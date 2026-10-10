import { it, expect } from 'vitest'
import { rowsOf } from '@ee-labs/explain/testing'
import { EXPERIMENTS, defaultsOf } from './experiments.js'
import { analyse } from './analysis.js'
import { experimentMath } from './math.js'

it('the fill-factor definition does not certify its own maximum power', () => {
  const exp = EXPERIMENTS[0]
  const p = defaultsOf(exp.id)
  const x = analyse(exp, p)
  const entry = experimentMath(exp, p, x)
  expect(rowsOf(entry, 'check').some(r => r.label.startsWith('P_mpp'))).toBe(false)
  expect(rowsOf(entry, 'values').find(r => r.label === 'P_mpp')?.value).toBe(x.fig.pmpp)
})

it('battery terminal readings are displayed as values, without self-comparison ticks', () => {
  let checked = 0
  for (const exp of EXPERIMENTS) {
    const p = defaultsOf(exp.id)
    const x = analyse(exp, p)
    if (x.kind !== 'battery') continue
    checked++
    const entry = experimentMath(exp, p, x)
    expect(rowsOf(entry, 'check').filter(r => r.label.startsWith('Terminal'))).toEqual([])
    const reading = rowsOf(entry, 'values').find(r => r.label.startsWith('Terminal'))
    expect(reading?.value).toBe(x.at.v)
  }
  expect(checked).toBeGreaterThan(0)
})
