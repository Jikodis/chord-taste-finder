export type ScaleCategory = 'major-minor' | 'mode' | 'exotic'

export interface ScaleDef {
  id: string
  name: string
  intervals: number[]
  category: ScaleCategory
}

export const SCALES: ScaleDef[] = [
  { id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11], category: 'major-minor' },
  { id: 'minor', name: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10], category: 'major-minor' },
  { id: 'harmonic-minor', name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11], category: 'major-minor' },
  { id: 'melodic-minor', name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11], category: 'major-minor' },
  { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], category: 'mode' },
  { id: 'phrygian', name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], category: 'mode' },
  { id: 'lydian', name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], category: 'mode' },
  { id: 'mixolydian', name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], category: 'mode' },
  { id: 'locrian', name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10], category: 'mode' },
  { id: 'phrygian-dominant', name: 'Phrygian Dominant', intervals: [0, 1, 4, 5, 7, 8, 10], category: 'exotic' },
  { id: 'hungarian-minor', name: 'Hungarian Minor', intervals: [0, 2, 3, 6, 7, 8, 11], category: 'exotic' },
  { id: 'double-harmonic', name: 'Double Harmonic', intervals: [0, 1, 4, 5, 7, 8, 11], category: 'exotic' },
  { id: 'neapolitan-minor', name: 'Neapolitan Minor', intervals: [0, 1, 3, 5, 7, 8, 11], category: 'exotic' },
  { id: 'whole-tone', name: 'Whole Tone', intervals: [0, 2, 4, 6, 8, 10], category: 'exotic' },
  { id: 'diminished-wh', name: 'Diminished (Whole-Half)', intervals: [0, 2, 3, 5, 6, 8, 9, 11], category: 'exotic' },
  { id: 'diminished-hw', name: 'Diminished (Half-Whole)', intervals: [0, 1, 3, 4, 6, 7, 9, 10], category: 'exotic' },
  { id: 'blues', name: 'Blues', intervals: [0, 3, 5, 6, 7, 10], category: 'exotic' },
  { id: 'pentatonic-major', name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9], category: 'exotic' },
  { id: 'pentatonic-minor', name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10], category: 'exotic' },
  { id: 'ryukyu', name: 'Ryukyu', intervals: [0, 4, 5, 7, 11], category: 'exotic' },
  { id: 'hirajoshi', name: 'Hirajoshi', intervals: [0, 2, 3, 7, 8], category: 'exotic' },
  { id: 'in-sen', name: 'In-Sen', intervals: [0, 1, 5, 7, 10], category: 'exotic' },
  { id: 'iwato', name: 'Iwato', intervals: [0, 1, 5, 6, 10], category: 'exotic' },
  { id: 'bebop-dominant', name: 'Bebop Dominant', intervals: [0, 2, 4, 5, 7, 9, 10, 11], category: 'exotic' },
  { id: 'lydian-dominant', name: 'Lydian Dominant', intervals: [0, 2, 4, 6, 7, 9, 10], category: 'exotic' },
  { id: 'altered', name: 'Altered (Super Locrian)', intervals: [0, 1, 3, 4, 6, 8, 10], category: 'exotic' },
]

const byId = new Map(SCALES.map((s) => [s.id, s]))

export function getScale(id: string): ScaleDef | undefined {
  return byId.get(id)
}
