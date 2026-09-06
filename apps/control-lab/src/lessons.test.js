import { describe, it, expect } from 'vitest'
import { LESSONS, LESSON_GROUPS, applyLesson } from './lessons.js'
import { TERMS } from './terms.js'
import { chromeTermIds } from './chrome.js'
import { watchSignals } from './watch.js'
import { PLANTS, CONTROLLERS, buildLoop, defaultsOf, ctrlDefaultsFor } from './systems.js'
import {
  dcGain,
  isStable,
  magnitudeAt,
  polesZeros,
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
      expect(['step', 'watch', 'nyquist', 'locus'], l.name).toContain(l.patch.view)
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
      // And a loop that BEHAVES, with one deliberate exception. Every OTHER
      // note describes a response that settles (the ones about losing
      // stability say "drag the gain up" — from a stable start), so the
      // loaded state itself must be stable. "...and what it costs" shipped
      // with poles exactly on the imaginary axis by ACCIDENT: an UNSTABLE
      // badge and a step ringing forever under a note calmly discussing
      // margins, and nothing here looked — that failure mode is still what
      // this test guards everywhere else. "The plant that needs feedback" is
      // the one lesson that loads unstable ON PURPOSE (Kp = 0.5, latched):
      // its whole point is the inverted failure mode, and the student review
      // found that mode a chip away rather than the first picture, so it now
      // opens on it directly instead of the tame Kp = 5 rise.
      if (l.name === 'The plant that needs feedback') {
        expect(isStable(closed), `${l.name} should load the latched, unstable case`).toBe(false)
      } else {
        expect(isStable(closed), `${l.name} should load a stable loop`).toBe(true)
      }
    }
  })
})

describe('terms — definitions on contact', () => {
  it('every lesson declares terms, and every one of them is defined', () => {
    for (const l of LESSONS) {
      expect(l.terms?.length, `${l.name} should lean on at least one term`).toBeGreaterThan(0)
      for (const id of l.terms) {
        expect(TERMS[id], `${l.name} references "${id}"`).toBeTruthy()
      }
    }
  })

  it('every defined term is surfaced by at least one lesson, or by the picker', () => {
    // Two surfaces now offer definitions: a lesson's own "terms used here"
    // fold, and the picker's (chrome.js), fed by whatever plant, controller
    // and view are on screen with no lesson loaded. A term only the picker
    // ever shows (characteristicequation, on screen only under the Math
    // tab's own static prose) is still surfaced somewhere, which is the
    // actual rule — "by a lesson" was always a stand-in for that.
    const used = new Set(LESSONS.flatMap((l) => l.terms || []))
    for (const pid of Object.keys(PLANTS)) {
      const plantP = defaultsOf(PLANTS[pid])
      for (const cid of Object.keys(CONTROLLERS)) {
        const ctrlP = ctrlDefaultsFor(pid, plantP, cid)
        for (const view of ['step', 'watch', 'nyquist', 'locus', 'math']) {
          for (const id of chromeTermIds({
            plantId: pid,
            plantP,
            ctrlId: cid,
            ctrlP,
            view,
            stepInput: 'ref',
            arrival: false,
          })) {
            used.add(id)
          }
        }
      }
    }
    for (const id of Object.keys(TERMS)) {
      expect(used.has(id), `"${id}" defined but never surfaced`).toBe(true)
    }
  })

  it('the load-bearing concepts appear where their lesson lives', () => {
    const of = (name) => LESSONS.find((l) => l.name === name)?.terms || []
    expect(of('The integrator closes the gap')).toContain('integrator')
    expect(of('The margin says exactly how far')).toContain('gainmargin')
    expect(of('A margin thin enough to feel')).toContain('zeta')
    expect(of('The plant that needs feedback')).toContain('rhp')
    expect(of('Everything is about one point')).toContain('nyquistplot')
    expect(of('Watch the poles cross')).toContain('rootlocus')
  })

  it('definitions hold to the house rules: short, and named', () => {
    for (const [id, t] of Object.entries(TERMS)) {
      expect(t.def.length, id).toBeLessThan(600)
      expect(t.def.length, id).toBeGreaterThan(120)
      expect(t.name.length, id).toBeGreaterThan(1)
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
    // The note says to SWITCH controllers and watch the number fall — and the
    // controller buttons reset the gains to their defaults, so the claim has
    // to hold for the clicks the reader can actually make, not just at
    // matched gains: the lesson, then P at its default, then PI at its.
    const pDefault = margins(buildLoop(s.plantId, s.plantP, 'p', defaultsOf(CONTROLLERS.p)).open, GRID)
    const piDefault = margins(buildLoop(s.plantId, s.plantP, 'pi', defaultsOf(CONTROLLERS.pi)).open, GRID)
    expect(withPi.phaseMargin, 'the lesson against the P click').toBeLessThan(pDefault.phaseMargin - 20)
    expect(piDefault.phaseMargin, 'the PI click against the P click').toBeLessThan(pDefault.phaseMargin - 20)
  })

  it('the watch lesson: the handoff it narrates is what its own setup produces', () => {
    const l = byName('Watch the integrator take over')
    expect(l.patch.view).toBe('watch')
    const s = applyLesson(l)
    const loop = buildLoop(s.plantId, s.plantP, s.ctrlId, s.ctrlP)
    const w = watchSignals(loop, s.ctrlId, s.ctrlP, 'ref', { duration: 60, points: 1200 })
    const at = (key) => w.parts.find((p) => p.key === key).y
    const end = (a) => a[a.length - 1]
    // "At first the proportional part carries all of the effort."
    expect(at('p')[0] / w.u[0]).toBeCloseTo(1, 6)
    // "By the end ... the proportional part is zero, the integral holds the
    // entire drive" — and the drive must be what holds y at 1 through P.
    expect(end(w.e)).toBeCloseTo(0, 2)
    expect(end(at('p'))).toBeCloseTo(0, 2)
    expect(end(at('i'))).toBeCloseTo(1 / dcGain(loop.plant), 2)
    // "Flip to Disturbance and the same memory winds down to exactly minus
    // the shove."
    const wd = watchSignals(loop, s.ctrlId, s.ctrlP, 'dist', { duration: 60, points: 1200 })
    expect(end(wd.u)).toBeCloseTo(-1, 2)
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
    // Loaded at Kp = 0.5: this is the picture the lesson exists to show,
    // latched rather than settled — the note and the picture agree.
    expect(s.ctrlP.kp).toBe(0.5)
    expect(at(s.ctrlP.kp), 'latched as loaded').toBe(false)
    expect(at(0.1)).toBe(false)
    // Raising the gain is what fixes it, the inverted failure mode's point.
    expect(at(5), 'Kp -> 5 stabilizes it').toBe(true)
    expect(at(20)).toBe(true)
  })

  it('and it runs away without bound rather than latching to a rail', () => {
    // The note used to say the loop "latches to a rail" at this gain. There
    // is no rail: this model is linear, the app's own glossary entry for the
    // word says the lab has none, and the picture is an exponential still
    // climbing when the plot ends. A latch would flatten; this does not.
    const s = applyLesson(byName('The plant that needs feedback'))
    const { closed } = buildLoop(s.plantId, s.plantP, 'p', { kp: s.ctrlP.kp })
    const { t, y } = stepResponse(closed, { duration: 8, points: 2000 })
    // Rising everywhere after the first instant, and rising FASTER at the
    // end than in the middle — the signature of growth without a limit, and
    // the opposite of settling against one.
    const slope = (i) => (y[i + 1] - y[i]) / (t[i + 1] - t[i])
    expect(slope(1000)).toBeGreaterThan(slope(500))
    expect(slope(1900)).toBeGreaterThan(slope(1000))
    // And it is far past the reference of 1 by the end, with nothing holding
    // it: 0.5 of loop gain against a pole at +1 leaves a mode at +0.5.
    expect(y[y.length - 1]).toBeGreaterThan(10)
    const { poles } = polesZeros(closed)
    expect(Math.max(...poles.map(([re]) => re))).toBeCloseTo(0.5, 9)
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
