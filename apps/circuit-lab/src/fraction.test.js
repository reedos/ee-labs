import { describe, it, expect } from 'vitest'
import { asFraction } from './fraction.js'
import { transferOf, defaultsOf } from './circuits.js'
import { dcGain } from '@ee-labs/systems'

describe('asFraction — the divider caption says a ratio as a ratio', () => {
  it('finds the small exact fractions and refuses the rest', () => {
    expect(asFraction(0.5)).toBe('1/2')
    expect(asFraction(0.75)).toBe('3/4')
    expect(asFraction(2 / 3)).toBe('2/3')
    expect(asFraction(1)).toBe('1')
    expect(asFraction(Math.SQRT1_2)).toBe(null)
    expect(asFraction(0.5000001)).toBe(null)
    expect(asFraction(NaN)).toBe(null)
  })

  it('labels the divider lesson H = 1/2, measured from its transfer function', () => {
    const g = dcGain(transferOf('divider', defaultsOf('divider'), 'out'))
    expect(asFraction(g)).toBe('1/2')
    const g2 = dcGain(transferOf('divider', { ...defaultsOf('divider'), r2: 3000 }, 'out'))
    expect(asFraction(g2)).toBe('3/4')
  })
})
