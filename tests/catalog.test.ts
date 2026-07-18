import { describe, it, expect } from 'vitest'
import { buildCatalog } from '@/lib/items/catalog'
import {
  diatonicChord,
  instantiateSeed,
  generateNovelProgression,
  SEED_TEMPLATES,
} from '@/lib/music/progressions'

describe('diatonic chords', () => {
  it('builds correct triads in C major', () => {
    expect(diatonicChord('major', 0, 0).qualityId).toBe('maj') // I = C
    expect(diatonicChord('major', 1, 0).qualityId).toBe('min') // ii = Dm
    expect(diatonicChord('major', 6, 0).qualityId).toBe('dim') // vii°
    expect(diatonicChord('major', 4, 0).rootPc).toBe(7) // V root = G
  })
  it('builds sevenths', () => {
    expect(diatonicChord('major', 4, 0, true).qualityId).toBe('7') // V7 = G7
    expect(diatonicChord('major', 0, 0, true).qualityId).toBe('maj7')
  })
  it('roman numerals reflect quality case', () => {
    expect(diatonicChord('major', 0, 0).roman).toBe('I')
    expect(diatonicChord('major', 1, 0).roman).toBe('ii')
    expect(diatonicChord('major', 6, 0).roman).toBe('vii°')
  })
})

describe('seed templates', () => {
  it('instantiate across keys with same romans, different roots', () => {
    const t = SEED_TEMPLATES.find((t) => t.id === 'I-IV-V-I')!
    const inC = instantiateSeed(t, 0)
    const inG = instantiateSeed(t, 7)
    expect(inC.chords.map((c) => c.roman)).toEqual(inG.chords.map((c) => c.roman))
    expect(inC.chords[0].rootPc).toBe(0)
    expect(inG.chords[0].rootPc).toBe(7)
  })
})

describe('novel generation', () => {
  it('is deterministic for the same seed', () => {
    const a = generateNovelProgression(7, 0, 'major', 4)
    const b = generateNovelProgression(7, 0, 'major', 4)
    expect(a).toEqual(b)
  })
  it('respects length bounds 2-8', () => {
    for (let s = 0; s < 20; s++) {
      const p = generateNovelProgression(s, 0, 'major', 3 + (s % 5))
      expect(p.chords.length).toBeGreaterThanOrEqual(2)
      expect(p.chords.length).toBeLessThanOrEqual(8)
    }
  })
})

describe('catalog', () => {
  const items = buildCatalog()
  const byDim = (d: string) => items.filter((i) => i.dimension === d)

  it('has 150+ key items', () => {
    expect(byDim('key').length).toBeGreaterThanOrEqual(150)
  })
  it('has 100+ quality items', () => {
    expect(byDim('quality').length).toBeGreaterThanOrEqual(100)
  })
  it('has a healthy voicing set', () => {
    expect(byDim('voicing').length).toBeGreaterThanOrEqual(60)
  })
  it('has 100+ progressions incl. cross-key duplicates', () => {
    const progs = byDim('progression')
    expect(progs.length).toBeGreaterThanOrEqual(100)
  })
  it('all ids unique', () => {
    const ids = items.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('catalog is deterministic across builds', () => {
    const again = buildCatalog()
    expect(again.map((i) => i.id)).toEqual(items.map((i) => i.id))
  })
})
