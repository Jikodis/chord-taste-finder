export interface VoicingDef {
  id: string
  name: string
  /** Minimum chord size (note count) this voicing applies to. */
  minNotes: number
}

export const VOICINGS: VoicingDef[] = [
  { id: 'root', name: 'Root position (closed)', minNotes: 2 },
  { id: 'inv1', name: '1st inversion', minNotes: 3 },
  { id: 'inv2', name: '2nd inversion', minNotes: 3 },
  { id: 'inv3', name: '3rd inversion', minNotes: 4 },
  { id: 'open', name: 'Open voicing', minNotes: 3 },
  { id: 'drop2', name: 'Drop-2', minNotes: 4 },
  { id: 'drop3', name: 'Drop-3', minNotes: 4 },
  { id: 'spread', name: 'Spread (root doubled low)', minNotes: 3 },
]

export function voicingsForChordSize(n: number): VoicingDef[] {
  return VOICINGS.filter((v) => v.minNotes <= n)
}

/**
 * Apply a voicing transform to a closed root-position chord (ascending midi numbers).
 * Always returns ascending midi numbers.
 */
export function applyVoicing(pitches: number[], voicingId: string): number[] {
  const p = [...pitches]
  let out: number[]
  switch (voicingId) {
    case 'root':
      out = p
      break
    case 'inv1':
      out = [...p.slice(1), p[0] + 12]
      break
    case 'inv2':
      out = [...p.slice(2), p[0] + 12, p[1] + 12]
      break
    case 'inv3':
      out = [...p.slice(3), p[0] + 12, p[1] + 12, p[2] + 12]
      break
    case 'open': {
      // Raise every other inner note an octave to spread the closed voicing.
      out = p.map((n, i) => (i > 0 && i < p.length - 1 && i % 2 === 1 ? n + 12 : n))
      break
    }
    case 'drop2': {
      const i = p.length - 2
      out = [...p]
      out[i] -= 12
      break
    }
    case 'drop3': {
      const i = p.length - 3
      out = [...p]
      out[i] -= 12
      break
    }
    case 'spread':
      out = [p[0] - 12, ...p]
      break
    default:
      out = p
  }
  return out.sort((a, b) => a - b)
}

const byId = new Map(VOICINGS.map((v) => [v.id, v]))

export function getVoicing(id: string): VoicingDef | undefined {
  return byId.get(id)
}
