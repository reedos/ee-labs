import { describe, it, expect } from 'vitest'
import {
  CRITERION,
  LINK_ITEMS,
  V_CUTOFF,
  acceptanceAngle,
  bandChannels,
  bandwidthDistance,
  bandwidthLimit,
  beta2FromD,
  bindingLimit,
  dFromBeta2,
  dispersionLimitedReach,
  dispersionNote,
  gridWavelength,
  indexContrast,
  linkBudget,
  lossDb,
  lossLimitedReach,
  modeCount,
  numericalAperture,
  powerRatio,
  pulseSpread,
  ratioDb,
  refuseNonlinear,
  singleModeCore,
  throughFibre,
  vNumber,
} from './fibre.js'
import { C0, PhotonicsError } from './const.js'
import { logUniform, randomFibre, relative, rng, uniform } from './fuzz.js'

// The fibre. Attenuation and the guided geometry are exact, the pulse spread is
// exact for the first-order model it names, and the bandwidth limit needs a
// criterion that is an argument rather than a convention.
//
// The reference fibre is the plan's: 0.20 dB/km at 1550 nm, D = 17 ps/(nm km),
// n1 = 1.4675 against n2 = 1.4622. Every figure a lesson quotes is recomputed
// from those settings here, never typed as a target.

const REF = { alpha: 0.2, D: 17, n1: 1.4675, n2: 1.4622, lambda: 1550e-9 }

describe('attenuation over a length', () => {
  it('the loss is the rate times the length, and the ratio is ten to minus a tenth of it', () => {
    const db = lossDb({ alpha: REF.alpha, length: 80 })
    expect(db).toBeCloseTo(16, 12)
    expect(powerRatio(db)).toBeCloseTo(Math.pow(10, -1.6), 15)
    expect(powerRatio(db)).toBeCloseTo(0.025119, 6)
  })

  it('the three windows over 80 km give the losses the lesson quotes', () => {
    expect(lossDb({ alpha: 0.35, length: 80 })).toBeCloseTo(28, 12)
    expect(lossDb({ alpha: 2, length: 80 })).toBeCloseTo(160, 12)
    expect(powerRatio(160)).toBeCloseTo(1e-16, 20)
  })

  it('a loss and a power ratio are each other inverted', () => {
    const r = rng(101)
    for (let k = 0; k < 300; k++) {
      const db = uniform(r, 0, 200)
      expect(relative(ratioDb(powerRatio(db)), db)).toBeLessThan(1e-12)
    }
  })

  it('the power that arrives is the power sent times the ratio', () => {
    const out = throughFibre({ alpha: REF.alpha, length: 80, power: 1e-3 })
    expect(relative(out.out, 1e-3 * out.ratio)).toBe(0)
  })

  it('loss composes: two lengths in series lose the sum in decibels, and the product in ratio', () => {
    const r = rng(103)
    for (let k = 0; k < 400; k++) {
      const f = randomFibre(r)
      const l1 = logUniform(r, 0.1, 200)
      const l2 = logUniform(r, 0.1, 200)
      const whole = lossDb({ alpha: f.alpha, length: l1 + l2 })
      const parts = lossDb({ alpha: f.alpha, length: l1 }) + lossDb({ alpha: f.alpha, length: l2 })
      expect(relative(whole, parts)).toBeLessThan(1e-12)
      expect(relative(powerRatio(whole), powerRatio(parts))).toBeLessThan(1e-12)
    }
  })
})

describe('dispersion spreads a pulse', () => {
  it('the spread is the product of the three, in the units the datasheet uses', () => {
    expect(pulseSpread({ D: REF.D, length: 80, dLambda: 1e-9 }) * 1e12).toBeCloseTo(1360, 9)
    expect(pulseSpread({ D: REF.D, length: 80, dLambda: 0.1e-9 }) * 1e12).toBeCloseTo(136, 9)
  })

  it('spread composes: two lengths in series spread by the sum', () => {
    const r = rng(107)
    for (let k = 0; k < 400; k++) {
      const f = randomFibre(r)
      const l1 = logUniform(r, 0.1, 200)
      const l2 = logUniform(r, 0.1, 200)
      const dl = logUniform(r, 1e-12, 5e-9)
      const whole = pulseSpread({ D: f.D, length: l1 + l2, dLambda: dl })
      const parts = pulseSpread({ D: f.D, length: l1, dLambda: dl }) + pulseSpread({ D: f.D, length: l2, dLambda: dl })
      expect(relative(whole, parts)).toBeLessThan(1e-12)
    }
  })

  it('D and beta two are each other inverted, at every wavelength', () => {
    const r = rng(109)
    for (let k = 0; k < 400; k++) {
      const lambda = logUniform(r, 800e-9, 1700e-9)
      const D = uniform(r, -20, 25)
      if (Math.abs(D) < 1e-6) continue
      const beta2 = beta2FromD({ D, lambda })
      expect(relative(dFromBeta2({ beta2, lambda }), D)).toBeLessThan(1e-12)
    }
  })

  it('beta two carries the sign the anomalous band has, and the values the lesson quotes', () => {
    expect(beta2FromD({ D: REF.D, lambda: 1550e-9 })).toBeCloseTo(-21.683, 3)
    expect(beta2FromD({ D: REF.D, lambda: 1310e-9 })).toBeCloseTo(-15.488, 3)
    expect(beta2FromD({ D: -2, lambda: 1550e-9 })).toBeCloseTo(2.5509, 4)
  })

  it('beta two is the formula it says it is', () => {
    const si = (-(REF.D * 1e-6) * REF.lambda * REF.lambda) / (2 * Math.PI * C0)
    expect(relative(beta2FromD({ D: REF.D, lambda: REF.lambda }), si * 1e27)).toBeLessThan(1e-14)
  })

  it('the bandwidth limit carries the criterion it was computed under', () => {
    const spread = pulseSpread({ D: REF.D, length: 80, dLambda: 1e-9 })
    const limit = bandwidthLimit({ spread })
    expect(limit.criterion).toBe(CRITERION)
    expect(limit.rate / 1e9).toBeCloseTo(0.1838, 4)
    expect(bandwidthLimit({ spread, criterion: 0.5 }).rate).toBeCloseTo(2 * limit.rate, 6)
  })

  it('the bandwidth-distance product is the limit at one kilometre for a one nanometre source', () => {
    const bd = bandwidthDistance({ D: REF.D, dLambda: 1e-9 })
    expect(bd.product / 1e9).toBeCloseTo(14.706, 3)
    const at80 = bandwidthLimit({ spread: pulseSpread({ D: REF.D, length: 80, dLambda: 1e-9 }) })
    expect(relative(bd.product, at80.rate * 80)).toBeLessThan(1e-12)
  })

  it('the note says what the first-order model leaves out', () => {
    expect(dispersionNote()).toMatch(/first-order/)
    expect(dispersionNote()).toMatch(/propagation/)
  })

  it('nonlinear propagation is declined, and the message says why', () => {
    expect(() => refuseNonlinear()).toThrow(PhotonicsError)
    expect(() => refuseNonlinear()).toThrow(/propagation equation solved along the fibre/)
  })
})

describe('the core, the cladding, and one mode', () => {
  it('the numerical aperture is the difference of the squares', () => {
    expect(numericalAperture(REF)).toBeCloseTo(Math.sqrt(REF.n1 ** 2 - REF.n2 ** 2), 15)
    expect(numericalAperture(REF)).toBeCloseTo(0.12461, 5)
  })

  it('the acceptance angle is the arcsine of it, and the contrast is 0.36 per cent', () => {
    expect(acceptanceAngle(REF)).toBeCloseTo(7.1582, 4)
    expect(indexContrast(REF) * 100).toBeCloseTo(0.36051, 5)
  })

  it('a cladding at or above the core index is refused by name', () => {
    expect(() => numericalAperture({ n1: 1.45, n2: 1.46 })).toThrow(/core index n1 must be larger/)
    expect(() => numericalAperture({ n1: 1.45, n2: 1.45 })).toThrow(PhotonicsError)
  })

  it('V is the single-mode cut-off exactly at the core diameter the fibre allows', () => {
    const { radius, diameter } = singleModeCore({ ...REF, lambda: 1550e-9 })
    expect(diameter * 1e6).toBeCloseTo(9.5224, 4)
    expect(vNumber({ ...REF, a: radius, lambda: 1550e-9 })).toBeCloseTo(V_CUTOFF, 12)
  })

  it('a wide core at 850 nm carries many modes, and the estimate says it is one', () => {
    const V = vNumber({ ...REF, a: 25e-6, lambda: 850e-9 })
    expect(V).toBeCloseTo(23.028, 3)
    const m = modeCount(V)
    expect(m.modes).toBeCloseTo((V * V) / 2, 12)
    expect(Math.round(m.modes)).toBe(265)
    expect(m.ok).toBe(true)
  })

  it('the mode estimate is guarded, and the guard names V and its threshold', () => {
    const V = vNumber({ ...REF, a: 4e-6, lambda: 1550e-9 })
    const m = modeCount(V)
    expect(m.ok).toBe(false)
    expect(m.quantity).toBe('V')
    expect(m.threshold).toBe(2 * V_CUTOFF)
    expect(m.says).toMatch(/2\.405/)
    expect(m.says.length).toBeGreaterThan(20)
  })

  it('V scales with the core and falls with the wavelength, over random fibres', () => {
    const r = rng(113)
    for (let k = 0; k < 300; k++) {
      const f = randomFibre(r)
      const lambda = logUniform(r, 800e-9, 1700e-9)
      const v1 = vNumber({ ...f, lambda })
      const v2 = vNumber({ ...f, a: 2 * f.a, lambda })
      expect(relative(v2, 2 * v1)).toBeLessThan(1e-12)
      expect(relative(vNumber({ ...f, lambda: 2 * lambda }), v1 / 2)).toBeLessThan(1e-12)
    }
  })
})

describe('the link budget', () => {
  const LOSSES = { fibre: 16, connectors: 1, splices: 0.4, dispersion: 1 }
  const at = { pinDbm: -3, sensitivityDbm: -28, losses: LOSSES }

  it('every line item appears, and the ones the model leaves out are zeros on the record', () => {
    const b = linkBudget(at)
    expect(b.items.map((i) => i.name)).toEqual(LINK_ITEMS)
    const zeros = b.items.filter((i) => i.db === 0).map((i) => i.name)
    expect(zeros).toEqual(['modalNoise', 'reflection', 'modePartition'])
  })

  it('the total is the sum of the items, and the margin is what is left', () => {
    const b = linkBudget(at)
    expect(b.loss).toBeCloseTo(18.4, 12)
    expect(b.outDbm).toBeCloseTo(-21.4, 12)
    expect(b.margin).toBeCloseTo(6.6, 12)
    expect(relative(b.loss, Object.values(LOSSES).reduce((s, v) => s + v, 0))).toBeLessThan(1e-14)
    expect(b.items[b.items.length - 1].after).toBeCloseTo(b.outDbm, 12)
  })

  it('the fibre item is the attenuation over the length, not a number typed beside it', () => {
    const b = linkBudget({ ...at, losses: { ...LOSSES, fibre: lossDb({ alpha: 0.2, length: 80 }) } })
    expect(b.margin).toBeCloseTo(6.6, 12)
  })

  it('a line item the budget does not have is refused by name', () => {
    expect(() => linkBudget({ ...at, losses: { ...LOSSES, weather: 1 } })).toThrow(/is not a line item of this budget/)
  })

  it('the loss-limited reach spends exactly the budget it was given', () => {
    const reach = lossLimitedReach({ pinDbm: -3, sensitivityDbm: -28, fixedDb: 2.4, reserveDb: 3, alpha: 0.2 })
    expect(reach).toBeCloseTo(98, 12)
    const b = linkBudget({ ...at, losses: { ...LOSSES, fibre: lossDb({ alpha: 0.2, length: reach }) } })
    expect(b.margin).toBeCloseTo(3, 12)
  })

  it('dispersion binds before loss on a fast link, and the two reaches say so', () => {
    const dispersion = dispersionLimitedReach({ rate: 10e9, D: REF.D, dLambda: 1e-9 })
    expect(dispersion).toBeCloseTo(1.4706, 4)
    const which = bindingLimit({ loss: 98, dispersion })
    expect(which.binds).toBe('dispersion')
    expect(which.reach).toBeCloseTo(dispersion, 12)
  })

  it('the dispersion-limited reach is the length at which the spread meets the criterion', () => {
    const L = dispersionLimitedReach({ rate: 10e9, D: REF.D, dLambda: 1e-9 })
    const spread = pulseSpread({ D: REF.D, length: L, dLambda: 1e-9 })
    expect(relative(bandwidthLimit({ spread }).rate, 10e9)).toBeLessThan(1e-12)
  })
})

describe('many colours down one fibre', () => {
  it('a frequency grid has a wavelength width, and the identity is the cavity spacing', () => {
    expect(gridWavelength({ lambda: 1550e-9, spacing: 100e9 }) * 1e9).toBeCloseTo(0.80139, 5)
    const r = rng(127)
    for (let k = 0; k < 200; k++) {
      const lambda = logUniform(r, 800e-9, 1700e-9)
      const spacing = logUniform(r, 1e9, 1e12)
      const dl = gridWavelength({ lambda, spacing })
      expect(relative((dl * C0) / (lambda * lambda), spacing)).toBeLessThan(1e-12)
    }
  })

  it('the C band is 4.38 THz wide and holds 43 channels on a 100 GHz grid', () => {
    const band = bandChannels({ lambdaLow: 1530e-9, lambdaHigh: 1565e-9, spacing: 100e9 })
    expect(band.width / 1e12).toBeCloseTo(4.3821, 4)
    expect(band.channels).toBe(43)
  })

  it('the channel count is a floor, so a band that fits no whole channel holds none', () => {
    const band = bandChannels({ lambdaLow: 1550e-9, lambdaHigh: 1550.1e-9, spacing: 100e9 })
    expect(band.channels).toBe(0)
    expect(band.width).toBeGreaterThan(0)
  })

  it('a band written the wrong way round is refused by name', () => {
    expect(() => bandChannels({ lambdaLow: 1565e-9, lambdaHigh: 1530e-9, spacing: 100e9 })).toThrow(
      /longest wavelength must be above the shortest/,
    )
  })
})
