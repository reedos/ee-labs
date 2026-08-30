import { describe, it, expect } from 'vitest'
import {
  BIQUAD_MODES,
  biquadResponse,
  designBiquad,
  isStable,
  makeBiquad,
  poleRadius,
  settleSamples,
} from './biquad.js'

const SR = 8000
const d = (mode, freq, q, gainDb) => designBiquad({ mode, freq, q, gainDb }, SR)
const H = (c, f) => biquadResponse(c, f, SR)

describe('designBiquad', () => {
  it('rejects an unknown mode', () => {
    expect(() => d('bogus', 1000, 1)).toThrow(/unknown biquad mode/)
  })

  it('normalizes so a0 = 1', () => {
    // Not directly observable, but |H(0)| = 1 for a lowpass only holds if it did.
    expect(H(d('lowpass', 1000, 1), 0)).toBeCloseTo(1, 12)
  })
})

// These are algebraic identities, not approximations, so they are asserted to 10+
// places. If any of them drifts, a coefficient is wrong — not a tolerance.
describe('exact identities', () => {
  it('lowpass |H(f0)| = Q, exactly', () => {
    // At w = w0 the numerator magnitude is sin^2(w0) and the denominator is
    // 2*alpha*sin(w0), so |H| = sin(w0)/(2*alpha) = Q. This is what Q *means*:
    // the height of the resonant peak. Q = 0.7071 gives -3.01 dB, which is where
    // "the cutoff frequency" comes from.
    for (const q of [0.5, Math.SQRT1_2, 1, 2, 8, 20]) {
      expect(H(d('lowpass', 1000, q), 1000)).toBeCloseTo(q, 10)
    }
  })

  it('lowpass passes DC and stops Nyquist', () => {
    const c = d('lowpass', 1000, 1)
    expect(H(c, 0)).toBeCloseTo(1, 12)
    expect(H(c, SR / 2)).toBeLessThan(1e-12)
  })

  it('highpass mirrors it', () => {
    const c = d('highpass', 1000, 1)
    expect(H(c, 0)).toBeLessThan(1e-12)
    expect(H(c, SR / 2)).toBeCloseTo(1, 12)
  })

  it('bandpass has unity peak gain at f0', () => {
    for (const q of [0.5, 1, 4, 12]) {
      expect(H(d('bandpass', 1000, q), 1000)).toBeCloseTo(1, 12)
    }
    const c = d('bandpass', 1000, 1)
    expect(H(c, 0)).toBeLessThan(1e-12)
    expect(H(c, SR / 2)).toBeLessThan(1e-12)
  })

  it('notch is exactly zero at f0', () => {
    const c = d('notch', 1000, 4)
    expect(H(c, 1000)).toBeLessThan(1e-12)
    // ...and unity far from it, on both sides.
    expect(H(c, 0)).toBeCloseTo(1, 12)
    expect(H(c, SR / 2)).toBeCloseTo(1, 12)
  })

  it('peaking hits exactly its requested gain at f0', () => {
    for (const g of [-24, -12, -6, 6, 12, 24]) {
      expect(H(d('peaking', 1000, 1, g), 1000)).toBeCloseTo(Math.pow(10, g / 20), 10)
    }
  })

  it('allpass has unity magnitude at every frequency', () => {
    // The numerator is e^{-2jw} times the conjugate of the denominator, so the
    // magnitude is identically 1 and only the phase moves. This is the one filter
    // whose whole effect is invisible in the spectrum.
    const c = d('allpass', 700, 3)
    for (let f = 0; f <= SR / 2; f += SR / 400) {
      expect(H(c, f)).toBeCloseTo(1, 12)
    }
  })
})

describe('rolloff', () => {
  it('falls at 12 dB per octave well above cutoff', () => {
    // Two poles, so an octave costs a factor of 4 in amplitude. Measured far enough
    // above f0 to be in the asymptote and far enough below Nyquist to avoid the
    // bilinear transform's frequency warping.
    const c = designBiquad({ mode: 'lowpass', freq: 100, q: Math.SQRT1_2 }, 192000)
    for (const f of [800, 1600, 3200]) {
      const ratio =
        biquadResponse(c, f, 192000) / biquadResponse(c, 2 * f, 192000)
      expect(ratio).toBeCloseTo(4, 1)
    }
  })

  it('highpass falls at 12 dB per octave below cutoff', () => {
    const c = designBiquad({ mode: 'highpass', freq: 10000, q: Math.SQRT1_2 }, 192000)
    for (const f of [1250, 625, 312.5]) {
      const ratio =
        biquadResponse(c, f, 192000) / biquadResponse(c, f / 2, 192000)
      expect(ratio).toBeCloseTo(4, 1)
    }
  })
})

describe('stability', () => {
  it('holds across the whole parameter grid the UI can reach', () => {
    for (const mode of BIQUAD_MODES) {
      for (const freq of [1, 20, 100, 1000, 3000, 3900, 3992]) {
        for (const q of [0.05, 0.5, 1, 5, 20, 40]) {
          const c = d(mode, freq, q, 12)
          expect(isStable(c), `${mode} f=${freq} q=${q}`).toBe(true)
          expect(poleRadius(c)).toBeLessThan(1)
        }
      }
    }
  })

  it('clamps out-of-range input rather than producing garbage', () => {
    for (const c of [d('lowpass', -50, 1), d('lowpass', SR, 1), d('lowpass', 1000, 1e6)]) {
      expect(isStable(c)).toBe(true)
      expect(Number.isFinite(c.b0)).toBe(true)
    }
  })

  it('impulse response actually decays within settleSamples', () => {
    for (const q of [0.707, 5, 20]) {
      const c = d('lowpass', 200, q)
      const n = settleSamples(c)
      expect(n).toBeLessThan(1e6)
      const step = makeBiquad(c)
      let last = 0
      for (let i = 0; i < n; i++) last = step(i === 0 ? 1 : 0)
      // Everything after the settle point is below the threshold.
      for (let i = 0; i < 200; i++) last = Math.max(last, Math.abs(step(0)))
      expect(Math.abs(last)).toBeLessThan(1e-5)
    }
  })

  it('higher Q rings longer', () => {
    const short = settleSamples(d('lowpass', 200, 0.707))
    const long = settleSamples(d('lowpass', 200, 20))
    expect(long).toBeGreaterThan(short)
  })
})

describe('makeBiquad', () => {
  it('is a passthrough for the identity coefficients', () => {
    const step = makeBiquad({ b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 })
    for (const x of [1, -0.5, 0.25, 0]) expect(step(x)).toBe(x)
  })

  it('starts from rest', () => {
    const step = makeBiquad(d('lowpass', 1000, 1))
    expect(step(0)).toBe(0)
  })

  it('settles to the DC gain for a constant input', () => {
    // |H(0)| = 1 for a lowpass, so a DC input of 0.5 must converge to 0.5.
    const step = makeBiquad(d('lowpass', 1000, 1))
    let y = 0
    for (let i = 0; i < 2000; i++) y = step(0.5)
    expect(y).toBeCloseTo(0.5, 10)
  })
})
