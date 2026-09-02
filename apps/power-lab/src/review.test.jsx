import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import App from './App.jsx'
import { EXPERIMENTS, GROUPS, TRACES, VIEWS, byId, defaultsOf } from './experiments.js'
import { analyse } from './analysis.js'
import { scopeRange } from './format.js'

// The 2026-09-02 review's bar (POWER_LAB_PLAN.md §11), one test per complaint.
// Each was written against the build the review looked at and watched fail
// there, so it restates the complaint rather than a proxy for it — a green
// suite had said nothing about any of these.

const render = (id, view) =>
  renderToString(React.createElement(App, { initialId: id, initialView: view || null })).replace(/<!--\s*-->/g, '')
const text = (h) => h.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ')
const topbar = (h) => h.slice(h.indexOf('class="topbar"'), h.indexOf('<main'))
const sidebar = (h) => h.slice(0, h.indexOf('class="topbar"'))

describe('the math is a view, not a fold at the bottom of the sidebar (§11.3.1)', () => {
  it('every experiment offers a Math view in the Analysis pane', () => {
    expect(VIEWS.math).toBeTruthy()
    for (const e of EXPERIMENTS) expect(e.views, e.id).toContain('math')
  })
  it('renders the math for every experiment, with formulas in it', () => {
    for (const e of EXPERIMENTS) {
      const h = render(e.id, 'math')
      expect(h, e.id).toContain('math-formula')
      expect(h, e.id).not.toMatch(/undefined|NaN/)
    }
  }, 120000)
  it('the sidebar no longer carries the math toggle', () => {
    expect(sidebar(render('b1'))).not.toContain('math-toggle')
  })
})

describe('the lower pane is called Analysis, as in Circuit Elements Lab (§11.3.8)', () => {
  it('names the pane Analysis and never Underneath', () => {
    const h = render('a1')
    expect(h).toContain('<h2>Analysis</h2>')
    expect(h).not.toContain('Underneath')
  })
})

describe('no visible surface shows a group letter (§11.5.1)', () => {
  it('group names, the note title and the top bar carry names, not letters', () => {
    for (const g of GROUPS) expect(g).not.toMatch(/^[A-N] · /)
    for (const e of EXPERIMENTS) {
      const t = text(render(e.id))
      const hit = t.match(/\b[A-N]\d\b/)
      expect(hit && hit[0], `${e.id}: "${hit && hit[0]}"`).toBeFalsy()
    }
  }, 60000)
})

describe('the first screen shows the loss, not three flat lines (§11.4.2, §11.6.5)', () => {
  it('A1 declares its scope silent and renders no scope; every other experiment renders one', () => {
    expect(byId.a1.scope).toBe(false)
    expect(render('a1')).not.toContain('aria-label="Scope')
    for (const e of EXPERIMENTS.filter((e) => e.id !== 'a1')) expect(render(e.id), e.id).toContain('aria-label="Scope')
  }, 60000)
  it('A1 opens on its losses, full height', () => {
    const h = render('a1')
    expect(h).toContain('is-single')
    expect(h).toContain('power-row')
  })
})

describe('no screen contradicts its note (§11.0 claim bugs)', () => {
  it('every experiment declares its headline meter, and A2’s is RMS against the mean, not η', () => {
    for (const e of EXPERIMENTS) expect(['eta', 'pf', 'rms'], e.id).toContain(e.headline)
    expect(byId.a2.headline).toBe('rms')
    const t = text(topbar(render('a2')))
    expect(t).toMatch(/7\.75/)
    expect(t).toMatch(/5\.00/)
    expect(t).not.toMatch(/100/)
    expect(t).not.toMatch(/η/)
  })
  it('K and K_crit wait for the experiment that teaches them: not on A3, present from B4 on', () => {
    expect(text(topbar(render('a3')))).not.toMatch(/K\s*=/)
    expect(text(topbar(render('b1')))).not.toMatch(/K\s*=/)
    expect(text(topbar(render('b4')))).toMatch(/K\s*=/)
    expect(text(topbar(render('b5')))).toMatch(/K_crit/)
  })
  it('C2 opens on the peak it is about: D = 0.9, M = 5.00, η = 50 %', () => {
    const d = defaultsOf('c2')
    expect(d.D).toBeCloseTo(0.9, 12)
    const x = analyse(byId.c2, d)
    expect(x.m.M).toBeCloseTo(5, 2)
    expect(x.m.eta).toBeCloseTo(0.5, 3)
  })
  it('a note that points at "this group" has somewhere in the group to point', () => {
    for (const e of EXPERIMENTS) {
      if (!/rest of this group/.test(e.note)) continue
      const later = EXPERIMENTS.filter((o) => o.group === e.group && EXPERIMENTS.indexOf(o) > EXPERIMENTS.indexOf(e))
      expect(later.length, `${e.id} says "the rest of this group" and is last in it`).toBeGreaterThan(0)
    }
  })
})

describe('the opening traces show the claim (§11.6.7)', () => {
  it('every signal a note names is on the scope when the experiment opens', () => {
    const labels = Object.fromEntries(Object.entries(TRACES).map(([k, t]) => [t.label, k]))
    for (const e of EXPERIMENTS) {
      for (const m of e.note.matchAll(/\b[vi]_[A-Za-z]+/g)) {
        const key = labels[m[0]]
        if (key) expect(e.traces, `${e.id} names ${m[0]}`).toContain(key)
      }
    }
  })
  it('A3 opens on the output alone, so its 3.65 mV is the whole frame; B3 likewise', () => {
    for (const id of ['a3', 'b3']) {
      const e = byId[id]
      const x = analyse(e, defaultsOf(id))
      const volts = e.traces.filter((k) => TRACES[k].axis === 'V')
      expect(volts, id).toEqual(['vout'])
      const [lo, hi] = scopeRange(x.wf, x.wf, volts)
      expect(x.m.sig.vout.pp / (hi - lo), `${id}: ripple as a share of the frame`).toBeGreaterThanOrEqual(0.15)
    }
  })
  it('C4 opens with i_in on the scope, since the note says to watch it', () => {
    expect(byId.c4.traces).toContain('iin')
  })
  it('Group A does not offer the twelve-chip trace bar', () => {
    for (const e of EXPERIMENTS.filter((e) => e.group === GROUPS[0])) {
      const offered = e.allTraces || (e.kind === 'buck' ? Object.keys(TRACES) : e.traces)
      expect(offered.length, e.id).toBeLessThanOrEqual(4)
    }
  })
})

describe('the layout gives the lesson the room (§11.4)', () => {
  it('every experiment says which knob it is about, and that knob is first (§11.4.4)', () => {
    for (const e of EXPERIMENTS) {
      expect(typeof e.about, e.id).toBe('string')
      expect(e.params.map((p) => p.key), e.id).toContain(e.about)
      expect(e.params[0].key, `${e.id} opens on ${e.params[0].key}, is about ${e.about}`).toBe(e.about)
    }
  })
  it('shows the first four knobs and folds the rest under More (§11.4.4)', () => {
    for (const e of EXPERIMENTS) {
      const s = sidebar(render(e.id))
      const knobs = s.slice(s.indexOf('<h2>Knobs</h2>'))
      const before = knobs.indexOf('class="more-knobs"')
      const labels = [...knobs.matchAll(/class="num-label"[^>]*>([^<]*)</g)].map((m) => m[1])
      expect(labels[0], e.id).toBe(e.params[0].label)
      if (e.params.length <= 4) expect(before, `${e.id} folds ${e.params.length} knobs`).toBe(-1)
      else {
        expect(before, e.id).toBeGreaterThan(0)
        const shown = [...knobs.slice(0, before).matchAll(/class="num-label"/g)].length
        expect(shown, e.id).toBe(4)
        expect(knobs).toMatch(/<summary[^>]*>More knobs/)
      }
    }
  })
  it('marks one pane primary — the scope when the lesson is in the waveform — and weights it 62 % (§11.4.1)', () => {
    for (const e of EXPERIMENTS) {
      const h = render(e.id)
      const main = h.slice(h.indexOf('<main'))
      if (e.scope === false) {
        expect(main, e.id).not.toContain('is-primary')
        continue
      }
      const primary = [...main.matchAll(/<section class="view([^"]*)"/g)].map((m) => m[1].includes('is-primary'))
      expect(primary.filter(Boolean).length, e.id).toBe(1)
      const scopeFirst = e.primary ? e.primary === 'scope' : e.view === 'measures'
      expect(primary[0], `${e.id}: ${scopeFirst ? 'scope' : 'analysis'} should lead`).toBe(scopeFirst)
      const rows = main.match(/grid-template-rows:([^;"]*)/)[1]
      expect(rows, e.id).toContain(scopeFirst ? 'minmax(0,62fr) 6px minmax(0,38fr)' : 'minmax(0,38fr) 6px minmax(0,62fr)')
      expect(main, e.id).toContain('class="pane-split"')
    }
  })
  it('keeps the sidebar in reading order: experiments, note, schematic, knobs (§11.4.5)', () => {
    const s = sidebar(render('b3'))
    const at = (t) => s.indexOf(t)
    expect(at('<h2>Experiments</h2>')).toBeGreaterThan(-1)
    expect(at('data-role="note"')).toBeGreaterThan(at('<h2>Experiments</h2>'))
    expect(at('<h2>Schematic')).toBeGreaterThan(at('data-role="note"'))
    expect(at('<h2>Knobs</h2>')).toBeGreaterThan(at('<h2>Schematic'))
  })
  it('puts a copy of the schematic at the top of the main column for the phone (§11.4.6)', () => {
    const h = render('b3')
    const main = h.slice(h.indexOf('<main'))
    const sch = main.indexOf('class="sch-phone"')
    expect(sch).toBeGreaterThan(-1)
    expect(sch).toBeLessThan(main.indexOf('<section class="view'))
    expect(main.slice(sch, main.indexOf('<section class="view'))).toContain('class="schematic"')
  })
})
