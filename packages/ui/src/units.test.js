import { describe, it, expect } from 'vitest'
import { eng, fmt, parseEng } from './units.js'

describe('fmt', () => {
  it('picks the prefix that leaves one to three digits before the point', () => {
    expect(fmt(1.792e12, 'Hz')).toBe('1.792 THz')
    expect(fmt(4.464e-12, 's')).toBe('4.464 ps')
    expect(fmt(1000, 'Ω', 3)).toBe('1 kΩ')
    expect(fmt(0.0055, 'A', 3)).toBe('5.5 mA')
    expect(fmt(-12.5, 'V', 3)).toBe('-12.5 V')
    expect(fmt(0, 'V')).toBe('0 V')
    expect(fmt(NaN, 'V')).toBe('— V')
  })

  it('rounds before choosing the prefix, so a hair under a boundary is not shown in the smaller unit', () => {
    // A solver hands back 0.99999999 for what is 1 V; "1000 mV" is the same
    // number printed to look like a different one.
    expect(fmt(0.99999999, 'V', 3)).toBe('1 V')
    expect(fmt(999.9999, 'Ω', 3)).toBe('1 kΩ')
    expect(fmt(-0.99999999, 'A', 3)).toBe('-1 A')
    // But a value that genuinely prints below the boundary keeps the smaller unit.
    expect(fmt(0.9994, 'V', 3)).toBe('999 mV')
    expect(fmt(999.4, 'Ω', 3)).toBe('999 Ω')
  })

  it('reports the multiplier a field must use to read back what it shows', () => {
    expect(eng(2.24e11)).toEqual({ num: '224', prefix: 'G', mult: 1e9 })
    expect(eng(0.99999999, 3).mult).toBe(1)
  })
})

describe('parseEng', () => {
  it('round-trips what fmt prints', () => {
    for (const v of [1.792e12, 4.464e-12, 1000, 0.0055, -12.5, 0.99999999]) {
      const shown = fmt(v, 'V', 4)
      const back = parseEng(shown, 'V')
      expect(back.hadPrefix).toBe(!/\d V$/.test(shown))
      expect(back.value / Number(v.toPrecision(4))).toBeCloseTo(1, 12)
    }
  })

  it('accepts u for micro and refuses nonsense', () => {
    expect(parseEng('4.7u')).toEqual({ value: expect.closeTo(4.7e-6, 15), ratio: null, hadPrefix: true })
    expect(parseEng('abc')).toBeNull()
    expect(parseEng('')).toBeNull()
  })
})
