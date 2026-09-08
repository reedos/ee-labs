import { describe, it, expect } from 'vitest'
import { complex as cx } from '@ee-labs/network'
import { RfError } from './const.js'
import { abcdToSparam, cascadeS, chainAbcd, chainViaAbcd, elementAbcd, seriesAbcd, shuntAbcd, sparamToAbcd, transformerAbcd } from './cascade.js'
import { entryOf, sDiff, sFromNetlist, sparam } from './sparam.js'
import { mdiff } from './convert.js'

const { C, cabs, csub } = cx
const Z0 = 50
const F = 1e9

const close = (got, want, tol = 1e-12) => expect(Math.abs(got - want)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(want)))

function piPad(db, z0 = Z0) {
  const K = Math.pow(10, db / 20)
  const series = (z0 * (K * K - 1)) / (2 * K)
  const shunt = (z0 * (K + 1)) / (K - 1)
  return {
    series,
    shunt,
    net: {
      elements: [
        { type: 'R', id: 'Rsh1', nodes: ['p1', 'gnd'], value: shunt },
        { type: 'R', id: 'Rser', nodes: ['p1', 'p2'], value: series },
        { type: 'R', id: 'Rsh2', nodes: ['p2', 'gnd'], value: shunt },
      ],
    },
  }
}

describe('the chain matrices of the elements', () => {
  it('a series element and a shunt element are the two a book gives', () => {
    const s = seriesAbcd(C(25))
    expect(s[0][1]).toEqual(C(25))
    expect(s[1][0]).toEqual(C(0))
    const p = shuntAbcd(C(0.02))
    expect(p[1][0]).toEqual(C(0.02))
    expect(p[0][1]).toEqual(C(0))
  })

  it('an inductor is jwL in series and a capacitor is 1/jwC', () => {
    const L = 8e-9
    const Cval = 1.6e-12
    const w = 2 * Math.PI * F
    expect(cabs(csub(elementAbcd('L', L, F)[0][1], C(0, w * L)))).toBeLessThan(1e-9)
    expect(cabs(csub(elementAbcd('C', Cval, F)[0][1], C(0, -1 / (w * Cval))))).toBeLessThan(1e-6)
  })

  it('a chain of nothing is a wire, and a wire changes no two-port', () => {
    const { net } = piPad(3)
    const sp = sFromNetlist(net, ['p1', 'p2'], F, { z0: Z0 })
    const wire = abcdToSparam(chainAbcd([]), { f: F, z0: Z0 })
    expect(sDiff(cascadeS(sp, wire), sp)).toBeLessThan(1e-13)
  })
})

describe('two attenuators in cascade', () => {
  it('give the sum of their decibels, and stay matched at both ports', () => {
    for (const [a, b] of [[3, 3], [1, 10], [6, 20]]) {
      const spA = sFromNetlist(piPad(a).net, ['p1', 'p2'], F, { z0: Z0 })
      const spB = sFromNetlist(piPad(b).net, ['p1', 'p2'], F, { z0: Z0 })
      const both = cascadeS(spA, spB)
      close(entryOf(both, 1, 0).db, -(a + b), 1e-10)
      expect(entryOf(both, 0, 0).mag).toBeLessThan(1e-12)
      expect(entryOf(both, 1, 1).mag).toBeLessThan(1e-12)
    }
  })

  it('give the same answer by the matrix product as by the closed composition', () => {
    const spA = sFromNetlist(piPad(3).net, ['p1', 'p2'], F, { z0: Z0 })
    const spB = sFromNetlist(piPad(10).net, ['p1', 'p2'], F, { z0: Z0 })
    expect(sDiff(cascadeS(spA, spB), chainViaAbcd([spA, spB]))).toBeLessThan(1e-12)
  })

  it('agree with solving the whole cascaded circuit at once', () => {
    // The two pads written as one netlist, and the same two composed.
    const p = piPad(3)
    const whole = {
      elements: [
        { type: 'R', id: 'Ra', nodes: ['p1', 'gnd'], value: p.shunt },
        { type: 'R', id: 'Rb', nodes: ['p1', 'm'], value: p.series },
        { type: 'R', id: 'Rc', nodes: ['m', 'gnd'], value: p.shunt / 2 },
        { type: 'R', id: 'Rd', nodes: ['m', 'p2'], value: p.series },
        { type: 'R', id: 'Re', nodes: ['p2', 'gnd'], value: p.shunt },
      ],
    }
    const direct = sFromNetlist(whole, ['p1', 'p2'], F, { z0: Z0 })
    const one = sFromNetlist(p.net, ['p1', 'p2'], F, { z0: Z0 })
    expect(sDiff(direct, cascadeS(one, one))).toBeLessThan(1e-11)
  })
})

describe('the order of a cascade matters, and the arithmetic says how', () => {
  it('a series inductor then a shunt capacitor is not the same two-port as the reverse', () => {
    const a = abcdToSparam(elementAbcd('L', 8e-9, F), { f: F, z0: Z0 })
    const b = abcdToSparam(elementAbcd('Cp', 1.6e-12, F), { f: F, z0: Z0 })
    expect(sDiff(cascadeS(a, b), cascadeS(b, a))).toBeGreaterThan(1e-3)
    // Both are lossless, so both keep the same through-power.
    close(entryOf(cascadeS(a, b), 1, 0).mag, entryOf(cascadeS(b, a), 1, 0).mag, 1e-12)
  })

  it('a chain matrix and its two-port are the same object, both ways', () => {
    const M = chainAbcd([elementAbcd('L', 8e-9, F), elementAbcd('Cp', 1.6e-12, F), seriesAbcd(C(10))])
    const sp = abcdToSparam(M, { f: F, z0: Z0 })
    expect(mdiff(sparamToAbcd(sp), M)).toBeLessThan(1e-12)
  })
})

describe('two mismatched ports with nothing between them', () => {
  it('are declined when a bounced wave returns unchanged, with the reason', () => {
    // Two ideal reflectors facing each other: S22 of the left is 1 and S11 of
    // the right is 1, so 1 − S22 S11 is zero and no finite steady state exists.
    const mirror = sparam({ f: F, z0: Z0, s: [[C(1), C(0)], [C(0), C(1)]] })
    let thrown = null
    try {
      cascadeS(mirror, mirror)
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(RfError)
    expect(thrown.message).toMatch(/comes back in phase/)
    expect(thrown.kind).toBe('resonance')
  })

  it('are declined when the two are referred to different impedances', () => {
    const a = sparam({ f: F, z0: 50, s: [[C(0), C(1)], [C(1), C(0)]] })
    const b = sparam({ f: F, z0: 75, s: [[C(0), C(1)], [C(1), C(0)]] })
    expect(() => cascadeS(a, b)).toThrow(RfError)
  })
})

describe('the ideal transformer, cascaded', () => {
  it('two of ratio n and 1/n cancel, leaving a wire', () => {
    const up = abcdToSparam(transformerAbcd(2), { f: F, z0: Z0 })
    const down = abcdToSparam(transformerAbcd(0.5), { f: F, z0: Z0 })
    const both = chainViaAbcd([up, down])
    expect(entryOf(both, 0, 0).mag).toBeLessThan(1e-13)
    close(entryOf(both, 1, 0).mag, 1, 1e-13)
  })
})
