import { describe, it, expect } from 'vitest'
import { expm, propagator, expm2Closed, cosSinhc, damping } from './expm.js'
import { eye, matMul, matAdd, matScale, norm1 } from './linalg.js'

// A deterministic generator so a failure reproduces.
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const maxAbs = (M) => Math.max(...M.flat().map(Math.abs))
const diff = (P, Q) => maxAbs(matAdd(P, Q, -1))

// State matrices in each damping class, at converter-like scales.
function overdamped(r) {
  const a = -(1 + 9 * r()) * 1e3
  const d = -(1 + 9 * r()) * 1e4
  return [
    [a, (r() - 0.5) * 1e3],
    [(r() - 0.5) * 1e3, d],
  ]
}
function underdamped(r) {
  const w = (1 + 99 * r()) * 1e3
  const s = -(r() * 1e3)
  return [
    [s, -w],
    [w * (0.5 + r()), s],
  ]
}
function critical(r) {
  // s·I plus a nilpotent part: Δ = 0 exactly.
  const s = -(r() * 1e4)
  const n = (r() - 0.5) * 1e4
  return [
    [s, n],
    [0, s],
  ]
}

describe('e^{At}: series with scaling/squaring against the two-state closed form', () => {
  const r = rng(7)
  const cases = []
  for (let i = 0; i < 40; i++) cases.push(['overdamped', overdamped(r)], ['underdamped', underdamped(r)], ['critical', critical(r)])

  it.each(cases)('%s', (kind, A) => {
    for (const t of [0, 1e-7, 2e-6, 3e-5, 1e-3]) {
      const series = propagator(A, t).phi0
      const closed = expm2Closed(A, t)
      const scale = Math.max(1, maxAbs(closed))
      expect(diff(series, closed) / scale).toBeLessThan(1e-12)
    }
    expect(damping(A).kind).toBe(kind)
  })

  it('one state: plain exp', () => {
    expect(expm2Closed([[-2500]], 1e-3)[0][0]).toBeCloseTo(Math.exp(-2.5), 15)
    expect(propagator([[-2500]], 1e-3).phi0[0][0]).toBeCloseTo(Math.exp(-2.5), 13)
  })
})

describe('φ1 and φ2 satisfy their defining identities without any inverse', () => {
  // A·φ1 = φ0 − I  and  A·φ2 = φ1 − tI, exactly.
  const r = rng(11)
  const cases = Array.from({ length: 30 }, (_, i) => (i % 3 === 0 ? overdamped(r) : i % 3 === 1 ? underdamped(r) : critical(r)))

  it.each(cases.map((A, i) => [i, A]))('case %i', (_, A) => {
    const t = 7e-6
    const { phi0, phi1, phi2 } = propagator(A, t)
    const I = eye(2)
    const lhs1 = matMul(A, phi1)
    const rhs1 = matAdd(phi0, I, -1)
    expect(diff(lhs1, rhs1)).toBeLessThan(1e-12 * Math.max(1, maxAbs(rhs1), norm1(A) * t))
    const lhs2 = matMul(A, phi2)
    const rhs2 = matAdd(phi1, matScale(I, t), -1)
    expect(diff(lhs2, rhs2)).toBeLessThan(1e-12 * Math.max(t, maxAbs(rhs2)))
  })

  it('at t = 0 the propagator is the identity and the integrals vanish', () => {
    const { phi0, phi1, phi2 } = propagator(underdamped(rng(3)), 0)
    expect(diff(phi0, eye(2))).toBe(0)
    expect(maxAbs(phi1)).toBe(0)
    expect(maxAbs(phi2)).toBe(0)
  })

  it('a singular A (dead segment, integrator) is no trouble', () => {
    const A = [
      [0, 0],
      [0, -2000],
    ]
    const { phi0, phi1, phi2 } = propagator(A, 5e-6)
    expect(phi0[0][0]).toBe(1)
    expect(phi1[0][0]).toBeCloseTo(5e-6, 20)
    expect(phi2[0][0]).toBeCloseTo(0.5 * 25e-12, 26)
    expect(phi0[1][1]).toBeCloseTo(Math.exp(-0.01), 15)
    const e11 = (1 - Math.exp(-0.01)) / 2000
    expect(Math.abs(phi1[1][1] - e11) / e11).toBeLessThan(1e-13)
  })

  it('a lossless LC (pure rotation) stays on the unit circle', () => {
    const w = 2 * Math.PI * 1591.5
    const A = [
      [0, -w],
      [w, 0],
    ]
    const { phi0 } = propagator(A, 1e-4)
    const det = phi0[0][0] * phi0[1][1] - phi0[0][1] * phi0[1][0]
    expect(det).toBeCloseTo(1, 13)
  })
})

describe('cosSinhc across the series/closed-form seam', () => {
  it('matches cosh/sinh, cos/sin and 1/t on both sides of the switch', () => {
    for (const delta of [1e6, -1e6, 4e5, -4e5]) {
      for (const t of [1e-4, 3.16e-3, 3.2e-3, 0.02]) {
        const { c, sigma } = cosSinhc(delta, t)
        const rt = Math.sqrt(Math.abs(delta)) * t
        const ec = delta > 0 ? Math.cosh(rt) : Math.cos(rt)
        const es = delta > 0 ? Math.sinh(rt) / Math.sqrt(delta) : Math.sin(rt) / Math.sqrt(-delta)
        expect(c).toBeCloseTo(ec, 12)
        expect(Math.abs(sigma - es) / Math.max(t, Math.abs(es))).toBeLessThan(1e-12)
      }
    }
    expect(cosSinhc(0, 0.3)).toEqual({ c: 1, sigma: 0.3 })
  })
})

describe('expm on larger matrices', () => {
  it('nilpotent: the series terminates and the answer is exact', () => {
    const N = [
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 0],
    ]
    const E = expm(N)
    expect(E[0][2]).toBeCloseTo(0.5, 15)
    expect(E[0][1]).toBe(1)
  })
  it('a large norm is scaled down and squared back without losing digits', () => {
    const A = [[-1e6]]
    expect(expm(A)[0][0]).toBeCloseTo(0, 20)
    expect(expm([[-20]])[0][0]).toBeCloseTo(Math.exp(-20), 20)
    expect(expm([[20]])[0][0] / Math.exp(20)).toBeCloseTo(1, 12)
  })
})
