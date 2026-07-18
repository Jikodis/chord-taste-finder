import { getScale } from '../music/scales'
import { getQuality } from '../music/chords'
import { pcToName } from '../music/notes'
import { realizeChord } from '../music/realize'

export interface KeyCandidate {
  itemId: string
  rootPc: number
  scaleId: string
  rating: number
}

export interface QualityCandidate {
  qualityId: string
  rating: number
}

export interface GeneratedChord {
  rootPc: number
  qualityId: string
  voicingId: string
  symbol: string
  roman: string
  midi: number[]
}

export interface GeneratedProgressionView {
  keyRootPc: number
  scaleId: string
  keyLabel: string
  chords: GeneratedChord[]
}

const MAJOR_DEGREES = [0, 2, 4, 5, 7, 9, 11]
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

function romanLabel(rootPc: number, keyRootPc: number, qualityId: string): string {
  const semis = (rootPc - keyRootPc + 12) % 12
  let best = 0
  let bestDiff = 12
  for (let d = 0; d < 7; d++) {
    const diff = Math.abs(semis - MAJOR_DEGREES[d])
    if (diff < bestDiff) {
      bestDiff = diff
      best = d
    }
  }
  const accidental = semis - MAJOR_DEGREES[best] === -1 ? 'b' : semis - MAJOR_DEGREES[best] === 1 ? '#' : ''
  const intervals = getQuality(qualityId)?.intervals ?? []
  const minorish = intervals.includes(3) && !intervals.includes(4)
  const base = minorish ? ROMAN[best].toLowerCase() : ROMAN[best]
  return `${accidental}${base}`
}

/**
 * Assemble a progression purely from the user's rated taste (PRD §3.4.1):
 * keys and qualities come only from the provided (already tier-filtered)
 * candidates; voicings use the user's top-ranked voicing per quality when
 * available. Roots stay on scale degrees of the chosen key for playability,
 * with no convention-based weighting of which degrees or qualities pair up.
 */
export function generateProgression(opts: {
  keys: KeyCandidate[]
  qualities: QualityCandidate[]
  bestVoicing: Map<string, string>
  length: number
  lockedKeyItemId?: string | null
  rand?: () => number
}): GeneratedProgressionView | null {
  const { keys, qualities, bestVoicing, length, lockedKeyItemId } = opts
  const rand = opts.rand ?? Math.random
  if (keys.length === 0 || qualities.length < 2 || length < 2) return null

  const key = lockedKeyItemId
    ? keys.find((k) => k.itemId === lockedKeyItemId) ?? keys[0]
    : weightedPick(keys, (k) => k.rating, rand)
  const scale = getScale(key.scaleId)
  if (!scale) return null

  const chords: GeneratedChord[] = []
  for (let i = 0; i < length; i++) {
    // First and (usually) last chord sit on the tonic so the ear has an anchor.
    const degreeInterval =
      i === 0 || (i === length - 1 && rand() < 0.6)
        ? 0
        : scale.intervals[Math.floor(rand() * scale.intervals.length)]
    const rootPc = (key.rootPc + degreeInterval) % 12
    const quality = weightedPick(qualities, (q) => q.rating, rand)
    const voicingId = bestVoicing.get(quality.qualityId) ?? 'root'
    const def = getQuality(quality.qualityId)!
    const midi = realizeChord(rootPc, quality.qualityId, voicingId, rootPc > 7 ? 3 : 4)
    chords.push({
      rootPc,
      qualityId: quality.qualityId,
      voicingId,
      symbol: `${pcToName(rootPc)}${def.symbol}`,
      roman: romanLabel(rootPc, key.rootPc, quality.qualityId),
      midi,
    })
  }

  return {
    keyRootPc: key.rootPc,
    scaleId: key.scaleId,
    keyLabel: `${pcToName(key.rootPc)} ${scale.name}`,
    chords,
  }
}

/** Sample proportional to (rating - min + 50) so higher-rated items appear more. */
function weightedPick<T>(items: T[], ratingOf: (t: T) => number, rand: () => number): T {
  const min = Math.min(...items.map(ratingOf))
  const weights = items.map((t) => ratingOf(t) - min + 50)
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rand() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}
