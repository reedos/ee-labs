// Group F's three registers. Every number is a reading the solver produced,
// or arithmetic over one: the meter's rounding, the maker's specification, the
// sensitivities of the divider, and the two noise formulas. Nothing in this
// group is simulated noise — F4's floor is stated from its closed form and
// labelled as the model it is.

import { K_B, enbwOf } from '../math.js'

/** The two terms of a specification, each on its own, from the knobs. */
const pctTerm = (x, p) => (p.pct / 100) * Math.abs(x.meter.shown)
const countsTerm = (x, p) => p.terms * x.meter.step
/** The thermal density of the input resistance, and the rms the capacitance leaves of it. */
const density = (x, p) => Math.sqrt(4 * K_B * p.T * p.R2)
const vrms = (x, p) => Math.sqrt((K_B * p.T) / p.C2)
const countOf = (x, p) => p.range / (p.counts + 1)

export const LESSONS_F = {
  f1: {
    see:
      'The circuit hands the meter 4.7619 V and the display shows 4.76 V. A 3½-digit meter has 1999 ' +
      'counts, so on the 20 V range it steps in 10 mV. Half a step, ±5 mV, is the whole of its ' +
      'resolution. That is ±0.105 % of the reading, and it is not the error the meter made by being there.',
    seeReads: [
      ['meter.read', 4.76190476],
      ['meter.shown', 4.76],
      ['meter.step', 0.01],
      ['meter.halfCount', 0.005],
      ['meter.resPct', 0.105],
    ],
    try: [
      {
        say: 'Switch the display to 4½ digits. The count falls to 1 mV, the display shows 4.762 V, and half a count is ±0.5 mV, or ±0.0105 %.',
        set: { counts: 19999 },
        reads: [
          ['meter.step', 1e-3],
          ['meter.shown', 4.762],
          ['meter.halfCount', 5e-4],
          ['meter.resPct', 0.0105],
        ],
      },
      {
        say: 'Switch to 6½ digits. The count is 10 µV and the display reads 4.7619 V. The loading error is still 4.762 %, because more digits resolve the reading without correcting it.',
        set: { counts: 1999999 },
        reads: [
          ['meter.step', 1e-5],
          ['meter.shown', 4.7619],
          ['meter.errorPct', -4.7619048],
        ],
      },
      {
        say: 'Back to 3½ digits, and switch to the 200 V range. The count is 100 mV, the display shows 4.8 V, and the resolution is ±1.05 %. A range too large throws digits away.',
        set: { counts: 1999, range: 200 },
        reads: [
          ['meter.step', 0.1],
          ['meter.shown', 4.8],
          ['meter.resPct', 1.05],
        ],
      },
    ],
    why:
      'A display of N counts plus the zero divides its range into N+1 steps, so a step is F/(N+1). ' +
      'The 20 V range over two thousand steps is 10 mV. Rounding to the nearest step is the last thing ' +
      'that happens to a reading. It can neither add information nor remove an error made earlier. ' +
      'Half a step is the most that rounding costs, and quoting a reading more finely is quoting the ' +
      'arithmetic rather than the measurement. The loading error C1 measured, 4.762 %, is forty-five ' +
      'times the ±0.105 % this display resolves, so digits bought here buy nothing. Resolution is one ' +
      'claim about a reading, and accuracy is another. F2 is the second.',
    whyReads: [
      ['meter.step', 0.01],
      ['meter.resPct', 0.105],
      ['meter.errorPct', -4.7619048],
    ],
  },

  f2: {
    see:
      'The maker’s specification is ±(0.5 % of reading + 2 counts). On the 20 V range that is 23.8 mV ' +
      'plus 20 mV, so the reading is worth ±43.8 mV, or ±0.920 %. The error the meter made by being ' +
      'connected is 238 mV, and no accuracy specification mentions it.',
    seeReads: [
      [pctTerm, 0.0238],
      [countsTerm, 0.02],
      ['meter.spec', 0.0438],
      ['meter.pct', 0.92016807],
      ['meter.error', -0.23809524],
    ],
    try: [
      {
        say: 'Set the counts term to 5. The specification grows to ±73.8 mV, or ±1.55 %, and the per-cent term has not moved.',
        set: { terms: 5 },
        reads: [
          ['meter.spec', 0.0738],
          ['meter.pct', 1.5504202],
          [pctTerm, 0.0238],
        ],
      },
      {
        say: 'Set the per cent of reading to 0.1 % with two counts back. The specification is ±24.8 mV, of which 20 mV is the counts term. Near the bottom of a range the counts win.',
        set: { pct: 0.1, terms: 2 },
        reads: [
          ['meter.spec', 0.02476],
          [countsTerm, 0.02],
        ],
      },
      {
        say: 'Set both resistors to 10 kΩ. The loading error collapses to 2.50 mV while the specification is ±45.0 mV, so now the maker’s number is the larger of the two by eighteen times.',
        set: { R1: 1e4, R2: 1e4 },
        reads: [
          ['meter.error', -0.0024987506],
          ['meter.spec', 0.045],
        ],
      },
    ],
    why:
      'Two terms, and which of them wins depends on where in the range the reading sits. The per-cent ' +
      'term follows the reading, so it dominates near full scale. The counts term is fixed by the ' +
      'range, so it dominates at the bottom of it. Read a tenth of full scale and the counts term is ' +
      '20 mV against 10 mV of per-cent term. That is why a meter belongs on the smallest range that ' +
      'holds the signal. A specification is also a claim about the instrument alone, made against a ' +
      'source that does not sag. It says nothing about what the leads did, and nothing about the ' +
      '238 mV this divider lost to loading. F3 propagates the circuit’s own tolerances separately.',
    whyReads: [
      [countsTerm, 0.02],
      [(x, p) => (p.pct / 100) * (p.range / 10), 0.01],
      ['meter.error', -0.23809524],
    ],
  },

  f3: {
    see:
      'The divider gives 5.000 V, and its two resistors are 1 % parts. A per cent on R₁ moves the output ' +
      'by −0.5 % and a per cent on R₂ moves it by +0.5 %. Added in quadrature the reading is worth ' +
      '±0.707 %, and in the worst case ±1.000 %.',
    seeReads: [
      ['v.out', 5],
      ['sens.R1', -0.5],
      ['sens.R2', 0.5],
      ['sens.quad', 0.70710678],
      ['sens.worst', 1],
    ],
    try: [
      {
        say: 'Raise R₁ to 90 kΩ. The output falls to 1.000 V, both sensitivities grow to nine tenths, and the quadrature sum grows with them to ±1.273 %.',
        set: { R1: 9e4 },
        reads: [
          ['v.out', 1],
          ['sens.R1', -0.9],
          ['sens.R2', 0.9],
          ['sens.quad', 1.2727922],
        ],
      },
      {
        say: 'Set the tolerance to 5 %. Nothing in the circuit changes. The quadrature sum grows to ±3.536 % and the worst case to ±5.000 %, both in proportion.',
        set: { tol: 5 },
        reads: [
          ['sens.quad', 3.5355339],
          ['sens.worst', 5],
        ],
      },
      {
        say: 'Raise both resistors by 1 %, to 10.1 kΩ each. The output does not move at all. It is 5.000 V still, because a divider carries the ratio of its resistors and nothing else.',
        set: { R1: 10100, R2: 10100 },
        reads: [['v.out', 5, 1e-12]],
      },
    ],
    why:
      'Write the output as a product of powers and the logarithms add, so differentiating brings each ' +
      'input in multiplied by its own ∂ln y/∂ln x. A per cent in gives that sensitivity times a per cent ' +
      'out. For a divider the two are −R₁/(R₁+R₂) and +R₁/(R₁+R₂), equal and opposite, and at equal ' +
      'resistors each is a half. Errors that are independent add in quadrature, which is ±0.707 % here. ' +
      'Errors that may conspire add by their magnitudes, which is ±1.000 %. The panel prints an exact ' +
      're-solve beside each row, because a sensitivity is the first term of a Taylor series and nothing ' +
      'more. Move both resistors the same way and the two contributions cancel exactly, which is the ' +
      'ratio speaking.',
  },

  f4: {
    see:
      'A 1 MΩ input at 300 K carries √(4kTR) = 128.7 nV/√Hz of thermal noise. The capacitance across it ' +
      'passes that over 16.67 kHz of noise bandwidth, and the two multiplied are 16.62 µV rms across the ' +
      'capacitor. That is √(kT/C), it is the noise floor of the front end, and it is stated rather than ' +
      'simulated.',
    seeReads: [
      [density, 1.2871592e-7],
      [(x, p) => enbwOf(p.R2, p.C2), 16666.667],
      [vrms, 1.6617154e-5],
    ],
    try: [
      {
        say: 'Lower the input resistance to 1 kΩ. The density falls to 4.07 nV/√Hz and the bandwidth rises to 16.67 MHz. Their product is 16.62 µV again, because the resistance cancels.',
        set: { R2: 1e3 },
        reads: [
          [density, 4.0703548e-9],
          [(x, p) => enbwOf(p.R2, p.C2), 16666667],
          [vrms, 1.6617154e-5],
        ],
      },
      {
        say: 'Raise the input capacitance to 1 nF. The bandwidth falls to 250 Hz and the rms falls to 2.035 µV, because the capacitance is all that is left in √(kT/C).',
        set: { C2: 1e-9 },
        reads: [
          [(x, p) => enbwOf(p.R2, p.C2), 250],
          [vrms, 2.0351774e-6],
        ],
      },
      {
        say: 'Cool the input to 4 K. The density falls to 14.86 nV/√Hz and the rms to 1.919 µV, each as the square root of the temperature.',
        set: { T: 4 },
        reads: [
          [density, 1.4862834e-8],
          [vrms, 1.9187836e-6],
        ],
      },
    ],
    why:
      'Both numbers are models, and this lab generates no noise anywhere. They come from their ' +
      'formulas and are drawn as labelled bands, never as a wiggle on a trace. A resistance carries ' +
      '4kTR volts squared per hertz open-circuit, and the capacitance across it passes that over ' +
      '1/(4RC) of bandwidth. Multiply, and R cancels. What is left is kT/C, which is 16.62 µV rms here ' +
      'whatever the resistance is. The meter of F1 counts in 10 mV, six hundred times larger, so what ' +
      'limits that reading is its display and not its physics. Which floor matters is a question about ' +
      'the instrument. A lock-in with a filter a few hertz wide is listening far below either of them.',
    whyReads: [
      [vrms, 1.6617154e-5],
      [countOf, 0.01],
    ],
  },
}
