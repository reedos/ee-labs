import { describe, it, expect } from 'vitest'
import katex from 'katex'
import { sourceMath, blockMath } from './math-parts.js'
import { agrees } from '@ee-labs/explain'
import { BLOCK_TYPES, makeBlockRecord } from './dsp/blocks.js'
import { WAVEFORMS } from '@ee-labs/dsp'

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
