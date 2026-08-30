import { describe, it, expect } from 'vitest'
import katex from 'katex'
import { PRESETS } from './presets.js'
import { mathsContext, mathsFor } from './maths.js'
import { agrees } from './components/Maths.jsx'
import { chainResponse, renderChain } from './dsp/chain.js'
import { render } from './dsp/signals.js'
import { spectrum } from './dsp/spectrum.js'

// The maths panel pairs a formula with the number this tool measured, which is
// only worth anything if the pairing is checked. Every claim it makes is
// rendered here against the real signal, so a row that quietly stopped agreeing
// fails the build rather than sitting on screen looking authoritative.

/** Reproduce exactly what App feeds the panel for a given preset. */
function contextFor(preset) {
  const patch = preset.patch
  const state = {
    sources: patch.sources,
    blocks: patch.blocks || [],
    sampleRate: patch.sampleRate || 8000,
    fftSize: patch.fftSize || 2048,
    window: patch.window || 'hann',
    presetName: preset.name,
    showGhost: !!patch.showGhost,
  }
  const r = renderChain(state.sources, state.blocks, state.fftSize, state.sampleRate)
  const { freqs, amps } = spectrum(r.buf, state.sampleRate, state.window)

  // The ghost is the pre-chain spectrum, which is what makes a "gap equals |H|"
  // claim checkable.
  const dry = render(state.sources, state.fftSize, state.sampleRate)
  const ghostAmps = spectrum(dry, state.sampleRate, state.window).amps

  const resp = state.blocks.length ? chainResponse(state.blocks, freqs, state.sampleRate) : null

  let iMax = 0
  for (let i = 1; i < amps.length; i++) if (amps[i] > amps[iMax]) iMax = i

  return mathsContext({ state, freqs, amps, ghostAmps, resp, peakFreq: freqs[iMax] })
}

describe('the maths panel', () => {
  it('covers every preset', () => {
    for (const p of PRESETS) {
      expect(mathsFor(p.name, contextFor(p)), p.name).not.toBeNull()
    }
  })

  it('emits only formulas KaTeX can typeset', () => {
    for (const p of PRESETS) {
      const entry = mathsFor(p.name, contextFor(p))
      for (const b of entry.blocks) {
        if (b.kind !== 'formula') continue
        // strict:'error' turns silent fallbacks into failures, so a malformed
        // formula cannot ship as red literal text on the page.
        expect(
          () => katex.renderToString(b.tex, { throwOnError: true, strict: 'error' }),
          `${p.name}: ${b.tex}`,
        ).not.toThrow()
      }
    }
  })

  it('says something, not just formulas', () => {
    for (const p of PRESETS) {
      const entry = mathsFor(p.name, contextFor(p))
      const kinds = entry.blocks.map((b) => b.kind)
      expect(kinds, p.name).toContain('text')
      expect(entry.blocks.length, p.name).toBeGreaterThan(1)
    }
  })

  it('every predicted value it prints agrees with the measured one', () => {
    // The whole reason the panel is built from live state instead of prose.
    const failures = []
    for (const p of PRESETS) {
      const entry = mathsFor(p.name, contextFor(p))
      for (const b of entry.blocks) {
        if (b.kind !== 'check') continue
        for (const row of b.rows) {
          const { label, predicted, measured, tol = 0.02, abs = 0 } = row
          if (!Number.isFinite(predicted) || !Number.isFinite(measured)) {
            failures.push(`${p.name} / ${label}: non-finite (${predicted}, ${measured})`)
            continue
          }
          // Same predicate the panel itself uses to draw its tick or cross, so
          // the test and the page can never disagree about what "agrees" means.
          if (!agrees({ predicted, measured, tol, abs })) {
            failures.push(
              `${p.name} / ${label}: theory ${predicted.toPrecision(5)} vs measured ` +
                `${measured.toPrecision(5)} (tol ${tol}, abs ${abs})`,
            )
          }
        }
      }
    }
    expect(failures.join('\n')).toBe('')
  })
})
