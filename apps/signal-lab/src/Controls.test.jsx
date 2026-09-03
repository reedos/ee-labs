import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import Controls from './components/Controls.jsx'
import { PRESETS } from './presets.js'
import { presetState } from './state.js'
import { termsSummary } from './terms.js'
import { mathContext, mathFor } from './math.js'
import { renderChain } from './dsp/chain.js'
import { spectrum } from '@ee-labs/dsp'

// The sidebar as a student first sees it for a given experiment. Server-
// rendered, so this covers what is on the page before any click — which
// groups are open, what sits under the note, in what order. The clicks
// themselves (folding, next/prev, chips) are driven in scripts/verify.mjs.

const html = (name, extra = {}) => {
  const p = PRESETS.find((x) => x.name === name)
  const state = presetState(p)
  const r = renderChain(state.sources, state.blocks, state.fftSize, state.sampleRate)
  const { freqs, amps } = spectrum(r.buf, state.sampleRate, state.window)
  const math = mathFor(name, mathContext({ state, freqs, amps, ghostAmps: null, resp: null, peakFreq: 250 }))
  const nav = { index: PRESETS.indexOf(p), total: PRESETS.length, dirty: false }
  return renderToString(
    <Controls
      state={state}
      setState={() => {}}
      presets={PRESETS}
      onPreset={() => {}}
      onChip={() => {}}
      nav={nav}
      openBlocks={new Set()}
      setOpenBlocks={() => {}}
      openGroups={new Set()}
      setOpenGroups={() => {}}
      math={math}
      {...extra}
    />,
  ).replace(/<!--\s*-->/g, '')
}

const openGroups = (h) => (h.match(/<details class="preset-group"[^>]*\sopen(=""|\s|>)/g) || []).length

describe('preset groups', () => {
  it('opens only the group holding the active preset', () => {
    expect(openGroups(html('Single tone'))).toBe(1)
    expect(openGroups(html('Resonance is Q'))).toBe(1)
    expect(openGroups(html('4 bits'))).toBe(1)
  })

  it('opens a group the student unfolded by hand as well', () => {
    expect(openGroups(html('Single tone', { openGroups: new Set(['Sampling']) }))).toBe(2)
  })
})

describe('under the note', () => {
  it('renders the lesson nav, the title, the try line, the featured knob, THEN the note body', () => {
    // title → try → featured knob → note (note last): so the knob a fold
    // probe holds at 1366×768 is never pushed past the fold by however long
    // the note runs. Six FIR/z-plane presets' knobs did exactly that with
    // the note ahead of them (verify.mjs's fold probe, 10i).
    const h = html('Resonance is Q')
    const i = PRESETS.findIndex((p) => p.name === 'Resonance is Q')
    expect(h).toContain(`${i + 1} of ${PRESETS.length}`)
    const nav = h.indexOf('class="lesson-nav"')
    const title = h.indexOf('class="note-title"')
    const tryLine = h.indexOf('class="try-line"')
    const featured = h.indexOf('class="featured"')
    const noteBody = h.indexOf('The resonant peak at the cutoff')
    const sources = h.indexOf('id="sources"')
    const math = h.indexOf('id="math"')
    expect(nav).toBeGreaterThan(0)
    expect(title).toBeGreaterThan(nav)
    expect(tryLine).toBeGreaterThan(title)
    expect(featured).toBeGreaterThan(tryLine)
    expect(noteBody).toBeGreaterThan(featured)
    expect(sources).toBeGreaterThan(noteBody)
    // The experiment's math sits BELOW the sources and chain, so opening it
    // moves no knob.
    expect(math).toBeGreaterThan(sources)
    expect(math).toBeGreaterThan(h.indexOf('id="chain"'))
  })

  it('features the Q knob for Resonance is Q and the Phase knob for Exactly at Nyquist', () => {
    expect(html('Resonance is Q')).toMatch(/class="featured"[\s\S]*Q \(resonance\)/)
    expect(html('Exactly at Nyquist')).toMatch(/class="featured"[\s\S]*aria-valuetext="90 degrees"/)
    expect(html('Aliasing')).toMatch(/class="featured"[\s\S]*aria-valuetext="3400 hertz"/)
  })

  it('renders the chips, marking the one the state already satisfies', () => {
    const h = html('Resonance is Q')
    expect(h).toMatch(/chip is-on[^>]*>10</)
    expect(h).toMatch(/class="chip"[^>]*>20</)
  })

  it('shows the reset only once the state has moved', () => {
    expect(html('Single tone')).not.toContain('lesson-nav-reset')
    expect(html('Single tone', { nav: { index: 0, total: 35, dirty: true } })).toContain('lesson-nav-reset')
  })
})

describe('terms', () => {
  it('stay folded and name what they define in the summary', () => {
    const h = html('Aliasing')
    expect(h).toMatch(/<details class="terms">/)
    expect(h).not.toMatch(/<details class="terms" open/)
    expect(h).toContain('Terms used here: sampled, aliasing, Nyquist')
    expect(termsSummary(['q', 'groupdelay', 'zplane'])).toBe('Terms used here: Q, group delay, z-plane')
  })

  it('defines the chrome terms once, folded, on every screen — not per preset', () => {
    for (const name of ['Single tone', 'Resonance is Q', '4 bits']) {
      const h = html(name)
      expect(h, name).toMatch(/<details class="terms chrome-terms">/)
      expect(h, name).not.toMatch(/<details class="terms chrome-terms" open/)
      expect(h, name).toContain('what the top bar means')
      // FFT, bin, frame, window, the window names, RMS, crest, span.
      expect(h, name).toContain('FFT (fast Fourier transform)')
      expect(h, name).toContain('hann, hamming, blackman, none')
      expect(h, name).toContain('Crest factor')
      expect(h, name).toContain('Span (cycles)')
    }
  })
})

describe('the square source', () => {
  it('keeps the Highest harmonic field to its chips — no paragraph beside it', () => {
    const h = html('A square that fits')
    expect(h).toContain('Highest harmonic')
    // The two sentences the old hint paragraph carried, one per state of
    // the field. (The note may say "topping out" in its own voice.)
    expect(h).not.toContain('Perfect reconstruction needs')
    expect(h).not.toContain('Set a highest harmonic to see the series instead')
    expect(html('Square = odd harmonics')).not.toContain('Set a highest harmonic to see the series instead')
  })
})
