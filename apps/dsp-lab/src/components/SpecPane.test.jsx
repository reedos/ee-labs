import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import SpecPane, { barFraction, formatMargin, formatValue } from './SpecPane.jsx'
import { lowpassSpec, specMarginRef, firResponse, designRemezSpec } from '@ee-labs/dsp'

// The specification pane's contract, from APPLIED_ANALOG_LAB_PLAN.md §4.3.
//
// Two labs use this pane and one builds it, so its props are tested against the
// shape the other lab asked for rather than against the shape this lab happens
// to pass. Both forms, `items` and `mask`, are exercised here.

const html = (props) => renderToString(React.createElement(SpecPane, props)).replace(/<!--\s*-->/g, '')

const ITEMS = [
  { key: 'bw', label: 'Bandwidth', value: 96500, target: 90000, unit: 'Hz', cmp: 'min', margin: 6500, pass: true },
  { key: 'os', label: 'Offset', value: 1.8, target: 1.0, unit: 'mV', cmp: 'max', margin: -0.8, pass: false },
  { key: 'g', label: 'Gain', value: 10.02, target: 10, tol: 0.1, unit: '', cmp: 'window', margin: 0.08, pass: true },
]

describe('the scalar form', () => {
  it('renders one row a specification, with its comparison in words', () => {
    const h = html({ items: ITEMS })
    expect(h).toContain('Bandwidth')
    expect(h).toContain('at least')
    expect(h).toContain('at most')
    expect(h).toContain('within')
  })

  it('a met row and a missed row read differently', () => {
    const h = html({ items: ITEMS })
    expect(h).toContain('met')
    expect(h).toContain('missed')
    expect(h).toMatch(/class="[^"]*missed/)
  })

  it('shows the binding row first', () => {
    const h = html({ items: ITEMS, binding: 'os' })
    expect(h.indexOf('Offset')).toBeLessThan(h.indexOf('Bandwidth'))
    expect(h).toMatch(/binds/)
  })

  it('renders no margin the caller did not supply', () => {
    const h = html({ items: [{ key: 'x', label: 'Unmeasured', value: null, target: 1, cmp: 'max', margin: null, pass: false }] })
    expect(h).toContain('—')
  })

  it('offers an editable target only when onEdit is given', () => {
    expect(html({ items: ITEMS })).not.toContain('<input')
    expect(html({ items: ITEMS, onEdit: () => {} })).toContain('<input')
  })

  it('draws bars in the phone mode and numbers in the table mode', () => {
    expect(html({ items: ITEMS, mode: 'bars' })).toContain('spec-bar')
    expect(html({ items: ITEMS, mode: 'table' })).not.toContain('spec-bar')
  })

  it('says what to do when it is given nothing', () => {
    expect(html({})).toContain('Load an experiment')
  })
})

describe('the mask form, which is what a filter states', () => {
  const SR = 48000
  const spec = { fpass: 4000, fstop: 6000, ripplePassDb: 1, stopDb: 60 }

  it('takes specMarginRef output with no reshaping', () => {
    const d = designRemezSpec(spec, SR)
    const bands = lowpassSpec(spec, SR)
    const margin = specMarginRef(bands, (f) => firResponse(d.h, f, SR))
    const h = html({ mask: { axis: 'f', bands: margin.bands } })
    expect(h).toContain('Passband')
    expect(h).toContain('Stopband')
    expect(h).toContain('Met, with')
    expect(h).toContain('frequency axis')
  })

  it('names the frequency where a design misses', () => {
    // Hamming cannot reach 60 dB at any length, so its stopband misses.
    const bands = lowpassSpec(spec, SR)
    const margin = specMarginRef(bands, (f) => (f < 5000 ? 1 : 0.01))
    const h = html({ mask: { axis: 'f', bands: margin.bands } })
    expect(h).toContain('missed at')
    expect(h).toMatch(/Missed by/)
  })

  it('carries both forms at once, which is what the second lab needs', () => {
    const bands = lowpassSpec(spec, SR)
    const margin = specMarginRef(bands, (f) => (f < 5000 ? 1 : 1e-4))
    const h = html({ items: ITEMS, mask: { axis: 'f', bands: margin.bands }, binding: 'bw' })
    expect(h).toContain('Bandwidth')
    expect(h).toContain('Stopband')
  })
})

describe('the formatting helpers', () => {
  it('gives a unit its own precision', () => {
    expect(formatValue(96500, 'Hz')).toBe('96.5kHz')
    expect(formatValue(-60.4, 'dB')).toBe('-60.40 dB')
    expect(formatValue(null, 'dB')).toBe('—')
  })

  it('signs a margin, and uses a minus rather than a hyphen', () => {
    expect(formatMargin(2.5, 'dB')).toBe('+2.50 dB')
    expect(formatMargin(-2.5, 'dB')).toBe('−2.50 dB')
  })

  it('puts a zero margin at the middle of the bar, and clamps the ends', () => {
    expect(barFraction(0, 10)).toBe(0.5)
    expect(barFraction(10, 10)).toBe(0.98)
    expect(barFraction(-10, 10)).toBe(0.02)
    expect(barFraction(1000, 10)).toBe(0.98)
  })
})
