import { guitarVoicings } from './guitarVoicings'

/** Frets low-to-high (6th → 1st string); null = muted. */
export interface GuitarShape {
  frets: Array<number | null>
  /** Compact notation, e.g. 'x32010'. Frets ≥ 10 render in parens: '(10)'. */
  notation: string
  baseFret: number
}

/** Easiest correct shape for a chord — the voicing engine's top result. */
export function guitarShape(rootPc: number, qualityId: string): GuitarShape {
  return guitarVoicings(rootPc, qualityId)[0]
}
