import { pcToMidi } from './notes'
import { getQuality } from './chords'
import { getScale } from './scales'
import { applyVoicing } from './voicings'

/** Realize a chord quality on a root pitch class as ascending midi numbers. */
export function realizeChord(rootPc: number, qualityId: string, voicingId = 'root', octave = 4): number[] {
  const quality = getQuality(qualityId)
  if (!quality) throw new Error(`Unknown chord quality: ${qualityId}`)
  const root = pcToMidi(rootPc, octave)
  const closed = quality.intervals.map((i) => root + i)
  return applyVoicing(closed, voicingId)
}

/** Realize a scale as one ascending octave plus the top root. */
export function realizeScale(rootPc: number, scaleId: string, octave = 4): number[] {
  const scale = getScale(scaleId)
  if (!scale) throw new Error(`Unknown scale: ${scaleId}`)
  const root = pcToMidi(rootPc, octave)
  return [...scale.intervals.map((i) => root + i), root + 12]
}
