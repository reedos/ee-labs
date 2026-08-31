import { describe, it, expect } from 'vitest'
import katex from 'katex'
import { sourceMath, blockMath } from './math-parts.js'
import { agrees } from '@ee-labs/explain'
import { BLOCK_TYPES, makeBlockRecord } from './dsp/blocks.js'
import { designBiquad, WAVEFORMS } from '@ee-labs/dsp'

// The source and block panels explain whatever the reader has built, rather
// than only the presets we shipped, so they have to hold for every waveform and
// every block — not just the combinations that happen to appear in a preset.

const SR = 8000
const CTX = { sampleRate: SR, fftSize: 2048 }

const src = (over = {}) => ({ id: 1, type: 'sine', freq: 250, amp: 1, phase: 0, enabled: true, ...over })

const rowsOf = (entry, kind) =>
  entry.blocks.filter((b) => b.kind === kind).flatMap((b) => b.rows)

const checkFailures = (entry, label) => {
  const out = []
  for (const r of rowsOf(entry, 'check')) {
    if (r.unchecked) continue
    const { predicted, measured, tol = 0.02, abs = 0 } = r
    if (!Number.isFinite(predicted) || !Number.isFinite(measured)) {
      out.push(`${label} / ${r.label}: non-finite`)
    } else if (!agrees({ predicted, measured, tol, abs })) {
      out.push(
        `${label} / ${r.label}: theory ${predicted.toPrecision(5)} vs measured ${measured.toPrecision(5)}`,
      )
    }
  }
  return out
}

const texFailures = (entry, label) => {
  const out = []
  for (const b of entry.blocks) {
    if (b.kind !== 'formula') continue
    try {
      katex.renderToString(b.tex, { throwOnError: true, strict: 'error' })
    } catch (e) {
      out.push(`${label}: ${b.tex} — ${e.message}`)
    }
  }
  return out
}

describe('source math', () => {
  it('covers every waveform the source menu offers', () => {
    for (const type of WAVEFORMS) {
      expect(sourceMath(src({ type }), CTX), type).not.toBeNull()
    }
  })

  it('typesets for every waveform', () => {
    const bad = []
    for (const type of WAVEFORMS) bad.push(...texFailures(sourceMath(src({ type }), CTX), type))
    expect(bad.join('\n  ')).toBe('')
  })

  it('predicts RMS and crest factor correctly for every periodic waveform', () => {
    // Each is a genuine comparison: a closed form against the samples the
    // generator actually produced. This is the check that would have caught the
    // square wave sitting 17 samples high and 15 low in every period.
    const bad = []
    for (const type of WAVEFORMS) {
      for (const amp of [0.25, 1, 1.5]) {
        for (const freq of [125, 250, 1000]) {
          bad.push(...checkFailures(sourceMath(src({ type, amp, freq }), CTX), `${type} ${amp} ${freq}Hz`))
        }
      }
    }
    expect(bad.join('\n  ')).toBe('')
  })

  it('knows the crest factor of each shape', () => {
    // Spot-check the values themselves, so a wrong constant cannot pass just by
    // being wrong in both columns.
    const crestOf = (type) =>
      rowsOf(sourceMath(src({ type }), CTX), 'check').find((r) => r.label === 'crest factor')
        .predicted
    expect(crestOf('square')).toBeCloseTo(1, 6)
    expect(crestOf('sine')).toBeCloseTo(Math.SQRT2, 6)
    expect(crestOf('triangle')).toBeCloseTo(Math.sqrt(3), 6)
    expect(crestOf('sawtooth')).toBeCloseTo(Math.sqrt(3), 6)
  })

  it('states the fold: a sine above Nyquist is measured AT its alias', () => {
    // 5.2 kHz sampled at 8 kHz: the check row must predict 2.8 kHz and the
    // measured side must find the spectrum's biggest line there.
    const entry = sourceMath(src({ type: 'sine', freq: 5200 }), CTX)
    const row = rowsOf(entry, 'check').find((r) => r.label.startsWith('appears folded'))
    expect(row).toBeTruthy()
    expect(row.predicted).toBeCloseTo(2800, 6)
    expect(Math.abs(row.measured - row.predicted)).toBeLessThanOrEqual(row.abs)
  })

  it('places the first folded harmonic between the comb when fs/f0 is not simple', () => {
    // f0 on a measuring-frame bin centre but NOT dividing fs: the fold of the
    // first above-Nyquist harmonic lands between harmonics, and the value
    // row says so. 273.4375 Hz = 140 bins of 8000/4096; k = 15 crosses
    // Nyquist (4101.6 Hz) and folds to 3898.4 Hz.
    const f0 = 273.4375
    const entry = sourceMath(src({ type: 'square', freq: f0 }), CTX)
    const rows = rowsOf(entry, 'values')
    const kRow = rows.find((r) => r.label === 'first harmonic past Nyquist')
    const fRow = rows.find((r) => r.label === 'it folds back to')
    expect(kRow.value).toBe(15)
    expect(fRow.value).toBeCloseTo(8000 - 15 * f0, 6)
    expect(fRow.note).toMatch(/between harmonics/)
    // And the amplitude check must hold there too (bin-centred, so checked).
    expect(checkFailures(entry, 'square off-comb')).toEqual([])
  })

  it('names the hidden fold when fs/f0 is an integer', () => {
    // 250 Hz at 8 kHz: every fold lands exactly on a lower harmonic, so no
    // new line appears - the row must say the comb hides them, not imply a
    // visible spur that is not there.
    const entry = sourceMath(src({ type: 'square', freq: 250 }), CTX)
    const fRow = rowsOf(entry, 'values').find((r) => r.label === 'it folds back to')
    expect(fRow.note).toMatch(/exactly onto a lower harmonic/)
  })

  it('does not count periods for noise, which has none', () => {
    // The frequency control is not even read by the noise generator, so
    // "samples per period" and "bins per period" were describing nothing.
    const labels = rowsOf(sourceMath(src({ type: 'noise', freq: 100 }), CTX), 'values').map(
      (r) => r.label,
    )
    expect(labels).not.toContain('samples per period')
    expect(labels).not.toContain('bins per period')
    // ...but a periodic source still gets them.
    const sine = rowsOf(sourceMath(src({ type: 'sine' }), CTX), 'values').map((r) => r.label)
    expect(sine).toContain('samples per period')
  })

  it('says a tone at or above Nyquist is an alias', () => {
    const e = sourceMath(src({ freq: 4000 }), CTX)
    const text = e.blocks.filter((b) => b.kind === 'text').map((b) => b.text).join(' ')
    expect(text).toMatch(/alias/i)
  })

  describe('a band-limited square', () => {
    // 125 Hz is bin 64 of 8000/4096, so every odd harmonic lands on a bin
    // centre and the panel's amplitude check is a real comparison.
    // `K` is the highest odd harmonic kept.
    const bl = (K, over = {}) =>
      sourceMath(src({ type: 'square', freq: 125, topHarmonic: K, ...over }), CTX)

    it('checks out numerically for every partial count that fits', () => {
      const bad = []
      for (const K of [1, 3, 5, 9, 17, 31]) bad.push(...checkFailures(bl(K), `square k=${K}`))
      expect(bad).toEqual([])
    })

    it('renders valid TeX for the truncated series', () => {
      for (const K of [1, 7, 31]) expect(texFailures(bl(K), `k=${K}`)).toEqual([])
      const tex = bl(7).blocks.find((b) => b.kind === 'formula').tex
      expect(tex).toMatch(/sum/)
      expect(tex).toMatch(/odd/)
      expect(tex).toContain('{7}') // the sum's upper limit IS the harmonic
    })

    it('predicts the truncated RMS, not A', () => {
      const row = rowsOf(bl(5, { amp: 2 }), 'check').find((r) => r.label === 'RMS')
      let acc = 0
      for (let k = 1; k <= 5; k += 2) acc += 1 / (k * k)
      expect(row.predicted).toBeCloseTo(2 * (4 / Math.PI) * Math.sqrt(acc / 2), 9)
      expect(row.predicted).toBeLessThan(2) // strictly under the naive square's A
    })

    it('declines to predict the crest factor, because Gibbs owns it', () => {
      const row = rowsOf(bl(15), 'check').find((r) => r.label === 'crest factor')
      expect(row.predicted).toBeNull()
      expect(row.unchecked).toMatch(/Gibbs/)
      // ...but the naive square still claims its exact 1.
      expect(rowsOf(bl(0), 'check').find((r) => r.label === 'crest factor').predicted).toBe(1)
    })

    it('reports nothing folding, because nothing is left above the top harmonic', () => {
      const labels = rowsOf(bl(7), 'values').map((r) => r.label)
      expect(labels).not.toContain('first harmonic past Nyquist')
      expect(labels).not.toContain('it folds back to')
      // The naive square at the same frequency does fold, and still says so.
      expect(rowsOf(bl(0), 'values').map((r) => r.label)).toContain('it folds back to')
    })

    it('names the rate the top harmonic demands and whether it is met', () => {
      // The 7th harmonic of 125 Hz is 875 Hz, needing fs > 1750 Hz. At 8 kHz
      // that clears.
      const rows = rowsOf(bl(7), 'values')
      expect(rows.find((r) => r.label === 'highest harmonic (7·f₀)').value).toBeCloseTo(875, 9)
      expect(rows.find((r) => r.label === 'rate this demands').value).toBeCloseTo(1750, 9)
      expect(rows.find((r) => r.label === 'rate in use').note).toMatch(/clears it/)

      // The 39th is 4875 Hz, past the 4 kHz Nyquist.
      const tight = rowsOf(bl(39), 'values')
      expect(tight.find((r) => r.label === 'rate this demands').value).toBeCloseTo(9750, 9)
      expect(tight.find((r) => r.label === 'rate in use').note).toMatch(/short by/)
      // And the harmonic it names has folded, so the panel must not claim to
      // have measured it.
      const amp = rowsOf(bl(39), 'check').find((r) => /39th harmonic/.test(r.label))
      expect(amp.unchecked).toMatch(/above Nyquist/)
    })

    it('is strict at exactly twice the top harmonic, not merely equal', () => {
      // fs = 2*fmax is the degenerate case, not a passing one: the samples
      // land at a fixed phase of the top harmonic and can miss it entirely.
      const at = sourceMath(src({ type: 'square', freq: 125, topHarmonic: 63 }), {
        ...CTX,
        sampleRate: 2 * 63 * 125,
      })
      const note = rowsOf(at, 'values').find((r) => r.label === 'rate in use').note
      expect(note).not.toMatch(/clears it/)
      expect(note).not.toMatch(/short by 0/)
      expect(note).toMatch(/exactly twice it/)
      // One hair above, and it passes.
      const above = sourceMath(src({ type: 'square', freq: 125, topHarmonic: 63 }), {
        ...CTX,
        sampleRate: 2 * 63 * 125 + 1,
      })
      expect(rowsOf(above, 'values').find((r) => r.label === 'rate in use').note).toMatch(
        /clears it/,
      )
    })
  })
})

describe('block math', () => {
  const every = Object.keys(BLOCK_TYPES)

  it('covers every block type in the add menu', () => {
    for (const type of every) {
      expect(blockMath(makeBlockRecord(type, 1), CTX), type).not.toBeNull()
    }
  })

  it('typesets for every block type', () => {
    const bad = []
    for (const type of every) {
      bad.push(...texFailures(blockMath(makeBlockRecord(type, 1), CTX), type))
    }
    expect(bad.join('\n  ')).toBe('')
  })

  it('its printed coefficients really are the filter the code runs', () => {
    // The measured column is an impulse pushed through the difference equation
    // and transformed back, NOT biquadResponse called a second time. So this
    // checks that the code implements the algebra the panel is printing, rather
    // than that the algebra was retyped consistently.
    const bad = []
    for (const type of ['lowpass', 'highpass', 'bandpass', 'notch', 'peaking', 'allpass']) {
      for (const freq of [200, 800, 2000]) {
        for (const q of [0.707, 2, 8]) {
          const b = makeBlockRecord(type, 1)
          b.params = { ...b.params, freq, q }
          bad.push(...checkFailures(blockMath(b, CTX), `${type} ${freq}Hz Q${q}`))
        }
      }
    }
    expect(bad.join('\n  ')).toBe('')
  })

  it('reports the pole radius and flags stability', () => {
    const radiusOf = (freq, q) => {
      const b = makeBlockRecord('lowpass', 1)
      b.params = { ...b.params, freq, q }
      return rowsOf(blockMath(b, CTX), 'values').find((r) => r.label === 'pole radius r')
    }
    for (const [freq, q] of [[200, 0.707], [800, 4], [2000, 20]]) {
      const r = radiusOf(freq, q)
      expect(r.value, `${freq}/${q}`).toBeGreaterThan(0)
      expect(r.value, `${freq}/${q}`).toBeLessThan(1)
      expect(r.note).toMatch(/stable/)
    }
    // A higher Q sits closer to the unit circle and rings for longer.
    expect(radiusOf(800, 20).value).toBeGreaterThan(radiusOf(800, 0.707).value)
  })

  it('derived value rows never masquerade as checks', () => {
    for (const type of every) {
      for (const row of rowsOf(blockMath(makeBlockRecord(type, 1), CTX), 'values')) {
        expect(row, `${type} / ${row.label}`).not.toHaveProperty('predicted')
        expect(row, `${type} / ${row.label}`).not.toHaveProperty('measured')
      }
    }
  })
})

// Malformed TeX with a swallowed backslash ("rac{1}{2}", a literal tab) still
// TYPESETS — KaTeX renders the wreckage as ordinary letters without throwing —
// so the strict-mode test cannot see it. Control characters can only get into
// a formula by that route, so their absence is the checkable proxy.
describe('formulas contain no mangled escapes', () => {
  it('no control characters or orphaned frac/tan/cos in any block formula', () => {
    const bad = []
    for (const type of Object.keys(BLOCK_TYPES)) {
      const variants = [{}]
      if (type === 'lowpass' || type === 'highpass') {
        variants.push({ order: '1' }, { order: '4' })
      }
      for (const over of variants) {
        const b = makeBlockRecord(type, 1)
        b.params = { ...b.params, ...over }
        const entry = blockMath(b, CTX)
        for (const blk of entry.blocks) {
          if (blk.kind !== 'formula') continue
          if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(blk.tex)) {
            bad.push(`${type} ${JSON.stringify(over)}: control char in "${blk.tex.slice(0, 50)}"`)
          }
        }
      }
    }
    expect(bad.join('\n  ')).toBe('')
  })

  it('order-1 and order-4 panels check out against their own measurements', () => {
    const bad = []
    for (const mode of ['lowpass', 'highpass']) {
      for (const order of ['1', '4']) {
        const b = makeBlockRecord(mode, 1)
        b.params = { ...b.params, freq: 800, order }
        bad.push(...checkFailures(blockMath(b, CTX), `${mode} order ${order}`))
      }
    }
    expect(bad.join('\n  ')).toBe('')
  })
})

describe('the raw biquad states its roots', () => {
  it('the RC arrival reads: one real pole, one zero at Nyquist, order 1', () => {
    const b = makeBlockRecord('biquad', 1)
    b.params = { b0: 0.0253863, b1: 0.0253863, b2: 0, a1: -0.949227, a2: 0 }
    const entry = blockMath(b, { sampleRate: 192000, nyquist: 96000, fftSize: 2048 })
    const vals = rowsOf(entry, 'values')
    const pole = vals.find((r) => r.label.startsWith('pole at z = 0.9492'))
    expect(pole, 'the real pole, stated with its value').toBeTruthy()
    expect(pole.note).toContain('no ringing')
    const zero = vals.find((r) => r.label.startsWith('zero at z = -1'))
    expect(zero, 'the bilinear zero at Nyquist, stated').toBeTruthy()
    expect(zero.note).toContain('Nyquist')
    expect(vals.find((r) => r.label === 'order of this filter').value).toBe(1)
    // And the on-circle zero is PROMISED, then measured: |H(Nyquist)| = 0.
    const nulls = rowsOf(entry, 'check').filter((r) => r.label.includes('on-circle zero'))
    expect(nulls).toHaveLength(1)
    expect(nulls[0].measured).toBeLessThan(1e-6)
  })

  it('a resonant pair reads as radius, angle, and the frequency it rings at', () => {
    const co = designBiquad({ mode: 'lowpass', freq: 2000, q: 8 }, 48000)
    const b = makeBlockRecord('biquad', 1)
    b.params = { ...co }
    const entry = blockMath(b, { sampleRate: 48000, nyquist: 24000, fftSize: 2048 })
    const pair = rowsOf(entry, 'values').find((r) => r.label.startsWith('pole pair'))
    expect(pair, 'complex poles reported as a pair').toBeTruthy()
    // The pair's angle-frequency sits near the design frequency (damped
    // slightly below it — the pole rings at fd, not f0).
    expect(pair.value).toBeGreaterThan(1800)
    expect(pair.value).toBeLessThan(2050)
    expect(pair.note).toContain('rings')
  })

  it('the factored H(z) typesets and matches the coefficients it came from', () => {
    const co = designBiquad({ mode: 'notch', freq: 3000, q: 4 }, 48000)
    const b = makeBlockRecord('biquad', 1)
    b.params = { ...co }
    const entry = blockMath(b, { sampleRate: 48000, nyquist: 24000, fftSize: 2048 })
    const factored = entry.blocks.find((x) => x.kind === 'formula' && x.tex.includes('frac'))
    expect(factored).toBeTruthy()
    // A notch's zeros are ON the circle: the check rows must promise the null.
    const nulls = rowsOf(entry, 'check').filter((r) => r.label.includes('on-circle zero'))
    expect(nulls).toHaveLength(1)
    expect(nulls[0].measured).toBeLessThan(1e-6)
  })
})

describe('the "fits" chip names a real harmonic, not a vague one', () => {
  // The chip offers the highest odd harmonic still under Nyquist. It replaced
  // an "all" option, which was both vague and misleading: "all" is not a
  // larger count, it is the ideal square — a different object whose trace
  // looks CLEANER than a band-limited one because the generator samples the
  // shape directly instead of summing terms.
  const fits = (f0, sampleRate) => {
    const n = Math.ceil(sampleRate / 2 / Math.max(f0, 1e-9)) - 1
    return Math.max(1, n < 1 ? 1 : n % 2 === 1 ? n : n - 1)
  }

  it('is odd, and its harmonic really does land under Nyquist', () => {
    for (const f0 of [50, 125, 281.25, 440, 1000]) {
      for (const sr of [8000, 16000, 44100, 48000, 96000]) {
        const k = fits(f0, sr)
        expect(k % 2, `${f0} @ ${sr}`).toBe(1)
        expect(k * f0, `${f0} @ ${sr}`).toBeLessThan(sr / 2)
        // ...and it is the HIGHEST such odd harmonic: the next one does not fit.
        if (k > 1) expect((k + 2) * f0).toBeGreaterThanOrEqual(sr / 2)
      }
    }
  })

  it('never offers 0, which would silently mean the ideal square', () => {
    // A fundamental already at or past Nyquist has no harmonic that fits, and
    // returning 0 there would hand back the infinite series under a label
    // promising the opposite.
    for (const f0 of [3999, 4000, 6000, 7999]) expect(fits(f0, 8000)).toBe(1)
  })

  it('matches the panel: at the preset\u2019s own settings it is the 13th', () => {
    expect(fits(281.25, 8000)).toBe(13)
    const e = sourceMath(
      src({ type: 'square', freq: 281.25, topHarmonic: fits(281.25, 8000) }),
      { sampleRate: 8000, fftSize: 2048 },
    )
    const rows = rowsOf(e, 'values')
    expect(rows.find((r) => r.label === 'rate in use').note).toMatch(/clears it/)
    expect(checkFailures(e, 'fits')).toEqual([])
  })
})
