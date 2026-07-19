import { describe, it, expect } from 'vitest'
import { guitarShape } from '@/lib/music/guitar'
import { OPEN_MIDI } from '@/lib/music/guitarVoicings'
import { getQuality } from '@/lib/music/chords'

describe('guitarShape (voicing-engine backed)', () => {
  it('always returns 6 strings', () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(guitarShape(pc, 'm7').frets).toHaveLength(6)
    }
  })

  it('sounds exactly the chord tones for classic chords', () => {
    for (const [pc, q] of [[0, 'maj'], [7, 'maj'], [4, 'min'], [6, 'maj']] as const) {
      const shape = guitarShape(pc, q)
      const sounded = new Set(
        shape.frets.map((f, s) => (f === null ? -1 : (OPEN_MIDI[s] + f) % 12)).filter((x) => x >= 0)
      )
      const expected = new Set(getQuality(q)!.intervals.map((i) => (pc + i) % 12))
      expect([...sounded].sort((a, b) => a - b)).toEqual([...expected].sort((a, b) => a - b))
    }
  })

  it('stays in open position for open-friendly chords', () => {
    expect(guitarShape(0, 'maj').baseFret).toBe(0)
    expect(guitarShape(4, 'min').baseFret).toBe(0)
  })
})
