import { describe, it, expect } from 'vitest'
import { guitarVoicings, OPEN_MIDI } from '@/lib/music/guitarVoicings'
import { getQuality } from '@/lib/music/chords'

/** Pitch classes actually sounded by a voicing. */
function soundedPcs(frets: Array<number | null>): Set<number> {
  return new Set(
    frets.map((f, s) => (f === null ? -1 : (OPEN_MIDI[s] + f) % 12)).filter((pc) => pc >= 0)
  )
}

function chordPcs(rootPc: number, qualityId: string): Set<number> {
  return new Set(getQuality(qualityId)!.intervals.map((i) => (rootPc + i) % 12))
}

describe('guitarVoicings core search', () => {
  it('finds complete valid voicings for C major', () => {
    const voicings = guitarVoicings(0, 'maj')
    expect(voicings.length).toBeGreaterThan(0)
    const pcs = chordPcs(0, 'maj')
    for (const v of voicings) {
      const sounded = soundedPcs(v.frets)
      // every chord tone present, nothing foreign
      expect([...pcs].filter((pc) => !sounded.has(pc))).toEqual([])
      expect([...sounded].filter((pc) => !pcs.has(pc))).toEqual([])
      expect(v.omitted).toEqual([])
    }
  })

  it('C6sus2 voicings contain exactly {C, D, G, A} — the bug the templates had', () => {
    const voicings = guitarVoicings(0, '6sus2')
    expect(voicings.length).toBeGreaterThan(0)
    for (const v of voicings) {
      expect([...soundedPcs(v.frets)].sort((a, b) => a - b)).toEqual([0, 2, 7, 9])
    }
  })

  it('respects playability limits on every voicing', () => {
    for (const [rootPc, q] of [[0, 'maj'], [6, 'maj'], [0, '6sus2'], [9, 'm7'], [2, '7sus4']] as const) {
      for (const v of guitarVoicings(rootPc, q)) {
        const fretted = v.frets.filter((f): f is number => f !== null && f > 0)
        const sounded = v.frets.filter((f) => f !== null)
        expect(sounded.length).toBeGreaterThanOrEqual(3)
        if (fretted.length > 0) {
          expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3)
          const min = Math.min(...fretted)
          const fingers = fretted.filter((f) => f > min).length + 1
          expect(fingers).toBeLessThanOrEqual(4)
        }
      }
    }
  })

  it('returns 6-element fret arrays and valid notation', () => {
    for (const v of guitarVoicings(7, 'maj')) {
      expect(v.frets).toHaveLength(6)
      expect(v.notation).toMatch(/^([x0-9]|\(\d+\))+$/)
    }
  })

  it('throws on unknown quality', () => {
    expect(() => guitarVoicings(0, 'nope')).toThrow(/Unknown chord quality/)
  })
})

describe('omission ladder', () => {
  it('voices 13sharp11 (7 tones > 6 strings) by dropping the 5th, then root if needed', () => {
    const voicings = guitarVoicings(0, '13sharp11')
    expect(voicings.length).toBeGreaterThan(0)
    for (const v of voicings) {
      expect(v.omitted.every((o) => o === '5th' || o === 'root')).toBe(true)
    }
  })

  it('omitted is truthful: listed tones absent, unlisted tones present', () => {
    for (const q of ['13sharp11', 'maj13sharp11', '13', 'maj', 'sowhat'] as const) {
      for (const v of guitarVoicings(0, q)) {
        const sounded = soundedPcs(v.frets)
        const pcs = chordPcs(0, q)
        const fifthPc = 7 // rootPc 0 + perfect fifth
        if (v.omitted.includes('5th')) expect(sounded.has(fifthPc)).toBe(false)
        if (v.omitted.includes('root')) expect(sounded.has(0)).toBe(false)
        const expectedPresent = [...pcs].filter(
          (pc) => !(v.omitted.includes('5th') && pc === fifthPc) && !(v.omitted.includes('root') && pc === 0)
        )
        for (const pc of expectedPresent) expect(sounded.has(pc)).toBe(true)
      }
    }
  })

  it('complete chords stay complete: 4-tone chords have empty omitted', () => {
    for (const v of guitarVoicings(0, '6sus2')) expect(v.omitted).toEqual([])
  })
})

describe('scoring', () => {
  it('prefers open-position shapes for the classic open chords', () => {
    // C, G, E, A major; E, A, D minor — the top voicing must live in open position
    for (const [pc, q] of [[0, 'maj'], [7, 'maj'], [4, 'maj'], [9, 'maj'], [4, 'min'], [9, 'min'], [2, 'min']] as const) {
      const top = guitarVoicings(pc, q)[0]
      expect(top.baseFret).toBe(0)
      expect(top.frets.filter((f) => f === 0).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('puts the root in the bass of the top voicing for common qualities', () => {
    for (const [pc, q] of [[0, 'maj'], [7, 'maj'], [9, 'min'], [2, '7']] as const) {
      const top = guitarVoicings(pc, q)[0]
      const bassString = top.frets.findIndex((f) => f !== null)
      const bassPc = (OPEN_MIDI[bassString] + top.frets[bassString]!) % 12
      expect(bassPc).toBe(pc)
    }
  })

  it('is deterministic: two calls agree, and scores ascend', () => {
    const a = guitarVoicings(6, 'm7b5')
    const b = guitarVoicings(6, 'm7b5')
    expect(a.map((v) => v.notation)).toEqual(b.map((v) => v.notation))
    for (let i = 1; i < a.length; i++) expect(a[i].score).toBeGreaterThanOrEqual(a[i - 1].score)
  })
})
