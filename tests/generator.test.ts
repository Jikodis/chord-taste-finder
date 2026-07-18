import { describe, it, expect } from 'vitest'
import { generateProgression } from '@/lib/generator/generate'
import { mulberry32 } from '@/lib/music/progressions'

const keys = [
  { itemId: 'key:0:major', rootPc: 0, scaleId: 'major', rating: 1600 },
  { itemId: 'key:7:lydian', rootPc: 7, scaleId: 'lydian', rating: 1550 },
]
const qualities = [
  { qualityId: 'maj7', rating: 1650 },
  { qualityId: 'm9', rating: 1600 },
  { qualityId: 'aug', rating: 1500 },
]

describe('generateProgression', () => {
  it('uses only supplied (tier-filtered) qualities and keys', () => {
    const rand = mulberry32(3)
    for (let i = 0; i < 10; i++) {
      const p = generateProgression({ keys, qualities, bestVoicing: new Map(), length: 4, rand })!
      expect([0, 7]).toContain(p.keyRootPc)
      for (const c of p.chords) {
        expect(['maj7', 'm9', 'aug']).toContain(c.qualityId)
      }
    }
  })
  it('respects requested length and anchors the first chord on the tonic', () => {
    const p = generateProgression({ keys, qualities, bestVoicing: new Map(), length: 6, rand: mulberry32(9) })!
    expect(p.chords.length).toBe(6)
    expect(p.chords[0].rootPc).toBe(p.keyRootPc)
  })
  it('honors a locked key', () => {
    const p = generateProgression({
      keys,
      qualities,
      bestVoicing: new Map(),
      length: 3,
      lockedKeyItemId: 'key:7:lydian',
      rand: mulberry32(1),
    })!
    expect(p.keyRootPc).toBe(7)
    expect(p.scaleId).toBe('lydian')
  })
  it('uses the top-ranked voicing for a quality when available', () => {
    const p = generateProgression({
      keys,
      qualities: [{ qualityId: 'maj7', rating: 1600 }, { qualityId: 'maj7', rating: 1600 }],
      bestVoicing: new Map([['maj7', 'inv2']]),
      length: 3,
      rand: mulberry32(5),
    })!
    expect(p.chords.every((c) => c.voicingId === 'inv2')).toBe(true)
  })
  it('returns null on insufficient data', () => {
    expect(generateProgression({ keys: [], qualities, bestVoicing: new Map(), length: 4 })).toBeNull()
    expect(generateProgression({ keys, qualities: qualities.slice(0, 1), bestVoicing: new Map(), length: 4 })).toBeNull()
  })
})
