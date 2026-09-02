import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import App, { termsFresh, flowNodes, FLOW_BUDGET } from './App.jsx'
import { termsFor } from './terms.js'
import { EXPERIMENTS, GROUPS, GROUP_INTROS, TRACES, VIEWS, byId, defaultsOf, offeredTraces } from './experiments.js'
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
      expect(offeredTraces(e).length, e.id).toBeLessThanOrEqual(4)
    }
  })
  it('the top bar’s strip fits beside the meters at 1366 px: mode and outcome inside FLOW_BUDGET, the name the only chip that gives way', () => {
    // On the step-8 walk the outcome chip was scrolled out of view for twelve
    // of the twenty-two at 1366 and 1440 wide. verify.mjs §10b measures it in
    // pixels; this holds the text to the budget that measurement set.
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const f = flowNodes(e, p, analyse(e, p))
      expect(f.mid.length, `${e.id} mid "${f.mid}"`).toBeLessThanOrEqual(FLOW_BUDGET.mid)
      expect(`${f.out} ${f.outSub}`.length, `${e.id} out "${f.out} ${f.outSub}"`).toBeLessThanOrEqual(FLOW_BUDGET.out)
      if (f.mode) expect(f.mode.length, `${e.id} mode "${f.mode}"`).toBeLessThanOrEqual(FLOW_BUDGET.mid)
    }
    const html = render('c1')
    const name = html.match(/<span class="flow-node is-name"[^>]*>(.*?)<\/span>/)
    expect(name, 'the name chip').toBeTruthy()
    expect(name[1]).not.toContain('<em>')
  })
  it('every trace pill offered is a waveform the circuit has (found on the step-8 walk: B1–B8 offered v_in, v_rect, v_D and i_R)', () => {
    for (const e of EXPERIMENTS) {
      const x = analyse(e, defaultsOf(e.id))
      for (const t of offeredTraces(e)) expect(x.wf.sig[t], `${e.id} offers ${t}`).toBeDefined()
      expect(offeredTraces(e), e.id).toEqual([...new Set(offeredTraces(e))])
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
    // The experiments section's cap is the row of group tabs, with the
    // heading's name kept for a screen reader.
    const cap = '<h2 class="picker-cap" data-role="experiments-cap"><span class="sr-only">Experiments</span>'
    expect(at(cap)).toBeGreaterThan(-1)
    expect(at('role="tablist"')).toBeGreaterThan(at(cap))
    expect(at('data-role="note"')).toBeGreaterThan(at(cap))
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

describe('a path through the material (§11.5, §11.3.3–5)', () => {
  it('the top bar says where you are — "n of 20" and the group — with a next and a previous (§11.5.2)', () => {
    EXPERIMENTS.forEach((e, i) => {
      const t = topbar(render(e.id))
      const pos = t.match(/data-role="position"[^>]*>(.*?)<\/span>/)
      expect(pos, `${e.id}: no position`).toBeTruthy()
      expect(text(pos[1])).toMatch(new RegExp(`${i + 1} of ${EXPERIMENTS.length}`))
      expect(text(pos[1].replace(/&amp;/g, '&'))).toContain(e.group)
      const next = t.match(/<button[^>]*data-role="next"[^>]*>/)
      const prev = t.match(/<button[^>]*data-role="prev"[^>]*>/)
      expect(next, `${e.id}: no next`).toBeTruthy()
      expect(prev, `${e.id}: no previous`).toBeTruthy()
      expect(/disabled/.test(next[0]), `${e.id}: next disabled`).toBe(i === EXPERIMENTS.length - 1)
      expect(/disabled/.test(prev[0]), `${e.id}: previous disabled`).toBe(i === 0)
      if (i + 1 < EXPERIMENTS.length) expect(next[0]).toContain(EXPERIMENTS[i + 1].name.replace(/"/g, '&quot;'))
    })
  })
  it('the first experiment says "Start here", and each group’s first experiment shows the group’s intro (§11.5.3)', () => {
    const h = sidebar(render(EXPERIMENTS[0].id))
    const start = h.match(/<button[^>]*class="preset is-on"[^>]*>[\s\S]*?<\/button>/)[0]
    expect(start).toContain('Start here')
    // On that one button and no other, from wherever the lab is looked at.
    expect(sidebar(render('b3')).match(/Start here/g)).toHaveLength(1)
    expect(sidebar(render('b3')).match(/data-id="a1"[^>]*>[^<]*<span class="start-here">Start here/)).toBeTruthy()
    for (const g of GROUPS) {
      const first = EXPERIMENTS.find((e) => e.group === g)
      const s = sidebar(render(first.id))
      const intro = s.match(/data-role="group-intro"[^>]*>([\s\S]*?)<\/p>/)
      expect(intro, `${first.id}: no intro for ${g}`).toBeTruthy()
      expect(text(intro[1].replace(/&amp;/g, '&')).replace(/\s+/g, ' ').trim()).toBe(GROUP_INTROS[g])
      // The intro sits above the group's experiments.
      expect(s.indexOf('data-role="group-intro"')).toBeLessThan(s.indexOf(`data-id="${first.id}"`))
    }
    // Deeper in a group the intro has been read, and the fold needs the lines.
    expect(sidebar(render('b3'))).not.toContain('data-role="group-intro"')
  })
  it('every note ends with where it leads, as a link the top-bar button is not (§11.5.4)', () => {
    EXPERIMENTS.forEach((e, i) => {
      const s = sidebar(render(e.id))
      const link = s.match(/<button[^>]*data-role="next-link"[^>]*>/)
      if (i + 1 === EXPERIMENTS.length) {
        expect(link, `${e.id}: the last experiment links on`).toBeNull()
        return
      }
      expect(link, `${e.id}: no next link`).toBeTruthy()
      expect(link[0]).toContain(`data-target="${EXPERIMENTS[i + 1].id}"`)
      expect(s.indexOf('data-role="next-link"')).toBeGreaterThan(s.indexOf('data-role="note"'))
      expect(s.indexOf('data-role="next-link"')).toBeLessThan(s.indexOf('<h2>Schematic'))
    })
  })
  it('the try line is its own element under the note, with the knob as a chip that names it (§11.3.5)', () => {
    for (const e of EXPERIMENTS) {
      const s = sidebar(render(e.id))
      const tr = s.match(/<p class="try"[^>]*data-role="try"[^>]*>([\s\S]*?)<\/p>/)
      expect(tr, `${e.id}: no try element`).toBeTruthy()
      const knob = e.params.find((p) => p.key === e.try.knob)
      expect(tr[1]).toMatch(new RegExp(`<button[^>]*class="knob-chip"[^>]*data-knob="${e.try.knob}"[^>]*>${knob.label.replace(/_/g, '_')}<`))
      expect(text(tr[1])).toContain(e.try.text.slice(0, 20))
      expect(s.indexOf('data-role="try"')).toBeGreaterThan(s.indexOf('data-role="note"'))
      expect(s.indexOf('data-role="try"')).toBeLessThan(s.indexOf('<h2>Schematic'))
      // Every knob is addressable, so the chip can focus it.
      for (const p of e.params) expect(s, `${e.id}: knob ${p.key}`).toContain(`data-knob="${p.key}"`)
    }
  })
  it('the about knob carries its chips, labelled in the knob’s units (§11.5.5)', () => {
    for (const e of EXPERIMENTS) {
      const s = sidebar(render(e.id)).slice(sidebar(render(e.id)).indexOf('<h2>Knobs</h2>'))
      const from = s.indexOf(`data-knob="${e.about}"`)
      const to = s.indexOf('data-knob=', from + 10)
      const first = s.slice(from, to < 0 ? undefined : to)
      const chips = first.match(/class="chip[^"]*"/g) || []
      expect(chips.length, `${e.id}: ${chips.length} chips on ${e.about}`).toBe(e.chips.length)
      expect(first, `${e.id}: the default chip is on`).toContain('class="chip is-on"')
      const k = e.params[0]
      if (k.percent) expect(first).toMatch(/>\d+(\.\d)? %</)
      else if (k.unit === '°') expect(first).toMatch(/>\d+°</)
      else expect(first).toMatch(new RegExp(`>[0-9.]+ [nµmkMG]?${k.unit}<`))
    }
  })
  it('the retired note gets a way back: a reset chip beside it (§11.5.6)', () => {
    const moved = { ...defaultsOf('b3'), fs: 400e3 }
    const h = sidebar(renderToString(React.createElement(App, { initialId: 'b3', initialParams: moved })).replace(/<!--\s*-->/g, ''))
    expect(h).toContain('data-pristine="false"')
    expect(h).toMatch(/<button[^>]*data-role="reset"/)
    expect(sidebar(render('b3'))).not.toContain('data-role="reset"')
  })
  it('the header says what the lab is for, in three sentences a newcomer can use (§11.3.3)', () => {
    const h = sidebar(render('a1'))
    const sub = h.match(/<p class="sub">([\s\S]*?)<\/p>/)
    expect(text(sub[1]).replace(/\s+/g, ' ').trim()).toBe('Pick an experiment. Turn the knob it names. Watch the number the note promised.')
    expect(text(sub[1])).not.toMatch(/steady state|engine/)
  })
  it('the terms line names its terms, in the accent on an experiment’s first visit (§11.3.4)', () => {
    for (const e of EXPERIMENTS) {
      if (!e.terms.length) continue
      const s = sidebar(render(e.id))
      const d = s.match(/<details class="terms is-fresh"[^>]*><summary>([\s\S]*?)<\/summary>/)
      expect(d, `${e.id}: no fresh terms line`).toBeTruthy()
      for (const t of termsFor(e.terms)) expect(text(d[1]), e.id).toContain(t.name)
    }
    expect(termsFresh(new Set(['a1']), 'a1')).toBe(false)
    expect(termsFresh(new Set(['a1']), 'a2')).toBe(true)
  })
})
