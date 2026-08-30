import { describe, it, expect } from 'vitest'
import katex from 'katex'
import { PRESETS } from './presets.js'
import { mathContext, mathFor } from './math.js'
import { agrees } from '@ee-labs/explain'
import { chainResponse, renderChain } from './dsp/chain.js'
import { render } from '@ee-labs/dsp'
import { spectrum } from '@ee-labs/dsp'

/** One failure per line, indented, so vitest's diff stays readable. */
const SEP = `\n  `

// The math panel pairs a formula with the number this tool measured, which is
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

  return mathContext({ state, freqs, amps, ghostAmps, resp, peakFreq: freqs[iMax] })
}

describe('the math panel', () => {
  it('covers every preset', () => {
    for (const p of PRESETS) {
      expect(mathFor(p.name, contextFor(p)), p.name).not.toBeNull()
    }
  })

  it('emits only formulas KaTeX can typeset', () => {
    for (const p of PRESETS) {
      const entry = mathFor(p.name, contextFor(p))
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
      const entry = mathFor(p.name, contextFor(p))
      const kinds = entry.blocks.map((b) => b.kind)
      expect(kinds, p.name).toContain('text')
      expect(entry.blocks.length, p.name).toBeGreaterThan(1)
    }
  })

  it('every predicted value it prints agrees with the measured one', () => {
    // The whole reason the panel is built from live state instead of prose.
    const failures = []
    for (const p of PRESETS) {
      const entry = mathFor(p.name, contextFor(p))
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
      const entry = mathFor(base.name, contextFor(variant))
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
      const entry = mathFor(base.name, contextFor({
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

describe('a check must actually read something', () => {
  // The question this answers: what is the point of "theory" and "measured"
  // being separate columns at all?
  //
  // Only that the two sides come from different places. The theory side is a
  // closed form; the measured side has to be read off something the app is
  // really showing — the FFT trace, the pre-chain ghost, the response curve.
  // When that holds, agreement means the implementation matches the formula,
  // and it has caught three genuine bugs.
  //
  // When it does not hold, the row is a tautology: half of this panel used to
  // print one number in both columns and mark it correct. Those are now
  // rendered as plain derived values with no tick.
  //
  // This test makes the distinction enforceable. Perturb everything the panel
  // could be measuring FROM, and every check row's measured value must move.
  // A row that does not move is not reading anything.
  const perturbed = (preset, factor) => {
    const patch = preset.patch
    const state = {
      // Source amplitudes scale with the perturbation too. The spectrum-derived
      // context covers rows that read bins; a row measured from the TIME-domain
      // signal - the convolution entry re-renders and re-filters it - reads the
      // state instead, and must also be seen to move.
      sources: patch.sources.map((x) => ({ ...x, amp: x.amp * factor })),
      blocks: patch.blocks || [],
      sampleRate: patch.sampleRate || 8000,
      fftSize: patch.fftSize || 2048,
      window: patch.window || 'hann',
      presetName: preset.name,
      showGhost: !!patch.showGhost,
    }
    const r = renderChain(state.sources, state.blocks, state.fftSize, state.sampleRate)
    const { freqs, amps } = spectrum(r.buf, state.sampleRate, state.window)
    const dry = render(state.sources, state.fftSize, state.sampleRate)
    const ghost = spectrum(dry, state.sampleRate, state.window).amps
    const resp = state.blocks.length
      ? chainResponse(state.blocks, freqs, state.sampleRate)
      : null

    // Scale every source of measurement by a different amount, AND tilt each
    // across frequency. A flat scale is not enough: a row that reads a ratio of
    // two bins — the rolloff comparison does — is scale-invariant by
    // construction and would look inert without the tilt.
    // The tilt has to vary WITH the perturbation, not just exist: an identical
    // tilt in both contexts cancels out of a ratio exactly as a flat scale does.
    const scale = (arr, k) =>
      Float64Array.from(arr, (v, i) => v * k * (1 + ((k - 1) * 0.6 * i) / arr.length))
    let iMax = 0
    for (let i = 1; i < amps.length; i++) if (amps[i] > amps[iMax]) iMax = i

    return mathContext({
      state,
      freqs,
      amps: scale(amps, factor),
      ghostAmps: scale(ghost, factor * 1.31),
      resp: resp ? { ...resp, mag: scale(resp.mag, factor * 0.77) } : null,
      peakFreq: freqs[iMax] * factor,
    })
  }

  it('every check row moves when the thing it reads is perturbed', () => {
    const inert = []
    for (const p of PRESETS) {
      const a = mathFor(p.name, perturbed(p, 1))
      const b = mathFor(p.name, perturbed(p, 1.9))
      const rowsOf = (e) => e.blocks.filter((x) => x.kind === 'check').flatMap((x) => x.rows)
      const ra = rowsOf(a)
      const rb = rowsOf(b)
      for (let i = 0; i < ra.length; i++) {
        // An unmeasurable row has nothing to read, which is the point of it.
        if (ra[i].unchecked) continue
        // A predicted-zero row stays near zero under scaling; exempt it, since
        // its content is "this is absent" rather than a magnitude.
        if (ra[i].predicted === 0) continue
        if (ra[i].measured === rb[i].measured) {
          inert.push(`${p.name} / ${ra[i].label}`)
        }
      }
    }
    expect(inert.join(SEP)).toBe('')
  })

  it('derived values are never presented as checks', () => {
    for (const p of PRESETS) {
      const entry = mathFor(p.name, contextFor(p))
      for (const b of entry.blocks) {
        if (b.kind !== 'values') continue
        for (const row of b.rows) {
          // A values row carries one number and no comparison, by construction.
          expect(row, `${p.name} / ${row.label}`).not.toHaveProperty('predicted')
          expect(row, `${p.name} / ${row.label}`).not.toHaveProperty('measured')
          expect(Number.isFinite(row.value) || row.value === undefined).toBe(true)
        }
      }
    }
  })
})

describe('preset math follows the controls it exposes', () => {
  // The panel stays on screen while its block's controls are dragged, so a
  // prediction tied to one setting must either follow the control or say why
  // it no longer applies — never show ✗ against correct physics.

  const withParams = (name, over) => {
    const base = PRESETS.find((p) => p.name === name)
    const patch = {
      ...base.patch,
      blocks: base.patch.blocks.map((b) => ({ ...b, params: { ...b.params, ...over } })),
    }
    return contextFor({ ...base, patch })
  }

  const rowIn = (entry, startsWith) =>
    entry.blocks
      .filter((b) => b.kind === 'check')
      .flatMap((b) => b.rows)
      .find((r) => r.label.startsWith(startsWith))

  it('the Gibbs check footnotes itself when the window is tapered', () => {
    const name = 'Cut it off abruptly and it rings'
    // As shipped: a live check that agrees.
    const bare = rowIn(mathFor(name, withParams(name, {})), 'largest |H|')
    expect(bare.unchecked).toBeFalsy()
    expect(Math.abs(bare.measured - bare.predicted)).toBeLessThan(0.05 * bare.predicted)
    // Window switched to hamming: the overshoot is gone BY DESIGN, so the row
    // must footnote rather than fail.
    const tapered = rowIn(mathFor(name, withParams(name, { window: 'hamming' })), 'largest |H|')
    expect(tapered.unchecked).toBeTruthy()
    expect(tapered.measured).toBeLessThan(1.02)
  })

  it('the kernel DC check follows the low-pass/high-pass select', () => {
    const name = 'The kernel is the filter'
    const lp = rowIn(mathFor(name, withParams(name, {})), '|H| at DC')
    expect(lp.predicted).toBe(1)
    expect(lp.measured).toBeCloseTo(1, 2)
    const hp = rowIn(mathFor(name, withParams(name, { mode: 'highpass' })), '|H| at DC')
    expect(hp.predicted).toBe(0)
    expect(hp.measured).toBeLessThan(0.01)
  })

  it('the moving-average rows follow the tap count', () => {
    const name = 'A moving average is a filter'
    const at12 = rowIn(mathFor(name, withParams(name, { taps: 12 })), '|H| at the first null')
    expect(at12.label).toContain('666.7')
    expect(at12.measured).toBeLessThan(0.02)
  })
})
