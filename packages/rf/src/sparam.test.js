import { describe, it, expect } from 'vitest'
import { complex as cx } from '@ee-labs/network'
import {
  RfError,
  dissipated,
  entryOf,
  fromPolarDeg,
  gammaFromVswr,
  largestSingular,
  loadFrom,
  mismatch,
  reciprocityError,
  reflection,
  s11FromNetlist,
  sFromNetlist,
  sparam,
  unitarityError,
  vswr,
} from './sparam.js'

// Every number here is computed from the settings the test names, never typed
// in. The pi attenuator's resistors are derived from the decibels asked for,
// the reflection coefficients from the loads, and the S-matrices from two exact
// AC solves of a netlist `@ee-labs/network` builds.

const { C, cabs, csub } = cx
const Z0 = 50
const F = 1e9

const close = (got, want, tol = 1e-12) => expect(Math.abs(got - want)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(want)))
const closeC = (got, want, tol = 1e-12) => expect(cabs(csub(got, want))).toBeLessThanOrEqual(tol * Math.max(1, cabs(want)))

/** A pi attenuator of `db` decibels in `z0` ohms, from the closed form. */
function piPad(db, z0 = Z0) {
  const K = Math.pow(10, db / 20)
  const series = (z0 * (K * K - 1)) / (2 * K)
  const shunt = (z0 * (K + 1)) / (K - 1)
  return {
    series,
    shunt,
    net: {
      elements: [
        { type: 'R', id: 'Rsh1', nodes: ['p1', 'gnd'], value: shunt },
        { type: 'R', id: 'Rser', nodes: ['p1', 'p2'], value: series },
        { type: 'R', id: 'Rsh2', nodes: ['p2', 'gnd'], value: shunt },
      ],
    },
  }
}

describe('the reflection coefficient, and the four names one number wears', () => {
  it('a load above the reference reflects in phase and one below reflects out of phase', () => {
    for (const ratio of [2, 4, 10]) {
      closeC(reflection(ratio * Z0, Z0), C((ratio - 1) / (ratio + 1)))
      closeC(reflection(Z0 / ratio, Z0), C(-(ratio - 1) / (ratio + 1)))
    }
  })

  it('a matched load reflects nothing and an open reflects everything', () => {
    closeC(reflection(Z0, Z0), C(0))
    closeC(reflection(Infinity, Z0), C(1))
    closeC(reflection(0, Z0), C(-1))
  })

  it('a reactive load reflects with a phase, and the load comes back from it', () => {
    const ZL = [30, -40]
    const g = reflection(ZL, Z0)
    // (30 − j40 − 50)/(30 − j40 + 50) works out to −j0.5 exactly.
    closeC(g, C(0, -0.5))
    closeC(loadFrom(g, Z0), C(30, -40))
  })

  it('the standing-wave ratio, the return loss and the mismatch loss follow from the magnitude', () => {
    for (const ZL of [100, 25, [30, -40], 200, 12.5]) {
      const m = mismatch(ZL, Z0)
      close(m.vswr, (1 + m.mag) / (1 - m.mag))
      close(m.mag, gammaFromVswr(m.vswr))
      close(m.returnLossDb, -20 * Math.log10(m.mag))
      close(m.mismatchLossDb, -10 * Math.log10(1 - m.mag * m.mag))
      close(m.powerAccepted, 1 - m.mag * m.mag)
    }
  })

  it('a load and its reciprocal about the reference give the same standing-wave ratio', () => {
    for (const r of [2, 3, 4]) {
      close(mismatch(r * Z0, Z0).vswr, mismatch(Z0 / r, Z0).vswr)
      close(mismatch(r * Z0, Z0).vswr, r)
    }
  })

  it('a load equal to the negative of the reference is declined by name', () => {
    expect(() => reflection([-Z0, 0], Z0)).toThrow(RfError)
  })

  it('a load on the unit circle has an infinite standing-wave ratio and no finite mismatch loss', () => {
    expect(vswr(reflection([0, 100], Z0))).toBe(Infinity)
    expect(mismatch([0, 100], Z0).mismatchLossDb).toBe(Infinity)
  })
})

describe('the S-matrix of a circuit the suite solves', () => {
  it('a pi attenuator matches at both ports and loses the decibels it was designed for', () => {
    for (const db of [1, 3, 6, 10, 20]) {
      const { net } = piPad(db)
      const sp = sFromNetlist(net, ['p1', 'p2'], F, { z0: Z0 })
      expect(entryOf(sp, 0, 0).mag).toBeLessThan(1e-12)
      expect(entryOf(sp, 1, 1).mag).toBeLessThan(1e-12)
      close(entryOf(sp, 1, 0).db, -db, 1e-11)
      close(entryOf(sp, 0, 1).db, -db, 1e-11)
    }
  })

  it('S11 of a one-port is the reflection coefficient of the load it holds', () => {
    for (const RL of [25, 50, 100, 200]) {
      const net = { elements: [{ type: 'R', id: 'RL', nodes: ['p', 'gnd'], value: RL }] }
      closeC(s11FromNetlist(net, 'p', F, { z0: Z0 }), reflection(RL, Z0), 1e-11)
    }
  })

  it('S11 of a reactive one-port is the reflection coefficient at that frequency', () => {
    const Cval = 3.1831e-12
    const net = { elements: [{ type: 'C', id: 'C1', nodes: ['p', 'gnd'], value: Cval }] }
    const X = -1 / (2 * Math.PI * F * Cval)
    closeC(s11FromNetlist(net, 'p', F, { z0: Z0 }), reflection([0, X], Z0), 1e-10)
  })

  it('a network of resistors is reciprocal', () => {
    const net = {
      elements: [
        { type: 'R', id: 'R1', nodes: ['p1', 'm'], value: 30 },
        { type: 'R', id: 'R2', nodes: ['m', 'gnd'], value: 70 },
        { type: 'R', id: 'R3', nodes: ['m', 'p2'], value: 20 },
      ],
    }
    expect(reciprocityError(sFromNetlist(net, ['p1', 'p2'], F, { z0: Z0 }))).toBeLessThan(1e-12)
  })

  it('an LC network loses nothing, and adding a resistor loses exactly what it dissipates', () => {
    const lossless = {
      elements: [
        { type: 'L', id: 'L1', nodes: ['p1', 'p2'], value: 8e-9 },
        { type: 'C', id: 'C1', nodes: ['p2', 'gnd'], value: 1.6e-12 },
      ],
    }
    const sp = sFromNetlist(lossless, ['p1', 'p2'], F, { z0: Z0 })
    expect(unitarityError(sp)).toBeLessThan(1e-11)
    close(dissipated(sp), 0, 1e-11)
    expect(largestSingular(sp)).toBeLessThan(1 + 1e-11)

    const withR = { elements: [...lossless.elements, { type: 'R', id: 'R1', nodes: ['p2', 'gnd'], value: 500 }] }
    const spR = sFromNetlist(withR, ['p1', 'p2'], F, { z0: Z0 })
    expect(dissipated(spR)).toBeGreaterThan(1e-3)
    expect(unitarityError(spR)).toBeGreaterThan(1e-3)
    expect(largestSingular(spR)).toBeLessThan(1 + 1e-11)
  })

  it('a circuit carrying its own source is declined, with the reason', () => {
    const net = { elements: [{ type: 'V', id: 'V1', nodes: ['p1', 'gnd'], value: 1 }, { type: 'R', id: 'R1', nodes: ['p1', 'p2'], value: 10 }] }
    expect(() => sFromNetlist(net, ['p1', 'p2'], F)).toThrow(RfError)
    try {
      sFromNetlist(net, ['p1', 'p2'], F)
    } catch (err) {
      expect(err.message).toMatch(/independent source/)
    }
  })
})

describe('a device quoted the way a datasheet quotes one', () => {
  it('reads back the magnitude and angle it was given', () => {
    const sp = sparam({
      f: 2e9,
      z0: Z0,
      s: [
        [{ mag: 0.894, deg: -60.6 }, { mag: 0.02, deg: 62.4 }],
        [{ mag: 3.122, deg: 123.6 }, { mag: 0.781, deg: -27.6 }],
      ],
    })
    close(entryOf(sp, 0, 0).mag, 0.894, 1e-14)
    close(entryOf(sp, 0, 0).deg, -60.6, 1e-13)
    close(entryOf(sp, 1, 0).mag, 3.122, 1e-14)
    close(entryOf(sp, 1, 0).db, 20 * Math.log10(3.122), 1e-13)
    // A device with gain is not passive, and the singular value says so.
    expect(largestSingular(sp)).toBeGreaterThan(1)
  })

  it('a magnitude and angle pair is the complex number the polar form gives', () => {
    closeC(fromPolarDeg(2, 30), C(2 * Math.cos(Math.PI / 6), 2 * Math.sin(Math.PI / 6)))
  })
})
