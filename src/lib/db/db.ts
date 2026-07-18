import Dexie, { type EntityTable } from 'dexie'
import type { Dimension } from '../items/catalog'
import type { ProgressionDef } from '../music/progressions'

export interface ItemRow {
  id: string
  dimension: Dimension
  rating: number
  comparisons: number
  lastComparedAt: number
}

export interface ComparisonRow {
  id?: number
  at: number
  dimension: Dimension
  aId: string
  bId: string
  winnerId: string
  sessionId: string
}

export interface SessionRow {
  id: string
  startedAt: number
  endedAt: number
  comparisons: number
}

export interface GeneratorFilters {
  qualityTiers: string[]
  keyTiers: string[]
  length: number
  lockedKeyItemId: string | null
}

export interface GeneratedRow {
  id?: number
  at: number
  progression: ProgressionDef
  filters: GeneratorFilters
  saved: boolean
}

export interface SettingsRow {
  key: string
  value: unknown
}

export type ChordDb = Dexie & {
  items: EntityTable<ItemRow, 'id'>
  comparisons: EntityTable<ComparisonRow, 'id'>
  sessions: EntityTable<SessionRow, 'id'>
  generated: EntityTable<GeneratedRow, 'id'>
  settings: EntityTable<SettingsRow, 'key'>
}

export function createDb(name = 'chord-taste-finder'): ChordDb {
  const db = new Dexie(name) as ChordDb
  db.version(1).stores({
    items: 'id, dimension, rating, comparisons',
    comparisons: '++id, at, dimension, sessionId',
    sessions: 'id, startedAt',
    generated: '++id, at, saved',
    settings: 'key',
  })
  return db
}

let instance: ChordDb | null = null

export function getDb(): ChordDb {
  if (!instance) instance = createDb()
  return instance
}

/** Test hook: swap the singleton (e.g. for fake-indexeddb-backed instances). */
export function setDbForTesting(db: ChordDb): void {
  instance = db
}
