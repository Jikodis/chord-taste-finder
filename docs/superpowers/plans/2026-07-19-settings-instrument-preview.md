# Settings Instrument Preview Implementation Plan (Piece 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A play button on each instrument option in Settings that plays the identical short phrase through that instrument's Tone.js engine, so choosing an instrument is a timbre comparison, not a guess.

**Architecture:** Pure UI wiring in `src/app/settings/page.tsx` over the existing audio engine — `playChord` already applies per-instrument character (guitar strum stagger). No new lib code, so no new unit tests (repo idiom: audio/UI verified in-browser); the phrase is a C major chord (`realizeChord(0, 'maj')`), the same notes for every instrument. Spec: `docs/superpowers/specs/2026-07-19-playable-cheatsheet-design.md` (Piece 3).

**Tech Stack:** Existing `playChord`/`stop` from `src/lib/audio/engine.ts:86,78`, `realizeChord`.

## Global Constraints

- The same phrase for all three instruments — timbre is the only variable.
- Preview must not change the selected instrument (the button sits inside the radio `<label>`; prevent default).
- Starting one preview stops any playing one (`playChord` already calls `stop()`).
- No new npm dependencies.

---

### Task 1: Preview button per instrument row

**Files:**
- Modify: `src/app/settings/page.tsx` (instrument section, lines 75–93)

- [ ] **Step 1: Wire the buttons**

Add imports:

```tsx
import { playChord, stop } from '@/lib/audio/engine'
import { realizeChord } from '@/lib/music/realize'
```

Add state + handler inside the component, and stop audio on unmount:

```tsx
const [previewing, setPreviewing] = useState<AppSettings['instrument'] | null>(null)
const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

useEffect(() => {
  return () => {
    if (previewTimer.current) clearTimeout(previewTimer.current)
    stop()
  }
}, [])

const preview = async (id: AppSettings['instrument']) => {
  if (previewTimer.current) clearTimeout(previewTimer.current)
  setPreviewing(id)
  await playChord(realizeChord(0, 'maj'), id) // same phrase for all — compare timbre only
  previewTimer.current = setTimeout(() => setPreviewing(null), 1700)
}
```

In the instrument `<label>`, add the button after the text block (flex row already):

```tsx
<button
  onClick={(e) => {
    e.preventDefault() // don't let the label flip the radio
    void preview(inst.id)
  }}
  className="ml-auto rounded-lg bg-surface px-3 py-2 text-sm transition hover:bg-accent-soft"
  aria-label={`Preview ${inst.label} sound`}
>
  {previewing === inst.id ? '♪' : '▶'}
</button>
```

- [ ] **Step 2: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: per-instrument sound preview in settings"
```

---

### Task 2: Browser verification + push

- [ ] **Step 1:** Open `/settings` in the dev server via chrome-devtools MCP. Click each preview button with real input events (script `.click()` is not a user gesture — AudioContext unlock needs trusted input). Confirm: ♪ indicator appears and reverts; the selected radio does not change when previewing a non-selected instrument; console has no errors.
- [ ] **Step 2:** `npm run build` clean, `git push origin main`.
