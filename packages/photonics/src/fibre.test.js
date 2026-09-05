import { describe, it, expect } from 'vitest'
import {
  BANDWIDTH_CRITERION,
  V_SINGLE_MODE,
  attenuation,
  bandChannels,
  bandwidthDistance,
  bandwidthLimit,
  beta2,
  bindingLimit,
  channelGrid,
  dispersion,
  dispersionFromBeta2,
  dispersionReach,
  lengthForLoss,
  linkBudget,
  lossReach,
  modeCount,
  nonlinearAvailable,
  numericalAperture,
  powerAfter,
  refuseNonlinear,
  singleModeDiameter,
  vNumber,
} from './fibre.js'
import { C0, PhotonicsError, toDbm } from './const.js'
import { logUniform, randomFibre, randomWavelength, relative, rng, uniform } from './fuzz.js'

// The fibre. Attenuation and the first-order dispersion model are exact, so the
// tolerances here are floating point.
//
// Two invariants of `PHOTONICS_LAB_PLAN.md` §2.11 live in this file. Number 9,
// attenuation composes: the loss of two lengths in series is the sum of their
// losses in decibels and the product of their power ratios, which is the whole
// reason a budget is a sum. Number 10, dispersion composes: the spread over two
// lengths is the sum of the two spreads, and beta_2 recovered from D returns D.
//
// The hostile corners the plan names are here too: a fibre with zero dispersion,
// a zero-length span, and a source of zero spectral width.

const NM = 1e-9
const KM = 1e3
// A dispersion parameter in base units. 17 ps/(nm km) is 17e-12 s over 1e-9 m
// of wavelength and 1e3 m of length, which is 17e-6 s/m^2.
const PS_NM_KM = 1e-6

describe('attenuation over a length', () => {
  it('the three windows over 80 km are the losses the plan pins', () => {
    expect(attenuation({ alphaDb: 0.2, length: 80 * KM }).db).toBeCloseTo(16, 12)
    expect(attenuation({ alphaDb: 0.35, length: 80 * KM }).db).toBeCloseTo(28, 12)
    expect(attenuation({ alphaDb: 2.0, length: 80 * KM }).db).toBeCloseTo(160, 12)
    expect(attenuation({ alphaDb: 0.2, length: 80 * KM }).ratio).toBeCloseTo(0.0251189, 7)
  })

  // Invariant 9.
  it('composes: two lengths cost the sum in decibels and the product in ratio', () => {
    const r = rng(0x9009)
    for (let k = 0; k < 100; k++) {
      const alphaDb = logUniform(r, 0.1, 4)
      const l1 = logUniform(r, 10, 1e5)
      const l2 = logUniform(r, 10, 1e5)
      const a1 = attenuation({ alphaDb, length: l1 })
      const a2 = attenuation({ alphaDb, length: l2 })
      const both = attenuation({ alphaDb, length: l1 + l2 })
      expect(relative(both.db, a1.db + a2.db)).toBeLessThan(1e-14)
      expect(relative(both.ratio, a1.ratio * a2.ratio)).toBeLessThan(1e-13)
    }
  })

  it('the length that costs a stated loss is the inverse of the loss over a length', () => {
    const r = rng(0xa10a)
    for (let k = 0; k < 60; k++) {
      const alphaDb = logUniform(r, 0.1, 4)
      const length = logUniform(r, 100, 2e5)
      expect(relative(lengthForLoss({ alphaDb, db: attenuation({ alphaDb, length }).db }), length)).toBeLessThan(1e-13)
    }
  })

  it('the power at the far end is the power in times the ratio, in watts and in dBm', () => {
    const p = powerAfter({ alphaDb: 0.2, length: 80 * KM, power: 1e-3 })
    expect(p.inDbm).toBeCloseTo(0, 12)
    expect(p.outDbm).toBeCloseTo(-16, 12)
    expect(relative(p.out, 1e-3 * p.ratio)).toBeLessThan(1e-15)
    expect(relative(toDbm(p.out), p.outDbm)).toBeLessThan(1e-15)
  })

  it('a zero-length span costs nothing and leaves everything', () => {
    const a = attenuation({ alphaDb: 2, length: 0 })
    expect(a.db).toBe(0)
    expect(a.ratio).toBe(1)
  })
})

describe('dispersion spreads a pulse', () => {
  it('a 1 nm source over 80 km of D = 17 fibre spreads by 1360 ps', () => {
    const d = dispersion({ D: 17 * PS_NM_KM, length: 80 * KM, dLambda: 1 * NM })
    expect(d.spread * 1e12).toBeCloseTo(1360, 9)
    expect(dispersion({ D: 17 * PS_NM_KM, length: 80 * KM, dLambda: 0.1 * NM }).spread * 1e12).toBeCloseTo(136, 9)
  })

  // Invariant 10, first half.
  it('composes: the spread over two lengths is the sum of the two spreads', () => {
    const r = rng(0xd10d)
    for (let k = 0; k < 100; k++) {
      const f = randomFibre(r)
      const l2 = logUniform(r, 10, 1e5)
      const s1 = dispersion({ ...f, length: f.length }).spread
      const s2 = dispersion({ ...f, length: l2 }).spread
      const both = dispersion({ ...f, length: f.length + l2 }).spread
      expect(relative(both, s1 + s2)).toBeLessThan(1e-14)
    }
  })

  // Invariant 10, second half.
  it('beta_2 recovered from D returns D, and carries the opposite sign', () => {
    const r = rng(0xb2b2)
    for (let k = 0; k < 100; k++) {
      const D = uniform(r, -20, 20) * PS_NM_KM
      const lambda = randomWavelength(r)
      const b2 = beta2({ D, lambda })
      if (D !== 0) expect(Math.sign(b2)).toBe(-Math.sign(D))
      expect(relative(dispersionFromBeta2({ beta2: b2, lambda }), D)).toBeLessThan(1e-12)
    }
  })

  it('beta_2 at 1550 and 1310 nm are the numbers the plan pins', () => {
    expect(beta2({ D: 17 * PS_NM_KM, lambda: 1550 * NM }) * 1e27).toBeCloseTo(-21.683, 3)
    expect(beta2({ D: 17 * PS_NM_KM, lambda: 1310 * NM }) * 1e27).toBeCloseTo(-15.488, 3)
    // Written the other way, so the definition is the check rather than a table.
    const lambda = 1550 * NM
    expect(relative(beta2({ D: 17 * PS_NM_KM, lambda }), (-17 * PS_NM_KM * lambda * lambda) / (2 * Math.PI * C0))).toBe(0)
  })

  it('a fibre with zero dispersion spreads nothing at any length', () => {
    expect(dispersion({ D: 0, length: 1e6, dLambda: 10 * NM }).spread).toBe(0)
    // Negative zero, because the relation carries a sign flip and the sign of
    // zero survives it. It is zero either way.
    expect(Math.abs(beta2({ D: 0, lambda: 1550 * NM }))).toBe(0)
    expect(() => bandwidthLimit({ spread: 0 })).toThrow(/spread must be a positive number/)
  })

  it('a source of zero width spreads nothing, whatever the fibre', () => {
    expect(dispersion({ D: 17 * PS_NM_KM, length: 1e6, dLambda: 0 }).spread).toBe(0)
  })
})

describe('the bit rate a spread allows, under a stated criterion', () => {
  it('carries the criterion beside the number, because it is a definition', () => {
    const b = bandwidthLimit({ spread: 1360e-12 })
    expect(b.criterion).toBe(BANDWIDTH_CRITERION)
    expect(b.text).toMatch(/0\.25/)
    expect(b.rate / 1e9).toBeCloseTo(0.18382, 5)
    // Twice the criterion is twice the rate on the same fibre, and neither is
    // more correct than the other.
    expect(relative(bandwidthLimit({ spread: 1360e-12, criterion: 0.5 }).rate, 2 * b.rate)).toBeLessThan(1e-14)
  })

  it('the bandwidth-distance product is the rate times the length times the width', () => {
    const r = rng(0xbd00)
    for (let k = 0; k < 60; k++) {
      const f = randomFibre(r)
      if (Math.abs(f.D) < 1e-9) continue
      const spread = dispersion(f).spread
      if (spread === 0) continue
      const rate = bandwidthLimit({ spread }).rate
      const product = bandwidthDistance({ D: f.D, dLambda: f.dLambda }).product
      expect(relative(product, rate * f.length)).toBeLessThan(1e-13)
    }
  })

  it('the product for D = 17 and a 1 nm source is 14.706 Gbit/s km per nm', () => {
    const p = bandwidthDistance({ D: 17 * PS_NM_KM, dLambda: 1 * NM })
    expect(p.product / 1e9 / KM).toBeCloseTo(14.706, 3)
  })

  it('the dispersion-limited reach at 10 Gbit/s with a 1 nm source is 1.4706 km', () => {
    const l = dispersionReach({ D: 17 * PS_NM_KM, dLambda: 1 * NM, rate: 1e10 })
    expect(l / KM).toBeCloseTo(1.4706, 4)
    // And the spread at that length is exactly a quarter of a bit period.
    expect(relative(dispersion({ D: 17 * PS_NM_KM, dLambda: 1 * NM, length: l }).spread, 0.25 / 1e10)).toBeLessThan(1e-13)
  })
})

describe('the core, the cladding, and one mode', () => {
  const STANDARD = { n1: 1.4675, n2: 1.4622 }

  it('the numerical aperture, the acceptance angle and the index difference', () => {
    const na = numericalAperture(STANDARD)
    expect(na.na).toBeCloseTo(0.124609, 6)
    expect(na.angle).toBeCloseTo(7.1582, 4)
    expect(na.delta * 100).toBeCloseTo(0.36051, 5)
    expect(relative(na.na, Math.sqrt(STANDARD.n1 ** 2 - STANDARD.n2 ** 2))).toBe(0)
    expect(relative(Math.sin((na.angle * Math.PI) / 180), na.na)).toBeLessThan(1e-15)
  })

  it('declines a cladding that guides nothing, by name', () => {
    expect(() => numericalAperture({ n1: 1.45, n2: 1.46 })).toThrow(PhotonicsError)
    expect(() => numericalAperture({ n1: 1.45, n2: 1.46 })).toThrow(/must be larger than the cladding index/)
  })

  it('V rises with the core and falls with the wavelength', () => {
    const r = rng(0x5011)
    for (let k = 0; k < 60; k++) {
      const a = logUniform(r, 2e-6, 5e-5)
      const lambda = randomWavelength(r)
      const na = numericalAperture(STANDARD).na
      const v = vNumber({ a, na, lambda })
      expect(relative(v, (2 * Math.PI * a * na) / lambda)).toBeLessThan(1e-15)
      expect(vNumber({ a: 2 * a, na, lambda })).toBeGreaterThan(v)
      expect(vNumber({ a, na, lambda: 2 * lambda })).toBeLessThan(v)
    }
  })

  it('the single-mode diameter is the core at which V is exactly 2.405', () => {
    const r = rng(0x2405)
    for (let k = 0; k < 60; k++) {
      const lambda = randomWavelength(r)
      const na = uniform(r, 0.05, 0.4)
      const d = singleModeDiameter({ na, lambda })
      expect(relative(vNumber({ a: d / 2, na, lambda }), V_SINGLE_MODE)).toBeLessThan(1e-14)
    }
    expect(singleModeDiameter({ na: numericalAperture(STANDARD).na, lambda: 1550 * NM }) * 1e6).toBeCloseTo(9.5224, 4)
  })

  it('the mode count is one and exact below the limit, and an estimate above it', () => {
    const na = numericalAperture(STANDARD).na
    const below = modeCount(vNumber({ a: 4e-6, na, lambda: 1550 * NM }))
    expect(below.modes).toBe(1)
    expect(below.estimate).toBe(false)
    const big = modeCount(vNumber({ a: 25e-6, na, lambda: 850 * NM }))
    expect(big.v).toBeCloseTo(23.028, 3)
    expect(big.modes).toBe(265)
    expect(big.estimate).toBe(true)
  })
})

describe('many colours down one fibre', () => {
  it('a 100 GHz grid at 1550 nm is 0.80139 nm wide', () => {
    const g = channelGrid({ spacing: 100e9, lambda: 1550 * NM })
    expect(g.width * 1e9).toBeCloseTo(0.80139, 5)
    expect(relative(g.width, ((1550 * NM) ** 2 * 100e9) / C0)).toBe(0)
  })

  it('the same grid is wider in wavelength at a longer wavelength', () => {
    const r = rng(0x9c9c)
    for (let k = 0; k < 40; k++) {
      const spacing = logUniform(r, 12.5e9, 200e9)
      const lambda = randomWavelength(r)
      expect(channelGrid({ spacing, lambda: 1.1 * lambda }).width).toBeGreaterThan(channelGrid({ spacing, lambda }).width)
    }
  })

  it('the C band is 4.3821 THz and holds 43 channels on that grid', () => {
    const b = bandChannels({ from: 1530 * NM, to: 1565 * NM, spacing: 100e9 })
    expect(b.width / 1e12).toBeCloseTo(4.3821, 4)
    expect(b.channels).toBe(43)
    expect(relative(b.width, C0 / (1530 * NM) - C0 / (1565 * NM))).toBeLessThan(1e-15)
  })

  it('a band with its ends the wrong way round is declined by name', () => {
    expect(() => bandChannels({ from: 1565 * NM, to: 1530 * NM, spacing: 100e9 })).toThrow(/must be past its short one/)
  })
})

describe('the link budget, and which limit binds', () => {
  const FIBRE = { alphaDb: 0.2, length: 80 * KM }
  const items = () => [
    { name: 'fibre', db: attenuation(FIBRE).db },
    { name: 'connectors', db: 1.0 },
    { name: 'splices', db: 0.4 },
    { name: 'dispersion penalty', db: 1.0 },
    { name: 'modal noise', db: 0 },
    { name: 'reflection penalty', db: 0 },
    { name: 'mode-partition noise', db: 0 },
  ]

  it('sums the line items, and a zero is a line item rather than an omission', () => {
    const b = linkBudget({ txDbm: -3, items: items(), sensitivityDbm: -28 })
    expect(b.total).toBeCloseTo(18.4, 12)
    expect(b.received).toBeCloseTo(-21.4, 12)
    expect(b.margin).toBeCloseTo(6.6, 12)
    expect(b.items.filter((i) => i.db === 0).map((i) => i.name)).toEqual(['modal noise', 'reflection penalty', 'mode-partition noise'])
    expect(relative(b.total, b.items.reduce((s, i) => s + i.db, 0))).toBeLessThan(1e-15)
  })

  it('the received power in watts is the transmitted power through the same ratio', () => {
    const b = linkBudget({ txDbm: -3, items: items(), sensitivityDbm: -28 })
    const straight = 1e-3 * Math.pow(10, -3 / 10) * Math.pow(10, -b.total / 10)
    expect(relative(b.receivedWatts, straight)).toBeLessThan(1e-12)
  })

  it('every line item is named, and an unnamed one is declined', () => {
    expect(() => linkBudget({ txDbm: -3, items: [{ db: 1 }], sensitivityDbm: -28 })).toThrow(/Every line item in a budget is named/)
    expect(() => linkBudget({ txDbm: -3, items: [], sensitivityDbm: -28 })).toThrow(/at least one line item/)
  })

  it('the loss-limited reach spends what the fixed items and the margin leave', () => {
    const reach = lossReach({ txDbm: -3, sensitivityDbm: -28, fixedDb: 2.4, marginDb: 3, alphaDb: 0.2 })
    expect(reach.forFibre).toBeCloseTo(19.6, 12)
    expect(reach.length / KM).toBeCloseTo(98, 9)
    // At that length the budget closes with exactly the margin held back.
    const b = linkBudget({
      txDbm: -3,
      sensitivityDbm: -28,
      items: [{ name: 'fibre', db: attenuation({ alphaDb: 0.2, length: reach.length }).db }, { name: 'fixed', db: 2.4 }],
    })
    expect(b.margin).toBeCloseTo(3, 9)
  })

  it('declines a reach whose fixed items already spend the budget', () => {
    expect(() => lossReach({ txDbm: -3, sensitivityDbm: -28, fixedDb: 24, marginDb: 3, alphaDb: 0.2 })).toThrow(/no length of fibre reaches/)
  })

  it('dispersion binds the fast link and loss binds the slow one', () => {
    const loss = lossReach({ txDbm: -3, sensitivityDbm: -28, fixedDb: 2.4, marginDb: 3, alphaDb: 0.2 }).length
    const fast = dispersionReach({ D: 17 * PS_NM_KM, dLambda: 1 * NM, rate: 1e10 })
    expect(bindingLimit({ loss, dispersionLength: fast }).binds).toBe('dispersion')
    const slow = dispersionReach({ D: 17 * PS_NM_KM, dLambda: 0.1 * NM, rate: 1e8 })
    expect(bindingLimit({ loss, dispersionLength: slow }).binds).toBe('loss')
    expect(bindingLimit({ loss, dispersionLength: fast }).reach).toBe(fast)
  })
})

describe('what the fibre module declines', () => {
  it('nonlinear propagation is declined with the reason, not approximated', () => {
    expect(() => refuseNonlinear()).toThrow(PhotonicsError)
    expect(() => refuseNonlinear('self-phase modulation')).toThrow(/self-phase modulation changes the field as it travels/)
    expect(nonlinearAvailable()).toMatch(/propagation equation solved along the fibre/)
  })
})
