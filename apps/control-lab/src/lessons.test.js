import { describe, it, expect } from 'vitest'
import { LESSONS, LESSON_GROUPS, applyLesson } from './lessons.js'
import { PLANTS, CONTROLLERS, buildLoop } from './systems.js'
import {
  dcGain,
  isStable,
  magnitudeAt,
  margins,
  secondOrderMetrics,
  stepResponse,
} from '@ee-labs/systems'

// Each note makes a claim, and several of them quote a number outright — "about
// 45%", "near 25 degrees". Those are the dangerous ones: a number in prose is
// exactly what drifts when a default changes, and nobody notices.

const GRID = Float64Array.from({ length: 6000 }, (_, i) => Math.pow(10, -4 + 8 * (i / 5999)))
const loopOf = (l) => {
  const s = applyLesson(l)
  return buildLoop(s.plantId, s.plantP, s.ctrlId, s.ctrlP)
}
const byName = (n) => {
  const l = LESSONS.find((x) => x.name === n)
  if (!l) throw new Error(`no lesson "${n}"`)
  return l
}
const peak = (tf, d) => Math.max(...stepResponse(tf, { duration: d, points: 4000 }).y)

describe('the lesson list itself', () => {
  it('every lesson names a real plant, controller, group and view', () => {
    for (const l of LESSONS) {
      expect(LESSON_GROUPS, l.name).toContain(l.group)
      expect(PLANTS[l.patch.plant], `${l.name}: plant`).toBeTruthy()
      expect(CONTROLLERS[l.patch.ctrl], `${l.name}: controller`).toBeTruthy()
      expect(['step', 'nyquist', 'locus'], l.name).toContain(l.patch.view)
      expect(l.note.length, l.name).toBeGreaterThan(100)
    }
  })

  it('exercises every plant and every controller across the set', () => {
    const plants = new Set(LESSONS.map((l) => l.patch.plant))
    const ctrls = new Set(LESSONS.map((l) => l.patch.ctrl))
    expect(ctrls.size).toBe(Object.keys(CONTROLLERS).length)
    expect(plants.size).toBeGreaterThanOrEqual(Object.keys(PLANTS).length - 2)
  })

  it('every lesson composes a loop that can actually be analysed', () => {
    for (const l of LESSONS) {
      const { open, closed } = loopOf(l)
      expect(Number.isFinite(dcGain(closed)) || dcGain(closed) === Infinity, l.name).toBe(true)
      expect(open.a.length, l.name).toBeGreaterThan(1)
    }
  })
})

describe('what each lesson claims', () => {
  it('proportional really does settle at 90%, not 100%', () => {
    const { closed } = loopOf(byName('Proportional cannot get there'))
    // Kp = 9 on a unit-gain lag: 9/(1+9).
    expect(dcGain(closed)).toBeCloseTo(0.9, 9)
    const { y } = stepResponse(closed, { duration: 30, points: 3000 })
    expect(y[y.length - 1]).toBeCloseTo(0.9, 3)
    // The note says raising Kp shrinks the gap without closing it.
    for (const kp of [50, 500, 5000]) {
      const g = dcGain(buildLoop('firstOrder', { k: 1, tau: 1 }, 'p', { kp }).closed)
      expect(g).toBeLessThan(1)
      expect(g).toBeGreaterThan(0.9)
    }
  })

  it('the integrator closes it exactly, not approximately', () => {
    const { closed } = loopOf(byName('The integrator closes the gap'))
    expect(dcGain(closed)).toBeCloseTo(1, 12)
    const { y } = stepResponse(closed, { duration: 60, points: 4000 })
    expect(y[y.length - 1]).toBeCloseTo(1, 3)
  })

  it('and the integrator really does cost phase margin', () => {
    const l = byName('...and what it costs')
    const s = applyLesson(l)
    const withPi = margins(buildLoop(s.plantId, s.plantP, 'pi', s.ctrlP).open, GRID)
    // Same proportional gain, no integral term: strictly more margin.
    const withP = margins(buildLoop(s.plantId, s.plantP, 'p', { kp: s.ctrlP.kp }).open, GRID)
    expect(withPi.phaseMargin).toBeLessThan(withP.phaseMargin)
  })

  it('three lags go from stable to divergent as the gain rises', () => {
    const s = applyLesson(byName('Turn it up until it sings'))
    const at = (kp) => buildLoop(s.plantId, s.plantP, 'p', { kp })
    expect(isStable(at(1).closed)).toBe(true)
    expect(isStable(at(s.ctrlP.kp).closed), 'the loaded gain should still be stable').toBe(true)
    expect(isStable(at(100).closed)).toBe(false)
    // ...and the overshoot grows on the way.
    expect(peak(at(8).closed, 40)).toBeGreaterThan(peak(at(2).closed, 40))
  })

  it('the gain margin is the exact factor the note claims it is', () => {
    const s = applyLesson(byName('The margin says exactly how far'))
    const gm = margins(buildLoop(s.plantId, s.plantP, 'p', s.ctrlP).open, GRID).gainMargin
    expect(gm).toBeGreaterThan(1)
    const at = (kp) => isStable(buildLoop(s.plantId, s.plantP, 'p', { kp }).closed)
    expect(at(s.ctrlP.kp * gm * 0.9), '0.9 of the margin').toBe(true)
    expect(at(s.ctrlP.kp * gm * 1.1), '1.1 of the margin').toBe(false)
  })

  it('the locus lesson loads a gain where a branch is heading for the boundary', () => {
    const l = byName('Watch the poles cross')
    expect(l.patch.view).toBe('locus')
    const s = applyLesson(l)
    // Stable as loaded, and unstable within reach of the slider.
    expect(isStable(buildLoop(s.plantId, s.plantP, 'p', s.ctrlP).closed)).toBe(true)
    expect(isStable(buildLoop(s.plantId, s.plantP, 'p', { kp: 60 }).closed)).toBe(false)
  })

  it('the Nyquist lesson loads a loop that has both margins to look at', () => {
    const l = byName('Everything is about one point')
    expect(l.patch.view).toBe('nyquist')
    const m = margins(loopOf(l).open, GRID)
    expect(m.phaseMargin, 'needs a gain crossover to show phase margin').not.toBeNull()
    expect(m.gainMargin, 'needs a phase crossover to show gain margin').not.toBeNull()
  })

  it('the thin-margin lesson quotes the numbers it actually produces', () => {
    // The note names four figures: 25 degrees, a predicted 0.25, an actual 0.22
    // and 49%. Prose drifts when a default changes and nobody notices, so each
    // one is pinned. It previously said 45%, and produced 57%.
    const { open, closed } = loopOf(byName('A margin thin enough to feel'))
    const pm = margins(open, GRID).phaseMargin
    expect(pm, 'the note says 25 degrees').toBeCloseTo(25, 0)

    const m = secondOrderMetrics(closed)
    expect(pm / 100, 'the rule predicts 0.25').toBeCloseTo(0.25, 1)
    expect(m.zeta, 'and the actual zeta is 0.22').toBeCloseTo(0.22, 2)

    const over = peak(closed, 30 / (m.zeta * m.wn)) - 1
    expect(over, 'overshooting 49%').toBeCloseTo(0.49, 1)

    // And the note's point: the rule is close, not exact.
    const ideal = Math.exp((-Math.PI * 0.25) / Math.sqrt(1 - 0.25 * 0.25))
    expect(ideal, 'a true 0.25 would give 44%').toBeCloseTo(0.44, 2)
    expect(over).toBeGreaterThan(ideal)
  })

  it('the unstable plant fails the other way round', () => {
    const s = applyLesson(byName('The plant that needs feedback'))
    const at = (kp) => isStable(buildLoop(s.plantId, s.plantP, 'p', { kp }).closed)
    expect(at(s.ctrlP.kp), 'stable as loaded').toBe(true)
    // Turning the gain DOWN is what breaks it, which is the whole point.
    expect(at(0.5)).toBe(false)
    expect(at(0.1)).toBe(false)
  })

  it('derivative action improves a resonant plant that P alone makes worse', () => {
    const s = applyLesson(byName('Derivative buys the phase back'))
    const withD = buildLoop(s.plantId, s.plantP, 'pid', s.ctrlP)
    const noD = buildLoop(s.plantId, s.plantP, 'pid', { ...s.ctrlP, kd: 0 })
    const pmWith = margins(withD.open, GRID).phaseMargin
    const pmWithout = margins(noD.open, GRID).phaseMargin
    expect(pmWith, 'derivative should add margin').toBeGreaterThan(pmWithout)
  })

  it('lead adds phase, and stops gaining above its pole', () => {
    const s = applyLesson(byName('Lead does it without the noise'))
    const c = CONTROLLERS.lead.tf(s.ctrlP)
    const deg = (f) => {
      const w = 2 * Math.PI * f
      const num = Math.atan2(w / s.ctrlP.z, 1)
      const den = Math.atan2(w / s.ctrlP.p, 1)
      return ((num - den) * 180) / Math.PI
    }
    const peakF = Math.sqrt(s.ctrlP.z * s.ctrlP.p) / (2 * Math.PI)
    expect(deg(peakF)).toBeGreaterThan(20)

    // Bounded at the top: the gain flattens at k*p/z rather than rising forever.
    const hi = magnitudeAt(c, 1e6)
    const hier = magnitudeAt(c, 1e8)
    expect(hier / hi).toBeCloseTo(1, 2)
  })
})
