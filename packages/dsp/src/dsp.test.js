import { describe, it, expect } from 'vitest'
import { fft, magnitude } from './fft.js'
import { render, rms, peak, sample } from './signals.js'
import { spectrum, windowFn, toDb } from './spectrum.js'

const src = (over = {}) => ({
  type: 'sine',
  freq: 100,
  amp: 1,
  phase: 0,
  enabled: true,
  ...over,
})

describe('fft', () => {
  it('rejects non-power-of-two lengths', () => {
    expect(() => fft(new Float64Array(3), new Float64Array(3))).toThrow(/power of two/)
  })

  it('puts a DC signal entirely in bin 0', () => {
    const n = 16
    const re = new Float64Array(n).fill(2)
    const im = new Float64Array(n)
    fft(re, im)
    const mag = magnitude(re, im)
    expect(mag[0]).toBeCloseTo(2 * n, 10)
    for (let k = 1; k < n; k++) expect(mag[k]).toBeCloseTo(0, 10)
  })

  it('puts a bin-centered sine in exactly that bin and its mirror', () => {
    const n = 64
    const k0 = 5
    const re = new Float64Array(n)
    const im = new Float64Array(n)
    for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * k0 * i) / n)
    fft(re, im)
    const mag = magnitude(re, im)
    // A real sine splits its energy between +k0 and n-k0, each n/2 * amp.
    expect(mag[k0]).toBeCloseTo(n / 2, 8)
    expect(mag[n - k0]).toBeCloseTo(n / 2, 8)
    for (let k = 0; k < n; k++) {
      if (k !== k0 && k !== n - k0) expect(mag[k]).toBeCloseTo(0, 8)
    }
  })

  it('conserves energy (Parseval)', () => {
    const n = 128
    const re = new Float64Array(n)
    const im = new Float64Array(n)
    for (let i = 0; i < n; i++) re[i] = Math.sin(i) + 0.5 * Math.cos(3 * i)
    const timeEnergy = re.reduce((a, v) => a + v * v, 0)
    fft(re, im)
    let freqEnergy = 0
    for (let k = 0; k < n; k++) freqEnergy += re[k] * re[k] + im[k] * im[k]
    expect(freqEnergy / n).toBeCloseTo(timeEnergy, 8)
  })
})

describe('generators', () => {
  const sr = 8000
  const n = 8000 // exactly one second

  // 25 Hz at 8 kHz is 320 samples per cycle. Resolution matters here: a
  // triangle has corners, so its square has a discontinuous derivative and the
  // discrete RMS converges to the analytic value only as O(1/N^2). At 80
  // samples/cycle the error is ~7e-4 — real, expected, and nothing to do with
  // whether the generator is correct. See the convergence test below.
  const f = 25

  it('sine has RMS = A/sqrt(2)', () => {
    const buf = render([src({ freq: f, amp: 2 })], n, sr)
    expect(rms(buf)).toBeCloseTo(2 / Math.SQRT2, 3)
  })

  it('square has RMS = A', () => {
    const buf = render([src({ type: 'square', freq: f, amp: 2 })], n, sr)
    expect(rms(buf)).toBeCloseTo(2, 3)
  })

  it('triangle has RMS = A/sqrt(3)', () => {
    const buf = render([src({ type: 'triangle', freq: f, amp: 2 })], n, sr)
    expect(rms(buf)).toBeCloseTo(2 / Math.sqrt(3), 3)
  })

  it('sawtooth has RMS = A/sqrt(3)', () => {
    const buf = render([src({ type: 'sawtooth', freq: f, amp: 2 })], n, sr)
    expect(rms(buf)).toBeCloseTo(2 / Math.sqrt(3), 3)
  })

  it('triangle RMS converges to A/sqrt(3) as O(1/N^2)', () => {
    // Doubling the sample rate should quarter the error. If this ever drifts,
    // the generator changed shape — a tolerance bump would hide that, so the
    // convergence rate is asserted directly.
    const target = 2 / Math.sqrt(3)
    const err = (spc) => {
      const rate = 100 * spc
      const buf = render(
        [src({ type: 'triangle', freq: 100, amp: 2 })],
        rate,
        rate,
      )
      return Math.abs(rms(buf) - target)
    }
    for (const spc of [40, 80, 160, 320]) {
      expect(err(spc) / err(2 * spc)).toBeCloseTo(4, 1)
    }
  })

  it('respects peak amplitude', () => {
    const buf = render([src({ freq: f, amp: 3 })], n, sr)
    expect(peak(buf)).toBeLessThanOrEqual(3 + 1e-9)
    expect(peak(buf)).toBeCloseTo(3, 3)
  })

  it('skips disabled sources', () => {
    const buf = render([src({ enabled: false })], 64, sr)
    expect(peak(buf)).toBe(0)
  })

  it('sums sources additively', () => {
    const a = render([src({ freq: 100 })], 64, sr)
    const b = render([src({ freq: 250 })], 64, sr)
    const both = render([src({ freq: 100 }), src({ freq: 250 })], 64, sr)
    for (let i = 0; i < 64; i++) expect(both[i]).toBeCloseTo(a[i] + b[i], 12)
  })

  it('phase shifts a sine into a cosine', () => {
    const s = sample('sine', 0, 100, 1, Math.PI / 2)
    expect(s).toBeCloseTo(1, 12)
  })

  it('rejects unknown waveforms', () => {
    expect(() => sample('bogus', 0, 1, 1, 0)).toThrow(/unknown waveform/)
  })
})

describe('band-limited square', () => {
  const sr = 48000
  const n = 8192
  const f0 = sr / n // exactly one bin, so every odd harmonic is on a bin centre
  const bl = (partials, over = {}) =>
    render([src({ type: 'square', freq: f0 * 32, partials, ...over })], n, sr)

  // 32 bins per fundamental, so harmonic k sits in bin 32k.
  const amps = (buf) => {
    const { amps } = spectrum(buf, sr, 'none')
    return amps
  }

  it('one partial is a pure sine at 4/pi', () => {
    const a = amps(bl(1))
    expect(a[32]).toBeCloseTo(4 / Math.PI, 6)
    for (let k = 2; k < 40; k++) expect(a[32 * k]).toBeLessThan(1e-9)
  })

  it('holds every odd harmonic at 4A/(k*pi) and no even ones', () => {
    const a = amps(bl(9, { amp: 0.7 }))
    for (let k = 1; k <= 17; k += 2) {
      expect(a[32 * k]).toBeCloseTo((4 * 0.7) / (k * Math.PI), 6)
    }
    for (let k = 2; k <= 18; k += 2) expect(a[32 * k]).toBeLessThan(1e-9)
  })

  it('stops dead after the (2N-1)th harmonic — nothing above to fold', () => {
    const a = amps(bl(5)) // top harmonic is the 9th
    expect(a[32 * 9]).toBeCloseTo(4 / (9 * Math.PI), 6)
    for (let i = 32 * 9 + 4; i < a.length; i++) expect(a[i]).toBeLessThan(1e-9)
  })

  it('matches the truncated-series RMS in closed form', () => {
    for (const P of [1, 3, 9, 32]) {
      let acc = 0
      for (let m = 0; m < P; m++) acc += 1 / ((2 * m + 1) * (2 * m + 1))
      expect(rms(bl(P))).toBeCloseTo((4 / Math.PI) * Math.sqrt(acc / 2), 6)
    }
  })

  it('overshoots to (2/pi)Si(pi) and stays there — Gibbs', () => {
    // Adding terms does NOT reduce the overshoot, it only narrows it: the peak
    // converges to (2/pi)*Si(pi) = 1.178980*A, which is 8.95% of the 2A jump.
    // That is why the math panel measures the crest factor of a band-limited
    // square instead of predicting it.
    const LIMIT = 1.1789797
    const peaks = [4, 16, 64, 256].map((P) =>
      peak(render([src({ type: 'square', freq: 1, partials: P })], 400000, 400000)),
    )
    // Approached from above, monotonically, and never washing out.
    for (let i = 1; i < peaks.length; i++) expect(peaks[i]).toBeLessThan(peaks[i - 1])
    for (const p of peaks) expect(p).toBeGreaterThan(LIMIT - 1e-4)
    expect(peaks[0]).toBeLessThan(1.19)
    expect(peaks.at(-1)).toBeCloseTo(LIMIT, 4)
  })

  it('converges to the naive square away from the edges', () => {
    const naive = render([src({ type: 'square', freq: 1, partials: 0 })], 4096, 4096)
    const many = render([src({ type: 'square', freq: 1, partials: 400 })], 4096, 4096)
    // Sample a quarter period in, far from either discontinuity.
    for (const i of [1024, 3072]) expect(many[i]).toBeCloseTo(naive[i], 2)
  })

  it('leaves the naive square untouched at partials = 0', () => {
    const a = render([src({ type: 'square', freq: 250, partials: 0 })], 256, sr)
    const b = render([src({ type: 'square', freq: 250 })], 256, sr)
    for (let i = 0; i < 256; i++) expect(a[i]).toBe(b[i])
    for (const v of a) expect(Math.abs(v)).toBe(1)
  })

  it('band-limits only the square, not the other waveforms', () => {
    for (const type of ['sine', 'triangle', 'sawtooth']) {
      const a = render([src({ type, freq: 250, partials: 4 })], 256, sr)
      const b = render([src({ type, freq: 250 })], 256, sr)
      for (let i = 0; i < 256; i++) expect(a[i]).toBe(b[i])
    }
  })
})

describe('windows', () => {
  it('rectangular is all ones', () => {
    const w = windowFn('none', 8)
    for (const v of w) expect(v).toBe(1)
  })

  it('hann starts and ends at zero', () => {
    const w = windowFn('hann', 64)
    expect(w[0]).toBeCloseTo(0, 12)
    expect(w[63]).toBeCloseTo(0, 12)
    expect(w[32]).toBeGreaterThan(0.9)
  })

  it('rejects unknown windows', () => {
    expect(() => windowFn('bogus', 8)).toThrow(/unknown window/)
  })
})

describe('spectrum', () => {
  const sr = 8000
  const n = 4096

  // 8000/4096 = 1.953125 Hz per bin; 250 Hz is exactly bin 128.
  const onBin = 250

  it('reads back the true amplitude of a bin-centered sine', () => {
    for (const windowName of ['none', 'hann', 'hamming', 'blackman']) {
      const buf = render([src({ freq: onBin, amp: 1.5 })], n, sr)
      const { amps } = spectrum(buf, sr, windowName)
      expect(Math.max(...amps)).toBeCloseTo(1.5, 2)
    }
  })

  it('locates the peak at the right frequency', () => {
    const buf = render([src({ freq: onBin })], n, sr)
    const { freqs, amps } = spectrum(buf, sr, 'hann')
    let iMax = 0
    for (let i = 1; i < amps.length; i++) if (amps[i] > amps[iMax]) iMax = i
    expect(freqs[iMax]).toBeCloseTo(onBin, 6)
  })

  it('resolves two tones separately', () => {
    const buf = render(
      [src({ freq: 250, amp: 1 }), src({ freq: 1000, amp: 0.5 })],
      n,
      sr,
    )
    const { freqs, amps } = spectrum(buf, sr, 'hann')
    const at = (f) => {
      let best = 0
      for (let i = 1; i < amps.length; i++) {
        if (Math.abs(freqs[i] - f) < Math.abs(freqs[best] - f)) best = i
      }
      return amps[best]
    }
    expect(at(250)).toBeCloseTo(1, 2)
    expect(at(1000)).toBeCloseTo(0.5, 2)
  })

  it('puts a square wave odd harmonics at 4A/(n*pi)', () => {
    const f0 = 250
    const buf = render([src({ type: 'square', freq: f0, amp: 1 })], n, sr)
    const { freqs, amps } = spectrum(buf, sr, 'hann')
    const at = (f) => {
      let best = 0
      for (let i = 1; i < amps.length; i++) {
        if (Math.abs(freqs[i] - f) < Math.abs(freqs[best] - f)) best = i
      }
      return amps[best]
    }
    // Fourier series of a square wave: odd harmonics only, 4A/(k*pi) — but a
    // SAMPLED square is not quite that. Summing 32 samples per period instead
    // of integrating adds a (k*pi/N)/sin(k*pi/N) factor, which is +0.16% at the
    // fundamental and +4.1% by the 5th. Asserting the continuous value to two
    // places was loose enough to pass either way, and hid a generator bug that
    // put 17 samples high and 15 low in every period.
    const N = sr / f0
    const ideal = (k) => (4 / (k * Math.PI)) * ((k * Math.PI) / N / Math.sin((k * Math.PI) / N))
    expect(at(f0) / ideal(1)).toBeCloseTo(1, 2)
    expect(at(3 * f0) / ideal(3)).toBeCloseTo(1, 2)
    expect(at(5 * f0) / ideal(5)).toBeCloseTo(1, 2)
    // Even harmonics are absent — and now genuinely absent, not merely small.
    expect(at(2 * f0)).toBeLessThan(1e-6)
    expect(at(4 * f0)).toBeLessThan(1e-6)
  })

  it('reports DC in bin 0 without doubling it', () => {
    const buf = new Float64Array(n).fill(0.75)
    const { freqs, amps } = spectrum(buf, sr, 'none')
    expect(freqs[0]).toBe(0)
    expect(amps[0]).toBeCloseTo(0.75, 6)
  })

  it('folds an above-Nyquist tone back down as aliasing', () => {
    // 7000 Hz sampled at 8000 aliases to |7000 - 8000| = 1000 Hz.
    const buf = render([src({ freq: 7000, amp: 1 })], n, sr)
    const { freqs, amps } = spectrum(buf, sr, 'hann')
    let iMax = 0
    for (let i = 1; i < amps.length; i++) if (amps[i] > amps[iMax]) iMax = i
    expect(freqs[iMax]).toBeCloseTo(1000, 0)
  })
})

describe('toDb', () => {
  it('maps unity to 0 dB', () => {
    expect(toDb(1)).toBeCloseTo(0, 12)
  })

  it('maps a half-amplitude to about -6 dB', () => {
    expect(toDb(0.5)).toBeCloseTo(-6.0206, 3)
  })

  it('floors silence instead of returning -Infinity', () => {
    expect(toDb(0)).toBe(-120)
    expect(Number.isFinite(toDb(0))).toBe(true)
  })
})
