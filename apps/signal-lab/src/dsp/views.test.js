import { describe, expect, it } from 'vitest'
import { designFir, fft, movingAverage, poleRadius, designBiquad } from '@ee-labs/dsp'
import {
  applyChain,
  chainGroupDelay,
  chainImpulse,
  chainPolesZeros,
  chainResponse,
  convKernel,
  framedRoots,
  kernelCentre,
  ZPLANE_MAX_R,
} from './chain.js'
import { makeBlockRecord } from './blocks.js'

// The three views added alongside the spectrum: the kernel, its roots, and the
// delay. Each one claims to be the same filter said another way, and each of
// those claims is checkable against the response curve the app already draws.

const FS = 8000
const NBINS = 1025
const freqs = Float64Array.from({ length: NBINS }, (_, i) => (i * (FS / 2)) / (NBINS - 1))

const blk = (type, params) => ({ ...makeBlockRecord(type, 1), params: { ...makeBlockRecord(type, 1).params, ...params } })

describe('group delay', () => {
  it('is flat at exactly (N-1)/2 for a symmetric FIR', () => {
    for (const taps of [21, 41, 101]) {
      const b = blk('fir', { taps, freq: 1200, mode: 'lowpass', window: 'hamming' })
      const { delay } = chainGroupDelay([b], freqs, FS)
      const want = (designFir(b.params, FS).length - 1) / 2
      let checked = 0
      for (let i = 1; i < delay.length - 1; i++) {
        if (!Number.isFinite(delay[i])) continue
        expect(delay[i], `${taps} taps at ${freqs[i].toFixed(0)} Hz`).toBeCloseTo(want, 5)
        checked++
      }
      // Not vacuously true: most of the axis really was tested.
      expect(checked).toBeGreaterThan(delay.length * 0.7)
    }
  })

  it('is flat at (N-1)/2 for a moving average, half-integer included', () => {
    for (const [taps, want] of [
      [8, 3.5],
      [7, 3],
      [16, 7.5],
    ]) {
      const { delay } = chainGroupDelay([blk('movingavg', { taps })], freqs, FS)
      for (let i = 1; i < delay.length - 1; i++) {
        if (!Number.isFinite(delay[i])) continue
        expect(delay[i], `N=${taps} at ${freqs[i].toFixed(0)} Hz`).toBeCloseTo(want, 5)
      }
    }
  })

  // The bug this whole NaN treatment exists for. Differencing straight through
  // the pi step at a null used to report -125 samples for a filter whose delay
  // is 3.5 everywhere.
  it('declines to report a delay across a null rather than inventing a spike', () => {
    const { delay } = chainGroupDelay([blk('movingavg', { taps: 8 })], freqs, FS)
    const blanked = [...delay].filter((v) => !Number.isFinite(v)).length
    expect(blanked).toBeGreaterThan(0) // the nulls were found
    expect(blanked).toBeLessThan(delay.length * 0.2) // and only the nulls
    for (const v of delay) {
      if (Number.isFinite(v)) expect(Math.abs(v)).toBeLessThan(10)
    }
  })

  // The contrast that justifies having both families in one rack.
  it('is NOT flat for a biquad, and peaks at its corner', () => {
    const b = blk('lowpass', { freq: 800, q: 8 })
    const { delay } = chainGroupDelay([b], freqs, FS)
    let peak = -Infinity
    let at = 0
    for (let i = 1; i < delay.length - 1; i++) {
      if (Number.isFinite(delay[i]) && delay[i] > peak) {
        peak = delay[i]
        at = freqs[i]
      }
    }
    expect(at).toBeGreaterThan(700)
    expect(at).toBeLessThan(900)
    // Far below the corner it has barely any delay at all; at the corner it has
    // a great deal. That difference IS the shape change a high-Q filter makes.
    expect(peak).toBeGreaterThan(20 * delay[2])
  })

  it('adds up across a cascade, because phases add', () => {
    const a = blk('fir', { taps: 21, freq: 1500, mode: 'lowpass', window: 'hann' })
    const b = { ...blk('fir', { taps: 41, freq: 1500, mode: 'lowpass', window: 'hann' }), id: 2 }
    const { delay } = chainGroupDelay([a, b], freqs, FS)
    for (let i = 1; i < delay.length - 1; i++) {
      if (Number.isFinite(delay[i])) expect(delay[i]).toBeCloseTo(10 + 20, 5)
    }
  })

  it('a bypassed block contributes no delay', () => {
    const b = { ...blk('fir', { taps: 41, freq: 1200 }), bypass: true }
    const { any } = chainGroupDelay([b], freqs, FS)
    expect(any).toBe(false)
  })
})

describe('impulse response', () => {
  it('gives back exactly the FIR kernel', () => {
    const b = blk('fir', { taps: 31, freq: 900, mode: 'lowpass', window: 'blackman' })
    const want = designFir(b.params, FS)
    const { h, exact } = chainImpulse([b], 256, FS)
    expect(exact).toBe(true)
    for (let k = 0; k < want.length; k++) expect(h[k]).toBeCloseTo(want[k], 15)
    for (let k = want.length; k < 256; k++) expect(h[k]).toBe(0)
  })

  it('gives back the moving average taps, all 1/N of them', () => {
    const { h } = chainImpulse([blk('movingavg', { taps: 5 })], 32, FS)
    for (let k = 0; k < 5; k++) expect(h[k]).toBeCloseTo(1 / 5, 15)
    expect(h[5]).toBe(0)
  })

  it('an empty chain is a single impulse — the identity kernel', () => {
    const { h, any } = chainImpulse([], 16, FS)
    expect(any).toBe(false)
    expect(h[0]).toBe(1)
    for (let k = 1; k < 16; k++) expect(h[k]).toBe(0)
  })

  // An IIR tail never reaches zero, which is exactly what distinguishes it.
  it('an IIR tail decays at the pole radius and does not end', () => {
    const b = blk('lowpass', { freq: 400, q: 6 })
    const r = poleRadius(designBiquad({ mode: 'lowpass', ...b.params }, FS))
    const { h } = chainImpulse([b], 4096, FS)
    let last = 0
    for (let i = h.length - 1; i >= 0; i--) {
      if (h[i] !== 0) {
        last = i
        break
      }
    }
    expect(last).toBeGreaterThan(1000)
    // Envelope ratio over a long span follows r^n.
    const n1 = 400
    const n2 = 900
    const e1 = envelope(h, n1)
    const e2 = envelope(h, n2)
    expect(Math.log(e2 / e1) / (n2 - n1)).toBeCloseTo(Math.log(r), 3)
  })

  it('says plainly that a nonlinear block has no impulse response', () => {
    const { exact } = chainImpulse([blk('clip', { threshold: 0.5 })], 64, FS)
    expect(exact).toBe(false)
  })
})

/** Local peak magnitude around n, to read a decaying oscillation's envelope. */
function envelope(h, n, half = 40) {
  let m = 0
  for (let i = Math.max(0, n - half); i < Math.min(h.length, n + half); i++) {
    m = Math.max(m, Math.abs(h[i]))
  }
  return m
}

describe('poles and zeros', () => {
  it('a biquad has two of each, with the poles inside the circle', () => {
    const b = blk('lowpass', { freq: 900, q: 4 })
    const { poles, zeros, exact } = chainPolesZeros([b], FS)
    expect(exact).toBe(true)
    expect(poles).toHaveLength(2)
    expect(zeros).toHaveLength(2)
    for (const [re, im] of poles) expect(Math.hypot(re, im)).toBeLessThan(1)
  })

  // Q is the peak height on the spectrum and the pole's closeness to the rim
  // here. Same number, two pictures.
  it('a higher Q puts the poles closer to the unit circle', () => {
    const radius = (q) => {
      const { poles } = chainPolesZeros([blk('lowpass', { freq: 900, q })], FS)
      return Math.hypot(poles[0][0], poles[0][1])
    }
    expect(radius(20)).toBeGreaterThan(radius(4))
    expect(radius(4)).toBeGreaterThan(radius(0.707))
    expect(radius(20)).toBeLessThan(1)
  })

  it('an FIR has N-1 zeros and no poles at all', () => {
    const b = blk('fir', { taps: 31, freq: 1000, mode: 'lowpass', window: 'hamming' })
    const { poles, zeros } = chainPolesZeros([b], FS)
    expect(poles).toHaveLength(0)
    expect(zeros).toHaveLength(30)
  })

  it('cascading collects the roots of both blocks', () => {
    const a = blk('lowpass', { freq: 500, q: 2 })
    const b = { ...blk('highpass', { freq: 2000, q: 2 }), id: 2 }
    const { poles, zeros } = chainPolesZeros([a, b], FS)
    expect(poles).toHaveLength(4)
    expect(zeros).toHaveLength(4)
  })

  // The reading the view is for: |H| at a frequency is the product of the
  // distances from that point on the unit circle to the zeros, over the product
  // of the distances to the poles. Checked as a RATIO between two frequencies,
  // which removes the overall gain and leaves only the geometry.
  it('reproduces the shape of the response from the marks alone', () => {
    for (const b of [
      blk('lowpass', { freq: 900, q: 4 }),
      blk('bandpass', { freq: 1400, q: 6 }),
      blk('fir', { taps: 21, freq: 1100, mode: 'lowpass', window: 'hamming' }),
    ]) {
      const { poles, zeros } = chainPolesZeros([b], FS)
      const { mag } = chainResponse([b], freqs, FS)
      const geo = (f) => {
        const w = (2 * Math.PI * f) / FS
        const er = Math.cos(w)
        const ei = Math.sin(w)
        let num = 1
        let den = 1
        for (const [re, im] of zeros) num *= Math.hypot(er - re, ei - im)
        for (const [re, im] of poles) den *= Math.hypot(er - re, ei - im)
        return num / den
      }
      // Reference well away from any null, so the ratio is well conditioned.
      const iRef = 40
      const ref = geo(freqs[iRef]) / mag[iRef]
      for (let i = 5; i < NBINS - 5; i += 37) {
        if (mag[i] < 1e-6) continue
        expect(geo(freqs[i]) / mag[i], `${b.type} at ${freqs[i].toFixed(0)} Hz`).toBeCloseTo(ref, 6)
      }
    }
  })

  it('a comb puts its zeros on a ring of radius |g|^(1/D)', () => {
    const b = blk('comb', { delayMs: 2, g: 0.7, mode: 'feedforward' })
    const D = Math.round((2 / 1000) * FS)
    const { poles, zeros } = chainPolesZeros([b], FS)
    expect(poles).toHaveLength(0)
    expect(zeros).toHaveLength(D)
    const want = Math.pow(0.7, 1 / D)
    for (const [re, im] of zeros) expect(Math.hypot(re, im)).toBeCloseTo(want, 12)
  })

  it('a feedback comb puts the same ring in the denominator instead', () => {
    const b = blk('comb', { delayMs: 2, g: 0.7, mode: 'feedback' })
    const { poles, zeros } = chainPolesZeros([b], FS)
    expect(zeros).toHaveLength(0)
    expect(poles.length).toBeGreaterThan(0)
  })

  it('declines rather than grinding when a delay has thousands of roots', () => {
    const b = blk('comb', { delayMs: 90, g: 0.5, mode: 'feedforward' })
    const { tooMany, exact } = chainPolesZeros([b], 48000)
    expect(tooMany).toBeGreaterThan(256)
    expect(exact).toBe(false)
  })

  // Playbook #4 and #5: the frame must be sized to its content, and the
  // content here is the unit circle. ZPlaneCanvas grows its axes to hold every
  // root it is handed, which is right for a pole that has escaped the circle
  // and wrong for an FIR's far outliers.
  describe('what the z-plane frame will show', () => {
    it('a windowed sinc throws zeros far enough out to destroy the frame', () => {
      // THE DEFECT, measured. A 31-tap windowed sinc's furthest zero sets the
      // axis, and the unit circle then occupies a fraction of the pane.
      const b = blk('fir', { taps: 31, freq: 900, mode: 'lowpass', window: 'blackman' })
      const { zeros } = chainPolesZeros([b], FS)
      const far = Math.max(...zeros.map(([re, im]) => Math.hypot(re, im)))
      expect(far).toBeGreaterThan(5)
      // ZPlaneCanvas's own span rule, applied to the unframed set: the circle
      // would be under a fifth of the half-height it deserves.
      const span = Math.max(1.35, far * 1.15)
      expect(1 / span).toBeLessThan(0.2)
    })

    it('framing keeps the circle worth looking at, and says what it dropped', () => {
      const b = blk('fir', { taps: 31, freq: 900, mode: 'lowpass', window: 'blackman' })
      const { poles, zeros } = chainPolesZeros([b], FS)
      const f = framedRoots(poles, zeros)
      expect(f.hidden).toBeGreaterThan(0)
      expect(f.zeros.length + f.hidden).toBe(zeros.length)
      const far = Math.max(...f.zeros.map(([re, im]) => Math.hypot(re, im)))
      expect(far).toBeLessThanOrEqual(ZPLANE_MAX_R)
      // The circle now gets at least a third of the half-height.
      expect(1 / Math.max(1.35, far * 1.15)).toBeGreaterThan(0.33)
    })

    it('keeps every root of a moving average — they are all on the circle', () => {
      // "Zeros on the circle" must be untouched: the lesson IS the eleven
      // zeros of a 12-tap average, and every one sits at |z| = 1.
      const b = blk('movingavg', { taps: 12 })
      const { poles, zeros } = chainPolesZeros([b], FS)
      const f = framedRoots(poles, zeros)
      expect(f.hidden).toBe(0)
      expect(f.zeros).toHaveLength(zeros.length)
    })

    it('keeps an unstable pole just outside the circle, which is the point', () => {
      expect(framedRoots([[1.4, 0]], []).hidden).toBe(0)
      expect(framedRoots([[1.4, 0]], []).poles).toHaveLength(1)
    })

    it('counts poles and zeros alike when they are too far out', () => {
      const f = framedRoots([[9, 0]], [[0, 9]])
      expect(f.hidden).toBe(2)
      expect(f.poles).toHaveLength(0)
      expect(f.zeros).toHaveLength(0)
    })

    it('measures distance from the origin, not along one axis', () => {
      // (1.6, 1.6) is inside the box |re| <= 2 and outside the disc |z| <= 2.
      expect(framedRoots([], [[1.6, 1.6]]).hidden).toBe(1)
      expect(framedRoots([], [[1.4, 1.4]]).hidden).toBe(0)
    })
  })

  it('reports that a nonlinear block has no roots to show', () => {
    const { exact, any } = chainPolesZeros([blk('rectify', {})], FS)
    expect(exact).toBe(false)
    expect(any).toBe(false)
  })

  it('a gain block has no roots, and that is not a failure', () => {
    const { poles, zeros, exact } = chainPolesZeros([blk('gain', { gainDb: 6 })], FS)
    expect(exact).toBe(true)
    expect(poles).toHaveLength(0)
    expect(zeros).toHaveLength(0)
  })
})

describe('kernel centre', () => {
  // The bug the browser harness caught. A Hann or Blackman window is EXACTLY
  // zero at its first and last point, so a 31-tap Blackman kernel genuinely
  // begins and ends with a 0. Trimming only the tail paired h[0] = 0 against a
  // nonzero last tap, the symmetry test failed, and a perfectly linear-phase
  // filter reported "delay varies with frequency" in the readout.
  it('finds the centre even when the window zeroes both end taps', () => {
    for (const window of ['none', 'hann', 'hamming', 'blackman']) {
      for (const taps of [21, 31, 61]) {
        const b = blk('fir', { taps, freq: 900, mode: 'lowpass', window })
        const { h } = chainImpulse([b], 512, FS)
        expect(kernelCentre(h), `${window} / ${taps}`).toBe((taps - 1) / 2)
      }
    }
  })

  it('agrees with the group delay overlay, which is the point of it', () => {
    for (const window of ['hann', 'blackman']) {
      const b = blk('fir', { taps: 41, freq: 1200, mode: 'lowpass', window })
      const { h } = chainImpulse([b], 512, FS)
      const { delay } = chainGroupDelay([b], freqs, FS)
      const measured = [...delay].find((v) => Number.isFinite(v))
      expect(kernelCentre(h)).toBeCloseTo(measured, 5)
    }
  })

  it('handles a half-integer centre', () => {
    const { h } = chainImpulse([blk('movingavg', { taps: 8 })], 64, FS)
    expect(kernelCentre(h)).toBe(3.5)
  })

  it('declines for an IIR tail that never finishes', () => {
    const { h } = chainImpulse([blk('lowpass', { freq: 400, q: 6 })], 256, FS)
    expect(kernelCentre(h)).toBeNull()
  })

  it('declines for an asymmetric kernel', () => {
    // A feed-forward comb is 1 at tap 0 and g at tap D — not symmetric.
    const { h } = chainImpulse([blk('comb', { delayMs: 2, g: 0.7, mode: 'feedforward' })], 256, FS)
    expect(kernelCentre(h)).toBeNull()
  })
})

describe('convolution kernel length', () => {
  // The bug Reed's skepticism led to: a Q=20 low-pass at 100 Hz rings for
  // ~7000 samples, and a kernel capped at 0.05 s made the dot product miss a
  // third of the answer — shown unflagged, on a linear chain, in the one view
  // whose entire message is that the two numbers are equal.
  it('sizes the kernel by the chain ring time, and then the sum matches', () => {
    const blocks = [blk('lowpass', { freq: 100, q: 20 })]
    const { n, truncated } = convKernel(blocks, FS)
    expect(truncated).toBe(false)
    expect(n).toBeGreaterThan(7000)

    const { h } = chainImpulse(blocks, n, FS)
    const N = 1600
    const x = new Float64Array(N)
    for (let i = 0; i < N; i++) x[i] = Math.sin((2 * Math.PI * 100 * i) / FS)
    const y = applyChain(blocks, x, FS, 0)
    for (const at of [399, 500, 800, 1500]) {
      let dot = 0
      for (let kk = 0; kk < h.length && kk <= at; kk++) dot += h[kk] * x[at - kk]
      // The old 400-sample kernel was off by 4.96 at n=800. Now: rounding.
      expect(Math.abs(y[at] - dot), `n=${at}`).toBeLessThan(1e-4)
    }
  })

  it('flags, rather than hides, a chain that out-rings even the cap', () => {
    // Q=20 at 20 Hz at 48 kHz settles in ~200k samples.
    const blocks = [blk('lowpass', { freq: 20, q: 20 })]
    const { n, truncated } = convKernel(blocks, 48000)
    expect(truncated).toBe(true)
    expect(n).toBe(32768)
  })

  it('stays small for chains that settle fast', () => {
    expect(convKernel([blk('movingavg', { taps: 8 })], FS).n).toBe(64)
    expect(convKernel([], FS).n).toBe(64)
  })
})

describe('the theorem the convolution view prints', () => {
  // The app prints "y = x ∗ h in time is Y(z) = X(z)·H(z)". House rule: a
  // printed sentence is a measurable claim, so measure it — FFT(x ∗ h)
  // against FFT(x)·FFT(h), pointwise.
  //
  // The trap: the DFT identity holds for CIRCULAR convolution. It equals the
  // linear convolution the view performs only when both sequences are
  // zero-padded to at least len(x)+len(h)−1, so the tail has nowhere to wrap.
  const fftOf = (seq, size) => {
    const re = new Float64Array(size)
    const im = new Float64Array(size)
    re.set(seq)
    fft(re, im)
    return { re, im }
  }

  it('FFT(x ∗ h) = FFT(x)·FFT(h), zero-padded past wrap-around', () => {
    const blocks = [blk('lowpass', { freq: 900, q: 2 })]
    const N = 256
    const x = new Float64Array(N)
    for (let i = 0; i < N; i++) {
      x[i] = Math.sin((2 * Math.PI * 500 * i) / FS) + 0.4 * Math.sin((2 * Math.PI * 1700 * i) / FS)
    }
    const { h, exact } = chainImpulse(blocks, convKernel(blocks, FS).n, FS)
    expect(exact).toBe(true)

    // Linear convolution, by the definition the view animates.
    const L = N + h.length - 1
    const y = new Float64Array(L)
    for (let n = 0; n < L; n++) {
      let acc = 0
      for (let k = Math.max(0, n - N + 1); k < h.length && k <= n; k++) acc += h[k] * x[n - k]
      y[n] = acc
    }

    let size = 1
    while (size < L) size <<= 1
    const X = fftOf(x, size)
    const H = fftOf(h, size)
    const Y = fftOf(y, size)
    for (let i = 0; i < size; i++) {
      const pr = X.re[i] * H.re[i] - X.im[i] * H.im[i]
      const pi = X.re[i] * H.im[i] + X.im[i] * H.re[i]
      expect(Math.abs(Y.re[i] - pr), `bin ${i} re`).toBeLessThan(1e-9)
      expect(Math.abs(Y.im[i] - pi), `bin ${i} im`).toBeLessThan(1e-9)
    }
  })

  it('and fails WITHOUT the padding — circular is not linear', () => {
    // Same identity attempted at FFT size N: the convolution tail wraps onto
    // the front and the product no longer matches. This failing case is what
    // makes the passing one above evidence rather than coincidence.
    const blocks = [blk('lowpass', { freq: 900, q: 2 })]
    const N = 256
    const x = new Float64Array(N)
    for (let i = 0; i < N; i++) x[i] = Math.sin((2 * Math.PI * 500 * i) / FS)
    const { h } = chainImpulse(blocks, convKernel(blocks, FS).n, FS)
    const y = new Float64Array(N)
    for (let n = 0; n < N; n++) {
      let acc = 0
      for (let k = 0; k < h.length && k <= n; k++) acc += h[k] * x[n - k]
      y[n] = acc
    }
    const X = fftOf(x, N)
    const H = fftOf(h.slice(0, N), N)
    const Y = fftOf(y, N)
    let worst = 0
    for (let i = 0; i < N; i++) {
      const pr = X.re[i] * H.re[i] - X.im[i] * H.im[i]
      worst = Math.max(worst, Math.abs(Y.re[i] - pr))
    }
    expect(worst).toBeGreaterThan(0.01)
  })
})
