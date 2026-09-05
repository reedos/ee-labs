// Group N's math panel, merged into the lab's one registry by mathEntries.js.
//
// Every predicted column is written from the knobs, so turning a knob moves
// both columns. Two of the closed forms carry a term a textbook drops. The
// Wien bridge's threshold is not three but three plus G²/A₀, and the
// relaxation oscillator's period does not contain the supply at all. Where a
// setting cannot show a row — the oscillation has not reached its limiter yet,
// or the poles have gone real — the row is footnoted with the reason instead
// of being crossed out.

import { colpittsF0, decayConstant, gainOf, oscOf, relaxPeriod, seriesC, swingAt, betaOf, wienBetaDeg, wienBetaMag, wienF0 } from './n.js'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.02, extra = {}) => ({ label, predicted, measured, unit, tol, ...extra })

/**
 * The Wien loop's growth rate, exactly.
 *
 * The characteristic polynomial of the bridge with an op-amp of finite gain is
 * s² + [(3 − G) + G²/A₀]s/(RC) + 1/(RC)², so the real part of the pole pair is
 * half the middle coefficient with its sign turned. The G²/A₀ term is the one
 * a textbook drops, and it is the whole of the difference between a threshold
 * at three and a threshold a little above it.
 */
export const wienSigma = (p) => {
  const G = gainOf(p)
  return (G - 3 - (G * G) / p.A0) / (2 * p.Rw * p.Cw)
}

/** The gain at which the pole pair reaches the axis, from G²/A₀ − G + 3 = 0. */
export const wienThreshold = (p) => (p.A0 - Math.sqrt(Math.max(p.A0 * p.A0 - 12 * p.A0, 0))) / 2

/**
 * The amplitude the describing function predicts for a tank driven by a
 * current-limited transconductor. The limited current is a square wave of
 * ±I_max, its fundamental is 4/π of that, and the tank turns it into a voltage
 * through the loss resistance referred across the whole tank. The estimate is
 * labelled where it is printed and carries the guard the panel states.
 */
export const squareEstimate = (p) => (4 / Math.PI) * p.ilim * p.Rb * ((p.C1 + p.C2) / p.C1) ** 2

/**
 * How far the tank's loss resistance sits above the tap capacitor's reactance
 * at the tank's own frequency. The frequency's closed form treats C₂ as
 * unloaded, and this ratio is how far that holds.
 */
export const tankQ = (p) => p.Rb * 2 * Math.PI * colpittsF0(p) * p.C2

/** The pole pair the polynomials report, or null where the poles have gone real. */
const pair = (x) => (x.poles || []).find((q) => Math.abs(q.im) > 1e-12) || null

/**
 * Has the walk shown a whole limit cycle? Two rail crossings and a period the
 * crossings could be counted between. Without them the run holds a fraction of
 * one swing, and a row read off it would be reading the start rather than the
 * steady state.
 */
const settled = (x, o) => !!x.tr && x.tr.events.length >= 3 && o.period > 0

/** Did the run stay linear across the whole window the growth is fitted over? */
const stillGrowing = (x) => {
  const at = (x.exp.osc && x.exp.osc.growAt) || [0.05, 0.2]
  const first = x.tr && x.tr.events.length ? x.tr.events[0].t : Infinity
  return first > at[1] * x.tEnd
}

export const MATH_N = {
  n1(p, x) {
    const q = pair(x)
    const wn = 1 / (p.Rw * p.Cw)
    const real = !q ? 'The gain is far enough from three that the two poles are real, so there is no pair to read a frequency off.' : null
    return {
      blocks: [
        T('The Wien network passes a third of the output at one frequency and passes it with no phase shift. The amplifier makes up the other three, and where its gain sits sets which side of the axis the poles are on.'),
        F('s^2 + \\frac{(3 - G) + G^2/A_0}{RC}\\,s + \\frac{1}{(RC)^2} = 0, \\qquad G = 1 + \\frac{R_f}{R_g}'),
        F('\\beta(j\\omega_0) = \\frac{v_p}{v_{out}} = \\frac{1}{3}, \\qquad \\angle\\beta(j\\omega_0) = 0^\\circ'),
        C([
          // Barkhausen's condition, measured rather than asserted. The two
          // arms are driven from the amplifier's output and what comes back to
          // the + input is read, which is the loop broken at the one place it
          // can be broken without the op-amp in it. `returnRatio` declines an
          // OPAMP element by type, so the return ratio itself is not on offer.
          row('what the network passes back at f₀', 1 / 3, wienBetaMag(p, wienF0(p)), '', 1e-9),
          row('the phase it passes it with', 0, wienBetaDeg(p, wienF0(p)), '°', 1e-9, { abs: 1e-9 }),
          row('the pair’s distance from the origin, 1/RC', wn, q ? Math.hypot(q.re, q.im) : NaN, 'rad/s', 1e-6, { unchecked: real }),
          row('the frequency that is, 1/(2πRC)', wienF0(p), q ? Math.hypot(q.re, q.im) / (2 * Math.PI) : NaN, 'Hz', 1e-6, { unchecked: real }),
          row('the growth rate σ', wienSigma(p), q ? q.re : NaN, 'rad/s', 2e-3, { abs: 1e-4 * wn, unchecked: real }),
        ]),
        V([
          { label: 'the closed-loop gain the resistors set', value: gainOf(p), unit: '', note: 'three is where a textbook puts the threshold' },
          { label: 'the gain that actually reaches the axis', value: wienThreshold(p), unit: '', note: 'three plus G²/A₀, which the op-amp’s own gain sets' },
        ]),
      ],
    }
  },

  n2(p, x) {
    const o = oscOf(x)
    const railed = settled(x, o) && Number.isFinite(o.high)
    return {
      blocks: [
        T('Poles in the right half plane give an answer that grows for ever. What stops it is not linear, and here it is the rails. The output clips, the gain the loop sees at the fundamental falls, and the amplitude settles where that gain is three.'),
        F('v_{out} \\to \\pm V_{sat}, \\qquad \\sigma = \\frac{(G - 3) - G^2/A_0}{2RC}'),
        C([
          row('the amplitude the rails set', p.vsat, o.high, 'V', 1e-6, {
            unchecked: railed ? null : 'The output has not settled into a whole cycle against the rails inside this window, so there is no steady amplitude yet.',
          }),
          row('the growth rate σ, from the envelope', wienSigma(p), o.growthRate, 'rad/s', 0.02, {
            unchecked: !Number.isFinite(o.growthRate)
              ? 'The output has no peaks to fit an envelope to over this stretch, so there is no growth rate to read.'
              : stillGrowing(x)
                ? null
                : 'The output meets a rail before the end of the stretch the envelope is fitted over, so what is fitted there is not the exponential.',
          }),
        ]),
        V([
          { label: 'distortion of the settled output', value: 100 * o.thd, unit: '%', note: 'over the first twelve harmonics' },
          { label: 'the frequency the loop runs at', value: o.f, unit: 'Hz', note: 'below the network’s own, because part of each cycle is spent against a rail' },
          { label: 'the network’s own frequency, 1/(2πRC)', value: wienF0(p), unit: 'Hz' },
        ]),
      ],
    }
  },

  n3(p, x) {
    const o = oscOf(x)
    const b = betaOf(p)
    const swing = swingAt(x, 'p', 0.2)
    const tau = decayConstant(x, 'n')
    const running = settled(x, o) ? null : 'This window holds less than one whole cycle, so what it shows is the start-up and not the steady oscillation.'
    return {
      blocks: [
        T('The capacitor charges toward the rail the output is on. When it reaches the threshold the positive feedback flips the output, the threshold flips with it, and the capacitor turns round.'),
        F('T = 2R_tC_t\\ln\\frac{1 + \\beta}{1 - \\beta}, \\qquad \\beta = \\frac{R_1}{R_1 + R_2}'),
        C([
          row('the period', relaxPeriod(p), o.period, 's', 1e-6, { unchecked: running }),
          row('the threshold, βV_sat', b * p.vsat, swing ? swing.high : NaN, 'V', 1e-6, { unchecked: running }),
          row('the output’s own level', p.vsat, o.high, 'V', 1e-6, { unchecked: running }),
          // The sentence above says the capacitor's voltage between edges is
          // one exponential of time constant R_tC_t. Three samples inside one
          // stretch measure that constant without the level it heads for.
          row('the time constant between edges, R_tC_t', p.Rt * p.Ct, tau, 's', 1e-6, {
            unchecked: Number.isFinite(tau) ? null : 'This window holds no stretch between two edges, so there is no exponential to fit a time constant to.',
          }),
        ]),
        V([
          { label: 'the feedback fraction β', value: b, unit: '', note: 'the same fraction sets both thresholds' },
          { label: 'the time constant R_tC_t', value: p.Rt * p.Ct, unit: 's', note: 'the period is 2 ln((1+β)/(1−β)) of it' },
          { label: 'distortion of the square wave', value: 100 * o.thd, unit: '%', note: 'over the first twelve harmonics, and every harmonic past them adds a little more' },
        ]),
      ],
    }
  },

  n4(p, x) {
    const o = oscOf(x)
    const t = swingAt(x, 't', (x.exp.osc && x.exp.osc.settle) || 0.7)
    const tap = swingAt(x, 'p', (x.exp.osc && x.exp.osc.settle) || 0.7)
    const oscillating = o.sigma > 0 && Number.isFinite(o.f) && !!t && !!tap && t.amp > Math.abs(p.kick)
    return {
      blocks: [
        T('Two capacitors in series make the tank’s capacitance, and the tap between them is what the transconductor reads. One network therefore sets the frequency and the feedback fraction at once.'),
        F('f_0 = \\frac{1}{2\\pi\\sqrt{L\\,C_1C_2/(C_1 + C_2)}}, \\qquad \\frac{v_{tap}}{v_{tank}} = \\frac{C_1}{C_1 + C_2}'),
        C([
          row('the tank’s frequency', colpittsF0(p), o.f, 'Hz', 0.03, {
            // The closed form treats the tap capacitor as the whole of what is
            // across it. R_b sits across it too, and once R_b falls to the same
            // order as that capacitor's reactance it moves the resonance. The
            // ratio of the two is the guard, and it is printed below.
            unchecked: !Number.isFinite(o.f)
              ? 'The tank has not completed a whole cycle inside this window, so there is no period to read.'
              : tankQ(p) < 1.5
                ? 'R_b is close to C₂’s own reactance here, so the loss moves the resonance and the closed form no longer describes it.'
                : null,
          }),
          row('the tap fraction C₁/(C₁ + C₂)', p.C1 / (p.C1 + p.C2), t && tap && t.amp > 0 ? tap.amp / t.amp : NaN, '', 0.02, {
            // The divider describes the waveform only while the tank is
            // ringing at its own frequency. Below the threshold the ring dies
            // away and what is left on the two nodes is the start-up, not a
            // division of anything.
            unchecked: oscillating ? null : 'The transconductance is below the threshold here, so the tank rings down instead of holding an amplitude.',
          }),
          row('the growth rate σ the state matrix gives', o.sigma, o.growthRate, 'rad/s', 0.05, {
            unchecked: !oscillating || !Number.isFinite(o.growthRate)
              ? 'The tank is not growing at this setting, so there is no envelope to fit a rate to.'
              : stillGrowing(x)
                ? null
                : 'The current limit bites before the end of the stretch the envelope is fitted over, so what is fitted there is not the exponential.',
          }),
        ]),
        V([
          { label: 'the series capacitance C₁C₂/(C₁ + C₂)', value: seriesC(p), unit: 'F' },
          { label: 'R_b against C₂’s reactance at f₀', value: tankQ(p), unit: '', note: 'the closed form above holds while this is well over one' },
          { label: 'the tank voltage the limit settles at', value: t ? t.amp : NaN, unit: 'V', note: 'measured off the settled waveform' },
          {
            label: 'an estimate of it, (4/π)I_max R_eq',
            value: squareEstimate(p),
            unit: 'V',
            // The describing function is an approximation and is labelled as
            // one. It replaces the limited current by its own fundamental,
            // which the tank is what makes reasonable, and it holds only while
            // the transconductor spends most of each cycle in limit.
            note:
              tap && p.g * tap.amp >= 3 * p.ilim
                ? `the square wave’s fundamental into the tapped tank, ${((100 * (squareEstimate(p) - (t ? t.amp : NaN))) / squareEstimate(p)).toFixed(1)} % from the measurement`
                : 'the transconductor does not reach its limit at this setting, so this estimate does not describe it',
          },
        ]),
      ],
    }
  },
}
