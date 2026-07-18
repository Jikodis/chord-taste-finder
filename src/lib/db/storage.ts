import { getDb, type ItemRow, type ComparisonRow, type GeneratedRow, type GeneratorFilters } from './db'
import { buildCatalog, DIMENSIONS, type Dimension } from '../items/catalog'
import { eloUpdate, INITIAL_ELO } from '../ranking/elo'
import { fitBradleyTerry } from '../ranking/bradleyTerry'
import { CONVERGED_N, type ItemStats } from '../ranking/matchup'

/** Refit Bradley-Terry after this many new comparisons (PRD §3.2.1). */
export const REFIT_EVERY = 50

export interface AppSettings {
  instrument: 'piano' | 'guitar' | 'synth'
  tempoBpm: number
  calibrated: boolean
  lastExportAt: number
  comparisonsAtLastExport: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  instrument: 'piano',
  tempoBpm: 80,
  calibrated: false,
  lastExportAt: 0,
  comparisonsAtLastExport: 0,
}

/** Insert catalog items missing from the DB. Idempotent; safe to run on every load. */
export async function ensureSeeded(): Promise<void> {
  const db = getDb()
  const catalog = buildCatalog()
  const existing = new Set(await db.items.toCollection().primaryKeys())
  const missing = catalog
    .filter((c) => !existing.has(c.id))
    .map<ItemRow>((c) => ({
      id: c.id,
      dimension: c.dimension,
      rating: INITIAL_ELO,
      comparisons: 0,
      lastComparedAt: 0,
    }))
  if (missing.length > 0) await db.items.bulkAdd(missing)
}

export async function getItemStats(dimension?: Dimension): Promise<ItemStats[]> {
  const db = getDb()
  const rows = dimension
    ? await db.items.where('dimension').equals(dimension).toArray()
    : await db.items.toArray()
  return rows.map((r) => ({
    itemId: r.id,
    dimension: r.dimension,
    rating: r.rating,
    comparisons: r.comparisons,
    lastComparedAt: r.lastComparedAt,
  }))
}

export interface RecordResult {
  newWinnerRating: number
  newLoserRating: number
  refitRan: boolean
  totalComparisons: number
}

export async function recordComparison(opts: {
  aId: string
  bId: string
  winnerId: string
  dimension: Dimension
  sessionId: string
}): Promise<RecordResult> {
  const db = getDb()
  const { aId, bId, winnerId, dimension, sessionId } = opts
  const loserId = winnerId === aId ? bId : aId
  const now = Date.now()

  const result = await db.transaction('rw', [db.items, db.comparisons, db.sessions], async () => {
    const winner = (await db.items.get(winnerId))!
    const loser = (await db.items.get(loserId))!
    const [newWinnerRating, newLoserRating] = eloUpdate(winner.rating, loser.rating, true)
    await db.items.update(winnerId, {
      rating: newWinnerRating,
      comparisons: winner.comparisons + 1,
      lastComparedAt: now,
    })
    await db.items.update(loserId, {
      rating: newLoserRating,
      comparisons: loser.comparisons + 1,
      lastComparedAt: now,
    })
    await db.comparisons.add({ at: now, dimension, aId, bId, winnerId, sessionId })
    const session = await db.sessions.get(sessionId)
    if (session) {
      await db.sessions.update(sessionId, { comparisons: session.comparisons + 1, endedAt: now })
    } else {
      await db.sessions.add({ id: sessionId, startedAt: now, endedAt: now, comparisons: 1 })
    }
    const totalComparisons = await db.comparisons.count()
    return { newWinnerRating, newLoserRating, totalComparisons }
  })

  let refitRan = false
  if (result.totalComparisons % REFIT_EVERY === 0) {
    await refitBradleyTerry()
    refitRan = true
  }
  return { ...result, refitRan }
}

/**
 * Refit the Bradley-Terry model over the full history and silently update
 * item ratings to the refined estimates (PRD §3.2.1).
 */
export async function refitBradleyTerry(): Promise<void> {
  const db = getDb()
  const comparisons = await db.comparisons.toArray()
  if (comparisons.length === 0) return
  const fitted = fitBradleyTerry(
    comparisons.map((c) => ({ winnerId: c.winnerId, loserId: c.winnerId === c.aId ? c.bId : c.aId }))
  )
  await db.transaction('rw', db.items, async () => {
    for (const [id, rating] of fitted) {
      await db.items.update(id, { rating })
    }
  })
}

export async function getSettings(): Promise<AppSettings> {
  const db = getDb()
  const row = await db.settings.get('app')
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<AppSettings>) ?? {}) }
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const db = getDb()
  const current = await getSettings()
  const next = { ...current, ...patch }
  await db.settings.put({ key: 'app', value: next })
  return next
}

export interface DimensionProgress {
  dimension: Dimension
  total: number
  converged: number
  percent: number
}

export async function getProgress(): Promise<{ perDimension: DimensionProgress[]; overallPercent: number }> {
  const stats = await getItemStats()
  const perDimension = DIMENSIONS.map((dimension) => {
    const items = stats.filter((s) => s.dimension === dimension)
    const converged = items.filter((s) => s.comparisons >= CONVERGED_N).length
    // Partial credit for partially-tested items so early progress is visible
    const credit = items.reduce((sum, s) => sum + Math.min(1, s.comparisons / CONVERGED_N), 0)
    return {
      dimension,
      total: items.length,
      converged,
      percent: items.length === 0 ? 0 : Math.round((credit / items.length) * 100),
    }
  })
  const overallPercent = Math.round(
    perDimension.reduce((s, d) => s + d.percent, 0) / Math.max(1, perDimension.length)
  )
  return { perDimension, overallPercent }
}

export async function getLifetimeStats(): Promise<{
  totalComparisons: number
  sessions: number
  comparisonsPerDay: number
}> {
  const db = getDb()
  const totalComparisons = await db.comparisons.count()
  const sessions = await db.sessions.count()
  const twoWeeksAgo = Date.now() - 14 * 24 * 3600 * 1000
  const recent = await db.comparisons.where('at').above(twoWeeksAgo).count()
  return { totalComparisons, sessions, comparisonsPerDay: recent / 14 }
}

export async function saveGenerated(row: Omit<GeneratedRow, 'id'>): Promise<number> {
  const db = getDb()
  return (await db.generated.add(row)) as number
}

export async function listGenerated(savedOnly = false): Promise<GeneratedRow[]> {
  const db = getDb()
  const all = await db.generated.orderBy('at').reverse().toArray()
  return savedOnly ? all.filter((g) => g.saved) : all
}

export async function setGeneratedSaved(id: number, saved: boolean): Promise<void> {
  const db = getDb()
  await db.generated.update(id, { saved })
}

export async function getRecentComparisons(limit = 20): Promise<ComparisonRow[]> {
  const db = getDb()
  return db.comparisons.orderBy('at').reverse().limit(limit).toArray()
}

export async function resetAll(): Promise<void> {
  const db = getDb()
  await db.transaction('rw', [db.items, db.comparisons, db.sessions, db.generated, db.settings], async () => {
    await Promise.all([
      db.items.clear(),
      db.comparisons.clear(),
      db.sessions.clear(),
      db.generated.clear(),
      db.settings.clear(),
    ])
  })
  await ensureSeeded()
}

export type { GeneratorFilters }
