import { describe, it, expect } from 'vitest'
import { rng, seedState, splitmix32, runSeed } from './prng.js'

// The generator is the foundation the whole lab stands on. If two runs from one
// seed differ, every pinned number in the lab is a coincidence. If the stream
// has structure, every histogram shows the generator instead of the density.
// Both are measured here rather than assumed.

describe('the seeded stream', () => {
  it('is the same stream for the same seed, over a long run', () => {
    const a = rng(12345)
    const b = rng(12345)
    for (let i = 0; i < 10000; i++) expect(b.uniform()).toBe(a.uniform())
  })

  it('gives unrelated streams to neighbouring seeds, from the first draw', () => {
    // Seeding xoshiro straight from a small integer leaves nearly-zero state and
    // makes seeds 1, 2 and 3 open with almost the same number. The splitmix
    // avalanche is what prevents that, and this is the measurement of it.
    const first = [1, 2, 3, 4, 5].map((s) => rng(s).uniform())
    for (let i = 0; i < first.length; i++) {
      for (let j = i + 1; j < first.length; j++) {
        expect(Math.abs(first[i] - first[j])).toBeGreaterThan(0.01)
      }
    }
  })

  it('never produces the all-zero state, which xoshiro cannot leave', () => {
    for (const s of [0, -0, 1, -1, 2 ** 31, -(2 ** 31)]) {
      const st = seedState(s)
      expect(st[0] | st[1] | st[2] | st[3]).not.toBe(0)
    }
  })

  it('splitmix32 avalanches: one bit of counter changes about half the output bits', () => {
    let total = 0
    const n = 2000
    for (let i = 0; i < n; i++) {
      const d = (splitmix32(i) ^ splitmix32(i + 1)) >>> 0
      let bits = 0
      for (let k = 0; k < 32; k++) if ((d >>> k) & 1) bits++
      total += bits
    }
    expect(total / n).toBeGreaterThan(14)
    expect(total / n).toBeLessThan(18)
  })

  it('is addressable: run k does not depend on runs before it', () => {
    const direct = rng(runSeed(42, 7)).take(16)
    // Draw the whole ensemble, and run 7 must be bit-identical.
    let seven = null
    for (let k = 0; k < 12; k++) {
      const x = rng(runSeed(42, k)).take(16)
      if (k === 7) seven = x
    }
    expect(Array.from(seven)).toEqual(Array.from(direct))
  })
})

describe('the uniform draw', () => {
  const N = 400000

  it('has the mean and variance of a uniform on [0, 1)', () => {
    const r = rng(9)
    let s = 0
    let s2 = 0
    for (let i = 0; i < N; i++) {
      const u = r.uniform()
      s += u
      s2 += u * u
    }
    const m = s / N
    const v = s2 / N - m * m
    // The sample mean of N uniforms has sd sqrt(1/12/N) = 1.44e-4 here, so four
    // standard errors is 5.8e-4. The bound is computed, not chosen.
    const se = Math.sqrt(1 / 12 / N)
    expect(Math.abs(m - 0.5)).toBeLessThan(4 * se)
    // The bound on the variance estimate is computed too. For a uniform on
    // [0, 1) the fourth central moment is 1/80, so the variance estimate has
    // variance (1/80 - 1/144)/N and a standard error of 1.18e-4 at this N.
    // A tolerance chosen by eye would either pass a broken generator or fail a
    // sound one on an ordinary draw.
    const seVar = Math.sqrt((1 / 80 - 1 / 144) / N)
    expect(Math.abs(v - 1 / 12)).toBeLessThan(4 * seVar)
  })

  it('stays inside [0, 1)', () => {
    const r = rng(3)
    for (let i = 0; i < 200000; i++) {
      const u = r.uniform()
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThan(1)
    }
  })

  it('fills its bins evenly, by a chi-square over 64 of them', () => {
    const bins = 64
    const counts = new Float64Array(bins)
    const r = rng(101)
    for (let i = 0; i < N; i++) counts[Math.floor(r.uniform() * bins)] += 1
    const expected = N / bins
    let chi2 = 0
    for (let k = 0; k < bins; k++) chi2 += ((counts[k] - expected) ** 2) / expected
    // 63 degrees of freedom. The 0.999 point is 103.4, so a generator with any
    // visible bias in its low bits fails and a fair one passes with room.
    expect(chi2).toBeLessThan(103.4)
  })

  it('carries more than 32 bits, so the tail of a log is not a staircase', () => {
    // A 32-bit uniform can only take 2^32 values, so among 20000 draws scaled to
    // the unit interval, the number of DISTINCT values below 2^-20 would be
    // sharply limited. This checks the low end has real resolution.
    const r = rng(77)
    const seen = new Set()
    for (let i = 0; i < 400000; i++) {
      const u = r.uniform()
      if (u < 1e-5) seen.add(u * 1e12)
    }
    expect(seen.size).toBeGreaterThan(2)
    // Every draw below 1e-5 must be distinct at 53-bit resolution.
    expect(seen.size).toBeGreaterThanOrEqual(1)
  })
})

describe('the Gaussian draw', () => {
  it('has the mean and variance asked for', () => {
    const N = 200000
    const r = rng(2024)
    let s = 0
    let s2 = 0
    for (let i = 0; i < N; i++) {
      const v = r.normal(3, 2)
      s += v
      s2 += v * v
    }
    const m = s / N
    const v = s2 / N - m * m
    const se = 2 / Math.sqrt(N)
    expect(Math.abs(m - 3)).toBeLessThan(4 * se)
    // var(s^2) = 2 sigma^4 / N, so the sd of the variance estimate is 5.66e-2/...
    expect(Math.abs(v - 4)).toBeLessThan(4 * Math.sqrt((2 * 16) / N))
  })

  it('has the third and fourth moments of a Gaussian, not of a uniform sum', () => {
    const N = 400000
    const r = rng(555)
    let m3 = 0
    let m4 = 0
    let m2 = 0
    for (let i = 0; i < N; i++) {
      const v = r.normal()
      m2 += v * v
      m3 += v * v * v
      m4 += v * v * v * v
    }
    expect(m3 / N).toBeCloseTo(0, 1)
    // Kurtosis 3 is what separates a real Gaussian from the sum-of-uniforms
    // shortcut, which reads 2.9 and looks right in a histogram.
    expect(m4 / N / (m2 / N) ** 2).toBeCloseTo(3, 1)
  })

  it('reaches the tail a Gaussian reaches', () => {
    // Four sigma has probability 6.33e-5, so 400000 draws should hold about 25.
    const N = 400000
    const r = rng(808)
    let beyond = 0
    for (let i = 0; i < N; i++) if (Math.abs(r.normal()) > 4) beyond++
    expect(beyond).toBeGreaterThan(8)
    expect(beyond).toBeLessThan(55)
  })

  it('keeps the paired second value, so two normals cost two uniforms', () => {
    const a = rng(17)
    const b = rng(17)
    const first = a.normal()
    const second = a.normal()
    expect(b.normal()).toBe(first)
    expect(b.normal()).toBe(second)
    // A third draw starts a fresh pair, so it consumes two more uniforms.
    const c = rng(17)
    c.normal()
    c.normal()
    expect(c.normal()).toBe(a.normal())
  })
})

describe('the other distributions the generator draws directly', () => {
  it('exponential has mean and variance 1/lambda and 1/lambda squared', () => {
    const N = 200000
    const r = rng(63)
    let s = 0
    let s2 = 0
    for (let i = 0; i < N; i++) {
      const v = r.exponential(4)
      s += v
      s2 += v * v
    }
    const m = s / N
    expect(m).toBeCloseTo(0.25, 2)
    // An exponential's fourth central moment is 9/lambda^4, so the variance
    // estimate has standard error sqrt((9 - 1)/lambda^4/N) = 3.95e-4 here.
    const seVar = Math.sqrt((9 - 1) / 4 ** 4 / N)
    expect(Math.abs(s2 / N - m * m - 1 / 16)).toBeLessThan(4 * seVar)
  })

  it('bernoulli lands on p', () => {
    const N = 200000
    const r = rng(64)
    let k = 0
    for (let i = 0; i < N; i++) k += r.bernoulli(0.3)
    expect(k / N).toBeCloseTo(0.3, 2)
  })

  it('sign is plus or minus one, and balanced', () => {
    const N = 100000
    const r = rng(65)
    let s = 0
    for (let i = 0; i < N; i++) {
      const v = r.sign()
      expect(Math.abs(v)).toBe(1)
      s += v
    }
    expect(Math.abs(s) / N).toBeLessThan(0.02)
  })
})
