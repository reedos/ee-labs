import { describe, it, expect } from 'vitest'
import { reportSummary } from './report.js'
import { CIRCUITS, defaultsOf } from './circuits.js'

// The first real report from this lab was missing the one row that says WHICH
// CIRCUIT it came from — the builder read `.label` off descriptors carrying
// `.name`, and the empty value was dropped as if it were deliberate. The
// browser probe passed it, because it counted the summary's rows instead of
// reading them. So every row is now read.

describe('the report summary', () => {
  it('names a real circuit for every circuit in the lab', () => {
    for (const id of Object.keys(CIRCUITS)) {
      const s = reportSummary({
        id,
        params: defaultsOf(id),
        output: CIRCUITS[id].outputs[0].key,
        tols: {},
        lower: 'step',
        lesson: null,
      })
      expect(s.Circuit, id).toBe(CIRCUITS[id].name)
      expect(s.Circuit, id).toBeTruthy()
    }
  })

  it('never yields undefined, NaN or [object Object] in any row', () => {
    // The class of failure that produced the empty row, checked across every
    // circuit and every one of its outputs.
    for (const id of Object.keys(CIRCUITS)) {
      for (const o of CIRCUITS[id].outputs) {
        const s = reportSummary({
          id,
          params: defaultsOf(id),
          output: o.key,
          tols: {},
          lower: 'bode',
          lesson: 'A lesson',
        })
        for (const [k, v] of Object.entries(s)) {
          expect(String(v), `${id}/${o.key} → ${k}`).not.toMatch(/undefined|NaN|\[object Object\]/)
          expect(String(v).trim(), `${id}/${o.key} → ${k}`).not.toBe('')
        }
      }
    }
  })

  it('names where the probe is, in words rather than a key', () => {
    const id = 'rcLow'
    const o = CIRCUITS[id].outputs[0]
    const s = reportSummary({ id, params: defaultsOf(id), output: o.key, tols: {}, lower: 'step' })
    expect(s['Measured at']).toBe(o.label)
  })

  it('distinguishes a hand-built setup from a loaded lesson', () => {
    const base = { id: 'rcLow', params: defaultsOf('rcLow'), output: 'c', tols: {}, lower: 'step' }
    expect(reportSummary({ ...base, lesson: null })['Started from']).toMatch(/built by hand/)
    expect(reportSummary({ ...base, lesson: 'Q is a shape' })['Started from']).toBe('Q is a shape')
  })

  it('reports tolerances when they are set, and says so when they are not', () => {
    const base = { id: 'rcLow', params: defaultsOf('rcLow'), output: 'c', lower: 'step' }
    expect(reportSummary({ ...base, tols: {} }).Tolerances).toBe('exact values')
    expect(reportSummary({ ...base, tols: { r: 0.05 } }).Tolerances).toBe('r ±5.0%')
  })

  it('survives an unknown circuit rather than throwing', () => {
    const s = reportSummary({ id: 'nope', params: {}, output: 'x', tols: {}, lower: 'step' })
    expect(s.Circuit).toBe('nope')
  })
})
