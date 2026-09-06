import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Schematic } from '@ee-labs/ui'
import { EXPERIMENTS, VIEW_LABELS } from './experiments.js'
import { analyse, defaultsOf } from './analysis.js'
import { drawOf } from './layouts.js'
import { readQuantity } from './quantities.js'
import { summary } from './report.js'

// The shell, rendered without a browser.
//
// A canvas draws nothing under renderToStaticMarkup, so what is checked here
// is everything around it. The circuit renders for every experiment that has
// one, every element a layout names exists in the netlist it was given, the
// meters cover every node the drawing labels, and the report link carries the
// setup a person would otherwise have to retype.

describe('the machine drawing', () => {
  for (const exp of EXPERIMENTS) {
    const x = analyse(exp, defaultsOf(exp))
    const draw = drawOf(x)
    if (!draw) continue
    it(`${exp.id} renders its circuit`, () => {
      const html = renderToStaticMarkup(
        <Schematic elements={draw.elements} layout={draw.layout} meters={x.sol || null} show="i" />,
      )
      expect(html).toContain('<svg')
      for (const e of draw.elements) expect(html, `${exp.id} draws ${e.id}`).toContain(`data-el="${e.id}"`)
    })

    it(`${exp.id} names only nodes the netlist has`, () => {
      const nodes = new Set(x.net.elements.flatMap((e) => e.nodes))
      for (const item of draw.layout.items)
        if (item.node) expect(nodes.has(item.node), `${exp.id} labels node ${item.node}`).toBe(true)
    })

    it(`${exp.id} crops inside its own canvas`, () => {
      const [x0, y0, x1, y1] = draw.layout.crop
      expect(x0).toBeGreaterThanOrEqual(0)
      expect(y0).toBeGreaterThanOrEqual(0)
      expect(x1).toBeLessThanOrEqual(draw.layout.w)
      expect(y1).toBeLessThanOrEqual(draw.layout.h)
    })
  }
})

describe('the report link', () => {
  it('carries the experiment, the view and every knob', () => {
    const exp = EXPERIMENTS[0]
    const params = defaultsOf(exp)
    const text = summary(exp, params, 'reading')
    expect(text).toContain(exp.name)
    expect(text).toContain('View: reading')
    for (const p of exp.params) expect(text, `${p.key} missing`).toContain(p.label)
  })
})

describe('the view switch', () => {
  it('gives every view a label and a hover line', () => {
    for (const [id, v] of Object.entries(VIEW_LABELS)) {
      expect(v.label.length, id).toBeGreaterThan(2)
      expect(v.title.length, id).toBeGreaterThan(20)
    }
  })

  it('has a reading for the topbar on every experiment', () => {
    for (const exp of EXPERIMENTS) {
      const x = analyse(exp, defaultsOf(exp))
      const first = {
        dc: 'mech.rpm',
        transformer: 'xf.vOut',
        im: 'im.rpm',
        field: 'field.rpmSync',
        sync: 'sync.P',
        pmsm: 'pmsm.torque',
        dq: 'dq.radius',
        losses: 'loss.efficiency',
        sat: 'sat.lambda',
      }[exp.kind]
      expect(Number.isFinite(readQuantity(x, first)), `${exp.id} ${first}`).toBe(true)
    }
  })
})
