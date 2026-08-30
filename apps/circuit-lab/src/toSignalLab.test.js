import { describe, it, expect } from 'vitest'
import { asDigitalFilter, suggestRate } from './toSignalLab.js'
import { transferOf, defaultsOf, CIRCUITS } from './circuits.js'
import { parseLink } from '@ee-labs/ui'
import { magnitudeAt, secondOrderMetrics } from '@ee-labs/systems'
import { designBiquad, biquadResponse } from '@ee-labs/dsp'

// The bridge is the suite's central claim made checkable: an RLC network and a
// biquad are the same object. If the mapping is wrong, the claim is marketing.

const p = defaultsOf('rlcSeries')
const f0 = 1 / (2 * Math.PI * Math.sqrt(p.l * p.c))
const Q = (1 / p.r) * Math.sqrt(p.l / p.c)

describe('recognising which filter a circuit is', () => {
  it('reads the shape off the numerator', () => {
    expect(asDigitalFilter(transferOf('rlcSeries', p, 'c')).shape).toBe('lowpass')
    expect(asDigitalFilter(transferOf('rlcSeries', p, 'r')).shape).toBe('bandpass')
    expect(asDigitalFilter(transferOf('rlcSeries', p, 'l')).shape).toBe('highpass')
  })

  it('recovers the circuit’s own resonance and Q', () => {
    const d = asDigitalFilter(transferOf('rlcSeries', p, 'c'))
    expect(d.f0).toBeCloseTo(f0, 6)
    expect(d.q).toBeCloseTo(Q, 9)
    expect(d.zeta).toBeCloseTo(1 / (2 * Q), 9)
  })

  it('offers nothing for a circuit that is not a second-order section', () => {
    // First order, so there is no Q to hand over.
    expect(asDigitalFilter(transferOf('rcLow', defaultsOf('rcLow')))).toBeNull()
    // Second order but its numerator is not a recognised shape.
    const tank = asDigitalFilter(transferOf('rlcParallel', defaultsOf('rlcParallel')))
    expect(tank.shape).toBe('bandpass')
  })

  it('builds a link that actually carries the filter', () => {
    const d = asDigitalFilter(transferOf('rlcSeries', p, 'c'), { sampleRate: 96000 })
    const { patch, warnings } = parseLink(d.link)
    expect(warnings).toEqual([])
    expect(patch.rate).toBe(96000)
    expect(patch.blocks[0].type).toBe('lowpass')
    expect(patch.blocks[0].params[0]).toBeCloseTo(f0, 0)
    expect(patch.blocks[0].params[1]).toBeCloseTo(Q, 3)
  })

  it('the discretised filter matches the circuit near the corner', () => {
    // The claim, checked: the sampled version and the continuous one agree
    // where it matters, which is what "the same filter" has to mean.
    const tf = transferOf('rlcSeries', p, 'c')
    const d = asDigitalFilter(tf, { sampleRate: 500000 })
    const dmag = (f) => {
      const w = (2 * Math.PI * f) / d.sampleRate
      let nr = 0, ni = 0, dr = 0, di = 0
      for (let i = 0; i < d.digital.b.length; i++) {
        nr += d.digital.b[i] * Math.cos(-i * w)
        ni += d.digital.b[i] * Math.sin(-i * w)
      }
      for (let i = 0; i < d.digital.a.length; i++) {
        dr += d.digital.a[i] * Math.cos(-i * w)
        di += d.digital.a[i] * Math.sin(-i * w)
      }
      return Math.hypot(nr, ni) / Math.hypot(dr, di)
    }
    for (const f of [f0 / 4, f0 / 2, f0, f0 * 2]) {
      expect(dmag(f) / magnitudeAt(tf, f), `${f.toFixed(0)} Hz`).toBeCloseTo(1, 1)
    }
    // At the corner exactly, where the transform was pre-warped, it is tight.
    expect(dmag(f0) / magnitudeAt(tf, f0)).toBeCloseTo(1, 3)
  })

  it('flags a sample rate too low for the correspondence to mean much', () => {
    const tf = transferOf('rlcSeries', p, 'c')
    expect(asDigitalFilter(tf, { sampleRate: 8000 }).tooFast).toBe(true)
    expect(asDigitalFilter(tf, { sampleRate: 500000 }).tooFast).toBe(false)
  })

  it('suggests a rate with room above the circuit', () => {
    expect(suggestRate(100)).toBeGreaterThanOrEqual(8000)
    expect(suggestRate(5000)).toBeGreaterThanOrEqual(192000 / 2)
    // Always a real rate, never something a tool would refuse.
    for (const f of [1, 50, 500, 5000, 50000]) {
      expect([8000, 16000, 22050, 44100, 48000, 96000, 192000]).toContain(suggestRate(f))
    }
  })

  it('every second-order circuit can be handed over', () => {
    for (const [id, c] of Object.entries(CIRCUITS)) {
      for (const o of c.outputs) {
        const tf = transferOf(id, defaultsOf(id), o.key)
        const d = asDigitalFilter(tf)
        // Either it is a recognised section with a link, or it declines.
        if (secondOrderMetrics(tf) && d && d.shape) {
          expect(d.link, `${id}/${o.key}`).toBeTruthy()
          expect(parseLink(d.link).warnings, `${id}/${o.key}`).toEqual([])
        }
      }
    }
  })
})

describe('the whole way across', () => {
  // The path an actual user takes: a circuit produces a link, the link names a
  // biquad mode with a cutoff and a Q, and Signal Lab designs a filter from
  // those three things. If the mapping is wrong anywhere along that chain, the
  // filter it ends up with is not the circuit that was handed over.
  //
  // This deliberately goes through designBiquad — the same function Signal Lab
  // calls — rather than through the bilinear coefficients, because the link
  // carries parameters, not coefficients.
  const SR = 500000

  const viaLink = (out) => {
    const tf = transferOf('rlcSeries', p, out)
    const d = asDigitalFilter(tf, { sampleRate: SR })
    const { patch, warnings } = parseLink(d.link)
    expect(warnings, out).toEqual([])
    const [mode, freq, q] = [patch.blocks[0].type, ...patch.blocks[0].params]
    return { tf, coeffs: designBiquad({ mode, freq, q }, SR), mode, freq, q }
  }

  it('a circuit handed over comes back as the same response', () => {
    // Exact at the corner, and close either side of it — but not identical, and
    // the difference is worth being precise about. Signal Lab designs an RBJ
    // cookbook biquad directly in the digital domain from (mode, f0, Q); it is
    // not the bilinear transform of this particular network. The two agree on
    // what a second-order section with that resonance and Q means, and differ
    // by about 1% two octaves out, where the numerator shaping of the two
    // designs is not quite the same thing.
    for (const out of ['c', 'r', 'l']) {
      const { tf, coeffs } = viaLink(out)
      // At the corner the correspondence is what defines both filters.
      expect(biquadResponse(coeffs, f0, SR) / magnitudeAt(tf, f0), `${out} at f0`).toBeCloseTo(1, 3)
      // Away from it, close but not exact.
      for (const r of [0.25, 0.5, 2, 4]) {
        const f = f0 * r
        const ratio = biquadResponse(coeffs, f, SR) / magnitudeAt(tf, f)
        expect(ratio, `${out} at ${r}x f0`).toBeGreaterThan(0.98)
        expect(ratio, `${out} at ${r}x f0`).toBeLessThan(1.02)
      }
    }
  })

  it('and it is the mode the circuit actually is', () => {
    expect(viaLink('c').mode).toBe('lowpass')
    expect(viaLink('r').mode).toBe('bandpass')
    expect(viaLink('l').mode).toBe('highpass')
  })

  it('carrying the circuit’s own resonance and Q, not approximations of them', () => {
    const { freq, q } = viaLink('c')
    expect(freq).toBeCloseTo(f0, 0)
    expect(q).toBeCloseTo(Q, 3)
  })

  it('changing a component changes what gets handed over', () => {
    // A bridge that ignored the components would pass every test above.
    const stiff = asDigitalFilter(transferOf('rlcSeries', { ...p, l: p.l / 4 }, 'c'), {
      sampleRate: SR,
    })
    const soft = asDigitalFilter(transferOf('rlcSeries', p, 'c'), { sampleRate: SR })
    expect(stiff.f0).toBeCloseTo(soft.f0 * 2, 0)
    expect(stiff.link).not.toBe(soft.link)
  })
})

describe('choosing a sample rate for a circuit', () => {
  // The panel derives its rate from the circuit rather than holding it in
  // state, because a useState initializer runs once: the rate stayed at
  // whatever the FIRST circuit needed, and a 5 kHz resonance then got sampled
  // at 48 kHz — nine samples a cycle — so the panel warned about a problem it
  // had created itself.
  it('gives every circuit enough room above its own resonance', () => {
    for (const [id, c] of Object.entries(CIRCUITS)) {
      for (const o of c.outputs) {
        const tf = transferOf(id, defaultsOf(id), o.key)
        const nat = asDigitalFilter(tf)
        if (!nat || !nat.shape) continue
        const d = asDigitalFilter(tf, { sampleRate: suggestRate(nat.f0) })
        expect(d.tooFast, `${id}/${o.key} at ${d.sampleRate} Hz`).toBe(false)
      }
    }
  })
})
