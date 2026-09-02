import { describe, expect, it } from 'vitest'
import { labelParts, signPlaces, valueText } from './schematicGeometry.js'

describe('schematic labels are typeset like the equations', () => {
  it('splits a reference designator into letter and subscript, then the value', () => {
    expect(labelParts({ id: 'R1', type: 'R', value: 1000 })).toEqual({ text: 'R1 1 kΩ', sym: 'R', sub: '1', value: '1 kΩ' })
    expect(labelParts({ id: 'Rin', type: 'R', value: 50 })).toEqual({ text: 'Rin 50 Ω', sym: 'R', sub: 'in', value: '50 Ω' })
    expect(labelParts({ id: 'RL', type: 'R', value: 8 })).toMatchObject({ sym: 'R', sub: 'L' })
    expect(labelParts({ id: 'SW1', type: 'SW', closed: true })).toMatchObject({ sym: 'SW', sub: '1', value: 'closed' })
    expect(labelParts({ id: 'U1', type: 'OPAMP' })).toMatchObject({ sym: 'U', sub: '1', value: 'ideal' })
    expect(labelParts({ id: 'V0', type: 'V', value: 0 })).toMatchObject({ sym: 'V', sub: '0', value: '0 V' })
  })

  it('keeps a custom label as written, and the full text for width and screen readers', () => {
    const e = { id: 'R1', type: 'R', value: 1000, label: 'load' }
    expect(labelParts(e)).toEqual({ text: 'load' })
    expect(labelParts({ id: 'R1', type: 'R', value: 1000 }).text).toBe(valueText({ id: 'R1', type: 'R', value: 1000 }))
  })
})

describe('voltage sign marks', () => {
  it('put + at the + terminal (local −20) and − at the other, on the side away from the label', () => {
    const h = signPlaces({ x: 100, y: 50 })
    expect(h.plus).toEqual({ x: 84, y: 44, anchor: 'middle' })
    expect(h.minus).toEqual({ x: 116, y: 44, anchor: 'middle' })
    const hf = signPlaces({ x: 100, y: 50, flip: true })
    expect([hf.plus.x, hf.minus.x]).toEqual([116, 84])
    const v = signPlaces({ x: 100, y: 50, dir: 'v' })
    expect(v.plus).toEqual({ x: 92, y: 39, anchor: 'middle' })
    expect(v.minus).toEqual({ x: 92, y: 67, anchor: 'middle' })
    const vf = signPlaces({ x: 100, y: 50, dir: 'v', flip: true })
    expect([vf.plus.y, vf.minus.y]).toEqual([67, 39])
  })
})
