import { describe, expect, it } from 'vitest'
import {
  designFir,
  firAt,
  firGroupDelay,
  firPhase,
  firResponse,
  firZeros,
  isSymmetric,
  makeFir,
  movingAverage,
  sinc,
} from './fir.js'

const FS = 8000

/** Run a kernel over a buffer the way the chain does, and return the tail. */
function through(h, buf) {
  const step = makeFir(h)
  const out = new Float64Array(buf.length)
  for (let i = 0; i < buf.length; i++) out[i] = step(buf[i])
  return out
}

const FRAME = 4096

/**
 * Amplitude and phase of a steady sine after the kernel, measured.
 *
 * Driven at bin-centred frequencies — `bin * fs / FRAME` — so that projecting
 * onto sin and cos over exactly FRAME samples is an EXACT single-bin DFT rather
 * than a leaky one. At an arbitrary frequency the projection carries an O(1/N)
 * leakage error of around 2e-4, which is far larger than the thing these tests
 * are trying to see. Choosing the frequency to fit the frame removes it
 * entirely instead of budgeting a tolerance for it.
 */
function measure(h, bin, sampleRate = FS) {
  const f = (bin * sampleRate) / FRAME
  const settle = h.length
  const total = settle + FRAME
  const x = new Float64Array(total)
  for (let i = 0; i < total; i++) x[i] = Math.sin((2 * Math.PI * f * i) / sampleRate)
  const y = through(h, x)
  let sr = 0
  let si = 0
  for (let i = settle; i < total; i++) {
    const a = (2 * Math.PI * f * i) / sampleRate
    sr += y[i] * Math.cos(a)
    si += y[i] * Math.sin(a)
  }
  return { f, amp: (2 * Math.hypot(sr, si)) / FRAME, phase: Math.atan2(sr, si) }
}

describe('sinc', () => {
  it('fills in the hole at zero', () => {
    expect(sinc(0)).toBe(1)
  })

  it('is zero at every nonzero integer', () => {
    for (let k = 1; k <= 20; k++) {
      expect(Math.abs(sinc(k))).toBeLessThan(1e-15)
      expect(Math.abs(sinc(-k))).toBeLessThan(1e-15)
    }
  })
})

describe('moving average', () => {
  it('has taps that sum to exactly one, so H(0) = 1', () => {
    for (const n of [2, 3, 8, 16, 33]) {
      const h = movingAverage(n)
      const sum = h.reduce((a, b) => a + b, 0)
      // To rounding, not to the last bit: 1/33 is not representable, so summing
      // it 33 times lands 6.7e-16 away. Twelve places is still a statement that
      // the DC gain is one and not merely close to it.
      expect(sum).toBeCloseTo(1, 12)
      expect(firResponse(h, 0, FS)).toBeCloseTo(1, 12)
    }
  })

  it('matches the Dirichlet kernel |sin(NW/2) / (N sin(W/2))|', () => {
    const N = 12
    const h = movingAverage(N)
    for (let f = 1; f < FS / 2; f += 37) {
      const W = (2 * Math.PI * f) / FS
      const want = Math.abs(Math.sin((N * W) / 2) / (N * Math.sin(W / 2)))
      expect(firResponse(h, f, FS)).toBeCloseTo(want, 12)
    }
  })

  // The property worth knowing by heart: averaging N samples kills exactly those
  // frequencies that complete a whole number of cycles inside the window.
  it('is exactly zero at every multiple of fs/N', () => {
    for (const N of [4, 5, 10, 16]) {
      const h = movingAverage(N)
      for (let m = 1; m * (FS / N) < FS / 2; m++) {
        if (m % N === 0) continue
        expect(firResponse(h, (m * FS) / N, FS)).toBeLessThan(1e-12)
      }
    }
  })

  // (z^N - 1)/(z - 1): the N-th roots of unity, minus the one at z = 1.
  it('puts its N-1 zeros on the unit circle at 2*pi*m/N', () => {
    const N = 8
    const zs = firZeros(movingAverage(N))
    expect(zs).toHaveLength(N - 1)
    const angles = zs
      .map(([re, im]) => {
        expect(Math.hypot(re, im)).toBeCloseTo(1, 9) // on the circle
        const a = Math.atan2(im, re)
        return a < -1e-9 ? a + 2 * Math.PI : a
      })
      .sort((a, b) => a - b)
    for (let m = 1; m < N; m++) {
      expect(angles[m - 1]).toBeCloseTo((2 * Math.PI * m) / N, 8)
    }
  })
})

describe('windowed sinc', () => {
  it('is symmetric, and therefore linear phase, for every window and length', () => {
    for (const window of ['none', 'hann', 'hamming', 'blackman']) {
      for (const taps of [11, 31, 64, 101]) {
        expect(isSymmetric(designFir({ mode: 'lowpass', taps, freq: 900, window }, FS))).toBe(true)
      }
    }
  })

  it('forces an odd length so the centre tap is real', () => {
    for (const taps of [10, 11, 64, 65]) {
      expect(designFir({ taps, freq: 900 }, FS).length % 2).toBe(1)
    }
  })

  it('has exactly unit gain at DC as a low-pass', () => {
    for (const window of ['none', 'hann', 'hamming', 'blackman']) {
      for (const freq of [200, 900, 2500]) {
        const h = designFir({ mode: 'lowpass', taps: 41, freq, window }, FS)
        expect(firResponse(h, 0, FS)).toBeCloseTo(1, 12)
      }
    }
  })

  it('has exactly zero gain at DC as a high-pass', () => {
    for (const window of ['none', 'hann', 'hamming', 'blackman']) {
      for (const freq of [200, 900, 2500]) {
        const h = designFir({ mode: 'highpass', taps: 41, freq, window }, FS)
        expect(firResponse(h, 0, FS)).toBeLessThan(1e-12)
      }
    }
  })

  it('passes and stops on the correct sides of the cutoff', () => {
    const fc = 1000
    const lp = designFir({ mode: 'lowpass', taps: 81, freq: fc, window: 'blackman' }, FS)
    const hp = designFir({ mode: 'highpass', taps: 81, freq: fc, window: 'blackman' }, FS)
    expect(firResponse(lp, 300, FS)).toBeGreaterThan(0.99)
    expect(firResponse(lp, 2200, FS)).toBeLessThan(0.01)
    expect(firResponse(hp, 300, FS)).toBeLessThan(0.01)
    expect(firResponse(hp, 2200, FS)).toBeGreaterThan(0.99)
  })

  // The claim the whole FIR case rests on. For a symmetric kernel,
  // H(w) = A(w) * e^{-j*w*M} with A real: the filter is a pure delay of M
  // samples times a real scaling, so no frequency is delayed differently from
  // any other. Rotating out that delay must leave nothing imaginary behind.
  it('is exactly linear phase: rotating out M samples leaves a real number', () => {
    const h = designFir({ mode: 'lowpass', taps: 51, freq: 1200, window: 'hamming' }, FS)
    const M = (h.length - 1) / 2
    for (let f = 0; f < FS / 2; f += 29) {
      const { re, im } = firAt(h, f, FS)
      const w = (2 * Math.PI * f) / FS
      // Multiply by e^{+j w M}.
      const rot = re * Math.cos(w * M) - im * Math.sin(w * M)
      const rotIm = re * Math.sin(w * M) + im * Math.cos(w * M)
      expect(Math.abs(rotIm)).toBeLessThan(1e-12)
      expect(Number.isFinite(rot)).toBe(true)
    }
  })

  it('reports a group delay of exactly (N-1)/2 samples', () => {
    for (const taps of [11, 31, 101]) {
      const h = designFir({ taps, freq: 900 }, FS)
      expect(firGroupDelay(h)).toBe((h.length - 1) / 2)
    }
  })

  // Gibbs, in the frequency domain this time, and the reason the window control
  // exists. Truncating the sinc abruptly IS a rectangular window, and the
  // overshoot beside the corner does not go away as taps are added: it converges
  // UP to about 8.9% of the step while getting narrower and creeping toward the
  // cutoff. Measured as overshoot above the ideal passband rather than deviation
  // from it, since the response also passes through 0.5 at the corner on its way
  // down and that is the filter working, not ripple.
  const overshoot = (taps, window) => {
    const h = designFir({ mode: 'lowpass', taps, freq: 1000, window }, FS)
    let worst = -Infinity
    let at = 0
    for (let f = 0; f < 1000; f += 0.25) {
      const d = firResponse(h, f, FS) - 1
      if (d > worst) {
        worst = d
        at = f
      }
    }
    return { worst, at }
  }

  it('overshoots by the Gibbs ~8.9% and does not improve with length', () => {
    const a = overshoot(41, 'none')
    const b = overshoot(201, 'none')
    // More taps make it WORSE, not better, on the way to the constant.
    expect(b.worst).toBeGreaterThan(a.worst)
    expect(b.worst).toBeGreaterThan(0.08)
    expect(b.worst).toBeLessThan(0.09)
    // What length does buy is narrowness: the ripple crowds in toward the corner.
    expect(b.at).toBeGreaterThan(a.at)
    expect(1000 - b.at).toBeLessThan(1000 - a.at)
  })

  it('a tapered window is what actually removes the overshoot', () => {
    expect(overshoot(201, 'hann').worst).toBeLessThan(0.01)
    expect(overshoot(201, 'blackman').worst).toBeLessThan(0.01)
  })

  it('trades transition width for stopband depth across the windows', () => {
    const stop = (window) => {
      const h = designFir({ mode: 'lowpass', taps: 61, freq: 1000, window }, FS)
      let worst = 0
      for (let f = 2000; f < FS / 2; f += 10) worst = Math.max(worst, firResponse(h, f, FS))
      return worst
    }
    // Each window buys a quieter stopband than the one before it.
    expect(stop('none')).toBeGreaterThan(stop('hann'))
    expect(stop('hann')).toBeGreaterThan(stop('blackman'))
    expect(stop('blackman')).toBeLessThan(1e-3)
  })
})

describe('running the filter', () => {
  // Validates the delay line, the convolution sum and the response evaluator at
  // once: if any of the three disagreed, the measured amplitude would not land
  // on the analytic curve.
  it('measured response matches the analytic one', () => {
    const kernels = [
      movingAverage(8),
      designFir({ mode: 'lowpass', taps: 31, freq: 800, window: 'hamming' }, FS),
      designFir({ mode: 'highpass', taps: 41, freq: 1500, window: 'blackman' }, FS),
    ]
    for (const h of kernels) {
      for (const bin of [64, 205, 448, 768, 1331]) {
        const { f, amp } = measure(h, bin)
        expect(amp).toBeCloseTo(firResponse(h, f, FS), 9)
      }
    }
  })

  it('delays every frequency by the same (N-1)/2 samples', () => {
    const h = designFir({ mode: 'lowpass', taps: 41, freq: 2000, window: 'hamming' }, FS)
    const M = (h.length - 1) / 2
    // Well inside the passband, where the amplitude is not near a sign flip.
    for (const bin of [102, 205, 410, 614]) {
      const { f, phase: measured } = measure(h, bin)
      const w = (2 * Math.PI * f) / FS
      // Expected lag of M samples, wrapped into (-pi, pi].
      let want = -w * M
      while (want <= -Math.PI) want += 2 * Math.PI
      while (want > Math.PI) want -= 2 * Math.PI
      let d = measured - want
      while (d <= -Math.PI) d += 2 * Math.PI
      while (d > Math.PI) d -= 2 * Math.PI
      expect(Math.abs(d)).toBeLessThan(1e-6)
    }
  })

  it('forgets completely after N samples', () => {
    const h = designFir({ taps: 31, freq: 900 }, FS)
    const step = makeFir(h)
    for (let i = 0; i < 50; i++) step(Math.sin(i) * 3 + 1) // arbitrary history
    let last = 0
    for (let i = 0; i < h.length; i++) last = step(0)
    // Every tap now multiplies a zero. Not "small" — exactly zero.
    expect(last).toBe(0)
    expect(step(0)).toBe(0)
  })

  it('reproduces the kernel as its impulse response', () => {
    const h = designFir({ mode: 'lowpass', taps: 21, freq: 1100, window: 'hann' }, FS)
    const x = new Float64Array(64)
    x[0] = 1
    const y = through(h, x)
    for (let k = 0; k < h.length; k++) expect(y[k]).toBeCloseTo(h[k], 15)
    for (let k = h.length; k < x.length; k++) expect(y[k]).toBe(0)
  })

  it('is linear, which the nonlinear blocks are not', () => {
    const h = designFir({ taps: 17, freq: 700 }, FS)
    const n = 256
    const a = new Float64Array(n)
    const b = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      a[i] = Math.sin((2 * Math.PI * 300 * i) / FS)
      b[i] = 0.4 * Math.sin((2 * Math.PI * 1900 * i) / FS + 1)
    }
    const sum = new Float64Array(n)
    for (let i = 0; i < n; i++) sum[i] = a[i] + b[i]
    const ya = through(h, a)
    const yb = through(h, b)
    const ysum = through(h, sum)
    for (let i = 0; i < n; i++) expect(ysum[i]).toBeCloseTo(ya[i] + yb[i], 12)
  })
})

describe('zeros', () => {
  it('finds exactly N-1 of them', () => {
    for (const taps of [11, 31]) {
      const h = designFir({ mode: 'lowpass', taps, freq: 1000, window: 'hamming' }, FS)
      expect(firZeros(h)).toHaveLength(h.length - 1)
    }
  })

  // A zero ON the unit circle at angle w means the response is exactly zero at
  // that frequency — the connection between the two views the z-plane exists to
  // make. Checked here so the plot cannot quietly disagree with the curve.
  it('a zero on the unit circle lands on a null in the response', () => {
    const h = movingAverage(10)
    for (const [re, im] of firZeros(h)) {
      const r = Math.hypot(re, im)
      if (Math.abs(r - 1) > 1e-6) continue
      const f = (Math.abs(Math.atan2(im, re)) * FS) / (2 * Math.PI)
      expect(firResponse(h, f, FS)).toBeLessThan(1e-9)
    }
  })

  it('reconstructs the response from the zeros alone', () => {
    // |H(w)| = |h0| * prod |e^{jw} - z_k|, the product-of-distances reading of
    // the z-plane: the response at a frequency is what the marks do to the point
    // on the circle at that angle.
    const h = designFir({ mode: 'lowpass', taps: 15, freq: 1400, window: 'hamming' }, FS)
    const zs = firZeros(h)
    for (let f = 50; f < FS / 2; f += 61) {
      const w = (2 * Math.PI * f) / FS
      const er = Math.cos(w)
      const ei = Math.sin(w)
      let prod = Math.abs(h[0])
      for (const [re, im] of zs) prod *= Math.hypot(er - re, ei - im)
      expect(prod).toBeCloseTo(firResponse(h, f, FS), 9)
    }
  })
})
