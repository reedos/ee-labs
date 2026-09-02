import { describe, it, expect } from 'vitest'
import { expm as expmNetwork } from '@ee-labs/network'
import { propagator } from './propagator.js'
import { eye, matMul, matAdd, matScale, norm1 } from './linalg.js'

// Two matrix exponentials once lived in the monorepo: the network package's
// Padé-13 with balancing, and this package's Taylor series with scaling and
// squaring. The propagator now uses the first; the second is retired to this
// file as the oracle, and the two must still agree — on every damping class,
// and on the augmented matrices the propagator actually builds, where the
// exponential carries φ1 and φ2 alongside e^{At}.

// The retired routine: scale until ‖M‖ ≤ 1/4, sixteen Taylor terms by
// Horner (truncation ~1e-25), square back up.
function expmSwitched(M) {
  const n = M.length
  const nrm = norm1(M)
  const s = nrm > 0.25 ? Math.ceil(Math.log2(nrm / 0.25)) : 0
  const X = matScale(M, 1 / 2 ** s)
  let E = eye(n)
  for (let k = 16; k >= 1; k--) E = matAdd(eye(n), matMul(X, E), 1 / k)
  for (let i = 0; i < s; i++) E = matMul(E, E)
  return E
}

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const maxAbs = (M) => Math.max(...M.flat().map(Math.abs))
const diff = (P, Q) => maxAbs(matAdd(P, Q, -1))

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
  const s = -(r() * 1e4)
  const n = (r() - 0.5) * 1e4
  return [
    [s, n],
    [0, s],
  ]
}
// A converter's own state matrix: L, C, R, ESR, series loss at knob scales.
function converterLike(r) {
  const L = 4.7e-6 * (2.2e-3 / 4.7e-6) ** r()
  const C = 1e-6 * (2.2e-3 / 1e-6) ** r()
  const R = 0.5 * 2000 ** r()
  const rs = r() < 0.5 ? 0 : 0.5 * r()
  const esr = r() < 0.5 ? 0 : r()
  const k = R / (R + esr)
  return [
    [-(rs + esr * k) / L, -k / L],
    [k / C, -1 / ((R + esr) * C)],
  ]
}

// The augmented matrices the propagator exponentiates: [[A, I, 0], [0, 0, I], [0, 0, 0]]·t.
function augmented(A, t) {
  const n = A.length
  const M = Array.from({ length: 3 * n }, () => new Array(3 * n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) M[i][j] = A[i][j] * t
    M[i][n + i] = t
    M[n + i][2 * n + i] = t
  }
  return M
}

// Both are exact to rounding below ‖M‖ ≈ 10; above it each halving of the
// argument costs a squaring on the way back, and the last bits go with it —
// so the bar rises with the norm, and holds both to the closed form as well
// as to each other (measured: ≤ 5e-14 at ‖M‖ ≈ 140 for either).
const tol = (M) => 1e-14 * Math.max(1, norm1(M) / 10)

describe('the exponential in use agrees with the retired one on 500 seeded matrices', () => {
  const r = rng(2026)
  const gens = [overdamped, underdamped, critical, converterLike]
  const cases = []
  for (let i = 0; i < 500; i++) {
    const A = gens[i % gens.length](r)
    const t = [1e-7, 2e-6, 3e-5, 1e-3][(i >> 2) % 4]
    cases.push([gens[i % gens.length].name, i, A, t])
  }

  it.each(cases)('%s #%i: e^{At} and the augmented exponential', (_, __, A, t) => {
    const At = A.map((row) => row.map((v) => v * t))
    const p = expmNetwork(At)
    const s = expmSwitched(At)
    expect(diff(p, s) / Math.max(1, maxAbs(p))).toBeLessThan(tol(At))
    const M = augmented(A, t)
    const P = expmNetwork(M)
    const S = expmSwitched(M)
    expect(diff(P, S) / Math.max(1, maxAbs(P))).toBeLessThan(tol(M))
    // And the propagator's blocks are the augmented exponential's.
    const { phi0, phi1, phi2 } = propagator(A, t)
    const n = A.length
    const block = (E, c) => E.slice(0, n).map((row) => row.slice(c * n, (c + 1) * n))
    expect(diff(block(P, 0), phi0) / Math.max(1, maxAbs(phi0))).toBeLessThan(tol(M))
    expect(diff(block(P, 1), phi1) / Math.max(t, maxAbs(phi1))).toBeLessThan(tol(M))
    expect(diff(block(P, 2), phi2) / Math.max(t * t, maxAbs(phi2))).toBeLessThan(tol(M))
  })

  it('the dead segment: a pinned inductor and a discharging capacitor', () => {
    const A = [
      [0, 0],
      [0, -2000],
    ]
    for (const t of [0, 1e-6, 5e-5, 2e-3]) {
      expect(diff(expmNetwork(augmented(A, t)), expmSwitched(augmented(A, t)))).toBeLessThan(1e-14)
    }
  })
})
