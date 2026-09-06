import { describe, expect, it } from 'vitest'
import { forReading, isNoise, num, prefixFor, readableCheck, readableValue, scaleOf } from './format.js'

describe('num: the one formatter the student reads', () => {
  it('snaps the solver’s residue to 0 — 8.7e-19 A at a node carrying milliamps is not a reading', () => {
    expect(num(8.7e-19, 'A', 2, 0.012)).toBe('0 A')
    expect(num(-8.7e-19, 'A', 2, 0.012)).toBe('0 A')
    // With no scale, nothing below a femto prints.
    expect(num(8.7e-19, 'A')).toBe('0 A')
    expect(num(-8.3e-23, 'A')).toBe('0 A')
    // A fit residual of 1.8 fV against a 6 V open-circuit voltage is noise too.
    expect(num(1.8e-15, 'V', 2, 6)).toBe('0 V')
  })

  it('keeps small readings that are real: 99 pW in a 1 MΩ input, 9.9 nA through it', () => {
    expect(num(99e-12, 'W', 2)).toBe('99 pW')
    expect(num(9.9e-9, 'A', 2)).toBe('9.9 nA')
    // Against the load's 89 mW the input's 99 pW is still 1e-9 above the floor.
    expect(num(99e-12, 'W', 2, 0.0889)).toBe('99 pW')
    expect(isNoise(99e-12, 0.0889)).toBe(false)
  })

  it('spells out the non-numbers', () => {
    expect(num(Infinity, 's')).toBe('∞')
    expect(num(-Infinity, 's')).toBe('−∞')
    expect(num(NaN, 'V')).toBe('—')
    expect(num(undefined, 'V')).toBe('—')
  })

  it('prints ordinary values as fmt does', () => {
    expect(num(0.012, 'A', 3)).toBe('12 mA')
    expect(num(1591.549, 'Hz', 4)).toBe('1.592 kHz')
    expect(num(4.07e-9, 'V/√Hz', 3)).toBe('4.07 nV/√Hz')
  })

  it('gives a ratio, a per cent and a multiple no SI prefix, since there is no unit to multiply', () => {
    // F3's topbar carried "500 m%" for half a per cent, and A3's "100 m" for a
    // ratio of a tenth. Both are the milli prefix on a unit that is not there.
    expect(num(0.5, '%', 4)).toBe('0.5 %')
    expect(num(0.7071068, '%', 4)).toBe('0.7071 %')
    expect(num(-1.2e-5, '%', 3)).toBe('-0.000012 %')
    expect(num(0.1, '', 4)).toBe('0.1')
    expect(num(0.25, '', 3)).toBe('0.25')
    expect(num(5.43, '×', 3)).toBe('5.43 ×')
    expect(num(898, 'million ×', 3)).toBe('898 million ×')
    // A quantity that does take a prefix still gets one.
    expect(num(0.1, 'V', 4)).toBe('100 mV')
  })

  it('scaleOf is the largest magnitude of a reading set, ignoring gaps', () => {
    expect(scaleOf({ a: 0.012, b: -0.03, c: NaN })).toBe(0.03)
    expect(scaleOf({})).toBe(0)
  })
})

describe('forReading: the math panel’s rows in the unit a student would write', () => {
  it('rescales into an SI prefix, tolerance and unit moving with the value', () => {
    const r = readableCheck({ label: 'i', predicted: 1e-4, measured: 1.00000001e-4, unit: 'A', tol: 1e-9, abs: 1e-12 })
    expect(r.unit).toBe('µA')
    expect(r.predicted).toBeCloseTo(100, 12)
    expect(r.measured).toBeCloseTo(100.000001, 9)
    expect(r.abs).toBeCloseTo(1e-6, 18)
    expect(readableCheck({ predicted: 12000, measured: 12000, unit: 'Ω' })).toMatchObject({ predicted: 12, unit: 'kΩ' })
    expect(readableValue({ value: 3.3e-9, unit: 'J' }).unit).toBe('nJ')
    expect(readableValue({ value: 3.3e-9, unit: 'J' }).value).toBeCloseTo(3.3, 12)
    expect(readableValue({ value: 4700, unit: 'Ω' })).toMatchObject({ value: 4700, unit: 'Ω' })
    expect(readableValue({ value: 1591.5, unit: 'Hz' })).toMatchObject({ value: 1591.5, unit: 'Hz' })
  })

  it('leaves ratios, degrees, dB and percentages alone', () => {
    for (const unit of ['', '%', '°', 'dB', '×', '1/s']) {
      const r = { predicted: 2e-4, measured: 2e-4, unit }
      expect(readableCheck(r)).toBe(r)
    }
  })

  it('a zero prediction met within its floor reads 0, not the residue', () => {
    expect(readableCheck({ predicted: 0, measured: 8.7e-19, unit: 'A', abs: 1e-12 }).measured).toBe(0)
    expect(readableCheck({ predicted: 0, measured: 1.4e-11, unit: '', tol: 0, abs: 1e-9 }).measured).toBe(0)
    // Not met: the residue stands, and the row's ✗ with it.
    expect(readableCheck({ predicted: 0, measured: 3e-9, unit: '', abs: 1e-12 }).measured).toBe(3e-9)
    // A zero row measured at 0 in volts stays in volts.
    expect(readableCheck({ predicted: 0, measured: 0, unit: 'V', abs: 1e-12 }).unit).toBe('V')
  })

  it('keeps agreement: a row that agreed before agrees after, and one that did not still does not', () => {
    const agrees = ({ predicted, measured, tol = 0.02, abs = 0 }) => Math.abs(measured - predicted) <= Math.max(tol * Math.abs(predicted), abs)
    for (const r of [
      { predicted: 5e-4, measured: 5.0000000001e-4, unit: 'V', tol: 1e-9, abs: 1e-12 },
      { predicted: 5e-4, measured: 5.1e-4, unit: 'V', tol: 1e-9, abs: 1e-12 },
      { predicted: 0, measured: 2e-13, unit: 'W', tol: 0, abs: 1e-12 },
    ]) expect(agrees(readableCheck(r))).toBe(agrees(r))
  })

  it('walks an entry’s blocks, touching only the tables', () => {
    const entry = { blocks: [{ kind: 'text', text: 'hi' }, { kind: 'check', rows: [{ predicted: 2e-3, measured: 2e-3, unit: 'A' }] }, { kind: 'values', rows: [{ value: 5e-6, unit: 'F' }] }] }
    const out = forReading(entry)
    expect(out.blocks[0]).toBe(entry.blocks[0])
    expect(out.blocks[1].rows[0]).toMatchObject({ predicted: 2, unit: 'mA' })
    expect(out.blocks[2].rows[0].unit).toBe('µF')
    expect(out.blocks[2].rows[0].value).toBeCloseTo(5, 12)
    expect(forReading(null)).toBeNull()
  })
})

describe('prefixFor: rates and ratios get words a student would write', () => {
  it('per-second rates fall to per-millisecond; ratios past 10⁴ are counted in thousands, millions, billions', () => {
    expect(prefixFor(2e4, '1/s')).toEqual([1e3, '1/ms'])
    expect(prefixFor(1e8, '1/s²')).toEqual([1e6, '1/µs²'])
    expect(prefixFor(1e4, 'rad/s')).toEqual([1e3, 'krad/s'])
    expect(prefixFor(8.98e8, '×')).toEqual([1e6, 'million ×'])
    expect(prefixFor(2.5e4, '×')).toEqual([1e3, 'thousand ×'])
    expect(prefixFor(9, '×')).toEqual([1, '×'])
    expect(prefixFor(1e-4, '%')).toEqual([1, '%'])
  })
})

describe('readableCheck: a prediction under the row’s own floor is zero', () => {
  it('shows 0 for both sides when theory and measurement are both residue', () => {
    const r = readableCheck({ label: 'stored', predicted: 2.7e-37, measured: 4.93e-37, unit: 'J', tol: 1e-7, abs: 1e-15 })
    expect(r.predicted).toBe(0)
    expect(r.measured).toBe(0)
    expect(r.unit).toBe('J')
    // A real small prediction above its floor is kept and prefixed.
    expect(readableCheck({ predicted: 3e-13, measured: 3e-13, unit: 'J', abs: 1e-15 })).toMatchObject({ unit: 'fJ' })
  })
})
