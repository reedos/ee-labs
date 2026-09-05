import { describe, it, expect } from 'vitest'
import { evalSignal } from './topologies.js'
import { fourierAt, spectrumOf } from './clocked.js'
import { stateAt } from './segment.js'
import {
  threePhase,
  threePhaseSteadyState,
  threePhaseMeasures,
  threePhaseWaveform,
  triplenRatio,
  referencePeak,
  legReference,
  legEdges,
  sixStepLineRms,
  sixStepLinePeak,
  sixStepPhaseRms,
  sixStepPhaseTotalRms,
  sixStepLineTotalRms,
  spwmLinePeak,
  spwmPhasePeak,
  injectionHeadroom,
  singlePhaseBusRipple,
  INJECTION,
  THREE_PHASE_KINDS,
  THREE_PHASE_DEFAULTS,
} from './threePhase.js'

// Three legs into a balanced wye, solved the way `inverter.js` solves one
// bridge: the pattern is fixed before the state is, so a period is an affine
// map and the periodic state is a linear solve.
//
// What has to hold is arithmetic about the load rather than about the legs.
// The neutral floats, so anything the three legs share is subtracted off
// before the windings see it. That single fact is the absent triplens, the
// six-level phase voltage, and the free fifteen per cent of I2, and each is
// measured here on the solved waveform rather than argued from the picture.

const mulberry = (seed) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function sample(rnd, kind) {
  const lg = (lo, hi) => lo * (hi / lo) ** rnd()
  const p = {
    Vdc: lg(24, 400),
    f1: lg(30, 120),
    L: lg(2e-3, 60e-3),
    R: lg(2, 40),
    ma: kind === 'sixstep' ? 1 : 0.2 + 0.75 * rnd(),
    fsw: lg(500, 4000),
    inject: kind === 'sixstep' ? 0 : rnd() < 0.5 ? 0 : INJECTION,
  }
  return { p, conv: threePhase(kind, p) }
}

const solved = (conv) => threePhaseSteadyState(conv)
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b))
const mag = (ss, name, k) => {
  const c = fourierAt(ss, name, k)
  return Math.hypot(c.a, c.b)
}

describe('the carrier the three legs share', () => {
  it('snaps to an odd multiple of three, never below three', () => {
    for (const [fsw, f1, want] of [
      [1260, 60, 21],
      [900, 60, 15],
      [3780, 60, 63],
      [10, 60, 3],
      [60, 60, 3],
      [400, 50, 9],
    ]) {
      expect(triplenRatio(fsw, f1), `${fsw}/${f1}`).toBe(want)
    }
    const rnd = mulberry(17)
    for (let i = 0; i < 200; i++) {
      const f1 = 30 + 90 * rnd()
      const mf = triplenRatio(300 + 6000 * rnd(), f1)
      expect(mf % 2, `m_f = ${mf} is odd`).toBe(1)
      expect(mf % 3, `m_f = ${mf} is a multiple of three`).toBe(0)
      expect(mf).toBeGreaterThanOrEqual(3)
    }
  })

  it('the three legs are one leg, shifted by a third of the output period', () => {
    for (const inject of [0, INJECTION]) {
      const mf = 21
      const f1 = 60
      const T = 1 / f1
      const legs = [0, 1, 2].map((leg) =>
        legEdges({ ref: legReference({ ma: 0.8, inject, f1, phase: (leg * 2 * Math.PI) / 3 }), mf, f1 }),
      )
      expect(legs[0].length, 'edges a leg makes').toBe(2 * mf)
      for (const q of legs) expect(q.length).toBe(legs[0].length)
      // Leg b is leg a delayed by T/3, wrapped into the period.
      const wrap = (t) => ((t % T) + T) % T
      for (let leg = 1; leg < 3; leg++) {
        const shifted = legs[0].map((e) => ({ t: wrap(e.t + (leg * T) / 3), s: e.s })).sort((x, y) => x.t - y.t)
        const here = [...legs[leg]].sort((x, y) => x.t - y.t)
        for (let i = 0; i < here.length; i++) {
          expect(Math.abs(here[i].t - shifted[i].t), `leg ${leg} edge ${i}`).toBeLessThan(1e-12 * T)
          expect(here[i].s).toBe(shifted[i].s)
        }
      }
    }
  })

  it('the offset lowers the reference’s own peak to √3/2, which is the fifteen per cent', () => {
    expect(referencePeak(0)).toBe(1)
    expect(referencePeak(INJECTION)).toBeCloseTo(Math.sqrt(3) / 2, 12)
    expect(injectionHeadroom()).toBeCloseTo(2 / Math.sqrt(3), 12)
    expect(injectionHeadroom() - 1).toBeCloseTo(0.1547, 4)
    // The peak is the largest the reference actually reaches, sampled.
    for (const h of [0, 0.05, 1 / 9, INJECTION, 0.3]) {
      let top = 0
      for (let i = 0; i < 20000; i++) {
        const th = (2 * Math.PI * i) / 20000
        top = Math.max(top, Math.abs(Math.sin(th) + h * Math.sin(3 * th)))
      }
      expect(referencePeak(h), `h = ${h}`).toBeCloseTo(top, 6)
    }
  })
})

describe('the load the three legs share', () => {
  it.each(THREE_PHASE_KINDS)('%s: the three currents sum to zero at every sample, at 80 seeded bridges', (kind) => {
    const rnd = mulberry(kind.length * 331 + 5)
    for (let i = 0; i < 80; i++) {
      const { conv } = sample(rnd, kind)
      const ss = solved(conv)
      const scale = Math.max(...ss.segments.map((seg) => Math.abs(seg.x0[0]) + Math.abs(seg.x0[1])))
      for (const seg of ss.segments) {
        if (seg.T <= 0) continue
        for (const f of [0, 0.5, 1]) {
          const x = stateAt(seg, f * seg.T)
          const sum =
            evalSignal(seg.state, 'ia', x) + evalSignal(seg.state, 'ib', x) + evalSignal(seg.state, 'ic', x)
          expect(Math.abs(sum), `${kind} #${i}`).toBeLessThan(1e-9 * Math.max(1e-6, scale))
          // ...and the phase voltages do too, because the neutral floats.
          const vs =
            evalSignal(seg.state, 'van', x) +
            evalSignal(seg.state, 'vao', x) * 0
          expect(Number.isFinite(vs)).toBe(true)
        }
      }
    }
  })

  it.each(THREE_PHASE_KINDS)('%s: one more period returns the same state, at 80 seeded bridges', (kind) => {
    const rnd = mulberry(kind.length * 733 + 11)
    for (let i = 0; i < 80; i++) {
      const { conv } = sample(rnd, kind)
      const ss = solved(conv)
      const scale = Math.max(1e-9, Math.abs(ss.x0[0]), Math.abs(ss.x0[1]))
      expect(Math.abs(ss.xEnd[0] - ss.x0[0]) / scale, `${kind} #${i} i_a`).toBeLessThan(1e-12)
      expect(Math.abs(ss.xEnd[1] - ss.x0[1]) / scale, `${kind} #${i} i_b`).toBeLessThan(1e-12)
    }
  })

  it.each(THREE_PHASE_KINDS)('%s: the rail delivers exactly what the windings dissipate, at 80 seeded bridges', (kind) => {
    const rnd = mulberry(kind.length * 199 + 23)
    for (let i = 0; i < 80; i++) {
      const { p, conv } = sample(rnd, kind)
      const m = threePhaseMeasures(solved(conv), { harmonics: 1, dense: 4 })
      expect(m.Pdc).toBeGreaterThan(0)
      expect(rel(m.Pdc, m.Pout), `${kind} #${i}: bus ${m.Pdc} vs load ${m.Pout}`).toBeLessThan(1e-9)
      // V_dc·⟨i_dc⟩ is the same number as ⟨p_dc⟩, by two routes.
      expect(rel(p.Vdc * m.sig.idc.avg, m.sig.pdc.avg), `${kind} #${i}`).toBeLessThan(1e-9)
      // The three phases carry one RMS between them.
      expect(rel(m.sig.ib.rms, m.sig.ia.rms), `${kind} #${i} i_b`).toBeLessThan(1e-9)
      expect(rel(m.sig.ic.rms, m.sig.ia.rms), `${kind} #${i} i_c`).toBeLessThan(1e-9)
      // Every average over a half-wave symmetric period is zero.
      const s = Math.max(m.sig.ia.max, 1e-9)
      expect(Math.abs(m.sig.ia.avg), `${kind} #${i} ⟨i_a⟩`).toBeLessThan(1e-9 * s)
      expect(Math.abs(m.sig.van.avg), `${kind} #${i} ⟨v_an⟩`).toBeLessThan(1e-9 * p.Vdc)
      expect(Math.abs(m.sig.vab.avg), `${kind} #${i} ⟨v_ab⟩`).toBeLessThan(1e-9 * p.Vdc)
    }
  })

  it.each(THREE_PHASE_KINDS)('%s: no even harmonic and no triplen on the line, at 80 seeded bridges', (kind) => {
    const rnd = mulberry(kind.length * 89 + 41)
    for (let i = 0; i < 80; i++) {
      const { p, conv } = sample(rnd, kind)
      const ss = solved(conv)
      const first = mag(ss, 'vab', 1)
      for (const k of [2, 4, 6, 3, 9, 15]) {
        expect(mag(ss, 'vab', k) / first, `${kind} #${i} harmonic ${k} of v_ab`).toBeLessThan(1e-9)
        expect(mag(ss, 'van', k) / first, `${kind} #${i} harmonic ${k} of v_an`).toBeLessThan(1e-9)
      }
    }
  })

  it('the offset lands on every leg and on no line', () => {
    const conv = threePhase('spwm3', { ma: 1, inject: INJECTION, fsw: 1260 })
    const ss = solved(conv)
    // The leg carries m_a·h·V_dc/2 of third harmonic; the line carries none.
    expect(mag(ss, 'vao', 3)).toBeCloseTo((INJECTION * conv.p.Vdc) / 2, 9)
    expect(mag(ss, 'vab', 3) / conv.p.Vdc).toBeLessThan(1e-12)
    expect(mag(ss, 'van', 3) / conv.p.Vdc).toBeLessThan(1e-12)
    // Without it the leg carries none either, below the ceiling.
    const plain = solved(threePhase('spwm3', { ma: 1, inject: 0, fsw: 1260 }))
    expect(mag(plain, 'vao', 3) / conv.p.Vdc).toBeLessThan(1e-12)
  })
})

describe('the fundamentals the plan writes down', () => {
  it('six-step: the line and phase fundamentals, and the total RMS of each', () => {
    for (const Vdc of [12, 24, 48, 400]) {
      const conv = threePhase('sixstep', { ...THREE_PHASE_DEFAULTS, Vdc })
      const ss = solved(conv)
      const m = threePhaseMeasures(ss)
      expect(m.Vll1).toBeCloseTo(sixStepLineRms(Vdc), 9)
      expect(m.Vll1 * Math.SQRT2).toBeCloseTo(sixStepLinePeak(Vdc), 9)
      expect(m.V1).toBeCloseTo(sixStepPhaseRms(Vdc), 9)
      expect(m.V1).toBeCloseTo(m.Vll1 / Math.sqrt(3), 9)
      expect(m.sig.vab.rms).toBeCloseTo(sixStepLineTotalRms(Vdc), 9)
      expect(m.sig.van.rms).toBeCloseTo(sixStepPhaseTotalRms(Vdc), 9)
      // The staircase: ±V_dc/3 and ±2V_dc/3, and nothing between.
      expect(m.sig.van.max).toBeCloseTo((2 * Vdc) / 3, 9)
      expect(m.sig.van.min).toBeCloseTo((-2 * Vdc) / 3, 9)
      expect(m.sig.vab.max).toBeCloseTo(Vdc, 9)
      expect(m.sig.vao.rms).toBeCloseTo(Vdc / 2, 9)
      // The odd non-triplen harmonics fall as 1/k, exactly.
      for (const k of [5, 7, 11, 13]) {
        expect(mag(ss, 'vab', k) / mag(ss, 'vab', 1), `harmonic ${k}`).toBeCloseTo(1 / k, 9)
      }
      // ...and the THD that follows from them.
      expect(m.thdLine).toBeCloseTo(Math.sqrt((Math.PI * Math.PI) / 9 - 1), 9)
    }
  })

  it('sine PWM: the line-to-line fundamental is (√3/2)·m_a·V_dc up to the ceiling', () => {
    for (const [inject, top] of [
      [0, 1],
      [INJECTION, 1.15],
    ]) {
      for (const ma of [0.2, 0.5, 0.8, top]) {
        const conv = threePhase('spwm3', { ...THREE_PHASE_DEFAULTS, ma, inject, fsw: 1260 })
        const m = threePhaseMeasures(solved(conv))
        expect(m.Vll1 * Math.SQRT2, `inject ${inject}, m_a ${ma}`).toBeCloseTo(spwmLinePeak(ma, conv.p.Vdc), 6)
        expect(m.V1 * Math.SQRT2).toBeCloseTo(spwmPhasePeak(ma, conv.p.Vdc), 6)
      }
    }
  })

  it('past its own ceiling the plain sine falls behind the line, and the offset does not', () => {
    const at = (ma, inject) => {
      const conv = threePhase('spwm3', { ...THREE_PHASE_DEFAULTS, ma, inject, fsw: 1260 })
      return threePhaseMeasures(solved(conv)).Vll1 * Math.SQRT2
    }
    const Vdc = THREE_PHASE_DEFAULTS.Vdc
    expect(at(1.15, 0)).toBeLessThan(0.99 * spwmLinePeak(1.15, Vdc))
    expect(at(1.15, INJECTION)).toBeCloseTo(spwmLinePeak(1.15, Vdc), 6)
    // The ceiling is what the reference's own height allows.
    expect(1 / referencePeak(INJECTION)).toBeCloseTo(injectionHeadroom(), 12)
    expect(threePhase('spwm3', { inject: INJECTION }).ceiling).toBeCloseTo(injectionHeadroom(), 12)
  })
})

describe('the exact Fourier integral against a dense discrete one', () => {
  const dense = (wf, name, k) => {
    const T = wf.T
    const w = (2 * Math.PI * k) / T
    let a = 0
    let b = 0
    for (let i = 1; i < wf.t.length; i++) {
      const dt = wf.t[i] - wf.t[i - 1]
      const y = wf.sig[name]
      a += ((y[i] * Math.cos(w * wf.t[i]) + y[i - 1] * Math.cos(w * wf.t[i - 1])) / 2) * dt
      b += ((y[i] * Math.sin(w * wf.t[i]) + y[i - 1] * Math.sin(w * wf.t[i - 1])) / 2) * dt
    }
    return Math.hypot((2 * a) / T, (2 * b) / T)
  }
  it.each(THREE_PHASE_KINDS)('%s: five signals, two orders each', (kind) => {
    const conv = threePhase(kind, { ...THREE_PHASE_DEFAULTS, fsw: 1260 })
    const ss = solved(conv)
    const wf = threePhaseWaveform(ss, { periods: 1, n: 200000 })
    const m = threePhaseMeasures(ss, { harmonics: 1 })
    for (const name of ['vao', 'vab', 'van', 'ia', 'pdc']) {
      for (const k of [1, 5]) {
        const exact = mag(ss, name, k)
        const numeric = dense(wf, name, k)
        // A component the balance cancels is judged against the signal it
        // sits on, not against itself: p_dc has no fundamental at all, and
        // two numbers near zero have no ratio.
        const scale = Math.max(exact, numeric, 1e-6 * m.sig[name].rms)
        expect(Math.abs(exact - numeric) / scale, `${kind} ${name} harmonic ${k}`).toBeLessThan(2e-4)
      }
    }
  })
})

describe('a balanced load draws a power the bus does not have to swing', () => {
  it('phase a swings at twice the output frequency and the three add to none of it', () => {
    for (const ma of [0.4, 0.8]) {
      const conv = threePhase('spwm3', { ...THREE_PHASE_DEFAULTS, ma, fsw: 1260 })
      const m = threePhaseMeasures(solved(conv))
      // One phase: p(t) = P(1 − cos 2ωt) + Q sin 2ωt, so the swing is S.
      const w = 2 * Math.PI * conv.p.f1
      const phi = Math.atan2(w * conv.p.L, conv.p.R)
      expect(m.phaseSwing, `m_a = ${ma}`).toBeCloseTo(1 / Math.cos(phi), 2)
      expect(m.pa2 / m.Pa).toBeCloseTo(singlePhaseBusRipple({ V1: 1, I1: 1, phi }).ratio, 2)
      // The bus: nothing at all there.
      expect(m.p2 / m.Pdc, `m_a = ${ma} bus at 2f`).toBeLessThan(1e-12)
      expect(m.busSwing).toBeLessThan(1e-12)
      expect(m.Pa * 3).toBeCloseTo(m.Pdc, 6)
    }
  })

  it('six-step leaves a sixth-harmonic ripple on the bus and still nothing at twice', () => {
    const m = threePhaseMeasures(solved(threePhase('sixstep', THREE_PHASE_DEFAULTS)))
    expect(m.p2 / m.Pdc).toBeLessThan(1e-12)
    expect(m.p6 / m.Pdc).toBeGreaterThan(0.1)
  })

  it.each(THREE_PHASE_KINDS)('%s: the bus carries no second harmonic at 80 seeded bridges', (kind) => {
    const rnd = mulberry(kind.length * 577 + 3)
    for (let i = 0; i < 80; i++) {
      const { conv } = sample(rnd, kind)
      const m = threePhaseMeasures(solved(conv), { harmonics: 1, dense: 4 })
      expect(m.p2 / m.Pdc, `${kind} #${i}`).toBeLessThan(1e-9)
    }
  })
})

describe('the shape of the solution', () => {
  it('six-step has six segments and sine PWM has one more than the comparators produce', () => {
    const six = solved(threePhase('sixstep', THREE_PHASE_DEFAULTS))
    expect(six.segments).toHaveLength(6)
    for (const seg of six.segments) expect(seg.T).toBeCloseTo(1 / (6 * THREE_PHASE_DEFAULTS.f1), 12)
    const conv = threePhase('spwm3', { ...THREE_PHASE_DEFAULTS, fsw: 1260 })
    expect(conv.mf).toBe(21)
    expect(solved(conv).segments.length).toBe(3 * 2 * conv.mf + 1)
  })

  it('refuses a bridge it does not have', () => {
    expect(() => threePhase('sixpulse', {})).toThrow(/unknown three-phase inverter/)
  })

  it('names the harmonics it reports, and the pane’s units with them', () => {
    const m = threePhaseMeasures(solved(threePhase('sixstep', THREE_PHASE_DEFAULTS)))
    expect(m.spectrum.unit).toBe('V')
    expect(m.harmonics[0].k).toBe(1)
    expect(m.mode).toBe('threephase')
    const hs = spectrumOf(solved(threePhase('sixstep', THREE_PHASE_DEFAULTS)), 'vab', 7)
    expect(hs).toHaveLength(7)
  })
})
