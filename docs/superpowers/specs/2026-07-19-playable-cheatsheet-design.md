# Playable cheat sheet: guitar voicing engine, key picker, instrument preview

**Date:** 2026-07-19
**Status:** Approved by Alex, pending spec review

## Problem

The app's purpose is to help people without advanced music theory find their
taste *and play it* on guitar and piano. Today the cheat sheet is a text-only
list: it says you like "C6sus2" or "I–IV–vi–V" without showing how to play
either. Worse, the existing guitar-shape derivation is wrong for **89 of 102
chord qualities**: `guitarShape()` (`src/lib/music/guitar.ts`) maps every
quality onto ~15 canned templates via `templateFor()`, silently dropping
extensions. C6sus2 renders as plain Csus2 (`x35533`, no 6th); C13 renders as
plain C7; every altered chord renders as its unaltered base. The generator
page already displays these wrong shapes.

Verified by a scratch property test comparing each template's pitch classes
against `realizeChord()`'s: 89/102 qualities have missing or foreign tones.
All 26 scales are correct (`realizeScale()`), so keyboard scale diagrams are
wirable today.

## Decisions made (with Alex)

1. **Build a real voicing engine** — search the fretboard for shapes
   containing the actual chord tones, rather than showing only the 13
   verified templates or a tones-on-a-neck map.
2. **Cheat sheet becomes interactive with a key picker** — everything
   re-renders into the chosen key; print flattens the current selection.
3. **Engine returns the easiest shape by default, alternatives on demand** —
   ranked by playability; a "more shapes" toggle reveals 2–3 others.
4. **Fret span capped at 4** — Alex has small hands; beginner-friendly
   shapes only, even though this rejects some reachable stretches.
5. **When a chord has more tones than the guitar can voice, drop the 5th
   first, then the root** — standard guitarist practice (rootless voicings
   are routine in jazz comping). The engine records omissions so the UI
   can say "5th omitted" rather than silently lying.

## Build order

Three separable pieces, each with its own implementation plan:

1. **Guitar voicing engine** — pure library, no UI. Foundation.
2. **Cheat sheet "how to play it"** — scales on keyboard, chords on both
   instruments, progressions realized in a chosen key.
3. **Settings instrument preview** — play button per instrument
   (piano/guitar/synth) playing one identical phrase, so the user compares
   timbre, not notes.

Piece 3 is independent of 1–2 and small; it can be reordered freely.

---

## Piece 1 — Guitar voicing engine

### Module

New `src/lib/music/guitarVoicings.ts`. Emits the existing `GuitarShape`
interface (`frets`, `baseFret`, `notation`) so `FretDiagram` renders
unchanged, extended with:

```ts
interface Voicing extends GuitarShape {
  /** Pitch-class tones intentionally left out, e.g. ['5th'] */
  omitted: string[]
  /** Playability score; lower = easier. Stable across runs. */
  score: number
}

/** All valid voicings for the chord, easiest first. Never empty for
    playable chords; empty array only if search genuinely fails. */
function guitarVoicings(rootPc: number, qualityId: string): Voicing[]
```

`guitarShape()` in `guitar.ts` becomes a thin wrapper returning
`guitarVoicings(...)[0]` so the generator page is fixed with no changes.
`templateFor()` and the template table are deleted once nothing consumes
them.

### Algorithm

Standard tuning `E A D G B E` (midi 40 45 50 55 59 64), frets 0–12.

1. **Chord tones**: pitch classes from `realizeChord(rootPc, qualityId)`,
   the already-correct source of truth.
2. **Tone priority** (kept-first): root → 3rd or sus tone → 7th/6th →
   defining extensions and alterations (b9, #9, #11, b13, 9, 11, 13) →
   5th last. A perfect 5th is the most omittable tone; altered 5ths
   (b5/#5) count as defining alterations, not as the 5th.
3. **Omission**: if tones exceed 6 (or no playable shape exists with the
   full set), drop from the bottom of the priority list one at a time and
   re-search: 5th first, then root. Record each drop in `omitted`.
4. **Candidate generation**: per string, candidate frets = positions 0–12
   whose pitch class is a chord tone, plus "muted". Enumerate combinations
   window-by-window (fret windows of width 4 starting at 1..9, plus open
   strings always allowed), pruning any partial assignment whose fretted
   span exceeds 4.
5. **Validation** (the check today's templates fail): every non-omitted
   tone present at least once; no pitch class outside the chord; at least
   3 sounded strings; no more than 4 fretted fingers (open strings free).
6. **Scoring** (lower = easier): fretted span, number of fretted notes,
   higher base fret, interior muted strings (x between sounded strings),
   non-root bass. Open strings and root-in-bass reduce score. Exact
   weights are implementation detail; ordering must be deterministic
   (ties broken by notation string) so tests and UI are stable.
7. **Return**: deduplicated (by notation), sorted by score. Top result is
   "the" shape; UI may show the next 2–3 as alternatives.

### Performance

102 qualities × 12 roots is precomputable but shouldn't need it: with
span pruning the per-chord search is small. Budget: full 1,224-chord
sweep under ~2s in vitest (it runs in the browser once per rendered
diagram; memoize by `(rootPc, qualityId)` in the module).

### Tests (the definition of done)

Property test over all 102 qualities × 12 roots = 1,224 cases; for each,
the top voicing must:

- contain every chord tone not listed in `omitted`,
- contain **no** pitch class foreign to the chord,
- have fretted span ≤ 4, ≥ 3 sounded strings, ≤ 4 fretted fingers,
- have `omitted` ⊆ {5th, root} (nothing else is ever dropped).

Plus targeted cases: C major must still find `x32010`-class open shapes
(score respects open strings); C6sus2 contains {C,D,G,A}; C13's `omitted`
is `['5th']` (or empty if a full shape exists); alt-7#9 contains the #9.
Existing `tests/guitar.test.ts` expectations that encode template output
will be rewritten against the new contract, not preserved.

## Piece 2 — Cheat sheet "how to play it"

`/cheatsheet` gains a **key picker** (12 pitch classes; defaults to the
user's top-rated key, else C). Sections re-render into the chosen key:

- **Scales**: top-rated scales drawn on `KeyboardDiagram` via
  `realizeScale(chosenPc, scaleId)`, note names beneath (answers "what
  does C Altered even mean in keys").
- **Chords**: top-rated qualities as `FretDiagram` (engine's top voicing,
  "▾ more shapes" toggle, "5th omitted" note when applicable) +
  `KeyboardDiagram` via `realizeChord`, side by side.
- **Progressions**: saved + top-rated progressions realized in the chosen
  key via existing `diatonicChord`; each chord gets roman numeral, name,
  fret diagram, keyboard diagram — the "how do I play I–IV–vi–V in G"
  answer.
- Existing tier-list text sections stay, with sublabels (per the history
  page precedent).

**Print**: print CSS flattens the current selection — controls hidden,
diagrams inline, page breaks between sections. Printed header states the
chosen key.

Diagram components stay presentational; data flows from page-level calls
into existing lib functions. No new storage.

## Piece 3 — Settings instrument preview

On `/settings`, next to the instrument radio group: one play button per
instrument (piano, guitar, synth). Each plays the **same** short phrase
(a C major chord strum/arpeggio ~1.5s) through that instrument's Tone.js
engine at the current tempo, so the comparison is purely timbre.
Reuses `playItem`/engine plumbing; stops any playing preview before
starting another. No storage changes.

## Out of scope

- Alternate guitar tunings and capo logic.
- Left-handed diagrams.
- Piano fingering numbers.
- Audio for the cheat sheet page (play buttons there can come later; the
  page is a reading/printing surface first).
- Backfilling voicing choices into the comparison arena (it plays synth
  voicings via `realizeChord`, unaffected by the guitar bug).

## Risks

- **Search blowup**: mitigated by span pruning and window enumeration;
  the 1,224-case test doubles as a performance canary.
- **"Easiest" disagreeing with convention**: scoring may rank an oddball
  shape above the textbook one (e.g. preferring 3-string fragments).
  Mitigation: minimum 3 sounded strings, open-string bonus, targeted
  tests pinning canonical open chords for the common qualities.
- **Muddy low voicings**: tones packed low sound bad even if playable.
  Score penalizes 3rds/extensions below ~G2 on the low strings.
