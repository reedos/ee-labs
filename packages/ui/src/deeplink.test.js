import { describe, it, expect } from 'vitest'
import { buildLink, parseLink } from './deeplink.js'

// Both ends of the bridge have to agree, so the round trip is the contract.

describe('deep links', () => {
  it('round-trips a patch', () => {
    const patch = {
      rate: 48000,
      sources: [{ type: 'square', freq: 250, amp: 1 }],
      blocks: [
        { type: 'lowpass', params: [800, 10] },
        { type: 'clip', params: [0.5] },
      ],
    }
    const { patch: back, warnings } = parseLink(buildLink(patch))
    expect(warnings).toEqual([])
    expect(back.rate).toBe(48000)
    expect(back.sources).toEqual([{ type: 'square', freq: 250, amp: 1 }])
    expect(back.blocks).toEqual(patch.blocks)
  })

  it('stays readable, which is the point of not encoding it', () => {
    const link = buildLink({ rate: 48000, blocks: [{ type: 'lowpass', params: [800, 0.707] }] })
    expect(link).toBe('rate=48000&b=lowpass:800:0.707')
  })

  it('survives a leading hash and empty segments', () => {
    const { patch } = parseLink('#rate=8000&&b=notch:1000:5')
    expect(patch.rate).toBe(8000)
    expect(patch.blocks).toHaveLength(1)
  })

  it('reports what it could not read instead of guessing', () => {
    const { patch, warnings } = parseLink('rate=fast&b=lowpass:eight:1&wat=3&nope')
    expect(warnings).toHaveLength(4)
    expect(warnings.join(' ')).toMatch(/rate "fast"/)
    expect(warnings.join(' ')).toMatch(/"eight" is not a number/)
    expect(warnings.join(' ')).toMatch(/unknown setting "wat"/)
    expect(warnings.join(' ')).toMatch(/not a key=value/)
    // The bad block is dropped, not loaded with a NaN in it.
    expect(patch).toBeNull()
  })

  it('keeps a good block when a different one is bad', () => {
    const { patch, warnings } = parseLink('b=lowpass:800:2&b=bogus:x')
    expect(warnings).toHaveLength(1)
    expect(patch.blocks).toEqual([{ type: 'lowpass', params: [800, 2] }])
  })

  it('is null for nothing at all, so a bare URL is not an empty patch', () => {
    expect(parseLink('').patch).toBeNull()
    expect(parseLink('#').patch).toBeNull()
  })

  it('does not lose precision that matters', () => {
    const link = buildLink({ blocks: [{ type: 'lowpass', params: [1234.5678, 0.7071068] }] })
    const { patch } = parseLink(link)
    expect(patch.blocks[0].params[0]).toBeCloseTo(1234.5678, 2)
    expect(patch.blocks[0].params[1]).toBeCloseTo(0.7071068, 6)
  })
})
