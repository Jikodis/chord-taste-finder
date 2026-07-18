'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { getProgress, getLifetimeStats, getItemStats, type DimensionProgress } from '@/lib/db/storage'
import { CONVERGED_N } from '@/lib/ranking/matchup'
import { DIMENSION_LABELS } from '@/lib/items/catalog'
import ProgressBar from '@/components/ProgressBar'

interface Projection {
  dimension: string
  remainingComparisons: number
  eta: string
}

export default function ProgressPage() {
  const ready = useAppStore((s) => s.ready)
  const [progress, setProgress] = useState<{ perDimension: DimensionProgress[]; overallPercent: number } | null>(null)
  const [stats, setStats] = useState<{ totalComparisons: number; sessions: number; comparisonsPerDay: number } | null>(null)
  const [projections, setProjections] = useState<Projection[]>([])

  useEffect(() => {
    if (!ready) return
    void (async () => {
      const [p, s, itemStats] = await Promise.all([getProgress(), getLifetimeStats(), getItemStats()])
      setProgress(p)
      setStats(s)
      const projs: Projection[] = p.perDimension.map((d) => {
        const items = itemStats.filter((i) => i.dimension === d.dimension)
        // Each comparison advances two items one step each
        const remaining = Math.ceil(
          items.reduce((sum, i) => sum + Math.max(0, CONVERGED_N - i.comparisons), 0) / 2
        )
        let eta = '—'
        if (remaining === 0) {
          eta = 'Complete'
        } else if (s.comparisonsPerDay > 0.5) {
          const days = Math.ceil(remaining / s.comparisonsPerDay)
          const date = new Date(Date.now() + days * 24 * 3600 * 1000)
          eta = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        } else {
          eta = 'Need more sessions to project'
        }
        return { dimension: DIMENSION_LABELS[d.dimension], remainingComparisons: remaining, eta }
      })
      setProjections(projs)
    })()
  }, [ready])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="mt-1 text-sm text-muted">
          An item is settled after {CONVERGED_N} comparisons. Projections use your average pace over
          the last two weeks.
        </p>
      </header>

      <section className="rounded-xl bg-surface p-5">
        <div className="text-4xl font-bold">{progress?.overallPercent ?? 0}%</div>
        <div className="text-sm text-muted">overall taste profile mapped</div>
        <div className="mt-5 space-y-4">
          {progress?.perDimension.map((d) => (
            <div key={d.dimension}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{DIMENSION_LABELS[d.dimension]}</span>
                <span className="text-muted">
                  {d.percent}% · {d.converged}/{d.total} items settled
                </span>
              </div>
              <ProgressBar percent={d.percent} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-surface p-5">
        <h2 className="mb-3 font-semibold">Projected completion</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="pb-2">Dimension</th>
              <th className="pb-2">Comparisons left</th>
              <th className="pb-2">Projected date</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((p) => (
              <tr key={p.dimension} className="border-t border-borderc">
                <td className="py-2">{p.dimension}</td>
                <td className="py-2">{p.remainingComparisons}</td>
                <td className="py-2">{p.eta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid grid-cols-3 gap-4">
        {[
          { label: 'Lifetime comparisons', value: stats?.totalComparisons ?? 0 },
          { label: 'Sessions', value: stats?.sessions ?? 0 },
          { label: 'Avg / day (14d)', value: (stats?.comparisonsPerDay ?? 0).toFixed(1) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-surface p-4 text-center">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="mt-1 text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </section>
    </div>
  )
}
