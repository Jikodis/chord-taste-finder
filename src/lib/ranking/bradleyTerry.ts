import { INITIAL_ELO } from './elo'

export interface ComparisonRecord {
  winnerId: string
  loserId: string
}

const MAX_ITERATIONS = 200
const TOLERANCE = 1e-6
/** Pseudo-count regularization: every item gets a fractional win+loss against a virtual opponent. */
const PRIOR = 0.5

/**
 * Fit a Bradley-Terry model over the full comparison history using the
 * minorization-maximization (MM) algorithm, returning Elo-scaled ratings
 * centered on INITIAL_ELO. Items not present in any comparison are omitted.
 */
export function fitBradleyTerry(comparisons: ComparisonRecord[]): Map<string, number> {
  const ids = new Set<string>()
  for (const c of comparisons) {
    ids.add(c.winnerId)
    ids.add(c.loserId)
  }
  const items = [...ids]
  if (items.length === 0) return new Map()
  const index = new Map(items.map((id, i) => [id, i]))
  const n = items.length

  const wins = new Array<number>(n).fill(PRIOR)
  // pairCount[i][j] = games between i and j (sparse)
  const pairCount = new Map<string, number>()
  const pairKey = (i: number, j: number) => (i < j ? `${i}|${j}` : `${j}|${i}`)
  for (const c of comparisons) {
    const wi = index.get(c.winnerId)!
    const li = index.get(c.loserId)!
    wins[wi] += 1
    const key = pairKey(wi, li)
    pairCount.set(key, (pairCount.get(key) ?? 0) + 1)
  }

  let p = new Array<number>(n).fill(1)
  const virtualGames = 2 * PRIOR // each item also "played" the virtual average opponent (strength 1)

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const denom = new Array<number>(n).fill(virtualGames / (1 + 0)) // placeholder, replaced below
    for (let i = 0; i < n; i++) denom[i] = virtualGames / (p[i] + 1)
    for (const [key, count] of pairCount) {
      const [i, j] = key.split('|').map(Number)
      const shared = count / (p[i] + p[j])
      denom[i] += shared
      denom[j] += shared
    }
    const next = p.map((_, i) => wins[i] / denom[i])
    // Normalize by geometric mean for identifiability
    const logSum = next.reduce((s, x) => s + Math.log(x), 0)
    const gm = Math.exp(logSum / n)
    for (let i = 0; i < n; i++) next[i] /= gm
    const maxDelta = Math.max(...next.map((x, i) => Math.abs(x - p[i])))
    p = next
    if (maxDelta < TOLERANCE) break
  }

  const scale = 400 / Math.LN10
  return new Map(items.map((id, i) => [id, INITIAL_ELO + scale * Math.log(p[i])]))
}
