import { describe, it, expect } from 'vitest'
import { awgn, constellation, mapBits, noiseVariance, softMetric } from '@ee-labs/comms'
import { rng } from '@ee-labs/random'
import { CONV_CODES, encode as convEncode, encoder, viterbi } from './conv.js'
import { L12, sumProduct, syndromeWeight } from './ldpc.js'
import { codeFromParity, encode as blockEncode } from './block.js'
import { errorCount, levelsFromLlr } from './channel.js'

// The hand-over this lab and the Communications Lab share
// (INFORMATION_LAB_PLAN.md §6): that lab's detector produces a per-bit belief,
// and every soft decoder here reads one.
//
// The two labs disagree about one thing and agree about the thing that
// crosses the boundary. That lab sends bit 0 as −1 and this one sends it as
// +1. Both write a belief as `log P(0|y) / P(1|y)`, so a positive number
// argues for a zero in both, and a decoder that reads beliefs never sees the
// difference. `levelsFromLlr` is where the two meet.

const bpsk = constellation('bpsk')

/** One block through that lab's chain, from bits to beliefs. */
function through(bits, ebN0Db, seed) {
  const syms = mapBits('bpsk', Int8Array.from(bits))
  const { sigma2 } = noiseVariance({ ebN0Db, bitsPerSymbol: 1 })
  const noisy = awgn(syms, { ebN0Db, bitsPerSymbol: 1, seed })
  const llr = softMetric('bpsk', noisy.out, sigma2)
  return { llr: Array.from(llr), sigma2, hard: Array.from(llr, (v) => (v < 0 ? 1 : 0)) }
}

describe('the Communications Lab’s soft metric', () => {
  it('agrees with the hard decision in sign, and grows with the ratio in size', () => {
    const r = rng(3)
    const bits = Array.from({ length: 400 }, () => (r.uniform() < 0.5 ? 0 : 1))
    const weak = through(bits, 2, 5)
    const strong = through(bits, 10, 5)
    // The sign of the belief is the bit the detector would decide.
    weak.llr.forEach((v, i) => expect(v < 0 ? 1 : 0, `bit ${i}`).toBe(weak.hard[i]))
    // Size grows with the ratio, and the strong channel is wrong less often.
    const mean = (list) => list.reduce((a, b) => a + Math.abs(b), 0) / list.length
    expect(mean(strong.llr)).toBeGreaterThan(mean(weak.llr))
    expect(errorCount(strong.hard, bits)).toBeLessThan(errorCount(weak.hard, bits))
    // That lab sends bit 0 as −1, so its label 0 sits at the negative point.
    expect(bpsk.points[0]).toBe(-1)
    expect(bpsk.labels[0]).toBe(0)
  })

  it('drives this lab’s Viterbi decoder, and soft beats hard on the same noise', () => {
    const enc = encoder(CONV_CODES.K3)
    const r = rng(11)
    const message = Array.from({ length: 600 }, () => (r.uniform() < 0.5 ? 0 : 1))
    const sent = convEncode(enc, message)
    // At 1 dB per channel bit the code is working hard enough for the two
    // decisions to differ. Higher up they both reach zero and the comparison
    // says nothing.
    const chain = through(sent.bits, 1, 21)
    const soft = viterbi(enc, levelsFromLlr(chain.llr, chain.sigma2), { soft: true })
    const hard = viterbi(enc, chain.hard)
    expect(errorCount(soft.bits, message)).toBe(0)
    expect(errorCount(hard.bits, message)).toBeGreaterThan(0)
    expect(errorCount(soft.bits, message)).toBeLessThan(errorCount(hard.bits, message))
    // Both are far better than the channel under them, which is the point.
    expect(errorCount(hard.bits, message)).toBeLessThan(errorCount(chain.hard, sent.bits))
    // A clean channel decodes exactly.
    const clean = through(sent.bits, 20, 4)
    expect(viterbi(enc, levelsFromLlr(clean.llr, clean.sigma2), { soft: true }).bits).toEqual(message)
  })

  it('drives this lab’s belief propagation, with no conversion at all', () => {
    // The sum-product decoder reads beliefs rather than samples, so that lab's
    // metric goes straight in.
    const H = L12()
    const code = codeFromParity(H)
    const codeword = blockEncode(code, [1, 0, 1, 1, 0])
    let converged = 0
    let right = 0
    for (let seed = 1; seed <= 60; seed++) {
      const chain = through(codeword, 3, seed)
      const out = sumProduct(H, chain.llr, { maxIter: 12 })
      if (!out.converged) continue
      converged++
      expect(syndromeWeight(H, out.bits), `seed ${seed}`).toBe(0)
      if (out.bits.join('') === codeword.join('')) right++
    }
    expect(converged).toBeGreaterThan(40)
    expect(right).toBeGreaterThan(converged * 0.8)
  })
})
