import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import HandOver from './HandOver.jsx'
import { transferOf } from '../circuits.js'

// A passing `vite build` only proves the modules parse (see
// App.smoke.test.jsx for the pattern). The hand-over panel grew tier and
// warning branches with the gain-carrying bridge; each one is mounted here so
// a render-phase crash or a broken sentence fails in the suite, not in the
// browser. The panel derives its own rate (suggestRate), so each branch is
// reached through a transfer function that lands on it naturally.

const html = (tf, name = 'test circuit') =>
  renderToString(React.createElement(HandOver, { tf, circuitName: name })).replace(
    /<!--\s*-->/g,
    '',
  )

describe('HandOver render branches', () => {
  it('a named crossing with gain says the gain rides along, in dB and times', () => {
    const h = html(transferOf('rlcParallel', { r: 10000, l: 10e-3, c: 100e-9 }, 'z'), 'the tank')
    expect(h).toContain('band-pass')
    expect(h).toContain('+80.0 dB')
    expect(h).toContain('10,000')
    expect(h).toContain('gain block')
    // ...and no coefficient warning beside an exact named crossing.
    expect(h).not.toContain('±3.999')
  })

  it('a Q past the knob names the reason it crossed raw', () => {
    const h = html(transferOf('rlcSeries', { r: 1, l: 10e-3, c: 100e-9 }, 'c'))
    expect(h).toContain('beyond the 0.1–100')
    expect(h).toContain('raw coefficients')
  })

  it('an inverting circuit names the sign as the reason — on both bridges', () => {
    const h = html(transferOf('inverting', { rin: 1000, rf: 10000, cf: 1e-9 }, 'out'))
    // Signal Lab side: raw coefficients, sign carried.
    expect(h).toContain('inverts')
    expect(h).toContain('no dB knob says a sign')
    // Control Lab side: custom plant, the minus in the coefficients — never
    // a −10 clamped onto a k knob that starts at 0.001.
    expect(h).toContain('minus carried in the coefficients')
  })

  it('a corner under the knob floor names the window', () => {
    const h = html(transferOf('rcLow', { r: 1e5, c: 100e-9 }, 'c'))
    expect(h).toContain('20 Hz')
    expect(h).toContain('raw coefficients')
  })

  it('a gain past ±126 dB warns before the copy, with the remedy', () => {
    // Synthetic ×10⁸ low-pass: at its suggested rate the factored scale
    // saturates the gain block, which is the one boundary left.
    const h = html({ b: [1e8], a: [1e-4, 1] })
    expect(h).toContain('±126 dB')
    expect(h).toContain('gain block')
  })

  it('the unity default still reads as the plain named hand-over', () => {
    const h = html(transferOf('rcLow', { r: 1000, c: 100e-9 }, 'c'), 'RC low-pass')
    expect(h).toContain('crosses by name')
    expect(h).not.toContain('rides along')
  })
})
