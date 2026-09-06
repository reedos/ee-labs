import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EXPERIMENTS, byId, defaultsOf } from '../experiments.js'
import { analyse } from '../math.js'
import App from '../App.jsx'
import { ChartPane, LinePane, NumbersPane, SweepPane } from './panes.jsx'

// Every view an experiment offers is rendered here, at that experiment's own
// defaults, as markup.
//
// `experiments.test.js` checks that the ANALYSIS a view needs is there. This
// file checks that the component given that analysis produces something, which
// is the failure the other one cannot see: a pane standing in for a view that
// has since landed would pass every numeric test in the suite and show the
// reader a sentence apologising for itself.

const PANE_OF = { chart: ChartPane, line: LinePane, sweep: SweepPane, numbers: NumbersPane }

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
        expect(out.length, `${exp.id} ${view} rendered ${out.length} characters`).toBeGreaterThan(200)
        expect(out, `${exp.id} ${view} is still a stub`).not.toMatch(/not built yet/)
        expect(out, `${exp.id} ${view} shows a NaN`).not.toMatch(/NaN/)
        expect(out, `${exp.id} ${view} shows an undefined`).not.toMatch(/undefined/)
      }
    })
  }
})

describe('the whole shell mounts, for every experiment in every one of its views', () => {
  // This is the check that catches a prop the shell forgot to pass. The app
  // itself never passes `initialId` or `initialView`; they exist for this.
  for (const exp of EXPERIMENTS) {
    it(`${exp.id}`, () => {
      for (const view of exp.views) {
        const out = html(<App initialId={exp.id} initialView={view} />)
        expect(out, `${exp.id} in ${view} shows a NaN`).not.toMatch(/NaN/)
        expect(out, `${exp.id} in ${view} shows an undefined`).not.toMatch(/undefined/)
        expect(out, `${exp.id} in ${view} lost its name`).toContain(exp.name)
        // The note, the headline and the pane are all on the first screen.
        expect(out, `${exp.id} in ${view} lost its note`).toContain('data-role="see"')
        expect(out, `${exp.id} in ${view} lost its headline`).toContain('data-role="headline"')
      }
    })
  }
})

describe('the line and the sweep say what they are drawing', () => {
  it('the line view names its length, its wavelength and its standing-wave ratio', () => {
    const p = defaultsOf('a3')
    const out = html(<LinePane exp={byId.a3} x={analyse(byId.a3, p)} p={p} />)
    expect(out).toContain('data-role="line-legend"')
    expect(out).toMatch(/Wavelength/)
    expect(out).toMatch(/Standing-wave ratio/)
    // The marks are quarter wavelengths, and a quarter-wave section carries one
    // at each end.
    expect(out).toContain('data-tick="0.00"')
    expect(out).toContain('data-tick="0.25"')
  })

  it('the sweep view carries the refusal under the plot, not in a tooltip', () => {
    const p = defaultsOf('a5')
    const out = html(<SweepPane exp={byId.a5} x={analyse(byId.a5, p)} p={p} />)
    const declined = out.indexOf('data-role="declined"')
    expect(declined).toBeGreaterThan(out.indexOf('data-role="sweep"'))
    expect(out).toMatch(/no rational transfer function/)
    expect(out).toMatch(/exact at every frequency/)
  })

  it('the chart view marks the load and draws the path a line takes', () => {
    const p = defaultsOf('b3')
    const out = html(<ChartPane exp={byId.b3} x={analyse(byId.b3, p)} p={p} />)
    expect(out).toContain('data-point="load"')
    expect(out).toContain('data-point="input"')
    expect(out).toContain('data-path="towards the generator"')
    expect(out).toMatch(/data-circle="VSWR 2/)
  })
})
