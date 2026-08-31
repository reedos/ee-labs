import { describe, it, expect } from 'vitest'
import { BLOCK_TYPES, makeBlockRecord } from './blocks.js'
import { applyChain, chainResponse, chainSettle, renderChain, runChain } from './chain.js'
import { render, rms, peak, butterworthQs, biquadResponse, designBiquad } from '@ee-labs/dsp'
import { bilinear, magnitudeAt } from '@ee-labs/systems'
import { spectrum } from '@ee-labs/dsp'

const SR = 8000
const N = 4096 // 1.953125 Hz/bin

const src = (over = {}) => ({ id: 1, type: 'sine', freq: 250, amp: 1, phase: 0, enabled: true, ...over })
const blk = (type, params = {}, over = {}) => ({
  id: 1,
  type,
  bypass: false,
  params: { ...BLOCK_TYPES[type].defaults, ...params },
  ...over,
})

/** Amplitude at the bin nearest `f`. */
const at = (freqs, amps, f) => {
  let best = 0
  for (let i = 1; i < amps.length; i++) {
    if (Math.abs(freqs[i] - f) < Math.abs(freqs[best] - f)) best = i
  }
  return amps[best]
}

/** Render sources through blocks and take the spectrum. */
const spec = (sources, blocks, opts = {}) => {
  const { buf } = renderChain(sources, blocks, N, SR, opts)
  return spectrum(buf, SR, 'hann')
}

describe('chain plumbing', () => {
  it('an empty chain is a bit-exact passthrough', () => {
    const buf = render([src()], 256, SR)
    const out = applyChain([], buf, SR)
    for (let i = 0; i < buf.length; i++) expect(out[i]).toBe(buf[i])
  })

  it('a bypassed block is bit-exactly skipped', () => {
    const buf = render([src()], 256, SR)
    const withBypass = applyChain([blk('clip', {}, { bypass: true })], buf, SR)
    for (let i = 0; i < buf.length; i++) expect(withBypass[i]).toBe(buf[i])
  })

  it('is deterministic across calls', () => {
    // The regression test for the fresh-processor design: if any block state
    // survived between invocations, the second run would differ.
    const chain = [blk('lowpass', { freq: 800, q: 4 })]
    const a = renderChain([src()], chain, 512, SR).buf
    const b = renderChain([src()], chain, 512, SR).buf
    for (let i = 0; i < a.length; i++) expect(a[i]).toBe(b[i])
  })

  it('is deterministic for noise too', () => {
    // Math.random() here would make the scope and the FFT disagree.
    const s = [src({ type: 'noise', amp: 1 })]
    const a = render(s, 512, SR)
    const b = render(s, 512, SR)
    for (let i = 0; i < a.length; i++) expect(a[i]).toBe(b[i])
  })

  it('noise is continuous across a pre-roll boundary', () => {
    // Rendering [-W, n) then dropping W must equal rendering [0, n) directly.
    const s = [src({ type: 'noise', amp: 1 })]
    const direct = render(s, 128, SR, 0)
    const prerolled = render(s, 64 + 128, SR, -64 / SR).slice(64)
    for (let i = 0; i < 128; i++) expect(prerolled[i]).toBeCloseTo(direct[i], 12)
  })

  it('order matters for nonlinear blocks', () => {
    const s = [src({ amp: 1 })]
    const a = renderChain(s, [blk('clip', { threshold: 0.3 }), blk('lowpass', { freq: 600, q: 1 }, { id: 2 })], 512, SR).buf
    const b = renderChain(s, [blk('lowpass', { freq: 600, q: 1 }), blk('clip', { threshold: 0.3 }, { id: 2 })], 512, SR).buf
    let maxDiff = 0
    for (let i = 0; i < a.length; i++) maxDiff = Math.max(maxDiff, Math.abs(a[i] - b[i]))
    expect(maxDiff).toBeGreaterThan(1e-3)
  })

  it('superposition holds for a filter and fails for a clipper', () => {
    // This is what "linear" means, encoded as a test.
    const a = [src({ freq: 250, amp: 0.6 })]
    const b = [src({ id: 2, freq: 900, amp: 0.6 })]
    const both = [...a, ...b]

    const lp = [blk('lowpass', { freq: 700, q: 1 })]
    const la = renderChain(a, lp, 512, SR).buf
    const lb = renderChain(b, lp, 512, SR).buf
    const lboth = renderChain(both, lp, 512, SR).buf
    for (let i = 0; i < 512; i++) expect(lboth[i]).toBeCloseTo(la[i] + lb[i], 10)

    const cl = [blk('clip', { threshold: 0.5 })]
    const ca = renderChain(a, cl, 512, SR).buf
    const cb = renderChain(b, cl, 512, SR).buf
    const cboth = renderChain(both, cl, 512, SR).buf
    let maxDiff = 0
    for (let i = 0; i < 512; i++) maxDiff = Math.max(maxDiff, Math.abs(cboth[i] - (ca[i] + cb[i])))
    expect(maxDiff).toBeGreaterThan(1e-2)
  })

  it('reports settle time and clamps runaway pre-roll', () => {
    expect(chainSettle([], SR)).toBe(0)
    expect(chainSettle([blk('clip')], SR)).toBe(0)
    expect(chainSettle([blk('lowpass', { freq: 200, q: 20 })], SR)).toBeGreaterThan(0)
    // A very long ring against a short frame must clamp rather than allocate wildly.
    const r = renderChain([src()], [blk('lowpass', { freq: 20, q: 20 })], 64, SR)
    expect(r.buf.length).toBe(64)
    expect(r.clamped).toBe(true)
  })

  it('runChain returns one stage per block plus the sum', () => {
    const { stages, out } = runChain([src()], [blk('gain', { gainDb: -6 })], 256, SR)
    expect(stages).toHaveLength(2)
    expect(stages[0].label).toBe('Σ')
    expect(out.length).toBe(256)
    // -6 dB is a factor of 0.501.
    expect(rms(stages[1].buf) / rms(stages[0].buf)).toBeCloseTo(0.501, 2)
  })
})

describe('biquad through the chain', () => {
  it('measured response matches the analytic one', () => {
    // The most valuable test here: it validates the coefficients, the difference
    // equation, the response evaluator AND the warm-up at once. Without pre-roll
    // the startup transient smears the frame and this fails.
    const q = 4
    const f0 = 1000
    const coeffs = designBiquad({ mode: 'lowpass', freq: f0, q }, SR)
    for (const f of [125, 250, 500, 750, 1000, 1500, 2000, 3000]) {
      const { freqs, amps } = spec([src({ freq: f })], [blk('lowpass', { freq: f0, q })])
      expect(at(freqs, amps, f), `${f} Hz`).toBeCloseTo(biquadResponse(coeffs, f, SR), 2)
    }
  })

  it('a resonant peak really is Q times the input', () => {
    const q = 8
    const { freqs, amps } = spec([src({ freq: 1000, amp: 1 })], [blk('lowpass', { freq: 1000, q })])
    expect(at(freqs, amps, 1000)).toBeCloseTo(q, 1)
  })

  it('allpass leaves an alias-free spectrum untouched', () => {
    // |H| = 1 at every frequency, so amplitudes survive exactly and only phase
    // moves. Built from discrete sines, all well under Nyquist, so there is no
    // aliased content anywhere.
    const sines = [
      src({ id: 1, freq: 250, amp: 1 }),
      src({ id: 2, freq: 750, amp: 0.5 }),
      src({ id: 3, freq: 1250, amp: 0.25 }),
    ]
    const dry = spec(sines, [])
    const wet = spec(sines, [blk('allpass', { freq: 400, q: 2 })])
    for (const k of [250, 750, 1250]) {
      expect(at(wet.freqs, wet.amps, k), `${k} Hz`).toBeCloseTo(at(dry.freqs, dry.amps, k), 6)
    }
  })

  it('and leaves an ALIASED square wave untouched too', () => {
    // This test used to assert the opposite, reasoning that a naive square has
    // harmonics past Nyquist which fold back onto legitimate ones, and that an
    // allpass shifts each folded component's phase differently so the vector
    // sum inside the shared bin changes.
    //
    // That reasoning is wrong. Folding happens when the signal is sampled, so
    // by the time any filter runs the folded energy is not several components
    // sharing a bin — it IS one discrete sinusoid, and a digital allpass gives
    // all of it the same phase shift. The magnitude has to survive.
    //
    // It passed anyway, because an allpass asks for pre-roll and the generator
    // computed sample times from the local index rather than the absolute one.
    // The warmed-up run was therefore fed a *different* square from the dry
    // one, and the growing "error" was that difference, not the filter.
    const sq = [src({ type: 'square', freq: 250 })]
    const dry = spec(sq, [])
    const wet = spec(sq, [blk('allpass', { freq: 400, q: 2 })])
    for (const k of [250, 750, 1250, 1750, 2250]) {
      expect(at(wet.freqs, wet.amps, k), `${k} Hz`).toBeCloseTo(at(dry.freqs, dry.amps, k), 6)
    }
  })

  it('generates the same signal whatever pre-roll runs ahead of it', () => {
    // The invariant the whole warm-up scheme rests on: the pre-roll must be the
    // same signal continued backwards. A square is the sensitive case, because
    // a last-bit difference in the sample time moves transition samples across
    // the decision threshold rather than nudging them by 1e-16.
    const sq = [src({ type: 'square', freq: 250 })]
    const base = render(sq, 2048, SR, 0)
    for (const w of [36, 64, 512, 8192]) {
      const pre = render(sq, w + 2048, SR, -w / SR).slice(w)
      for (let i = 0; i < 2048; i++) {
        if (pre[i] !== base[i]) throw new Error(`warmup ${w}: sample ${i} differs`)
      }
    }
  })

  it('lowpassing a square keeps the fundamental and kills high harmonics', () => {
    const { freqs, amps } = spec(
      [src({ type: 'square', freq: 250 })],
      [blk('lowpass', { freq: 700, q: Math.SQRT1_2 })],
    )
    expect(at(freqs, amps, 250)).toBeCloseTo(4 / Math.PI, 1)
    expect(at(freqs, amps, 2250)).toBeLessThan(0.02)
  })
})

describe('comb', () => {
  it('notches where the delay makes the echo cancel', () => {
    // g = 1, D taps: |H| = 2|cos(pi f D / fs)|, so nulls at odd multiples of
    // fs/(2D) and peaks at multiples of fs/D.
    const D = 8
    const delayMs = (D / SR) * 1000
    const params = { delayMs, g: 1, mode: 'feedforward' }
    const notch = SR / (2 * D) // 500 Hz
    const peakF = SR / D // 1000 Hz

    const n = spec([src({ freq: notch })], [blk('comb', params)])
    expect(at(n.freqs, n.amps, notch)).toBeLessThan(1e-3)

    const p = spec([src({ freq: peakF })], [blk('comb', params)])
    expect(at(p.freqs, p.amps, peakF)).toBeCloseTo(2, 1)
  })

  it('feedback comb resonates at 1/(1-g)', () => {
    const D = 8
    const delayMs = (D / SR) * 1000
    for (const g of [0.5, 0.8, 0.9]) {
      const r = BLOCK_TYPES.comb.response({ delayMs, g, mode: 'feedback' }, SR / D, SR)
      expect(r).toBeCloseTo(1 / (1 - g), 6)
    }
  })

  it('analytic response matches the measured one', () => {
    const params = { delayMs: 1, g: 0.7, mode: 'feedforward' }
    for (const f of [250, 500, 1000, 1500, 2000]) {
      const { freqs, amps } = spec([src({ freq: f })], [blk('comb', params)])
      expect(at(freqs, amps, f), `${f} Hz`).toBeCloseTo(
        BLOCK_TYPES.comb.response(params, f, SR),
        2,
      )
    }
  })
})

describe('clip', () => {
  it('never exceeds the threshold', () => {
    const { buf } = renderChain([src({ amp: 1 })], [blk('clip', { threshold: 0.3 })], 512, SR)
    expect(peak(buf)).toBeLessThanOrEqual(0.3 + 1e-12)
  })

  it('hard clipping toward zero approaches a square wave', () => {
    // As the threshold goes to 0 the output tends to a square of amplitude c, whose
    // harmonics are the 4c/(k*pi) the existing square-wave test already pins.
    const c = 0.2
    const { freqs, amps } = spec([src({ freq: 250, amp: 1 })], [blk('clip', { threshold: c })])
    expect(at(freqs, amps, 250)).toBeCloseTo((4 * c) / Math.PI, 1)
    expect(at(freqs, amps, 750)).toBeCloseTo((4 * c) / (3 * Math.PI), 1)
    expect(at(freqs, amps, 1250)).toBeCloseTo((4 * c) / (5 * Math.PI), 1)
  })

  it('a symmetric clipper makes only odd harmonics', () => {
    const { freqs, amps } = spec([src({ freq: 250, amp: 1 })], [blk('clip', { threshold: 0.4 })])
    expect(at(freqs, amps, 500)).toBeLessThan(1e-3)
    expect(at(freqs, amps, 1000)).toBeLessThan(1e-3)
  })

  it('a DC offset before the clipper brings in even harmonics', () => {
    // Asymmetry is where even harmonics come from — the whole point of putting DC
    // offset in the gain block.
    const { freqs, amps } = spec(
      [src({ freq: 250, amp: 1 })],
      [blk('gain', { gainDb: 0, dcOffset: 0.3 }), blk('clip', { threshold: 0.4 }, { id: 2 })],
    )
    expect(at(freqs, amps, 500)).toBeGreaterThan(0.05)
  })

  it('does nothing when the threshold is above the peak', () => {
    const dry = renderChain([src({ amp: 0.5 })], [], 256, SR).buf
    const wet = renderChain([src({ amp: 0.5 })], [blk('clip', { threshold: 1.2 })], 256, SR).buf
    for (let i = 0; i < 256; i++) expect(wet[i]).toBeCloseTo(dry[i], 12)
  })
})

describe('ring modulator', () => {
  it('produces sum and difference, and suppresses both inputs', () => {
    // 250 x 1000 -> 750 and 1250, with neither original present.
    const { freqs, amps } = spec([src({ freq: 250, amp: 1 })], [blk('ringmod', { freq: 1000 })])
    expect(at(freqs, amps, 750)).toBeCloseTo(0.5, 1)
    expect(at(freqs, amps, 1250)).toBeCloseTo(0.5, 1)
    expect(at(freqs, amps, 250)).toBeLessThan(1e-2)
    expect(at(freqs, amps, 1000)).toBeLessThan(1e-2)
  })

  it('folds the sum sideband when it exceeds Nyquist', () => {
    // 3000 x 2000 -> difference 1000, sum 5000 which folds to 8000-5000 = 3000.
    const { freqs, amps } = spec([src({ freq: 3000, amp: 1 })], [blk('ringmod', { freq: 2000 })])
    expect(at(freqs, amps, 1000)).toBeCloseTo(0.5, 1)
    expect(at(freqs, amps, 3000)).toBeCloseTo(0.5, 1)
  })
})

describe('quantizer', () => {
  const quant = (bits, dither = false) => {
    const { buf } = renderChain([src({ freq: 250, amp: 1 })], [blk('quantize', { bits, dither })], N, SR)
    return buf
  }

  it('output lands on the quantization grid', () => {
    const bits = 6
    const delta = 2 / Math.pow(2, bits)
    for (const v of quant(bits)) {
      expect(Math.abs(v / delta - Math.round(v / delta))).toBeLessThan(1e-9)
    }
  })

  it('error never exceeds half a step — except at the positive rail', () => {
    // A b-bit converter's top code is 1 - delta (codes -2^(b-1) .. 2^(b-1)-1),
    // so a sample AT +1 clips by up to a full step. That asymmetry is the
    // standard two's-complement ADC convention, not an accident.
    const bits = 8
    const delta = 2 / Math.pow(2, bits)
    const dry = render([src({ freq: 250, amp: 1 })], N, SR)
    const wet = quant(bits)
    for (let i = 0; i < N; i++) {
      const bound = dry[i] > 1 - delta / 2 ? delta : delta / 2
      expect(Math.abs(wet[i] - dry[i])).toBeLessThanOrEqual(bound + 1e-12)
    }
  })

  it('produces exactly 2^bits distinct levels, rails included', () => {
    // Midtread rounding over a symmetric range would include BOTH rails and
    // hand a "1-bit" crusher three levels. The clamp makes the count exact.
    for (const bits of [1, 2, 4]) {
      const proc = BLOCK_TYPES.quantize.make({ bits, dither: false }, SR)
      const seen = new Set()
      for (let i = 0; i <= 4000; i++) {
        seen.add(proc.process(-1 + (2 * i) / 4000, i / SR).toFixed(9))
      }
      expect(seen.size, `${bits} bits`).toBe(Math.pow(2, bits))
    }
  })

  it('SNR approaches 6.02*bits + 1.76 dB at high resolution', () => {
    const dry = render([src({ freq: 250, amp: 1 })], N, SR)
    for (const bits of [12, 14, 16]) {
      const wet = quant(bits)
      const err = new Float64Array(N)
      for (let i = 0; i < N; i++) err[i] = wet[i] - dry[i]
      const snr = 20 * Math.log10(rms(dry) / rms(err))
      expect(snr, `${bits} bits`).toBeCloseTo(6.02 * bits + 1.76, -0.7)
    }
  })

  it('deviates from that formula at very low resolution', () => {
    // Not a bug — the formula assumes the error is decorrelated from the signal.
    // At 3 bits it very much is not, which is exactly why the spectrum shows
    // discrete spurs instead of a smooth floor.
    const dry = render([src({ freq: 250, amp: 1 })], N, SR)
    const wet = quant(3)
    const err = new Float64Array(N)
    for (let i = 0; i < N; i++) err[i] = wet[i] - dry[i]
    const snr = 20 * Math.log10(rms(dry) / rms(err))
    expect(Math.abs(snr - (6.02 * 3 + 1.76))).toBeGreaterThan(0.5)
  })
})

describe('rectifier', () => {
  it('doubles the frequency and makes DC plus even harmonics', () => {
    // |A sin| = 2A/pi - (4A/pi) * sum cos(2m w t)/(4m^2 - 1)
    const A = 1
    const { freqs, amps } = spec([src({ freq: 250, amp: A })], [blk('rectify')])
    expect(amps[0]).toBeCloseTo((2 * A) / Math.PI, 1)
    expect(at(freqs, amps, 500)).toBeCloseTo((4 * A) / (3 * Math.PI), 1)
    expect(at(freqs, amps, 1000)).toBeCloseTo((4 * A) / (15 * Math.PI), 1)
    expect(at(freqs, amps, 250)).toBeLessThan(1e-2)
  })

  it('preserves RMS exactly', () => {
    const dry = render([src({ freq: 250, amp: 1 })], 512, SR)
    const wet = renderChain([src({ freq: 250, amp: 1 })], [blk('rectify')], 512, SR).buf
    expect(rms(wet)).toBeCloseTo(rms(dry), 12)
  })
})

describe('chainResponse', () => {
  it('multiplies the magnitudes of cascaded filters', () => {
    const freqs = Float64Array.from([100, 500, 1000, 2000])
    const b1 = blk('lowpass', { freq: 900, q: 1 })
    const b2 = blk('highpass', { freq: 300, q: 1 }, { id: 2 })
    const { mag, exact } = chainResponse([b1, b2], freqs, SR)
    expect(exact).toBe(true)
    for (let i = 0; i < freqs.length; i++) {
      const want =
        biquadResponse(designBiquad({ mode: 'lowpass', freq: 900, q: 1 }, SR), freqs[i], SR) *
        biquadResponse(designBiquad({ mode: 'highpass', freq: 300, q: 1 }, SR), freqs[i], SR)
      expect(mag[i]).toBeCloseTo(want, 12)
    }
  })

  it('is flat and exact for an empty chain', () => {
    const { mag, exact, any } = chainResponse([], Float64Array.from([100, 1000]), SR)
    expect(exact).toBe(true)
    expect(any).toBe(false)
    expect(Array.from(mag)).toEqual([1, 1])
  })

  it('goes inexact when a nonlinear block is present', () => {
    const { exact } = chainResponse(
      [blk('lowpass'), blk('clip', {}, { id: 2 })],
      Float64Array.from([100, 1000]),
      SR,
    )
    expect(exact).toBe(false)
  })

  it('ignores bypassed blocks', () => {
    const { exact } = chainResponse(
      [blk('clip', {}, { bypass: true })],
      Float64Array.from([100]),
      SR,
    )
    expect(exact).toBe(true)
  })
})

describe('registry', () => {
  it('every type builds, processes and reports a settle time', () => {
    for (const [type, def] of Object.entries(BLOCK_TYPES)) {
      const rec = makeBlockRecord(type, 1)
      const proc = def.make(rec.params, SR)
      const y = proc.process(0.5, 0)
      expect(Number.isFinite(y), type).toBe(true)
      expect(Number.isFinite(proc.settle), type).toBe(true)
      expect(proc.settle).toBeGreaterThanOrEqual(0)
    }
  })

  it('every parameter has a usable schema', () => {
    const ctx = { sampleRate: SR, nyquist: SR / 2 }
    for (const [type, def] of Object.entries(BLOCK_TYPES)) {
      for (const p of def.params) {
        expect(p.key, type).toBeTruthy()
        expect(p.label, `${type}.${p.key}`).toBeTruthy()
        if (!p.kind) {
          const min = typeof p.min === 'function' ? p.min(ctx) : p.min
          const max = typeof p.max === 'function' ? p.max(ctx) : p.max
          expect(min, `${type}.${p.key} min`).toBeLessThan(max)
          expect(def.defaults[p.key], `${type}.${p.key} default`).toBeGreaterThanOrEqual(min)
          expect(def.defaults[p.key], `${type}.${p.key} default`).toBeLessThanOrEqual(max)
        }
      }
    }
  })

  it('every type produces a summary string', () => {
    for (const [type, def] of Object.entries(BLOCK_TYPES)) {
      expect(typeof def.summary(def.defaults), type).toBe('string')
    }
  })
})

describe('filter order', () => {
  const FS2 = 8000
  const respOf = (over, f) =>
    BLOCK_TYPES.lowpass.response({ freq: 500, q: Math.SQRT1_2, gainDb: 0, ...over }, f, FS2)

  it('order 1: exactly -3.01 dB at the cutoff, 6 dB per octave beyond', () => {
    expect(respOf({ order: '1' }, 500)).toBeCloseTo(Math.SQRT1_2, 6)
    // Far above the corner each octave costs x2 (until Nyquist warping bites).
    const r1 = respOf({ order: '1' }, 1200)
    const r2 = respOf({ order: '1' }, 2400)
    expect(r1 / r2).toBeGreaterThan(1.85)
    expect(r1 / r2).toBeLessThan(2.6)
  })

  it('order 4: still exactly -3.01 dB at the cutoff — the Butterworth signature', () => {
    expect(respOf({ order: '4' }, 500)).toBeCloseTo(Math.SQRT1_2, 6)
    // ...which two identical 0.707 sections do NOT give: they sag to -6.02.
    const twice = Math.pow(respOf({ order: '2', q: Math.SQRT1_2 }, 500), 2)
    expect(twice).toBeCloseTo(0.5, 6)
  })

  it('order 4 equals the product of the two RBJ sections with Butterworth Qs', () => {
    const [q1, q2] = butterworthQs(4)
    for (const f of [100, 500, 900, 2000]) {
      const want =
        biquadResponse(designBiquad({ mode: 'lowpass', freq: 500, q: q1 }, FS2), f, FS2) *
        biquadResponse(designBiquad({ mode: 'lowpass', freq: 500, q: q2 }, FS2), f, FS2)
      expect(respOf({ order: '4' }, f)).toBeCloseTo(want, 12)
    }
  })

  it('rolloff doubles with each doubling of order: 6, 12, 24 dB per octave', () => {
    // Measured well above the corner as dB lost from f to 2f.
    const octave = (order) =>
      20 * Math.log10(respOf({ order }, 1000) / respOf({ order }, 2000))
    expect(octave('1')).toBeGreaterThan(5)
    expect(octave('1')).toBeLessThan(8.5)
    expect(octave('2')).toBeGreaterThan(11)
    expect(octave('2')).toBeLessThan(16)
    expect(octave('4')).toBeGreaterThan(22)
    expect(octave('4')).toBeLessThan(32)
  })

  it('the z-plane carries 1, 2 and 4 poles respectively — no phantom origin marks', () => {
    for (const [order, n] of [
      ['1', 1],
      ['2', 2],
      ['4', 4],
    ]) {
      const { poles } = BLOCK_TYPES.lowpass.pz(
        { freq: 500, q: Math.SQRT1_2, gainDb: 0, order },
        FS2,
      )
      expect(poles, `order ${order}`).toHaveLength(n)
      for (const [re, im] of poles) {
        expect(Math.hypot(re, im), `order ${order}`).toBeGreaterThan(0.1)
        expect(Math.hypot(re, im), `order ${order}`).toBeLessThan(1)
      }
    }
  })

  it('running the order-4 filter matches its own response curve', () => {
    const p = { freq: 500, q: Math.SQRT1_2, gainDb: 0, order: '4' }
    const proc = BLOCK_TYPES.lowpass.make(p, FS2)
    const N = 8192
    for (const f of [250, 500, 1000]) {
      let sr = 0
      let si = 0
      const settle = proc.settle
      const total = settle + N
      const fresh = BLOCK_TYPES.lowpass.make(p, FS2)
      const ys = new Float64Array(total)
      for (let i = 0; i < total; i++) {
        ys[i] = fresh.process(Math.sin((2 * Math.PI * f * i) / FS2), i / FS2)
      }
      for (let i = settle; i < total; i++) {
        const a = (2 * Math.PI * f * i) / FS2
        sr += ys[i] * Math.cos(a)
        si += ys[i] * Math.sin(a)
      }
      const amp = (2 * Math.hypot(sr, si)) / N
      expect(amp, `${f} Hz`).toBeCloseTo(respOf({ order: '4' }, f), 4)
    }
  })
})

describe('phase at the cutoff', () => {
  // The hint's claim: the lag at the cutoff is EXACTLY 45 degrees per order,
  // not approximately. The bilinear transform preserves the analog value at
  // the pre-warped frequency, so this survives sampling untouched.
  it('low-pass lags exactly 45 degrees x order at fc', () => {
    for (const [order, want] of [
      ['1', -45],
      ['2', -90],
      ['4', -180],
    ]) {
      const ph = BLOCK_TYPES.lowpass.phase(
        { freq: 500, q: Math.SQRT1_2, gainDb: 0, order },
        500,
        8000,
      )
      expect((ph * 180) / Math.PI, `order ${order}`).toBeCloseTo(want, 9)
    }
  })

  it('high-pass leads exactly 45 degrees x order at fc', () => {
    for (const [order, want] of [
      ['1', 45],
      ['2', 90],
    ]) {
      const ph = BLOCK_TYPES.highpass.phase(
        { freq: 500, q: Math.SQRT1_2, gainDb: 0, order },
        500,
        8000,
      )
      expect((ph * 180) / Math.PI, `order ${order}`).toBeCloseTo(want, 9)
    }
  })
})

describe('the phase transition, as the hint describes it', () => {
  // The hint says the swing happens "over roughly the two decades around the
  // cutoff". Measured: at least three quarters of the full 90-degrees-per-order
  // swing lies inside fc/10 .. 10fc, and none of it is left far outside.
  it('most of the swing sits within a decade either side of fc', () => {
    const FS3 = 48000 // room for 10x fc below Nyquist
    const FC = 200
    for (const order of ['1', '2', '4']) {
      const n = Number(order)
      const ph = (f) =>
        (BLOCK_TYPES.lowpass.phase({ freq: FC, q: Math.SQRT1_2, gainDb: 0, order }, f, FS3) * 180) /
        Math.PI
      const swing = Math.abs(ph(10 * FC) - ph(FC / 10))
      expect(swing, `order ${order}`).toBeGreaterThan(0.75 * 90 * n)
      expect(swing, `order ${order}`).toBeLessThanOrEqual(90 * n + 1)
      // And far outside the transition there is almost nothing left.
      expect(Math.abs(ph(FC / 100)), `order ${order} at fc/100`).toBeLessThan(0.1 * 90 * n)
    }
  })
})

describe('the raw-coefficient biquad — the universal hand-over receiver', () => {
  it('given a named mode\u2019s own coefficients, it IS that block, sample for sample', () => {
    const co = designBiquad({ mode: 'lowpass', freq: 700, q: 4 }, SR)
    const named = BLOCK_TYPES.lowpass.make({ freq: 700, q: 4, gainDb: 0, order: '2' }, SR)
    const raw = BLOCK_TYPES.biquad.make({ ...co }, SR)
    for (let i = 0; i < 512; i++) {
      const x = Math.sin(i * 0.37) + 0.3 * Math.sin(i * 1.91)
      expect(raw.process(x, i / SR)).toBe(named.process(x, i / SR))
    }
  })

  it('carries a twin-T notch \u2014 which no named mode can express \u2014 bilinear-exactly', () => {
    // The twin-T's H(s) at R = 10k, C = 10n: zeros ON the axis at w0 = 1/RC.
    const R = 1e4
    const C = 10e-9
    const w0 = 1 / (R * C)
    const analog = { b: [1 / (w0 * w0), 0, 1], a: [1 / (w0 * w0), 4 / w0, 1] }
    const f0 = w0 / (2 * Math.PI)
    const fs = 48000
    const d = bilinear(analog, fs, f0)
    const p = { b0: d.b[0], b1: d.b[1], b2: d.b[2], a1: d.a[1], a2: d.a[2] }

    // The notch survives the journey: exactly zero at the (pre-warped) f0...
    expect(BLOCK_TYPES.biquad.response(p, f0, fs)).toBeLessThan(1e-9)
    // ...and passes DC and high frequencies at unity, as the circuit does.
    expect(BLOCK_TYPES.biquad.response(p, 1, fs)).toBeCloseTo(1, 3)
    expect(BLOCK_TYPES.biquad.response(p, 20000, fs)).toBeCloseTo(1, 1)
    // Against the analog curve: the bilinear map is EXACT at the pre-warped
    // f0 and drifts as tan(pi f/fs)/(pi f/fs) elsewhere - about 1.6% by 2*f0
    // at this rate. That drift is the honest cost of sampling, so the
    // tolerance states it rather than hiding it.
    for (const f of [200, 800, 1600, 3183]) {
      const want = magnitudeAt(analog, f)
      expect(Math.abs(BLOCK_TYPES.biquad.response(p, f, fs) - want) / want).toBeLessThan(0.02)
    }
    // And the z-plane shows what a notch IS: zeros on the unit circle.
    const { zeros } = BLOCK_TYPES.biquad.pz(p, fs)
    for (const [re, im] of zeros) expect(Math.hypot(re, im)).toBeCloseTo(1, 6)
  })

  it('an unstable setting passes through and says so, instead of exploding the plots', () => {
    const p = { b0: 1, b1: 0, b2: 0, a1: -2.1, a2: 1.2 }
    const proc = BLOCK_TYPES.biquad.make(p, SR)
    expect(proc.process(0.5, 0)).toBe(0.5)
    expect(BLOCK_TYPES.biquad.summary(p)).toBe('UNSTABLE')
    expect(BLOCK_TYPES.biquad.response(p, 100, SR)).toBeNull()
  })
})
