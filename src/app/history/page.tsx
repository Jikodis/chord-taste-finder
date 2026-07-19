'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import {
  getRecentComparisons,
  deleteComparison,
  updateComparisonWinner,
} from '@/lib/db/storage'
import type { ComparisonRow } from '@/lib/db/db'
import { catalogItem } from '@/lib/items/lookup'
import { DIMENSION_LABELS } from '@/lib/items/catalog'
import { playItem } from '@/lib/audio/playItem'
import { stop } from '@/lib/audio/engine'

const PAGE_SIZE = 40

function timeAgo(at: number): string {
  const mins = Math.floor((Date.now() - at) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function HistoryPage() {
  const ready = useAppStore((s) => s.ready)
  const settings = useAppStore((s) => s.settings)
  const [rows, setRows] = useState<ComparisonRow[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    setRows(await getRecentComparisons(PAGE_SIZE))
  }, [])

  useEffect(() => {
    if (!ready) return
    void (async () => {
      await refresh()
    })()
    return () => stop()
  }, [ready, refresh])

  const withBusy = useCallback(
    async (id: number, fn: () => Promise<void>) => {
      setBusyId(id)
      await fn()
      await refresh()
      setBusyId(null)
    },
    [refresh]
  )

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-xl font-bold">Vote history</h1>
        <p className="mt-1 text-sm text-muted">
          Your last {PAGE_SIZE} comparisons. Pick the other side to change a vote, or undo it entirely —
          ratings are recalculated from scratch either way.
        </p>
      </header>

      {rows.length === 0 && (
        <div className="rounded-lg bg-surface p-6 text-center text-sm text-muted">
          No comparisons yet. Head to Compare to start rating.
        </div>
      )}

      <ul className="space-y-2">
        {rows.map((row) => {
          const winner = catalogItem(row.winnerId)
          const loserId = row.winnerId === row.aId ? row.bId : row.aId
          const loser = catalogItem(loserId)
          const busy = busyId === row.id

          return (
            <li
              key={row.id}
              className={`rounded-xl border border-borderc bg-surface p-3 transition ${busy ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{DIMENSION_LABELS[row.dimension]}</span>
                <span>{timeAgo(row.at)}</span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { id: row.winnerId, item: winner, won: true },
                  { id: loserId, item: loser, won: false },
                ].map(({ id, item, won }) => {
                  // Neither label nor sublabel is unique on its own: progressions repeat the
                  // label across keys, voicings repeat the sublabel across shapes.
                  const extra = item?.sublabel && item.sublabel !== item.label ? item.sublabel : null
                  const fullName = [item?.label ?? id, extra].filter(Boolean).join(', ')
                  return (
                  <div
                    key={id}
                    className={`rounded-lg border-2 p-2 ${won ? 'border-accent bg-accent-soft' : 'border-transparent bg-surface-2'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{item?.label ?? id}</span>
                      <button
                        onClick={() => item && void playItem(item, settings.instrument, settings.tempoBpm)}
                        className="shrink-0 rounded px-1.5 py-0.5 text-xs transition hover:bg-surface"
                        aria-label={`Play ${fullName}`}
                      >
                        ▶
                      </button>
                    </div>
                    {extra && (
                      <div className="truncate text-xs text-muted" title={extra}>
                        {extra}
                      </div>
                    )}
                    {won ? (
                      <div className="mt-1 text-xs text-accent">Your pick</div>
                    ) : (
                      <button
                        onClick={() => void withBusy(row.id!, () => updateComparisonWinner(row.id!, id))}
                        disabled={busy}
                        className="mt-1 text-xs text-muted underline transition hover:text-foreground disabled:opacity-40"
                        aria-label={`Change this vote to ${fullName}`}
                      >
                        Pick this instead
                      </button>
                    )}
                  </div>
                  )
                })}
              </div>

              <button
                onClick={() => void withBusy(row.id!, () => deleteComparison(row.id!))}
                disabled={busy}
                className="mt-2 text-xs text-muted transition hover:text-foreground disabled:opacity-40"
              >
                ✕ Undo this vote
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
