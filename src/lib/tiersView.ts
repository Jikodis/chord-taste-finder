import { getItemStats } from './db/storage'
import { assignTiers, TIER_ORDER, type Tier } from './ranking/tiers'
import { confidence } from './ranking/matchup'
import { catalogItem } from './items/lookup'
import type { CatalogItem, Dimension } from './items/catalog'

export interface TieredItem {
  item: CatalogItem
  rating: number
  comparisons: number
  confidence: number
}

export type TierRows = Array<{ tier: Tier; items: TieredItem[] }>

/** Tier rows for one dimension, rated items only, sorted by rating within tier. */
export async function getTierRows(dimension: Dimension): Promise<TierRows> {
  const stats = (await getItemStats(dimension)).filter((s) => s.comparisons > 0)
  const ratings = new Map(stats.map((s) => [s.itemId, s.rating]))
  const tiers = assignTiers(ratings)
  const rows: TierRows = TIER_ORDER.map((tier) => ({ tier, items: [] }))
  for (const s of stats) {
    const tier = tiers.get(s.itemId)
    const item = catalogItem(s.itemId)
    if (!tier || !item) continue
    rows
      .find((r) => r.tier === tier)!
      .items.push({ item, rating: s.rating, comparisons: s.comparisons, confidence: confidence(s) })
  }
  for (const r of rows) r.items.sort((a, b) => b.rating - a.rating)
  return rows
}

export interface ExportReminder {
  due: boolean
  reason: string
}

export function exportReminder(
  totalComparisons: number,
  lastExportAt: number,
  comparisonsAtLastExport: number
): ExportReminder {
  if (totalComparisons === 0) return { due: false, reason: '' }
  const newSince = totalComparisons - comparisonsAtLastExport
  if (newSince >= 500)
    return { due: true, reason: `${newSince} comparisons since your last backup` }
  const twoWeeks = 14 * 24 * 3600 * 1000
  if (lastExportAt === 0 && totalComparisons >= 50)
    return { due: true, reason: `You have ${totalComparisons} comparisons and no backup yet` }
  if (lastExportAt > 0 && Date.now() - lastExportAt > twoWeeks && newSince > 0)
    return { due: true, reason: 'It has been over 2 weeks since your last backup' }
  return { due: false, reason: '' }
}
