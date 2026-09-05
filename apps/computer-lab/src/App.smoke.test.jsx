import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import App, { Pane } from './App.jsx'
import { EXPERIMENTS, VIEW_LABELS, defaultsOf } from './experiments.js'
import { analyse } from './analysis.js'

// A passing `vite build` only proves the modules parse. This mounts the real
// component tree, and then every pane of every experiment, so a render-phase
// crash fails here instead of in the browser.
//
// The shell can only be server-rendered at its opening state, so the second
// test does what a reader does instead. It walks all thirty experiments, and
// for each one renders its own first pane and every view it offers, against
// that experiment's own analysis. A pane that is offered and cannot draw what
// it is given fails here.

const strip = (h) => h.replace(/<!--\s*-->/g, '')
const html = () => strip(renderToString(React.createElement(App)))

describe('the shell', () => {
  it('renders without throwing, at the first experiment', () => {
    const h = html()
    expect(h).toContain('Computer Lab')
    expect(h).toContain('Analysis')
    expect(h).toContain('Knobs')
  })

  it('opens on A1, with its note, its terms and its readings', () => {
    const h = html()
    expect(h).toContain(EXPERIMENTS[0].name)
    expect(h).toContain('Terms')
    expect(h).toContain('Deeper')
    expect(h).toContain(`1 of ${EXPERIMENTS.length}`)
  })

  it('lists all seven groups in the sidebar', () => {
    const h = html()
    for (const g of new Set(EXPERIMENTS.map((e) => e.group))) expect(h, g).toContain(g.split(' · ')[1])
  })
})

describe('every pane of every experiment', () => {
  it('draws what its own experiment gives it, in all thirty of them', () => {
    let drawn = 0
    for (const e of EXPERIMENTS) {
      let here = 0
      const p = defaultsOf(e.id)
      const x = analyse(e, p)
      const cursor = p.cycle ?? p.step ?? 0
      for (const view of new Set([e.main, ...e.views])) {
        expect(VIEW_LABELS[view], `${e.id} offers ${view}`).toBeDefined()
        const el = <Pane which={view} x={x} exp={e} params={p} cursor={cursor} />
        const h = strip(renderToString(el))
        expect(h.length, `${e.id} ${view} drew nothing`).toBeGreaterThan(0)
        drawn++
        here++
      }
      // Every experiment offers its own first pane and at least one other, so
      // a reader always has a second way to look at the same run.
      expect(here, `${e.id} draws more than one pane`).toBeGreaterThanOrEqual(2)
    }
    expect(drawn).toBeGreaterThanOrEqual(EXPERIMENTS.length * 2)
  })

  it('names a pane it has no drawing for, rather than drawing nothing', () => {
    const e = EXPERIMENTS[0]
    const x = analyse(e, defaultsOf(e.id))
    expect(() => renderToString(<Pane which="nonesuch" x={x} exp={e} params={defaultsOf(e.id)} />)).toThrow(/no pane draws/)
  })

  it('says so where an experiment offers no run for a pane to draw', () => {
    // Group A has no program, so its datapath pane has nothing to draw. The
    // pane says which, rather than rendering an empty box.
    const e = EXPERIMENTS[0]
    const x = analyse(e, defaultsOf(e.id))
    const h = strip(renderToString(<Pane which="datapath" x={x} exp={e} params={defaultsOf(e.id)} />))
    expect(h).toContain('no run')
  })
})
