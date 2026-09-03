import { describe, it, expect } from 'vitest'
import { axisMax, AXIS_PAD } from './SpectrumCanvas.jsx'

// Playbook #4: "a fixed range the content escaped". A line sitting exactly AT
// Nyquist — the whole point of "Exactly at Nyquist" — used to land on the
// axis's own right border and read half-clipped. axisMax pads 1.5% past the
// last bin so it draws inside the frame instead.

describe('axisMax', () => {
  it('pads past Nyquist when the view is not zoomed', () => {
    const nyq = 4000
    const max = axisMax(nyq, null)
    expect(max).toBeGreaterThan(nyq)
    expect(max).toBeCloseTo(nyq * (1 + AXIS_PAD), 6)
  })

  it('the padded axis actually clears a tone sitting exactly on Nyquist', () => {
    // "Exactly at Nyquist": 4 kHz at an 8 kHz sample rate. A line drawn AT
    // the axis's own edge (max === f) is half-clipped by the border; the pad
    // must leave real daylight past it.
    const sampleRate = 8000
    const nyq = sampleRate / 2
    const max = axisMax(nyq, null)
    expect(max).toBeGreaterThan(nyq)
    expect((max - nyq) / nyq).toBeCloseTo(AXIS_PAD, 6)
  })

  it('leaves a zoomed axis alone — the reader chose that edge', () => {
    const nyq = 4000
    expect(axisMax(nyq, 2000)).toBe(2000)
  })

  it('does not pad past a full-Nyquist request — no daylight to add', () => {
    const nyq = 4000
    // Asking to zoom exactly to the full span (or past it) falls back to the
    // padded full axis, same as no zoom at all.
    expect(axisMax(nyq, nyq)).toBeCloseTo(nyq * (1 + AXIS_PAD), 6)
    expect(axisMax(nyq, nyq * 2)).toBeCloseTo(nyq * (1 + AXIS_PAD), 6)
  })
})
