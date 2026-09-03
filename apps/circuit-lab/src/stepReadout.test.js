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
  })

  it('across L (high-pass): final 0, peak 1 — the step itself, before it decays', () => {
    const { step, gain, second } = setupOf(byName('One circuit, three filters'), 'across L')
    const r = stepReadout(step, gain, second)
    expect(r.final).toBe(0)
    expect(r.overshoot).toBeNull()
    expect(r.peak).toBeCloseTo(1, 3)
  })

  it('the tank: Z at DC is 0 Ω, so peak in ohms and no overshoot', () => {
    const { step, gain, second } = setupOf(byName('The same R, the opposite effect'))
    const r = stepReadout(step, gain, second, 'Ω')
    expect(r.final).toBe(0)
    expect(r.unit).toBe('Ω')
    expect(r.overshoot).toBeNull()
    expect(r.peak).toBeCloseTo(308.5, 0)
  })

  it('across C (low-pass): final 1, overshoot quoted, no peak line', () => {
    const { step, gain, second } = setupOf(byName('Resonance, seen in time'))
    const r = stepReadout(step, gain, second)
    expect(r.final).toBeCloseTo(1, 12)
    expect(r.overshoot).toBeCloseTo(0.35, 2)
    expect(r.peak).toBeNull()
    expect(r.settling).toBeGreaterThan(0)
  })

  it('the integrator: never settles, nothing else claimed', () => {
    const { step, gain, second } = setupOf(byName('A pole exactly at the origin'))
    const r = stepReadout(step, gain, second)
    expect(r.final).toBeNull()
    expect(r.finalText).toBe('never settles')
    expect(r.overshoot).toBeNull()
    expect(r.peak).toBeNull()
  })

  it('a null step (too stiff) still reports the final value', () => {
    const r = stepReadout(null, 0, null)
    expect(r.final).toBe(0)
    expect(r.peak).toBeNull()
  })
})

describe('dampingWord', () => {
  it('agrees with the three printed decimals', () => {
    expect(dampingWord(0.9992797)).toBe('underdamped') // 632 Ω: prints 0.999
    expect(dampingWord(1.0000071)).toBe('critically damped') // 632.46 Ω: prints 1.000
    expect(dampingWord(0.99951)).toBe('critically damped')
    expect(dampingWord(1.0006)).toBe('overdamped')
    expect(dampingWord(0.158)).toBe('underdamped')
    expect(dampingWord(NaN)).toBe('')
  })
})
