import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import Schematic from './Schematic.jsx'

// The DC/AC overlay, which is the one thing the Electronics Lab needed from
// this renderer. The rule it is built on: the renderer draws what it is given.
// What an AC meter reads is measured in the app, on the small-signal netlist,
// and arrives here as a number.

const elements = [
  { id: 'V1', type: 'V', nodes: ['in', 'gnd'], value: 10 },
  { id: 'RC', type: 'R', nodes: ['in', 'c'], value: 5000 },
]
const layout = {
  w: 200,
  h: 120,
  items: [
    { el: 'V1', x: 40, y: 60, dir: 'v' },
    { el: 'RC', x: 120, y: 20, dir: 'h' },
    { node: 'c', x: 160, y: 20, side: 'r' },
  ],
}
const meters = { v: { in: 10, c: 5.25 }, i: { V1: -1e-3, RC: 1e-3 }, p: { V1: -0.01, RC: 0.005 }, volt: { V1: 10, RC: 4.75 } }
const draw = (props) => renderToStaticMarkup(<Schematic elements={elements} layout={layout} meters={meters} show="v" {...props} />)

describe('the DC and AC overlay', () => {
  it('writes the operating point when no overlay is asked for', () => {
    const svg = draw({})
    expect(svg).toContain('5.25 V')
    expect(svg).not.toContain('·sin')
  })

  it('writes the operating point in dc mode, and nothing about the signal', () => {
    const svg = draw({ overlay: { mode: 'dc', v: { c: 0.184 } } })
    expect(svg).toContain('5.25 V')
    expect(svg).not.toContain('·sin')
  })

  it('writes the signal amplitude in ac mode, with the sine it rides on', () => {
    const svg = draw({ overlay: { mode: 'ac', v: { c: 0.184 } } })
    expect(svg).toContain('184 mV·sin')
    expect(svg).not.toContain('5.25 V')
    // Marked as the other circuit, so a stylesheet can colour it apart.
    expect(svg).toContain('is-ac')
  })

  it('writes both as the sum they are', () => {
    const svg = draw({ overlay: { mode: 'both', v: { c: 0.184 } } })
    expect(svg).toContain('5.25 V + 184 mV·sin')
  })

  it('falls back to whichever half it has, rather than writing half a sum', () => {
    // A node the small-signal solve does not carry: in `both` it still reads
    // its own operating point, and in `ac` it reads nothing at all.
    expect(draw({ overlay: { mode: 'both', v: {} } })).toContain('5.25 V')
    expect(draw({ overlay: { mode: 'ac', v: {} } })).not.toContain('5.25 V')
  })

  it('leaves every other reading alone, because the overlay is the node text', () => {
    // The element still carries the voltage across it, in whichever `show` it
    // was given. Only the node's own text follows the overlay.
    const svg = draw({ overlay: { mode: 'ac', v: { c: 0.184 } } })
    expect(svg).toContain('4.75 V')
    expect(svg).toContain('184 mV·sin')
  })
})

describe('transistor glyphs', () => {
  // A CE stage's own transistor and a MOSFET switch's, side by side: one Q
  // and one M, both drawn from the same layout item shape as any other
  // element and both reading the collector or drain current by default.
  const qm = [
    { id: 'Q1', type: 'Q', nodes: ['c', 'b', 'e'], polarity: 'npn' },
    { id: 'M1', type: 'M', nodes: ['d', 'g', 's'], polarity: 'n' },
  ]
  const layout = {
    w: 220,
    h: 120,
    items: [
      { el: 'Q1', x: 60, y: 60, dir: 'h' },
      { el: 'M1', x: 160, y: 60, dir: 'h' },
    ],
  }
  const meters = { v: {}, i: { Q1: 2.5e-3, M1: -1.2e-3 }, p: { Q1: 0, M1: 0 }, volt: {} }

  it('draws both glyphs and labels them with their polarity', () => {
    const svg = renderToStaticMarkup(<Schematic elements={qm} layout={layout} />)
    expect(svg).toContain('data-el="Q1"')
    expect(svg).toContain('data-el="M1"')
    expect(svg).toContain('Q1 npn')
    expect(svg).toContain('M1 nmos')
  })

  it('reads the collector or drain current by default, from the same meters.i slot every element uses', () => {
    const svg = renderToStaticMarkup(<Schematic elements={qm} layout={layout} meters={meters} show="i" />)
    expect(svg).toContain('2.5 mA')
    expect(svg).toContain('1.2 mA')
  })

  it('draws the MOSFET’s gate plate, held off the channel by a gap the BJT has no reason to have', () => {
    // Symbols are drawn in the local −20…20 frame and rotated into place by
    // the enclosing group's transform, so the gate plate's local x = −9
    // shows up in the markup whatever the item's own (x, y).
    const oneM = renderToStaticMarkup(<Schematic elements={[qm[1]]} layout={{ w: 220, h: 120, items: [{ el: 'M1', x: 160, y: 60 }] }} />)
    const oneQ = renderToStaticMarkup(<Schematic elements={[qm[0]]} layout={{ w: 220, h: 120, items: [{ el: 'Q1', x: 160, y: 60 }] }} />)
    expect(oneM).toContain('x1="-9"')
    expect(oneQ).not.toContain('x1="-9"')
  })
})
