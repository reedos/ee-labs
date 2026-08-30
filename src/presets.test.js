import { describe, it, expect } from 'vitest'
import { PRESETS } from './App.jsx'
import { renderChain } from './dsp/chain.js'
import { spectrum } from './dsp/spectrum.js'
import { designBiquad, biquadResponse } from './dsp/biquad.js'

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
  it('names a block type that exists and renders without NaN', () => {
    for (const p of PRESETS) {
      const sampleRate = p.patch.sampleRate || 8000
      const r = renderChain(p.patch.sources, p.patch.blocks || [], 1024, sampleRate)
      for (let i = 0; i < r.buf.length; i++) {
        if (!Number.isFinite(r.buf[i])) throw new Error(`${p.name}: non-finite at ${i}`)
      }
    }
  })

  it('keeps every source below Nyquist except the one about aliasing', () => {
    for (const p of PRESETS) {
      if (p.name === 'Aliasing') continue
      const nyq = (p.patch.sampleRate || 8000) / 2
      for (const s of p.patch.sources) {
        expect(s.freq, `${p.name}`).toBeLessThan(nyq)
      }
    }
  })
})
