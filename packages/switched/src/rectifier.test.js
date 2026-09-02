import { describe, it, expect } from 'vitest'
import {
  rectifier,
  rectifierSteadyState,
  rectifierMeasures,
  harmonic,
  dimmer,
  dimmerHarmonic,
  dimmerWaveform,
  RECT_KINDS,
  RECT_DEFAULTS,
} from './rectifier.js'
import { walkPeriod, periodIntegral, signalAverage } from './events.js'
import { waveforms } from './steady.js'
import { stateAt } from './segment.js'

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const logU = (r, lo, hi) => lo * (hi / lo) ** r()

// Rectifier parameters across the lab's knob ranges: transformer secondaries
// from 6 to 48 V, both line frequencies, series resistance from a stiff
// winding to a limp one, capacitors from token to bulk, loads from heavy
// to nearly open.
function randomParams(r) {
  return {
    Vs: logU(r, 6, 48),
    f: r() < 0.5 ? 50 : 60,
    Rs: logU(r, 0.1, 5),
    Vf: r() < 0.2 ? 0 : 0.3 + 0.7 * r(),
    C: logU(r, 10e-6, 4700e-6),
    R: logU(r, 5, 2000),
  }
}

const r = rng(2026)
const cases = []
for (let i = 0; i < 45; i++) cases.push([RECT_KINDS[i % 3], i, randomParams(r)])

describe('invariants every rectifier must satisfy in periodic steady state', () => {
  it.each(cases)('%s #%i', (kind, _, p) => {
    const conv = rectifier(kind, p)
    const ss = rectifierSteadyState(conv)
    const m = rectifierMeasures(ss)
    const Vp = conv.Vp * (kind === 'six' ? Math.sqrt(3) : 1)

    // 1. Periodicity: the walk returns to where it started.
    expect(Math.abs(ss.xEnd[0] - ss.x0[0])).toBeLessThan(1e-9 * Vp)
    // The source oscillator is exact: one period brings (s, c) back to (0, Vp).
    expect(ss.xEnd[1]).toBeCloseTo(0, 9)
    expect(ss.xEnd[2]).toBeCloseTo(conv.Vp, 9)

    // 2. Charge balance: the capacitor's average current is zero, so what the
    // diodes deliver on average is what the load takes.
    expect(Math.abs(signalAverage(ss, 'iC'))).toBeLessThan(1e-9 * Math.max(1, m.iPeak))
    expect(m.sig.iD.avg).toBeCloseTo(m.Iout, 9)

    // 3. Energy: the source's power is the load's plus what R_s and the diodes burn.
    expect(Math.abs(m.balance)).toBeLessThan(1e-9 * Math.max(1, m.Pin))
    expect(m.eta).toBeGreaterThan(0)
    expect(m.eta).toBeLessThan(1)

    // 4. Continuity: the capacitor voltage does not jump at any event.
    for (let i = 1; i < ss.segments.length; i++) {
      const prev = ss.segments[i - 1]
      if (prev.T <= 0) continue
      expect(Math.abs(stateAt(prev, prev.T)[0] - ss.segments[i].x0[0])).toBeLessThan(1e-9 * Vp)
    }

    // 5. The diodes only ever conduct forward, and the output never exceeds
    // what the source can push through them.
    expect(m.sig.iD.min).toBeGreaterThanOrEqual(-1e-9)
    expect(m.sig.vout.max).toBeLessThanOrEqual(Vp - conv.nD * p.Vf + 1e-9)
    expect(m.sig.vout.min).toBeGreaterThan(0)

    // 6. The switching rule holds inside every segment, not only at its ends.
    for (const seg of ss.segments) {
      if (seg.T <= 0) continue
      for (const frac of [0.25, 0.5, 0.75]) expect(conv.pick(stateAt(seg, frac * seg.T))).toBe(seg.name)
    }

    // 7. Pulses: one per diode pair per period, at most.
    expect(m.pulses).toBeGreaterThanOrEqual(1)
    expect(m.pulses).toBeLessThanOrEqual(conv.pulses)

    // 8. The power factor's two factors multiply to the power factor.
    expect(m.displacement * m.distortion).toBeCloseTo(m.pf, 9)
    expect(m.pf).toBeGreaterThan(0)
    expect(m.pf).toBeLessThanOrEqual(1 + 1e-12)
  })
})

describe('the shooting problem', () => {
  it('a wrong start does not close, and the steady state does', () => {
    const conv = rectifier('bridge')
    const ss = rectifierSteadyState(conv)
    const low = walkPeriod(conv, conv.start(ss.x0[0] * 0.5))
    expect(low.xEnd[0]).toBeGreaterThan(ss.x0[0] * 0.5) // charges up towards it
    const high = walkPeriod(conv, conv.start(conv.Vp))
    expect(high.xEnd[0]).toBeLessThan(conv.Vp) // sags down towards it
  })

  it('the guard agrees with pick: positive exactly where the topology holds', () => {
    const conv = rectifier('six')
    const ss = rectifierSteadyState(conv)
    for (const seg of ss.segments) {
      if (seg.T <= 0) continue
      const mid = stateAt(seg, seg.T / 2)
      expect(conv.guard(mid, seg.name)).toBeGreaterThan(0)
      for (const other of Object.keys(conv.states)) {
        if (other !== seg.name) expect(conv.guard(mid, other)).toBeLessThanOrEqual(0)
      }
    }
  })

  it('a guard-less model reaches the same steady state by bisection', () => {
    const conv = rectifier('bridge')
    const ss = rectifierSteadyState(conv)
    const { guard, ...bare } = conv
    const ss2 = rectifierSteadyState(bare)
    expect(ss2.x0[0]).toBeCloseTo(ss.x0[0], 9)
    expect(rectifierMeasures(ss2).Vdc).toBeCloseTo(rectifierMeasures(ss).Vdc, 9)
  })
})

describe('closed forms the lessons quote', () => {
  it('half-wave ripple is about I/(fC), bridge about I/(2fC), six-pulse about I/(6fC), and always less', () => {
    for (const kind of RECT_KINDS) {
      const conv = rectifier(kind, { C: 2200e-6, R: 100 })
      const m = rectifierMeasures(rectifierSteadyState(conv))
      const firstOrder = m.Iout / (conv.pulses * conv.p.f * conv.p.C)
      // The first-order formula counts the whole period as discharge; the
      // real capacitor recharges for part of it, so it rides a little lower.
      expect(m.ripple).toBeLessThan(firstOrder)
      expect(m.ripple).toBeGreaterThan(0.6 * firstOrder)
    }
  })

  it('the ripple is the hold interval’s RC discharge from the peak, exactly', () => {
    for (const kind of RECT_KINDS) {
      const conv = rectifier(kind)
      const m = rectifierMeasures(rectifierSteadyState(conv))
      expect(m.tHold).toBeGreaterThan(0)
      expect(m.tHold).toBeLessThan(conv.T / conv.pulses)
      expect(m.holdFrom * (1 - Math.exp(-m.tHold / (conv.p.R * conv.p.C)))).toBeCloseTo(m.holdDrop, 9)
      // The peak-to-peak ripple is a little more, never less.
      expect(m.ripple).toBeGreaterThan(m.holdDrop)
      expect(m.ripple).toBeLessThan(1.05 * m.holdDrop)
    }
  })

  it('with a light load the output sits just under the peak less the diode drops', () => {
    for (const kind of RECT_KINDS) {
      const conv = rectifier(kind, { R: 5000, C: 4700e-6 })
      const m = rectifierMeasures(rectifierSteadyState(conv))
      const peak = conv.Vp * (kind === 'six' ? Math.sqrt(3) : 1) - conv.nD * conv.p.Vf
      expect(m.Vdc).toBeGreaterThan(0.98 * peak)
      expect(m.Vdc).toBeLessThan(peak)
    }
  })

  it('peak inverse voltage: half-wave and six-pulse see the peak line voltage, the bridge sees the peak', () => {
    const half = rectifierMeasures(rectifierSteadyState(rectifier('half')))
    const bridge = rectifierMeasures(rectifierSteadyState(rectifier('bridge')))
    const six = rectifierMeasures(rectifierSteadyState(rectifier('six')))
    const Vp = rectifier('half').Vp
    // Half-wave: the capacitor sits near +Vp while the source swings to −Vp.
    expect(half.piv).toBeGreaterThan(1.8 * Vp)
    expect(half.piv).toBeLessThan(2 * Vp)
    // Bridge: the blocked diode sees the capacitor voltage, so a bit under Vp.
    expect(bridge.piv).toBeLessThan(Vp)
    expect(bridge.piv).toBeGreaterThan(0.9 * Vp)
    // Six-pulse: the peak line-to-line voltage.
    expect(six.piv).toBeLessThan(Math.sqrt(3) * Vp)
    expect(six.piv).toBeGreaterThan(0.95 * Math.sqrt(3) * Vp)
  })

  it('more capacitance means a narrower, taller pulse with a worse form factor', () => {
    const at = (C) => rectifierMeasures(rectifierSteadyState(rectifier('bridge', { C })))
    const small = at(220e-6)
    const big = at(4700e-6)
    expect(big.ripple).toBeLessThan(small.ripple)
    expect(big.angle).toBeLessThan(small.angle)
    expect(big.iPeak).toBeGreaterThan(small.iPeak)
    expect(big.formFactor).toBeGreaterThan(small.formFactor)
    expect(big.pf).toBeLessThan(small.pf)
    expect(big.thd).toBeGreaterThan(small.thd)
  })

  it('the six-pulse output ripples six times per cycle and its line current has no triplen harmonics', () => {
    const conv = rectifier('six', { C: 470e-6, R: 50 })
    const ss = rectifierSteadyState(conv)
    const m = rectifierMeasures(ss, { harmonics: 13 })
    expect(m.pulses).toBe(6)
    // Output voltage: harmonics 6 and 12 only, of the line frequency.
    const vh = (k) => Math.hypot(harmonic(ss, 'vout', k).a, harmonic(ss, 'vout', k).b)
    expect(vh(6)).toBeGreaterThan(20 * vh(1))
    expect(vh(6)).toBeGreaterThan(20 * vh(2))
    expect(vh(6)).toBeGreaterThan(20 * vh(3))
    expect(vh(12)).toBeGreaterThan(20 * vh(11))
    // Line current: 5th and 7th present, 3rd and 9th absent, no even orders.
    const ih = (k) => m.harmonics[k - 1].rms
    expect(ih(5)).toBeGreaterThan(0.05 * ih(1))
    expect(ih(7)).toBeGreaterThan(0.05 * ih(1))
    expect(ih(3)).toBeLessThan(1e-6 * ih(1))
    expect(ih(9)).toBeLessThan(1e-6 * ih(1))
    expect(ih(2)).toBeLessThan(1e-6 * ih(1))
  })

  it('the single-phase bridge draws only odd harmonics; the half-wave circuit draws DC and even ones too', () => {
    const bridge = rectifierMeasures(rectifierSteadyState(rectifier('bridge')), { harmonics: 6 })
    const half = rectifierMeasures(rectifierSteadyState(rectifier('half')), { harmonics: 6 })
    const ih = (m, k) => m.harmonics[k - 1].rms
    expect(ih(bridge, 2)).toBeLessThan(1e-6 * ih(bridge, 1))
    expect(ih(bridge, 4)).toBeLessThan(1e-6 * ih(bridge, 1))
    expect(ih(bridge, 3)).toBeGreaterThan(0.3 * ih(bridge, 1))
    expect(ih(half, 2)).toBeGreaterThan(0.3 * ih(half, 1))
    expect(half.sig.iin.avg).toBeGreaterThan(0)
    expect(Math.abs(bridge.sig.iin.avg)).toBeLessThan(1e-9)
  })
})

describe('the harmonic analysis', () => {
  it('exact Fourier integrals agree with a DFT of the dense waveform', () => {
    const conv = rectifier('bridge')
    const ss = rectifierSteadyState(conv)
    const m = rectifierMeasures(ss, { harmonics: 9 })
    // Uniformly resample one period from the exact segments.
    const N = 4096
    const y = new Array(N)
    let seg = 0
    for (let i = 0; i < N; i++) {
      const t = (i / N) * ss.T
      while (seg < ss.segments.length - 1 && ss.segments[seg + 1].t0 <= t) seg++
      const s = ss.segments[seg]
      const x = stateAt(s, t - s.t0)
      const sig = s.state.signals.iin
      y[i] = sig.c[0] * x[0] + sig.c[1] * x[1] + sig.c[2] * x[2] + sig.d
    }
    for (const k of [1, 3, 5, 7, 9]) {
      let a = 0
      let b = 0
      for (let i = 0; i < N; i++) {
        a += y[i] * Math.cos((2 * Math.PI * k * i) / N)
        b += y[i] * Math.sin((2 * Math.PI * k * i) / N)
      }
      a *= 2 / N
      b *= 2 / N
      const h = m.harmonics[k - 1]
      // The current has a kink at every edge; a 4096-point trapezoid is good to ~1e-3 of the fundamental.
      expect(Math.abs(h.a - a)).toBeLessThan(2e-3 * m.I1)
      expect(Math.abs(h.b - b)).toBeLessThan(2e-3 * m.I1)
    }
  })

  it("Parseval: the harmonics' powers sum to the rms squared, and the power factor two ways agree", () => {
    for (const kind of RECT_KINDS) {
      const ss = rectifierSteadyState(rectifier(kind))
      const m = rectifierMeasures(ss, { harmonics: 200 })
      const dc = m.sig.iin.avg
      const sum = dc * dc + m.harmonics.reduce((acc, h) => acc + h.rms * h.rms, 0)
      expect(sum).toBeCloseTo(m.Irms ** 2, 4)
      // Real power flows only in the fundamental (the source is a pure sine):
      // P = V_rms · I_1 · cos φ_1 per phase.
      const phases = kind === 'six' ? 3 : 1
      expect(phases * m.Vrms * m.I1 * m.displacement).toBeCloseTo(m.Pin, 9)
    }
  })
})

describe('the dimmer', () => {
  const p = { Vs: 120, f: 60, alpha: 1.2, R: 100 }

  it('at α = 0 passes everything, at α = π nothing, and the closed form matches numerical integration between', () => {
    expect(dimmer({ ...p, alpha: 0 }).share).toBeCloseTo(1, 12)
    expect(dimmer({ ...p, alpha: Math.PI }).share).toBeCloseTo(0, 12)
    for (const alpha of [0.3, 1.2, 2.5]) {
      const d = dimmer({ ...p, alpha })
      // Midpoint sums on the conducting arcs only, where the waveform is
      // smooth, so the step at α costs nothing.
      const N = 4000
      let ms = 0
      let a1 = 0
      let b1 = 0
      for (const h0 of [0, Math.PI]) {
        const dth = (Math.PI - alpha) / N
        for (let i = 0; i < N; i++) {
          const th = h0 + alpha + (i + 0.5) * dth
          const v = d.Vp * Math.sin(th)
          ms += v * v * dth
          a1 += v * Math.cos(th) * dth
          b1 += v * Math.sin(th) * dth
        }
      }
      ms /= 2 * Math.PI
      a1 /= Math.PI
      b1 /= Math.PI
      expect(d.Vrms).toBeCloseTo(Math.sqrt(ms), 5)
      expect(d.a1).toBeCloseTo(a1, 5)
      expect(d.b1).toBeCloseTo(b1, 5)
      expect(d.P).toBeCloseTo(ms / p.R, 5)
      expect(d.pf).toBeCloseTo(d.displacement * d.distortion, 12)
      // The fundamental lags the source: a resistor that waits for its current.
      expect(d.phi1).toBeLessThan(0)
      expect(d.displacement).toBeLessThan(1)
    }
  })

  it('its harmonics in closed form: odd only, the first agreeing with the fundamental, and Parseval holding', () => {
    for (const alpha of [0.4, Math.PI / 2, 2.2]) {
      const d = dimmer({ ...p, alpha }, { harmonics: 400 })
      expect(dimmerHarmonic({ ...p, alpha }, 1).a).toBeCloseTo(d.a1, 12)
      expect(dimmerHarmonic({ ...p, alpha }, 1).b).toBeCloseTo(d.b1, 12)
      expect(d.harmonics[1].rms).toBe(0)
      expect(d.harmonics[3].rms).toBe(0)
      // Against a plain numerical integral, for the 3rd and 7th.
      for (const k of [3, 7]) {
        const N = 40000
        let a = 0
        let b = 0
        for (const h0 of [0, Math.PI]) {
          const dth = (Math.PI - alpha) / N
          for (let i = 0; i < N; i++) {
            const th = h0 + alpha + (i + 0.5) * dth
            const v = d.Vp * Math.sin(th)
            a += v * Math.cos(k * th) * dth
            b += v * Math.sin(k * th) * dth
          }
        }
        expect(dimmerHarmonic({ ...p, alpha }, k).a).toBeCloseTo(a / Math.PI, 5)
        expect(dimmerHarmonic({ ...p, alpha }, k).b).toBeCloseTo(b / Math.PI, 5)
      }
      // The harmonics’ powers sum to the rms squared; a step’s harmonics fall as 1/k, so 400 terms leave ~1/400 of the distortion power.
      const sum = d.harmonics.reduce((acc, h) => acc + h.rms * h.rms, 0)
      expect(Math.abs(sum - d.Irms ** 2) / d.Irms ** 2).toBeLessThan(3e-3)
      expect(Math.abs(d.thd - Math.sqrt(sum - d.I1 ** 2) / d.I1) / d.thd).toBeLessThan(1e-2)
    }
  })

  it('the waveform is the source where fired and zero where blocked, with edges at every firing and zero crossing', () => {
    const w = dimmerWaveform(p, { periods: 2, n: 360 })
    expect(w.edges.filter((e) => e.name === 'fire')).toHaveLength(4)
    expect(w.edges.filter((e) => e.name === 'zero')).toHaveLength(4)
    for (let i = 0; i < w.t.length; i++) {
      const v = w.sig.vout[i]
      expect(v === 0 || Math.abs(v - w.sig.vin[i]) < 1e-12).toBe(true)
      expect(w.sig.iin[i]).toBeCloseTo(v / p.R, 12)
      expect(w.sig.vD[i]).toBeCloseTo(w.sig.vin[i] - v, 12)
    }
    // Its rms agrees with the closed form.
    let ms = 0
    let span = 0
    for (let i = 1; i < w.t.length; i++) {
      const dt = w.t[i] - w.t[i - 1]
      ms += (dt * (w.sig.vout[i] ** 2 + w.sig.vout[i - 1] ** 2)) / 2
      span += dt
    }
    expect(Math.sqrt(ms / span)).toBeCloseTo(dimmer(p).Vrms, 0)
  })
})

describe('defaults and guards', () => {
  it('rejects an unknown kind and exposes the lesson defaults', () => {
    expect(() => rectifier('full')).toThrow(/unknown rectifier/)
    expect(RECT_DEFAULTS.Vs).toBe(12.6)
    expect(rectifier('half').p.C).toBe(1000e-6)
  })

  it('waveforms() renders the event steady state with an edge per segment', () => {
    const ss = rectifierSteadyState(rectifier('bridge'))
    const w = waveforms(ss, { periods: 1, n: 120 })
    expect(w.edges).toHaveLength(ss.segments.filter((s) => s.T > 0).length)
    expect(Object.keys(w.sig)).toEqual(['vin', 'vrect', 'vout', 'iD', 'iin', 'iC', 'iR', 'vD'])
    // 120 points per period straddle the peak; the sampled maximum is within (π/120)²/2 of it.
    expect(Math.max(...w.sig.vin)).toBeCloseTo(rectifier('bridge').Vp, 1)
  })

  it('periodIntegral of 1 is the period', () => {
    const ss = rectifierSteadyState(rectifier('half'))
    expect(periodIntegral(ss, () => 1)).toBeCloseTo(ss.T, 12)
  })
})
