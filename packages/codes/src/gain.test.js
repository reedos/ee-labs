import { describe, it, expect } from 'vitest'
import { qFunction } from '@ee-labs/random'
import { berClosed, ebN0For } from '@ee-labs/comms'
import {
  asymptoticHard,
  asymptoticSoft,
  channelBer,
  crossover,
  ebN0AtBer,
  gainCurve,
  hardBlockBer,
  hardConvBound,
  pairwiseHard,
  realGain,
  softConvBound,
  uncodedBer,
} from './gain.js'
import { CONV_CODES, encoder, freeDistance, weightSpectrum } from './conv.js'
import { correctionRadius, golayCode, hammingCode, minimumDistance } from './block.js'
import { shannonLimitDb } from './entropy.js'

// The coding gain, and the two places this lab meets the Communications Lab.
//
// Invariants 11 and 12 of INFORMATION_LAB_PLAN.md §2.10 live here. The gain has
// the right sign either side of the crossover, and the uncoded curve this lab
// draws is the one that lab computes.

const H74 = hammingCode(3)
const K3 = encoder(CONV_CODES.K3)
const spectrumOf = (enc, extra = 7) => weightSpectrum(enc, freeDistance(enc) + extra)

const blockCurve = (code) => {
  const t = correctionRadius(minimumDistance(code).d)
  return (db) => hardBlockBer({ n: code.n, k: code.k, t }, db).ber
}
const softCurve = (enc) => {
  const dFree = freeDistance(enc)
  const spectrum = spectrumOf(enc)
  return (db) => softConvBound({ rate: enc.rate, spectrum, dFree }, db).ber
}
const hardCurve = (enc) => {
  const dFree = freeDistance(enc)
  const spectrum = spectrumOf(enc)
  return (db) => hardConvBound({ rate: enc.rate, spectrum, dFree }, db).ber
}

describe('invariant 12: the two labs agree about the uncoded link', () => {
  it('draws the same curve the Communications Lab computes, to floating point', () => {
    for (let db = -2; db <= 16; db += 0.25) {
      expect(uncodedBer(db), `${db} dB`).toBe(berClosed('bpsk', 10 ** (db / 10)))
    }
    // And the same energy per bit at the error rate every gain is read at.
    expect(ebN0AtBer(uncodedBer, 1e-5)).toBeCloseTo(ebN0For('bpsk', 1e-5), 6)
    expect(ebN0AtBer(uncodedBer, 1e-5)).toBeCloseTo(9.5879, 4)
  })

  it('puts the Shannon limit to the left of every point on that lab’s curve', () => {
    // A scheme carrying r bit/s/Hz cannot work below the limit at r, so every
    // point of a real curve sits to the right of it. The gap at 10⁻⁵ is what
    // B4 measures.
    for (const [scheme, r] of [
      ['bpsk', 1],
      ['qpsk', 2],
      ['qam16', 4],
      ['qam64', 6],
    ]) {
      const limit = shannonLimitDb(r)
      // Every error rate a reader would ask that scheme for costs more energy
      // than the limit at its own spectral efficiency, and the gap grows as
      // the target falls.
      let last = -Infinity
      for (const target of [1e-3, 1e-4, 1e-5, 1e-6]) {
        const at = ebN0For(scheme, target)
        expect(at, `${scheme} at ${target}`).toBeGreaterThan(limit)
        expect(at, `${scheme} at ${target}`).toBeGreaterThan(last)
        last = at
      }
    }
    expect(ebN0For('bpsk', 1e-5) - shannonLimitDb(1)).toBeCloseTo(9.588, 3)
    expect(ebN0For('qpsk', 1e-5) - shannonLimitDb(2)).toBeCloseTo(7.827, 3)
    expect(ebN0For('qam16', 1e-5) - shannonLimitDb(4)).toBeCloseTo(7.694, 3)
  })
})

describe('the coded curves', () => {
  it('runs a block code at the channel rate its own rate buys', () => {
    for (const db of [0, 4, 8, 12]) {
      const out = hardBlockBer({ n: 7, k: 4, t: 1 }, db)
      expect(out.rate).toBeCloseTo(4 / 7, 12)
      expect(out.p).toBeCloseTo(qFunction(Math.sqrt((2 * 4 * 10 ** (db / 10)) / 7)), 12)
      // The channel the code sees is worse than the one no code would see.
      expect(out.p).toBeGreaterThan(uncodedBer(db))
      expect(out.bound).toBe(false)
    }
  })

  it('reaches 10⁻⁵ where the plan says, and gains what the plan says', () => {
    const g = realGain({ coded: blockCurve(H74), uncoded: uncodedBer, target: 1e-5 })
    expect(g.coded).toBeCloseTo(9.174, 3)
    expect(g.uncoded).toBeCloseTo(9.588, 3)
    expect(g.gain).toBeCloseTo(0.413, 3)
    const asym = asymptoticHard(H74.k / H74.n, 1)
    expect(asym).toBeCloseTo(0.58, 3)
    expect(asym - g.gain).toBeCloseTo(0.167, 3)
    // The real gain is below the asymptotic one, which is the whole point of
    // keeping the two apart.
    expect(g.gain).toBeLessThan(asym)
  })

  it('gains more from a longer code, and the two gains stay in order', () => {
    const golay = golayCode()
    const g = realGain({ coded: blockCurve(golay), uncoded: uncodedBer, target: 1e-5 })
    expect(g.gain).toBeCloseTo(2.143, 3)
    const asym = asymptoticHard(golay.k / golay.n, 3)
    expect(asym).toBeCloseTo(3.195, 3)
    expect(asym - g.gain).toBeCloseTo(1.053, 3)
    expect(g.gain).toBeGreaterThan(realGain({ coded: blockCurve(H74), uncoded: uncodedBer, target: 1e-5 }).gain)
  })

  it('bounds a convolutional code, and says which way the bound runs', () => {
    const out = softConvBound({ rate: 0.5, spectrum: spectrumOf(K3), dFree: 5 }, 6)
    expect(out.bound).toBe(true)
    expect(out.direction).toMatch(/at or below/)
    const g = realGain({ coded: softCurve(K3), uncoded: uncodedBer, target: 1e-5, bound: true })
    expect(g.coded).toBeCloseTo(5.882, 3)
    expect(g.gain).toBeCloseTo(3.706, 3)
    expect(g.direction).toMatch(/at or above/)
    expect(asymptoticSoft(0.5, 5)).toBeCloseTo(3.979, 3)
    // A bound on the error rate gives a bound on the gain, and the asymptotic
    // figure is the one the curves approach.
    expect(g.gain).toBeLessThan(asymptoticSoft(0.5, 5))
  })

  it('makes soft decisions worth over two decibels against hard ones, on the same code', () => {
    const soft = realGain({ coded: softCurve(K3), uncoded: uncodedBer, target: 1e-5, bound: true })
    const hard = realGain({ coded: hardCurve(K3), uncoded: uncodedBer, target: 1e-5, bound: true })
    expect(hard.coded - soft.coded).toBeCloseTo(2.217, 3)
    expect(soft.gain).toBeGreaterThan(hard.gain)
    // The pairwise hard term is a probability, and it grows with the crossover.
    expect(pairwiseHard(5, 0)).toBe(0)
    expect(pairwiseHard(5, 0.5)).toBeCloseTo(0.5, 9)
    expect(pairwiseHard(5, 0.1)).toBeGreaterThan(pairwiseHard(5, 0.01))
    // An even distance splits the tie, so it sits above the odd-only sum.
    expect(pairwiseHard(6, 0.1)).toBeGreaterThan(0)
  })

  it('gains more as the constraint length grows', () => {
    let last = 0
    for (const name of ['K3', 'K5', 'K7', 'K9']) {
      const enc = encoder(CONV_CODES[name])
      const g = realGain({ coded: softCurve(enc), uncoded: uncodedBer, target: 1e-5, bound: true })
      expect(g.gain, name).toBeGreaterThan(last)
      expect(g.gain, name).toBeLessThan(asymptoticSoft(enc.rate, freeDistance(enc)))
      last = g.gain
    }
  })
})

describe('invariant 11: the gain has the right sign', () => {
  it('puts the coded curve below the uncoded one above the crossover, and above it below', () => {
    for (const [name, coded] of [
      ['H74', blockCurve(H74)],
      ['Golay', blockCurve(golayCode())],
      ['K3 soft', softCurve(K3)],
      ['K3 hard', hardCurve(K3)],
    ]) {
      const x = crossover({ coded, uncoded: uncodedBer, lo: -2, hi: 14 })
      expect(x.ber, name).toBeCloseTo(x.uncodedBer, 9)
      for (const above of [0.5, 1, 2, 4]) {
        expect(coded(x.ebN0Db + above), `${name} at +${above} dB`).toBeLessThan(uncodedBer(x.ebN0Db + above))
      }
      for (const below of [0.5, 1, 1.5]) {
        expect(coded(x.ebN0Db - below), `${name} at −${below} dB`).toBeGreaterThan(uncodedBer(x.ebN0Db - below))
      }
    }
  })

  it('pins the crossover of the (7,4) code, where both curves read the same rate', () => {
    const x = crossover({ coded: blockCurve(H74), uncoded: uncodedBer })
    expect(x.ebN0Db).toBeCloseTo(5.862, 3)
    expect(x.ber).toBeCloseTo(2.741e-3, 6)
    expect(x.uncodedBer).toBeCloseTo(2.741e-3, 6)
    // Below it the code is the worse of the two, which is F2's claim.
    expect(blockCurve(H74)(4)).toBeGreaterThan(uncodedBer(4))
    expect(blockCurve(H74)(8)).toBeLessThan(uncodedBer(8))
  })

  it('refuses a crossover that is not inside the window it was given', () => {
    expect(() => crossover({ coded: blockCurve(H74), uncoded: uncodedBer, lo: 8, hi: 12 })).toThrow(/already the better/)
    expect(() => crossover({ coded: blockCurve(H74), uncoded: uncodedBer, lo: 0, hi: 3 })).toThrow(/has not crossed/)
  })

  it('refuses a target a curve does not reach, rather than returning the end of the window', () => {
    expect(() => ebN0AtBer(uncodedBer, 1e-5, { lo: -4, hi: 4 })).toThrow(/does not reach/)
    expect(() => ebN0AtBer(uncodedBer, 0.4, { lo: 0, hi: 12 })).toThrow(/already below/)
    expect(() => ebN0AtBer(uncodedBer, 0)).toThrow(/between 0 and 0.5/)
  })
})

describe('the curve the pane draws', () => {
  it('carries both rates at every point, in order', () => {
    const curve = gainCurve({ coded: blockCurve(H74), uncoded: uncodedBer, from: 0, to: 12, step: 0.5 })
    expect(curve.points.length).toBe(25)
    expect(curve.points[0].ebN0Db).toBe(0)
    expect(curve.points.at(-1).ebN0Db).toBeCloseTo(12, 9)
    for (const q of curve.points) {
      expect(q.coded).toBeGreaterThan(0)
      expect(q.uncoded).toBeGreaterThan(0)
      expect(q.coded).toBeLessThan(1)
    }
    // Both curves fall as the ratio rises.
    for (let i = 1; i < curve.points.length; i++) {
      expect(curve.points[i].uncoded).toBeLessThan(curve.points[i - 1].uncoded)
      expect(curve.points[i].coded).toBeLessThan(curve.points[i - 1].coded)
    }
  })
})
