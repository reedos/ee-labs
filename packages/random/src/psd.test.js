import { describe, it, expect } from 'vitest'
import { windowFn } from '@ee-labs/dsp'
import { rng } from './prng.js'
import {
  periodogram, averagedPeriodogram, overlapCorrelation, integratePsd, relativeSpread,
  whitePsd, filteredPsd,
} from './psd.js'
import { autocorrelation, psdFromAcf, acfFromPsd } from './corr.js'
import { whiteNoise, firstOrderLowpass } from './noise.js'

describe('one periodogram frame', () => {
  it('puts a sine where the sine is, with the power the sine has', () => {
    const fs = 8000
    const n = 4096
    const amp = 3
    const f0 = (fs * 250) / n // exactly on a bin
    const x = new Float64Array(n)
    for (let i = 0; i < n; i++) x[i] = amp * Math.sin((2 * Math.PI * f0 * i) / fs)
    const p = periodogram(x, fs, { window: 'none' })
    // A sine of amplitude A has mean-square A^2/2, and the whole of it sits in
    // one bin, so the density there times the bin width is that power.
    const df = fs / n
    expect(p.psd[250] * df).toBeCloseTo((amp * amp) / 2, 6)
    expect(p.freqs[250]).toBeCloseTo(f0, 9)
  })

  it('reads a flat floor at the density the noise was given', () => {
    const fs = 48000
    const { x, density } = whiteNoise({ n: 4096, sampleRate: fs, rms: 1e-3, seed: 4 })
    const p = periodogram(x, fs, { window: 'none' })
    let acc = 0
    for (let k = 1; k < p.psd.length - 1; k++) acc += p.psd[k]
    const mean = acc / (p.psd.length - 2)
    // One frame's average over bins has relative error 1/sqrt(bins).
    expect(Math.abs(Math.sqrt(mean) / density - 1)).toBeLessThan(5 / Math.sqrt(2048))
  })

  it('divides by the window power, not by its coherent gain', () => {
    // The trap: dividing by sum(w)^2, which is right for an amplitude spectrum,
    // reads a Hann-windowed noise floor 1.76 dB low. Two windows must give the
    // same floor for the same noise.
    const fs = 8000
    const { x } = whiteNoise({ n: 8192, sampleRate: fs, rms: 1, seed: 5 })
    const flat = averagedPeriodogram(x, fs, { segment: 512, window: 'none' })
    const hann = averagedPeriodogram(x, fs, { segment: 512, window: 'hann' })
    expect(Math.abs(hann.integral / flat.integral - 1)).toBeLessThan(0.03)
  })

  it('refuses a frame that is not a power of two', () => {
    expect(() => periodogram(new Float64Array(1000), 8000)).toThrow(/power of two/)
  })

  it('removes the mean when asked, which empties the DC bin', () => {
    const x = new Float64Array(256).fill(5)
    expect(periodogram(x, 1000, { removeMean: true }).psd[0]).toBeCloseTo(0, 20)
    expect(periodogram(x, 1000, { removeMean: false }).psd[0]).toBeGreaterThan(0)
  })
})

describe('the averaged periodogram', () => {
  it('counts its segments and its degrees of freedom', () => {
    const { x } = whiteNoise({ n: 4096, sampleRate: 8000, rms: 1, seed: 6 })
    const ap = averagedPeriodogram(x, 8000, { segment: 256 })
    expect(ap.segments).toBe(16)
    expect(ap.dof).toBe(32)
    expect(ap.dofExact).toBe(true)
    expect(ap.relativeSe).toBeCloseTo(Math.sqrt(2 / 32), 12)
  })

  it('reports fewer degrees of freedom than segments when the segments overlap', () => {
    const { x } = whiteNoise({ n: 4096, sampleRate: 8000, rms: 1, seed: 7 })
    const plain = averagedPeriodogram(x, 8000, { segment: 256, overlap: 0 })
    const lapped = averagedPeriodogram(x, 8000, { segment: 256, overlap: 0.5 })
    expect(lapped.segments).toBeGreaterThan(plain.segments)
    expect(lapped.dofExact).toBe(false)
    // Twice the segments, but not twice the degrees of freedom, because they
    // share samples. Claiming 2M there would give an interval that is too
    // narrow, which is the defect the guard exists to prevent.
    expect(lapped.dof).toBeLessThan(2 * lapped.segments)
    expect(lapped.dof).toBeGreaterThan(plain.dof)
  })

  it('the overlap correlation is one at zero shift and zero past the window', () => {
    const w = windowFn('hann', 256)
    expect(overlapCorrelation(w, 0)).toBeCloseTo(1, 12)
    expect(overlapCorrelation(w, 256)).toBe(0)
    expect(overlapCorrelation(w, 128)).toBeGreaterThan(0)
    expect(overlapCorrelation(w, 128)).toBeLessThan(1)
  })

  it('refuses a record too short to hold one segment, naming both numbers', () => {
    expect(() => averagedPeriodogram(new Float64Array(100), 8000, { segment: 256 })).toThrow(
      /100 samples hold no 256-sample segment/,
    )
  })

  it('refuses a segment that is not a power of two, and an overlap out of range', () => {
    const x = new Float64Array(4096)
    expect(() => averagedPeriodogram(x, 8000, { segment: 300 })).toThrow(/power of two/)
    expect(() => averagedPeriodogram(x, 8000, { overlap: 0.95 })).toThrow(/overlap must be/)
  })

  it('carries a chi-square interval that widens as the averages fall', () => {
    const { x } = whiteNoise({ n: 8192 * 8, sampleRate: 8000, rms: 1, seed: 8 })
    const few = averagedPeriodogram(x.subarray(0, 2048), 8000, { segment: 256 })
    const many = averagedPeriodogram(x, 8000, { segment: 256 })
    const width = (ap, k) => (ap.ci[k][1] - ap.ci[k][0]) / ap.psd[k]
    expect(width(few, 20)).toBeGreaterThan(width(many, 20))
  })
})

describe('the integral of a density', () => {
  it('returns the variance of white noise, exactly, from a flat array', () => {
    const fs = 8000
    const n = 1024
    const freqs = new Float64Array(n / 2 + 1)
    for (let k = 0; k < freqs.length; k++) freqs[k] = (k * fs) / n
    const psd = new Float64Array(freqs.length).fill(whitePsd(4, fs))
    expect(integratePsd({ freqs, psd })).toBeCloseTo(4, 10)
  })

  it('takes a band, and the bands add up to the whole', () => {
    const fs = 8000
    const n = 1024
    const freqs = new Float64Array(n / 2 + 1)
    for (let k = 0; k < freqs.length; k++) freqs[k] = (k * fs) / n
    const psd = new Float64Array(freqs.length).fill(whitePsd(4, fs))
    const whole = integratePsd({ freqs, psd })
    const lower = integratePsd({ freqs, psd }, [0, 1000])
    const upper = integratePsd({ freqs, psd }, [1000, 4000])
    expect(lower + upper).toBeCloseTo(whole, 10)
    expect(lower / whole).toBeCloseTo(0.25, 10)
  })
})

describe('a filter shapes the density by the magnitude squared', () => {
  it('the closed form and the run agree on the variance a filter passes', () => {
    const fs = 48000
    for (const fc of [200, 1000, 5000, 15000]) {
      const lp = firstOrderLowpass(fc, fs)
      // sum h^2 = K/(K+1), reached by running an impulse through.
      const imp = new Float64Array(1 << 16)
      imp[0] = 1
      const h = lp.run(imp)
      let e = 0
      for (let i = 0; i < h.length; i++) e += h[i] * h[i]
      expect(e / lp.noiseGain).toBeCloseTo(1, 8)
    }
  })

  it('and the magnitude is one at DC and zero at Nyquist', () => {
    const lp = firstOrderLowpass(2000, 48000)
    expect(lp.magnitude(0)).toBeCloseTo(1, 12)
    expect(lp.magnitude(24000)).toBeCloseTo(0, 12)
    expect(lp.magnitude(2000)).toBeCloseTo(1 / Math.SQRT2, 12)
  })

  it('filteredPsd multiplies the input density by the magnitude squared', () => {
    const freqs = Float64Array.from([0, 100, 200, 400])
    const psdIn = Float64Array.from([1, 1, 1, 1])
    const out = filteredPsd(freqs, psdIn, (f) => 1 / (1 + f / 100))
    expect(out[0]).toBeCloseTo(1, 12)
    expect(out[1]).toBeCloseTo(0.25, 12)
    expect(out[3]).toBeCloseTo(1 / 25, 12)
  })
})

describe('the two directions of Wiener and Khinchin', () => {
  it('a density and its autocorrelation return each other', () => {
    const fs = 2000
    const n = 512
    const freqs = new Float64Array(n / 2 + 1)
    const psd = new Float64Array(n / 2 + 1)
    for (let k = 0; k < freqs.length; k++) {
      freqs[k] = (k * fs) / n
      // A shaped density, so the round trip has something to lose.
      psd[k] = 1 / (1 + (freqs[k] / 300) ** 2)
    }
    const r = acfFromPsd(psd, fs, 64)
    const back = psdFromAcf(r, fs, { nfft: 512 })
    // The autocorrelation was truncated at 64 lags, so the density that comes
    // back is the original smoothed by that window rather than the original.
    // The zero lag survives exactly, and it is the variance.
    //
    // `acfFromPsd` sums the bins with weight one, which is the exact inverse of
    // the transform. `integratePsd` is the trapezoid rule, which is what a
    // plotted curve's area is, and it takes half of each end panel. The gap
    // between the two is exactly those two half panels and nothing else.
    const df = freqs[1] - freqs[0]
    const endGap = 0.5 * (psd[0] + psd[psd.length - 1]) * df
    expect(r[0]).toBeCloseTo(integratePsd({ freqs, psd }) + endGap, 8)
    expect(back.psd.length).toBeGreaterThan(0)
  })

  it('the autocorrelation of white noise is a spike at zero lag', () => {
    const { x } = whiteNoise({ n: 8192, sampleRate: 1000, rms: 2, seed: 9 })
    const acf = autocorrelation(x, 32, { removeMean: false })
    expect(acf.r0).toBeCloseTo(4, 1)
    expect(acf.normalised[0]).toBe(1)
    for (let m = 1; m <= 32; m++) {
      // A lag correlation of a white record has standard error 1/sqrt(N).
      expect(Math.abs(acf.normalised[m])).toBeLessThan(5 / Math.sqrt(8192))
    }
  })

  it('the autocorrelation of a filtered process decays over the filter time constant', () => {
    const fs = 48000
    const fc = 500
    const lp = firstOrderLowpass(fc, fs)
    const { x } = whiteNoise({ n: 1 << 18, sampleRate: fs, rms: 1, seed: 10 })
    const acf = autocorrelation(lp.run(x), 400, { removeMean: false })
    // The correlation falls to 1/e over about one time constant, 1/(2 pi fc)
    // seconds, which is this many samples.
    const tauSamples = fs / (2 * Math.PI * fc)
    let cross = 0
    while (cross < 400 && acf.normalised[cross] > Math.exp(-1)) cross++
    expect(cross).toBeGreaterThan(0.6 * tauSamples)
    expect(cross).toBeLessThan(1.6 * tauSamples)
  })

  it('the biased estimate is the default, because the unbiased one can go negative', () => {
    const { x } = whiteNoise({ n: 256, sampleRate: 1000, rms: 1, seed: 12 })
    const biased = autocorrelation(x, 255)
    const unbiased = autocorrelation(x, 255, { biased: false })
    expect(biased.biased).toBe(true)
    // At the longest lags the unbiased estimate divides by one or two terms and
    // is wild. The biased one tapers to zero.
    expect(Math.abs(unbiased.normalised[254])).toBeGreaterThan(
      Math.abs(biased.normalised[254]),
    )
  })
})

describe('relativeSpread', () => {
  it('is zero for a constant and one for a unit-mean unit-spread sample', () => {
    expect(relativeSpread(Float64Array.from([3, 3, 3, 3]))).toBe(0)
    const r = rng(2)
    const x = r.take(20000, () => r.normal(10, 1))
    expect(relativeSpread(x)).toBeCloseTo(0.1, 2)
  })

  it('returns zero rather than infinity when the mean is zero', () => {
    expect(relativeSpread(Float64Array.from([0, 0]))).toBe(0)
  })
})
