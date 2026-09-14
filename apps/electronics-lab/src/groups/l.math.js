// The math panel for Group L: the formula behind each number, and the closed
// form checked against what the solver measured.
//
// The discipline is mathEntries.js's. A check row appears only when its
// measured side is genuinely read from the circuit, a closed form the current
// settings cannot see is footnoted with the reason rather than crossed out,
// and every predicted side is written from the knobs so that turning one moves
// both columns.

import { blackman, evalTF, normalize, polesOf, solveDC } from '@ee-labs/network'
import { loopT, loopTF, loopMargins, ringOf, tangent } from './l.js'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.02, extra = {}) => ({ label, predicted, measured, unit, tol, ...extra })

/** The feedback factor of a divider from the output back to the inverting input. */
const beta = (p) => p.Rg / (p.Rf + p.Rg)

/** One DC solve of an experiment's own circuit at another setting of its knobs. */
const solveAt = (x, over) => solveDC(normalize(x.exp.net({ ...x.p, ...over })))

/** The resistance the source sees, from the current it has to deliver at one volt. */
const rIn = (x, over = {}) => {
  const sol = solveDC(normalize(x.exp.net({ ...x.p, ...over })), { sources: { V1: 1, It: 0 } })
  return 1 / -sol.i.V1
}

/** The resistance at the output port, from the voltage a unit test current makes there. */
const rOut = (x, over = {}) => solveDC(normalize(x.exp.net({ ...x.p, ...over })), { sources: { V1: 0, It: 1 } }).v.out

export const MATH_L = {
  l1(p, x) {
    const b = beta(p)
    const T0 = loopT(x, 'V2')
    const closed = (p.A0 * p.E) / (1 + p.A0 * b)
    const bl = blackman(tangent(x), 'V2', { input: 'V1', output: 'out' })
    return {
      blocks: [
        T('Drive the controlled source with one unit of its own controlling signal, and read what comes back to its input. That is the return ratio, and every other number here is written in it.'),
        F('T = A_0\\beta, \\qquad v_{out} = V_1\\,\\frac{A_0}{1 + T}, \\qquad \\beta = \\frac{R_g}{R_f + R_g}'),
        C([
          row('the return ratio, from the broken loop', p.A0 * b, T0, '', 1e-6),
          row('the output, from the closed form', closed, x.sol.v.out, 'V', 1e-6, { abs: 1e-9 }),
          row('Blackman’s form, against the direct solve', bl.closed[0] * p.E, x.sol.v.out, 'V', 1e-6, { abs: 1e-9 }),
        ]),
        V([
          { label: 'A∞, the gain with the source made infinite', value: bl.Ainf[0], unit: '', note: 'the divider read backwards, 1 + R_f/R_g' },
          { label: 'd, what gets through with the source dead', value: bl.d[0], unit: '' },
          { label: 'the shortfall from A∞, one part in 1 + T', value: 1 / (1 + T0), unit: '' },
        ]),
      ],
    }
  },

  l2(p, x) {
    const b = beta(p)
    const T0 = loopT(x, 'V2')
    const up = solveAt(x, { A0: p.A0 * 1.01 })
    // The exact change, not the first-order one: a hundredth more forward gain
    // gives a closed-loop gain of 1.01A/(1 + 1.01Aβ), and the ratio of that to
    // the one on screen is what the second column measures.
    const exact = (1.01 * p.A0) / (1 + 1.01 * p.A0 * b) / (p.A0 / (1 + p.A0 * b)) - 1
    return {
      blocks: [
        T('A fractional change in the forward amplifier arrives at the closed-loop gain divided by 1 + T. That division is the reason for feedback, and the gain given up to buy it is the same factor.'),
        F('\\frac{dG}{G} = \\frac{1}{1 + T}\\,\\frac{dA_0}{A_0}, \\qquad G = \\frac{A_0}{1 + T}'),
        C([
          row('the closed-loop output', (p.A0 * p.E) / (1 + p.A0 * b), x.sol.v.out, 'V', 1e-6, { abs: 1e-9 }),
          row('what a one per cent rise in A₀ moves it by', exact, up.v.out / x.sol.v.out - 1, '', 1e-6, {
            abs: 1e-12,
            unchecked: Math.abs(x.sol.v.out) < 1e-9 ? 'With no input applied there is no output to take a fraction of.' : null,
          }),
        ]),
        V([
          { label: 'the desensitivity factor 1 + T', value: 1 + T0, unit: '' },
          { label: 'the gain given up to get it', value: p.A0 / (p.A0 / (1 + p.A0 * b)), unit: '', note: 'the same 1 + T, spent rather than saved' },
          { label: 'first-order estimate of the move, 1 % ÷ (1 + T)', value: 0.01 / (1 + T0), unit: '' },
        ]),
      ],
    }
  },

  l3(p, x) {
    const b = beta(p)
    const fp = p.ft / p.A0
    const G = 1 + p.Rf / p.Rg
    const closed = fp * (1 + p.A0 * b)
    // The corner is read as the −3 dB point against the response at one hertz.
    // That reference is the flat part only while the corner sits well above
    // it, so the row is checked two decades up and footnoted below that.
    const low = closed < 100 ? 'The corner is close to the one hertz the flat part is measured against, so the −3 dB point is read from a reference that has already started to fall.' : null
    const Ttf = loopTF(x, 'G1')
    const tPoles = polesOf(Ttf).sort((a, c) => a.hz - c.hz)
    return {
      blocks: [
        T('The amplifier is written out: a transconductance into one resistor and one capacitor, then a buffer. Its pole is the loop’s pole, and closing the loop moves it out by 1 + T.'),
        F('T(s) = \\frac{A_0\\beta}{1 + s/\\omega_p}, \\qquad f_{3dB} = f_p\\,(1 + A_0\\beta), \\qquad f_p = \\frac{f_t}{A_0}'),
        C([
          row('the loop’s own pole, f_t/A₀', fp, tPoles.length ? tPoles[0].hz : NaN, 'Hz', 1e-6),
          row('the return ratio at DC, A₀β', p.A0 * b, evalTF(Ttf, [0, 1e-9])[0], '', 1e-6),
          row('the closed-loop corner', closed, x.corner ? x.corner.high : NaN, 'Hz', 1e-3, { unchecked: low }),
          row('gain × bandwidth', p.ft + G * fp, x.corner ? G * x.corner.high : NaN, 'Hz', 1e-3, { unchecked: low }),
        ]),
        V([
          { label: 'the textbook’s constant product', value: p.ft, unit: 'Hz', note: 'the same number with the open-loop pole dropped' },
          { label: 'the gain the resistors ask for', value: G, unit: '' },
          { label: 'the loop gain left at the corner', value: (p.A0 * b) / Math.sqrt(1 + (closed / fp) ** 2), unit: '', note: 'about one: above the corner there is no loop gain left to spend' },
        ]),
      ],
    }
  },

  l4(p, x) {
    const T0 = loopT(x, 'V2')
    const rInNow = rIn(x)
    const rOutNow = rOut(x)
    // The same ports with the controlled source dead. Blackman's impedance
    // form says the closed value is the dead one times 1 + T at a port the
    // loop mixes into, and divided by 1 + T at a port it samples.
    const rInDead = rIn(x, { A0: 0 })
    const rOutDead = rOut(x, { A0: 0 })
    const gV = solveDC(x.norm, { sources: { V1: 1, It: 0 } }).v.out
    const gI = solveDC(x.norm, { sources: { V1: 0, It: 1 } }).v.out
    return {
      blocks: [
        T('Series mixing puts the fed-back voltage in series with the input, so the source has to push against 1 + T times as much. Shunt sampling takes the output voltage, so a load sees 1 + T times less.'),
        F('R_{in} = R_{in}^{(0)}\\,(1 + T), \\qquad R_{out} = \\frac{R_{out}^{(0)}}{1 + T}'),
        C([
          row('R_in, the loop raising it', rInDead * (1 + T0), rInNow, 'Ω', 1e-6),
          row('R_out, the loop lowering it', rOutDead / (1 + T0), rOutNow, 'Ω', 1e-6),
          row('the output, source and test current together', p.E * gV + p.It * gI, x.sol.v.out, 'V', 1e-6, { abs: 1e-9 }),
        ]),
        V([
          { label: 'the return ratio here', value: T0, unit: '' },
          { label: 'R_in with the loop dead', value: rInDead, unit: 'Ω', note: 'R_i and the divider, nothing more' },
          { label: 'R_out with the loop dead', value: rOutDead, unit: 'Ω' },
        ]),
      ],
    }
  },

  l5(p, x) {
    const Ttf = loopTF(x, 'Vfb')
    const m = loopMargins(Ttf)
    const ring = ringOf(x.poles)
    // Three lag sections give the closed-loop denominator D(s) + A₀, and only
    // its constant term depends on the gain. Every other coefficient is the
    // ladder's, so the sum of the three poles cannot move when the gain does.
    const sumNow = (x.poles || []).reduce((s, q) => s + q.re, 0)
    const sumLadder = polesOf(Ttf).reduce((s, q) => s + q.re, 0)
    const dcGain = solveDC(x.norm, { sources: { V1: 1 } }).v.out
    // Faddeev–LeVerrier loses digits when a circuit's time constants are
    // decades apart, and three sections whose capacitors differ by a thousand
    // is where that starts to show. The row that compares the polynomials with
    // the direct solve says so rather than widening its own tolerance.
    const ratio = Math.max(p.C, p.C3) / Math.min(p.C, p.C3)
    const spread = ratio > 1e3 ? 'The three sections’ time constants are more than three decades apart here, and the polynomials lose digits at that spread.' : null
    return {
      blocks: [
        T('Each section costs the loop phase, and the gain decides where the closed-loop poles land. Two sections keep them left of the axis at any gain. Three carry them across it.'),
        F('L(s) = \\frac{A_0}{D(s)}, \\qquad 1 + L(s) = 0 \\;\\Rightarrow\\; D(s) + A_0 = 0'),
        C([
          row('the loop gain at DC', p.A0, loopT(x, 'Vfb'), '', 1e-6),
          row('the closed-loop gain, A₀/(1 + A₀)', p.A0 / (1 + p.A0), dcGain, '', 1e-9, { abs: 1e-12 }),
          row('the polynomials at DC, against the direct solve', dcGain, x.gain, '', 1e-6, { abs: 1e-12, unchecked: spread }),
          row('the sum of the three poles, gain or no gain', sumLadder, sumNow, 'rad/s', 1e-6),
        ]),
        V([
          { label: 'the phase margin of the loop', value: m.pm, unit: '°', note: m.pm == null ? 'the loop gain never reaches one here' : 'zero is the axis' },
          { label: 'the crossover frequency', value: m.crossover, unit: 'Hz' },
          { label: 'the damping of the ringing pair', value: ring.zeta, unit: '', note: ring.zeta == null ? 'the poles are real here, so nothing rings' : 'negative means the right half plane' },
          { label: 'the step overshoot that damping gives', value: ring.overshoot, unit: '%', note: ring.overshoot == null ? 'no overshoot to quote: the poles are real or unstable' : '' },
          { label: 'the frequency √6/RC, where three equal sections turn 180°', value: Math.sqrt(6) / (p.R * p.C) / (2 * Math.PI), unit: 'Hz', note: p.C3 === p.C ? 'all three sections match here' : 'the third section differs, so the loop turns 180° elsewhere' },
        ]),
      ],
    }
  },

  l6(p, x) {
    const closedOut = rOut(x)
    const gV = solveDC(x.norm, { sources: { V1: 1, It: 0 } }).v.out
    const gI = solveDC(x.norm, { sources: { V1: 0, It: 1 } }).v.out
    return {
      blocks: [
        T('A follower feeds all of its output back, so its return ratio is the whole open-loop gain. The output resistance the load sees is what the amplifier has, divided by one plus that.'),
        F('R_{out} = \\frac{R_{out}^{(0)}}{1 + A_0}, \\qquad v_{out} = V_1\\,\\frac{A_0}{1 + A_0} + I_t\\,R_{out}'),
        C([
          row('the output resistance, by test source', p.rout / (1 + p.A0), closedOut, 'Ω', 1e-6),
          row('the output, source and test current together', p.E * gV + p.It * gI, x.sol.v.out, 'V', 1e-6, { abs: 1e-9 }),
        ]),
        V([
          { label: 'the output resistance before the loop', value: p.rout, unit: 'Ω', note: 'the knob’s own value, which is what an open-loop buffer would show' },
          { label: 'the factor the loop divides it by', value: 1 + p.A0, unit: '' },
          { label: 'what the test current makes at the output', value: p.It * closedOut, unit: 'V' },
        ]),
      ],
    }
  },
}
