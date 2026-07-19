'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { getItemStats, recordComparison, deleteComparison } from '@/lib/db/storage'
import { selectMatchup, CONVERGED_N } from '@/lib/ranking/matchup'
import { catalogItem } from '@/lib/items/lookup'
import { DIMENSION_LABELS, type CatalogItem, type Dimension } from '@/lib/items/catalog'
import { playItem } from '@/lib/audio/playItem'
import { stop } from '@/lib/audio/engine'

const CALIBRATION_ROUNDS = 8

interface Matchup {
  a: CatalogItem
  b: CatalogItem
  dimension: Dimension
  maintenance: boolean
}

interface LastResult {
  comparisonId: number
  winner: string
  loser: string
  delta: number
}

/** Rough playback length so auto-play B can follow A. */
function estimateSeconds(item: CatalogItem, bpm: number): number {
  const p = item.payload
  switch (p.kind) {
    case 'key':
      return 8 * 0.28 + 0.8
    case 'quality':
    case 'voicing':
      return 2.0
    case 'progression':
      return p.progression.chords.length * (60 / bpm) * 2 + 0.4
  }
}

function ArenaInner() {
  const ready = useAppStore((s) => s.ready)
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const sessionId = useAppStore((s) => s.sessionId)
  const searchParams = useSearchParams()
  const router = useRouter()

  const [matchup, setMatchup] = useState<Matchup | null>(null)
  const [sessionCount, setSessionCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [last, setLast] = useState<LastResult | null>(null)
  const [playingSide, setPlayingSide] = useState<'A' | 'B' | null>(null)
  const [busy, setBusy] = useState(false)
  const recentDims = useRef<Dimension[]>([])
  const autoplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadNext = useCallback(async (targetId?: string | null) => {
    const stats = await getItemStats()
    setTotalCount(stats.reduce((s, i) => s + i.comparisons, 0) / 2)
    let next: Matchup | null = null
    if (targetId) {
      const target = stats.find((s) => s.itemId === targetId)
      if (target) {
        const pool = stats
          .filter((s) => s.dimension === target.dimension && s.itemId !== target.itemId)
          .sort((x, y) => Math.abs(x.rating - target.rating) - Math.abs(y.rating - target.rating))
        const opponent = pool[Math.floor(Math.random() * Math.min(4, pool.length))]
        if (opponent) {
          next = {
            a: catalogItem(target.itemId)!,
            b: catalogItem(opponent.itemId)!,
            dimension: target.dimension,
            maintenance: false,
          }
        }
      }
    }
    if (!next) {
      const m = selectMatchup(stats, recentDims.current)
      if (!m) return
      next = { a: catalogItem(m.aId)!, b: catalogItem(m.bId)!, dimension: m.dimension, maintenance: m.maintenance }
    }
    recentDims.current = [...recentDims.current.slice(-6), next.dimension]
    setMatchup(next)
  }, [])

  useEffect(() => {
    if (!ready) return
    const target = searchParams.get('target')
    void (async () => {
      await loadNext(target)
    })()
    return () => {
      if (autoplayTimer.current) clearTimeout(autoplayTimer.current)
      stop()
    }
  }, [ready, loadNext, searchParams])

  const playRef = useRef<((side: 'A' | 'B', thenOther?: boolean) => Promise<void>) | null>(null)

  const play = useCallback(
    async (side: 'A' | 'B', thenOther = false) => {
      if (!matchup) return
      if (autoplayTimer.current) clearTimeout(autoplayTimer.current)
      const item = side === 'A' ? matchup.a : matchup.b
      setPlayingSide(side)
      await playItem(item, settings.instrument, settings.tempoBpm)
      const secs = estimateSeconds(item, settings.tempoBpm)
      autoplayTimer.current = setTimeout(() => {
        if (thenOther && side === 'A') {
          void playRef.current?.('B')
        } else {
          setPlayingSide(null)
        }
      }, secs * 1000)
    },
    [matchup, settings.instrument, settings.tempoBpm]
  )
  useEffect(() => {
    playRef.current = play
  }, [play])

  const choose = useCallback(
    async (side: 'A' | 'B') => {
      if (!matchup || busy) return
      setBusy(true)
      stop()
      const winner = side === 'A' ? matchup.a : matchup.b
      const loser = side === 'A' ? matchup.b : matchup.a
      const res = await recordComparison({
        aId: matchup.a.id,
        bId: matchup.b.id,
        winnerId: winner.id,
        dimension: matchup.dimension,
        sessionId,
      })
      setLast({
        comparisonId: res.comparisonId,
        winner: winner.label,
        loser: loser.label,
        delta: Math.round(res.newWinnerRating - 1500),
      })
      const newSession = sessionCount + 1
      setSessionCount(newSession)
      if (!settings.calibrated && newSession >= CALIBRATION_ROUNDS) {
        await updateSettings({ calibrated: true })
      }
      if (searchParams.get('target')) router.replace('/compare')
      await loadNext()
      setBusy(false)
    },
    [matchup, busy, sessionId, sessionCount, settings.calibrated, updateSettings, loadNext, searchParams, router]
  )

  /** Undo the vote just cast, leaving the current matchup in place. */
  const undoLast = useCallback(async () => {
    if (!last || busy) return
    setBusy(true)
    await deleteComparison(last.comparisonId)
    const stats = await getItemStats()
    setTotalCount(stats.reduce((s, i) => s + i.comparisons, 0) / 2)
    setSessionCount((c) => Math.max(0, c - 1))
    setLast(null)
    setBusy(false)
  }, [last, busy])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'ArrowLeft') void choose('A')
      if (e.key === 'b' || e.key === 'ArrowRight') void choose('B')
      if (e.key === 'u') void undoLast()
      if (e.key === '1') void play('A')
      if (e.key === '2') void play('B')
      if (e.key === ' ') {
        e.preventDefault()
        void play('A', true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choose, play, undoLast])

  if (!matchup) {
    return <div className="py-24 text-center text-muted">Preparing your first matchup…</div>
  }

  const inCalibration = !settings.calibrated && totalCount < CALIBRATION_ROUNDS

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header className="text-center">
        <div className="text-xs uppercase tracking-widest text-accent">
          {inCalibration
            ? `Calibration round ${Math.min(sessionCount + 1, CALIBRATION_ROUNDS)}/${CALIBRATION_ROUNDS}`
            : matchup.maintenance
              ? 'Maintenance retest — checking for taste drift'
              : `${DIMENSION_LABELS[matchup.dimension]} comparison`}
        </div>
        <h1 className="mt-1 text-xl font-bold">Which do you prefer?</h1>
        <p className="mt-1 text-xs text-muted">
          Listen to both, then choose. Keys: 1/2 to play, A/B (or ←/→) to pick, space to play both, U to undo.
        </p>
      </header>

      <button
        onClick={() => void play('A', true)}
        className="w-full rounded-lg bg-surface-2 py-2.5 text-sm font-medium transition hover:bg-accent-soft"
      >
        ▶ Play both (A then B)
      </button>

      <div className="grid grid-cols-2 gap-4">
        {(['A', 'B'] as const).map((side) => (
          <div
            key={side}
            className={`flex flex-col items-center gap-3 rounded-xl border-2 bg-surface p-5 transition ${
              playingSide === side ? 'border-accent' : 'border-transparent'
            }`}
          >
            <div className="text-3xl font-bold text-muted">{side}</div>
            <button
              onClick={() => void play(side)}
              className="w-full rounded-lg bg-surface-2 py-3 text-2xl transition hover:bg-accent-soft"
              aria-label={`Play option ${side}`}
            >
              {playingSide === side ? '♪' : '▶'}
            </button>
            <button
              onClick={() => void choose(side)}
              disabled={busy}
              className="w-full rounded-lg bg-accent py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              Prefer {side}
            </button>
          </div>
        ))}
      </div>

      {last && (
        <div className="flex items-center justify-center gap-3 rounded-lg bg-surface p-3 text-center text-sm text-muted">
          <span>
            <span className="text-foreground">{last.winner}</span> beat {last.loser}
          </span>
          <button
            onClick={() => void undoLast()}
            disabled={busy}
            className="rounded bg-surface-2 px-2 py-1 text-xs transition hover:bg-accent-soft disabled:opacity-40"
          >
            Undo (u)
          </button>
        </div>
      )}

      <footer className="flex justify-between text-xs text-muted">
        <span>This session: {sessionCount}</span>
        <span>Lifetime: {Math.round(totalCount)}</span>
        <span>Settled at {CONVERGED_N}+ tests/item</span>
      </footer>
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-muted">Loading…</div>}>
      <ArenaInner />
    </Suspense>
  )
}
