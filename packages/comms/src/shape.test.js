import { describe, it, expect } from 'vitest'
import { firResponse, firGroupDelay, isSymmetric } from '@ee-labs/dsp'
import {
  raisedCosine,
  rootRaisedCosine,
  shapeTaps,
  convolve,
  residualIsi,
  shapedBandwidth,
  streamPeak,
  eyeOpening,
  SPAN_GUARD,
} from './shape.js'

describe("Nyquist's criterion in the time domain", () => {
  for (const beta of [0, 0.25, 0.35, 1]) {
    it(`the raised cosine at beta = ${beta} is 1 at zero and nothing at every other instant`, () => {
      expect(raisedCosine(0, beta)).toBeCloseTo(1, 15)
      for (let k = 1; k <= 12; k++) {
        expect(Math.abs(raisedCosine(k, beta)), `k = ${k}`).toBeLessThan(1e-15)
        expect(Math.abs(raisedCosine(-k, beta)), `k = -${k}`).toBeLessThan(1e-15)
      }
    })
  }

  it('holds at the removable singularity of beta = 0.5, where 2 beta t is one', () => {
    // The denominator vanishes at t = 1, and the limit is finite. Approaching it
    // from either side must reach the same value the closed form returns.
    const exact = raisedCosine(1, 0.5)
    expect(raisedCosine(1 - 1e-7, 0.5)).toBeCloseTo(exact, 6)
    expect(raisedCosine(1 + 1e-7, 0.5)).toBeCloseTo(exact, 6)
  })
})

describe('the root raised cosine', () => {
  it('is not itself a Nyquist pulse, which is the fact C6 is about', () => {
    expect(Math.abs(rootRaisedCosine(1, 0.35))).toBeGreaterThan(1e-3)
  })

  it('has a finite value at its own removable singularity', () => {
    const t = 1 / (4 * 0.35)
    const exact = rootRaisedCosine(t, 0.35)
    expect(Number.isFinite(exact)).toBe(true)
    expect(rootRaisedCosine(t - 1e-7, 0.35)).toBeCloseTo(exact, 5)
    expect(rootRaisedCosine(t + 1e-7, 0.35)).toBeCloseTo(exact, 5)
  })

  it('convolved with itself gives the raised cosine, to the residual the span allows', () => {
    const h = shapeTaps({ kind: 'rrc', beta: 0.35, span: 16, sps: 8 })
    const c = convolve(h, h)
    const mid = (c.length - 1) / 2
    for (let k = 1; k <= 3; k++) {
      const got = c[mid + k * 8] / c[mid]
      expect(Math.abs(got - raisedCosine(k, 0.35)), `k = ${k}`).toBeLessThan(1e-4)
    }
  })
})

describe('the shaping kernel', () => {
  it('carries unit energy, so the matched filter output reads 2E over N0 directly', () => {
    for (const kind of ['rc', 'rrc', 'rect']) {
      const h = shapeTaps({ kind, beta: 0.35, span: 12, sps: 8 })
      let e = 0
      for (const v of h) e += v * v
      expect(e, kind).toBeCloseTo(1, 12)
    }
  })

  it('is symmetric, so its group delay is flat at half its length', () => {
    const h = shapeTaps({ kind: 'rrc', beta: 0.35, span: 12, sps: 8 })
    expect(isSymmetric(h, 1e-12)).toBe(true)
    expect(firGroupDelay(h)).toBe((h.length - 1) / 2)
  })

  it('rolls off where the bandwidth formula says it does', () => {
    const sps = 8
    const symbolRate = 1000
    const sampleRate = symbolRate * sps
    for (const beta of [0, 0.35, 1]) {
      const h = shapeTaps({ kind: 'rc', beta, span: 24, sps })
      const edge = shapedBandwidth(beta, symbolRate)
      const inband = firResponse(h, edge / 4, sampleRate)
      const outband = firResponse(h, edge * 1.6, sampleRate)
      expect(outband / inband, `beta ${beta}`).toBeLessThan(0.02)
    }
  })

  it('gives the bandwidths the plan quotes at four roll-offs', () => {
    expect(shapedBandwidth(0, 1000)).toBeCloseTo(500, 12)
    expect(shapedBandwidth(0.25, 1000)).toBeCloseTo(625, 12)
    expect(shapedBandwidth(0.35, 1000)).toBeCloseTo(675, 12)
    expect(shapedBandwidth(1, 1000)).toBeCloseTo(1000, 12)
  })
})

describe('the residual the truncation leaves', () => {
  const isiAt = (span) => residualIsi(shapeTaps({ kind: 'rrc', beta: 0.35, span, sps: 8 }), 8)

  it('falls with the span, on the nearest neighbours', () => {
    const near = [4, 6, 12, 16].map((s) => isiAt(s).near)
    for (let i = 1; i < near.length; i++) expect(near[i], `${i}`).toBeLessThan(near[i - 1])
  })

  it('reads the four figures the plan quotes', () => {
    expect(isiAt(4).near).toBeCloseTo(4.76e-2, 4)
    expect(isiAt(6).near).toBeCloseTo(6.54e-4, 6)
    expect(isiAt(12).near).toBeCloseTo(7.44e-5, 7)
    expect(isiAt(16).near).toBeCloseTo(2.83e-5, 7)
  })

  it('reports a larger figure over every lag than over the nearest two', () => {
    // The three measures differ by more than an order of magnitude at a span of
    // 12, which is why a pane that prints one of them names which.
    const r = isiAt(12)
    expect(r.peak).toBeGreaterThan(10 * r.near)
    expect(r.sum).toBeGreaterThan(r.peak)
  })

  it('crosses the span guard where the plan sets it', () => {
    expect(isiAt(SPAN_GUARD - 2).near).toBeGreaterThan(1e-2)
    expect(isiAt(SPAN_GUARD).near).toBeLessThan(1e-3)
  })
})

describe('the eye, and what closes it', () => {
  it('is fully open at the right instant, at every roll-off', () => {
    for (const beta of [0, 0.35, 1]) expect(eyeOpening(beta, 0)).toBeCloseTo(1, 6)
  })

  it('gives the openings the plan quotes at three timing errors', () => {
    expect(eyeOpening(0.35, 0.05)).toBeCloseTo(0.8619, 4)
    expect(eyeOpening(0.35, 0.1)).toBeCloseTo(0.7166, 4)
    expect(eyeOpening(0.35, 0.2)).toBeCloseTo(0.4108, 4)
    expect(eyeOpening(0, 0.05)).toBeCloseTo(0.5695, 4)
    expect(eyeOpening(0, 0.1)).toBeCloseTo(0.1395, 4)
    expect(eyeOpening(1, 0.05)).toBeCloseTo(0.9548, 4)
    expect(eyeOpening(1, 0.1)).toBeCloseTo(0.8959, 4)
    expect(eyeOpening(1, 0.2)).toBeCloseTo(0.7364, 4)
  })

  it('closes entirely at beta = 0 and a fifth of a symbol', () => {
    expect(eyeOpening(0, 0.2)).toBeLessThan(0)
  })

  it('narrows as the roll-off falls, at every offset it is measured at', () => {
    for (const eps of [0.05, 0.1, 0.2]) {
      expect(eyeOpening(0, eps)).toBeLessThan(eyeOpening(0.35, eps))
      expect(eyeOpening(0.35, eps)).toBeLessThan(eyeOpening(1, eps))
    }
  })
})

describe("the stream's worst-case peak", () => {
  it('reads 11.141 dB at beta = 0 and 4.746 dB at beta = 0.35', () => {
    expect(streamPeak(0).db).toBeCloseTo(11.141, 3)
    expect(streamPeak(0.35).db).toBeCloseTo(4.746, 3)
  })

  it('grows with the window at beta = 0, because that tail decays as one over t', () => {
    expect(streamPeak(0, 80).peak).toBeGreaterThan(streamPeak(0, 40).peak)
  })
})
