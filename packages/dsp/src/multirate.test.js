import { describe, it, expect } from 'vitest'
import {
  convolveFir,
  decimate,
  designDecimationFir,
  designInterpolationFir,
  downsample,
  expandTaps,
  interpolate,
  makeDecimateHold,
  makeInterpolateFill,
  multirateCost,
  polyphase,
  polyphaseDecimate,
  polyphaseInterpolate,
  upsample,
} from './multirate.js'
import { designFir, firResponse, makeFir } from './fir.js'
import { hash01, render } from './signals.js'
import { spectrum } from './spectrum.js'

// The multirate invariants, fuzzed.
//
// Three of them are exact identities rather than approximations, and the tests
// say so by comparing bit patterns rather than by allowing a tolerance. Where a
// tolerance is unavoidable it is because the same products are added in a
// different order, and that case is separated from the exact one on purpose.

const noise = (n, seed) => Float64Array.from({ length: n }, (_, i) => 2 * hash01(i, seed) - 1)
const SR = 48000

/** Coefficients that are exact binary fractions, so no sum can lose a bit. */
const dyadic = (n, seed) =>
  Float64Array.from({ length: n }, (_, i) => Math.round(16 * (2 * hash01(i, seed) - 1)) / 16)

describe('convolveFir is the filter the rest of the package already runs', () => {
  it('agrees with makeFir sample for sample, to the last bit', () => {
    const x = noise(400, 3)
    const h = designFir({ mode: 'lowpass', taps: 21, freq: 5000 }, SR)
    const step = makeFir(h)
    const a = convolveFir(x, h)
    for (let i = 0; i < x.length; i++) expect(step(x[i]), `i=${i}`).toBe(a[i])
  })
})

describe('the noble identities hold exactly', () => {
  // Identity 1: downsample by M then H(z)  ==  H(z^M) then downsample by M.
  for (const M of [2, 3, 4, 5, 8]) {
    it(`M = ${M}: decimation commutes with the expanded filter, bit for bit`, () => {
      for (const seed of [1, 2, 3]) {
        const x = noise(311, seed)
        const h = designFir({ mode: 'lowpass', taps: 9 + 2 * seed, freq: 4000, window: 'hann' }, SR)
        const a = convolveFir(downsample(x, M), h)
        const b = downsample(convolveFir(x, expandTaps(h, M)), M)
        expect(a.length).toBe(b.length)
        for (let i = 0; i < a.length; i++) expect(a[i], `seed=${seed} i=${i}`).toBe(b[i])
      }
    })
  }

  // Identity 2: H(z) then upsample by L  ==  upsample by L then H(z^L).
  for (const L of [2, 3, 4, 7]) {
    it(`L = ${L}: interpolation commutes with the expanded filter, bit for bit`, () => {
      for (const seed of [4, 5, 6]) {
        const x = noise(157, seed)
        const h = designFir({ mode: 'lowpass', taps: 11 + 2 * seed, freq: 3000 }, SR)
        const a = upsample(convolveFir(x, h), L)
        const b = convolveFir(upsample(x, L), expandTaps(h, L))
        for (let i = 0; i < a.length; i++) expect(a[i], `seed=${seed} i=${i}`).toBe(b[i])
      }
    })
  }

  it('the expanded filter repeats its response L times around the circle', () => {
    const h = designFir({ mode: 'lowpass', taps: 25, freq: 4000 }, SR)
    const L = 4
    const g = expandTaps(h, L)
    for (let i = 0; i <= 40; i++) {
      const f = (i * SR) / (2 * L * 40)
      // H(z^L) at f is H(z) at L*f, which is what "repeats L times" means.
      expect(firResponse(g, f, SR)).toBeCloseTo(firResponse(h, L * f, SR), 10)
    }
  })
})

describe('polyphase forms are the same arithmetic, regrouped', () => {
  it('a polyphase decimator equals filter-then-downsample, bit for bit on a dyadic kernel', () => {
    for (const M of [2, 3, 4, 6]) {
      const h = dyadic(4 * M + 3, M)
      const x = Float64Array.from({ length: 200 }, (_, i) => Math.round(8 * (2 * hash01(i, 21) - 1)) / 8)
      const a = decimate(x, M, h)
      const b = polyphaseDecimate(x, M, h)
      expect(a.length).toBe(b.length)
      for (let i = 0; i < a.length; i++) expect(a[i], `M=${M} i=${i}`).toBe(b[i])
    }
  })

  it('and equals it to rounding on a designed kernel, which reassociates the sum', () => {
    for (const M of [2, 3, 5, 8]) {
      const h = designDecimationFir({ M, taps: 41 }, SR)
      const x = noise(600, M)
      const a = decimate(x, M, h)
      const b = polyphaseDecimate(x, M, h)
      let worst = 0
      let scale = 0
      for (let i = 0; i < a.length; i++) {
        worst = Math.max(worst, Math.abs(a[i] - b[i]))
        scale = Math.max(scale, Math.abs(a[i]))
      }
      expect(worst / scale, `M=${M}`).toBeLessThan(1e-12)
    }
  })

  it('a polyphase interpolator equals zero-stuff-then-filter', () => {
    for (const L of [2, 3, 4, 6]) {
      const h = designInterpolationFir({ L, taps: 33 }, SR)
      const x = noise(150, L + 10)
      const a = interpolate(x, L, h)
      const b = polyphaseInterpolate(x, L, h)
      expect(b.length).toBe(x.length * L)
      for (let i = 0; i < b.length; i++) expect(b[i], `L=${L} i=${i}`).toBeCloseTo(a[i], 12)
    }
  })

  it('deals every tap out exactly once', () => {
    const h = Float64Array.from({ length: 23 }, (_, i) => i + 1)
    const parts = polyphase(h, 4)
    const back = []
    parts.forEach((e, p) => e.forEach((v, q) => (back[q * 4 + p] = v)))
    expect(back).toEqual(Array.from(h))
  })

  it('costs exactly M times less per output, whatever the length', () => {
    for (const taps of [17, 41, 101]) {
      for (const factor of [2, 4, 10]) {
        const c = multirateCost({ taps, factor, sampleRate: SR })
        expect(c.ratio).toBe(factor)
        expect(c.direct / c.polyphase).toBeCloseTo(factor, 12)
      }
    }
  })
})

describe('what a rate change does to a spectrum', () => {
  const src = (freq) => [{ id: 1, type: 'sine', freq, amp: 1, phase: 0, enabled: true }]

  it('folds an out-of-band tone without an anti-alias filter, and removes it with one', () => {
    // 5 kHz at fs = 48 kHz, decimated by 4: the new Nyquist is 6 kHz, so 5 kHz
    // survives. 8 kHz is above it and folds to 12 - 8 = 4 kHz.
    const M = 4
    const n = 8192
    const run = (freq, h) => {
      const x = render(src(freq), n, SR)
      const d = makeDecimateHold({ M, h })
      const y = new Float64Array(n)
      for (let i = 0; i < n; i++) y[i] = d.process(x[i])
      return spectrum(y, SR, 'hann')
    }
    const at = (s, f) => {
      let bi = 0
      for (let i = 1; i < s.freqs.length; i++) {
        if (Math.abs(s.freqs[i] - f) < Math.abs(s.freqs[bi] - f)) bi = i
      }
      let m = 0
      for (let i = Math.max(0, bi - 2); i <= Math.min(s.amps.length - 1, bi + 2); i++) {
        m = Math.max(m, s.amps[i])
      }
      return m
    }

    const bare = run(8000, null)
    expect(at(bare, 4000)).toBeGreaterThan(0.2)

    const h = designDecimationFir({ M, taps: 121, window: 'blackman' }, SR)
    const guarded = run(8000, h)
    expect(at(guarded, 4000)).toBeLessThan(at(bare, 4000) / 100)
  })

  it('zero stuffing puts images in, and the interpolation filter takes them out', () => {
    const L = 4
    const n = 8192
    const run = (fill, h) => {
      const x = render(src(1000), n, SR)
      const u = makeInterpolateFill({ L, fill, h })
      const y = new Float64Array(n)
      for (let i = 0; i < n; i++) y[i] = u.process(x[i])
      return spectrum(y, SR, 'hann')
    }
    const at = (s, f) => {
      let bi = 0
      for (let i = 1; i < s.freqs.length; i++) {
        if (Math.abs(s.freqs[i] - f) < Math.abs(s.freqs[bi] - f)) bi = i
      }
      let m = 0
      for (let i = Math.max(0, bi - 2); i <= Math.min(s.amps.length - 1, bi + 2); i++) {
        m = Math.max(m, s.amps[i])
      }
      return m
    }

    // The signal is on a grid L times coarser, so its rate is 12 kHz and the
    // images of a 1 kHz tone sit at 12 - 1, 12 + 1, 24 - 1 kHz and so on.
    const zeros = run('zeros', null)
    expect(at(zeros, 11000)).toBeGreaterThan(at(zeros, 1000) / 4)

    const h = designInterpolationFir({ L, taps: 121, window: 'blackman' }, SR)
    const filtered = run('filter', h)
    expect(at(filtered, 11000)).toBeLessThan(at(zeros, 11000) / 100)
    // ...and the interpolation filter's gain of L puts the amplitude back.
    expect(at(filtered, 1000)).toBeGreaterThan(0.8)
  })
})

describe('upsample and downsample are each other only in one direction', () => {
  it('down after up returns the original exactly', () => {
    const x = noise(64, 12)
    const back = downsample(upsample(x, 5), 5)
    for (let i = 0; i < x.length; i++) expect(back[i]).toBe(x[i])
  })

  it('up after down does not, and the samples it lost are the reason', () => {
    const x = noise(64, 13)
    const back = upsample(downsample(x, 4), 4)
    let differing = 0
    for (let i = 0; i < x.length; i++) if (back[i] !== x[i]) differing++
    expect(differing).toBe(48)
  })
})
