import { PLANTS, CONTROLLERS } from './systems.js'
import { dcGain, polesZeros, secondOrderMetrics, isStable, magnitudeAt } from '@ee-labs/systems'

// The math for the loop currently on screen.
//
// Same rule as everywhere in the suite: a two-column comparison only where the
// measured side is genuinely computed from the system rather than restating the
// formula. Here "measured" means evaluated from the composed loop — a margin
// found by walking the frequency response, a pole found by rooting the
// characteristic polynomial — while "theory" is the closed form in terms of the
// plant and controller parameters. Different paths; a dropped term separates
// them at once.

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })

/**
 * Why the phase-margin rule of thumb does not apply here, or null if it does.
 *
 * "Phase margin in degrees is about a hundred times the damping ratio" is
 * derived for one specific arrangement: a type-1 loop, L = wn^2/(s(s+2 zeta wn)),
 * whose closed form is a clean second-order pair with no zeros, and only while
 * the damping is light enough for the approximation behind it to hold.
 *
 * Applied outside that it is simply wrong, and it was: a second-order plant
 * under proportional control has no integrator and reads 0.21 against a
 * predicted 0.50. Stating the preconditions is the difference between teaching
 * a useful approximation and teaching a false identity.
 */
function ruleOfThumbBlocker(marg, second, loop, integrators, pz) {
  if (marg.phaseMargin == null) {
    return 'No gain crossover, so there is no phase margin to compare against.'
  }
  if (pz.poles.some(([re]) => re > 0)) {
    return 'The loop is unstable, so its damping ratio does not describe a settling response.'
  }
  if (integrators !== 1) {
    return `The rule is derived for a loop with exactly one integrator; this one has ${integrators}. Without that the crossover and the closed-loop pair are not related in the way it assumes.`
  }
  if (loop.closed.b.length > 1) {
    return 'The controller puts a zero in the closed loop, which moves the overshoot independently of ζ and breaks the correspondence.'
  }
  if (second.zeta > 0.7) {
    return 'Only holds while the loop is lightly damped — above ζ ≈ 0.7 the approximation behind it fails.'
  }
  return null
}

export function loopMath(plantId, plantP, ctrlId, ctrlP, loop, marg, freqs) {
  try {
    const plant = PLANTS[plantId]
    const ctrl = CONTROLLERS[ctrlId]
    const pz = polesZeros(loop.closed)
    const second = secondOrderMetrics(loop.closed)
    const stable = isStable(loop.closed)
    const closedDc = dcGain(loop.closed)

    // An integrator anywhere in the loop is what kills steady-state error, so
    // it is worth naming rather than leaving the reader to infer it.
    const openPoles = polesZeros(loop.open).poles
    const integrators = openPoles.filter(([re, im]) => Math.abs(re) < 1e-9 && Math.abs(im) < 1e-9).length

    const blocks = [
      T(
        'Feedback subtracts the output from the reference and drives the plant with what is ' +
          'left. Two transfer functions follow from that one loop: what gets through, and what ' +
          'does not.',
      ),
      F(
        'L(s) = C(s)P(s), \\qquad T(s) = \\frac{L}{1+L}, \\qquad E(s) = \\frac{1}{1+L}',
      ),
      T(
        'The denominator is the same in both, and setting it to zero gives the characteristic ' +
          'equation 1 + L = 0. Everything about stability is a statement about whether that has ' +
          'a solution in the right half plane — which is why the Nyquist view is a plot of L ' +
          'against the single point −1.',
      ),
      F(`C(s):\\quad ${ctrl.tex}`),
      F(`P(s):\\quad ${plant.tex}`),
    ]

    // --- steady-state error, and why ---
    blocks.push(
      T(
        integrators > 0
          ? `There ${integrators === 1 ? 'is an integrator' : `are ${integrators} integrators`} in the loop — a pole at the origin — so the loop gain is infinite at DC and the steady-state error to a step is exactly zero. The integral keeps accumulating until there is nothing left to accumulate.`
          : 'There is no integrator in the loop, so the DC gain is finite and the error cannot ' +
            'reach zero: zero error would mean zero drive, and the plant would not be held ' +
            'anywhere. What is left over is 1/(1+L) evaluated at DC.',
      ),
      F('e_{ss} = \\frac{1}{1 + L(0)}'),
      C([
        {
          label: 'steady-state error',
          predicted: integrators > 0 ? 0 : 1 / (1 + dcGain(loop.open)),
          measured: 1 - closedDc,
          tol: 0.01,
          abs: 1e-6,
        },
      ]),
    )

    // --- margins ---
    blocks.push(
      T(
        'Phase margin and gain margin ask the same question from two sides: how far is L from ' +
          'being −1 at some real frequency? Phase margin is how much extra lag the loop would ' +
          'tolerate at the frequency where its gain is already 1. Gain margin is how much extra ' +
          'gain it would tolerate at the frequency where the phase has already reached −180°.',
      ),
      F(
        '\\text{PM} = 180^\\circ + \\angle L(j\\omega_{gc}) \\quad\\text{where}\\quad |L(j\\omega_{gc})| = 1',
      ),
      F('\\text{GM} = \\frac{1}{|L(j\\omega_{pc})|} \\quad\\text{where}\\quad \\angle L(j\\omega_{pc}) = -180^\\circ'),
    )

    const marginRows = []
    if (marg.gainCrossover != null) {
      marginRows.push({
        label: 'gain at the crossover',
        predicted: 1,
        measured: magnitudeAt(loop.open, marg.gainCrossover),
        tol: 0.02,
      })
    }
    if (marg.gainMargin != null) {
      // If the margin is real, multiplying the gain by exactly it should put the
      // loop on the edge. This is the claim, checked.
      marginRows.push({
        label: 'gain at the −180° point',
        predicted: 1 / marg.gainMargin,
        measured: magnitudeAt(loop.open, marg.phaseCrossover),
        tol: 0.02,
      })
    }
    if (marginRows.length) blocks.push(C(marginRows))

    blocks.push(
      V([
        {
          label: 'phase margin',
          value: marg.phaseMargin ?? NaN,
          unit: '°',
          note: marg.phaseMargin == null ? 'gain never reaches 1' : marg.phaseMargin < 30 ? 'thin' : '',
        },
        {
          label: 'gain margin',
          value: marg.gainMargin ?? NaN,
          unit: '×',
          note: marg.gainMargin == null ? 'phase never reaches −180°' : '',
        },
        { label: 'crossover frequency', value: marg.gainCrossover ?? NaN, unit: 'Hz' },
        { label: 'closed-loop poles', value: pz.poles.length },
        { label: 'in the right half plane', value: pz.poles.filter(([re]) => re > 0).length },
      ]),
    )

    // --- the frequency/time link ---
    if (second) {
      blocks.push(
        T(
          'This closed loop is second order, so the frequency-domain margin and the ' +
            'time-domain overshoot are two views of one number. The rule of thumb every ' +
            'controls course teaches is that phase margin in degrees is roughly a hundred times ' +
            'the damping ratio. It is an approximation with conditions attached — one ' +
            'integrator in the loop, no closed-loop zeros, and light damping — and where those ' +
            'do not hold the row below says so rather than pretending.',
        ),
        F('\\zeta \\approx \\frac{\\text{PM}^\\circ}{100}, \\qquad M_p = e^{-\\pi\\zeta/\\sqrt{1-\\zeta^2}}'),
        C([
          {
            label: 'ζ from the closed loop',
            predicted: second.zeta,
            measured: marg.phaseMargin != null ? marg.phaseMargin / 100 : NaN,
            // A rule of thumb, not an identity, so the tolerance is generous —
            // and it is only offered where the rule actually applies.
            tol: 0.3,
            abs: 0.06,
            unchecked: ruleOfThumbBlocker(marg, second, loop, integrators, pz),
          },
        ]),
        V([
          { label: 'ζ', value: second.zeta, note: second.zeta >= 1 ? 'no overshoot' : 'rings' },
          { label: 'ωn', value: second.f0, unit: 'Hz' },
          { label: 'overshoot', value: second.overshoot, unit: '×' },
          { label: 'settles in', value: second.settling, unit: 's', note: 'to within 2%' },
        ]),
      )
    }

    if (!stable) {
      blocks.push(
        T(
          'This loop is unstable: at least one closed-loop pole is in the right half plane, so ' +
            'the step response grows without bound. On the Nyquist view the locus has moved so ' +
            'that it no longer keeps −1 on the correct side; on the root locus a branch has ' +
            'crossed into the shaded half.',
        ),
      )
    }

    return { blocks }
  } catch {
    return null
  }
}
