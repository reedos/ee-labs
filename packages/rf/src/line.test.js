import { describe, it, expect } from 'vitest'
import { complex as cx } from '@ee-labs/network'
import { C0, sMatrix } from '@ee-labs/fields'
import { describeLine, inputImpedance, lineAbcd, lineTwoPort, rationalAvailable, refuseRational, sweepLine } from './line.js'
import { cascade, cascadeAbcd } from './cascade.js'
import { abcdToS, sToAbcd } from './convert.js'
import { mismatch } from './sparam.js'
import { logPick, rng } from './fuzz.js'

const { C, cabs, csub } = cx

const close = (a, b, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(a), Math.abs(b)))
const closeC = (x, y, tol = 1e-9) => expect(cabs(csub(x, y))).toBeLessThanOrEqual(tol * Math.max(1, cabs(x), cabs(y)))
const worstOf = (A, B) => {
  let w = 0
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) w = Math.max(w, cabs(csub(A[i][j], B[i][j])))
  return w
}

// The lab's line: PTFE at a relative permittivity of 2.1, so the phase
// velocity is c / sqrt(2.1) and a quarter wave at 1 GHz is 5.1719 cm. Nothing
// below types a length in: every one is computed from the permittivity and the
// frequency, as PROGRAM.md §6 requires.
const EPSR = 2.1
const VP = C0 / Math.sqrt(EPSR)
const quarterAt = (f) => VP / f / 4
const ptfe = (len, { alpha = 0 } = {}) => {
  const base = describeLine({ Z0: 50, vp: VP, len })
  if (alpha === 0) return base
  // A stated attenuation in nepers per metre, as a series resistance on the
  // per-metre four: alpha = R / (2 Z0) for a low-loss line.
  return describeLine({ L: base.L, C: base.C, R: 2 * alpha * base.Z0, G: 0, len })
}

describe('the line as a two-port at one frequency', () => {
  it('a quarter wave of 50 ohm line turns 100 ohms into 25 ohms exactly', () => {
    const l = quarterAt(1e9)
    close(l, 0.051719, 1e-4)
    const zin = inputImpedance(ptfe(l), C(100, 0), 1e9)
    close(zin.Z[0], 25, 1e-9)
    expect(Math.abs(zin.Z[1])).toBeLessThan(1e-9)
  })

  it('the same section reads 40 minus j30 at half the frequency and 100 ohms at twice it', () => {
    const line = ptfe(quarterAt(1e9))
    const half = inputImpedance(line, C(100, 0), 0.5e9)
    close(half.Z[0], 40, 1e-9)
    close(half.Z[1], -30, 1e-9)
    const twice = inputImpedance(line, C(100, 0), 2e9)
    close(twice.Z[0], 100, 1e-9)
    expect(Math.abs(twice.Z[1])).toBeLessThan(1e-8)
  })

  it('the magnitude of the reflection is the same at all three, because the line is lossless', () => {
    const line = ptfe(quarterAt(1e9))
    for (const f of [0.5e9, 1e9, 2e9]) {
      const zin = inputImpedance(line, C(100, 0), f)
      close(mismatch(cxReflect(zin.Z, 50)).mag, 1 / 3, 1e-9)
    }
  })

  it('the ABCD entries are cosh and sinh of gamma l, checked against the closed form', () => {
    const line = ptfe(quarterAt(1e9))
    const { m } = lineAbcd(line, 1e9)
    // At a quarter wave, cosh(j pi/2) = 0 and sinh(j pi/2) = j, so the matrix
    // is [[0, j Z0], [j / Z0, 0]] and the transformer identity follows.
    expect(cabs(m[0][0])).toBeLessThan(1e-12)
    closeC(m[0][1], C(0, 50), 1e-9)
    closeC(m[1][0], C(0, 1 / 50), 1e-9)
  })

  it('agrees entry for entry with the Fields Lab s-matrix it is built on', () => {
    const r = rng(31)
    for (let k = 0; k < 20; k++) {
      const len = logPick(r, 1e-3, 1)
      const f = logPick(r, 1e8, 1e10)
      const line = ptfe(len)
      const rec = lineTwoPort(line, f, { z0: 75 })
      const want = sMatrix(line, f, 75)
      expect(worstOf(rec.s, [[want.s11, want.s12], [want.s21, want.s22]]), `len ${len} at ${f}`).toBeLessThan(1e-9)
    }
  })

  it('a line whose own impedance is the reference is a pure delay', () => {
    const line = ptfe(0.1)
    const rec = lineTwoPort(line, 2.4e9, { z0: 50 })
    expect(cabs(rec.s[0][0])).toBeLessThan(1e-12)
    expect(cabs(rec.s[1][1])).toBeLessThan(1e-12)
    close(cabs(rec.s[1][0]), 1, 1e-12)
  })

  it('a lossy line takes the quarter wave from 25.000 to 25.097 ohms', () => {
    const alpha = 0.05
    close(alpha * 8.685889638065035, 0.4343, 1e-3)
    const l = quarterAt(1e9)
    const zin = inputImpedance(ptfe(l, { alpha }), C(100, 0), 1e9)
    close(zin.Z[0], 25.097, 1e-4)
  })
})

// ---------------------------------------------------------------- invariant 6

describe('invariant 6: N sections of a line equal one section of the whole', () => {
  it('holds for every N from one to eight, lossless and lossy', () => {
    const r = rng(97)
    for (let trial = 0; trial < 12; trial++) {
      const len = logPick(r, 1e-3, 0.5)
      const f = logPick(r, 1e8, 5e9)
      const alpha = trial % 2 === 0 ? 0 : 0.2
      const line = ptfe(len, { alpha })
      const whole = lineAbcd(line, f).m
      for (let n = 1; n <= 8; n++) {
        const one = lineAbcd(line, f, { atLength: len / n }).m
        let acc = one
        for (let k = 1; k < n; k++) acc = cascadeAbcd(acc, one)
        expect(worstOf(acc, whole), `N = ${n}, len ${len}, ${f} Hz, alpha ${alpha}`).toBeLessThan(1e-9 * Math.max(1, ...whole.flat().map(cabs)))
      }
    }
  })

  it('holds through the scattering route too, so the two descriptions agree', () => {
    const len = 0.2
    const f = 1.7e9
    const line = ptfe(len)
    const whole = lineTwoPort(line, f, { z0: 50 })
    const parts = [0, 1, 2, 3].map(() => lineTwoPort(line, f, { z0: 50, atLength: len / 4 }))
    expect(worstOf(cascade(parts).s, whole.s)).toBeLessThan(1e-9)
  })

  it('a line a whole wavelength long is the identity, which is the hostile corner', () => {
    const f = 1e9
    const line = ptfe(VP / f)
    const { m } = lineAbcd(line, f)
    closeC(m[0][0], C(1, 0), 1e-9)
    expect(cabs(m[0][1])).toBeLessThan(1e-6)
    expect(cabs(m[1][0])).toBeLessThan(1e-9)
    const rec = lineTwoPort(line, f, { z0: 50 })
    close(cabs(rec.s[1][0]), 1, 1e-9)
  })

  it('a zero-length section is the identity, so the split has a base case', () => {
    const { m } = lineAbcd(ptfe(0.1), 1e9, { atLength: 0 })
    closeC(m[0][0], C(1, 0), 1e-15)
    expect(cabs(m[0][1])).toBeLessThan(1e-15)
    expect(() => lineAbcd(ptfe(0.1), 1e9, { atLength: -1 })).toThrow(/not negative/)
  })
})

// ---------------------------------------------------------------- invariant 7

describe('invariant 7: the line is not rational, and the refusal says why', () => {
  it('declines the hand-over on a lossless line, naming the transcendental factor', () => {
    const line = ptfe(0.1)
    expect(() => refuseRational(line)).toThrow(/transcendental/)
    expect(() => refuseRational(line)).toThrow(/no finite poles and no finite zeros/)
    expect(() => refuseRational(line)).toThrow(/exact at every single frequency/)
  })

  it('declines it on a lossy line for the same reason', () => {
    const line = ptfe(0.1, { alpha: 0.05 })
    expect(() => refuseRational(line)).toThrow(/transcendental/)
    expect(() => refuseRational(line)).toThrow(/lossy/)
  })

  it('offers the refusal as a sentence, so the pane never sees an exception', () => {
    for (const alpha of [0, 0.05]) {
      const said = rationalAvailable(ptfe(0.1, { alpha }))
      expect(said.ok).toBe(false)
      expect(said.kind).toBe('no-rational-line')
      expect(said.says.length).toBeGreaterThan(120)
      expect(said.says).toMatch(/lineTwoPort/)
    }
  })

  it('the sweep it points at is exact at every one of its points', () => {
    const line = ptfe(quarterAt(1e9))
    const sweep = sweepLine(line, C(100, 0), { from: 0.5e9, to: 2e9, points: 241 })
    expect(sweep.points).toBe(241)
    expect(sweep.f.length).toBe(241)
    for (let k = 0; k < sweep.points; k++) {
      const want = inputImpedance(line, C(100, 0), sweep.f[k]).Z
      closeC(sweep.Z[k], want, 1e-12)
      // A lossless line moves the reflection round a circle and never off it.
      close(cabs(sweep.gamma[k]), 1 / 3, 1e-9)
    }
    // The three frequencies the lesson names land on sweep points.
    close(sweep.f[0], 0.5e9, 1e-12)
    close(sweep.f[80], 1e9, 1e-9)
    close(sweep.f[240], 2e9, 1e-12)
    expect(() => sweepLine(line, C(100, 0), { from: 0, to: 1e9 })).toThrow(/positive frequency/)
    expect(() => sweepLine(line, C(100, 0), { from: 1e9, to: 2e9, points: 1 })).toThrow(/at least two points/)
  })
})

/** The reflection of an impedance against a real reference, for the checks above. */
function cxReflect(Z, z0) {
  const num = csub(Z, C(z0, 0))
  const den = C(Z[0] + z0, Z[1])
  return cx.cdiv(num, den)
}
