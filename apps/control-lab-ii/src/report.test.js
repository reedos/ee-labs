import { describe, it, expect } from 'vitest'
import { reportSummary } from './report.js'
import { applyExperiment, byId, EXPERIMENTS } from './experiments.js'

// A report is what a reader sends when something looks wrong, so every row in
// it has to be readable by the person who receives it.

describe('the report header', () => {
  it('names the experiment it came from, or says it was built by hand', () => {
    const e = byId('A5')
    expect(reportSummary(applyExperiment(e), e)['Started from']).toBe('A5 Pole placement')
    expect(reportSummary(applyExperiment(e), null)['Started from']).toBe('(built by hand)')
  })

  it('prints no key it did not find, which is the defect Control Lab shipped', () => {
    for (const e of EXPERIMENTS) {
      const rows = reportSummary(applyExperiment(e), e)
      for (const [key, value] of Object.entries(rows)) {
        expect(String(value), `${e.id}: ${key}`).not.toMatch(/undefined|NaN|\[object/)
        expect(String(value).length, `${e.id}: ${key} is empty`).toBeGreaterThan(0)
      }
    }
  })

  it('a sampled experiment reports its rate and its rule', () => {
    const rows = reportSummary(applyExperiment(byId('B6')), byId('B6'))
    expect(rows['Sample time']).toMatch(/samples a cycle/)
    expect(rows['Emulation rule']).toBe('tustin')
  })

  it('a saturating experiment reports the limit that made the picture', () => {
    const rows = reportSummary(applyExperiment(byId('C3')), byId('C3'))
    expect(rows.Nonlinearity).toMatch(/Saturation, limit 1.5/)
  })

  it('a linear experiment reports no nonlinearity at all', () => {
    expect(reportSummary(applyExperiment(byId('A1')), byId('A1')).Nonlinearity).toBe(undefined)
  })
})
