import { describe, it, expect } from 'vitest'
import { BLOCK_GROUPS, BLOCK_TYPES, firDesign, iirDesign, makeBlockRecord, tapsOf } from './blocks.js'
import { chainImpulse, chainRefusals, chainResponse, chainSpec, renderChain } from './chain.js'
import { biquadResponse, designBiquad, firResponse, quantizer, runAdaptive, weightError } from '@ee-labs/dsp'

// The registry's contract, which the group lanes build against.

const SR = 48000
const blk = (type, params = {}, over = {}) => ({
  id: 1,
  type,
  bypass: false,
  params: { ...BLOCK_TYPES[type].defaults, ...params },
  ...over,
})

describe('every block declares what one card needs to render it', () => {
  it('a label, a group, a hint, defaults and a parameter schema', () => {
    for (const [type, def] of Object.entries(BLOCK_TYPES)) {
      expect(def.label, type).toBeTruthy()
      expect(BLOCK_GROUPS, type).toContain(def.group)
      expect(def.hint, type).toBeTruthy()
      expect(def.defaults, type).toBeTruthy()
      expect(Array.isArray(def.params), type).toBe(true)
      expect(typeof def.make, type).toBe('function')
      // Every parameter in the schema has a default, and every default has a
      // parameter. A knob with no default renders as NaN.
      const keys = new Set(def.params.map((p) => p.key))
      for (const k of Object.keys(def.defaults)) expect(keys.has(k), `${type}.${k}`).toBe(true)
      for (const k of keys) expect(k in def.defaults, `${type}.${k}`).toBe(true)
    }
  })

  it('makeBlockRecord gives a block its own copy of the defaults', () => {
    const a = makeBlockRecord('decimate', 1)
    const b = makeBlockRecord('decimate', 2)
    a.params.M = 8
    expect(b.params.M).toBe(BLOCK_TYPES.decimate.defaults.M)
  })

  it('every processor runs a buffer through without producing a NaN', () => {
    const x = Float64Array.from({ length: 512 }, (_, i) => Math.sin(i / 7))
    for (const [type, def] of Object.entries(BLOCK_TYPES)) {
      const proc = def.make(def.defaults, SR)
      let bad = 0
      for (let i = 0; i < x.length; i++) if (!Number.isFinite(proc.process(x[i], i / SR))) bad++
      expect(bad, type).toBe(0)
      expect(Number.isFinite(proc.settle), type).toBe(true)
    }
  })
})

describe('the blocks that have no transfer function', () => {
  it('decline a response and give the reason', () => {
    for (const type of ['decimate', 'interpolate', 'adaptive']) {
      const def = BLOCK_TYPES[type]
      expect(def.response(def.defaults, 1000, SR), type).toBe(null)
      expect(def.reason, type).toBeTruthy()
    }
  })

  it('and the chain reports the reason rather than an empty overlay', () => {
    const out = chainRefusals([blk('decimate')], SR)
    expect(out).toHaveLength(1)
    expect(out[0].label).toBe('Decimate and hold')
    expect(out[0].reason).toMatch(/shift-invariant/)
  })

  it('a chain of only linear blocks reports nothing to explain', () => {
    expect(chainRefusals([blk('firspec')], SR)).toEqual([])
  })

  it('the response overlay is marked inexact when one is present', () => {
    const freqs = Float64Array.from([500, 2000, 8000])
    expect(chainResponse([blk('firspec')], freqs, SR).exact).toBe(true)
    expect(chainResponse([blk('decimate')], freqs, SR).exact).toBe(false)
  })
})

describe('the design blocks', () => {
  it('memoise, so a Remez exchange runs once for a set of parameters', () => {
    const p = BLOCK_TYPES.firspec.defaults
    const first = firDesign(p, SR)
    for (let i = 0; i < 50; i++) expect(firDesign({ ...p }, SR)).toBe(first)
    // A different specification is a different design.
    expect(firDesign({ ...p, stopDb: 40 }, SR)).not.toBe(first)
  })

  it('the block runs the filter it designed, and its response is that filter', () => {
    const p = BLOCK_TYPES.firspec.defaults
    const h = firDesign(p, SR).h
    const proc = BLOCK_TYPES.firspec.make(p, SR)
    // Its impulse response is the kernel, tap for tap.
    for (let k = 0; k < h.length; k++) {
      expect(proc.process(k === 0 ? 1 : 0, 0), `tap ${k}`).toBeCloseTo(h[k], 12)
    }
    for (const f of [1000, 4000, 8000]) {
      expect(BLOCK_TYPES.firspec.response(p, f, SR)).toBeCloseTo(firResponse(h, f, SR), 12)
    }
  })

  it('the IIR block runs its cascade and reports its poles', () => {
    const p = BLOCK_TYPES.iirspec.defaults
    const d = iirDesign(p, SR)
    const pz = BLOCK_TYPES.iirspec.pz(p, SR)
    expect(pz.poles.length).toBe(d.order)
    for (const [re, im] of pz.poles) expect(Math.hypot(re, im)).toBeLessThan(1)

    const proc = BLOCK_TYPES.iirspec.make(p, SR)
    const n = 20000
    let peak = 0
    for (let i = 0; i < n; i++) {
      const y = proc.process(Math.sin((2 * Math.PI * 1000 * i) / SR), i / SR)
      if (i > n - 2000) peak = Math.max(peak, Math.abs(y))
    }
    expect(peak).toBeCloseTo(BLOCK_TYPES.iirspec.response(p, 1000, SR), 3)
  })

  it('carry their specification, and the chain finds exactly one', () => {
    const s = chainSpec([blk('firspec')], SR)
    expect(s.margin.bands).toHaveLength(2)
    expect(s.extra).toBe(0)
    const two = chainSpec([blk('firspec'), blk('iirspec', {}, { id: 2 })], SR)
    expect(two.extra).toBe(1)
    expect(chainSpec([blk('decimate')], SR)).toBe(null)
  })
})

describe('the adaptive block', () => {
  it('runs the whole record for the view, and keeps a weight vector per stride', () => {
    const p = { ...BLOCK_TYPES.adaptive.defaults, taps: 8, mu: 0.02 }
    const x = Float64Array.from({ length: 4096 }, (_, i) => Math.sin(i * 1.1) * Math.cos(i * 0.37))
    const r = BLOCK_TYPES.adaptive.run(p, x, SR)
    expect(r.history.length).toBeGreaterThan(2)
    for (const w of r.history) expect(w.length).toBe(8)
    // The first row is the vector the run started from.
    expect(Array.from(r.history[0])).toEqual(new Array(8).fill(0))
  })

  it('reaches the plant it is chasing, from a white input', () => {
    const p = { ...BLOCK_TYPES.adaptive.defaults, taps: 8, mu: 0.05 }
    const plant = tapsOf(p.plant)
    const x = Float64Array.from({ length: 40000 }, (_, i) => 2 * ((Math.sin(i * 12.9898) * 43758.5453) % 1) - 1)
    const r = runAdaptive({ x, plant, algorithm: 'lms', taps: 8, mu: 0.02, stride: 4000 })
    expect(weightError(r.w, plant)).toBeLessThan(0.01)
  })

  it('parses its tap list, and survives a malformed one', () => {
    expect(Array.from(tapsOf('1, -0.5, 0.25'))).toEqual([1, -0.5, 0.25])
    expect(Array.from(tapsOf(''))).toEqual([1])
    expect(Array.from(tapsOf('a, b'))).toEqual([1])
  })
})

describe('the fixed-point block', () => {
  const p = BLOCK_TYPES.fixedbiquad.defaults

  it('quantises its coefficients onto the grid its word length names', () => {
    const q = quantizer({ bits: p.coeffBits, intBits: p.coeffInt })
    const r = BLOCK_TYPES.fixedbiquad.quantised(p, SR)
    for (const k of ['b0', 'b1', 'b2', 'a1', 'a2']) {
      const n = r.coeffs[k] / q.delta
      expect(Math.abs(n - Math.round(n)), k).toBeLessThan(1e-9)
    }
    expect(r.stable).toBe(true)
  })

  it('is exactly linear while its state is float64, and says so when it is not', () => {
    expect(BLOCK_TYPES.fixedbiquad.lti({ ...p, stateBits: 0 })).toBe(true)
    expect(BLOCK_TYPES.fixedbiquad.lti({ ...p, stateBits: 12 })).toBe(false)
    expect(BLOCK_TYPES.fixedbiquad.reason).toMatch(/nonlinear/)

    // The exact case: the measured impulse response is the quantised filter's.
    const linear = chainImpulse([blk('fixedbiquad')], 4096, SR)
    expect(linear.exact).toBe(true)
    const coeffs = BLOCK_TYPES.fixedbiquad.quantised(p, SR).coeffs
    for (const f of [200, 600, 3000]) {
      let re = 0
      let im = 0
      for (let n = 0; n < linear.h.length; n++) {
        const w = (2 * Math.PI * f * n) / SR
        re += linear.h[n] * Math.cos(w)
        im -= linear.h[n] * Math.sin(w)
      }
      expect(Math.hypot(re, im), `${f} Hz`).toBeCloseTo(biquadResponse(coeffs, f, SR), 3)
    }
    expect(chainImpulse([blk('fixedbiquad', { stateBits: 12 })], 512, SR).exact).toBe(false)
  })

  it('passes the signal through unchanged when quantisation made it unstable', () => {
    const unstable = { ...p, coeffBits: 8, q: 20 }
    expect(BLOCK_TYPES.fixedbiquad.quantised(unstable, SR).stable).toBe(false)
    const proc = BLOCK_TYPES.fixedbiquad.make(unstable, SR)
    for (let i = 0; i < 50; i++) expect(proc.process(0.5, 0)).toBe(0.5)
  })
})

describe('the chain runs the registry it was bound to', () => {
  it('renders a frame through a rate changer and a design block together', () => {
    const sources = [{ id: 1, type: 'sine', freq: 1500, amp: 1, phase: 0, enabled: true }]
    const blocks = [blk('firspec'), blk('decimate', {}, { id: 2 })]
    const { buf } = renderChain(sources, blocks, 2048, SR)
    expect(buf.length).toBe(2048)
    for (let i = 0; i < buf.length; i++) expect(Number.isFinite(buf[i])).toBe(true)
  })
})
