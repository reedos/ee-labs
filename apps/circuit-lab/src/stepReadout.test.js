import { describe, it, expect } from 'vitest'
import { stepReadout, dampingWord } from './stepReadout.js'
import { LESSONS, applyLesson, chipSetup } from './lessons.js'
import { transferOf } from './circuits.js'
import { dcGain, secondOrderMetrics, stepResponse } from '@ee-labs/systems'

// The step pane's readout printed "final 0 · overshoot 60.5%" for a band-pass.
// Overshoot is a fraction OF the final value; with a final of 0 it is not a
// number at all. These pin what the pane says instead, on the three screens
// the walk saw it on.

const byName = (n) => LESSONS.find((x) => x.name === n)
const setupOf = (lesson, chip) => {
  const s = chip ? chipSetup(lesson, lesson.chips.find((c) => c.label === chip)) : applyLesson(lesson)
  const tf = transferOf(s.id, s.params, s.output)
  const second = secondOrderMetrics(tf)
  const step = stepResponse(tf, { duration: 2e-3, points: 900 })
  return { tf, second, step, gain: dcGain(tf) }
}

describe('stepReadout', () => {
  it('across R (band-pass): final 0, no overshoot, the peak measured off the trace', () => {
    const { step, gain, second } = setupOf(byName('One circuit, three filters'), 'across R')
    const r = stepReadout(step, gain, second)
    expect(r.final).toBe(0)
    expect(r.overshoot).toBeNull()
    expect(r.peak).toBeCloseTo(0.252, 2)
    expect(r.peak).toBe(Math.max(...step.y.map(Math.abs)))
    // "settles ... to within 2%" of a final value of 0 is undefined; diesAway
    // replaces it, measured against the peak rather than assumed from a
    // formula that only means something for a nonzero final value.
    expect(r.settling).toBeNull()
    expect(r.diesAway).toBeGreaterThan(0)
    expect(r.diesAway).toBeLessThan(step.t[step.t.length - 1])
  })

  it('across L (high-pass): final 0, peak 1 — the step itself, before it decays', () => {
    const { step, gain, second } = setupOf(byName('One circuit, three filters'), 'across L')
    const r = stepReadout(step, gain, second)
    expect(r.final).toBe(0)
    expect(r.overshoot).toBeNull()
    expect(r.peak).toBeCloseTo(1, 3)
    expect(r.settling).toBeNull()
    expect(r.diesAway).toBeGreaterThan(0)
  })

  it('the tank: Z at DC is 0 Ω, so peak in ohms and no overshoot', () => {
    const { step, gain, second } = setupOf(byName('The same R, the opposite effect'))
    const r = stepReadout(step, gain, second, 'Ω')
    expect(r.final).toBe(0)
    expect(r.unit).toBe('Ω')
    expect(r.overshoot).toBeNull()
    expect(r.peak).toBeCloseTo(308.5, 0)
    expect(r.settling).toBeNull()
    expect(r.diesAway).toBeGreaterThan(0)
  })

  it('diesAway is the LAST moment the trace was outside ±2% of its own peak', () => {
    // Measured against the raw samples independently of stepReadout's own
    // scan, so this checks the boundary rather than re-running the same code.
    const { step, gain, second } = setupOf(byName('One circuit, three filters'), 'across R')
    const r = stepReadout(step, gain, second)
    const band = 0.02 * r.peak
    const idx = step.t.findIndex((t) => t === r.diesAway)
    expect(idx).toBeGreaterThan(-1)
    expect(Math.abs(step.y[idx])).toBeGreaterThan(band)
    // Every sample after it stays inside the band...
    for (let i = idx + 1; i < step.y.length; i++) {
      expect(Math.abs(step.y[i]), `sample ${i} after diesAway`).toBeLessThanOrEqual(band)
    }
  })

  it('across C (low-pass): final 1, overshoot quoted, no peak line, no diesAway', () => {
    const { step, gain, second } = setupOf(byName('Resonance, seen in time'))
    const r = stepReadout(step, gain, second)
    expect(r.final).toBeCloseTo(1, 12)
    expect(r.overshoot).toBeCloseTo(0.35, 2)
    expect(r.peak).toBeNull()
    expect(r.settling).toBeGreaterThan(0)
    expect(r.diesAway).toBeNull()
  })

  it('drops the overshoot line below 0.05% — the 632 Ω near-critical build', () => {
    // 632 Ω (632.46 rounded, the natural value a person types) reads ζ so
    // close to 1 that the true overshoot is astronomically small; printing
    // "overshoot 0.0%" beside "critically damped" was the second half of
    // the defect this build files against.
    const l = byName('Resonance, seen in time')
    const s = applyLesson(l)
    const tf = transferOf(s.id, { ...s.params, r: 632 }, s.output)
    const second = secondOrderMetrics(tf)
    expect(second.overshoot).toBeGreaterThan(0)
    expect(second.overshoot).toBeLessThan(5e-4)
    const step = stepResponse(tf, { duration: 2e-3, points: 900 })
    const r = stepReadout(step, dcGain(tf), second)
    expect(r.overshoot).toBeNull()
  })

  it('the integrator: never settles, nothing else claimed', () => {
    const { step, gain, second } = setupOf(byName('A pole exactly at the origin'))
    const r = stepReadout(step, gain, second)
    expect(r.final).toBeNull()
    expect(r.finalText).toBe('never settles')
    expect(r.overshoot).toBeNull()
    expect(r.peak).toBeNull()
    expect(r.diesAway).toBeNull()
  })

  it('a null step (too stiff) still reports the final value', () => {
    const r = stepReadout(null, 0, null)
    expect(r.final).toBe(0)
    expect(r.peak).toBeNull()
    expect(r.diesAway).toBeNull()
  })
})

describe('dampingWord', () => {
  it('widened band, |ζ − 1| < 0.005: 632 Ω (the natural rounding of 632.46) now reads critically damped', () => {
    // The three-decimal band (±0.0005) still called 632 Ω "underdamped" —
    // ζ = 0.9992797 — right beside a pane that had just read ζ = 1.000 for
    // the unrounded 632.46 Ω. The comment in stepReadout.js states the band.
    expect(dampingWord(0.9992797)).toBe('critically damped') // 632 Ω: prints 0.999
    expect(dampingWord(1.0000071)).toBe('critically damped') // 632.46 Ω: prints 1.000
    expect(dampingWord(0.99951)).toBe('critically damped')
    // Just inside vs just outside the new ±0.005 band.
    expect(dampingWord(0.996)).toBe('critically damped')
    expect(dampingWord(1.004)).toBe('critically damped')
    expect(dampingWord(0.994)).toBe('underdamped')
    expect(dampingWord(1.006)).toBe('overdamped')
    expect(dampingWord(0.158)).toBe('underdamped')
    expect(dampingWord(NaN)).toBe('')
  })
})
