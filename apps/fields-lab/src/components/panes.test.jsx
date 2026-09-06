import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EXPERIMENTS, byId, defaultsOf } from '../experiments.js'
import { analyse } from '../math.js'
import { mapPropsFor, profilePropsFor } from '../view.js'
import FieldMapCanvas from './FieldMapCanvas.jsx'
import { CircuitPane, FluxPane, MeshPane, NumbersPane } from './panes.jsx'
import { InterfacePane, WavePane } from './wavePanes.jsx'
import { BouncePane, LinePane, SmithPane, SweepPane } from './linePanes.jsx'
import { GuidePane, PatternPane } from './guidePanes.jsx'

// Every view an experiment offers is rendered here, at that experiment's own
// defaults, as markup.
//
// `experiments.test.js` checks that the ANALYSIS a view needs is there.
// This file checks that the component given that analysis produces something,
// which is the failure the other one cannot see: a pane still standing in for a
// group that has since landed would pass every numeric test in the suite and
// show the reader a sentence apologising for itself.

const PANE_OF = {
  numbers: NumbersPane,
  mesh: MeshPane,
  flux: FluxPane,
  circuit: CircuitPane,
  wave: WavePane,
  interface: InterfacePane,
  bounce: BouncePane,
  line: LinePane,
  smith: SmithPane,
  sweep: SweepPane,
  guide: GuidePane,
  pattern: PatternPane,
}

const html = (el) => renderToStaticMarkup(el)

describe('every view an experiment offers renders', () => {
  for (const exp of EXPERIMENTS) {
    it(`${exp.id} ${exp.views.join(', ')}`, () => {
      const p = defaultsOf(exp.id)
      const x = analyse(byId[exp.id], p)
      for (const view of exp.views) {
        let out
        if (view === '2d') out = html(<FieldMapCanvas {...mapPropsFor(exp, p, x)} />)
        else if (view === 'profile') out = html(<FieldMapCanvas mode="profile" profile={profilePropsFor(exp, p, x)} units={{ length: 'm' }} />)
        else {
          const Pane = PANE_OF[view]
          expect(Pane, `${exp.id} offers ${view}, which nothing draws`).toBeDefined()
          out = html(<Pane exp={exp} x={x} p={p} />)
        }
        expect(out.length, `${exp.id} ${view} rendered ${out.length} characters`).toBeGreaterThan(120)
        expect(out, `${exp.id} ${view} is still a stub`).not.toMatch(/not built yet/)
        expect(out, `${exp.id} ${view} shows a NaN`).not.toMatch(/NaN/)
        expect(out, `${exp.id} ${view} shows an undefined`).not.toMatch(/undefined/)
      }
    })
  }
})

describe('a pane asked for something the experiment has not got says so', () => {
  // The panes are reachable only through an experiment that lists their view,
  // so these branches never show a reader anything. They exist so that a group
  // file listing a view its analysis cannot feed fails visibly rather than
  // throwing inside a render.
  const bare = { kind: 'charges', exp: byId.a1, p: {}, headline: { value: 1, unit: '', label: 'nothing' } }
  for (const [view, Pane] of Object.entries(PANE_OF)) {
    it(`${view}`, () => {
      const out = html(<Pane exp={byId.a1} x={bare} p={{}} />)
      expect(typeof out).toBe('string')
    })
  }
})
