'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { getTierRows, type TierRows } from '@/lib/tiersView'
import { DIMENSIONS, DIMENSION_LABELS, type Dimension } from '@/lib/items/catalog'
import TierBadge from '@/components/TierBadge'
import PlayButton from '@/components/PlayButton'

export default function TiersPage() {
  const ready = useAppStore((s) => s.ready)
  const [dimension, setDimension] = useState<Dimension>('key')
  const [rows, setRows] = useState<TierRows>([])
  const [loaded, setLoaded] = useState<Dimension | null>(null)
  const loading = loaded !== dimension

  useEffect(() => {
    if (!ready) return
    void (async () => {
      const r = await getTierRows(dimension)
      setRows(r)
      setLoaded(dimension)
    })()
  }, [ready, dimension])

  const total = rows.reduce((s, r) => s + r.items.length, 0)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Tier lists</h1>
        <p className="mt-1 text-sm text-muted">
          Ranked by your comparisons. Items marked <span className="text-amber-400">?</span> need more
          testing — tap one to target it in the arena.
        </p>
      </header>

      <div className="no-print flex flex-wrap gap-2">
        {DIMENSIONS.map((d) => (
          <button
            key={d}
            onClick={() => setDimension(d)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              dimension === d ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-foreground'
            }`}
          >
            {DIMENSION_LABELS[d]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted">Loading…</div>
      ) : total === 0 ? (
        <div className="rounded-xl bg-surface p-8 text-center text-sm text-muted">
          Nothing rated in {DIMENSION_LABELS[dimension]} yet.{' '}
          <Link href="/compare" className="text-accent underline">
            Start comparing
          </Link>{' '}
          to build this tier list.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ tier, items }) => (
            <div key={tier} className="flex gap-3 rounded-xl bg-surface p-3">
              <div className="shrink-0 pt-1">
                <TierBadge tier={tier} size="lg" />
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {items.length === 0 && <span className="py-2 text-xs text-muted">—</span>}
                {items.map((ti) => (
                  <div
                    key={ti.item.id}
                    className={`flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm ${
                      ti.confidence < 1 ? 'border border-dashed border-amber-400/50' : ''
                    }`}
                  >
                    <PlayButton item={ti.item} />
                    <span>{ti.item.label}</span>
                    <span className="text-xs text-muted">{Math.round(ti.rating)}</span>
                    {ti.confidence < 1 && (
                      <Link
                        href={`/compare?target=${encodeURIComponent(ti.item.id)}`}
                        title="Low confidence — run targeted comparisons"
                        className="text-amber-400"
                      >
                        ?
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
