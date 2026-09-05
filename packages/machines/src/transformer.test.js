import { describe, it, expect } from 'vitest'
import { GROUND, complex as cx, solveAC } from '@ee-labs/network'
import {
  idealTransformer,
  openShort,
  reflected,
  regulation,
  transformerEfficiency,
  transformerNetlist,
  transformerOf,
} from './transformer.js'

const rand = (lo, hi) => lo + Math.random() * (hi - lo)
const rms = (X) => cx.cabs(X) / Math.SQRT2

// A source, an ideal transformer and a load. The simplest circuit in which the
// two ratios and the power balance can all be measured at once.
const bare = (n, RL, rs = 1, Vp = 240) => ({
  elements: [
    { type: 'V', id: 'Vs', nodes: ['p', GROUND], value: 0, wave: { kind: 'sine', amp: Vp * Math.SQRT2, freq: 60 } },
    ...idealTransformer('T1', ['p', GROUND], ['s', GROUND], n, rs).elements,
    { type: 'R', id: 'RL', nodes: ['s', GROUND], value: RL },
  ],
})

describe('the ideal transformer', () => {
  it('divides the voltage by the turns ratio, exactly, at any ratio and any load', () => {
    for (let t = 0; t < 40; t++) {
      const n = rand(0.2, 12)
      const RL = Math.pow(10, rand(-1, 4))
      const ac = solveAC(bare(n, RL), 2 * Math.PI * 60)
      expect(rms(ac.v.s) / (rms(ac.v.p) / n)).toBeCloseTo(1, 11)
    }
  })

  it('multiplies the current by the turns ratio, exactly', () => {
    for (let t = 0; t < 40; t++) {
      const n = rand(0.2, 12)
      const RL = Math.pow(10, rand(-1, 4))
      const ac = solveAC(bare(n, RL), 2 * Math.PI * 60)
      const ip = rms(ac.i.Vs) // the source's current is the primary's
      const is = rms(ac.i.RL)
      expect(ip / (is / n)).toBeCloseTo(1, 10)
    }
  })

  it('holds Tellegen across itself: the four elements sum to no power at all', () => {
    for (let t = 0; t < 30; t++) {
      const n = rand(0.2, 12)
      const RL = Math.pow(10, rand(-1, 4))
      const ac = solveAC(bare(n, RL), 2 * Math.PI * 60)
      const ids = ['T1.Es', 'T1.sen.rs', 'T1.sen.e', 'T1.Gp']
      const S = ids.reduce((acc, id) => cx.cadd(acc, ac.s[id]), cx.C(0))
      const scale = cx.cabs(ac.s.RL)
      expect(cx.cabs(S) / scale).toBeLessThan(1e-11)
    }
  })

  it('gives the same answer whatever the sense resistance', () => {
    const ref = solveAC(bare(2.5, 47, 1), 2 * Math.PI * 60)
    for (const rs of [1e-2, 1, 1e2, 1e4, 1e6]) {
      const ac = solveAC(bare(2.5, 47, rs), 2 * Math.PI * 60)
      expect(rms(ac.v.s) / rms(ref.v.s)).toBeCloseTo(1, 11)
      expect(rms(ac.i.RL) / rms(ref.i.RL)).toBeCloseTo(1, 11)
    }
  })

  it('refuses a turns ratio that is not positive', () => {
    expect(() => idealTransformer('T', ['a', 'b'], ['c', 'd'], 0)).toThrow(/turns ratio/)
  })
})

describe('reflected impedance', () => {
  it('makes the primary see n² times the load', () => {
    for (let t = 0; t < 25; t++) {
      const n = rand(0.5, 6)
      const RL = Math.pow(10, rand(0, 3))
      const ac = solveAC(bare(n, RL), 2 * Math.PI * 60)
      const Zin = cx.cabs(cx.cdiv(ac.volt.Vs, cx.cscale(ac.i.Vs, -1)))
      expect(Zin / (n * n * RL)).toBeCloseTo(1, 10)
    }
  })

  it('refers the secondary winding to the primary the same way', () => {
    const r = reflected({ n: 2, R1: 0.6, R2: 0.15, X1: 1.2, X2: 0.3 })
    expect(r.Req).toBeCloseTo(0.6 + 4 * 0.15, 12)
    expect(r.Xeq).toBeCloseTo(1.2 + 4 * 0.3, 12)
  })
})

describe('the equivalent circuit with leakage and a magnetising branch', () => {
  const spec = {}
  const t = transformerOf(spec)

  it('drops the secondary below the ideal ratio, and the drop is the series branch', () => {
    const net = transformerNetlist(spec)
    const ac = solveAC(net, t.omega)
    const vOut = rms(ac.v[net.outNode])
    expect(vOut).toBeLessThan(t.Vp / t.n)
    // The whole drop is R1, X1, R2 and X2. Take them out and the ratio is exact.
    const ideal = solveAC(transformerNetlist({ ...spec, stage: 'ideal' }), t.omega)
    expect(rms(ideal.v.s) / (t.Vp / t.n)).toBeCloseTo(1, 11)
  })

  it('reads the shunt branch on an open circuit and the series branch on a short', () => {
    const os = openShort(spec)
    const open = solveAC(transformerNetlist({ ...spec, RL: 1e9 }), t.omega)
    const Zoc = cx.cdiv(open.volt.Vs, cx.cscale(open.i.Vs, -1))
    expect(cx.cabs(Zoc) / Math.hypot(os.Zoc[0], os.Zoc[1])).toBeCloseTo(1, 5)
    const short = solveAC(transformerNetlist({ ...spec, RL: 1e-9 }), t.omega)
    const Zsc = cx.cdiv(short.volt.Vs, cx.cscale(short.i.Vs, -1))
    expect(cx.cabs(Zsc) / Math.hypot(os.Zsc[0], os.Zsc[1])).toBeCloseTo(1, 5)
  })

  it('closes the power balance: in equals out plus copper plus core', () => {
    const net = transformerNetlist(spec)
    const ac = solveAC(net, t.omega)
    const pIn = -ac.s.Vs[0]
    const pOut = ac.s.RL[0]
    const pCu = ac.s.R1[0] + ac.s.R2[0]
    const pCore = ac.s.Rc[0]
    expect((pOut + pCu + pCore) / pIn).toBeCloseTo(1, 10)
  })
})

describe('regulation and efficiency', () => {
  const spec = {}
  const t = transformerOf(spec)

  it('measures regulation as the fall from no load to load', () => {
    const noLoad = rms(solveAC(transformerNetlist({ ...spec, RL: 1e9 }), t.omega).v.s2)
    const net = transformerNetlist(spec)
    const full = rms(solveAC(net, t.omega).v[net.outNode])
    const reg = regulation(noLoad, full)
    expect(reg).toBeGreaterThan(0)
    expect(reg).toBeCloseTo((noLoad - full) / full, 12)
  })

  it('refuses a regulation with no loaded voltage to divide by', () => {
    expect(() => regulation(120, 0)).toThrow(/loaded voltage/)
  })

  it('peaks where copper loss equals core loss', () => {
    const net = transformerNetlist(spec)
    const ac = solveAC(net, t.omega)
    const pCoreFull = ac.s.Rc[0]
    const pCuFull = ac.s.R1[0] + ac.s.R2[0]
    // Copper goes as the square of the load fraction, core stands still.
    const at = (x) => transformerEfficiency({ pOut: x * ac.s.RL[0], pCu: x * x * pCuFull, pCore: pCoreFull }).efficiency
    const xBest = Math.sqrt(pCoreFull / pCuFull)
    for (const d of [0.8, 0.9, 1.1, 1.2]) expect(at(xBest)).toBeGreaterThan(at(xBest * d))
  })
})
