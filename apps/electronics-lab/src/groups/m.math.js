// The math panel for Group M: the op-amp's own numbers, each written from the
// transistors that make it and checked against what the solver measured.
//
// Where a closed form is an approximation, the row says so and the value rows
// beside it carry the measured number the approximation is being judged
// against. Where the settings cannot show a closed form at all, the row is
// footnoted with the reason rather than crossed out.

import { evalTF, newtonDC, normalize, polesOf, thermalVoltage, zerosOf } from '@ee-labs/network'
import { harmonics, loopMargins, loopTF, portResistance, ringOf, tangent, unityGain } from './l.js'
import { rampWindow, slopeOf } from '../math.js'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.02, extra = {}) => ({ label, predicted, measured, unit, tol, ...extra })

/** Two resistances in parallel, with an infinite one meaning no load at all. */
const par = (...rs) => 1 / rs.reduce((s, r) => s + 1 / r, 0)

/** The tangent's poles, lowest frequency first. */
const poles = (x) => x.poles || []

export const MATH_M = {
  m1(p, x) {
    const q = x.point
    const rNode = par(q.Q2.ro, q.Q4.ro, q.Q5.rpi)
    const rOut = par(p.rc, q.Q5.ro)
    const stage1 = q.Q1.gm * rNode
    const stage2 = q.Q5.gm * rOut
    const rInMeasured = portResistance(tangent(x).elements, 'inp', ['Vin'])
    return {
      blocks: [
        T('The mirror turns the pair’s two collector currents into one, so the whole of g_m1 arrives at the second stage’s base. That stage turns it into a voltage across its own load, and the two gains multiply.'),
        F(
          'A_0 \\approx g_{m1}\\,(r_{o2} \\parallel r_{o4} \\parallel r_{\\pi5}) \\times g_{m5}\\,(R_C \\parallel r_{o5})',
          'Two stages multiplied is an estimate, not an identity. It cuts the circuit at the second stage’s base, where the mirror and that base both carry current.' +
            (Number.isFinite(x.gain) && x.gain !== 0 ? ` Here it sits ${(100 * ((stage1 * stage2) / Math.abs(x.gain) - 1)).toFixed(1)} % above the solve.` : ''),
        ),
        C([
          row('the output resistance, by test source', rOut, portResistance(tangent(x).elements, 'out'), 'Ω', 1e-3),
          row('the gain, the two stages multiplied', stage1 * stage2, Math.abs(x.gain), '', 0.12),
        ]),
        V([
          // Two r_π in series is the textbook figure, and it is an estimate.
          // The pair's own output resistances and the mirror carry part of the
          // input current as well, so the measured port sits below it, and by
          // more as β rises. The row prints the gap rather than hiding it.
          { label: 'the input resistance, measured at the port', value: rInMeasured, unit: 'Ω' },
          { label: 'the estimate, two r_π in series', value: 2 * q.Q1.rpi, unit: 'Ω', note: `${((100 * (2 * q.Q1.rpi - rInMeasured)) / rInMeasured).toFixed(1)} % above what the port measures` },
          { label: 'the first stage’s gain', value: stage1, unit: '', note: 'g_m1 into what the mirror and the next base leave at that node' },
          { label: 'the second stage’s gain', value: stage2, unit: '' },
          { label: 'the collector current in each input transistor', value: Math.abs(q.Q1.ic), unit: 'A', note: 'half the tail, less the base currents' },
          { label: 'the output’s resting voltage', value: x.sol.v.out, unit: 'V', note: 'set by R_C and the second stage’s current, with the loop open' },
        ]),
      ],
    }
  },

  m2(p, x) {
    const q = x.point
    const ps = poles(x)
    const ft = q.Q1.gm / (2 * Math.PI * p.cc)
    const p2 = q.Q5.gm / (2 * Math.PI * p.cl)
    const gbw = Math.abs(x.gain) * (ps[0] ? ps[0].hz : NaN)
    // The second pole is only the second pole while it stays well above the
    // first. Where the load capacitor brings it down to meet the compensation
    // pole the two swap places and the row has nothing to compare.
    const split = ps[0] && p2 > 10 * ps[0].hz ? null : 'The load capacitor has brought the second pole down near the first, so the two are no longer separate enough to name apart.'
    // Miller's estimate needs the second stage to have gain. The capacitor is
    // multiplied by that gain, and below about twenty of it the node in front
    // is no longer dominated by what the capacitor puts there.
    const stage2 = q.Q5.gm * par(p.rc, q.Q5.ro)
    // Both estimates are the pole-split result, and a split needs room. Below
    // three times the transition frequency the second pole is close enough to
    // reshape the response the first one is supposed to own.
    const tight = p2 < 3 * ft ? 'The load capacitor puts the second pole within three times the transition frequency, which is too close for the two to be read apart.' : null
    const weak = stage2 < 50 ? 'The second stage has a gain of only ' + stage2.toFixed(1) + ' at this load, so the capacitor across it is not multiplied enough to split the two poles apart.' : null
    return {
      blocks: [
        T('The capacitor across the second stage is multiplied by that stage’s gain, so the node in front of it sees a very large capacitance and the amplifier gets one pole far below every other.'),
        F(
          'f_t \\approx \\frac{g_{m1}}{2\\pi C_c}, \\qquad f_p \\approx \\frac{f_t}{A_0}, \\qquad f_{p2} \\approx \\frac{g_{m5}}{2\\pi C_L}',
          'All three are the pole-split result, which holds while the second stage’s gain is large and the two poles are decades apart.' +
            (Number.isFinite(gbw) ? ` Here the product sits ${(100 * (ft / gbw - 1)).toFixed(1)} % above the measured one.` : ''),
        ),
        C([
          row('the gain-bandwidth product', ft, gbw, 'Hz', 0.14, { unchecked: weak || tight }),
          row('the dominant pole, f_t over the gain', ft / Math.abs(x.gain), ps[0] ? ps[0].hz : NaN, 'Hz', 0.14, { unchecked: weak || tight }),
          row('the second pole, g_m5 into the load', p2, ps[1] ? ps[1].hz : NaN, 'Hz', 0.2, { unchecked: weak || tight || split }),
        ]),
        V([
          { label: 'the unity-gain frequency, measured', value: unityGain(x.tf), unit: 'Hz', note: 'where the magnitude passes one, which the second pole and the zero pull in' },
          { label: 'the second stage’s gain, which multiplies the capacitor', value: stage2, unit: '' },
          { label: 'the capacitance the first stage sees', value: p.cc * (1 + stage2), unit: 'F', note: 'C_c multiplied by one plus that gain' },
          { label: 'the right-half-plane zero, g_m5/2πC_c', value: q.Q5.gm / (2 * Math.PI * p.cc), unit: 'Hz' },
        ]),
      ],
    }
  },

  m3(p, x) {
    const Ttf = loopTF(x, 'Efb')
    const m = loopMargins(Ttf)
    const tp = polesOf(Ttf).sort((a, b) => a.hz - b.hz)
    const tz = zerosOf(Ttf).sort((a, b) => a.hz - b.hz)
    const ring = ringOf(x.poles)
    const deg = (r) => (Math.atan(r) * 180) / Math.PI
    const pmParts = m.crossover && tp[1] && tz[0] ? 90 - deg(m.crossover / tp[1].hz) - deg(m.crossover / tz[0].hz) : NaN
    const p2 = x.point.Q5.gm / (2 * Math.PI * p.cl)
    const ft = x.point.Q1.gm / (2 * Math.PI * p.cc)
    // The second pole is the pole-split result, and the split needs room. The
    // same threshold the open-loop panel uses applies here.
    const tight = p2 < 3 * ft ? 'The load capacitor puts the second pole within three times the transition frequency, which is too close for the two to be read apart.' : null
    // The rule of thumb that reads damping straight off the phase margin is a
    // straight-line fit to a second-order loop. Past about seventy degrees the
    // closed-loop poles are real and there is no damping ratio to compare it to.
    const noRing = ring.zeta == null ? 'The closed-loop poles are real at this setting, so there is no ringing to put a damping ratio on.' : m.pm > 70 ? 'Past about seventy degrees of margin the straight-line rule runs out: the poles are nearly real and the fit no longer describes them.' : null
    return {
      blocks: [
        T('One pole costs the loop ninety degrees and nothing more. What is left of the margin is spent by the second pole and by the zero the compensation capacitor makes, both counted at the crossover.'),
        F('\\mathrm{PM} = 90^\\circ - \\arctan\\frac{f_c}{f_{p2}} - \\arctan\\frac{f_c}{f_z}, \\qquad \\zeta \\approx \\frac{\\mathrm{PM}}{100^\\circ}'),
        C([
          row('the phase margin, from the crossover', pmParts, m.pm, '°', 0.01, {
            unchecked: m.crossover == null ? 'The loop gain never passes one here, so there is no crossover to measure a margin at.' : null,
          }),
          row('the loop’s second pole, g_m5 into the load', p2, tp[1] ? tp[1].hz : NaN, 'Hz', 0.2, { unchecked: tight }),
          row('the damping the margin predicts', m.pm / 100, ring.zeta, '', 0.15, { unchecked: noRing }),
        ]),
        V([
          { label: 'the crossover frequency', value: m.crossover, unit: 'Hz' },
          { label: 'the loop gain at DC', value: evalTF(Ttf, [0, 1e-9])[0], unit: '', note: 'the amplifier’s own gain, taken at the point the closed loop settles at' },
          { label: 'the right-half-plane zero of the loop', value: tz[0] ? tz[0].hz : NaN, unit: 'Hz', note: 'it subtracts phase where a left-plane zero would add it' },
          { label: 'the step overshoot the damping gives', value: ring.overshoot, unit: '%', note: ring.overshoot == null ? 'the poles are real here, so a step does not overshoot' : '' },
        ]),
      ],
    }
  },

  m4(p, x) {
    const alpha = p.beta / (p.beta + 1)
    const rate = (alpha * p.itail) / p.cc
    const win = x.tr ? rampWindow(x) : null
    const mid = win ? (x.tr.at(win[0]).sol.v.c2 + x.tr.at(win[1]).sol.v.c2) / 2 : 0
    // The bias resistor takes its own share of the steered current, and takes
    // more of it as the node climbs. The row corrects for exactly the share it
    // is taking between the two instants the slope is measured across.
    const drained = (alpha * p.itail - (mid + 10) / p.rc) / p.cc
    const ev = x.tr && x.tr.events.length ? x.tr.events[0].t : null
    // The correction is the instantaneous drain at the middle of the measured
    // window, so it describes a straight ramp with a small tilt on it. Once
    // the window covers a tenth of the resistor's own time constant the climb
    // is an exponential rather than a ramp, and one midpoint no longer stands
    // for the whole of it.
    const tau = p.rc * p.cc
    const curved = win && win[1] - win[0] > tau / 10
      ? 'The bias resistor’s time constant is short enough that this climb is an exponential rather than a ramp, so one midpoint does not describe the slope across the window.'
      : null
    // The whole climb is a longer window than the slope's, so it meets the
    // same limit sooner.
    const curvedLong = curved || (ev != null && ev > tau / 10)
      ? 'The resistor drains a growing share of the current all the way up, so the climb takes longer than a straight ramp at the starting rate would.'
      : null
    return {
      blocks: [
        T('A large input steers the whole tail into one collector, and that collector has a capacitor on it. The capacitor can only charge at the current it is given, so the node climbs at a fixed rate.'),
        F('\\frac{dv}{dt} = \\frac{\\alpha I_{tail}}{C_c}, \\qquad \\alpha = \\frac{\\beta}{\\beta + 1}'),
        C([
          row('the ramp’s slope, less what the resistor drains', drained, x.tr ? slopeOf(x, 'c2') : NaN, 'V/s', 0.01, { unchecked: curved }),
          row('the ramp’s length, the swing over the rate', (0.5 + 10) / rate, ev, 's', 0.1, {
            unchecked: ev == null ? 'The ramp has not reached the transistor’s knee inside this window, so there is no event to time it against.' : curvedLong,
          }),
        ]),
        V([
          { label: 'the rate the tail alone would give', value: rate, unit: 'V/s', note: 'α I_tail into C_c, with no resistor taking a share' },
          { label: 'the share the bias resistor takes', value: 1 - drained / rate, unit: '', note: 'measured across the same two instants the slope is' },
          { label: 'the swing the transistor allows', value: 10.5, unit: 'V', note: 'from V_EE up to the knee, V_BE(on) less V_CE(sat) above ground' },
          { label: 'the same rate in volts per microsecond', value: rate / 1e6, unit: '', note: 'the number a datasheet prints' },
        ]),
      ],
    }
  },

  m5(p, x) {
    const vt = thermalVoltage(300)
    const q = x.point
    // The matched pair, solved on its own, is what the offset is measured
    // against: the input voltage that would put the output back there.
    let matched = NaN
    try {
      matched = newtonDC(normalize(x.exp.net({ ...p, ratio: 1 }))).sol.v.out
    } catch {
      matched = NaN
    }
    const shift = x.sol.v.out - matched
    const vos = -shift / x.gain
    const early = 1 + Math.abs(q.Q1.vce) / p.va
    const ib = p.itail / (2 * (1 + p.beta * early))
    // Sharing the tail evenly is what makes each base take half of it. Past a
    // few per cent of mismatch the two sides carry visibly different currents,
    // and the halving is no longer the right arithmetic.
    const lopsided = p.ratio > 1.05 ? 'The two sides are more than five per cent apart in saturation current, so they no longer share the tail evenly enough for a half each.' : null
    // Referring the output shift back through the gain is a small-signal step,
    // and it holds while the offset is a few millivolts. Past five per cent of
    // mismatch the pair is far enough from balance that the gain on the way
    // back is not the gain the shift went out through.
    const wide = p.ratio > 1.05 ? 'More than five per cent of mismatch moves the pair too far from balance for the output shift to be referred back through one gain.' : null
    const big = Math.abs(shift) > 8 ? 'The mismatch drives the output past what this load can give, so the shift it makes is no longer the gain times an input voltage.' : wide
    return {
      blocks: [
        T('Two input transistors that differ in saturation current need a voltage between their bases to carry the same current. From outside the amplifier that voltage is indistinguishable from a signal.'),
        F(
          'V_{OS} \\approx V_T \\ln r, \\qquad I_B \\approx \\frac{I_{tail}}{2\\,(1 + \\beta_{eff})}, \\qquad \\beta_{eff} = \\beta\\left(1 + \\frac{|V_{CE}|}{V_A}\\right)',
          'Both hold for a pair sharing its tail evenly. Once the two sides are mismatched they carry slightly different currents, and each estimate then sits beside the solve rather than on it.',
        ),
        C([
          row('the input offset the mismatch asks for', vt * Math.log(p.ratio), vos, 'V', 0.06, { abs: 1e-9, unchecked: big }),
          row('the base current, the tail shared out', ib, Math.abs(q.Q1.ib), 'A', 0.03, { unchecked: lopsided }),
        ]),
        V([
          { label: 'the output the mismatch moves', value: shift, unit: 'V', note: 'the offset multiplied by the open-loop gain' },
          { label: 'the textbook’s I_tail/2β', value: p.itail / (2 * p.beta), unit: 'A', note: 'the same number with the Early effect on β left out' },
          { label: 'the measured current gain of an input transistor', value: Math.abs(q.Q1.ic / q.Q1.ib), unit: '', note: 'β raised by the Early factor at this collector voltage' },
          { label: 'the open-loop gain the offset is divided by', value: x.gain, unit: '' },
        ]),
      ],
    }
  },

  m6(p, x) {
    const dead = 0.7 - p.vbias
    // With a dead band the two devices take turns, and each of them drives the
    // load through one ballast resistor. With the bias past a diode drop the
    // dead band closes, both devices carry current at once, and the load is
    // driven through the two ballasts in parallel. The prediction branches on
    // which of the two the settings are in, because the control that decides
    // is a knob.
    const overlap = dead <= 0
    const k = overlap ? p.RL / (p.RL + p.re / 2) : p.RL / (p.RL + p.re)
    const theta = overlap ? 0 : Math.abs(dead) < p.amp ? Math.asin(dead / p.amp) : Math.PI / 2
    // A stage with a dead band passes v_out = k(v_in − d) where the drive
    // clears d, and nothing where it does not. The fundamental of that shape
    // is one integral, and it is exact for any dead band inside the drive.
    const peak = overlap ? k * p.amp : k * (p.amp - dead)
    const fundamental = overlap ? k * p.amp : k * p.amp * (1 - (2 * theta + Math.sin(2 * theta)) / Math.PI)
    const swing = p.vsup - 0.2
    const silent = dead >= p.amp ? 'The drive never clears the dead band at this setting, so neither transistor conducts and the output stays at nothing.' : null
    const clipped = peak > swing ? 'The drive asks for more than the supply can give, so the peaks are the rail rather than the follower’s own output.' : null
    // Both devices stay on all the way round only while the ballast’s own drop
    // is smaller than the overlap the bias bought.
    const partly = overlap && (p.amp * (p.re / 2)) / (p.RL + p.re / 2) > -dead ? 'The drive is large enough for the ballast resistors to turn one device off part of the way round, so the stage is in neither regime cleanly.' : null
    const h = x.tr ? harmonics(x, 'out', p.f) : null
    return {
      blocks: [
        // The text and the formula follow the bias knob, because the knob is
        // what decides which of the two regimes the stage is in. Written for
        // the dead band alone, they would contradict the prediction beside
        // them as soon as the bias closed it.
        overlap
          ? T('The bias holds both transistors on at rest, so one of them carries the load at every instant of the cycle. There is no dead band left to flatten the crossing, and the load is driven through the two ballast resistors in parallel.')
          : T('Neither transistor conducts until the drive clears its own turn-on voltage, so the output is flat while the input passes through zero. The dead band is a fixed number of volts, which is why small signals lose the largest share of themselves.'),
        overlap
          ? F(
              'v_{out} = \\frac{R_L}{R_L + R_E/2}\\,v_{in}, \\qquad d = 0.7\\,\\mathrm{V} - V_{bias} \\leq 0',
              'Both devices conduct, so the two ballast resistors act in parallel and the dead band term is gone.',
            )
          : F('v_{out} = \\frac{R_L}{R_L + R_E}\\,(|v_{in}| - d)\\,\\mathrm{sgn}(v_{in}), \\qquad d = 0.7\\,\\mathrm{V} - V_{bias}'),
        C([
          row('the peak the load reaches', peak, x.tr ? Math.max(...x.tr.samples.map((s) => s.sol.v.out)) : NaN, 'V', 0.01, { unchecked: silent || clipped || partly }),
          row('the fundamental left after the dead band', fundamental, h ? h[0] : NaN, 'V', 0.02, { unchecked: silent || clipped || partly }),
        ]),
        V([
          { label: 'the dead band, one drop less the bias', value: dead, unit: 'V', note: dead <= 0 ? 'the bias has closed it: both devices idle on' : 'the drive has to clear this before anything moves' },
          { label: 'the fraction of the cycle with nothing conducting', value: (2 * theta) / Math.PI, unit: '', note: 'zero once the bias closes the dead band' },
          { label: 'the second harmonic of the output', value: h ? h[1] : NaN, unit: 'V', note: 'a symmetric dead band makes odd harmonics, so this one stays small' },
          { label: 'the third harmonic of the output', value: h ? h[2] : NaN, unit: 'V' },
        ]),
      ],
    }
  },
}
