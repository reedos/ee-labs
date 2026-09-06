import { describe, it, expect } from 'vitest'
import {
  axisMax,
  AXIS_PAD,
  AMPLITUDE_TITLES,
  fitTitle,
  spectrumYStep,
} from './SpectrumCanvas.jsx'

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

// ---------------------------------------------------------------------------
// Playbook #4 again: named, united, and sized to their content.
//
// A y-axis title is drawn rotated, so its room is the plot's HEIGHT, and
// drawFrame centres it and lets the canvas edge cut the overhang. At 390x844
// the spectrum pane is about 125 px of plot. Measured in the face drawFrame
// uses, "Amplitude (dB, 1.0 = 0 dB)" is about 145 px wide, so the reader was
// shown "Amplitude (dB, 1.0 = 0" — a title that states the opposite of the
// fact it carries. The overlay title lost both ends at once, arriving as
// "delay of the chain (sample".
//
// A stand-in for ctx.measureText: 5.8 px per character at 12 px in a system
// sans face, the ratio these strings measure at on the built page. What is
// under test is the CHOICE between wordings, not the metrics.
const measure = (s) => s.length * 5.8

describe('fitTitle', () => {
  it('keeps the full wording when the pane is tall enough', () => {
    expect(fitTitle(measure, AMPLITUDE_TITLES.db, 365)).toBe('Amplitude (dB, 1.0 = 0 dB)')
    expect(fitTitle(measure, AMPLITUDE_TITLES.linear, 365)).toBe('Amplitude (signal units)')
  })

  it('drops to a shorter wording rather than let the canvas edge cut one', () => {
    const phonePlotPx = 125
    for (const variants of [AMPLITUDE_TITLES.db, AMPLITUDE_TITLES.linear]) {
      const picked = fitTitle(measure, variants, phonePlotPx)
      expect(measure(picked)).toBeLessThanOrEqual(phonePlotPx)
      expect(picked).not.toBe(variants[0])
    }
  })

  it('names its quantity in every wording, and its unit where there is one', () => {
    // The shortest option is the one a 390 px phone gets, so it carries the
    // burden. "dB" is quantity and unit at once. The linear axis has no unit
    // to lose, since its numbers are the signal's own, and "signal units" is
    // the long way of saying dimensionless.
    expect(AMPLITUDE_TITLES.db.at(-1)).toBe('dB')
    expect(AMPLITUDE_TITLES.linear.at(-1)).toBe('amp')
    for (const v of AMPLITUDE_TITLES.db) expect(v).toMatch(/dB/)
    for (const v of AMPLITUDE_TITLES.linear) expect(v).toMatch(/amp/i)
  })

  it('falls back to the shortest when even that does not fit', () => {
    expect(fitTitle(measure, AMPLITUDE_TITLES.db, 1)).toBe('dB')
  })
})

// The ceiling already follows the chain, so a Q = 20 peak at +26 dB is inside
// the frame. It was not READABLE there: at Q = 10 the frame runs -100 to +30,
// the round step for that range is 50, and the ticks come out -100, -50, 0.
// Every gridline the peak could be measured against sat below it, on the one
// lesson whose try line names the peak's height in dB.
describe('spectrumYStep', () => {
  const LAPTOP_H = 300

  const ticksOf = (yMin, yMax, step) => {
    const out = []
    for (let v = Math.ceil(yMin / step) * step; v <= yMax + step * 1e-6; v += step) out.push(v)
    return out
  }

  it('leaves an ordinary spectrum alone — nothing rises above 0 dB', () => {
    expect(spectrumYStep(-100, 10, 0, LAPTOP_H)).toBe(null)
    expect(spectrumYStep(-100, 10, -6.02, LAPTOP_H)).toBe(null)
  })

  it('puts a gridline above 0 dB when the resonant peak is the lesson', () => {
    // "Resonance is Q" at Q = 10: the try line says the peak stands 20 dB
    // over the passband, and the reader must be able to measure that.
    const step = spectrumYStep(-100, 30, 20.0, LAPTOP_H)
    expect(step).not.toBe(null)
    const ticks = ticksOf(-100, 30, step)
    expect(ticks.some((v) => v > 0.5)).toBe(true)
    expect(ticks).toContain(0)
  })

  it('reads the peak the try line names at Q = 20 too', () => {
    // Playbook #4's own case: +26 dB under a +30 ceiling.
    const step = spectrumYStep(-100, 30, 26.02, LAPTOP_H)
    expect(ticksOf(-100, 30, step).some((v) => v > 0.5)).toBe(true)
  })

  it('keeps 15 px between gridlines, since the labels are 11 px tall', () => {
    for (const areaH of [77, 125, 200, LAPTOP_H, 700]) {
      const step = spectrumYStep(-100, 30, 20.0, areaH)
      if (step === null) continue
      expect(areaH / (130 / step)).toBeGreaterThanOrEqual(15)
    }
  })

  // Found on the deployed layout, at 390x844, after the laptop case was
  // already fixed. The phone pane is 77 px of plot, which has room for five
  // labels and not for seven, so every round step small enough to land a
  // gridline above 0 dB was too crowded to use.
  it('still reads the peak on a 77 px phone pane, using the ceiling itself', () => {
    const step = spectrumYStep(-100, 30, 20.0, 77)
    expect(step).toBe(30)
    const ticks = ticksOf(-100, 30, step)
    expect(ticks.some((v) => v > 0.5)).toBe(true)
    expect(ticks).toContain(0)
    expect(ticks.length).toBeLessThanOrEqual(5)
  })

  it('prefers a round step to the ceiling when the pane has room', () => {
    expect(spectrumYStep(-100, 30, 20.0, LAPTOP_H)).toBe(20)
  })

  it('does not fight a frame that already has a tick above zero', () => {
    // "Impulse response": a +13 dB peak gives a +20 ceiling and a 20 dB step,
    // which already lands a label at the top.
    expect(spectrumYStep(-100, 20, 13.0, LAPTOP_H)).toBe(null)
  })

  it('works on the deeper floor a leakage lesson asks for', () => {
    // "Spectral leakage" drops the floor to -160 to show the collapse.
    const step = spectrumYStep(-160, 30, 20.0, LAPTOP_H)
    if (step !== null) expect(ticksOf(-160, 30, step).some((v) => v > 0.5)).toBe(true)
  })
})
