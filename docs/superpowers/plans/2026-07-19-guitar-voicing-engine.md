# Guitar Voicing Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the template-based guitar shape lookup (wrong for 89 of 102 chord qualities) with a search-based voicing engine that returns provably correct, playable shapes.

**Architecture:** New pure module `src/lib/music/guitarVoicings.ts` searches the fretboard (standard tuning, frets 0–12) for shapes containing a chord's actual pitch classes, validates them (all tones present, none foreign, span ≤ 4, ≤ 4 fingers, ≥ 3 strings), and returns them easiest-first by a playability score. `guitarShape()` in `guitar.ts` becomes a thin wrapper over the top result, so `FretDiagram` and the generator page are fixed without changes. Spec: `docs/superpowers/specs/2026-07-19-playable-cheatsheet-design.md`.

**Tech Stack:** TypeScript (strict), vitest, no new dependencies. All music-theory source data already exists in `src/lib/music/chords.ts` (`CHORD_QUALITIES`, `getQuality`).

## Global Constraints

- Fretted span ≤ 4 frets (max fretted − min fretted ≤ 3). Alex has small hands; this is a hard limit, not a preference.
- ≤ 4 fingers (a barre — multiple strings at the lowest fretted fret — counts as one finger).
- ≥ 3 sounded strings per voicing.
- `omitted` may only ever contain `'5th'` and/or `'root'`, dropped in that order, and only when the full tone set yields no valid shape.
- A voicing must contain zero pitch classes outside the chord's tones. This is the invariant today's templates violate.
- Deterministic output: same input → same voicings in the same order (ties broken by notation string).
- Repo idioms: plain functions, no classes; `Array<number | null>` frets low-E→high-E matching `GuitarShape` (`src/lib/music/guitar.ts:4`); tests in `tests/*.test.ts` with `@/` path alias; run via `npx vitest run`.
- No new npm dependencies.

---

### Task 1: Core search — complete, valid voicings

**Files:**
- Create: `src/lib/music/guitarVoicings.ts`
- Test: `tests/guitarVoicings.test.ts` (new)

**Interfaces:**
- Consumes: `getQuality(id)` from `src/lib/music/chords.ts` (returns `{ intervals: number[] } | undefined`); `GuitarShape` type from `src/lib/music/guitar.ts`.
- Produces: `guitarVoicings(rootPc: number, qualityId: string): Voicing[]` where `Voicing = GuitarShape & { omitted: string[]; score: number }`. Task 2 adds the omission ladder; Task 3 makes ordering meaningful; Task 5 wires `guitarShape` to `guitarVoicings(...)[0]`. Throws `Error` on unknown `qualityId` (matching `realizeChord`, `src/lib/music/realize.ts:9`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/guitarVoicings.test.ts
import { describe, it, expect } from 'vitest'
import { guitarVoicings, OPEN_MIDI } from '@/lib/music/guitarVoicings'
import { getQuality } from '@/lib/music/chords'

/** Pitch classes actually sounded by a voicing. */
function soundedPcs(frets: Array<number | null>): Set<number> {
  return new Set(
    frets.map((f, s) => (f === null ? -1 : (OPEN_MIDI[s] + f) % 12)).filter((pc) => pc >= 0)
  )
}

function chordPcs(rootPc: number, qualityId: string): Set<number> {
  return new Set(getQuality(qualityId)!.intervals.map((i) => (rootPc + i) % 12))
}

describe('guitarVoicings core search', () => {
  it('finds complete valid voicings for C major', () => {
    const voicings = guitarVoicings(0, 'maj')
    expect(voicings.length).toBeGreaterThan(0)
    const pcs = chordPcs(0, 'maj')
    for (const v of voicings) {
      const sounded = soundedPcs(v.frets)
      // every chord tone present, nothing foreign
      expect([...pcs].filter((pc) => !sounded.has(pc))).toEqual([])
      expect([...sounded].filter((pc) => !pcs.has(pc))).toEqual([])
      expect(v.omitted).toEqual([])
    }
  })

  it('C6sus2 voicings contain exactly {C, D, G, A} — the bug the templates had', () => {
    const voicings = guitarVoicings(0, '6sus2')
    expect(voicings.length).toBeGreaterThan(0)
    for (const v of voicings) {
      expect([...soundedPcs(v.frets)].sort((a, b) => a - b)).toEqual([0, 2, 7, 9])
    }
  })

  it('respects playability limits on every voicing', () => {
    for (const [rootPc, q] of [[0, 'maj'], [6, 'maj'], [0, '6sus2'], [9, 'm7'], [2, '7sus4']] as const) {
      for (const v of guitarVoicings(rootPc, q)) {
        const fretted = v.frets.filter((f): f is number => f !== null && f > 0)
        const sounded = v.frets.filter((f) => f !== null)
        expect(sounded.length).toBeGreaterThanOrEqual(3)
        if (fretted.length > 0) {
          expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3)
          const min = Math.min(...fretted)
          const fingers = fretted.filter((f) => f > min).length + 1
          expect(fingers).toBeLessThanOrEqual(4)
        }
      }
    }
  })

  it('returns 6-element fret arrays and valid notation', () => {
    for (const v of guitarVoicings(7, 'maj')) {
      expect(v.frets).toHaveLength(6)
      expect(v.notation).toMatch(/^([x0-9]|\(\d+\))+$/)
    }
  })

  it('throws on unknown quality', () => {
    expect(() => guitarVoicings(0, 'nope')).toThrow(/Unknown chord quality/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/guitarVoicings.test.ts`
Expected: FAIL — `Cannot find module '@/lib/music/guitarVoicings'` (or "guitarVoicings is not a function").

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/music/guitarVoicings.ts
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
        for (let t = s; t < 6; t++) if (reachable[t].has(pc)) { coverable = true; break }
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

function toVoicing(frets: Array<number | null>, chordPcs: Set<number>, rootPc: number): Voicing {
  const sounded = new Set(
    frets.map((f, s) => (f === null ? -1 : (OPEN_MIDI[s] + f) % 12)).filter((pc) => pc >= 0)
  )
  const omitted: string[] = []
  for (const pc of chordPcs) {
    if (sounded.has(pc)) continue
    omitted.push(pc === rootPc ? 'root' : '5th') // only the 5th and root are ever relaxed
  }
  const fretted = frets.filter((f): f is number => f !== null && f > 0)
  const baseFret = fretted.length > 0 && Math.max(...fretted) > SPAN ? Math.min(...fretted) : 0
  return { frets, notation: toNotation(frets), baseFret, omitted, score: 0 }
}

/** All valid voicings for the chord. Task 3 makes the order easiest-first. */
export function guitarVoicings(rootPc: number, qualityId: string): Voicing[] {
  const quality = getQuality(qualityId)
  if (!quality) throw new Error(`Unknown chord quality: ${qualityId}`)
  const chordPcs = new Set(quality.intervals.map((i) => (rootPc + i) % 12))
  const found = search(chordPcs, chordPcs)
  return found.map((f) => toVoicing(f, chordPcs, rootPc))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/guitarVoicings.test.ts`
Expected: PASS (5 tests). If slow (> ~5s), do not optimize yet — Task 4 owns performance.

- [ ] **Step 5: Commit**

```bash
git add src/lib/music/guitarVoicings.ts tests/guitarVoicings.test.ts
git commit -m "feat: fretboard search engine for correct guitar voicings"
```

---

### Task 2: Omission ladder for dense chords

**Files:**
- Modify: `src/lib/music/guitarVoicings.ts` (the `guitarVoicings` function only)
- Test: `tests/guitarVoicings.test.ts` (append)

**Interfaces:**
- Consumes: `search`, `toVoicing` from Task 1 (same file).
- Produces: same signature; `guitarVoicings` now never returns `[]` for any catalog quality. `omitted` lists exactly the chord tones absent from that voicing.

- [ ] **Step 1: Write the failing test**

Append to `tests/guitarVoicings.test.ts`:

```ts
describe('omission ladder', () => {
  it('voices 13sharp11 (7 tones > 6 strings) by dropping the 5th, then root if needed', () => {
    const voicings = guitarVoicings(0, '13sharp11')
    expect(voicings.length).toBeGreaterThan(0)
    for (const v of voicings) {
      expect(v.omitted.every((o) => o === '5th' || o === 'root')).toBe(true)
    }
  })

  it('omitted is truthful: listed tones absent, unlisted tones present', () => {
    for (const q of ['13sharp11', 'maj13sharp11', '13', 'maj', 'sowhat'] as const) {
      for (const v of guitarVoicings(0, q)) {
        const sounded = soundedPcs(v.frets)
        const pcs = chordPcs(0, q)
        const fifthPc = 7 // rootPc 0 + perfect fifth
        if (v.omitted.includes('5th')) expect(sounded.has(fifthPc)).toBe(false)
        if (v.omitted.includes('root')) expect(sounded.has(0)).toBe(false)
        const expectedPresent = [...pcs].filter(
          (pc) => !(v.omitted.includes('5th') && pc === fifthPc) && !(v.omitted.includes('root') && pc === 0)
        )
        for (const pc of expectedPresent) expect(sounded.has(pc)).toBe(true)
      }
    }
  })

  it('complete chords stay complete: 4-tone chords have empty omitted', () => {
    for (const v of guitarVoicings(0, '6sus2')) expect(v.omitted).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/guitarVoicings.test.ts`
Expected: FAIL — the `13sharp11` test gets `voicings.length` 0 (7 required tones can never fit 6 strings).

- [ ] **Step 3: Implement the ladder**

Replace the body of `guitarVoicings` (keep everything else):

```ts
export function guitarVoicings(rootPc: number, qualityId: string): Voicing[] {
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
    if (found.length > 0) return found.map((f) => toVoicing(f, chordPcs, rootPc))
  }
  return []
}
```

Note `toVoicing` from Task 1 already computes `omitted` from what is actually missing, so a "drop the 5th" search that happens to include the 5th anyway reports `omitted: []`. One correction to `toVoicing` while here — it labels any missing non-root tone `'5th'`; make it explicit:

```ts
  const omitted: string[] = []
  for (const pc of chordPcs) {
    if (sounded.has(pc)) continue
    omitted.push(pc === rootPc ? 'root' : '5th')
  }
  omitted.sort() // '5th' before 'root', deterministic
```

(The only tones the ladder can leave unrequired are the perfect 5th and root, so the label is always correct; no other tone can be absent because `search` requires the rest.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/guitarVoicings.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/music/guitarVoicings.ts tests/guitarVoicings.test.ts
git commit -m "feat: drop 5th then root when a chord has more tones than the guitar can voice"
```

---

### Task 3: Playability scoring — easiest first, deterministic

**Files:**
- Modify: `src/lib/music/guitarVoicings.ts`
- Test: `tests/guitarVoicings.test.ts` (append)

**Interfaces:**
- Consumes: Task 1's `toVoicing` (gains a real score), `guitarVoicings` return path.
- Produces: `guitarVoicings` results sorted ascending by `score`, ties by `notation`; `Voicing.score` populated. Task 5 relies on index 0 being "the" shape.

- [ ] **Step 1: Write the failing test**

Append to `tests/guitarVoicings.test.ts`:

```ts
describe('scoring', () => {
  it('prefers open-position shapes for the classic open chords', () => {
    // C, G, E, A major; E, A, D minor — the top voicing must live in open position
    for (const [pc, q] of [[0, 'maj'], [7, 'maj'], [4, 'maj'], [9, 'maj'], [4, 'min'], [9, 'min'], [2, 'min']] as const) {
      const top = guitarVoicings(pc, q)[0]
      expect(top.baseFret).toBe(0)
      expect(top.frets.filter((f) => f === 0).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('puts the root in the bass of the top voicing for common qualities', () => {
    for (const [pc, q] of [[0, 'maj'], [7, 'maj'], [9, 'min'], [2, '7']] as const) {
      const top = guitarVoicings(pc, q)[0]
      const bassString = top.frets.findIndex((f) => f !== null)
      const bassPc = (OPEN_MIDI[bassString] + top.frets[bassString]!) % 12
      expect(bassPc).toBe(pc)
    }
  })

  it('is deterministic: two calls agree, and scores ascend', () => {
    const a = guitarVoicings(6, 'm7b5')
    const b = guitarVoicings(6, 'm7b5')
    expect(a.map((v) => v.notation)).toEqual(b.map((v) => v.notation))
    for (let i = 1; i < a.length; i++) expect(a[i].score).toBeGreaterThanOrEqual(a[i - 1].score)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/guitarVoicings.test.ts`
Expected: FAIL — with score fixed at 0 the order is search order, so open-position/bass assertions miss for at least one case. (If all happen to pass, tighten nothing — proceed; the determinism test still pins the contract. But run it and look.)

- [ ] **Step 3: Implement scoring**

Add to `guitarVoicings.ts` and call from `toVoicing` (replace `score: 0`):

```ts
/** Lower = easier. Weights are heuristic; ordering contract is what tests pin. */
function scoreVoicing(frets: Array<number | null>, rootPc: number): number {
  const fretted = frets.filter((f): f is number => f !== null && f > 0)
  const soundedMidi = frets
    .map((f, s) => (f === null ? -1 : OPEN_MIDI[s] + f))
    .filter((m) => m >= 0)
  let score = 0
  if (fretted.length > 0) {
    score += (Math.max(...fretted) - Math.min(...fretted)) * 4 // hand stretch
    score += (Math.min(...fretted) - 1) * 1 // low positions are easier to find
  }
  score += fretted.length * 2 // fingers down
  score -= frets.filter((f) => f === 0).length * 2 // open strings are free
  score -= soundedMidi.length * 1 // prefer fuller voicings
  const first = frets.findIndex((f) => f !== null)
  const last = 5 - [...frets].reverse().findIndex((f) => f !== null)
  for (let s = first; s <= last; s++) if (frets[s] === null) score += 6 // interior mute
  if (soundedMidi.length > 0 && soundedMidi[0] % 12 !== rootPc) score += 5 // non-root bass
  score += soundedMidi.filter((m) => m < 43 && m % 12 !== rootPc).length * 4 // muddy low tones
  return score
}
```

In `toVoicing`: `score: scoreVoicing(frets, rootPc)`.
At the end of `guitarVoicings`, sort before returning:

```ts
    if (found.length > 0) {
      return found
        .map((f) => toVoicing(f, chordPcs, rootPc))
        .sort((a, b) => a.score - b.score || (a.notation < b.notation ? -1 : 1))
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/guitarVoicings.test.ts`
Expected: PASS (11 tests). If an open-chord assertion fails, inspect the winner: `console.log(guitarVoicings(pc, q).slice(0, 3))` — adjust weights only with the failing shape in front of you, re-run, remove the log.

- [ ] **Step 5: Commit**

```bash
git add src/lib/music/guitarVoicings.ts tests/guitarVoicings.test.ts
git commit -m "feat: playability scoring so easiest guitar voicing comes first"
```

---

### Task 4: Full-catalog property sweep + memoization

**Files:**
- Modify: `src/lib/music/guitarVoicings.ts` (memo wrapper)
- Test: `tests/guitarVoicings.test.ts` (append)

**Interfaces:**
- Consumes: everything prior.
- Produces: the definition-of-done guarantee for the spec — every quality × root has a correct top voicing — plus module-level memoization by `(rootPc, qualityId)` (the browser calls this per rendered diagram).

- [ ] **Step 1: Write the failing (or slow) test**

Append to `tests/guitarVoicings.test.ts`:

```ts
import { CHORD_QUALITIES } from '@/lib/music/chords'

describe('full catalog sweep — the definition of done', () => {
  it('every quality × every root yields a correct, playable top voicing', () => {
    const started = performance.now()
    for (const q of CHORD_QUALITIES) {
      for (let rootPc = 0; rootPc < 12; rootPc++) {
        const voicings = guitarVoicings(rootPc, q.id)
        expect(voicings.length, `${q.id} @ ${rootPc} found no voicing`).toBeGreaterThan(0)
        const top = voicings[0]
        const pcs = chordPcs(rootPc, q.id)
        const sounded = soundedPcs(top.frets)
        // nothing foreign
        for (const pc of sounded) expect(pcs.has(pc), `${q.id} @ ${rootPc}: foreign tone ${pc} in ${top.notation}`).toBe(true)
        // everything non-omitted present
        const fifthPc = (rootPc + 7) % 12
        for (const pc of pcs) {
          const excused =
            (top.omitted.includes('5th') && pc === fifthPc) || (top.omitted.includes('root') && pc === rootPc)
          if (!excused) expect(sounded.has(pc), `${q.id} @ ${rootPc}: missing tone ${pc} in ${top.notation}`).toBe(true)
        }
        expect(top.omitted.every((o) => o === '5th' || o === 'root')).toBe(true)
        const fretted = top.frets.filter((f): f is number => f !== null && f > 0)
        if (fretted.length > 0) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3)
      }
    }
    const elapsed = performance.now() - started
    expect(elapsed, `sweep took ${Math.round(elapsed)}ms`).toBeLessThan(4000)
  }, 30_000)

  it('memoizes: repeat call returns the identical array instance', () => {
    expect(guitarVoicings(3, 'maj9')).toBe(guitarVoicings(3, 'maj9'))
  })
})
```

- [ ] **Step 2: Run test to verify current state**

Run: `npx vitest run tests/guitarVoicings.test.ts`
Expected: memoization test FAILS (new array each call). The sweep may pass or may fail on speed or on an obscure quality — read the failure message; it names the exact `quality @ root`.

- [ ] **Step 3: Implement memoization (and fix any sweep failure)**

In `guitarVoicings.ts`, rename the existing exported function to `computeVoicings` (not exported) and export:

```ts
const memo = new Map<string, Voicing[]>()

export function guitarVoicings(rootPc: number, qualityId: string): Voicing[] {
  const key = `${rootPc}:${qualityId}`
  let cached = memo.get(key)
  if (!cached) {
    cached = computeVoicings(rootPc, qualityId)
    memo.set(key, cached)
  }
  return cached
}
```

If the sweep fails for a specific chord, reproduce it alone (`guitarVoicings(<root>, '<id>')`), understand why (usually: required set unsatisfiable in every window → the ladder needs to actually engage, or a pruning bug), fix the engine — do not weaken the assertions. If the sweep fails on time, profile: the usual fix is tightening the per-string candidate pruning, not caching (the sweep hits each key once).

- [ ] **Step 4: Run tests, all green**

Run: `npx vitest run tests/guitarVoicings.test.ts`
Expected: PASS (13 tests) with sweep well under the 4s ceiling.

- [ ] **Step 5: Commit**

```bash
git add src/lib/music/guitarVoicings.ts tests/guitarVoicings.test.ts
git commit -m "test: 1,224-case property sweep proving every chord gets a correct voicing"
```

---

### Task 5: Rewire `guitarShape`, delete the template system

**Files:**
- Modify: `src/lib/music/guitar.ts` (shrinks to the `GuitarShape` type + wrapper)
- Modify: `tests/guitar.test.ts` (rewrite — its expectations encode template output)

**Interfaces:**
- Consumes: `guitarVoicings` from Task 4.
- Produces: `guitarShape(rootPc, qualityId): GuitarShape` — same signature as today (`src/lib/music/guitar.ts:96`), now backed by the engine. Existing consumers (`src/app/cheatsheet/page.tsx:97`, `src/app/generator/page.tsx`) keep working unchanged. `templateFor`, `OPEN_SHAPES`, `E_SHAPES`, `A_SHAPES` are deleted; `tests/guitar.test.ts` is their only external consumer (verify in Step 2).

- [ ] **Step 1: Rewrite the guitar test against the new contract**

Replace `tests/guitar.test.ts` entirely:

```ts
import { describe, it, expect } from 'vitest'
import { guitarShape } from '@/lib/music/guitar'
import { OPEN_MIDI } from '@/lib/music/guitarVoicings'
import { getQuality } from '@/lib/music/chords'

describe('guitarShape (voicing-engine backed)', () => {
  it('always returns 6 strings', () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(guitarShape(pc, 'm7').frets).toHaveLength(6)
    }
  })

  it('sounds exactly the chord tones for classic chords', () => {
    for (const [pc, q] of [[0, 'maj'], [7, 'maj'], [4, 'min'], [6, 'maj']] as const) {
      const shape = guitarShape(pc, q)
      const sounded = new Set(
        shape.frets.map((f, s) => (f === null ? -1 : (OPEN_MIDI[s] + f) % 12)).filter((x) => x >= 0)
      )
      const expected = new Set(getQuality(q)!.intervals.map((i) => (pc + i) % 12))
      expect([...sounded].sort((a, b) => a - b)).toEqual([...expected].sort((a, b) => a - b))
    }
  })

  it('stays in open position for open-friendly chords', () => {
    expect(guitarShape(0, 'maj').baseFret).toBe(0)
    expect(guitarShape(4, 'min').baseFret).toBe(0)
  })
})
```

- [ ] **Step 2: Verify template symbols have no other consumers, then run**

Run: `grep -rn "templateFor\|OPEN_SHAPES\|E_SHAPES\|A_SHAPES" src/ tests/`
Expected: hits only in `src/lib/music/guitar.ts` and (before this rewrite) `tests/guitar.test.ts`. If anything else consumes them, stop and reassess.

Run: `npx vitest run tests/guitar.test.ts`
Expected: FAIL — "sounds exactly the chord tones" fails while `guitarShape` still uses templates (e.g. F# maj barre passes but any discrepancy vs engine shows), and the file may fail to compile if `templateFor` import was left. The meaningful signal: the old implementation is still in place.

- [ ] **Step 3: Rewire and delete**

Replace `src/lib/music/guitar.ts` entirely:

```ts
import { guitarVoicings } from './guitarVoicings'

/** Frets low-to-high (6th → 1st string); null = muted. */
export interface GuitarShape {
  frets: Array<number | null>
  /** Compact notation, e.g. 'x32010'. Frets ≥ 10 render in parens: '(10)'. */
  notation: string
  baseFret: number
}

/** Easiest correct shape for a chord — the voicing engine's top result. */
export function guitarShape(rootPc: number, qualityId: string): GuitarShape {
  return guitarVoicings(rootPc, qualityId)[0]
}
```

Import cycle note: `guitarVoicings.ts` imports `type { GuitarShape }` from `./guitar`, and `guitar.ts` imports `guitarVoicings` from `./guitarVoicings`. The type import is erased at compile time, so there is no runtime cycle. If the bundler still complains, move the `GuitarShape` interface into `guitarVoicings.ts` and re-export it from `guitar.ts` (`export type { GuitarShape } from './guitarVoicings'`) — keep `guitar.ts` as the import site consumers already use.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: ALL PASS. `tests/smoke.test.ts` and `tests/catalog.test.ts` exercise pages/catalog that call `guitarShape` — if one asserts an old template notation, update that assertion to the correctness-based style from Step 1, never by re-adding templates.

- [ ] **Step 5: Commit**

```bash
git add src/lib/music/guitar.ts tests/guitar.test.ts
git commit -m "feat: guitarShape now returns engine voicings; delete wrong template tables"
```

---

### Task 6: Full verification

**Files:**
- No new files. Gate before the cheat-sheet work builds on this.

- [ ] **Step 1: Full test suite, lint, typecheck, build**

Run: `npx vitest run && npm run lint && npx tsc --noEmit && npm run build`
Expected: all green, `/generator` and `/cheatsheet` still in the route list.

- [ ] **Step 2: Eyeball real output**

Run a throwaway spot-check through vitest (which has the `@/` alias configured), then delete it:

```bash
cat > tests/_scratch_spot.test.ts <<'EOF'
import { it } from 'vitest'
import { guitarVoicings } from '@/lib/music/guitarVoicings'
it('spot check', () => {
  for (const [pc, q] of [[0, 'maj'], [0, '6sus2'], [0, '13'], [0, 'alt-7#9'], [7, 'maj']] as const) {
    const [top, ...rest] = guitarVoicings(pc, q)
    console.log(q.padEnd(10), top.notation.padEnd(10), 'omitted:', top.omitted, 'alts:', rest.slice(0, 2).map(v => v.notation))
  }
})
EOF
npx vitest run tests/_scratch_spot.test.ts
rm tests/_scratch_spot.test.ts
```

Expected: shapes that look like guitar chords (C maj in open position; C13 with omitted ['5th'] or complete; alt-7#9 containing the ♯9). A human (Alex or the session driver) should glance at these before Piece 2 builds UI on them.

- [ ] **Step 3: Commit anything outstanding & push**

```bash
git status --short   # expect clean
git push origin main
```

---

## Self-Review Notes

- **Spec coverage:** engine module ✓ (T1–T4), omission ladder ✓ (T2), easiest-first + alternatives ✓ (T3; alternatives are simply indices 1+), 1,224-case done-gate ✓ (T4), `guitarShape` wrapper + template deletion ✓ (T5), memoization ✓ (T4), perf budget ✓ (T4 assertion). Cheat-sheet UI and settings preview are Pieces 2–3 — separate plans by design.
- **Type consistency:** `Voicing extends GuitarShape`; `OPEN_MIDI` exported for tests; `guitarVoicings(rootPc: number, qualityId: string): Voicing[]` used identically in T1–T5.
- **Known judgment call:** `fingersNeeded` treats all lowest-fret strings as one barre finger — an approximation that admits a rare shape a strict model would reject; acceptable for v1 and pinned by no test, so tightening later won't break the contract.
