import { describe, expect, it } from 'vitest'
import { sincInterp } from './reconstruct.js'

// The sampling theorem, measured - both faces of it.

const FS = 8000
const N = 4096
const sampled = (f, phase = 0.3) =>
  Float64Array.from({ length: N }, (_, i) => Math.sin((2 * Math.PI * f * i) / FS + phase))

describe('ideal (sinc) reconstruction', () => {
  it('reproduces a sub-Nyquist sine BETWEEN its samples', () => {
    // The claim the scope's reconstructed trace makes: these dots describe
    // exactly one bandlimited signal, and this is it. Checked at off-grid
    // instants an interpolation cannot fake: t = i + 0.37 samples.
    const f = 700
    const buf = sampled(f)
    for (const t of [900.37, 1500.5, 2048.11, 3000.77]) {
      const truth = Math.sin((2 * Math.PI * f * t) / FS + 0.3)
      expect(Math.abs(sincInterp(buf, t, 256) - truth)).toBeLessThan(2e-3)
    }
  })

  it('widening the window shrinks the truncation error', () => {
    // The stated caveat, as a rate: half = 256 must beat half = 16 clearly.
    const f = 700
    const buf = sampled(f)
    const err = (half) => Math.abs(sincInterp(buf, 2048.11, half) - Math.sin((2 * Math.PI * f * 2048.11) / FS + 0.3))
    expect(err(256)).toBeLessThan(err(16) / 3)
  })

  it('reproduces the ALIAS for a sine above Nyquist', () => {
    // The other face: sample 5.2 kHz at 8 kHz and the samples genuinely
    // describe 2.8 kHz. Reconstruction cannot recover what sampling
    // discarded - it lands on the folded sine, phase-flipped, exactly as
    // the fold predicts: sin(2pi f t) at t = i/fs equals -sin(2pi (fs-f) t - phase details).
    const f = 5200
    const alias = FS - f // 2800
    const buf = sampled(f, 0)
    for (const t of [900.37, 2048.11]) {
      const folded = -Math.sin((2 * Math.PI * alias * t) / FS)
      expect(Math.abs(sincInterp(buf, t, 256) - folded)).toBeLessThan(2e-3)
    }
  })

  it('reproduces a bandlimited square off-grid, harmonic by harmonic', () => {
    // Three odd harmonics, all below Nyquist: the sum is bandlimited, so
    // reconstruction owes us the exact continuous sum between samples.
    const f = 300
    const buf = Float64Array.from({ length: N }, (_, i) => {
      let v = 0
      for (const k of [1, 3, 5]) v += Math.sin((2 * Math.PI * k * f * i) / FS) / k
      return v
    })
    const t = 2000.41
    let truth = 0
    for (const k of [1, 3, 5]) truth += Math.sin((2 * Math.PI * k * f * t) / FS) / k
    expect(Math.abs(sincInterp(buf, t, 256) - truth)).toBeLessThan(4e-3)
  })
})
