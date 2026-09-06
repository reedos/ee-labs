import { describe, it, expect } from 'vitest'
import { rng } from '@ee-labs/random'
import {
  CONSTELLATIONS,
  constellation,
  neighbourPairs,
  adjacency,
  naturalLabels,
  hamming,
  gray,
  mapBits,
  demapSymbols,
  randomBits,
  errorVectorMagnitude,
} from './mappers.js'

describe('the Gray code', () => {
  it('sends neighbouring integers to labels one bit apart', () => {
    for (let i = 0; i < 63; i++) expect(hamming(gray(i), gray(i + 1)), `${i}`).toBe(1)
  })

  it('is a permutation of the integers it covers', () => {
    const seen = new Set()
    for (let i = 0; i < 64; i++) seen.add(gray(i))
    expect(seen.size).toBe(64)
  })
})

describe('every constellation', () => {
  for (const name of CONSTELLATIONS) {
    describe(name, () => {
      const c = constellation(name)

      it('has unit mean square, so Es and Eb differ by exactly 10 log10 of the bits', () => {
        expect(Math.abs(c.meanSquare - 1)).toBeLessThan(1e-12)
      })

      it('holds two to the bits points', () => {
        expect(c.size).toBe(2 ** c.bits)
      })

      it('labels every point once', () => {
        expect(new Set(Array.from(c.labels)).size).toBe(c.size)
      })

      it('labels nearest neighbours one bit apart, by enumeration', () => {
        for (const [i, j] of neighbourPairs(name)) {
          expect(hamming(c.labels[i], c.labels[j]), `${name} ${i} ${j}`).toBe(1)
        }
      })
    })
  }

  it('gives the minimum distances the plan quotes', () => {
    expect(constellation('bpsk').minDistance).toBeCloseTo(2, 12)
    expect(constellation('qpsk').minDistance).toBeCloseTo(Math.SQRT2, 12)
    expect(constellation('psk8').minDistance).toBeCloseTo(2 * Math.sin(Math.PI / 8), 12)
    expect(constellation('qam16').minDistance).toBeCloseTo(Math.sqrt(2 / 5), 12)
    expect(constellation('qam64').minDistance).toBeCloseTo(2 / Math.sqrt(42), 12)
    expect(constellation('pam4').minDistance).toBeCloseTo(2 / Math.sqrt(5), 12)
  })

  it("reads 16-QAM's constellation peak-to-average as 2.553 dB", () => {
    // 18 a^2 over 1, with a = sqrt(1/10). Not typed in: the table produces it.
    expect(constellation('qam16').paprDb).toBeCloseTo(10 * Math.log10(1.8), 12)
    expect(constellation('qam16').paprDb).toBeCloseTo(2.553, 3)
  })
})

describe('Gray labels against natural binary', () => {
  it('costs nothing and saves a bit on QPSK', () => {
    expect(adjacency('qpsk')).toBe(1)
    expect(adjacency('qpsk', naturalLabels('qpsk'))).toBe(2)
  })

  it('holds for every square constellation the lab ships', () => {
    for (const name of ['pam4', 'qam16', 'qam64', 'psk8']) {
      expect(adjacency(name), name).toBe(1)
      expect(adjacency(name, naturalLabels(name)), `${name} natural`).toBeGreaterThan(1)
    }
  })
})

describe('the mapper round trip', () => {
  for (const name of CONSTELLATIONS) {
    it(`${name} returns the bits it was given, exactly`, () => {
      const c = constellation(name)
      const r = rng(7)
      const bits = randomBits(c.bits * 500, r)
      const got = demapSymbols(name, mapBits(name, bits))
      expect(Array.from(got)).toEqual(Array.from(bits))
    })
  }

  it('refuses a bit stream that is not a whole number of symbols', () => {
    expect(() => mapBits('qam16', new Uint8Array(6))).toThrow(/whole number/)
  })

  it('refuses a constellation it does not ship', () => {
    expect(() => constellation('qam256')).toThrow(/no such table/)
  })
})

describe('the error vector magnitude', () => {
  it('is zero on a clean constellation', () => {
    const bits = randomBits(4 * 64, rng(1))
    const evm = errorVectorMagnitude('qam16', mapBits('qam16', bits))
    expect(evm.percent).toBeLessThan(1e-12)
  })

  it('reads the displacement when every point is moved by a known amount', () => {
    const bits = randomBits(2 * 64, rng(1))
    const syms = mapBits('qpsk', bits)
    const moved = Float64Array.from(syms)
    for (let i = 0; i < moved.length; i += 2) moved[i] += 0.1
    const evm = errorVectorMagnitude('qpsk', moved)
    expect(evm.rms).toBeCloseTo(0.1, 10)
  })
})
