import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import App from './App.jsx'

// A passing `vite build` only proves the modules parse. This mounts the real
// component tree so a render-phase crash — a bad hook, a missing field, an
// undefined preset — fails here instead of in the browser.

// React inserts <!-- --> between adjacent text nodes when server-rendering, so
// `{value} Hz` comes out as `4000<!-- --> Hz`. Strip the markers before matching.
const html = () => renderToString(React.createElement(App)).replace(/<!--\s*-->/g, '')

describe('App', () => {
  it('renders without throwing', () => {
    const h = html()
    expect(h).toContain('Signal Lab')
    expect(h).toContain('Time domain')
    expect(h).toContain('Frequency domain')
  })

  it('shows the default single-tone readouts', () => {
    const h = html()
    // Default is a 1.0-amplitude sine: RMS should read about 0.707.
    expect(h).toMatch(/0\.70[0-9]/)
    expect(h).toContain('4000 Hz') // Nyquist for the default 8 kHz rate
  })

  it('has a note for every preset', () => {
    expect(html()).toContain('One sine, one line')
  })

  it('renders the chain section and its add menu', () => {
    const h = html()
    expect(h).toContain('Chain')
    expect(h).toContain('Low-pass')
    expect(h).toContain('Ring modulator')
    // Empty state, since no blocks are in the initial patch.
    expect(h).toContain('Nothing between the sources and the plots')
  })

  it('renders the top bar with global controls', () => {
    const h = html()
    expect(h).toContain('Hz/bin')
    expect(h).toContain('Signal chain') // the flow strip's aria-label
    expect(h).toContain('scope + FFT')
  })

  it('gives frequency a log slider and the Nyquist chips', () => {
    const h = html()
    expect(h).toContain('Nyquist — the fold point')
    expect(h).toContain('Above Nyquist')
    // 250 Hz on a log 1..8000 slider sits past the midpoint; a linear slider
    // would put it at position 31 of 1000.
    expect(h).toMatch(/class="num-slider"[^>]*value="6\d\d"/)
  })

  it('exposes numeric inputs as spinbuttons', () => {
    const h = html()
    expect(h).toContain('role="spinbutton"')
    expect(h).toContain('aria-valuetext="250 hertz"')
  })
})
