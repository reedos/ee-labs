import { describe, it, expect } from 'vitest'
import { amplitudeCheck, hd2Estimate, isSignal, smallSignal } from './smallSignal.js'
import { newtonDC, solvePWL } from './pwl.js'
import { solveDC } from './mna.js'
import { solveAC } from './phasor.js'
import { normalize, NetworkError } from './netlist.js'
import { bisect } from './transient.js'
import { cabs } from './complex.js'
import { VT } from './physics.js'

// The tangent, as a netlist. The check that matters is the one invariant 2
// names: the gain of the linear circuit equals the slope of the real one,
// measured by moving the bias a hair and watching the output.

/** The plan's reference stage, biased so I_C is exactly 1.000 mA. */
function reference(over = {}) {
  const net = (vs) => ({
    elements: [
      { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
      { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: 5000 },
      { type: 'V', id: 'Vs', nodes: ['s', 'gnd'], value: vs, small: true },
      { type: 'R', id: 'Rs', nodes: ['s', 'b'], value: 1000 },
      { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'exp', beta: 100, cpi: 20e-12, cmu: 2e-12, ...over },
    ],
  })
  const vs = bisect((v) => newtonDC(net(v)).sol.i.RC - 1e-3, 0.4, 1.5, 0)
  return { net: net(vs), vs, op: newtonDC(net(vs)) }
}

/** The DC gain of a small-signal netlist from one source to one node. */
const gain = (elements, from, to) => {
  const sources = Object.fromEntries(elements.filter((e) => e.type === 'V' || e.type === 'I').map((e) => [e.id, e.id === from ? 1 : 0]))
  return solveDC({ elements }, { sources }).v[to]
}

describe('the hybrid-π, printed', () => {
  it('is r_π, g_m v_be and r_o, with the Early effect left out', () => {
    const { net, op } = reference({ va: Infinity })
    const ss = smallSignal(net, op)
    const rpi = ss.elements.find((e) => e.id === 'Q1.rpi')
    const gm = ss.elements.find((e) => e.id === 'Q1.gm')
    const ro = ss.elements.find((e) => e.id === 'Q1.ro')
    expect(gm.gain * 1000).toBeCloseTo(38.682, 3)
    expect(rpi.value).toBeCloseTo(2585.2, 1)
    expect(rpi.value).toBeCloseTo(100 / gm.gain, 6)
    expect(gm.gain).toBeCloseTo(1e-3 / VT, 9)
    // A flat curve has no output resistance at all: with V_A infinite the
    // collector's slope is exactly zero, so r_o is not drawn.
    expect(ro).toBeUndefined()
    // What is left across the base and collector is the leakage floor every
    // junction is stamped with, a teraohm, and it changes nothing.
    expect(ss.elements.find((e) => e.id === 'Q1.rmu').value).toBeGreaterThan(1e11)
    expect(ss.label).toMatch(/V_CE = 5\.00 V/)
    expect(ss.label).toMatch(/I_C = 1\.00 mA/)
  })

  it('carries the Early effect as r_o = (V_A + V_CE)/I_C when it is on', () => {
    const { net, op } = reference({ va: 100 })
    const ss = smallSignal(net, op)
    const ro = ss.elements.find((e) => e.id === 'Q1.ro')
    expect(ro.value / 1000).toBeCloseTo(105, 3)
    // The textbook's V_A/I_C is the same number with V_CE dropped.
    expect(100 / 1e-3 / ro.value - 1).toBeCloseTo(-5 / 105, 6)
  })

  it('kills the supply and keeps the signal source', () => {
    const { net, op } = reference()
    const ss = smallSignal(net, op)
    const vcc = ss.elements.find((e) => e.id === 'VCC')
    expect(vcc.value).toBe(0)
    expect(ss.elements.find((e) => e.id === 'Vs').small).toBe(true)
    expect(isSignal({ type: 'V', wave: { kind: 'sine', amp: 1, freq: 10 } })).toBe(true)
    expect(isSignal({ type: 'V', value: 5 })).toBe(false)
    expect(isSignal({ type: 'V', value: 5, small: true })).toBe(true)
  })

  it('adds the two capacitances only when they are asked for', () => {
    const { net, op } = reference()
    expect(smallSignal(net, op).elements.some((e) => e.type === 'C')).toBe(false)
    const withC = smallSignal(net, op, { caps: true })
    expect(withC.elements.find((e) => e.id === 'Q1.cpi').value).toBe(20e-12)
    expect(withC.elements.find((e) => e.id === 'Q1.cmu').value).toBe(2e-12)
    expect(withC.elements.find((e) => e.id === 'Q1.cmu').nodes).toEqual(['b', 'c'])
  })

  it('refuses to take a tangent without an operating point to take it at', () => {
    const { net } = reference()
    expect(() => smallSignal(net, {})).toThrow(NetworkError)
  })
})

describe('invariant 2: the tangent is the derivative', () => {
  it('gives the gain the quasi-static sweep’s slope gives, to a part in a million', () => {
    const { net, vs, op } = reference()
    const ss = smallSignal(net, op)
    const av = gain(ss.elements, 'Vs', 'c')
    // The same gain, measured by moving the real bias and watching the real
    // output: the finite-difference slope of the transfer characteristic.
    const at = (v) => newtonDC({ elements: net.elements.map((e) => (e.id === 'Vs' ? { ...e, value: v } : e)) }).sol.v.c
    const h = 1e-6
    const slope = (at(vs + h) - at(vs - h)) / (2 * h)
    expect(Math.abs(av / slope - 1)).toBeLessThan(1e-6)
    // The same number the hand hybrid-π gives: −g_m(R_C ∥ r_o), divided by
    // what R_s takes on the way in.
    const p = ss.point.Q1
    const RL = (5000 * p.ro) / (5000 + p.ro)
    // The hand formula leaves out r_μ, which is a teraohm here and worth a
    // part in seven million.
    expect(Math.abs(av / (-p.gm * RL * (p.rpi / (p.rpi + 1000))) - 1)).toBeLessThan(1e-6)
    expect(av).toBeCloseTo(-134.915, 3)
  })

  it('holds at four bias currents, over a decade and a half', () => {
    for (const ic of [0.25e-3, 0.5e-3, 1e-3, 4e-3]) {
      const base = (vs) => ({
        elements: [
          { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
          { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: 1000 },
          { type: 'V', id: 'Vs', nodes: ['s', 'gnd'], value: vs, small: true },
          { type: 'R', id: 'Rs', nodes: ['s', 'b'], value: 1000 },
          { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'exp', beta: 100, va: 100 },
        ],
      })
      const vs = bisect((v) => newtonDC(base(v)).sol.i.RC - ic, 0.3, 1.5, 0)
      const op = newtonDC(base(vs))
      const av = gain(smallSignal(base(vs), op).elements, 'Vs', 'c')
      const at = (v) => newtonDC(base(v)).sol.v.c
      const h = 1e-6
      const slope = (at(vs + h) - at(vs - h)) / (2 * h)
      expect(Math.abs(av / slope - 1), `I_C = ${ic}`).toBeLessThan(1e-5)
    }
  })

  it('holds for a MOSFET stage too, where there is no r_π at all', () => {
    const cs = (vg) => ({
      elements: [
        { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: 5 },
        { type: 'R', id: 'RD', nodes: ['vdd', 'd'], value: 10000 },
        { type: 'V', id: 'VG', nodes: ['g', 'gnd'], value: vg, small: true },
        { type: 'M', id: 'M1', nodes: ['d', 'g', 'gnd'], vt: 0.7, kn: 20e-3, lambda: 0.02 },
      ],
    })
    const op = newtonDC(cs(0.9))
    const ss = smallSignal(cs(0.9), op)
    expect(ss.elements.some((e) => e.id === 'M1.rpi')).toBe(false)
    const av = gain(ss.elements, 'VG', 'd')
    const h = 1e-6
    const slope = (newtonDC(cs(0.9 + h)).sol.v.d - newtonDC(cs(0.9 - h)).sol.v.d) / (2 * h)
    expect(Math.abs(av / slope - 1)).toBeLessThan(1e-5)
    // H5's number: −g_m(R_D ∥ r_o), with g_m and r_o read at the point.
    const gm = ss.elements.find((e) => e.id === 'M1.gm').gain
    const ro = ss.elements.find((e) => e.id === 'M1.ro').value
    expect(av).toBeCloseTo(-gm * ((10000 * ro) / (10000 + ro)), 6)
    expect(av).toBeCloseTo(-37.7, 1)
  })

  it('draws no gate current in the tangent, whatever the drive', () => {
    const cs = {
      elements: [
        { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: 5 },
        { type: 'R', id: 'RD', nodes: ['vdd', 'd'], value: 10000 },
        { type: 'V', id: 'VG', nodes: ['g', 'gnd'], value: 0.9, small: true },
        { type: 'M', id: 'M1', nodes: ['d', 'g', 'gnd'], vt: 0.7, kn: 20e-3, lambda: 0.02 },
      ],
    }
    const ss = smallSignal(cs, newtonDC(cs))
    const sources = { VDD: 0, VG: 1 }
    expect(solveDC({ elements: ss.elements }, { sources }).i.VG).toBe(0)
  })
})

describe('the three-region model has a tangent too', () => {
  it('takes g_m from the collector current the region model settled at', () => {
    const net = {
      elements: [
        { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
        { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: 5000 },
        { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: 5 },
        { type: 'R', id: 'RB', nodes: ['bb', 'b'], value: 430000 },
        { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], beta: 100, va: 100 },
      ],
    }
    const op = solvePWL(net)
    const ss = smallSignal(net, op)
    expect(ss.point.Q1.region).toBe('active')
    expect(ss.elements.find((e) => e.id === 'Q1.gm').gain).toBeCloseTo(1e-3 / VT, 6)
    expect(ss.elements.find((e) => e.id === 'Q1.rpi').value).toBeCloseTo(100 * VT / 1e-3, 3)
  })

  it('opens every terminal of a device that is cut off', () => {
    const net = {
      elements: [
        { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
        { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: 5000 },
        { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: 0.2 },
        { type: 'R', id: 'RB', nodes: ['bb', 'b'], value: 100000 },
        { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], beta: 100 },
      ],
    }
    const ss = smallSignal(net, solvePWL(net))
    expect(ss.elements.filter((e) => e.of === 'Q1').every((e) => e.type === 'I' && e.value === 0)).toBe(true)
  })
})

describe('the amplitude guard', () => {
  it('estimates HD2 at v_be/(4V_T), and turns amber at 5 mV', () => {
    expect(hd2Estimate(5e-3) * 100).toBeCloseTo(4.835, 3)
    expect(hd2Estimate(10e-3) * 100).toBeCloseTo(9.670, 3)
    expect(amplitudeCheck(1e-3).state).toBe('ok')
    expect(amplitudeCheck(6e-3).state).toBe('warn')
    expect(amplitudeCheck(25e-3).state).toBe('refuse')
    expect(amplitudeCheck(5e-3).state).toBe('ok')
    expect(amplitudeCheck(5.1e-3).state).toBe('warn')
  })

  it('is measured against the real second harmonic of the exponential', () => {
    // The estimate is for the drive at the junction, so the junction is what
    // is driven: no source resistance, and no Early effect to modulate the
    // current with the output. What is left is a pure exponential through a
    // sine, whose harmonics are Bessel functions, and v_be/(4V_T) is the first
    // term of that ratio.
    const at = (vbe) =>
      newtonDC({
        elements: [
          { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
          { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: 5000 },
          { type: 'V', id: 'Vs', nodes: ['b', 'gnd'], value: vbe, small: true },
          { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'exp', beta: 100, va: Infinity },
        ],
      }).sol.v.c
    const bias = bisect((v) => (10 - at(v)) / 5000 - 1e-3, 0.4, 1.0, 0)
    const harmonics = (amp) => {
      const N = 128
      const out = Array.from({ length: N }, (_, k) => at(bias + amp * Math.sin((2 * Math.PI * k) / N)))
      const bin = (n) => {
        let re = 0
        let im = 0
        for (let k = 0; k < N; k++) {
          const t = (2 * Math.PI * n * k) / N
          re += out[k] * Math.cos(t)
          im -= out[k] * Math.sin(t)
        }
        return (2 * Math.hypot(re, im)) / N
      }
      return bin(2) / bin(1)
    }
    for (const amp of [2e-3, 5e-3]) {
      expect(Math.abs(harmonics(amp) / hd2Estimate(amp) - 1), `${amp * 1000} mV`).toBeLessThan(0.01)
    }
    // And it grows with the drive, which is the point of the guard.
    expect(harmonics(10e-3)).toBeGreaterThan(harmonics(5e-3) * 1.9)
  })
})
