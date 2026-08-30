import { describe, it, expect } from 'vitest'
import katex from 'katex'
import { PRESETS } from './presets.js'
import { mathsContext, mathsFor } from './maths.js'
import { agrees } from './components/Maths.jsx'
import { chainResponse, renderChain } from './dsp/chain.js'
import { render } from './dsp/signals.js'
import { spectrum } from './dsp/spectrum.js'

/** One failure per line, indented, so vitest's diff stays readable. */
const SEP = `\n  `

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
          // A row the current settings make unmeasurable is footnoted on the
          // page rather than marked wrong, so there is nothing to check here.
          if (row.unchecked) continue
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

describe('when the settings move away from the preset', () => {
  // The panel is built from live state, so a slider can invalidate a claim that
  // held when the preset loaded. Every row must then be either right or
  // explicitly marked unmeasurable — never a cross against correct physics.
  //
  // This is the regression test for exactly that: raising a square from 250 Hz
  // to 1 kHz pushes its 5th harmonic above Nyquist, and the panel used to ask
  // for a bin that does not exist, read whatever sat at the end of the axis,
  // and print a cross.
  const sweep = (preset, mutate) => {
    const base = PRESETS.find((p) => p.name === preset)
    const failures = []
    for (const variant of mutate(base)) {
      const entry = mathsFor(base.name, contextFor(variant))
      for (const b of entry.blocks) {
        if (b.kind !== 'check') continue
        for (const row of b.rows) {
          if (row.unchecked) continue
          const { predicted, measured, tol = 0.02, abs = 0 } = row
          if (!agrees({ predicted, measured, tol, abs })) {
            failures.push(
              `${variant.label} / ${row.label}: theory ${Number(predicted).toPrecision(5)} ` +
                `vs measured ${Number(measured).toPrecision(5)}`,
            )
          }
        }
      }
    }
    return failures
  }

  it('a square wave stays honest at every frequency', () => {
    const failures = sweep('Square = odd harmonics', (base) =>
      [100, 125, 200, 250, 263, 400, 500, 600, 800, 1000, 1600, 2000, 3000].map((freq) => ({
        ...base,
        label: `${freq} Hz`,
        patch: { ...base.patch, sources: [{ ...base.patch.sources[0], freq }] },
      })),
    )
    expect(failures.join(SEP)).toBe('')
  })

  it('a square wave stays honest at every sample rate and FFT size', () => {
    const failures = sweep('Square = odd harmonics', (base) => {
      const out = []
      for (const sampleRate of [8000, 16000, 22050, 44100, 48000]) {
        for (const fftSize of [512, 2048, 8192]) {
          out.push({
            ...base,
            label: `${sampleRate} Hz / ${fftSize}`,
            patch: { ...base.patch, sampleRate, fftSize },
          })
        }
      }
      return out
    })
    expect(failures.join(SEP)).toBe('')
  })

  it('a filtered square stays honest at every frequency', () => {
    const failures = sweep('Low-pass a square', (base) =>
      [125, 250, 400, 700, 1000, 1500].map((freq) => ({
        ...base,
        label: `${freq} Hz`,
        patch: { ...base.patch, sources: [{ ...base.patch.sources[0], freq }] },
      })),
    )
    expect(failures.join(SEP)).toBe('')
  })

  it('the rolloff comparison stays honest across waveforms and frequencies', () => {
    const failures = sweep('Corners make harmonics', (base) => {
      const out = []
      for (const type of ['triangle', 'square']) {
        for (const freq of [125, 250, 400, 1000]) {
          out.push({
            ...base,
            label: `${type} ${freq} Hz`,
            patch: { ...base.patch, sources: [{ ...base.patch.sources[0], type, freq }] },
          })
        }
      }
      return out
    })
    expect(failures.join(SEP)).toBe('')
  })

  it('still checks something in the common cases, rather than opting out of everything', () => {
    // The escape hatch must not become the answer everywhere: a panel that
    // never checks anything would pass the tests above and teach nothing.
    const base = PRESETS.find((p) => p.name === 'Square = odd harmonics')
    let checked = 0
    for (const freq of [125, 250, 500, 1000]) {
      const entry = mathsFor(base.name, contextFor({
        ...base,
        patch: { ...base.patch, sources: [{ ...base.patch.sources[0], freq }] },
      }))
      for (const b of entry.blocks) {
        if (b.kind !== 'check') continue
        checked += b.rows.filter((r) => !r.unchecked).length
      }
    }
    expect(checked).toBeGreaterThanOrEqual(8)
  })
})
