import { PLANTS, CONTROLLERS } from './systems.js'
import { bode, dcGain, errorLoop, phaseAt, polesZeros, secondOrderMetrics, isStable, magnitudeAt } from '@ee-labs/systems'

// The math for the loop currently on screen.
//
// Same rule as everywhere in the suite: a two-column comparison only where the
// measured side is genuinely computed from the system rather than restating the
// formula. Here "measured" means evaluated from the composed loop — a margin
// found by walking the frequency response, a pole found by rooting the
// characteristic polynomial — while "theory" is the closed form in terms of the
// plant and controller parameters. Different paths; a dropped term separates
// them at once.

/** An unwrapped phase curve read at one frequency, in degrees, log-interpolated. */
const phaseDegAt = (phase, freqs, f) => {
  let i = 1
  while (i < freqs.length - 1 && freqs[i] < f) i++
  const t = Math.log(f / freqs[i - 1]) / Math.log(freqs[i] / freqs[i - 1])
  return ((phase[i - 1] + t * (phase[i] - phase[i - 1])) * 180) / Math.PI
}

/**
 * PM = 180° + ∠L(jω_gc) — the ONE fold this app uses for that identity,
 * shared by every reader of it in this file rather than each keeping its own
 * copy.
 *
 * This is a regression fix: the topbar's phase margin (margins(), in
 * packages/systems, out of this app's territory) already folds this
 * correctly at its own binding crossover — phase.test.js pins it as "reads
 * 78.5°, not 438.5°". This panel used to recompute the SAME identity from
 * bode()'s continuously unwrapped, per-transfer-function-anchored phase
 * curve instead of asking the loop directly, and an anchor can sit any
 * multiple of 360° from the principal value the fold needs — the unstable
 * plant's own row read 447.134° beside the topbar's 87.1°, 360° off, under
 * every controller. phaseAt() (packages/systems) returns the ordinary atan2
 * principal value, wrapped to (−180°, 180°] with no anchoring at all, so
 * reading it fresh at the exact crossover margins() found — rather than
 * interpolating a plotted, anchored curve — reproduces margins()'s own
 * arithmetic exactly instead of drifting from it.
 */
const phaseMarginAt = (loop, atFreq, stable) => {
  const angleDeg = (phaseAt(loop.open, atFreq) * 180) / Math.PI
  return (stable ? 1 : -1) * (180 - Math.abs(angleDeg))
}

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
    return 'The closed loop carries a zero — from the controller or the plant — which moves the overshoot independently of ζ and breaks the correspondence.'
  }
  if (second.zeta > 0.7) {
    return 'Only holds while the loop is lightly damped — above ζ ≈ 0.7 the approximation behind it fails.'
  }
  return null
}

export function loopMath(plantId, plantP, ctrlId, ctrlP, loop, marg, freqs) {
  try {
    // buildLoop (systems.js) refuses before this pane ever sees a number:
    // an all-zero plant denominator carries `reason` instead of a loop, and
    // computing steady-state error or a DC gain from it would print a tick
    // beside a division by zero rather than the check it claims to be.
    if (loop.reason) return { blocks: [T(loop.reason)] }
    const plant = PLANTS[plantId]
    const ctrl = CONTROLLERS[ctrlId]
    const pz = polesZeros(loop.closed)
    const second = secondOrderMetrics(loop.closed)
    const stable = isStable(loop.closed)
    const closedDc = dcGain(loop.closed)

    // An integrator anywhere in the loop is what kills steady-state error, so
    // it is worth naming rather than leaving the reader to infer it. Counted
    // from the denominator's trailing coefficients RELATIVE to its own scale:
    // an absolute pole test (|re| < 1e-9) once called a custom plant's
    // −1e-12 rad/s pole an integrator and printed "steady-state error is
    // exactly zero" beside its own measurement of 0.5. A genuine integrator
    // has a constant term of exactly zero, not merely a slow pole.
    const openA = loop.open.a
    const aScale = Math.max(...openA.map(Math.abs), 1e-300)
    let integrators = 0
    for (let i = openA.length - 1; i > 0 && Math.abs(openA[i]) < 1e-12 * aScale; i--) integrators++

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
      T(
        'One multiplication carries the whole suite. Signal Lab writes it y = x∗h ⇔ ' +
          'Y(z) = X(z)·H(z); Circuit Lab writes Y(s) = X(s)·H(s); here the same fact composes ' +
          'the loop — blocks in cascade MULTIPLY, L = C·P — and closing the wire turns it into ' +
          'Y/R = L/(1+L). Three vocabularies, one theorem; the row below measures this app’s ' +
          'dialect of it on the loop on screen.',
      ),
      F(`C(s):\\quad ${ctrl.tex}`),
      // The custom plant's formula is built from its live coefficients.
      F(`P(s):\\quad ${typeof plant.tex === 'function' ? plant.tex(plantP) : plant.tex}`),
    ]

    // The multiplication, measured: |C| and |P| each read from their own
    // polynomial, their float product against the composed |L| — polyMul
    // built one side, a multiply builds the other, and a composition bug
    // splits them. Probed at the crossover where one exists (the frequency
    // that decides everything else), mid-sweep otherwise.
    {
      const fProbe = marg.gainCrossover ?? freqs[Math.floor(freqs.length / 2)]
      blocks.push(
        C([
          {
            label: 'cascade multiplies: |C|·|P| = |L|',
            predicted: magnitudeAt(loop.controller, fProbe) * magnitudeAt(loop.plant, fProbe),
            measured: magnitudeAt(loop.open, fProbe),
            tol: 1e-3,
          },
        ]),
      )
    }

    // --- the bridge back to Circuit Lab ---
    //
    // Each named plant carries its circuit analogue: the network that IS this
    // transfer function, with component values computed from the CURRENT
    // parameters. The check rows then build the network from those printed
    // component values and require it to match the plant — so the mapping in
    // the prose is measured, not asserted.
    if (plant.circuit) {
      const ctf = plant.circuit.tf(plantP)
      const f1 = freqs[Math.floor(freqs.length / 3)]
      const f2 = freqs[Math.floor((2 * freqs.length) / 3)]
      const degOf = (tf, f) => (phaseAt(tf, f) * 180) / Math.PI
      blocks.push(
        T('Where a plant like this comes from on a bench: ' + plant.circuit.text(plantP)),
        F(plant.circuit.tex),
        C([
          // Labelled by the probe frequency itself, not by "below/above the
          // corner": the sticky frame drifts while τ is tuned, and a label
          // that names a side can end up on the wrong one (and the
          // integrator plant has no corner to be below).
          {
            label: `|circuit| = |P| at ${Number(f1.toPrecision(3))} Hz`,
            predicted: magnitudeAt(loop.plant, f1),
            measured: magnitudeAt(ctf, f1),
            tol: 1e-3,
          },
          {
            label: `…and at ${Number(f2.toPrecision(3))} Hz`,
            predicted: magnitudeAt(loop.plant, f2),
            measured: magnitudeAt(ctf, f2),
            tol: 1e-3,
          },
          {
            label: '∠circuit = ∠P',
            predicted: degOf(loop.plant, f1),
            measured: degOf(ctf, f1),
            tol: 1e-3,
            abs: 0.05,
          },
        ]),
      )
    } else if (plant.circuitNote) {
      blocks.push(T(plant.circuitNote))
    }

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
          // An unstable loop settles nowhere, so there is no steady state to
          // have an error — the default unstable plant under P sits exactly on
          // the boundary and reads Infinity against −Infinity otherwise.
          unchecked: stable
            ? null
            : 'The loop is not stable, so it settles nowhere and has no steady-state error.',
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
        // Both unit systems, always: the suite plots hertz, the textbook
        // derivations this panel mirrors are written in radians per second.
        {
          label: '…as a textbook writes it',
          value: marg.gainCrossover != null ? 2 * Math.PI * marg.gainCrossover : NaN,
          unit: 'rad/s',
        },
        { label: 'closed-loop poles', value: pz.poles.length },
        { label: 'in the right half plane', value: pz.poles.filter(([re]) => re > 0).length },
      ]),
    )

    // --- where the phase went ---
    //
    // The margin numbers invite the wrong lesson — that stability is about
    // gain. Gain only decides WHERE the crossover sits; what gets spent there
    // is phase, and the spending follows three rules worth saying every time.
    // The rows then measure the accounting on the loop actually on screen.
    blocks.push(
      T(
        'The lag has an accounting, the same three rules every time: each pole costs up to 90° ' +
          'of phase and has already spent 45° of it at its corner frequency; an integrator is a ' +
          'pole at the origin, so its −90° is flat across every frequency; and zeros work the ' +
          'other way — derivative and lead action ADD phase on the same schedule. The phase ' +
          'margin is what is left of 180° once C and P have each taken their share at the ' +
          'crossover.',
      ),
    )

    const phaseRows = []
    let phaseShares = null
    if (marg.gainCrossover != null) {
      // The shares measured separately — the controller's own unwrapped phase
      // curve and the plant's, each read at the crossover the composed loop
      // found — against the composed loop's phase there. series() multiplies
      // the polynomials, this adds the angles; a composition bug splits them.
      const phC = phaseDegAt(bode(loop.controller, freqs).phase, freqs, marg.gainCrossover)
      const phP = phaseDegAt(bode(loop.plant, freqs).phase, freqs, marg.gainCrossover)
      const phL = phaseDegAt(bode(loop.open, freqs).phase, freqs, marg.gainCrossover)
      phaseRows.push({
        label: '∠C + ∠P = ∠L at the crossover',
        predicted: phC + phP,
        measured: phL,
        tol: 0.02,
        abs: 0.5,
      })
      // The phase MARGIN, not the raw accounting total: phL above is read
      // off bode()'s unwrapped, anchored curve, fine for the check row it
      // feeds (both sides share the same anchor and the offset cancels) but
      // wrong to add 180° to directly. foldedPM reads the loop fresh, at
      // this exact crossover, through the one fold (above) the topbar's own
      // margin already uses.
      phaseShares = { phC, phP, foldedPM: phaseMarginAt(loop, marg.gainCrossover, stable) }
    }
    if (ctrlId === 'pi' || ctrlId === 'pid') {
      // "A flat −90°" is a claim about the integrator term alone, and far
      // below the controller's corner that term is all there is — so it is
      // measured there numerically rather than asserted.
      phaseRows.push({
        label: "the integrator's −90°, read far below its corner",
        predicted: -90,
        measured: (phaseAt(loop.controller, 1e-12) * 180) / Math.PI,
        tol: 0.01,
        abs: 0.5,
      })
    }
    if (phaseRows.length) blocks.push(C(phaseRows))
    if (phaseShares) {
      blocks.push(
        V([
          { label: "the controller's share ∠C", value: phaseShares.phC, unit: '°', note: phaseShares.phC > 0 ? 'adds phase' : '' },
          { label: "the plant's share ∠P", value: phaseShares.phP, unit: '°' },
          { label: '180° + ∠L at the crossover', value: phaseShares.foldedPM, unit: '°', note: 'the phase margin' },
        ]),
      )
    }

    // --- the two doors: S and T ---
    //
    // S + T = 1 is NOT offered as a check row: errorLoop and closeLoop build
    // their polynomials from the same additions, so the sum is 1 to the last
    // bit by construction and a row for it could never disagree — the
    // definition of a tick that carries no information. It stays a formula.
    // The row with content is the price at the crossover, which ties the
    // margin (read by walking the frequency response) to |S| (read from the
    // polynomial) through two genuinely different computations.
    const S = errorLoop(loop.open)
    blocks.push(
      T(
        'One more split, and it is the deal the loop cannot escape: what the output follows of ' +
          'the reference is T = L/(1+L), and what survives at the output — of the reference the ' +
          'loop failed to track, of anything shoved in from outside — is S = 1/(1+L), the same ' +
          'E(s) as above. They add to exactly one at every frequency, identically, so no ' +
          'frequency can have both doors closed: |S| and |T| can never both be below ½. Below ' +
          'the crossover the loop has the gain to hold S near zero — it follows r and erases d ' +
          'together. Above it, both revert to doing nothing. The bill comes due at the ' +
          'crossover, where |L| = 1 and NEITHER is small — and a thin phase margin makes both ' +
          'larger than one at once: the loop amplifies precisely at the edge of its authority.',
      ),
      F(
        'S(s) = \\frac{1}{1+L} = E(s), \\qquad T(s) = \\frac{L}{1+L}, \\qquad S + T = 1',
      ),
    )
    if (marg.phaseMargin != null) {
      // At the crossover L = e^{j(PM−180°)}, so |1+L| = 2·sin(PM/2): the
      // sensitivity there is set by the phase margin and nothing else.
      blocks.push(
        C([
          {
            label: 'the price at the crossover: |S| = 1/(2·sin(PM/2))',
            predicted: 1 / (2 * Math.abs(Math.sin((marg.phaseMargin * Math.PI) / 360))),
            measured: magnitudeAt(S, marg.gainCrossover),
            tol: 0.03,
            // 1/(2·sin) blows up toward the boundary faster than the
            // interpolated crossover can follow — the physics stays right,
            // the comparison stops being honest.
            unchecked:
              Math.abs(marg.phaseMargin) < 5
                ? 'Within a few degrees of the boundary the crossover is known too coarsely to price this honestly.'
                : null,
          },
        ]),
      )
    }
    {
      const sMag = bode(S, freqs).mag
      let iPeak = 0
      for (let i = 1; i < sMag.length; i++) if (sMag[i] > sMag[iPeak]) iPeak = i
      const rows = []
      if (marg.gainCrossover != null) {
        rows.push(
          {
            label: '|S| at the crossover',
            value: magnitudeAt(S, marg.gainCrossover),
            note: 'what gets through',
          },
          {
            label: '|T| at the crossover',
            value: magnitudeAt(loop.closed, marg.gainCrossover),
            note: 'equal, |L| is 1 there',
          },
        )
      }
      rows.push({
        label: 'worst amplification, max |S|',
        value: sMag[iPeak],
        // Neither branch introduces a term with no sentence beside it — the
        // cold walk's finding 5. "The sensitivity peak" used to sit here with
        // no TERMS entry and no explanatory sentence anywhere in this pane,
        // the one bare cue the math-pane exclusion's justification (verify.mjs
        // item 33) had missed: it claimed EVERY term here sits beside its own
        // sentence, and this row was the counterexample. Reworded rather than
        // given a definition, because the row's own label already says what
        // the number is ("worst amplification, max |S|") — a definition for
        // "sensitivity peak" would only restate that.
        note: sMag[iPeak] > 2 ? 'a thin margin, priced' : 'a comfortable margin, barely priced',
      })
      rows.push({ label: 'paid at', value: freqs[iPeak], unit: 'Hz' })
      blocks.push(V(rows))
    }

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
          // ωₙ is a rad/s symbol — printing it against a Hz value was a
          // quiet unit mismatch. Both systems, labelled as themselves.
          { label: 'ωₙ', value: 2 * Math.PI * second.f0, unit: 'rad/s' },
          { label: 'fₙ = ωₙ/2π', value: second.f0, unit: 'Hz' },
          {
            label: 'overshoot (ζ-only form)',
            // The e^(−πζ/√(1−ζ²)) form assumes NO closed-loop zeros; with one
            // present the true peak sits higher (a PI loop drew 29.8% beside
            // a claim of 16.3%). The step readout measures the real peak.
            value: loop.closed.b.length > 1 ? NaN : second.overshoot,
            unit: '×',
            note:
              loop.closed.b.length > 1
                ? 'not offered: the closed-loop zero raises the true peak — the step readout measures it'
                : '',
          },
          {
            label: 'settles in',
            // 4/(ζωₙ) is the underdamped envelope estimate. For an overdamped
            // pair it undershot the true 2% time by up to 44x, so it is not
            // offered there.
            value: second.zeta < 1 ? second.settling : NaN,
            unit: 's',
            note:
              second.zeta < 1
                ? 'to within 2%'
                : 'no simple form when overdamped — the slow pole alone sets it; read the step pane',
          },
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
