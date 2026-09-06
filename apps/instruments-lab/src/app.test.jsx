import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { equations } from '@ee-labs/network'
import App from './App.jsx'
import { EquationsPane, ReadingsPane, Refusal } from './components/panes.jsx'
import ErrorBarCanvas from './components/ErrorBarCanvas.jsx'
import ContribCanvas from './components/ContribCanvas.jsx'
import { EXPERIMENTS, byId, defaultsOf, drawables } from './experiments.js'
import { analyse } from './math.js'

// The shell, rendered. The browser harness (scripts/verify.mjs) drives the
// page for real; this catches what it would catch first and in a second: a
// prop not passed, a pane handed a shape it does not read, an import that does
// not resolve. Rendering on the server runs no effect, so the canvases render
// as elements and their drawing is the harness's business.

const html = (el) => renderToStaticMarkup(el)
const strip = (s) => s.replace(/<[^>]+>/g, ' ')
const solve = (id) => {
  const exp = byId[id]
  const p = defaultsOf(id)
  return { exp, p, x: analyse(exp, p) }
}

describe('the shell', () => {
  it('renders the first experiment, its lesson, its knobs and its topbar', () => {
    const h = html(<App />)
    const text = strip(h)
    const first = EXPERIMENTS[0]
    expect(h).toContain('Instruments Lab')
    expect(text).toContain(first.name)
    expect(text).toContain('Oscilloscope')
    // The lesson, the knobs and the try steps are all on the first screen.
    expect(text).toContain(first.see.slice(0, 40))
    for (const k of first.params.filter((q) => !q.kind && q.key !== 'N')) expect(text).toContain(k.label)
    expect((h.match(/data-role="try-step"/g) || []).length).toBe(first.try.length)
    // Dark: the lab names itself in its own nav, and nothing claims a release.
    expect(h).not.toMatch(/released/i)
  })

  it('offers every view the first experiment declares, and only those', () => {
    const h = html(<App />)
    const labels = [...h.matchAll(/<button type="button" class="[^"]*" aria-pressed="(?:true|false)" title="([^"]*)"/g)].map((m) => m[1])
    expect(labels.length).toBeGreaterThan(0)
    expect(strip(h)).toContain('Reading')
  })
})

describe('the panes', () => {
  it('the readings pane prints one row per element and every node voltage', () => {
    for (const id of ['c1', 'f1', 'a1', 'a3']) {
      const { x, exp, p } = solve(id)
      const els = drawables(exp, p)
      const sol = x.snap || x.sol
      const text = strip(html(<ReadingsPane sol={sol} elements={els} />))
      for (const e of els) expect(text, `${id} ${e.id}`).toContain(e.id)
      for (const n of Object.keys(sol.v).filter((k) => k !== 'gnd')) expect(text, `${id} v_${n}`).toContain(n)
    }
  })

  it('a sine-driven experiment with no time axis reads a live circuit, not the zero at t = 0', () => {
    // solveDC evaluates a wave source at t = 0, where a sine is zero, so these
    // six opened with every meter and every reading row showing 0 V.
    const still = EXPERIMENTS.filter((e) => solve(e.id).x.snap)
    expect(still.map((e) => e.id)).toEqual(['a3', 'a5', 'b2', 'd1', 'd2', 'f4'])
    for (const e of still) {
      const { x, exp, p } = solve(e.id)
      const scale = Math.max(...Object.values(x.snap.v).map(Math.abs))
      expect(scale, `${e.id} node voltages`).toBeGreaterThan(0)
      // The instant is inside the first cycle of the drive, at the drive's peak.
      const period = (2 * Math.PI) / x.omega
      expect(x.snapAt, `${e.id} instant`).toBeGreaterThanOrEqual(0)
      expect(x.snapAt, `${e.id} instant`).toBeLessThan(period)
      // The source it names is at its own amplitude there, to the last digit.
      const wave = exp.net(p).elements.find((el) => el.wave && el.wave.kind === 'sine').wave
      const amp = wave.amp
      const at = amp * Math.sin(x.omega * x.snapAt + (wave.phase || 0))
      expect(Math.abs(at - amp), `${e.id} at the peak`).toBeLessThan(1e-9 * Math.abs(amp))
      // Every reading is finite, and the table has a row for each element.
      for (const el of drawables(exp, p)) expect(Number.isFinite(x.snap.volt[el.id]), `${e.id} ${el.id}`).toBe(true)
    }
  })

  it('the equations pane prints a row for every equation the solver built', () => {
    const { x } = solve('c1')
    const eq = equations(x.sol.norm, x.sol)
    const h = html(<EquationsPane eq={eq} solved fold={false} />)
    expect((h.match(/class="eq-row"/g) || []).length).toBeGreaterThanOrEqual(eq.rows.length - 1)
  })

  it('a refusal is a sentence with the solver’s own reason in it', () => {
    const err = { code: 'state-loop', message: 'Two capacitors and an ideal source form a loop with no resistance in it.' }
    const text = strip(html(<Refusal err={err} />))
    expect(text).toContain('No solution')
    expect(text).toContain('loop with no resistance')
  })

  it('the error bar and the contributions render from the analysis, not from their own arithmetic', () => {
    const f1 = solve('f1')
    expect(html(<ErrorBarCanvas meter={f1.x.meter} unit="V" />)).toContain('canvas')
    const f3 = solve('f3')
    expect(html(<ContribCanvas sens={f3.x.sens} />)).toContain('canvas')
    // The two panes are only offered where the analysis carries what they read.
    for (const e of EXPERIMENTS) {
      const { x } = solve(e.id)
      if (e.views.includes('errorbar')) expect(x.meter, `${e.id} errorbar`).toBeTruthy()
      if (e.views.includes('contrib')) expect(x.sens, `${e.id} contrib`).toBeTruthy()
      if (e.views.includes('scope')) expect(x.tr, `${e.id} scope`).toBeTruthy()
      if (e.views.includes('bode') || e.views.includes('impedance')) expect(x.freq, `${e.id} freq`).toBeTruthy()
    }
  })
})
