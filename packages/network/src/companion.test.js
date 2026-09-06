import { describe, it, expect } from 'vitest'
import { companion, companionElements, controlsOf, guessFor, hasCompanion, operatingPoint, readControls, stampCurrents, terminalLaw } from './companion.js'
import { newtonDC } from './pwl.js'
import { normalize, NetworkError } from './netlist.js'
import { GMIN, VT } from './physics.js'

// Invariant 2 of the plan, at the element rather than at the circuit: the
// tangent a companion returns IS the derivative of the element's own law.
//
// The check differences the law itself and then differences the stamps with
// the companion held fixed. If the two agree at twenty random points for every
// device, no sign, no factor and no missing cross term has survived.

const DEVICES = [
  { type: 'D', id: 'D1', nodes: ['a', 'k'], model: 'exp', is: 1e-14 },
  { type: 'D', id: 'D2', nodes: ['a', 'k'], model: 'exp', is: 1e-12, n: 1.8 },
  { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'e'], model: 'exp', beta: 100, va: 100 },
  { type: 'Q', id: 'Q2', nodes: ['c', 'b', 'e'], model: 'exp', beta: 250, br: 2, va: Infinity },
  { type: 'Q', id: 'Q3', nodes: ['c', 'b', 'e'], model: 'exp', polarity: 'pnp', beta: 60, va: 50 },
  { type: 'M', id: 'M1', nodes: ['d', 'g', 's'], vt: 0.7, kn: 20e-3, lambda: 0.02 },
  { type: 'M', id: 'M2', nodes: ['d', 'g', 's'], polarity: 'p', vt: 0.9, kn: 50e-3, lambda: 0 },
]

/** A deterministic point inside the range where each device's law is used. */
function sample(e, seed) {
  let s = seed >>> 0
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32)
  if (e.type === 'D') return { v: -0.4 + 1.1 * rnd() }
  if (e.type === 'Q') {
    const sign = e.polarity === 'pnp' ? -1 : 1
    const vbe = sign * (0.4 + 0.35 * rnd())
    const vbc = sign * (-6 + 6.6 * rnd())
    return { vbe, vbc }
  }
  const sign = e.polarity === 'p' ? -1 : 1
  return { vgs: sign * (0.2 + 2.3 * rnd()), vds: sign * (0.05 + 4 * rnd()) }
}

describe('the companion is the derivative', () => {
  it('matches a central difference of the law at twenty points on every device', () => {
    for (const e of DEVICES) {
      const keys = controlsOf(e)
      for (let k = 0; k < 20; k++) {
        const v = sample(e, k * 7919 + 13)
        const c = companion(e, v)
        // The tangent passes through the point.
        const law = terminalLaw(e, v)
        const at = stampCurrents(e, c, v)
        for (const node of e.nodes) {
          expect(Math.abs(at[node] - law[node]), `${e.id} ${node} at ${JSON.stringify(v)}`).toBeLessThan(1e-9 * (1 + Math.abs(law[node])))
        }
        expect(typeof c.region).toBe('string')
        // And its slope is the law's slope, in every controlling direction.
        for (const key of keys) {
          // A step small enough that the curve is straight over it and large
          // enough that the difference is not rounding: 10 µV either side.
          const h = 1e-5
          const up = { ...v, [key]: v[key] + h }
          const dn = { ...v, [key]: v[key] - h }
          const dLaw = {}
          const dStamp = {}
          for (const node of e.nodes) {
            dLaw[node] = (terminalLaw(e, up)[node] - terminalLaw(e, dn)[node]) / (2 * h)
            dStamp[node] = (stampCurrents(e, c, up)[node] - stampCurrents(e, c, dn)[node]) / (2 * h)
          }
          for (const node of e.nodes) {
            // A part in 10⁵, or the leakage floor, whichever is looser. Below
            // the floor the companion is deliberately NOT the derivative: a
            // junction whose true slope is femtosiemens is stamped at GMIN so
            // that its node stays attached to the circuit at all.
            const tol = Math.max(1e-5 * Math.abs(dLaw[node]), 4 * GMIN)
            expect(Math.abs(dStamp[node] - dLaw[node]), `${e.id} ∂i_${node}/∂${key} at ${JSON.stringify(v)}`).toBeLessThanOrEqual(tol)
          }
        }
      }
    }
  })

  it('is pinned at the leakage floor where the true slope is below it', () => {
    // The one place the tangent is not the derivative, stated rather than hidden.
    const e = { type: 'D', id: 'D1', nodes: ['a', 'k'], model: 'exp', is: 1e-14 }
    const c = companion(e, { v: -0.5 })
    expect(c.g[0][2]).toBe(GMIN)
    expect(companion(e, { v: 0.6 }).g[0][2]).toBeGreaterThan(GMIN)
  })

  it('conserves current: what goes in at one terminal comes out at the others', () => {
    for (const e of DEVICES) {
      for (let k = 0; k < 10; k++) {
        const v = sample(e, k * 104729 + 5)
        const c = companion(e, v)
        const at = stampCurrents(e, c, v)
        const sum = e.nodes.reduce((s, n) => s + at[n], 0)
        const scale = e.nodes.reduce((s, n) => Math.max(s, Math.abs(at[n])), 1e-12)
        expect(Math.abs(sum) / scale, e.id).toBeLessThan(1e-12)
      }
    }
  })

  it('knows which elements carry a curve and which carry straight pieces', () => {
    expect(hasCompanion({ type: 'D', id: 'D', model: 'exp' })).toBe(true)
    expect(hasCompanion({ type: 'D', id: 'D', model: 'drop' })).toBe(false)
    expect(hasCompanion({ type: 'Q', id: 'Q' })).toBe(false) // three regions by default
    expect(hasCompanion({ type: 'Q', id: 'Q', model: 'exp' })).toBe(true)
    expect(hasCompanion({ type: 'M', id: 'M' })).toBe(true) // the square law by default
    expect(hasCompanion({ type: 'M', id: 'M', model: 'switch' })).toBe(false)
    expect(hasCompanion({ type: 'R', id: 'R' })).toBe(false)
    expect(() => companion({ type: 'R', id: 'R1', nodes: ['a', 'b'] }, {})).toThrow(NetworkError)
  })

  it('reads its controlling voltages off a solution, and starts somewhere sane', () => {
    const v = { c: 5, b: 0.65, e: 0, gnd: 0 }
    expect(readControls(DEVICES[2], v)).toEqual({ vbe: 0.65, vbc: -4.35 })
    expect(readControls(DEVICES[0], { a: 0.7, k: 0 })).toEqual({ v: 0.7 })
    expect(readControls(DEVICES[5], { d: 2, g: 1, s: 0 })).toEqual({ vgs: 1, vds: 2 })
    for (const e of DEVICES) {
      const g = guessFor(e)
      for (const key of controlsOf(e)) expect(Number.isFinite(g[key]), `${e.id}.${key}`).toBe(true)
    }
  })

  it('keeps the diode’s own id on its one stamp, and names a transistor’s several', () => {
    const d = DEVICES[0]
    const one = companionElements(d, companion(d, { v: 0.6 }))
    expect(one.length).toBe(1)
    expect(one[0].id).toBe('D1')
    expect(one[0].type).toBe('GI')
    const q = DEVICES[2]
    const many = companionElements(q, companion(q, { vbe: 0.65, vbc: -4 }))
    expect(many.length).toBeGreaterThan(3)
    for (const el of many) expect(el.of).toBe('Q1')
    expect(many.map((el) => el.id)).toContain('Q1.g0')
    expect(many.map((el) => el.id)).toContain('Q1.m0')
  })

  it('does not spend its current sources: two calls give the same stamps', () => {
    const q = DEVICES[2]
    const c = companion(q, { vbe: 0.65, vbc: -4 })
    const a = companionElements(q, c)
    const b = companionElements(q, c)
    expect(b.map((e) => [e.id, e.g ?? e.gain ?? e.value, e.i0 ?? 0])).toEqual(a.map((e) => [e.id, e.g ?? e.gain ?? e.value, e.i0 ?? 0]))
  })
})

describe('Newton over the companion interface', () => {
  const stage = (over = {}) => ({
    elements: [
      { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
      { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: 5000 },
      { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: 5 },
      { type: 'R', id: 'RB', nodes: ['bb', 'b'], value: 430000 },
      { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'exp', beta: 100, va: 100, ...over },
    ],
  })

  it('settles in a handful of iterations and keeps every one of them', () => {
    const r = newtonDC(stage())
    expect(r.converged).toBe(true)
    expect(r.iters.length).toBeLessThanOrEqual(10)
    expect(r.iters[0].k).toBe(0)
    expect(r.iters[r.iters.length - 1].step).toBeLessThan(1e-9)
    // Each iteration carries the point it linearised at, which is what the
    // curves view draws walking down to the answer.
    expect(r.iters[0].v.Q1.ic).toBeDefined()
    expect(r.sol.maxResidual).toBeLessThan(1e-12)
  })

  it('reports the operating point the tangent was taken at', () => {
    const net = stage()
    const r = newtonDC(net)
    const op = operatingPoint(normalize(net), r.sol)
    expect(op.Q1.region).toBe('active')
    expect(op.Q1.vce).toBeCloseTo(r.sol.v.c, 12)
    expect(op.Q1.gm).toBeCloseTo(op.Q1.ic / VT, 3)
    expect(op.Q1.rpi * op.Q1.gm).toBeCloseTo(100 * (1 + op.Q1.vce / 100), 1)
    expect(op.Q1.ro).toBeCloseTo((100 + op.Q1.vce) / op.Q1.ic, 0)
  })

  it('ramps the supplies from zero when the direct solve will not settle', () => {
    // A transistor with an enormous β and a hard current drive into its base:
    // the direct solve walks the exponential past anything the limiter can
    // pull back, and the ramp is what finds the point.
    const hard = {
      elements: [
        { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
        { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: 5000 },
        { type: 'I', id: 'IB', nodes: ['gnd', 'b'], value: 5e-6 },
        { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'exp', beta: 1000, va: 100 },
      ],
    }
    const r = newtonDC(hard)
    expect(r.converged).toBe(true)
    expect(r.sol.maxResidual).toBeLessThan(1e-12)
    // 5 µA of base current at β = 1000 asks for 5 mA, and 5 kΩ cannot deliver
    // it, so the device ends up saturated near the supply's foot.
    expect(r.sol.v.c).toBeLessThan(1)
    expect(r.sol.v.b).toBeGreaterThan(0.5)
  })

  it('gives its refusal a reason when there is no operating point at all', () => {
    const impossible = {
      elements: [
        { type: 'I', id: 'I1', nodes: ['a', 'gnd'], value: 1e-3 },
        { type: 'D', id: 'D1', nodes: ['a', 'gnd'], model: 'exp' },
      ],
    }
    // A milliamp pulled backwards through a junction: nothing to settle on.
    expect(() => newtonDC(impossible, { maxIter: 30 })).toThrow(NetworkError)
    expect(() => newtonDC(impossible, { maxIter: 30 })).toThrow(/settle|no solution|path to ground/)
  })
})
