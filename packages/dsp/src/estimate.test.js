import { describe, it, expect } from 'vitest'
import {
  arOrderCriteria,
  arSpectrum,
  arYuleWalker,
  bandStats,
  bartlett,
  bitReversal,
  butterfly,
  dft,
  fftCost,
  levinson,
  periodogram,
  welch,
  windowPower,
} from './estimate.js'
import { fft } from './fft.js'
import { windowFn } from './spectrum.js'
import { hash01 } from './signals.js'

const SR = 8000
const white = (n, seed) => Float64Array.from({ length: n }, (_, i) => 2 * hash01(i, seed) - 1)
const power = (x) => x.reduce((a, v) => a + v * v, 0) / x.length

// Uniform noise on [-1, 1) has variance 1/3, so its one-sided density is
// 2 * (1/3) / fs. Every scaling check below is against that number.
const TRUE_VARIANCE = 1 / 3
const TRUE_DENSITY = (2 * TRUE_VARIANCE) / SR

describe('the density scaling is a property, not a convention', () => {
  it('integrates to the mean power of the record', () => {
    for (const n of [1024, 4096]) {
      for (const window of ['none', 'hann', 'blackman']) {
        const x = white(n, n + 1)
        const p = periodogram(x, SR, { window })
        let acc = 0
        for (let k = 0; k < p.psd.length; k++) acc += p.psd[k] * p.df
        // Windowed, so the power measured is the windowed record's.
        const w = windowFn(window, n)
        const wp = x.reduce((a, v, i) => a + (v * w[i]) ** 2, 0) / windowPower(w)
        expect(acc, `${n} ${window}`).toBeCloseTo(wp, 9)
      }
    }
  })

  it('reads the right level for white noise, whatever the window', () => {
    const x = white(16384, 9)
    for (const window of ['none', 'hann', 'hamming', 'blackman']) {
      const p = periodogram(x, SR, { window })
      const st = bandStats(p, 500, 3500)
      expect(st.mean / TRUE_DENSITY, window).toBeGreaterThan(0.9)
      expect(st.mean / TRUE_DENSITY, window).toBeLessThan(1.1)
    }
  })
})

describe('the periodogram does not improve with the length of the record', () => {
  it('its scatter stays at about the density itself, at every length', () => {
    for (const n of [1024, 4096, 16384, 65536]) {
      const p = periodogram(white(n, 5), SR)
      const st = bandStats(p, 500, 3500)
      // The estimate at each bin is exponentially distributed, so its standard
      // deviation equals its mean and this ratio is 1 whatever n is.
      expect(st.cv, `n=${n}`).toBeGreaterThan(0.85)
      expect(st.cv, `n=${n}`).toBeLessThan(1.15)
    }
  })

  it('what a longer record buys is resolution, and only that', () => {
    const a = periodogram(white(4096, 5), SR)
    const b = periodogram(white(65536, 5), SR)
    expect(a.df / b.df).toBeCloseTo(16, 6)
    expect(Math.abs(bandStats(a, 500, 3500).cv - bandStats(b, 500, 3500).cv)).toBeLessThan(0.2)
  })
})

describe('averaging trades resolution for scatter, and the rate is 1 over root K', () => {
  const x = white(65536, 5)

  it('Bartlett: K abutting segments cut the scatter by root K', () => {
    for (const K of [4, 16, 64, 256]) {
      const b = bartlett(x, SR, { segments: K })
      expect(b.segments).toBe(K)
      const st = bandStats(b, 500, 3500)
      const predicted = 1 / Math.sqrt(K)
      expect(st.cv / predicted, `K=${K}`).toBeGreaterThan(0.8)
      expect(st.cv / predicted, `K=${K}`).toBeLessThan(1.25)
      // ...and the bin spacing rises by exactly K.
      expect(b.df * b.n).toBeCloseTo(SR, 9)
    }
  })

  it('Welch: overlapping windowed segments, at the same rate', () => {
    for (const K of [4, 16, 64]) {
      const w = welch(x, SR, { segments: K, overlap: 0.5, window: 'hann' })
      const st = bandStats(w, 500, 3500)
      expect(st.cv / (1 / Math.sqrt(K)), `K=${K}`).toBeGreaterThan(0.8)
      expect(st.cv / (1 / Math.sqrt(K)), `K=${K}`).toBeLessThan(1.3)
      expect(st.mean / TRUE_DENSITY, `K=${K}`).toBeGreaterThan(0.9)
      expect(st.mean / TRUE_DENSITY, `K=${K}`).toBeLessThan(1.1)
    }
  })

  it('the window is what lets a weak component be seen beside a strong one', () => {
    // A full-scale tone and one 70 dB below it. The strong tone sits half a bin
    // off centre, which is where a rectangular window leaks worst, and that
    // leakage is what buries the weak one.
    const n = 32768
    const strong = 1001
    const weak = 1300
    const x = Float64Array.from({ length: n }, (_, i) => {
      const t = i / SR
      return Math.sin(2 * Math.PI * strong * t) + 3.16e-4 * Math.sin(2 * Math.PI * weak * t)
    })
    const at = (est, f) => {
      let bi = 0
      for (let k = 1; k < est.freqs.length; k++) {
        if (Math.abs(est.freqs[k] - f) < Math.abs(est.freqs[bi] - f)) bi = k
      }
      let m = 0
      for (let k = Math.max(0, bi - 1); k <= Math.min(est.psd.length - 1, bi + 1); k++) {
        m = Math.max(m, est.psd[k])
      }
      return m
    }
    const rect = welch(x, SR, { segments: 8, overlap: 0.5, window: 'none' })
    const hann = welch(x, SR, { segments: 8, overlap: 0.5, window: 'hann' })
    // The ratio between the two tones is what the estimate should report. With a
    // rectangular window the leak floor sits far above the weak tone.
    const rectRatio = at(rect, weak) / at(rect, strong)
    const hannRatio = at(hann, weak) / at(hann, strong)
    expect(hannRatio).toBeLessThan(rectRatio)
    expect(10 * Math.log10(hannRatio)).toBeLessThan(-50)
    expect(10 * Math.log10(rectRatio)).toBeGreaterThan(-50)
  })
})

describe('the all-pole model is exact when the signal really is all-pole', () => {
  /** y[n] = -a1 y[n-1] - a2 y[n-2] + w[n], a genuine AR(2). */
  const ar2 = (a1, a2, n, seed) => {
    const w = white(n + 2000, seed)
    const y = new Float64Array(n)
    let y1 = 0
    let y2 = 0
    for (let i = 0; i < n + 2000; i++) {
      const v = -a1 * y1 - a2 * y2 + w[i]
      y2 = y1
      y1 = v
      if (i >= 2000) y[i - 2000] = v
    }
    return y
  }

  it('recovers the coefficients of a process that is one', () => {
    for (const [a1, a2] of [
      [-1.6, 0.9],
      [-0.5, 0.25],
      [0.8, 0.6],
    ]) {
      const y = ar2(a1, a2, 60000, 13)
      const m = arYuleWalker(y, 2)
      expect(m.a[1], `${a1},${a2}`).toBeCloseTo(a1, 1)
      expect(m.a[2], `${a1},${a2}`).toBeCloseTo(a2, 1)
      // The driving noise's variance comes back too.
      expect(m.sigma2).toBeCloseTo(TRUE_VARIANCE, 1)
    }
  })

  it('its spectrum agrees with the averaged periodogram of the same signal', () => {
    const y = ar2(-1.6, 0.9, 65536, 17)
    const m = arYuleWalker(y, 2)
    const w = welch(y, SR, { segments: 32, overlap: 0.5, window: 'hann' })
    const model = arSpectrum(m, w.freqs, SR)
    const errs = []
    for (let k = 1; k < w.freqs.length - 1; k++) {
      if (w.freqs[k] < 100 || w.freqs[k] > 3800) continue
      errs.push(Math.abs(10 * Math.log10(model[k] / w.psd[k])))
    }
    errs.sort((a, b) => a - b)
    // The typical disagreement is a fraction of a decibel. The largest is a few,
    // because the averaged periodogram still scatters by 1/sqrt(32).
    expect(errs[Math.floor(errs.length / 2)]).toBeLessThan(1)
    expect(errs[errs.length - 1]).toBeLessThan(5)
  })

  it('every model it builds is stable, because the recursion makes it so', () => {
    for (const order of [1, 2, 4, 8, 16, 32]) {
      const y = ar2(-1.6, 0.9, 8192, 19)
      const m = arYuleWalker(y, order)
      expect(m.singular, `order=${order}`).toBe(false)
      // Every reflection coefficient inside the unit interval is the stability
      // condition, and Levinson-Durbin cannot produce one outside it.
      for (const k of m.reflection) expect(Math.abs(k), `order=${order}`).toBeLessThan(1)
      // The prediction error falls monotonically with order.
      const lower = arYuleWalker(y, Math.max(1, order - 1))
      expect(m.sigma2).toBeLessThanOrEqual(lower.sigma2 * (1 + 1e-12))
    }
  })

  it('the order criteria disagree, and the stricter one picks the lower order', () => {
    const y = ar2(-1.6, 0.9, 16384, 23)
    const c = arOrderCriteria(y, 12)
    expect(c.rows).toHaveLength(12)
    expect(c.mdlOrder).toBeLessThanOrEqual(c.aicOrder)
    expect(c.mdlOrder).toBeGreaterThanOrEqual(2)
  })

  it('levinson solves the same system Yule-Walker states', () => {
    const y = ar2(-1.2, 0.5, 20000, 29)
    const m = arYuleWalker(y, 4)
    const direct = levinson(m.r, 4)
    for (let k = 0; k <= 4; k++) expect(direct.a[k]).toBe(m.a[k])
    // The normal equations, checked directly: sum_k a[k] r[|i-k|] = 0 for i > 0.
    for (let i = 1; i <= 4; i++) {
      let acc = 0
      for (let k = 0; k <= 4; k++) acc += m.a[k] * m.r[Math.abs(i - k)]
      expect(Math.abs(acc) / m.r[0], `i=${i}`).toBeLessThan(1e-9)
    }
  })
})

describe('the transform itself', () => {
  it('the cost is (N/2) log2 N against N squared', () => {
    for (const n of [8, 64, 1024, 4096]) {
      const c = fftCost(n)
      expect(c.stages).toBe(Math.log2(n))
      expect(c.butterflies).toBe((n / 2) * Math.log2(n))
      expect(c.direct).toBe(n * n)
      expect(c.ratio).toBeCloseTo((2 * n) / Math.log2(n), 9)
    }
    expect(fftCost(1024).ratio).toBeCloseTo(204.8, 9)
  })

  it('bit reversal is its own inverse, and it is a permutation', () => {
    for (const n of [4, 8, 16, 1024]) {
      const br = bitReversal(n)
      expect(new Set(br).size).toBe(n)
      for (let i = 0; i < n; i++) expect(br[br[i]], `n=${n} i=${i}`).toBe(i)
    }
    expect(Array.from(bitReversal(8))).toEqual([0, 4, 2, 6, 1, 5, 3, 7])
  })

  it('one butterfly is two additions and one complex multiply', () => {
    // At k = 0 the twiddle is 1, so the butterfly is a sum and a difference.
    const b0 = butterfly([1, 2], [3, -1], 0, 8)
    expect(b0.x).toEqual([4, 1])
    expect(b0.y).toEqual([-2, 3])
    // At k = N/4 the twiddle is -j, which turns the second input a quarter turn.
    const b1 = butterfly([0, 0], [1, 0], 2, 8)
    expect(b1.x[0]).toBeCloseTo(0, 12)
    expect(b1.x[1]).toBeCloseTo(-1, 12)
  })

  it('the transform equals the sum it replaces', () => {
    for (const n of [8, 32, 128]) {
      const re = white(n, n)
      const im = white(n, n + 100)
      const d = dft(re, im)
      const r2 = Float64Array.from(re)
      const i2 = Float64Array.from(im)
      fft(r2, i2)
      let worst = 0
      let scale = 0
      for (let k = 0; k < n; k++) {
        worst = Math.max(worst, Math.hypot(d.re[k] - r2[k], d.im[k] - i2[k]))
        scale = Math.max(scale, Math.hypot(d.re[k], d.im[k]))
      }
      expect(worst / scale, `n=${n}`).toBeLessThan(1e-13)
    }
  })

  it('and the sum costs what the count says it does', () => {
    // A direct transform of 1024 points is 205 times the work. Timing is not a
    // test, so the count is: one complex multiply per (k, t) pair.
    const c = fftCost(1024)
    expect(c.direct / c.butterflies).toBeCloseTo(c.ratio, 9)
    expect(c.butterflies).toBe(5120)
  })
})
