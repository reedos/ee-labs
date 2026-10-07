import { describe, it, expect } from 'vitest'
import { fmtNum } from './format.js'
describe('browser count and axis formatting', () => {
  it('renders zero-digit integer labels without crashing the canvas or readout', () => {
    expect(fmtNum(2048, 0)).toBe('2048')
    expect(fmtNum(0.4, 0)).toBe('0')
    expect(fmtNum(-1.6, 0)).toBe('-2')
  })
  it('keeps positive significant-digit formatting for small and large values', () => {
    expect(fmtNum(0.00001234, 2)).toBe('0.000012')
    expect(fmtNum(1234, 2)).toBe('1200')
    expect(fmtNum(-1.234, 3)).toBe('-1.23')
  })
})
