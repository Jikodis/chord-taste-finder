# Playable Cheat Sheet UI Implementation Plan (Piece 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/cheatsheet` into an interactive "how to play it" page: a key picker at the top, with the user's top scales on keyboard diagrams, top chords on both instruments (engine voicings), and progressions realized as playable chord sequences in the chosen key.

**Architecture:** Pure selection/transposition helpers in a new `src/lib/cheatsheetView.ts` (vitest-tested); one presentational `ChordCard` component composing the existing `FretDiagram` + `KeyboardDiagram`; the page wires them. No storage changes. Spec: `docs/superpowers/specs/2026-07-19-playable-cheatsheet-design.md`.

**Tech Stack:** Existing: `guitarVoicings` (piece 1), `realizeChord`/`realizeScale`, `diatonicChord`-built `ProgressionDef`s, `getTierRows`, Tailwind, vitest.

## Global Constraints

- The UI must surface `Voicing.omitted` ("5th omitted") whenever non-empty — never render an incomplete shape as if complete.
- Default key = the user's top-rated key item's root; C if nothing rated.
- Transposition never changes which items are shown, only the key they're rendered in. Roman numerals are key-independent and must not change.
- Repo idioms: `'use client'` pages, `useAppStore` ready-gate, `no-print` / `print:bg-white print:p-0` classes, components in `src/components/`, lib logic testable without DOM.
- No scale picker — the key picker alone (the spec's mock showed one; scales are already chosen by the user's ratings). YAGNI.
- No new npm dependencies.

---

### Task 1: Selection & transposition helpers

**Files:**
- Create: `src/lib/cheatsheetView.ts`
- Test: `tests/cheatsheetView.test.ts`

**Interfaces:**
- Consumes: `TierRows`/`TieredItem` from `src/lib/tiersView.ts:14`; `CatalogItem` payloads from `src/lib/items/catalog.ts:16-34`; `ProgressionDef` from `src/lib/music/progressions.ts`.
- Produces (Task 3 consumes exactly these):
  - `defaultKeyPc(keyRows: TierRows): number`
  - `topScales(keyRows: TierRows, limit?: number): Array<{ scaleId: string; tier: Tier; ratedAs: string }>` — deduped by scale, best tier first
  - `topQualities(qualityRows: TierRows, limit?: number): Array<{ qualityId: string; tier: Tier }>`
  - `topProgressions(progressionRows: TierRows, limit?: number): Array<{ progression: ProgressionDef; tier: Tier }>`
  - `transposeProgression(p: ProgressionDef, targetPc: number): ProgressionDef`

- [ ] **Step 1: Write the failing test**

```ts
// tests/cheatsheetView.test.ts
import { describe, it, expect } from 'vitest'
import {
  defaultKeyPc,
  topScales,
  topQualities,
  topProgressions,
  transposeProgression,
} from '@/lib/cheatsheetView'
import type { TierRows } from '@/lib/tiersView'
import type { CatalogItem } from '@/lib/items/catalog'
import { instantiateSeed, SEED_TEMPLATES } from '@/lib/music/progressions'

function keyItem(rootPc: number, scaleId: string): CatalogItem {
  return {
    id: `key:${rootPc}:${scaleId}`,
    dimension: 'key',
    label: `test ${scaleId}`,
    payload: { kind: 'key', rootPc, scaleId },
  }
}

function rows(items: Array<[string, CatalogItem[]]>): TierRows {
  return items.map(([tier, list]) => ({
    tier: tier as TierRows[number]['tier'],
    items: list.map((item, i) => ({ item, rating: 1600 - i, comparisons: 12, confidence: 1 })),
  }))
}

describe('defaultKeyPc', () => {
  it('returns the top-rated key root, or 0 when nothing is rated', () => {
    const r = rows([
      ['S', [keyItem(7, 'blues'), keyItem(2, 'major')]],
      ['A', [keyItem(4, 'minor')]],
    ])
    expect(defaultKeyPc(r)).toBe(7)
    expect(defaultKeyPc(rows([['S', []]]))).toBe(0)
  })
})

describe('topScales', () => {
  it('dedupes by scale keeping the best-tier occurrence, in tier order', () => {
    const r = rows([
      ['S', [keyItem(7, 'blues')]],
      ['A', [keyItem(0, 'blues'), keyItem(2, 'altered')]],
    ])
    const top = topScales(r)
    expect(top.map((s) => s.scaleId)).toEqual(['blues', 'altered'])
    expect(top[0].tier).toBe('S')
  })

  it('respects the limit', () => {
    const r = rows([['S', [keyItem(0, 'a'), keyItem(0, 'b'), keyItem(0, 'c')]]])
    expect(topScales(r, 2)).toHaveLength(2)
  })
})

describe('topQualities / topProgressions', () => {
  it('extracts quality ids in tier order', () => {
    const qual = (id: string): CatalogItem => ({
      id: `qual:${id}`,
      dimension: 'quality',
      label: id,
      payload: { kind: 'quality', qualityId: id },
    })
    const r = rows([['S', [qual('maj7')]], ['B', [qual('m9')]]])
    expect(topQualities(r).map((q) => q.qualityId)).toEqual(['maj7', 'm9'])
  })

  it('extracts progressions in tier order', () => {
    const p = instantiateSeed(SEED_TEMPLATES[0], 0)
    const item: CatalogItem = {
      id: `prog:${p.id}`,
      dimension: 'progression',
      label: p.name,
      payload: { kind: 'progression', progression: p },
    }
    const r = rows([['A', [item]]])
    expect(topProgressions(r)[0].progression.id).toBe(p.id)
  })
})

describe('transposeProgression', () => {
  it('shifts every chord root by the key delta and preserves romans', () => {
    const p = instantiateSeed(SEED_TEMPLATES[0], 0) // in C
    const t = transposeProgression(p, 7) // to G
    expect(t.keyRootPc).toBe(7)
    expect(t.chords.map((c) => c.roman)).toEqual(p.chords.map((c) => c.roman))
    expect(t.chords.map((c) => c.rootPc)).toEqual(p.chords.map((c) => (c.rootPc + 7) % 12))
    expect(t.chords.map((c) => c.qualityId)).toEqual(p.chords.map((c) => c.qualityId))
  })

  it('is identity when already in the target key', () => {
    const p = instantiateSeed(SEED_TEMPLATES[0], 5)
    expect(transposeProgression(p, 5)).toBe(p)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cheatsheetView.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/cheatsheetView.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cheatsheetView.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cheatsheetView.ts tests/cheatsheetView.test.ts
git commit -m "feat: cheat-sheet selection and transposition helpers"
```

---

### Task 2: ChordCard component

**Files:**
- Create: `src/components/ChordCard.tsx`

**Interfaces:**
- Consumes: `guitarVoicings` (piece 1), `realizeChord`, `getQuality`, `pcToName`, `midiToName`, `FretDiagram`, `KeyboardDiagram`.
- Produces: `<ChordCard rootPc={number} qualityId={string} roman={string?} compact={boolean?} />`. Task 3 uses it in the chords section (full) and progression rows (compact).

No component-test infra exists in this repo (all tests are lib-level; pages are verified in-browser) — follow that idiom: no new test file, correctness is carried by the tested libs underneath and Task 4's browser verification.

- [ ] **Step 1: Write the component**

```tsx
// src/components/ChordCard.tsx
'use client'

import { useState } from 'react'
import { guitarVoicings } from '@/lib/music/guitarVoicings'
import { realizeChord } from '@/lib/music/realize'
import { getQuality } from '@/lib/music/chords'
import { pcToName, midiToName } from '@/lib/music/notes'
import FretDiagram from './FretDiagram'
import KeyboardDiagram from './KeyboardDiagram'

/** One chord, playable: name, guitar shape (with alternatives), keyboard keys. */
export default function ChordCard({
  rootPc,
  qualityId,
  roman,
  compact = false,
}: {
  rootPc: number
  qualityId: string
  roman?: string
  compact?: boolean
}) {
  const [showAlts, setShowAlts] = useState(false)
  const quality = getQuality(qualityId)
  const voicings = guitarVoicings(rootPc, qualityId)
  const top = voicings[0]
  if (!quality || !top) return null
  const name = `${pcToName(rootPc)}${quality.symbol || ' major'}`
  const midi = realizeChord(rootPc, qualityId)

  return (
    <div className={`rounded-lg bg-surface-2 p-3 print:bg-white ${compact ? '' : 'sm:p-4'}`}>
      <div className="flex items-baseline gap-2">
        {roman && <span className="font-bold text-accent">{roman}</span>}
        <span className="text-sm font-semibold">{name}</span>
        {!compact && <span className="text-xs text-muted">{quality.name}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-start gap-3">
        <div>
          <FretDiagram shape={top} />
          <div className="font-mono text-xs text-muted">{top.notation}</div>
          {top.omitted.length > 0 && (
            <div className="text-xs text-muted">{top.omitted.join(' & ')} omitted</div>
          )}
        </div>
        <div>
          <KeyboardDiagram midi={midi} />
          <div className="text-xs text-muted">{midi.map((m) => midiToName(m)).join(' ')}</div>
        </div>
      </div>
      {!compact && voicings.length > 1 && (
        <div className="no-print mt-2">
          <button
            onClick={() => setShowAlts((s) => !s)}
            className="text-xs text-accent hover:underline"
          >
            {showAlts ? '▴ fewer shapes' : `▾ more shapes (${Math.min(voicings.length - 1, 3)})`}
          </button>
          {showAlts && (
            <div className="mt-2 flex flex-wrap gap-3">
              {voicings.slice(1, 4).map((v) => (
                <div key={v.notation}>
                  <FretDiagram shape={v} />
                  <div className="font-mono text-xs text-muted">{v.notation}</div>
                  {v.omitted.length > 0 && (
                    <div className="text-xs text-muted">{v.omitted.join(' & ')} omitted</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (`Voicing` satisfies `FretDiagram`'s `GuitarShape` prop by extension.)

- [ ] **Step 3: Commit**

```bash
git add src/components/ChordCard.tsx
git commit -m "feat: ChordCard — one chord rendered playably on guitar and keyboard"
```

---

### Task 3: Cheat sheet page — key picker and playable sections

**Files:**
- Modify: `src/app/cheatsheet/page.tsx` (full rewrite; current file is 114 lines of text-only sections)

**Interfaces:**
- Consumes: everything from Tasks 1–2; existing `getTierRows`, `listGenerated`, `getLifetimeStats`, `realizeScale`, `KeyboardDiagram`, `TierBadge`.
- Produces: the page. Keeps the existing tier-summary text sections at the bottom (now with progression sublabels).

- [ ] **Step 1: Rewrite the page**

```tsx
// src/app/cheatsheet/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { getTierRows, type TierRows } from '@/lib/tiersView'
import { getLifetimeStats, listGenerated } from '@/lib/db/storage'
import { DIMENSIONS, DIMENSION_LABELS, type Dimension } from '@/lib/items/catalog'
import {
  defaultKeyPc,
  topScales,
  topQualities,
  topProgressions,
  transposeProgression,
} from '@/lib/cheatsheetView'
import { realizeScale, } from '@/lib/music/realize'
import { getScale } from '@/lib/music/scales'
import { pcToName, midiToName, NOTE_NAMES } from '@/lib/music/notes'
import type { ProgressionDef } from '@/lib/music/progressions'
import KeyboardDiagram from '@/components/KeyboardDiagram'
import ChordCard from '@/components/ChordCard'
import TierBadge from '@/components/TierBadge'

export default function CheatSheetPage() {
  const ready = useAppStore((s) => s.ready)
  const [rows, setRows] = useState<Partial<Record<Dimension, TierRows>>>({})
  const [saved, setSaved] = useState<ProgressionDef[]>([])
  const [stats, setStats] = useState<{ totalComparisons: number } | null>(null)
  const [generatedAt] = useState(() => new Date().toLocaleDateString())
  const [keyPc, setKeyPc] = useState<number | null>(null)

  useEffect(() => {
    if (!ready) return
    void (async () => {
      const all: Partial<Record<Dimension, TierRows>> = {}
      for (const d of DIMENSIONS) all[d] = await getTierRows(d)
      setRows(all)
      setSaved((await listGenerated(true)).map((g) => g.progression))
      setStats(await getLifetimeStats())
      setKeyPc((prev) => prev ?? defaultKeyPc(all.key ?? []))
    })()
  }, [ready])

  const pc = keyPc ?? 0
  const scales = topScales(rows.key ?? [])
  const qualities = topQualities(rows.quality ?? [])
  // Saved progressions first (explicit bookmarks), then top-rated, deduped
  const progs: ProgressionDef[] = []
  for (const p of [...saved, ...topProgressions(rows.progression ?? []).map((t) => t.progression)]) {
    if (!progs.some((x) => x.id === p.id)) progs.push(p)
  }

  return (
    <div className="print-page space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Taste cheat sheet</h1>
          <p className="mt-1 text-sm text-muted">
            In {pcToName(pc)} · generated {generatedAt} · {stats?.totalComparisons ?? 0} comparisons
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="key-picker" className="no-print text-sm text-muted">
            Key
          </label>
          <select
            id="key-picker"
            value={pc}
            onChange={(e) => setKeyPc(Number(e.target.value))}
            className="no-print rounded-lg bg-surface-2 px-3 py-2 text-sm"
          >
            {NOTE_NAMES.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="no-print rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Print / save as PDF
          </button>
        </div>
      </header>

      <section className="rounded-xl bg-surface p-4 print:bg-white print:p-0">
        <h2 className="mb-1 font-semibold">Your scales, on the keyboard</h2>
        <p className="mb-3 text-xs text-muted">
          Your top-rated scales, spelled out in {pcToName(pc)}. White = don&apos;t play, purple = the scale.
        </p>
        {scales.length === 0 && <p className="text-sm text-muted">Not yet rated — visit Compare.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {scales.map((s) => {
            const midi = realizeScale(pc, s.scaleId)
            return (
              <div key={s.scaleId} className="rounded-lg bg-surface-2 p-3 print:bg-white">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <TierBadge tier={s.tier} size="sm" />
                  {pcToName(pc)} {getScale(s.scaleId)?.name ?? s.scaleId}
                </div>
                <KeyboardDiagram midi={midi} className="mt-2" />
                <div className="text-xs text-muted">{midi.map((m) => midiToName(m)).join(' ')}</div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-xl bg-surface p-4 print:bg-white print:p-0">
        <h2 className="mb-1 font-semibold">Your chords, on guitar and keys</h2>
        <p className="mb-3 text-xs text-muted">Top-rated chord qualities, rooted on {pcToName(pc)}.</p>
        {qualities.length === 0 && <p className="text-sm text-muted">Not yet rated — visit Compare.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {qualities.map((q) => (
            <ChordCard key={q.qualityId} rootPc={pc} qualityId={q.qualityId} />
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-surface p-4 print:bg-white print:p-0">
        <h2 className="mb-1 font-semibold">Your progressions, in {pcToName(pc)}</h2>
        <p className="mb-3 text-xs text-muted">
          Saved and top-rated progressions, transposed so you can play them in your key.
        </p>
        {progs.length === 0 && (
          <p className="text-sm text-muted">None yet — bookmark favorites in the Generator or rate progressions.</p>
        )}
        <div className="space-y-5">
          {progs.slice(0, 5).map((orig) => {
            const p = transposeProgression(orig, pc)
            return (
              <div key={p.id} className="border-t border-borderc pt-3 first:border-t-0 first:pt-0">
                <div className="text-sm font-semibold">
                  {p.name}{' '}
                  <span className="font-normal text-muted">
                    in {pcToName(p.keyRootPc)} {getScale(p.scaleId)?.name}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {p.chords.map((c, i) => (
                    <ChordCard key={i} rootPc={c.rootPc} qualityId={c.qualityId} roman={c.roman} compact />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {DIMENSIONS.map((d) => {
        const tierRows = rows[d] ?? []
        const any = tierRows.some((r) => r.items.length > 0)
        return (
          <section key={d} className="rounded-xl bg-surface p-4 print:bg-white print:p-0">
            <h2 className="mb-2 font-semibold">{DIMENSION_LABELS[d]} — full tier list</h2>
            {!any && <p className="text-sm text-muted">Not yet rated.</p>}
            {tierRows
              .filter((r) => r.items.length > 0)
              .map((r) => (
                <div key={r.tier} className="mb-1 flex gap-2 text-sm">
                  <span className="w-6 shrink-0 font-bold">{r.tier}</span>
                  <span className="text-muted">
                    {r.items
                      .slice(0, 12)
                      .map((i) =>
                        d === 'progression' && i.item.sublabel ? i.item.sublabel : i.item.label
                      )
                      .join(' · ')}
                    {r.items.length > 12 ? ` (+${r.items.length - 12} more)` : ''}
                  </span>
                </div>
              ))}
          </section>
        )
      })}
    </div>
  )
}
```

Notes for the implementer:
- The old "Preferred keys, ranked" and "Saved progressions" sections are replaced by the new playable sections (saved progressions now render inside "Your progressions"). Delete them; the imports `guitarShape`, `realizeChord`, `midiToName` (old usages) go away with them — keep only what the new code uses.
- `keyPc` starts `null` so the async default (top-rated key) wins the first render; the `?? 0` fallback covers the pre-load frame.
- Stray `realizeScale, ,` import in the block above is illustrative sloppiness — write it clean: `import { realizeScale } from '@/lib/music/realize'`.

- [ ] **Step 2: Typecheck, lint, full suite**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: all clean (smoke test renders pages — if it imports the cheat sheet, it must still pass).

- [ ] **Step 3: Commit**

```bash
git add src/app/cheatsheet/page.tsx
git commit -m "feat: cheat sheet becomes playable — key picker, scale keyboards, chord cards, transposed progressions"
```

---

### Task 4: Verification in the real app + push

**Files:** none (browser + git only)

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: clean, `/cheatsheet` in route list.

- [ ] **Step 2: Browser walkthrough (chrome-devtools MCP against `npm run dev`)**

1. Open `/compare`, cast ~8 votes (rotates dimensions automatically).
2. Open `/cheatsheet`: scales section shows keyboard diagrams; chords section shows fret + keyboard diagrams; change the key picker C → G and confirm chord names re-root (e.g. Cmaj7 → Gmaj7) and scale spellings change; progression section (if any progression got rated) shows roman numerals with per-chord diagrams.
3. Confirm any card with a dense chord shows "5th omitted" when the engine says so.
4. Print emulation (CSS `print` media): picker and "more shapes" toggles hidden.
5. Console: no errors.
6. Clean up the seeded votes via `/history` undo buttons (restores the DB to its prior state).

- [ ] **Step 3: Push**

```bash
git status --short   # expect clean
git push origin main
```

---

## Self-Review Notes

- **Spec coverage:** key picker + default from top-rated key ✓ (T1 `defaultKeyPc`, T3 header), scales on keyboard with note names ✓ (T3), chords on both instruments with omitted note + more-shapes ✓ (T2), progressions transposed with romans ✓ (T1 `transposeProgression`, T3), tier text sections stay with progression sublabels ✓ (T3), print flattening ✓ (existing `no-print`/`print:` classes; verified T4). Audio on the cheat sheet is explicitly out of scope in the spec.
- **Type consistency:** helper signatures in T1 match T3's imports; `ChordCard` props in T2 match T3 usage (`roman`, `compact`).
- **Judgment call:** limits (6 scales, 8 qualities, 5 progressions, 3 alternative shapes) are pragmatic caps, easy to tune; not spec'd.
