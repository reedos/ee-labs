import { describe, it, expect } from 'vitest'
import {
  DEGENERATE,
  EG_SI,
  EPS_OX,
  EPS_SI,
  E_AVALANCHE,
  E_ZENER,
  MATERIALS,
  N_C_SI,
  N_I_300,
  N_V_SI,
  Q_E,
  bodyEffect,
  breakdown,
  builtIn,
  bulkPotential,
  carriers,
  channelIntegral,
  cvCurve,
  debyeLength,
  degenerate,
  depletionWidth,
  diffusionCap,
  dopingFromRatio,
  doseFor,
  doubling,
  drainCurrent,
  driftDiffusion,
  earlyVoltage,
  emission,
  flatBand,
  gapFrom,
  gummel,
  implantDoping,
  implantFor,
  intrinsicAt,
  isAt,
  junctionCap,
  mosCap,
  niAt,
  niFrom,
  oxideCap,
  peakField,
  photovoltaic,
  profile,
  saturationCurrent,
  subthreshold,
  surfaceDepletion,
  surfacePotential,
  threshold,
  thermalVoltage,
  vbeSlope,
  velocitySaturation,
} from './junction.js'
import { MOSFET_DEFAULTS } from './mosfet.js'
import { NetworkError } from './netlist.js'

// The Devices Lab's engine, against the plan's §2.11 invariants.
//
// Every doping here is in m⁻³, which is what the formulas take: 10¹⁷ cm⁻³ is
// 10²³ m⁻³. Nothing in this file is a constant typed in from the plan without
// a second route to it. Where the plan quotes a number the test computes it
// from the parameters and compares, so a changed parameter moves the pin and a
// changed formula fails it.

/** The plan's junction: 10¹⁷ and 10¹⁶ cm⁻³, area 10⁻⁴ cm². */
const J = { na: 1e23, nd: 1e22 }
const AREA = 1e-8
/** The plan's MOS process: 10¹⁷ cm⁻³ under 10 nm of oxide, n⁺ polysilicon gate. */
const MOS = { na: 1e23, tox: 10e-9 }
/** The plan's transistor: the two Gummel numbers, and a collector at 10¹⁶ cm⁻³. */
const B = { ne: 1e25, we: 0.3e-6, nb: 1e23, wb: 0.5e-6, nc: 1e22, area: AREA, db: 1.0341e-3, de: 1.2926e-4 }
const VT = thermalVoltage(300)

/** A deterministic generator, so a failure is reproducible. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
/** A log-uniform draw between two bounds. */
const logPick = (r, lo, hi) => lo * (hi / lo) ** r()

/**
 * Simpson's rule over [a, b], for the quadrature routes below.
 *
 * Every integrand here has a kink at the metallurgical boundary, where the
 * charge steps and the field changes slope. Simpson across a kink measures the
 * grid rather than the function, so each integral below is taken over the two
 * sides separately and added. The rule is then exact on both pieces, and the
 * comparison is against the closed form rather than against a discretisation.
 */
function quad(f, a, b, n = 400) {
  const m = n % 2 ? n + 1 : n
  const h = (b - a) / m
  let sum = f(a) + f(b)
  for (let k = 1; k < m; k++) sum += (k % 2 ? 4 : 2) * f(a + k * h)
  return (sum * h) / 3
}

/** The same, over a profile's two sides, meeting at the boundary. */
const overRegion = (p, f, n = 400) => quad(f, -p.xp, -Number.MIN_VALUE, n) + quad(f, Number.MIN_VALUE, p.xn, n)

// ---------------------------------------------------------------------------
// Invariant 6 first, because it is the one that decides whether this lab was
// allowed to open the file at all. Group C of the Electronics Lab pins these
// five, and none of them may move.

describe('invariant 6: Electronics Group C is unchanged', () => {
  it('keeps V_0, the width and its split', () => {
    expect(builtIn(J)).toBeCloseTo(VT * Math.log((J.na * J.nd) / N_I_300 ** 2), 12)
    expect(builtIn(J)).toBeCloseTo(0.75288, 5)
    const { w, xp, xn } = depletionWidth(J, 0)
    expect(xp + xn).toBeCloseTo(w, 15)
    expect(J.na * xp).toBeCloseTo(J.nd * xn, 6)
  })

  it('keeps C_j, C_d and the two transit numbers', () => {
    const v0 = builtIn(J)
    expect(junctionCap({ cj0: 2e-12, v0 }, -5) * 1e12).toBeCloseTo(0.7235, 4)
    expect(junctionCap({ cj0: 2e-12, v0 }, 0.5) * 1e12).toBeCloseTo(3.451, 3)
    expect(diffusionCap({ tauF: 0.5e-9 }, 1e-3 / VT) * 1e12).toBeCloseTo(19.341, 3)
  })

  it('keeps the temperature law and its slope', () => {
    expect(doubling({ is: 1e-14 }, 300)).toBeCloseTo(4.5549, 3)
    expect(isAt({ is: 1e-14 }, 300)).toBeCloseTo(1e-14, 20)
    expect(vbeSlope({ vbe: 0.7 }) * 1000).toBeCloseTo(-1.6585, 4)
    expect(vbeSlope({ vbe: 0.6 }) * 1000).toBeCloseTo(-1.9919, 4)
  })

  it('keeps n_i at 1.5 × 10¹⁶ m⁻³, which the plan’s Decision 1 pins', () => {
    expect(N_I_300).toBe(1.5e16)
    expect(niAt(300)).toBeCloseTo(N_I_300, 6)
  })
})

// ---------------------------------------------------------------------------

describe('the intrinsic concentration, and why two books disagree', () => {
  it('computes n_i from the band-edge densities, 1.39 times below the suite’s constant', () => {
    const computed = niFrom()
    expect(computed).toBeCloseTo(Math.sqrt(N_C_SI * N_V_SI) * Math.exp(-EG_SI / (2 * VT)), 6)
    expect(computed / 1e16).toBeCloseTo(1.0790409, 6)
    expect(N_I_300 / computed).toBeCloseTo(1.39012, 4)
  })

  it('reads the same law backwards for the band gap a stated n_i implies', () => {
    expect(gapFrom({ ni: niFrom() })).toBeCloseTo(EG_SI, 12)
    expect(gapFrom({ ni: N_I_300 })).toBeCloseTo(1.10297, 5)
    // The suite's constant is the larger, so the gap it implies is the smaller.
    expect(gapFrom({ ni: N_I_300 })).toBeLessThan(EG_SI)
  })
})

describe('invariant 5: the law of mass action', () => {
  it('holds to floating point at every doping, and both ways round', () => {
    const r = rng(11)
    for (let k = 0; k < 200; k++) {
      const na = logPick(r, 1e20, 1e26)
      const nd = logPick(r, 1e20, 1e26)
      const c = carriers({ na, nd })
      expect(c.n * c.p).toBeCloseTo(N_I_300 ** 2, -20)
      expect((c.n * c.p) / N_I_300 ** 2).toBeCloseTo(1, 9)
      // Neutrality: n − p is the net doping, whatever the two dopings are.
      expect((c.n - c.p) / (nd - na)).toBeCloseTo(1, 9)
    }
  })

  it('departs from n ≈ N_D by exactly (n_i/N_D)², which is what sets where it may be used', () => {
    // The plan's invariant 5 asks for agreement to 10⁻⁶ above 100 n_i. The
    // error is the square of the ratio, so 100 n_i buys 10⁻⁴ and 10⁻⁶ needs
    // 1000 n_i. The relation itself is the check, and the two thresholds
    // follow from it.
    for (const r of [30, 100, 1000, 1e4, 1e6]) {
      const nd = r * N_I_300
      expect(carriers({ nd }).n / nd - 1).toBeCloseTo((Math.sqrt(1 + 4 / r ** 2) - 1) / 2, 12)
    }
    expect(carriers({ nd: 100 * N_I_300 }).n / (100 * N_I_300) - 1).toBeLessThan(1.01e-4)
    expect(carriers({ nd: 1000 * N_I_300 }).n / (1000 * N_I_300) - 1).toBeLessThan(1.01e-6)
    // At the intrinsic concentration itself the approximation is out by 62 %,
    // which is the whole reason the neutrality solve is here.
    const at = carriers({ nd: N_I_300 })
    expect(at.n / N_I_300).toBeCloseTo((1 + Math.sqrt(5)) / 2, 9)
    expect(at.n / N_I_300).toBeGreaterThan(1.5)
  })

  it('puts the Fermi level 59.5 meV up for every decade of doping', () => {
    const step = carriers({ nd: 1e23 }).efi - carriers({ nd: 1e22 }).efi
    expect(step).toBeCloseTo(VT * Math.LN10, 9)
    expect(step * 1e3).toBeCloseTo(59.5264, 3)
    expect(carriers({ nd: 1e21 }).efi * 1e3).toBeCloseTo(287.150, 2)
    expect(carriers({ nd: 1e22 }).efi * 1e3).toBeCloseTo(346.676, 2)
    expect(carriers({ nd: 1e23 }).efi * 1e3).toBeCloseTo(406.203, 2)
    // p-type puts it the same distance below, because the two are one formula.
    expect(carriers({ na: 1e23 }).efi).toBeCloseTo(-bulkPotential({ na: 1e23 }), 12)
  })

  it('names the temperature each sample goes intrinsic at', () => {
    // A sample doped 10¹⁶ cm⁻³ holds across the range A3 sweeps, and one
    // doped 10¹³ cm⁻³ does not.
    expect(intrinsicAt({ net: 1e22 })).toBeGreaterThan(400)
    expect(intrinsicAt({ net: 1e19 })).toBeLessThan(400)
    // At the temperature it reports, the majority concentration is the stated
    // factor above the doping, measured rather than assumed.
    for (const net of [1e19, 1e21, 1e22]) {
      const T = intrinsicAt({ net })
      expect(carriers({ nd: net, T }).n / net).toBeCloseTo(1.1, 6)
    }
    expect(intrinsicAt({ net: 1e26 })).toBe(Infinity)
  })

  it('refuses a negative doping, and declines degenerate doping with the reason', () => {
    expect(() => carriers({ na: -1 })).toThrow(NetworkError)
    expect(degenerate({ n: 0.9 * DEGENERATE }).degenerate).toBe(false)
    expect(degenerate({ n: 1.1 * DEGENERATE }).degenerate).toBe(true)
    expect(degenerate({ n: 1.1 * DEGENERATE }).reason).toMatch(/Fermi–Dirac/)
    expect(degenerate({ n: 0.9 * DEGENERATE }).reason).toBe('')
  })
})

// ---------------------------------------------------------------------------

describe('invariant 1: charge neutrality across the depletion region', () => {
  it('splits the region so that the two exposed charges cancel, at every bias', () => {
    const r = rng(23)
    for (let k = 0; k < 200; k++) {
      const na = logPick(r, 1e20, 1e26)
      const nd = logPick(r, 1e20, 1e26)
      const v0 = builtIn({ na, nd })
      const v = -logPick(r, 1e-3, 30) * (r() < 0.15 ? -0.5 : 1)
      const p = profile({ na, nd }, Math.min(v, 0.9 * v0))
      expect((na * p.xp) / (nd * p.xn)).toBeCloseTo(1, 9)
      expect(p.xp + p.xn).toBeCloseTo(p.w, 12)
    }
  })

  it('gives the plan’s junction ten times the width on the lightly doped side', () => {
    const p = profile(J, 0)
    expect(p.xn / p.xp).toBeCloseTo(J.na / J.nd, 9)
    expect(p.xn * 1e9).toBeCloseTo(297.504, 2)
    expect(p.xp * 1e9).toBeCloseTo(29.7504, 3)
    expect(p.w * 1e9).toBeCloseTo(327.255, 2)
  })
})

describe('invariant 2: Gauss’s law over the whole region', () => {
  it('integrates the charge density to zero and returns the field to zero at both edges', () => {
    const r = rng(37)
    for (let k = 0; k < 60; k++) {
      const na = logPick(r, 1e20, 1e26)
      const nd = logPick(r, 1e20, 1e26)
      const p = profile({ na, nd }, -logPick(r, 1e-3, 20))
      const charge = overRegion(p, p.rho)
      // The two sides expose equal and opposite charge, so the integral over
      // the whole region is zero against the scale either side carries.
      const scale = Q_E * na * p.xp
      expect(Math.abs(charge) / scale).toBeLessThan(1e-12)
      expect(p.field(-p.xp)).toBe(0)
      expect(p.field(p.xn)).toBe(0)
      expect(p.field(-1.001 * p.xp)).toBe(0)
      expect(p.field(1.001 * p.xn)).toBe(0)
      // Inside, the field is negative everywhere and steepest at the boundary.
      expect(p.field(-p.xp / 2)).toBeLessThan(0)
      expect(p.field(p.xn / 2)).toBeLessThan(0)
      expect(Math.abs(p.field(-Number.MIN_VALUE)) / p.emax).toBeCloseTo(1, 12)
    }
  })

  it('makes the field’s peak the same number by both routes', () => {
    for (const v of [-10, -5, -1, 0, 0.5]) {
      const p = profile(J, v)
      expect(p.emax).toBeCloseTo((2 * p.vj) / p.w, 6)
      expect(p.emax).toBeCloseTo((Q_E * J.nd * p.xn) / EPS_SI, 6)
      expect(peakField(J, v)).toBe(p.emax)
    }
    expect(profile(J, 0).emax / 1e5).toBeCloseTo(46.0118, 3)
    expect(profile(J, -5).emax / 1e5).toBeCloseTo(127.189, 2)
    expect(profile(J, -10).emax / 1e5).toBeCloseTo(173.888, 2)
  })
})

describe('invariant 3: the area under the field is the junction potential', () => {
  it('agrees to 10⁻¹² relative by quadrature, at every doping and bias', () => {
    const r = rng(53)
    for (let k = 0; k < 60; k++) {
      const na = logPick(r, 1e20, 1e26)
      const nd = logPick(r, 1e20, 1e26)
      const v = -logPick(r, 1e-3, 20)
      const p = profile({ na, nd }, v)
      const area = -overRegion(p, p.field)
      expect(area / p.vj).toBeCloseTo(1, 11)
    }
  })

  it('climbs the potential from zero to V_0 − v across the region, in two parabolas', () => {
    const p = profile(J, 0)
    expect(p.potential(-p.xp)).toBe(0)
    expect(p.potential(p.xn)).toBeCloseTo(p.vj, 15)
    expect(p.potential(-2 * p.xp)).toBe(0)
    expect(p.potential(2 * p.xn)).toBeCloseTo(p.vj, 15)
    // The two parabolas meet at the boundary. The p side has climbed
    // qN_Ax_p²/2ε from its edge, the n side has qN_Dx_n²/2ε left to climb, and
    // the two add to the whole barrier.
    const fromP = (Q_E * J.na * p.xp * p.xp) / (2 * EPS_SI)
    const fromN = (Q_E * J.nd * p.xn * p.xn) / (2 * EPS_SI)
    expect(p.potential(-Number.MIN_VALUE)).toBeCloseTo(fromP, 15)
    expect(p.potential(Number.MIN_VALUE)).toBeCloseTo(fromP, 15)
    expect(fromP + fromN).toBeCloseTo(p.vj, 12)
    // And they meet in slope too, which is the field at the boundary.
    const h = p.w / 1e5
    expect(-(p.potential(h) - p.potential(-h)) / (2 * h) / -p.emax).toBeCloseTo(1, 4)
    // The width follows the square root of the barrier, so the plan's sweep is
    // one formula read at five biases.
    for (const v of [-10, -5, -1, 0.5]) {
      expect(depletionWidth(J, v).w).toBeCloseTo(p.w * Math.sqrt((p.v0 - v) / p.v0), 12)
    }
    expect(p.v0 * 1e3).toBeCloseTo(752.879, 2)
  })
})

describe('invariant 4: C_j from the profile equals the closed form', () => {
  it('differentiates the depletion charge and lands on ε_s/W', () => {
    const r = rng(67)
    for (let k = 0; k < 60; k++) {
      const na = logPick(r, 1e21, 1e25)
      const nd = logPick(r, 1e21, 1e25)
      const v = -logPick(r, 0.1, 20)
      // The charge one side exposes, per unit area, as a function of the bias.
      const charge = (u) => Q_E * na * profile({ na, nd }, u).xp
      const h = Math.abs(v) * 1e-6
      // The charge falls as the bias rises, so the capacitance is the slope
      // against the reverse bias, which is the sign C_j is quoted with.
      const measured = -(charge(v + h) - charge(v - h)) / (2 * h)
      const closed = EPS_SI / profile({ na, nd }, v).w
      expect(measured / closed).toBeCloseTo(1, 6)
    }
  })

  it('follows 1/√(1 − v/V_0), which is the law the Electronics Lab was given', () => {
    const cj0 = EPS_SI / profile(J, 0).w
    expect(cj0 * 1e5).toBeCloseTo(31.6554, 3)
    const v0 = builtIn(J)
    for (const v of [-10, -5, -1, 0.5]) {
      expect(EPS_SI / profile(J, v).w).toBeCloseTo(junctionCap({ cj0, v0 }, v), 15)
    }
    // A linearly graded junction takes the cube root instead, and the two are
    // one formula with two exponents.
    expect(junctionCap({ cj0, v0, m: 1 / 3 }, -5)).toBeGreaterThan(junctionCap({ cj0, v0 }, -5))
  })

  it('declines a forward bias at or past the barrier, and names what replaces it', () => {
    const v0 = builtIn(J)
    expect(() => profile(J, v0)).toThrow(/depletion approximation/)
    expect(() => profile(J, v0 + 0.1)).toThrow(NetworkError)
    expect(profile(J, v0 - 0.01).w).toBeLessThan(profile(J, v0 - 0.1).w)
  })
})

describe('breakdown is a field reaching a number', () => {
  it('puts the junction potential at εE²(1/N_A + 1/N_D)/2q, and the peak field back at E_crit', () => {
    const r = rng(83)
    for (let k = 0; k < 60; k++) {
      const na = logPick(r, 1e22, 1e26)
      const nd = logPick(r, 1e21, 1e25)
      const b = breakdown({ na, nd })
      expect(b.vj).toBeCloseTo((EPS_SI * E_AVALANCHE ** 2 * (1 / na + 1 / nd)) / (2 * Q_E), 6)
      // Read the profile back at the bias it names and the peak field is the
      // critical field again, which is the definition the number came from.
      if (b.v < 0) expect(peakField({ na, nd }, b.v) / E_AVALANCHE).toBeCloseTo(1, 9)
    }
  })

  it('makes a Zener diode’s rating a doping, and separates the two mechanisms', () => {
    // One-sided, so 1/N_A is negligible and the textbook's εE²/2qN_D holds.
    for (const [nd, want] of [
      [1e21, 290.991],
      [1e22, 29.1253],
      [1e23, 2.93872],
    ]) {
      const b = breakdown({ na: 1e25, nd })
      expect(b.vj).toBeCloseTo(want, 2)
      // The textbook's one-sided form drops the 1/N_A term, so it reads low by
      // exactly the doping ratio: a part in ten thousand here, a part in a
      // hundred at 10¹⁷ cm⁻³.
      expect(b.vj / ((EPS_SI * E_AVALANCHE ** 2) / (2 * Q_E * nd)) - 1).toBeCloseTo(nd / 1e25, 9)
      // The applied bias is the junction potential less the barrier the doping
      // already built, and at 10¹⁷ cm⁻³ that difference is a third of it.
      expect(b.v).toBeCloseTo(b.v0 - b.vj, 12)
    }
    expect(breakdown({ na: 1e25, nd: 1e21 }).mechanism).toBe('avalanche')
    expect(breakdown({ na: 1e25, nd: 1e23 }).mechanism).toBe('tunnelling')
    // The heavily doped pair reaches the tunnelling field in a layer 75 nm wide.
    expect(peakField({ na: 1e25, nd: 1e24 }, -3) / 1e5).toBeCloseTo(1059.37, 1)
    expect(peakField({ na: 1e25, nd: 1e24 }, -3)).toBeGreaterThan(E_ZENER)
    expect(depletionWidth({ na: 1e25, nd: 1e24 }, -3).w * 1e9).toBeCloseTo(75.347, 2)
    expect(() => breakdown(J, 0)).toThrow(NetworkError)
  })
})

describe('the saturation current, from the geometry', () => {
  it('is qA n_i²(D_p/L_pN_D + D_n/L_nN_A), with Einstein’s relation for each D', () => {
    const s = saturationCurrent({ ...J, area: AREA })
    expect(s.dp).toBeCloseTo(VT * 0.045, 15)
    expect(s.dn).toBeCloseTo(VT * 0.11, 15)
    expect(s.lp).toBeCloseTo(Math.sqrt(s.dp * 1e-6), 15)
    expect(s.ln).toBeCloseTo(Math.sqrt(s.dn * 1e-6), 15)
    expect(s.is).toBeCloseTo(Q_E * AREA * N_I_300 ** 2 * (s.hole + s.electron), 30)
    expect(s.is).toBeCloseTo(1.42179e-15, 20)
    // The plan's two voltages at 1 mA, and the decade that separates any two
    // currents a factor of ten apart.
    expect(VT * Math.log(1e-3 / s.is) * 1e3).toBeCloseTo(705.219, 2)
    expect(VT * Math.log(1e-3 / 1e-14) * 1e3).toBeCloseTo(654.791, 2)
    expect(VT * Math.LN10 * 1e3).toBeCloseTo(59.5264, 3)
  })

  it('refuses a doping or an area of zero', () => {
    expect(() => saturationCurrent({ na: 0, nd: 1e22, area: AREA })).toThrow(NetworkError)
    expect(() => saturationCurrent({ ...J, area: 0 })).toThrow(NetworkError)
  })
})

describe('what the depletion approximation leaves out', () => {
  it('measures the edge tails against the region’s own width', () => {
    const l = debyeLength({ n: 1e23 })
    expect(l).toBeCloseTo(Math.sqrt((EPS_SI * VT) / (Q_E * 1e23)), 15)
    expect(l * 1e9).toBeCloseTo(12.9288, 3)
    // Two edges, so the model is good to about eight per cent at the plan's
    // junction. Measured, not asserted.
    expect((2 * l) / profile(J, 0).w).toBeCloseTo(0.079, 3)
  })

  it('declines the carrier profile inside the region, and names the three things it replaces', () => {
    expect(() => driftDiffusion()).toThrow(NetworkError)
    expect(() => driftDiffusion()).toThrow(/drift-diffusion/)
    expect(() => driftDiffusion()).toThrow(/Debye lengths/)
    expect(() => driftDiffusion()).toThrow(/Generation inside the layer/)
  })
})

// ---------------------------------------------------------------------------

describe('the MOS capacitor', () => {
  it('gives C_ox, φ_F and W_max their closed forms at the plan’s process', () => {
    const t = threshold(MOS)
    expect(t.cox).toBeCloseTo(EPS_OX / MOS.tox, 15)
    expect(t.cox * 1e5).toBeCloseTo(345.313, 2)
    expect(oxideCap({ tox: 5e-9 })).toBeCloseTo(2 * t.cox, 12)
    expect(t.phiF).toBeCloseTo(VT * Math.log(MOS.na / N_I_300), 12)
    expect(t.phiF * 1e3).toBeCloseTo(406.203, 2)
    expect(t.wmax).toBeCloseTo(Math.sqrt((4 * EPS_SI * t.phiF) / (Q_E * MOS.na)), 15)
    expect(t.wmax * 1e9).toBeCloseTo(102.498, 2)
    expect(t.cdmin).toBeCloseTo(EPS_SI / t.wmax, 15)
    expect(t.debye * 1e9).toBeCloseTo(12.9288, 3)
  })

  it('sums the threshold from four terms, and lands the implant on the Electronics Lab’s 0.700 V', () => {
    const t = threshold(MOS)
    expect(t.phims).toBeCloseTo(-(EG_SI / 2 + t.phiF), 12)
    expect(t.phims * 1e3).toBeCloseTo(-966.203, 2)
    expect(t.vfb).toBe(t.phims)
    expect(t.qdep).toBeCloseTo(Q_E * MOS.na * t.wmax, 18)
    expect(t.depTerm * 1e3).toBeCloseTo(475.566, 2)
    expect(t.vt).toBeCloseTo(t.vfb + 2 * t.phiF + t.depTerm, 15)
    expect(t.vt * 1e3).toBeCloseTo(321.769, 2)
    // Invariant 12: the implant closes the gap to the number the Electronics
    // Lab's MOSFET was given, and the pin is that lab's own default.
    const dose = implantFor({ from: t.vt, to: MOSFET_DEFAULTS.vt, cox: t.cox })
    expect(dose / 1e4).toBeCloseTo(8.15193e11, -7)
    expect(threshold({ ...MOS, implant: dose }).vt).toBeCloseTo(MOSFET_DEFAULTS.vt, 12)
    // Oxide charge moves the same term the other way.
    expect(flatBand({ ...MOS, qf: 2.15528e15 }).vfb).toBeCloseTo(t.vfb - 0.1, 5)
    expect(implantFor({ from: 0, to: 0.1, cox: t.cox }) / 1e4).toBeCloseTo(2.15528e11, -7)
  })

  it('takes each gate material as a stated work-function difference, and refuses an unknown one', () => {
    expect(flatBand({ ...MOS, gate: 'p+ poly' }).phims).toBeCloseTo(EG_SI / 2 - threshold(MOS).phiF, 12)
    expect(flatBand({ ...MOS, gate: 'p+ poly' }).phims).toBeGreaterThan(flatBand(MOS).phims)
    expect(flatBand({ ...MOS, gate: 'aluminium' }).phims).toBeLessThan(flatBand(MOS).phims)
    expect(() => flatBand({ ...MOS, gate: 'unobtainium' })).toThrow(/gate material/)
    expect(() => oxideCap({ tox: 0 })).toThrow(NetworkError)
    expect(() => bulkPotential({ na: 0 })).toThrow(NetworkError)
  })

  it('gives γ and S, and the body bias raises the threshold by the amount γ says', () => {
    const t = threshold(MOS)
    expect(t.gamma).toBeCloseTo(Math.sqrt(2 * Q_E * EPS_SI * MOS.na) / t.cox, 12)
    expect(t.gamma).toBeCloseTo(0.5276235, 6)
    expect(t.swing).toBeCloseTo(VT * Math.LN10 * (1 + t.cdmin / t.cox), 15)
    expect(t.swing * 1e3).toBeCloseTo(76.9492, 3)
    for (const vsb of [0, 1, 2, 5]) {
      const b = bodyEffect(MOS, vsb)
      expect(b.shift).toBeCloseTo(t.gamma * (Math.sqrt(2 * t.phiF + vsb) - Math.sqrt(2 * t.phiF)), 12)
      expect(b.vt).toBeCloseTo(t.vt + b.shift, 15)
    }
    expect(bodyEffect(MOS, 1).shift * 1e3).toBeCloseTo(234.7506, 3)
    expect(bodyEffect(MOS, 0).shift).toBe(0)
    expect(() => bodyEffect(MOS, -1)).toThrow(NetworkError)
  })
})

describe('invariant 7: the C–V curve falls with no step, and the two frequencies part in inversion', () => {
  it('runs from C_ox down to C_min, monotonically, at every process the fuzzer picks', () => {
    const r = rng(101)
    for (let k = 0; k < 40; k++) {
      const process = { na: logPick(r, 1e21, 1e24), tox: logPick(r, 2e-9, 100e-9) }
      const t = threshold(process)
      const { c, vg } = cvCurve(process, { from: t.vfb - 2, to: t.vt + 2, points: 401 })
      expect(c[0]).toBeCloseTo(t.cox, 15)
      expect(c[c.length - 1]).toBeCloseTo(t.cmin, 12)
      for (let i = 1; i < c.length; i++) expect(c[i]).toBeLessThanOrEqual(c[i - 1] * (1 + 1e-12))
      expect(vg[0]).toBeCloseTo(t.vfb - 2, 12)
      // No step, which is a statement about the two joints rather than about
      // the grid: the curve leaving flat band and the curve arriving at
      // threshold each match the branch on the other side to floating point.
      const eps = 1e-12
      expect(mosCap(process, t.vfb - eps).c).toBeCloseTo(t.cox, 15)
      expect(mosCap(process, t.vfb + eps).c / t.cox).toBeCloseTo(1, 5)
      expect(mosCap(process, t.vt - eps).c / t.cmin).toBeCloseTo(1, 9)
      expect(mosCap(process, t.vt + eps).c).toBeCloseTo(t.cmin, 15)
      // The two curves are the same function outside inversion.
      for (const v of [t.vfb - 1, t.vfb, (t.vfb + t.vt) / 2, t.vt - 1e-9]) {
        expect(mosCap(process, v, { frequency: 'low' }).c).toBeCloseTo(mosCap(process, v).c, 18)
      }
      // And they differ by the whole of it above threshold.
      expect(mosCap(process, t.vt + 1, { frequency: 'low' }).c).toBeCloseTo(t.cox, 15)
      expect(mosCap(process, t.vt + 1).c).toBeCloseTo(t.cmin, 15)
    }
  })

  it('names the three regimes by their conditions on the surface potential', () => {
    const t = threshold(MOS)
    expect(surfacePotential(MOS, t.vfb - 1).regime).toBe('accumulation')
    expect(surfacePotential(MOS, t.vfb - 1).psi).toBe(0)
    expect(surfacePotential(MOS, (t.vfb + t.vt) / 2).regime).toBe('depletion')
    expect(surfacePotential(MOS, t.vt + 1).regime).toBe('inversion')
    expect(surfacePotential(MOS, t.vt + 1).psi).toBeCloseTo(2 * t.phiF, 15)
    // In depletion the gate voltage divides between the oxide and the layer,
    // which is the relation the root came from, read back.
    for (const v of [-0.6, -0.3, 0, 0.2]) {
      const s = surfacePotential(MOS, v)
      if (s.regime !== 'depletion') continue
      expect(t.vfb + s.psi + Math.sqrt(2 * Q_E * EPS_SI * MOS.na * s.psi) / t.cox).toBeCloseTo(v, 9)
    }
    expect(() => mosCap(MOS, 0, { frequency: 'audio' })).toThrow(NetworkError)
  })

  it('reads the substrate doping off C_min/C_ox, which is what the industry uses it for', () => {
    expect(threshold(MOS).ratio).toBeCloseTo(0.226419, 6)
    expect(1 / threshold(MOS).ratio).toBeCloseTo(4.41659, 4)
    for (const [na, want] of [
      [1e21, 0.0336406],
      [1e22, 0.0910647],
      [1e23, 0.226419],
      [1e24, 0.463633],
    ]) {
      expect(threshold({ na, tox: 10e-9 }).ratio).toBeCloseTo(want, 6)
      // The read-back is the same curve inverted, so it returns the doping.
      expect(dopingFromRatio({ ratio: want, tox: 10e-9 }) / na).toBeCloseTo(1, 4)
    }
    expect(() => dopingFromRatio({ ratio: 1.2, tox: 10e-9 })).toThrow(NetworkError)
  })

  it('halves C_ox for twice the oxide, and moves the threshold with it', () => {
    for (const [tox, want] of [
      [5e-9, 83.9859],
      [10e-9, 321.769],
      [20e-9, 797.335],
      [50e-9, 2224.03],
    ]) {
      expect(threshold({ na: 1e23, tox }).vt * 1e3).toBeCloseTo(want, 2)
      expect(threshold({ na: 1e23, tox }).cox * tox).toBeCloseTo(EPS_OX, 18)
    }
  })
})

describe('invariant 8: C_min from the profile equals the closed form', () => {
  it('differentiates the depletion charge under the gate at 2φ_F', () => {
    const r = rng(113)
    for (let k = 0; k < 40; k++) {
      const process = { na: logPick(r, 1e21, 1e24), tox: logPick(r, 2e-9, 100e-9) }
      const t = threshold(process)
      // Q_dep(ψ) = √(2qε_sN_Aψ), and its slope at the surface potential the
      // layer stops at is C_dmin.
      const charge = (psi) => Math.sqrt(2 * Q_E * EPS_SI * process.na * psi)
      const psi = 2 * t.phiF
      const h = psi * 1e-6
      const cdmin = (charge(psi + h) - charge(psi - h)) / (2 * h)
      expect(cdmin / t.cdmin).toBeCloseTo(1, 9)
      expect((t.cox * cdmin) / (t.cox + cdmin) / t.cmin).toBeCloseTo(1, 9)
      // And the width at that potential is W_max, by the other route.
      expect(surfaceDepletion(process, psi).w / t.wmax).toBeCloseTo(1, 12)
      expect(surfaceDepletion(process, 10 * psi).w).toBeCloseTo(t.wmax, 15)
      expect(surfaceDepletion(process, -1).w).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------

describe('invariant 9: the square law is the integrated channel charge', () => {
  it('agrees with the quadrature in triode and in saturation, at every setting', () => {
    const r = rng(127)
    for (let k = 0; k < 200; k++) {
      const kn = logPick(r, 1e-5, 1e-2)
      const vt = 0.2 + 1.3 * r()
      const vgs = vt + logPick(r, 0.01, 3)
      const vds = logPick(r, 0.01, 5)
      const closed = drainCurrent({ kn, vt }, { vgs, vds }).id
      const integral = channelIntegral({ kn, vt }, { vgs, vds })
      expect(integral / closed).toBeCloseTo(1, 9)
    }
    expect(drainCurrent({ kn: 1e-3, vt: 0.7 }, { vgs: 0.5, vds: 1 }).id).toBe(0)
    expect(drainCurrent({ kn: 1e-3, vt: 0.7 }, { vgs: 0.5, vds: 1 }).region).toBe('cutoff')
    expect(channelIntegral({ kn: 1e-3, vt: 0.7 }, { vgs: 0.5, vds: 1 })).toBe(0)
    expect(() => drainCurrent({ kn: 0, vt: 0.7 }, { vgs: 1, vds: 1 })).toThrow(NetworkError)
  })

  it('matches the two expressions in value and in slope at pinch-off', () => {
    const dev = { kn: 1.72657e-3, vt: 0.7 }
    const vgs = 1.2
    const vov = vgs - dev.vt
    const h = 1e-7
    const below = drainCurrent(dev, { vgs, vds: vov - h })
    const above = drainCurrent(dev, { vgs, vds: vov + h })
    expect(below.region).toBe('triode')
    expect(above.region).toBe('saturation')
    expect(below.id / above.id).toBeCloseTo(1, 12)
    // The slope on the triode side falls to zero at the boundary, which is what
    // makes the pair one curve rather than two.
    const slope = (v) => (drainCurrent(dev, { vgs, vds: v + h }).id - drainCurrent(dev, { vgs, vds: v - h }).id) / (2 * h)
    expect(slope(vov - 10 * h) / (dev.kn * vov)).toBeLessThan(1e-3)
    expect(slope(vov + 10 * h)).toBeCloseTo(0, 9)
  })

  it('gives the plan’s currents at the plan’s process', () => {
    const t = threshold(MOS)
    const kprime = 0.05 * t.cox
    expect(kprime * 1e6).toBeCloseTo(172.657, 2)
    const dev = { kn: 10 * kprime, vt: 0.7 }
    expect(drainCurrent(dev, { vgs: 1.2, vds: 1 }).id * 1e6).toBeCloseTo(215.821, 2)
    expect(drainCurrent(dev, { vgs: 1.2, vds: 0.25 }).id * 1e6).toBeCloseTo(161.866, 2)
    expect(drainCurrent(dev, { vgs: 1.2, vds: 0.25 }).region).toBe('triode')
    expect(t.cox * 0.5 * 1e5).toBeCloseTo(172.657, 2)
    expect(drainCurrent({ ...dev, lambda: 0.05 }, { vgs: 1.2, vds: 1 }).ro / 1e3).toBeCloseTo(92.6694, 3)
    expect(drainCurrent(dev, { vgs: 1.2, vds: 1 }).ro).toBe(Infinity)
  })
})

describe('invariant 10: g_m is the derivative', () => {
  it('equals a central difference of I_D against V_GS, and 2I_D/V_OV in saturation', () => {
    const r = rng(139)
    for (let k = 0; k < 120; k++) {
      const kn = logPick(r, 1e-5, 1e-2)
      const vt = 0.2 + 1.3 * r()
      const vov = logPick(r, 0.05, 3)
      const vgs = vt + vov
      const vds = vov * (1 + logPick(r, 0.01, 4))
      const h = 1e-6
      const dev = { kn, vt }
      const measured = (drainCurrent(dev, { vgs: vgs + h, vds }).id - drainCurrent(dev, { vgs: vgs - h, vds }).id) / (2 * h)
      const point = drainCurrent(dev, { vgs, vds })
      expect(measured / point.gm).toBeCloseTo(1, 6)
      if (point.region === 'saturation') expect(point.gm).toBeCloseTo((2 * point.id) / vov, 9)
    }
  })

  it('puts g_m/I_D at 4.00 per volt at half a volt of overdrive', () => {
    const kn = 10 * 0.05 * threshold(MOS).cox
    const point = drainCurrent({ kn, vt: 0.7 }, { vgs: 1.2, vds: 1 })
    expect(point.gm * 1e6).toBeCloseTo(863.283, 2)
    expect(point.gm / point.id).toBeCloseTo(4, 9)
    expect(point.gm / point.id).toBeCloseTo(2 / point.vov, 12)
  })
})

describe('where the square law stops', () => {
  it('costs S millivolts a decade below threshold, and names the overdrive velocity saturation takes', () => {
    const t = threshold(MOS)
    const s = subthreshold({ swing: t.swing, from: 2.15821e-4, to: 1e-9 })
    expect(s.decades).toBeCloseTo(Math.log10(2.15821e-4 / 1e-9), 12)
    expect(s.dv * 1e3).toBeCloseTo(410.453, 2)
    expect(subthreshold({ swing: t.swing, from: 1e-3, to: 1e-8 }).dv).toBeCloseTo(5 * t.swing, 12)
    expect(() => subthreshold({ swing: 0, from: 1, to: 1 })).toThrow(NetworkError)
    expect(velocitySaturation({ length: 1e-6 })).toBeCloseTo(2, 12)
    expect(velocitySaturation({ length: 0.1e-6 })).toBeCloseTo(0.2, 12)
  })
})

// ---------------------------------------------------------------------------

describe('the BJT from two junctions', () => {
  it('gets I_S and β from the two Gummel numbers, and nothing else', () => {
    const g = gummel(B)
    expect(g.gummelBase).toBeCloseTo(B.nb * B.wb, 6)
    expect(g.gummelEmitter).toBeCloseTo(B.ne * B.we, 6)
    expect(g.gummelBase / 1e4).toBeCloseTo(5e12, -8)
    expect(g.gummelEmitter / 1e4).toBeCloseTo(3e14, -10)
    expect(g.is).toBeCloseTo((Q_E * B.area * N_I_300 ** 2 * B.db) / g.gummelBase, 25)
    expect(g.is).toBeCloseTo(7.45565e-15, 20)
    expect(g.beta).toBeCloseTo((B.db * g.gummelEmitter) / (B.de * g.gummelBase), 9)
    expect(g.beta).toBeCloseTo(480.009, 2)
    expect(g.alpha).toBeCloseTo(g.beta / (g.beta + 1), 15)
    expect(g.alpha).toBeCloseTo(0.997921, 6)
    expect(g.vbeAt(1e-3) * 1e3).toBeCloseTo(662.381, 2)
    // Doubling the base Gummel number halves I_S and halves β together.
    const thicker = gummel({ ...B, wb: 2 * B.wb })
    expect(thicker.is / g.is).toBeCloseTo(0.5, 9)
    expect(thicker.beta / g.beta).toBeCloseTo(0.5, 9)
    for (const key of ['ne', 'we', 'nb', 'wb', 'area', 'db', 'de']) expect(() => gummel({ ...B, [key]: 0 })).toThrow(NetworkError)
  })

  it('caps f_T at 1/(2πτ_B), and quadruples the cap when the base halves', () => {
    const g = gummel(B)
    expect(g.tauB).toBeCloseTo((B.wb * B.wb) / (2 * B.db), 18)
    expect(g.tauB * 1e12).toBeCloseTo(120.878, 2)
    expect(g.ftLimit / 1e9).toBeCloseTo(1.31666, 4)
    const half = gummel({ ...B, wb: B.wb / 2 })
    expect(half.tauB / g.tauB).toBeCloseTo(0.25, 12)
    expect(half.ftLimit / g.ftLimit).toBeCloseTo(4, 12)
    expect(gummel({ ...B, wb: 1e-6 }).ftLimit / 1e9).toBeCloseTo(0.329164, 5)
  })

  it('takes the Early voltage off the collector junction’s edge, moving into the base', () => {
    const e = earlyVoltage(B, 5)
    expect(e.intoBase).toBeCloseTo(depletionWidth({ na: B.nb, nd: B.nc }, -5).xp, 15)
    expect(e.intoBase * 1e9).toBeCloseTo(82.2382, 3)
    expect(e.w * 1e9).toBeCloseTo(904.620, 2)
    expect(e.neutralBase).toBeCloseTo(B.wb - e.intoBase, 15)
    expect(e.taken).toBeCloseTo(0.164476, 5)
    // The rate is the derivative of the edge against the bias, measured.
    const h = 1e-5
    const edge = (v) => depletionWidth({ na: B.nb, nd: B.nc }, -v).xp
    expect((edge(5 + h) - edge(5 - h)) / (2 * h) / e.rate).toBeCloseTo(1, 6)
    expect(e.rate * 1e9).toBeCloseTo(7.14757, 4)
    expect(e.va).toBeCloseTo(B.wb / e.rate, 12)
    expect(e.va).toBeCloseTo(69.9539, 3)
    // More reverse bias moves the edge more slowly, so V_A climbs with V_CB.
    expect(earlyVoltage(B, 10).va).toBeGreaterThan(e.va)
    expect(() => earlyVoltage({ ...B, wb: 0 }, 5)).toThrow(NetworkError)
  })
})

// ---------------------------------------------------------------------------

describe('invariant 11: the maximum power point is stationary', () => {
  it('puts dP/dV below 10⁻¹⁰ of I_sc, at every cell the fuzzer builds', () => {
    const r = rng(151)
    for (let k = 0; k < 120; k++) {
      const is = logPick(r, 1e-15, 1e-8)
      const il = logPick(r, 1e-4, 1)
      const cell = photovoltaic({ is, il })
      expect(Math.abs(cell.slope(cell.vmp)) / cell.isc).toBeLessThan(1e-10)
      expect(cell.pmax).toBeCloseTo(cell.ff * cell.voc * cell.isc, 15)
      expect(cell.pmax).toBeGreaterThanOrEqual(cell.power(cell.vmp * 0.99))
      expect(cell.pmax).toBeGreaterThanOrEqual(cell.power(cell.vmp * 1.01))
      expect(cell.voc).toBeCloseTo(VT * Math.log(il / is + 1), 12)
      expect(cell.current(0)).toBeCloseTo(il, 15)
      expect(Math.abs(cell.current(cell.voc)) / il).toBeLessThan(1e-12)
      expect(cell.ff).toBeGreaterThan(0.5)
      expect(cell.ff).toBeLessThan(1)
    }
  })

  it('gives the plan’s cell its point, its fill factor and its efficiency', () => {
    const cell = photovoltaic({ is: 1e-12, il: 35e-3, area: 1e-4 })
    expect(cell.voc * 1e3).toBeCloseTo(627.651, 2)
    expect(cell.vmp * 1e3).toBeCloseTo(547.531, 2)
    expect(cell.imp * 1e3).toBeCloseTo(33.4220, 3)
    expect(cell.pmax * 1e3).toBeCloseTo(18.2996, 3)
    expect(cell.ff).toBeCloseTo(0.833019, 6)
    expect(cell.efficiency * 100).toBeCloseTo(18.2996, 3)
    // The empirical fill factor is an approximation, and its error is printed
    // rather than left to look like agreement.
    expect(cell.ffEmpirical).toBeCloseTo(0.833107, 6)
    expect(Math.abs(cell.ffError)).toBeLessThan(2e-4)
    expect(cell.ffError).toBeCloseTo((cell.ffEmpirical - cell.ff) / cell.ff, 15)
    // A worse junction and a brighter sun each move V_oc by a logarithm.
    expect(photovoltaic({ is: 1e-10, il: 35e-3 }).voc * 1e3).toBeCloseTo(508.598, 2)
    expect(photovoltaic({ is: 1e-10, il: 35e-3 }).ff).toBeCloseTo(0.805693, 6)
    expect(photovoltaic({ is: 1e-12, il: 350e-3 }).voc * 1e3).toBeCloseTo(687.177, 2)
    expect(photovoltaic({ is: 1e-12, il: 350e-3 }).voc - cell.voc).toBeCloseTo(VT * Math.LN10, 6)
    // One ohm of series resistance costs I_mp volts at the point.
    expect(photovoltaic({ is: 1e-12, il: 35e-3, rs: 1 }).seriesLoss * 1e3).toBeCloseTo(33.4220, 3)
  })

  it('holds together at the hostile corner where the light is below the leakage', () => {
    const dark = photovoltaic({ is: 1e-9, il: 1e-12 })
    expect(dark.voc).toBeGreaterThan(0)
    expect(dark.voc).toBeLessThan(VT)
    expect(dark.pmax).toBeGreaterThan(0)
    expect(photovoltaic({ is: 1e-12, il: 0 }).voc).toBe(0)
    expect(() => photovoltaic({ is: 0, il: 1e-3 })).toThrow(NetworkError)
    expect(() => photovoltaic({ is: 1e-12, il: -1 })).toThrow(NetworkError)
  })

  it('emits at hc/E_g, and cannot be driven below E_g/q', () => {
    for (const [name, nm] of [
      ['silicon', 1107.00],
      ['gallium arsenide', 873.128],
      ['gallium phosphide', 548.603],
      ['gallium nitride', 364.659],
    ]) {
      const e = emission({ eg: MATERIALS[name] })
      expect(e.wavelength * 1e9).toBeCloseTo(nm, 2)
      expect(e.vf).toBe(MATERIALS[name])
      expect(e.photonEnergy).toBeCloseTo(MATERIALS[name] * Q_E, 25)
    }
    // Twice the gap is half the wavelength, which is the whole of the law.
    expect(emission({ eg: 2 * MATERIALS.silicon }).wavelength).toBeCloseTo(emission({ eg: MATERIALS.silicon }).wavelength / 2, 15)
    expect(() => emission({ eg: 0 })).toThrow(NetworkError)
  })
})

// ---------------------------------------------------------------------------

describe('fabrication: what each step sets', () => {
  it('turns a dose over a depth into the doping the earlier groups took as a knob', () => {
    expect(implantDoping({ dose: 1e16, depth: 0.1e-6 })).toBeCloseTo(1e23, -14)
    expect(builtIn({ na: implantDoping({ dose: 1e16, depth: 0.1e-6 }), nd: 1e22 }) * 1e3).toBeCloseTo(752.879, 2)
    expect(doseFor({ doping: 1e23, depth: 0.1e-6 })).toBeCloseTo(1e16, -7)
    expect(implantDoping({ dose: doseFor({ doping: 1e23, depth: 0.1e-6 }), depth: 0.1e-6 })).toBeCloseTo(1e23, -14)
    expect(() => implantDoping({ dose: 0, depth: 1e-6 })).toThrow(NetworkError)
    expect(() => implantDoping({ dose: 1e16, depth: 0 })).toThrow(NetworkError)
  })
})

describe('the hostile corners the plan names', () => {
  it('holds at 10²⁰ cm⁻³ on both sides, 10 mV from the barrier, and a 2 nm oxide', () => {
    const heavy = { na: 1e26, nd: 1e26 }
    const p = profile(heavy, 0)
    expect(p.w).toBeGreaterThan(0)
    expect((heavy.na * p.xp) / (heavy.nd * p.xn)).toBeCloseTo(1, 9)
    expect(degenerate({ n: heavy.na }).degenerate).toBe(true)

    const v0 = builtIn(J)
    const near = profile(J, v0 - 0.01)
    expect(near.w).toBeGreaterThan(0)
    expect(near.vj).toBeCloseTo(0.01, 9)
    expect(-overRegion(near, near.field) / near.vj).toBeCloseTo(1, 9)

    const thin = threshold({ na: 1e23, tox: 2e-9 })
    expect(thin.cox).toBeCloseTo(5 * threshold(MOS).cox, 12)
    expect(thin.vt).toBeLessThan(threshold(MOS).vt)
    expect(mosCap({ na: 1e23, tox: 2e-9 }, thin.vt + 1).c).toBeCloseTo(thin.cmin, 15)

    expect(bodyEffect(MOS, 5).shift).toBeGreaterThan(bodyEffect(MOS, 1).shift)
  })
})
