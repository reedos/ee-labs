import { describe, expect, it } from 'vitest'
import { simulate } from '@ee-labs/systems'
import { transferOf } from '../../../apps/circuit-lab/src/circuits.js'
import {
  NetworkError,
  allBreaks,
  charPoly,
  crossings,
  dynamics,
  energies,
  expm,
  expm2,
  extrema,
  initialConditions,
  matVecMul,
  settleTime,
  solveDC,
  sourceAffine,
  sourceValue,
  transient,
} from '../index.js'

const close = (a, b, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(a), Math.abs(b)))
const closeAbs = (a, b, tol) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)

// Series RC charged through a switch closing at t = 0.
const rc = ({ V = 12, R = 1000, C = 1e-6, v0, before = false } = {}) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: V },
    { type: 'SW', id: 'S1', nodes: ['in', 'a'], closed: true, before },
    { type: 'R', id: 'R1', nodes: ['a', 'out'], value: R },
    { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: C, ...(v0 === undefined ? {} : { x0: v0 }) },
  ],
})

// Series RL, step from 0 to V at t = 0.
const rl = ({ V = 12, R = 1000, L = 0.1 } = {}) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: V, wave: { kind: 'step', from: 0, to: V } },
    { type: 'R', id: 'R1', nodes: ['in', 'a'], value: R },
    { type: 'L', id: 'L1', nodes: ['a', 'gnd'], value: L },
  ],
})

// Series RLC, step input, output across C. States follow netlist order, so
// C is listed first: x = [v_C, i_L].
const rlc = ({ V = 1, R = 200, L = 10e-3, C = 1e-6, wave = { kind: 'step', from: 0, to: 1 } } = {}) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: V, wave },
    { type: 'R', id: 'R1', nodes: ['in', 'a'], value: R },
    { type: 'C', id: 'C1', nodes: ['b', 'gnd'], value: C },
    { type: 'L', id: 'L1', nodes: ['a', 'b'], value: L },
  ],
})

// Parallel RLC driven by a current step.
const tank = ({ I = 1e-3, R = 10000, L = 10e-3, C = 1e-6 } = {}) => ({
  elements: [
    { type: 'I', id: 'I1', nodes: ['gnd', 'a'], value: I, wave: { kind: 'step', from: 0, to: I } },
    { type: 'R', id: 'R1', nodes: ['a', 'gnd'], value: R },
    { type: 'C', id: 'C1', nodes: ['a', 'gnd'], value: C },
    { type: 'L', id: 'L1', nodes: ['a', 'gnd'], value: L },
  ],
})

describe('expm', () => {
  it('is the scalar exponential for n = 1', () => {
    close(expm([[-2.5]])[0][0], Math.exp(-2.5))
  })
  it('agrees with the closed-form 2×2 in all three damping cases', () => {
    const cases = [
      [[0, 1], [-1e8, -4000]], // under: α = 2000 < ω₀ = 1e4
      [[0, 1], [-1e8, -40000]], // over: α = 2e4 > ω₀ = 1e4
      [[0, 1], [-1e8, -20000]], // critical: α = ω₀
      [[0, 1], [-1e8, 0]], // undamped: pure rotation
      [[-3, 1], [2, -4]],
    ]
    for (const A of cases)
      for (const t of [1e-5, 1e-4, 3e-4]) {
        const E = expm(A.map((r) => r.map((v) => v * t)))
        const F = expm2(A, t)
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) closeAbs(E[i][j], F[i][j], 1e-9 * Math.max(1, Math.abs(F[i][j])))
      }
  })
  it('the undamped rotation keeps its determinant exactly 1', () => {
    const E = expm([
      [0, 1e-3],
      [-1e5, 0],
    ])
    close(E[0][0] * E[1][1] - E[0][1] * E[1][0], 1)
  })
  it('handles a singular augmented matrix (a ramp integrated by a pure integrator)', () => {
    // dx/dt = 0·x + 1·(U0 + U1 τ): x(t) = x0 + U0 t + U1 t²/2.
    const M = [
      [0, 2, 3],
      [0, 0, 0],
      [0, 1, 0],
    ]
    const z = matVecMul(expm(M.map((r) => r.map((v) => v * 0.5))), [1, 1, 0])
    close(z[0], 1 + 2 * 0.5 + (3 * 0.25) / 2)
    close(z[1], 1)
    close(z[2], 0.5)
  })
  it('charPoly of the series RLC A is s² + (R/L)s + 1/LC', () => {
    const { A } = dynamics(rlc({ R: 50 }))
    const c = charPoly(A)
    close(c[0], 1)
    close(c[1], 50 / 10e-3)
    close(c[2], 1 / (10e-3 * 1e-6))
  })
})

describe('waves', () => {
  const sq = { type: 'V', id: 'V', value: 0, wave: { kind: 'square', amp: 1, offset: 0.5, period: 1e-3, duty: 0.5 } }
  const tri = { type: 'V', id: 'V', value: 0, wave: { kind: 'triangle', amp: 2, offset: 0, period: 4 } }
  it('square: high for the first half of each period, low after', () => {
    close(sourceValue(sq, 0), 1.5)
    close(sourceValue(sq, 0.25e-3), 1.5)
    close(sourceValue(sq, 0.5e-3), -0.5)
    close(sourceValue(sq, 1e-3), 1.5)
    close(sourceValue(sq, 0.5e-3 * (1 - 1e-14)), -0.5)
  })
  it('triangle: rising from the offset, peaks at T/4 and 3T/4, slope 4A/T', () => {
    close(sourceValue(tri, 0), 0)
    close(sourceValue(tri, 1), 2)
    close(sourceValue(tri, 2), 0)
    close(sourceValue(tri, 3), -2)
    close(sourceValue(tri, 4), 0)
    close(sourceAffine(tri, 0.5).slope, 2)
    close(sourceAffine(tri, 1.5).slope, -2)
    close(sourceAffine(tri, 3.5).slope, 2)
  })
  it('breakpoints are every edge in (0, tEnd) plus the ends', () => {
    expect(allBreaks([sq], 2.2e-3).map((t) => Math.round(t * 1e7) / 1e7)).toEqual([0, 0.0005, 0.001, 0.0015, 0.002, 0.0022])
    // A triangle has no corner at T/2 — it passes through the offset without changing slope.
    expect(allBreaks([tri], 5)).toEqual([0, 1, 3, 4, 5])
  })
})

describe('dynamics: state space by substitution', () => {
  it('series RC: A = −1/RC, B = 1/RC', () => {
    const d = dynamics(rc())
    expect(d.states.map((s) => s.id)).toEqual(['C1'])
    expect(d.inputs).toEqual(['V1'])
    close(d.A[0][0], -1 / 1e-3)
    close(d.B[0][0], 1 / 1e-3)
  })
  it('series RL: A = −R/L, B = 1/L', () => {
    const d = dynamics(rl())
    close(d.A[0][0], -1000 / 0.1)
    close(d.B[0][0], 1 / 0.1)
  })
  it('series RLC: the textbook companion matrix in (v_C, i_L)', () => {
    const { A, B } = dynamics(rlc({ R: 200 }))
    // dv_C/dt = i_L / C ; di_L/dt = (u − R i_L − v_C) / L
    close(A[0][0], 0)
    close(A[0][1], 1 / 1e-6)
    close(A[1][0], -1 / 10e-3)
    close(A[1][1], -200 / 10e-3)
    close(B[0][0], 0)
    close(B[1][0], 1 / 10e-3)
  })
  it('parallel RLC: dv/dt = (u − v/R − i_L)/C, di_L/dt = v/L', () => {
    const { A, B } = dynamics(tank())
    close(A[0][0], -1 / (10000 * 1e-6))
    close(A[0][1], -1 / 1e-6)
    close(A[1][0], 1 / 10e-3)
    close(A[1][1], 0)
    close(B[0][0], 1 / 1e-6)
    close(B[1][0], 0)
  })
  it('an ideal source straight across a capacitor is refused as a state loop', () => {
    const net = {
      elements: [
        { type: 'V', id: 'V1', nodes: ['a', 'gnd'], value: 1 },
        { type: 'C', id: 'C1', nodes: ['a', 'gnd'], value: 1e-6 },
      ],
    }
    let err
    try {
      dynamics(net)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(NetworkError)
    expect(err.code).toBe('state-loop')
    expect(err.detail.element).toBe('C1')
  })
  it('an inductor left in an open path is refused as an inductor cutset', () => {
    const net = {
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 12 },
        { type: 'R', id: 'R1', nodes: ['in', 'a'], value: 1000 },
        { type: 'SW', id: 'S1', nodes: ['a', 'b'], closed: false, before: true },
        { type: 'L', id: 'L1', nodes: ['b', 'gnd'], value: 1 },
      ],
    }
    let err
    try {
      dynamics(net)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(NetworkError)
    expect(err.code).toBe('inductor-cutset')
    expect(err.detail.element).toBe('L1')
    // With a finite off-resistance the same circuit has a state equation, τ = L/(R + R_off).
    net.elements[2].roff = 1e5
    const d = dynamics(net)
    close(d.A[0][0], -(1000 + 1e5) / 1)
  })
  it('a zero-ohm resistor is a wire, not a division by zero', () => {
    const { A } = dynamics(rlc({ R: 0 }))
    close(A[1][1], 0)
    close(A[1][0], -1 / 10e-3)
  })
})

describe('initial conditions', () => {
  it('a switch open before t = 0 leaves an uncharged capacitor at 0; a declared x0 is taken as given', () => {
    expect(initialConditions(rc()).x0[0]).toBe(0)
    expect(initialConditions(rc({ v0: 5 })).x0[0]).toBe(5)
  })
  it('a switch closed before t = 0 gives the DC steady state', () => {
    close(initialConditions(rc({ before: true })).x0[0], 12)
  })
  it('an inductor before a step is at the DC current of the pre-step source', () => {
    const net = rl()
    net.elements[0].wave = { kind: 'step', from: 6, to: 12 }
    close(initialConditions(net).x0[0], 6 / 1000)
  })
})

describe('transient: exact RC and RL', () => {
  it('RC charge follows V(1 − e^{−t/τ}) from v₀ at every sample', () => {
    const tr = transient(rc({ v0: 3 }), { tEnd: 5e-3, points: 201 })
    const tau = 1e-3
    for (const s of tr.samples) close(s.x[0], 12 + (3 - 12) * Math.exp(-s.t / tau), 1e-10)
    close(tr.at(tau).x[0], 12 + (3 - 12) / Math.E, 1e-12)
    // The resistor current at the cursor is (V − v_C)/R, from the same solve.
    const a = tr.at(0.4e-3)
    close(a.sol.i.R1, (12 - a.x[0]) / 1000, 1e-12)
    close(a.dxdt[0], a.sol.i.R1 / 1e-6, 1e-12)
  })
  it('RL current rises as (V/R)(1 − e^{−tR/L}) and the inductor voltage falls as V e^{−t/τ}', () => {
    const tr = transient(rl(), { tEnd: 1e-3, points: 101 })
    const tau = 0.1 / 1000
    for (const s of tr.samples) {
      close(s.x[0], (12 / 1000) * (1 - Math.exp(-s.t / tau)), 1e-10)
      close(s.sol.volt.L1, 12 * Math.exp(-s.t / tau), 1e-10)
    }
  })
  it('the state is continuous across the switch: x(0⁺) = x(0⁻), while the resistor current jumps', () => {
    const tr = transient(rc({ v0: 3 }), { tEnd: 1e-3 })
    const before = initialConditions(rc({ v0: 3 }))
    close(tr.at(0).x[0], before.x0[0])
    close(before.sol.i.R1, 0)
    close(tr.at(0).sol.i.R1, (12 - 3) / 1000)
  })
  it('the grid samples every breakpoint from both sides so a jump plots vertical', () => {
    const tr = transient(rlc({ wave: { kind: 'square', amp: 1, offset: 0, period: 2e-3, duty: 0.5 } }), { tEnd: 4e-3, points: 101 })
    const idx = []
    tr.t.forEach((t, k) => Math.abs(t - 1e-3) < 1e-15 && idx.push(k))
    expect(idx.length).toBe(2)
    const [l, r] = idx
    close(tr.samples[l].u[0], 1)
    close(tr.samples[r].u[0], -1)
    // The states themselves do not jump.
    close(tr.samples[l].x[0], tr.samples[r].x[0], 1e-12)
    close(tr.samples[l].x[1], tr.samples[r].x[1], 1e-12)
    // The inductor voltage does, by the full 2 V of the edge (i_L and v_C hold, so v_L = u − R i_L − v_C jumps with u).
    close(tr.samples[l].sol.volt.L1 - tr.samples[r].sol.volt.L1, 2, 1e-9)
  })
  it('t → ∞ is the DC solution of the post-switch circuit', () => {
    for (const net of [rc(), rl(), rlc({ R: 800 }), tank()]) {
      const tr = transient(net, { tEnd: 1, points: 11 })
      const dc = solveDC(net, { sources: Object.fromEntries(tr.inputs.map((id) => [id, tr.at(1).u[tr.inputs.indexOf(id)]])) })
      const end = tr.at(1)
      for (const node of Object.keys(dc.v)) closeAbs(end.sol.v[node], dc.v[node], 1e-9)
    }
  })
  it('a triangle ramp through a small series R: mid-ramp capacitor current is C·dv/dt', () => {
    const net = {
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'triangle', amp: 1, offset: 0, period: 4e-3 } },
        { type: 'R', id: 'R1', nodes: ['in', 'a'], value: 1 },
        { type: 'C', id: 'C1', nodes: ['a', 'gnd'], value: 1e-6 },
      ],
    }
    const tr = transient(net, { tEnd: 4e-3, points: 401 })
    // Slope 4A/T = 1000 V/s; τ = 1 µs ≪ T so i = C·slope to e^{−t/τ}.
    close(tr.at(0.5e-3).sol.i.C1, 1e-6 * 1000, 1e-6)
    close(tr.at(1.5e-3).sol.i.C1, -1e-6 * 1000, 1e-6)
  })
})

describe('transient: series RLC, three damping faces', () => {
  const w0 = 1 / Math.sqrt(10e-3 * 1e-6)
  const step = (R, t) => {
    // Step response across C from rest, by the standard closed forms.
    const alpha = R / (2 * 10e-3)
    if (alpha > w0 * (1 + 1e-12)) {
      const b = Math.sqrt(alpha * alpha - w0 * w0)
      const s1 = -alpha + b
      const s2 = -alpha - b
      return 1 - (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1)
    }
    if (Math.abs(alpha - w0) <= 1e-12 * w0) return 1 - Math.exp(-alpha * t) * (1 + alpha * t)
    const wd = Math.sqrt(w0 * w0 - alpha * alpha)
    return 1 - Math.exp(-alpha * t) * (Math.cos(wd * t) + (alpha / wd) * Math.sin(wd * t))
  }
  it.each([
    ['over', 800],
    ['critical', 200],
    ['under', 50],
    ['undamped', 0],
  ])('%s-damped (R = %d Ω) matches the closed form at every sample', (_, R) => {
    const tr = transient(rlc({ R }), { tEnd: 2e-3, points: 401 })
    for (const s of tr.samples) closeAbs(s.x[0], step(R, s.t), 1e-9)
  })
  it('the roots of det(sI − A) are the exponents of the response', () => {
    const { A } = dynamics(rlc({ R: 800 }))
    const [, c1, c2] = charPoly(A)
    const alpha = c1 / 2
    const b = Math.sqrt(alpha * alpha - c2)
    close(-alpha + b, -(800 / (2 * 10e-3)) + Math.sqrt((800 / (2 * 10e-3)) ** 2 - w0 * w0))
  })
  it('critical damping is the fastest settle with no overshoot; below it the peak is V(1 + e^{−πζ/√(1−ζ²)})', () => {
    const settle = (R) => {
      const tr = transient(rlc({ R }), { tEnd: 8e-3, points: 801 })
      const y = tr.series('x', 0)
      return settleTime(tr.t, y, (t) => tr.at(t).x[0], 1, 0.02)
    }
    const over = [800, 400, 300, 250, 200].map(settle)
    for (let k = 1; k < over.length; k++) expect(over[k]).toBeLessThan(over[k - 1])
    for (const R of [800, 300, 200]) {
      const tr = transient(rlc({ R }), { tEnd: 3e-3, points: 601 })
      expect(Math.max(...tr.series('x', 0))).toBeLessThanOrEqual(1 + 1e-9)
    }
    const tr = transient(rlc({ R: 50 }), { tEnd: 3e-3, points: 601 })
    const peaks = extrema(tr.t, tr.series('x', 0), (t) => tr.at(t).x[0]).filter((p) => p.kind === 'max')
    const zeta = 50 / 200
    close(peaks[0].y, 1 + Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)), 1e-8)
    close(peaks[0].t, Math.PI / (w0 * Math.sqrt(1 - zeta * zeta)), 1e-8)
  })
  it('undamped: the state orbits at ω₀ and the crossings of v_C = 1 are spaced π/ω₀', () => {
    const tr = transient(rlc({ R: 0 }), { tEnd: 2e-3, points: 801 })
    const xs = crossings(tr.t, tr.series('x', 0), (t) => tr.at(t).x[0], 1)
    for (let k = 1; k < xs.length; k++) close(xs[k] - xs[k - 1], Math.PI / w0, 1e-8)
  })
  it('parallel RLC has α = 1/2RC and the same ω₀', () => {
    const { A } = dynamics(tank({ R: 1000 }))
    const [, c1, c2] = charPoly(A)
    close(c1 / 2, 1 / (2 * 1000 * 1e-6))
    close(Math.sqrt(c2), w0)
  })
})

describe('energy', () => {
  it('RC charge from rest: supplied CV², stored ½CV², dissipated ½CV² — whatever R is', () => {
    for (const R of [100, 1000, 10000]) {
      const tr = transient(rc({ R }), { tEnd: 20 * R * 1e-6, points: 401 })
      const en = energies(tr)
      const last = en.points[en.points.length - 1]
      const CV2 = 1e-6 * 144
      close(last.supplied, CV2, 1e-6)
      close(last.stored, CV2 / 2, 1e-6)
      close(last.dissipated, CV2 / 2, 1e-6)
    }
  })
  it('the identity supplied = Δstored + dissipated holds at every sample, for RC, RL, RLC and the tank', () => {
    for (const [net, tEnd] of [
      [rc({ v0: 3 }), 5e-3],
      [rl(), 1e-3],
      [rlc({ R: 50 }), 2e-3],
      [rlc({ R: 0 }), 2e-3],
      [tank(), 2e-3],
      [rlc({ wave: { kind: 'triangle', amp: 1, offset: 0, period: 1e-3 } }), 2e-3],
    ]) {
      const tr = transient(net, { tEnd, points: 401 })
      const en = energies(tr)
      const scale = Math.max(...en.points.map((p) => Math.abs(p.supplied) + Math.abs(p.stored) + Math.abs(p.dissipated)))
      for (const p of en.points) closeAbs(p.gap, 0, 1e-9 * scale)
    }
  })
  it('the undamped LC dissipates nothing and its stored energy is constant once the source is gone', () => {
    // v_C(0) = 1 V, no source in the loop: the energy sloshes but the total holds.
    const net = {
      elements: [
        { type: 'C', id: 'C1', nodes: ['a', 'gnd'], value: 1e-6, x0: 1 },
        { type: 'L', id: 'L1', nodes: ['a', 'gnd'], value: 10e-3, x0: 0 },
      ],
    }
    const tr = transient(net, { tEnd: 2e-3, points: 201 })
    const en = energies(tr)
    for (const p of en.points) {
      close(p.stored, 0.5e-6, 1e-9)
      closeAbs(p.dissipated, 0, 1e-15)
    }
    // And it sloshes: the inductor holds all of it a quarter period in.
    const q = tr.at(Math.PI / 2 / 1e4)
    close(0.5 * 10e-3 * q.x[1] ** 2, 0.5e-6, 1e-8)
  })
})

describe('cross-lab: Circuit Lab’s RK4 sees the same step responses', () => {
  const pin = (net, tf, tEnd, pick, tol) => {
    const tr = transient(net, { tEnd, points: 401 })
    const rk = simulate(tf, () => 1, { duration: tEnd, points: 4001 })
    for (let k = 0; k < rk.t.length; k += 40) closeAbs(pick(tr.at(rk.t[k])), rk.y[k], tol)
  }
  it('RC low-pass', () => {
    const net = rc({ R: 1000, C: 100e-9, before: false })
    pin(net, transferOf('rcLow', { r: 1000, c: 100e-9 }), 1e-3, (a) => a.x[0] / 12, 1e-6)
  })
  it('RL low-pass (output across R)', () => {
    const net = rl({ V: 1, R: 1000, L: 100e-3 })
    pin(net, transferOf('rlLow', { r: 1000, l: 100e-3 }), 1e-3, (a) => a.sol.volt.R1, 1e-6)
  })
  it('series RLC, all three outputs', () => {
    const p = { r: 100, l: 10e-3, c: 100e-9 }
    const net = rlc({ R: 100, L: 10e-3, C: 100e-9 })
    pin(net, transferOf('rlcSeries', p, 'c'), 2e-3, (a) => a.x[0], 1e-5)
    pin(net, transferOf('rlcSeries', p, 'r'), 2e-3, (a) => a.sol.volt.R1, 1e-5)
    pin(net, transferOf('rlcSeries', p, 'l'), 2e-3, (a) => a.sol.volt.L1, 1e-5)
  })
  it('parallel RLC impedance: v across the tank for a 1 A step', () => {
    const net = tank({ I: 1, R: 10000, L: 10e-3, C: 100e-9 })
    pin(net, transferOf('rlcParallel', { r: 10000, l: 10e-3, c: 100e-9 }), 2e-3, (a) => a.x[0], 1e-5 * 1e4)
  })
})
