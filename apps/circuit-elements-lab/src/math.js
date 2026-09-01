// The math for the experiment on screen.
//
// Same discipline as the rest of the suite: the "theory" column is a closed
// form written by hand in terms of the knobs, and the "measured" column is
// read off the solved circuit. Those are different paths — one is algebra, the
// other is a matrix solve — so a wrong sign, a dropped parallel term or a
// mis-stamped source separates them at once. experiments.test.js runs every
// row here at the defaults and at random settings and requires the tick.

import { solveDC, superposition, thevenin, sourcePower, NetworkError } from '@ee-labs/network'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })

const par = (...rs) => 1 / rs.reduce((s, r) => s + 1 / r, 0)
const row = (label, predicted, measured, unit = '', tol = 1e-9, abs = 1e-12) => ({ label, predicted, measured, unit, tol, abs })

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
export function analyse(exp, p) {
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
  if (exp.sweepId) x.sweep = sweepKnob(exp, p)
  return x
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
