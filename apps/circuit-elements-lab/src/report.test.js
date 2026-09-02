import { describe, it, expect } from 'vitest'
import { reportSummary } from './report.js'
import { EXPERIMENTS, defaultsOf } from './experiments.js'

// Circuit Lab's first real report lacked the row that named the circuit, and
// its probe passed because it counted rows instead of reading them. Every row
// is read here, for every experiment.

describe('the report summary', () => {
  it('names the experiment, with its id, for every experiment in the lab', () => {
    for (const e of EXPERIMENTS) {
      const s = reportSummary({ id: e.id, params: defaultsOf(e.id), show: e.show, view: e.view, outcome: 'solved' })
      expect(s.Experiment).toBe(`${e.id.toUpperCase()} · ${e.name}`)
      expect(s.Group).toBe(e.group)
    }
  })

  it('never yields undefined, NaN, an empty row or [object Object]', () => {
    for (const e of EXPERIMENTS) {
      for (const view of e.views) {
        const s = reportSummary({
          id: e.id,
          params: defaultsOf(e.id),
          show: e.show,
          view,
          outcome: 'current in = current out at every node (KCL), largest imbalance 1.2e-16 A',
        })
        for (const [k, v] of Object.entries(s)) {
          expect(String(v), `${e.id}/${view} → ${k}`).not.toMatch(/undefined|NaN|\[object Object\]/)
          expect(String(v).trim(), `${e.id}/${view} → ${k}`).not.toBe('')
        }
      }
    }
  })

  it('lists every knob by key and value', () => {
    const s = reportSummary({ id: 'b1', params: defaultsOf('b1'), show: 'i', view: 'equations', outcome: 'solved' })
    expect(s.Settings).toMatch(/E = 12/)
    expect(s.Settings).toMatch(/R3 = 3000/)
  })

  it('names a toggle knob’s position rather than printing a boolean (F6 crashed the app on this)', () => {
    const off = reportSummary({ id: 'f6', params: defaultsOf('f6'), show: 'v', view: 'scope', outcome: 'solved' })
    expect(off.Settings).toMatch(/ideal = finite R_off/)
    const on = reportSummary({ id: 'f6', params: { ...defaultsOf('f6'), ideal: true }, show: 'v', view: 'scope', outcome: 'refused' })
    expect(on.Settings).toMatch(/ideal = ideal/)
    expect(on.Settings).not.toMatch(/true|false/)
  })

  it('reports the cursor time for a dynamic experiment, and no cursor row for a DC one', () => {
    const dyn = reportSummary({ id: 'f3', params: defaultsOf('f3'), show: 'v', view: 'scope', outcome: 'solved', cursor: 0.0025 })
    expect(dyn.Cursor).toBe('t = 0.0025 s') // two significant figures, as every other setting
    const dc = reportSummary({ id: 'b1', params: defaultsOf('b1'), show: 'i', view: 'equations', outcome: 'solved', cursor: null })
    expect(dc.Cursor).toBeUndefined()
  })

  it('says what the schematic shows in words', () => {
    const base = { id: 'b1', params: defaultsOf('b1'), view: 'equations', outcome: 'solved' }
    expect(reportSummary({ ...base, show: 'p' })['Schematic shows']).toBe('powers')
    expect(reportSummary({ ...base, show: 'none' })['Schematic shows']).toBe('no readings')
  })

  it('carries the refusal through as the outcome', () => {
    const s = reportSummary({ id: 'e3', params: defaultsOf('e3'), show: 'v', view: 'equations', outcome: 'refused: opamp-open-loop' })
    expect(s.Outcome).toBe('refused: opamp-open-loop')
  })

  it('survives an unknown experiment rather than throwing', () => {
    const s = reportSummary({ id: 'nope', params: {}, show: 'i', view: 'x', outcome: '' })
    expect(s.Experiment).toBe('nope')
  })
})
