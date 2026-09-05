import { describe, it, expect } from 'vitest'
import { createComplexChain, cmul, cdiv, cabs, rot, at, put } from './chain.js'

// A small registry, so this test measures the machinery rather than the lab's
// blocks. It is the same shape Signal Lab's BLOCK_TYPES has.
const BLOCK_TYPES = {
  rotate: {
    label: 'Rotate',
    defaults: { degrees: 0 },
    make: (p) => {
      const r = rot((p.degrees * Math.PI) / 180)
      return { process: (v) => cmul(v, r), settle: 0 }
    },
  },
  gain: {
    label: 'Gain',
    defaults: { g: 1 },
    make: (p) => ({ process: (v) => [v[0] * p.g, v[1] * p.g], settle: 0 }),
  },
  delay: {
    label: 'Delay',
    defaults: { n: 1 },
    make: (p) => {
      const buf = []
      return {
        process: (v) => {
          buf.push(v)
          return buf.length > p.n ? buf.shift() : [0, 0]
        },
        settle: p.n,
      }
    },
  },
}

const { applyChain, runChain, chainSettle } = createComplexChain(BLOCK_TYPES)

const ramp = (n) => {
  const b = new Float64Array(2 * n)
  for (let i = 0; i < n; i++) put(b, i, i + 1, -(i + 1))
  return b
}

describe('complex arithmetic', () => {
  it('multiplies and divides as inverses', () => {
    const a = [0.3, -1.7]
    const b = [2.1, 0.4]
    const back = cdiv(cmul(a, b), b)
    expect(back[0]).toBeCloseTo(a[0], 12)
    expect(back[1]).toBeCloseTo(a[1], 12)
  })

  it('answers zero for a zero divisor rather than a pair of NaNs', () => {
    expect(cdiv([1, 1], [0, 0])).toEqual([0, 0])
  })

  it('reads a magnitude off an interleaved buffer', () => {
    const b = Float64Array.from([3, 4])
    expect(cabs(at(b, 0))).toBe(5)
  })
})

describe('the chain over complex samples', () => {
  it('returns a copy when no block is active, and not the input itself', () => {
    const buf = ramp(8)
    const out = applyChain([], buf, 8000)
    expect(Array.from(out)).toEqual(Array.from(buf))
    expect(out).not.toBe(buf)
  })

  it('composes blocks in order', () => {
    const buf = ramp(4)
    const g2 = [{ id: 1, type: 'gain', params: { g: 2 } }]
    const g3 = [{ id: 2, type: 'gain', params: { g: 3 } }]
    const both = applyChain([...g2, ...g3], buf, 8000)
    const twice = applyChain(g3, applyChain(g2, buf, 8000), 8000)
    expect(Array.from(both)).toEqual(Array.from(twice))
  })

  it('takes a rotation and its inverse back to the identity, to floating point', () => {
    const buf = ramp(16)
    const out = applyChain(
      [
        { id: 1, type: 'rotate', params: { degrees: 37 } },
        { id: 2, type: 'rotate', params: { degrees: -37 } },
      ],
      buf,
      8000,
    )
    for (let i = 0; i < buf.length; i++) expect(out[i]).toBeCloseTo(buf[i], 12)
  })

  it('is pure, so two calls give bit-identical output', () => {
    const buf = ramp(32)
    const blocks = [{ id: 1, type: 'delay', params: { n: 3 } }]
    expect(Array.from(applyChain(blocks, buf, 8000))).toEqual(
      Array.from(applyChain(blocks, buf, 8000)),
    )
  })

  it('skips a bypassed block and an unknown type', () => {
    const buf = ramp(4)
    const out = applyChain(
      [
        { id: 1, type: 'gain', params: { g: 5 }, bypass: true },
        { id: 2, type: 'nosuch', params: {} },
      ],
      buf,
      8000,
    )
    expect(Array.from(out)).toEqual(Array.from(buf))
  })

  it('adds up how long the chain takes to forget its start', () => {
    expect(
      chainSettle(
        [
          { id: 1, type: 'delay', params: { n: 3 } },
          { id: 2, type: 'delay', params: { n: 5 } },
        ],
        8000,
      ),
    ).toBe(8)
  })
})

describe('the flow strip', () => {
  it('returns the buffer after every stage, including the source', () => {
    const buf = ramp(4)
    const { out, stages } = runChain(
      buf,
      [
        { id: 1, type: 'gain', params: { g: 2 } },
        { id: 2, type: 'gain', params: { g: 3 } },
      ],
      8000,
    )
    expect(stages.map((s) => s.label)).toEqual(['Source', 'Gain', 'Gain'])
    expect(stages[1].buf[0]).toBeCloseTo(2, 12)
    expect(out[0]).toBeCloseTo(6, 12)
  })

  it('marks a bypassed stage and passes its buffer through unchanged', () => {
    const buf = ramp(4)
    const { stages } = runChain(buf, [{ id: 1, type: 'gain', params: { g: 9 }, bypass: true }], 8000)
    expect(stages[1].bypassed).toBe(true)
    expect(Array.from(stages[1].buf)).toEqual(Array.from(buf))
  })
})
