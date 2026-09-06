// Three phases as two, and the rotating field they make.
//
// Two separate ideas live here, and they are the same idea twice.
//
// The rotating field. Three windings 120 electrical degrees apart, carrying
// three currents 120 degrees apart in time, make one magnetomotive force that
// travels. It is not three fields beating. It is one, and the proof is a
// trigonometric identity:
//
//     cos ωt cos θ + cos(ωt − 2π/3) cos(θ − 2π/3) + cos(ωt + 2π/3) cos(θ + 2π/3)
//       = (3/2) cos(ωt − θ)
//
// exactly, at every θ and every t. `rotatingField` states the amplitude and
// the speed, and the test measures the identity to floating point rather than
// quoting it.
//
// The dq transform. Ride the travelling wave and it stops travelling. That is
// a change of coordinates, nothing more, and the matrix below is orthogonal,
// so it is invertible with its own transpose and it loses nothing.
//
// ---------------------------------------------------------- which convention
//
// Two conventions are in use and they differ by a constant. The package's
// default is POWER-INVARIANT:
//
//     K = √(2/3) [ cos θ      cos(θ−2π/3)   cos(θ+2π/3)  ]
//                [ −sin θ    −sin(θ−2π/3)  −sin(θ+2π/3)  ]
//                [ 1/√2       1/√2          1/√2         ]
//
// K Kᵀ = I, so K⁻¹ = Kᵀ and v·i is the same number in either frame. No 3/2
// appears in any power or torque expression.
//
// The AMPLITUDE-INVARIANT convention scales the first two rows by 2/3 and the
// third by 1/3 instead. A balanced set of peak amplitude V maps to v_d² + v_q²
// = V², which is convenient at a scope, and the price is that power carries a
// 3/2: p = (3/2)(v_d i_d + v_q i_q) + 3 v₀ i₀. Both are exact. Every function
// here takes `convention` and every result says which one it used, because a
// torque constant quoted in the wrong convention is wrong by 3/2 and that is
// the commonest error in the subject.

const TAU3 = (2 * Math.PI) / 3

/** The two conventions, and the power law each one obeys. */
export const CONVENTIONS = {
  'power-invariant': {
    k: Math.sqrt(2 / 3),
    k0: 1 / Math.SQRT2,
    orthogonal: true,
    power: 'p = v_d i_d + v_q i_q + v₀ i₀',
    torqueFactor: 1,
  },
  'amplitude-invariant': {
    k: 2 / 3,
    k0: 1 / 2,
    orthogonal: false,
    power: 'p = (3/2)(v_d i_d + v_q i_q) + 3 v₀ i₀',
    torqueFactor: 3 / 2,
  },
}

const conv = (name) => {
  const c = CONVENTIONS[name]
  if (!c) throw new Error(`unknown dq convention "${name}"`)
  return c
}

/** The 3 × 3 matrix that takes abc to dq0 at rotor angle θ, in the named convention. */
export function dqMatrix(theta, convention = 'power-invariant') {
  const c = conv(convention)
  const a = [theta, theta - TAU3, theta + TAU3]
  return [
    a.map((x) => c.k * Math.cos(x)),
    a.map((x) => -c.k * Math.sin(x)),
    // The zero row: 1/√3 power-invariant, 1/3 amplitude-invariant.
    a.map(() => c.k * c.k0),
  ]
}

/** abc → dq0. `abc` is [a, b, c]; the result is [d, q, 0]. */
export function dq0(abc, theta, convention = 'power-invariant') {
  const K = dqMatrix(theta, convention)
  return K.map((row) => row[0] * abc[0] + row[1] * abc[1] + row[2] * abc[2])
}

/** dq0 → abc, the exact inverse of `dq0` at the same θ and convention. */
export function invDq0(dq, theta, convention = 'power-invariant') {
  const c = conv(convention)
  const a = [theta, theta - TAU3, theta + TAU3]
  if (c.orthogonal) {
    const K = dqMatrix(theta, convention)
    return a.map((_, j) => K[0][j] * dq[0] + K[1][j] * dq[1] + K[2][j] * dq[2])
  }
  return a.map((x) => Math.cos(x) * dq[0] - Math.sin(x) * dq[1] + dq[2])
}

/** abc → αβ0, the stationary two-axis frame. The dq transform at θ = 0. */
export const clarke = (abc, convention = 'power-invariant') => dq0(abc, 0, convention)
/** αβ0 → abc. */
export const invClarke = (ab, convention = 'power-invariant') => invDq0(ab, 0, convention)
/** αβ0 → dq0: the rotation alone, with no scaling. */
export function park(ab, theta) {
  return [ab[0] * Math.cos(theta) + ab[1] * Math.sin(theta), -ab[0] * Math.sin(theta) + ab[1] * Math.cos(theta), ab[2]]
}
/** dq0 → αβ0. */
export function invPark(dq, theta) {
  return [dq[0] * Math.cos(theta) - dq[1] * Math.sin(theta), dq[0] * Math.sin(theta) + dq[1] * Math.cos(theta), dq[2]]
}

/**
 * Instantaneous power, both ways round, so the convention's claim is checkable
 * rather than stated. `abc` and `dq` are the same instant in the two frames.
 */
export function power(vAbc, iAbc, theta, convention = 'power-invariant') {
  const c = conv(convention)
  const vd = dq0(vAbc, theta, convention)
  const id = dq0(iAbc, theta, convention)
  const pAbc = vAbc[0] * iAbc[0] + vAbc[1] * iAbc[1] + vAbc[2] * iAbc[2]
  const pDq = c.orthogonal
    ? vd[0] * id[0] + vd[1] * id[1] + vd[2] * id[2]
    : 1.5 * (vd[0] * id[0] + vd[1] * id[1]) + 3 * vd[2] * id[2]
  return { pAbc, pDq, law: c.power, vdq: vd, idq: id }
}

/**
 * The travelling wave three phases make.
 *
 * @param amp   the peak current in one phase, A
 * @param omega the electrical angular frequency, rad/s
 * @param poles the number of poles. The wave travels at 2ω/poles mechanically.
 * @param turns effective turns per phase. The amplitude is (3/2)·turns·amp.
 */
export function rotatingField({ amp = 1, omega = 2 * Math.PI * 50, poles = 4, turns = 1 } = {}) {
  if (!(poles >= 2) || poles % 2) throw new Error('poles: an even number of poles, two or more')
  return {
    amplitude: 1.5 * turns * amp,
    omega,
    poles,
    /** Synchronous speed of the wave, mechanical rad/s. */
    omegaSync: (2 * omega) / poles,
    /** …in rev/min, the number on a nameplate. */
    rpmSync: (120 * (omega / (2 * Math.PI))) / poles,
    turns,
    amp,
  }
}

/**
 * The magnetomotive force at electrical angle θ and time t, summed over the
 * three windings. The test measures this against (3/2)·N·I·cos(ωt − θ).
 */
export function fieldAt(f, theta, t) {
  const i = [0, -TAU3, TAU3].map((ph) => f.amp * Math.cos(f.omega * t + ph))
  const ang = [theta, theta - TAU3, theta + TAU3]
  return f.turns * (i[0] * Math.cos(ang[0]) + i[1] * Math.cos(ang[1]) + i[2] * Math.cos(ang[2]))
}
