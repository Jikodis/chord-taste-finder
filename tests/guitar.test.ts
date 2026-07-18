import { describe, it, expect } from 'vitest'
import { guitarShape, templateFor } from '@/lib/music/guitar'

describe('guitar shapes', () => {
  it('uses classic open shapes where they exist', () => {
    expect(guitarShape(0, 'maj').notation).toBe('x32010') // C
    expect(guitarShape(7, 'maj').notation).toBe('320003') // G
    expect(guitarShape(4, 'min').notation).toBe('022000') // Em
  })
  it('derives barre shapes for non-open roots', () => {
    const fSharp = guitarShape(6, 'maj') // F# — E-shape barre at fret 2
    expect(fSharp.notation).toBe('244322')
    expect(fSharp.baseFret).toBe(2)
  })
  it('always returns 6 strings', () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(guitarShape(pc, 'm7').frets.length).toBe(6)
    }
  })
  it('reduces exotic qualities to playable templates', () => {
    expect(templateFor('13')).toBe('7')
    expect(templateFor('maj9')).toBe('maj7')
    expect(templateFor('m11')).toBe('m7')
    expect(templateFor('sus2')).toBe('sus2')
    expect(templateFor('dim7')).toBe('dim7')
  })
})
