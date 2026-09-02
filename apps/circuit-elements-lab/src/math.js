// The math for the experiment on screen.
//
// Same discipline as the rest of the suite: the "theory" column is a closed
// form written by hand in terms of the knobs, and the "measured" column is
// read off the solved circuit. Those are different paths — one is algebra, the
// other is a matrix solve — so a wrong sign, a dropped parallel term or a
// mis-stamped source separates them at once. experiments.test.js runs every
// row here at the defaults and at random settings and requires the tick.

import {
  solveDC,
  superposition,
  thevenin,
  sourcePower,
  NetworkError,
  transient,
  energies,
  initialConditions,
  charPoly,
  extrema,
  crossings,
  settleTime,
  sourceValue,
} from '@ee-labs/network'
import { isDynamic } from './experiments.js'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })

const par = (...rs) => 1 / rs.reduce((s, r) => s + 1 / r, 0)
const row = (label, predicted, measured, unit = '', tol = 1e-9, abs = 1e-12) => ({ label, predicted, measured, unit, tol, abs })

// ------------------------------------------------------------ closed forms in time
// The hand side of the dynamic groups. None of this touches the matrix
// exponential: these are the formulas a first course writes down, evaluated.

/** The exact waveform at t, clamped to the window so a row never reads past the trace. */
const atT = (x, t) => x.tr.at(Math.min(Math.max(t, 0), x.tEnd))

/** Square wave: +A for the first half of each period, −A for the second. */
const square = (A, T, t) => (t - T * Math.floor(t / T) < T / 2 ? A : -A)

/**
 * The τ recipe on a triangle drive: a quantity obeying τ·y′ + y = ±F, the
 * sign flipping at each corner of the triangle (T/4, 3T/4, 5T/4, …), from
 * y(0) = 0. On every piece y = target + (y_start − target)·e^(−Δt/τ).
 */
function alternating(F, tau, T, t) {
  let y = 0
  let tk = 0
  let sign = +1
  let next = T / 4
  while (t > next) {
    y = sign * F + (y - sign * F) * Math.exp(-(next - tk) / tau)
    tk = next
    sign = -sign
    next += T / 2
  }
  return sign * F + (y - sign * F) * Math.exp(-(t - tk) / tau)
}

/**
 * The state itself under the triangle drive: y obeying τ·y′ + y = triangle(t)
 * from y(0) = 0. On a piece where the drive is a + s·Δ the particular solution
 * lags it by s·τ, and the rest decays. (Writing y = drive − τ·(the alternating
 * current) instead cancels catastrophically when τ ≫ T.)
 */
function tracked(A, T, tau, t) {
  const s = (4 * A) / T
  let y = 0
  let tk = 0
  let a = 0
  let slope = s
  let next = T / 4
  // y(Δ) = y·e^(−u) + a·(1 − e^(−u)) + s·τ·(u − 1 + e^(−u)),  u = Δ/τ.
  // The last bracket is ~u²/2 for small u and would vanish in rounding if
  // formed from its three terms; the series takes over there.
  const piece = (dt) => {
    const u = dt / tau
    const e = Math.exp(-u)
    const g = u < 1e-2 ? (u * u) / 2 - (u * u * u) / 6 + u ** 4 / 24 - u ** 5 / 120 + u ** 6 / 720 - u ** 7 / 5040 : u - 1 + e
    return y * e - a * Math.expm1(-u) + slope * tau * g
  }
  while (t > next) {
    y = piece(next - tk)
    a += slope * (next - tk)
    tk = next
    slope = -slope
    next += T / 2
  }
  return piece(t - tk)
}

/**
 * The integrator's output under a square wave ±A of period T from v_out(0) = 0.
 * Ideal: a straight ramp of slope −v_in/RC on each half. Finite gain G: on
 * each half the output heads for −G·v_in with τ = RC(G + 1) — an ordinary RC.
 */
function integrated(A, T, RC, G, t) {
  let y = 0
  let tk = 0
  let vin = A
  const piece = (dt) => (Number.isFinite(G) ? -G * vin + (y + G * vin) * Math.exp(-dt / (RC * (G + 1))) : y - (vin / RC) * dt)
  for (let next = T / 2; t > next; next += T / 2) {
    y = piece(next - tk)
    tk = next
    vin = -vin
  }
  return piece(t - tk)
}

/**
 * The natural response of a second-order circuit from y(0) = y0, y′(0) = dy0,
 * in its three faces. Overdamped uses the two roots directly, the slow one
 * computed as −ω₀²/(α + β) so that a large α does not cancel it away.
 */
function natural(alpha, w0, y0, dy0) {
  const disc = alpha * alpha - w0 * w0
  if (Math.abs(disc) <= 1e-9 * w0 * w0) return (t) => Math.exp(-alpha * t) * (y0 + (dy0 + alpha * y0) * t)
  if (disc < 0) {
    const wd = Math.sqrt(-disc)
    return (t) => Math.exp(-alpha * t) * (y0 * Math.cos(wd * t) + ((dy0 + alpha * y0) / wd) * Math.sin(wd * t))
  }
  const beta = Math.sqrt(disc)
  const s1 = -(w0 * w0) / (alpha + beta) // slow
  const s2 = -(alpha + beta) // fast
  const c1 = (dy0 - s2 * y0) / (s1 - s2)
  const c2 = (s1 * y0 - dy0) / (s1 - s2)
  return (t) => c1 * Math.exp(s1 * t) + c2 * Math.exp(s2 * t)
}

/** α, ω₀ and the natural-response helpers for a series RLC with the knobs p. */
function series(p) {
  const alpha = p.R1 / (2 * p.L1)
  const w0 = 1 / Math.sqrt(p.L1 * p.C1)
  const zeta = alpha / w0
  return { alpha, w0, zeta, wd: zeta < 1 ? Math.sqrt(w0 * w0 - alpha * alpha) : 0, Rcrit: 2 * Math.sqrt(p.L1 / p.C1) }
}
/** Per-cent overshoot of an underdamped second-order step as a fraction of the step. */
const overshootOf = (zeta) => (zeta < 1 ? Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)) : 0)

/**
 * Settling time of a hand-written waveform to within `band` of `final`, by
 * scanning a fine grid and bisecting the last exit — the same definition the
 * engine measures, applied to the closed form instead of the propagator.
 */
function settleOf(f, final, band, tEnd, n = 4000) {
  let k = n
  while (k >= 0 && Math.abs(f((k / n) * tEnd) - final) <= band) k--
  if (k < 0) return 0
  if (k === n) return tEnd
  let a = (k / n) * tEnd
  let b = ((k + 1) / n) * tEnd
  for (let j = 0; j < 80; j++) {
    const m = (a + b) / 2
    if (Math.abs(f(m) - final) > band) a = m
    else b = m
  }
  return (a + b) / 2
}

/**
 * The peaks of a quantity in the trace — its maxima, or its minima when the
 * drive is negative (`sign` −1) so that a step down has its "overshoot" too —
 * each refined on the exact evaluator. Null if there are none in the window.
 */
function peakOf(x, q, key, sign = 1) {
  const f = (t) => x.tr.at(t).sol[q][key]
  const kind = sign < 0 ? 'min' : 'max'
  const ex = extrema(x.tr.t, x.tr.series(q, key), f).filter((e) => e.kind === kind)
  return ex.length ? ex : null
}
const sgn = (v) => (v < 0 ? -1 : 1)

const ENTRIES = {
  a1(p, s) {
    const i = p.E / p.R1
    return {
      blocks: [
        T('The source fixes the voltage across the resistor; Ohm’s law then fixes the current. The source supplies exactly that current.'),
        F('v_R = E, \\qquad i = \\frac{v_R}{R} = \\frac{E}{R}'),
        C([
          row('v_R = E', p.E, s.volt.R1, 'V'),
          row('i = E / R', i, s.i.R1, 'A'),
          row('source current (out of +)', -i, s.i.V1, 'A'),
          row('p_R = E²/R', (p.E * p.E) / p.R1, s.p.R1, 'W'),
        ]),
      ],
    }
  },

  a2(p, s) {
    const v = p.I * p.R1
    return {
      blocks: [
        T('The source fixes the current through the resistor; Ohm’s law then fixes the voltage — the same law, solved for v.'),
        F('i_R = I, \\qquad v = i_R R = I R'),
        C([
          row('i_R = I', p.I, s.i.R1, 'A'),
          row('v = I·R', v, s.v.in, 'V'),
          row('p_R = I²R', p.I * p.I * p.R1, s.p.R1, 'W'),
          row('source delivers it all', -p.I * p.I * p.R1, s.p.I1, 'W'),
        ]),
        V([{ label: 'v at R = 1 MΩ', value: p.I * 1e6, unit: 'V', note: 'and unbounded as R → ∞' }]),
      ],
    }
  },

  a3(p, s) {
    const i = p.E / (p.R1 + p.R2)
    const vA = p.Vref + i * p.R2
    return {
      blocks: [
        T('Every node voltage carries V_ref; every difference between two nodes does not. Elements see only differences.'),
        F('v_{in} = V_{ref} + E, \\qquad v_A = V_{ref} + E\\,\\frac{R_2}{R_1 + R_2}, \\qquad v_{ref} = V_{ref}'),
        F('v_{R_1} = v_{in} - v_A = E\\,\\frac{R_1}{R_1 + R_2}', 'no V_ref in it'),
        C([
          row('v_in', p.Vref + p.E, s.v.in, 'V'),
          row('v_A', vA, s.v.A, 'V'),
          row('v_ref', p.Vref, s.v.ref, 'V'),
          row('v_R1 (independent of V_ref)', i * p.R1, s.volt.R1, 'V'),
          row('i (independent of V_ref)', i, s.i.R1, 'A'),
          row('current through V_ref', 0, s.i.V0, 'A', 0, 1e-12),
        ]),
      ],
    }
  },

  a4(p, s) {
    const v = p.E1 - p.E2
    const i = v / p.R1
    return {
      blocks: [
        T('The resistor’s + is its left end, at node in. Its voltage is in minus n1; its current is measured into the left end. Both flip sign together, so their product never does.'),
        F('v_R = v_{in} - v_{n_1} = E_1 - E_2, \\qquad i_R = \\frac{v_R}{R}, \\qquad p_R = v_R\\, i_R = \\frac{(E_1 - E_2)^2}{R} \\ge 0'),
        F('p_{V_1} = -E_1 i_R', 'negative while V₁ pushes: current leaves its +'),
        C([
          row('v_R', v, s.volt.R1, 'V'),
          row('i_R', i, s.i.R1, 'A'),
          row('p_R ≥ 0', v * i, s.p.R1, 'W'),
          row('p_V1', -p.E1 * i, s.p.V1, 'W'),
          row('p_V2', p.E2 * i, s.p.V2, 'W'),
        ]),
        V([{ label: 'sign of v_R × sign of i_R', value: Math.sign(s.volt.R1) * Math.sign(s.i.R1), unit: '', note: 'never −1 for a resistor' }]),
      ],
    }
  },

  b1(p, s) {
    const rp = par(p.R2, p.R3)
    const vA = (p.E * rp) / (p.R1 + rp)
    return {
      blocks: [
        T('KCL at node A: the current arriving through R₁ equals the current leaving through R₂ and R₃.'),
        F('i_{R_1} = i_{R_2} + i_{R_3}'),
        F('V_A = E\\,\\frac{R_2 \\parallel R_3}{R_1 + R_2 \\parallel R_3}', 'the node voltage, from the series–parallel reduction'),
        C([
          row('V_A', vA, s.v.A, 'V'),
          row('i_R1', (p.E - vA) / p.R1, s.i.R1, 'A'),
          row('i_R2 + i_R3', (p.E - vA) / p.R1, s.i.R2 + s.i.R3, 'A'),
          row('KCL residual at A', 0, s.residual.A, 'A', 0, 1e-12),
        ]),
      ],
    }
  },

  b2(p, s) {
    const i = p.E / (p.R1 + p.R2)
    return {
      blocks: [
        T('KVL around the loop: the rise across the source equals the sum of the drops across the resistors.'),
        F('E - i R_1 - i R_2 = 0 \\quad\\Rightarrow\\quad i = \\frac{E}{R_1 + R_2}'),
        C([
          row('loop current', i, s.i.R1, 'A'),
          row('v_R1', i * p.R1, s.volt.R1, 'V'),
          row('v_R2', i * p.R2, s.volt.R2, 'V'),
          row('v_V1 − v_R1 − v_R2', 0, s.volt.V1 - s.volt.R1 - s.volt.R2, 'V', 0, 1e-12),
        ]),
      ],
    }
  },

  b3(p, s) {
    const i = p.E / (p.R1 + p.R2)
    return {
      blocks: [
        T('Passive sign convention: p = v·i with i measured into the + terminal. Resistors come out positive, the source negative, and the total is zero.'),
        F('\\sum_k v_k i_k = 0', 'Tellegen’s theorem — a consequence of KVL and KCL alone'),
        C([
          row('p_R1 = i²R₁', i * i * p.R1, s.p.R1, 'W'),
          row('p_R2 = i²R₂', i * i * p.R2, s.p.R2, 'W'),
          row('p_V1 = −E·i', -p.E * i, s.p.V1, 'W'),
          row('Σ p', 0, s.pTotal, 'W', 0, 1e-12),
        ]),
      ],
    }
  },

  b4(p, s) {
    const i = (p.E1 - p.E2) / p.R1
    return {
      blocks: [
        T('One loop, two sources. KVL gives the current from the difference of the two voltages; the sign of each source’s power says which is delivering.'),
        F('i = \\frac{E_1 - E_2}{R}'),
        F('p_{V_1} = -E_1 i, \\qquad p_{V_2} = +E_2 i', 'the weaker source absorbs when i > 0'),
        C([
          row('i', i, s.i.R1, 'A'),
          row('p_V1', -p.E1 * i, s.p.V1, 'W'),
          row('p_V2', p.E2 * i, s.p.V2, 'W'),
          row('Σ p', 0, s.pTotal, 'W', 0, 1e-12),
        ]),
      ],
    }
  },

  c1(p, s) {
    const rs = p.R1 + p.R2 + p.R3
    const i = p.E / rs
    return {
      blocks: [
        T('Series: one current, so resistances add and voltage divides in proportion.'),
        F('R_{eq} = R_1 + R_2 + R_3, \\qquad v_k = E\\,\\frac{R_k}{R_{eq}}'),
        C([
          row('i = E / R_eq', i, s.i.R1, 'A'),
          row('v_R1', (p.E * p.R1) / rs, s.volt.R1, 'V'),
          row('v_R2', (p.E * p.R2) / rs, s.volt.R2, 'V'),
          row('v_R3', (p.E * p.R3) / rs, s.volt.R3, 'V'),
          row('same current in R₃', i, s.i.R3, 'A'),
        ]),
        V([{ label: 'R_eq', value: rs, unit: 'Ω' }]),
      ],
    }
  },

  c2(p, s) {
    const req = par(p.R1, p.R2, p.R3)
    return {
      blocks: [
        T('Parallel: one voltage, so conductances add and current divides in proportion to 1/R.'),
        F('\\frac{1}{R_{eq}} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\frac{1}{R_3}, \\qquad i_k = \\frac{E}{R_k}'),
        C([
          row('total current E / R_eq', p.E / req, -s.i.V1, 'A'),
          row('i_R1', p.E / p.R1, s.i.R1, 'A'),
          row('i_R2', p.E / p.R2, s.i.R2, 'A'),
          row('i_R3', p.E / p.R3, s.i.R3, 'A'),
        ]),
        V([
          { label: 'R_eq', value: req, unit: 'Ω' },
          { label: 'smallest branch', value: Math.min(p.R1, p.R2, p.R3), unit: 'Ω', note: 'R_eq is below it' },
        ]),
      ],
    }
  },

  c3(p, s) {
    const rp = par(p.R2, p.RL)
    const unloaded = (p.E * p.R2) / (p.R1 + p.R2)
    const loaded = (p.E * rp) / (p.R1 + rp)
    return {
      blocks: [
        T('The load sits in parallel with R₂, so the divider’s bottom leg shrinks and the output drops.'),
        F('V_{A} = E\\,\\frac{R_2 \\parallel R_L}{R_1 + R_2 \\parallel R_L} \\;<\\; E\\,\\frac{R_2}{R_1 + R_2}'),
        C([
          row('V_A loaded', loaded, s.v.A, 'V'),
          row('droop from unloaded', unloaded - loaded, unloaded - s.v.A, 'V'),
        ]),
        V([
          { label: 'unloaded V_A', value: unloaded, unit: 'V' },
          { label: 'droop', value: (100 * (unloaded - loaded)) / unloaded, unit: '%' },
          { label: 'R_L / R₂', value: p.RL / p.R2, unit: '', note: 'droop is small only when this is large' },
        ]),
      ],
    }
  },

  c4(p, s) {
    const vL = (p.E * p.R2) / (p.R1 + p.R2)
    const vR = (p.E * p.R4) / (p.R3 + p.R4)
    // Small-signal sensitivity of the output to R4, at balance R4 = R3·R2/R1.
    const r4bal = (p.R3 * p.R2) / p.R1
    const sens = (p.E * p.R3) / (p.R3 + r4bal) ** 2
    return {
      blocks: [
        T('Two dividers; the output is the difference of their midpoints. It is zero exactly when the ratios match.'),
        F('v_{out} = v_R - v_L = E\\left(\\frac{R_4}{R_3 + R_4} - \\frac{R_2}{R_1 + R_2}\\right)'),
        C([
          row('v_L', vL, s.v.L, 'V'),
          row('v_R', vR, s.v.R, 'V'),
          row('v_out', vR - vL, s.v.R - s.v.L, 'V'),
        ]),
        V([
          { label: 'R₄ for balance', value: r4bal, unit: 'Ω' },
          { label: '∂v_out/∂R₄ at balance', value: sens, unit: 'V/Ω' },
          { label: 'per 1 % of R₄', value: sens * r4bal * 0.01, unit: 'V', note: '≈ E/4 × 1 % when all four are equal' },
        ]),
      ],
    }
  },

  d1(p, s) {
    const g = 1 / p.R1 + 1 / p.R2 + 1 / p.R3
    const vA = p.E / p.R1 / g
    return {
      blocks: [
        T('One unknown node voltage, one KCL equation, written directly in conductances.'),
        F('\\frac{V_A - E}{R_1} + \\frac{V_A}{R_2} + \\frac{V_A}{R_3} = 0'),
        F('V_A = \\frac{E/R_1}{1/R_1 + 1/R_2 + 1/R_3}'),
        C([row('V_A', vA, s.v.A, 'V'), row('KCL residual at A', 0, s.residual.A, 'A', 0, 1e-12)]),
      ],
    }
  },

  d2(p, s) {
    // Supernode: (VA−E1)/R1 + VA/R2 + VB/R3 = 0 with VA − VB = E2.
    const vB = (p.E1 / p.R1 - p.E2 / p.R1 - p.E2 / p.R2) / (1 / p.R1 + 1 / p.R2 + 1 / p.R3)
    const vA = vB + p.E2
    return {
      blocks: [
        T('KCL at A and at B each contain the unknown current through E₂. Add them and it cancels — that is the supernode — and V_A − V_B = E₂ closes the system.'),
        F('\\frac{V_A - E_1}{R_1} + \\frac{V_A}{R_2} + \\frac{V_B}{R_3} = 0, \\qquad V_A - V_B = E_2'),
        F('V_B = \\frac{E_1/R_1 - E_2(1/R_1 + 1/R_2)}{1/R_1 + 1/R_2 + 1/R_3}', 'the hand solution'),
        C([
          row('V_A', vA, s.v.A, 'V'),
          row('V_B', vB, s.v.B, 'V'),
          row('V_A − V_B', p.E2, s.v.A - s.v.B, 'V'),
          row('i through E₂ (A→B)', (p.E1 - vA) / p.R1 - vA / p.R2, s.i.V2, 'A'),
        ]),
        V([{ label: 'unknowns in the printed system', value: s.sys.unknowns.length, unit: '', note: '2 nodes + 2 source currents' }]),
      ],
    }
  },

  d3(p, s) {
    // Mesh: [R1+R2, −R2; −R2, R2+R3] [i1; i2] = [E1; −E2]
    const a = p.R1 + p.R2
    const b = -p.R2
    const d = p.R2 + p.R3
    const det = a * d - b * b
    const i1 = (p.E1 * d - b * -p.E2) / det
    const i2 = (a * -p.E2 - b * p.E1) / det
    return {
      blocks: [
        T('One circulating current per window; KVL around each. The shared resistor carries i₁ − i₂.'),
        F('\\begin{bmatrix} R_1 + R_2 & -R_2 \\\\ -R_2 & R_2 + R_3 \\end{bmatrix}\\begin{bmatrix} i_1 \\\\ i_2 \\end{bmatrix} = \\begin{bmatrix} E_1 \\\\ -E_2 \\end{bmatrix}'),
        C([
          row('i₁ (= i_R1)', i1, s.i.R1, 'A'),
          row('i₂ (= i_R3)', i2, s.i.R3, 'A'),
          row('i₁ − i₂ (= i_R2)', i1 - i2, s.i.R2, 'A'),
        ]),
        V([{ label: 'E₂ that stops i₂', value: (p.E1 * p.R2) / (p.R1 + p.R2), unit: 'V', note: 'above this the right loop reverses' }]),
      ],
    }
  },

  d4(p, s, x) {
    const sp = x.superposition
    const vA_E = (p.E1 * p.R2) / (p.R1 + p.R2)
    const vA_I = p.I1 * par(p.R1, p.R2)
    const iE = vA_E / p.R2
    const iI = vA_I / p.R2
    return {
      blocks: [
        T('Each source alone, then the sum. Voltages and currents add; the power in R₂ does not, because (i₁ + i₂)² ≠ i₁² + i₂².'),
        F('V_A = \\underbrace{E_1\\frac{R_2}{R_1+R_2}}_{V_1\\text{ alone}} + \\underbrace{I_1\\,(R_1 \\parallel R_2)}_{I_1\\text{ alone}}'),
        C([
          row('V_A from E₁ alone', vA_E, sp.parts.find((q) => q.id === 'V1').sol.v.A, 'V'),
          row('V_A from I₁ alone', vA_I, sp.parts.find((q) => q.id === 'I1').sol.v.A, 'V'),
          row('sum = full V_A', vA_E + vA_I, s.v.A, 'V'),
          row('p_R2 full − Σ parts = 2 i₁ i₂ R₂', 2 * iE * iI * p.R2, s.p.R2 - sp.sumP.R2, 'W'),
        ]),
      ],
    }
  },

  d5(p, s, x) {
    const th = x.thevenin
    const rth = par(p.R1, p.R2, p.R3)
    const voc = (p.E / p.R1) * rth
    return {
      blocks: [
        T('Three routes to the same resistor. The first two are exact solves; the third is a least-squares line through five loaded points.'),
        F('R_{th} = \\frac{V_{oc}}{I_{sc}} = \\left.\\frac{v}{1\\,\\mathrm{A}}\\right|_{\\text{sources killed}} = -\\frac{dv}{di}\\Big|_{\\text{load line}}'),
        C([
          row('V_oc', voc, th.voc, 'V'),
          row('I_sc = E / R₁', p.E / p.R1, th.isc, 'A'),
          row('R_th by ratio', rth, th.rth.ratio, 'Ω'),
          row('R_th by test source', rth, th.rth.test, 'Ω'),
          row('R_th by load-line fit', rth, th.rth.fit, 'Ω', 1e-6),
          row('fit intercept = V_oc', voc, th.fitVoc, 'V', 1e-6),
        ]),
      ],
    }
  },

  d6(p, s, x) {
    const pl = (p.E * p.E * p.RL) / (p.Rs + p.RL) ** 2
    return {
      blocks: [
        T('Load power against load resistance has one maximum, at R_L = R_s, where half the power is lost inside the source.'),
        F('P_L = \\frac{E^2 R_L}{(R_s + R_L)^2}, \\qquad P_{max} = \\frac{E^2}{4R_s} \\text{ at } R_L = R_s'),
        F('\\eta = \\frac{R_L}{R_s + R_L}', '50 % at the maximum'),
        C([
          row('P_L', pl, s.p.RL, 'W'),
          row('efficiency', p.RL / (p.Rs + p.RL), s.p.RL / -s.p.V1, ''),
          row('R_th the load sees', p.Rs, x.thevenin.rth.test, 'Ω'),
          row('P_max = V_oc²/4R_th', (p.E * p.E) / (4 * p.Rs), x.thevenin.voc ** 2 / (4 * x.thevenin.rth.test), 'W'),
          row('sweep peak is at R_th', p.Rs, x.sweep.rOpt, 'Ω', 0.06),
        ]),
      ],
    }
  },

  e1(p, s) {
    const vout = p.A * p.E
    return {
      blocks: [
        T('The controlled source copies A times its control voltage to its output whatever is connected — and pays for it with power the symbol does not show.'),
        F('v_{out} = A\\,v_{in}, \\qquad p_{E_1} = -\\frac{(A E)^2}{R_L}'),
        C([
          row('v_out', vout, s.v.out, 'V'),
          row('p_E1 (delivered)', -(vout * vout) / p.RL, s.p.E1, 'W'),
          row('p_V1 (input source)', -(p.E * p.E) / p.Rin, s.p.V1, 'W'),
        ]),
        V([{ label: 'power gain', value: (vout * vout) / p.RL / ((p.E * p.E) / p.Rin), unit: '×' }]),
      ],
    }
  },

  e2(p, s) {
    // Input divider, gain, output divider — three factors, two of them the
    // non-idealities; the ideal box is the middle one alone.
    const kin = p.Rin / (p.Rs + p.Rin)
    const kout = p.RL / (p.Rout + p.RL)
    const vp = p.E * kin
    const vout = p.A * vp * kout
    const pLoad = (vout * vout) / p.RL
    const pSource = (p.E * p.E) / (p.Rs + p.Rin)
    return {
      blocks: [
        T('Two dividers and a gain. R_in loads the source through R_s; R_out loads the dependent source through R_L; the ideal op-amp loses neither.'),
        F('v_p = E\\,\\frac{R_{in}}{R_s + R_{in}}, \\qquad v_{out} = A\\,v_p\\,\\frac{R_L}{R_{out} + R_L}'),
        F('\\frac{v_{out}}{E} \\;\\xrightarrow{\\;R_{in}\\to\\infty,\\;R_{out}\\to 0\\;}\\; A', 'the ideal black box'),
        C([
          row('v_p', vp, s.v.p, 'V'),
          row('v_out', vout, s.v.out, 'V'),
          row('input current E/(R_s + R_in)', p.E / (p.Rs + p.Rin), -s.i.V1, 'A'),
          row('power into the load', pLoad, s.p.RL, 'W'),
          row('power from the source', pSource, -s.p.V1, 'W'),
        ]),
        V([
          { label: 'input loss R_in/(R_s+R_in)', value: kin, unit: '', note: '1 when R_in = ∞' },
          { label: 'output loss R_L/(R_out+R_L)', value: kout, unit: '', note: '1 when R_out = 0' },
          { label: 'shortfall from ideal A·E', value: 100 * (1 - kin * kout), unit: '%' },
          { label: 'power gain, load over source', value: pLoad / pSource, unit: '×', note: 'a resistor network cannot exceed 1' },
        ]),
      ],
    }
  },

  e3(p, s) {
    if (!s) {
      return {
        blocks: [
          T('With A = ∞ and no feedback, v_out = A·(E − 0) has no finite value. The solver refuses rather than invent one — see the message above.'),
          F('v_{out} = A\\,(v_+ - v_-) \\to \\infty'),
        ],
      }
    }
    return {
      blocks: [
        T('With finite gain and no feedback the output is simply A times the input — a number, but not a useful one until the rails clip it.'),
        F('v_{out} = A\\,(v_+ - v_-) = A\\,E'),
        C([row('v_out', p.A * p.E, s.v.out, 'V')]),
      ],
    }
  },

  e4(p, s) {
    const G = 1 + p.Rf / p.Rg
    const vout = (G * p.E) / (1 + G / p.A)
    return {
      blocks: [
        T('Feedback divides the output by G = 1 + R_f/R_g and hands it to the − input; the op-amp amplifies the remaining difference by A. Solve the loop exactly:'),
        F('v_{out} = A\\left(E - \\frac{v_{out}}{G}\\right) \\;\\Rightarrow\\; v_{out} = \\frac{G E}{1 + G/A}'),
        F('v_+ - v_- = \\frac{v_{out}}{A} \\xrightarrow{A\\to\\infty} 0', 'golden rule 2, as a limit'),
        C([
          row('v_out', vout, s.v.out, 'V'),
          row('v₊ − v₋ = v_out/A', vout / p.A, s.v.in - s.v.n, 'V'),
          row('input current into op-amp', 0, -s.i.V1, 'A', 0, 1e-15),
        ]),
        V([
          { label: 'G = 1 + R_f/R_g', value: G, unit: '' },
          { label: 'actual gain', value: vout / p.E, unit: '' },
          { label: 'shortfall', value: 100 * (1 - vout / p.E / G), unit: '%', note: '≈ 100·G/A' },
        ]),
      ],
    }
  },

  e5(p, s) {
    const vout = -(p.Rf / p.Rg) * p.E
    return {
      blocks: [
        T('The − input is held at 0 V by feedback, so the input current is E/R_g and all of it continues through R_f.'),
        F('v_n = 0, \\qquad i = \\frac{E}{R_g} = \\frac{0 - v_{out}}{R_f} \\;\\Rightarrow\\; v_{out} = -\\frac{R_f}{R_g}E'),
        C([
          row('v_n (virtual ground)', 0, s.v.n, 'V', 0, 1e-12),
          row('v_out', vout, s.v.out, 'V'),
          row('i_Rg = i_Rf', p.E / p.Rg, s.i.Rf, 'A'),
          row('input resistance E / i_in', p.Rg, p.E / -s.i.V1, 'Ω'),
          // KCL at the output: what the op-amp sources feeds R_L and pulls back through R_f.
          row('op-amp output current', vout / p.RL - p.E / p.Rg, -s.i.U1, 'A'),
        ]),
      ],
    }
  },

  e6(p, s) {
    const vout = -p.Rf * (p.E1 / p.R1 + p.E2 / p.R2)
    return {
      blocks: [
        T('KCL at the virtual ground: the two input currents, each set by its own resistor, sum into R_f.'),
        F('\\frac{E_1}{R_1} + \\frac{E_2}{R_2} = \\frac{0 - v_{out}}{R_f} \\;\\Rightarrow\\; v_{out} = -R_f\\left(\\frac{E_1}{R_1} + \\frac{E_2}{R_2}\\right)'),
        C([
          row('v_n', 0, s.v.n, 'V', 0, 1e-12),
          row('i_R1 = E₁/R₁', p.E1 / p.R1, s.i.R1, 'A'),
          row('i_R2 = E₂/R₂', p.E2 / p.R2, s.i.R2, 'A'),
          row('v_out', vout, s.v.out, 'V'),
        ]),
      ],
    }
  },

  e7(p, s) {
    // Exact output of the four-resistor difference amplifier (ideal op-amp).
    const vp = (p.E2 * p.R4) / (p.R3 + p.R4)
    const vout = vp * (1 + p.R2 / p.R1) - (p.R2 / p.R1) * p.E1
    const gd = p.R2 / p.R1
    // Common-mode gain: set E1 = E2 = 1.
    const gcm = (p.R4 / (p.R3 + p.R4)) * (1 + p.R2 / p.R1) - p.R2 / p.R1
    return {
      blocks: [
        T('The + input is a divider of E₂; the − side is an inverting amplifier of E₁ plus a non-inverting amplifier of v₊. Superpose:'),
        F('v_{out} = \\frac{R_4}{R_3 + R_4}\\left(1 + \\frac{R_2}{R_1}\\right)E_2 - \\frac{R_2}{R_1}E_1'),
        F('\\frac{R_3}{R_4} = \\frac{R_1}{R_2} \\;\\Rightarrow\\; v_{out} = \\frac{R_2}{R_1}(E_2 - E_1)', 'the matched case'),
        C([
          row('v₊', vp, s.v.p, 'V'),
          row('v₋ = v₊', vp, s.v.n, 'V'),
          row('v_out', vout, s.v.out, 'V'),
        ]),
        V([
          { label: 'differential gain R₂/R₁', value: gd, unit: '' },
          { label: 'common-mode gain', value: gcm, unit: '', note: 'zero when matched' },
          { label: 'CMRR', value: gcm === 0 ? Infinity : 20 * Math.log10(Math.abs(gd / gcm)), unit: 'dB' },
        ]),
      ],
    }
  },

  e8(p, s) {
    const unloaded = (p.E * p.R2) / (p.R1 + p.R2)
    return {
      blocks: [
        T('Output wired to − makes v_out = v₊ = V_A, and the op-amp’s input draws no current, so the divider is unloaded whatever hangs on the output.'),
        F('v_{out} = V_A = E\\,\\frac{R_2}{R_1 + R_2}, \\qquad i_{R_L} = \\frac{v_{out}}{R_L} \\text{ from the op-amp}'),
        C([
          row('v_out = unloaded divider', unloaded, s.v.out, 'V'),
          row('divider current unchanged', p.E / (p.R1 + p.R2), s.i.R1, 'A'),
          row('load current from op-amp', -unloaded / p.RL, s.i.U1, 'A'),
        ]),
      ],
    }
  },

  // ---------------------------------------------------------------- F
  f1(p, s, x) {
    const slope = (4 * p.A) / p.T
    const tau = p.Rs * p.C1
    const I = p.C1 * slope
    const i = (t) => alternating(I, tau, p.T, t)
    const vC = (t) => tracked(p.A, p.T, tau, t)
    const t1 = Math.min(p.T / 8, x.tEnd)
    const t2 = Math.min((3 * p.T) / 8, x.tEnd)
    const tc = x.cursor
    return {
      blocks: [
        T('Charge is C·v, current is charge per second. On each straight piece of the triangle the capacitor current heads for C times the slope, with the lag τ = R_sC.'),
        F('i_C = C\\,\\frac{dv_C}{dt}, \\qquad v_{in} = \\pm\\frac{4A}{T}\\,t \\;\\Rightarrow\\; i_C \\to \\pm C\\,\\frac{4A}{T}'),
        F('R_s C\\,\\frac{di_C}{dt} + i_C = C\\,\\frac{dv_{in}}{dt}, \\qquad \\tau = R_s C', 'the τ recipe, piece by piece'),
        C([
          row('i_C mid-rise (t = T/8)', i(t1), atT(x, t1).sol.i.C1, 'A'),
          row('i_C mid-fall (t = 3T/8)', i(t2), atT(x, t2).sol.i.C1, 'A'),
          row('v_C mid-rise', vC(t1), atT(x, t1).sol.volt.C1, 'V'),
          row('C·dv_C/dt at the cursor', i(tc), p.C1 * atT(x, tc).dxdt[0], 'A'),
        ]),
        V([
          { label: 'plateau ±C·4A/T', value: I, unit: 'A' },
          { label: 'lag τ = R_sC', value: tau, unit: 's' },
        ]),
      ],
      marks: [
        { t: p.T / 4, label: 'slope flips' },
        { t: (3 * p.T) / 4, label: 'flips back' },
      ],
    }
  },

  f2(p, s, x) {
    const slope = (4 * p.A) / p.T
    const tau = p.L1 / p.Rp
    const Vp = p.L1 * slope
    const vL = (t) => alternating(Vp, tau, p.T, t)
    const iL = (t) => tracked(p.A, p.T, tau, t)
    const t1 = Math.min(p.T / 8, x.tEnd)
    const t2 = Math.min((3 * p.T) / 8, x.tEnd)
    const tc = x.cursor
    return {
      blocks: [
        T('Flux is L·i, voltage is flux per second. On each straight piece of the triangle the inductor voltage heads for L times the slope, with the lag τ = L/R_p — F1 with every word swapped for its dual.'),
        F('v_L = L\\,\\frac{di_L}{dt}, \\qquad i_{in} = \\pm\\frac{4A}{T}\\,t \\;\\Rightarrow\\; v_L \\to \\pm L\\,\\frac{4A}{T}'),
        F('\\frac{L}{R_p}\\,\\frac{dv_L}{dt} + v_L = L\\,\\frac{di_{in}}{dt}, \\qquad \\tau = \\frac{L}{R_p}'),
        C([
          row('v_L mid-rise (t = T/8)', vL(t1), atT(x, t1).sol.volt.L1, 'V'),
          row('v_L mid-fall (t = 3T/8)', vL(t2), atT(x, t2).sol.volt.L1, 'V'),
          row('i_L mid-rise', iL(t1), atT(x, t1).sol.i.L1, 'A'),
          row('L·di_L/dt at the cursor', vL(tc), p.L1 * atT(x, tc).dxdt[0], 'V'),
        ]),
        V([
          { label: 'plateau ±L·4A/T', value: Vp, unit: 'V' },
          { label: 'lag τ = L/R_p', value: tau, unit: 's' },
        ]),
      ],
      marks: [
        { t: p.T / 4, label: 'slope flips' },
        { t: (3 * p.T) / 4, label: 'flips back' },
      ],
    }
  },

  f3(p, s, x) {
    const tau = p.R1 * p.C1
    const v = (t) => p.E + (p.v0 - p.E) * Math.exp(-t / tau)
    const i = (t) => ((p.E - p.v0) / p.R1) * Math.exp(-t / tau)
    const t5 = Math.min(5 * tau, x.tEnd)
    const tc = x.cursor
    return {
      blocks: [
        T('KVL round the loop with i = C·dv_C/dt is a first-order differential equation; its solution is the final value plus the starting gap shrinking as e^(−t/τ).'),
        F('RC\\,\\frac{dv_C}{dt} + v_C = E \\;\\Rightarrow\\; v_C(t) = E + (v_0 - E)\\,e^{-t/\\tau}, \\qquad \\tau = RC'),
        F('i(t) = \\frac{E - v_0}{R}\\,e^{-t/\\tau}', 'the same τ; the current cannot wait'),
        C([
          row('v_C before the switch', p.v0, x.tr.x0[0], 'V'),
          row('v_C(τ): 63.2 % of the way', v(tau), atT(x, tau).sol.volt.C1, 'V'),
          row('v_C(5τ): 99.3 %', v(t5), atT(x, t5).sol.volt.C1, 'V'),
          row('v_C at the cursor', v(tc), atT(x, tc).sol.volt.C1, 'V'),
          row('i(0⁺) = (E − v₀)/R', i(0), atT(x, 0).sol.i.C1, 'A'),
          row('i at the cursor', i(tc), atT(x, tc).sol.i.C1, 'A'),
        ]),
        V([
          { label: 'τ = RC', value: tau, unit: 's' },
          { label: 'covered after τ', value: 100 * (1 - Math.exp(-1)), unit: '%' },
          { label: 'covered after 5τ', value: 100 * (1 - Math.exp(-5)), unit: '%' },
        ]),
      ],
      marks: [{ t: tau, label: 'τ' }],
    }
  },

  f4(p, s, x) {
    const vth = (p.E * p.R2) / (p.R1 + p.R2)
    const rth = p.R3 + par(p.R1, p.R2)
    const tau = rth * p.C1
    const vB = (t) => vth * (1 - Math.exp(-t / tau))
    // Node A from the capacitor voltage: one KCL at A.
    const vA = (t) => (p.E / p.R1 + vB(t) / p.R3) / (1 / p.R1 + 1 / p.R2 + 1 / p.R3)
    const tc = x.cursor
    const rows = [
      row('V_th = E·R₂/(R₁+R₂)', vth, x.thevenin ? x.thevenin.voc : NaN, 'V'),
      row('R_th = R₃ + R₁∥R₂', rth, x.thevenin ? x.thevenin.rth.test : NaN, 'Ω'),
      row('v_B(τ)', vB(tau), atT(x, tau).sol.v.B, 'V'),
      row('v_B at the cursor', vB(tc), atT(x, tc).sol.v.B, 'V'),
      row('v_A(0⁺): A sees R₂∥R₃', vA(0), atT(x, 0).sol.v.A, 'V'),
      row('v_A at the cursor', vA(tc), atT(x, tc).sol.v.A, 'V'),
      row('i_C(0⁺) = V_th/R_th', vth / rth, atT(x, 0).sol.i.C1, 'A'),
    ]
    return {
      blocks: [
        T('Everything left of the capacitor is a Thévenin source; then the circuit is F3 with V_th for E and R_th for R.'),
        F('V_{th} = E\\,\\frac{R_2}{R_1 + R_2}, \\qquad R_{th} = R_3 + \\frac{R_1 R_2}{R_1 + R_2}, \\qquad \\tau = R_{th}\\,C'),
        F('v_B(t) = V_{th}\\left(1 - e^{-t/\\tau}\\right)'),
        C(x.thevenin ? rows : rows.slice(2)),
        V([
          { label: 'τ = R_th·C', value: tau, unit: 's' },
          { label: 'v_A settles to', value: vth, unit: 'V' },
        ]),
      ],
      marks: [{ t: tau, label: 'τ' }],
    }
  },

  f5(p, s, x) {
    const tau = p.R1 * p.C1
    const vC = (t) => p.E * (1 - Math.exp(-t / tau))
    const end = x.energy.points[x.energy.points.length - 1]
    const tEnd = x.tEnd
    const supplied = p.C1 * p.E * vC(tEnd)
    const stored = 0.5 * p.C1 * vC(tEnd) ** 2
    return {
      blocks: [
        T('The source’s energy is E times the charge moved; the capacitor keeps ½Cv²; the resistor gets the rest. In the limit that is C·E², ½C·E² and ½C·E² — with R nowhere in any of them.'),
        F('W_{source} = E\\,q = C E\\, v_C(t), \\qquad W_C = \\tfrac{1}{2} C v_C^2, \\qquad W_R = W_{source} - W_C'),
        F('W_R = \\int_0^{\\infty} i^2 R\\, dt = \\int_0^{E} (E - v_C)\\, C\\, dv_C = \\tfrac{1}{2} C E^2', 'independent of R'),
        C([
          row('supplied so far (end of window)', supplied, end.supplied, 'J', 1e-8),
          row('stored so far', stored, end.stored, 'J', 1e-8),
          row('dissipated so far = ½CE²(1 − e^(−2t/τ))', 0.5 * p.C1 * p.E * p.E * (1 - Math.exp((-2 * tEnd) / tau)), end.dissipated, 'J', 1e-8),
        ]),
        V([
          { label: 'the whole charge: source', value: p.C1 * p.E * p.E, unit: 'J' },
          { label: 'capacitor, for ever', value: 0.5 * p.C1 * p.E * p.E, unit: 'J' },
          { label: 'resistor, for ever, any R', value: 0.5 * p.C1 * p.E * p.E, unit: 'J' },
        ]),
      ],
    }
  },

  f6(p, s, x) {
    const I0 = p.E / p.R1
    if (!x.tr) {
      return {
        blocks: [
          T('An ideal open switch is an open circuit, and the inductor’s current — a state — cannot become zero in no time. The equations have no finite answer, and the solver says so rather than inventing one.'),
          F('v_L = L\\,\\frac{di}{dt} \\to -\\infty \\quad\\text{as}\\quad i: I_0 \\to 0 \\text{ in } dt \\to 0'),
          V([
            { label: 'I₀ = E/R before the switch', value: I0, unit: 'A' },
            { label: 'spike with an ideal switch', value: NaN, unit: 'V', note: 'unbounded' },
          ]),
        ],
      }
    }
    const tau = p.L1 / (p.R1 + p.Roff)
    const Iinf = p.E / (p.R1 + p.Roff)
    const i = (t) => Iinf + (I0 - Iinf) * Math.exp(-t / tau)
    const tc = x.cursor
    return {
      blocks: [
        T('Before t = 0 the inductor is a short carrying E/R. After, the loop is R + R_off: the current heads for the trickle E/(R + R_off) with τ = L/(R + R_off), and the switch drops i·R_off — I₀·R_off at the first instant.'),
        F('i(t) = I_\\infty + (I_0 - I_\\infty)\\,e^{-t/\\tau}, \\qquad I_0 = \\frac{E}{R}, \\quad I_\\infty = \\frac{E}{R + R_{off}}, \\quad \\tau = \\frac{L}{R + R_{off}}'),
        F('v_{switch}(0^+) = I_0\\, R_{off}', 'the spark'),
        C([
          row('i_L before the switch opens', I0, x.tr.x0[0], 'A'),
          row('i_L(0⁺): unchanged', I0, atT(x, 0).sol.i.L1, 'A'),
          row('v_switch(0⁺) = I₀·R_off', I0 * p.Roff, atT(x, 0).sol.volt.S1, 'V'),
          row('i_L(τ): 63.2 % of the way down', i(tau), atT(x, tau).sol.i.L1, 'A'),
          row('i_L at the cursor', i(tc), atT(x, tc).sol.i.L1, 'A'),
          row('v_switch at the cursor', i(tc) * p.Roff, atT(x, tc).sol.volt.S1, 'V'),
        ]),
        V([
          { label: 'τ = L/(R + R_off)', value: tau, unit: 's' },
          { label: 'build-up τ = L/R was', value: p.L1 / p.R1, unit: 's' },
          { label: 'ratio', value: (p.R1 + p.Roff) / p.R1, unit: '×' },
        ]),
      ],
      marks: [{ t: tau, label: 'τ' }],
    }
  },

  f7(p, s, x) {
    const RC = p.R1 * p.C1
    const G = p.ideal ? Infinity : p.G
    const vout = (t) => integrated(p.A, p.T, RC, G, t)
    const iin = (t) => (square(p.A, p.T, t) + (Number.isFinite(G) ? vout(t) / G : 0)) / p.R1
    const tq = Math.min(p.T / 4, x.tEnd)
    const th = Math.min(p.T / 2, x.tEnd)
    const tc = x.cursor
    return {
      blocks: [
        T(
          p.ideal
            ? 'The virtual ground makes the input current v_in/R, all of it flows into the capacitor, and the output is minus the capacitor voltage — so the output is the integral of the input.'
            : 'With finite gain the inverting input sits at −v_out/A instead of 0, and the integrator is an RC circuit with τ = RC(A + 1) heading for −A·v_in.',
        ),
        F('i = \\frac{v_{in}}{R} = C\\,\\frac{dv_C}{dt}, \\qquad v_{out} = -v_C \\;\\Rightarrow\\; \\frac{dv_{out}}{dt} = -\\frac{v_{in}}{RC}'),
        F(
          Number.isFinite(G)
            ? 'RC\\,(A + 1)\\,\\frac{dv_{out}}{dt} + v_{out} = -A\\,v_{in}'
            : 'v_{out}(t) = -\\frac{1}{RC}\\int_0^t v_{in}\\,dt',
          Number.isFinite(G) ? 'the leaky integrator' : 'a square in, a triangle out',
        ),
        C([
          row('v_out at T/4', vout(tq), atT(x, tq).sol.v.out, 'V'),
          row('v_out at T/2 (the trough)', vout(th), atT(x, th).sol.v.out, 'V'),
          row('v_out at the cursor', vout(tc), atT(x, tc).sol.v.out, 'V'),
          row('input current at the cursor', iin(tc), atT(x, tc).sol.i.R1, 'A'),
        ]),
        V([
          { label: 'slope A/RC', value: p.A / RC, unit: 'V/s' },
          { label: 'peak to peak A·T/2RC', value: (p.A * p.T) / (2 * RC), unit: 'V', note: Number.isFinite(G) ? 'ideal case' : undefined },
          ...(Number.isFinite(G) ? [{ label: 'leak τ = RC(A + 1)', value: RC * (G + 1), unit: 's' }] : []),
        ]),
      ],
      marks: [{ t: p.T / 2, label: 'v_in flips' }],
    }
  },

  // ---------------------------------------------------------------- G
  g1(p, s, x) {
    return rlcEntry(p, x, {
      text: 'KVL round the loop, with i = C·dv_C/dt, is a second-order equation. The solver’s A matrix carries the same information: det(sI − A) is the characteristic polynomial, and its roots decide the shape.',
      extra: [F('LC\\,\\frac{d^2 v_C}{dt^2} + RC\\,\\frac{dv_C}{dt} + v_C = E, \\qquad s^2 + \\frac{R}{L}\\,s + \\frac{1}{LC} = 0')],
    })
  },
  g2(p, s, x) {
    return rlcEntry(p, x, {
      text: 'At α = ω₀ the roots coincide and the response is E[1 − (1 + αt)e^(−αt)]: no overshoot, and none of the slow tail an overdamped circuit has.',
      extra: [F('v_C = E\\left[1 - (1 + \\alpha t)\\,e^{-\\alpha t}\\right], \\qquad i = \\frac{E}{L}\\,t\\,e^{-\\alpha t}', 'the critical case, α = ω₀')],
    })
  },
  g3(p, s, x) {
    const q = series(p)
    const vC = (t) => p.E + natural(q.alpha, q.w0, -p.E, 0)(t)
    const d = x.damping
    const rows = d && d.at
      ? [
          row('overshoot at this R', overshootOf(q.zeta), d.at.overshoot, '', 1e-6, 1e-9),
          row('2 % settling time at this R', settleOf(vC, p.E, 0.02 * Math.abs(p.E), d.at.tEnd), d.at.settle, 's', 1e-6),
        ]
      : []
    return rlcEntry(p, x, {
      text: 'Two measurements of the same step response, repeated across R in the sweep above: how far v_C overshoots E, and when it last leaves the ±2 % band around E. The quickest settling is not at critical damping but a little below it, where a small overshoot buys a faster approach.',
      extra: [
        F('\\text{overshoot} = e^{-\\pi\\zeta/\\sqrt{1-\\zeta^2}} \\;(\\zeta < 1), \\qquad 0 \\;(\\zeta \\ge 1)'),
        rows.length ? C(rows) : T('This R lies outside the sweep (R_crit/20 to 50·R_crit), where the ringing outlasts any window the trace could resolve; bring R back into range for the two measurements.'),
        V([{ label: 'critical R = 2√(L/C)', value: q.Rcrit, unit: 'Ω' }]),
      ],
    })
  },
  g4(p, s, x) {
    const q = series(p)
    const extra = [
      F('v_C = E\\left[1 - e^{-\\alpha t}\\left(\\cos\\omega_d t + \\frac{\\alpha}{\\omega_d}\\sin\\omega_d t\\right)\\right], \\qquad \\omega_d = \\sqrt{\\omega_0^2 - \\alpha^2}'),
      F('\\text{first peak: } t_p = \\frac{\\pi}{\\omega_d}, \\qquad \\frac{v_{C,max} - E}{E} = e^{-\\pi\\zeta/\\sqrt{1-\\zeta^2}}, \\qquad \\zeta = \\frac{\\alpha}{\\omega_0}'),
    ]
    return rlcEntry(p, x, { text: 'Complex roots: the response rings at ω_d inside an envelope e^(−αt). The damping ratio alone fixes the overshoot and the ratio of one peak to the next.', extra })
  },
  g5(p, s, x) {
    const w0 = 1 / Math.sqrt(p.L1 * p.C1)
    const vC = (t) => p.E * (1 - Math.cos(w0 * t))
    const i = (t) => p.E * Math.sqrt(p.C1 / p.L1) * Math.sin(w0 * t)
    const tc = x.cursor
    const end = x.energy.points[x.energy.points.length - 1]
    const storedEnd = 0.5 * p.C1 * vC(x.tEnd) ** 2 + 0.5 * p.L1 * i(x.tEnd) ** 2
    const zeros = crossings(x.tr.t, x.tr.series('i', 'L1'), (t) => x.tr.at(t).sol.i.L1).filter((t) => t > 1e-9 * x.tEnd)
    const peaks = peakOf(x, 'volt', 'C1', sgn(p.E))
    return {
      blocks: [
        T('No resistance, no decay: the roots are ±jω₀ and the energy the source has delivered is all still in the circuit, swapping between ½Cv² and ½Li² every quarter cycle.'),
        F('v_C = E\\,(1 - \\cos\\omega_0 t), \\qquad i = E\\sqrt{\\tfrac{C}{L}}\\,\\sin\\omega_0 t, \\qquad \\omega_0 = \\frac{1}{\\sqrt{LC}}'),
        F('\\tfrac{1}{2} C v_C^2 + \\tfrac{1}{2} L i^2 = E\\, C\\, v_C = W_{source}', 'nothing is lost'),
        C([
          row('v_C at the cursor', vC(tc), atT(x, tc).sol.volt.C1, 'V'),
          row('i at the cursor', i(tc), atT(x, tc).sol.i.L1, 'A'),
          ...(peaks ? [row('peak v_C = 2E', 2 * p.E, peaks[0].y, 'V', 1e-8)] : []),
          ...(zeros.length >= 2 ? [row('zeros of i spaced π/ω₀', Math.PI / w0, zeros[1] - zeros[0], 's', 1e-8)] : []),
          row('stored at the end = ½Cv² + ½Li²', storedEnd, end.stored, 'J', 1e-7, 1e-15),
          row('supplied at the end = stored', storedEnd, end.supplied, 'J', 1e-7, 1e-15),
          row('dissipated', 0, end.dissipated, 'J', 0, 1e-15),
        ]),
        V([
          { label: 'ω₀', value: w0, unit: 'rad/s' },
          { label: 'peak current E√(C/L)', value: p.E * Math.sqrt(p.C1 / p.L1), unit: 'A' },
          { label: 'period 2π/ω₀', value: (2 * Math.PI) / w0, unit: 's' },
        ]),
      ],
      marks: [{ t: Math.PI / w0, label: 'v_C peak, i = 0' }],
    }
  },
  g6(p, s, x) {
    const q = series(p)
    const vC = (t) => p.E + natural(q.alpha, q.w0, p.v0 - p.E, p.i0 / p.C1)(t)
    const iL = (t) => natural(q.alpha, q.w0, p.i0, (p.E - p.v0 - p.R1 * p.i0) / p.L1)(t)
    const own = natural(q.alpha, q.w0, p.v0, p.i0 / p.C1)
    const tc = x.cursor
    const th = x.tEnd / 2
    return {
      blocks: [
        T('The same equation as G4 with a different starting point. The forced part, E, is the source’s; the natural part starts from the two initial conditions and dies with e^(−αt).'),
        F('v_C(t) = E + e^{-\\alpha t}\\left[(v_0 - E)\\cos\\omega_d t + \\frac{i_0/C + \\alpha(v_0 - E)}{\\omega_d}\\sin\\omega_d t\\right]'),
        F('v_C(0^+) = v_0, \\qquad i_L(0^+) = i_0, \\qquad \\frac{dv_C}{dt}(0^+) = \\frac{i_0}{C}, \\qquad \\frac{di_L}{dt}(0^+) = \\frac{E - v_0 - R i_0}{L}', 'what the states hand the equation'),
        C([
          row('v_C(0⁺) = v_C(0)', p.v0, atT(x, 0).x[0], 'V'),
          row('i_L(0⁺) = i_L(0)', p.i0, atT(x, 0).x[1], 'A'),
          row('v_C at the cursor', vC(tc), atT(x, tc).sol.volt.C1, 'V'),
          row('i_L at the cursor', iL(tc), atT(x, tc).sol.i.L1, 'A'),
          row('v_C at mid-window', vC(th), atT(x, th).sol.volt.C1, 'V'),
          ...(x.ghost ? [row('bright − dim = natural response from (v₀, i₀)', own(tc), atT(x, tc).x[0] - x.ghost.at(Math.min(tc, x.tEnd)).x[0], 'V')] : []),
        ]),
        V([
          { label: 'α = R/2L', value: q.alpha, unit: '1/s' },
          { label: 'ω_d', value: q.wd, unit: 'rad/s' },
          { label: 'both settle to', value: p.E, unit: 'V' },
        ]),
      ],
    }
  },
  g7(p, s, x) {
    const alpha = 1 / (2 * p.R1 * p.C1)
    const w0 = 1 / Math.sqrt(p.L1 * p.C1)
    const zeta = alpha / w0
    const iL = (t) => p.I + natural(alpha, w0, -p.I, 0)(t)
    const v = (t) => natural(alpha, w0, 0, p.I / p.C1)(t)
    const tc = x.cursor
    const peaks = zeta < 1 ? peakOf(x, 'i', 'L1', sgn(p.I)) : null
    return {
      blocks: [
        T('KCL at the one node is the series loop’s KVL with every quantity swapped for its dual. The inductor current takes the role v_C had; the node voltage the role i had.'),
        F('C\\,\\frac{dv}{dt} + \\frac{v}{R} + i_L = I, \\qquad v = L\\,\\frac{di_L}{dt} \\;\\Rightarrow\\; s^2 + \\frac{1}{RC}\\,s + \\frac{1}{LC} = 0'),
        F('\\alpha = \\frac{1}{2RC}, \\qquad \\omega_0 = \\frac{1}{\\sqrt{LC}}, \\qquad R_{crit} = \\tfrac{1}{2}\\sqrt{L/C}', 'compare α = R/2L, R_crit = 2√(L/C) in series'),
        C([
          row('2α = 1/RC from det(sI − A)', 1 / (p.R1 * p.C1), x.state.poly[1], '1/s'),
          row('ω₀² = 1/LC from det(sI − A)', w0 * w0, x.state.poly[2], '1/s²'),
          row('ζ = α/ω₀', zeta, x.state.zeta, ''),
          row('i_L at the cursor', iL(tc), atT(x, tc).sol.i.L1, 'A'),
          row('v at the cursor', v(tc), atT(x, tc).sol.v.in, 'V'),
          ...(peaks ? [row('overshoot of i_L', overshootOf(zeta), (peaks[0].y - p.I) / p.I, '', 1e-8)] : []),
        ]),
        V([
          { label: 'R_crit = ½√(L/C)', value: 0.5 * Math.sqrt(p.L1 / p.C1), unit: 'Ω' },
          { label: 'series R for the same ζ', value: 2 * zeta * Math.sqrt(p.L1 / p.C1), unit: 'Ω' },
        ]),
      ],
    }
  },
}

/**
 * The shared body of G1–G4: the state-space numbers against the hand values,
 * v_C and i against the three-face closed form, and whichever face-specific
 * rows the current R makes measurable — the roots when real, the peak when
 * critical, the overshoot and peak time when ringing.
 */
function rlcEntry(p, x, { text, extra = [] }) {
  const q = series(p)
  const vC = (t) => p.E + natural(q.alpha, q.w0, -p.E, 0)(t)
  const i = (t) => natural(q.alpha, q.w0, 0, p.E / p.L1)(t)
  const tc = x.cursor
  const th = x.tEnd / 2
  const st = x.state
  const rows = [
    row('2α = R/L from det(sI − A)', p.R1 / p.L1, st.poly[1], '1/s'),
    row('ω₀² = 1/LC from det(sI − A)', q.w0 * q.w0, st.poly[2], '1/s²'),
    row('v_C at the cursor', vC(tc), atT(x, tc).sol.volt.C1, 'V'),
    row('i at the cursor', i(tc), atT(x, tc).sol.i.L1, 'A'),
    row('v_C at mid-window', vC(th), atT(x, th).sol.volt.C1, 'V'),
  ]
  const marks = []
  const guides = []
  const values = [
    { label: 'α = R/2L', value: q.alpha, unit: '1/s' },
    { label: 'ω₀ = 1/√LC', value: q.w0, unit: 'rad/s' },
    { label: 'ζ = α/ω₀', value: q.zeta, unit: '', note: st.face },
  ]
  if (st.face === 'overdamped') {
    const beta = Math.sqrt(q.alpha * q.alpha - q.w0 * q.w0)
    rows.push(row('slow root −ω₀²/(α+β)', -(q.w0 * q.w0) / (q.alpha + beta), st.roots[0].re, '1/s'))
    rows.push(row('fast root −(α+β)', -(q.alpha + beta), st.roots[1].re, '1/s'))
    const peaks = peakOf(x, 'volt', 'C1', sgn(p.E))
    rows.push(row('overshoot: none', 0, peaks ? Math.max(0, (peaks[0].y - p.E) / p.E) : 0, '', 0, 1e-9))
    values.push({ label: 'slow time constant', value: (q.alpha + beta) / (q.w0 * q.w0), unit: 's' })
  } else if (st.face === 'critical') {
    const peaks = peakOf(x, 'i', 'L1', sgn(p.E))
    if (peaks) {
      rows.push(row('i peaks at t = 1/α', 1 / q.alpha, peaks[0].t, 's', 1e-7))
      rows.push(row('i peak = E/(Lαe)', p.E / (p.L1 * q.alpha * Math.E), peaks[0].y, 'A', 1e-8))
      marks.push({ t: 1 / q.alpha, label: 'i peaks' })
    }
    rows.push(row('repeated root −α', -q.alpha, st.roots[0].re, '1/s', 1e-6))
  } else {
    const os = overshootOf(q.zeta)
    rows.push(row('ω_d = √(ω₀² − α²)', q.wd, st.wd, 'rad/s'))
    const peaks = peakOf(x, 'volt', 'C1', sgn(p.E))
    if (peaks) {
      rows.push(row('first peak at π/ω_d', Math.PI / q.wd, peaks[0].t, 's', 1e-7))
      rows.push(row('overshoot e^(−πζ/√(1−ζ²))', os, (peaks[0].y - p.E) / p.E, '', 1e-8))
      if (peaks.length >= 2) rows.push(row('next peak over first = overshoot²', os * os, (peaks[1].y - p.E) / (peaks[0].y - p.E), '', 1e-6))
      marks.push({ t: Math.PI / q.wd, label: 'peak' })
    }
    const env = (q.w0 / q.wd) * p.E
    guides.push({ f: (t) => p.E + env * Math.exp(-q.alpha * t), label: 'envelope' }, { f: (t) => p.E - env * Math.exp(-q.alpha * t) })
    values.push({ label: 'Q = 1/2ζ', value: 1 / (2 * q.zeta), unit: '' }, { label: 'overshoot', value: 100 * os, unit: '%' })
  }
  return {
    blocks: [T(text), ...extra, F('\\alpha = \\frac{R}{2L}, \\qquad \\omega_0 = \\frac{1}{\\sqrt{LC}}, \\qquad s = -\\alpha \\pm \\sqrt{\\alpha^2 - \\omega_0^2}'), C(rows), V(values)],
    marks,
    guides,
  }
}

/**
 * Everything the panes need for one experiment at one setting: the solution
 * (or the refusal), and the theorem results the experiment's views ask for.
 * Solving is cheap — a handful of unknowns — so this runs on every keystroke.
 *
 * When the experiment names a `sweepId`, that element is the load: the
 * Thévenin equivalent is taken with it removed (the source as the load sees
 * it), and the sweep re-solves the whole circuit at each value of that knob.
 */
export function analyse(exp, p, cursor) {
  if (isDynamic(exp)) return analyseDynamic(exp, p, cursor)
  const net = exp.net(p)
  let sol = null
  let refusal = null
  try {
    sol = solveDC(net)
  } catch (err) {
    if (err instanceof NetworkError) refusal = err
    else throw err
  }
  const x = { net, sol, refusal }
  if (!sol) return x
  if (exp.views.includes('superposition')) x.superposition = superposition(net)
  if (exp.port) {
    const portNet = exp.sweepId ? { elements: net.elements.filter((e) => e.id !== exp.sweepId) } : net
    try {
      x.thevenin = thevenin(portNet, exp.port[0], exp.port[1])
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err
    }
  }
  if (exp.sweepId && exp.port) x.sweep = sweepKnob(exp, p)
  return x
}

/**
 * The dynamic groups. The window is the experiment's own — N time constants
 * or N cycles — so the trace always resolves whatever the knobs say. The
 * schematic's readout is the exact circuit at the cursor: `x.sol` is
 * `tr.at(cursor).sol`, and everything that was true of a DC solve (KCL
 * residual, powers, the printed equations) is true of it, with the states
 * standing in as sources at their instantaneous values.
 *
 * `cursor` is in seconds; absent, the experiment's default fraction of the
 * window is used (that is what the tests analyse at).
 */
export function analyseDynamic(exp, p, cursor) {
  const net = exp.net(p)
  const tEnd = exp.window(p)
  const t = Number.isFinite(cursor) ? Math.min(Math.max(cursor, 0), tEnd) : exp.cursor * tEnd
  const x = { net, tEnd, cursor: t, sol: null, refusal: null, tr: null }
  try {
    x.tr = transient(net, { tEnd, points: 601 })
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err
    x.refusal = err
    return x
  }
  x.dyn = x.tr.dyn
  x.before = initialConditions(net)
  x.now = x.tr.at(t)
  x.sol = x.now.sol
  x.state = stateSummary(x.dyn)
  // The energy bookkeeping integrates the exact waveform with a 7-point rule
  // on every sample interval — thousands of evaluations — so it is computed
  // the first time something asks for it (the energy view, F5, G5).
  let energy = null
  Object.defineProperty(x, 'energy', {
    enumerable: true,
    get() {
      if (!energy) energy = energies(x.tr)
      return energy
    },
  })
  if (exp.ghost) {
    try {
      x.ghost = transient(exp.net(exp.ghost(p)), { tEnd, points: 601 })
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err
    }
  }
  if (exp.port) {
    try {
      x.thevenin = thevenin(portNetAt(net, tEnd), exp.port[0], exp.port[1])
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err
    }
  }
  // The one-point measurement is cheap and runs on every keystroke; the sweep
  // across R (fifty transients) is the damping view's own, via dampingSweep().
  if (exp.views.includes('damping')) x.damping = { at: dampingPoint(exp, p), Rcrit: series(p).Rcrit, ...sweepRange(series(p)) }
  return x
}

/**
 * Σ p for the meters. Tellegen says it is zero; the solver says it is zero to
 * rounding, which on a 1 V, 10 mA circuit prints as "−0.0016 fW". A residual
 * below 1e-9 of the largest single element power is the zero the theorem
 * promises, not a reading, and is shown as one.
 */
export function netPower(sol) {
  let scale = 0
  for (const w of Object.values(sol.p)) scale = Math.max(scale, Math.abs(w))
  return Math.abs(sol.pTotal) <= 1e-9 * scale ? 0 : sol.pTotal
}

/**
 * The resistive network a capacitor sees after the step: capacitors removed,
 * every source at its value at time t, switches in their after position.
 */
function portNetAt(net, t) {
  return {
    elements: net.elements
      .filter((e) => e.type !== 'C')
      .map((e) => (e.type === 'V' || e.type === 'I' ? { ...e, value: sourceValue(e, t), wave: undefined } : e)),
  }
}

/**
 * What the A matrix says about the circuit, in the words of the lesson:
 * det(sI − A) and its roots; τ for one state; α, ω₀, ζ, Q, ω_d and the
 * damping face for two.
 */
export function stateSummary(dyn) {
  const { A, n } = dyn
  const poly = charPoly(A)
  const out = { n, A, B: dyn.B, poly, states: dyn.states, inputs: dyn.inputs }
  if (n === 1) {
    out.roots = [{ re: A[0][0], im: 0 }]
    out.tau = A[0][0] < 0 ? -1 / A[0][0] : Infinity // a pure integrator has no τ
    return out
  }
  if (n === 2) {
    const alpha = poly[1] / 2
    const w0 = Math.sqrt(Math.abs(poly[2]))
    const disc = alpha * alpha - w0 * w0
    out.alpha = alpha
    out.w0 = w0
    out.zeta = w0 > 0 ? alpha / w0 : Infinity
    out.Q = alpha > 0 ? w0 / (2 * alpha) : Infinity
    if (Math.abs(disc) <= 1e-9 * w0 * w0) {
      out.face = 'critical'
      out.roots = [{ re: -alpha, im: 0 }, { re: -alpha, im: 0 }]
      out.wd = 0
    } else if (disc < 0) {
      out.face = alpha === 0 ? 'undamped' : 'underdamped'
      out.wd = Math.sqrt(-disc)
      out.roots = [{ re: -alpha, im: out.wd }, { re: -alpha, im: -out.wd }]
    } else {
      out.face = 'overdamped'
      const beta = Math.sqrt(disc)
      out.roots = [{ re: -(w0 * w0) / (alpha + beta), im: 0 }, { re: -(alpha + beta), im: 0 }]
      out.wd = 0
    }
    return out
  }
  out.roots = []
  return out
}

/** The R range the damping sweep covers: from a fortieth of critical (ζ = 0.05) to fifty times it. */
const sweepRange = (q) => ({ lo: q.Rcrit / 20, hi: q.Rcrit * 50 })

/**
 * Overshoot (fraction of the step) and 2 % settling time of v_C for one
 * series-RLC setting, or null outside the sweep's range: below ζ = 0.05 the
 * ringing outlasts any window a sample grid can resolve, and the settle
 * measurement would be reading aliasing.
 */
function dampingPoint(exp, p) {
  const q = series(p)
  const { lo, hi } = sweepRange(q)
  if (!(p.R1 >= lo * (1 - 1e-9) && p.R1 <= hi * (1 + 1e-9))) return null
  const net = exp.net(p)
  const beta = q.zeta > 1 ? Math.sqrt(q.alpha * q.alpha - q.w0 * q.w0) : 0
  const slow = q.zeta > 1 ? (q.alpha + beta) / (q.w0 * q.w0) : 1 / q.alpha
  const tEnd = 8 * slow
  const cycles = (tEnd * (q.wd || q.w0)) / (2 * Math.PI)
  const points = Math.min(801, Math.max(201, Math.round(200 + 24 * cycles)))
  const tr = transient(net, { tEnd, points })
  const y = tr.series('volt', 'C1')
  const f = (t) => tr.at(t).sol.volt.C1
  const ex = extrema(tr.t, y, f).filter((e) => e.kind === (p.E < 0 ? 'min' : 'max'))
  const peak = ex.length ? ex[0].y : p.E
  return {
    R: p.R1,
    zeta: q.zeta,
    overshoot: Math.max(0, (peak - p.E) / p.E),
    settle: settleTime(tr.t, y, f, p.E, 0.02 * Math.abs(p.E)),
    tEnd,
  }
}

const DAMP_MEMO = new Map()

/**
 * The damping sweep behind G3: R from R_crit/20 to 50·R_crit on a log grid,
 * each point a fresh exact transient measured for overshoot and settling
 * time. Memoized on (E, L, C) — the sweep is the same whichever R the knob is
 * at — so dragging R costs nothing after the first draw.
 */
export function dampingSweep(exp, p) {
  const q = series(p)
  const key = JSON.stringify([exp.id, p.E, p.L1, p.C1])
  let out = DAMP_MEMO.get(key)
  if (out) return out
  const points = []
  const n = 49
  const { lo, hi } = sweepRange(q)
  for (let k = 0; k < n; k++) points.push(dampingPoint(exp, { ...p, R1: lo * Math.pow(hi / lo, k / (n - 1)) }))
  let fastest = points[0]
  for (const d of points) if (d.settle < fastest.settle) fastest = d
  // The 2 % settling time has cliffs — where the first peak drops inside the
  // band the time falls by a third in a few ohms — so the grid's minimum is
  // refined by a fine scan of the bracket around it. The scan's points join
  // the curve, so the plot shows the cliff instead of a dot floating under it.
  const k = points.indexOf(fastest)
  const a = points[Math.max(0, k - 1)].R
  const b = points[Math.min(n - 1, k + 1)].R
  for (let j = 1; j < 24; j++) {
    const d = dampingPoint(exp, { ...p, R1: a * Math.pow(b / a, j / 24) })
    points.push(d)
    if (d.settle < fastest.settle) fastest = d
  }
  points.sort((u, v) => u.R - v.R)
  out = { points, fastest, Rcrit: q.Rcrit, lo, hi }
  DAMP_MEMO.clear()
  DAMP_MEMO.set(key, out)
  return out
}

/**
 * Re-solve the circuit across the load knob's whole range: load voltage,
 * current and power, plus efficiency (load power over independent-source
 * power) where the experiment asks for it. Every point is a real solve, so the
 * curve is a measurement of the circuit and not a plot of a formula about it.
 */
export function sweepKnob(exp, p, n = 241) {
  const knob = exp.params.find((q) => q.key === exp.sweepId)
  const [a, b] = exp.port
  const points = []
  for (let k = 0; k < n; k++) {
    const R = knob.min * Math.pow(knob.max / knob.min, k / (n - 1))
    let s
    try {
      s = solveDC(exp.net({ ...p, [exp.sweepId]: R }))
    } catch (err) {
      if (err instanceof NetworkError) continue
      throw err
    }
    const pl = s.p[exp.sweepId]
    points.push({
      R,
      v: s.v[a] - s.v[b],
      i: s.i[exp.sweepId],
      p: pl,
      efficiency: exp.sweepEfficiency ? pl / -sourcePower(s) : undefined,
    })
  }
  let best = points[0]
  for (const q of points) if (q.p > best.p) best = q
  return { points, rOpt: best.R, pMax: best.p, knob }
}

/** The math panel for an experiment, or null if it has none. */
export function experimentMath(exp, p, x) {
  const fn = ENTRIES[exp.id]
  if (!fn) return null
  try {
    return fn(p, x.sol, x)
  } catch {
    return null
  }
}
