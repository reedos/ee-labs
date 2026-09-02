// The segment propagator, built on the monorepo's one matrix exponential.
//
// Between switching events a converter is a linear circuit with a constant
// drive, so its state moves exactly by
//
//     x(t) = φ0(t)·x(0) + φ1(t)·B·u,   φ0 = e^{At},  φ1 = ∫₀ᵗ e^{Aτ} dτ
//
// and its running integral (what the averages need) by
//
//     ∫₀ᵗ x = φ1(t)·x(0) + φ2(t)·B·u,  φ2 = ∫₀ᵗ φ1
//
// All three come out of one exponential of the augmented matrix
//
//     M = [[A, I, 0], [0, 0, I], [0, 0, 0]]  →  e^{Mt} = [[φ0, φ1, φ2], [0, I, tI], [0, 0, I]]
//
// which never inverts A (so a lossless LC, a dead segment with a pinned
// inductor current, or a plain integrator are all fine) and never meets the
// cancellation that closed forms suffer near a repeated eigenvalue. The
// exponential itself is @ee-labs/network's Padé-13 with balancing, scaling
// and squaring — the same routine the RLC lessons step with; the two labs
// share one, and oneExpm.test.js is the record of the day they were shown
// to agree.
//
// The two-state closed form the plan writes down — three cases on the
// discriminant, the biquad's over/under/critically damped triplet — is here
// too, as `expm2Closed`. It is the independent oracle the tests hold the
// series against, and the formula the math panel shows.

import { expm } from '@ee-labs/network'
import { zeros } from './linalg.js'

// { phi0, phi1, phi2 } for the state matrix A over a duration t.
export function propagator(A, t) {
  const n = A.length
  const M = zeros(3 * n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) M[i][j] = A[i][j] * t
    M[i][n + i] = t
    M[n + i][2 * n + i] = t
  }
  const E = expm(M)
  const block = (c) => E.slice(0, n).map((row) => row.slice(c * n, (c + 1) * n))
  return { phi0: block(0), phi1: block(1), phi2: block(2) }
}

// { phi0, phi1 } alone, from the 2n augmented matrix [[A, I], [0, 0]] — the
// same construction without the running integral, for the propagation that
// does not need it (state evaluation and sampling, which the event search
// does thousands of times per steady state). Cheaper by the cube of 3/2.
export function propagator01(A, t) {
  const n = A.length
  const M = zeros(2 * n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) M[i][j] = A[i][j] * t
    M[i][n + i] = t
  }
  const E = expm(M)
  const block = (c) => E.slice(0, n).map((row) => row.slice(c * n, (c + 1) * n))
  return { phi0: block(0), phi1: block(1) }
}

// Cosh/cos and sinh/sin over a signed square: with z = Δ·t², c = Σ zᵏ/(2k)!
// and σ = t·Σ zᵏ/(2k+1)!, which is cosh(√Δ t) and sinh(√Δ t)/√Δ for Δ > 0,
// cos and sin/ω for Δ < 0, and 1 and t at Δ = 0 — one formula, no branch
// at the boundary. The series is used near z = 0 where the closed forms lose
// digits to cancellation; the closed forms take over where the series would
// need many terms.
export function cosSinhc(delta, t) {
  const z = delta * t * t
  if (Math.abs(z) < 1e-2) {
    let c = 0
    let sg = 0
    let term = 1
    for (let k = 0; k < 10; k++) {
      c += term / factorial(2 * k)
      sg += term / factorial(2 * k + 1)
      term *= z
    }
    return { c, sigma: t * sg }
  }
  const r = Math.sqrt(Math.abs(delta))
  if (delta > 0) return { c: Math.cosh(r * t), sigma: Math.sinh(r * t) / r }
  return { c: Math.cos(r * t), sigma: Math.sin(r * t) / r }
}

const FACT = [1]
function factorial(n) {
  while (FACT.length <= n) FACT.push(FACT[FACT.length - 1] * FACT.length)
  return FACT[n]
}

// e^{At} for a 1×1 or 2×2 A by the closed form
//     e^{At} = e^{st} ( c(t)·I + σ(t)·(A − sI) ),  s = tr A / 2,  Δ = s² − det A.
export function expm2Closed(A, t) {
  if (A.length === 1) return [[Math.exp(A[0][0] * t)]]
  const [[a, b], [c, d]] = A
  const s = (a + d) / 2
  const delta = s * s - (a * d - b * c)
  const { c: ch, sigma } = cosSinhc(delta, t)
  const e = Math.exp(s * t)
  return [
    [e * (ch + sigma * (a - s)), e * sigma * b],
    [e * sigma * c, e * (ch + sigma * (d - s))],
  ]
}

// The three-case label the math panel prints for a state matrix.
export function damping(A) {
  if (A.length === 1) return { s: A[0][0], delta: 0, kind: 'first-order' }
  const [[a, b], [c, d]] = A
  const s = (a + d) / 2
  const delta = s * s - (a * d - b * c)
  const scale = Math.max(1, s * s, Math.abs(a * d - b * c))
  const kind = Math.abs(delta) < 1e-9 * scale ? 'critical' : delta > 0 ? 'overdamped' : 'underdamped'
  return { s, delta, kind }
}
