import { describe, it, expect } from 'vitest'
import {
  EG_SI,
  N_I_300,
  builtIn,
  depletionWidth,
  diffusionCap,
  doubling,
  isAt,
  junctionCap,
  niAt,
  thermalVoltage,
  transitFreq,
  transitLimit,
  vbeSlope,
} from './junction.js'
import { NetworkError } from './netlist.js'

// Group C's four closed forms, each against the algebra it came from and each
// at more than one point, so a sign that reversed would show.

/** The plan's junction: 10¹⁷ and 10¹⁶ cm⁻³, in m⁻³. */
const DOPING = { na: 1e23, nd: 1e22 }
const VT = thermalVoltage(300)

describe('the built-in potential', () => {
  it('is V_T ln(N_A N_D / n_i²)', () => {
    const v0 = builtIn(DOPING)
    expect(v0).toBeCloseTo(VT * Math.log((DOPING.na * DOPING.nd) / N_I_300 ** 2), 12)
    expect(v0).toBeCloseTo(0.75288, 5)
  })

  it('rises 60 mV for every decade of doping, on either side', () => {
    const v0 = builtIn(DOPING)
    expect(builtIn({ ...DOPING, na: DOPING.na * 10 }) - v0).toBeCloseTo(VT * Math.LN10, 12)
    expect(builtIn({ ...DOPING, nd: DOPING.nd * 10 }) - v0).toBeCloseTo(VT * Math.LN10, 12)
  })

  it('falls with temperature, because n_i climbs faster than V_T does', () => {
    expect(builtIn({ ...DOPING, T: 350 })).toBeLessThan(builtIn(DOPING))
    expect(niAt(300)).toBeCloseTo(N_I_300, 6)
    expect(niAt(350)).toBeGreaterThan(niAt(300))
  })

  it('refuses a doping of zero, which is not a junction', () => {
    expect(() => builtIn({ na: 0, nd: 1e22 })).toThrow(NetworkError)
  })
})

describe('the depletion region', () => {
  it('splits in inverse proportion to the doping, and the charges match', () => {
    const { w, xp, xn } = depletionWidth(DOPING, 0)
    expect(xp + xn).toBeCloseTo(w, 15)
    // Charge neutrality: N_A x_p = N_D x_n.
    expect(DOPING.na * xp).toBeCloseTo(DOPING.nd * xn, 6)
    // The lightly doped side takes ten times the width.
    expect(xn / xp).toBeCloseTo(DOPING.na / DOPING.nd, 9)
  })

  it('follows the square root of the reverse bias', () => {
    const v0 = builtIn(DOPING)
    const w0 = depletionWidth(DOPING, 0).w
    for (const v of [-1, -5, -10]) {
      expect(depletionWidth(DOPING, v).w).toBeCloseTo(w0 * Math.sqrt((v0 - v) / v0), 12)
    }
    // A tenth of a micron at zero bias, which is the scale the pane draws to.
    expect(w0).toBeGreaterThan(1e-7)
    expect(w0).toBeLessThan(1e-6)
  })

  it('narrows under forward bias, and declines a bias past the barrier', () => {
    const v0 = builtIn(DOPING)
    expect(depletionWidth(DOPING, 0.5).w).toBeLessThan(depletionWidth(DOPING, 0).w)
    expect(() => depletionWidth(DOPING, v0)).toThrow(/depletion approximation/)
    expect(() => depletionWidth(DOPING, v0 + 0.1)).toThrow(NetworkError)
  })
})

describe('the two capacitances', () => {
  it('gives C_j its square-root law, in both directions from zero bias', () => {
    const v0 = builtIn(DOPING)
    const cj0 = 2e-12
    expect(junctionCap({ cj0, v0 }, 0)).toBeCloseTo(cj0, 15)
    expect(junctionCap({ cj0, v0 }, -5)).toBeCloseTo(cj0 / Math.sqrt(1 + 5 / v0), 15)
    expect(junctionCap({ cj0, v0 }, -5) * 1e12).toBeCloseTo(0.7235, 4)
    expect(junctionCap({ cj0, v0 }, 0.5) * 1e12).toBeCloseTo(3.451, 3)
  })

  it('takes the grading coefficient it is given', () => {
    const v0 = builtIn(DOPING)
    // A linearly graded junction is the cube root, not the square root.
    expect(junctionCap({ cj0: 2e-12, v0, m: 1 / 3 }, -5)).toBeGreaterThan(junctionCap({ cj0: 2e-12, v0 }, -5))
  })

  it('declines C_j at the built-in potential, and names what replaces it', () => {
    const v0 = builtIn(DOPING)
    expect(() => junctionCap({ cj0: 2e-12, v0 }, v0)).toThrow(/diffusion capacitance/)
  })

  it('gives C_d = τ_F g_m, rising in proportion to the current', () => {
    const tauF = 0.5e-9
    for (const ic of [0.25e-3, 1e-3, 4e-3]) {
      const gm = ic / VT
      expect(diffusionCap({ tauF }, gm)).toBeCloseTo(tauF * gm, 18)
    }
    expect(diffusionCap({ tauF }, 1e-3 / VT) * 1e12).toBeCloseTo(19.341, 3)
  })

  it('climbs f_T toward 1/(2π τ_F) as the current rises', () => {
    const tauF = 0.5e-9
    const cmu = 2e-12
    const cje = 0.7e-12 // the emitter junction's depletion part, fixed with current
    const fT = (ic) => {
      const gm = ic / VT
      return transitFreq({ gm, cpi: diffusionCap({ tauF }, gm) + cje, cmu })
    }
    expect(fT(1e-3)).toBeLessThan(fT(10e-3))
    expect(fT(10e-3)).toBeLessThan(fT(100e-3))
    expect(fT(1)).toBeLessThan(transitLimit(tauF))
    expect(transitLimit(tauF) / 1e6).toBeCloseTo(318.31, 2)
    // The plan's default: C_π = 20 pF, C_μ = 2 pF at 1 mA gives 280 MHz.
    expect(transitFreq({ gm: 1e-3 / VT, cpi: 20e-12, cmu: 2e-12 }) / 1e6).toBeCloseTo(279.84, 2)
  })
})

describe('the temperature law', () => {
  it('doubles I_S about every 4.5 K, from the law and not from its slope', () => {
    const dT = doubling({ is: 1e-14 }, 300)
    expect(dT).toBeCloseTo(4.5549, 3)
    expect(isAt({ is: 1e-14 }, 300 + dT) / isAt({ is: 1e-14 }, 300)).toBeCloseTo(2, 9)
    // The slope at 300 K alone predicts a narrower interval, because the law
    // flattens as it climbs: the exponent carries 1/T, not T.
    const slope = 3 / 300 + EG_SI / (VT * 300)
    expect(Math.LN2 / slope).toBeLessThan(dT)
    expect(Math.LN2 / slope).toBeCloseTo(4.489, 3)
  })

  it('is the identity at the reference temperature, and scales both ways', () => {
    expect(isAt({ is: 1e-14 }, 300)).toBeCloseTo(1e-14, 20)
    expect(isAt({ is: 1e-14 }, 250)).toBeLessThan(1e-14)
    expect(isAt({ is: 1e-14 }, 350)).toBeGreaterThan(1e-14)
  })

  it('drops V_BE by 1.66 mV/K at 0.7 V and 1.99 mV/K at 0.6 V', () => {
    expect(vbeSlope({ vbe: 0.7 }) * 1000).toBeCloseTo(-1.6585, 4)
    expect(vbeSlope({ vbe: 0.6 }) * 1000).toBeCloseTo(-1.9919, 4)
    // The slope is (V_BE − E_g − 3V_T)/T, so it is the same for any junction
    // biased at the same voltage.
    expect(vbeSlope({ vbe: 0.7 })).toBeCloseTo((0.7 - EG_SI - 3 * VT) / 300, 15)
  })

  it('agrees with the exponential law it was differentiated from', () => {
    // Hold I_C and let T move: the V_BE the law needs falls at the slope above.
    const ic = 1e-3
    const vbeAt = (T) => thermalVoltage(T) * Math.log(ic / isAt({ is: 1e-14 }, T))
    const T = 300
    const h = 0.01
    const measured = (vbeAt(T + h) - vbeAt(T - h)) / (2 * h)
    expect(measured).toBeCloseTo(vbeSlope({ vbe: vbeAt(T) }, T), 8)
  })
})
