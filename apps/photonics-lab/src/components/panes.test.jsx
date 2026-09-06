import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EXPERIMENTS, byId, defaultsOf } from '../experiments.js'
import { analyse } from '../math.js'
import { CavityPane, CurvePane, LinkPane, NumbersPane, PulsePane, SchematicPane, SpectrumPane } from './panes.jsx'

// Every view an experiment offers is rendered here, at that experiment's own
// defaults, as markup.
//
// `experiments.test.js` checks that the ANALYSIS a view needs is there. This
// file checks that the component given that analysis produces something, which
// is the failure the other one cannot see: a pane still standing in for a group
// that has since landed would pass every numeric test in the suite and show the
// reader a sentence apologising for itself.
//
// The canvas panes draw in an effect, which does not run under
// `renderToStaticMarkup`, so what is measured for those is the frame and the
// readouts around the canvas. The drawing itself is measured by the harness,
// `scripts/verify.mjs`.

const PANE_OF = {
  schematic: SchematicPane,
  curve: CurvePane,
  pulse: PulsePane,
  link: LinkPane,
  cavity: CavityPane,
  spectrum: SpectrumPane,
  numbers: NumbersPane,
}

const html = (el) => renderToStaticMarkup(el)

describe('every view an experiment offers renders', () => {
  for (const exp of EXPERIMENTS) {
    it(`${exp.id} ${exp.views.join(', ')}`, () => {
      const p = defaultsOf(exp.id)
      const x = analyse(byId[exp.id], p)
      for (const view of exp.views) {
        const Pane = PANE_OF[view]
        expect(Pane, `${exp.id} offers ${view}, which nothing draws`).toBeDefined()
        const out = html(<Pane exp={exp} x={x} p={p} />)
        expect(out.length, `${exp.id} ${view} rendered ${out.length} characters`).toBeGreaterThan(120)
        expect(out, `${exp.id} ${view} is still a stub`).not.toMatch(/no circuit|no curve/)
        expect(out, `${exp.id} ${view} shows a NaN`).not.toMatch(/NaN/)
        expect(out, `${exp.id} ${view} shows an undefined`).not.toMatch(/undefined/)
      }
    })
  }
})

describe('what a pane puts on screen', () => {
  const at = (id, over = {}) => {
    const p = { ...defaultsOf(id), ...over }
    return { exp: byId[id], p, x: analyse(byId[id], p) }
  }

  it('the circuit carries a meter on every node and every element', () => {
    const { exp, p, x } = at('a2')
    const out = html(<SchematicPane exp={exp} x={x} p={p} />)
    for (const id of ['Vb', 'RL', 'D1', 'Iph']) expect(out, `the circuit omits ${id}`).toMatch(new RegExp(`data-el="${id}"`))
    for (const node of ['vb', 'c']) expect(out, `the circuit omits node ${node}`).toMatch(new RegExp(`data-node="${node}"`))
  })

  it('the waterfall draws a named bar for every loss, including the three at zero', () => {
    const { exp, p, x } = at('e5')
    const out = html(<LinkPane exp={exp} x={x} p={p} />)
    for (const it of x.budget.items) expect(out, `the waterfall omits ${it.name}`).toContain(it.name)
    // Three rows are losses this model does not include, drawn as zeros.
    expect((out.match(/class="is-zero"/g) || []).length).toBe(3)
  })

  it('the margin reads as off when the link does not close', () => {
    const closes = at('e5')
    const fails = at('e5', { length: 200e3 })
    expect(fails.x.budget.margin).toBeLessThan(0)
    expect(html(<LinkPane exp={closes.exp} x={closes.x} p={closes.p} />)).not.toMatch(/class="is-off"/)
    expect(html(<LinkPane exp={fails.exp} x={fails.x} p={fails.p} />)).toMatch(/class="is-off"/)
  })

  it('the cavity pane carries the refusal, because the refusal is content', () => {
    const { exp, p, x } = at('f1')
    const out = html(<CavityPane exp={exp} x={x} p={p} />)
    expect(out).toMatch(/cavity-refusal/)
    expect(out).toMatch(/transcendental/)
  })

  it('the spectrum pane marks the source as too wide when it is', () => {
    const narrow = at('f2')
    const wide = at('f2', { dLambda: 2e-9 })
    expect(wide.x.fits).toBe(false)
    expect(html(<SpectrumPane exp={narrow.exp} x={narrow.x} p={narrow.p} />)).not.toMatch(/class="is-off"/)
    expect(html(<SpectrumPane exp={wide.exp} x={wide.x} p={wide.p} />)).toMatch(/class="is-off"/)
  })

  it('the pulse pane prints both widths and the span they were measured over', () => {
    const { exp, p, x } = at('e2')
    const out = html(<PulsePane exp={exp} x={x} p={p} />)
    expect(out).toMatch(/Into the fibre/)
    expect(out).toMatch(/Out of the fibre/)
    expect(out).toMatch(/80\.000 km/)
  })

  it('a pane asked for something the experiment has not got says so rather than throwing', () => {
    // These branches are unreachable through the app, because a pane is only
    // offered by an experiment that lists its view. They exist so that a group
    // file listing a view its analysis cannot feed fails visibly.
    const bare = { kind: 'detector', exp: byId.a1, p: {}, headline: { value: 1, unit: '', label: 'nothing' } }
    expect(html(<SchematicPane exp={byId.a1} x={bare} p={{}} />)).toMatch(/no circuit/)
    expect(html(<CurvePane exp={{ ...byId.a1, curve: null }} x={bare} p={{}} />)).toMatch(/no curve/)
  })
})
