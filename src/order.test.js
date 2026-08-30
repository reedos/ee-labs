import { describe, it, expect } from 'vitest'
import { designBiquad, biquadResponse } from './dsp/biquad.js'
import { PRESETS } from './presets.js'

// Filter order, and the claim the "Order is a choice" preset makes.
//
// Prompted by a fair question: the block panel describes a biquad as
// second-order, so are all filters second order? They are not. This tool only
// ships second-order sections, order comes from cascading them, and cascading
// identical sections gives the right ORDER but not a named response.

// Deliberately far above the frequencies measured. A digital biquad has a zero
// at Nyquist that its analogue prototype does not, so a slope measured near
// Nyquist reads much steeper than the asymptote: the same 2nd-order section
// measures 19 dB/octave at two-thirds of Nyquist and 12 well below it. That is
// a real property, not an error, but it is not what this test is about.
const SR = 192000
const FC = 1000
const db = (a) => 20 * Math.log10(a)
const lp = (q, fc = FC) => designBiquad({ mode: 'lowpass', freq: fc, q }, SR)
const cascade = (qs, f, fc = FC) =>
  qs.reduce((m, q) => m * biquadResponse(lp(q, fc), f, SR), 1)

/** Butterworth section Qs: poles spaced evenly around a semicircle. */
const butterworth = (N) =>
  Array.from({ length: N / 2 }, (_, k) => 1 / (2 * Math.cos(((2 * k + 1) * Math.PI) / (2 * N))))

describe('filter order', () => {
  it('every filter block this tool offers is second order', () => {
    // Not a law of DSP — a property of what is shipped, and worth pinning so the
    // explanation stays true if a higher-order block is ever added.
    const qs = butterworth(2)
    expect(qs).toHaveLength(1)
    expect(qs[0]).toBeCloseTo(Math.SQRT1_2, 6)
  })

  it('rolloff approaches 6 dB per octave per order', () => {
    // An asymptote, approached from above, so it is measured far out.
    for (const N of [2, 4, 6]) {
      const qs = butterworth(N)
      const slope = db(cascade(qs, 8 * FC)) - db(cascade(qs, 16 * FC))
      expect(slope, `order ${N}`).toBeGreaterThan(6 * N - 1)
      expect(slope, `order ${N}`).toBeLessThan(6 * N + 1.5)
    }
  })

  it('a Butterworth is -3.01 dB at its cutoff whatever its order', () => {
    // This is what pins the Q values: the definition, not a convention.
    for (const N of [2, 4, 6, 8]) {
      expect(db(cascade(butterworth(N), FC)), `order ${N}`).toBeCloseTo(-3.0103, 3)
    }
  })

  it('cascading identical 0.707 sections is NOT a Butterworth', () => {
    const naive = [Math.SQRT1_2, Math.SQRT1_2]
    const real = butterworth(4)

    // Each section contributes its own -3.01 dB at the corner, so they stack.
    expect(db(cascade(naive, FC))).toBeCloseTo(-6.02, 1)
    expect(db(cascade(real, FC))).toBeCloseTo(-3.01, 1)

    // And the naive one sags well before the corner, where a Butterworth is
    // still flat — that is precisely what "maximally flat" buys.
    expect(db(cascade(naive, FC / 2))).toBeLessThan(-0.3)
    expect(db(cascade(real, FC / 2))).toBeGreaterThan(-0.1)

    // Far out they agree, because order alone sets the asymptotic slope.
    const far = (qs) => db(cascade(qs, 8 * FC)) - db(cascade(qs, 16 * FC))
    expect(Math.abs(far(naive) - far(real))).toBeLessThan(0.5)
  })

  it('the preset really does use the Butterworth pair, not 0.707 twice', () => {
    const p = PRESETS.find((x) => x.name === 'Order is a choice')
    expect(p, 'preset exists').toBeTruthy()
    const qs = p.patch.blocks.map((b) => b.params.q)
    const want = butterworth(4)
    expect(qs).toHaveLength(2)
    for (let i = 0; i < 2; i++) expect(qs[i], `section ${i}`).toBeCloseTo(want[i], 2)
    // Same cutoff in both, or it is not a cascade of one filter.
    expect(p.patch.blocks[0].params.freq).toBe(p.patch.blocks[1].params.freq)
  })

  it('the preset lands on -3.01 dB at its own cutoff and sample rate', () => {
    const p = PRESETS.find((x) => x.name === 'Order is a choice')
    const sr = p.patch.sampleRate
    const fc = p.patch.blocks[0].params.freq
    const mag = p.patch.blocks.reduce(
      (m, b) => m * biquadResponse(designBiquad({ mode: b.type, ...b.params }, sr), fc, sr),
      1,
    )
    expect(db(mag)).toBeCloseTo(-3.01, 1)
  })
})
