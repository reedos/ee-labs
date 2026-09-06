import { describe, it, expect } from 'vitest'
import { MOSFET_DEFAULTS, mosfetCompanion, mosfetCurrent, mosfetOf, signOf } from './mosfet.js'
import { newtonDC, solvePWL } from './pwl.js'
import { bisect } from './transient.js'
import { NetworkError } from './netlist.js'

// The MOSFET's square law, against the algebra, and in the two circuits the
// curriculum builds on it: the common-source stage and the CMOS inverter.

const M = mosfetOf({ id: 'M1' })

describe('what a MOSFET element is', () => {
  it('fills its defaults and keeps the ones it is given', () => {
    expect(MOSFET_DEFAULTS.polarity).toBe('n')
    expect(MOSFET_DEFAULTS.model).toBe('square')
    expect(M.vt).toBe(0.7)
    expect(M.kn).toBe(20e-3)
    expect(signOf(mosfetOf({ id: 'M1', polarity: 'p' }))).toBe(-1)
  })

  it('names what is wrong with every parameter it refuses', () => {
    const bad = (over, re) => expect(() => mosfetOf({ id: 'M1', ...over })).toThrow(re)
    bad({ model: 'bsim' }, /unknown transistor model/)
    bad({ polarity: 'npn' }, /"n".*"p"/)
    bad({ kn: 0 }, /transconductance parameter/)
    bad({ lambda: -1 }, /λ cannot be negative/)
    bad({ model: 'switch', ron: 0 }, /R_on/)
  })
})

describe('the square law, region by region', () => {
  const d = mosfetOf({ id: 'M1', lambda: 0.02 })

  it('passes nothing below threshold', () => {
    for (const vgs of [0, 0.3, 0.7]) {
      const r = mosfetCurrent(d, { vgs, vds: 2 })
      expect(r.id).toBe(0)
      expect(r.region).toBe('cutoff')
      expect(r.gm).toBe(0)
    }
  })

  it('follows the triode expression below the knee and the square law above it', () => {
    const vgs = 1.5
    const vov = vgs - d.vt
    for (const vds of [0.1, 0.4, 0.7]) {
      const r = mosfetCurrent(d, { vgs, vds })
      expect(r.region).toBe('triode')
      expect(r.id).toBeCloseTo(d.kn * (vov * vds - 0.5 * vds * vds) * (1 + d.lambda * vds), 15)
    }
    for (const vds of [1, 3, 5]) {
      const r = mosfetCurrent(d, { vgs, vds })
      expect(r.region).toBe('saturation')
      expect(r.id).toBeCloseTo(0.5 * d.kn * vov * vov * (1 + d.lambda * vds), 15)
    }
  })

  it('meets at the knee with the same value and the same slope', () => {
    const vgs = 1.5
    const vov = vgs - d.vt
    const h = 1e-7
    const below = mosfetCurrent(d, { vgs, vds: vov - h })
    const above = mosfetCurrent(d, { vgs, vds: vov + h })
    // Judged relatively: the two evaluations are a step apart, so what is
    // being asked is that the pieces meet, not that a step has no width.
    expect(Math.abs(below.id / above.id - 1)).toBeLessThan(1e-7)
    expect(Math.abs(below.gds / above.gds - 1)).toBeLessThan(1e-4)
    expect(Math.abs(below.gm / above.gm - 1)).toBeLessThan(1e-6)
  })

  it('gives g_m = k_n V_OV = 2I_D/V_OV and r_o = 1/(λ I_D) in saturation', () => {
    const vgs = d.vt + 0.2
    const vds = 2
    const r = mosfetCurrent(d, { vgs, vds })
    const vov = 0.2
    expect(r.gm).toBeCloseTo(d.kn * vov * (1 + d.lambda * vds), 15)
    expect(r.gm).toBeCloseTo((2 * r.id) / vov, 12)
    // r_o = 1/g_ds, and g_ds is λ times the current with λ divided out.
    expect(1 / r.gds).toBeCloseTo(1 / (d.lambda * 0.5 * d.kn * vov * vov), 6)
    expect(1 / r.gds / 1000).toBeCloseTo(125, 6)
  })

  it('is its own mirror image when the drain and source swap', () => {
    // A MOSFET has no built-in direction: at v_DS < 0 the terminals exchange
    // roles, and the current has to come out reversed and continuous.
    for (const vgs of [1, 1.5, 2]) {
      const f = mosfetCurrent(d, { vgs, vds: 0.3 })
      const rv = mosfetCurrent(d, { vgs: vgs - 0.3, vds: -0.3 })
      expect(rv.id).toBeCloseTo(-f.id, 15)
    }
    const zero = mosfetCurrent(d, { vgs: 1.5, vds: 0 })
    expect(zero.id).toBeCloseTo(0, 18)
  })

  it('turns every sign for a p-channel, and draws no gate current either way', () => {
    const e = { type: 'M', id: 'M1', nodes: ['d', 'g', 's'], lambda: 0.02 }
    const n = mosfetCompanion(e, { vgs: 0.9, vds: 2 })
    const p = mosfetCompanion({ ...e, polarity: 'p' }, { vgs: -0.9, vds: -2 })
    expect(p.point.id_).toBeCloseTo(-n.point.id_, 15)
    expect(p.point.gm).toBeCloseTo(n.point.gm, 15)
    expect(p.point.ro).toBeCloseTo(n.point.ro, 6)
    expect(p.region).toBe(n.region)
    // No stamp touches the gate, in either polarity.
    for (const c of [n, p]) {
      for (const [a, b] of c.g) expect([a, b]).not.toContain('g')
      for (const [a, b] of c.gm) expect([a, b]).not.toContain('g')
      for (const [a, b] of c.i) expect([a, b]).not.toContain('g')
    }
  })
})

describe('the common-source stage', () => {
  /** H5's stage: V_DD = 5 V, R_D = 10 kΩ, the source at ground. */
  const cs = (vg, RD = 10000) => ({
    elements: [
      { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: 5 },
      { type: 'R', id: 'RD', nodes: ['vdd', 'd'], value: RD },
      { type: 'V', id: 'VG', nodes: ['g', 'gnd'], value: vg },
      { type: 'M', id: 'M1', nodes: ['d', 'g', 'gnd'], vt: 0.7, kn: 20e-3, lambda: 0.02 },
    ],
  })

  it('sits in saturation at an overdrive of 0.2 V, passing 0.4 mA', () => {
    const net = cs(0.9)
    const r = newtonDC(net)
    const c = mosfetCompanion(net.elements[3], { vgs: r.sol.v.g, vds: r.sol.v.d })
    expect(c.region).toBe('saturation')
    expect(c.point.vov).toBeCloseTo(0.2, 12)
    // 0.4 mA, plus what λ adds over the drain voltage it settles at.
    expect(c.point.id_).toBeCloseTo(0.5 * 20e-3 * 0.04 * (1 + 0.02 * r.sol.v.d), 12)
    expect(c.point.id_ * 1000).toBeCloseTo(0.4074, 4)
    expect(r.sol.maxResidual).toBeLessThan(1e-15)
    expect(r.iters.length).toBeLessThan(20)
  })

  it('draws no gate current at all, which is the reason for the device', () => {
    const r = newtonDC(cs(0.9))
    expect(r.sol.i.VG).toBe(0)
  })

  it('has no operating point at all when its gate is left floating', () => {
    const floating = {
      elements: [
        { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: 5 },
        { type: 'R', id: 'RD', nodes: ['vdd', 'd'], value: 10000 },
        { type: 'M', id: 'M1', nodes: ['d', 'g', 'gnd'], vt: 0.7, kn: 20e-3 },
      ],
    }
    expect(() => newtonDC(floating)).toThrow(NetworkError)
    expect(() => newtonDC(floating)).toThrow(/no path to ground/)
  })
})

describe('D6: the CMOS inverter', () => {
  /** Matched devices, λ left out so the two halves are exactly each other. */
  const inverter = (vin, VDD = 5) => ({
    elements: [
      { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: VDD },
      { type: 'V', id: 'Vin', nodes: ['in', 'gnd'], value: vin },
      { type: 'M', id: 'Mp', nodes: ['out', 'in', 'vdd'], polarity: 'p', vt: 0.7, kn: 20e-3 },
      { type: 'M', id: 'Mn', nodes: ['out', 'in', 'gnd'], polarity: 'n', vt: 0.7, kn: 20e-3 },
    ],
  })
  const out = (vin) => newtonDC(inverter(vin)).sol.v.out

  it('switches at half the supply when the two halves match', () => {
    // With λ left out, both devices saturate at once in the middle and their
    // currents match at any output voltage there: the characteristic is
    // vertical, and what settles it is the leakage floor the solver keeps on
    // every junction. It settles it symmetrically, which is the answer.
    expect(out(2.5)).toBeCloseTo(2.5, 4)
    expect(newtonDC(inverter(1.65, 3.3)).sol.v.out).toBeCloseTo(1.65, 4)
    // Away from that band the characteristic has a slope and the answer is
    // tight: half a supply either side, to floating point.
    expect(out(1)).toBeGreaterThan(4.9)
    expect(out(4)).toBeLessThan(0.1)
  })

  it('takes no supply current at either end, which is the door to digital', () => {
    expect(Math.abs(newtonDC(inverter(0)).sol.i.VDD)).toBeLessThan(1e-12)
    expect(Math.abs(newtonDC(inverter(5)).sol.i.VDD)).toBeLessThan(1e-12)
    expect(out(0)).toBeCloseTo(5, 9)
    expect(out(5)).toBeCloseTo(0, 9)
    // Halfway across, both devices conduct and the supply feels it.
    expect(Math.abs(newtonDC(inverter(2.5)).sol.i.VDD)).toBeCloseTo(0.5 * 20e-3 * (2.5 - 0.7) ** 2, 6)
  })

  it('puts the noise margins where the slope reaches −1', () => {
    const slope = (vin) => (out(vin + 1e-5) - out(vin - 1e-5)) / 2e-5
    const vil = bisect((v) => slope(v) + 1, 1.0, 2.4, 0)
    const vih = bisect((v) => slope(v) + 1, 2.6, 4.0, 0)
    // The matched inverter's closed forms: (3V_DD + 2V_t)/8 and (5V_DD − 2V_t)/8.
    expect(vil).toBeCloseTo((3 * 5 + 2 * 0.7) / 8, 4)
    expect(vih).toBeCloseTo((5 * 5 - 2 * 0.7) / 8, 4)
    expect(vil).toBeCloseTo(2.05, 4)
    expect(vih).toBeCloseTo(2.95, 4)
  })
})

describe('the switch model', () => {
  const load = (vg) => ({
    elements: [
      { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: 12 },
      { type: 'R', id: 'RL', nodes: ['vdd', 'd'], value: 24 },
      { type: 'V', id: 'VG', nodes: ['g', 'gnd'], value: vg },
      { type: 'M', id: 'M1', nodes: ['d', 'g', 'gnd'], model: 'switch', vt: 2, ron: 0.5 },
    ],
  })

  it('conducts through R_on above threshold, and blocks below it', () => {
    const on = solvePWL(load(10))
    expect(on.regions.M1).toBe('on')
    expect(on.sol.v.d).toBeCloseTo((12 * 0.5) / 24.5, 12)
    expect(on.sol.i['M1.ds']).toBeCloseTo(12 / 24.5, 12)
    const off = solvePWL(load(0))
    expect(off.regions.M1).toBe('off')
    expect(off.sol.v.d).toBeCloseTo(12, 12)
    expect(off.sol.i['M1.ds']).toBe(0)
  })

  it('wastes what R_on costs, which is Power Lab’s whole argument', () => {
    const on = solvePWL(load(10))
    const i = on.sol.i['M1.ds']
    expect(on.sol.p['M1.ds']).toBeCloseTo(i * i * 0.5, 12)
    expect(on.sol.p['M1.ds'] / (12 * i)).toBeCloseTo(0.5 / 24.5, 12)
  })
})
