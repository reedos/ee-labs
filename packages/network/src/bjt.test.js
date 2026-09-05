import { describe, it, expect } from 'vitest'
import { NetworkError } from './netlist.js'
import { VT } from './physics.js'
import { BJT_DEFAULTS, bjtCompanion, bjtCurrents, bjtOf, bjtSlopes, signOf } from './bjt.js'
import { shockley } from './diode.js'
import { newtonDC, solvePWL } from './pwl.js'
import { bisect } from './transient.js'

// The transistor, in two models, each against the algebra it is written from.

/** The common-emitter reference circuit: V_CC = 10 V, R_C = 5 kΩ, the base driven. */
const stage = (over = {}, p = {}) => ({
  elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
    { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: p.RC ?? 5000 },
    { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: p.VBB ?? 5 },
    { type: 'R', id: 'RB', nodes: ['bb', 'b'], value: p.RB ?? 430000 },
    { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], beta: 100, va: 100, ...over },
  ],
})

describe('what a BJT element is', () => {
  it('fills its defaults and keeps the ones it is given', () => {
    expect(BJT_DEFAULTS.polarity).toBe('npn')
    expect(BJT_DEFAULTS.model).toBe('regions')
    const d = bjtOf({ id: 'Q1', beta: 250, polarity: 'pnp' })
    expect(d.beta).toBe(250)
    expect(d.polarity).toBe('pnp')
    expect(d.vbe).toBe(0.7)
    expect(d.vcesat).toBe(0.2)
    expect(d.va).toBe(100)
    expect(signOf(d)).toBe(-1)
    expect(signOf(bjtOf({ id: 'Q2' }))).toBe(1)
  })

  it('names what is wrong with every parameter it refuses', () => {
    const bad = (over, re) => expect(() => bjtOf({ id: 'Q1', ...over })).toThrow(re)
    bad({ model: 'gummel' }, /unknown transistor model/)
    bad({ polarity: 'n' }, /npn.*pnp/)
    bad({ beta: 0 }, /β must be positive/)
    bad({ br: -1 }, /reverse β/)
    bad({ vt: 0 }, /thermal voltage/)
    bad({ model: 'exp', is: 0 }, /I_S must be positive/)
    bad({ model: 'exp', n: 0 }, /emission coefficient/)
    bad({ vbe: -0.1 }, /V_BE\(on\)/)
    bad({ vcesat: -0.1 }, /V_CE\(sat\)/)
    bad({ va: 0 }, /Early voltage/)
    expect(() => bjtOf({ id: 'Q1', va: Infinity })).not.toThrow()
  })
})

describe('D1: Ebers–Moll is two diodes and one controlled source', () => {
  const junction = (is, n) => ({ id: 'D', model: 'exp', is, n, vt: VT })

  it('gives the currents the two-diode drawing gives, to floating point', () => {
    const d = bjtOf({ id: 'Q1', model: 'exp', va: Infinity })
    for (const [vbe, vbc] of [
      [0.65, -4],
      [0.7, -0.2],
      [0.72, 0.6],
      [0.5, -1],
      [-0.2, -5],
    ]) {
      const cur = bjtCurrents(d, { vbe, vbc })
      // The drawing: a diode from base to emitter of I_S/β_F, a diode from
      // base to collector of I_S/β_R, and one source of I_S(e^{vbe} − e^{vbc}).
      const ibe = shockley(junction(d.is / d.beta, d.n), vbe).i
      const ibc = shockley(junction(d.is / d.br, d.n), vbc).i
      const iT = d.is * (Math.exp(vbe / (d.n * d.vt)) - Math.exp(vbc / (d.n * d.vt)))
      expect(cur.ib).toBeCloseTo(ibe + ibc, 15)
      expect(cur.ic).toBeCloseTo(iT - ibc, 15)
      expect(cur.ie).toBeCloseTo(-(cur.ic + cur.ib), 15)
      expect(cur.ic + cur.ib + cur.ie).toBeCloseTo(0, 18)
    }
  })

  it('gives β from α, and α from the base that is thin', () => {
    const d = bjtOf({ id: 'Q1', model: 'exp', va: Infinity })
    const cur = bjtCurrents(d, { vbe: 0.65, vbc: -4 })
    const alpha = cur.ic / -cur.ie
    expect(alpha).toBeCloseTo(d.beta / (d.beta + 1), 9)
    expect(alpha / (1 - alpha)).toBeCloseTo(d.beta, 6)
    expect(alpha).toBeCloseTo(0.990099, 6)
  })

  it('rises 59.5 mV for every decade of collector current', () => {
    const d = bjtOf({ id: 'Q1', model: 'exp', va: Infinity })
    const icAt = (vbe) => bjtCurrents(d, { vbe, vbc: vbe - 5 }).ic
    const vbeFor = (ic) => bisect((v) => icAt(v) - ic, 0.2, 1.0, 0)
    expect(vbeFor(1e-3) - vbeFor(1e-4)).toBeCloseTo(d.n * d.vt * Math.LN10, 6)
    expect((d.n * d.vt * Math.LN10) * 1000).toBeCloseTo(59.526, 3)
  })
})

describe('the exponential model’s tangent, and the Early effect', () => {
  it('makes g_m, r_π and r_o what the hybrid-π says, with V_A left out', () => {
    const e = { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'exp', beta: 100, va: Infinity }
    const d = bjtOf(e)
    const vbe = bisect((v) => bjtCurrents(d, { vbe: v, vbc: v - 5 }).ic - 1e-3, 0.4, 0.9, 0)
    const sl = bjtSlopes(d, { vbe, vbc: vbe - 5 })
    const cur = bjtCurrents(d, { vbe, vbc: vbe - 5 })
    expect(sl.gm).toBeCloseTo(cur.ic / VT, 9)
    expect(sl.gm * 1000).toBeCloseTo(38.682, 3)
    expect(1 / sl.gpi).toBeCloseTo(d.beta / sl.gm, 6)
    expect(1 / sl.gpi).toBeCloseTo(2585.2, 1)
    expect(sl.gobc).toBeCloseTo(0, 12) // no Early effect, so a flat curve
  })

  it('extrapolates every curve back to −V_A, which is what the Early slope is', () => {
    const d = bjtOf({ id: 'Q1', model: 'exp', va: 100 })
    for (const vbe of [0.6, 0.65, 0.7]) {
      const ic = (vce) => bjtCurrents(d, { vbe, vbc: vbe - vce }).ic
      // Two points on one curve, and the straight line through them.
      const [a, b] = [4, 8]
      const slope = (ic(b) - ic(a)) / (b - a)
      const intercept = a - ic(a) / slope
      expect(intercept).toBeCloseTo(-d.va, 6)
    }
  })

  it('makes r_o (V_A + V_CE)/I_C, of which V_A/I_C is the textbook’s rounding', () => {
    const d = bjtOf({ id: 'Q1', model: 'exp', va: 100 })
    const vce = 5
    const vbe = bisect((v) => bjtCurrents(d, { vbe: v, vbc: v - vce }).ic - 1e-3, 0.4, 0.9, 0)
    const sl = bjtSlopes(d, { vbe, vbc: vbe - vce })
    const ic = bjtCurrents(d, { vbe, vbc: vbe - vce }).ic
    // ∂i_C/∂v_CE at fixed v_BE is −∂i_C/∂v_BC.
    const ro = -1 / sl.gobc
    expect(ro).toBeCloseTo((d.va + vce) / ic, 3)
    expect(ro / 1000).toBeCloseTo(105, 6)
    // The textbook's V_A/I_C is 4.8 % low here, and the panel prints that.
    expect(d.va / ic / ro - 1).toBeCloseTo(-vce / (d.va + vce), 9)
  })

  it('mirrors exactly for a pnp: same conductances, currents the other way', () => {
    // The law is written once, for an npn, in the device's own frame. Only the
    // boundary between terminal and device carries the polarity, so the
    // conductances of the tangent come out identical and the currents reverse.
    const npn = { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'e'], model: 'exp', va: 100 }
    const pnp = { ...npn, polarity: 'pnp' }
    const v = { vbe: 0.66, vbc: -4 }
    const a = bjtCompanion(npn, v)
    const b = bjtCompanion(pnp, { vbe: -v.vbe, vbc: -v.vbc })
    expect(b.point.ic).toBeCloseTo(-a.point.ic, 15)
    expect(b.point.ib).toBeCloseTo(-a.point.ib, 15)
    expect(b.point.gm).toBeCloseTo(a.point.gm, 15)
    expect(b.point.rpi).toBeCloseTo(a.point.rpi, 9)
    expect(b.point.ro).toBeCloseTo(a.point.ro, 6)
    expect(b.region).toBe(a.region)
    // Every conductance of the two stamps matches, entry for entry.
    expect(b.g.map((r) => r[2])).toEqual(a.g.map((r) => r[2]))
    expect(b.gm.map((r) => r[4])).toEqual(a.gm.map((r) => r[4]))
  })
})

describe('the three-region model, in a circuit', () => {
  it('sits in the active region and delivers β times the base current', () => {
    const p = solvePWL(stage({ model: 'regions' }))
    expect(p.regions.Q1).toBe('active')
    const ib = p.sol.i['Q1.be']
    const ic = p.sol.i['Q1.ce']
    expect(ib).toBeCloseTo((5 - 0.7) / 430000, 12)
    expect(ic).toBeCloseTo(100 * ib, 12)
    expect(p.sol.v.c).toBeCloseTo(10 - 5000 * ic, 12)
    expect(p.sol.v.b).toBeCloseTo(0.7, 12)
    expect(p.sol.maxResidual).toBeLessThan(1e-15)
  })

  it('saturates when the base is driven past I_C/β, and holds V_CE(sat)', () => {
    const p = solvePWL(stage({ model: 'regions' }, { RB: 43000 }))
    expect(p.regions.Q1).toBe('saturation')
    expect(p.sol.v.c).toBeCloseTo(0.2, 12)
    const ic = p.sol.i['Q1.ce']
    const ib = p.sol.i['Q1.be']
    expect(ic).toBeCloseTo((10 - 0.2) / 5000, 12)
    // The forced β is what the circuit allows, and it is below the device's.
    expect(ic / ib).toBeLessThan(100)
    expect(ic / ib).toBeCloseTo(19.6, 1)
  })

  it('cuts off below V_BE(on), and the collector sits at the supply', () => {
    const p = solvePWL(stage({ model: 'regions' }, { VBB: 0.2, RB: 100000 }))
    expect(p.regions.Q1).toBe('cutoff')
    expect(p.sol.v.c).toBeCloseTo(10, 12)
    expect(p.sol.i['Q1.ce']).toBe(0)
  })

  it('walks cutoff, active and saturation as the drive rises, with no gap', () => {
    const seen = []
    for (const RB of [4e6, 1e6, 430000, 200000, 100000, 43000, 20000]) {
      const p = solvePWL(stage({ model: 'regions' }, { RB }))
      if (seen[seen.length - 1] !== p.regions.Q1) seen.push(p.regions.Q1)
      // Whatever the region, KCL holds and the collector is inside the rails.
      expect(p.sol.maxResidual).toBeLessThan(1e-12)
      expect(p.sol.v.c).toBeGreaterThanOrEqual(0.2 - 1e-12)
      expect(p.sol.v.c).toBeLessThanOrEqual(10 + 1e-12)
    }
    expect(seen).toEqual(['active', 'saturation'])
  })

  it('runs a pnp the same way, with every sign turned', () => {
    const net = {
      elements: [
        { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: -10 },
        { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: 5000 },
        { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: -5 },
        { type: 'R', id: 'RB', nodes: ['bb', 'b'], value: 430000 },
        { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], polarity: 'pnp', beta: 100 },
      ],
    }
    const p = solvePWL(net)
    expect(p.regions.Q1).toBe('active')
    expect(p.sol.v.b).toBeCloseTo(-0.7, 12)
    expect(p.sol.v.c).toBeCloseTo(-5, 9)
    expect(p.sol.i['Q1.ce']).toBeCloseTo(-100 * (5 - 0.7) / 430000, 12)
  })
})

describe('the two models, side by side', () => {
  it('puts the operating point within a tenth of a decade of each other', () => {
    const pwl = solvePWL(stage({ model: 'regions' }))
    const exp = newtonDC(stage({ model: 'exp' }))
    const icPwl = pwl.sol.i['Q1.ce']
    const icExp = exp.sol.i.RC
    // The exponential needs less than 0.7 V for a milliamp, so it takes a
    // little more base current and its β rises with V_CE. The gap is the
    // three-region model's stated error, and the panel prints it.
    expect(Math.abs(icExp / icPwl - 1)).toBeLessThan(0.1)
    expect(Math.abs(icExp / icPwl - 1)).toBeGreaterThan(0.01)
    expect(exp.sol.maxResidual).toBeLessThan(1e-12)
  })

  it('declines the exponential model in time, with the reason', () => {
    expect(() => solvePWL(stage({ model: 'exp' }))).toThrow(NetworkError)
    expect(() => solvePWL(stage({ model: 'exp' }))).toThrow(/curve rather than straight pieces/)
  })
})
