import { describe, it, expect } from 'vitest'
import { loopFilter, costasRun, earlyLate, loopSnrDb, phaseErrorLossDb, rotationDeg } from './sync.js'
import { shapeTaps } from './shape.js'
import { mapBits, randomBits } from './mappers.js'
import { rng } from '@ee-labs/random'

describe('the loop filter', () => {
  const f = loopFilter({ bnT: 0.02, zeta: 0.707, symbolRate: 1000 })

  it('reads a loop bandwidth of 20.00 Hz at a normalised 0.02 and 1000 symbols a second', () => {
    expect(f.bn).toBeCloseTo(20, 12)
  })

  it('reads a natural frequency of 37.71 radians a second', () => {
    expect(f.wn).toBeCloseTo(37.71, 2)
  })

  it('is stable, with both poles inside the unit circle', () => {
    expect(f.poleRadius).toBeLessThan(1)
    expect(f.stable).toBe(true)
  })

  it('gives a second-order denominator and a numerator with two terms', () => {
    expect(f.denominator.length).toBe(3)
    expect(f.numerator.length).toBe(3)
    expect(f.denominator[0]).toBe(1)
  })

  it('settles inside 1 % in 173 symbols, which is 172.5 ms', () => {
    // The envelope decays as e^{-zeta wn t}, so the time to a band of one per
    // cent is ln(100) over that rate. The plan calls this 172.50 ms.
    expect(f.settleTo(0.01) * 1000).toBeCloseTo(172.7, 0)
    expect(f.settleSymbols(0.01)).toBe(173)
  })

  it('takes four times as long when the loop is narrowed by four', () => {
    const narrow = loopFilter({ bnT: 0.005, zeta: 0.707, symbolRate: 1000 })
    // The plan reads 690 symbols, which is four times its own 172.5 ms.
    expect(narrow.settleSymbols(0.01) / f.settleSymbols(0.01)).toBeCloseTo(4, 1)
    expect(narrow.settleSymbols(0.01) / 690).toBeCloseTo(1, 2)
  })

  it('buys 6.02 dB of loop ratio for that fourfold narrowing', () => {
    expect(loopSnrDb(0.005) - loopSnrDb(0.02)).toBeCloseTo(6.02, 2)
    expect(loopSnrDb(0.005)).toBeCloseTo(20, 2)
    expect(loopSnrDb(0.0005)).toBeCloseTo(30, 2)
  })
})

describe('the Costas loop', () => {
  it('pulls a static phase error below half a degree', () => {
    const r = costasRun({ symbols: 4000, phaseOffsetDeg: 40, bnT: 0.02, seed: 1 })
    expect(r.residualDeg).toBeLessThan(0.5)
  })

  it('does the same for QPSK, with the four-quadrant error signal', () => {
    const r = costasRun({ symbols: 6000, phaseOffsetDeg: 20, bnT: 0.02, scheme: 'qpsk', seed: 2 })
    expect(r.residualDeg).toBeLessThan(0.5)
  })

  it('leaves a static error under a frequency offset when it is first order', () => {
    const first = costasRun({ symbols: 6000, freqOffsetHz: 5, order: 1, bnT: 0.02, seed: 3 })
    const second = costasRun({ symbols: 6000, freqOffsetHz: 5, order: 2, bnT: 0.02, seed: 3 })
    expect(first.staticErrorDeg).toBeGreaterThan(1)
    expect(second.residualDeg).toBeLessThan(0.5)
  })

  it('acquires sooner with a wider loop', () => {
    const wide = costasRun({ symbols: 4000, phaseOffsetDeg: 40, bnT: 0.05, seed: 4 })
    const narrow = costasRun({ symbols: 4000, phaseOffsetDeg: 40, bnT: 0.005, seed: 4 })
    expect(wide.settledAt).toBeLessThan(narrow.settledAt)
  })

  it('leaves more jitter with a wider loop under noise, which is the trade', () => {
    const wide = costasRun({ symbols: 8000, phaseOffsetDeg: 10, bnT: 0.05, ebN0Db: 8, seed: 6 })
    const narrow = costasRun({ symbols: 8000, phaseOffsetDeg: 10, bnT: 0.005, ebN0Db: 8, seed: 6 })
    expect(wide.jitterDeg).toBeGreaterThan(narrow.jitterDeg)
  })
})

describe('the early-late gate', () => {
  const h = shapeTaps({ kind: 'rrc', beta: 0.35, span: 12, sps: 8 })
  const s = earlyLate({ h, sps: 8, spacing: 0.5 })

  it('crosses zero at the right instant', () => {
    const centre = (s.curve.length - 1) / 2
    expect(Math.abs(s.curve[centre])).toBeLessThan(1e-9)
  })

  it('has a slope at zero that says which way to move', () => {
    expect(s.slope).not.toBe(0)
    expect(Number.isFinite(s.slope)).toBe(true)
  })

  it('takes a gate spacing of half a symbol as four samples at eight a symbol', () => {
    expect(s.gateSamples).toBe(4)
  })

  it('turns over away from the instant, which bounds the range it pulls in from', () => {
    expect(s.peakAt).toBeGreaterThan(0.2)
    expect(s.peakAt).toBeLessThan(1.5)
    expect(s.peakValue).toBeGreaterThan(0.5)
  })

  it('rises through the whole pull-in range, so the correction has the right sign', () => {
    const centre = (s.curve.length - 1) / 2
    for (let k = centre; s.offsets[k] < s.peakAt; k++) {
      expect(s.curve[k + 1], `at ${s.offsets[k]}`).toBeGreaterThan(s.curve[k])
    }
  })

  it('is odd about the instant, because early and late are the same measurement', () => {
    const centre = (s.curve.length - 1) / 2
    for (let k = 1; k <= centre; k++) {
      expect(s.curve[centre + k], `${k}`).toBeCloseTo(-s.curve[centre - k], 12)
    }
  })
})

describe('a phase error', () => {
  it('turns the constellation by exactly the offset', () => {
    const syms = Float64Array.from([1, 0])
    const out = rotationDeg(syms, 30)
    expect(Math.atan2(out[1], out[0]) * (180 / Math.PI)).toBeCloseTo(30, 10)
  })

  it('scales the wanted component by its cosine, costing 1.249 dB at 30 degrees', () => {
    expect(phaseErrorLossDb(30)).toBeCloseTo(1.249, 3)
    expect(Math.cos(Math.PI / 6)).toBeCloseTo(0.866, 3)
  })

  it('leaves nothing at 90 degrees', () => {
    expect(phaseErrorLossDb(90)).toBe(Infinity)
  })

  it('leaves the magnitudes alone, because a rotation is not a gain', () => {
    const syms = mapBits('qam16', randomBits(4 * 32, rng(1)))
    const out = rotationDeg(syms, 17)
    for (let i = 0; i < syms.length / 2; i++) {
      expect(Math.hypot(out[2 * i], out[2 * i + 1])).toBeCloseTo(
        Math.hypot(syms[2 * i], syms[2 * i + 1]),
        12,
      )
    }
  })
})
