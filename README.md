# Chord Taste Finder

A local-first web app that discovers your harmonic taste through A/B listening comparisons — then generates new chord progressions from what it learns.

You hear two musical options (a key/scale, chord quality, voicing, or progression) and pick the one you prefer. Rankings are computed with Elo ratings, periodically refined by a Bradley-Terry model fit over your full comparison history, and presented as S–F tier lists. Taste-first and convention-agnostic: if you love tritone subs and Locrian mode, that's what the generator gives you.

Full product spec: [`docs/PRD.md`](docs/PRD.md).

## Features (V1)

- **Comparison Arena** — uncertainty-driven A/B matchups across four dimensions (312 keys/scales, 102 chord qualities, 90 voicings, 136 progressions), interleaved to prevent ear fatigue. Keyboard shortcuts: `1`/`2` play, `A`/`B` (or arrows) choose, space plays both.
- **Tier lists** — S/A/B/C/D/F percentile tiers per dimension, live playback, low-confidence flags with targeted retesting.
- **Ranking engine** — real-time Elo plus a Bradley-Terry (minorization-maximization) refit every 50 comparisons; maintenance-mode retests for taste drift once everything converges.
- **Progression generator** — assembles progressions purely from your rated keys and chords (tier-filterable), with guitar fret diagrams/notation and piano keyboard diagrams for every chord.
- **Cheat sheet** — printable export of all tier lists, ranked keys, and saved progressions.
- **Three instruments** — synthesized piano (default), guitar, and warm pad via Tone.js.
- **Data ownership** — everything lives in your browser (IndexedDB). Versioned JSON export/import with merge or replace, plus periodic backup reminders.

## Running

```bash
npm install
npm run dev     # http://localhost:3000
```

```bash
npm test        # Vitest unit tests (theory, catalog, ranking, storage, generator)
npm run build   # production build
npm run lint
```

## Architecture

- `src/lib/music/` — framework-free theory core: notes, 26 scale types, 100+ chord qualities, voicing transforms, progression generation, guitar shape derivation.
- `src/lib/items/` — the testable item catalog across all four dimensions (deterministic IDs, seeded PRNG).
- `src/lib/ranking/` — Elo, Bradley-Terry fit, percentile tiers, uncertainty-driven matchup selection.
- `src/lib/db/` — Dexie (IndexedDB) schema behind a storage service layer (swappable for native storage in a future mobile port).
- `src/lib/audio/` — lazy-loaded Tone.js synthesis for the three timbres.
- `src/app/` — Next.js App Router screens: dashboard, compare, tiers, progress, generator, cheatsheet, settings.

Built with Next.js + TypeScript, Tailwind CSS, Tone.js, Dexie, Zustand, Vitest.
