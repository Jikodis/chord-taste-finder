import { getScale } from './scales'
import { CHORD_QUALITIES, getQuality } from './chords'
import { pcToName } from './notes'

export interface ProgressionChord {
  rootPc: number
  qualityId: string
  roman: string
}

export interface ProgressionTags {
  movement: 'diatonic' | 'chromatic'
  source: 'seeded' | 'novel'
}

export interface ProgressionDef {
  id: string
  name: string
  keyRootPc: number
  scaleId: string
  chords: ProgressionChord[]
  tags: ProgressionTags
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/** Match an interval pc-set (relative to root) to a known chord quality id. */
function matchQuality(intervals: number[]): string {
  const key = intervals.join(',')
  for (const q of CHORD_QUALITIES) {
    if (q.intervals.map((i) => i % 12).sort((a, b) => a - b).join(',') === key) return q.id
  }
  // Fall back to the closest triad classification
  return intervals.includes(3) ? 'min' : 'maj'
}

/** Build the diatonic chord on a scale degree by stacking thirds (7-note scales). */
export function diatonicChord(
  scaleId: string,
  degree: number,
  keyRootPc: number,
  seventh = false
): ProgressionChord {
  const scale = getScale(scaleId)!
  const n = scale.intervals.length
  const stack = seventh ? [0, 2, 4, 6] : [0, 2, 4]
  const pitches = stack.map((s) => {
    const idx = (degree + s) % n
    const wrap = Math.floor((degree + s) / n) * 12
    return scale.intervals[idx] + wrap
  })
  const rootPc = (keyRootPc + scale.intervals[degree]) % 12
  const rel = pitches.map((p) => (p - pitches[0] + 24) % 24).sort((a, b) => a - b)
  const relPc = [...new Set(rel.map((r) => r % 12))].sort((a, b) => a - b)
  const qualityId = matchQuality(relPc)
  const roman = romanFor(degree, scale.intervals[degree], qualityId, scaleId)
  return { rootPc, qualityId, roman }
}

function romanFor(degree: number, semitonesFromTonic: number, qualityId: string, scaleId: string): string {
  const majorDegrees = [0, 2, 4, 5, 7, 9, 11]
  const base = ROMAN[degree % 7]
  const diff = semitonesFromTonic - majorDegrees[degree % 7]
  const accidental = diff === -1 ? 'b' : diff === 1 ? '#' : ''
  const intervals = getQuality(qualityId)?.intervals ?? []
  const minorish = intervals.includes(3) && !intervals.includes(4)
  const numeral = minorish ? base.toLowerCase() : base
  const suffix = qualityId.includes('dim') ? '°' : qualityId === 'aug' ? '+' : ''
  const seventh = qualityId.includes('7') ? '7' : ''
  void scaleId
  return `${accidental}${numeral}${suffix}${seventh}`
}

/** A chromatic (non-diatonic) chord specified directly. */
function chromatic(rootOffset: number, qualityId: string, roman: string, keyRootPc: number): ProgressionChord {
  return { rootPc: (keyRootPc + rootOffset) % 12, qualityId, roman }
}

export interface SeedTemplate {
  id: string
  name: string
  scaleId: 'major' | 'minor'
  /** Degrees (0-indexed) or chromatic specs. */
  build: (keyRootPc: number) => ProgressionChord[]
}

const d = diatonicChord

export const SEED_TEMPLATES: SeedTemplate[] = [
  { id: 'I-IV-V-I', name: 'I–IV–V–I', scaleId: 'major', build: (k) => [d('major', 0, k), d('major', 3, k), d('major', 4, k), d('major', 0, k)] },
  { id: 'ii-V-I', name: 'ii–V–I', scaleId: 'major', build: (k) => [d('major', 1, k, true), d('major', 4, k, true), d('major', 0, k, true)] },
  { id: 'I-V-vi-IV', name: 'I–V–vi–IV', scaleId: 'major', build: (k) => [d('major', 0, k), d('major', 4, k), d('major', 5, k), d('major', 3, k)] },
  { id: 'I-vi-IV-V', name: 'I–vi–IV–V (50s)', scaleId: 'major', build: (k) => [d('major', 0, k), d('major', 5, k), d('major', 3, k), d('major', 4, k)] },
  { id: 'vi-IV-I-V', name: 'vi–IV–I–V', scaleId: 'major', build: (k) => [d('major', 5, k), d('major', 3, k), d('major', 0, k), d('major', 4, k)] },
  { id: 'I-IV-vi-V', name: 'I–IV–vi–V', scaleId: 'major', build: (k) => [d('major', 0, k), d('major', 3, k), d('major', 5, k), d('major', 4, k)] },
  { id: 'I-bVII-IV', name: 'I–bVII–IV (Mixolydian)', scaleId: 'major', build: (k) => [d('major', 0, k), chromatic(10, 'maj', 'bVII', k), d('major', 3, k)] },
  { id: 'blues-turn', name: 'I7–IV7–I7–V7 (blues)', scaleId: 'major', build: (k) => [chromatic(0, '7', 'I7', k), chromatic(5, '7', 'IV7', k), chromatic(0, '7', 'I7', k), chromatic(7, '7', 'V7', k)] },
  { id: 'ii-V-I-vi', name: 'ii–V–I–vi', scaleId: 'major', build: (k) => [d('major', 1, k, true), d('major', 4, k, true), d('major', 0, k, true), d('major', 5, k, true)] },
  { id: 'tritone-sub', name: 'ii–bII7–I (tritone sub)', scaleId: 'major', build: (k) => [d('major', 1, k, true), chromatic(1, '7', 'bII7', k), d('major', 0, k, true)] },
  { id: 'i-iv-v', name: 'i–iv–v', scaleId: 'minor', build: (k) => [d('minor', 0, k), d('minor', 3, k), d('minor', 4, k)] },
  { id: 'i-bVI-bIII-bVII', name: 'i–bVI–bIII–bVII', scaleId: 'minor', build: (k) => [d('minor', 0, k), d('minor', 5, k), d('minor', 2, k), d('minor', 6, k)] },
  { id: 'andalusian', name: 'i–bVII–bVI–V (Andalusian)', scaleId: 'minor', build: (k) => [d('minor', 0, k), d('minor', 6, k), d('minor', 5, k), chromatic(7, '7', 'V7', k)] },
  { id: 'i-iv-i-v', name: 'i–iv–i–V7', scaleId: 'minor', build: (k) => [d('minor', 0, k), d('minor', 3, k), d('minor', 0, k), chromatic(7, '7', 'V7', k)] },
]

export function instantiateSeed(template: SeedTemplate, keyRootPc: number): ProgressionDef {
  return {
    id: `${template.id}:${keyRootPc}`,
    name: template.name,
    keyRootPc,
    scaleId: template.scaleId,
    chords: template.build(keyRootPc),
    tags: {
      movement: template.build(keyRootPc).some((c) => c.roman.startsWith('b') || c.roman.startsWith('#')) ? 'chromatic' : 'diatonic',
      source: 'seeded',
    },
  }
}

/** Deterministic PRNG so the generated catalog is identical across sessions. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CHROMATIC_MOVES: Array<(k: number) => ProgressionChord> = [
  (k) => chromatic(1, '7', 'bII7', k), // tritone sub
  (k) => chromatic(10, 'maj', 'bVII', k), // borrowed bVII
  (k) => chromatic(8, 'maj', 'bVI', k), // borrowed bVI
  (k) => chromatic(5, 'min', 'iv', k), // borrowed iv
  (k) => chromatic(4, 'maj', 'III', k), // chromatic mediant
  (k) => chromatic(9, 'maj', 'VI', k), // chromatic mediant
  (k) => chromatic(3, 'maj', 'bIII', k), // borrowed bIII
]

/**
 * Generate a novel progression via a seeded random walk over diatonic degrees
 * with occasional chromatic substitutions (borrowed chords, tritone subs, mediants).
 */
export function generateNovelProgression(
  seed: number,
  keyRootPc: number,
  scaleId: 'major' | 'minor',
  length: number
): ProgressionDef {
  const rand = mulberry32(seed * 2654435761 + 1)
  const chords: ProgressionChord[] = []
  let usedChromatic = false
  let degree = 0
  for (let i = 0; i < length; i++) {
    const seventh = rand() < 0.35
    if (i > 0 && rand() < 0.22) {
      const move = CHROMATIC_MOVES[Math.floor(rand() * CHROMATIC_MOVES.length)]
      chords.push(move(keyRootPc))
      usedChromatic = true
    } else {
      chords.push(diatonicChord(scaleId, degree, keyRootPc, seventh))
    }
    // Weighted walk: favor strong root motion (4ths/5ths), sometimes steps
    const steps = [3, 4, 1, 5, 2, 6]
    degree = rand() < 0.5 ? steps[Math.floor(rand() * 2)] : steps[Math.floor(rand() * steps.length)]
    if (i === length - 2 && rand() < 0.5) degree = 0 // often resolve home
  }
  return {
    id: `novel-${seed}:${keyRootPc}`,
    name: chords.map((c) => c.roman).join('–'),
    keyRootPc,
    scaleId,
    chords,
    tags: { movement: usedChromatic ? 'chromatic' : 'diatonic', source: 'novel' },
  }
}

export function progressionLabel(p: ProgressionDef): string {
  return `${p.name} in ${pcToName(p.keyRootPc)} ${getScale(p.scaleId)?.name ?? p.scaleId}`
}
