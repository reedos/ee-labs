import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import App from './App.jsx'
import { EXPERIMENTS } from './experiments.js'

// A passing `vite build` only proves the modules parse. This mounts the real
// component tree, so a render-phase crash — a bad hook, a missing field, an
// undefined experiment — fails here rather than in the browser.
//
// React inserts <!-- --> between adjacent text nodes when server-rendering, so
// the markers are stripped before matching.

const html = () => renderToString(React.createElement(App)).replace(/<!--\s*-->/g, '')

describe('App', () => {
  it('renders without throwing', () => {
    const h = html()
    expect(h).toContain('DSP Lab')
    expect(h).toContain('Time domain')
    expect(h).toContain('Frequency domain')
  })

  it('lists every experiment in the sidebar, under its group', () => {
    const h = html()
    for (const e of EXPERIMENTS) expect(h, e.id).toContain(e.name)
    expect(h).toContain('Changing the rate')
    expect(h).toContain('Designing to a specification')
    expect(h).toContain('The arithmetic a processor has')
  })

  it('names only views the app can draw', () => {
    // A patch that asks for a view nobody renders leaves a reader on a blank
    // pane with the switch showing something else. The set is small and it is
    // checked rather than trusted.
    const TIME = new Set(['signal', 'weights'])
    const FREQ = new Set(['spectrum', 'zplane', 'polegrid', 'density', 'butterfly'])
    for (const e of EXPERIMENTS) {
      if (e.patch.timeView) expect(TIME.has(e.patch.timeView), `${e.id} ${e.patch.timeView}`).toBe(true)
      if (e.patch.freqView) expect(FREQ.has(e.patch.freqView), `${e.id} ${e.patch.freqView}`).toBe(true)
    }
  })

  it('opens on the first experiment, with its three registers on screen', () => {
    const h = html()
    const first = EXPERIMENTS[0]
    expect(h).toContain(first.see.slice(0, 40))
    expect(h).toContain(first.try.slice(0, 30))
    expect(h).toContain(first.why.slice(0, 40))
  })

  it('shows the measured readout for the loaded experiment', () => {
    const h = html()
    expect(h).toContain('Measured')
    expect(h).toContain('New Nyquist')
    // The first experiment's new Nyquist is 6 kHz, and the readout prints it.
    expect(h).toMatch(/6kHz/)
  })

  it('prints the rate changer’s reason rather than leaving the response blank', () => {
    const h = html()
    expect(h).toContain('shift-invariant')
  })
})
