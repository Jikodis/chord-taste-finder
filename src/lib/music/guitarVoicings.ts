import { getQuality } from './chords'
import type { GuitarShape } from './guitar'

export interface Voicing extends GuitarShape {
  /** Chord tones intentionally absent from this voicing: subset of ['5th', 'root']. */
  omitted: string[]
  /** Playability score; lower = easier. */
  score: number
}

/** Standard tuning, low E → high E. */
export const OPEN_MIDI = [40, 45, 50, 55, 59, 64]
const MAX_FRET = 12
/** Hard span limit: max fretted − min fretted ≤ SPAN − 1. */
const SPAN = 4

function toNotation(frets: Array<number | null>): string {
  return frets.map((f) => (f === null ? 'x' : f >= 10 ? `(${f})` : String(f))).join('')
}

function fingersNeeded(fretted: number[]): number {
  if (fretted.length === 0) return 0
  const min = Math.min(...fretted)
  // Strings held at the lowest fretted fret share one (possibly barred) finger.
  return fretted.filter((f) => f > min).length + 1
}

/** Frets on `string` within [lo, hi] (plus open) sounding one of `allowed`. */
function candidateFrets(string: number, allowed: Set<number>, lo: number, hi: number): number[] {
  const out: number[] = []
  if (allowed.has(OPEN_MIDI[string] % 12)) out.push(0)
  for (let f = Math.max(1, lo); f <= hi; f++) {
    if (allowed.has((OPEN_MIDI[string] + f) % 12)) out.push(f)
  }
  return out
}

/**
 * Enumerate every voicing sounding all of `required`, only tones from `allowed`,
 * within the global playability limits. Deduplicated by notation.
 */
function search(required: Set<number>, allowed: Set<number>): Array<Array<number | null>> {
  const results: Array<Array<number | null>> = []
  const seen = new Set<string>()

  for (let lo = 1; lo + SPAN - 1 <= MAX_FRET; lo++) {
    const hi = lo + SPAN - 1
    const perString = OPEN_MIDI.map((_, s) => candidateFrets(s, allowed, lo, hi))
    // Pitch classes each string could still contribute (for pruning).
    const reachable = perString.map((cands, s) => new Set(cands.map((f) => (OPEN_MIDI[s] + f) % 12)))

    const frets: Array<number | null> = [null, null, null, null, null, null]
    const dfs = (s: number, sounded: number[]) => {
      if (s === 6) {
        const soundedSet = new Set(sounded.map((m) => m % 12))
        if (sounded.length < 3) return
        for (const pc of required) if (!soundedSet.has(pc)) return
        const fretted = frets.filter((f): f is number => f !== null && f > 0)
        if (fretted.length > 0 && Math.max(...fretted) - Math.min(...fretted) > SPAN - 1) return
        if (fingersNeeded(fretted) > 4) return
        const notation = toNotation(frets)
        if (!seen.has(notation)) {
          seen.add(notation)
          results.push([...frets])
        }
        return
      }
      // Prune: remaining strings must be able to cover the still-missing tones.
      const soundedSet = new Set(sounded.map((m) => m % 12))
      const missing = [...required].filter((pc) => !soundedSet.has(pc))
      if (missing.length > 6 - s) return
      for (const pc of missing) {
        let coverable = false
        for (let t = s; t < 6; t++) {
          if (reachable[t].has(pc)) {
            coverable = true
            break
          }
        }
        if (!coverable) return
      }
      frets[s] = null
      dfs(s + 1, sounded)
      for (const f of perString[s]) {
        frets[s] = f
        dfs(s + 1, [...sounded, OPEN_MIDI[s] + f])
      }
      frets[s] = null
    }
    dfs(0, [])
  }
  return results
}

/** Lower = easier. Weights are heuristic; ordering contract is what tests pin. */
function scoreVoicing(frets: Array<number | null>, rootPc: number): number {
  const fretted = frets.filter((f): f is number => f !== null && f > 0)
  const soundedMidi = frets
    .map((f, s) => (f === null ? -1 : OPEN_MIDI[s] + f))
    .filter((m) => m >= 0)
  let score = 0
  if (fretted.length > 0) {
    score += (Math.max(...fretted) - Math.min(...fretted)) * 4 // hand stretch
    score += (Math.min(...fretted) - 1) * 2 // low positions are easier to find
  }
  score += fretted.length * 2 // fingers down
  score -= frets.filter((f) => f === 0).length * 2 // open strings are free
  score -= soundedMidi.length * 3 // prefer fuller voicings
  const first = frets.findIndex((f) => f !== null)
  const last = 5 - [...frets].reverse().findIndex((f) => f !== null)
  for (let s = first; s <= last; s++) if (frets[s] === null) score += 6 // interior mute
  if (soundedMidi.length > 0 && soundedMidi[0] % 12 !== rootPc) score += 8 // non-root bass
  score += soundedMidi.filter((m) => m < 43 && m % 12 !== rootPc).length * 4 // muddy low tones
  return score
}

function toVoicing(frets: Array<number | null>, chordPcs: Set<number>, rootPc: number): Voicing {
  const sounded = new Set(
    frets.map((f, s) => (f === null ? -1 : (OPEN_MIDI[s] + f) % 12)).filter((pc) => pc >= 0)
  )
  const omitted: string[] = []
  for (const pc of chordPcs) {
    if (sounded.has(pc)) continue
    omitted.push(pc === rootPc ? 'root' : '5th') // only the 5th and root are ever relaxed
  }
  omitted.sort() // '5th' before 'root', deterministic
  const fretted = frets.filter((f): f is number => f !== null && f > 0)
  const baseFret = fretted.length > 0 && Math.max(...fretted) > SPAN ? Math.min(...fretted) : 0
  return { frets, notation: toNotation(frets), baseFret, omitted, score: scoreVoicing(frets, rootPc) }
}

function computeVoicings(rootPc: number, qualityId: string): Voicing[] {
  const quality = getQuality(qualityId)
  if (!quality) throw new Error(`Unknown chord quality: ${qualityId}`)
  const chordPcs = new Set(quality.intervals.map((i) => (rootPc + i) % 12))

  // Relaxation ladder: full set → drop perfect 5th → also drop root.
  // Only a *perfect* fifth (interval 7) is omittable; altered fifths are defining tones.
  const hasPerfectFifth = quality.intervals.some((i) => i % 12 === 7)
  const fifthPc = (rootPc + 7) % 12
  const ladder: Array<Set<number>> = [chordPcs]
  if (hasPerfectFifth) {
    const noFifth = new Set([...chordPcs].filter((pc) => pc !== fifthPc))
    ladder.push(noFifth)
    ladder.push(new Set([...noFifth].filter((pc) => pc !== rootPc)))
  } else {
    ladder.push(new Set([...chordPcs].filter((pc) => pc !== rootPc)))
  }

  for (const required of ladder) {
    // Tones outside `required` may still appear (they are real chord tones);
    // `omitted` reports what is actually absent per shape.
    const found = search(required, chordPcs)
    if (found.length > 0) {
      return found
        .map((f) => toVoicing(f, chordPcs, rootPc))
        .sort((a, b) => a.score - b.score || (a.notation < b.notation ? -1 : 1))
    }
  }
  return []
}

const memo = new Map<string, Voicing[]>()

/** All valid voicings for the chord, easiest first. Memoized: the UI calls this per rendered diagram. */
export function guitarVoicings(rootPc: number, qualityId: string): Voicing[] {
  const key = `${rootPc}:${qualityId}`
  let cached = memo.get(key)
  if (!cached) {
    cached = computeVoicings(rootPc, qualityId)
    memo.set(key, cached)
  }
  return cached
}
