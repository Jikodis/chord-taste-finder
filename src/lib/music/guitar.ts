import { getQuality } from './chords'

/** Frets low-to-high (6th → 1st string); null = muted. */
export interface GuitarShape {
  frets: Array<number | null>
  /** Compact notation, e.g. 'x32010'. Frets ≥ 10 render in parens: '(10)'. */
  notation: string
  baseFret: number
}

/** Classic open shapes, keyed by `${rootPc}:${templateId}`. */
const OPEN_SHAPES: Record<string, Array<number | null>> = {
  '0:maj': [null, 3, 2, 0, 1, 0], // C
  '0:7': [null, 3, 2, 3, 1, 0], // C7
  '0:maj7': [null, 3, 2, 0, 0, 0], // Cmaj7
  '2:maj': [null, null, 0, 2, 3, 2], // D
  '2:min': [null, null, 0, 2, 3, 1], // Dm
  '2:7': [null, null, 0, 2, 1, 2], // D7
  '2:m7': [null, null, 0, 2, 1, 1], // Dm7
  '4:maj': [0, 2, 2, 1, 0, 0], // E
  '4:min': [0, 2, 2, 0, 0, 0], // Em
  '4:7': [0, 2, 0, 1, 0, 0], // E7
  '4:m7': [0, 2, 0, 0, 0, 0], // Em7
  '7:maj': [3, 2, 0, 0, 0, 3], // G
  '7:7': [3, 2, 0, 0, 0, 1], // G7
  '9:maj': [null, 0, 2, 2, 2, 0], // A
  '9:min': [null, 0, 2, 2, 1, 0], // Am
  '9:7': [null, 0, 2, 0, 2, 0], // A7
  '9:m7': [null, 0, 2, 0, 1, 0], // Am7
  '9:maj7': [null, 0, 2, 1, 2, 0], // Amaj7
  '11:7': [null, 2, 1, 2, 0, 2], // B7
}

/** Movable templates: intervals from the barre fret. E-shape roots on string 6 (E=pc 4), A-shape on string 5 (A=pc 9). */
const E_SHAPES: Record<string, Array<number | null>> = {
  maj: [0, 2, 2, 1, 0, 0],
  min: [0, 2, 2, 0, 0, 0],
  '7': [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, null],
  sus4: [0, 2, 2, 2, 0, 0],
  '6': [0, 2, 2, 1, 2, 0],
}
const A_SHAPES: Record<string, Array<number | null>> = {
  maj: [null, 0, 2, 2, 2, 0],
  min: [null, 0, 2, 2, 1, 0],
  '7': [null, 0, 2, 0, 2, 0],
  m7: [null, 0, 2, 0, 1, 0],
  maj7: [null, 0, 2, 1, 2, 0],
  mMaj7: [null, 0, 2, 1, 1, 0],
  sus2: [null, 0, 2, 2, 0, 0],
  sus4: [null, 0, 2, 2, 3, 0],
  dim: [null, 0, 1, 2, 1, null],
  dim7: [null, 0, 1, 2, 1, 2],
  aug: [null, 0, 3, 2, 2, 1],
  '6': [null, 0, 2, 2, 2, 2],
  m6: [null, 0, 2, 2, 1, 2],
  add9: [null, 0, 2, 4, 2, 0],
}

/** Reduce any chord quality to the nearest playable template id. */
export function templateFor(qualityId: string): string {
  const q = getQuality(qualityId)
  if (!q) return 'maj'
  const has = (i: number) => q.intervals.some((x) => x % 12 === i)
  const third = has(4) ? 'maj' : has(3) ? 'min' : null
  if (!third) {
    if (has(5)) return 'sus4'
    if (has(2)) return 'sus2'
    return 'maj'
  }
  if (has(3) && has(6)) return q.intervals.some((x) => x % 12 === 9) ? 'dim7' : 'dim'
  if (has(4) && has(8)) return 'aug'
  if (third === 'maj') {
    if (has(11)) return 'maj7'
    if (has(10)) return '7'
    if (has(9) && !has(10) && !has(11)) return '6'
    if (has(2) && !has(10) && !has(11)) return 'add9'
    return 'maj'
  }
  if (has(11)) return 'mMaj7'
  if (has(10)) return 'm7'
  if (has(9) && !has(10)) return 'm6'
  return 'min'
}

function offsetShape(template: Array<number | null>, offset: number): Array<number | null> {
  return template.map((f) => (f === null ? null : f + offset))
}

function toNotation(frets: Array<number | null>): string {
  return frets.map((f) => (f === null ? 'x' : f >= 10 ? `(${f})` : String(f))).join('')
}

/** Best-effort guitar shape for a chord: open shape if classic, else nearest barre form. */
export function guitarShape(rootPc: number, qualityId: string): GuitarShape {
  const template = templateFor(qualityId)
  const open = OPEN_SHAPES[`${rootPc}:${template}`]
  if (open) return { frets: open, notation: toNotation(open), baseFret: 0 }

  const eFret = (rootPc - 4 + 12) % 12
  const aFret = (rootPc - 9 + 12) % 12
  const eTemplate = E_SHAPES[template]
  const aTemplate = A_SHAPES[template]

  const candidates: Array<{ frets: Array<number | null>; base: number }> = []
  if (eTemplate && eFret > 0) candidates.push({ frets: offsetShape(eTemplate, eFret), base: eFret })
  if (aTemplate && aFret > 0) candidates.push({ frets: offsetShape(aTemplate, aFret), base: aFret })
  if (eTemplate && eFret === 0) candidates.push({ frets: eTemplate, base: 0 })
  if (aTemplate && aFret === 0) candidates.push({ frets: aTemplate, base: 0 })

  if (candidates.length === 0) {
    const fallback = offsetShape(A_SHAPES.maj, aFret)
    return { frets: fallback, notation: toNotation(fallback), baseFret: aFret }
  }
  candidates.sort((x, y) => x.base - y.base)
  const best = candidates[0]
  return { frets: best.frets, notation: toNotation(best.frets), baseFret: best.base }
}
