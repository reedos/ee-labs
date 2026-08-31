import { describe, it, expect } from 'vitest'
import { createChain } from './chain.js'
import { render, rms } from './signals.js'
import { spectrum } from './spectrum.js'

// The boundary test.
//
// This package exists to be shared, which is only true if it works with a block
// registry it has never seen. Everything below uses a registry invented here —
// nothing from Signal Lab — so if an app-specific assumption ever creeps back
// into the chain, this fails before a second app is written against it.

/** A registry with nothing in common with the filter sandbox's. */
const TOY = {
  scale: {
    label: 'Scale',
    defaults: { k: 2 },
    make: (p) => ({ process: (x) => x * p.k, settle: 0 }),
    response: (p) => p.k,
    phase: () => 0,
  },
  invert: {
    label: 'Invert',
    defaults: {},
    make: () => ({ process: (x) => -x, settle: 0 }),
    response: () => 1,
    phase: () => Math.PI,
  },
  // Deliberately memoryful, to exercise the pre-roll path.
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
  squarer: {
    label: 'Squarer',
    defaults: {},
    make: () => ({ process: (x) => x * x, settle: 0 }),
    response: () => null,
  },
}

const chain = createChain(TOY)
const SR = 8000
const src = (over = {}) => ({ id: 1, type: 'sine', freq: 250, amp: 1, phase: 0, enabled: true, ...over })
const blk = (type, params = {}, over = {}) => ({
  id: 1,
  type,
  bypass: false,
  params: { ...TOY[type].defaults, ...params },
  ...over,
})

describe('the chain works with a registry it has never seen', () => {
  it('returns every function an application needs', () => {
    for (const name of [
      'chainSettle',
      'applyChain',
      'renderChain',
      'runChain',
      'chainResponse',
      'chainPhase',
    ]) {
      expect(typeof chain[name], name).toBe('function')
    }
  })

  it('applies a foreign block', () => {
    const dry = chain.renderChain([src()], [], 512, SR).buf
    const wet = chain.renderChain([src()], [blk('scale', { k: 3 })], 512, SR).buf
    for (let i = 0; i < 512; i++) expect(wet[i]).toBeCloseTo(dry[i] * 3, 10)
  })

  it('composes them in order', () => {
    const both = chain.renderChain(
      [src()],
      [blk('scale', { k: 2 }), blk('invert', {}, { id: 2 })],
      256,
      SR,
    ).buf
    const dry = chain.renderChain([src()], [], 256, SR).buf
    for (let i = 0; i < 256; i++) expect(both[i]).toBeCloseTo(-2 * dry[i], 10)
  })

  it('skips a bypassed block bit-exactly', () => {
    const dry = chain.renderChain([src()], [], 256, SR).buf
    const out = chain.renderChain([src()], [blk('scale', {}, { bypass: true })], 256, SR).buf
    for (let i = 0; i < 256; i++) expect(out[i]).toBe(dry[i])
  })

  it('multiplies magnitudes and adds phases across foreign blocks', () => {
    const freqs = Float64Array.from([100, 500, 1000])
    const blocks = [blk('scale', { k: 4 }), blk('invert', {}, { id: 2 })]
    const r = chain.chainResponse(blocks, freqs, SR)
    const p = chain.chainPhase(blocks, freqs, SR)
    expect(r.exact).toBe(true)
    for (let i = 0; i < freqs.length; i++) expect(r.mag[i]).toBeCloseTo(4, 10)
    // The invert contributes pi; unwrapping may express it as -pi, which is the
    // same angle. Either is correct, so compare the cosine.
    for (let i = 0; i < freqs.length; i++) expect(Math.cos(p.phase[i])).toBeCloseTo(-1, 10)
  })

  it('reports a nonlinear foreign block as inexact rather than guessing', () => {
    const r = chain.chainResponse([blk('squarer')], Float64Array.from([100]), SR)
    expect(r.exact).toBe(false)
  })

  it('asks for pre-roll on a memoryful foreign block, and settles it', () => {
    const blocks = [blk('leak', { a: 0.95 })]
    expect(chain.chainSettle(blocks, SR)).toBeGreaterThan(100)

    // Started cold the output climbs from zero; warmed up it is already there.
    const cold = chain.renderChain([src({ type: 'square' })], blocks, 1024, SR, { warmup: 0 }).buf
    const warm = chain.renderChain([src({ type: 'square' })], blocks, 1024, SR).buf
    expect(Math.abs(cold[0])).toBeLessThan(Math.abs(warm[0]))
    // ...and by the end of the frame the two have converged.
    expect(cold[1023]).toBeCloseTo(warm[1023], 6)
  })

  it('reports one stage per block for a flow display', () => {
    const { stages, out } = chain.runChain(
      [src()],
      [blk('scale', { k: 2 }), blk('invert', {}, { id: 2 })],
      128,
      SR,
    )
    expect(stages).toHaveLength(3)
    expect(stages.map((s) => s.label)).toEqual(['Σ', 'Scale', 'Invert'])
    expect(rms(out)).toBeCloseTo(2 * rms(stages[0].buf), 6)
  })

  it('generation and transforms need no registry at all', () => {
    // These are usable on their own, which is what a control tool would want
    // before it has any blocks defined.
    const buf = render([src({ freq: 1000, amp: 1 })], 2048, SR)
    const { freqs, amps } = spectrum(buf, SR, 'hann')
    let bi = 0
    for (let i = 1; i < amps.length; i++) if (amps[i] > amps[bi]) bi = i
    expect(freqs[bi]).toBeCloseTo(1000, 0)
    expect(amps[bi]).toBeCloseTo(1, 2)
  })
})

describe('runChain honors the warmup option', () => {
  // The "show transient" checkbox passes warmup: 0 here. runChain once
  // destructured only t0 and silently pre-rolled anyway, so the checkbox
  // toggled a "transient shown" flag over a fully settled waveform.
  const { runChain, renderChain } = createChain(TOY)
  const sources = [{ id: 1, enabled: true, type: 'sine', freq: 250, amp: 1, phase: 0 }]
  const blocks = [{ id: 1, type: 'leak', bypass: false, params: { a: 0.98 } }]

  it('warmup: 0 really starts cold, and differs from auto', () => {
    const cold = runChain(sources, blocks, 256, 8000, { warmup: 0 })
    const warm = runChain(sources, blocks, 256, 8000, {})
    expect(cold.warmup).toBe(0)
    expect(warm.warmup).toBeGreaterThan(0)
    let diff = 0
    for (let i = 0; i < 256; i++) diff = Math.max(diff, Math.abs(cold.out[i] - warm.out[i]))
    expect(diff).toBeGreaterThan(0.01)
  })

  it('matches renderChain sample for sample under the same warmup', () => {
    for (const warmup of [0, 'auto']) {
      const a = runChain(sources, blocks, 256, 8000, { warmup })
      const b = renderChain(sources, blocks, 256, 8000, { warmup })
      for (let i = 0; i < 256; i++) expect(a.out[i], `warmup=${warmup} i=${i}`).toBe(b.buf[i])
    }
  })
})
