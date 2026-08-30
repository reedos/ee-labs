import { describe, it, expect } from 'vitest'
import { BLOCK_TYPES, makeBlockRecord } from './blocks.js'
import { applyChain, chainResponse, chainSettle, renderChain, runChain } from './chain.js'
import { render, rms, peak } from '@ee-labs/dsp'
import { spectrum } from '@ee-labs/dsp'
import { designBiquad, biquadResponse } from '@ee-labs/dsp'

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

  it('error never exceeds half a step', () => {
    const bits = 8
    const delta = 2 / Math.pow(2, bits)
    const dry = render([src({ freq: 250, amp: 1 })], N, SR)
    const wet = quant(bits)
    for (let i = 0; i < N; i++) expect(Math.abs(wet[i] - dry[i])).toBeLessThanOrEqual(delta / 2 + 1e-12)
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
