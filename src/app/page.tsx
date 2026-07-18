'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { getProgress, getLifetimeStats, getRecentComparisons, type DimensionProgress } from '@/lib/db/storage'
import { getTierRows, exportReminder, type ExportReminder } from '@/lib/tiersView'
import { DIMENSIONS, DIMENSION_LABELS, type Dimension } from '@/lib/items/catalog'
import { catalogItem } from '@/lib/items/lookup'
import ProgressBar from '@/components/ProgressBar'
import TierBadge from '@/components/TierBadge'
import type { Tier } from '@/lib/ranking/tiers'

interface TopItem {
  dimension: Dimension
  tier: Tier
  label: string
}

export default function Dashboard() {
  const ready = useAppStore((s) => s.ready)
  const settings = useAppStore((s) => s.settings)
  const [progress, setProgress] = useState<{ perDimension: DimensionProgress[]; overallPercent: number } | null>(null)
  const [stats, setStats] = useState<{ totalComparisons: number; sessions: number } | null>(null)
  const [tops, setTops] = useState<TopItem[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [reminder, setReminder] = useState<ExportReminder>({ due: false, reason: '' })

  useEffect(() => {
    if (!ready) return
    void (async () => {
      const [p, s, r] = await Promise.all([getProgress(), getLifetimeStats(), getRecentComparisons(6)])
      setProgress(p)
      setStats(s)
      setReminder(exportReminder(s.totalComparisons, settings.lastExportAt, settings.comparisonsAtLastExport))
      setRecent(
        r.map((c) => {
          const winner = catalogItem(c.winnerId)
          const loser = catalogItem(c.winnerId === c.aId ? c.bId : c.aId)
          return `${winner?.label ?? '?'} beat ${loser?.label ?? '?'}`
        })
      )
      const topItems: TopItem[] = []
      for (const d of DIMENSIONS) {
        const rows = await getTierRows(d)
        const best = rows.flatMap((row) => row.items.map((i) => ({ row, i }))).slice(0, 2)
        for (const { row, i } of best) {
          topItems.push({ dimension: d, tier: row.tier, label: i.item.label })
        }
      }
      setTops(topItems)
    })()
  }, [ready, settings.lastExportAt, settings.comparisonsAtLastExport])

  const isNew = (stats?.totalComparisons ?? 0) === 0

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Your taste profile</h1>
        <p className="mt-1 text-sm text-muted">
          Discover your chord taste through listening comparisons.
        </p>
      </header>

      {reminder.due && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <span className="font-semibold">Back up your data:</span> {reminder.reason}.{' '}
          <Link href="/settings" className="underline">
            Export now
          </Link>
          {' '}— V1 stores everything on this device only.
        </div>
      )}

      <section className="rounded-xl bg-surface p-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-4xl font-bold">{progress?.overallPercent ?? 0}%</div>
            <div className="text-sm text-muted">of your taste profile mapped</div>
          </div>
          <Link
            href="/compare"
            className="rounded-lg bg-accent px-5 py-3 font-semibold text-white transition hover:opacity-90"
          >
            {isNew ? 'Start comparing' : 'Continue comparing'}
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {progress?.perDimension.map((d) => (
            <div key={d.dimension}>
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>{DIMENSION_LABELS[d.dimension]}</span>
                <span>
                  {d.percent}% · {d.converged}/{d.total} settled
                </span>
              </div>
              <ProgressBar percent={d.percent} />
            </div>
          ))}
        </div>
      </section>

      {isNew ? (
        <section className="rounded-xl bg-surface p-5 text-sm leading-relaxed text-muted">
          <h2 className="mb-2 text-base font-semibold text-foreground">How it works</h2>
          <p>
            You&apos;ll hear two musical options — keys, chords, voicings, or progressions — and pick
            the one you prefer. Each choice sharpens your profile. There are no wrong answers: the
            app maps what <em>you</em> love, not what theory says is correct. Expect thousands of
            comparisons over weeks; every one counts.
          </p>
        </section>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl bg-surface p-5">
            <h2 className="mb-3 font-semibold">Current favorites</h2>
            {tops.length === 0 && <p className="text-sm text-muted">Not enough data yet — keep comparing.</p>}
            <ul className="space-y-2">
              {tops.map((t, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <TierBadge tier={t.tier} size="sm" />
                  <span>{t.label}</span>
                  <span className="ml-auto text-xs text-muted">{DIMENSION_LABELS[t.dimension]}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl bg-surface p-5">
            <h2 className="mb-3 font-semibold">Recent activity</h2>
            <ul className="space-y-2 text-sm text-muted">
              {recent.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <div className="mt-3 text-xs text-muted">
              {stats?.totalComparisons ?? 0} lifetime comparisons · {stats?.sessions ?? 0} sessions
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
