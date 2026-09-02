import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, byId, defaultsOf } from './experiments.js'
import { analyse } from './math.js'
import { rereference, switchKnob } from './reference.js'

// The schematic answers back (student review, Phase 8): a node tapped becomes
// the reference, a switch tapped is thrown. Re-referencing is the claim A3
// makes in words — node voltages shift together, every difference stays.

describe('rereference', () => {
  const e = byId.a3
  const p = defaultsOf('a3')
  const x = analyse(e, p)
  it('A3 measured from A: A reads 0, the others shift by what A read, ground reads minus that', () => {
    const y = rereference(x, 'A')
    const vA = x.sol.v.A
    expect(vA).not.toBe(0)
    expect(y.sol.v.A).toBeCloseTo(0, 12)
    expect(y.sol.v.in).toBeCloseTo(x.sol.v.in - vA, 12)
    expect(y.sol.v.ref).toBeCloseTo(x.sol.v.ref - vA, 12)
    expect(y.sol.v.gnd).toBeCloseTo(-vA, 12)
  })
  it('leaves every element voltage, current and power exactly where it was', () => {
    const y = rereference(x, 'A')
    expect(y.sol.volt).toBe(x.sol.volt)
    expect(y.sol.i).toBe(x.sol.i)
    expect(y.sol.p).toBe(x.sol.p)
    // Differences from the shifted node voltages agree with the elements' own readings.
    expect(y.sol.v.in - y.sol.v.A).toBeCloseTo(x.sol.volt.R1, 12)
  })
  it('does not touch the analysis otherwise — same object back', () => {
    expect(rereference(x, null)).toBe(x)
    expect(rereference(x, 'nowhere')).toBe(x)
    expect(rereference({ sol: null, refusal: 'x' }, 'A')).toEqual({ sol: null, refusal: 'x' })
    // A node already at zero is already the reference.
    const zero = { ...x, sol: { ...x.sol, v: { ...x.sol.v, Z: 0 } } }
    expect(rereference(zero, 'Z')).toBe(zero)
  })
  it('re-referencing to ground itself is the identity', () => {
    const y = rereference(x, 'gnd')
    expect(y.sol.v).toEqual(x.sol.v)
  })
})

describe('switchKnob', () => {
  it('A2: the switch is thrown by the "open" toggle', () => {
    const e = byId.a2
    expect(switchKnob(e, defaultsOf('a2'), 'S1')).toBe('open')
  })
  it('F3 and F6: the switch is a time switch, no knob throws it', () => {
    expect(switchKnob(byId.f3, defaultsOf('f3'), 'S1')).toBeNull()
    expect(switchKnob(byId.f6, defaultsOf('f6'), 'S1')).toBeNull()
  })
  it('an id that is not a switch is nobody’s knob', () => {
    expect(switchKnob(byId.a2, defaultsOf('a2'), 'R1')).toBeNull()
  })
  it('every switch in the course is either a knob’s or a time switch — and a knob’s really throws it', () => {
    let knobbed = 0
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      for (const el of e.net(p).elements) {
        if (el.type !== 'SW') continue
        const k = switchKnob(e, p, el.id)
        if (k === null) continue
        knobbed++
        const was = el.closed !== false
        const now = e.net({ ...p, [k]: !p[k] }).elements.find((q) => q.id === el.id).closed !== false
        expect(now, `${e.id} ${el.id} flips with ${k}`).toBe(!was)
      }
    }
    expect(knobbed).toBeGreaterThan(0)
  })
})
