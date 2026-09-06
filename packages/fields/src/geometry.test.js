import { describe, it, expect } from 'vitest'
import { describeGeometry, epsOf, hasClosedForm, KINDS, labelOf, muOf } from './geometry.js'
import { EPS0, FieldsError, MU0 } from './const.js'
import { randomGeometry, rng } from './fuzz.js'

// The geometry description is the one object every other module in this package
// reads, so its contract is checked here rather than assumed everywhere else.
//
// The rule the messages follow: a dimension that cannot exist is not clamped
// into one that can. An inner radius larger than an outer one is a different
// object, and the message names the field and the two numbers.

describe('the nine kinds, and what each has a closed form for', () => {
  it('every kind lists its dimensions and its quantities', () => {
    expect(Object.keys(KINDS).length).toBe(9)
    for (const [kind, spec] of Object.entries(KINDS)) {
      expect(Array.isArray(spec.dims), kind).toBe(true)
      expect(spec.dims.length, kind).toBeGreaterThan(0)
      expect(Array.isArray(spec.has), kind).toBe(true)
      expect(spec.has.length, kind).toBeGreaterThan(0)
      expect(spec.name, kind).toBeTruthy()
      expect(spec.note, kind).toBeTruthy()
      for (const q of spec.has) expect(['capacitance', 'inductance', 'resistance']).toContain(q)
    }
  })

  it('hasClosedForm agrees with the table', () => {
    expect(hasClosedForm('coax', 'capacitance')).toBe(true)
    expect(hasClosedForm('coax', 'inductance')).toBe(true)
    expect(hasClosedForm('coax', 'resistance')).toBe(true)
    expect(hasClosedForm('solenoid', 'capacitance')).toBe(false)
    expect(hasClosedForm('twoWire', 'resistance')).toBe(false)
    expect(hasClosedForm('nonsense', 'capacitance')).toBe(false)
  })
})

describe('defaults, and the material', () => {
  it('fills epsr, mur, sigma and length', () => {
    const g = describeGeometry({ kind: 'coax', a: 1e-3, b: 3e-3 })
    expect(g.epsr).toBe(1)
    expect(g.mur).toBe(1)
    expect(g.sigma).toBe(0)
    expect(g.length).toBe(1)
  })

  it('the absolute permittivity and permeability follow the relative ones', () => {
    const g = describeGeometry({ kind: 'coax', a: 1e-3, b: 3e-3, epsr: 2.25, mur: 300 })
    expect(epsOf(g)).toBeCloseTo(2.25 * EPS0, 24)
    expect(muOf(g)).toBeCloseTo(300 * MU0, 12)
  })

  it('does not modify what it is given, so app state can be passed straight in', () => {
    const input = { kind: 'coax', a: 1e-3, b: 3e-3 }
    const before = JSON.stringify(input)
    describeGeometry(input)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('is idempotent, so a described geometry can be described again', () => {
    const r = rng(0x1de)
    for (const kind of Object.keys(KINDS)) {
      const once = describeGeometry(randomGeometry(r, kind))
      const twice = describeGeometry(once)
      expect(twice, kind).toEqual(once)
    }
  })

  it('gives every geometry a label naming its dimensions', () => {
    const g = { kind: 'coax', a: 1e-3, b: 3e-3 }
    expect(labelOf(describeGeometry(g))).toBe('Coaxial, a = 0.001 m, b = 0.003 m')
    const s = { kind: 'solenoid', area: 1e-4, len: 0.1, turns: 200 }
    expect(labelOf(describeGeometry(s))).toMatch(/turns = 200/)
  })
})

describe('what a geometry declines, and what it says', () => {
  it('an unknown kind lists the ones it knows', () => {
    expect(() => describeGeometry({ kind: 'trapezoid' })).toThrow(FieldsError)
    try {
      describeGeometry({ kind: 'trapezoid' })
    } catch (e) {
      expect(e.message).toMatch(/not a geometry this package knows/)
      expect(e.message).toMatch(/coax/)
      expect(e.field).toBe('kind')
    }
  })

  it('a missing dimension names the dimension', () => {
    expect(() => describeGeometry({ kind: 'coax', a: 1e-3 })).toThrow(/needs b, and it is missing/)
  })

  it('a dimension that is not a positive number names it and the value', () => {
    expect(() => describeGeometry({ kind: 'coax', a: -1e-3, b: 3e-3 })).toThrow(/a must be a positive number, and it is -0.001/)
    expect(() => describeGeometry({ kind: 'coax', a: 1e-3, b: NaN })).toThrow(/b must be a positive number/)
  })

  it('an inner radius larger than an outer one is a different object, not a clamp', () => {
    expect(() => describeGeometry({ kind: 'coax', a: 3e-3, b: 1e-3 })).toThrow(/outer radius b must be larger/)
    expect(() => describeGeometry({ kind: 'spherical', a: 3e-3, b: 1e-3 })).toThrow(/outer radius b must be larger/)
  })

  it('two wires that overlap are declined, with both numbers', () => {
    expect(() => describeGeometry({ kind: 'twoWire', a: 1e-3, d: 1.5e-3 })).toThrow(/cannot have their centres/)
    expect(() => describeGeometry({ kind: 'twoWire', a: 1e-3, d: 1.5e-3 })).toThrow(/or the wires overlap/)
    // Exactly touching is still an overlap, and the boundary is tested.
    expect(() => describeGeometry({ kind: 'twoWire', a: 1e-3, d: 2e-3 })).toThrow()
    expect(() => describeGeometry({ kind: 'twoWire', a: 1e-3, d: 2.0001e-3 })).not.toThrow()
  })

  it('a wire buried in its ground plane is declined', () => {
    expect(() => describeGeometry({ kind: 'wireOverGround', a: 2e-3, h: 1e-3 })).toThrow(/height must exceed the radius/)
  })

  it('a loop thinner than its own wire is declined', () => {
    expect(() => describeGeometry({ kind: 'loop', a: 1e-3, wire: 2e-3 })).toThrow(/loop radius must exceed the wire radius/)
  })

  it('a fractional turn count is declined', () => {
    expect(() => describeGeometry({ kind: 'solenoid', area: 1e-4, len: 0.1, turns: 10.5 })).toThrow(/whole number of one or more/)
    expect(() => describeGeometry({ kind: 'solenoid', area: 1e-4, len: 0.1, turns: 0 })).toThrow(/whole number of one or more/)
  })

  it('a negative conductivity is declined and a zero one is allowed', () => {
    expect(() => describeGeometry({ kind: 'bar', area: 1e-6, len: 1, sigma: -1 })).toThrow(/sigma must be zero or a positive number/)
    expect(describeGeometry({ kind: 'bar', area: 1e-6, len: 1, sigma: 0 }).sigma).toBe(0)
  })

  it('something that is not an object at all is declined', () => {
    expect(() => describeGeometry(null)).toThrow(/must be an object with a kind/)
    expect(() => describeGeometry(42)).toThrow(/must be an object with a kind/)
  })
})
