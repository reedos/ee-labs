import { describe, it, expect } from 'vitest'
import { PRESETS, PRESET_GROUPS } from './presets.js'
import { chainResponse, renderChain } from './dsp/chain.js'
import { render, spectrum } from '@ee-labs/dsp'
import { designBiquad, biquadResponse, designFir } from '@ee-labs/dsp'
import { applyChain, chainGroupDelay, chainImpulse, chainPolesZeros } from './dsp/chain.js'

// The presets are the lessons, and each note makes a claim about physics:
// "only odd harmonics", "the peak is Q", "neither input survives". A note that
// is confidently wrong is worse here than a missing feature — someone learns
// the wrong thing and has no way to catch it.
//
// Two of these notes WERE wrong. One said each surviving harmonic of a filtered
// square sits on the response curve (it does not: the square's own 4/k(pi)
// envelope is already there, so the peaks sit 7-17 dB below it). The other used
// a band-pass to demonstrate that the resonant peak height equals Q, which is
// true of a low-pass and false of a band-pass, where |H(f0)| is pinned at 1
// however far Q is pushed.
//
// So each claim is rendered and measured here rather than trusted.

const byName = (n) => {
  const p = PRESETS.find((x) => x.name === n)
  if (!p) throw new Error(`no preset "${n}"`)
  return p
}

/** Render a preset exactly as the app would, and return its spectrum. */
function run(name, over = {}) {
  const p = { ...byName(name).patch, ...over }
  const sampleRate = p.sampleRate || 8000
  const fftSize = p.fftSize || 2048
  const r = renderChain(p.sources, p.blocks || [], fftSize, sampleRate)
  const s = spectrum(r.buf, sampleRate, p.window || 'hann')
  const at = (f) => {
    let bi = 0
    for (let i = 1; i < s.freqs.length; i++) {
      if (Math.abs(s.freqs[i] - f) < Math.abs(s.freqs[bi] - f)) bi = i
    }
    // Take the local peak: a Hann window spreads a line over ~3 bins.
    let m = 0
    for (let i = Math.max(0, bi - 2); i <= Math.min(s.amps.length - 1, bi + 2); i++) {
      if (s.amps[i] > m) m = s.amps[i]
    }
    return m
  }
  return { ...s, at, sampleRate }
}

describe('preset: Square = odd harmonics', () => {
  it('has odd harmonics at 4A/k(pi) and no even ones', () => {
    const { at } = run('Square = odd harmonics')
    const f0 = 250
    // A sampled square carries a (k*pi/N)/sin(k*pi/N) correction on top of the
    // continuous 4A/k(pi) — see dsp.test.js. The note quotes the continuous
    // series, which is right as a description and about 4% low by the 5th.
    const N = 8000 / f0
    const ideal = (k) => (4 / (k * Math.PI)) * ((k * Math.PI) / N / Math.sin((k * Math.PI) / N))
    for (const k of [1, 3, 5, 7]) {
      expect(at(k * f0) / ideal(k), `k=${k}`).toBeCloseTo(1, 1)
    }
    // "Nothing between them" is the claim worth checking, and it has to mean
    // absent rather than merely small: the generator used to leave every even
    // harmonic sitting at -39 dB.
    for (const k of [2, 4, 6]) {
      expect(at(k * f0), `k=${k}`).toBeLessThan(at(f0) / 1e4)
    }
  })
})

describe('preset: Low-pass a square', () => {
  it('the gap between the pre- and post-chain traces is the response curve', () => {
    // What the corrected note actually claims.
    const p = byName('Low-pass a square').patch
    const dry = run('Low-pass a square', { blocks: [] })
    const wet = run('Low-pass a square')
    const coeffs = designBiquad({ mode: 'lowpass', ...p.blocks[0].params }, 8000)

    for (const k of [1, 3, 5, 7]) {
      const f = 250 * k
      const measured = wet.at(f) / dry.at(f)
      expect(measured / biquadResponse(coeffs, f, 8000), `k=${k}`).toBeCloseTo(1, 1)
    }
  })

  it('the peaks do NOT sit on the curve, which is why the note says so', () => {
    const p = byName('Low-pass a square').patch
    const wet = run('Low-pass a square')
    const coeffs = designBiquad({ mode: 'lowpass', ...p.blocks[0].params }, 8000)
    // The 5th is the one the note quotes as "down 11 dB" relative to the curve.
    const f = 1250
    const gapDb = 20 * Math.log10(wet.at(f) / biquadResponse(coeffs, f, 8000))
    expect(gapDb).toBeLessThan(-9)
    expect(gapDb).toBeGreaterThan(-13)
  })
})

describe('preset: Resonance is Q', () => {
  it('uses a filter mode whose peak height really is Q', () => {
    const p = byName('Resonance is Q').patch
    const b = p.blocks[0]
    const { freq, q } = { ...b.params }
    const h = biquadResponse(designBiquad({ mode: b.type, freq, q }, 8000), freq, 8000)
    // Exactly Q for low-pass and high-pass; pinned at 1 for band-pass, which is
    // what made this preset's original note wrong.
    expect(h).toBeCloseTo(q, 6)
    expect(q).toBeGreaterThan(1)
  })
})

describe('preset: Phase is invisible here', () => {
  it('leaves the spectrum untouched while changing the waveform', () => {
    const dry = run('Phase is invisible here', { blocks: [] })
    const wet = run('Phase is invisible here')
    for (const f of [250, 750, 1250]) {
      expect(wet.at(f) / dry.at(f), `${f} Hz`).toBeCloseTo(1, 2)
    }

    // ...and the time-domain waveform genuinely differs, or there is no lesson.
    const p = byName('Phase is invisible here').patch
    const a = renderChain(p.sources, [], 2048, 8000).buf
    const b = renderChain(p.sources, p.blocks, 2048, 8000).buf
    let worst = 0
    for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]))
    expect(worst).toBeGreaterThan(0.1)
  })
})

describe('preset: Clipping makes harmonics', () => {
  it('manufactures odd harmonics and no even ones', () => {
    const { at } = run('Clipping makes harmonics')
    const f0 = 250
    for (const k of [3, 5]) expect(at(k * f0), `k=${k}`).toBeGreaterThan(at(f0) / 100)
    for (const k of [2, 4]) expect(at(k * f0), `k=${k}`).toBeLessThan(at(f0) / 100)
  })
})

describe('preset: DC breaks the symmetry', () => {
  it('brings in the even harmonics the symmetric clip did not have', () => {
    const withDc = run('DC breaks the symmetry')
    const f0 = 250
    for (const k of [2, 4]) {
      expect(withDc.at(k * f0), `k=${k}`).toBeGreaterThan(withDc.at(f0) / 100)
    }
    // And removing the offset takes them away again — the note tells the reader
    // to drag it to zero and watch them vanish.
    const p = byName('DC breaks the symmetry').patch
    const blocks = [
      { ...p.blocks[0], params: { ...p.blocks[0].params, dcOffset: 0 } },
      p.blocks[1],
    ]
    const without = run('DC breaks the symmetry', { blocks })
    for (const k of [2, 4]) {
      expect(without.at(k * f0), `k=${k}`).toBeLessThan(without.at(f0) / 100)
    }
  })
})

describe('preset: Ring modulator', () => {
  it('produces the sum and difference, and neither input survives', () => {
    const { at } = run('Ring modulator')
    const sum = at(1250)
    const diff = at(750)
    expect(diff).toBeGreaterThan(0.1)
    expect(sum).toBeGreaterThan(0.1)
    // "Neither original frequency survives" is the surprising half of the claim.
    expect(at(250)).toBeLessThan(diff / 100)
    expect(at(1000)).toBeLessThan(diff / 100)
  })
})

describe('preset: Beating', () => {
  it('resolves into two lines, which is what the scope envelope hides', () => {
    const { at, freqs } = run('Beating')
    const binHz = freqs[1] - freqs[0]
    // The two tones are 5 Hz apart; the frame has to resolve them or the
    // "spectrum shows two lines" half of the note is false.
    expect(binHz).toBeLessThan(5)
    expect(at(250)).toBeGreaterThan(0.1)
    expect(at(255)).toBeGreaterThan(0.1)
  })
})

describe('every preset', () => {
  it('belongs to a declared group', () => {
    for (const p of PRESETS) {
      expect(PRESET_GROUPS, `${p.name}`).toContain(p.group)
    }
  })

  it('names a block type that exists and renders without NaN', () => {
    for (const p of PRESETS) {
      const sampleRate = p.patch.sampleRate || 8000
      const r = renderChain(p.patch.sources, p.patch.blocks || [], 1024, sampleRate)
      for (let i = 0; i < r.buf.length; i++) {
        if (!Number.isFinite(r.buf[i])) throw new Error(`${p.name}: non-finite at ${i}`)
      }
    }
  })

  it('keeps every source below Nyquist except the ones about the limit itself', () => {
    // Two presets sit on or past the limit deliberately, which is their lesson.
    const deliberate = new Set(['Aliasing', 'Exactly at Nyquist'])
    for (const p of PRESETS) {
      if (deliberate.has(p.name)) continue
      const nyq = (p.patch.sampleRate || 8000) / 2
      for (const s of p.patch.sources) {
        expect(s.freq, `${p.name}`).toBeLessThanOrEqual(nyq)
      }
    }
  })
})

describe('preset: Exactly at Nyquist', () => {
  it('reads a different amplitude for the same tone depending only on phase', () => {
    // The whole lesson. Two samples per cycle is the theorem's limit, and at the
    // limit the samples can land on the peaks or on the zero crossings.
    const p = byName('Exactly at Nyquist').patch
    const amp = (phase) => {
      const src = [{ ...p.sources[0], phase }]
      const s = run('Exactly at Nyquist', { sources: src })
      return s.at(4000)
    }
    expect(amp(Math.PI / 2)).toBeCloseTo(1, 2) // samples on the peaks
    expect(amp(0)).toBeLessThan(1e-9) // samples on the zero crossings
    expect(amp(Math.PI / 4)).toBeCloseTo(Math.SQRT1_2, 2)
  })
})

describe('preset: Corners make harmonics', () => {
  it('falls as 1/k^2 for a triangle where a square falls as 1/k', () => {
    const tri = run('Corners make harmonics')
    const sq = run('Corners make harmonics', {
      sources: [{ ...byName('Corners make harmonics').patch.sources[0], type: 'square' }],
    })
    // Ratio of fundamental to 3rd harmonic: 3 for 1/k, 9 for 1/k^2.
    expect(sq.at(250) / sq.at(750)).toBeCloseTo(3, 0)
    expect(tri.at(250) / tri.at(750)).toBeCloseTo(9, 0)
  })
})

describe('preset: Two filters are steeper', () => {
  it('squares the response, doubling the attenuation in dB', () => {
    const p = byName('Two filters are steeper').patch
    const one = chainResponse([p.blocks[0]], Float64Array.from([1600, 3200]), 8000)
    const two = chainResponse(p.blocks, Float64Array.from([1600, 3200]), 8000)
    for (let i = 0; i < 2; i++) {
      expect(two.mag[i] / (one.mag[i] * one.mag[i])).toBeCloseTo(1, 6)
    }
    // Both blocks are the same filter, so this really is |H| squared.
    expect(p.blocks[0].params.freq).toBe(p.blocks[1].params.freq)
    expect(p.blocks[0].params.q).toBe(p.blocks[1].params.q)
  })
})

describe('preset: Impulse response', () => {
  it('measures the transfer function, because the input spectrum is flat', () => {
    const p = byName('Impulse response').patch
    const dry = run('Impulse response', { blocks: [] })
    const wet = run('Impulse response')
    // A single unit sample spreads evenly over every bin.
    const flat = dry.at(1000)
    for (const f of [200, 800, 2000, 3000]) {
      expect(dry.at(f) / flat, `flat at ${f}`).toBeCloseTo(1, 3)
    }
    // ...so the ratio out/in is |H(f)| itself.
    const h = chainResponse(p.blocks, Float64Array.from([200, 800, 2000]), 8000)
    const fs = [200, 800, 2000]
    for (let i = 0; i < fs.length; i++) {
      expect(wet.at(fs[i]) / dry.at(fs[i]) / h.mag[i], `${fs[i]} Hz`).toBeCloseTo(1, 1)
    }
  })

  it('is silent before the impulse arrives, so what follows is the response alone', () => {
    const p = byName('Impulse response').patch
    const r = renderChain(p.sources, p.blocks, 256, 8000)
    expect(r.warmup).toBeGreaterThan(0)
    expect(Math.abs(r.buf[0])).toBeGreaterThan(0)
  })
})

describe('preset: AM: the carrier returns', () => {
  it('restores the carrier that the ring modulator suppresses', () => {
    const p = byName('AM: the carrier returns').patch
    const am = run('AM: the carrier returns')
    // Same chain with the offset removed is plain DSB-SC.
    const noDc = [{ ...p.blocks[0], params: { ...p.blocks[0].params, dcOffset: 0 } }, p.blocks[1]]
    const dsb = run('AM: the carrier returns', { blocks: noDc })

    expect(am.at(1000)).toBeGreaterThan(0.1)
    expect(dsb.at(1000)).toBeLessThan(am.at(1000) / 100)
    // The sidebands are untouched either way — only the carrier changes.
    for (const f of [750, 1250]) {
      expect(am.at(f) / dsb.at(f), `${f} Hz`).toBeCloseTo(1, 2)
    }
  })
})

describe('preset: Two tones, one nonlinearity', () => {
  it('creates frequencies that are harmonics of neither input', () => {
    const clipped = run('Two tones, one nonlinearity')
    const clean = run('Two tones, one nonlinearity', { blocks: [] })
    // 2*400 - 250 and 3*250 - 2*400: intermodulation, not harmonics.
    for (const f of [900, 50]) {
      expect(clipped.at(f), `${f} Hz clipped`).toBeGreaterThan(clean.at(f) * 50 + 1e-3)
      expect(clean.at(f), `${f} Hz clean`).toBeLessThan(1e-3)
    }
    // A symmetric clipper makes odd-order products; the even-order ones stay
    // small until something breaks the symmetry.
    expect(clipped.at(150)).toBeLessThan(clipped.at(900) / 10)
  })
})

// ------------------------------------------------------ FIR and the z-plane

describe('preset: A moving average is a filter', () => {
  // The note claims deep nulls every fs/N. Tested by putting a sine exactly on
  // one and seeing whether it survives, which is a stronger reading than
  // eyeballing a noise spectrum.
  it('annihilates a tone sitting exactly on a null', () => {
    const p = byName('A moving average is a filter').patch
    const N = p.blocks[0].params.taps
    const fs = p.sampleRate
    const spacing = fs / N

    for (let mult = 1; mult * spacing < fs / 2; mult++) {
      const f = mult * spacing
      const sources = [{ id: 1, type: 'sine', freq: f, amp: 1, phase: 0, enabled: true }]
      const r = renderChain(sources, p.blocks, 4096, fs)
      let pk = 0
      // Skip the pre-roll region: the filter is settled, but the first N-1
      // output samples of the returned frame are still the honest response.
      for (let i = N; i < r.buf.length; i++) pk = Math.max(pk, Math.abs(r.buf[i]))
      expect(pk, `${f} Hz`).toBeLessThan(1e-9)
    }
  })

  it('passes DC through untouched', () => {
    const p = byName('A moving average is a filter').patch
    const sources = [{ id: 1, type: 'sine', freq: 0, amp: 1, phase: Math.PI / 2, enabled: true }]
    const r = renderChain(sources, p.blocks, 512, p.sampleRate)
    for (let i = p.blocks[0].params.taps; i < r.buf.length; i++) {
      expect(r.buf[i]).toBeCloseTo(1, 12)
    }
  })
})

describe('preset: Everything arrives together', () => {
  it('has a flat group delay of exactly (N-1)/2 samples', () => {
    const p = byName('Everything arrives together').patch
    const N = p.blocks[0].params.taps
    const freqs = Float64Array.from({ length: 513 }, (_, i) => (i * p.sampleRate) / 2 / 512)
    const { delay } = chainGroupDelay(p.blocks, freqs, p.sampleRate)
    let seen = 0
    for (let i = 1; i < delay.length - 1; i++) {
      if (!Number.isFinite(delay[i])) continue
      expect(delay[i]).toBeCloseTo((N - 1) / 2, 5)
      seen++
    }
    expect(seen).toBeGreaterThan(300)
  })

  // The note contrasts this against a biquad. That contrast is the lesson, so
  // it gets measured rather than asserted.
  it('a biquad at the same cutoff is NOT flat', () => {
    const p = byName('Everything arrives together').patch
    const fc = p.blocks[0].params.freq
    const bq = [{ id: 9, type: 'lowpass', bypass: false, params: { freq: fc, q: 4, gainDb: 0 } }]
    const freqs = Float64Array.from({ length: 513 }, (_, i) => (i * p.sampleRate) / 2 / 512)
    const { delay } = chainGroupDelay(bq, freqs, p.sampleRate)
    let lo = Infinity
    let hi = -Infinity
    for (let i = 1; i < delay.length - 1; i++) {
      if (!Number.isFinite(delay[i])) continue
      lo = Math.min(lo, delay[i])
      hi = Math.max(hi, delay[i])
    }
    expect(hi - lo).toBeGreaterThan(5)
  })

  it('sits at half amplitude at the cutoff, not at -3 dB', () => {
    const p = byName('Everything arrives together').patch
    const fc = p.blocks[0].params.freq
    const { mag } = chainResponse(p.blocks, Float64Array.of(fc), p.sampleRate)
    expect(mag[0]).toBeCloseTo(0.5, 2)
    // Emphatically not the biquad convention.
    expect(Math.abs(mag[0] - Math.SQRT1_2)).toBeGreaterThan(0.1)
  })
})

describe('preset: The kernel is the filter', () => {
  it('the impulse response IS the designed kernel', () => {
    const p = byName('The kernel is the filter').patch
    const want = designFir(p.blocks[0].params, p.sampleRate)
    const { h, exact } = chainImpulse(p.blocks, 256, p.sampleRate)
    expect(exact).toBe(true)
    for (let k = 0; k < want.length; k++) expect(h[k]).toBeCloseTo(want[k], 15)
  })

  it('has its symmetry centre where the note says', () => {
    const p = byName('The kernel is the filter').patch
    const h = designFir(p.blocks[0].params, p.sampleRate)
    expect((h.length - 1) / 2).toBe(15)
    for (let k = 0, j = h.length - 1; k < j; k++, j--) {
      expect(h[k]).toBeCloseTo(h[j], 15)
    }
  })
})

describe('preset: Cut it off abruptly and it rings', () => {
  const overshoot = (blocks, fs) => {
    const freqs = Float64Array.from({ length: 400 }, (_, i) => (i * blocks[0].params.freq) / 400)
    const { mag } = chainResponse(blocks, freqs, fs)
    let top = 0
    for (const v of mag) top = Math.max(top, v)
    return top - 1
  }

  it('overshoots by roughly the Gibbs 9%', () => {
    const p = byName('Cut it off abruptly and it rings').patch
    const o = overshoot(p.blocks, p.sampleRate)
    expect(o).toBeGreaterThan(0.05)
    expect(o).toBeLessThan(0.12)
  })

  it('more taps do not fix it, and a taper does', () => {
    const p = byName('Cut it off abruptly and it rings').patch
    const with_ = (over) => [{ ...p.blocks[0], params: { ...p.blocks[0].params, ...over } }]
    // Doubling the length leaves the overshoot essentially where it was...
    const short = overshoot(with_({ taps: 101 }), p.sampleRate)
    const long = overshoot(with_({ taps: 201 }), p.sampleRate)
    expect(Math.abs(long - short)).toBeLessThan(0.02)
    // ...while a window removes it outright.
    expect(overshoot(with_({ window: 'hamming' }), p.sampleRate)).toBeLessThan(0.01)
  })
})

describe('preset: Zeros on the circle', () => {
  it('has N-1 zeros, all of them exactly on the unit circle', () => {
    const p = byName('Zeros on the circle').patch
    const N = p.blocks[0].params.taps
    const { poles, zeros } = chainPolesZeros(p.blocks, p.sampleRate)
    expect(poles).toHaveLength(0)
    expect(zeros).toHaveLength(N - 1)
    for (const [re, im] of zeros) expect(Math.hypot(re, im)).toBeCloseTo(1, 9)
  })

  // The claim that ties the two panes together: each zero's ANGLE is a null's
  // frequency. Not a resemblance — the same numbers.
  it('every zero sits at the angle of a null in the spectrum', () => {
    const p = byName('Zeros on the circle').patch
    const fs = p.sampleRate
    const { zeros } = chainPolesZeros(p.blocks, fs)
    const spacing = fs / p.blocks[0].params.taps
    for (const [re, im] of zeros) {
      const f = (Math.abs(Math.atan2(im, re)) * fs) / (2 * Math.PI)
      // The angle lands on a whole multiple of fs/N...
      const mult = f / spacing
      expect(Math.abs(mult - Math.round(mult)), `${f} Hz`).toBeLessThan(1e-6)
      // ...and the response there really is zero.
      const { mag } = chainResponse(p.blocks, Float64Array.of(f), fs)
      expect(mag[0], `${f} Hz`).toBeLessThan(1e-9)
    }
  })
})

describe('preset: Convolution, watched', () => {
  const setup = () => {
    const p = byName('Convolution, watched').patch
    const n = 480 // 3 periods at 8 kHz / 250 Hz, plus room
    const x = render(p.sources, n, p.sampleRate, 0)
    const y = applyChain(p.blocks, x, p.sampleRate, 0)
    const { h } = chainImpulse(p.blocks, 64, p.sampleRate)
    return { p, x, y, h }
  }

  // The view's central claim, at every sample: the chain's stateful output IS
  // the dot product against the kernel. Two code paths, one number.
  it('the chain output equals the convolution sum at every sample', () => {
    const { x, y, h } = setup()
    for (let n = 0; n < x.length; n++) {
      let dot = 0
      for (let k = 0; k < h.length && k <= n; k++) dot += h[k] * x[n - k]
      expect(y[n], `sample ${n}`).toBeCloseTo(dot, 12)
    }
  })

  it('flat tops sit exactly at the amplitude, ramps are exactly N-1 wide', () => {
    const { p, y } = setup()
    const A = p.sources[0].amp
    const N = p.blocks[0].params.taps
    const half = 8000 / p.sources[0].freq / 2 // 16 samples per half-period

    // Window wholly inside the first high half-period: samples N-1 .. half-1.
    for (let n = N - 1; n < half; n++) expect(y[n]).toBeCloseTo(A, 12)
    // And wholly inside the following low half-period.
    for (let n = half + N - 1; n < 2 * half; n++) expect(y[n]).toBeCloseTo(-A, 12)
    // The ramp between them takes exactly N-1 samples: strictly between the
    // levels while the window straddles the edge.
    for (let n = half; n < half + N - 1; n++) {
      expect(Math.abs(y[n]), `ramp sample ${n}`).toBeLessThan(A)
    }
  })

  it('breaks, visibly, for a nonlinear chain — which is the lesson', () => {
    const p = byName('Convolution, watched').patch
    const blocks = [
      ...p.blocks,
      { id: 99, type: 'clip', bypass: false, params: { threshold: 0.4 } },
    ]
    const x = render(p.sources, 256, p.sampleRate, 0)
    const y = applyChain(blocks, x, p.sampleRate, 0)
    const { h, exact } = chainImpulse(blocks, 64, p.sampleRate)
    expect(exact).toBe(false)
    let worst = 0
    for (let n = 32; n < 256; n++) {
      let dot = 0
      for (let k = 0; k < h.length && k <= n; k++) dot += h[k] * x[n - k]
      worst = Math.max(worst, Math.abs(y[n] - dot))
    }
    expect(worst).toBeGreaterThan(0.05)
  })
})
