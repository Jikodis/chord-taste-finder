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
  getRecentComparisons,
  getLifetimeStats,
  deleteComparison,
  updateComparisonWinner,
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

  it('returns the id of the row it wrote, so callers can undo it', async () => {
    const stats = await getItemStats('quality')
    const res = await recordComparison({
      aId: stats[0].itemId,
      bId: stats[1].itemId,
      winnerId: stats[0].itemId,
      dimension: 'quality',
      sessionId: 's1',
    })
    const [row] = await getRecentComparisons(1)
    expect(res.comparisonId).toBe(row.id)
    await deleteComparison(res.comparisonId)
    expect(await getRecentComparisons(10)).toHaveLength(0)
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

describe('undoing and editing past votes', () => {
  it('deleteComparison returns the two items to their untouched state', async () => {
    const stats = await getItemStats('quality')
    const [a, b] = stats
    await recordComparison({
      aId: a.itemId,
      bId: b.itemId,
      winnerId: a.itemId,
      dimension: 'quality',
      sessionId: 's1',
    })
    const [row] = await getRecentComparisons(1)
    await deleteComparison(row.id!)

    const after = await getItemStats('quality')
    for (const id of [a.itemId, b.itemId]) {
      const s = after.find((x) => x.itemId === id)!
      expect(s.rating).toBeCloseTo(INITIAL_ELO)
      expect(s.comparisons).toBe(0)
    }
    expect(await getRecentComparisons(10)).toHaveLength(0)
  })

  it('deleteComparison replays history exactly as if the vote never happened', async () => {
    const ids = (await getItemStats('quality')).slice(0, 3).map((s) => s.itemId)
    const vote1 = { aId: ids[0], bId: ids[1], winnerId: ids[0] }
    const doomed = { aId: ids[1], bId: ids[2], winnerId: ids[1] }
    const vote3 = { aId: ids[0], bId: ids[2], winnerId: ids[2] }
    const ctx = { dimension: 'quality' as const, sessionId: 's1' }

    for (const v of [vote1, doomed, vote3]) await recordComparison({ ...v, ...ctx })
    const rows = await getRecentComparisons(10)
    const doomedRow = rows.find((r) => r.aId === doomed.aId && r.bId === doomed.bId)!
    await deleteComparison(doomedRow.id!)
    const afterDelete = await getItemStats('quality')

    // A pristine DB that only ever saw the two surviving votes
    setDbForTesting(createDb(`test-${++dbCounter}`))
    await ensureSeeded()
    for (const v of [vote1, vote3]) await recordComparison({ ...v, ...ctx })
    const expected = await getItemStats('quality')

    for (const id of ids) {
      expect(afterDelete.find((s) => s.itemId === id)!.rating).toBeCloseTo(
        expected.find((s) => s.itemId === id)!.rating,
        6
      )
      expect(afterDelete.find((s) => s.itemId === id)!.comparisons).toBe(
        expected.find((s) => s.itemId === id)!.comparisons
      )
    }
  })

  it('updateComparisonWinner flips who gained rating', async () => {
    const stats = await getItemStats('quality')
    const [a, b] = stats
    await recordComparison({
      aId: a.itemId,
      bId: b.itemId,
      winnerId: a.itemId,
      dimension: 'quality',
      sessionId: 's1',
    })
    const [row] = await getRecentComparisons(1)
    await updateComparisonWinner(row.id!, b.itemId)

    const after = await getItemStats('quality')
    expect(after.find((s) => s.itemId === b.itemId)!.rating).toBeGreaterThan(INITIAL_ELO)
    expect(after.find((s) => s.itemId === a.itemId)!.rating).toBeLessThan(INITIAL_ELO)
    // Still exactly one comparison, now recorded the other way round
    const rowsAfter = await getRecentComparisons(10)
    expect(rowsAfter).toHaveLength(1)
    expect(rowsAfter[0].winnerId).toBe(b.itemId)
    expect(after.find((s) => s.itemId === a.itemId)!.comparisons).toBe(1)
  })

  it('deleteComparison decrements the session count', async () => {
    const stats = await getItemStats('quality')
    await recordComparison({
      aId: stats[0].itemId,
      bId: stats[1].itemId,
      winnerId: stats[0].itemId,
      dimension: 'quality',
      sessionId: 's1',
    })
    await recordComparison({
      aId: stats[0].itemId,
      bId: stats[2].itemId,
      winnerId: stats[0].itemId,
      dimension: 'quality',
      sessionId: 's1',
    })
    const [latest] = await getRecentComparisons(1)
    await deleteComparison(latest.id!)
    expect((await getLifetimeStats()).totalComparisons).toBe(1)
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
