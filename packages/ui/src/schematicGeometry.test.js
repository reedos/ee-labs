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
    expect(h.plus).toEqual({ x: 84, y: 39.2, anchor: 'middle' })
    expect(h.minus).toEqual({ x: 116, y: 39.2, anchor: 'middle' })
    const hf = signPlaces({ x: 100, y: 50, flip: true })
    expect([hf.plus.x, hf.minus.x]).toEqual([116, 84])
    const v = signPlaces({ x: 100, y: 50, dir: 'v' })
    expect(v.plus).toEqual({ x: 87, y: 39, anchor: "middle" })
    expect(v.minus).toEqual({ x: 87, y: 67, anchor: "middle" })
    const vf = signPlaces({ x: 100, y: 50, dir: 'v', flip: true })
    expect([vf.plus.y, vf.minus.y]).toEqual([67, 39])
  })

  // The defect this geometry exists to prevent: a horizontal element's marks
  // used to be drawn on top of the resistor's own zigzag. Stated as clearance
  // against the body rather than as coordinates, so it still means something if
  // the numbers move.
  it('keeps a horizontal element’s marks above its body', () => {
    // The resistor zigzag: ±20 along the axis, ±6.8 off it counting its stroke.
    const BODY = 6.8
    // A glyph grows upward from its baseline, so the baseline is its lowest ink.
    for (const flip of [false, true]) {
      const h = signPlaces({ x: 100, y: 50, flip })
      for (const m of [h.plus, h.minus]) expect(m.y).toBeLessThan(50 - BODY)
    }
  })

  // A vertical element's marks clear the body sideways, and the distance is set
  // by the mark's BOX rather than its ink: an 11px <text> measures 16px wide and
  // is centred on the anchor, so half of it reaches back toward the body. 12.47
  // in these units is where the box stops touching a vertical resistor's teeth,
  // measured in the browser. Upper bound too, because the space further out
  // belongs to the element's callout, which an earlier offset collided with.
  it('keeps a vertical element’s mark box clear of its body, and no further', () => {
    for (const flip of [false, true]) {
      const v = signPlaces({ x: 100, y: 50, dir: 'v', flip })
      for (const m of [v.plus, v.minus]) {
        expect(Math.abs(m.x - 100)).toBeGreaterThan(12.47)
        expect(Math.abs(m.x - 100)).toBeLessThan(13.8)
      }
    }
  })
})
