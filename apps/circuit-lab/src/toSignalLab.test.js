import { describe, it, expect } from 'vitest'
import { asDigitalFilter, suggestRate, asControlPlant } from './toSignalLab.js'
import { transferOf, defaultsOf, CIRCUITS } from './circuits.js'
import { parseLink } from '@ee-labs/ui'
import { magnitudeAt, secondOrderMetrics, dcGain } from '@ee-labs/systems'
import { designBiquad, designFirstOrder, biquadResponse, isStable } from '@ee-labs/dsp'

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

  it('hands a first-order low-pass over BY NAME, order 1 in the link', () => {
    // Reed's rule, upgraded from the raw tier: Signal Lab has a named
    // 1st-order recipe (the order select), so a unity-gain RC low-pass
    // crosses as b=lowpass:<fc>:<q>:1 — the corner by name, not anonymous
    // coefficients. The Q slot carries the default; order 1 has no Q.
    const d = asDigitalFilter(transferOf('rcLow', defaultsOf('rcLow')))
    expect(d.shape).toBe('lowpass')
    expect(d.order).toBe(1)
    expect(d.raw).toBe(false)
    const { patch, warnings } = parseLink(d.link)
    expect(warnings).toEqual([])
    expect(patch.blocks[0].type).toBe('lowpass')
    expect(patch.blocks[0].params[2]).toBe(1)
    // Second order with a recognised numerator still gets the named form —
    // preferred, because its knobs mean something over there.
    const tank = asDigitalFilter(transferOf('rlcParallel', defaultsOf('rlcParallel')))
    expect(tank.shape).toBe('bandpass')
    expect(tank.order).toBe(2)
    expect(tank.raw).toBe(false)
  })

  it('the named 1st-order map is EXACT: bilinear of the circuit equals the recipe', () => {
    // The claim the panel makes with no hedge, proven at the coefficient
    // level: Signal Lab's designFirstOrder is the pre-warped bilinear
    // transform of the unity-gain prototype, so discretising the RC gives
    // the same section Signal Lab designs from (fc, order 1), to rounding.
    const q = defaultsOf('rcLow')
    const rate = 192000
    const d = asDigitalFilter(transferOf('rcLow', q, 'c'), { sampleRate: rate })
    const recipe = designFirstOrder({ mode: 'lowpass', freq: d.f0 }, rate)
    expect(d.digital.b[0]).toBeCloseTo(recipe.b0, 12)
    expect(d.digital.b[1] ?? 0).toBeCloseTo(recipe.b1, 12)
    expect(d.digital.a[1] ?? 0).toBeCloseTo(recipe.a1, 12)
    // And the corner lands where the panel says: |H| = 1/√2 exactly there.
    expect(biquadResponse({ ...recipe }, d.f0, rate)).toBeCloseTo(Math.SQRT1_2, 9)
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
    // a-normalized — and raw-coefficient carriers serialize EXACTLY
    // (deeplink.js trimExact is the shortest round-trip decimal; named knobs
    // stay at six figures). Six figures priced this notch floor at −100 dB,
    // twelve at −140 dB, and twelve still broke a component-extreme tank's
    // Q ≈ 3×10⁴ resonance — exact costs a few characters and ends the story.
    const { patch, warnings } = parseLink(d.link)
    expect(warnings).toEqual([])
    expect(patch.blocks[0].type).toBe('biquad')
    const [b0, b1, b2, a1, a2] = patch.blocks[0].params
    expect(b0).toBeCloseTo(d.digital.b[0], 10)
    expect(a2).toBeCloseTo(d.digital.a[2], 10)
    expect(biquadResponse({ b0, b1, b2, a1, a2 }, f0, rate)).toBeLessThan(1e-7)

    // And Control Lab receives it too now, raw: the custom plant holds the
    // zeros no named plant could (it used to be declined here).
    expect(asControlPlant(tf).plant).toBe('custom')
  })

  it('the named 1st-order link lands on the circuit’s own curve', () => {
    // The link now says lowpass:<fc>:<q>:1 rather than five raw numbers;
    // what must survive unchanged is the FIDELITY: rebuild the section the
    // receiving recipe designs from the linked corner, and it sits on the
    // circuit's curve — exact at the pre-warped corner up to the link's six
    // significant figures, faithful (well under 1%) a decade out.
    const p = defaultsOf('rcLow')
    const rate = 192000
    const d = asDigitalFilter(transferOf('rcLow', p, 'c'), { sampleRate: rate })
    const { patch, warnings } = parseLink(d.link)
    expect(warnings).toEqual([])
    expect(patch.blocks[0].type).toBe('lowpass')
    const [linkFc, , linkOrder] = patch.blocks[0].params
    expect(linkOrder).toBe(1)
    const coeffs = designFirstOrder({ mode: 'lowpass', freq: linkFc }, rate)
    const fc = 1 / (2 * Math.PI * p.r * p.c)
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

  it('coefficients the knobs cannot hold are FACTORED, not flagged — the filter still crosses whole', () => {
    // The inverting amp at gain −10, rate dropped toward the corner: b₀ used
    // to outgrow the biquad's ±3.999 and the panel could only say "raise the
    // rate". The app changed, not this test's subject: the numerator now
    // crosses normalized (largest tap = 1) with the factor as a gain block —
    // an exact rational scaling — so nothing clips at ANY rate and the old
    // clipped pin is retired. The inversion stays in the coefficients' sign,
    // which is why this circuit is raw in the first place: no dB knob says a
    // minus.
    const tf = transferOf('inverting', defaultsOf('inverting'), 'out')

    const high = asDigitalFilter(tf, { sampleRate: 192000 })
    expect(high.raw).toBe(true)
    expect(high.rawReason).toBe('inverted')
    expect(high.clipped).toBe(false)
    expect(high.gainDb).toBeNull() // fits the knobs unfactored
    expect(high.carried.b[0]).toBeLessThan(0)

    const low = asDigitalFilter(tf, { sampleRate: 48000 })
    expect(low.clipped).toBe(false)
    expect(low.gainDb).not.toBeNull()
    const { patch, warnings } = parseLink(low.link)
    expect(warnings).toEqual([])
    const [b0, b1, b2, a1, a2] = patch.blocks[0].params
    for (const v of [b0, b1, b2, a1, a2]) expect(Math.abs(v)).toBeLessThanOrEqual(3.999)
    expect(patch.blocks[1].type).toBe('gain')
    const k = Math.pow(10, patch.blocks[1].params[0] / 20)
    // The pair IS the circuit: exact at DC (bilinear maps s = 0 to z = 1
    // with no warp error) and at the pre-warped corner — to the gain knob's
    // six-figure serialization, the same precision every named knob carries.
    const fc = 1 / (2 * Math.PI * defaultsOf('inverting').rf * defaultsOf('inverting').cf)
    expect((k * biquadResponse({ b0, b1, b2, a1, a2 }, 0, 48000)) / magnitudeAt(tf, 0)).toBeCloseTo(1, 5)
    expect((k * biquadResponse({ b0, b1, b2, a1, a2 }, fc, 48000)) / magnitudeAt(tf, fc)).toBeCloseTo(1, 3)
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

  it('crosses the outputs with zeros as the exact custom plant', () => {
    // Across R and L the numerator carries zeros no NAMED plant holds, and
    // they used to be refused for it. Control Lab's `custom` plant holds
    // anything rational of order <= 2, so now they cross - and the mapping
    // must be EXACT: rebuild H(s) from the six coefficients the link
    // carries (bit-exact round-trip serialization) and it is the same
    // function, not a neighbour of it.
    const stripL = (c) => {
      const out = [...c]
      while (out.length > 1 && Math.abs(out[0]) < 1e-18) out.shift()
      return out
    }
    for (const out of ['r', 'l']) {
      const tf = transferOf('rlcSeries', p, out)
      const c = asControlPlant(tf)
      expect(c.plant, out).toBe('custom')
      const { patch, warnings } = parseLink(c.link)
      expect(warnings, out).toEqual([])
      const [b2, b1, b0, a2, a1, a0] = patch.plant.params
      const rebuilt = { b: stripL([b2, b1, b0]), a: stripL([a2, a1, a0]) }
      for (const r of [0.1, 0.5, 1, 2, 10]) {
        const want = magnitudeAt(tf, f0 * r)
        const got = magnitudeAt(rebuilt, f0 * r)
        expect(Math.abs(got - want) / (want || 1), `${out} at ${r}x f0`).toBeLessThan(1e-9)
      }
    }
  })

  it('maps an RC low-pass to a first-order lag with the right time constant', () => {
    const par = defaultsOf('rcLow')
    const c = asControlPlant(transferOf('rcLow', par, 'c'))
    expect(c.plant).toBe('firstOrder')
    expect(c.params[0]).toBeCloseTo(1, 9)
    expect(c.params[1]).toBeCloseTo(par.r * par.c, 12)
  })

  it('the op-amp integrator crosses with its SIGN — custom, not a flipped named integrator', () => {
    // The app changed and this test's old pin was the bug: H = −1/(sRC) used
    // to cross as +K/s via Math.abs, and closing negative feedback around
    // what is really an INVERTING integrator is positive feedback — the
    // received loop showed stable margins in exactly the case the real one
    // has none. No named gain knob says a sign (they start at 0.001), so the
    // sign rides the exact custom coefficients instead.
    const par = defaultsOf('integrator')
    const tf = transferOf('integrator', par, 'out')
    const c = asControlPlant(tf)
    expect(c.plant).toBe('custom')
    const [b2, b1, b0, a2, a1, a0] = c.params
    expect(b0).toBeLessThan(0) // the inversion, carried
    expect(a0).toBe(0) // the pole at the origin, carried
    // Rebuild H(s) from the six numbers: same magnitude AND same sign.
    expect(Math.abs(b0 / a1)).toBeCloseTo(1 / (par.r * par.c), 9)
    expect(magnitudeAt({ b: [b0], a: [a1, a0] }, 100)).toBeCloseTo(magnitudeAt(tf, 100), 9)
    expect(b2).toBe(0)
    expect(b1).toBe(0)
    expect(a2).toBe(0)

    // The NAMED integrator tier still exists for what it is exact for: a
    // non-inverting integrator (a transconductance charging a capacitor).
    const pos = asControlPlant({ b: [1], a: [1e-4, 0] })
    expect(pos.plant).toBe('integrator')
    expect(pos.params[0]).toBeCloseTo(1e4, 9)
  })

  it('the inverting amplifier crosses custom — a −10 clamped to the k knob’s +0.001 is a different plant', () => {
    const tf = transferOf('inverting', defaultsOf('inverting'), 'out')
    const c = asControlPlant(tf)
    expect(c.plant).toBe('custom')
    const [, , b0, , a1, a0] = c.params
    // DC gain −10 exactly, sign intact.
    expect(b0 / a0).toBeCloseTo(-10, 9)
    expect(a1 / a0).toBeCloseTo(defaultsOf('inverting').rf * defaultsOf('inverting').cf, 12)
  })

  it('named knobs that cannot hold the values are not clamped into — the circuit crosses custom, exact', () => {
    // The receiver's ζ knob spans 0.01…5; the component box reaches 1.6e-4
    // and 1.6e7. Overdamped and barely-damped RLCs used to arrive clamped
    // (a silently different plant); now they cross raw.
    for (const [r, whatFor] of [
      [1e5, 'overdamped, ζ ≈ 158'],
      [1, 'barely damped, ζ ≈ 1.6e-3'],
    ]) {
      const tf = transferOf('rlcSeries', { r, l: 10e-3, c: 100e-9 }, 'c')
      const c = asControlPlant(tf)
      expect(c.plant, whatFor).toBe('custom')
      const [b2, b1, b0, a2, a1, a0] = c.params
      for (const f of [100, 5033, 50000]) {
        expect(magnitudeAt({ b: [b2, b1, b0], a: [a2, a1, a0] }, f) / magnitudeAt(tf, f), `${whatFor} at ${f} Hz`).toBeCloseTo(1, 9)
      }
    }
    // A time constant past the τ knob's 100 s: same treatment.
    const slow = asControlPlant(transferOf('rcLow', { r: 1e6, c: 1e-3 }, 'c'))
    expect(slow.plant).toBe('custom')
  })

  it('a twin-T at nanosecond τ scales its coefficients into the ±1e12 fields — by a power of two, H unchanged', () => {
    // τ = RC = 1 ns puts 1/τ² = 1e24 in the a₀-normalized polynomials, far
    // past the receiving fields' ±1e12. One common scale is free in a ratio;
    // dividing all six by 2ⁿ is EXACT in binary floating point.
    const p = { r: 1000, c: 1e-12 } // τ = 1e-9
    const tf = transferOf('twinT', p, 'out')
    const c = asControlPlant(tf)
    expect(c.plant).toBe('custom')
    for (const v of c.params) expect(Math.abs(v)).toBeLessThanOrEqual(1e12)
    const [b2, b1, b0, a2, a1, a0] = c.params
    const f0 = 1 / (2 * Math.PI * p.r * p.c)
    // Exact rebuild: the circuit's own curve off the notch (the Q = 1/4
    // skirt is already 0.08% down two decades out — compare to the circuit,
    // not to a remembered "unity"), and zero at the notch itself.
    const rebuilt = { b: [b2, b1, b0], a: [a2, a1, a0] }
    for (const f of [f0 / 100, f0 / 3, f0 * 3, f0 * 100]) {
      expect(magnitudeAt(rebuilt, f) / magnitudeAt(tf, f), `${f.toFixed(0)} Hz`).toBeCloseTo(1, 9)
    }
    expect(magnitudeAt(rebuilt, f0)).toBeLessThan(1e-9)
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

  describe('the plant contract: nothing it emits can arrive clamped', () => {
    // Control Lab's knob ranges, mirrored (apps/control-lab/src/systems.js).
    // The receiver clamps out-of-range arrivals with a warning; the emitter
    // must therefore never put a value outside these on a named plant, and
    // everything else must ride `custom` inside its ±1e12 fields.
    const RANGES = {
      secondOrder: [
        [0.001, 1e6],
        [0.01, 1e8],
        [0.01, 5],
      ],
      firstOrder: [
        [0.001, 1e6],
        [1e-7, 100],
      ],
      integrator: [[0.001, 1e6]],
    }
    const rebuildTf = (type, p) =>
      type === 'secondOrder'
        ? { b: [p[0] * p[1] * p[1]], a: [1, 2 * p[2] * p[1], p[1] * p[1]] }
        : type === 'firstOrder'
          ? { b: [p[0]], a: [p[1], 1] }
          : type === 'integrator'
            ? { b: [p[0]], a: [1, 0] }
            : { b: [p[0], p[1], p[2]], a: [p[3], p[4], p[5]] }
    const cartesian = (lists) =>
      lists.reduce((acc, list) => acc.flatMap((c) => list.map((v) => [...c, v])), [[]])

    it('holds across the component extremes of every circuit', () => {
      for (const [id, circ] of Object.entries(CIRCUITS)) {
        const combos = cartesian(circ.params.map((p) => [p.min, p.value, p.max]))
        for (const combo of combos) {
          const params = {}
          circ.params.forEach((p, i) => (params[p.key] = combo[i]))
          for (const o of circ.outputs) {
            const tf = transferOf(id, params, o.key)
            const c = asControlPlant(tf)
            const tag = `${id}[${combo.join(',')}]/${o.key}`
            // Every catalog circuit is rational of order ≤ 2: the custom
            // tier must catch whatever the named knobs cannot hold, so a
            // refusal here would be a regression.
            expect(c, tag).not.toBeNull()

            const { patch, warnings } = parseLink(c.link)
            expect(warnings, tag).toEqual([])
            const got = patch.plant.params

            if (c.plant === 'custom') {
              for (const v of got) {
                expect(Math.abs(v), tag).toBeLessThanOrEqual(1e12)
                // ...and nothing scaled down into the receiver's 1e-30
                // leading-zero epsilon, which would change the plant's order.
                if (v !== 0) expect(Math.abs(v), tag).toBeGreaterThan(1e-28)
              }
            } else {
              RANGES[c.plant].forEach(([lo, hi], i) => {
                expect(got[i], tag).toBeGreaterThanOrEqual(lo)
                expect(got[i], tag).toBeLessThanOrEqual(hi)
              })
            }

            // The plant the receiver rebuilds IS the circuit: magnitude on a
            // wide grid (named knobs at six figures, custom exact), and the
            // SIGN of the DC gain — the abs-stripped integrator's regression
            // guard — wherever both are finite and nonzero.
            const rebuilt = rebuildTf(c.plant, got)
            const wants = []
            const grid = [1e-4, 1e-2, 1, 1e2, 1e4, 1e6]
            for (const f of grid) wants.push(magnitudeAt(tf, f))
            const scale = Math.max(...wants)
            grid.forEach((f, i) => {
              if (!(wants[i] > 1e-6 * scale)) return // notches: nothing to ratio
              const ratio = magnitudeAt(rebuilt, f) / wants[i]
              expect(ratio, `${tag} at ${f} Hz`).toBeGreaterThan(0.999)
              expect(ratio, `${tag} at ${f} Hz`).toBeLessThan(1.001)
            })
            const dcWant = dcGain(tf)
            const dcGot = dcGain(rebuilt)
            if (Number.isFinite(dcWant) && Number.isFinite(dcGot) && Math.abs(dcWant) > 1e-12) {
              expect(Math.sign(dcGot), `${tag} DC sign`).toBe(Math.sign(dcWant))
            }
          }
        }
      }
    })
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

describe('gain crosses the bridge (full parameter fidelity)', () => {
  it('the tank crosses whole: named band-pass, its Q on the knob, its 10 k\u03a9 as a gain block', () => {
    // The parallel RLC's output is an impedance whose resonant value IS R \u2014
    // a scale the (shape, f\u2080, Q) tier used to drop, arriving normalized to
    // peak 1 while the panel said "the same one". The gain block carries it
    // now, exactly: at resonance the tank is purely resistive, so the pair
    // (RBJ band-pass, peak 1) \u00d7 (gain, R) lands on |Z(j\u03c9\u2080)| = R with no
    // approximation to hedge.
    const p = defaultsOf('rlcParallel')
    const tf = transferOf('rlcParallel', p, 'z')
    const rate = 192000
    const d = asDigitalFilter(tf, { sampleRate: rate })
    expect(d.raw).toBe(false)
    expect(d.shape).toBe('bandpass')
    expect(d.q).toBeCloseTo(31.6228, 3) // over the OLD knob ceiling of 20
    expect(d.gainDb).toBeCloseTo(20 * Math.log10(p.r), 9) // exactly 80 dB
    // No coefficient warning on a named crossing: the link carries knobs,
    // not the five raw numbers this flag is about (hedging an exact mapping
    // is the counter-rule's bug).
    expect(d.clipped).toBe(false)

    const { patch, warnings } = parseLink(d.link)
    expect(warnings).toEqual([])
    expect(patch.blocks).toHaveLength(2)
    const [freq, q] = patch.blocks[0].params
    expect(patch.blocks[0].type).toBe('bandpass')
    expect(q).toBeCloseTo(31.6228, 3) // carried, not clamped
    expect(patch.blocks[1].type).toBe('gain')
    const k = Math.pow(10, patch.blocks[1].params[0] / 20)
    const f0 = 1 / (2 * Math.PI * Math.sqrt(p.l * p.c))
    const coeffs = designBiquad({ mode: 'bandpass', freq, q }, rate)
    expect((k * biquadResponse(coeffs, f0, rate)) / magnitudeAt(tf, f0)).toBeCloseTo(1, 3)
  })

  it('a positive non-unity first-order gain crosses by name, the gain riding along', () => {
    // K/(1 + sRC) at K = 2. The named recipe is unity-gain by construction,
    // so the tier used to demand K = 1; the gain block lifts that: recipe \u00d7
    // 10^(gdb/20) is still bilinear-exact, checked on the circuit's curve.
    const rc = 1e-4 // corner \u2248 1591.5 Hz
    const tf = { b: [2], a: [rc, 1] }
    const rate = 192000
    const d = asDigitalFilter(tf, { sampleRate: rate })
    expect(d.order).toBe(1)
    expect(d.shape).toBe('lowpass')
    expect(d.gainDb).toBeCloseTo(20 * Math.log10(2), 9)

    const { patch, warnings } = parseLink(d.link)
    expect(warnings).toEqual([])
    expect(patch.blocks[0].params[2]).toBe(1) // still the order-1 select
    expect(patch.blocks[1].type).toBe('gain')
    const k = Math.pow(10, patch.blocks[1].params[0] / 20)
    const coeffs = designFirstOrder({ mode: 'lowpass', freq: patch.blocks[0].params[0] }, rate)
    const fc = 1 / (2 * Math.PI * rc)
    expect(k * biquadResponse(coeffs, fc, rate)).toBeCloseTo(magnitudeAt(tf, fc), 4)
    expect(k * biquadResponse(coeffs, fc / 10, rate)).toBeCloseTo(magnitudeAt(tf, fc / 10), 3)
  })

  it('unity circuits emit no gain block, so their links do not churn', () => {
    for (const [id, out] of [
      ['rlcSeries', 'c'],
      ['rcLow', 'c'],
      ['sallenKey', 'out'],
    ]) {
      const d = asDigitalFilter(transferOf(id, defaultsOf(id), out))
      expect(d.gainDb, id).toBeNull()
      expect(d.link, id).not.toContain('b=gain')
    }
  })
})

describe('the raw tier catches what the knobs cannot hold \u2014 exactly', () => {
  it('a Q beyond the knob crosses raw, with the reason named', () => {
    const p = { r: 1, l: 10e-3, c: 100e-9 } // Q = \u221a(L/C)/R \u2248 316
    const tf = transferOf('rlcSeries', p, 'c')
    const rate = 192000
    const d = asDigitalFilter(tf, { sampleRate: rate })
    expect(d.raw).toBe(true)
    expect(d.rawReason).toBe('q')
    expect(d.clipped).toBe(false)

    const { patch, warnings } = parseLink(d.link)
    expect(warnings).toEqual([])
    const [b0, b1, b2, a1, a2] = patch.blocks[0].params
    for (const v of [b0, b1, b2, a1, a2]) expect(Math.abs(v)).toBeLessThanOrEqual(3.999)
    // Exact at the pre-warped resonance, where a Q-316 peak is least forgiving.
    const f0 = 1 / (2 * Math.PI * Math.sqrt(p.l * p.c))
    expect(biquadResponse({ b0, b1, b2, a1, a2 }, f0, rate) / magnitudeAt(tf, f0)).toBeCloseTo(1, 2)
  })

  it('a corner below the 20 Hz knob floor crosses raw, landing exactly', () => {
    const p = { r: 1e5, c: 100e-9 } // fc \u2248 15.9 Hz \u2014 plausible bench values
    const tf = transferOf('rcLow', p, 'c')
    const d = asDigitalFilter(tf, { sampleRate: 8000 })
    expect(d.raw).toBe(true)
    expect(d.rawReason).toBe('corner')

    const { patch, warnings } = parseLink(d.link)
    expect(warnings).toEqual([])
    const [b0, b1, b2, a1, a2] = patch.blocks[0].params
    const fc = 1 / (2 * Math.PI * p.r * p.c)
    expect(biquadResponse({ b0, b1, b2, a1, a2 }, fc, 8000)).toBeCloseTo(Math.SQRT1_2, 6)
  })

  it('a sub-hertz corner cannot ask the receiving scope for hours of buffer', () => {
    // Five cycles of a 0.16 mHz square is fourteen hours of samples; the
    // probing source is clamped to 1 Hz on emit (and Signal Lab guards its
    // own floor independently). The zoom is omitted, not clamped: an
    // eight-corner span under the receiver's 50 Hz floor shows nothing.
    const tf = transferOf('rcLow', { r: 1e6, c: 1e-3 }, 'c')
    const d = asDigitalFilter(tf, { sampleRate: 8000 })
    const { patch, warnings } = parseLink(d.link)
    expect(warnings).toEqual([])
    expect(patch.sources[0].freq).toBeGreaterThanOrEqual(1)
    expect(d.link).not.toContain('zoom=')
  })

  it('a corner at or above Nyquist keeps the carried filter stable (no negative pre-warp)', () => {
    // tan(\u03c0f/fs) flips sign past fs/2; pre-warping there would hand over an
    // UNSTABLE copy of a stable circuit. The anchor is dropped instead, and
    // tooFast already says the correspondence is gone at this rate.
    const tf = transferOf('rlcSeries', defaultsOf('rlcSeries'), 'c') // f0 \u2248 5033 Hz
    const d = asDigitalFilter(tf, { sampleRate: 8000 }) // Nyquist 4000
    expect(d.tooFast).toBe(true)
    const { patch, warnings } = parseLink(d.link)
    expect(warnings).toEqual([])
    const [, , , a1, a2] = patch.blocks[0].params
    expect(isStable({ a1, a2 })).toBe(true)
  })

  it('a corner nine decades below the rate is flagged: the digits ran out, lower the rate', () => {
    // The mirror of tooFast. A thousand-second twin-T sampled at 192 kHz has
    // both poles within 1e-8 of z = 1; their joint stability margin
    // (1\u2212p\u2081)(1\u2212p\u2082) \u2248 7e-18 is below float64's resolution at a\u2081 \u2248 \u22122, so the
    // receiver's isStable \u2014 the same predicate on the same exact-serialized
    // numbers \u2014 reads the arrival as unstable. The emitter flags it BEFORE
    // the copy, with the remedy (lower the rate), per CORE_SCOPE rule 3.
    const tf = transferOf('twinT', { r: 1e6, c: 1e-3 }, 'out')
    expect(asDigitalFilter(tf, { sampleRate: 192000 }).uncertifiable).toBe(true)
    // The suggested rate for the same circuit stays out of the hole.
    const nat = asDigitalFilter(tf)
    expect(asDigitalFilter(tf, { sampleRate: suggestRate(nat.f0 || 0) }).uncertifiable).toBe(false)
  })

  it('a gain past \u00b1126 dB is the one boundary left, and it warns before the copy', () => {
    // Unreachable from the component ranges (they top out at \u00d710\u2076 = 120 dB);
    // the guard exists so the boundary is stated rather than discovered
    // (CORE_SCOPE rule 3). Synthetic \u00d710\u2078 low-pass: the factor saturates at
    // 126 dB, the leftover clips, and BOTH flags raise so the panel warns.
    const d = asDigitalFilter({ b: [1e8], a: [1e-4, 1] }, { sampleRate: 48000 })
    expect(d.raw).toBe(true)
    expect(d.gainOver).toBe(true)
    expect(d.gainDb).toBeCloseTo(126, 9)
    // The warning names the TRUE overflow, not the capped carrier value.
    expect(d.gainWanted).toBeGreaterThan(126)
  })
})

describe('the emitter contract: nothing it emits can arrive clamped', () => {
  // The property the whole bridge now rests on, swept across the component
  // BOX of every circuit (each part at min/default/max) at three rates: every
  // link parses clean, every carried knob is inside the receiving range, the
  // carried filter is stable, and where the rate supports the correspondence
  // at all (ratio \u2265 20) the rebuilt response lands on the circuit's own value
  // at f\u2080. These bounds mirror Signal Lab's schemas; fromLink.test.js pins
  // the receiving side of the same contract.
  const cartesian = (lists) =>
    lists.reduce((acc, list) => acc.flatMap((c) => list.map((v) => [...c, v])), [[]])

  const receiverResponse = (blocks, f, rate) => {
    let mag = 1
    for (const blk of blocks) {
      if (blk.type === 'biquad') {
        const [b0, b1, b2, a1, a2] = blk.params
        mag *= biquadResponse({ b0, b1, b2, a1, a2 }, f, rate)
      } else if (blk.type === 'gain') {
        mag *= Math.pow(10, blk.params[0] / 20)
      } else {
        const [freq, q, order] = blk.params
        const coeffs =
          order === 1
            ? designFirstOrder({ mode: blk.type, freq }, rate)
            : designBiquad({ mode: blk.type, freq, q }, rate)
        mag *= biquadResponse(coeffs, f, rate)
      }
    }
    return mag
  }

  it('holds across the component extremes of every circuit, at 8 k / 48 k / 192 kHz', () => {
    for (const [id, c] of Object.entries(CIRCUITS)) {
      const combos = cartesian(c.params.map((p) => [p.min, p.value, p.max]))
      for (const combo of combos) {
        const params = {}
        c.params.forEach((p, i) => (params[p.key] = combo[i]))
        for (const o of c.outputs) {
          const tf = transferOf(id, params, o.key)
          for (const rate of [8000, 48000, 192000]) {
            const d = asDigitalFilter(tf, { sampleRate: rate })
            if (!d) continue // the integrator's reasoned refusal
            const tag = `${id}[${combo.join(',')}]/${o.key}@${rate}`
            const { patch, warnings } = parseLink(d.link)
            expect(warnings, tag).toEqual([])

            for (const blk of patch.blocks) {
              if (blk.type === 'biquad') {
                for (const v of blk.params) expect(Math.abs(v), tag).toBeLessThanOrEqual(3.999)
                // Either the carried filter is certifiably stable, or the
                // emitter flagged that it is not (the extreme-slow-corner
                // resolution boundary) and the panel warns before the copy —
                // the receiver's verdict must never come as a surprise.
                const [, , , a1, a2] = blk.params
                expect(isStable({ a1, a2 }), tag).toBe(!d.uncertifiable)
              } else if (blk.type === 'gain') {
                expect(Math.abs(blk.params[0]), tag).toBeLessThanOrEqual(126)
              } else {
                const [freq, q] = blk.params
                expect(freq, tag).toBeGreaterThanOrEqual(20)
                expect(freq, tag).toBeLessThanOrEqual(Math.floor(rate * 0.499))
                expect(q, tag).toBeGreaterThanOrEqual(0.1)
                expect(q, tag).toBeLessThanOrEqual(100)
              }
            }
            expect(patch.sources[0].freq, tag).toBeGreaterThanOrEqual(1)
            if (patch.zoom != null) expect(patch.zoom, tag).toBeGreaterThanOrEqual(50)

            // Fidelity at the anchor — except at an exact notch, where the
            // analog value is 0 and a ratio is 0/0 (the twin-T's notch depth
            // has its own exact pin above), and except past ~10⁶ samples per
            // cycle, where cos(2πf₀/fs) rounds to 1 and the z-domain response
            // FORMULA — this test's ruler, not the carried filter — can no
            // longer resolve the anchor. No receiver view reaches such a
            // frequency either, so nothing observable is being skipped.
            const want = d.f0 ? magnitudeAt(tf, d.f0) : 0
            if (
              d.f0 &&
              !d.tooFast &&
              !d.gainOver &&
              !d.uncertifiable &&
              want > 1e-9 &&
              rate / d.f0 < 1e6
            ) {
              const ratio = receiverResponse(patch.blocks, d.f0, rate) / want
              expect(ratio, tag).toBeGreaterThan(0.98)
              expect(ratio, tag).toBeLessThan(1.02)
            }
          }
        }
      }
    }
  })
})
