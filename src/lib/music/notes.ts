export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

export function pcToName(pc: number, preferFlat = false): string {
  const i = ((pc % 12) + 12) % 12
  return preferFlat ? FLAT_NAMES[i] : NOTE_NAMES[i]
}

export function midiToName(midi: number, preferFlat = false): string {
  const octave = Math.floor(midi / 12) - 1
  return `${pcToName(midi % 12, preferFlat)}${octave}`
}

/** Midi number for a pitch class at a given octave (C4 = 60). */
export function pcToMidi(pc: number, octave: number): number {
  return (octave + 1) * 12 + pc
}
