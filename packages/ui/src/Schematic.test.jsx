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
