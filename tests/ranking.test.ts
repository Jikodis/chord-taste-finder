import { describe, it, expect } from 'vitest'
import { eloUpdate, expectedScore, INITIAL_ELO } from '@/lib/ranking/elo'
import { fitBradleyTerry, type ComparisonRecord } from '@/lib/ranking/bradleyTerry'
import { assignTiers } from '@/lib/ranking/tiers'
import { selectMatchup, CONVERGED_N, type ItemStats } from '@/lib/ranking/matchup'
import { mulberry32 } from '@/lib/music/progressions'

describe('elo', () => {
  it('is zero-sum', () => {
    const [ra, rb] = eloUpdate(1500, 1500, true)
    expect(ra + rb).toBeCloseTo(3000)
    expect(ra).toBeGreaterThan(1500)
  })
  it('upset moves ratings more than expected win', () => {
    const [strongLoses] = eloUpdate(1700, 1300, false)
    const [strongWins] = eloUpdate(1700, 1300, true)
    expect(1700 - strongLoses).toBeGreaterThan(strongWins - 1700)
  })
  it('expected score is symmetric', () => {
    expect(expectedScore(1600, 1400) + expectedScore(1400, 1600)).toBeCloseTo(1)
  })
})

describe('bradley-terry', () => {
  it('recovers a known ordering from synthetic data', () => {
    // A beats B 8/10, B beats C 8/10, A beats C 9/10
    const comparisons: ComparisonRecord[] = []
    const addGames = (w: string, l: string, wWins: number, lWins: number) => {
      for (let i = 0; i < wWins; i++) comparisons.push({ winnerId: w, loserId: l })
      for (let i = 0; i < lWins; i++) comparisons.push({ winnerId: l, loserId: w })
    }
    addGames('A', 'B', 8, 2)
    addGames('B', 'C', 8, 2)
    addGames('A', 'C', 9, 1)
    const ratings = fitBradleyTerry(comparisons)
    expect(ratings.get('A')!).toBeGreaterThan(ratings.get('B')!)
    expect(ratings.get('B')!).toBeGreaterThan(ratings.get('C')!)
  })
  it('centers ratings near the Elo baseline', () => {
    const ratings = fitBradleyTerry([
      { winnerId: 'A', loserId: 'B' },
      { winnerId: 'B', loserId: 'A' },
    ])
    expect(ratings.get('A')!).toBeCloseTo(INITIAL_ELO, 0)
    expect(ratings.get('B')!).toBeCloseTo(INITIAL_ELO, 0)
  })
  it('handles undefeated items without diverging', () => {
    const ratings = fitBradleyTerry([
      { winnerId: 'A', loserId: 'B' },
      { winnerId: 'A', loserId: 'B' },
    ])
    expect(Number.isFinite(ratings.get('A')!)).toBe(true)
    expect(ratings.get('A')!).toBeGreaterThan(ratings.get('B')!)
  })
})

describe('tiers', () => {
  it('assigns percentile bands over 100 items', () => {
    const ratings = new Map<string, number>()
    for (let i = 0; i < 100; i++) ratings.set(`i${i}`, 2000 - i)
    const tiers = assignTiers(ratings)
    const count = (t: string) => [...tiers.values()].filter((x) => x === t).length
    expect(count('S')).toBe(5)
    expect(count('A')).toBe(15)
    expect(count('B')).toBe(20)
    expect(count('C')).toBe(20)
    expect(count('D')).toBe(20)
    expect(count('F')).toBe(20)
    expect(tiers.get('i0')).toBe('S')
    expect(tiers.get('i99')).toBe('F')
  })
  it('handles tiny sets without crashing', () => {
    const tiers = assignTiers(new Map([['a', 1600], ['b', 1400]]))
    expect(tiers.size).toBe(2)
  })
})

function makeStats(dim: 'key' | 'quality', n: number, comparisons: number): ItemStats[] {
  return Array.from({ length: n }, (_, i) => ({
    itemId: `${dim}${i}`,
    dimension: dim,
    rating: 1500 + i * 10,
    comparisons,
    lastComparedAt: i,
  }))
}

describe('matchup selection', () => {
  it('never repeats a dimension more than 3x consecutively', () => {
    const stats = [...makeStats('key', 10, 0), ...makeStats('quality', 10, 0)]
    const rand = mulberry32(42)
    const recent: Array<'key' | 'quality'> = []
    for (let i = 0; i < 50; i++) {
      const m = selectMatchup(stats, recent, rand)!
      recent.push(m.dimension as 'key' | 'quality')
    }
    for (let i = 3; i < recent.length; i++) {
      const window = recent.slice(i - 3, i + 1)
      expect(new Set(window).size).toBeGreaterThan(1)
    }
  })
  it('prefers unconverged items', () => {
    const converged = makeStats('key', 8, CONVERGED_N + 5)
    const fresh: ItemStats[] = [
      { itemId: 'fresh1', dimension: 'key', rating: 1500, comparisons: 0, lastComparedAt: 0 },
      { itemId: 'fresh2', dimension: 'key', rating: 1500, comparisons: 1, lastComparedAt: 0 },
    ]
    const rand = mulberry32(7)
    for (let i = 0; i < 20; i++) {
      const m = selectMatchup([...converged, ...fresh], [], rand)!
      expect(['fresh1', 'fresh2']).toContain(m.aId)
      expect(['fresh1', 'fresh2']).toContain(m.bId)
    }
  })
  it('enters maintenance mode when everything is converged', () => {
    const stats = makeStats('key', 10, CONVERGED_N + 1)
    const m = selectMatchup(stats, [], mulberry32(1))!
    expect(m.maintenance).toBe(true)
  })
  it('returns null with fewer than 2 items', () => {
    expect(selectMatchup([], [])).toBeNull()
  })
})
