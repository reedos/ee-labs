// Group O's math panel, merged into the lab's one registry by mathEntries.js.
//
// Two of these entries check a closed form against a solve, which is the
// usual shape. O1's check a statistic against what the estimator says about
// itself: the spread across bins against √(2/dof), and the estimate against
// the density the generator was given, which is only expected to land once
// enough frames have been averaged. That threshold is stated on the row.

import { cornerOf, ktOverC, noiseBandwidth, noiseOf, shotDensity, stageOf, thermalDensity } from './o.js'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.02, extra = {}) => ({ label, predicted, measured, unit, tol, ...extra })

const K_B = 1.380649e-23
const Q_E = 1.602176634e-19

/**
 * The noise figure of the common-emitter stage, written out.
 *
 * Three sources, each referred to the source resistance's own thermal noise.
 * The base's shot noise flows in R_s ∥ r_π, not in R_s alone, which is the
 * whole of the difference between this and the textbook's 1 + 1/√β.
 */
export function ceFigure(p) {
  const { gm, ib } = stageOf(p)
  const rpi = p.beta / gm
  const par = (p.Rs * rpi) / (p.Rs + rpi)
  const ref = (4 * K_B * p.T) / p.Rs
  const base = 2 * Q_E * ib
  const coll = (2 * Q_E * p.ic) / (gm * gm * par * par)
  return 1 + (base + coll) / ref
}

/** The signal-to-noise ratio the source resistance alone would allow, in decibels. */
export const sourceLimit = (p) =>
  20 * Math.log10(p.vsig / Math.SQRT2 / (thermalDensity(p.Rs, p.T) * Math.sqrt(Math.max(p.bw - 1, 1e-30))))

export const MATH_O = {
  o1(p, x) {
    const n = noiseOf(x)
    const given = p.rms / Math.sqrt(p.fs / 2)
    // One frame's estimate has the same standard deviation as the density it
    // is estimating, so it is not expected to land on it. The row says so
    // rather than failing, and the spread row below is the claim that holds
    // at every number of frames.
    const enough = p.averages >= 10 ? null : 'One frame carries two degrees of freedom, so its estimate scatters by its own height and is not expected to land on the density.'
    return {
      blocks: [
        T('A random signal has no lines. What it has is a density, and one frame of it is a poor estimate of that density. Averaging frames is what turns the estimate into a floor.'),
        F('S = \\frac{v_{rms}^2}{f_s/2}, \\qquad \\frac{\\sigma_{\\hat S}}{S} = \\sqrt{\\frac{2}{\\nu}}, \\qquad \\nu = 2M'),
        C([
          row('the density the rms and the sample rate give', given, n.measured, 'V', 0.06, { unchecked: enough }),
          row('the integral of it over the band', p.rms, n.integral, 'V', 0.06, { unchecked: enough }),
          // This one holds at every number of frames, and it is the claim the
          // experiment exists to make.
          row('the spread across bins, √(2/ν)', n.relativeSe, n.flatness, '', 0.2),
        ]),
        V([
          { label: 'frames averaged', value: n.segments, unit: '', note: 'each one an independent periodogram' },
          { label: 'degrees of freedom', value: n.dof, unit: '', note: 'two per frame' },
          { label: 'the band the record covers', value: n.band[1], unit: 'Hz', note: 'nothing above half the sample rate is measured' },
        ]),
      ],
    }
  },

  o2(p, x) {
    const n = noiseOf(x)
    const fc = cornerOf(p)
    // The density is quoted at one hertz, which is the flat part only while
    // the corner is well above it.
    const flat = fc > 1000 ? null : 'The corner has come down to the frequency the density is quoted at, so what is read there is already on the roll-off.'
    return {
      blocks: [
        T('A resistance carries a noise voltage of its own. The capacitor beside it sets how much of that noise arrives, and the two effects of raising the resistance cancel exactly.'),
        F('v_n = \\sqrt{4kTR}, \\qquad B_n = \\frac{\\pi}{2}f_c = \\frac{1}{4RC}, \\qquad v_{n,rms} = \\sqrt{\\frac{kT}{C}}'),
        C([
          row('the density, √(4kTR)', thermalDensity(p.R1, p.T), n.density, 'V', 1e-6, { unchecked: flat }),
          row('the rms over the band, √(kT/C)', ktOverC(p.C1, p.T), n.rms, 'V', 2e-3),
          row('the noise bandwidth the two imply', noiseBandwidth(fc), n.density > 0 ? (n.rms / n.density) ** 2 : NaN, 'Hz', 5e-3, { unchecked: flat }),
        ]),
        V([
          { label: 'the −3 dB corner', value: fc, unit: 'Hz', note: 'the noise bandwidth is π/2 of it' },
          { label: 'the band the integral ran over', value: n.band[1], unit: 'Hz', note: 'from a ten-thousandth of the corner, which leaves 0.064 % of the power in each tail' },
        ]),
      ],
    }
  },

  o3(p, x) {
    const n = noiseOf(x)
    const pt = x.point && x.point.D1
    const rd = pt ? pt.rd : NaN
    return {
      blocks: [
        T('A current crossing a junction arrives as separate charges, and the count in any interval has a spread. That spread is the noise, and it depends on the current alone.'),
        F('i_n = \\sqrt{2qI}, \\qquad r_d = \\frac{V_T}{I}, \\qquad \\frac{2qI\\,r_d^2}{4kT\\,r_d} = \\frac{1}{2}'),
        C([
          // The slope is the derivative of Shockley's law, so what divides V_T
          // is the current plus the saturation current rather than the current
          // alone. At a milliamp the two differ by a part in 10¹¹.
          row('the junction’s own slope, V_T/(I + I_S)', (K_B * p.T) / Q_E / (p.i + p.is), rd, 'Ω', 1e-6),
          row('the shot current the density implies', shotDensity(p.i), Number.isFinite(rd) ? n.density / rd : NaN, 'A', 1e-6),
          // Exactly one half once I_S is negligible against I. The slope
          // divides V_T by I + I_S while the shot noise follows I alone, so
          // the ratio carries that factor and the row keeps it rather than
          // rounding it into the tolerance.
          row('the shot power against a resistor of the same slope', (0.5 * p.i) / (p.i + p.is), Number.isFinite(rd) ? (n.density / thermalDensity(rd, p.T)) ** 2 : NaN, '', 1e-9),
        ]),
        V([
          { label: 'the voltage the shot current makes here', value: n.density, unit: 'V', note: 'per root hertz, across the junction’s own slope' },
          { label: 'a resistor of the same slope, for comparison', value: thermalDensity(rd, p.T), unit: 'V', note: 'per root hertz, and it is √2 larger' },
        ]),
      ],
    }
  },

  o4(p, x) {
    const n = noiseOf(x)
    const { gm } = stageOf(p)
    const best = Math.sqrt(p.beta) / gm
    const atBest = Math.abs(p.Rs - best) / best < 0.01
    return {
      blocks: [
        T('Three sources reach the collector. The source resistance’s own noise is the reference the figure is against, the base current’s shot noise grows with that resistance, and the collector current’s shrinks with it.'),
        F('F = 1 + \\frac{2qI_B + 2qI_C/(g_m^2(R_s\\|r_\\pi)^2)}{4kT/R_s}, \\qquad R_{s,opt} = \\frac{\\sqrt{\\beta}}{g_m}'),
        C([
          row('the noise factor of this stage', ceFigure(p), n.f, '', 1e-6),
          row('the textbook figure at the optimum, 1 + 1/√β', 1 + 1 / Math.sqrt(p.beta), n.f, '', 0.02, {
            // The closed form sends the base's noise current through R_s
            // alone. In the circuit r_π sits across the same node, and at the
            // optimum R_s is a tenth of it, so the measurement comes out about
            // one per cent above the closed form.
            unchecked: atBest ? null : 'The textbook figure is the value at the optimum source resistance, and R_s is not set to it here.',
          }),
        ]),
        V([
          { label: 'the optimum source resistance, √β/g_m', value: best, unit: 'Ω' },
          { label: 'the figure in decibels', value: n.nf, unit: 'dB', note: 'ten times the log of the factor above' },
          { label: 'the transconductance the bias sets', value: gm, unit: 'A/V' },
        ]),
      ],
    }
  },

  o5(p, x) {
    const n = noiseOf(x)
    const stack = n.snrdb || {}
    // With no capacitor anywhere the density is flat, so the rms over the band
    // is the density times the root of the band's width. That identity is what
    // makes the ratio below readable as one number.
    const width = n.band[1] - n.band[0]
    const figure = sourceLimit(p) - (stack.d ?? NaN)
    const firstGain = n.gain && n.gain.b > 0 ? n.gain.c / n.gain.b : NaN
    return {
      blocks: [
        T('The signal and the noise are read at the same node and over the same band, so every gain after that node multiplies both and leaves the ratio alone. What a later stage can still do is add noise of its own.'),
        F('F_{chain} = F_1 + \\frac{F_2 - 1}{G_1}, \\qquad \\mathrm{SNR} = \\frac{v_{sig}/\\sqrt{2}}{v_{n,rms}}'),
        C([
          row('the band, from the rms over the density', width, n.density > 0 ? (n.rms / n.density) ** 2 : NaN, 'Hz', 5e-3),
          row('what the second stage costs the ratio', 0, (stack.c ?? NaN) - (stack.d ?? NaN), 'dB', 1e-9, {
            // Friis divides the second stage's excess by the gain in front of
            // it, so the claim that it costs nothing is a claim about that
            // gain. Without gain in the first stage the second one is as loud
            // as the first, and the row says so instead of failing.
            abs: 0.05,
            unchecked: firstGain > 10 ? null : 'The first stage has almost no gain at this bias, so the second stage’s noise is not divided down by anything.',
          }),
          row('the figure of the chain, from the two ratios', 10 * Math.log10(chainFactor(n)), figure, 'dB', 0.05),
        ]),
        V([
          { label: 'the ratio the source resistance alone would allow', value: sourceLimit(p), unit: 'dB' },
          { label: 'the ratio at the first stage’s output', value: stack.c, unit: 'dB' },
          { label: 'the ratio at the second stage’s output', value: stack.d, unit: 'dB', note: 'the same ratio, after a gain of the second stage' },
        ]),
      ],
    }
  },
}

/** The chain's noise factor from the stack: the total over the source's own share. */
function chainFactor(n) {
  const total = n.powers ? Object.values(n.powers).reduce((a, b) => a + b, 0) : NaN
  const ref = n.powers ? n.powers.Rs : NaN
  return ref > 0 ? total / ref : NaN
}
