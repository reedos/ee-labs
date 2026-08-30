import { describe, it, expect } from 'vitest'
import { LESSONS, LESSON_GROUPS, applyLesson } from './lessons.js'
import { CIRCUITS, transferOf, defaultsOf } from './circuits.js'
import { asDigitalFilter } from './toSignalLab.js'
import {
  magnitudeAt,
  phaseAt,
  dcGain,
  polesZeros,
  secondOrderMetrics,
  stepResponse,
} from '@ee-labs/systems'

// Every lesson makes a claim, so every claim is rendered and measured.
//
// Signal Lab's equivalent tests caught four confidently wrong explanations. The
// point is not that these particular numbers are hard to get right — it is that
// a note is prose, prose drifts from the code beneath it, and a reader has no
// way to tell. A test is the only thing standing between a teaching tool and
// teaching something false.

const db = (a) => 20 * Math.log10(a)
const deg = (r) => (r * 180) / Math.PI
const tfOf = (l) => {
  const s = applyLesson(l)
  return transferOf(s.id, s.params, s.output || CIRCUITS[s.id].outputs[0].key)
}
const byName = (n) => {
  const l = LESSONS.find((x) => x.name === n)
  if (!l) throw new Error(`no lesson "${n}"`)
  return l
}

describe('the lesson list itself', () => {
  it('every lesson names a real circuit, group and output', () => {
    for (const l of LESSONS) {
      expect(LESSON_GROUPS, l.name).toContain(l.group)
      const c = CIRCUITS[l.patch.circuit]
      expect(c, `${l.name}: circuit ${l.patch.circuit}`).toBeTruthy()
      if (l.patch.output) {
        expect(c.outputs.map((o) => o.key), l.name).toContain(l.patch.output)
      }
      expect(['step', 'pz'], l.name).toContain(l.patch.view)
      expect(l.note.length, l.name).toBeGreaterThan(80)
    }
  })

  it('covers every group, and most circuits', () => {
    for (const g of LESSON_GROUPS) {
      expect(LESSONS.filter((l) => l.group === g).length, g).toBeGreaterThan(0)
    }
    const used = new Set(LESSONS.map((l) => l.patch.circuit))
    expect(used.size).toBeGreaterThanOrEqual(Object.keys(CIRCUITS).length - 1)
  })

  it('produces a finite response for every lesson as loaded', () => {
    for (const l of LESSONS) {
      const tf = tfOf(l)
      for (const f of [0.1, 100, 1e5]) {
        expect(Number.isFinite(magnitudeAt(tf, f)), `${l.name} at ${f} Hz`).toBe(true)
      }
    }
  })
})

describe('the claims each lesson makes', () => {
  it('a divider really is flat, at every frequency', () => {
    const tf = tfOf(byName('A divider has no dynamics'))
    const at = magnitudeAt(tf, 1)
    expect(at).toBeCloseTo(0.5, 12)
    for (const f of [1e-3, 1, 1e3, 1e6, 1e9]) {
      expect(magnitudeAt(tf, f), `${f} Hz`).toBeCloseTo(at, 12)
      expect(phaseAt(tf, f), `${f} Hz`).toBeCloseTo(0, 12)
    }
    expect(polesZeros(tf).poles).toHaveLength(0)
  })

  it('the corner is −3.01 dB and 45°, and moves as 1/(2πRC)', () => {
    const l = byName('Where the corner comes from')
    const s = applyLesson(l)
    const fc = 1 / (2 * Math.PI * s.params.r * s.params.c)
    const tf = tfOf(l)
    expect(db(magnitudeAt(tf, fc))).toBeCloseTo(-3.0103, 4)
    expect(deg(phaseAt(tf, fc))).toBeCloseTo(-45, 6)

    // ...and it is 1/(2 pi RC), not something that merely looks like it.
    for (const [r, c] of [[2200, 47e-9], [10000, 10e-9]]) {
      const moved = transferOf('rcLow', { r, c }, 'c')
      const want = 1 / (2 * Math.PI * r * c)
      expect(db(magnitudeAt(moved, want)), `${r}/${c}`).toBeCloseTo(-3.0103, 4)
    }
  })

  it('the two RC outputs are exactly complementary', () => {
    const par = defaultsOf('rcLow')
    const lo = transferOf('rcLow', par, 'c')
    const hi = transferOf('rcHigh', par, 'r')
    for (const f of [10, 100, 1591.5, 1e4, 1e5]) {
      const a = magnitudeAt(lo, f)
      const b = magnitudeAt(hi, f)
      expect(a * a + b * b, `${f} Hz`).toBeCloseTo(1, 10)
    }
  })

  it('the RL low-pass is the RC low-pass with L/R for RC', () => {
    const l = byName('Different physics, same algebra')
    const s = applyLesson(l)
    const rl = tfOf(l)
    const tau = s.params.l / s.params.r
    const rc = transferOf('rcLow', { r: 1, c: tau }, 'c')
    for (const f of [1, 50, 500, 5000]) {
      expect(magnitudeAt(rl, f), `${f} Hz`).toBeCloseTo(magnitudeAt(rc, f), 12)
      expect(phaseAt(rl, f), `${f} Hz`).toBeCloseTo(phaseAt(rc, f), 12)
    }
  })

  it('one circuit really does give three different filters', () => {
    const par = defaultsOf('rlcSeries')
    const f0 = 1 / (2 * Math.PI * Math.sqrt(par.l * par.c))
    const lo = transferOf('rlcSeries', par, 'c')
    const bp = transferOf('rlcSeries', par, 'r')
    const hi = transferOf('rlcSeries', par, 'l')

    // Different at DC, different at infinity — genuinely three shapes.
    expect(dcGain(lo)).toBeCloseTo(1, 12)
    expect(dcGain(bp)).toBeCloseTo(0, 12)
    expect(dcGain(hi)).toBeCloseTo(0, 12)
    expect(magnitudeAt(hi, f0 * 1e4)).toBeCloseTo(1, 3)
    expect(magnitudeAt(lo, f0 * 1e4)).toBeLessThan(1e-6)

    // ...and they still sum to the input, which is Kirchhoff.
    for (const f of [f0 / 8, f0, f0 * 8]) {
      let re = 0
      let im = 0
      for (const tf of [lo, bp, hi]) {
        const m = magnitudeAt(tf, f)
        const ph = phaseAt(tf, f)
        re += m * Math.cos(ph)
        im += m * Math.sin(ph)
      }
      expect(re, `${f} Hz`).toBeCloseTo(1, 8)
      expect(im, `${f} Hz`).toBeCloseTo(0, 8)
    }
  })

  it('doubling R halves Q, exactly', () => {
    const q = (r) => CIRCUITS.rlcSeries.metrics({ ...defaultsOf('rlcSeries'), r }).q
    expect(q(40)).toBeCloseTo(q(20) / 2, 9)
    expect(q(20)).toBeGreaterThan(q(200))
    // The lesson loads at R = 20, where the resonance is clearly visible.
    const l = byName('Q is how sharp, and R sets it')
    expect(applyLesson(l).params.r).toBe(20)
    expect(secondOrderMetrics(tfOf(l)).q).toBeGreaterThan(4)
  })

  it('the tank inverts R’s role and peaks at exactly R', () => {
    const par = defaultsOf('rlcParallel')
    const f0 = 1 / (2 * Math.PI * Math.sqrt(par.l * par.c))
    expect(magnitudeAt(tfOf(byName('The same R, the opposite effect')), f0)).toBeCloseTo(par.r, 4)

    const q = (r) => CIRCUITS.rlcParallel.metrics({ ...par, r }).q
    expect(q(40000)).toBeCloseTo(q(20000) * 2, 9) // proportional, not inverse
    const qs = (r) => CIRCUITS.rlcSeries.metrics({ ...defaultsOf('rlcSeries'), r }).q
    expect(qs(40)).toBeCloseTo(qs(20) / 2, 9) // the series case, for contrast
  })

  it('overshoot follows ζ, and stops at Q = 0.5 rather than 0.707', () => {
    const l = byName('Resonance, seen in time')
    const tf = tfOf(l)
    const m = secondOrderMetrics(tf)
    const { y } = stepResponse(tf, { duration: 20 / (m.zeta * m.wn), points: 4000 })
    expect(Math.max(...y) - 1).toBeCloseTo(m.overshoot, 2)

    // The claim in the note, checked at the two values it names.
    const at = (q) => {
      const z = 1 / (2 * q)
      return z < 1 ? Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z)) : 0
    }
    expect(at(0.5)).toBe(0)
    expect(at(Math.SQRT1_2)).toBeCloseTo(0.043, 3)
  })

  it('Sallen–Key has a complex pair and no inductor', () => {
    const l = byName('Why active filters exist')
    const { poles } = polesZeros(tfOf(l))
    expect(poles).toHaveLength(2)
    expect(Math.abs(poles[0][1]), 'poles must be complex, or it cannot ring').toBeGreaterThan(0)
    // No parameter of this circuit is an inductance.
    for (const par of CIRCUITS.sallenKey.params) expect(par.unit).not.toBe('H')

    // Two cascaded RC sections, by contrast, can only give real poles.
    const cascade = { b: [1], a: [1e-4 * 1e-4, 2e-4, 1] }
    for (const [, im] of polesZeros(cascade).poles) expect(Math.abs(im)).toBeLessThan(1e-9)
  })

  it('the inverting amplifier really is negative', () => {
    const l = byName('Gain is a ratio, and negative')
    const s = applyLesson(l)
    const tf = tfOf(l)
    expect(dcGain(tf)).toBeCloseTo(-s.params.rf / s.params.rin, 9)
    expect(Math.abs(deg(phaseAt(tf, 0.001)))).toBeCloseTo(180, 4)
    // And it is a ratio: scaling both resistors leaves the gain alone.
    const scaled = transferOf('inverting', { ...s.params, rin: s.params.rin * 7, rf: s.params.rf * 7 }, 'out')
    expect(dcGain(scaled)).toBeCloseTo(dcGain(tf), 9)
  })

  it('the integrator’s pole is at the origin and its step never settles', () => {
    const l = byName('A pole exactly at the origin')
    const s = applyLesson(l)
    const tf = tfOf(l)
    const { poles } = polesZeros(tf)
    expect(poles).toHaveLength(1)
    expect(Math.hypot(poles[0][0], poles[0][1])).toBeCloseTo(0, 12)

    const { t, y } = stepResponse(tf, { duration: 10 * s.params.r * s.params.c, points: 600 })
    // A ramp: the output at the end is proportional to the time elapsed.
    expect(y[y.length - 1]).toBeCloseTo(-t[t.length - 1] / (s.params.r * s.params.c), 2)
    expect(Math.abs(y[y.length - 1])).toBeGreaterThan(Math.abs(y[Math.floor(y.length / 2)]) * 1.8)
  })

  it('the bridge lesson really does hand over a low-pass biquad', () => {
    const l = byName('This circuit is a biquad')
    const d = asDigitalFilter(tfOf(l), { sampleRate: 192000 })
    expect(d.shape).toBe(l.claim.handsOver)
    expect(d.link).toBeTruthy()
    // The note quotes these two numbers, so they had better be these numbers.
    expect(d.f0 / 1000).toBeCloseTo(5.03, 1)
    expect(d.q).toBeCloseTo(3.16, 1)
  })
})
