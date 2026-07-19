import { describe, it, expect } from 'vitest'
import {
  defaultKeyPc,
  topScales,
  topQualities,
  topProgressions,
  transposeProgression,
} from '@/lib/cheatsheetView'
import type { TierRows } from '@/lib/tiersView'
import type { CatalogItem } from '@/lib/items/catalog'
import { instantiateSeed, SEED_TEMPLATES } from '@/lib/music/progressions'

function keyItem(rootPc: number, scaleId: string): CatalogItem {
  return {
    id: `key:${rootPc}:${scaleId}`,
    dimension: 'key',
    label: `test ${scaleId}`,
    payload: { kind: 'key', rootPc, scaleId },
  }
}

function rows(items: Array<[string, CatalogItem[]]>): TierRows {
  return items.map(([tier, list]) => ({
    tier: tier as TierRows[number]['tier'],
    items: list.map((item, i) => ({ item, rating: 1600 - i, comparisons: 12, confidence: 1 })),
  }))
}

describe('defaultKeyPc', () => {
  it('returns the top-rated key root, or 0 when nothing is rated', () => {
    const r = rows([
      ['S', [keyItem(7, 'blues'), keyItem(2, 'major')]],
      ['A', [keyItem(4, 'minor')]],
    ])
    expect(defaultKeyPc(r)).toBe(7)
    expect(defaultKeyPc(rows([['S', []]]))).toBe(0)
  })
})

describe('topScales', () => {
  it('dedupes by scale keeping the best-tier occurrence, in tier order', () => {
    const r = rows([
      ['S', [keyItem(7, 'blues')]],
      ['A', [keyItem(0, 'blues'), keyItem(2, 'altered')]],
    ])
    const top = topScales(r)
    expect(top.map((s) => s.scaleId)).toEqual(['blues', 'altered'])
    expect(top[0].tier).toBe('S')
  })

  it('respects the limit', () => {
    const r = rows([['S', [keyItem(0, 'a'), keyItem(0, 'b'), keyItem(0, 'c')]]])
    expect(topScales(r, 2)).toHaveLength(2)
  })
})

describe('topQualities / topProgressions', () => {
  it('extracts quality ids in tier order', () => {
    const qual = (id: string): CatalogItem => ({
      id: `qual:${id}`,
      dimension: 'quality',
      label: id,
      payload: { kind: 'quality', qualityId: id },
    })
    const r = rows([['S', [qual('maj7')]], ['B', [qual('m9')]]])
    expect(topQualities(r).map((q) => q.qualityId)).toEqual(['maj7', 'm9'])
  })

  it('extracts progressions in tier order', () => {
    const p = instantiateSeed(SEED_TEMPLATES[0], 0)
    const item: CatalogItem = {
      id: `prog:${p.id}`,
      dimension: 'progression',
      label: p.name,
      payload: { kind: 'progression', progression: p },
    }
    const r = rows([['A', [item]]])
    expect(topProgressions(r)[0].progression.id).toBe(p.id)
  })
})

describe('transposeProgression', () => {
  it('shifts every chord root by the key delta and preserves romans', () => {
    const p = instantiateSeed(SEED_TEMPLATES[0], 0) // in C
    const t = transposeProgression(p, 7) // to G
    expect(t.keyRootPc).toBe(7)
    expect(t.chords.map((c) => c.roman)).toEqual(p.chords.map((c) => c.roman))
    expect(t.chords.map((c) => c.rootPc)).toEqual(p.chords.map((c) => (c.rootPc + 7) % 12))
    expect(t.chords.map((c) => c.qualityId)).toEqual(p.chords.map((c) => c.qualityId))
  })

  it('is identity when already in the target key', () => {
    const p = instantiateSeed(SEED_TEMPLATES[0], 5)
    expect(transposeProgression(p, 5)).toBe(p)
  })
})
