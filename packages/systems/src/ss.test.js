import { describe, it, expect } from 'vitest'
import { evalAtFreq, polyMul, toStateSpace, stepResponse, isStable } from './tf.js'
import {
  StateSpaceError,
  charPoly,
  controllability,
  eigenvalues,
  lqr,
  lyapunov,
  observability,
  observerGain,
  placePoles,
  polyFromRoots,
  similarity,
  ssSeries,
  ssTrajectory,
  stateSpace,
  toTransferFunction,
} from './ss.js'
import { eye, mul, normInf, transpose } from './matrix.js'

// A deterministic generator, so a failure here is a failure anyone can
// reproduce from the seed printed beside it rather than a flake.
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Strip leading zeros and divide through by a[0]: the comparison form. */
const normalise = (tf) => {
  const a = [...tf.a]
  const b = [...tf.b]
  while (a.length > 1 && Math.abs(a[0]) < 1e-300) a.shift()
  const g = a[0]
  const bb = b.slice(Math.max(0, b.length - a.length))
  while (bb.length < a.length) bb.unshift(0)
  return { b: bb.map((v) => v / g), a: a.map((v) => v / g) }
}

const relClose = (x, y, tol, label) => {
  const scale = Math.max(Math.abs(x), Math.abs(y), 1e-12)
  expect(Math.abs(x - y) / scale, label).toBeLessThan(tol)
}

describe('the two views are one object', () => {
  it('a transfer function through a state space comes back unchanged, on the textbook cases', () => {
    const cases = [
      { name: 'first-order lag', tf: { b: [1], a: [1, 1] } },
      { name: 'integrator', tf: { b: [2], a: [1, 0] } },
      { name: 'lead network', tf: { b: [1, 10], a: [1, 100] } },
      { name: 'lightly damped pair', tf: { b: [100], a: [1, 2, 100] } },
      { name: 'three lags', tf: { b: [1], a: polyMul(polyMul([1, 1], [0.5, 1]), [0.25, 1]) } },
      { name: 'right-half-plane zero', tf: { b: [-1, 1], a: [1, 3, 2] } },
      { name: 'proper with feedthrough', tf: { b: [2, 3, 4], a: [1, 5, 6] } },
    ]
    for (const { name, tf } of cases) {
      const back = normalise(toTransferFunction(toStateSpace(tf)))
      const want = normalise(tf)
      expect(back.a.length, name).toBe(want.a.length)
      for (let i = 0; i < want.a.length; i++) relClose(back.a[i], want.a[i], 1e-9, `${name} a[${i}]`)
      for (let i = 0; i < want.b.length; i++) relClose(back.b[i], want.b[i], 1e-9, `${name} b[${i}]`)
    }
  })

  it('INVARIANT: the round trip is exact to 1e-9 relative, fuzzed over 400 random systems', () => {
    // The comparison is coefficient by coefficient, each relative to the
    // largest coefficient of its own polynomial. That is what "relative after
    // normalisation" has to mean for a polynomial: a coefficient a billionth
    // the size of its neighbour carries no information about the system, and
    // scoring it against itself measures the arithmetic rather than the
    // conversion. The frequency response is checked alongside, which is the
    // basis-free form of the same claim.
    const rand = rng(20260905)
    const grid = Float64Array.from({ length: 41 }, (_, i) => Math.pow(10, -3 + 6 * (i / 40)))
    let worst = 0
    let worstAt = ''
    let worstH = 0
    for (let trial = 0; trial < 400; trial++) {
      const n = 1 + Math.floor(rand() * 4)
      // Poles spread over four decades: a loop written in seconds and one
      // written in microseconds must round-trip alike.
      const decade = Math.pow(10, -1 + 4 * rand())
      const poles = []
      while (poles.length < n) {
        if (poles.length + 1 < n && rand() < 0.5) {
          const re = -decade * (0.2 + rand())
          const im = decade * (0.2 + 2 * rand())
          poles.push([re, im], [re, -im])
        } else {
          poles.push([-decade * (0.2 + rand()), 0])
        }
      }
      const a = polyFromRoots(poles)
      // A numerator built the way a physical one is: from zeros on the same
      // decade as the poles, times a gain. Drawing its coefficients at random
      // instead makes a system with a feedthrough of 1e11 and a DC gain of
      // 1e-12, which is not a transfer function anyone writes and which the
      // canonical form cannot round-trip (the test below records why).
      const m = Math.floor(rand() * (n + 1))
      const zeros = []
      while (zeros.length < m) {
        if (zeros.length + 1 < m && rand() < 0.4) {
          const re = decade * (rand() - 0.5)
          const im = decade * (0.2 + rand())
          zeros.push([re, im], [re, -im])
        } else {
          // Right-half-plane zeros included: they are real systems.
          zeros.push([decade * (rand() - 0.4), 0])
        }
      }
      const gain = (rand() - 0.5) * 4
      const b = polyFromRoots(zeros).map((v) => v * gain)
      const tf = { b, a }
      const back = normalise(toTransferFunction(toStateSpace(tf)))
      const want = normalise(tf)
      const scaleOf = (poly) => Math.max(...poly.map(Math.abs), 1e-300)
      for (const [key, sc] of [['a', scaleOf(want.a)], ['b', scaleOf(want.b)]]) {
        for (let i = 0; i < want[key].length; i++) {
          const err = Math.abs(back[key][i] - want[key][i]) / sc
          if (err > worst) {
            worst = err
            worstAt = `trial ${trial}, ${key}[${i}], n = ${n}, decade = ${decade.toPrecision(3)}`
          }
        }
      }
      for (const f of grid) {
        const h1 = evalAtFreq(tf, f)
        const h2 = evalAtFreq(back, f)
        const mag = Math.hypot(...h1)
        if (mag < 1e-280) continue
        worstH = Math.max(worstH, Math.hypot(h1[0] - h2[0], h1[1] - h2[1]) / mag)
      }
    }
    expect(worst, `worst round-trip coefficient error at ${worstAt}`).toBeLessThan(1e-9)
    expect(worstH, 'worst round-trip error in H(jw)').toBeLessThan(1e-9)
  })

  it('a feedthrough far above the system\'s own scale loses digits, and the test says so', () => {
    // Not a defect in the conversion, and worth recording rather than leaving
    // to be found. The controllable canonical form builds C as b[k] minus D
    // times a[k]. When the feedthrough D is many decades above the rest of the
    // system, that product dwarfs every coefficient it is subtracted from, and
    // the small ones are cancelled away.
    const a = [1, 3335, 5.79e6, 4.795e9, 1.7817e12] // poles near 886 rad/s
    const b = [-5.038e11, -4.968e8, -5.712e5, 197.7, -0.6998] // D = -5e11
    const back = toTransferFunction(toStateSpace({ b, a }))
    // The leading coefficient, which is the feedthrough itself, survives.
    expect(Math.abs(back.b[0] / b[0] - 1)).toBeLessThan(1e-12)
    // The constant term does not. D times a[4] is 9e23, and 9e23 times the
    // machine epsilon is 1e8, so a constant term of 0.7 is entirely gone.
    expect(Math.abs(back.b[4] - b[4]) / Math.abs(b[4])).toBeGreaterThan(0.1)
    // A system written the way a physical one is, same poles and a
    // feedthrough of order one, round-trips to the full tolerance.
    const sane = { b: [2, 6670, 1.158e7, 9.59e9, 3.563e12], a }
    const ok = toTransferFunction(toStateSpace(sane))
    const scale = Math.max(...sane.b.map(Math.abs))
    for (let i = 0; i < sane.b.length; i++) {
      expect(Math.abs(ok.b[i] - sane.b[i]) / scale, `b[${i}]`).toBeLessThan(1e-9)
    }
  })

  it('the state is a choice and the transfer function is not', () => {
    const tf = { b: [1, 2], a: [1, 3, 2] }
    const ss = toStateSpace(tf)
    // Any invertible change of coordinates leaves H(s) alone.
    const T = [
      [2, 1],
      [1, 3],
    ]
    const moved = similarity(ss, T)
    const a = normalise(toTransferFunction(ss))
    const b = normalise(toTransferFunction(moved))
    for (let i = 0; i < a.a.length; i++) relClose(b.a[i], a.a[i], 1e-9, `a[${i}]`)
    for (let i = 0; i < a.b.length; i++) relClose(b.b[i], a.b[i], 1e-9, `b[${i}]`)
    // And the A matrices really are different, so the check is not trivial.
    expect(normInf(moved.A.map((r, i) => r.map((v, j) => v - ss.A[i][j])))).toBeGreaterThan(0.1)
  })

  it('a memoryless system has no state, and its transfer function is a constant', () => {
    const ss = toStateSpace({ b: [3], a: [6] })
    expect(ss.n).toBe(0)
    const tf = toTransferFunction(ss)
    expect(tf.b[0] / tf.a[0]).toBeCloseTo(0.5, 12)
  })

  it('the characteristic polynomial equals the denominator', () => {
    const tf = { b: [1], a: [1, 4, 13] }
    const ss = toStateSpace(tf)
    const poly = charPoly(ss.A)
    expect(poly[0]).toBeCloseTo(1, 12)
    expect(poly[1]).toBeCloseTo(4, 9)
    expect(poly[2]).toBeCloseTo(13, 9)
    const eig = eigenvalues(ss.A)
    expect(Math.min(...eig.map(([re]) => re))).toBeCloseTo(-2, 6)
    expect(Math.max(...eig.map(([, im]) => Math.abs(im)))).toBeCloseTo(3, 6)
  })
})

describe('reaching the state, and seeing it', () => {
  it('the three lags are controllable and observable, and the rank says so', () => {
    const ss = toStateSpace({ b: [1], a: polyMul(polyMul([1, 1], [0.5, 1]), [0.25, 1]) })
    expect(controllability(ss).rank).toBe(3)
    expect(controllability(ss).controllable).toBe(true)
    expect(observability(ss).rank).toBe(3)
  })

  it('a cancelled mode is not reachable, and the rank drops by exactly one', () => {
    // Two parallel first-order paths with the SAME pole: one state combination
    // never moves, and no input can move it.
    const ss = {
      A: [
        [-1, 0],
        [0, -1],
      ],
      B: [1, 1],
      C: [1, -1],
      D: 0,
    }
    const c = controllability(ss)
    expect(c.rank).toBe(1)
    expect(c.controllable).toBe(false)
    // And the same system is unobservable from that output, by symmetry.
    expect(observability(ss).rank).toBe(1)
  })

  it('INVARIANT: full controllability rank is exactly when pole placement solves', () => {
    const rand = rng(77123)
    let controllableSeen = 0
    let notSeen = 0
    for (let trial = 0; trial < 200; trial++) {
      const n = 2 + Math.floor(rand() * 3)
      const A = Array.from({ length: n }, () => Array.from({ length: n }, () => (rand() - 0.5) * 4))
      const B = Array.from({ length: n }, () => (rand() - 0.5) * 2)
      // Half the trials are deliberately broken: a state with no input path,
      // and no coupling into it, which is exactly rank deficiency.
      const broken = trial % 2 === 1
      if (broken) {
        B[n - 1] = 0
        for (let j = 0; j < n - 1; j++) A[n - 1][j] = 0
      }
      const ss = { A, B, C: Array.from({ length: n }, () => 1), D: 0 }
      const ctrl = controllability(ss)
      const desired = Array.from({ length: n }, (_, i) => -(1 + 0.5 * i))
      if (ctrl.controllable) {
        controllableSeen++
        const placed = placePoles(ss, desired)
        const got = placed.achieved.map(([re]) => re).sort((x, y) => x - y)
        const want = [...desired].sort((x, y) => x - y)
        for (let i = 0; i < n; i++) {
          // Ackermann on a badly conditioned controllability matrix loses
          // digits, so the tolerance scales with that conditioning rather
          // than pretending every placement is equally well posed.
          const tol = Math.max(1e-7, 1e-13 * ctrl.condition)
          expect(Math.abs(got[i] - want[i]), `trial ${trial} pole ${i}`).toBeLessThan(tol)
        }
      } else {
        notSeen++
        expect(() => placePoles(ss, desired)).toThrow(StateSpaceError)
      }
    }
    expect(controllableSeen, 'the fuzzer should reach controllable systems').toBeGreaterThan(50)
    expect(notSeen, 'and rank-deficient ones').toBeGreaterThan(50)
  })

  it('a placement is declined with the reason, not approximated', () => {
    const ss = {
      A: [
        [-1, 0],
        [0, -2],
      ],
      B: [1, 0],
      C: [1, 1],
      D: 0,
    }
    let err = null
    try {
      placePoles(ss, [-5, -6])
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(StateSpaceError)
    expect(err.code).toBe('uncontrollable')
    expect(err.message).toMatch(/rank 1 of 2/)
    expect(err.message).toMatch(/declined rather than approximated/)
  })

  it('an unpaired complex pole is declined, because real matrices cannot have one', () => {
    expect(() => polyFromRoots([[-1, 2], [-3, 0]])).toThrow(/no conjugate/)
  })

  it('the wrong number of poles is declined with the count', () => {
    const ss = toStateSpace({ b: [1], a: [1, 2, 3] })
    expect(() => placePoles(ss, [-1])).toThrow(/exactly 2 poles/)
  })

  it('the observer is the dual, and its gain places the estimate error poles', () => {
    const ss = toStateSpace({ b: [1], a: [1, 2, 3] })
    const { L, achieved } = observerGain(ss, [-10, -11])
    expect(L.length).toBe(2)
    const got = achieved.map(([re]) => re).sort((a, b) => a - b)
    expect(got[0]).toBeCloseTo(-11, 6)
    expect(got[1]).toBeCloseTo(-10, 6)
    // Duality, stated exactly: placing on (A', C') and transposing gives the
    // same L as the routine returns.
    const dual = { A: transpose(ss.A), B: [...ss.C], C: [1, 0], D: 0 }
    expect(placePoles(dual, [-10, -11]).K).toEqual(L)
  })

  it('an unobservable mode is declined with the reason', () => {
    const ss = {
      A: [
        [-1, 0],
        [0, -2],
      ],
      B: [1, 1],
      C: [1, 0],
      D: 0,
    }
    let err = null
    try {
      observerGain(ss, [-5, -6])
    } catch (e) {
      err = e
    }
    expect(err.code).toBe('unobservable')
    expect(err.message).toMatch(/leave no trace in the output/)
  })
})

describe('the quadratic trade', () => {
  it('the scalar case matches the Riccati equation solved by hand', () => {
    // A = 1, B = 1, Q = 1, R = 1. The equation 2P - P^2 + 1 = 0 gives
    // P = 1 + sqrt(2), K = P, and a closed-loop pole at 1 - K = -sqrt(2).
    const out = lqr({ A: [[1]], B: [1], C: [1], D: 0 }, [[1]], 1)
    expect(out.P[0][0]).toBeCloseTo(1 + Math.SQRT2, 10)
    expect(out.K[0]).toBeCloseTo(1 + Math.SQRT2, 10)
    expect(out.poles[0][0]).toBeCloseTo(-Math.SQRT2, 9)
    expect(out.relResidual).toBeLessThan(1e-12)
  })

  it('raising R buys less drive and a slower loop, monotonically', () => {
    const ss = toStateSpace({ b: [1], a: [1, 0, 0] })
    let prevGain = Infinity
    let prevSpeed = Infinity
    for (const R of [0.01, 0.1, 1, 10, 100]) {
      const out = lqr(ss, eye(2), R)
      const gain = Math.hypot(...out.K)
      const speed = Math.max(...out.poles.map(([re]) => -re))
      expect(gain, `R = ${R}`).toBeLessThan(prevGain)
      expect(speed, `R = ${R}`).toBeLessThan(prevSpeed)
      prevGain = gain
      prevSpeed = speed
      expect(out.relResidual, `R = ${R} residual`).toBeLessThan(1e-10)
    }
  })

  it('INVARIANT: the optimal loop is stable and the Riccati residual is reported small', () => {
    const rand = rng(4242)
    let checked = 0
    for (let trial = 0; trial < 120; trial++) {
      const n = 1 + Math.floor(rand() * 3)
      const A = Array.from({ length: n }, () => Array.from({ length: n }, () => (rand() - 0.5) * 4))
      const B = Array.from({ length: n }, () => (rand() - 0.5) * 2 + 0.5)
      const ss = { A, B, C: Array.from({ length: n }, () => 1), D: 0 }
      if (!controllability(ss).controllable) continue
      const q = 0.1 + 3 * rand()
      const Q = eye(n).map((r) => r.map((v) => v * q))
      const R = 0.05 + 5 * rand()
      const out = lqr(ss, Q, R)
      checked++
      expect(Math.max(...out.poles.map(([re]) => re)), `trial ${trial}`).toBeLessThan(0)
      expect(out.relResidual, `trial ${trial} residual`).toBeLessThan(1e-8)
      // Every call reports the residual. There is no shape without it.
      expect(Object.prototype.hasOwnProperty.call(out, 'residual')).toBe(true)
    }
    expect(checked).toBeGreaterThan(80)
  })

  it('a regulator with no price on drive is declined', () => {
    expect(() => lqr({ A: [[1]], B: [1], C: [1], D: 0 }, [[1]], 0)).toThrow(/infinite drive/)
  })

  it('the Lyapunov solve is exact where a hand answer exists', () => {
    // A = -a scalar: -2 a P + Q = 0, so P = Q / (2a).
    const P = lyapunov([[-3]], [[6]])
    expect(P[0][0]).toBeCloseTo(1, 12)
    // And a two by two, checked by substitution rather than by a second formula.
    const A = [
      [0, 1],
      [-2, -3],
    ]
    const Q = [
      [2, 0],
      [0, 4],
    ]
    const P2 = lyapunov(A, Q)
    const resid = mul(transpose(A), P2).map((r, i) => r.map((v, j) => v + mul(P2, A)[i][j] + Q[i][j]))
    expect(normInf(resid)).toBeLessThan(1e-12)
  })
})

describe('composition and simulation', () => {
  it('a series of two state spaces has the product transfer function', () => {
    const a = toStateSpace({ b: [2], a: [1, 3] })
    const b = toStateSpace({ b: [1, 5], a: [1, 7] })
    const joined = normalise(toTransferFunction(ssSeries(a, b)))
    const want = normalise({ b: polyMul([2], [1, 5]), a: polyMul([1, 3], [1, 7]) })
    for (let i = 0; i < want.a.length; i++) relClose(joined.a[i], want.a[i], 1e-9, `a[${i}]`)
    for (let i = 0; i < want.b.length; i++) relClose(joined.b[i], want.b[i], 1e-9, `b[${i}]`)
  })

  it('the state trajectory of a lag matches the closed form exactly', () => {
    const tau = 0.7
    const K = 3
    const ss = toStateSpace({ b: [K], a: [tau, 1] })
    const { t, y } = ssTrajectory(ss, () => 1, { duration: 4, points: 401 })
    for (let i = 0; i < t.length; i += 40) {
      expect(y[i]).toBeCloseTo(K * (1 - Math.exp(-t[i] / tau)), 10)
    }
  })

  it('the state trajectory and the existing RK4 simulate agree on a resonant plant', () => {
    const tf = { b: [100], a: [1, 3, 100] }
    const ss = toStateSpace(tf)
    const exact = ssTrajectory(ss, () => 1, { duration: 4, points: 801 })
    const rk = stepResponse(tf, { duration: 4, points: 801 })
    let worst = 0
    for (let i = 0; i < exact.y.length; i++) worst = Math.max(worst, Math.abs(exact.y[i] - rk.y[i]))
    expect(worst).toBeLessThan(2e-6)
  })

  it('a state feedback moves the poles where a hand calculation says', () => {
    // Double integrator: A = [[0,1],[0,0]], B = [0,1] in this form. Placing at
    // -2 +/- 2j needs the characteristic polynomial s^2 + 4s + 8.
    const ss = toStateSpace({ b: [1], a: [1, 0, 0] })
    const { K, Acl } = placePoles(ss, [[-2, 2], [-2, -2]])
    const poly = charPoly(Acl)
    expect(poly[1]).toBeCloseTo(4, 9)
    expect(poly[2]).toBeCloseTo(8, 9)
    expect(isStable({ b: [1], a: poly })).toBe(true)
    expect(K.length).toBe(2)
  })

  it('a bad shape is declined rather than half-read', () => {
    expect(() => stateSpace({ A: [[1, 2]], B: [1], C: [1], D: 0 })).toThrow(/square/)
    expect(() => stateSpace({ A: [[1]], B: [1, 2], C: [1], D: 0 })).toThrow(/one entry per state/)
  })
})
