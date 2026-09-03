import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import HandOver, { CompactHandOvers } from './HandOver.jsx'
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

  it('at the 192 kHz ceiling the sparse-sampling warning says so instead of "raise the rate"', () => {
    // A 159 kHz corner: suggestRate tops out at 192 kHz, 1.2 samples per
    // cycle, and there is no higher rate to ask for.
    const h = html(transferOf('rcLow', { r: 1000, c: 1e-9 }, 'c'))
    expect(h).toContain('ceiling')
    expect(h).toContain('coarse but exact')
    expect(h).toMatch(/1\.21 samples per cycle/)
    expect(h).not.toContain('Raise the rate')
  })

  it('the circuit is named as the sidebar names it, and the panel defines its own terms', () => {
    const h = html(transferOf('rlcSeries', { r: 100, l: 10e-3, c: 100e-9 }, 'c'), 'Series RLC')
    expect(h).toContain('Series RLC is a low-pass biquad')
    expect(h).not.toContain('series rlc')
    for (const name of ['Bilinear transform', 'Sample rate', 'Samples per cycle', 'Coefficients', 'Plant', 'Damping ratio']) {
      expect(h).toContain(name)
    }
    // The refused integrator gets the same reveal.
    const d = html(transferOf('integrator', { r: 10000, c: 10e-9 }, 'out'), 'Op-amp integrator')
    expect(d).toContain('Declined')
    expect(d).toContain('Bilinear transform')
  })
})

// The compact links surfaced beside the network (student-review item 4):
// second order only, and only where siblingUrl can resolve a real link — a
// bare Node render has no `window`, the same "dev port" case siblingUrl
// itself declines, so a fake deployed `window.location` stands in for the
// browser navigating to /circuit-lab/ the way verify.mjs does.
describe('CompactHandOvers', () => {
  const compactHtml = (tf, from) =>
    renderToString(React.createElement(CompactHandOvers, { tf, from })).replace(/<!--\s*-->/g, '')

  const onDeployedLayout = (fn) => {
    const prev = globalThis.window
    globalThis.window = { location: { pathname: '/ee-labs/circuit-lab/', origin: 'https://ee-labs.example' } }
    try {
      return fn()
    } finally {
      if (prev === undefined) delete globalThis.window
      else globalThis.window = prev
    }
  }

  it('renders nothing without a deployed location, even for a second-order circuit', () => {
    const tf = transferOf('rlcSeries', { r: 100, l: 10e-3, c: 100e-9 }, 'c')
    expect(compactHtml(tf, { app: 'circuit', id: 'rlcSeries', label: 'Series RLC' })).toBe('')
  })

  it('a second-order circuit gets both links on the deployed layout', () => {
    const tf = transferOf('rlcSeries', { r: 100, l: 10e-3, c: 100e-9 }, 'c')
    const h = onDeployedLayout(() => compactHtml(tf, { app: 'circuit', id: 'rlcSeries', label: 'Series RLC' }))
    expect(h).toContain('Signal Lab')
    expect(h).toContain('Control Lab')
  })

  it('a first-order circuit gets neither link, even on the deployed layout', () => {
    const tf = transferOf('rcLow', { r: 1000, c: 100e-9 }, 'c')
    const h = onDeployedLayout(() => compactHtml(tf, { app: 'circuit', id: 'rcLow', label: 'RC low-pass' }))
    expect(h).toBe('')
  })

  it('the integrator (declined everywhere) gets neither link', () => {
    const tf = transferOf('integrator', { r: 10000, c: 10e-9 }, 'out')
    const h = onDeployedLayout(() => compactHtml(tf, { app: 'circuit', id: 'integrator', label: 'Op-amp integrator' }))
    expect(h).toBe('')
  })
})
