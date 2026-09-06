import { describe, it, expect } from 'vitest'
import { bitReversal, butterfly, dft, fft, fftCost, hash01 } from '@ee-labs/dsp'
import { byId } from '../experiments.js'
import { experimentState } from '../state.js'
import { psdOf, resolvePath } from '../measure.js'
import { LENGTHS, ODD_RECORD, ODD_TONE } from './f.js'

// Group F's numbers, measured against the transform the whole lab runs.
//
// Every expectation is computed from the frame the experiment names. The counts
// come out of the same fftCost the readout reads, the twiddle out of the same
// butterfly the view draws, and the padded bin spacing out of the estimator.

const SR = 48000
const state = (id) => experimentState(byId(id))
const at = (id, extra) => ({ ...state(id), ...extra })

describe('F1: the sum every spectrum has been using', () => {
  it('agrees with the sum it replaces, to a part in 1e-13', () => {
    const n = 256
    const re = Float64Array.from({ length: n }, (_, i) => 2 * hash01(i, 5) - 1)
    const im = new Float64Array(n)
    const slow = dft(re, im)
    const fastRe = Float64Array.from(re)
    const fastIm = new Float64Array(n)
    fft(fastRe, fastIm)
    let worst = 0
    let scale = 0
    for (let k = 0; k < n; k++) {
      scale = Math.max(scale, Math.hypot(slow.re[k], slow.im[k]))
      worst = Math.max(worst, Math.hypot(fastRe[k] - slow.re[k], fastIm[k] - slow.im[k]))
    }
    expect(worst / scale).toBeLessThan(1e-13)
  })

  it('counts the sum at N squared and the transform at N over 2 times log2 N', () => {
    const s = state('f1')
    const c = fftCost(s.fftSize)
    expect(resolvePath('fft.direct', s)).toBe(s.fftSize * s.fftSize)
    expect(resolvePath('fft.butterflies', s)).toBe((s.fftSize / 2) * Math.log2(s.fftSize))
    expect(resolvePath('fft.n', s)).toBe(c.n)
  })
})

describe('F2: the butterfly', () => {
  it('is a sum and a difference where the twiddle is one', () => {
    const s = at('f2', { twiddleK: 0 })
    // Zero here arrives as a negative zero, because sin of minus zero is one.
    // Its magnitude is what the claim is about.
    expect(resolvePath('fft.twiddleRe', s)).toBe(1)
    expect(Math.abs(resolvePath('fft.twiddleIm', s))).toBe(0)
    expect(Math.abs(resolvePath('fft.twiddleDeg', s))).toBe(0)
    const out = butterfly([1, 0], [1, 0], 0, s.fftSize)
    expect(out.x[0]).toBe(2)
    expect(Math.abs(out.x[1])).toBe(0)
    expect(out.y[0]).toBe(0)
    // A twiddle of exactly 1 gives a - b of exactly zero, and the sign of that
    // zero is the sign of the imaginary part it came from.
    expect(Math.abs(out.y[1])).toBe(0)
  })

  it('is a quarter turn at k of N over four', () => {
    const n = state('f2').fftSize
    const s = at('f2', { twiddleK: n / 4 })
    expect(resolvePath('fft.twiddleRe', s)).toBeCloseTo(0, 15)
    expect(resolvePath('fft.twiddleIm', s)).toBeCloseTo(-1, 15)
    expect(resolvePath('fft.twiddleDeg', s)).toBeCloseTo(-90, 12)
    const out = butterfly([1, 0], [1, 0], n / 4, n)
    expect(out.x[0]).toBeCloseTo(1, 15)
    expect(out.x[1]).toBeCloseTo(-1, 15)
    expect(out.y[0]).toBeCloseTo(1, 15)
    expect(out.y[1]).toBeCloseTo(1, 15)
  })

  it('walks the unit circle at minus 360 k over N degrees', () => {
    const n = state('f2').fftSize
    for (const k of [0, n / 8, n / 4, n / 2]) {
      const s = at('f2', { twiddleK: k })
      expect(resolvePath('fft.twiddleDeg', s), `k ${k}`).toBeCloseTo(-(360 * k) / n, 9)
      const re = resolvePath('fft.twiddleRe', s)
      const im = resolvePath('fft.twiddleIm', s)
      expect(Math.hypot(re, im), `k ${k}`).toBeCloseTo(1, 15)
    }
  })
})

describe('F3: bit reversal', () => {
  it('reads eight points in the order the index reversed gives', () => {
    expect(Array.from(bitReversal(8))).toEqual([0, 4, 2, 6, 1, 5, 3, 7])
  })

  it('is its own inverse, at every length the lab offers', () => {
    for (const n of LENGTHS) {
      const p = bitReversal(n)
      const twice = Array.from(p, (i) => p[i])
      expect(twice, `${n} points`).toEqual(Array.from({ length: n }, (_, i) => i))
    }
  })

  it('takes one stage for each halving', () => {
    for (const fftSize of LENGTHS) {
      expect(resolvePath('fft.stages', at('f3', { fftSize })), `${fftSize}`).toBe(Math.log2(fftSize))
    }
  })
})

describe('F4: the saving, counted', () => {
  it('is two N over log2 N, at every length', () => {
    for (const fftSize of LENGTHS) {
      const s = at('f4', { fftSize })
      const ratio = resolvePath('fft.ratio', s)
      expect(ratio, `${fftSize}`).toBeCloseTo((2 * fftSize) / Math.log2(fftSize), 9)
      expect(ratio, `${fftSize}`).toBeCloseTo(
        resolvePath('fft.direct', s) / resolvePath('fft.butterflies', s),
        9,
      )
    }
  })

  it('grows with the frame rather than staying put', () => {
    const ratios = LENGTHS.map((fftSize) => resolvePath('fft.ratio', at('f4', { fftSize })))
    for (let i = 1; i < ratios.length; i++) expect(ratios[i]).toBeGreaterThan(ratios[i - 1])
    // Four times the frame is less than four times the saving, because the
    // stages grow too.
    expect(ratios[1] / ratios[0]).toBeLessThan(4)
    expect(ratios[1] / ratios[0]).toBeGreaterThan(2)
  })
})

describe('F5: why the frame is a power of two', () => {
  it('runs a transform longer than the record it was given', () => {
    const s = state('f5')
    expect(resolvePath('psd.record', s)).toBe(ODD_RECORD)
    expect(resolvePath('psd.padded', s)).toBe(s.fftSize)
    expect(Math.log2(resolvePath('psd.padded', s)) % 1).toBe(0)
    expect(resolvePath('psd.padded', s)).toBeGreaterThan(ODD_RECORD)
  })

  it('reports a bin the record alone would not have predicted', () => {
    const s = state('f5')
    const naive = resolvePath('psd.naive', s)
    const real = resolvePath('psd.df', s)
    expect(naive).toBeCloseTo(SR / ODD_RECORD, 12)
    expect(real).toBeCloseTo(SR / resolvePath('psd.padded', s), 12)
    expect(naive / real).toBeCloseTo(resolvePath('psd.padded', s) / ODD_RECORD, 9)
    // The tone sits on a bin of the record's own grid and on none of the
    // padded one, so the frequency the readout prints moves off it.
    expect(ODD_TONE % naive).toBeCloseTo(0, 9)
    expect(Math.abs(resolvePath('psd.peakHz.4000.5600', s) - ODD_TONE)).toBeGreaterThan(1)
    expect(resolvePath('psd.peakHz.4000.5600', s) % real).toBeCloseTo(0, 6)
  })

  it('pads nothing when the record is already a power of two', () => {
    const clean = at('f5', { record: null })
    expect(resolvePath('psd.naive', clean)).toBe(resolvePath('psd.df', clean))
    expect(resolvePath('psd.padded', clean)).toBe(clean.fftSize)
    // And a shorter power of two is not padded either, it is just shorter.
    const half = at('f5', { record: 2048 })
    expect(resolvePath('psd.padded', half)).toBe(2048)
    expect(resolvePath('psd.naive', half)).toBe(resolvePath('psd.df', half))
    expect(psdOf(half).n).toBe(2048)
  })
})
