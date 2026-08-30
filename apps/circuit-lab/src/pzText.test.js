import { describe, expect, it } from 'vitest'
import { describeRoots } from './pzText.js'
import { polesZeros } from '@ee-labs/systems'
import { transferOf, defaultsOf } from './circuits.js'

// The values printed beside the pole-zero plot, measured against the circuits
// whose roots they describe — the reader is being handed numbers to write
// down, so the numbers had better be the roots.

describe('describeRoots', () => {
  it('prints a conjugate pair once, as re ± j·im', () => {
    const { poles } = polesZeros(transferOf('rlcSeries', defaultsOf('rlcSeries'), 'c'))
    const text = describeRoots(poles)
    // One pair, so one entry; ζω₀ = 5k, ω₀√(1−ζ²) ≈ 31.2k — in fmt()'s own
    // spaced engineering notation, since that is what the reader sees.
    expect(text).toBe('-5 k ± j31.2 k')
  })

  it('prints real poles plainly, both of them', () => {
    const { poles } = polesZeros(transferOf('twinT', defaultsOf('twinT'), 'out'))
    const text = describeRoots(poles)
    // (−2±√3)/RC = −2.68k and −37.3k, two distinct reals.
    expect(text.split(',').length).toBe(2)
    expect(text).toContain('-2.68 k')
    expect(text).toContain('-37.3 k')
  })

  it('drops the zero real part for roots ON the axis — the twin-T story', () => {
    // ω₀ = 1/RC = 10⁴ rad/s at the defaults (10 kΩ, 10 nF).
    const { zeros } = polesZeros(transferOf('twinT', defaultsOf('twinT'), 'out'))
    expect(describeRoots(zeros)).toBe('±j10 k')
  })

  it('calls the origin 0 and an empty list none', () => {
    const { poles, zeros } = polesZeros(transferOf('integrator', defaultsOf('integrator'), 'out'))
    expect(describeRoots(poles)).toBe('0')
    expect(describeRoots(zeros)).toBe('none')
  })
})
