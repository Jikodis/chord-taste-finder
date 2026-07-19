import type { TierRows } from './tiersView'
import type { Tier } from './ranking/tiers'
import type { ProgressionDef } from './music/progressions'

/** The user's top-rated key root; C when nothing is rated. */
export function defaultKeyPc(keyRows: TierRows): number {
  for (const row of keyRows) {
    for (const t of row.items) {
      if (t.item.payload.kind === 'key') return t.item.payload.rootPc
    }
  }
  return 0
}

export interface TopScale {
  scaleId: string
  tier: Tier
  /** The label the user actually rated, e.g. 'C Blues' — shown so ratings stay traceable. */
  ratedAs: string
}

/** Top scales deduped by scale type (a scale rated in several roots counts once, best tier wins). */
export function topScales(keyRows: TierRows, limit = 6): TopScale[] {
  const seen = new Set<string>()
  const out: TopScale[] = []
  for (const row of keyRows) {
    for (const t of row.items) {
      if (t.item.payload.kind !== 'key') continue
      const { scaleId } = t.item.payload
      if (seen.has(scaleId)) continue
      seen.add(scaleId)
      out.push({ scaleId, tier: row.tier, ratedAs: t.item.label })
      if (out.length >= limit) return out
    }
  }
  return out
}

export function topQualities(qualityRows: TierRows, limit = 8): Array<{ qualityId: string; tier: Tier }> {
  const out: Array<{ qualityId: string; tier: Tier }> = []
  for (const row of qualityRows) {
    for (const t of row.items) {
      if (t.item.payload.kind !== 'quality') continue
      out.push({ qualityId: t.item.payload.qualityId, tier: row.tier })
      if (out.length >= limit) return out
    }
  }
  return out
}

export function topProgressions(
  progressionRows: TierRows,
  limit = 4
): Array<{ progression: ProgressionDef; tier: Tier }> {
  const out: Array<{ progression: ProgressionDef; tier: Tier }> = []
  for (const row of progressionRows) {
    for (const t of row.items) {
      if (t.item.payload.kind !== 'progression') continue
      out.push({ progression: t.item.payload.progression, tier: row.tier })
      if (out.length >= limit) return out
    }
  }
  return out
}

/** Re-root a progression into `targetPc`, preserving structure and roman numerals. */
export function transposeProgression(p: ProgressionDef, targetPc: number): ProgressionDef {
  const delta = (targetPc - p.keyRootPc + 12) % 12
  if (delta === 0) return p
  return {
    ...p,
    keyRootPc: targetPc,
    chords: p.chords.map((c) => ({ ...c, rootPc: (c.rootPc + delta) % 12 })),
  }
}
