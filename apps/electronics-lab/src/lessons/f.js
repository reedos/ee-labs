// Group F's three registers. Every number here is a reading, checked against
// the solver by experiments.test.js, and every knob move names a setting the
// knob can reach. Nothing is quoted from a datasheet: the bias voltages come
// from `vbeFor` and `vgsFor`, which invert each device's own law.

import { thermalVoltage } from '@ee-labs/network'
import { hd2Of, vbeFor, vgsFor } from '../groups/f.js'

const VT = thermalVoltage(300)

/** The second harmonic of the drive now set, as a percentage of the fundamental. */
const hd2 = (x, p, again, e) => 100 * hd2Of(e, p, 'drive', 0, p.drive)
/** Where the tangent taken at the bias says the collector would be at this drive. */
const tangentAt = (x, p, again) => {
  const bias = again({ drive: 0 })
  return bias.sol.v.c + bias.gain * p.drive
}
/** The central difference of a quantity over ±50 µV of a knob, against what it should equal. */
const central = (again, key, at, read) => (read(again({ [key]: at + 5e-5 })) - read(again({ [key]: at - 5e-5 }))) / 1e-4

export const LESSONS_F = {
  f1: {
    see:
      'A junction carrying 1.00 mA has a small-signal slope of 25.85 Ω. The transistor beside it sits at ' +
      '653.5 mV on its base and passes 1.000 mA in its collector, and its slope reads 38.68 mA/V. Inverted, ' +
      'that is 25.85 Ω as well. One exponential law gives both numbers.',
    seeReads: [
      ['op.D1.rd', 25.852],
      ['op.Q1.vbe', 0.6535294],
      ['op.Q1.ic', 0.001],
      ['op.Q1.gm', 0.0386817271],
    ],
    try: [
      {
        say: 'Cut the junction to 250 µA. Its slope rises to 103.4 Ω, four times what it was, because the slope is V_T divided by the current.',
        set: { i: 0.25e-3 },
        reads: [['op.D1.rd', 103.407999]],
      },
      {
        say: 'Set the base to 689.4 mV. The collector carries 4.00 mA now, and its slope inverted reads 6.463 Ω.',
        set: { vbe: vbeFor(4e-3) },
        reads: [
          ['op.Q1.ic', 0.004],
          [(x) => 1 / x.point.Q1.gm, 6.46299995],
        ],
      },
      {
        say: 'Set the junction to 4.00 mA as well. Both slopes read 6.463 Ω, and the two devices agree to eight figures.',
        set: { i: 4e-3, vbe: vbeFor(4e-3) },
        reads: [
          ['op.D1.rd', 6.46299995],
          [(x) => 1 / x.point.Q1.gm, 6.46299995],
          [(x) => x.point.D1.rd * x.point.Q1.gm, 1, 1e-8],
        ],
      },
    ],
    whyReads: [
      ['op.D1.rd', 25.852],
      ['op.Q1.gm', 0.0386817271],
    ],
    why:
      'Both numbers are the derivative of the same function. A junction’s current follows e^{v/V_T}, so its ' +
      'derivative with respect to voltage is that current divided by V_T. The junction has two terminals, so ' +
      'the derivative is written as a resistance, 25.85 Ω at 1.00 mA. The transistor sends the same current ' +
      'out of a third terminal, so its derivative is written as a current per volt instead, 38.68 mA/V. The ' +
      'operating point fixes both. Move either device’s bias and its slope moves in proportion, which is why ' +
      'the same current always gives the same slope. Circuit Elements Lab drew this line for the diode alone. ' +
      'Everything the rest of this group builds rests on it being the same line for the transistor.',
  },

  f2: {
    see:
      'The collector sits at 5.000 V and carries 184.6 mV of signal on top of it. The base sits at 653.5 mV ' +
      'and carries 1.00 mV. The meters print both, because superposition allows a linear response to be added ' +
      'to a bias that does not move.',
    seeReads: [
      ['v.c', 5],
      [(x) => x.ac.v.c, 0.184617334],
      ['op.Q1.vbe', 0.6535294],
      [(x) => x.ac.v.b, 0.001],
    ],
    try: [
      {
        say: 'Raise the signal to 5.00 mV. The collector’s signal grows five times, to 923.1 mV, and the 5.000 V underneath it does not move.',
        set: { amp: 5e-3 },
        reads: [
          [(x) => x.ac.v.c, 0.923086669],
          ['v.c', 5],
        ],
      },
      {
        say: 'Cut it to 100 µV. The signal falls to 18.46 mV and the bias is still 5.000 V, because the DC solve never saw the signal at all.',
        set: { amp: 1e-4 },
        reads: [
          [(x) => x.ac.v.c, 0.0184617334],
          ['v.c', 5],
        ],
      },
      {
        say: 'Set the base to 689.4 mV instead. The bias falls to 37.04 mV at the collector, the transistor saturates, and the signal there collapses to 1.092 mV.',
        set: { vbe: vbeFor(4e-3) },
        reads: [
          ['v.c', 0.0370436029],
          [(x) => x.ac.v.c, 0.00109227137],
        ],
      },
    ],
    why:
      'A bias and a signal share one wire and are read apart because the response to the signal is linear. ' +
      'Superposition is that statement. The DC solve finds where the base and the collector sit with the ' +
      'signal switched off. The tangent taken there is a netlist of resistors and one controlled source, ' +
      'which the phasor solve answers on its own. The two answers are added at the meter. The split is only as ' +
      'good as the tangent underneath it. The transistor’s law is an exponential, so a signal large enough to ' +
      'bend it puts power at frequencies no linear answer has room for, and F5 measures where that begins.',
  },

  f3: {
    see:
      'Both devices carry 440 µA. The bipolar transistor’s slope reads 17.02 mA/V and the MOSFET’s reads ' +
      '4.400 mA/V. An exponential differentiates to itself, so the first is the collector current divided by ' +
      'V_T. A square law differentiates to a straight line, so the second is twice the drain current divided ' +
      'by the 200 mV of overdrive.',
    seeReads: [
      ['op.Q1.ic', 0.00044],
      ['op.M1.id_', 0.00044],
      ['op.Q1.gm', 0.01701996],
      ['op.M1.gm', 0.0044],
      ['op.M1.vov', 0.2],
    ],
    try: [
      {
        say: 'Set the base to 650.2 mV, one V_T ln 2 higher. The collector current doubles to 880 µA and the slope doubles with it, to 34.04 mA/V.',
        set: { vbe: vbeFor(0.88e-3) },
        reads: [
          ['op.Q1.ic', 0.00088],
          ['op.Q1.gm', 0.0340399198],
        ],
      },
      {
        say: 'Set the gate to 982.8 mV. The drain current doubles to 880 µA as well, and the slope rises only to 6.223 mA/V, by a factor of √2.',
        set: { vgs: vgsFor(0.88e-3) },
        reads: [
          ['op.M1.id_', 0.00088],
          ['op.M1.gm', 0.00622253967],
        ],
      },
      {
        say: 'Set the gate to 1.10 V. The drain current is four times its first reading, at 1.76 mA, and the slope is twice it, at 8.800 mA/V.',
        set: { vgs: 1.1 },
        reads: [
          ['op.M1.id_', 0.00176],
          ['op.M1.gm', 0.0088],
        ],
      },
    ],
    whyReads: [
      ['op.M1.id_', 0.00044],
      [(x, p, again) => central(again, 'vbe', p.vbe, (y) => y.point.Q1.ic) / x.point.Q1.gm, 1, 1e-6],
      [(x, p) => (x.point.Q1.gm * x.point.Q1.gm) / (2 * p.kn), 0.00724197093],
    ],
    why:
      'Transconductance is a derivative, and it is measured here as one. Moving the base a fraction of a ' +
      'millivolt each way and taking the central difference of the collector current reproduces the printed ' +
      'slope to a part in a million. The two laws differ in shape rather than in kind. The exponential’s ' +
      'derivative is proportional to the function itself, so the slope follows the current. The square law’s ' +
      'derivative is a straight line, so the slope follows the square root of the current. This MOSFET would ' +
      'need 7.24 mA to reach the bipolar device’s slope at 440 µA, sixteen times the current for the same ' +
      'job. That ratio is why a bipolar input stage is still chosen where gain per milliamp is what matters.',
  },

  f4: {
    see:
      'The equations pane prints the hybrid-π as a netlist. It holds r_π at 2.714 kΩ, r_o at 105.0 kΩ, and a ' +
      'controlled source of 38.68 mA/V times the base’s own signal. Those three give a gain of −184.6. The ' +
      'slope of the characteristic beside them is that same number.',
    seeReads: [
      ['op.Q1.rpi', 2714.45998],
      ['op.Q1.ro', 105000.011],
      ['op.Q1.gm', 0.0386817271],
      ['gain', -184.617334],
    ],
    try: [
      {
        say: 'Set R_C to 1.00 kΩ. The gain falls to −39.76 while r_π stays at 2.714 kΩ, because r_π follows the base voltage and nothing else.',
        set: { RC: 1000 },
        reads: [
          ['gain', -39.7627223],
          ['op.Q1.rpi', 2714.45998],
        ],
      },
      {
        say: 'Double β to 200. r_π doubles to 5.429 kΩ and the gain does not move, because an ideal source delivers the base current at no cost.',
        set: { beta: 200 },
        reads: [
          ['op.Q1.rpi', 5428.91996],
          ['gain', -184.617334],
        ],
      },
      {
        say: 'Set V_A to 200 V. r_o doubles to 210.0 kΩ and the gain rises only to −184.5, because R_C is much the smaller of the two.',
        set: { va: 200 },
        reads: [
          ['op.Q1.ro', 210000.044],
          ['gain', -184.517487],
        ],
      },
    ],
    whyReads: [
      ['op.Q1.ro', 105000.011],
      [(x, p) => p.va / x.point.Q1.ic, 100000],
      [(x, p, again) => central(again, 'vbe', p.vbe, (y) => y.sol.v.c) / x.gain, 1, 1e-6],
    ],
    why:
      'Each element of the hybrid-π is a partial derivative of the device’s law at the point. The base ' +
      'current’s slope gives r_π, which is β over g_m at the β the device really has, 105 rather than the ' +
      '100 the knob names. The Early effect raises the collector current without raising the base current, ' +
      'and the two differ by exactly that factor. The collector current’s slope against V_CE gives r_o, ' +
      'which is (V_A + V_CE)/I_C, or 105.0 kΩ here. The textbook’s V_A/I_C gives 100.0 kΩ instead. The model ' +
      'earns its place by one measurement. The gain this netlist predicts equals the slope of the ' +
      'quasi-static characteristic at the point, to better than a part in a million.',
  },

  f5: {
    see:
      'The drive knob puts the base at the top of its swing. At 5.00 mV the collector reads 3.991 V, where ' +
      'the tangent taken at the bias says 4.077 V. The slope where the base now sits is −219.7 against the ' +
      '−184.6 at the bias. A sine of that amplitude leaves a second harmonic 4.4 % of its fundamental.',
    seeReads: [
      ['v.c', 3.99138509],
      [tangentAt, 4.07691333],
      [hd2, 4.38703351],
    ],
    try: [
      {
        say: 'Cut the drive to 1.00 mV. The collector reads 4.812 V, and the second harmonic is 0.879 % of the fundamental.',
        set: { drive: 1e-3 },
        reads: [
          ['v.c', 4.81210236],
          [hd2, 0.879061089],
        ],
      },
      {
        say: 'Raise it to 10.0 mV. The collector reads 2.793 V and the second harmonic doubles to 8.72 %, as the estimate doubles with it.',
        set: { drive: 10e-3 },
        reads: [
          ['v.c', 2.79327401],
          [hd2, 8.72277727],
        ],
      },
      {
        say: 'Raise it to 20.0 mV. The collector runs down to 99.96 mV, past the amplitude guard, and what the tangent says no longer describes this stage.',
        set: { drive: 20e-3 },
        reads: [['v.c', 0.0999570131]],
      },
    ],
    whyReads: [
      [hd2, 4.38703351],
      [(x, p) => (100 * p.drive) / (4 * VT), 4.83521588],
    ],
    why:
      'An exponential driven by a sine returns a sine at every harmonic of it. The second one is the first ' +
      'that matters, and its size is about the drive divided by four thermal voltages. At this drive that ' +
      'estimate is 4.84 % and the measured figure is 4.39 %, nine per cent apart, because the estimate keeps ' +
      'only the leading term of a series. Both rise with the drive. The guard sits at 5.00 mV, where the ' +
      'tangent still describes the curve to within a few per cent. The small-signal view is declined past ' +
      '20.0 mV, where the collector has run out of room. Nothing here is an approximate solution. Every point ' +
      'is an exact DC solve, and the approximation being measured is the straight line.',
  },

  f6: {
    see:
      'The MOSFET’s tangent has two elements. The controlled source carries 4.231 mA/V times the gate’s ' +
      'signal, and r_o beside it reads 125.0 kΩ. Nothing sits between gate and source, because the gate draws ' +
      '0 A at any bias. Into 5.00 kΩ the gain is −20.34.',
    seeReads: [
      ['op.M1.gm', 0.00423076923],
      ['op.M1.ro', 125000],
      ['i.VG', 0],
      ['gain', -20.3402367],
    ],
    try: [
      {
        say: 'Raise R_D to 10.0 kΩ. The gain nearly doubles, to −37.72, because the drain works into twice the resistance.',
        set: { RD: 10000 },
        reads: [['gain', -37.7229081]],
      },
      {
        say: 'Set λ to 0.04 V⁻¹. r_o halves to 62.50 kΩ and the gain moves only to −20.58, because R_D is the smaller of the two by far.',
        set: { lambda: 0.04 },
        reads: [
          ['op.M1.ro', 62500],
          ['gain', -20.5761317],
        ],
      },
      {
        say: 'Set the gate to 950 mV. The drain current rises to 647 µA and the slope to 5.176 mA/V, and the gate still draws 0 A.',
        set: { vgs: 0.95 },
        reads: [
          ['op.M1.id_', 0.000647058824],
          ['op.M1.gm', 0.00517647059],
          ['i.VG', 0],
        ],
      },
    ],
    whyReads: [
      ['op.M1.id_', 0.000423076923],
      ['op.M1.gm', 0.00423076923],
      [(x) => x.point.M1.id_ / VT, 0.0163653614],
    ],
    why:
      'The gate sits on an oxide, so no current crosses it and the model has no resistance from gate to ' +
      'source. That is the reason for the device and the whole of its advantage as an input. The price is the ' +
      'slope. At 423 µA this device gives 4.231 mA/V where a bipolar transistor at the same current gives ' +
      '16.4 mA/V, four times as much, and F3 measures both. The output resistance comes from ' +
      'channel-length modulation alone. ' +
      'With λ at zero the drain current in saturation would not depend on the drain voltage at all. The ' +
      'output resistance would then be infinite, and the gain would be the slope times R_D.',
  },
}
