import { it, expect } from 'vitest'
import { rowsOf } from '@ee-labs/explain/testing'
import { ENTRIES } from './mathEntries.js'

it('the resistor-defined gain is a setting, while the output check reads the solver', () => {
  const p = { Rf: 9000, Rg: 1000, E: 0.1, vos: 0.001 }
  const a = ENTRIES.a1(p, { sol: { v: { out: 1.01 } } })
  const b = ENTRIES.a1(p, { sol: { v: { out: 0.8 } } })
  expect(rowsOf(a, 'check').some(r => r.label.includes('closed-loop gain'))).toBe(false)
  expect(rowsOf(a, 'values').find(r => r.label.includes('closed-loop gain'))?.value).toBe(10)
  expect(rowsOf(a, 'check')[0].measured).not.toBe(rowsOf(b, 'check')[0].measured)
})
