import { describe, it, expect } from 'vitest'
import { qFunction } from '@ee-labs/random'
import {
  SCHEMES,
  HOLLOW_BELOW,
  berClosed,
  serClosed,
  ebN0For,
  bitsPerSymbol,
  relativeHalfWidth,
  errorsFor,
  symbolsFor,
  berCount,
  berCurve,
} from './ber.js'

const lin = (db) => 10 ** (db / 10)

describe('the closed forms', () => {
  it('give BPSK and QPSK the same rate per bit, to floating point', () => {
    for (const db of [0, 4, 8, 12]) {
      expect(berClosed('qpsk', lin(db))).toBeCloseTo(berClosed('bpsk', lin(db)), 15)
    }
  })

  it('are the Q function of twice the ratio, for antipodal signalling', () => {
    for (const db of [0, 4, 8, 12]) {
      expect(berClosed('bpsk', lin(db))).toBeCloseTo(qFunction(Math.sqrt(2 * lin(db))), 15)
    }
  })

  it('give the four rates at 10 dB the plan quotes', () => {
    expect(berClosed('bpsk', lin(10))).toBeCloseTo(3.8721e-6, 10)
    expect(berClosed('fskCoherent', lin(10))).toBeCloseTo(7.827e-4, 8)
    expect(berClosed('qam16', lin(10))).toBeCloseTo(1.7542e-3, 7)
    expect(berClosed('qam64', lin(10))).toBeCloseTo(2.6533e-2, 6)
  })

  it('reach the exact 16-QAM form the standard references give', () => {
    // 3/4 Q(sqrt(4 g / 5)) + 1/2 Q(3 sqrt(4 g / 5)) - 1/4 Q(5 sqrt(4 g / 5)),
    // which the per-dimension enumeration must reproduce without being told it.
    for (const db of [0, 5, 10, 15]) {
      const g = lin(db)
      const a = Math.sqrt((4 * g) / 5)
      const want = 0.75 * qFunction(a) + 0.5 * qFunction(3 * a) - 0.25 * qFunction(5 * a)
      expect(berClosed('qam16', g), `${db} dB`).toBeCloseTo(want, 12)
    }
  })

  it('give the BPSK rates at the five counted points', () => {
    const want = [7.865e-2, 3.7506e-2, 1.2501e-2, 2.3883e-3, 1.9091e-4]
    const got = [0, 2, 4, 6, 8].map((d) => berClosed('bpsk', lin(d)))
    for (let i = 0; i < want.length; i++) expect(got[i] / want[i], `${i}`).toBeCloseTo(1, 3)
  })

  it('fall as the ratio rises, for every scheme', () => {
    for (const s of SCHEMES) {
      let last = Infinity
      for (const db of [0, 2, 4, 6, 8, 10, 12]) {
        const v = berClosed(s, lin(db))
        expect(v, `${s} at ${db} dB`).toBeLessThan(last)
        last = v
      }
    }
  })

  it('refuses a scheme it has no form for', () => {
    expect(() => berClosed('turbo', 1)).toThrow(/no form/)
  })
})

describe('the thresholds for a rate of one in a hundred thousand', () => {
  it('are the six the plan quotes', () => {
    expect(ebN0For('bpsk', 1e-5)).toBeCloseTo(9.588, 3)
    expect(ebN0For('qpsk', 1e-5)).toBeCloseTo(9.588, 3)
    expect(ebN0For('fskCoherent', 1e-5)).toBeCloseTo(12.598, 3)
    expect(ebN0For('fskNoncoherent', 1e-5)).toBeCloseTo(13.352, 3)
    expect(ebN0For('dbpsk', 1e-5)).toBeCloseTo(10.342, 3)
    expect(ebN0For('qam16', 1e-5)).toBeCloseTo(13.435, 3)
    expect(ebN0For('qam64', 1e-5)).toBeCloseTo(17.787, 3)
  })

  it('put exactly 3.010 dB between coherent FSK and BPSK', () => {
    // The orthogonal penalty is a factor of two inside the argument of Q, and
    // nothing else, so the gap is 10 log10(2) at every rate.
    for (const target of [1e-3, 1e-5, 1e-7]) {
      const gap = ebN0For('fskCoherent', target) - ebN0For('bpsk', target)
      expect(gap, `${target}`).toBeCloseTo(10 * Math.log10(2), 3)
    }
  })

  it('put 3.847 dB between QPSK and 16-QAM, and 4.352 dB more to 64-QAM', () => {
    expect(ebN0For('qam16', 1e-5) - ebN0For('qpsk', 1e-5)).toBeCloseTo(3.847, 2)
    expect(ebN0For('qam64', 1e-5) - ebN0For('qam16', 1e-5)).toBeCloseTo(4.352, 2)
  })
})

describe('the symbol rate beside the bit rate', () => {
  it('is exactly twice the bit rate for QPSK, because Gray labels the arms', () => {
    for (const db of [4, 10]) {
      expect(serClosed('qpsk', lin(db)) / berClosed('qpsk', lin(db))).toBeCloseTo(2, 3)
    }
  })

  it('reads 7.004 per thousand for 16-QAM at 10 dB', () => {
    expect(serClosed('qam16', lin(10))).toBeCloseTo(7.004e-3, 6)
  })

  it('makes the ratio to the bit rate 0.9982 for 16-QAM at 10 dB', () => {
    const r = serClosed('qam16', lin(10)) / (4 * berClosed('qam16', lin(10)))
    expect(r).toBeCloseTo(0.9982, 4)
  })

  it('makes that ratio exactly one for QPSK', () => {
    const r = serClosed('qpsk', lin(10)) / (2 * berClosed('qpsk', lin(10)))
    expect(r).toBeCloseTo(1, 6)
  })
})

describe('the interval, which is the guard', () => {
  it('reads 19.6 % at a hundred errors and 6.2 % at a thousand', () => {
    expect(relativeHalfWidth(100)).toBeCloseTo(0.196, 3)
    expect(relativeHalfWidth(1000)).toBeCloseTo(0.062, 3)
  })

  it('needs 385 errors for a tenth', () => {
    expect(errorsFor(0.1)).toBe(385)
  })

  it('says how many symbols each rate takes for a hundred errors', () => {
    // The plan rounds these to 1272, 41 870 and 523 800.
    expect(symbolsFor('bpsk', 0, 100) / 1271.5).toBeCloseTo(1, 3)
    expect(symbolsFor('bpsk', 6, 100) / 41870).toBeCloseTo(1, 4)
    expect(symbolsFor('bpsk', 8, 100) / 523800).toBeCloseTo(1, 4)
  })
})

describe('the count', () => {
  it('lands inside its own interval of the closed form, for four schemes', () => {
    const cases = [
      { scheme: 'bpsk', ebN0Db: 4, symbols: 200000 },
      { scheme: 'qpsk', ebN0Db: 4, symbols: 100000 },
      { scheme: 'qam16', ebN0Db: 8, symbols: 60000 },
      { scheme: 'fskCoherent', ebN0Db: 6, symbols: 200000 },
    ]
    for (const c of cases) {
      const got = berCount({ ...c, seed: 3 })
      expect(got.errors, `${c.scheme} errors`).toBeGreaterThan(100)
      expect(got.ci[0], `${c.scheme} low`).toBeLessThanOrEqual(got.closed)
      expect(got.ci[1], `${c.scheme} high`).toBeGreaterThanOrEqual(got.closed)
    }
  })

  it('lands inside its interval for noncoherent FSK and for differential BPSK', () => {
    for (const scheme of ['fskNoncoherent', 'dbpsk']) {
      const got = berCount({ scheme, ebN0Db: 6, symbols: 200000, seed: 5 })
      expect(got.errors, scheme).toBeGreaterThan(100)
      expect(got.ci[0], `${scheme} low`).toBeLessThanOrEqual(got.closed)
      expect(got.ci[1], `${scheme} high`).toBeGreaterThanOrEqual(got.closed)
    }
  })

  it('reproduces bit for bit from one seed, and moves with another', () => {
    const a = berCount({ scheme: 'bpsk', ebN0Db: 4, symbols: 20000, seed: 1 })
    const b = berCount({ scheme: 'bpsk', ebN0Db: 4, symbols: 20000, seed: 1 })
    const c = berCount({ scheme: 'bpsk', ebN0Db: 4, symbols: 20000, seed: 2 })
    expect(a.errors).toBe(b.errors)
    expect(a.errors).not.toBe(c.errors)
  })

  it('agrees between two seeds, inside the sum of their intervals', () => {
    const a = berCount({ scheme: 'bpsk', ebN0Db: 4, symbols: 200000, seed: 1 })
    const b = berCount({ scheme: 'bpsk', ebN0Db: 4, symbols: 200000, seed: 2 })
    const half = (a.ci[1] - a.ci[0]) / 2 + (b.ci[1] - b.ci[0]) / 2
    expect(Math.abs(a.value - b.value)).toBeLessThanOrEqual(half)
  })

  it('is drawn hollow when it rests on too few errors', () => {
    const few = berCount({ scheme: 'bpsk', ebN0Db: 8, symbols: 2000, seed: 1 })
    expect(few.errors).toBeLessThan(HOLLOW_BELOW)
    expect(few.hollow).toBe(true)
    // Wilson keeps a width at zero errors, where the obvious interval collapses.
    expect(few.ci[1]).toBeGreaterThan(0)
  })

  it('carries a symbol rate beside the bit rate', () => {
    const got = berCount({ scheme: 'qam16', ebN0Db: 8, symbols: 40000, seed: 1 })
    expect(got.ser.value).toBeGreaterThan(got.value)
    expect(got.ser.n).toBe(40000)
  })
})

describe('the curve the plot draws', () => {
  it('carries the closed form everywhere and a count only where one can be read', () => {
    const c = berCurve({ scheme: 'bpsk', from: 0, to: 12, step: 2, countTo: 4, symbols: 20000 })
    for (const p of c.points) expect(p.closed).toBeGreaterThan(0)
    expect(c.points.filter((p) => p.counted).length).toBe(3)
    expect(c.points.at(-1).counted).toBe(null)
  })
})

describe('the bits a symbol carries', () => {
  it('is what the constellation says, and one for the binary schemes', () => {
    expect(bitsPerSymbol('qam16')).toBe(4)
    expect(bitsPerSymbol('qam64')).toBe(6)
    expect(bitsPerSymbol('fskCoherent')).toBe(1)
    expect(bitsPerSymbol('dbpsk')).toBe(1)
  })
})
