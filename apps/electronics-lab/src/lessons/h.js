// Group H's three registers. Every number here is a reading, checked against
// the solver by experiments.test.js, and every knob move names a setting the
// knob can reach.
//
// Two readings are functions rather than quantity paths, because each is a
// method rather than a number the solve hands over. `portR` puts a test
// source at a port and reads the ratio, and `hd2Of` maps a sine through the
// quasi-static characteristic and transforms what comes out. Both live in
// groups/h.js beside the circuits they measure.

import { gainFrom, hd2Of, portR } from '../groups/h.js'

const rin = (node, drop) => (x) => portR(x, node, drop)
const rout = (node, drop = []) => (x) => portR(x, node, drop)

/**
 * The slope of the quasi-static sweep where it crosses zero input, which is
 * the gain a stage with no capacitor in it has. It is read off the sweep the
 * transfer pane already draws, rather than off the tangent, because H7's
 * three-region model has no tangent to take.
 */
const sweepSlope = (x) => {
  const { xs, ys } = x.sweep
  const k = xs.findIndex((v) => v >= 0)
  return (ys[k + 1] - ys[k - 1]) / (xs[k + 1] - xs[k - 1])
}

export const LESSONS_H = {
  h1: {
    see:
      'The transistor sits at 1.00 mA and 5.00 V, and its slope there is 38.7 mA/V. A signal at the base ' +
      'leaves the collector multiplied by −185, upside down. A test source at the base sees 2.71 kΩ. One at ' +
      'the collector sees 4.77 kΩ.',
    seeReads: [
      ['op.Q1.ic', 1e-3],
      ['op.Q1.vce', 5],
      ['op.Q1.gm', 0.038682],
      ['gain', -184.617],
      [rin('b', ['Vs']), 2714.46],
      [rout('c'), 4772.73],
    ],
    try: [
      {
        say: 'Switch the Early effect off. The output resistance becomes R_C itself, 5.00 kΩ, and the gain grows to −193.',
        set: { early: false },
        reads: [
          [rout('c'), 5000],
          ['gain', -193.409],
        ],
      },
      {
        say: 'Set I_C to 250 µA. The slope falls with the current, so the gain falls to −47.8 and the input resistance climbs to 11.2 kΩ.',
        set: { ic: 0.25e-3 },
        reads: [
          ['gain', -47.8027],
          [rin('b', ['Vs']), 11245.6],
        ],
      },
      {
        say: 'Set R_C to 8 kΩ. The collector now sits at 2.00 V and the gain reaches −287, closer to the ceiling one transistor has.',
        set: { RC: 8000 },
        reads: [
          ['op.Q1.vce', 2],
          ['gain', -286.948],
        ],
      },
    ],
    why:
      'This is the common emitter, the stage every other one is compared against. The collector current is an ' +
      'exponential of the base-emitter voltage, so its slope there is the current divided by the thermal ' +
      'voltage. The gain is that slope times whatever resistance the collector current has to flow through, ' +
      'which is R_C in parallel with the transistor’s own r_o. The minus sign is the collector falling as the ' +
      'current rises. The input resistance is r_π, the base’s share of the same slope, larger by β because a ' +
      'base current is β times smaller than a collector current. The output resistance is what a test source ' +
      'at the collector reads, R_C in parallel with r_o again. Those three numbers describe the stage from ' +
      'outside, and Group I stacks them.',
  },

  h2: {
    see:
      'A hundred ohms in the emitter costs most of the gain. The stage reads −39.0 where one ohm there ' +
      'read −178, and its input resistance rises from 2.82 kΩ to 12.8 kΩ. The distortion falls ' +
      'further than the gain does. The second harmonic is 0.196 % at a 5 mV drive, against 4.08 % with one ' +
      'ohm in its place.',
    seeReads: [
      ['gain', -39.0322],
      [rin('b', ['Vs']), 12813.9],
      [(x, p, again) => portR(again({ RE: 1 }), 'b', ['Vs']), 2815.61],
      [(x, p, again, e) => hd2Of(e, p, { key: 'vin', amp: p.amp, node: 'c' }), 0.195654],
      [(x, p, again, e) => hd2Of(e, { ...p, RE: 1 }, { key: 'vin', amp: p.amp, node: 'c' }), 4.07663],
      [(x, p, again) => again({ RE: 1 }).gain, -177.981],
    ],
    try: [
      {
        say: 'Set R_E to 1 Ω. One ohm is a fortieth of 1/g_m, so the gain climbs to −178 and the second harmonic returns to 4.08 %.',
        set: { RE: 1 },
        reads: [
          ['gain', -177.981],
          [(x, p, again, e) => hd2Of(e, p, { key: 'vin', amp: p.amp, node: 'c' }), 4.07663],
        ],
      },
      {
        say: 'Set R_E to 1 kΩ. The gain falls to −4.82 and the second harmonic to 0.00285 %, while the input resistance reaches 102 kΩ.',
        set: { RE: 1000 },
        reads: [
          ['gain', -4.81924],
          [(x, p, again, e) => hd2Of(e, p, { key: 'vin', amp: p.amp, node: 'c' }), 0.00285326],
          [rin('b', ['Vs']), 101992],
        ],
      },
      {
        say: 'Raise the drive to 20 mV. The second harmonic grows with the amplitude, to 0.787 %.',
        set: { amp: 0.02 },
        reads: [[(x, p, again, e) => hd2Of(e, p, { key: 'vin', amp: p.amp, node: 'c' }), 0.787145]],
      },
    ],
    why:
      'Emitter degeneration is feedback built out of one resistor. The emitter follows the base, so R_E takes ' +
      'back part of the input before it reaches the junction, and what is left is smaller by 1 + g_m R_E. The ' +
      'gain falls by that factor and the input resistance rises by it. The distortion falls by very nearly the square of ' +
      'it, because the exponential sees a smaller drive and the loop divides what curvature is left by the ' +
      'same factor again. That is the trade a designer makes over and over. Gain is cheap, since another ' +
      'stage supplies more of it, and linearity is not, since nothing downstream can take a harmonic back out.',
    // The square, measured. The closed form drops the base current and the
    // Early factor, and the tangent carries both, so the two sit about five
    // per cent apart at these settings rather than on top of each other.
    whyReads: [
      [
        (x, p, again, e) => {
          const hd = (RE) => hd2Of(e, { ...p, RE }, { key: 'vin', amp: p.amp, node: 'c' })
          const factor = (a) => 1 + a.point.Q1.gm * a.p.RE
          return hd(1) / hd(p.RE) / (factor(x) / factor(again({ RE: 1 }))) ** 2
        },
        1,
        0.06,
      ],
    ],
  },

  h3: {
    see:
      'The emitter follower gives no voltage gain. The output follows the base at 0.975, and from the source ' +
      'through R_s it is 0.966. What it gives is resistance, 112 kΩ looking in at the base and 34.7 Ω looking ' +
      'back in at the emitter.',
    seeReads: [
      [(x) => gainFrom(x, 'b', 'out', ['Vs', 'Rs']), 0.974838],
      ['gain', 0.966196],
      [rin('b', ['Rs']), 111801],
      [rout('out', ['RL']), 34.6573],
    ],
    try: [
      {
        say: 'Set R_L to 3 kΩ. The follower’s own gain rises to 0.991 and the base looks like 318 kΩ, because both follow the load.',
        set: { RL: 3000 },
        reads: [
          [(x) => gainFrom(x, 'b', 'out', ['Vs', 'Rs']), 0.991307],
          [rin('b', ['Rs']), 317827],
        ],
      },
      {
        say: 'Set R_L to 200 Ω. The follower’s gain falls to 0.887 and the base looks like 24.9 kΩ, while the output resistance hardly moves at 34.5 Ω.',
        set: { RL: 200 },
        reads: [
          [(x) => gainFrom(x, 'b', 'out', ['Vs', 'Rs']), 0.886721],
          [rin('b', ['Rs']), 24944.7],
          [rout('out', ['RL']), 34.5179],
        ],
      },
      {
        say: 'Set R_s to 10 Ω. The output resistance falls to 25.7 Ω, which is 1/g_m, because the source resistance divided by β + 1 has gone.',
        set: { Rs: 10 },
        reads: [
          [rout('out', ['RL']), 25.6812],
          [(x) => 1 / x.point.Q1.gm, 25.8312],
        ],
      },
    ],
    why:
      'A follower has one job. It takes a signal from something that cannot drive a load, and hands it to the ' +
      'load with the current the load needs. The voltage gain is R_L over R_L plus 1/g_m, a little under one, ' +
      'and it can never exceed one. What changes is the resistance seen at each end. Looking in at the base, ' +
      'the load appears multiplied by β + 1, because the base carries that fraction of the emitter current. ' +
      'Looking back in at the emitter, the source resistance appears divided by β + 1, with 1/g_m added to it. ' +
      'A stage with a large gain and a poor output resistance gets a follower after it, and keeps the gain.',
  },

  h4: {
    see:
      'The common base takes its signal at the emitter. From there to the collector the gain is 185, and ' +
      'nothing is inverted. But the emitter is a low port. A test source there sees 26.8 Ω, so a 1 kΩ source ' +
      'loses almost all of the signal and the stage delivers 4.82.',
    seeReads: [
      [(x) => gainFrom(x, 'e', 'c', ['Rs', 'Vs']), 184.647],
      [rin('e', ['Rs']), 26.8086],
      ['gain', 4.82088],
    ],
    try: [
      {
        say: 'Set R_s to 10 Ω. Now most of the signal reaches the emitter and the stage delivers 135.',
        set: { Rs: 10 },
        reads: [['gain', 134.506]],
      },
      {
        say: 'Set R_s to 3 kΩ. The gain falls to 1.64, while the gain measured at the emitter has not moved from 184.',
        set: { Rs: 3000 },
        reads: [
          ['gain', 1.63508],
          [(x) => gainFrom(x, 'e', 'c', ['Rs', 'Vs']), 184.448],
        ],
      },
      {
        say: 'Set R_C to 1 kΩ. The emitter-to-collector gain falls to 38.4, five times smaller with five times less collector resistance.',
        set: { RC: 1000 },
        reads: [[(x) => gainFrom(x, 'e', 'c', ['Rs', 'Vs']), 38.3631]],
      },
    ],
    why:
      'The common base is the third way to wire one transistor. The base is held, the emitter takes the ' +
      'signal, and the collector delivers it. The emitter is inside the junction, so the resistance there is ' +
      '1/g_m, 26.8 Ω at a milliamp, and almost anything driving it wins the divider. The current gain is α, a ' +
      'little under one, so nothing is amplified in current at all. What the stage is for is the collector’s ' +
      'side. Its own output resistance is very high, and its input voltage never appears across the collector ' +
      'junction’s capacitance, so it does not slow the stage in front of it. Group I stands one of these on a ' +
      'common emitter for exactly that reason.',
    whyReads: [[rin('e', ['Rs']), 26.8086]],
  },

  h5: {
    see:
      'The common source is the MOSFET’s common emitter. At 407 µA the slope is 4.07 mA/V, a tenth of the ' +
      'bipolar’s at a milliamp, and the gain into 10 kΩ is −37.7. The gate draws no current at all, so the ' +
      'input resistance is infinite and no r_π appears in the equations.',
    seeReads: [
      ['op.M1.id_', 4.07407e-4],
      ['op.M1.gm', 4.07407e-3],
      ['gain', -37.7229],
      // The gate current, and the port that carries it. The first is the
      // current the input source passes, and it is a machine zero. The
      // second is the port with its two bias sources lifted off, which the
      // solver cannot answer for at all, and that is what infinite means.
      ['i.Vs', 0],
      [(x) => 1 / portR(x, 'g', ['Vs', 'VGG']), 0],
    ],
    try: [
      {
        say: 'Set V_OV to 100 mV. The current falls to 108 µA and the gain with it, to −21.1.',
        set: { vov: 0.1 },
        reads: [
          ['op.M1.id_', 1.07843e-4],
          ['gain', -21.1457],
        ],
      },
      {
        say: 'Set V_OV to 150 mV. The current is 237 µA and the gain −30.2, so the gain climbs with the square root of the current.',
        set: { vov: 0.15 },
        reads: [
          ['op.M1.id_', 2.36842e-4],
          ['gain', -30.2191],
        ],
      },
      {
        say: 'Set R_D to 2 kΩ. The gain falls to −8.53, and the drain sits at 4.13 V with room to move.',
        set: { RD: 2000 },
        reads: [
          ['gain', -8.52502],
          ['op.M1.vds', 4.13386],
        ],
      },
    ],
    why:
      'The common source and the common emitter are the same circuit with a different device in it. The ' +
      'square law gives a slope of 2 I_D over V_OV rather than I_C over V_T. V_OV is chosen by the designer, ' +
      'and V_T is fixed by temperature. That is why the MOSFET’s slope is smaller at the same current. It is ' +
      'also why raising the current buys only its square root. The gate is a plate with an insulator behind ' +
      'it. No current crosses it, so the input resistance is infinite. Digital electronics rests on that one ' +
      'fact, and so does every circuit that holds a charge rather than passing a current.',
  },

  h6: {
    see:
      'The source follower delivers 0.812 into 1 kΩ. A test source at the output reads 229 Ω, and that is ' +
      '1/g_m. The same port driven rather than loaded is the common gate’s input, and it reads the same 229 Ω. ' +
      'The bipolar follower’s port at a milliamp is tens of ohms, and this one is hundreds.',
    seeReads: [
      ['gain', 0.812439],
      [rout('out', ['RL']), 228.61],
      [(x) => 1 / x.point.M1.gm, 229.029],
    ],
    try: [
      {
        say: 'Set R_L to 10 kΩ. The gain climbs to 0.974, because the load now dwarfs the 245 Ω looking into the source.',
        set: { RL: 10000 },
        reads: [
          ['gain', 0.974189],
          [rout('out', ['RL']), 244.814],
        ],
      },
      {
        say: 'Set R_L to 100 Ω. The gain collapses to 0.305, since the load is now well under the 227 Ω at the same port.',
        set: { RL: 100 },
        reads: [
          ['gain', 0.305219],
          [rout('out', ['RL']), 227.039],
        ],
      },
      {
        say: 'Set V_OV to 400 mV. The current rises fourfold, the slope doubles, and the port falls to 117 Ω.',
        set: { vov: 0.4 },
        reads: [[rout('out', ['RL']), 116.734]],
      },
    ],
    why:
      'One port carries two names. The resistance looking into a source with the gate held is 1/g_m, and it ' +
      'does not matter whether the signal is going in or coming out. As a follower’s output resistance it is ' +
      'what the next stage is driven from. As a common gate’s input resistance it is what the stage in front ' +
      'has to drive. The MOSFET’s slope is small, so this port is hundreds of ohms where the bipolar’s is ' +
      'tens. That is the price of a gate that draws nothing, and it is why a MOSFET follower is a poor buffer ' +
      'for a heavy load and a bipolar one is not.',
  },

  h7: {
    see:
      'The collector sits at 5.00 V with nothing applied, and a 30 mV sine at a gain of 185 asks for more ' +
      'output than there is. The top flattens at 10.0 V, where the transistor is off and R_C carries no ' +
      'current. The bottom flattens at 200 mV, which is where the transistor saturates.',
    seeReads: [
      ['v.c', 5],
      ['clip.high.c', 10],
      ['clip.low.c', 0.2],
      // The gain the sentence quotes, off the sweep rather than off a
      // formula: v_BE is pinned on this model, so R_B alone sets the base
      // current and β times it sets the collector current.
      [sweepSlope, -185.185],
    ],
    try: [
      {
        say: 'Set the drive to 10 mV. Nothing flattens now, and the collector moves between 6.85 V and 3.15 V.',
        set: { amp: 0.01 },
        reads: [
          ['clip.high.c', 6.85185],
          ['clip.low.c', 3.14815],
        ],
      },
      {
        say: 'Set the drive to 100 mV. The flats are at the same two levels, and the output spends most of its period against one of them.',
        set: { amp: 0.1 },
        reads: [
          ['clip.high.c', 10],
          ['clip.low.c', 0.2],
        ],
      },
      {
        say: 'Switch the model to the curve. No waveform is drawn, because an exponential has no closed-form answer in time, and the pane gives that reason.',
        set: { model: 'exp' },
        refuses: true,
      },
    ],
    why:
      'The load line is the resistor’s own law drawn on the transistor’s plane, running from V_CC at no ' +
      'current to V_CC over R_C at no volts. The quiescent point sits on it wherever the bias puts it, and a ' +
      'signal slides the point along it. Both ends of the line are hard. At the top the transistor is off and ' +
      'the collector is pulled all the way to the supply. At the bottom it saturates, and the collector cannot ' +
      'go below the saturation voltage the model gives it. The largest undistorted output is set by whichever ' +
      'end is nearer, which is why a stage meant for a large output is biased near the middle of what the ' +
      'supply allows.',
  },
}
