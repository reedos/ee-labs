import { describe, it, expect } from 'vitest'
import { reportSummary } from './report.js'
import { EXPERIMENTS, defaultsOf } from './experiments.js'

// Circuit Lab's first real report lacked the row that named the circuit, and
// its probe passed because it counted rows instead of reading them. Every row
// is read here, for every experiment.

describe('the report summary', () => {
  it('names the experiment, with its id, for every experiment in the lab', () => {
    for (const e of EXPERIMENTS) {
      const s = reportSummary({ id: e.id, params: defaultsOf(e.id), traces: e.traces, view: e.view, outcome: 'CCM' })
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
          traces: e.traces,
          view,
          outcome: 'continuous conduction, M = 0.4167, η = 100.00 %',
        })
        for (const [k, v] of Object.entries(s)) {
          expect(String(v), `${e.id}/${view} → ${k}`).not.toMatch(/undefined|NaN|\[object Object\]/)
          expect(String(v).trim(), `${e.id}/${view} → ${k}`).not.toBe('')
        }
      }
    }
  })

  it('lists every knob by key and value', () => {
    const s = reportSummary({ id: 'b6', params: defaultsOf('b6'), traces: ['vsw'], view: 'losses', outcome: 'x' })
    expect(s.Settings).toMatch(/Vf = 0\.5/)
    expect(s.Settings).toMatch(/sync = 0/)
    const r = reportSummary({ id: 'b7', params: defaultsOf('b7'), traces: ['vout'], view: 'losses', outcome: 'x' })
    expect(r.Settings).toMatch(/ESR = 0\.05/)
    expect(r.Settings).toMatch(/Ron = 0\.05/)
    expect(r.Settings).toMatch(/RL = 0\.03/)
  })

  it('says which traces the scope shows, by their labels, and names the pane', () => {
    const s = reportSummary({ id: 'b1', params: defaultsOf('b1'), traces: ['vL', 'iL'], view: 'balance', outcome: 'x' })
    expect(s['Scope shows']).toBe('v_L, i_L')
    expect(s['Lower pane']).toBe('Balance')
    expect(reportSummary({ id: 'b1', params: {}, traces: [], view: 'balance', outcome: 'x' })['Scope shows']).toBe('no traces')
  })

  it('carries the outcome through', () => {
    const s = reportSummary({ id: 'b4', params: defaultsOf('b4'), traces: ['iL'], view: 'sweep', outcome: 'discontinuous conduction, M = 0.7098' })
    expect(s.Outcome).toBe('discontinuous conduction, M = 0.7098')
  })

  it('survives an unknown experiment rather than throwing', () => {
    const s = reportSummary({ id: 'nope', params: {}, traces: [], view: 'x', outcome: '' })
    expect(s.Experiment).toBe('nope')
  })

  it('carries the engine’s provenance, which left the header for here (§11.3.3)', () => {
    const s = reportSummary({ id: 'a1', params: defaultsOf('a1'), traces: [], view: 'losses', outcome: 'x' })
    expect(s.Engine).toMatch(/exact periodic steady state/)
    expect(s.Engine).toMatch(/measured/)
  })
})
