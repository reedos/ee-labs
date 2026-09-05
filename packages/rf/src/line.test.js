import { describe, it, expect } from 'vitest'
import { complex as cx } from '@ee-labs/network'
import { RfError } from './const.js'
import {
  C0,
  dbPerMetre,
  electricalLength,
  inputImpedance,
  lineAbcd,
  lineSparam,
  npPerMetre,
  phaseVelocity,
  quarterWaveZ0,
  rationalAvailable,
  refuseRational,
  repeatFrequency,
  sweepLine,
  uniformLine,
} from './line.js'
import { entryOf, reflection } from './sparam.js'
import { chainViaAbcd } from './cascade.js'
import { mdiff } from './convert.js'

// The line at one frequency, checked against the closed form a book gives, and
// then checked against itself split into pieces.
//
// Every length below is computed from the phase velocity and the frequency, so
// a quarter wave is exactly a quarter wave and not a rounded centimetre count.

const { C, cabs, cadd, cdiv, cmul, csub } = cx

const Z0 = 50
const EPSR = 2.1
const F0 = 1e9
const VP = phaseVelocity(EPSR)
const QUARTER = VP / (4 * F0)

const close = (got, want, tol = 1e-10) => expect(Math.abs(got - want)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(want)))
const closeC = (got, want, tol = 1e-10) => expect(cabs(csub(got, want))).toBeLessThanOrEqual(tol * Math.max(1, cabs(want)))

/** Zin of a LOSSLESS line, written out from the tangent, not from the module. */
function zinByHand(Z0line, ZL, betaL) {
  const t = C(0, Math.tan(betaL))
  const zl = Array.isArray(ZL) ? ZL : C(ZL)
  const z0 = C(Z0line)
  return cmul(z0, cdiv(cadd(zl, cmul(z0, t)), cadd(z0, cmul(zl, t))))
}

describe('the line as a description', () => {
  it('takes its phase velocity from the dielectric constant', () => {
    close(phaseVelocity(1), C0)
    close(VP, C0 / Math.sqrt(EPSR))
    close((100 * VP) / C0, 69.0066, 1e-5)
  })

  it('has the wavelength and the electrical length the frequency gives', () => {
    const line = uniformLine({ Z0, epsr: EPSR, len: QUARTER })
    const el = electricalLength(line, F0)
    close(el.lambda, VP / F0)
    close(el.degrees, 90)
    close(el.wavelengths, 0.25)
    close(el.Z0, Z0)
    // Twice the frequency is twice the electrical length, in the same copper.
    close(electricalLength(line, 2 * F0).degrees, 180)
    close(electricalLength(line, F0 / 2).degrees, 45)
  })

  it('carries the loss the knob asked for at every frequency, in both units', () => {
    const alpha = 0.05
    for (const f of [1e8, 1e9, 1e10]) {
      const line = uniformLine({ Z0, epsr: EPSR, len: 1, alpha })
      close(electricalLength(line, f).alpha, alpha)
      // The characteristic impedance stays real, which is what R/L = G/C buys.
      close(electricalLength(line, f).Z0, Z0)
    }
    close(dbPerMetre(alpha), alpha * 8.685889638065035, 1e-12)
    close(npPerMetre(dbPerMetre(alpha)), alpha, 1e-12)
  })
})

describe('the line transforms impedance', () => {
  const line = uniformLine({ Z0, epsr: EPSR, len: QUARTER })

  it('agrees with the closed form at every frequency tried', () => {
    for (const f of [0.25e9, 0.5e9, 1e9, 1.5e9, 2e9, 2.7e9]) {
      const beta = (2 * Math.PI * f) / VP
      closeC(inputImpedance(line, 100, f).Z, zinByHand(Z0, 100, beta * QUARTER), 1e-9)
    }
  })

  it('turns 100 ohms into 25 at a quarter wave, and back into 100 at a half', () => {
    close(inputImpedance(line, 100, F0).Z[0], (Z0 * Z0) / 100)
    expect(Math.abs(inputImpedance(line, 100, F0).Z[1])).toBeLessThan(1e-12)
    close(inputImpedance(line, 100, 2 * F0).Z[0], 100)
  })

  it('reads 40 − j30 at half the frequency, which is 45 degrees of line', () => {
    const zin = inputImpedance(line, 100, F0 / 2).Z
    close(zin[0], 40)
    close(zin[1], -30)
    close(electricalLength(line, F0 / 2).degrees, 45)
  })

  it('keeps the reflection magnitude, because a lossless line loses nothing', () => {
    const atLoad = cabs(reflection(100, Z0))
    for (const f of [0.3e9, 0.7e9, 1e9, 1.9e9]) {
      close(cabs(reflection(inputImpedance(line, 100, f).Z, Z0)), atLoad, 1e-10)
    }
  })

  it('a quarter-wave transformer matches, and its impedance is the geometric mean', () => {
    close(quarterWaveZ0(50, 100), Math.sqrt(5000))
    const t = uniformLine({ Z0: quarterWaveZ0(50, 100), epsr: EPSR, len: QUARTER })
    close(inputImpedance(t, 100, F0).Z[0], 50)
    expect(Math.abs(inputImpedance(t, 100, F0).Z[1])).toBeLessThan(1e-11)
  })

  it('a reactive load has no quarter-wave transformer, and the refusal says where to go', () => {
    expect(() => quarterWaveZ0([30, -40], 50)).toThrow(RfError)
  })
})

describe('loss on the line', () => {
  const alpha = 0.05
  const lossy = uniformLine({ Z0, epsr: EPSR, len: QUARTER, alpha })

  it('moves the transformed impedance off the lossless value', () => {
    const zin = inputImpedance(lossy, 100, F0).Z
    close(zin[0], 25.0968, 1e-4)
    expect(zin[0]).toBeGreaterThan(25)
  })

  it('shrinks the reflection seen at the source by exactly two passes of the loss', () => {
    const atLoad = cabs(reflection(100, Z0))
    const atSource = cabs(reflection(inputImpedance(lossy, 100, F0).Z, Z0))
    close(atSource, atLoad * Math.exp(-2 * alpha * QUARTER), 1e-9)
    expect(atSource).toBeLessThan(atLoad)
  })

  it('costs the same decibels each way, and twice that on the round trip', () => {
    close(dbPerMetre(alpha * QUARTER), 0.0224623, 1e-5)
    close(dbPerMetre(2 * alpha * QUARTER), 2 * dbPerMetre(alpha * QUARTER))
  })
})

describe('the line as a two-port', () => {
  it('is a pure delay when its own impedance is the reference', () => {
    const line = uniformLine({ Z0, epsr: EPSR, len: QUARTER })
    const sp = lineSparam(line, F0, { z0: Z0 })
    expect(entryOf(sp, 0, 0).mag).toBeLessThan(1e-12)
    close(entryOf(sp, 1, 0).mag, 1, 1e-12)
    close(entryOf(sp, 1, 0).deg, -90, 1e-9)
  })

  it('splits into N sections that cascade back to the whole, for every N', () => {
    for (const alpha of [0, 0.05, 0.4]) {
      const whole = uniformLine({ Z0: 70.7, epsr: EPSR, len: 0.13, alpha })
      const spWhole = lineSparam(whole, 1.7e9, { z0: Z0 })
      for (const N of [2, 3, 5, 8]) {
        const piece = uniformLine({ Z0: 70.7, epsr: EPSR, len: 0.13 / N, alpha })
        const parts = Array.from({ length: N }, () => lineSparam(piece, 1.7e9, { z0: Z0 }))
        expect(mdiff(chainViaAbcd(parts).s, spWhole.s), `N = ${N}, alpha = ${alpha}`).toBeLessThan(1e-11)
      }
    }
  })

  it('has the chain matrix the hyperbolic functions give, with determinant one', () => {
    const line = uniformLine({ Z0: 75, epsr: 2.4, len: 0.07, alpha: 0.02 })
    const { abcd } = lineAbcd(line, 3.2e9)
    // cosh² − sinh² = 1, so AD − BC = 1 for any length of any uniform line.
    const det = csub(cmul(abcd[0][0], abcd[1][1]), cmul(abcd[0][1], abcd[1][0]))
    closeC(det, C(1), 1e-12)
    // A equals D, which is what makes a uniform line symmetric.
    closeC(abcd[0][0], abcd[1][1], 1e-12)
  })
})

describe('the line has no transfer function, and the sweep is what there is instead', () => {
  const lossless = uniformLine({ Z0, epsr: EPSR, len: QUARTER })
  const lossy = uniformLine({ Z0, epsr: EPSR, len: QUARTER, alpha: 0.05 })

  it('repeats for ever, at exactly the frequency the length sets', () => {
    for (const line of [lossless, lossy]) {
      const repeat = repeatFrequency(line, F0)
      close(repeat, VP / (2 * QUARTER))
      close(repeat, 2e9, 1e-9)
      for (const f of [0.3e9, 0.7e9, 1.3e9, 1.9e9]) {
        closeC(inputImpedance(line, 100, f).Z, inputImpedance(line, 100, f + repeat).Z, 1e-11)
        closeC(inputImpedance(line, 100, f).Z, inputImpedance(line, 100, f + 5 * repeat).Z, 1e-9)
      }
    }
  })

  it('declines the hand-over to the rational core, lossless and lossy alike', () => {
    for (const line of [lossless, lossy]) {
      expect(() => refuseRational(line, F0)).toThrow(RfError)
      const said = rationalAvailable(line, F0)
      expect(said.ok).toBe(false)
      expect(said.says).toMatch(/no rational transfer function/)
      expect(said.says).toMatch(/e\^\(-gamma l\)/)
      expect(said.says).toMatch(/no finite poles and no finite zeros/)
      // The refusal names what is available instead.
      expect(said.says).toMatch(/exact at every frequency/)
      close(said.delay, QUARTER / VP, 1e-12)
    }
  })

  it('the refusal carries the delay the length and the phase velocity give', () => {
    try {
      refuseRational(lossless, F0)
    } catch (err) {
      close(err.detail.delay * 1e12, 250, 1e-4)
      expect(err.kind).toBe('not-rational')
    }
  })

  it('the sweep is the closed form at every one of its points, and nothing between them', () => {
    const points = 241
    const sweep = sweepLine(lossless, 100, { from: 0.1e9, to: 4.1e9, points, z0: Z0 })
    expect(sweep.length).toBe(points)
    for (const p of sweep) {
      const beta = (2 * Math.PI * p.f) / VP
      closeC(p.Z, zinByHand(Z0, 100, beta * QUARTER), 1e-8)
      close(p.mag, cabs(reflection(100, Z0)), 1e-9)
    }
  })

  it('a sweep of one point is declined, because a sweep needs two', () => {
    expect(() => sweepLine(lossless, 100, { from: 1e9, to: 2e9, points: 1 })).toThrow(RfError)
  })
})
