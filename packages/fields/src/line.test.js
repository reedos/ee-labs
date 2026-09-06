import { describe, it, expect } from 'vitest'
import {
  ccosh,
  csinh,
  ctanh,
  describeLine,
  gammaToZ,
  inputImpedance,
  lineAt,
  lineFromGeometry,
  lineStandingWave,
  loadFromGamma,
  normalise,
  quarterWave,
  reactanceCircle,
  reflectionCoefficient,
  refuseLossyTime,
  resistanceCircle,
  sMatrix,
  timeDomainAvailable,
  towardsGenerator,
  zToGamma,
} from './line.js'
import { capacitance, inductance } from './closed.js'
import { C0, FieldsError } from './const.js'
import { logUniform, randomGeometry, relative, rng, uniform } from './fuzz.js'

// Invariants 8, 9 and 10.
//
//   8   the input impedance at every frequency equals the closed form
//   9   S21 equals S12, on lossy and lossless lines alike
//   10  the lossy line in time is declined with its reason
//
// The first is checked two ways, because a closed form checked against itself
// proves nothing. The quarter-wave inversion, the half-wave repeat and the open
// stub's short are three independent statements about the same expression, and
// each is checked at many frequencies and lengths.

const mag = (z) => Math.hypot(z[0], z[1])
const deg = (z) => (Math.atan2(z[1], z[0]) * 180) / Math.PI

describe('a line, described two ways', () => {
  it('(Z0, vp) and the per-metre four describe the same object', () => {
    const a = describeLine({ Z0: 50, vp: 2e8, len: 2 })
    const b = describeLine({ L: a.L, C: a.C, len: 2 })
    expect(relative(a.Z0, b.Z0)).toBeLessThan(1e-14)
    expect(relative(a.vp, b.vp)).toBeLessThan(1e-14)
    expect(relative(a.delay, b.delay)).toBeLessThan(1e-14)
  })

  it('a 50 ohm line at 2e8 is 250 nH and 100 pF per metre', () => {
    const a = describeLine({ Z0: 50, vp: 2e8, len: 2 })
    expect(a.L * 1e9).toBeCloseTo(250, 6)
    expect(a.C * 1e12).toBeCloseTo(100, 6)
    expect(a.delay * 1e9).toBeCloseTo(10, 6)
  })

  it('a described line read again keeps its losses', () => {
    // The bug this test is named for: a described line carries both Z0 and the
    // per-metre four, so a describeLine that read Z0 first would turn a lossy
    // line into a lossless one and every later call would agree with it.
    const once = describeLine({ R: 0.5, L: 250e-9, G: 1e-6, C: 100e-12, len: 100 })
    expect(once.lossy).toBe(true)
    const twice = describeLine(once)
    expect(twice.lossy).toBe(true)
    expect(twice.R).toBe(0.5)
    expect(twice.G).toBe(1e-6)
    expect(lineAt(once, 1e6).lossless).toBe(false)
    expect(timeDomainAvailable(once).ok).toBe(false)
  })

  it('a signal faster than light is declined', () => {
    expect(() => describeLine({ Z0: 50, vp: 4e8 })).toThrow(/must not exceed the speed of light/)
  })

  it('a line from a geometry has the speed the dielectric gives it', () => {
    const r = rng(0x11a3)
    for (const kind of ['coax', 'twoWire', 'wireOverGround']) {
      for (let k = 0; k < 20; k++) {
        const g = randomGeometry(r, kind)
        g.mur = 1
        const ln = lineFromGeometry(g)
        expect(relative(ln.vp, C0 / Math.sqrt(g.epsr)), kind).toBeLessThan(1e-9)
        expect(relative(ln.Z0, Math.sqrt(inductance(g).perMetre / capacitance(g).perMetre))).toBeLessThan(1e-14)
      }
    }
  })

  it('RG-58 gives 47.45 ohms at two thirds of the speed of light', () => {
    const ln = lineFromGeometry({ kind: 'coax', a: 0.45e-3, b: 1.475e-3, epsr: 2.25 }, { len: 2 })
    expect(ln.Z0).toBeCloseTo(47.45, 2)
    expect(ln.vp / C0).toBeCloseTo(1 / 1.5, 6)
  })

  it('a geometry with no per-metre pair cannot be a line', () => {
    expect(() => lineFromGeometry({ kind: 'spherical', a: 0.01, b: 0.02 })).toThrow(/no closed-form inductance/)
  })
})

describe('the propagation constant', () => {
  it('a lossless line has alpha exactly zero and Z0 exactly real', () => {
    const r = rng(0x9a)
    for (let k = 0; k < 40; k++) {
      const at = lineAt({ Z0: logUniform(r, 10, 300), vp: logUniform(r, 1e8, 2.9e8), len: 1 }, logUniform(r, 1e3, 1e11))
      expect(at.alpha).toBe(0)
      expect(at.Z0[1]).toBe(0)
      expect(at.lossless).toBe(true)
      expect(relative(at.lambda, at.vp / at.f)).toBeLessThan(1e-14)
    }
  })

  it('a lossy line attenuates, and its Z0 turns capacitive', () => {
    const ln = { R: 0.5, L: 250e-9, G: 1e-6, C: 100e-12, len: 100 }
    const lo = lineAt(ln, 1e4)
    const hi = lineAt(ln, 1e6)
    expect(lo.alpha).toBeGreaterThan(0)
    expect(lo.Z0deg).toBeLessThan(0)
    expect(hi.Z0deg).toBeLessThan(0)
    // As frequency rises the line approaches its lossless limit.
    expect(Math.abs(hi.Z0deg)).toBeLessThan(Math.abs(lo.Z0deg))
    expect(relative(hi.Z0mag, 50)).toBeLessThan(0.05)
  })

  it('the lossy line disperses, which is what makes its step response impossible', () => {
    const ln = { R: 0.5, L: 250e-9, G: 1e-6, C: 100e-12, len: 100 }
    const slow = lineAt(ln, 1e4).vp
    const fast = lineAt(ln, 1e6).vp
    expect(relative(fast, slow)).toBeGreaterThan(0.5)
  })

  it('the attenuation in decibels is the nepers times 8.686', () => {
    const at = lineAt({ R: 0.5, L: 250e-9, G: 1e-6, C: 100e-12, len: 100 }, 1e6)
    expect(relative(at.dbPerMetre, at.alpha * 20 * Math.log10(Math.E))).toBeLessThan(1e-14)
  })

  it('the hyperbolic functions satisfy their own identity', () => {
    const r = rng(0x9b)
    for (let k = 0; k < 40; k++) {
      const z = [uniform(r, -3, 3), uniform(r, -3, 3)]
      const c = ccosh(z)
      const s = csinh(z)
      // cosh^2 - sinh^2 = 1.
      const re = c[0] * c[0] - c[1] * c[1] - (s[0] * s[0] - s[1] * s[1])
      const im = 2 * c[0] * c[1] - 2 * s[0] * s[1]
      expect(Math.abs(re - 1)).toBeLessThan(1e-12)
      expect(Math.abs(im)).toBeLessThan(1e-12)
      // tanh is sinh over cosh.
      const t = ctanh(z)
      expect(relative(t[0], (s[0] * c[0] + s[1] * c[1]) / (c[0] * c[0] + c[1] * c[1]))).toBeLessThan(1e-10)
    }
  })
})

describe('the reflection coefficient', () => {
  it('an open gives exactly one, a short exactly minus one, a match exactly zero', () => {
    expect(reflectionCoefficient(Infinity, 50)).toEqual([1, 0])
    expect(reflectionCoefficient(0, 50)[0]).toBe(-1)
    expect(reflectionCoefficient(50, 50)[0]).toBe(0)
  })

  it('maps back to the load it came from', () => {
    const r = rng(0x9c)
    for (let k = 0; k < 60; k++) {
      const Z0 = logUniform(r, 10, 300)
      const ZL = [logUniform(r, 0.1, 5000), uniform(r, -3000, 3000)]
      const g = reflectionCoefficient(ZL, Z0)
      const back = loadFromGamma(g, Z0)
      // A load far from Z0 has a reflection coefficient close to the unit
      // circle, so 1 - Gamma is a difference of two nearly equal numbers and the
      // round trip gives back nine or ten figures rather than fifteen. That is
      // the arithmetic, not the formula.
      expect(relative(back[0], ZL[0])).toBeLessThan(1e-9)
      expect(relative(back[1], ZL[1])).toBeLessThan(1e-9)
    }
  })

  it('a passive load never reflects more than it receives', () => {
    const r = rng(0x9d)
    for (let k = 0; k < 60; k++) {
      const g = reflectionCoefficient([logUniform(r, 0.01, 1e4), uniform(r, -1e4, 1e4)], 50)
      expect(mag(g)).toBeLessThanOrEqual(1 + 1e-12)
    }
  })

  it('the plan quotes plus and minus a third for 100 and 25 ohms on a 50 ohm line', () => {
    expect(reflectionCoefficient(100, 50)[0]).toBeCloseTo(1 / 3, 12)
    expect(reflectionCoefficient(25, 50)[0]).toBeCloseTo(-1 / 3, 12)
  })
})

describe('invariant 8: the input impedance against length', () => {
  const line = { Z0: 50, vp: 2e8, len: 2 }

  it('a quarter wave inverts the load, at every frequency', () => {
    const r = rng(0x9e)
    for (let k = 0; k < 40; k++) {
      const f = logUniform(r, 1e6, 1e10)
      const ZL = logUniform(r, 1, 1000)
      const at = lineAt(line, f)
      const z = inputImpedance(line, ZL, f, { atLength: at.lambda / 4 })
      expect(relative(z.Z[0], (50 * 50) / ZL)).toBeLessThan(1e-8)
      expect(Math.abs(z.Z[1])).toBeLessThan(1e-6 * z.Z[0])
    }
  })

  it('a half wave repeats the load, at every frequency', () => {
    const r = rng(0x9f)
    for (let k = 0; k < 40; k++) {
      const f = logUniform(r, 1e6, 1e10)
      const ZL = [logUniform(r, 1, 1000), uniform(r, -500, 500)]
      const at = lineAt(line, f)
      const z = inputImpedance(line, ZL, f, { atLength: at.lambda / 2 })
      expect(relative(z.Z[0], ZL[0])).toBeLessThan(1e-7)
      expect(Math.abs(z.Z[1] - ZL[1])).toBeLessThan(1e-6 * Math.max(1, Math.abs(ZL[1])))
    }
  })

  it('a matched load looks the same at any length', () => {
    const r = rng(0xa0)
    for (let k = 0; k < 30; k++) {
      const z = inputImpedance(line, 50, logUniform(r, 1e6, 1e10), { atLength: logUniform(r, 0.01, 100) })
      expect(relative(z.Z[0], 50)).toBeLessThan(1e-10)
      expect(Math.abs(z.Z[1])).toBeLessThan(1e-8)
    }
  })

  it('an open stub is a short a quarter wave back, and a short stub is an open', () => {
    const f = 1e8
    const at = lineAt(line, f)
    const openStub = inputImpedance(line, Infinity, f, { atLength: at.lambda / 4 })
    expect(mag(openStub.Z)).toBeLessThan(1e-6)
    const shortStub = inputImpedance(line, 0, f, { atLength: at.lambda / 4 })
    expect(mag(shortStub.Z)).toBeGreaterThan(1e10)
  })

  it('an eighth-wave open stub is minus Z0 of reactance', () => {
    const f = 1e8
    const at = lineAt(line, f)
    const z = inputImpedance(line, Infinity, f, { atLength: at.lambda / 8 })
    expect(Math.abs(z.Z[0])).toBeLessThan(1e-8)
    expect(z.Z[1]).toBeCloseTo(-50, 6)
  })

  it('a short stub shorter than a quarter wave is an inductor', () => {
    const f = 1e8
    const at = lineAt(line, f)
    const z = inputImpedance(line, 0, f, { atLength: at.lambda / 8 })
    expect(z.Z[1]).toBeCloseTo(50, 6)
  })

  it('a lossy line of great length looks like its own Z0', () => {
    const lossy = { R: 0.5, L: 250e-9, G: 1e-6, C: 100e-12, len: 1 }
    const at = lineAt(lossy, 1e6)
    const z = inputImpedance(lossy, 1e6, 1e6, { atLength: 5000 })
    expect(relative(mag(z.Z), at.Z0mag)).toBeLessThan(1e-6)
    expect(Math.abs(deg(z.Z) - at.Z0deg)).toBeLessThan(1e-4)
  })
})

describe('the quarter-wave transformer', () => {
  it('is the geometric mean, and it matches', () => {
    const r = rng(0xa1)
    for (let k = 0; k < 40; k++) {
      const Zin = logUniform(r, 1, 1000)
      const ZL = logUniform(r, 1, 1000)
      const q = quarterWave(Zin, ZL)
      expect(relative(q.Z0, Math.sqrt(Zin * ZL))).toBeLessThan(1e-14)
      // A quarter wave of that Z0 really does turn ZL into Zin.
      const f = 1e9
      const line = { Z0: q.Z0, vp: 2e8, len: 1 }
      const at = lineAt(line, f)
      const z = inputImpedance(line, ZL, f, { atLength: at.lambda / 4 })
      expect(relative(z.Z[0], Zin)).toBeLessThan(1e-8)
    }
  })

  it('50 to 100 needs 70.7107 ohms', () => {
    expect(quarterWave(50, 100).Z0).toBeCloseTo(70.7107, 4)
  })

  it('reports its own length when it is given a frequency', () => {
    const q = quarterWave(50, 100, { f: 1e9, vp: 2e8 })
    expect(q.lambda).toBeCloseTo(0.2, 12)
    expect(q.length).toBeCloseTo(0.05, 12)
  })

  it('a reactive load is declined, and the message names what does match it', () => {
    expect(() => quarterWave(50, [100, 40])).toThrow(FieldsError)
    expect(() => quarterWave(50, [100, 40])).toThrow(/matches two REAL impedances/)
    expect(() => quarterWave(50, [100, 40])).toThrow(/needs a matching network/)
  })

  it('an open load is declined', () => {
    expect(() => quarterWave(50, Infinity)).toThrow(/cannot match an open circuit/)
  })
})

describe('invariant 9: the two-port line is reciprocal', () => {
  it('S21 equals S12 at fifty frequencies, lossless and lossy', () => {
    const r = rng(0xa2)
    for (const line of [
      { Z0: 75, vp: 2.1e8, len: 1.3 },
      { R: 0.5, L: 250e-9, G: 1e-6, C: 100e-12, len: 40 },
      { R: 5, L: 400e-9, G: 1e-4, C: 60e-12, len: 3 },
    ]) {
      for (let k = 0; k < 50; k++) {
        const s = sMatrix(line, logUniform(r, 1e4, 1e10), logUniform(r, 10, 200))
        expect(Math.abs(s.s21[0] - s.s12[0])).toBeLessThan(1e-12 * Math.max(1, mag(s.s21)))
        expect(Math.abs(s.s21[1] - s.s12[1])).toBeLessThan(1e-12 * Math.max(1, mag(s.s21)))
      }
    }
  })

  it('a matched line is a pure delay, and its S11 is exactly nothing', () => {
    const s = sMatrix({ Z0: 50, vp: 2e8, len: 2 }, 1e8, 50)
    expect(mag(s.s11)).toBeLessThan(1e-15)
    expect(mag(s.s22)).toBeLessThan(1e-15)
    expect(mag(s.s21)).toBeCloseTo(1, 12)
    // Two metres at 2e8 is ten nanoseconds, which at 100 MHz is one whole cycle.
    expect(Math.abs(deg(s.s21))).toBeLessThan(1e-10)
  })

  it('the delay shows as a phase that grows with frequency', () => {
    const line = { Z0: 50, vp: 2e8, len: 2 }
    const a = sMatrix(line, 25e6, 50)
    const b = sMatrix(line, 50e6, 50)
    expect(deg(a.s21)).toBeCloseTo(-90, 8)
    expect(deg(b.s21)).toBeCloseTo(-180, 8)
  })

  it('a lossy line loses power between its ports', () => {
    const s = sMatrix({ R: 5, L: 400e-9, G: 1e-4, C: 60e-12, len: 20 }, 1e7, 50)
    expect(mag(s.s21)).toBeLessThan(1)
    expect(mag(s.s11) ** 2 + mag(s.s21) ** 2).toBeLessThan(1)
  })

  it('a lossless line conserves power at every port', () => {
    const r = rng(0xa3)
    for (let k = 0; k < 30; k++) {
      const s = sMatrix({ Z0: logUniform(r, 20, 200), vp: 2e8, len: logUniform(r, 0.1, 10) }, logUniform(r, 1e6, 1e10), 50)
      expect(Math.abs(mag(s.s11) ** 2 + mag(s.s21) ** 2 - 1)).toBeLessThan(1e-10)
    }
  })
})

describe('the standing wave on a line', () => {
  it('reports the ratio, the return loss and the mismatch loss together', () => {
    const sw = lineStandingWave({ Z0: 50, vp: 2e8, len: 2 }, 100, 1e8)
    expect(sw.mag).toBeCloseTo(1 / 3, 12)
    expect(sw.swr).toBeCloseTo(2, 10)
    expect(sw.returnLossDb).toBeCloseTo(9.542, 3)
    expect(sw.mismatchLossDb).toBeCloseTo(0.5115, 4)
  })

  it('a matched load has infinite return loss and no mismatch loss', () => {
    const sw = lineStandingWave({ Z0: 50, vp: 2e8, len: 2 }, 50, 1e8)
    expect(sw.swr).toBe(1)
    expect(sw.returnLossDb).toBe(Infinity)
    expect(sw.mismatchLossDb).toBe(-0)
  })

  it('on a lossy line the standing wave flattens with distance from the load', () => {
    const sw = lineStandingWave({ R: 5, L: 400e-9, G: 1e-4, C: 60e-12, len: 100 }, 200, 1e7)
    const near = sw.atDistance(1)
    const far = sw.atDistance(50)
    expect(far.mag).toBeLessThan(near.mag)
    expect(far.swr).toBeLessThan(near.swr)
  })
})

describe("the Smith chart's arithmetic", () => {
  it('normalising and mapping round trip', () => {
    const r = rng(0xa4)
    for (let k = 0; k < 60; k++) {
      const z = [logUniform(r, 0.01, 100), uniform(r, -50, 50)]
      const back = gammaToZ(zToGamma(z))
      expect(relative(back[0], z[0])).toBeLessThan(1e-10)
      expect(relative(back[1], z[1])).toBeLessThan(1e-10)
    }
  })

  it('the three landmarks sit where the chart draws them', () => {
    expect(zToGamma([1, 0])).toEqual([0, 0])
    expect(zToGamma([0, 0])[0]).toBe(-1)
    expect(zToGamma(Infinity)).toEqual([1, 0])
    expect(gammaToZ([1, 0])).toBe(Infinity)
  })

  it('normalise divides by Z0', () => {
    const z = normalise([100, 50], 50)
    expect(z[0]).toBeCloseTo(2, 12)
    expect(z[1]).toBeCloseTo(1, 12)
  })

  it('a constant-resistance circle carries the resistance it is labelled with', () => {
    const r = rng(0xa5)
    for (let k = 0; k < 30; k++) {
      const res = logUniform(r, 0.05, 50)
      const c = resistanceCircle(res)
      for (const t of [0, 1, 2, 3, 4, 5]) {
        const g = [c.cx + c.radius * Math.cos(t), c.cy + c.radius * Math.sin(t)]
        const z = gammaToZ(g)
        if (z === Infinity) continue
        expect(relative(z[0], res)).toBeLessThan(1e-9)
      }
    }
  })

  it('a constant-reactance arc carries the reactance it is labelled with', () => {
    const r = rng(0xa6)
    for (let k = 0; k < 30; k++) {
      const x = logUniform(r, 0.05, 50) * (r() > 0.5 ? 1 : -1)
      const c = reactanceCircle(x)
      for (const t of [0.4, 1.2, 2.5, 4.1]) {
        const g = [c.cx + c.radius * Math.cos(t), c.cy + c.radius * Math.sin(t)]
        if (Math.hypot(g[0], g[1]) > 0.999) continue
        const z = gammaToZ(g)
        expect(relative(z[1], x)).toBeLessThan(1e-8)
      }
    }
  })

  it('half a wavelength towards the generator is one whole turn', () => {
    const g = zToGamma([2, 1])
    const half = towardsGenerator(g, Math.PI)
    expect(Math.abs(half[0] - g[0])).toBeLessThan(1e-12)
    expect(Math.abs(half[1] - g[1])).toBeLessThan(1e-12)
  })

  it('a quarter wavelength towards the generator inverts the impedance', () => {
    const z = [2, 0]
    const rotated = gammaToZ(towardsGenerator(zToGamma(z), Math.PI / 2))
    expect(relative(rotated[0], 0.5)).toBeLessThan(1e-10)
    expect(Math.abs(rotated[1])).toBeLessThan(1e-10)
  })

  it('on a lossy line the rotation spirals inwards', () => {
    const g = zToGamma([2, 1])
    const spiral = towardsGenerator(g, Math.PI / 2, 0.3)
    expect(mag(spiral)).toBeLessThan(mag(g))
  })

  it('the rotation agrees with the input impedance the line computes', () => {
    const line = { Z0: 50, vp: 2e8, len: 1 }
    const f = 3e8
    const at = lineAt(line, f)
    const d = 0.17
    const ZL = [120, -60]
    const byRotation = gammaToZ(towardsGenerator(zToGamma(normalise(ZL, 50)), at.beta * d))
    const byFormula = inputImpedance(line, ZL, f, { atLength: d }).Z
    expect(relative(byRotation[0] * 50, byFormula[0])).toBeLessThan(1e-10)
    expect(relative(byRotation[1] * 50, byFormula[1])).toBeLessThan(1e-10)
  })
})

describe('invariant 10: the lossy line in time is declined', () => {
  const lossy = { R: 0.5, L: 250e-9, G: 1e-6, C: 100e-12, len: 100 }
  const lossless = { Z0: 50, vp: 2e8, len: 2 }

  it('throws with the reason, and points at what is available', () => {
    expect(() => refuseLossyTime(lossy)).toThrow(FieldsError)
    try {
      refuseLossyTime(lossy)
    } catch (e) {
      expect(e.message).toMatch(/no finite set of arrivals/)
      expect(e.message).toMatch(/Every frequency travels at its own speed/)
      expect(e.message).toMatch(/exact at every frequency/)
      expect(e.message).toMatch(/lineAt and sMatrix/)
      expect(e.kind).toBe('lossy-line-in-time')
      expect(e.R).toBe(0.5)
      expect(e.G).toBe(1e-6)
    }
  })

  it('a lossless line asked for the same refusal is told it does not need one', () => {
    expect(() => refuseLossyTime(lossless)).toThrow(/its time-domain response is exact/)
    expect(() => refuseLossyTime(lossless)).toThrow(/Use bounceDiagram/)
  })

  it('the panel form returns the reason instead of throwing it', () => {
    const no = timeDomainAvailable(lossy)
    expect(no.ok).toBe(false)
    expect(no.says).toMatch(/no finite set of arrivals/)
    const yes = timeDomainAvailable(lossless)
    expect(yes.ok).toBe(true)
    expect(yes.says).toMatch(/finite sum of arrivals/)
  })

  it('a line with only conductor loss is still declined, and so is one with only leakage', () => {
    expect(timeDomainAvailable({ R: 0.1, L: 250e-9, G: 0, C: 100e-12 }).ok).toBe(false)
    expect(timeDomainAvailable({ R: 0, L: 250e-9, G: 1e-9, C: 100e-12 }).ok).toBe(false)
    expect(timeDomainAvailable({ R: 0, L: 250e-9, G: 0, C: 100e-12 }).ok).toBe(true)
  })

  it('the same lossy line answers exactly in the frequency domain', () => {
    const r = rng(0xa7)
    for (let k = 0; k < 30; k++) {
      const f = logUniform(r, 1e3, 1e9)
      const at = lineAt(lossy, f)
      expect(Number.isFinite(at.alpha)).toBe(true)
      expect(Number.isFinite(at.beta)).toBe(true)
      expect(at.alpha).toBeGreaterThan(0)
      // gamma squared really is (R + jwL)(G + jwC).
      const w = 2 * Math.PI * f
      const zre = 0.5
      const zim = w * 250e-9
      const yre = 1e-6
      const yim = w * 100e-12
      const prodRe = zre * yre - zim * yim
      const prodIm = zre * yim + zim * yre
      const g2re = at.gamma[0] * at.gamma[0] - at.gamma[1] * at.gamma[1]
      const g2im = 2 * at.gamma[0] * at.gamma[1]
      expect(relative(g2re, prodRe)).toBeLessThan(1e-10)
      expect(relative(g2im, prodIm)).toBeLessThan(1e-10)
    }
  })
})
