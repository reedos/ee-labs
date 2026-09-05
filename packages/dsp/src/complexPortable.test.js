import { describe, it, expect } from 'vitest'
import { createChain } from './chain.js'
import {
  createComplexChain,
  complexBuffer,
  imagOf,
  magnitudeOf,
  realOf,
  renderComplex,
  toComplex,
} from './complexChain.js'
import { render } from './signals.js'
import { spectrumComplex } from './spectrum.js'

// The complex chain's boundary test, written the way portable.test.js is: a
// registry invented here and nothing imported from any application.
//
// The load-bearing invariant is the last describe block. A registry that knows
// nothing about complex samples, fed a signal with a zero imaginary part, must
// come out of the complex chain bit-identical to what the real chain produces.
// If that ever stops holding, the two chains have drifted apart and a lab using
// both is comparing two different filters.

/** A registry with no idea that complex samples exist. */
const REAL_ONLY = {
  scale: {
    label: 'Scale',
    defaults: { k: 2 },
    make: (p) => ({ process: (x) => x * p.k, settle: 0 }),
    response: (p) => p.k,
    phase: () => 0,
  },
  leak: {
    label: 'Leaky integrator',
    defaults: { a: 0.9 },
    make: (p) => {
      let y = 0
      return {
        process: (x) => {
          y = p.a * y + (1 - p.a) * x
          return y
        },
        settle: Math.ceil(Math.log(1e-6) / Math.log(p.a)),
      }
    },
    response: null,
  },
}

/** One block that genuinely mixes the two parts, which the real chain cannot hold. */
const COMPLEX_AWARE = {
  ...REAL_ONLY,
  rotate: {
    label: 'Frequency shift',
    defaults: { shift: 1000 },
    make: () => ({ process: (x) => x, settle: 0 }),
    makeComplex: (p, sampleRate) => {
      const w = (2 * Math.PI * p.shift) / sampleRate
      const pair = [0, 0]
      return {
        process: (x, y, t) => {
          const c = Math.cos(w * t * sampleRate)
          const s = Math.sin(w * t * sampleRate)
          pair[0] = x * c - y * s
          pair[1] = x * s + y * c
          return pair
        },
        settle: 0,
      }
    },
    response: () => null,
  },
}

const SR = 8000
const src = (over = {}) => ({ id: 1, type: 'sine', freq: 250, amp: 1, phase: 0, enabled: true, ...over })
const blk = (registry, type, params = {}, over = {}) => ({
  id: 1,
  type,
  bypass: false,
  params: { ...registry[type].defaults, ...params },
  ...over,
})

describe('the interleaved buffer and its parts', () => {
  it('holds two numbers a sample, and hands each part back', () => {
    const buf = complexBuffer(4)
    expect(buf.length).toBe(8)
    const re = Float64Array.from([1, 2, 3, 4])
    const im = Float64Array.from([-1, 0, 1, 2])
    const c = toComplex(re, im)
    expect(Array.from(realOf(c))).toEqual([1, 2, 3, 4])
    expect(Array.from(imagOf(c))).toEqual([-1, 0, 1, 2])
    expect(Array.from(magnitudeOf(toComplex(Float64Array.from([3]), Float64Array.from([4]))))).toEqual([5])
  })

  it('a source list written for the real chain arrives with nothing in quadrature', () => {
    const n = 64
    const c = renderComplex([src()], n, SR)
    const r = render([src()], n, SR)
    for (let i = 0; i < n; i++) {
      expect(c[2 * i], `i=${i}`).toBe(r[i])
      expect(c[2 * i + 1], `i=${i}`).toBe(0)
    }
  })

  it('an analytic source is a rotating phasor, with constant magnitude', () => {
    const n = 256
    const c = renderComplex([src({ analytic: true, amp: 2 })], n, SR)
    const mag = magnitudeOf(c)
    for (let i = 0; i < n; i++) expect(mag[i], `i=${i}`).toBeCloseTo(2, 10)
    // ...and its spectrum has one line, on the positive side only, which is the
    // whole reason for carrying the second number.
    const s = spectrumComplex(realOf(c), imagOf(c), SR, 'hann')
    let hi = 0
    let lo = 0
    for (let k = 0; k < s.freqs.length; k++) {
      if (Math.abs(s.freqs[k] - 250) < 100) hi = Math.max(hi, s.amps[k])
      if (Math.abs(s.freqs[k] + 250) < 100) lo = Math.max(lo, s.amps[k])
    }
    expect(hi).toBeGreaterThan(1.9)
    expect(lo).toBeLessThan(hi / 1000)
  })

  it('refuses an analytic source it cannot build, with the reason', () => {
    expect(() => renderComplex([src({ type: 'square', analytic: true })], 32, SR)).toThrow(/Hilbert/)
    // Disabled, so nothing is claimed about it and nothing is refused.
    expect(() => renderComplex([src({ type: 'square', analytic: true, enabled: false })], 32, SR)).not.toThrow()
  })
})

describe('a real-only registry runs unchanged, and gives the real chain answer', () => {
  const real = createChain(REAL_ONLY)
  const complex = createComplexChain(REAL_ONLY)

  for (const blocks of [
    [],
    [blk(REAL_ONLY, 'scale', { k: 3 })],
    [blk(REAL_ONLY, 'leak', { a: 0.95 })],
    [blk(REAL_ONLY, 'scale', { k: 2 }), blk(REAL_ONLY, 'leak', { a: 0.9 }, { id: 2 })],
    [blk(REAL_ONLY, 'scale', {}, { bypass: true }), blk(REAL_ONLY, 'leak', { a: 0.8 }, { id: 2 })],
  ]) {
    const name = blocks.map((b) => b.type + (b.bypass ? ' (bypassed)' : '')).join(' then ') || 'no blocks'
    it(`${name}: bit for bit against createChain`, () => {
      for (const type of ['sine', 'square', 'noise']) {
        const sources = [src({ type })]
        const a = real.renderChain(sources, blocks, 512, SR)
        const b = complex.renderComplexChain(sources, blocks, 512, SR)
        expect(b.warmup).toBe(a.warmup)
        expect(b.clamped).toBe(a.clamped)
        for (let i = 0; i < 512; i++) {
          expect(b.buf[2 * i], `${type} i=${i}`).toBe(a.buf[i])
          expect(b.buf[2 * i + 1], `${type} i=${i}`).toBe(0)
        }
      }
    })
  }

  it('the stage buffers agree too, one for one', () => {
    const blocks = [blk(REAL_ONLY, 'scale', { k: 2 }), blk(REAL_ONLY, 'leak', { a: 0.9 }, { id: 2 })]
    const a = real.runChain([src()], blocks, 256, SR)
    const b = complex.runComplexChain([src()], blocks, 256, SR)
    expect(b.stages.map((s) => s.label)).toEqual(a.stages.map((s) => s.label))
    for (let s = 0; s < a.stages.length; s++) {
      for (let i = 0; i < 256; i++) {
        expect(b.stages[s].buf[2 * i], `stage ${s} i=${i}`).toBe(a.stages[s].buf[i])
      }
    }
  })

  it('a real block treats the two parts separately, which is what a real filter does', () => {
    // Put different signals in the two parts and the outputs must not mix.
    const n = 400
    const re = render([src({ freq: 250 })], n, SR)
    const im = render([src({ freq: 700, amp: 0.5 })], n, SR)
    const blocks = [blk(REAL_ONLY, 'leak', { a: 0.9 })]
    const both = complex.applyComplexChain(blocks, toComplex(re, im), SR)
    const onlyRe = real.applyChain(blocks, re, SR)
    const onlyIm = real.applyChain(blocks, im, SR)
    for (let i = 0; i < n; i++) {
      expect(both[2 * i], `i=${i}`).toBe(onlyRe[i])
      expect(both[2 * i + 1], `i=${i}`).toBe(onlyIm[i])
    }
  })

  it('offers the same response, phase and settle functions the real chain does', () => {
    const blocks = [blk(REAL_ONLY, 'scale', { k: 4 })]
    const freqs = Float64Array.from([100, 500, 1000])
    expect(complex.chainSettle(blocks, SR)).toBe(real.chainSettle(blocks, SR))
    expect(Array.from(complex.chainResponse(blocks, freqs, SR).mag)).toEqual(
      Array.from(real.chainResponse(blocks, freqs, SR).mag),
    )
    expect(typeof complex.chainPhase).toBe('function')
    expect(typeof complex.chainGroupDelay).toBe('function')
  })
})

describe('a block that mixes the two parts', () => {
  const complex = createComplexChain(COMPLEX_AWARE)

  it('shifts a spectrum sideways, which no real block can do', () => {
    const n = 4096
    const sources = [src({ freq: 500, analytic: true })]
    const blocks = [blk(COMPLEX_AWARE, 'rotate', { shift: 1500 })]
    const { buf } = complex.renderComplexChain(sources, blocks, n, SR)
    const s = spectrumComplex(realOf(buf), imagOf(buf), SR, 'hann')
    let peak = 0
    let at = 0
    for (let k = 0; k < s.freqs.length; k++) {
      if (s.amps[k] > peak) {
        peak = s.amps[k]
        at = s.freqs[k]
      }
    }
    // 500 Hz shifted up by 1500 lands at 2000, on one side only.
    expect(at).toBeCloseTo(2000, 0)
    expect(peak).toBeGreaterThan(0.9)
  })

  it('leaves the magnitude alone, because a rotation is what it is', () => {
    const n = 512
    const sources = [src({ freq: 500, analytic: true, amp: 1.5 })]
    const blocks = [blk(COMPLEX_AWARE, 'rotate', { shift: 900 })]
    const { buf } = complex.renderComplexChain(sources, blocks, n, SR)
    for (const m of magnitudeOf(buf)) expect(m).toBeCloseTo(1.5, 9)
  })
})
