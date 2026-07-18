import { describe, it, expect } from 'vitest'
import { NOTE_NAMES, pcToName, midiToName } from '@/lib/music/notes'
import { SCALES, getScale } from '@/lib/music/scales'
import { CHORD_QUALITIES, getQuality } from '@/lib/music/chords'
import { VOICINGS, applyVoicing, voicingsForChordSize } from '@/lib/music/voicings'
import { realizeChord, realizeScale } from '@/lib/music/realize'

describe('notes', () => {
  it('has 12 pitch classes', () => {
    expect(NOTE_NAMES.length).toBe(12)
  })
  it('names middle C', () => {
    expect(midiToName(60)).toBe('C4')
  })
  it('names pitch classes', () => {
    expect(pcToName(1)).toBe('C#')
    expect(pcToName(1, true)).toBe('Db')
  })
})

describe('scales', () => {
  it('covers at least 13 scale types (>=150 key items across 12 roots)', () => {
    expect(SCALES.length).toBeGreaterThanOrEqual(13)
    expect(SCALES.length * 12).toBeGreaterThanOrEqual(150)
  })
  it('major scale intervals are correct', () => {
    expect(getScale('major')!.intervals).toEqual([0, 2, 4, 5, 7, 9, 11])
  })
  it('all scales start at 0, ascend, stay within an octave', () => {
    for (const s of SCALES) {
      expect(s.intervals[0]).toBe(0)
      for (let i = 1; i < s.intervals.length; i++) {
        expect(s.intervals[i]).toBeGreaterThan(s.intervals[i - 1])
        expect(s.intervals[i]).toBeLessThan(12)
      }
    }
  })
  it('scale ids are unique', () => {
    const ids = SCALES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('chord qualities', () => {
  it('has at least 100 qualities', () => {
    expect(CHORD_QUALITIES.length).toBeGreaterThanOrEqual(100)
  })
  it('interval sets are unique (no enharmonic duplicate chords)', () => {
    const keys = CHORD_QUALITIES.map((q) => q.intervals.join(','))
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('all include the root and ascend', () => {
    for (const q of CHORD_QUALITIES) {
      expect(q.intervals[0]).toBe(0)
      for (let i = 1; i < q.intervals.length; i++) {
        expect(q.intervals[i]).toBeGreaterThan(q.intervals[i - 1])
      }
    }
  })
  it('major triad and dom7 present with standard intervals', () => {
    expect(getQuality('maj')!.intervals).toEqual([0, 4, 7])
    expect(getQuality('7')!.intervals).toEqual([0, 4, 7, 10])
  })
})

describe('voicings', () => {
  const cmaj7 = [60, 64, 67, 71] // C E G B

  it('root position is identity', () => {
    expect(applyVoicing(cmaj7, 'root')).toEqual(cmaj7)
  })
  it('first inversion moves the bass up an octave', () => {
    expect(applyVoicing(cmaj7, 'inv1')).toEqual([64, 67, 71, 72])
  })
  it('second inversion moves two notes up', () => {
    expect(applyVoicing(cmaj7, 'inv2')).toEqual([67, 71, 72, 76])
  })
  it('drop-2 lowers the second-from-top note an octave', () => {
    expect(applyVoicing(cmaj7, 'drop2')).toEqual([55, 60, 64, 71])
  })
  it('drop-3 lowers the third-from-top note an octave', () => {
    expect(applyVoicing(cmaj7, 'drop3')).toEqual([52, 60, 67, 71])
  })
  it('triads do not get 3rd inversion or drop-3', () => {
    const ids = voicingsForChordSize(3).map((v) => v.id)
    expect(ids).not.toContain('inv3')
    expect(ids).not.toContain('drop3')
    expect(ids).toContain('inv2')
  })
  it('all voicing results are sorted ascending', () => {
    for (const v of VOICINGS) {
      const out = applyVoicing(cmaj7, v.id)
      for (let i = 1; i < out.length; i++) expect(out[i]).toBeGreaterThan(out[i - 1])
    }
  })
})

describe('realize', () => {
  it('realizes C major triad at octave 4', () => {
    expect(realizeChord(0, 'maj', 'root', 4)).toEqual([60, 64, 67])
  })
  it('realizes a G7 rooted at G3', () => {
    expect(realizeChord(7, '7', 'root', 3)).toEqual([55, 59, 62, 65])
  })
  it('realizes a scale one octave plus top root', () => {
    const c = realizeScale(0, 'major', 4)
    expect(c[0]).toBe(60)
    expect(c[c.length - 1]).toBe(72)
    expect(c.length).toBe(8)
  })
})
