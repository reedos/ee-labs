import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { stateText } from '@ee-labs/codes'
import App from './App.jsx'
import { EXPERIMENTS, defaultsOf } from './experiments.js'
import { analyse } from './analysis.js'
import { ChannelPane, CodeTable, DecodePane, EncoderTable, FieldPane, GraphPane, SourcePane } from './components/panes.jsx'
import CurveCanvas from './components/CurveCanvas.jsx'
import GainCanvas from './components/GainCanvas.jsx'
import TannerCanvas from './components/TannerCanvas.jsx'
import TreeCanvas from './components/TreeCanvas.jsx'
import TrellisCanvas from './components/TrellisCanvas.jsx'
import WeightCanvas from './components/WeightCanvas.jsx'

// A passing `vite build` only proves the modules parse. This mounts the real
// component tree, and then every pane of every experiment, so a render-phase
// crash fails here instead of in the browser.
//
// The shell can only be server-rendered at its opening state, so the second
// test does what a reader does instead. It walks all 21 experiments, and for
// each one renders every view that experiment offers against that experiment's
// own analysis. A pane that is offered and cannot draw what it is given fails
// here.

const strip = (h) => h.replace(/<!--\s*-->/g, '')
const html = () => strip(renderToString(React.createElement(App)))

describe('the shell', () => {
  it('renders without throwing, at the first experiment', () => {
    const h = html()
    expect(h).toContain('Information Lab')
    expect(h).toContain('Entropy, capacity, and the codes that reach them')
  })

  it('opens on A1, with its note, its knobs and its terms', () => {
    const h = html()
    expect(h).toContain(EXPERIMENTS[0].name)
    expect(h).toContain('Knobs')
    expect(h).toContain('Terms')
    expect(h).toContain('Deeper')
    expect(h).toContain(`1 of ${EXPERIMENTS.length}`)
  })

  it('lists all six groups in the sidebar, each with experiments under it', () => {
    const h = html()
    for (const g of new Set(EXPERIMENTS.map((e) => e.group))) expect(h, g).toContain(g.split(' · ')[1])
    expect(h).toContain('Coding gain measured')
    // Every group is built now, so nothing in the sidebar waits on another lab.
    expect(h).not.toContain('waits on the Communications Lab')
    expect(new Set(EXPERIMENTS.map((e) => e.group)).size).toBe(6)
  })
})

/** The pane each view name draws, given one experiment's analysis. */
const paneOf = (view, x) => {
  if (view === 'source') return <SourcePane x={x} />
  if (view === 'channel') return <ChannelPane x={x} />
  if (view === 'decode') return <DecodePane x={x} />
  if (view === 'field') return <FieldPane x={x} />
  if (view === 'curve') return <CurveCanvas curve={x.curve} />
  if (view === 'gain')
    return (
      <GainCanvas
        curve={x.gain.curve}
        target={x.gain.target}
        limits={[{ ebN0Db: x.gain.limitDb, label: 'limit' }]}
        marks={x.gain.crossoverDb ? [{ ebN0Db: x.gain.crossoverDb, ber: x.gain.crossoverBer, label: 'cross' }] : []}
        gain={x.gain.real === undefined ? null : { real: x.gain.real, coded: x.gain.atCoded, uncoded: x.gain.atUncoded }}
      />
    )
  if (view === 'tree') return <TreeCanvas code={x.source.code} arith={x.source.arith} />
  if (view === 'weights') {
    if (x.block) return <WeightCanvas weights={x.block.weights || []} d={x.block.d} t={x.block.t} detect={x.block.detect} />
    if (x.gain && x.gain.weights) return <WeightCanvas weights={x.gain.weights} d={x.gain.d} t={x.gain.t} detect={x.gain.detect} />
    if (x.gain && x.gain.spectrumA) return <WeightCanvas weights={x.gain.spectrumA} d={x.gain.dFree} />
    return <WeightCanvas weights={(x.conv.spectrum || { a: [] }).a} d={x.conv.dfree} />
  }
  if (view === 'table') return x.block ? <CodeTable x={x} /> : x.conv ? <EncoderTable x={x} /> : <GraphPane x={x} />
  if (view === 'trellis')
    return <TrellisCanvas states={Array.from({ length: x.conv.enc.states }, (_, s) => stateText(x.conv.enc, s))} steps={x.conv.viterbi.steps} path={x.conv.viterbi.path} />
  if (view === 'tanner') {
    const it = x.ldpc.bp && x.ldpc.bp.iterations.length ? x.ldpc.bp.iterations[0] : null
    return <TannerCanvas graph={x.ldpc.graph} beliefs={it ? it.toVar : null} bits={it ? it.bits : x.ldpc.received} />
  }
  throw new Error(`no pane for view ${view}`)
}

describe('every pane of every experiment', () => {
  it('renders, at that experiment’s own defaults', () => {
    let panes = 0
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const x = analyse(e, p)
      for (const view of e.views) {
        const out = renderToString(paneOf(view, x))
        expect(out.length, `${e.id} ${view}`).toBeGreaterThan(0)
        panes++
      }
    }
    expect(panes).toBeGreaterThanOrEqual(EXPERIMENTS.length * 2)
  })

  it('renders the panes an experiment offers after a knob has moved', () => {
    // A pane fed stale state is the defect this catches: the analysis is
    // rebuilt at the new setting, and every view of it has to draw again.
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      for (const k of e.params) {
        const moved = { ...p, [k.key]: k.kind === 'choice' ? k.options[k.options.length - 1].value : k.max }
        const x = analyse(e, moved)
        if (x.refusal) continue
        for (const view of e.views) expect(renderToString(paneOf(view, x)).length, `${e.id} ${view} at ${k.key}`).toBeGreaterThan(0)
      }
    }
  })
})
