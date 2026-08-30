import { describe, it, expect } from 'vitest'
import { CIRCUITS, CIRCUIT_GROUPS, transferOf, defaultsOf } from './circuits.js'
import { sineResponse } from './math.js'
import {
  bode,
  magnitudeAt,
  phaseAt,
  dcGain,
  polesZeros,
  secondOrderMetrics,
  stepResponse,
} from '@ee-labs/systems'

// Every H(s) here was derived by hand, so every one is checked against what the
// circuit must do — at DC, at infinity, and at resonance — rather than against
// the algebra being retyped. A sign error or a swapped component would survive
// re-reading the formula and would not survive these.

const db = (a) => 20 * Math.log10(a)
const tfOf = (id, out) => transferOf(id, defaultsOf(id), out)

describe('the registry itself', () => {
  it('gives every circuit a declared group, params and outputs', () => {
    for (const [id, c] of Object.entries(CIRCUITS)) {
      expect(CIRCUIT_GROUPS, id).toContain(c.group)
      expect(c.params.length, id).toBeGreaterThan(0)
      expect(c.outputs.length, id).toBeGreaterThan(0)
      expect(typeof c.tf, id).toBe('function')
      expect(c.derive.tex, id).toBeTruthy()
    }
  })

  it('produces a finite response for every circuit and every output', () => {
    for (const [id, c] of Object.entries(CIRCUITS)) {
      for (const o of c.outputs) {
        const tf = tfOf(id, o.key)
        for (const f of [1, 100, 1e3, 1e5]) {
          expect(Number.isFinite(magnitudeAt(tf, f)), `${id}/${o.key} at ${f} Hz`).toBe(true)
        }
      }
    }
  })
})

describe('first-order circuits', () => {
  it('a divider is flat, and equal to the resistor ratio', () => {
    const tf = tfOf('divider')
    expect(dcGain(tf)).toBeCloseTo(0.5, 12)
    for (const f of [1, 1e3, 1e6]) expect(magnitudeAt(tf, f)).toBeCloseTo(0.5, 12)
    expect(phaseAt(tf, 1e3)).toBeCloseTo(0, 12)
  })

  it('an RC low-pass passes DC, blocks high frequency, and turns at 1/(2 pi RC)', () => {
    const p = defaultsOf('rcLow')
    const tf = tfOf('rcLow')
    const fc = 1 / (2 * Math.PI * p.r * p.c)
    expect(dcGain(tf)).toBeCloseTo(1, 12)
    expect(db(magnitudeAt(tf, fc))).toBeCloseTo(-3.0103, 4)
    expect((phaseAt(tf, fc) * 180) / Math.PI).toBeCloseTo(-45, 6)
    expect(magnitudeAt(tf, fc * 1000)).toBeLessThan(0.002)
  })

  it('an RC high-pass is the exact complement of the low-pass', () => {
    // They share one current, so their outputs must sum to the input at every
    // frequency. This is the check a sign error could not survive.
    const p = defaultsOf('rcLow')
    const lo = transferOf('rcLow', p, 'c')
    const hi = transferOf('rcHigh', p, 'r')
    const fc = 1 / (2 * Math.PI * p.r * p.c)

    expect(dcGain(hi)).toBeCloseTo(0, 12)
    expect(db(magnitudeAt(hi, fc))).toBeCloseTo(-3.0103, 4)
    expect((phaseAt(hi, fc) * 180) / Math.PI).toBeCloseTo(45, 6)

    // |H_lo|^2 + |H_hi|^2 = 1 for this pair, at every frequency.
    for (const f of [fc / 10, fc, fc * 10]) {
      const a = magnitudeAt(lo, f)
      const b = magnitudeAt(hi, f)
      expect(a * a + b * b, `${f} Hz`).toBeCloseTo(1, 10)
    }
  })

  it('an RL low-pass is an RC low-pass with L/R for RC', () => {
    const p = defaultsOf('rlLow')
    const rl = tfOf('rlLow')
    const tau = p.l / p.r
    const equivalent = { b: [1], a: [tau, 1] }
    for (const f of [10, 100, 1000, 10000]) {
      expect(magnitudeAt(rl, f), `${f} Hz`).toBeCloseTo(magnitudeAt(equivalent, f), 12)
    }
  })
})

describe('series RLC: one circuit, three filters', () => {
  const p = defaultsOf('rlcSeries')
  const w0 = 1 / Math.sqrt(p.l * p.c)
  const f0 = w0 / (2 * Math.PI)
  const Q = (1 / p.r) * Math.sqrt(p.l / p.c)

  it('resonates where the algebra says, with the stated Q', () => {
    const m = secondOrderMetrics(transferOf('rlcSeries', p, 'c'))
    expect(m.wn).toBeCloseTo(w0, 6)
    expect(m.q).toBeCloseTo(Q, 9)
    expect(CIRCUITS.rlcSeries.metrics(p).q).toBeCloseTo(Q, 12)
  })

  it('is low-pass across C, band-pass across R, high-pass across L', () => {
    const lo = transferOf('rlcSeries', p, 'c')
    const bp = transferOf('rlcSeries', p, 'r')
    const hi = transferOf('rlcSeries', p, 'l')

    // At DC: the capacitor holds the whole input, the others nothing.
    expect(dcGain(lo)).toBeCloseTo(1, 12)
    expect(dcGain(bp)).toBeCloseTo(0, 12)
    expect(dcGain(hi)).toBeCloseTo(0, 12)

    // Far above resonance the inductor holds it all.
    const hf = f0 * 1e4
    expect(magnitudeAt(hi, hf)).toBeCloseTo(1, 4)
    expect(magnitudeAt(lo, hf)).toBeLessThan(1e-6)

    // At resonance the band-pass is exactly 1 and the other two are exactly Q.
    expect(magnitudeAt(bp, f0)).toBeCloseTo(1, 8)
    expect(magnitudeAt(lo, f0)).toBeCloseTo(Q, 6)
    expect(magnitudeAt(hi, f0)).toBeCloseTo(Q, 6)
  })

  it('the three outputs sum to the input at every frequency', () => {
    // Kirchhoff, stated as a test: the three voltages are one loop.
    const parts = ['c', 'r', 'l'].map((o) => transferOf('rlcSeries', p, o))
    for (const f of [f0 / 50, f0 / 2, f0, f0 * 2, f0 * 50]) {
      let re = 0
      let im = 0
      for (const tf of parts) {
        const m = magnitudeAt(tf, f)
        const ph = phaseAt(tf, f)
        re += m * Math.cos(ph)
        im += m * Math.sin(ph)
      }
      expect(re, `real at ${f} Hz`).toBeCloseTo(1, 8)
      expect(im, `imag at ${f} Hz`).toBeCloseTo(0, 8)
    }
  })

  it('R sets Q inversely — more resistance, blunter resonance', () => {
    const q = (r) => CIRCUITS.rlcSeries.metrics({ ...p, r }).q
    expect(q(10)).toBeGreaterThan(q(100))
    expect(q(100)).toBeGreaterThan(q(1000))
    // Doubling R halves Q exactly.
    expect(q(200)).toBeCloseTo(q(100) / 2, 9)
  })
})

describe('parallel RLC', () => {
  const p = defaultsOf('rlcParallel')
  const f0 = 1 / (2 * Math.PI * Math.sqrt(p.l * p.c))

  it('peaks at R, where the series circuit dipped', () => {
    const z = tfOf('rlcParallel')
    expect(magnitudeAt(z, f0)).toBeCloseTo(p.r, 4)
    // Away from resonance the impedance collapses.
    expect(magnitudeAt(z, f0 / 100)).toBeLessThan(p.r / 50)
    expect(magnitudeAt(z, f0 * 100)).toBeLessThan(p.r / 50)
  })

  it('R sets Q the other way round from the series case', () => {
    const q = (r) => CIRCUITS.rlcParallel.metrics({ ...p, r }).q
    expect(q(100000)).toBeGreaterThan(q(10000))
    // The reciprocal of the series relationship, exactly.
    expect(q(10000)).toBeCloseTo(10000 * Math.sqrt(p.c / p.l), 9)
  })
})

describe('active circuits', () => {
  it('Sallen-Key gets its Q from ratios, with no inductor anywhere', () => {
    const p = defaultsOf('sallenKey')
    const tf = tfOf('sallenKey')
    const m = secondOrderMetrics(tf)
    const want = CIRCUITS.sallenKey.metrics(p)

    expect(dcGain(tf)).toBeCloseTo(1, 12)
    expect(m.wn).toBeCloseTo(want.w0, 6)
    expect(m.q).toBeCloseTo(want.q, 9)

    // The capacitor ratio alone moves Q, with both resistors held equal.
    const qOf = (c1) => CIRCUITS.sallenKey.metrics({ ...p, c1 }).q
    expect(qOf(4 * p.c1)).toBeCloseTo(2 * qOf(p.c1), 9)
  })

  it('an inverting amplifier has negative DC gain and 180 degrees of phase', () => {
    const p = defaultsOf('inverting')
    const tf = tfOf('inverting')
    expect(dcGain(tf)).toBeCloseTo(-p.rf / p.rin, 9)
    // 180 degrees is the DC limit, approached from below: even at 1 Hz the
    // feedback pole near 16 kHz has already contributed a few thousandths of a
    // degree of lag, which is the circuit being right rather than the test.
    const deg = (f) => Math.abs((phaseAt(tf, f) * 180) / Math.PI)
    expect(deg(0.001)).toBeCloseTo(180, 5)
    expect(deg(1)).toBeCloseTo(180, 2)
    expect(deg(1)).toBeLessThan(180)
    // ...and the lag grows with frequency, as one pole must make it.
    expect(deg(1e4)).toBeLessThan(deg(1e3))
    // ...and one pole, at the feedback time constant.
    const { poles } = polesZeros(tf)
    expect(poles).toHaveLength(1)
    expect(poles[0][0]).toBeCloseTo(-1 / (p.rf * p.cf), 3)
  })

  it('an inverting amplifier at its pole has lost exactly 45 of its 180 degrees', () => {
    // The hint used to say "180° at every frequency", and that is false the
    // moment the feedback capacitor engages: the minus sign contributes 180°,
    // the pole then takes its 45°-per-order toll at the corner. Total: 135°,
    // exactly, because this is 1st order.
    const p = defaultsOf('inverting')
    const tf = tfOf('inverting')
    const fp = 1 / (2 * Math.PI * p.rf * p.cf)
    expect((phaseAt(tf, fp) * 180) / Math.PI).toBeCloseTo(135, 9)
    // Far above the corner only 90° is left: the full first-order lag has
    // arrived on top of the inversion.
    expect((phaseAt(tf, fp * 1e4) * 180) / Math.PI).toBeCloseTo(90, 1)
  })

  it('an integrator has its pole exactly at the origin', () => {
    const tf = tfOf('integrator')
    const { poles } = polesZeros(tf)
    expect(poles).toHaveLength(1)
    expect(poles[0][0]).toBeCloseTo(0, 12)
    expect(poles[0][1]).toBeCloseTo(0, 12)

    // Gain rises without limit towards DC, at 6 dB per octave.
    const slope = db(magnitudeAt(tf, 10)) - db(magnitudeAt(tf, 20))
    expect(slope).toBeCloseTo(6.02, 2)

    // A step in gives a ramp out: the output never settles, and it should not.
    const p = defaultsOf('integrator')
    const { t, y } = stepResponse(tf, { duration: 5 * p.r * p.c, points: 500 })
    const mid = Math.floor(y.length / 2)
    expect(y[y.length - 1]).toBeCloseTo(-t[t.length - 1] / (p.r * p.c), 3)
    expect(Math.abs(y[y.length - 1])).toBeGreaterThan(Math.abs(y[mid]))
  })
})

// Every phase figure the hints and panels print, measured before it is allowed
// to appear. The rule the sentences lead with — a 1st-order corner costs 45° at
// the corner and 90° beyond, times the order — is EXACT for these circuits at
// their corner, not a sketch: at ω₀ the s² and 1 terms of a second-order
// denominator cancel, leaving a purely imaginary jωRC, whatever R is. Which is
// also why every figure below is checked to nine decimal places and at more
// than one damping.
describe('phase, wherever magnitude is claimed', () => {
  const deg = (tf, f) => (phaseAt(tf, f) * 180) / Math.PI

  it('the RC low-pass lags exactly 45 degrees at the corner, heading to 90', () => {
    const p = defaultsOf('rcLow')
    const tf = tfOf('rcLow')
    const fc = 1 / (2 * Math.PI * p.r * p.c)
    expect(deg(tf, fc)).toBeCloseTo(-45, 9)
    // "Heading to 90 beyond" is asymptotic, so it is tested as one: the lag
    // only ever grows across the sweep and lands within a tenth of a degree
    // of -90 four decades out.
    const { phase } = bode(tf, [fc, fc * 10, fc * 100, fc * 1e3, fc * 1e4])
    for (let i = 1; i < phase.length; i++) expect(phase[i]).toBeLessThan(phase[i - 1])
    expect((phase[phase.length - 1] * 180) / Math.PI).toBeCloseTo(-90, 1)
  })

  it('the RC high-pass leads exactly 45 at the corner, from 90 at DC down to 0', () => {
    const p = defaultsOf('rcHigh')
    const tf = tfOf('rcHigh')
    const fc = 1 / (2 * Math.PI * p.r * p.c)
    expect(deg(tf, fc)).toBeCloseTo(45, 9)
    expect(deg(tf, fc / 1e4)).toBeCloseTo(90, 1)
    expect(deg(tf, fc * 1e4)).toBeCloseTo(0, 1)
  })

  it('the RL low-pass lags the same 45 degrees at its own corner', () => {
    const p = defaultsOf('rlLow')
    const fc = 1 / (2 * Math.PI * (p.l / p.r))
    expect(deg(tfOf('rlLow'), fc)).toBeCloseTo(-45, 9)
  })

  it('the two RC outputs are 90 degrees apart at EVERY frequency, not 45', () => {
    // The corner lesson used to say the two component voltages sit "45° apart".
    // Each is 45° from the INPUT at the corner — the two are 90° from each
    // other, there and everywhere else, because V_R/V_C = jωRC is purely
    // imaginary. The tenth confidently wrong explanation, caught here.
    const p = defaultsOf('rcLow')
    const lo = transferOf('rcLow', p, 'c')
    const hi = transferOf('rcHigh', p, 'r')
    const fc = 1 / (2 * Math.PI * p.r * p.c)
    for (const f of [fc / 100, fc, fc * 100]) {
      expect(deg(hi, f) - deg(lo, f), `${f} Hz`).toBeCloseTo(90, 9)
    }
  })

  it('the series RLC at resonance reads exactly -90, 0 and +90 across C, R and L', () => {
    // Second order = 2 x 45° for the low- and high-pass outputs; the band-pass
    // numerator's own +90 cancels one corner's worth. And none of it moves
    // with R: damping reshapes the magnitude peak but the phase at ω₀ is
    // pinned by the LC cancellation alone.
    for (const r of [20, 100, 1000]) {
      const p = { ...defaultsOf('rlcSeries'), r }
      const f0 = 1 / (2 * Math.PI * Math.sqrt(p.l * p.c))
      expect(deg(transferOf('rlcSeries', p, 'c'), f0), `C, R=${r}`).toBeCloseTo(-90, 9)
      expect(deg(transferOf('rlcSeries', p, 'r'), f0), `R, R=${r}`).toBeCloseTo(0, 9)
      expect(deg(transferOf('rlcSeries', p, 'l'), f0), `L, R=${r}`).toBeCloseTo(90, 9)
    }
  })

  it('the tank is purely resistive at resonance: zero phase, whatever R is', () => {
    for (const r of [1000, 10000, 100000]) {
      const p = { ...defaultsOf('rlcParallel'), r }
      const f0 = 1 / (2 * Math.PI * Math.sqrt(p.l * p.c))
      expect(deg(transferOf('rlcParallel', p, 'z'), f0), `R=${r}`).toBeCloseTo(0, 9)
    }
    // ...and the crossing runs from inductive to capacitive, as the panel says:
    // +90° far below the peak, where Z ≈ sL, and −90° far above, where Z ≈ 1/sC.
    const p = defaultsOf('rlcParallel')
    const f0 = 1 / (2 * Math.PI * Math.sqrt(p.l * p.c))
    const z = transferOf('rlcParallel', p, 'z')
    expect(deg(z, f0 / 1e4)).toBeCloseTo(90, 1)
    expect(deg(z, f0 * 1e4)).toBeCloseTo(-90, 1)
  })

  it('the Sallen-Key lags exactly 90 degrees at f0, whatever Q the ratios chose', () => {
    // The panel says "whatever Q", so more than one Q gets measured: the
    // capacitor ratio swings Q without touching f₀'s pinned-phase argument.
    for (const c1 of [22e-9, 100e-9, 4.7e-9]) {
      const p = { ...defaultsOf('sallenKey'), c1 }
      const tf = transferOf('sallenKey', p, 'out')
      const f0 = CIRCUITS.sallenKey.metrics(p).w0 / (2 * Math.PI)
      expect(deg(tf, f0), `C1=${c1}`).toBeCloseTo(-90, 9)
      expect(deg(tf, f0 * 1e4), `C1=${c1}`).toBeCloseTo(-180, 1)
    }
  })

  it('the integrator holds +90 degrees at every frequency', () => {
    // 1/s costs a constant -90; the inversion adds 180. The sum never moves,
    // which is the frequency-domain face of "integration shifts everything a
    // quarter cycle" — and unlike every corner above, there is no corner.
    const tf = tfOf('integrator')
    for (const f of [0.1, 10, 1e3, 1e6]) {
      expect(deg(tf, f), `${f} Hz`).toBeCloseTo(90, 9)
    }
  })

  it('the integrator falls at 6.02 dB per octave AND 20 dB per decade', () => {
    // The slope row states both units, so both are measured.
    const tf = tfOf('integrator')
    expect(db(magnitudeAt(tf, 2000)) - db(magnitudeAt(tf, 1000))).toBeCloseTo(-6.0206, 3)
    expect(db(magnitudeAt(tf, 10000)) - db(magnitudeAt(tf, 1000))).toBeCloseTo(-20, 6)
  })
})

// The phase TRANSITION slope, measured before it is printed — because the
// "obvious" figure is a trap. The Bode sketch's −45° per decade per order is a
// straight-line approximation; the true curve's slope at the corner is
// −(ln 10)/2 rad/decade for one pole, and for a second-order section it is
// −2Q·ln 10 rad/decade — it follows Q, and no flat per-order number exists.
// Every slope here is a central difference of phaseAt against the closed form.
describe('phase transition slope at the corner', () => {
  // Degrees per decade of frequency, measured over ±1e-4 decades.
  const slopeAt = (tf, f) => {
    const h = 1e-4
    const up = phaseAt(tf, f * Math.pow(10, h))
    const dn = phaseAt(tf, f * Math.pow(10, -h))
    return (((up - dn) / (2 * h)) * 180) / Math.PI
  }
  const LN10 = Math.log(10)

  it('one pole crosses its corner at exactly −(ln 10)/2 rad per decade', () => {
    const want = (-(LN10 / 2) * 180) / Math.PI // −65.964°/decade
    for (const [id, fcOf] of [
      ['rcLow', (p) => 1 / (2 * Math.PI * p.r * p.c)],
      ['rlLow', (p) => 1 / (2 * Math.PI * (p.l / p.r))],
    ]) {
      const p = defaultsOf(id)
      expect(slopeAt(tfOf(id), fcOf(p)), id).toBeCloseTo(want, 5)
    }
    // The high-pass sheds its lead at the same rate the low-pass gains lag.
    const p = defaultsOf('rcHigh')
    expect(slopeAt(tfOf('rcHigh'), 1 / (2 * Math.PI * p.r * p.c))).toBeCloseTo(want, 5)
    // ...and the Bode sketch's −45°/decade is an approximation, not the tangent:
    // the true corner slope is steeper by ln(10)·90/π ÷ 45 ≈ 1.466.
    expect(Math.abs(want)).toBeGreaterThan(45)
  })

  it('a second-order corner crosses at −2Q·ln 10 rad per decade — Q decides, not order', () => {
    // Same denominator, three numerators whose phase contributions are
    // CONSTANT (0°, +90°, +180°) — so all three outputs cross f₀ at the same
    // Q-set rate, and changing R changes it.
    for (const r of [100, 316]) {
      const p = { ...defaultsOf('rlcSeries'), r }
      const f0 = 1 / (2 * Math.PI * Math.sqrt(p.l * p.c))
      const q = CIRCUITS.rlcSeries.metrics(p).q
      const want = ((-2 * q * LN10) * 180) / Math.PI
      for (const out of ['c', 'r', 'l']) {
        // 2 decimals of a ~800°/decade figure: the residual is the central
        // difference's own truncation error, not the physics.
        expect(slopeAt(transferOf('rlcSeries', p, out), f0), `R=${r}/${out}`).toBeCloseTo(want, 2)
      }
    }
    // The Sallen-Key too: its manufactured resonance pays the same phase bill.
    const p = defaultsOf('sallenKey')
    const m = CIRCUITS.sallenKey.metrics(p)
    const want = ((-2 * m.q * LN10) * 180) / Math.PI
    expect(slopeAt(tfOf('sallenKey'), m.w0 / (2 * Math.PI))).toBeCloseTo(want, 4)
  })
})

// The twin-T's whole story is where its zeros are, so every sentence about it
// is pinned here: zeros exactly ON the axis (the notch is removal, not
// attenuation), poles safely real and inside, Q refusing to follow any
// component, and the 180-degree phase snap that only an axis zero produces.
// The panel's Y(s) = X(s)·H(s) block prints "a sine in comes out |H| times
// as large and ∠H shifted" as a MEASURED row: sineResponse() runs the circuit
// through RK4 and demodulates the settled tail — a path that shares nothing
// with evaluating the polynomial at jω. These pin the two paths together at
// the sharpest points available: a corner, a Q-tall resonance (whose long
// ring is exactly what the settle-on-decay logic must survive), and the
// integrator's frequency-independent +90°.
describe('sines are eigenfunctions — simulated in time, not restated', () => {
  const deg = (r) => (r * 180) / Math.PI

  it('the RC at its corner: 1/√2 the size, 45 degrees late, out of RK4 alone', () => {
    const p = defaultsOf('rcLow')
    const fc = 1 / (2 * Math.PI * p.r * p.c)
    const r = sineResponse(tfOf('rcLow'), fc)
    expect(r.amplitude).toBeCloseTo(Math.SQRT1_2, 3)
    expect(deg(r.phase)).toBeCloseTo(-45, 1)
  })

  it('the series RLC at resonance: Q times the input, phase pinned at −90', () => {
    const p = defaultsOf('rlcSeries')
    const f0 = 1 / (2 * Math.PI * Math.sqrt(p.l * p.c))
    const Q = (1 / p.r) * Math.sqrt(p.l / p.c)
    const r = sineResponse(transferOf('rlcSeries', p, 'c'), f0)
    expect(r.amplitude).toBeCloseTo(Q, 2)
    expect(deg(r.phase)).toBeCloseTo(-90, 1)
  })

  it('the integrator: the running circuit leads by 90 degrees, DC offset and all', () => {
    // The sine response of −1/sRC carries a constant offset (the integral of
    // sin does not average to zero from t = 0); quadrature over whole cycles
    // must reject it exactly, or this row could never be printed.
    const p = defaultsOf('integrator')
    const f = 1 / (2 * Math.PI * p.r * p.c)
    const r = sineResponse(tfOf('integrator'), f)
    expect(r.amplitude).toBeCloseTo(1, 3)
    expect(deg(r.phase)).toBeCloseTo(90, 1)
  })
})

describe('twin-T notch', () => {
  const deg = (tf, f) => (phaseAt(tf, f) * 180) / Math.PI
  const p = defaultsOf('twinT')
  const tau = p.r * p.c
  const f0 = 1 / (2 * Math.PI * tau)

  it('has both zeros exactly on the jω axis, at ±j/RC', () => {
    const { zeros } = polesZeros(tfOf('twinT'))
    expect(zeros).toHaveLength(2)
    for (const [re, im] of zeros) {
      expect(re).toBeCloseTo(0, 12)
      expect(Math.abs(im)).toBeCloseTo(1 / tau, 6)
    }
  })

  it('removes the notch frequency rather than attenuating it', () => {
    const tf = tfOf('twinT')
    // Not "very small" - zero, to numerical precision, because the zero is on
    // the axis rather than merely near it.
    expect(magnitudeAt(tf, f0)).toBeLessThan(1e-12)
    // Either side of the hole, life goes on: unity at DC, unity far above.
    expect(dcGain(tf)).toBeCloseTo(1, 12)
    expect(magnitudeAt(tf, f0 * 1e4)).toBeCloseTo(1, 6)
    expect(magnitudeAt(tf, f0 / 1e4)).toBeCloseTo(1, 6)
  })

  it('keeps its poles real, at (−2±√3)/RC', () => {
    const { poles } = polesZeros(tfOf('twinT'))
    expect(poles).toHaveLength(2)
    const res = poles.map(([re]) => re).sort((a, b) => a - b)
    for (const [, im] of poles) expect(Math.abs(im)).toBeLessThan(1e-9)
    expect(res[0]).toBeCloseTo((-2 - Math.sqrt(3)) / tau, 3)
    expect(res[1]).toBeCloseTo((-2 + Math.sqrt(3)) / tau, 3)
  })

  it('has Q fixed at exactly 1/4, whatever R and C are chosen', () => {
    for (const [r, c] of [[10000, 10e-9], [1000, 100e-9], [220000, 1e-9]]) {
      const m = secondOrderMetrics(transferOf('twinT', { r, c }, 'out'))
      expect(m.q, `R=${r} C=${c}`).toBeCloseTo(0.25, 9)
      expect(CIRCUITS.twinT.metrics({ r, c }).q).toBe(0.25)
      // ...while the notch itself follows 1/(2πRC).
      expect(m.f0, `R=${r} C=${c}`).toBeCloseTo(1 / (2 * Math.PI * r * c), 6)
    }
  })

  it('snaps 180 degrees of phase across the notch: −90 just below, +90 just above', () => {
    const tf = tfOf('twinT')
    expect(deg(tf, f0 * (1 - 1e-6))).toBeCloseTo(-90, 2)
    expect(deg(tf, f0 * (1 + 1e-6))).toBeCloseTo(90, 2)
    // ...and both tails are quiet: no phase to speak of far from the notch.
    expect(deg(tf, f0 / 1e4)).toBeCloseTo(0, 1)
    expect(deg(tf, f0 * 1e4)).toBeCloseTo(0, 1)
  })
})
