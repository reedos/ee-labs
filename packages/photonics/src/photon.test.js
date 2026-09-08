import { describe, it, expect } from 'vitest'
import {
  capPerArea,
  collectedPower,
  cutoffWavelength,
  darkEqualsLight,
  detectorArea,
  detectorSpeed,
  photocurrent,
  photodiode,
  photodiodeNet,
  photodiodeSweep,
  photonEnergy,
  photonFlux,
  quantumEfficiency,
  responsivity,
  wavelengthOf,
} from './photon.js'
import { C0, HC_EV, H_PLANCK, PhotonicsError, Q_E } from './const.js'
import { logUniform, randomWavelength, relative, rng, uniform } from './fuzz.js'
import { junctionCap } from '@ee-labs/network'

// The photon and the photodiode. Everything here is exact, so the tolerances
// are floating point and not physics.
//
// Two claims are worth naming. The responsivity is bounded above by q lambda /
// (h c) for every quantum efficiency at or below one, with equality at one, and
// that bound is the first invariant of `PHOTONICS_LAB_PLAN.md` §2.11. And the
// photodiode is not a formula: its current comes out of the same Newton
// iteration `@ee-labs/network` runs for every other diode, so the second
// invariant is Kirchhoff's law at the cathode rather than a comparison with an
// expression written twice.

const NM = 1e-9

describe('the photon carries hc over lambda', () => {
  it('the eV micrometre constant is the one a datasheet quotes', () => {
    expect(HC_EV * 1e6).toBeCloseTo(1.23984198, 8)
  })

  it('the three windows carry the energies the plan pins', () => {
    // Written against HC_EV rather than against a typed 1.23984, so the check
    // is the arithmetic and not a rounding of the constant.
    for (const nm of [1550, 1310, 850]) {
      expect(relative(photonEnergy(nm * NM).eV, (HC_EV * 1e6) / (nm / 1000))).toBeLessThan(1e-15)
    }
    expect(photonEnergy(1550 * NM).eV).toBeCloseTo(0.79990, 5)
    expect(photonEnergy(1310 * NM).eV).toBeCloseTo(0.94644, 5)
    expect(photonEnergy(850 * NM).eV).toBeCloseTo(1.45864, 5)
  })

  it('the optical frequency is c over lambda, and the energy is h times it', () => {
    const r = rng(0x7017)
    for (let k = 0; k < 80; k++) {
      const lambda = randomWavelength(r)
      const e = photonEnergy(lambda)
      expect(relative(e.frequency, C0 / lambda)).toBeLessThan(1e-15)
      expect(relative(e.joules, H_PLANCK * e.frequency)).toBeLessThan(1e-15)
      expect(relative(e.eV * Q_E, e.joules)).toBeLessThan(1e-15)
      expect(relative(wavelengthOf(e.eV), lambda)).toBeLessThan(1e-14)
    }
  })

  it('the flux is the power divided by one photon, so a watt is more photons at 1550 than at 850', () => {
    const r = rng(0x1105)
    for (let k = 0; k < 60; k++) {
      const p = logUniform(r, 1e-12, 1e-1)
      const lambda = randomWavelength(r)
      expect(relative(photonFlux(p, lambda), p / photonEnergy(lambda).joules)).toBeLessThan(1e-15)
    }
    expect(photonFlux(1e-3, 1550 * NM)).toBeGreaterThan(photonFlux(1e-3, 850 * NM))
  })

  it('a milliwatt at 1550 nm is 7.80e15 photons a second', () => {
    expect(photonFlux(1e-3, 1550 * NM) / 1e15).toBeCloseTo(7.80288, 4)
  })
})

describe('responsivity, and where it stops', () => {
  // Invariant 1 of the plan's §2.11.
  it('is bounded by q lambda over hc for every efficiency, with equality at one', () => {
    const r = rng(0xa11a)
    for (let k = 0; k < 200; k++) {
      const lambda = randomWavelength(r)
      const eta = uniform(r, 0, 1)
      const bound = (Q_E * lambda) / (H_PLANCK * C0)
      expect(responsivity({ eta, lambda })).toBeLessThanOrEqual(bound * (1 + 1e-15))
      expect(relative(responsivity({ eta: 1, lambda }), bound)).toBe(0)
    }
  })

  it('is eta lambda over 1.23984 in amps per watt', () => {
    const r = rng(0x2c2c)
    for (let k = 0; k < 60; k++) {
      const lambda = randomWavelength(r)
      const eta = uniform(r, 0.05, 1)
      expect(relative(responsivity({ eta, lambda }), (eta * lambda * 1e6) / (HC_EV * 1e6))).toBeLessThan(1e-14)
    }
  })

  it('the quantum efficiency recovers from a measured responsivity', () => {
    const r = rng(0x3d3d)
    for (let k = 0; k < 60; k++) {
      const lambda = randomWavelength(r)
      const eta = uniform(r, 0.05, 1)
      expect(relative(quantumEfficiency({ responsivity: responsivity({ eta, lambda }), lambda }), eta)).toBeLessThan(1e-14)
    }
  })

  it('is exactly zero past the cut-off, not small', () => {
    const eg = 1.12
    const lc = cutoffWavelength(eg)
    expect(relative(lc, HC_EV / eg)).toBe(0)
    expect(lc * 1e9).toBeCloseTo(1107.0, 1)
    expect(responsivity({ eta: 0.8, lambda: 1550 * NM, eg })).toBe(0)
    expect(responsivity({ eta: 0.8, lambda: lc * 0.999, eg })).toBeGreaterThan(0)
    // Right at the cut-off the photon still carries the bandgap exactly.
    expect(photonEnergy(lc).eV).toBeCloseTo(eg, 12)
  })

  it('a wider bandgap sees less of the spectrum', () => {
    const r = rng(0x4e4e)
    for (let k = 0; k < 40; k++) {
      const eg = uniform(r, 0.5, 2)
      expect(cutoffWavelength(eg + 0.1)).toBeLessThan(cutoffWavelength(eg))
    }
  })

  it('names the field it will not take a number for', () => {
    expect(() => responsivity({ eta: 1.4, lambda: 1550 * NM })).toThrow(PhotonicsError)
    expect(() => responsivity({ eta: 1.4, lambda: 1550 * NM })).toThrow(/eta must be between 0 and 1/)
    expect(() => photonEnergy(0)).toThrow(/lambda must be a positive number/)
  })
})

describe('the photodiode is a circuit, not a formula', () => {
  const base = { eta: 0.8, lambda: 1550 * NM, bias: 5, load: 1000, dark: 1e-9 }

  it('the netlist is four elements and the light is one of them', () => {
    const net = photodiodeNet({ ...base, power: 1e-6 })
    expect(net.elements.map((e) => e.id)).toEqual(['Vb', 'RL', 'D1', 'Iph'])
    expect(net.elements.find((e) => e.id === 'Iph').value).toBe(photocurrent({ ...base, power: 1e-6 }))
    expect(net.elements.find((e) => e.id === 'D1').is).toBe(base.dark)
  })

  // Invariant 2 of the plan's §2.11.
  it('the load current is the photocurrent plus the junction dark current, by KCL', () => {
    const r = rng(0x5f5f)
    for (let k = 0; k < 60; k++) {
      const spec = {
        ...base,
        lambda: randomWavelength(r),
        eta: uniform(r, 0.1, 1),
        power: logUniform(r, 1e-12, 1e-4),
        load: logUniform(r, 50, 1e5),
        bias: uniform(r, 1, 20),
        dark: logUniform(r, 1e-12, 1e-8),
      }
      const pd = photodiode(spec)
      // KCL at the cathode: what comes in through the load leaves through the
      // photocurrent source and the junction. The band is the reading's own
      // arithmetic floor and not a tolerance anybody chose. A current read as
      // the difference of two voltages that agree to six figures carries the
      // supply's last bits, and `pd.floor` is those bits as a current.
      expect(Math.abs(pd.current - (pd.iph + pd.dark))).toBeLessThanOrEqual(pd.floor + 1e-9 * Math.abs(pd.iph))
      expect(relative(pd.iph, photocurrent(spec))).toBeLessThan(1e-15)
      // Every solve leaves the junction with the bias it did not spend on the load.
      expect(Math.abs(pd.reverse - (spec.bias - pd.current * spec.load))).toBeLessThanOrEqual(pd.floor * spec.load)
    }
  })

  it('turn the light off and the junction still carries its own reverse current', () => {
    const dark = photodiode({ ...base, power: 0 })
    expect(dark.iph).toBe(0)
    expect(relative(dark.current, base.dark)).toBeLessThan(1e-9)
    expect(dark.reverse).toBeCloseTo(base.bias - base.dark * base.load, 12)
  })

  it('the current is flat against reverse bias while the junction has bias to spend', () => {
    const sweep = photodiodeSweep({ ...base, power: 1e-6 }, [2, 5, 10, 20])
    const first = sweep[0].current
    for (const point of sweep) {
      expect(relative(point.current, first)).toBeLessThan(1e-6)
      expect(point.reverse).toBeGreaterThan(0)
    }
  })

  it('a load big enough to spend the bias forward-biases the junction and stops the current', () => {
    // 1 mA of photocurrent into 100 kOhm would need 100 V, and there are 5.
    const starved = photodiode({ ...base, power: 1e-3, load: 1e5 })
    expect(starved.current).toBeLessThan(starved.iph)
    expect(starved.reverse).toBeLessThan(0.1)
    expect(starved.current * starved.spec.load).toBeCloseTo(base.bias - starved.reverse, 6)
  })

  it('the level where the dark current matches the light is a division, not a threshold', () => {
    const level = darkEqualsLight({ ...base })
    expect(relative(photocurrent({ ...base, power: level }), base.dark)).toBeLessThan(1e-14)
    const at = photodiode({ ...base, power: level })
    expect(relative(at.current, 2 * base.dark)).toBeLessThan(1e-6)
  })

  it('a detector blind at the wavelength never reaches its own dark current', () => {
    expect(() => darkEqualsLight({ ...base, eg: 1.12 })).toThrow(/never reaches its own dark current/)
  })
})

describe('area, capacitance and speed', () => {
  it('the area is round and the collected power follows it', () => {
    const r = rng(0x6060)
    for (let k = 0; k < 40; k++) {
      const d = logUniform(r, 10e-6, 1e-3)
      const irradiance = logUniform(r, 0.1, 1e4)
      expect(relative(detectorArea(d), (Math.PI / 4) * d * d)).toBeLessThan(1e-15)
      expect(relative(collectedPower({ d, irradiance }), detectorArea(d) * irradiance)).toBeLessThan(1e-15)
      // Twice the diameter catches four times the light.
      expect(relative(collectedPower({ d: 2 * d, irradiance }), 4 * collectedPower({ d, irradiance }))).toBeLessThan(1e-14)
    }
  })

  it('the capacitance is the Electronics junction law over the detector area', () => {
    const r = rng(0x7171)
    for (let k = 0; k < 40; k++) {
      const d = logUniform(r, 10e-6, 1e-3)
      const load = logUniform(r, 50, 1e5)
      const bias = uniform(r, 0, 20)
      const s = detectorSpeed({ d, load, bias })
      expect(relative(s.cj0, capPerArea() * detectorArea(d))).toBeLessThan(1e-15)
      expect(relative(s.cj, junctionCap({ cj0: s.cj0, v0: 0.75, m: 0.5 }, -bias))).toBeLessThan(1e-15)
      expect(relative(s.corner, 1 / (2 * Math.PI * load * s.cj))).toBeLessThan(1e-15)
      // Reverse bias widens the depletion region, so it lowers the capacitance.
      expect(s.cj).toBeLessThanOrEqual(s.cj0 * (1 + 1e-15))
    }
  })

  it('the area bandwidth product does not move with area, which is why it is the figure of merit', () => {
    const load = 1000
    const bias = 5
    const at = (d) => detectorSpeed({ d, load, bias }).areaBandwidth
    const ref = at(50e-6)
    for (const d of [20e-6, 100e-6, 200e-6, 500e-6]) expect(relative(at(d), ref)).toBeLessThan(1e-12)
    // And it does move with the load, which is the other half of the trade.
    expect(detectorSpeed({ d: 100e-6, load: 50, bias }).areaBandwidth).toBeGreaterThan(ref)
  })
})
