// The piecewise-linear layer, measured.
//
// Every claim the diode lessons will make is checked here against the solver
// rather than against the formula it came from: the conduction angle is
// counted from the event times the walk actually found, the ripple is read off
// the exact waveform and only then compared with the textbook approximation,
// and Newton's convergence is measured as the ratio it is supposed to have.

import { describe, expect, it } from 'vitest'
import { NetworkError } from './netlist.js'
import { decadeSlope, diodeOf, regionMargins, shockley, smallSignalR, thermalVoltage, VT } from './diode.js'
import { assumedState, conduction, newtonDC, pnjlim, pwlTransient, solvePWL, vcritOf } from './pwl.js'
import { energies, meanRms } from './transient.js'
import { crossings } from './transient.js'

const near = (a, b, rel = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(Math.abs(a), Math.abs(b), 1e-12))

/** Source — resistor — diode to ground: the circuit I1 and I2 are about. */
const series = (diode, { vs = 5, R = 1000 } = {}) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: vs },
    { type: 'R', id: 'R1', nodes: ['in', 'a'], value: R },
    { type: 'D', id: 'D1', nodes: ['a', 'gnd'], ...diode },
  ],
})

describe('the diode as four models', () => {
  it('the thermal voltage is kT/q — 25.852 mV at 300 K, not a number typed into a lesson', () => {
    near(VT, 0.025852, 1e-5)
    near(thermalVoltage(300), VT)
    // It is proportional to temperature: twice the kelvins, twice the volts.
    near(thermalVoltage(600), 2 * VT)
  })

  it('each model is the next one approximated: ideal, drop and V_f + r_d bracket the exponential', () => {
    const i = {}
    for (const model of ['ideal', 'drop', 'pwl']) i[model] = solvePWL(series({ model })).sol.i.D1
    const exp = newtonDC(series({ model: 'exp' })).sol.i.D1
    // The ideal switch passes the most (no drop at all), the constant drop the
    // least of the three; the exponential sits between drop and ideal.
    expect(i.ideal).toBeGreaterThan(exp)
    expect(i.drop).toBeLessThan(exp)
    expect(i.pwl).toBeLessThan(exp)
    // And each is within a few per cent of the truth on this circuit.
    expect(Math.abs(i.drop - exp) / exp).toBeLessThan(0.02)
    expect(Math.abs(i.ideal - exp) / exp).toBeLessThan(0.2)
  })

  it('the 60 mV/decade rule is the curve’s own slope: ten times the current costs nV_T ln 10 more volts', () => {
    const d = diodeOf({ id: 'D1', type: 'D', model: 'exp' })
    const vAt = (i) => d.n * d.vt * Math.log(i / d.is + 1)
    const step = vAt(1e-3) - vAt(1e-4)
    near(step, decadeSlope({ id: 'D1', type: 'D', model: 'exp' }), 1e-6)
    near(step, 0.05953, 1e-3) // the 60 mV every datasheet rounds to
  })

  it('r_d = nV_T/I is the exponential’s derivative at the operating point, and the PWL model fitted there has that slope', () => {
    const nw = newtonDC(series({ model: 'exp' }))
    const I = nw.sol.i.D1
    const v = nw.sol.volt.D1
    const d = diodeOf({ id: 'D1', type: 'D', model: 'exp' })
    // The analytic derivative, and the fitted small-signal resistance.
    near(1 / shockley(d, v).g, smallSignalR({ id: 'D1', type: 'D', model: 'exp' }, I), 1e-9)
    // A difference quotient on the curve itself — an independent path.
    const h = 1e-7
    const numeric = (shockley(d, v + h).i - shockley(d, v - h).i) / (2 * h)
    near(numeric, shockley(d, v).g, 1e-6)
    // The PWL model with that r_d, fitted at the point, reproduces the current.
    const fitted = solvePWL(series({ model: 'pwl', vf: v - I * (1 / shockley(d, v).g), rd: 1 / shockley(d, v).g }))
    near(fitted.sol.i.D1, I, 1e-9)
  })
})

describe('assume, solve, check', () => {
  it('a diode the wrong way round blocks: no current, and the assumption that it conducts contradicts itself', () => {
    const r = solvePWL(series({ model: 'drop' }, { vs: -5 }))
    expect(r.regions.D1).toBe('off')
    expect(r.sol.i.D1).toBe(0)
    const on = r.tried.find((t) => t.regions.D1 === 'on')
    expect(on.ok).toBe(false)
    expect(on.why).toMatch(/i_D1 ≥ 0 fails/)
  })

  it('I3: two diodes give four assumed states, three of which reject themselves, and the survivor matches the exponential solve', () => {
    // A 5 V source through 1 kΩ into D1 (forward) with D2 across the load the
    // other way round: D1 must conduct, D2 must not.
    const two = (model) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 5 },
        { type: 'R', id: 'R1', nodes: ['in', 'a'], value: 1000 },
        { type: 'D', id: 'D1', nodes: ['a', 'b'], model, vf: 0.7 },
        { type: 'R', id: 'R2', nodes: ['b', 'gnd'], value: 1000 },
        { type: 'D', id: 'D2', nodes: ['gnd', 'b'], model, vf: 0.7 },
      ],
    })
    const { consistent, tried } = assumedState(two('drop'))
    expect(tried).toHaveLength(4)
    expect(consistent).toHaveLength(1)
    expect(consistent[0].regions).toEqual({ D1: 'on', D2: 'off' })
    // Each rejection carries the contradiction that killed it, in the reader's terms.
    for (const row of tried.filter((t) => !t.ok)) expect(row.why).toBeTruthy()
    expect(tried.find((t) => t.regions.D1 === 'off' && t.regions.D2 === 'off').why).toMatch(/v_D1 ≤ V_f fails/)
    // And the answer agrees with the curve it approximates, to the model's own error.
    const exact = newtonDC(two('exp')).sol
    expect(Math.abs(consistent[0].sol.v.b - exact.v.b) / exact.v.b).toBeLessThan(0.02)
  })

  it('every solve reports KCL closing at every node, region solves included', () => {
    for (const model of ['ideal', 'drop', 'pwl']) {
      const r = solvePWL(series({ model }))
      expect(r.sol.maxResidual).toBeLessThan(1e-15)
    }
  })
})

describe('Newton’s method, watched', () => {
  it('converges quadratically in a handful of iterations, and lands where KVL closes', () => {
    const nw = newtonDC(series({ model: 'exp' }))
    expect(nw.converged).toBe(true)
    expect(nw.iters.length).toBeLessThanOrEqual(8)
    // Quadratic, with the constant the curve itself sets: for an exponential
    // Newton's error obeys e_{k+1} ≈ e_k²·f″/2f′ = e_k²/(2nV_T), and the last
    // few steps of a real solve reproduce that number.
    const steps = nw.iters.map((i) => i.step).filter((s) => s > 0)
    const ratios = steps.slice(1).map((s, k) => s / (steps[k] * steps[k]))
    const C = 1 / (2 * VT)
    for (const r of ratios.slice(-3)) {
      expect(r).toBeGreaterThan(C / 2)
      expect(r).toBeLessThan(C * 2)
    }
    // KVL around the loop, from the answer itself.
    const { sol } = nw
    expect(Math.abs(sol.v.in - sol.volt.R1 - sol.volt.D1)).toBeLessThan(1e-12)
    expect(sol.maxResidual).toBeLessThan(1e-15)
    // And the current really is Shockley's at that voltage.
    const d = diodeOf({ id: 'D1', type: 'D', model: 'exp' })
    near(sol.i.D1, shockley(d, sol.volt.D1).i, 1e-9)
  })

  it('the constant-drop model’s error against the exponential is the number I2 quotes: 0.70 V assumed, 0.69 V true', () => {
    const exact = newtonDC(series({ model: 'exp' })).sol.volt.D1
    expect(exact).toBeGreaterThan(0.68)
    expect(exact).toBeLessThan(0.70)
    const drop = solvePWL(series({ model: 'drop' })).sol
    near(drop.volt.D1, 0.7, 1e-12)
    expect(Math.abs(0.7 - exact)).toBeLessThan(0.02)
  })

  it('the limiter damps a wild step and leaves a small one alone', () => {
    const d = diodeOf({ id: 'D1', type: 'D', model: 'exp' })
    const vt = d.n * d.vt
    const vcrit = vcritOf(d)
    // A step of a hundred volts is taken in the log instead.
    const limited = pnjlim(100, 0.6, vt, vcrit)
    expect(limited).toBeLessThan(1)
    expect(limited).toBeGreaterThan(0.6)
    // A millivolt step passes through untouched.
    near(pnjlim(0.601, 0.6, vt, vcrit), 0.601)
  })

  it('refuses the exponential diode in time, and says why', () => {
    const net = {
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'sine', amp: 5, freq: 50 } },
        { type: 'D', id: 'D1', nodes: ['in', 'out'], model: 'exp' },
        { type: 'R', id: 'R1', nodes: ['out', 'gnd'], value: 1000 },
        { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: 1e-6 },
      ],
    }
    let err
    try {
      pwlTransient(net, { tEnd: 0.02 })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(NetworkError)
    expect(err.code).toBe('exp-diode')
    expect(err.message).toMatch(/no closed-form response in time/)
    expect(err.message).toMatch(/ideal, constant-drop or V_f \+ r_d/)
  })
})

// ------------------------------------------------------------ in time

const rectifier = (diode = { model: 'ideal' }, { amp = 10, freq = 50, R = 1000, extra = [] } = {}) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'sine', amp, freq } },
    { type: 'D', id: 'D1', nodes: ['in', 'out'], ...diode },
    { type: 'R', id: 'R1', nodes: ['out', 'gnd'], value: R },
    ...extra,
  ],
})

describe('the half-wave rectifier, on the exact waveform', () => {
  it('ideal: mean V_p/π and RMS V_p/2, measured by integrating the solution the walk produced', () => {
    const w = pwlTransient(rectifier(), { tEnd: 0.04, points: 801 })
    const { mean, rms } = meanRms(w, (sol) => sol.v.out, 0, 0.04)
    near(mean, 10 / Math.PI, 1e-6)
    near(rms, 10 / 2, 1e-6)
  })

  it('constant drop: it peaks at V_p − V_f and conducts for π − 2·asin(V_f/V_p) of every cycle', () => {
    const w = pwlTransient(rectifier({ model: 'drop', vf: 0.7 }), { tEnd: 0.04, points: 801 })
    const vout = w.series('v', 'out')
    near(Math.max(...vout), 9.3, 1e-6)
    expect(Math.min(...vout)).toBe(0)
    // Two cycles, so two conduction windows; the angle is per cycle.
    const c = conduction(w, 2 * Math.PI * 50)
    expect(c.D1.spans).toHaveLength(2)
    near(c.D1.angle / 2, ((Math.PI - 2 * Math.asin(0.7 / 10)) * 180) / Math.PI, 1e-6)
  })

  it('the events are where the guards say they are: the diode turns on as the source passes V_f', () => {
    const w = pwlTransient(rectifier({ model: 'drop', vf: 0.7 }), { tEnd: 0.04, points: 801 })
    const on = w.events.filter((e) => e.to === 'on')
    expect(on.length).toBeGreaterThanOrEqual(2)
    for (const e of on) {
      const vin = w.at(e.t).sol.v.in
      near(vin, 0.7, 1e-6)
    }
    for (const e of w.events.filter((e) => e.to === 'off')) near(w.at(e.t).sol.i.D1, 0, 1e-9)
  })

  it('no diode in the netlist: the walk is the ordinary transient, unchanged', () => {
    const rc = {
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'step', from: 0, to: 5 } },
        { type: 'R', id: 'R1', nodes: ['in', 'out'], value: 1000 },
        { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: 1e-6 },
      ],
    }
    const w = pwlTransient(rc, { tEnd: 0.005, points: 201 })
    expect(w.events).toEqual([])
    // 1 − e⁻¹ of the way there after one τ.
    near(w.at(1e-3).sol.v.out, 5 * (1 - Math.exp(-1)), 1e-9)
  })
})

describe('the bridge doubles the ripple frequency', () => {
  // Four diodes across a floating source: the classic bridge, with the load
  // between the two mid-nodes' rails.
  const bridge = (vf) => ({
    elements: [
      { type: 'V', id: 'V1', nodes: ['a', 'b'], value: 0, wave: { kind: 'sine', amp: 10, freq: 50 } },
      { type: 'D', id: 'D1', nodes: ['a', 'p'], model: 'drop', vf },
      { type: 'D', id: 'D2', nodes: ['b', 'p'], model: 'drop', vf },
      { type: 'D', id: 'D3', nodes: ['gnd', 'a'], model: 'drop', vf },
      { type: 'D', id: 'D4', nodes: ['gnd', 'b'], model: 'drop', vf },
      { type: 'R', id: 'RL', nodes: ['p', 'gnd'], value: 1000 },
    ],
  })

  it('ideal-ish (V_f = 0): |sin| — mean 2V_p/π, RMS V_p/√2, and twice as many humps as the source has cycles', () => {
    const w = pwlTransient(bridge(0), { tEnd: 0.04, points: 1201 })
    const { mean, rms } = meanRms(w, (sol) => sol.v.p, 0, 0.04)
    near(mean, (2 * 10) / Math.PI, 1e-4)
    near(rms, 10 / Math.SQRT2, 1e-4)
    // The output touches zero four times in two cycles of a 50 Hz drive: the
    // first line of its spectrum is at 100 Hz, not 50.
    const zeros = crossings(w.t, w.series('v', 'p'), (t) => w.at(t).sol.v.p - 1e-9, 1e-9)
    expect(zeros.length).toBeGreaterThanOrEqual(3)
  })

  it('two drops in the path, not one: the peak is V_p − 2V_f', () => {
    const w = pwlTransient(bridge(0.7), { tEnd: 0.04, points: 1201 })
    near(Math.max(...w.series('v', 'p')), 10 - 1.4, 1e-6)
  })

  it('every half-cycle rectifies, not just the first: the mean over two cycles is the closed form', () => {
    // Real diodes leak, and with a leak the two diodes of a conducting pair no
    // longer reach their thresholds at exactly the same instant. The one that
    // arrives second starts its run already a rounding error past its own
    // boundary — no crossing to find inside the run — and if that counts as a
    // violation that never happens, the pair never completes, the bridge goes
    // dead after its first cycle and the mean comes out at half. It is a
    // silent failure: the peak is still right, and only an average over more
    // than one cycle sees it.
    const leaky = { ...bridge(0.7) }
    leaky.elements = leaky.elements.map((e) => (e.type === 'D' ? { ...e, roff: 1e7 } : e))
    const w = pwlTransient(leaky, { tEnd: 0.04, points: 601 })
    const { mean } = meanRms(w, (sol) => sol.v.p, 0, 0.04)
    // Mean of (V_p·sin φ − 2V_f) over the conduction window of each half cycle.
    const phi = Math.asin(1.4 / 10)
    const theory = (2 * 10 * Math.cos(phi) - 1.4 * (Math.PI - 2 * phi)) / Math.PI
    expect(Math.abs(mean - theory) / theory).toBeLessThan(2e-3)
    // Both diagonals do the same work, every cycle — to within the half per
    // cent the leak itself costs: the pair does not stop conducting in the
    // same instant, because the one still on has the leak to carry.
    const c = conduction(w)
    for (const id of ["D1", "D2", "D3", "D4"]) near(c[id].fraction, c.D1.fraction, 0.02)
    expect(c.D1.spans).toHaveLength(2)
  })
})

describe('smoothing, exactly and approximately', () => {
  // A real supply has some resistance in front of the capacitor — the winding,
  // the diode's own slope. With none at all an ideal diode reaching a
  // capacitor is a loop of voltage sources and the current at the instant it
  // conducts is unbounded; the solver refuses that circuit by name (below), so
  // the smoothing experiments carry a source resistance, as the bench does.
  const peak = (C, R = 1000, rs = 5) => {
    // Long enough to be in the steady state: six time constants, and never
    // less than five cycles of the drive.
    const tEnd = Math.max(0.1, 6 * R * C)
    return pwlTransient(
      {
        elements: [
          { type: 'V', id: 'V1', nodes: ['s', 'gnd'], value: 0, wave: { kind: 'sine', amp: 10, freq: 50 } },
          { type: 'R', id: 'RS', nodes: ['s', 'in'], value: rs },
          { type: 'D', id: 'D1', nodes: ['in', 'out'], model: 'ideal' },
          { type: 'R', id: 'R1', nodes: ['out', 'gnd'], value: R },
          { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: C },
        ],
      },
      { tEnd, points: Math.max(801, Math.round(tEnd * 2000)) },
    )
  }

  /** The ripple in the last two cycles — the steady state, not the first charge-up. */
  const ripple = (w) => {
    const late = w.samples.filter((s) => s.t > w.tEnd - 0.04).map((s) => s.sol.v.out)
    return { pp: Math.max(...late) - Math.min(...late), top: Math.max(...late) }
  }

  it('an ideal diode straight from an ideal source into a capacitor is refused, by name', () => {
    let err
    try {
      pwlTransient(rectifier({ model: 'ideal' }, { extra: [{ type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: 47e-6 }] }), {
        tEnd: 0.02,
        points: 401,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(NetworkError)
    expect(err.code).toBe('no-state')
    // The reason a reader needs is the loop, not "nothing fits".
    expect(err.message).toMatch(/in a loop with other voltage sources/)
  })

  it('the capacitor charges to the peak and decays through R until the next peak catches it', () => {
    const w = peak(100e-6)
    const late = w.samples.filter((s) => s.t > 0.1)
    const vs = late.map((s) => s.sol.v.out)
    expect(Math.max(...vs)).toBeLessThanOrEqual(10 + 1e-9)
    expect(Math.min(...vs)).toBeGreaterThan(5)
    // It conducts only in short bursts near each peak — that is what makes the
    // ripple small and the diode's current spiky.
    expect(conduction(w).D1.fraction).toBeLessThan(0.3)
  })

  it('the textbook ripple V_p/(fRC) always reads high, and its error shrinks with RC but stops at about a fifth', () => {
    const errs = []
    for (const C of [22e-6, 47e-6, 100e-6, 220e-6]) {
      const w = peak(C)
      const { pp } = ripple(w)
      const approx = 10 / (50 * 1000 * C)
      // It overestimates every time: it lets the capacitor discharge for the
      // whole period, when in truth the diode tops it up for part of it.
      expect(approx).toBeGreaterThan(pp)
      errs.push((approx - pp) / pp)
    }
    // Monotone better — and levelling off, not going to zero. That plateau is
    // the guard the note has to carry: it is the conduction window the formula
    // ignores, and no amount of capacitance makes it go away.
    for (let k = 1; k < errs.length; k++) expect(errs[k]).toBeLessThan(errs[k - 1])
    expect(errs[0]).toBeGreaterThan(0.5)
    expect(errs[errs.length - 1]).toBeGreaterThan(0.15)
    expect(errs[errs.length - 1]).toBeLessThan(0.25)
  })

  it('two refinements close it: discharging only while the diode is off halves the error, and doing it exponentially lands within 1 %', () => {
    for (const C of [47e-6, 100e-6, 220e-6]) {
      const w = peak(C)
      const { pp, top } = ripple(w)
      const RC = 1000 * C
      const tOff = 0.02 * (1 - conduction(w).D1.fraction)
      const simple = Math.abs(10 / (50 * 1000 * C) - pp) / pp
      // Same straight-line discharge, but only for the part of the cycle the
      // diode is not conducting.
      const offOnly = Math.abs((10 * tOff) / RC - pp) / pp
      // And the discharge is an exponential, not a straight line.
      const exponential = Math.abs(top * (1 - Math.exp(-tOff / RC)) - pp) / pp
      expect(offOnly).toBeLessThan(simple / 2)
      expect(exponential).toBeLessThan(0.02)
    }
  })

  it('energy still closes with a diode in the loop: supplied = stored + dissipated', () => {
    const w = peak(47e-6)
    const e = energies(w)
    const last = e.points[e.points.length - 1]
    expect(Math.abs(last.gap)).toBeLessThan(1e-6 * Math.abs(last.supplied))
  })

  it('every state is continuous across every event — the invariant the walk is built on', () => {
    const w = peak(47e-6)
    expect(w.events.length).toBeGreaterThan(2)
    for (const ev of w.events) {
      const before = w.at(ev.t, 'left').x
      const after = w.at(ev.t, 'right').x
      before.forEach((x, k) => near(x, after[k], 1e-9))
    }
  })
})

describe('clipping and clamping', () => {
  it('a diode above a reference clips at V_ref + V_f, and leaves everything below it alone', () => {
    const net = rectifier({ model: 'drop', vf: 0.7 }, { amp: 10, R: 1000 })
    // Rebuild as a clipper: source through R, diode from the node to a 3 V rail.
    const clip = {
      elements: [
        net.elements[0],
        { type: 'R', id: 'R1', nodes: ['in', 'out'], value: 1000 },
        { type: 'D', id: 'D1', nodes: ['out', 'ref'], model: 'drop', vf: 0.7 },
        { type: 'V', id: 'V2', nodes: ['ref', 'gnd'], value: 3 },
        { type: 'R', id: 'R2', nodes: ['out', 'gnd'], value: 1e6 },
      ],
    }
    const w = pwlTransient(clip, { tEnd: 0.04, points: 801 })
    const vout = w.series('v', 'out')
    // Clipped above at 3.7 V; the negative half is untouched, so it still
    // reaches very nearly −10 V.
    expect(Math.max(...vout)).toBeLessThan(3.7 + 1e-6)
    expect(Math.max(...vout)).toBeGreaterThan(3.6)
    expect(Math.min(...vout)).toBeLessThan(-9.9)
  })
})

describe('the op-amp against its rails', () => {
  // E9: a comparator with the output fed back to the + input — a Schmitt trigger.
  const schmitt = (R1, R2, vsat = 12) => ({
    elements: [
      { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'sine', amp: 5, freq: 50 } },
      { type: 'OPAMP', id: 'A1', nodes: ['out'], ctrl: ['p', 'in'], vsat },
      { type: 'R', id: 'R1', nodes: ['p', 'gnd'], value: R1 },
      { type: 'R', id: 'R2', nodes: ['out', 'p'], value: R2 },
    ],
  })

  it('the thresholds are ±V_sat·R₁/(R₁ + R₂), measured at the instants it actually flips', () => {
    const w = pwlTransient(schmitt(10e3, 90e3), { tEnd: 0.04, points: 1601, start: { A1: 'high' } })
    const trip = (12 * 10) / 100
    expect(w.events.length).toBeGreaterThanOrEqual(3)
    for (const ev of w.events) {
      const vin = w.at(ev.t).sol.v.in
      near(Math.abs(vin), trip, 1e-6)
      // Rising input trips it one way, falling the other.
      expect(Math.sign(vin) === (ev.to === 'low' ? 1 : -1)).toBe(true)
    }
  })

  it('one transition per crossing: the output is at a rail throughout, never between them', () => {
    const w = pwlTransient(schmitt(10e3, 90e3), { tEnd: 0.04, points: 1601, start: { A1: 'high' } })
    for (const s of w.samples) expect(Math.abs(Math.abs(s.sol.v.out) - 12)).toBeLessThan(1e-9)
    // A 5 V sine crosses both ±1.2 V thresholds twice per cycle: four flips in two cycles.
    expect(w.events).toHaveLength(4)
  })

  it('left to find its own start it takes a rail, not the linear state balanced between them', () => {
    const w = pwlTransient(schmitt(10e3, 90e3), { tEnd: 0.04, points: 801 })
    expect(['high', 'low']).toContain(w.runs[0].regions.A1)
    near(Math.abs(w.at(0).sol.v.out), 12, 1e-12)
  })

  it('as a DC question it has no single answer, and the refusal says why: three states are consistent at once', () => {
    const dc = {
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0 },
        { type: 'OPAMP', id: 'A1', nodes: ['out'], ctrl: ['p', 'in'], vsat: 12 },
        { type: 'R', id: 'R1', nodes: ['p', 'gnd'], value: 10e3 },
        { type: 'R', id: 'R2', nodes: ['out', 'p'], value: 90e3 },
      ],
    }
    let err
    try {
      solvePWL(dc)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(NetworkError)
    expect(err.code).toBe('multi-state')
    expect(err.message).toMatch(/hysteresis, not an error/)
    // Both rails — and, balanced exactly between them, the linear state a real
    // circuit never sits in. All three satisfy their own guards.
    expect(err.detail.states).toHaveLength(3)
    expect(err.detail.states.map((s) => s.A1).sort()).toEqual(['high', 'linear', 'low'])
    // Told which one it is in, it answers.
    const high = solvePWL(dc, { prefer: { A1: 'high' } })
    near(high.sol.v.out, 12, 1e-12)
  })

  it('the margins are the checks a reader would make, named in the reader’s terms', () => {
    const sol = solvePWL(series({ model: 'drop' })).sol
    const on = regionMargins({ id: 'D1', type: 'D', model: 'drop', vf: 0.7, nodes: ['a', 'gnd'] }, 'on', sol)
    expect(on[0].says).toBe('i_D1 ≥ 0')
    expect(on[0].margin).toBeGreaterThan(0)
    const off = regionMargins({ id: 'D1', type: 'D', model: 'drop', vf: 0.7, nodes: ['a', 'gnd'] }, 'off', sol)
    expect(off[0].says).toBe('v_D1 ≤ V_f')
  })
})
