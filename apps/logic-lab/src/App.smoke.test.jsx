import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import App from './App.jsx'
import { EXPERIMENTS, VIEW_LABELS, bussesOf, defaultsOf, signalsOf } from './experiments.js'
import { analyse } from './analysis.js'
import { EventTable, KarnaughMap, PathList, RatePane, Refusal, TruthTable } from './components/panes.jsx'
import GateCanvas from './components/GateCanvas.jsx'
import StateCanvas from './components/StateCanvas.jsx'
import TimingCanvas from './components/TimingCanvas.jsx'

// A passing `vite build` only proves the modules parse. This mounts the real
// component tree, and then every pane of every experiment, so a render-phase
// crash fails here instead of in the browser.
//
// The shell can only be server-rendered at its opening state, so the second
// test does what a reader does instead. It walks all 45 experiments, and for
// each one renders every view that experiment offers, against that
// experiment's own analysis. A pane that is offered and cannot draw what it is
// given fails here.

const strip = (h) => h.replace(/<!--\s*-->/g, '')
const html = () => strip(renderToString(React.createElement(App)))

describe('the shell', () => {
  it('renders without throwing, at the first experiment', () => {
    const h = html()
    expect(h).toContain('Logic Lab')
    expect(h).toContain('Gate diagram')
    expect(h).toContain('Analysis')
  })

  it('opens on A1, with its note, its knobs and its terms', () => {
    const h = html()
    expect(h).toContain(EXPERIMENTS[0].name)
    expect(h).toContain('Knobs')
    expect(h).toContain('Terms')
    expect(h).toContain('Deeper')
    expect(h).toContain(`1 of ${EXPERIMENTS.length}`)
  })

  it('lists all eight groups in the sidebar', () => {
    const h = html()
    for (const g of new Set(EXPERIMENTS.map((e) => e.group))) expect(h, g).toContain(g.split(' · ')[1])
  })
})

/** The pane each view name draws, given one experiment's analysis. */
const paneOf = (view, x, e, p) => {
  if (view === 'timing') return <TimingCanvas res={x.res} signals={signalsOf(e, p)} busses={bussesOf(e, p)} cursor={0} />
  if (view === 'gates') return <GateCanvas x={x} />
  if (view === 'table') return <TruthTable x={x} />
  if (view === 'kmap') return <KarnaughMap x={x} />
  if (view === 'paths') return <PathList x={x} />
  if (view === 'rate') return <RatePane x={x} />
  if (view === 'events') return <EventTable x={x} />
  if (view === 'state') return x.fsm ? <StateCanvas states={x.fsm.table.states} edges={x.fsm.table.rows.map((r) => ({ from: r.state, to: r.next, label: 'x', out: r.out }))} /> : null
  throw new Error(`no pane draws the view "${view}"`)
}

describe('every pane of every experiment', () => {
  it('draws what its own experiment gives it, in all 45 of them', () => {
    let drawn = 0
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const x = analyse(e, p)
      for (const view of e.views) {
        expect(VIEW_LABELS[view], `${e.id} offers ${view}`).toBeDefined()
        const el = paneOf(view, x, e, p)
        expect(el, `${e.id} ${view}`).not.toBeNull()
        const h = strip(renderToString(el))
        expect(h.length, `${e.id} ${view} drew nothing`).toBeGreaterThan(0)
        drawn++
      }
    }
    expect(drawn).toBeGreaterThanOrEqual(EXPERIMENTS.length * 3)
  })

  it('renders the refusal an experiment expects, as content rather than as a failure', () => {
    for (const e of EXPERIMENTS.filter((x) => x.expects)) {
      const x = analyse(e, defaultsOf(e.id))
      const h = strip(renderToString(<Refusal refusal={x.refusal} />))
      expect(h, e.id).toContain(x.refusal.code)
      expect(h, e.id).toContain('latch')
    }
  })

  it('prints the rate model’s assumptions wherever the rate pane is offered', () => {
    const rated = EXPERIMENTS.filter((e) => e.views.includes('rate'))
    expect(rated.length).toBeGreaterThan(0)
    for (const e of rated) {
      const x = analyse(e, defaultsOf(e.id))
      const h = strip(renderToString(<RatePane x={x} />))
      for (const a of x.rate.assumptions) expect(h, `${e.id}: ${a}`).toContain(a)
      expect(h, e.id).toContain('MTBF')
    }
  })
})
