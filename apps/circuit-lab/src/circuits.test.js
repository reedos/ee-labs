import { describe, it, expect } from 'vitest'
import { CIRCUITS, CIRCUIT_GROUPS, transferOf, defaultsOf } from './circuits.js'
import {
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
