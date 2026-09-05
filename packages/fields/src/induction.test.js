import { describe, it, expect } from 'vitest'
import {
  eddyLossSheet,
  faradayEmf,
  guardText,
  motionalEmf,
  planarCurrent,
  rotatingLoop,
  skinDepth,
  surfaceImpedance,
  wireHighFrequency,
  wireImpedance,
} from './induction.js'
import { MU0, SIGMA_CU } from './const.js'
import { logUniform, relative, rng, uniform } from './fuzz.js'

// Faraday, and the skin effect.
//
// The round wire's exact solve is the load-bearing piece here. It integrates
// the Bessel equation outward from the axis rather than tabulating a Kelvin
// function, so it is checked three ways: against its two limits, against the
// published Kelvin-function table, and by the fact that its answer does not
// move when the step count changes. Only then is it used to guard the tube
// formula, which is the approximation this group ships.

describe('the skin depth, and the surface impedance that follows it', () => {
  it('falls as one over the square root of frequency', () => {
    const r = rng(0x5c)
    for (let k = 0; k < 40; k++) {
      const f = logUniform(r, 1, 1e10)
      const sigma = logUniform(r, 1e4, 1e8)
      expect(relative(skinDepth(f, { sigma }), Math.SQRT2 * skinDepth(2 * f, { sigma }))).toBeLessThan(1e-13)
    }
  })

  it('is infinite at zero frequency, rather than dividing by zero', () => {
    expect(skinDepth(0, { sigma: SIGMA_CU })).toBe(Infinity)
  })

  it('the surface impedance has equal resistance and reactance, at every frequency', () => {
    const r = rng(0x5d)
    for (let k = 0; k < 30; k++) {
      const f = logUniform(r, 1, 1e10)
      const z = surfaceImpedance(f, { sigma: SIGMA_CU })
      expect(z.R).toBe(z.X)
      expect(z.phaseDeg).toBe(45)
      expect(relative(z.R, 1 / (SIGMA_CU * z.delta))).toBeLessThan(1e-14)
    }
  })

  it('one skin depth in, the current is 1/e and the phase has slipped a radian', () => {
    const delta = skinDepth(1e6, { sigma: SIGMA_CU })
    const p = planarCurrent(delta, 1e6, { sigma: SIGMA_CU })
    expect(p.mag).toBeCloseTo(Math.exp(-1), 12)
    expect(p.phaseDeg).toBeCloseTo(-180 / Math.PI, 10)
  })

  it('the plan quotes 9.346 mm at 50 Hz and 66.09 micrometres at 1 MHz', () => {
    expect(skinDepth(50, { sigma: SIGMA_CU }) * 1000).toBeCloseTo(9.346, 3)
    expect(skinDepth(1e6, { sigma: SIGMA_CU }) * 1e6).toBeCloseTo(66.09, 2)
    expect(skinDepth(1e9, { sigma: SIGMA_CU }) * 1e9).toBeCloseTo(2090, 0)
  })

  it('a conductivity is required, and zero is declined', () => {
    expect(() => skinDepth(50, { sigma: 0 })).toThrow(/sigma must be a positive number/)
  })
})

describe('the round wire, solved exactly', () => {
  const material = { sigma: SIGMA_CU }

  it('at zero frequency the ratio is one and the internal inductance is mu over 8 pi', () => {
    const z = wireImpedance(1e-3, 0, material)
    expect(z.ratio).toBe(1)
    expect(relative(z.Lint, MU0 / (8 * Math.PI))).toBeLessThan(1e-15)
  })

  it('at a very low frequency it approaches the same two limits', () => {
    const z = wireImpedance(1e-3, 1, material)
    expect(relative(z.ratio, 1)).toBeLessThan(1e-5)
    expect(relative(z.Lint, MU0 / (8 * Math.PI))).toBeLessThan(1e-5)
  })

  it('reproduces the published Kelvin-function table at q of 2, 4 and 8', () => {
    // The tables give R_ac / R_dc against q = sqrt(2) a / delta.
    const table = [
      [1, 1.005],
      [2, 1.0779],
      [4, 1.678],
      [8, 3.094],
    ]
    const a = 1e-3
    for (const [q, expected] of table) {
      const delta = (Math.SQRT2 * a) / q
      const f = 1 / (Math.PI * MU0 * SIGMA_CU * delta * delta)
      const got = wireImpedance(a, f, material).ratio
      expect(relative(got, expected), `q = ${q}: got ${got.toFixed(5)}, table ${expected}`).toBeLessThan(1e-3)
    }
  })

  it('the answer does not move when the step count changes', () => {
    const a = 1e-3
    const f = 1e6
    const coarse = wireImpedance(a, f, { ...material, steps: 2000 })
    const fine = wireImpedance(a, f, { ...material, steps: 16000 })
    expect(relative(coarse.ratio, fine.ratio)).toBeLessThan(1e-6)
    expect(relative(coarse.Lint, fine.Lint)).toBeLessThan(1e-6)
  })

  it('the resistance rises and the internal inductance falls with frequency', () => {
    const a = 1e-3
    let lastRatio = 0
    let lastLint = Infinity
    for (const f of [1e3, 1e4, 1e5, 1e6, 1e7]) {
      const z = wireImpedance(a, f, material)
      expect(z.ratio).toBeGreaterThan(lastRatio)
      expect(z.Lint).toBeLessThan(lastLint)
      lastRatio = z.ratio
      lastLint = z.Lint
    }
  })

  it('at 1 MHz a 1 mm copper wire carries 7.822 times its direct-current resistance', () => {
    expect(wireImpedance(1e-3, 1e6, material).ratio).toBeCloseTo(7.822, 2)
  })
})

describe('the tube formula, guarded against that exact solve', () => {
  const material = { sigma: SIGMA_CU }

  it('is good where the current has crowded, and its guard says so', () => {
    const hf = wireHighFrequency(1e-3, 1e6, material)
    expect(hf.guard.ok).toBe(true)
    expect(hf.guard.value).toBeGreaterThan(3)
    expect(hf.error).toBeLessThan(0.05)
    expect(hf.guard.says).toMatch(/past the threshold of 3/)
  })

  it('is wrong where it has not, and the guard refuses it', () => {
    const lf = wireHighFrequency(1e-3, 1e4, material)
    expect(lf.guard.ok).toBe(false)
    expect(lf.guard.value).toBeLessThan(3)
    expect(lf.error).toBeGreaterThan(0.2)
    expect(lf.guard.says).toMatch(/short of the threshold of 3/)
    expect(lf.guard.says).toMatch(/the exact solve is shown instead/)
  })

  it('the error the guard reports is measured, not estimated', () => {
    const r = rng(0x7bee)
    for (let k = 0; k < 12; k++) {
      const a = logUniform(r, 1e-4, 5e-3)
      const f = logUniform(r, 1e4, 1e8)
      const hf = wireHighFrequency(a, f, material)
      const exact = wireImpedance(a, f, material).R
      expect(relative(hf.error, Math.abs(hf.R - exact) / exact)).toBeLessThan(1e-12)
    }
  })

  it('the error falls as the wire gets many skin depths thick', () => {
    const errors = [1e5, 1e6, 1e7, 1e8].map((f) => wireHighFrequency(1e-3, f, material).error)
    for (let k = 1; k < errors.length; k++) expect(errors[k]).toBeLessThan(errors[k - 1])
  })

  it('a guard renders through one accessor whichever guard it is', () => {
    expect(guardText(wireHighFrequency(1e-3, 1e6, material).guard)).toMatch(/skin depths/)
    expect(guardText(null)).toBe('')
  })
})

describe('eddy-current loss, and why a core is laminated', () => {
  const sheet = { Bpeak: 1.2, f: 50, rho: 4.7e-7 }

  it('follows the square of the thickness', () => {
    const thick = eddyLossSheet({ ...sheet, thickness: 0.35e-3 })
    const thin = eddyLossSheet({ ...sheet, thickness: 0.175e-3 })
    expect(relative(thick.P / thin.P, 4)).toBeLessThan(1e-13)
  })

  it('follows the square of the frequency and of the flux density', () => {
    const base = eddyLossSheet({ ...sheet, thickness: 0.35e-3 })
    const twiceF = eddyLossSheet({ ...sheet, thickness: 0.35e-3, f: 100 })
    const twiceB = eddyLossSheet({ ...sheet, thickness: 0.35e-3, Bpeak: 2.4 })
    expect(relative(twiceF.P / base.P, 4)).toBeLessThan(1e-13)
    expect(relative(twiceB.P / base.P, 4)).toBeLessThan(1e-13)
  })

  it('the plan quotes 1.543 and 0.3859 kilowatts a cubic metre', () => {
    expect(eddyLossSheet({ ...sheet, thickness: 0.35e-3 }).P / 1000).toBeCloseTo(1.543, 3)
    expect(eddyLossSheet({ ...sheet, thickness: 0.175e-3 }).P / 1000).toBeCloseTo(0.3859, 4)
  })

  it('the guard holds at mains frequency and trips at a high one', () => {
    expect(eddyLossSheet({ ...sheet, thickness: 0.35e-3 }).guard.ok).toBe(true)
    // Silicon steel is resistive enough that a lamination is thin against the
    // skin depth well past mains frequency. At 50 Hz the depth is 24 mm and at
    // 100 kHz it is still 1.1 mm. The guard trips near a megahertz.
    const fast = eddyLossSheet({ ...sheet, thickness: 0.35e-3, f: 1e6 })
    expect(fast.guard.ok).toBe(false)
    expect(fast.guard.says).toMatch(/screen the interior/)
  })
})

describe('Faraday, and the two emfs that come out of it', () => {
  it('the transformer coefficient is 2 pi over root 2, and 4.44 is that rounded', () => {
    const e = faradayEmf({ turns: 200, area: 4e-4, Bpeak: 1.2, f: 50 })
    expect(e.coefficient).toBeCloseTo((2 * Math.PI) / Math.SQRT2, 14)
    expect(e.coefficient).toBeCloseTo(4.44288, 5)
    expect(relative(e.rms, e.coefficient * 50 * 200 * e.fluxPeak)).toBeLessThan(1e-14)
    expect(e.rms).toBeCloseTo(21.33, 2)
  })

  it('the emf is proportional to turns, area, flux density and frequency', () => {
    const base = { turns: 100, area: 1e-4, Bpeak: 1, f: 50 }
    const one = faradayEmf(base).rms
    for (const key of ['turns', 'area', 'Bpeak', 'f']) {
      const doubled = faradayEmf({ ...base, [key]: base[key] * 2 }).rms
      expect(relative(doubled, 2 * one), key).toBeLessThan(1e-13)
    }
  })

  it('a bar moving across a field gives B l v, and nothing along the field', () => {
    expect(motionalEmf({ B: 0.4, length: 0.25, speed: 3 }).emf).toBeCloseTo(0.3, 12)
    expect(motionalEmf({ B: 0.4, length: 0.25, speed: 3, angleDeg: 0 }).emf).toBeCloseTo(0, 15)
    expect(motionalEmf({ B: 0.4, length: 0.25, speed: 3, angleDeg: 30 }).emf).toBeCloseTo(0.15, 12)
  })

  it('the force on that bar carrying a current is B l I', () => {
    const m = motionalEmf({ B: 0.4, length: 0.25, speed: 3 })
    expect(m.force(2)).toBeCloseTo(0.2, 12)
  })

  it('a turning loop gives a sinusoid whose peak is N B A omega', () => {
    const g = rotatingLoop({ B: 0.5, area: 2e-3, f: 60, turns: 20 })
    expect(relative(g.peak, 20 * 0.5 * 2e-3 * 2 * Math.PI * 60)).toBeLessThan(1e-14)
    expect(g.at(0)).toBeCloseTo(0, 12)
    expect(g.at(Math.PI / (2 * g.omega))).toBeCloseTo(g.peak, 10)
    expect(relative(g.rms, g.peak / Math.SQRT2)).toBeLessThan(1e-15)
  })
})
