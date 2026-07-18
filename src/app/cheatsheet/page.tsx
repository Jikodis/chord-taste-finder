'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { getTierRows, type TierRows } from '@/lib/tiersView'
import { getLifetimeStats, listGenerated } from '@/lib/db/storage'
import { DIMENSIONS, DIMENSION_LABELS, type Dimension } from '@/lib/items/catalog'
import { guitarShape } from '@/lib/music/guitar'
import { realizeChord } from '@/lib/music/realize'
import { midiToName, pcToName } from '@/lib/music/notes'
import { getScale } from '@/lib/music/scales'
import type { ProgressionDef } from '@/lib/music/progressions'

export default function CheatSheetPage() {
  const ready = useAppStore((s) => s.ready)
  const [rows, setRows] = useState<Partial<Record<Dimension, TierRows>>>({})
  const [saved, setSaved] = useState<ProgressionDef[]>([])
  const [stats, setStats] = useState<{ totalComparisons: number } | null>(null)
  const [generatedAt] = useState(() => new Date().toLocaleDateString())

  useEffect(() => {
    if (!ready) return
    void (async () => {
      const all: Partial<Record<Dimension, TierRows>> = {}
      for (const d of DIMENSIONS) all[d] = await getTierRows(d)
      setRows(all)
      setSaved((await listGenerated(true)).map((g) => g.progression))
      setStats(await getLifetimeStats())
    })()
  }, [ready])

  const ratedKeys = (rows.key ?? []).flatMap((r) => r.items.map((i) => ({ tier: r.tier, ...i })))

  return (
    <div className="print-page space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Taste cheat sheet</h1>
          <p className="mt-1 text-sm text-muted">
            Generated {generatedAt} · {stats?.totalComparisons ?? 0} comparisons
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="no-print rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Print / save as PDF
        </button>
      </header>

      {DIMENSIONS.map((d) => {
        const tierRows = rows[d] ?? []
        const any = tierRows.some((r) => r.items.length > 0)
        return (
          <section key={d} className="rounded-xl bg-surface p-4 print:bg-white print:p-0">
            <h2 className="mb-2 font-semibold">{DIMENSION_LABELS[d]}</h2>
            {!any && <p className="text-sm text-muted">Not yet rated.</p>}
            {tierRows
              .filter((r) => r.items.length > 0)
              .map((r) => (
                <div key={r.tier} className="mb-1 flex gap-2 text-sm">
                  <span className="w-6 shrink-0 font-bold">{r.tier}</span>
                  <span className="text-muted">
                    {r.items.slice(0, 12).map((i) => i.item.label).join(' · ')}
                    {r.items.length > 12 ? ` (+${r.items.length - 12} more)` : ''}
                  </span>
                </div>
              ))}
          </section>
        )
      })}

      <section className="rounded-xl bg-surface p-4 print:bg-white print:p-0">
        <h2 className="mb-2 font-semibold">Preferred keys, ranked</h2>
        {ratedKeys.length === 0 ? (
          <p className="text-sm text-muted">Not yet rated.</p>
        ) : (
          <p className="text-sm text-muted">
            {ratedKeys.slice(0, 15).map((k, i) => `${i + 1}. ${k.item.label}`).join('  ·  ')}
          </p>
        )}
      </section>

      <section className="rounded-xl bg-surface p-4 print:bg-white print:p-0">
        <h2 className="mb-3 font-semibold">Saved progressions</h2>
        {saved.length === 0 && (
          <p className="text-sm text-muted">None saved yet — bookmark favorites in the Generator.</p>
        )}
        <div className="space-y-4">
          {saved.map((p) => (
            <div key={p.id} className="border-t border-borderc pt-3 first:border-t-0 first:pt-0">
              <div className="text-sm font-semibold">
                {p.name} <span className="font-normal text-muted">in {pcToName(p.keyRootPc)} {getScale(p.scaleId)?.name}</span>
              </div>
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                {p.chords.map((c, i) => {
                  const shape = guitarShape(c.rootPc, c.qualityId)
                  const midi = realizeChord(c.rootPc, c.qualityId, 'root', 4)
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-16 font-bold">{c.roman}</span>
                      <span className="font-mono">{shape.notation}</span>
                      <span className="text-muted">{midi.map((m) => midiToName(m)).join(' ')}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
