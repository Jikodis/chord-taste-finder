# Chord Taste Finder V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build V1 of Chord Progression Taste — a local-first web app that profiles harmonic taste via A/B listening comparisons (Elo + Bradley-Terry), renders S–F tier lists, and generates progressions from the discovered taste.

**Architecture:** Client-only Next.js App Router SPA. All state lives in IndexedDB (Dexie) behind a storage service layer. Pure-TypeScript domain libraries (music theory, item catalog, ranking) are framework-free and unit-tested with Vitest; UI screens are thin clients over those libraries. Audio is synthesized on demand with Tone.js (piano/guitar/synth timbres).

**Tech Stack:** Next.js 15 + TypeScript, Tailwind CSS, Tone.js, Dexie (IndexedDB), Zustand, Vitest.

**Source PRD:** `modular-pfc/5-projects/chord-progression-taste.md` (V1, April 2026). A copy is committed to this repo at `docs/PRD.md` so the app repo is self-contained.

## Global Constraints

- All data local (IndexedDB); no network calls at runtime. Export/import JSON is the only backup path.
- Storage access only through `src/lib/db/storage.ts` (service layer — PRD §6.4 mobile-readiness).
- Domain logic (`src/lib/music`, `src/lib/items`, `src/lib/ranking`) must not import React, Next, Tone, or Dexie.
- Standard theory notation (not simplified). Four dimensions: keys/scales, chord qualities, voicings, progressions.
- Tiers are distribution-based percentiles: S=top 5%, A=next 15%, B=20%, C=20%, D=20%, F=bottom 20%.
- Mobile-first responsive; Comparison Arena thumb-friendly.
- Tests: `npm test` (Vitest) green and `npm run build` green before every commit.

## File Structure

```
src/
  lib/
    music/notes.ts        # pitch classes, midi helpers, note naming
    music/scales.ts       # scale interval catalog (major, modes, exotic) → 150+ key/scale items
    music/chords.ts       # chord quality catalog (triads→13ths, alt, sus, add) → 100+ qualities
    music/voicings.ts     # inversions, open/closed, drop-2/drop-3 transforms
    music/progressions.ts # seeded + algorithmic progression generation, roman numerals
    music/guitar.ts       # fret-notation voicing lookup/derivation (e.g. x32010)
    items/catalog.ts      # builds the full testable item set for all 4 dimensions
    ranking/elo.ts        # K-factor Elo update
    ranking/bradleyTerry.ts # MM-algorithm BT fit over full comparison history
    ranking/tiers.ts      # percentile tier mapping
    ranking/matchup.ts    # uncertainty-driven matchup selection, dimension interleaving, drift retests
    audio/engine.ts       # Tone.js instruments, playChord/playScale/playProgression
    db/db.ts              # Dexie schema
    db/storage.ts         # service layer: items, comparisons, sessions, saved progressions, settings
    export/backup.ts      # versioned JSON export/import (merge|replace)
    store.ts              # Zustand app store (settings, session state)
  components/             # shared UI (TierBadge, PlayButton, KeyboardDiagram, FretDiagram, Nav)
  app/
    page.tsx              # Dashboard
    compare/page.tsx      # Comparison Arena
    tiers/page.tsx        # Tier Lists
    progress/page.tsx     # Progress & stats
    generator/page.tsx    # Progression Generator
    cheatsheet/page.tsx   # Printable cheat sheet
    settings/page.tsx     # Settings + Your Data (export/import/reset)
tests/                    # Vitest unit tests for lib/
docs/PRD.md               # committed copy of the PRD
```

## Tasks

### Task 1: Scaffold
- [x] `create-next-app` (TS, Tailwind, App Router, src dir), add tone, dexie, zustand, vitest. Vitest config + smoke test. Commit PRD copy + scaffold.

### Task 2: Music theory core (`music/notes.ts`, `scales.ts`, `chords.ts`, `voicings.ts`)
**Produces:** `NOTE_NAMES`, `midiToName(midi)`, `SCALES: ScaleDef[]` (name, intervals, category), `CHORD_QUALITIES: ChordQualityDef[]` (symbol, name, intervals, category), `applyVoicing(pitches, voicing): number[]`, `realizeChord(rootPc, quality, voicing, octave): number[] (midi)`, `realizeScale(rootPc, scale, octave): number[]`.
- [x] TDD: interval math, catalog sizes (≥150 key/scale combos via roots×scales, ≥100 qualities), voicing transforms (inversions rotate, drop-2 drops 2nd-from-top an octave), realization produces sorted midi.

### Task 3: Item catalog + progression generation (`items/catalog.ts`, `music/progressions.ts`)
**Produces:** `Item {id, dimension: 'key'|'quality'|'voicing'|'progression', label, payload}`, `buildCatalog(): Item[]`, `generateProgression(opts): ProgressionPayload {chords: {degree, rootPc, quality, voicing}[], keyItemId, romanNumerals}`, seeded pool (I-IV-V-I, ii-V-I, I-vi-IV-V, …) + novel diatonic/chromatic generation, same progression templated across multiple keys, metadata tags (diatonic|chromatic, common|novel).
- [x] TDD: catalog counts per dimension, progression length bounds 2–8, cross-key duplication of templates, deterministic ids.

### Task 4: Ranking engine (`ranking/elo.ts`, `bradleyTerry.ts`, `tiers.ts`, `matchup.ts`)
**Produces:** `eloUpdate(ra, rb, winner, k): [number, number]`, `fitBradleyTerry(comparisons, itemIds): Map<id, rating>` (minorization-maximization, rescaled to Elo space), `assignTiers(ratings): Map<id, Tier>` (percentile bands), `selectMatchup(items, stats, recentDims): [Item, Item]` (uncertainty-first: prefer high-CI pairs with close ratings; interleave dimensions; deprioritize converged items; maintenance-mode retest hook), `confidence(item): number` from comparison count + rating stability.
- [x] TDD: Elo symmetry/zero-sum, BT recovers a known ordering from synthetic data, tier percentile edges, matchup never repeats same dimension >3× consecutively, converged items deprioritized.

### Task 5: Storage layer (`db/db.ts`, `db/storage.ts`) + Zustand store
**Produces:** Dexie tables `items, comparisons, sessions, generated, settings`; `storage.recordComparison()`, `storage.getItemStats()`, `storage.refitIfDue()` (BT every 50 comparisons), `storage.getSettings()/saveSettings()`; store hydration.
- [x] Unit-test pure helpers (refit-due logic) with fake-indexeddb; UI-facing methods exercised via app.

### Task 6: Audio engine (`audio/engine.ts`)
**Produces:** `setInstrument('piano'|'guitar'|'synth')`, `playChord(midi[], dur)`, `playScale(midi[])`, `playProgression(chords, tempo)`, `stop()`. Piano default; guitar arpeggiates/strums (staggered attacks); synth = warm pad. Tempo adjustable.
- [x] Manual verification (audio not unit-testable headlessly); smoke-test module imports without window at build time (lazy Tone import).

### Task 7: UI — Nav shell + Dashboard (overall %, per-dimension summaries, start button, recent activity)
### Task 8: UI — Comparison Arena (auto-play A then B, replay, choose A/B, keyboard shortcuts, dimension label, session counter, tier-movement flash, onboarding calibration round on first run)
### Task 9: UI — Tier Lists (tabs per dimension, S–F rows, per-item playback, low-confidence "?" badge, tap to target-test)
### Task 10: UI — Progress (per-dimension bars, projected completion from session pace, lifetime stats)
### Task 11: UI — Generator (tier/key/length filters, generate/regenerate/save/play, guitar fret notation + piano keyboard diagram per chord, insufficient-data notice)
### Task 12: UI — Cheat sheet (print-formatted tier lists + top progressions + stats, window.print export)
### Task 13: UI — Settings (instrument, tempo; Your Data: export JSON, import with preview + merge/replace, auto-export reminder every 500 comparisons/2 weeks, confirmed reset)
- [x] Tasks 7–13: build after each screen; commit per screen.

### Task 14: Final verify — `npm test`, `npm run build`, README rewrite, push.

## Deferred from V1 scope (noted, not silently dropped)

- Taste-drift detection ships as the maintenance-mode retest hook in `matchup.ts` + drift flagging on dashboard (basic). Historical drift graphs → post-V1.
- Drag-and-drop manual tier reordering → post-V1 (PRD lists as option).
- Swipe gestures → post-V1 (PRD marks optional).
