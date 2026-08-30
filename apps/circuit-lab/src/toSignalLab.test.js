import { describe, it, expect } from 'vitest'
import { asDigitalFilter, suggestRate, asControlPlant } from './toSignalLab.js'
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

  it('hands a first-order circuit over raw — no named recipe, but no refusal either', () => {
    // There is no Q to put on a named block's knob, so the RC crosses as its
    // raw coefficients instead (Reed's full-fidelity rule).
    const d = asDigitalFilter(transferOf('rcLow', defaultsOf('rcLow')))
    expect(d.shape).toBeNull()
    expect(d.raw).toBe(true)
    expect(d.link).toBeTruthy()
    // Second order with a recognised numerator still gets the named form —
    // preferred, because its knobs mean something over there.
    const tank = asDigitalFilter(transferOf('rlcParallel', defaultsOf('rlcParallel')))
    expect(tank.shape).toBe('bandpass')
    expect(tank.raw).toBe(false)
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

  it('carries the twin-T raw — the showcase of the full-fidelity tier', () => {
    // No named mode can express a notch, and a band-pass "close enough"
    // would be confidently wrong at exactly the frequency the circuit exists
    // to remove. It used to decline; now Signal Lab's raw-coefficient biquad
    // receives it bilinear-exactly.
    const p = defaultsOf('twinT')
    const tf = transferOf('twinT', p, 'out')
    const rate = 48000
    const d = asDigitalFilter(tf, { sampleRate: rate })
    expect(d.shape).toBeNull()
    expect(d.raw).toBe(true)
    expect(d.clipped).toBe(false)

    // Bilinear-exact in the coefficients themselves: the notch is EXACTLY
    // zero at the pre-warped frequency — carried whole, not approximated —
    // and unity at DC and far above, same as the analog circuit.
    const f0 = 1 / (2 * Math.PI * p.r * p.c)
    const exact = {
      b0: d.digital.b[0],
      b1: d.digital.b[1],
      b2: d.digital.b[2],
      a1: d.digital.a[1],
      a2: d.digital.a[2],
    }
    expect(biquadResponse(exact, f0, rate)).toBeLessThan(1e-9)
    expect(biquadResponse(exact, 1, rate)).toBeCloseTo(1, 4)
    expect(biquadResponse(exact, rate / 2 - 1, rate)).toBeCloseTo(1, 2)

    // The LINK carries the five numbers in the receiver's schema order,
    // a-normalized — at the suite serializer's six significant figures
    // (deeplink.js trim). That prices the carried notch floor at roughly
    // −100 dB rather than −∞: stated, not hidden, and inaudibly deep. If
    // raw hand-overs ever deserve better, the ask is a serializer change
    // (packages/ui), not a deeper approximation here.
    const { patch, warnings } = parseLink(d.link)
    expect(warnings).toEqual([])
    expect(patch.blocks[0].type).toBe('biquad')
    const [b0, b1, b2, a1, a2] = patch.blocks[0].params
    expect(b0).toBeCloseTo(d.digital.b[0], 6)
    expect(a2).toBeCloseTo(d.digital.a[2], 6)
    expect(biquadResponse({ b0, b1, b2, a1, a2 }, f0, rate)).toBeLessThan(1e-4)

    // Control Lab is still declined — its second-order plant has no zeros.
    // The raw tier there waits on their `custom` plant (see NEEDS.md).
    expect(asControlPlant(tf)).toBeNull()
  })

  it('a first-order circuit crosses faithfully too, padded into the five slots', () => {
    const p = defaultsOf('rcLow')
    const rate = 192000
    const d = asDigitalFilter(transferOf('rcLow', p, 'c'), { sampleRate: rate })
    const { patch, warnings } = parseLink(d.link)
    expect(warnings).toEqual([])
    const [b0, b1, b2, a1, a2] = patch.blocks[0].params
    expect(b2).toBe(0)
    expect(a2).toBe(0)
    const coeffs = { b0, b1, b2, a1, a2 }
    const fc = 1 / (2 * Math.PI * p.r * p.c)
    // Exact at the pre-warped corner up to the link's six significant
    // figures, faithful (well under 1%) a decade out.
    expect(biquadResponse(coeffs, fc, rate)).toBeCloseTo(Math.SQRT1_2, 4)
    expect(biquadResponse(coeffs, fc / 10, rate)).toBeCloseTo(
      magnitudeAt(transferOf('rcLow', p, 'c'), fc / 10),
      3,
    )
  })

  it('still refuses the integrator, with its reason intact', () => {
    // A pole exactly at the origin: unbounded DC gain, a sampled copy that
    // counts forever. The one circuit whose hand-over stays declined.
    expect(asDigitalFilter(transferOf('integrator', defaultsOf('integrator'), 'out'))).toBeNull()
  })

  it('carries provenance, so the receiving lab can greet the circuit by name', () => {
    // from=circuit:<id>:<label> — the difference between a hand-over and a
    // teleport with amnesia, per the deeplink grammar. On both link kinds.
    const from = { app: 'circuit', id: 'twinT', label: 'Twin-T notch' }
    const tf = transferOf('twinT', defaultsOf('twinT'), 'out')
    const { patch, warnings } = parseLink(asDigitalFilter(tf, { from }).link)
    expect(warnings).toEqual([])
    expect(patch.from).toEqual(from)

    const rlc = transferOf('rlcSeries', defaultsOf('rlcSeries'), 'c')
    const plant = asControlPlant(rlc, { app: 'circuit', id: 'rlcSeries', label: 'Series RLC' })
    expect(parseLink(plant.link).patch.from).toEqual({
      app: 'circuit',
      id: 'rlcSeries',
      label: 'Series RLC',
    })
  })

  it('flags coefficients the receiving knobs cannot hold, before the link is copied', () => {
    // The inverting amp at gain −10: comfortable at its suggested rate, but
    // drop the rate toward the corner and b₀ outgrows the biquad's ±3.999.
    // Signal Lab would clamp with a warning on arrival; the panel warns
    // BEFORE, and says the fix (raise the rate).
    const tf = transferOf('inverting', defaultsOf('inverting'), 'out')
    expect(asDigitalFilter(tf, { sampleRate: 192000 }).clipped).toBe(false)
    expect(asDigitalFilter(tf, { sampleRate: 48000 }).clipped).toBe(true)
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

describe('the same circuit as a thing to control', () => {
  it('a series RLC across C is exactly a second-order plant', () => {
    const tf = transferOf('rlcSeries', p, 'c')
    const c = asControlPlant(tf)
    expect(c.plant).toBe('secondOrder')
    const [k, wn, zeta] = c.params
    expect(k).toBeCloseTo(1, 9)
    expect(wn).toBeCloseTo(1 / Math.sqrt(p.l * p.c), 6)
    expect(zeta).toBeCloseTo((p.r / 2) * Math.sqrt(p.c / p.l), 9)
    // The same two numbers the filter view calls f0 and Q.
    expect(wn / (2 * Math.PI)).toBeCloseTo(f0, 6)
    expect(1 / (2 * zeta)).toBeCloseTo(Q, 9)
  })

  it('and rebuilding it from those numbers gives the same response', () => {
    // The mapping has to be exact, not close: a plant that is nearly right
    // produces a loop whose margins are confidently wrong.
    const tf = transferOf('rlcSeries', p, 'c')
    const [k, wn, zeta] = asControlPlant(tf).params
    const rebuilt = { b: [k * wn * wn], a: [1, 2 * zeta * wn, wn * wn] }
    for (const r of [0.1, 0.5, 1, 2, 10]) {
      expect(magnitudeAt(rebuilt, f0 * r), `${r}x f0`).toBeCloseTo(magnitudeAt(tf, f0 * r), 9)
    }
  })

  it('declines the outputs whose numerator it cannot express', () => {
    // Across R and L the numerator carries zeros, and Control Lab's
    // second-order plant has none. A different system, so no hand-over.
    expect(asControlPlant(transferOf('rlcSeries', p, 'r'))).toBeNull()
    expect(asControlPlant(transferOf('rlcSeries', p, 'l'))).toBeNull()
  })

  it('maps an RC low-pass to a first-order lag with the right time constant', () => {
    const par = defaultsOf('rcLow')
    const c = asControlPlant(transferOf('rcLow', par, 'c'))
    expect(c.plant).toBe('firstOrder')
    expect(c.params[0]).toBeCloseTo(1, 9)
    expect(c.params[1]).toBeCloseTo(par.r * par.c, 12)
  })

  it('recognises the op-amp integrator as an integrator', () => {
    const par = defaultsOf('integrator')
    const c = asControlPlant(transferOf('integrator', par, 'out'))
    expect(c.plant).toBe('integrator')
    expect(c.params[0]).toBeCloseTo(1 / (par.r * par.c), 6)
  })

  it('builds a link that parses, for every circuit it accepts', () => {
    let offered = 0
    for (const [id, circ] of Object.entries(CIRCUITS)) {
      for (const o of circ.outputs) {
        const c = asControlPlant(transferOf(id, defaultsOf(id), o.key))
        if (!c) continue
        offered++
        const { patch, warnings } = parseLink(c.link)
        expect(warnings, `${id}/${o.key}`).toEqual([])
        expect(patch.plant.type, `${id}/${o.key}`).toBe(c.plant)
        expect(patch.ctrl.type, `${id}/${o.key}`).toBe('p')
      }
    }
    expect(offered, 'several circuits should be controllable').toBeGreaterThanOrEqual(4)
  })
})

describe('the emitted link (Reed\u2019s arrival fixes)', () => {
  it('sends a square near a fifth of the corner, zoomed to eight corners', () => {
    const tf = { b: [1], a: [1 / (2 * Math.PI * 1591.5), 1] } // RC at ~1591.5 Hz
    const d = asDigitalFilter(tf, { sampleRate: 192000 })
    expect(d.link).toContain('src=square:320:0.8')
    expect(d.link).toContain('zoom=12732')
    expect(d.link).not.toContain('noise')
  })
})
