import { it, expect } from 'vitest'
import { rowsOf } from '@ee-labs/explain/testing'
import { EXPERIMENTS, defaultsOf } from './experiments.js'
import { analyse } from './analysis.js'
import { experimentMath } from './math.js'

it('base definitions and unit conversions carry values without measurement ticks', () => {
  const labels = new Set(['Z_b', 'I_b', 'Line to neutral', 'Surge impedance'])
  const seen = new Set()
  for (const exp of EXPERIMENTS.filter(e => ['base', 'phase', 'line'].includes(e.kind))) {
    const p = defaultsOf(exp.id)
    const entry = experimentMath(exp, p, analyse(exp, p))
    expect(rowsOf(entry, 'check').filter(r => labels.has(r.label))).toEqual([])
    for (const row of rowsOf(entry, 'values')) if (labels.has(row.label)) {
      expect(Number.isFinite(row.value)).toBe(true)
      seen.add(row.label)
    }
  }
  expect(seen).toEqual(labels)
})
