import { describe, it, expect } from 'vitest'
import { PRESETS } from './presets.js'
import { INITIAL, presetState } from './state.js'

// What "click a preset" does to the state — in particular what it does NOT
// carry over from the previous one.

describe('presetState', () => {
  it('re-pins every field a patch does not name to its default', () => {
    for (const p of PRESETS) {
      const st = presetState(p)
      for (const k of Object.keys(INITIAL)) {
        if (k === 'presetName') continue
        if (k in p.patch) expect(st[k], `${p.name}.${k}`).toEqual(p.patch[k])
        else expect(st[k], `${p.name}.${k}`).toEqual(INITIAL[k])
      }
      expect(st.presetName).toBe(p.name)
    }
  })

  it('does not depend on where the student came from', () => {
    // Beating sets an 8192-point frame; the next lesson must not inherit it.
    // That inheritance is what made Exactly at Nyquist read 3999.0 Hz.
    const beating = presetState(PRESETS.find((p) => p.name === 'Beating'))
    expect(beating.fftSize).toBe(8192)
    const nyq = presetState(PRESETS.find((p) => p.name === 'Exactly at Nyquist'))
    expect(nyq.fftSize).toBe(INITIAL.fftSize)
    expect(nyq.specMax).toBeNull()
  })

  it('every preset names its own sources and rate, so nothing needs carrying over', () => {
    for (const p of PRESETS) {
      expect(Array.isArray(p.patch.sources) && p.patch.sources.length > 0, p.name).toBe(true)
      expect(typeof p.patch.sampleRate, p.name).toBe('number')
    }
  })
})
