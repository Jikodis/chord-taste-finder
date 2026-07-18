'use client'

import type * as ToneType from 'tone'

export type Instrument = 'piano' | 'guitar' | 'synth'

let tone: typeof ToneType | null = null
let poly: ToneType.PolySynth | null = null
let currentInstrument: Instrument | null = null
let scheduled: number[] = []

/** Lazily load Tone and unlock the AudioContext. Must be called from a user gesture. */
async function ensureStarted(): Promise<typeof ToneType> {
  if (!tone) tone = await import('tone')
  await tone.start()
  return tone
}

function buildSynth(t: typeof ToneType, instrument: Instrument): ToneType.PolySynth {
  switch (instrument) {
    case 'piano': {
      // Percussive FM tone with fast attack and natural decay — piano-like enough
      // to expose voicing differences clearly (PRD §3.1.3: piano is the default).
      const synth = new t.PolySynth(t.FMSynth, {
        harmonicity: 2.5,
        modulationIndex: 12,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.004, decay: 1.6, sustain: 0.12, release: 1.4 },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0.05, release: 0.6 },
        volume: -8,
      })
      const reverb = new t.Reverb({ decay: 1.4, wet: 0.18 })
      synth.chain(reverb, t.getDestination())
      return synth
    }
    case 'guitar': {
      // Plucked character: sharp attack, quick decay, mellow lowpassed body.
      const synth = new t.PolySynth(t.Synth, {
        oscillator: { type: 'fmtriangle', harmonicity: 1.5, modulationIndex: 6 } as ToneType.SynthOptions['oscillator'],
        envelope: { attack: 0.002, decay: 1.1, sustain: 0.05, release: 0.9 },
        volume: -6,
      })
      const filter = new t.Filter(2200, 'lowpass')
      const reverb = new t.Reverb({ decay: 1.2, wet: 0.15 })
      synth.chain(filter, reverb, t.getDestination())
      return synth
    }
    case 'synth': {
      // Warm pad: detuned saws, slow attack, generous release.
      const synth = new t.PolySynth(t.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 24 } as ToneType.SynthOptions['oscillator'],
        envelope: { attack: 0.12, decay: 0.4, sustain: 0.6, release: 1.8 },
        volume: -14,
      })
      const filter = new t.Filter(1600, 'lowpass')
      const reverb = new t.Reverb({ decay: 2.5, wet: 0.3 })
      synth.chain(filter, reverb, t.getDestination())
      return synth
    }
  }
}

async function getSynth(instrument: Instrument): Promise<ToneType.PolySynth> {
  const t = await ensureStarted()
  if (!poly || currentInstrument !== instrument) {
    poly?.dispose()
    poly = buildSynth(t, instrument)
    currentInstrument = instrument
  }
  return poly
}

function midiToFreqName(t: typeof ToneType, midi: number): string {
  return t.Frequency(midi, 'midi').toNote()
}

export function stop(): void {
  if (!tone || !poly) return
  for (const id of scheduled) tone.getTransport().clear(id)
  scheduled = []
  poly.releaseAll()
}

/** Play a chord. Guitar gets a light strum stagger; others attack together. */
export async function playChord(midi: number[], instrument: Instrument, durationSec = 1.6): Promise<void> {
  const t = await ensureStarted()
  const synth = await getSynth(instrument)
  stop()
  const now = t.now()
  const stagger = instrument === 'guitar' ? 0.045 : 0.008
  midi.forEach((m, i) => {
    synth.triggerAttackRelease(midiToFreqName(t, m), durationSec, now + i * stagger)
  })
}

/** Play a scale ascending, then the tonic chord-free rest. */
export async function playScale(midi: number[], instrument: Instrument, noteSec = 0.28): Promise<void> {
  const t = await ensureStarted()
  const synth = await getSynth(instrument)
  stop()
  const now = t.now()
  midi.forEach((m, i) => {
    synth.triggerAttackRelease(midiToFreqName(t, m), noteSec * 0.92, now + i * noteSec)
  })
}

/** Play a progression: one chord per beat-pair at the given tempo. */
export async function playProgression(
  chords: number[][],
  instrument: Instrument,
  bpm = 80
): Promise<number> {
  const t = await ensureStarted()
  const synth = await getSynth(instrument)
  stop()
  const secPerChord = (60 / bpm) * 2 // two beats per chord
  const now = t.now()
  chords.forEach((chord, ci) => {
    const at = now + ci * secPerChord
    const stagger = instrument === 'guitar' ? 0.04 : 0.008
    chord.forEach((m, ni) => {
      synth.triggerAttackRelease(midiToFreqName(t, m), secPerChord * 0.95, at + ni * stagger)
    })
  })
  return chords.length * secPerChord
}
