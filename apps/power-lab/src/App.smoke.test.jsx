import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import App, { outcomeOf } from './App.jsx'
import { EXPERIMENTS, defaultsOf } from './experiments.js'
import { analyse } from './analysis.js'

// A passing `vite build` only proves the modules parse. This mounts the real
// component tree so a render-phase crash — a bad hook, a missing field, an
// undefined experiment — fails here instead of in the browser.

const html = () => renderToString(React.createElement(App)).replace(/<!--\s*-->/g, '')

describe('App', () => {
  it('renders without throwing, on the first experiment', () => {
    const h = html()
    expect(h).toContain('Power Lab')
    expect(h).toContain('The resistor divider')
    // The regulator has no scope (its lesson is the regulation sweep); the chopper does.
    expect(h).toContain('Analysis')
    expect(renderToString(React.createElement(App, { initialId: 'a2' }))).toContain('Scope')
  })

  it('shows the resistor divider’s numbers in the top bar', () => {
    const h = html()
    expect(h).toMatch(/41\.7 %/)
    expect(h).toMatch(/5\.000 W|5 W/)
  })

  it('renders the report-issue control and the terms fold', () => {
    const h = html()
    expect(h).toContain('report-issue')
    expect(h).toMatch(/<details class="terms[^"]*"><summary>Terms: /)
  })

  it('mounts every experiment in every one of its views', () => {
    for (const e of EXPERIMENTS) {
      for (const v of e.views) {
        const h = renderToString(React.createElement(App, { initialId: e.id, initialView: v }))
        expect(h, `${e.id} ${v}`).toContain(e.name)
        expect(h, `${e.id} ${v}`).not.toMatch(/undefined|NaN/)
      }
    }
  }, 60000)

  it('never shows the arithmetic’s residue as a measurement', () => {
    // An average that is zero comes back from exact integration as ~1e-16, and
    // fmt would render it "0.6776 fV" — a number that reads like a reading.
    // Nothing in this lab is legitimately femto-anything at its defaults.
    const dust = /[\d.]\s*[fazy](V|A|W|C|Hz|s)/
    for (const e of EXPERIMENTS) {
      for (const v of e.views) {
        const h = renderToString(React.createElement(App, { initialId: e.id, initialView: v }))
        const hit = h.replace(/<[^>]*>/g, ' ').match(dust)
        expect(hit && hit[0], `${e.id} ${v}`).toBeFalsy()
      }
    }
  }, 60000)

  it('has a one-line outcome for every experiment, with no undefined or NaN in it', () => {
    for (const e of EXPERIMENTS) {
      const o = outcomeOf(e, analyse(e, defaultsOf(e.id)))
      expect(o, e.id).not.toMatch(/undefined|NaN/)
      expect(o.length).toBeGreaterThan(8)
    }
  })
})
