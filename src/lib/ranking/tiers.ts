export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F'

/** Distribution-based bands, top-down (PRD §3.2.2). */
export const TIER_BANDS: Array<[Tier, number]> = [
  ['S', 0.05],
  ['A', 0.15],
  ['B', 0.2],
  ['C', 0.2],
  ['D', 0.2],
  ['F', 0.2],
]

export const TIER_ORDER: Tier[] = ['S', 'A', 'B', 'C', 'D', 'F']

/** Assign percentile tiers from ratings. Ties broken by insertion order. */
export function assignTiers(ratings: Map<string, number>): Map<string, Tier> {
  const sorted = [...ratings.entries()].sort((a, b) => b[1] - a[1])
  const n = sorted.length
  const out = new Map<string, Tier>()
  if (n === 0) return out
  let idx = 0
  let cumulative = 0
  for (const [tier, frac] of TIER_BANDS) {
    cumulative += frac
    const end = tier === 'F' ? n : Math.round(cumulative * n)
    while (idx < end && idx < n) {
      out.set(sorted[idx][0], tier)
      idx++
    }
  }
  return out
}
