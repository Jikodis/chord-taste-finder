import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createDb, setDbForTesting } from '@/lib/db/db'
import {
  ensureSeeded,
  getItemStats,
  recordComparison,
  getSettings,
  saveSettings,
  getProgress,
  resetAll,
  REFIT_EVERY,
} from '@/lib/db/storage'
import { exportBackup, importBackup, validateBackup } from '@/lib/export/backup'
import { INITIAL_ELO } from '@/lib/ranking/elo'

let dbCounter = 0

beforeEach(async () => {
  // Fresh IDB world per test
  globalThis.indexedDB = new IDBFactory()
  setDbForTesting(createDb(`test-${++dbCounter}`))
  await ensureSeeded()
})

describe('storage seeding', () => {
  it('seeds the full catalog once, idempotently', async () => {
    const first = await getItemStats()
    expect(first.length).toBeGreaterThan(500)
    await ensureSeeded()
    const second = await getItemStats()
    expect(second.length).toBe(first.length)
    expect(second.every((s) => s.rating === INITIAL_ELO && s.comparisons === 0)).toBe(true)
  })
})

describe('recordComparison', () => {
  it('updates ratings zero-sum and increments counts', async () => {
    const stats = await getItemStats('quality')
    const [a, b] = stats
    const res = await recordComparison({
      aId: a.itemId,
      bId: b.itemId,
      winnerId: a.itemId,
      dimension: 'quality',
      sessionId: 's1',
    })
    expect(res.newWinnerRating).toBeGreaterThan(INITIAL_ELO)
    expect(res.newWinnerRating + res.newLoserRating).toBeCloseTo(2 * INITIAL_ELO)
    const after = await getItemStats('quality')
    const aAfter = after.find((s) => s.itemId === a.itemId)!
    expect(aAfter.comparisons).toBe(1)
    expect(aAfter.lastComparedAt).toBeGreaterThan(0)
  })

  it(`runs a Bradley-Terry refit every ${REFIT_EVERY} comparisons`, async () => {
    const stats = await getItemStats('quality')
    let refits = 0
    for (let i = 0; i < REFIT_EVERY; i++) {
      const a = stats[i % 10]
      const b = stats[10 + (i % 10)]
      const res = await recordComparison({
        aId: a.itemId,
        bId: b.itemId,
        winnerId: a.itemId,
        dimension: 'quality',
        sessionId: 's1',
      })
      if (res.refitRan) refits++
    }
    expect(refits).toBe(1)
  })
})

describe('settings', () => {
  it('round-trips settings', async () => {
    const initial = await getSettings()
    expect(initial.instrument).toBe('piano')
    await saveSettings({ instrument: 'guitar', tempoBpm: 100 })
    const after = await getSettings()
    expect(after.instrument).toBe('guitar')
    expect(after.tempoBpm).toBe(100)
  })
})

describe('progress', () => {
  it('reports zero initially and rises with comparisons', async () => {
    const before = await getProgress()
    expect(before.overallPercent).toBe(0)
    const stats = await getItemStats('key')
    for (let i = 0; i < 12; i++) {
      await recordComparison({
        aId: stats[0].itemId,
        bId: stats[1 + i].itemId,
        winnerId: stats[0].itemId,
        dimension: 'key',
        sessionId: 's1',
      })
    }
    const after = await getProgress()
    const keyDim = after.perDimension.find((d) => d.dimension === 'key')!
    expect(keyDim.converged).toBe(1)
    expect(keyDim.percent).toBeGreaterThan(0)
  })
})

describe('backup export/import', () => {
  it('replace round-trips all data', async () => {
    const stats = await getItemStats('quality')
    await recordComparison({
      aId: stats[0].itemId,
      bId: stats[1].itemId,
      winnerId: stats[0].itemId,
      dimension: 'quality',
      sessionId: 's1',
    })
    const backup = await exportBackup()
    expect(backup.comparisons.length).toBe(1)

    await resetAll()
    expect((await exportBackup()).comparisons.length).toBe(0)

    const validated = validateBackup(JSON.parse(JSON.stringify(backup)))
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.preview.comparisons).toBe(1)
    await importBackup(validated.file, 'replace')
    const restored = await exportBackup()
    expect(restored.comparisons.length).toBe(1)
    const restoredItem = (await getItemStats('quality')).find((s) => s.itemId === stats[0].itemId)!
    expect(restoredItem.comparisons).toBe(1)
  })

  it('merge dedupes identical comparisons and keeps unions', async () => {
    const stats = await getItemStats('quality')
    await recordComparison({
      aId: stats[0].itemId,
      bId: stats[1].itemId,
      winnerId: stats[0].itemId,
      dimension: 'quality',
      sessionId: 's1',
    })
    const backup = await exportBackup()
    // Import the same data as a merge: nothing should duplicate
    await importBackup(backup, 'merge')
    const after = await exportBackup()
    expect(after.comparisons.length).toBe(1)
  })

  it('rejects malformed files', () => {
    expect(validateBackup({ foo: 'bar' }).ok).toBe(false)
    expect(validateBackup(null).ok).toBe(false)
    expect(validateBackup('nope').ok).toBe(false)
  })
})
