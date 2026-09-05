import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import OneLineCanvas, { balanceRows, branchGeometry, tintOf } from './OneLineCanvas.jsx'

// The one-line diagram with power-flow arrows. `PROGRAM.md` §4 names the Grid
// Lab as its first user and the Energy Lab as its second, so both are drawn
// here. The rule the renderer is built on is `Schematic.jsx`'s: the renderer
// draws what it is given, and what a meter reads is measured in the app.

// The Grid Lab's three-bus system, at its solved values.
const GRID = {
  buses: [
    { id: 'bus1', name: 'Bus 1', x: 60, y: 40, V: 1, theta: 0, kind: 'slack' },
    { id: 'bus2', name: 'Bus 2', x: 300, y: 40, V: 1, theta: -0.026032, kind: 'bus' },
    { id: 'bus3', name: 'Bus 3', x: 180, y: 170, V: 0.961727, theta: -0.083063, kind: 'load' },
  ],
  branches: [
    { id: 'br12', from: 'bus1', to: 'bus2', Pf: 0.32088, Qf: -0.11588, Pt: -0.31838, Qt: 0.03434 },
    { id: 'br13', from: 'bus1', to: 'bus3', Pf: 0.69729, Qf: 0.13941, Pt: -0.68724, Qt: -0.05233 },
    { id: 'br23', from: 'bus2', to: 'bus3', Pf: 0.91984, Qf: 0.44346, Pt: -0.91276, Qt: -0.34767 },
  ],
}

// The Energy Lab's microgrid: an array, a battery and a load on one DC bus.
const ENERGY = {
  buses: [
    { id: 'pv', name: 'Array', x: 60, y: 60, V: 1, kind: 'source', dc: true },
    { id: 'dcbus', name: 'DC bus', x: 200, y: 60, V: 0.98, kind: 'bus', dc: true },
    { id: 'bank', name: 'Bank', x: 340, y: 60, V: 0.98, kind: 'storage', soc: 0.62, dc: true },
    { id: 'load', name: 'Load', x: 200, y: 170, V: 0.98, kind: 'load', dc: true },
  ],
  branches: [
    { id: 'pv-bus', from: 'pv', to: 'dcbus', Pf: 0.8, Qf: 0, Pt: -0.8, Qt: 0 },
    { id: 'bus-bank', from: 'dcbus', to: 'bank', Pf: 0.3, Qf: 0, Pt: -0.3, Qt: 0 },
    { id: 'bus-load', from: 'dcbus', to: 'load', Pf: 0.5, Qf: 0, Pt: -0.5, Qt: 0 },
  ],
  balance: { in: 0.8, out: 0.5, stored: 0.3, curtailed: 0, unit: 'pu' },
}

const draw = (props) => renderToStaticMarkup(<OneLineCanvas {...props} />)

describe('the Grid Lab network', () => {
  it('draws one bar per bus and two arrows per branch', () => {
    const svg = draw(GRID)
    for (const b of GRID.buses) expect(svg, b.id).toContain(`data-bus="${b.id}"`)
    for (const br of GRID.branches) {
      expect(svg, br.id).toContain(`data-branch="${br.id}"`)
      expect(svg, `${br.id} head`).toContain(`data-arrow="${br.id}.from"`)
      expect(svg, `${br.id} tail`).toContain(`data-arrow="${br.id}.to"`)
    }
  })

  it('writes each bus voltage and angle, and leaves a DC bus no angle', () => {
    const svg = draw(GRID)
    expect(svg).toContain('0.962 pu')
    expect(svg).toContain('∠')
    // A DC bus has no angle to show, so none is written.
    const dc = draw({ buses: [{ id: 'b', name: 'DC', x: 40, y: 40, V: 1, dc: true }], branches: [] })
    expect(dc).not.toContain('∠')
    expect(dc).toContain('is-dc')
  })

  it('reverses an arrow when the flow reverses', () => {
    const a = GRID.buses[0]
    const b = GRID.buses[1]
    const out = branchGeometry(a, b, { Pf: 0.5, Pt: -0.5 }, 1)
    const back = branchGeometry(a, b, { Pf: -0.5, Pt: 0.5 }, 1)
    expect(Math.sign(out.head.x2 - out.head.x1)).toBe(1)
    expect(Math.sign(back.head.x2 - back.head.x1)).toBe(-1)
    // The two ends of a branch point opposite ways when the power goes in one
    // end and out the other, which is every branch on a solved network.
    expect(Math.sign(out.head.x2 - out.head.x1)).toBe(Math.sign(out.tail.x2 - out.tail.x1))
  })

  it('makes the arrow length the real flow, scaled by the largest one drawn', () => {
    const a = GRID.buses[0]
    const b = GRID.buses[1]
    const big = branchGeometry(a, b, { Pf: 1, Pt: -1 }, 1)
    const small = branchGeometry(a, b, { Pf: 0.5, Pt: -0.5 }, 1)
    expect(small.head.length).toBeLessThan(big.head.length)
    expect(small.head.length / big.head.length).toBeCloseTo(0.5, 6)
    // A flow of zero still draws a stub, so a branch never disappears.
    expect(branchGeometry(a, b, { Pf: 0, Pt: 0 }, 1).head.length).toBeGreaterThan(0)
  })

  it('carries the sign of the reactive flow on the arrow, without a second arrow', () => {
    const svg = draw(GRID)
    expect(svg).toContain('q-in')
    expect(svg).toContain('q-out')
  })

  it('tints a bus by how far its magnitude sits from nominal', () => {
    expect(tintOf(1)).toBe(0)
    expect(tintOf(0.95)).toBeCloseTo(-0.5, 12)
    expect(tintOf(1.05)).toBeCloseTo(0.5, 12)
    // The tint saturates rather than running off the scale.
    expect(tintOf(0.5)).toBe(-1)
    expect(tintOf(1.5)).toBe(1)
    expect(draw(GRID)).toContain('data-tint="-0.38"')
  })

  it('declines the arrows when a guard says the direction cannot be vouched for', () => {
    const refused = draw({ ...GRID, arrows: 'none', refusal: 'Past 30° the two solves can disagree on a direction.' })
    expect(refused).not.toContain('data-arrow=')
    expect(refused).toContain('Past 30°')
    // The lines and the buses stay: what is declined is the direction, not the
    // network.
    expect(refused).toContain('data-branch="br12"')
  })

  it('writes volts and watts when it is asked for SI rather than per unit', () => {
    const si = draw({ ...GRID, units: 'si', base: { S: 100e6, V: 230e3 } })
    expect(si).toContain('kV')
    expect(si).toContain('MW')
    expect(si).not.toContain('0.962 pu')
  })
})

describe('the Energy Lab microgrid', () => {
  it('draws a source, a store with its state of charge, and a load on one bus', () => {
    const svg = draw(ENERGY)
    expect(svg).toContain('is-source')
    expect(svg).toContain('is-storage')
    expect(svg).toContain('is-load')
    expect(svg).toContain('62 %')
    expect(svg).toContain('ol-rays')
  })

  it('shows the day cursor it is given, and nothing when there is none', () => {
    expect(draw({ ...ENERGY, t: 13 })).toContain('hour 13')
    expect(draw(ENERGY)).not.toContain('hour')
  })

  it('closes the energy balance and prints the residual beside it', () => {
    const { rows, residual } = balanceRows(ENERGY.balance)
    expect(rows.map((r) => r.key)).toEqual(['in', 'out', 'stored', 'curtailed'])
    expect(Math.abs(residual)).toBeLessThan(1e-12)
    const svg = draw(ENERGY)
    expect(svg).toContain('data-role="balance"')
    expect(svg).toContain('data-role="residual"')
    expect(svg).toContain('Curtailed')
  })

  it('shows a balance that does not close as a residual rather than hiding it', () => {
    const { residual } = balanceRows({ in: 1, out: 0.5, stored: 0.2 })
    expect(residual).toBeCloseTo(0.3, 12)
    // An unserved load is what the balance could not meet, so it counts back in.
    expect(balanceRows({ in: 1, out: 1.2, unserved: 0.2 }).residual).toBeCloseTo(0, 12)
  })

  it('shows only the balance rows it is given', () => {
    const { rows } = balanceRows({ in: 1, out: 1, loss: 0 })
    expect(rows.map((r) => r.key)).toEqual(['in', 'out', 'loss'])
  })
})

describe('what the canvas does with nothing', () => {
  it('draws an empty network without failing', () => {
    const svg = draw({ buses: [], branches: [] })
    expect(svg).toContain('one-line-svg')
    expect(svg).not.toContain('data-bus=')
  })

  it('skips a branch whose bus is not in the list', () => {
    const svg = draw({ buses: [{ id: 'a', x: 20, y: 20, V: 1 }], branches: [{ id: 'x', from: 'a', to: 'nowhere', Pf: 1 }] })
    expect(svg).not.toContain('data-branch="x"')
  })

  it('names itself for a reader who cannot see it', () => {
    expect(draw(GRID)).toContain('3 buses and 3 branches')
  })
})
