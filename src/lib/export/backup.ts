import { getDb, type ItemRow, type ComparisonRow, type SessionRow, type GeneratedRow } from '../db/db'
import { ensureSeeded, refitBradleyTerry, type AppSettings, DEFAULT_SETTINGS } from '../db/storage'

export const SCHEMA_VERSION = 1

export interface BackupFile {
  app: 'chord-taste-finder'
  schemaVersion: number
  exportedAt: string
  items: ItemRow[]
  comparisons: Omit<ComparisonRow, 'id'>[]
  sessions: SessionRow[]
  generated: Omit<GeneratedRow, 'id'>[]
  settings: AppSettings
}

export async function exportBackup(): Promise<BackupFile> {
  const db = getDb()
  const [items, comparisons, sessions, generated, settingsRow] = await Promise.all([
    db.items.toArray(),
    db.comparisons.toArray(),
    db.sessions.toArray(),
    db.generated.toArray(),
    db.settings.get('app'),
  ])
  return {
    app: 'chord-taste-finder',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    items,
    comparisons: comparisons.map(({ id: _id, ...rest }) => rest),
    sessions,
    generated: generated.map(({ id: _id, ...rest }) => rest),
    settings: { ...DEFAULT_SETTINGS, ...((settingsRow?.value as Partial<AppSettings>) ?? {}) },
  }
}

export interface BackupPreview {
  schemaVersion: number
  exportedAt: string
  comparisons: number
  ratedItems: number
  savedProgressions: number
  versionMismatch: boolean
}

export function validateBackup(data: unknown): { ok: true; file: BackupFile; preview: BackupPreview } | { ok: false; error: string } {
  if (typeof data !== 'object' || data === null) return { ok: false, error: 'Not a JSON object' }
  const f = data as Partial<BackupFile>
  if (f.app !== 'chord-taste-finder') return { ok: false, error: 'Not a chord-taste-finder backup file' }
  if (typeof f.schemaVersion !== 'number') return { ok: false, error: 'Missing schema version' }
  if (!Array.isArray(f.items) || !Array.isArray(f.comparisons)) return { ok: false, error: 'Missing items or comparisons' }
  const file = f as BackupFile
  return {
    ok: true,
    file,
    preview: {
      schemaVersion: file.schemaVersion,
      exportedAt: file.exportedAt ?? 'unknown',
      comparisons: file.comparisons.length,
      ratedItems: file.items.filter((i) => i.comparisons > 0).length,
      savedProgressions: (file.generated ?? []).filter((g) => g.saved).length,
      versionMismatch: file.schemaVersion !== SCHEMA_VERSION,
    },
  }
}

const comparisonKey = (c: Omit<ComparisonRow, 'id'>) => `${c.at}|${c.aId}|${c.bId}|${c.winnerId}`

/**
 * Import a backup. 'replace' wipes local data first; 'merge' unions comparison
 * histories (deduplicated) and recomputes all ratings via Bradley-Terry.
 */
export async function importBackup(file: BackupFile, mode: 'replace' | 'merge'): Promise<void> {
  const db = getDb()
  if (mode === 'replace') {
    await db.transaction('rw', [db.items, db.comparisons, db.sessions, db.generated, db.settings], async () => {
      await Promise.all([db.items.clear(), db.comparisons.clear(), db.sessions.clear(), db.generated.clear(), db.settings.clear()])
      await db.items.bulkAdd(file.items)
      await db.comparisons.bulkAdd(file.comparisons)
      await db.sessions.bulkAdd(file.sessions ?? [])
      await db.generated.bulkAdd(file.generated ?? [])
      await db.settings.put({ key: 'app', value: file.settings ?? DEFAULT_SETTINGS })
    })
    await ensureSeeded() // catalog may have grown since the export
    return
  }

  // Merge
  await db.transaction('rw', [db.comparisons, db.sessions, db.generated], async () => {
    const existing = await db.comparisons.toArray()
    const seen = new Set(existing.map(comparisonKey))
    const fresh = file.comparisons.filter((c) => !seen.has(comparisonKey(c)))
    await db.comparisons.bulkAdd(fresh)

    const sessionIds = new Set(await db.sessions.toCollection().primaryKeys())
    await db.sessions.bulkAdd((file.sessions ?? []).filter((s) => !sessionIds.has(s.id)))

    const genExisting = await db.generated.toArray()
    const genSeen = new Set(genExisting.map((g) => g.at))
    await db.generated.bulkAdd((file.generated ?? []).filter((g) => !genSeen.has(g.at)))
  })
  await ensureSeeded()
  await recountItemStats()
  await refitBradleyTerry()
}

/** Recompute per-item comparison counts and lastComparedAt from history (after merge). */
async function recountItemStats(): Promise<void> {
  const db = getDb()
  const comparisons = await db.comparisons.toArray()
  const counts = new Map<string, { n: number; last: number }>()
  for (const c of comparisons) {
    for (const id of [c.aId, c.bId]) {
      const cur = counts.get(id) ?? { n: 0, last: 0 }
      cur.n += 1
      cur.last = Math.max(cur.last, c.at)
      counts.set(id, cur)
    }
  }
  await db.transaction('rw', db.items, async () => {
    for (const [id, { n, last }] of counts) {
      await db.items.update(id, { comparisons: n, lastComparedAt: last })
    }
  })
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
