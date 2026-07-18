# Chord Progression Taste — Product Requirements Document

Registry record: `proj-20260412-008` ("Build Chord Taste App") · **recreation** · Creativity, Learning. In-repo spec (V1, April 2026); filed 2026-07-16. This is the spec `task-20260707-002` ("Build chord taste app per spec") builds against — it supersedes the "retrieve spec from work laptop" task.

A web app that profiles a musician's harmonic taste through thousands of A/B listening comparisons, ranks preferences in an S–F tier system (Elo + Bradley-Terry), and generates new chord progressions from the discovered taste. Taste-first, convention-agnostic.

---

**Version 1.0 | April 2026**

| Field | Detail |
|---|---|
| Product Name | Chord Progression Taste |
| Version | V1 |
| Tech Stack | Next.js, TypeScript, Web Audio API |
| Target Platform | Web (responsive, mobile-ready for future native app) |
| Data Storage | Local storage (V1) |
| Status | Pre-Development |

---

## 1. Executive Summary

Chord Progression Taste is a web application that helps musicians discover, quantify, and leverage their personal harmonic preferences. Through thousands of A/B pairwise listening comparisons, the app builds a comprehensive taste profile across four dimensions: musical keys, chord qualities, chord voicings/inversions, and chord progressions. Rankings are presented in a gamified S/A/B/C/D/F tier system powered by Elo ratings with periodic Bradley-Terry model refitting for statistical precision.

The app targets musicians with basic music theory knowledge who want to understand their harmonic instincts. Rather than teaching theory prescriptively, it reveals what a musician already gravitates toward, then provides tools to generate new chord progressions from that taste profile. The design is taste-first and convention-agnostic: a user who loves tritone substitutions and chromatic mediants will get progressions full of those, not watered-down pop conventions.

---

## 2. Product Vision

### 2.1 Problem Statement

Musicians often struggle to articulate what they like harmonically. They may know they enjoy certain songs but cannot identify the underlying chord patterns, key preferences, or chord qualities that attract them. Music theory education tends to be prescriptive (teaching what is "correct") rather than descriptive (revealing what a specific musician finds beautiful). This gap is especially acute for composers and jazz musicians who want to develop a distinctive harmonic voice.

### 2.2 Solution

A comprehensive, data-driven taste profiling system that uses pairwise comparison—the gold standard in preference research—to build granular, ranked preference profiles across every dimension of harmonic choice. The system is designed to be thorough (covering esoteric chords and all key signatures including modes), patient (comfortable requiring thousands of comparisons), and actionable (generating new progressions from discovered taste).

### 2.3 Target User

Musicians with basic music theory knowledge. They understand chord names, Roman numeral notation (ii-V-I), and key signatures. They have the intention and desire to deepen their music theory understanding. This includes singer-songwriters, bedroom producers, composers, and jazz musicians. The app uses standard theory notation (not simplified) since the audience is comfortable with it or actively learning it.

---

## 3. Core Features (V1)

### 3.1 A/B Pairwise Comparison Engine

The heart of the application. Users hear two musical stimuli and choose which they prefer. Each comparison is a simple binary decision, keeping cognitive load low and data quality high—especially important with audio stimuli where holding multiple options in memory is difficult.

#### 3.1.1 Testing Dimensions

The app tests four distinct but interrelated preference dimensions:

| Dimension | Description | Item Space |
|---|---|---|
| **Keys & Scales** | All 12 major keys, 12 natural minor keys, Western modal scales (Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian), and non-Western/exotic scales (Ryukyu, Hungarian minor, Phrygian dominant, whole tone, diminished, blues, pentatonic major and minor, harmonic minor, melodic minor, Hirajoshi, In-Sen, Iwato, and others) across all roots. Coverage should be comprehensive and include esoteric scales that composers and jazz musicians may encounter or seek out. | 150+ keys/scales |
| **Chord Qualities** | Individual chord types independent of key context. Includes basic triads (major, minor, diminished, augmented), seventh chords (maj7, min7, dom7, dim7, half-dim7, minMaj7), extended chords (9ths, 11ths, 13ths), altered chords (aug, dim, sus2, sus4, add9, add11), and other voicings. | 100+ chord types |
| **Chord Voicings & Inversions** | The same chord quality in different voicings: root position, 1st/2nd/3rd inversions, open vs closed voicing, spread voicings, drop-2/drop-3 voicings. Tested to determine whether a user's preference for a chord quality is voicing-dependent. | Multiplicative on chord qualities |
| **Chord Progressions** | Sequences of 2–8 chords. Algorithmically generated to cover common and novel progressions. Critically, the same progression is tested in multiple keys to isolate whether the user likes the progression itself or the key it was played in. | Thousands of combinations |

#### 3.1.2 Intelligent Matchup Selection

The system does not present random matchups. Instead, it uses an uncertainty-driven selection algorithm that prioritizes comparisons where the system has the least confidence in the relative ranking of two items. This ensures each comparison maximally reduces uncertainty, leading to faster convergence without sacrificing the organic, free-flowing feel.

- **Free-flowing stream:** The algorithm mixes matchups across all four dimensions to prevent listener fatigue. A user will not face 30 minor chord comparisons in a row; instead, the system interleaves key comparisons, chord quality tests, voicing comparisons, and progression matchups.
- **Cross-dimensional testing:** Chord progressions are tested in multiple keys to decouple key preference from progression preference. If a user rates progression X highly in E minor but not in C major, the system captures this nuance.
- **Convergence awareness:** The system tracks statistical confidence for each item's ranking. Once an item's Elo score stabilizes (confidence interval below threshold), it is deprioritized in matchup selection.

#### 3.1.3 Audio Playback

All comparisons are presented as audio using browser-based synthesis via the Web Audio API or a widely-adopted JavaScript audio library (such as Tone.js). Users can switch between three instrument timbres:

- **Piano:** Clean acoustic piano tone. Default option.
- **Guitar:** Acoustic guitar strumming/arpeggiation.
- **Synthesizer:** Warm pad/synth tone.

The selected instrument persists across sessions. Audio should be high-quality enough that voicing and inversion differences are audible. Playback controls include play, replay each option, and adjustable tempo.

Piano is the recommended default for taste profiling. Piano timbres render chord qualities, voicings, and inversions most transparently—each note is distinct and sustained, making subtle harmonic differences easier to perceive. Guitar and synthesizer timbres are fully supported for users who prefer them, but the onboarding flow should suggest piano as the starting point for the most accurate profiling. Users who primarily write on guitar can switch freely; the chord shape display in the Generator (section 3.4.3) ensures results translate directly to their instrument.

### 3.2 Elo Rating & Tier System

Every item across all four dimensions receives an Elo rating that updates in real-time after each comparison. The Elo system provides the instant feedback and game-like feel that makes the app engaging over thousands of comparisons.

#### 3.2.1 Elo + Bradley-Terry Hybrid

The system uses a dual-layer ranking approach:

- **Elo (real-time):** After each A/B comparison, both items' Elo scores are updated immediately. This provides instant, responsive feedback in the UI.
- **Bradley-Terry (periodic refit):** On a scheduled basis (e.g., after every 50 comparisons or at session end), the full Bradley-Terry model is refit across all accumulated comparison data. This produces more statistically stable rankings than Elo alone, because it considers all comparisons simultaneously rather than sequentially. The refit silently updates Elo scores to reflect the refined estimates.

#### 3.2.2 Tier Mapping

Elo scores are mapped to tiers based on score distribution:

| Tier | Description | Elo Range Mapping |
|---|---|---|
| **S** | Absolute favorites. Core to the user's musical identity. | Top 5% of scores |
| **A** | Strong preferences. Frequently enjoyed. | Next 15% |
| **B** | Solid likes. Good but not essential. | Next 20% |
| **C** | Neutral. Neither drawn to nor away from. | Middle 20% |
| **D** | Mild dislikes. Would not actively choose. | Next 20% |
| **F** | Strong dislikes. Actively avoided. | Bottom 20% |

Tier thresholds are calculated dynamically based on the current score distribution, not fixed numbers. This means tiers are meaningful regardless of how many items have been tested. Users can view tier lists for each dimension independently.

#### 3.2.3 Taste Drift Detection

Once a user's tier list is statistically complete (all items have converged to stable scores), the system transitions to a maintenance mode inspired by spaced repetition systems. In this mode:

- The system periodically re-tests settled matchups at decreasing frequency.
- If a preference reversal is detected on a previously confident matchup, the system flags the shift and opens up additional testing in that area.
- Taste drift is surfaced to the user: "Your preference for Lydian mode has shifted from B-tier to A-tier over the past month."
- This mode only activates once the initial dataset is complete. Until then, all effort goes toward initial profiling.

### 3.3 Progress Tracking

Users see a clear progress indicator showing how much of their taste profile has been mapped:

- **Per-dimension percentage:** "Keys: 72% complete | Chord Qualities: 45% complete | Voicings: 18% complete | Progressions: 31% complete."
- **Overall percentage:** Weighted composite across all four dimensions.
- **Projected completion date:** Based on the user's average comparisons per session, average session frequency, and remaining uncertain matchups. Example: "At your current pace, your key preferences will be fully mapped by April 15."
- **Session stats:** Comparisons completed this session, total lifetime comparisons, current streak.

### 3.4 Chord Progression Generator

A generative tool that creates new chord progressions based entirely on the user's discovered taste profile. This is taste-first with no conventional weighting—if the user's profile shows a love for unconventional harmonic movement, the generator embraces that fully.

#### 3.4.1 Generation Logic

- Draws exclusively from items the user has rated. The generator never introduces untested elements.
- Assembles progressions by combining the user's preferred chord qualities in their preferred keys.
- No Hooktheory or convention-based weighting. A user who loves augmented chords and tritone substitutions gets progressions full of those, not softened by statistical norms.
- Respects harmonic voice-leading where possible for playability, but does not override taste preferences to enforce conventional resolution.

#### 3.4.2 Filtering & Controls

- **Filter by tier:** Generate using only S-tier and A-tier chords, or expand to include B-tier. Users choose the tier threshold for both keys and chord qualities independently.
- **Filter by key:** Lock to a specific key or let the generator choose from top-ranked keys.
- **Progression length:** Specify desired length (2–8 chords).
- **Regenerate:** One-click to generate a new progression with the same filters.
- **Save:** Bookmark generated progressions for later reference.
- **Play:** Hear the generated progression in the selected instrument timbre.

#### 3.4.3 Chord Shape Display

Generated progressions display instrument-specific chord shapes alongside the Roman numeral and chord symbol notation, so users can immediately play what the generator produces:

- **Guitar:** Chord shapes displayed as fret notation strings (e.g., 320003 for G major, x32010 for C major) using the standard low-to-high string convention (6th string to 1st string). Where a chord has multiple common voicings, the voicing that best matches the user's tested voicing preferences is selected. An optional chord diagram visual (fretboard grid with dot markers) can accompany the notation string.
- **Piano:** Chord voicings displayed as note names in low-to-high order (e.g., C-E-G for C major, G-B-D-F# for Gmaj7) so the exact voicing and inversion is captured. A visual keyboard diagram highlights the pressed keys, making it immediately clear where to place fingers. The visual representation is the primary display for piano, with note names as a secondary label.
- **Voicing consistency:** The displayed chord shapes reflect the specific voicing/inversion that the user has ranked highest for that chord quality. If the user prefers Cmaj7 in second inversion, the guitar tab and piano diagram show that inversion, not root position.

### 3.5 Exportable Cheat Sheet

Users can export their complete taste profile as a downloadable document (PDF or printable HTML). The cheat sheet includes:

- Tier lists for all four dimensions (keys & scales, chord qualities, voicings, progressions).
- Top chord progressions with notation and chord shapes for both guitar (fret notation) and piano (note names and keyboard diagrams).
- Preferred keys ranked.
- Summary statistics (total comparisons, date profile was generated, confidence level).

This serves as a quick reference during songwriting sessions, rehearsals, or studio work.

---

## 4. Information Architecture & Screens

### 4.1 Screen Map

| Screen | Purpose | Key Elements |
|---|---|---|
| **Home / Dashboard** | Central hub showing taste profile overview and entry points. | Overall progress %, quick-start comparison button, tier list summaries for each dimension, recent activity. |
| **Comparison Arena** | The core A/B testing interface. | Two audio players (A and B), play/replay controls, instrument selector, choice buttons, current dimension indicator, session stats counter. |
| **Tier Lists** | Detailed ranked view of all tested items per dimension. | Switchable tabs for Keys & Scales / Chord Qualities / Voicings / Progressions. Drag-and-drop manual reordering option. S through F tier rows with items. Playback for any item. |
| **Progress** | Detailed progress and statistics. | Per-dimension progress bars with percentages, projected completion dates, comparison history graph, session frequency data. |
| **Generator** | Chord progression generation from taste profile. | Tier filter controls, key filter, length selector, generate button, audio playback, guitar fret notation and piano keyboard diagrams for each chord, save/bookmark, history of generated progressions. |
| **Cheat Sheet / Export** | Preview and export taste profile. | Print-formatted view of all tier lists, export to PDF button, share options. |
| **Settings** | App configuration and data management. | Instrument timbre selection, audio tempo control, display preferences. "Your Data" section with prominent export/import JSON buttons, auto-export reminders, merge vs. replace import options, and data reset with confirmation. |

---

## 5. User Flows

### 5.1 Flow 1: First-Time User Onboarding

1. User lands on the home page. Brief welcome explains the concept: "Discover your chord taste through listening comparisons."
2. User selects their preferred instrument timbre (piano, guitar, or synthesizer). Can be changed anytime.
3. A brief calibration round (5–10 comparisons) introduces the A/B format with clear, contrasting examples to familiarize the user with the interaction.
4. User enters the Comparison Arena. The dashboard now shows 0% progress and empty tier lists, motivating the user to build their profile.
5. After 20–30 comparisons, the system has enough data to begin showing preliminary tier placements. A notification encourages the user: "Your first tier list is taking shape!"

### 5.2 Flow 2: Core Comparison Session

1. User opens the app and taps "Start Comparing" from the dashboard (or continues a session).
2. The system selects the next matchup based on uncertainty-driven algorithm, mixing across dimensions to prevent fatigue.
3. Two audio stimuli are presented. User can play each one (auto-plays A, then B), replay either, or replay both.
4. User taps "Prefer A" or "Prefer B." Elo scores update immediately. A subtle animation shows the winning item's tier movement (if any).
5. Next matchup loads automatically. Session counter increments. The dimension label subtly indicates what is being tested (e.g., "Key Comparison" or "Progression Comparison").
6. User can end session at any time. All data is saved to local storage. Dashboard updates with new progress percentages.

### 5.3 Flow 3: Exploring Tier Lists

1. User navigates to the Tier Lists screen from the dashboard.
2. Tabs allow switching between Keys & Scales, Chord Qualities, Voicings, and Progressions.
3. Each tier (S through F) is displayed as a horizontal row. Items within a tier are sorted by Elo score. User can tap any item to hear it played.
4. Items with low confidence are shown with a visual indicator (e.g., a "?" badge or dashed border) to signal that more testing is needed for that item.
5. User can tap a low-confidence item to trigger targeted comparisons for that item in the Comparison Arena.

### 5.4 Flow 4: Generating Chord Progressions

1. User navigates to the Generator screen.
2. User sets filters: tier threshold for chord qualities (e.g., S and A tier only), tier threshold for keys, and desired progression length.
3. User taps "Generate." The system assembles a progression from the filtered taste profile data.
4. The progression is displayed in notation (Roman numerals and chord symbols) and is playable with the selected instrument timbre.
5. User can regenerate (new random progression with same filters), adjust filters, save/bookmark the progression, or export it.
6. If insufficient data exists for the selected filters, the system notifies the user: "You need more comparisons in [dimension] to use these filters. Start comparing?"

### 5.5 Flow 5: Taste Drift (Post-Completion)

1. All four dimension progress bars reach 100%. The system notifies the user that their taste profile is complete.
2. The Comparison Arena shifts to maintenance mode. Comparisons are served at reduced frequency, targeting previously settled matchups.
3. If a preference reversal is detected, the system alerts the user and opens targeted re-testing in that area.
4. Drift is visualized on the dashboard: historical tier changes over time, with timestamps.

---

## 6. Technical Architecture

### 6.1 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js with TypeScript | Interactive, state-heavy SPA. React ecosystem enables future React Native mobile port. TypeScript for type safety across the ranking algorithm. |
| Audio Engine | Web Audio API / Tone.js | Browser-native synthesis. Tone.js provides higher-level abstractions for instrument timbres, scheduling, and playback. Wide adoption and active maintenance. |
| Data Storage | Local Storage / IndexedDB | V1 is local-only. IndexedDB preferred over localStorage for structured data and larger storage limits. All comparison history, Elo scores, and tier lists stored client-side. |
| Ranking Algorithm | Custom Elo + Bradley-Terry implementation | Elo for real-time updates, Bradley-Terry for periodic batch refitting. Implemented in TypeScript. |
| Styling | Tailwind CSS or CSS Modules | Rapid, consistent styling. Mobile-first responsive design. |

### 6.2 Data Model (Conceptual)

The following entities are stored in IndexedDB:

- **Items:** Each testable item (a key, chord quality, voicing, or progression) with its Elo score, confidence interval, tier assignment, dimension type, and metadata.
- **Comparisons:** Complete history of every A/B comparison with timestamp, the two item IDs, the winner, and the dimension. This is the source of truth for Bradley-Terry refitting.
- **Sessions:** Metadata per session including start/end time, number of comparisons, and dimensions covered.
- **Generated Progressions:** Saved/bookmarked progressions from the generator with the filters that produced them.
- **Settings:** Instrument timbre, tempo, display preferences.

### 6.3 Algorithmic Generation of Progressions

Chord progressions for testing are algorithmically generated rather than drawn from a static library. The generation algorithm should:

- Cover the full space of 2–8 chord sequences using all chord qualities in the system.
- Include both diatonic and chromatic movement to ensure coverage of conventional and unconventional progressions.
- Seed the initial pool with well-known progressions (I-IV-V-I, ii-V-I, I-vi-IV-V, etc.) but generate novel combinations beyond these to discover unexpected preferences.
- Tag progressions with metadata: diatonic vs. chromatic, functional vs. non-functional, common vs. novel.

### 6.4 Mobile Readiness

V1 is web-only, but all design decisions should account for an eventual mobile app:

- **Responsive design:** All screens must work on mobile viewports. The Comparison Arena in particular must be thumb-friendly.
- **Touch-first interactions:** Swipe gestures for A/B choice (optional, in addition to tap buttons).
- **React component architecture:** Designed for future extraction into React Native components.
- **Data layer abstraction:** Storage access is abstracted behind a service layer so IndexedDB can be swapped for a native storage solution later.

### 6.5 Data Portability & Backup

Because V1 stores all data locally with no cloud backup, data portability is critical. Users must never lose their taste profile due to browser data clearing, device changes, or accidental resets. The app provides a robust export/import system:

- **Export to JSON:** One-click export of the entire dataset—all comparison history, Elo scores, tier assignments, saved progressions, and settings—as a single JSON file. The file should be human-readable and versioned with a schema version number for forward compatibility.
- **Import from JSON:** Users can import a previously exported file to restore their full profile. The import process validates the file against the expected schema, warns of version mismatches, and provides a preview of what will be restored (e.g., "4,327 comparisons, 83 ranked items, 12 saved progressions") before overwriting.
- **Merge vs. replace:** When importing into an app that already has data, the user is given the choice to replace all existing data or merge (combining comparison histories and recalculating rankings). Merge is the safer default.
- **Auto-export reminders:** The app periodically reminds users to export their data (e.g., every 500 comparisons or every 2 weeks) since there is no cloud backup in V1.
- **Settings screen integration:** Export and import buttons are prominently placed in Settings under a "Your Data" section, alongside a data reset option that requires confirmation.

---

## 7. Future Features (Post-V1)

The following features are captured for future development. They are out of scope for V1 but should be considered in architectural decisions to avoid costly refactoring.

| Feature | Version | Description |
|---|---|---|
| Account System | V2 | Email/OAuth login for cloud-synced profiles. Enables cross-device access and sharing. |
| Spotify Playlist Analysis | V2 | Connect Spotify account, analyze playlists by matching songs against Hooktheory's 70,000+ song database for chord progressions, and use Spotify API for key/mode data. Creates a separate preference dataset alongside the A/B testing data. Requires Hooktheory API integration (rate limited: 10 req/10 sec) and Spotify OAuth. |
| AI Taste Analysis | V2 | LLM-powered analysis of the user's preference profile. Identifies patterns the user might not notice: "You strongly prefer minor keys with extended chords, especially in flat keys. This is characteristic of neo-soul and modern jazz harmony." |
| Rhythm Preferences | V3 | A/B testing for rhythmic patterns, time signatures, tempo preferences, and groove styles. |
| Bass Line Preferences | V3 | Testing preferences for bass movement patterns: walking bass, pedal tones, chromatic approaches, etc. |
| Melodic Phrasing Preferences | V3 | Testing preferences for melodic shapes, intervals, and phrasing over chord progressions. |
| Mobile Native App | V2–V3 | React Native port using the same component architecture and data model. Requires cloud sync (account system). |
| Social / Sharing | V3+ | Share taste profiles, compare with other musicians, discover musicians with similar harmonic taste. |
| MIDI Export | V2 | Export generated progressions as MIDI files for import into DAWs. |

---

## 8. Design Principles

**Taste-first, convention-agnostic.** The app never judges or corrects preferences. There is no "wrong" taste. A user who prefers Locrian mode and augmented chords is served with the same respect and thoroughness as one who prefers I-IV-V-I in C major.

**Gamified but rigorous.** The tier system and progress tracking make the experience feel like a game, but the underlying statistics are scientifically sound. Elo and Bradley-Terry are well-established preference models.

**Patient and comprehensive.** The app is designed for long-term engagement over weeks or months. It does not rush to premature conclusions. Thousands of comparisons are expected and embraced.

**Audio-first.** Every screen that references a musical concept should let the user hear it. Notation is supplementary; sound is primary.

**Mobile-ready from day one.** Responsive design, touch-friendly interactions, and abstracted data layers ensure a smooth path to native mobile.

**Data ownership.** V1 stores everything locally. The user's taste data belongs to them and never leaves their device unless they export it.

---

## 9. Open Questions

- **Elo K-factor tuning:** What K-factor values produce the best balance between responsiveness and stability? May require playtesting to calibrate.
- **Bradley-Terry refit frequency:** After every N comparisons, or at session end, or both? Performance implications for large datasets on client-side computation.
- **Progression generation algorithm:** Exact rules for generating novel progressions that are musically interesting without conventional weighting. May benefit from a Markov chain or constraint-satisfaction approach.
- **Voicing synthesis quality:** Can Web Audio API / Tone.js produce voicing differences that are clearly audible, especially for guitar timbre? May need custom sample sets.
- **Tier threshold tuning:** Are percentile-based thresholds (top 5%, next 15%, etc.) the right distribution, or should they be adjustable per user?
- **Session length recommendations:** Should the app suggest session lengths to prevent ear fatigue, or leave it entirely to the user?
- **Hooktheory API terms of service:** Verify commercial use is permitted for the Spotify playlist analysis feature in V2.
