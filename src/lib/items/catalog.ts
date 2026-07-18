import { SCALES } from '../music/scales'
import { CHORD_QUALITIES } from '../music/chords'
import { voicingsForChordSize, getVoicing } from '../music/voicings'
import { getQuality } from '../music/chords'
import { pcToName } from '../music/notes'
import {
  SEED_TEMPLATES,
  instantiateSeed,
  generateNovelProgression,
  progressionLabel,
  type ProgressionDef,
} from '../music/progressions'

export type Dimension = 'key' | 'quality' | 'voicing' | 'progression'

export interface KeyPayload {
  kind: 'key'
  rootPc: number
  scaleId: string
}
export interface QualityPayload {
  kind: 'quality'
  qualityId: string
}
export interface VoicingPayload {
  kind: 'voicing'
  qualityId: string
  voicingId: string
}
export interface ProgressionPayload {
  kind: 'progression'
  progression: ProgressionDef
}
export type ItemPayload = KeyPayload | QualityPayload | VoicingPayload | ProgressionPayload

export interface CatalogItem {
  id: string
  dimension: Dimension
  label: string
  sublabel?: string
  payload: ItemPayload
}

/** Qualities representative enough to be worth testing across voicings. */
const VOICING_QUALITY_IDS = ['maj', 'min', '7', 'maj7', 'm7', 'dim7', 'm7b5', 'mMaj7', '6', 'm6', 'add9', '9']

const MAJOR_KEYS = [0, 7, 2, 3] // C, G, D, Eb
const MINOR_KEYS = [9, 4, 0, 6] // A, E, C, F#
const NOVEL_COUNT = 40
const NOVEL_KEYS: Array<[number, number]> = [
  [0, 7],
  [9, 4],
  [2, 10],
  [5, 1],
] // each novel template lands in 2 keys for cross-key decoupling

export function buildCatalog(): CatalogItem[] {
  const items: CatalogItem[] = []

  for (const scale of SCALES) {
    for (let root = 0; root < 12; root++) {
      items.push({
        id: `key:${root}:${scale.id}`,
        dimension: 'key',
        label: `${pcToName(root)} ${scale.name}`,
        sublabel: scale.category,
        payload: { kind: 'key', rootPc: root, scaleId: scale.id },
      })
    }
  }

  for (const q of CHORD_QUALITIES) {
    items.push({
      id: `qual:${q.id}`,
      dimension: 'quality',
      label: q.symbol ? `C${q.symbol}` : 'C major',
      sublabel: q.name,
      payload: { kind: 'quality', qualityId: q.id },
    })
  }

  for (const qid of VOICING_QUALITY_IDS) {
    const quality = getQuality(qid)!
    for (const v of voicingsForChordSize(quality.intervals.length)) {
      items.push({
        id: `voic:${qid}:${v.id}`,
        dimension: 'voicing',
        label: `C${quality.symbol || ''} — ${v.name}`,
        sublabel: quality.name,
        payload: { kind: 'voicing', qualityId: qid, voicingId: v.id },
      })
    }
  }

  const progs: ProgressionDef[] = []
  for (const t of SEED_TEMPLATES) {
    const keys = t.scaleId === 'major' ? MAJOR_KEYS : MINOR_KEYS
    for (const k of keys) progs.push(instantiateSeed(t, k))
  }
  for (let seed = 0; seed < NOVEL_COUNT; seed++) {
    const scaleId = seed % 2 === 0 ? 'major' : 'minor'
    const length = 3 + (seed % 5) // 3..7 chords
    const [k1, k2] = NOVEL_KEYS[seed % NOVEL_KEYS.length]
    progs.push(generateNovelProgression(seed, k1, scaleId, length))
    progs.push(generateNovelProgression(seed, k2, scaleId, length))
  }
  for (const p of progs) {
    items.push({
      id: `prog:${p.id}`,
      dimension: 'progression',
      label: p.name,
      sublabel: progressionLabel(p),
      payload: { kind: 'progression', progression: p },
    })
  }

  return items
}

export function voicingName(voicingId: string): string {
  return getVoicing(voicingId)?.name ?? voicingId
}

export const DIMENSIONS: Dimension[] = ['key', 'quality', 'voicing', 'progression']

export const DIMENSION_LABELS: Record<Dimension, string> = {
  key: 'Keys & Scales',
  quality: 'Chord Qualities',
  voicing: 'Voicings & Inversions',
  progression: 'Progressions',
}
