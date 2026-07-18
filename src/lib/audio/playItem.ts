'use client'

import type { CatalogItem } from '../items/catalog'
import type { ProgressionDef } from '../music/progressions'
import { realizeChord, realizeScale } from '../music/realize'
import { playChord, playScale, playProgression, type Instrument } from './engine'

/** Keep chord roots centered around middle C: high roots drop an octave. */
function octaveFor(rootPc: number): number {
  return rootPc > 7 ? 3 : 4
}

export function progressionMidi(p: ProgressionDef): number[][] {
  return p.chords.map((c) => realizeChord(c.rootPc, c.qualityId, 'root', octaveFor(c.rootPc)))
}

/** Play any catalog item with the right rendering for its dimension. */
export async function playItem(item: CatalogItem, instrument: Instrument, bpm: number): Promise<void> {
  const p = item.payload
  switch (p.kind) {
    case 'key':
      await playScale(realizeScale(p.rootPc, p.scaleId, 4), instrument)
      break
    case 'quality':
      await playChord(realizeChord(0, p.qualityId, 'root', 4), instrument)
      break
    case 'voicing':
      await playChord(realizeChord(0, p.qualityId, p.voicingId, 4), instrument)
      break
    case 'progression':
      await playProgression(progressionMidi(p.progression), instrument, bpm)
      break
  }
}
