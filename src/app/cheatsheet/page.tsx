'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { getTierRows, type TierRows } from '@/lib/tiersView'
import { getLifetimeStats, listGenerated } from '@/lib/db/storage'
import { DIMENSIONS, DIMENSION_LABELS, type Dimension } from '@/lib/items/catalog'
import {
  defaultKeyPc,
  topScales,
  topQualities,
  topProgressions,
  transposeProgression,
} from '@/lib/cheatsheetView'
import { realizeScale } from '@/lib/music/realize'
import { getScale } from '@/lib/music/scales'
import { pcToName, midiToName, NOTE_NAMES } from '@/lib/music/notes'
import type { ProgressionDef } from '@/lib/music/progressions'
import KeyboardDiagram from '@/components/KeyboardDiagram'
import ChordCard from '@/components/ChordCard'
import TierBadge from '@/components/TierBadge'

export default function CheatSheetPage() {
  const ready = useAppStore((s) => s.ready)
  const [rows, setRows] = useState<Partial<Record<Dimension, TierRows>>>({})
  const [saved, setSaved] = useState<ProgressionDef[]>([])
  const [stats, setStats] = useState<{ totalComparisons: number } | null>(null)
  const [generatedAt] = useState(() => new Date().toLocaleDateString())
  const [keyPc, setKeyPc] = useState<number | null>(null)

  useEffect(() => {
    if (!ready) return
    void (async () => {
      const all: Partial<Record<Dimension, TierRows>> = {}
      for (const d of DIMENSIONS) all[d] = await getTierRows(d)
      setRows(all)
      setSaved((await listGenerated(true)).map((g) => g.progression))
      setStats(await getLifetimeStats())
      setKeyPc((prev) => prev ?? defaultKeyPc(all.key ?? []))
    })()
  }, [ready])

  const pc = keyPc ?? 0
  const scales = topScales(rows.key ?? [])
  const qualities = topQualities(rows.quality ?? [])
  // Saved progressions first (explicit bookmarks), then top-rated, deduped
  const progs: ProgressionDef[] = []
  for (const p of [...saved, ...topProgressions(rows.progression ?? []).map((t) => t.progression)]) {
    if (!progs.some((x) => x.id === p.id)) progs.push(p)
  }

  return (
    <div className="print-page space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Taste cheat sheet</h1>
          <p className="mt-1 text-sm text-muted">
            In {pcToName(pc)} · generated {generatedAt} · {stats?.totalComparisons ?? 0} comparisons
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="key-picker" className="no-print text-sm text-muted">
            Key
          </label>
          <select
            id="key-picker"
            value={pc}
            onChange={(e) => setKeyPc(Number(e.target.value))}
            className="no-print rounded-lg bg-surface-2 px-3 py-2 text-sm"
          >
            {NOTE_NAMES.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="no-print rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Print / save as PDF
          </button>
        </div>
      </header>

      <section className="rounded-xl bg-surface p-4 print:bg-white print:p-0">
        <h2 className="mb-1 font-semibold">Your scales, on the keyboard</h2>
        <p className="mb-3 text-xs text-muted">
          Your top-rated scales, spelled out in {pcToName(pc)}. Purple keys are the scale.
        </p>
        {scales.length === 0 && <p className="text-sm text-muted">Not yet rated — visit Compare.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {scales.map((s) => {
            const midi = realizeScale(pc, s.scaleId)
            return (
              <div key={s.scaleId} className="rounded-lg bg-surface-2 p-3 print:bg-white">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <TierBadge tier={s.tier} size="sm" />
                  {pcToName(pc)} {getScale(s.scaleId)?.name ?? s.scaleId}
                </div>
                <KeyboardDiagram midi={midi} className="mt-2" />
                <div className="text-xs text-muted">{midi.map((m) => midiToName(m)).join(' ')}</div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-xl bg-surface p-4 print:bg-white print:p-0">
        <h2 className="mb-1 font-semibold">Your chords, on guitar and keys</h2>
        <p className="mb-3 text-xs text-muted">Top-rated chord qualities, rooted on {pcToName(pc)}.</p>
        {qualities.length === 0 && <p className="text-sm text-muted">Not yet rated — visit Compare.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {qualities.map((q) => (
            <ChordCard key={q.qualityId} rootPc={pc} qualityId={q.qualityId} />
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-surface p-4 print:bg-white print:p-0">
        <h2 className="mb-1 font-semibold">Your progressions, in {pcToName(pc)}</h2>
        <p className="mb-3 text-xs text-muted">
          Saved and top-rated progressions, transposed so you can play them in your key.
        </p>
        {progs.length === 0 && (
          <p className="text-sm text-muted">None yet — bookmark favorites in the Generator or rate progressions.</p>
        )}
        <div className="space-y-5">
          {progs.slice(0, 5).map((orig) => {
            const p = transposeProgression(orig, pc)
            return (
              <div key={p.id} className="border-t border-borderc pt-3 first:border-t-0 first:pt-0">
                <div className="text-sm font-semibold">
                  {p.name}{' '}
                  <span className="font-normal text-muted">
                    in {pcToName(p.keyRootPc)} {getScale(p.scaleId)?.name}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {p.chords.map((c, i) => (
                    <ChordCard key={i} rootPc={c.rootPc} qualityId={c.qualityId} roman={c.roman} compact />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {DIMENSIONS.map((d) => {
        const tierRows = rows[d] ?? []
        const any = tierRows.some((r) => r.items.length > 0)
        return (
          <section key={d} className="rounded-xl bg-surface p-4 print:bg-white print:p-0">
            <h2 className="mb-2 font-semibold">{DIMENSION_LABELS[d]} — full tier list</h2>
            {!any && <p className="text-sm text-muted">Not yet rated.</p>}
            {tierRows
              .filter((r) => r.items.length > 0)
              .map((r) => (
                <div key={r.tier} className="mb-1 flex gap-2 text-sm">
                  <span className="w-6 shrink-0 font-bold">{r.tier}</span>
                  <span className="text-muted">
                    {r.items
                      .slice(0, 12)
                      .map((i) =>
                        d === 'progression' && i.item.sublabel ? i.item.sublabel : i.item.label
                      )
                      .join(' · ')}
                    {r.items.length > 12 ? ` (+${r.items.length - 12} more)` : ''}
                  </span>
                </div>
              ))}
          </section>
        )
      })}
    </div>
  )
}
