import { describe, it, expect } from 'vitest'
import {
  designBiquad,
  fftCost,
  lmsStepBound,
  misadjustment,
  poleRadius,
  quantizer,
  quantizeBiquad,
  weightError,
} from '@ee-labs/dsp'
import { BLOCK_TYPES } from './blocks.js'
import { INITIAL } from './state.js'
import { DEAD_BAND_START, adaptiveOf, deadBandOf, fixedOf, psdOf, resolvePath } from './measure.js'

// The quantity paths the four remaining groups stand on.
//
// Every group lane writes its own pins against its own experiments. This file
// is the layer under them: the resolver knows the path, the number it returns
// is the engine's own, and the two invariants that belong to the resolver
// rather than to any one lesson are measured here.

const SR = 48000
const bk = (id, type, params) => ({
  id,
  type,
  bypass: false,
  params: { ...BLOCK_TYPES[type].defaults, ...params },
})
const noise = (id, amp = 1) => ({ id, type: 'noise', freq: 0, amp, phase: 0, enabled: true })

const ADAPTIVE = {
  ...INITIAL,
  sources: [noise(1, 1)],
  blocks: [bk(1, 'adaptive', { algorithm: 'lms', mu: 0.02, noiseAmp: 0.05 })],
}
const FIXED = {
  ...INITIAL,
  sources: [noise(1, 0.5)],
  blocks: [bk(1, 'fixedbiquad', { coeffBits: 16, stateBits: 12, stateInt: 1 })],
}
const ESTIMATED = { ...INITIAL, sources: [noise(1, 1)], estimator: 'welch', segments: 16 }

describe('the adaptive paths', () => {
  it('read the step bounds the engine states, from the input the block saw', () => {
    const r = adaptiveOf(ADAPTIVE)
    const b = lmsStepBound({ taps: r.block.params.taps, inputPower: r.inputPower })
    expect(resolvePath('lms.power', ADAPTIVE)).toBeCloseTo(r.inputPower, 12)
    expect(resolvePath('lms.bound', ADAPTIVE)).toBeCloseTo(b.meanSquare, 12)
    expect(resolvePath('lms.boundMean', ADAPTIVE)).toBeCloseTo(b.mean, 12)
    expect(resolvePath('lms.misadjustment', ADAPTIVE)).toBeCloseTo(
      misadjustment({ mu: r.block.params.mu, taps: r.block.params.taps, inputPower: r.inputPower }),
      12,
    )
    // The mean-square bound is the tighter of the two, by exactly three.
    expect(b.mean / b.meanSquare).toBeCloseTo(3, 12)
  })

  it('report a convergence the weights actually reached', () => {
    const r = adaptiveOf(ADAPTIVE)
    const reach = resolvePath('lms.reach', ADAPTIVE)
    expect(resolvePath('lms.converged', ADAPTIVE)).toBe(true)
    expect(reach).toBeLessThan(r.history.length)
    expect(weightError(r.history[reach], r.plant)).toBeLessThanOrEqual(0.1)
    expect(weightError(r.history[reach - 1], r.plant)).toBeGreaterThan(0.1)
    expect(resolvePath('lms.diverged', ADAPTIVE)).toBe(false)
  })

  it('measure the floor as the noise that was added, not as a constant', () => {
    const floor = resolvePath('lms.floor', ADAPTIVE)
    const settled = resolvePath('lms.settled', ADAPTIVE)
    const amp = ADAPTIVE.blocks[0].params.noiseAmp
    // Uniform noise of amplitude A carries A^2/3 a sample, and the sequence the
    // block uses is close enough to uniform to hold that within a tenth.
    expect(floor).toBeGreaterThan((0.9 * amp * amp) / 3)
    expect(floor).toBeLessThan((1.1 * amp * amp) / 3)
    // The settled error is the floor plus the excess, and never below the floor
    // by more than the estimate's own scatter.
    expect(resolvePath('lms.ratio', ADAPTIVE)).toBeCloseTo(settled / floor, 12)
  })

  it('price each algorithm at the multiplies a sample it really costs', () => {
    const N = ADAPTIVE.blocks[0].params.taps
    const at = (algorithm) =>
      resolvePath('lms.cost', {
        ...ADAPTIVE,
        blocks: [bk(1, 'adaptive', { ...ADAPTIVE.blocks[0].params, algorithm })],
      })
    expect(at('lms')).toBe(2 * N)
    expect(at('nlms')).toBe(3 * N)
    expect(at('rls')).toBe(N * N)
  })
})

describe('the fixed-point paths', () => {
  it('read the step and the poles from the word length', () => {
    const p = FIXED.blocks[0].params
    const exact = designBiquad({ mode: p.mode, freq: p.freq, q: p.q }, SR)
    const q = quantizeBiquad(exact, quantizer({ bits: p.coeffBits, intBits: p.coeffInt }))
    expect(resolvePath('fix.delta', FIXED)).toBe(Math.pow(2, -(p.coeffBits - 1 - p.coeffInt)))
    expect(resolvePath('fix.stateDelta', FIXED)).toBe(Math.pow(2, -(p.stateBits - 1 - p.stateInt)))
    expect(resolvePath('fix.radius', FIXED)).toBeCloseTo(q.radius, 12)
    expect(resolvePath('fix.moved', FIXED)).toBeCloseTo(Math.max(...q.moved), 12)
    expect(resolvePath('fix.stable', FIXED)).toBe(true)
    // Every quantised coefficient is an exact multiple of the step.
    const d = q.delta
    for (const v of Object.values(q.coeffs)) expect(Math.abs(v / d - Math.round(v / d))).toBeLessThan(1e-9)
    // And the quantised radius is not the exact one.
    expect(q.radius).not.toBe(poleRadius(exact))
  })

  it('measure a dead band that the word length does not change', () => {
    const counts = [10, 12, 14, 16].map((stateBits) =>
      resolvePath('fix.deadband', {
        ...FIXED,
        blocks: [bk(1, 'fixedbiquad', { ...FIXED.blocks[0].params, stateBits })],
      }),
    )
    // The coefficients set the count and the word length sets the size of a
    // step, so one number holds across a factor of 64 in resolution.
    expect(new Set(counts).size).toBe(1)
    expect(counts[0]).toBeGreaterThan(1)
    for (const stateBits of [10, 12, 14, 16]) {
      const s = { ...FIXED, blocks: [bk(1, 'fixedbiquad', { ...FIXED.blocks[0].params, stateBits })] }
      const band = deadBandOf(s)
      // It really repeats, and its amplitude is an exact multiple of the step.
      expect(band.found).toBe(true)
      expect(band.period).toBeGreaterThan(0)
      expect(Math.abs(band.amplitude / band.delta - band.steps)).toBeLessThan(1e-9)
      expect(band.amplitude).toBeLessThan(DEAD_BAND_START)
    }
  })

  it('report the rounding noise as a gain the recursion applies', () => {
    const gain = resolvePath('fix.noiseGain', FIXED)
    const rmsIn = resolvePath('fix.rmsIn', FIXED)
    const rmsOut = resolvePath('fix.rmsOut', FIXED)
    const f = fixedOf(FIXED)
    expect(rmsIn).toBeCloseTo(f.qs.state.delta / Math.sqrt(12), 15)
    expect(rmsOut).toBeCloseTo(rmsIn * Math.sqrt(gain), 12)
    expect(resolvePath('fix.gainDb', FIXED)).toBeCloseTo(10 * Math.log10(gain), 12)
    // A section at Q of 10 amplifies its own rounding by tens of decibels, which
    // is the whole of E6.
    expect(gain).toBeGreaterThan(1000)
  })
})

describe('the estimator and the transform paths', () => {
  it('read the estimate the state names, and its resolution', () => {
    const est = psdOf(ESTIMATED)
    expect(resolvePath('psd.segments', ESTIMATED)).toBe(est.segments)
    expect(resolvePath('psd.df', ESTIMATED)).toBe(SR / est.n)
    expect(resolvePath('psd.n', ESTIMATED)).toBe(est.n)
    // Averaging sixteen segments cuts the scatter to about a quarter, and a
    // single periodogram does not move off one whatever the record length is.
    expect(resolvePath('psd.cv', ESTIMATED)).toBeLessThan(0.4)
    const one = { ...ESTIMATED, estimator: 'periodogram', window: 'none' }
    expect(resolvePath('psd.cv', one)).toBeGreaterThan(0.85)
    expect(resolvePath('psd.cv', one)).toBeLessThan(1.15)
  })

  it('fit a model whose coefficients are the ones the recursion states', () => {
    // White noise is an AR(0) process, so the fitted coefficients sit near zero
    // and the model's density is flat. A lesson's own source puts poles in it.
    expect(Math.abs(resolvePath('ar.a1', ESTIMATED))).toBeLessThan(0.1)
    expect(Math.abs(resolvePath('ar.a2', ESTIMATED))).toBeLessThan(0.1)
    expect(resolvePath('ar.sigma2', ESTIMATED)).toBeGreaterThan(0)
    expect(resolvePath('ar.peak', ESTIMATED)).toBeGreaterThanOrEqual(0)
    expect(resolvePath('ar.aic', ESTIMATED)).toBeGreaterThanOrEqual(1)
    expect(resolvePath('ar.mdl', ESTIMATED)).toBeLessThanOrEqual(resolvePath('ar.aic', ESTIMATED))
  })

  it('count the transform against the sum it replaces', () => {
    const c = fftCost(ESTIMATED.fftSize)
    expect(resolvePath('fft.n', ESTIMATED)).toBe(ESTIMATED.fftSize)
    expect(resolvePath('fft.stages', ESTIMATED)).toBe(Math.log2(ESTIMATED.fftSize))
    expect(resolvePath('fft.butterflies', ESTIMATED)).toBe((c.n / 2) * c.stages)
    expect(resolvePath('fft.direct', ESTIMATED)).toBe(c.n * c.n)
    expect(resolvePath('fft.ratio', ESTIMATED)).toBeCloseTo((2 * c.n) / c.stages, 9)
  })
})

describe('a path nobody measures is a defect, not a blank', () => {
  it('throws on a path the resolver does not know', () => {
    expect(() => resolvePath('lms.nonsense', ADAPTIVE)).toThrow()
    expect(() => resolvePath('fix.nonsense', FIXED)).toThrow()
    expect(() => resolvePath('psd.nonsense', ESTIMATED)).toThrow()
    expect(() => resolvePath('ar.a9', ESTIMATED)).toThrow()
    expect(() => resolvePath('fft.nonsense', ESTIMATED)).toThrow()
  })

  it('throws on a path whose block is not in the chain', () => {
    expect(() => resolvePath('lms.reach', ESTIMATED)).toThrow(/no adaptive block/)
    expect(() => resolvePath('fix.radius', ESTIMATED)).toThrow(/no fixed-point block/)
  })
})
