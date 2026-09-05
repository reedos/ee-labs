import { describe, it, expect } from 'vitest'
import {
  INVERTER_KINDS,
  INVERTER_SIGNALS,
  carrierRatio,
  inverter,
  inverterDistortion,
  inverterMeasures,
  inverterSteadyState,
  inverterWaveform,
  lcMagnitude,
  pwmEdges,
  spwmFundamentalPeak,
  squareFundamentalRms,
  squareThd,
} from './inverter.js'
import { fourierAt, spectrumOf } from './clocked.js'
import { endState } from './segment.js'
import { lossLedger } from './ledger.js'

// The inverter, judged the way an inverter is judged: by its fundamental and
// by everything else it puts out.
//
// Two closed forms carry Group F. A square wave's fundamental is (4/π)V_dc at
// a total harmonic distortion of √(π²/8 − 1) = 48.34 %, whatever V_dc is. A
// bipolar sine-PWM bridge's fundamental is m_a·V_dc up to m_a = 1, whatever
// the carrier is. Both are compared here against exact Fourier integrals of a
// solved waveform, and the integrals themselves against a dense discrete
// transform that shares no code with them.

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const logU = (r, lo, hi) => lo * (hi / lo) ** r()

/** A plain DFT of a signal sampled uniformly over one period: the outside opinion. */
function dftRms(ss, name, k, n = 20000) {
  const T = ss.T
  const w = (2 * Math.PI) / T
  const live = ss.segments.filter((s) => s.T > 0)
  let a = 0
  let b = 0
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) * T) / n
    let seg = live[live.length - 1]
    for (const s of live) {
      if (t >= s.t0 && t < s.t0 + s.T) {
        seg = s
        break
      }
    }
    const form = seg.state.signals[name]
    const x = endState({ ...seg, T: t - seg.t0 })
    const y = form.c[0] * x[0] + form.c[1] * x[1] + form.d
    a += y * Math.cos(k * w * t)
    b += y * Math.sin(k * w * t)
  }
  return Math.hypot((2 * a) / n, (2 * b) / n) / Math.SQRT2
}

describe('the comparator', () => {
  it('locks the carrier to an odd multiple of the fundamental', () => {
    expect(carrierRatio(3780, 60)).toBe(63)
    expect(carrierRatio(1980, 60)).toBe(33)
    expect(carrierRatio(900, 60)).toBe(15)
    // Anything between snaps to the nearest odd multiple, and never below 3.
    expect(carrierRatio(3800, 60)).toBe(63)
    expect(carrierRatio(3700, 60)).toBe(61)
    expect(carrierRatio(10, 60)).toBe(3)
  })

  it('cuts two edges per carrier period, in order, inside the period', () => {
    const mf = 15
    const edges = pwmEdges({ ma: 0.8, mf, f1: 60 })
    expect(edges).toHaveLength(2 * mf)
    for (let i = 1; i < edges.length; i++) expect(edges[i]).toBeGreaterThan(edges[i - 1])
    expect(edges[0]).toBeGreaterThan(0)
    expect(edges[edges.length - 1]).toBeLessThan(1 / 60)
  })

  it('puts every edge where the reference meets the ramp, to a part in 1e12', () => {
    const mf = 15
    const T = 1 / 60
    const Tc = T / mf
    for (const t of pwmEdges({ ma: 0.8, mf, f1: 60 })) {
      const q = Math.floor(t / Tc)
      const local = t - q * Tc
      const carrier = local <= Tc / 2 ? -1 + (4 * local) / Tc : 1 - (4 * (local - Tc / 2)) / Tc
      expect(Math.abs(0.8 * Math.sin((2 * Math.PI * t) / T) - carrier)).toBeLessThan(1e-11)
    }
  })

  it('is half-wave symmetric: an edge in the first half has its mirror in the second', () => {
    const T = 1 / 60
    const edges = pwmEdges({ ma: 0.9, mf: 21, f1: 60 })
    const first = edges.filter((t) => t < T / 2)
    const second = edges.filter((t) => t >= T / 2).map((t) => t - T / 2)
    expect(second).toHaveLength(first.length)
    first.forEach((t, i) => expect(second[i]).toBeCloseTo(t, 9))
  })

  it('stops cutting where the reference leaves the carrier behind: that is overmodulation', () => {
    // Past m_a = 1 the reference spends part of each half cycle outside the
    // carrier's range, and those ramps carry no crossing at all. The edges
    // that survive are the ones near the zero crossings, where the reference
    // is still inside ±1, and there are fewer of them the deeper it goes.
    const counts = [0.99, 1.2, 2, 3].map((ma) => pwmEdges({ ma, mf: 21, f1: 60 }).length)
    expect(counts[0]).toBe(42)
    for (let i = 1; i < counts.length; i++) expect(counts[i], `m_a step ${i}`).toBeLessThan(counts[i - 1])
    expect(counts[3]).toBeLessThan(12)
  })
})

describe('the square-wave inverter', () => {
  const conv = inverter('square', {})
  const ss = inverterSteadyState(conv)
  const m = inverterMeasures(ss)

  it('has a fundamental of (4/π)·V_dc and a distortion of √(π²/8 − 1)', () => {
    expect(squareFundamentalRms(48)).toBeCloseTo(43.2152, 4)
    expect(squareThd()).toBeCloseTo(0.483426, 6)
    expect(m.Vsw1).toBeCloseTo(squareFundamentalRms(48), 9)
    expect(m.thdSw).toBeCloseTo(squareThd(), 9)
    expect(m.VswRms).toBeCloseTo(48, 9)
  })

  it('keeps that distortion at every rail voltage, because it is a shape', () => {
    for (const Vdc of [12, 24, 48]) {
      const q = inverterMeasures(inverterSteadyState(inverter('square', { Vdc })))
      expect(q.Vsw1, `${Vdc} V`).toBeCloseTo(squareFundamentalRms(Vdc), 9)
      expect(q.thdSw, `${Vdc} V`).toBeCloseTo(squareThd(), 9)
    }
  })

  it('has odd harmonics falling as 1/k, and no even ones', () => {
    const h = spectrumOf(ss, 'vsw', 9)
    for (const k of [2, 4, 6, 8]) expect(h[k - 1].rms).toBeLessThan(1e-12 * h[0].rms)
    for (const k of [3, 5, 7, 9]) expect(h[k - 1].rms).toBeCloseTo(h[0].rms / k, 9)
  })

  it('agrees with a dense discrete transform that shares none of its code', () => {
    for (const k of [1, 3, 5]) expect(dftRms(ss, 'vsw', k)).toBeCloseTo(spectrumOf(ss, 'vsw', 5)[k - 1].rms, 3)
    expect(dftRms(ss, 'vout', 1)).toBeCloseTo(m.V1, 2)
  })

  it('leaves the filtering problem standing: a 60 Hz square wave is still distorted after the LC', () => {
    // The third harmonic is at 180 Hz and the filter's corner is at 1.59 kHz,
    // so the filter has nothing to work with.
    expect(lcMagnitude({ L: 1e-3, C: 10e-6, R: 10 }, 180)).toBeGreaterThan(0.9)
    expect(m.thd).toBeGreaterThan(0.4)
  })
})

describe('sine PWM', () => {
  it('puts the fundamental at m_a·V_dc, whatever the carrier', () => {
    for (const fsw of [900, 1980, 3780]) {
      for (const ma of [0.2, 0.5, 0.8, 1]) {
        const conv = inverter('spwm', { fsw, ma })
        const m = inverterMeasures(inverterSteadyState(conv))
        expect(m.Vsw1 * Math.SQRT2, `ma=${ma} fsw=${fsw}`).toBeCloseTo(spwmFundamentalPeak(ma, 48), 6)
      }
    }
  })

  it('departs from m_a·V_dc past m_a = 1, and stops below what the line promised', () => {
    const over = inverterMeasures(inverterSteadyState(inverter('spwm', { ma: 1.2 })))
    const peak = over.Vsw1 * Math.SQRT2
    expect(peak).toBeGreaterThan(48)
    expect(peak).toBeLessThan(spwmFundamentalPeak(1.2, 48))
    // The ceiling is the square wave's, approached from below: at m_a = 4
    // only the notches near the zero crossings are left, and they are what
    // keeps the fundamental short of it.
    const full = inverterMeasures(inverterSteadyState(inverter('spwm', { ma: 4 })))
    expect(full.Vsw1).toBeLessThan(squareFundamentalRms(48))
    expect(full.Vsw1 / squareFundamentalRms(48)).toBeGreaterThan(0.98)
  })

  it('leaves the baseband empty between the fundamental and the carrier cluster', () => {
    const conv = inverter('spwm', { fsw: 3780, ma: 0.8 })
    const ss = inverterSteadyState(conv)
    const h = spectrumOf(ss, 'vsw', 2 * conv.mf + 8)
    const first = h[0].rms
    for (let k = 2; k <= conv.mf - 5; k++) {
      expect(h[k - 1].rms, `order ${k}`).toBeLessThan(0.01 * first)
    }
    // The families sit around m_f and 2·m_f.
    const near = (k0) => Math.max(...h.filter((q) => Math.abs(q.k - k0) <= 4).map((q) => q.rms))
    expect(near(conv.mf)).toBeGreaterThan(0.3 * first)
    expect(near(2 * conv.mf)).toBeGreaterThan(0.05 * first)
    // And no even orders at all, because m_f is odd.
    for (const q of h) if (q.k % 2 === 0) expect(q.rms).toBeLessThan(1e-9 * first)
  })

  it('is attenuated at the carrier by exactly what the LC says', () => {
    for (const fsw of [1980, 3780, 7740]) {
      const conv = inverter('spwm', { fsw, ma: 0.8 })
      const m = inverterMeasures(inverterSteadyState(conv))
      const H = lcMagnitude({ L: 1e-3, C: 10e-6, R: 10 }, m.carrier.k * 60)
      expect(m.attenuation, `fsw=${fsw}`).toBeCloseTo(H, 6)
    }
  })

  it('distorts less the faster it switches, once the families are past the corner', () => {
    const thd = [900, 1980, 3780, 7740].map((fsw) => inverterDistortion(inverterSteadyState(inverter('spwm', { fsw, ma: 0.8 }))).thd)
    for (let i = 1; i < thd.length; i++) expect(thd[i], `step ${i}`).toBeLessThan(thd[i - 1])
    expect(thd[0]).toBeGreaterThan(1)
    expect(thd[3]).toBeLessThan(0.06)
  })

  it('reads the same distortion the full measure does', () => {
    const ss = inverterSteadyState(inverter('spwm', { fsw: 3780, ma: 0.8 }))
    const cheap = inverterDistortion(ss)
    const full = inverterMeasures(ss)
    expect(cheap.thd).toBeCloseTo(full.thd, 6)
    expect(cheap.V1).toBeCloseTo(full.V1, 6)
  })
})

describe('the invariants', () => {
  const cases = []
  const r = rng(777)
  for (const kind of INVERTER_KINDS) {
    for (let i = 0; i < 60; i++) {
      cases.push([
        `${kind} #${i}`,
        kind,
        {
          Vdc: logU(r, 12, 400),
          f1: logU(r, 50, 400),
          L: logU(r, 100e-6, 10e-3),
          C: logU(r, 1e-6, 100e-6),
          R: logU(r, 1, 100),
          ma: 0.1 + 1.2 * r(),
          fsw: logU(r, 500, 8000),
          Ron: r() < 0.5 ? logU(r, 1e-3, 0.2) : 0,
          RL: r() < 0.5 ? logU(r, 1e-3, 0.5) : 0,
          ESR: r() < 0.5 ? logU(r, 1e-3, 0.5) : 0,
        },
      ])
    }
  }
  it.each(cases)('%s', (_, kind, p) => {
    const conv = inverter(kind, p)
    const ss = inverterSteadyState(conv)
    const m = inverterMeasures(ss, { harmonics: 6 })
    const live = ss.segments.filter((s) => s.T > 0)
    // The plan covers the period exactly, and the segments join.
    expect(live.reduce((a, s) => a + s.T, 0)).toBeCloseTo(ss.T, 12)
    const Is = Math.max(1e-9, ...live.flatMap((s) => [Math.abs(s.x0[0]), Math.abs(endState(s)[0])]))
    const Vs = Math.max(p.Vdc, ...live.flatMap((s) => [Math.abs(s.x0[1]), Math.abs(endState(s)[1])]))
    for (let k = 1; k < live.length; k++) {
      const xe = endState(live[k - 1])
      expect(Math.abs(live[k].x0[0] - xe[0])).toBeLessThan(1e-9 * Is)
      expect(Math.abs(live[k].x0[1] - xe[1])).toBeLessThan(1e-9 * Vs)
    }
    // Periodic: one more period returns the same state.
    expect(Math.abs(ss.xEnd[0] - ss.x0[0])).toBeLessThan(1e-9 * Is)
    expect(Math.abs(ss.xEnd[1] - ss.x0[1])).toBeLessThan(1e-9 * Vs)
    // Volt-second balance on the filter inductor, charge balance on the cap.
    expect(Math.abs(m.sig.vL.avg)).toBeLessThan(1e-8 * Vs)
    expect(Math.abs(m.sig.iC.avg)).toBeLessThan(1e-8 * Is)
    // The books: the rail delivers the load plus the losses, to floating point.
    const led = lossLedger(m)
    expect(Math.abs(led.residual)).toBeLessThan(1e-8 * Math.max(m.Pin, m.Pout, 1e-12))
    for (const s of Object.values(m.sig)) for (const v of Object.values(s)) expect(Number.isFinite(v)).toBe(true)
    expect(m.thd).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(m.thd)).toBe(true)
  })
})

describe('the shapes the app leans on', () => {
  it('names both kinds and refuses anything else', () => {
    expect(INVERTER_KINDS).toEqual(['square', 'spwm'])
    expect(() => inverter('trapezoid', {})).toThrow(/unknown inverter/)
  })
  it('carries every signal in every state, and draws a waveform of them', () => {
    for (const kind of INVERTER_KINDS) {
      const conv = inverter(kind, {})
      for (const state of Object.values(conv.states)) {
        for (const s of INVERTER_SIGNALS) expect(state.signals[s], `${kind}.${state.name}.${s}`).toBeTruthy()
      }
      const wf = inverterWaveform(inverterSteadyState(conv), { periods: 1 })
      for (const s of INVERTER_SIGNALS) expect(wf.sig[s].length).toBe(wf.t.length)
      expect(wf.edges).toHaveLength(2)
    }
  })
  it('reads the rail current as the load current with the bridge’s sign on it', () => {
    const ss = inverterSteadyState(inverter('square', {}))
    const m = inverterMeasures(ss)
    expect(m.sig.iin.rms).toBeCloseTo(m.sig.iL.rms, 9)
    expect(m.Pin).toBeCloseTo(m.Pout, 6)
  })
  it('agrees with fourierAt at order zero: the average of a symmetric bridge is zero', () => {
    const ss = inverterSteadyState(inverter('spwm', { fsw: 1980 }))
    expect(Math.abs(fourierAt(ss, 'vsw', 0).a)).toBeLessThan(1e-9 * 48)
  })
})
