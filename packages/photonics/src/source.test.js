import { describe, it, expect } from 'vitest'
import {
  MODEL,
  SOURCE_DEFAULTS,
  VT_ROOM,
  drive,
  driveNet,
  driveSweep,
  forwardVoltage,
  laserOutput,
  ledBandwidth,
  ledOutput,
  ledResponse,
  slopeEfficiency,
  voltsPerPhoton,
  wallPlug,
  widthInWavelength,
} from './source.js'
import { HC_EV, PhotonicsError, Q_E, C0 } from './const.js'
import { photonEnergy } from './photon.js'
import { threshold } from './rate.js'
import { logUniform, randomWavelength, relative, rng, uniform } from './fuzz.js'
import { VT } from '@ee-labs/network'

// The LED and the laser. The electrical port is a circuit and is measured as
// one: KCL at the junction's own node, from the solver's numbers, with the
// reading's arithmetic floor as the tolerance rather than a chosen epsilon.
//
// The optical port is three stated models, and every test that touches one
// checks that the model's own sentence comes back with the number. A slope
// efficiency with no model named beside it is a number a reader would take for
// a measurement of a particular laser.
//
// The threshold current is `rate.js`'s throughout. `laserOutput` requires one
// rather than defaulting it, and the test that proves the requirement is the
// one that calls it without.

const NM = 1e-9

describe('the volts one photon costs', () => {
  it('h nu / q is the photon energy in electronvolts, at every wavelength', () => {
    const r = rng(0x3311)
    for (let k = 0; k < 120; k++) {
      const lambda = randomWavelength(r)
      expect(relative(voltsPerPhoton(lambda), HC_EV / lambda)).toBeLessThan(1e-15)
      expect(relative(voltsPerPhoton(lambda), photonEnergy(lambda).eV)).toBeLessThan(1e-15)
    }
  })

  it('the three windows cost the volts the lessons quote', () => {
    expect(voltsPerPhoton(1550 * NM)).toBeCloseTo(0.7999, 4)
    expect(voltsPerPhoton(1310 * NM)).toBeCloseTo(0.94644, 5)
    expect(voltsPerPhoton(850 * NM)).toBeCloseTo(1.4586, 4)
  })
})

// ------------------------------------------------------- the electrical port

describe('both devices are one forward-biased junction', () => {
  it('the netlist is three elements and the same shape any other diode experiment loads', () => {
    const net = driveNet()
    expect(net.elements.map((e) => e.id)).toEqual(['Vd', 'Rs', 'D1'])
    expect(net.elements.map((e) => e.type)).toEqual(['V', 'R', 'D'])
    const d = net.elements[2]
    expect(d.model).toBe('exp')
    expect(d.nodes).toEqual(['a', 'gnd'])
    expect(d.is).toBe(SOURCE_DEFAULTS.is)
  })

  it('the current is the solver’s, and KCL holds at the junction’s node', () => {
    const r = rng(0x6f21)
    for (let k = 0; k < 80; k++) {
      const spec = {
        drive: uniform(r, 1.2, 5),
        series: logUniform(r, 10, 1000),
        is: logUniform(r, 1e-14, 1e-10),
        n: uniform(r, 1, 2.5),
      }
      const x = drive(spec)
      // Everything that arrives at node `a` leaves it. `i.Rs` runs from the
      // supply into the node and `i.D1` runs from the node to ground, in the
      // package's own convention, so the two are equal. Both come out of the
      // solve, so this measures the solve rather than restating it.
      const kcl = x.sol.i.Rs - x.sol.i.D1
      expect(Math.abs(kcl), `KCL at a, seed ${k}`).toBeLessThanOrEqual(Math.max(x.floor, 1e-18))
      // And Ohm's law across the resistor, with the same numbers.
      expect(relative(x.current, (spec.drive - x.forward) / spec.series)).toBeLessThan(1e-9)
      expect(x.forward).toBeGreaterThan(0)
      expect(x.forward).toBeLessThan(spec.drive)
    }
  })

  it('the plan’s bias point is what the solver returns, not a number typed beside it', () => {
    const x = drive()
    expect(x.current * 1e3).toBeCloseTo(18.778, 3)
    expect(x.forward).toBeCloseTo(1.2231, 4)
    expect(x.iters).toBeGreaterThan(0)
  })

  it('a larger supply or a smaller resistor raises the current, and the voltage barely moves', () => {
    const sweep = driveSweep({}, [1.8, 2.5, 3.3])
    expect(sweep.map((s) => s.current)).toEqual([...sweep.map((s) => s.current)].sort((a, b) => a - b))
    // A decade and a half of current costs about a tenth of a volt, which is
    // the exponential law seen from the outside.
    const span = sweep[2].forward - sweep[0].forward
    expect(span).toBeGreaterThan(0)
    expect(span).toBeLessThan(0.15)
    expect(sweep[2].current / sweep[0].current).toBeGreaterThan(3)
  })

  it('Shockley read backwards gives the voltage the solver puts the same current at', () => {
    const r = rng(0x0b4d)
    for (let k = 0; k < 60; k++) {
      const spec = { drive: uniform(r, 1.5, 4), series: logUniform(r, 20, 500), is: logUniform(r, 1e-13, 1e-11), n: 2 }
      const x = drive(spec)
      const back = forwardVoltage({ current: x.current, is: spec.is, n: spec.n, vt: VT })
      expect(relative(back, x.forward), `seed ${k}`).toBeLessThan(1e-6)
    }
  })

  it('the thermal voltage this module reads back with is the network package’s', () => {
    expect(relative(VT_ROOM, VT)).toBeLessThan(1e-12)
  })

  it('a supply or a resistance outside its meaning is refused by name', () => {
    expect(() => driveNet({ series: 0 })).toThrow(/series must be a positive number/)
    expect(() => driveNet({ drive: -1 })).toThrow(/drive must be zero or a positive number/)
    expect(() => driveNet({ is: 0 })).toThrow(/is must be a positive number/)
  })
})

// -------------------------------------------------------------------- the LED

describe('the LED’s power is linear in current', () => {
  it('the slope is the internal efficiency times the volts one photon costs', () => {
    const r = rng(0x44a8)
    for (let k = 0; k < 120; k++) {
      const lambda = randomWavelength(r)
      const etaInt = uniform(r, 0, 1)
      const current = logUniform(r, 1e-4, 0.1)
      const o = ledOutput({ etaInt, lambda, current })
      expect(relative(o.slope, etaInt * HC_EV / lambda)).toBeLessThan(1e-14)
      expect(relative(o.power, o.slope * current)).toBeLessThan(1e-15)
      // Linear means exactly linear: twice the current is twice the light.
      const twice = ledOutput({ etaInt, lambda, current: 2 * current })
      expect(relative(twice.power, 2 * o.power)).toBeLessThan(1e-14)
      expect(o.model).toBe(MODEL.led)
    }
  })

  it('an efficiency of one is the most a current can buy, and the lessons’ slopes come back', () => {
    const ceiling = ledOutput({ etaInt: 1, lambda: 1550 * NM, current: 1e-3 })
    expect(ceiling.power * 1e3).toBeCloseTo(0.7999, 4)
    for (const [eta, want] of [
      [0.1, 0.07999],
      [0.2, 0.15998],
      [0.5, 0.39995],
    ]) {
      expect(ledOutput({ etaInt: eta, lambda: 1550 * NM, current: 1e-3 }).slope).toBeCloseTo(want, 5)
    }
    expect(ledOutput({ etaInt: 0.2, lambda: 1310 * NM, current: 1e-3 }).slope).toBeCloseTo(0.18929, 5)
    expect(ledOutput({ etaInt: 0.2, lambda: 850 * NM, current: 1e-3 }).slope).toBeCloseTo(0.29173, 5)
  })

  it('an efficiency above one is refused, because it would be more photons than electrons', () => {
    expect(() => ledOutput({ etaInt: 1.2, lambda: 1550 * NM, current: 1e-3 })).toThrow(/must be between 0 and 1/)
    expect(() => ledOutput({ etaInt: 0.2, lambda: 1550 * NM, current: -1 })).toThrow(PhotonicsError)
  })
})

describe('the LED is slow, and one carrier lifetime says how slow', () => {
  it('the bandwidth is one over two pi times the lifetime, at the three lifetimes the lessons name', () => {
    for (const [ns, mhz] of [
      ['1', '159.15'],
      ['5', '31.831'],
      ['20', '7.9577'],
    ]) {
      const b = ledBandwidth({ tauC: Number(ns) * 1e-9 })
      expect(relative(b.f3db, 1 / (2 * Math.PI * Number(ns) * 1e-9))).toBeLessThan(1e-15)
      // Compared as the five figures a lesson prints, so the pin is the
      // rendering the reader sees and not a tolerance chosen around it.
      expect(Number(b.f3db / 1e6).toPrecision(5)).toBe(mhz)
      expect(b.model).toBe(MODEL.bandwidth)
    }
  })

  it('the response is one pole: 3 dB down at the corner, 20 dB a decade above it', () => {
    const r = rng(0x1d7e)
    for (let k = 0; k < 60; k++) {
      const tauC = logUniform(r, 0.2e-9, 50e-9)
      const { f3db } = ledBandwidth({ tauC })
      expect(20 * Math.log10(ledResponse({ tauC, f: f3db }))).toBeCloseTo(-3.0103, 6)
      // The rule first, then this instance of it. A first-order roll-off is
      // 6 dB an octave and 20 dB a decade, well above the corner.
      const decade = 20 * Math.log10(ledResponse({ tauC, f: 100 * f3db }) / ledResponse({ tauC, f: 1000 * f3db }))
      const octave = 20 * Math.log10(ledResponse({ tauC, f: 100 * f3db }) / ledResponse({ tauC, f: 200 * f3db }))
      expect(decade).toBeCloseTo(20, 2)
      expect(octave).toBeCloseTo(6.0206, 2)
    }
  })

  it('a lifetime of zero has no corner and is refused', () => {
    expect(() => ledBandwidth({ tauC: 0 })).toThrow(/tauC must be a positive number/)
  })
})

// ------------------------------------------------------------------ the laser

describe('the laser’s output above threshold', () => {
  const t = threshold()

  it('the slope efficiency is the differential efficiency times the volts one photon costs', () => {
    for (const [eta, want] of [
      [0.2, 0.15998],
      [0.4, 0.31996],
      [0.6, 0.47994],
    ]) {
      expect(slopeEfficiency({ etaD: eta, lambda: 1550 * NM }).slope).toBeCloseTo(want, 5)
    }
    expect(slopeEfficiency({ etaD: 0.4, lambda: 1310 * NM }).slope).toBeCloseTo(0.37858, 5)
    expect(slopeEfficiency({ etaD: 0.4, lambda: 850 * NM }).slope).toBeCloseTo(0.58346, 5)
  })

  it('the threshold it uses is the rate equations’, and it will not invent one', () => {
    expect(() => laserOutput({ etaD: 0.4, lambda: 1550 * NM, current: 20e-3 })).toThrow(/ith must be a positive number/)
    const o = laserOutput({ etaD: 0.4, lambda: 1550 * NM, current: 2 * t.ith, ith: t.ith, etaSp: 0.002 })
    expect(o.ith).toBe(t.ith)
    expect(o.model).toBe(MODEL.laser)
  })

  it('invariant 5: below threshold the output is spontaneous alone, above it the slope is the efficiency', () => {
    const spec = { etaD: 0.4, lambda: 1550 * NM, ith: t.ith, etaSp: 0.002 }
    for (const k of [0.2, 0.6, 0.99]) {
      const o = laserOutput({ ...spec, current: k * t.ith })
      expect(o.stimulated).toBe(0)
      expect(relative(o.power, o.spontaneousSlope * k * t.ith)).toBeLessThan(1e-14)
      expect(o.above).toBe(false)
    }
    // The slope above, measured off the curve rather than read off the return.
    const h = 1e-6 * t.ith
    for (const k of [1.5, 2, 4]) {
      const i = k * t.ith
      const slope =
        (laserOutput({ ...spec, current: i + h }).power - laserOutput({ ...spec, current: i - h }).power) / (2 * h)
      expect(relative(slope, spec.etaD * voltsPerPhoton(spec.lambda))).toBeLessThan(1e-8)
    }
  })

  it('the kink is the ratio of the two slopes, and both are on the return', () => {
    const o = laserOutput({ etaD: 0.4, lambda: 1550 * NM, current: 2 * t.ith, ith: t.ith, etaSp: 0.002 })
    expect(relative(o.slopeRatio, o.slope / o.spontaneousSlope)).toBeLessThan(1e-15)
    expect(o.slopeRatio).toBeCloseTo(200, 6)
    // With no spontaneous path at all the ratio has no finite value, and the
    // module says infinity rather than a large number it chose.
    expect(laserOutput({ etaD: 0.4, lambda: 1550 * NM, current: 2 * t.ith, ith: t.ith }).slopeRatio).toBe(Infinity)
  })

  it('the plan’s laser gives the powers the lessons quote', () => {
    const spec = { etaD: 0.4, lambda: 1550 * NM, ith: t.ith, etaSp: 0.002 }
    expect(laserOutput({ ...spec, current: 20e-3 }).power * 1e3).toBeCloseTo(2.1368, 4)
    expect(laserOutput({ ...spec, current: 2 * t.ith }).power * 1e3).toBeCloseTo(4.3052, 4)
    expect(laserOutput({ ...spec, current: 5e-3 }).power * 1e3).toBeCloseTo(0.007999, 6)
  })

  it('the wall-plug efficiency needs the volts as well as the amps', () => {
    const x = drive()
    const o = laserOutput({ etaD: 0.4, lambda: 1550 * NM, current: x.current, ith: t.ith, etaSp: 0.002 })
    const eff = wallPlug({ power: o.power, current: x.current, forward: x.forward })
    expect(relative(eff, o.power / (x.current * x.forward))).toBeLessThan(1e-15)
    // Light out cannot beat the volts one photon costs over the volts the
    // junction takes, whatever the differential efficiency.
    expect(eff).toBeLessThan(voltsPerPhoton(1550 * NM) / x.forward)
    expect(eff).toBeGreaterThan(0)
  })
})

describe('a spectral width is the same width in either unit', () => {
  it('the conversion is lambda squared over c, and it round-trips', () => {
    const r = rng(0x27c4)
    for (let k = 0; k < 60; k++) {
      const lambda = randomWavelength(r)
      const dNu = logUniform(r, 1e9, 1e13)
      const dLambda = widthInWavelength({ lambda, dNu })
      expect(relative(dLambda, (lambda * lambda * dNu) / C0)).toBeLessThan(1e-15)
      expect(relative((dLambda * C0) / (lambda * lambda), dNu)).toBeLessThan(1e-14)
    }
  })
})

describe('every model this module ships is named where its number is', () => {
  it('the three sentences say what the model is, not that it is good', () => {
    for (const [key, text] of Object.entries(MODEL)) {
      expect(text.length, key).toBeGreaterThan(30)
      expect(text, key).not.toMatch(/\b(exact|perfect|accurate|good|elegant)\b/i)
    }
    expect(Object.keys(MODEL)).toEqual(['led', 'bandwidth', 'laser'])
  })

  it('the charge on the electron comes from one place in the package', () => {
    expect(Q_E).toBe(1.602176634e-19)
  })
})
