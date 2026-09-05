import { describe, it, expect } from 'vitest'
import {
  bandgapOf,
  collectedPower,
  cutoffWavelength,
  darkCrossover,
  detectorCapacitance,
  detectorCorner,
  junctionCurrent,
  opticalFrequency,
  photocurrent,
  photodiodeNet,
  photonEnergy,
  photonEnergyEv,
  photonFlux,
  quantumEfficiencyOf,
  responsivity,
  wavelengthOf,
} from './photon.js'
import { C0, EV_UM, H_PLANCK, PhotonicsError, Q_E } from './const.js'
import { newtonDC } from '@ee-labs/network'
import { logUniform, relative, rng, uniform } from './fuzz.js'

// The photon and the photodiode. Everything here is exact, so the tolerances
// are floating point and not physics.
//
// Nothing below compares a function against a table of numbers somebody typed.
// Each expectation is the same physics written a second way: the energy against
// `h c / λ` computed here, the responsivity against `η q λ / (h c)`, the
// cut-off against the bandgap it came from. Where a figure from the plan does
// appear it is the value a lesson quotes, and it is checked to the digits the
// lesson prints.

const BANDS = { 850: 850e-9, 1310: 1310e-9, 1550: 1550e-9 }

describe('a photon carries h c over lambda', () => {
  it('the energy in joules is the product of the constants over the wavelength', () => {
    for (const lambda of Object.values(BANDS)) {
      expect(photonEnergy(lambda)).toBeCloseTo((H_PLANCK * C0) / lambda, 40)
    }
  })

  it('the energy in electronvolts is the joules divided by the elementary charge', () => {
    for (const lambda of Object.values(BANDS)) {
      expect(relative(photonEnergyEv(lambda), photonEnergy(lambda) / Q_E)).toBeLessThan(1e-14)
    }
  })

  it('the three windows carry the energies the lessons quote', () => {
    expect(photonEnergyEv(BANDS[1550])).toBeCloseTo(0.7999, 4)
    expect(photonEnergyEv(BANDS[1310])).toBeCloseTo(0.94644, 5)
    expect(photonEnergyEv(BANDS[850])).toBeCloseTo(1.45864, 5)
  })

  it('one micrometre carries the derived constant itself', () => {
    expect(photonEnergyEv(1e-6)).toBeCloseTo(EV_UM, 12)
  })

  it('the optical frequency and the wavelength are each other inverted', () => {
    const r = rng(11)
    for (let k = 0; k < 200; k++) {
      const lambda = logUniform(r, 400e-9, 2000e-9)
      expect(relative(wavelengthOf(opticalFrequency(lambda)), lambda)).toBeLessThan(1e-14)
    }
    expect(opticalFrequency(BANDS[1550]) / 1e12).toBeCloseTo(193.41, 2)
  })

  it('the flux is the power divided by one photon energy', () => {
    const flux = photonFlux({ power: 1e-3, lambda: BANDS[1550] })
    expect(relative(flux, 1e-3 / photonEnergy(BANDS[1550]))).toBe(0)
    expect(flux / 1e15).toBeCloseTo(7.8, 1)
  })

  it('a wavelength that is not a positive number is refused by name', () => {
    expect(() => photonEnergy(0)).toThrow(PhotonicsError)
    expect(() => photonEnergy(-1)).toThrow(/wavelength must be a positive number/)
  })
})

describe('responsivity, and where it stops', () => {
  it('is the quantum efficiency times the wavelength over the derived constant', () => {
    const r = rng(23)
    for (let k = 0; k < 300; k++) {
      const lambda = logUniform(r, 400e-9, 2000e-9)
      const eta = uniform(r, 0, 1)
      const want = (eta * Q_E * lambda) / (H_PLANCK * C0)
      expect(relative(responsivity({ eta, lambda }), want)).toBeLessThan(1e-14)
    }
  })

  it('the three windows give the amps per watt the lessons quote at eta 0.8', () => {
    expect(responsivity({ eta: 0.8, lambda: BANDS[1550] })).toBeCloseTo(1.00013, 5)
    expect(responsivity({ eta: 0.8, lambda: BANDS[1310] })).toBeCloseTo(0.84527, 5)
    expect(responsivity({ eta: 0.8, lambda: BANDS[850] })).toBeCloseTo(0.54846, 5)
  })

  it('the quantum efficiency read back off a responsivity is the one it came from', () => {
    const r = rng(37)
    for (let k = 0; k < 200; k++) {
      const lambda = logUniform(r, 400e-9, 2000e-9)
      const eta = uniform(r, 0.01, 1)
      const back = quantumEfficiencyOf({ responsivity: responsivity({ eta, lambda }), lambda })
      expect(relative(back, eta)).toBeLessThan(1e-14)
    }
  })

  it('a quantum efficiency above one is refused, because a photon makes one carrier', () => {
    expect(() => responsivity({ eta: 1.2, lambda: BANDS[1550] })).toThrow(/quantum efficiency must be between 0 and 1/)
  })

  it('the cut-off and the bandgap are each other inverted, and silicon stops at 1107 nm', () => {
    expect(cutoffWavelength(1.12) * 1e9).toBeCloseTo(1107.0, 1)
    const r = rng(41)
    for (let k = 0; k < 100; k++) {
      const eg = uniform(r, 0.3, 3)
      expect(relative(bandgapOf(cutoffWavelength(eg)), eg)).toBeLessThan(1e-14)
    }
  })

  it('a detector is blind past its cut-off, which is why 1550 nm needs InGaAs', () => {
    expect(cutoffWavelength(1.12)).toBeLessThan(BANDS[1550])
    expect(cutoffWavelength(0.75)).toBeGreaterThan(BANDS[1550])
  })
})

describe('the photocurrent, and the dark current under it', () => {
  it('is the responsivity times the power, plus the leakage', () => {
    const at = { eta: 0.8, lambda: BANDS[1550], power: 1e-6, dark: 1e-9 }
    expect(photocurrent(at)).toBeCloseTo(responsivity(at) * at.power + at.dark, 20)
    expect(photocurrent({ ...at, dark: 0 }) * 1e6).toBeCloseTo(1.0001, 4)
  })

  it('the crossover is the power at which the two are equal', () => {
    const at = { eta: 0.8, lambda: BANDS[1550], dark: 1e-9 }
    const p = darkCrossover(at)
    expect(relative(photocurrent({ ...at, power: p, dark: 0 }), at.dark)).toBeLessThan(1e-14)
  })

  it('a larger detector catches more light and is slower, and the product does not move', () => {
    const r = rng(53)
    const cPerArea = 5e-4
    const load = 1000
    const irradiance = 1
    const first = (() => {
      const area = 1e-8
      return (
        collectedPower({ irradiance, area }) *
        detectorCorner({ load, capacitance: detectorCapacitance({ area, cPerArea }) })
      )
    })()
    for (let k = 0; k < 50; k++) {
      const area = logUniform(r, 1e-10, 1e-5)
      const product =
        collectedPower({ irradiance, area }) *
        detectorCorner({ load, capacitance: detectorCapacitance({ area, cPerArea }) })
      expect(relative(product, first)).toBeLessThan(1e-12)
    }
  })
})

describe('the photodiode is a circuit, not a formula', () => {
  const at = { eta: 0.8, lambda: BANDS[1550], power: 1e-6, dark: 1e-9, bias: 5, load: 10000 }

  it('the netlist is elements the solver already stamps, with the light as a source', () => {
    const net = photodiodeNet(at)
    expect(net.elements.map((e) => e.type).sort()).toEqual(['D', 'I', 'I', 'R', 'V'])
    expect(relative(net.iph, responsivity(at) * at.power)).toBe(0)
  })

  it('Newton solves it and KCL holds at every node', () => {
    const net = photodiodeNet(at)
    const { sol } = newtonDC(net)
    expect(sol.maxResidual / Math.abs(sol.i.RL)).toBeLessThan(1e-9)
    // The load current is the two sources minus what the junction takes back,
    // which is the node equation the solver wrote and not a rearrangement of it.
    expect(relative(Math.abs(sol.i.RL), net.iph + at.dark - sol.i.D1)).toBeLessThan(1e-12)
  })

  it('the circuit answer is the closed form, to within what the junction takes back', () => {
    const net = photodiodeNet(at)
    const { sol } = newtonDC(net)
    expect(relative(Math.abs(sol.i.RL), photocurrent(at))).toBeLessThan(1e-7)
    // A reverse-biased junction carries its saturation current the other way,
    // and at 10 fA against a microamp that is where the agreement stops.
    expect(Math.abs(sol.i.D1)).toBeLessThan(1e-13)
    expect(relative(Math.abs(sol.i.D1), Math.abs(junctionCurrent({ v: -sol.v.k })))).toBeLessThan(1e-9)
  })

  it('a reverse-biased detector reads the same current at four bias voltages', () => {
    const currents = [1, 2, 5, 10].map((bias) => Math.abs(newtonDC(photodiodeNet({ ...at, bias })).sol.i.RL))
    for (const i of currents) expect(relative(i, currents[0])).toBeLessThan(1e-9)
  })

  it('with the light off the detector reads its own leakage and no more', () => {
    const { sol } = newtonDC(photodiodeNet({ ...at, power: 0 }))
    expect(relative(Math.abs(sol.i.RL), at.dark)).toBeLessThan(1e-4)
  })
})
