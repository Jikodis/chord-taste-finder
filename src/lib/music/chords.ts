export type ChordCategory =
  | 'triad'
  | 'sixth'
  | 'seventh'
  | 'extended'
  | 'altered'
  | 'suspended'
  | 'added'
  | 'quartal'

export interface ChordQualityDef {
  id: string
  /** Chord symbol suffix, e.g. 'maj7', 'm7b5'. Root name is prepended at display time. */
  symbol: string
  name: string
  intervals: number[]
  category: ChordCategory
}

function q(id: string, symbol: string, name: string, intervals: number[], category: ChordCategory): ChordQualityDef {
  return { id, symbol, name, intervals, category }
}

const EXPLICIT: ChordQualityDef[] = [
  // Triads
  q('maj', '', 'Major', [0, 4, 7], 'triad'),
  q('min', 'm', 'Minor', [0, 3, 7], 'triad'),
  q('dim', 'dim', 'Diminished', [0, 3, 6], 'triad'),
  q('aug', 'aug', 'Augmented', [0, 4, 8], 'triad'),
  q('majb5', '(b5)', 'Major flat-five', [0, 4, 6], 'triad'),
  q('minsharp5', 'm(#5)', 'Minor sharp-five', [0, 3, 8], 'triad'),
  q('5', '5', 'Power chord', [0, 7], 'triad'),
  // Suspended
  q('sus2', 'sus2', 'Suspended 2nd', [0, 2, 7], 'suspended'),
  q('sus4', 'sus4', 'Suspended 4th', [0, 5, 7], 'suspended'),
  q('sus24', 'sus24', 'Suspended 2nd & 4th', [0, 2, 5, 7], 'suspended'),
  q('sussharp4', 'sus#4', 'Suspended sharp-4th', [0, 6, 7], 'suspended'),
  q('7sus4', '7sus4', 'Dominant 7th sus4', [0, 5, 7, 10], 'suspended'),
  q('7sus2', '7sus2', 'Dominant 7th sus2', [0, 2, 7, 10], 'suspended'),
  q('maj7sus4', 'maj7sus4', 'Major 7th sus4', [0, 5, 7, 11], 'suspended'),
  q('maj7sus2', 'maj7sus2', 'Major 7th sus2', [0, 2, 7, 11], 'suspended'),
  q('9sus4', '9sus4', 'Dominant 9th sus4', [0, 5, 7, 10, 14], 'suspended'),
  q('13sus4', '13sus4', 'Dominant 13th sus4', [0, 5, 7, 10, 14, 21], 'suspended'),
  q('6sus4', '6sus4', 'Sixth sus4', [0, 5, 7, 9], 'suspended'),
  q('6sus2', '6sus2', 'Sixth sus2', [0, 2, 7, 9], 'suspended'),
  // Sixths
  q('6', '6', 'Major 6th', [0, 4, 7, 9], 'sixth'),
  q('m6', 'm6', 'Minor 6th', [0, 3, 7, 9], 'sixth'),
  q('69', '6/9', 'Six-nine', [0, 4, 7, 9, 14], 'sixth'),
  q('m69', 'm6/9', 'Minor six-nine', [0, 3, 7, 9, 14], 'sixth'),
  // Sevenths
  q('maj7', 'maj7', 'Major 7th', [0, 4, 7, 11], 'seventh'),
  q('7', '7', 'Dominant 7th', [0, 4, 7, 10], 'seventh'),
  q('m7', 'm7', 'Minor 7th', [0, 3, 7, 10], 'seventh'),
  q('dim7', 'dim7', 'Diminished 7th', [0, 3, 6, 9], 'seventh'),
  q('m7b5', 'm7b5', 'Half-diminished 7th', [0, 3, 6, 10], 'seventh'),
  q('mMaj7', 'm(maj7)', 'Minor-major 7th', [0, 3, 7, 11], 'seventh'),
  q('augMaj7', 'maj7#5', 'Augmented-major 7th', [0, 4, 8, 11], 'seventh'),
  q('maj7b5', 'maj7b5', 'Major 7th flat-five', [0, 4, 6, 11], 'seventh'),
  q('dimMaj7', 'dim(maj7)', 'Diminished-major 7th', [0, 3, 6, 11], 'seventh'),
  // Added-tone
  q('add9', 'add9', 'Added 9th', [0, 4, 7, 14], 'added'),
  q('madd9', 'm(add9)', 'Minor added 9th', [0, 3, 7, 14], 'added'),
  q('add11', 'add11', 'Added 11th', [0, 4, 7, 17], 'added'),
  q('madd11', 'm(add11)', 'Minor added 11th', [0, 3, 7, 17], 'added'),
  q('addsharp11', 'add#11', 'Added sharp-11th', [0, 4, 7, 18], 'added'),
  q('m7add11', 'm7(add11)', 'Minor 7th added 11th', [0, 3, 7, 10, 17], 'added'),
  // Ninths
  q('maj9', 'maj9', 'Major 9th', [0, 4, 7, 11, 14], 'extended'),
  q('9', '9', 'Dominant 9th', [0, 4, 7, 10, 14], 'extended'),
  q('m9', 'm9', 'Minor 9th', [0, 3, 7, 10, 14], 'extended'),
  q('mMaj9', 'm(maj9)', 'Minor-major 9th', [0, 3, 7, 11, 14], 'extended'),
  q('augMaj9', 'maj9#5', 'Augmented-major 9th', [0, 4, 8, 11, 14], 'extended'),
  q('m9b5', 'm9b5', 'Half-diminished 9th', [0, 3, 6, 10, 14], 'extended'),
  q('9b5', '9b5', 'Dominant 9th flat-five', [0, 4, 6, 10, 14], 'extended'),
  q('9sharp5', '9#5', 'Dominant 9th sharp-five', [0, 4, 8, 10, 14], 'extended'),
  // Elevenths
  q('11', '11', 'Dominant 11th', [0, 4, 7, 10, 14, 17], 'extended'),
  q('m11', 'm11', 'Minor 11th', [0, 3, 7, 10, 14, 17], 'extended'),
  q('maj7sharp11', 'maj7#11', 'Major 7th sharp-11', [0, 4, 7, 11, 18], 'extended'),
  q('maj9sharp11', 'maj9#11', 'Major 9th sharp-11', [0, 4, 7, 11, 14, 18], 'extended'),
  q('9sharp11', '9#11', 'Dominant 9th sharp-11', [0, 4, 7, 10, 14, 18], 'extended'),
  q('m11b5', 'm11b5', 'Half-diminished 11th', [0, 3, 6, 10, 14, 17], 'extended'),
  q('mMaj11', 'm(maj11)', 'Minor-major 11th', [0, 3, 7, 11, 14, 17], 'extended'),
  // Thirteenths
  q('13', '13', 'Dominant 13th', [0, 4, 7, 10, 14, 21], 'extended'),
  q('maj13', 'maj13', 'Major 13th', [0, 4, 7, 11, 14, 21], 'extended'),
  q('m13', 'm13', 'Minor 13th', [0, 3, 7, 10, 14, 21], 'extended'),
  q('13sharp11', '13#11', 'Dominant 13th sharp-11', [0, 4, 7, 10, 14, 18, 21], 'extended'),
  q('maj13sharp11', 'maj13#11', 'Major 13th sharp-11', [0, 4, 7, 11, 14, 18, 21], 'extended'),
  q('mMaj13', 'm(maj13)', 'Minor-major 13th', [0, 3, 7, 11, 14, 21], 'extended'),
  // Quartal
  q('quartal3', 'quartal', 'Quartal (3 notes)', [0, 5, 10], 'quartal'),
  q('quartal4', 'quartal4', 'Quartal (4 notes)', [0, 5, 10, 15], 'quartal'),
  q('sowhat', 'So What', '"So What" voicing chord', [0, 5, 10, 15, 19], 'quartal'),
]

/** Altered-dominant grid: every combination of fifth alteration × altered ninth × upper tension. */
function alteredDominants(): ChordQualityDef[] {
  const out: ChordQualityDef[] = []
  const fifths: Array<[string, number | null]> = [['', 7], ['b5', 6], ['#5', 8]]
  const nines: Array<[string, number | null]> = [['', null], ['b9', 13], ['#9', 15]]
  const extras: Array<[string, number | null]> = [['', null], ['#11', 18], ['b13', 20]]
  for (const [fLabel, fifth] of fifths) {
    for (const [nLabel, nine] of nines) {
      for (const [eLabel, extra] of extras) {
        if (!fLabel && !nLabel && !eLabel) continue // plain dom7 is explicit
        const intervals = [0, 4, fifth!, 10, nine, extra].filter((x): x is number => x !== null)
        intervals.sort((a, b) => a - b)
        const label = `7${fLabel}${nLabel}${eLabel}`
        out.push(q(`alt-${label}`, label, `Dominant ${label.slice(1)} altered`, intervals, 'altered'))
      }
    }
  }
  return out
}

/** Added-tone grid over the basic triads. */
function triadAdds(): ChordQualityDef[] {
  const out: ChordQualityDef[] = []
  const triads: Array<[string, string, number[]]> = [
    ['maj', '', [0, 4, 7]],
    ['min', 'm', [0, 3, 7]],
    ['dim', 'dim', [0, 3, 6]],
    ['aug', 'aug', [0, 4, 8]],
    ['sus2', 'sus2', [0, 2, 7]],
    ['sus4', 'sus4', [0, 5, 7]],
  ]
  const adds: Array<[string, number]> = [['add9', 14], ['addb9', 13], ['add#11', 18], ['add6', 9]]
  for (const [tid, tSym, tInts] of triads) {
    for (const [aLabel, aInt] of adds) {
      if (tInts.some((i) => i % 12 === aInt % 12)) continue
      const intervals = [...tInts, aInt].sort((a, b) => a - b)
      out.push(q(`${tid}-${aLabel}`, `${tSym}(${aLabel})`, `${tid} ${aLabel}`, intervals, 'added'))
    }
  }
  return out
}

function dedupe(defs: ChordQualityDef[]): ChordQualityDef[] {
  const seen = new Set<string>()
  const out: ChordQualityDef[] = []
  for (const d of defs) {
    const key = d.intervals.join(',')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(d)
  }
  return out
}

export const CHORD_QUALITIES: ChordQualityDef[] = dedupe([
  ...EXPLICIT,
  ...alteredDominants(),
  ...triadAdds(),
])

const byId = new Map(CHORD_QUALITIES.map((c) => [c.id, c]))

export function getQuality(id: string): ChordQualityDef | undefined {
  return byId.get(id)
}
