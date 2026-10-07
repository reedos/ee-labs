import { it, expect } from 'vitest'
import { rowsOf } from '@ee-labs/explain/testing'
import { ENTRIES } from './mathEntries.js'
import { photovoltaic } from '@ee-labs/network'

it('maximum power is a value, not a check of its own fill-factor definition', () => {
  const pv = photovoltaic({ is: 1e-12, il: 0.03 })
  const entry = ENTRIES.f2({}, { pv })
  expect(rowsOf(entry, 'check').some(r => r.label === 'the power there, against the fill factor')).toBe(false)
  expect(rowsOf(entry, 'values').find(r => r.label === 'maximum power')?.value).toBe(pv.pmax)
  expect(rowsOf(entry, 'check').some(r => r.label === 'the empirical fill factor')).toBe(true)
})
