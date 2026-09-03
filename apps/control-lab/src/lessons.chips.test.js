import { describe, it, expect } from 'vitest'
import {
  LESSONS,
  applyLesson,
  applyChip,
  activeChipOf,
  chipMatches,
  chipsFor,
  crossingGain,
  gainKeyOf,
  isDirty,
} from './lessons.js'
import { PLANTS, CONTROLLERS, buildLoop, defaultsOf } from './systems.js'
import { stickyDuration } from './stepAxis.js'
import { watchSignals, openingCursor, WATCH_OPEN_FRACTION } from './watch.js'
import { dcGain, isStable, magnitudeAt, margins, polesZeros, secondOrderMetrics, stepResponse } from '@ee-labs/systems'

// The try lines and their chips. A try line quotes numbers — "Kp → 12 and the
// gap shrinks to 7.7%" — and a chip claims to land on a state; both are the
// kind of prose that drifts when a default moves. So every number a try line
// prints is measured here off the loop the chip actually builds, and every
// chip is applied and checked to produce a loop the lesson can show.

const GRID = Float64Array.from({ length: 6000 }, (_, i) => Math.pow(10, -4 + 8 * (i / 5999)))
const byName = (n) => {
  const l = LESSONS.find((x) => x.name === n)
  if (!l) throw new Error(`no lesson "${n}"`)
  return l
}
const stateOf = (l) => {
  const s = applyLesson(l)
  return { plantId: s.plantId, plantP: s.plantP, ctrlId: s.ctrlId, ctrlP: s.ctrlP, stepInput: s.stepInput }
}
const loopOf = (s) => buildLoop(s.plantId, s.plantP, s.ctrlId, s.ctrlP)
const margOf = (s) => margins(loopOf(s).open, GRID)
const chipsOf = (l, s = stateOf(l)) => chipsFor(l, s, margOf(s))
/** The state after clicking the chip whose label starts with `prefix`. */
const click = (l, prefix, s = stateOf(l)) => {
  const chip = chipsOf(l, s).find((c) => c.label.startsWith(prefix))
  if (!chip) throw new Error(`${l.name}: no chip "${prefix}" among ${chipsOf(l, s).map((c) => c.label).join(' | ')}`)
  return applyChip(s, chip)
}
const peak = (tf, d) => Math.max(...stepResponse(tf, { duration: d, points: 4000 }).y)
const overshoot = (tf, d) => peak(tf, d) / dcGain(tf) - 1
const settle2pc = (tf, d) => {
  const { t, y } = stepResponse(tf, { duration: d, points: 4000 })
  const f = dcGain(tf)
  let i = y.length - 1
  while (i > 0 && Math.abs(y[i] - f) <= 0.02 * Math.abs(f)) i--
  return t[i]
}
const words = (text) => text.trim().split(/\s+/).length

describe('the shape of every lesson', () => {
  it('has a one-claim note, a try line with the verb, a featured knob, and chips', () => {
    for (const l of LESSONS) {
      expect(words(l.note), `${l.name}: note is ${words(l.note)} words`).toBeLessThanOrEqual(55)
      expect(l.try, `${l.name}: try`).toBeTruthy()
      expect(words(l.try), `${l.name}: try line`).toBeLessThanOrEqual(40)
      expect(l.featured?.length, `${l.name}: featured`).toBeGreaterThan(0)
      const chips = chipsOf(l)
      expect(chips.length, `${l.name}: chips`).toBeGreaterThan(0)
    }
  })

  it('every featured knob is a knob of the lesson\'s controller, or the step toggle', () => {
    for (const l of LESSONS) {
      const keys = CONTROLLERS[l.patch.ctrl].params.map((p) => p.key)
      for (const f of l.featured) {
        expect(f === 'disturbance' || keys.includes(f), `${l.name}: featured "${f}"`).toBe(true)
      }
    }
  })

  it('a try line that says to move Kp, Ki, Kd or the step features that knob', () => {
    for (const l of LESSONS) {
      if (/Kp\s*→/.test(l.try)) expect(l.featured, l.name).toContain('kp')
      if (/Ki\s*→/.test(l.try)) expect(l.featured, l.name).toContain('ki')
      if (/Kd\s*→/.test(l.try)) expect(l.featured, l.name).toContain('kd')
      if (/Disturbance/.test(l.try)) expect(l.featured, l.name).toContain('disturbance')
    }
  })

  it('every chip lands on a loop that can be analysed, and chips are unique', () => {
    for (const l of LESSONS) {
      const labels = chipsOf(l).map((c) => c.label)
      expect(new Set(labels).size, `${l.name}: duplicate chip labels`).toBe(labels.length)
      for (const c of chipsOf(l)) {
        const next = applyChip(stateOf(l), c)
        expect(CONTROLLERS[next.ctrlId], `${l.name} / ${c.label}`).toBeTruthy()
        for (const p of CONTROLLERS[next.ctrlId].params) {
          expect(Number.isFinite(next.ctrlP[p.key]), `${l.name} / ${c.label}: ${p.key}`).toBe(true)
          expect(next.ctrlP[p.key], `${l.name} / ${c.label}: ${p.key} in range`).toBeGreaterThanOrEqual(p.min)
          expect(next.ctrlP[p.key]).toBeLessThanOrEqual(p.max)
        }
        const { open } = loopOf(next)
        expect(open.a.length, `${l.name} / ${c.label}`).toBeGreaterThan(1)
        // A chip the state already satisfies is the one highlighted.
        expect(chipMatches(c, next), `${l.name} / ${c.label} matches its own result`).toBe(true)
      }
    }
  })
})

describe('the helpers behind the chips', () => {
  it('the active chip is the most specific one the state satisfies', () => {
    const l = byName('A shove at the plant input')
    const s = stateOf(l)
    // Loaded: P at Kp 9 — "back to P" already describes the state.
    expect(activeChipOf(chipsOf(l), s)).toBe('back to P')
    const pi = click(l, 'switch to PI')
    expect(activeChipOf(chipsOf(l), pi)).toBe('switch to PI')
    expect(activeChipOf(chipsOf(l), { ...pi, ctrlP: { ...pi.ctrlP, ki: 7 } })).toBeNull()
    // Two chips can match at once; the more specific one wins.
    const w = byName('Watch the integrator take over')
    const both = [{ label: 'a', set: { stepInput: 'ref' } }, { label: 'b', set: { stepInput: 'ref', ctrlP: { ki: 1 } } }]
    expect(activeChipOf(both, stateOf(w))).toBe('b')
  })

  it('dirty means the setup has left the lesson\'s, and comes back when it returns', () => {
    const l = byName('Proportional cannot get there')
    const s = stateOf(l)
    expect(isDirty(l, s)).toBe(false)
    expect(isDirty(l, { ...s, ctrlP: { kp: 12 } })).toBe(true)
    expect(isDirty(l, { ...s, ctrlP: { kp: 9 + 1e-12 } })).toBe(false)
    expect(isDirty(l, { ...s, stepInput: 'dist' })).toBe(true)
    expect(isDirty(l, { ...s, plantP: { ...s.plantP, tau: 2 } })).toBe(true)
    expect(isDirty(null, s)).toBe(false)
  })

  it('a chip that changes the controller starts from that controller\'s defaults', () => {
    const l = byName('The integrator closes the gap')
    const back = click(l, 'back to P')
    expect(back.ctrlId).toBe('p')
    expect(back.ctrlP).toEqual({ kp: 9 })
    const fromP = click(byName('A shove at the plant input'), 'switch to PI')
    expect(fromP.ctrlP).toEqual({ kp: 9, ki: 3 })
  })

  it('the crossing gain is the current gain times the gain margin, or null without one', () => {
    expect(gainKeyOf('p')).toBe('kp')
    expect(gainKeyOf('lead')).toBe('k')
    const motor = stateOf(byName('A margin thin enough to feel'))
    expect(crossingGain(motor.ctrlId, motor.ctrlP, margOf(motor))).toBeNull()
    const three = stateOf(byName('Watch the poles cross'))
    const x = crossingGain(three.ctrlId, three.ctrlP, margOf(three))
    expect(x.key).toBe('kp')
    expect(x.now).toBe(4)
    expect(x.crossing).toBeCloseTo(4 * margOf(three).gainMargin, 12)
  })
})

describe('what each try line and chip claims, measured', () => {
  it('Proportional cannot get there: 7.7% at Kp 12, 67% at Kp 0.5', () => {
    const l = byName('Proportional cannot get there')
    expect(1 - dcGain(loopOf(click(l, 'Kp → 12')).closed)).toBeCloseTo(0.077, 3)
    expect(1 - dcGain(loopOf(click(l, 'Kp → 0.5')).closed)).toBeCloseTo(0.667, 3)
    expect(dcGain(loopOf(click(l, 'Kp → 9')).closed)).toBeCloseTo(0.9, 9)
  })

  it('The integrator closes the gap: 30 s at Ki 0.2, 23% at Ki 5, exactly 1 both times; P brings the 10% back', () => {
    const l = byName('The integrator closes the gap')
    const slow = loopOf(click(l, 'Ki → 0.2')).closed
    expect(dcGain(slow)).toBeCloseTo(1, 12)
    expect(settle2pc(slow, 80)).toBeCloseTo(30, 0)
    const fast = loopOf(click(l, 'Ki → 5')).closed
    expect(dcGain(fast)).toBeCloseTo(1, 12)
    expect(Math.round(overshoot(fast, 80) * 100)).toBe(23)
    expect(dcGain(loopOf(click(l, 'back to P')).closed)).toBeCloseTo(0.9, 9)
  })

  it('Watch the integrator: the cursor opens with both terms visibly at work', () => {
    const l = byName('Watch the integrator take over')
    const s = stateOf(l)
    const loop = loopOf(s)
    // The app's own window: 12 over the slowest closed pole, on the ladder.
    const pz = polesZeros(loop.closed)
    const slow = Math.min(...pz.poles.filter(([re]) => Math.abs(re) > 1e-9).map(([re]) => Math.abs(re)))
    const duration = stickyDuration(NaN, Math.min(12 / slow, 400))
    expect(duration).toBe(15)
    const N = 600
    const w = watchSignals(loop, s.ctrlId, s.ctrlP, 'ref', { duration, points: N })
    const i = openingCursor(N)
    expect(i).toBe(Math.round(WATCH_OPEN_FRACTION * (N - 1)))
    const p = w.parts.find((x) => x.key === 'p').y[i]
    const int = w.parts.find((x) => x.key === 'i').y[i]
    // "Both parts still working": each visibly nonzero, neither finished.
    expect(Math.abs(p), 'Kp·e at the opening cursor').toBeGreaterThan(0.05)
    expect(Math.abs(int), 'Ki·∫e at the opening cursor').toBeGreaterThan(0.05)
    expect(int).toBeLessThan(0.95)
    // And why 0.15 rather than 0.2: at 20% Kp·e has already fallen under 0.05.
    const at20 = w.parts.find((x) => x.key === 'p').y[Math.round(0.2 * (N - 1))]
    expect(Math.abs(at20)).toBeLessThan(0.05)
    // The featured toggle lands on the shove, whose memory winds to −1.
    expect(l.featured).toContain('disturbance')
    const wd = watchSignals(loop, s.ctrlId, s.ctrlP, 'dist', { duration: 60, points: 1200 })
    expect(wd.u[wd.u.length - 1]).toBeCloseTo(-1, 2)
    // The Ki chips: "slow handoff" and "quick handoff" measured as the moment
    // Ki·∫e overtakes Kp·e — later at Ki 0.3, sooner at Ki 3.
    const overtake = (st) => {
      const lp = loopOf(st)
      const ws = watchSignals(lp, st.ctrlId, st.ctrlP, 'ref', { duration: 30, points: 3000 })
      const P = ws.parts.find((x) => x.key === 'p').y
      const I = ws.parts.find((x) => x.key === 'i').y
      const k = P.findIndex((v, j) => I[j] > v)
      return ws.t[k]
    }
    const tSlow = overtake(click(l, 'Ki → 0.3'))
    const tMid = overtake(click(l, 'Ki → 1'))
    const tQuick = overtake(click(l, 'Ki → 3'))
    expect(tSlow).toBeGreaterThan(tMid)
    expect(tMid).toBeGreaterThan(tQuick)
    for (const st of [click(l, 'Ki → 0.3'), click(l, 'Ki → 3')]) expect(isStable(loopOf(st).closed)).toBe(true)
  })

  it('A shove at the plant input: 0.1 under P, erased under the PI chip', () => {
    const l = byName('A shove at the plant input')
    const s = stateOf(l)
    expect(s.stepInput).toBe('dist')
    const { open, disturbance } = loopOf(s)
    // P(0)/(1+L(0)) — the number the note prints.
    expect(dcGain(disturbance)).toBeCloseTo(dcGain(loopOf(s).plant) / (1 + dcGain(open)), 12)
    expect(dcGain(disturbance)).toBeCloseTo(0.1, 12)
    const pi = click(l, 'switch to PI')
    expect(pi.ctrlId).toBe('pi')
    expect(pi.stepInput).toBe('dist')
    const piLoop = loopOf(pi)
    expect(isStable(piLoop.closed), 'the PI chip must land on a stable loop').toBe(true)
    expect(Math.abs(dcGain(piLoop.disturbance))).toBeLessThan(1e-12)
    expect(dcGain(loopOf(click(l, 'back to P')).disturbance)).toBeCloseTo(0.1, 12)
  })

  it('...and what it costs: 19° under PI, 52° under P at the same Kp', () => {
    const l = byName('...and what it costs')
    expect(margOf(stateOf(l)).phaseMargin).toBeCloseTo(19, 0)
    const p = click(l, 'Proportional')
    expect(p.ctrlP.kp).toBe(2)
    expect(margOf(p).phaseMargin).toBeCloseTo(52, 0)
    const back = click(l, 'PI', p)
    expect(margOf(back).phaseMargin).toBeCloseTo(19, 0)
  })

  it('Turn it up until it sings: 42% at 4, 71% at 8, divergent at 12, boundary at 11.25', () => {
    const l = byName('Turn it up until it sings')
    const s = stateOf(l)
    expect(Math.round(overshoot(loopOf(s).closed, 40) * 100)).toBe(42)
    expect(Math.round(overshoot(loopOf(click(l, 'Kp → 8')).closed, 40) * 100)).toBe(71)
    const sluggish = loopOf(click(l, 'Kp → 0.5')).closed
    expect(isStable(sluggish)).toBe(true)
    expect(overshoot(sluggish, 40)).toBeLessThan(0.03)
    expect(isStable(loopOf(click(l, 'Kp → 12')).closed)).toBe(false)
    expect(crossingGain(s.ctrlId, s.ctrlP, margOf(s)).crossing).toBeCloseTo(11.25, 6)
  })

  it('The margin says exactly how far: the 0.9× and 1.1× chips read the live margin', () => {
    const l = byName('The margin says exactly how far')
    const s = stateOf(l)
    const chips = chipsOf(l)
    const inside = chips.find((c) => c.label.startsWith('0.9 × GM'))
    const past = chips.find((c) => c.label.startsWith('1.1 × GM'))
    expect(inside && past).toBeTruthy()
    const gm = margOf(s).gainMargin
    expect(inside.set.ctrlP.kp).toBeCloseTo(0.9 * gm, 9)
    expect(past.set.ctrlP.kp).toBeCloseTo(1.1 * gm, 9)
    expect(isStable(loopOf(applyChip(s, inside)).closed)).toBe(true)
    expect(isStable(loopOf(applyChip(s, past)).closed)).toBe(false)
    // From wherever Kp is: re-read at the new gain, the chips still bracket.
    const moved = applyChip(s, inside)
    const again = chipsOf(l, moved)
    expect(isStable(loopOf(applyChip(moved, again.find((c) => c.label.startsWith('0.9')))).closed)).toBe(true)
    expect(isStable(loopOf(applyChip(moved, again.find((c) => c.label.startsWith('1.1')))).closed)).toBe(false)
    // The label carries the gain it sets, so the chip says where it goes.
    expect(inside.label).toMatch(/Kp 10\.1/)
  })

  it('Watch the poles cross: the crossing chip puts the poles ON the axis, and the verdict flips there', () => {
    const l = byName('Watch the poles cross')
    const s = stateOf(l)
    const x = crossingGain(s.ctrlId, s.ctrlP, margOf(s))
    expect(x.crossing).toBeCloseTo(11.25, 6)
    // Bisect the verdict independently of the margin: same number.
    let lo = 1
    let hi = 40
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2
      if (isStable(buildLoop(s.plantId, s.plantP, 'p', { kp: mid }).closed)) lo = mid
      else hi = mid
    }
    expect(lo).toBeCloseTo(x.crossing, 6)
    // At the crossing gain a pole pair sits on the imaginary axis.
    const at = click(l, 'Kp → 11.25')
    const poles = polesZeros(loopOf(at).closed).poles
    const nearest = Math.min(...poles.map(([re]) => Math.abs(re)))
    expect(nearest).toBeLessThan(1e-6)
    expect(isStable(loopOf(click(l, 'Kp → 15')).closed)).toBe(false)
    expect(isStable(loopOf(click(l, 'Kp → 4')).closed)).toBe(true)
  })

  it('Everything is about one point: at the crossing chip the curve passes through −1', () => {
    const l = byName('Everything is about one point')
    const s = stateOf(l)
    const m = margOf(s)
    const at = click(l, 'Kp → 11.25')
    expect(magnitudeAt(loopOf(at).open, m.phaseCrossover)).toBeCloseTo(1, 6)
    const wide = click(l, 'Kp → 2')
    expect(magnitudeAt(loopOf(wide).open, m.phaseCrossover)).toBeLessThan(0.2)
  })

  it('A margin thin enough to feel: 13° and 70% at Kp 40, 52° and 16% at Kp 2', () => {
    const l = byName('A margin thin enough to feel')
    const over = (s) => {
      const c = loopOf(s).closed
      const m = secondOrderMetrics(c)
      return overshoot(c, 30 / (m.zeta * m.wn))
    }
    const hot = click(l, 'Kp → 40')
    expect(margOf(hot).phaseMargin).toBeCloseTo(13, 0)
    expect(Math.round(over(hot) * 100)).toBe(70)
    const cool = click(l, 'Kp → 2')
    expect(margOf(cool).phaseMargin).toBeCloseTo(52, 0)
    expect(Math.round(over(cool) * 100)).toBe(16)
  })

  it('The plant that needs feedback: latches at Kp 0.5, sits at 1.25 and 1.05', () => {
    const l = byName('The plant that needs feedback')
    expect(isStable(loopOf(click(l, 'Kp → 0.5')).closed)).toBe(false)
    expect(dcGain(loopOf(click(l, 'Kp → 5')).closed)).toBeCloseTo(1.25, 9)
    expect(dcGain(loopOf(click(l, 'Kp → 20')).closed)).toBeCloseTo(1.05, 2)
    expect(isStable(loopOf(click(l, 'Kp → 20')).closed)).toBe(true)
  })

  it('Derivative buys the phase back: 12° and 23% at the floor, 90° and none at Kd 1', () => {
    const l = byName('Derivative buys the phase back')
    const floor = click(l, 'Kd → 0.0001')
    expect(floor.ctrlP.kd).toBe(CONTROLLERS.pid.params.find((p) => p.key === 'kd').min)
    expect(margOf(floor).phaseMargin).toBeCloseTo(12, 0)
    expect(Math.round(overshoot(loopOf(floor).closed, 20) * 100)).toBe(23)
    const high = click(l, 'Kd → 1')
    expect(margOf(high).phaseMargin).toBeCloseTo(90, 0)
    expect(overshoot(loopOf(high).closed, 20)).toBeLessThan(0.005)
  })

  it('Lead does it without the noise: 64° with the lead, 54° without; the derivative keeps rising, the lead does not', () => {
    const l = byName('Lead does it without the noise')
    const s = stateOf(l)
    expect(margOf(s).phaseMargin).toBeCloseTo(64, 0)
    const bare = click(l, 'Proportional')
    expect(bare.ctrlId).toBe('p')
    expect(bare.ctrlP.kp).toBe(s.ctrlP.k)
    expect(margOf(bare).phaseMargin).toBeCloseTo(54, 0)
    // "Without the noise", measured: two decades up, a PID's |C| has grown a
    // hundredfold while the lead's has stopped growing at all.
    const pid = CONTROLLERS.pid.tf(applyLesson(byName('Derivative buys the phase back')).ctrlP)
    expect(magnitudeAt(pid, 1e8) / magnitudeAt(pid, 1e6)).toBeGreaterThan(10)
    const lead = CONTROLLERS.lead.tf(s.ctrlP)
    expect(magnitudeAt(lead, 1e8) / magnitudeAt(lead, 1e6)).toBeCloseTo(1, 3)
    // The ghost is K·P: same |L| far below the zero, where the lead is just K.
    const { plant } = loopOf(s)
    const fLow = 1e-4
    expect(magnitudeAt(loopOf(s).open, fLow) / (s.ctrlP.k * magnitudeAt(plant, fLow))).toBeCloseTo(1, 3)
  })
})

describe('the plants stay a toolbox, not a course', () => {
  it('still seven plants and four controllers, thirteen lessons', () => {
    expect(Object.keys(PLANTS).length).toBe(7)
    expect(Object.keys(CONTROLLERS).length).toBe(4)
    expect(LESSONS.length).toBe(13)
    expect(defaultsOf(PLANTS.motor)).toEqual({ k: 1, tau: 0.5 })
  })
})
