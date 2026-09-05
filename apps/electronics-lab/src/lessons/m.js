// Group M's three registers. Every number is a reading of the transistor
// circuit on screen, and the group's whole purpose is that each one of them
// is a number Group A carried as a datasheet fact.

import { harmonics, loopMargins, loopTF, portResistance, powerOver, ringOf, tangent, thdOf, unityGain } from '../groups/l.js'

/** The gain-bandwidth product, read as the open-loop gain times its dominant pole. */
const gbw = (x) => Math.abs(x.gain) * x.poles[0].hz

/** The two port resistances of the amplifier, by test source on the tangent. */
const rIn = (x) => portResistance(tangent(x).elements, 'inp', ['Vin'])
const rOut = (x) => portResistance(tangent(x).elements, 'out')

/** The loop of the follower, and what it leaves at the crossover. */
const fcOf = (x) => loopMargins(loopTF(x, 'Efb')).crossover
const pmOf = (x) => loopMargins(loopTF(x, 'Efb')).pm

/** The input offset: the shift the mismatch makes at the output, referred back through the gain. */
const vosOf = (x, p, again) => -(x.sol.v.out - again({ ratio: 1 }).sol.v.out) / x.gain

/** The output stage's fundamental, its distortion, and where its power goes. */
const fundOf = (x, p) => harmonics(x, 'out', p.f)[0]
const thd = (x, p) => thdOf(x, 'out', p.f)
const power = (x, p) => powerOver(x, { load: 'RL', supplies: ['VCC', 'VEE'], freq: p.f })

export const LESSONS_M = {
  m1: {
    see:
      'Five transistors make the two-stage amplifier Circuit Elements Lab drew as a box. A pnp pair takes the ' +
      'difference, an npn mirror turns its two collector currents into one, and a common-emitter stage turns ' +
      'that into a large voltage. Open loop the gain reads 3 240, the input port 756 kΩ and the output port ' +
      '98.6 kΩ.',
    seeReads: [
      ['gain', 3238.545],
      [rIn, 756103],
      [rOut, 98593.4],
    ],
    try: [
      {
        say: 'Set the tail current to 60 µA. Four times the current is four times the transconductance, so the gain rises to 11 900 while the input port falls to 189 kΩ.',
        set: { itail: 60e-6 },
        reads: [
          ['gain', 11927.7],
          [rIn, 189030],
        ],
      },
      {
        say: 'Set R_C to 200 kΩ. The second stage has twice the load resistance, so the output port doubles to 194 kΩ and the gain follows it to 6 300.',
        set: { rc: 200e3 },
        reads: [
          [rOut, 194452],
          ['gain', 6298.73],
        ],
      },
      {
        say: 'Set β to 200. Both input transistors have twice the input resistance, so the port reads 1.49 MΩ, and the second stage’s gain doubles as well.',
        set: { beta: 200 },
        reads: [
          [rIn, 1488300],
          ['gain', 6376.74],
        ],
      },
    ],
    why:
      'Circuit Elements Lab gave the op-amp three numbers and called the rest datasheet facts. Here they come out ' +
      'of the parts. The input resistance is the two input transistors’ own r_π in series, because a differential ' +
      'input drives them that way. The output resistance is the second stage’s load in parallel with its own ' +
      'r_o. And the gain is the two stages multiplied, each of them a transconductance into whatever the next ' +
      'stage leaves at that node. The current mirror is what makes the first stage worth building. A pair with ' +
      'resistors for loads throws half its transconductance away, because only one collector reaches the output. ' +
      'A mirror carries the other collector’s current across and adds it, so the whole of g_m1 arrives at the ' +
      'second stage’s base.',
  },

  m2: {
    see:
      'One capacitor across the second stage decides how fast the whole amplifier is. The gain across that stage ' +
      'multiplies it, so the node in front sees a very large capacitance and the amplifier gets one pole at ' +
      '454 Hz. Gain times that pole is 1.47 MHz, which is the first stage’s transconductance over 2πC_c.',
    seeReads: [
      ['pole.1.hz', 454.011],
      [gbw, 1470330],
    ],
    try: [
      {
        say: 'Set C_c to 10 pF. Three times less capacitance is three times the speed, and the pole moves out to 1.35 kHz.',
        set: { cc: 10e-12 },
        reads: [['pole.1.hz', 1354.53]],
      },
      {
        say: 'Set the tail current to 60 µA. The transconductance rises with it, so the product climbs to 5.94 MHz while the pole stays near 498 Hz.',
        set: { itail: 60e-6 },
        reads: [
          [gbw, 5943700],
          ['pole.1.hz', 498.329],
        ],
      },
      {
        say: 'Set the tail current to 5 µA. The product falls to 476 kHz, against the 508 kHz the transconductance and the capacitor predict.',
        set: { itail: 5e-6 },
        reads: [
          [gbw, 476180],
          [(x, p) => x.point.Q1.gm / (2 * Math.PI * p.cc), 508450],
        ],
      },
    ],
    why:
      'This is Miller compensation. A capacitor across an inverting stage of gain A looks like A + 1 times as ' +
      'much capacitance at that stage’s input. So 30 pF across a stage of sixty-four behaves like 2.0 nF at the ' +
      'node in front of it. That node then carries a pole far below every other one. The response is first-order ' +
      'across the whole useful range because of it. The product of gain and bandwidth then depends on neither ' +
      'the load resistor nor the node’s own resistance, because both of them cancel. What is left is the first ' +
      'stage’s transconductance divided by the capacitor. That is why the datasheet number moves with the bias ' +
      'current and with almost nothing else. The measured product runs a few per cent under the estimate, ' +
      'because the second pole and the zero pull the response down.',
    whyReads: [[(x, p) => p.cc * (1 + x.point.Q5.gm / (1 / p.rc + 1 / x.point.Q5.ro)), 1.9597e-9]],
  },

  m3: {
    see:
      'Close the loop as a follower and the whole open-loop gain becomes loop gain. The return ratio passes one ' +
      'at 3.62 MHz, and what is left of the phase there is a margin of 58.6°. The closed-loop poles are a ' +
      'complex pair with a damping of 0.601, so a step overshoots by 9.43 %.',
    seeReads: [
      [fcOf, 3621250],
      [pmOf, 58.578],
      [(x) => ringOf(x.poles).zeta, 0.6007831],
      [(x) => ringOf(x.poles).overshoot, 9.4325386],
    ],
    try: [
      {
        say: 'Set C_c to 30 pF. The crossover comes in to 1.41 MHz, the margin rises to 73.6°, and the closed-loop poles are real, so nothing rings at all.',
        set: { cc: 30e-12 },
        reads: [
          [fcOf, 1414690],
          [pmOf, 73.64],
        ],
      },
      {
        say: 'Set C_c to 5 pF. The crossover goes out to 5.91 MHz, the margin falls to 48.5°, and the overshoot grows to 19.4 %.',
        set: { cc: 5e-12 },
        reads: [
          [fcOf, 5906710],
          [pmOf, 48.488],
          [(x) => ringOf(x.poles).overshoot, 19.42452],
        ],
      },
      {
        say: 'Set C_L to 330 pF. The second pole comes down to meet the crossover, the margin falls to 42.8°, and the step overshoots by 25.6 %.',
        set: { cl: 330e-12 },
        reads: [
          [pmOf, 42.845],
          [(x) => ringOf(x.poles).overshoot, 25.577],
        ],
      },
    ],
    why:
      'A margin is counted at one frequency, the one where the loop gain passes one. A single pole can only ever ' +
      'cost ninety degrees, so a loop with one pole keeps all ninety of them. Everything else in the amplifier ' +
      'takes some away. The second pole, set by the second stage’s transconductance into the load capacitor, ' +
      'takes the arctangent of the crossover over its own frequency. So does the right-half-plane zero the ' +
      'compensation capacitor makes, and that one subtracts phase where a left-plane zero would add it. Those ' +
      'three terms account for the measured margin to a hundredth of a degree. Lowering the capacitor buys ' +
      'bandwidth and spends margin, because the crossover moves out toward poles that were harmless while they ' +
      'sat above it.',
  },

  m4: {
    see:
      'A large input steers the whole tail current into one collector, and that collector carries the ' +
      'compensation capacitor. The node then climbs at 490 kV/s, which is the steered current divided by the ' +
      'capacitance. It runs out of headroom after 22.0 µs, and the walk records that instant as an event.',
    seeReads: [
      ['slope.c2', 489630],
      [(x) => x.tr.events[0].t, 2.1994e-5],
    ],
    try: [
      {
        say: 'Set C_c to 10 pF. A third of the capacitance takes a third of the time, so the slope reads 1.47 MV/s and the ramp ends after 7.33 µs.',
        set: { cc: 10e-12 },
        reads: [
          ['slope.c2', 1468890],
          [(x) => x.tr.events[0].t, 7.3314e-6],
        ],
      },
      {
        say: 'Set the tail current to 60 µA. Four times the current is four times the rate, at 1.97 MV/s.',
        set: { itail: 60e-6 },
        reads: [['slope.c2', 1974870]],
      },
      {
        say: 'Set the bias resistor to 1 MΩ. It now takes a noticeable share of the steered current on the way up, and the slope reads 428 kV/s.',
        set: { rc: 1e6 },
        reads: [['slope.c2', 427978]],
      },
    ],
    why:
      'Slew rate and bandwidth are different limits, and they are often confused. Bandwidth is a property of the ' +
      'tangent, and it holds for signals small enough to leave the pair sharing its tail between both sides. ' +
      'Once the input is a few times the thermal voltage, one side has all of the tail and the other has none. ' +
      'From there the capacitor can only be charged at that one current, so the output moves at a fixed rate ' +
      'whatever the input asks for. The rate is the steered current over the compensation capacitor, and those ' +
      'are the two numbers that set the small-signal bandwidth as well. Nothing chosen for one of the two ' +
      'limits is free for the other. A slew rate is quoted in volts per microsecond for that reason, and never ' +
      'in hertz.',
  },

  m5: {
    see:
      'One input transistor is made one per cent larger in saturation current. The pair then needs 258 µV ' +
      'between its bases to carry the same current on both sides, and nothing outside can tell that voltage from ' +
      'a signal. Each base also draws 67.2 nA, which the tail supplies on top of the collector currents.',
    seeReads: [
      [vosOf, 2.58123e-4],
      ['op.Q1.ib', -6.72411e-8],
    ],
    try: [
      {
        say: 'Set the mismatch to 1.05. Five per cent of difference asks for 1.30 mV, which is the thermal voltage times the natural log of the ratio.',
        set: { ratio: 1.05 },
        reads: [[vosOf, 1.29879e-3]],
      },
      {
        say: 'Set β to 50. Each base draws twice as much, at 133 nA, because the tail is shared between two collectors and two bases.',
        set: { beta: 50 },
        reads: [['op.Q1.ib', -1.33278e-7]],
      },
      {
        say: 'Set the tail current to 60 µA. Four times the tail is four times the base current, at 269 nA.',
        set: { itail: 60e-6 },
        reads: [['op.Q1.ib', -2.68964e-7]],
      },
    ],
    why:
      'Group A hung a battery on one input and called it the offset. A mismatched pair is where that battery ' +
      'comes from. Two transistors carrying the same current at different saturation currents sit at different ' +
      'base voltages, and the difference is the thermal voltage times the log of the ratio. One per cent of ' +
      'mismatch is a quarter of a millivolt, and a real pair on one die is matched better than that. The bias ' +
      'current has the same kind of origin. The tail supplies both collectors and both bases, so each base takes ' +
      'the tail over twice one plus the current gain. A textbook writes that as the tail over two β. The ' +
      'measured number sits a tenth under it, because the Early effect raises the current gain at these ' +
      'collector voltages.',
  },

  m6: {
    see:
      'Neither output transistor conducts until the drive clears its own turn-on voltage, so the output stays ' +
      'flat while the input crosses zero. A one-volt sine comes out with a peak of 297 mV and a fundamental of ' +
      '186 mV. Total harmonic distortion reads 59.2 %.',
    seeReads: [
      ['peak.out', 0.29703],
      [fundOf, 0.186257],
      [thd, 59.199],
    ],
    try: [
      {
        say: 'Raise the drive to 9 V. The dead band is the same fixed width, so it costs proportionally less of the swing, and the distortion falls to 4.61 %.',
        set: { amp: 9 },
        reads: [
          [thd, 4.6109],
          ['peak.out', 8.21782],
        ],
      },
      {
        say: 'Set the bias to 0.69 V a side. The two bases are now nearly a diode drop apart, both devices idle just on, and the distortion falls to 0.553 %.',
        set: { vbias: 0.69 },
        reads: [
          [thd, 0.55285],
          ['peak.out', 0.980198],
        ],
      },
      {
        say: 'Raise the drive to 9 V with that bias still on. The load takes 39.6 mW from 56.1 mW of supply, which is an efficiency of 70.6 %.',
        set: { amp: 9, vbias: 0.69 },
        reads: [
          [(x, p) => power(x, p).load, 0.03959],
          [(x, p) => power(x, p).supply, 0.056068],
          [(x, p) => power(x, p).efficiency, 70.61],
        ],
      },
    ],
    why:
      'Class B is the reason an output stage can be efficient. Neither device carries current at rest, so ' +
      'nothing is wasted while nothing is asked for. The price is crossover distortion, a flat piece in the ' +
      'middle of every waveform, and it is worst for the small signals a listener notices most. Two ' +
      'forward-biased diodes between the bases hold each device just on, which closes the dead band and turns ' +
      'the stage into class AB at the cost of a small idling current. The ceiling on efficiency is π/4, which is ' +
      '78.5 %, and it belongs to an ideal stage driven all the way to its rail. This one reaches 70.6 % at nine ' +
      'volts into a kilohm, and the shortfall is the volt the transistors keep for themselves.',
    whyReads: [
      [() => 25 * Math.PI, 78.53982],
      [(x, p, again) => power(again({ amp: 9, vbias: 0.69 }), { ...p, amp: 9, vbias: 0.69 }).efficiency, 70.61],
    ],
  },
}
