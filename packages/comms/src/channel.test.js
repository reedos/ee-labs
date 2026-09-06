import { describe, it, expect } from 'vitest'
import { firResponse } from '@ee-labs/dsp'
import { sampleVariance } from '@ee-labs/random'
import {
  noiseVariance,
  awgn,
  multipath,
  twoRay,
  realTaps,
  tapsReal,
  channelResponse,
  rayleighGains,
  applyFading,
  rayleighBer,
  rayleighThreshold,
  FADING_ASSUMPTIONS,
} from './channel.js'
import { constellation, mapBits, randomBits } from './mappers.js'
import { rng } from '@ee-labs/random'

describe('the noise the channel adds', () => {
  it('takes its variance from Eb/N0 and the bits a symbol carries', () => {
    const a = noiseVariance({ ebN0Db: 10, bitsPerSymbol: 1 })
    const b = noiseVariance({ ebN0Db: 10, bitsPerSymbol: 4 })
    // Four bits a symbol at the same Eb/N0 is four times the symbol energy, so
    // the same noise sits four times lower relative to it.
    expect(a.sigma2 / b.sigma2).toBeCloseTo(4, 12)
  })

  it('spreads the same noise over more samples when the chain is oversampled', () => {
    const one = noiseVariance({ ebN0Db: 6, bitsPerSymbol: 2, sps: 1 })
    const eight = noiseVariance({ ebN0Db: 6, bitsPerSymbol: 2, sps: 8 })
    expect(eight.sigma2 / one.sigma2).toBeCloseTo(8, 12)
  })

  it('draws a sequence whose measured variance sits on the stated one', () => {
    const zeros = new Float64Array(2 * 40000)
    const { out, sigma2 } = awgn(zeros, { ebN0Db: 5, bitsPerSymbol: 1, seed: 11 })
    const v = sampleVariance(out)
    expect(v.ci[0]).toBeLessThanOrEqual(sigma2)
    expect(v.ci[1]).toBeGreaterThanOrEqual(sigma2)
  })

  it('gives the same waveform from the same seed, and another from another', () => {
    const z = new Float64Array(64)
    const a = awgn(z, { ebN0Db: 5, bitsPerSymbol: 1, seed: 1 }).out
    const b = awgn(z, { ebN0Db: 5, bitsPerSymbol: 1, seed: 1 }).out
    const c = awgn(z, { ebN0Db: 5, bitsPerSymbol: 1, seed: 2 }).out
    expect(Array.from(a)).toEqual(Array.from(b))
    expect(Array.from(a)).not.toEqual(Array.from(c))
  })
})

describe('the multipath channel', () => {
  const taps = twoRay(0.5, 4)

  it('is linear, so two inputs sum to the sum of their outputs', () => {
    const r = rng(2)
    const a = mapBits('qpsk', randomBits(2 * 64, r))
    const b = mapBits('qpsk', randomBits(2 * 64, r))
    const sum = new Float64Array(a.length)
    for (let i = 0; i < a.length; i++) sum[i] = a[i] + b[i]
    const viaSum = multipath(sum, taps)
    const ya = multipath(a, taps)
    const yb = multipath(b, taps)
    for (let i = 0; i < viaSum.length; i++) {
      expect(viaSum[i]).toBeCloseTo(ya[i] + yb[i], 12)
    }
  })

  it('has the transfer function the FIR machinery in dsp reads from its taps', () => {
    const real = tapsReal(taps)
    const r = channelResponse(taps, 8000, 241)
    for (let i = 0; i < r.freqs.length; i++) {
      expect(r.mag[i], `${r.freqs[i]} Hz`).toBeCloseTo(firResponse(real, r.freqs[i], 8000), 12)
    }
  })

  it('peaks at 3.522 dB and notches at -6.021 dB with an echo at half amplitude', () => {
    const r = channelResponse(taps, 8000, 4001)
    expect(r.peakDb).toBeCloseTo(20 * Math.log10(1.5), 6)
    expect(r.notchDb).toBeCloseTo(20 * Math.log10(0.5), 4)
    expect(r.peakDb).toBeCloseTo(3.522, 3)
    expect(r.notchDb).toBeCloseTo(-6.021, 3)
  })

  it('puts a notch every 2000 Hz with the first at 1000 Hz', () => {
    const r = channelResponse(twoRay(0.5, 4), 8000, 401)
    expect(r.notchSpacing).toBeCloseTo(2000, 9)
    expect(r.firstNotch).toBeCloseTo(1000, 9)
  })

  it('deepens the notch to -20.000 dB at a tap of 0.9', () => {
    const r = channelResponse(twoRay(0.9, 4), 8000, 4001)
    expect(r.notchDb).toBeCloseTo(-20, 2)
  })

  it('leaves the response flat when there is no echo', () => {
    const r = channelResponse(realTaps([1]), 8000, 51)
    expect(r.peakDb).toBeCloseTo(0, 12)
    expect(r.notchDb).toBeCloseTo(0, 12)
  })
})

describe('flat fading, which is a labelled model', () => {
  it('carries its three assumptions wherever its numbers go', () => {
    const g = rayleighGains(16, { seed: 1 })
    expect(g.assumptions).toEqual(FADING_ASSUMPTIONS)
    expect(g.assumptions.length).toBe(3)
    expect(g.model).toBe('Rayleigh')
  })

  it('has unit mean square, so it changes the fading and not the average power', () => {
    expect(rayleighGains(200000, { seed: 4 }).meanSquare).toBeCloseTo(1, 2)
    expect(rayleighGains(200000, { seed: 4, kFactor: 4 }).meanSquare).toBeCloseTo(1, 2)
  })

  it('names the Rician case by its factor', () => {
    expect(rayleighGains(8, { kFactor: 6 }).model).toBe('Rician')
  })

  it('multiplies each symbol by one gain', () => {
    const syms = Float64Array.from([1, 0, 0, 1])
    const faded = applyFading(syms, Float64Array.from([2, 0, 0, 3]))
    expect(Array.from(faded)).toEqual([2, 0, -3, 0])
  })

  it('reads 2.3269e-2 at 10 dB and 2.4814e-3 at 20 dB', () => {
    expect(rayleighBer(10)).toBeCloseTo(2.3269e-2, 6)
    expect(rayleighBer(20)).toBeCloseTo(2.4814e-3, 7)
  })

  it('needs 43.98 dB for one error in a hundred thousand', () => {
    expect(rayleighThreshold(1e-5)).toBeCloseTo(43.98, 2)
  })

  it('costs 34.39 dB against the same rate with no fading', () => {
    // 9.5879 dB is what BPSK needs in noise alone, from ber.js.
    expect(rayleighThreshold(1e-5) - 9.5879).toBeCloseTo(34.39, 2)
  })

  it('measures what the model predicts, over its own draws', () => {
    // The average of the conditional rate over the fading, against the closed
    // form. This is the model checked against itself, which is all a labelled
    // model can claim.
    const n = 40000
    const { gains } = rayleighGains(n, { seed: 9 })
    const gbar = 10 ** (10 / 10)
    let sum = 0
    for (let i = 0; i < n; i++) {
      const g = (gains[2 * i] ** 2 + gains[2 * i + 1] ** 2) * gbar
      sum += 0.5 * erfcApprox(Math.sqrt(g))
    }
    expect(sum / n).toBeCloseTo(rayleighBer(10), 3)
  })
})

/** `Q(sqrt(2 g))` written through erfc, as a second route to the same number. */
function erfcApprox(x) {
  // Abramowitz and Stegun 7.1.26, which is a different method from the one
  // `@ee-labs/random` uses, so the comparison is between two routes.
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x)
  return x >= 0 ? 1 - y : 1 + y
}
