import type { Dimension } from '../items/catalog'
import { DIMENSIONS } from '../items/catalog'

/** Comparisons needed before an item counts as converged (deprioritized). */
export const CONVERGED_N = 12
/** Never serve the same dimension more than this many times in a row. */
export const MAX_DIMENSION_STREAK = 3

export interface ItemStats {
  itemId: string
  dimension: Dimension
  rating: number
  comparisons: number
  lastComparedAt: number // epoch ms, 0 = never
}

/** 0..1 confidence that an item's rating has settled. */
export function confidence(stats: Pick<ItemStats, 'comparisons'>): number {
  return Math.min(1, stats.comparisons / CONVERGED_N)
}

export interface Matchup {
  dimension: Dimension
  aId: string
  bId: string
  /** True when every item in every dimension has converged (maintenance retest). */
  maintenance: boolean
}

/**
 * Uncertainty-driven matchup selection (PRD §3.1.2):
 * - Prefer dimensions with unconverged items; never repeat one >MAX_DIMENSION_STREAK in a row.
 * - Within a dimension prefer the least-tested items, paired with a close-rated opponent.
 * - Once everything has converged, switch to maintenance mode: retest the
 *   least-recently-compared close pairs at low frequency (drift detection, PRD §3.2.3).
 */
export function selectMatchup(
  stats: ItemStats[],
  recentDimensions: Dimension[],
  rand: () => number = Math.random
): Matchup | null {
  if (stats.length < 2) return null
  const byDim = new Map<Dimension, ItemStats[]>()
  for (const s of stats) {
    const list = byDim.get(s.dimension) ?? []
    list.push(s)
    byDim.set(s.dimension, list)
  }

  const streakDim =
    recentDimensions.length >= MAX_DIMENSION_STREAK &&
    recentDimensions.slice(-MAX_DIMENSION_STREAK).every((d) => d === recentDimensions[recentDimensions.length - 1])
      ? recentDimensions[recentDimensions.length - 1]
      : null

  const eligibleDims = DIMENSIONS.filter((d) => (byDim.get(d)?.length ?? 0) >= 2 && d !== streakDim)
  if (eligibleDims.length === 0) return null

  // Weight dimensions by number of unconverged items (+1 so converged dims stay reachable)
  const weights = eligibleDims.map((d) => {
    const items = byDim.get(d)!
    return 1 + items.filter((s) => s.comparisons < CONVERGED_N).length
  })
  const allConverged = stats.every((s) => s.comparisons >= CONVERGED_N)

  const totalWeight = weights.reduce((a, b) => a + b, 0)
  let roll = rand() * totalWeight
  let dimension = eligibleDims[0]
  for (let i = 0; i < eligibleDims.length; i++) {
    roll -= weights[i]
    if (roll <= 0) {
      dimension = eligibleDims[i]
      break
    }
  }

  const pool = byDim.get(dimension)!
  let a: ItemStats
  let candidates: ItemStats[]

  if (allConverged) {
    // Maintenance: least-recently-tested first
    const sorted = [...pool].sort((x, y) => x.lastComparedAt - y.lastComparedAt)
    a = sorted[Math.floor(rand() * Math.min(5, sorted.length))]
    candidates = pool.filter((s) => s.itemId !== a.itemId)
  } else {
    // Uncertainty first: sample among the least-compared items
    const unconverged = pool.filter((s) => s.comparisons < CONVERGED_N)
    const source = unconverged.length > 0 ? unconverged : pool
    const sorted = [...source].sort((x, y) => x.comparisons - y.comparisons)
    a = sorted[Math.floor(rand() * Math.min(8, sorted.length))]
    // Prefer unconverged opponents too so converged items are deprioritized
    const others = (unconverged.length > 1 ? unconverged : pool).filter((s) => s.itemId !== a.itemId)
    candidates = others.length > 0 ? others : pool.filter((s) => s.itemId !== a.itemId)
  }

  // Opponent: close in rating maximizes information; sample among the closest few
  const byDistance = [...candidates].sort(
    (x, y) => Math.abs(x.rating - a.rating) - Math.abs(y.rating - a.rating)
  )
  const b = byDistance[Math.floor(rand() * Math.min(6, byDistance.length))]

  // Randomize presentation order
  const [aId, bId] = rand() < 0.5 ? [a.itemId, b.itemId] : [b.itemId, a.itemId]
  return { dimension, aId, bId, maintenance: allConverged }
}
