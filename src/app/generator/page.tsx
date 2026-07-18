'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { getItemStats, saveGenerated, listGenerated, setGeneratedSaved } from '@/lib/db/storage'
import { assignTiers, TIER_ORDER, type Tier } from '@/lib/ranking/tiers'
import { generateProgression, type GeneratedProgressionView, type KeyCandidate, type QualityCandidate } from '@/lib/generator/generate'
import { playProgression, stop } from '@/lib/audio/engine'
import { guitarShape } from '@/lib/music/guitar'
import { midiToName, pcToName } from '@/lib/music/notes'
import { getScale } from '@/lib/music/scales'
import FretDiagram from '@/components/FretDiagram'
import KeyboardDiagram from '@/components/KeyboardDiagram'
import type { ProgressionDef } from '@/lib/music/progressions'
import type { GeneratorFilters } from '@/lib/db/db'

const THRESHOLDS: Array<{ label: string; tiers: Tier[] }> = [
  { label: 'S only', tiers: ['S'] },
  { label: 'S–A', tiers: ['S', 'A'] },
  { label: 'S–B', tiers: ['S', 'A', 'B'] },
  { label: 'S–C', tiers: ['S', 'A', 'B', 'C'] },
  { label: 'All rated', tiers: [...TIER_ORDER] },
]

interface Pools {
  keys: Array<KeyCandidate & { tier: Tier; label: string }>
  qualities: Array<QualityCandidate & { tier: Tier }>
  bestVoicing: Map<string, string>
}

async function loadPools(): Promise<Pools> {
  const [keyStats, qualStats, voicStats] = await Promise.all([
    getItemStats('key'),
    getItemStats('quality'),
    getItemStats('voicing'),
  ])
  const ratedKeys = keyStats.filter((s) => s.comparisons > 0)
  const ratedQuals = qualStats.filter((s) => s.comparisons > 0)
  const keyTiers = assignTiers(new Map(ratedKeys.map((s) => [s.itemId, s.rating])))
  const qualTiers = assignTiers(new Map(ratedQuals.map((s) => [s.itemId, s.rating])))

  const keys = ratedKeys.map((s) => {
    const [, root, scaleId] = s.itemId.split(':')
    const rootPc = Number(root)
    return {
      itemId: s.itemId,
      rootPc,
      scaleId,
      rating: s.rating,
      tier: keyTiers.get(s.itemId)!,
      label: `${pcToName(rootPc)} ${getScale(scaleId)?.name ?? scaleId}`,
    }
  })
  const qualities = ratedQuals.map((s) => ({
    qualityId: s.itemId.replace(/^qual:/, ''),
    rating: s.rating,
    tier: qualTiers.get(s.itemId)!,
  }))

  const bestVoicing = new Map<string, string>()
  const bestRating = new Map<string, number>()
  for (const v of voicStats.filter((s) => s.comparisons > 0)) {
    const [, qualityId, voicingId] = v.itemId.split(':')
    if ((bestRating.get(qualityId) ?? -Infinity) < v.rating) {
      bestRating.set(qualityId, v.rating)
      bestVoicing.set(qualityId, voicingId)
    }
  }
  return { keys, qualities, bestVoicing }
}

export default function GeneratorPage() {
  const ready = useAppStore((s) => s.ready)
  const settings = useAppStore((s) => s.settings)
  const [pools, setPools] = useState<Pools | null>(null)
  const [qualityThreshold, setQualityThreshold] = useState(1)
  const [keyThreshold, setKeyThreshold] = useState(1)
  const [length, setLength] = useState(4)
  const [lockedKey, setLockedKey] = useState<string>('')
  const [result, setResult] = useState<GeneratedProgressionView | null>(null)
  const [saved, setSaved] = useState<Array<{ id: number; progression: ProgressionDef }>>([])
  const [notice, setNotice] = useState<string | null>(null)

  const refreshSaved = useCallback(async () => {
    const rows = await listGenerated(true)
    setSaved(rows.filter((r) => r.id !== undefined).map((r) => ({ id: r.id!, progression: r.progression })))
  }, [])

  useEffect(() => {
    if (!ready) return
    void (async () => {
      setPools(await loadPools())
      await refreshSaved()
    })()
  }, [ready, refreshSaved])

  const allowedKeys = pools?.keys.filter((k) => THRESHOLDS[keyThreshold].tiers.includes(k.tier)) ?? []
  const allowedQualities =
    pools?.qualities.filter((q) => THRESHOLDS[qualityThreshold].tiers.includes(q.tier)) ?? []

  const generate = () => {
    setNotice(null)
    if (allowedKeys.length === 0 || allowedQualities.length < 2) {
      const missing = allowedKeys.length === 0 ? 'Keys & Scales' : 'Chord Qualities'
      setNotice(`You need more comparisons in ${missing} to use these filters.`)
      setResult(null)
      return
    }
    const view = generateProgression({
      keys: allowedKeys,
      qualities: allowedQualities,
      bestVoicing: pools!.bestVoicing,
      length,
      lockedKeyItemId: lockedKey || null,
    })
    setResult(view)
  }

  const play = async () => {
    if (!result) return
    stop()
    await playProgression(result.chords.map((c) => c.midi), settings.instrument, settings.tempoBpm)
  }

  const save = async () => {
    if (!result) return
    const progression: ProgressionDef = {
      id: `gen-${Date.now()}`,
      name: result.chords.map((c) => c.roman).join('–'),
      keyRootPc: result.keyRootPc,
      scaleId: result.scaleId,
      chords: result.chords.map((c) => ({ rootPc: c.rootPc, qualityId: c.qualityId, roman: c.roman })),
      tags: { movement: 'diatonic', source: 'novel' },
    }
    const filters: GeneratorFilters = {
      qualityTiers: THRESHOLDS[qualityThreshold].tiers,
      keyTiers: THRESHOLDS[keyThreshold].tiers,
      length,
      lockedKeyItemId: lockedKey || null,
    }
    await saveGenerated({ at: Date.now(), progression, filters, saved: true })
    await refreshSaved()
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Progression generator</h1>
        <p className="mt-1 text-sm text-muted">
          Built entirely from what you&apos;ve rated — your taste, no watered-down conventions.
        </p>
      </header>

      <section className="grid gap-4 rounded-xl bg-surface p-5 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Chord quality tiers</span>
          <select
            value={qualityThreshold}
            onChange={(e) => setQualityThreshold(Number(e.target.value))}
            className="w-full rounded-lg bg-surface-2 p-2"
          >
            {THRESHOLDS.map((t, i) => (
              <option key={t.label} value={i}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Key tiers</span>
          <select
            value={keyThreshold}
            onChange={(e) => setKeyThreshold(Number(e.target.value))}
            className="w-full rounded-lg bg-surface-2 p-2"
          >
            {THRESHOLDS.map((t, i) => (
              <option key={t.label} value={i}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Length: {length} chords</span>
          <input
            type="range"
            min={2}
            max={8}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Key</span>
          <select
            value={lockedKey}
            onChange={(e) => setLockedKey(e.target.value)}
            className="w-full rounded-lg bg-surface-2 p-2"
          >
            <option value="">Let my taste choose</option>
            {allowedKeys.map((k) => (
              <option key={k.itemId} value={k.itemId}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-3 sm:col-span-2">
          <button
            onClick={generate}
            className="flex-1 rounded-lg bg-accent py-3 font-semibold text-white transition hover:opacity-90"
          >
            {result ? 'Regenerate' : 'Generate'}
          </button>
          {result && (
            <>
              <button onClick={() => void play()} className="rounded-lg bg-surface-2 px-5 py-3 transition hover:bg-accent-soft">
                ▶ Play
              </button>
              <button onClick={() => void save()} className="rounded-lg bg-surface-2 px-5 py-3 transition hover:bg-accent-soft">
                ☆ Save
              </button>
            </>
          )}
        </div>
      </section>

      {notice && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          {notice}{' '}
          <Link href="/compare" className="underline">
            Start comparing?
          </Link>
        </div>
      )}

      {result && (
        <section className="rounded-xl bg-surface p-5">
          <h2 className="mb-1 font-semibold">
            {result.chords.map((c) => c.roman).join(' – ')}{' '}
            <span className="text-sm font-normal text-muted">in {result.keyLabel}</span>
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {result.chords.map((c, i) => {
              const shape = guitarShape(c.rootPc, c.qualityId)
              return (
                <div key={i} className="rounded-lg bg-surface-2 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold">{c.symbol}</span>
                    <span className="text-sm text-muted">{c.roman}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <div>
                      <FretDiagram shape={shape} />
                      <div className="mt-1 font-mono text-xs text-muted">{shape.notation}</div>
                    </div>
                    <div>
                      <KeyboardDiagram midi={c.midi} />
                      <div className="mt-1 text-xs text-muted">{c.midi.map((m) => midiToName(m)).join(' ')}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {saved.length > 0 && (
        <section className="rounded-xl bg-surface p-5">
          <h2 className="mb-3 font-semibold">Saved progressions</h2>
          <ul className="space-y-2 text-sm">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
                <span>
                  {s.progression.name}{' '}
                  <span className="text-xs text-muted">
                    in {pcToName(s.progression.keyRootPc)} {getScale(s.progression.scaleId)?.name}
                  </span>
                </span>
                <button
                  onClick={() => void setGeneratedSaved(s.id, false).then(refreshSaved)}
                  className="text-xs text-muted hover:text-foreground"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
