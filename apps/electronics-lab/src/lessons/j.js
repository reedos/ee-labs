// Group J's three registers. Every number here is a reading, checked against
// the solver by experiments.test.js, and every knob move names a setting the
// knob can reach. The gains are centred differences of the exact DC solve,
// which is the tangent measured on the circuit rather than asserted about it.

import { thermalVoltage } from '@ee-labs/network'
import { cmrrDb, gainCM, gainD, linearityShortfall, offsetOf, resistiveGain, shareQ1 } from '../groups/j.js'

const VT = thermalVoltage(300)

/** The share the steering law alone gives, with no Early effect in it. */
const idealShare = (x, p) => 100 / (1 + Math.exp(-p.vid / VT))

/** How far the shared emitter node moves for a differential drive. */
const emitterFollow = (x, p, again) => (again({ vid: p.vid + 1e-3 }).sol.v.e - again({ vid: p.vid - 1e-3 }).sol.v.e) / 2e-3

/** The gain a single collector gives, rather than the two together. */
const singleEnded = (x, p, again) => (again({ vid: p.vid + 1e-4 }).sol.v.c1 - again({ vid: p.vid - 1e-4 }).sol.v.c1) / 2e-4

export const LESSONS_J = {
  j1: {
    see:
      'The tail current source takes 1.00 mA from the two emitters together, and the two bases sit at the same ' +
      'voltage. Each side carries 495.4 µA of collector current, and both collectors rest at 7.523 V. The ' +
      'curve below plots one collector against the difference between the two bases.',
    seeReads: [
      ['op.Q1.ic', 4.9541946e-4],
      ['v.c1', 7.5229027],
      [(x) => shareQ1(x), 50],
    ],
    try: [
      {
        say: 'Set v_id to 103.4 mV, four thermal voltages. Q1 now carries 98.12 % of the tail and its collector has fallen to 5.140 V.',
        set: { vid: 0.1034 },
        reads: [
          [(x) => shareQ1(x), 98.121814],
          ['v.c1', 5.1398351],
        ],
      },
      {
        say: 'Set v_id to 51.7 mV, two thermal voltages. The share is 87.71 %, close to the 88.08 % the steering law alone gives.',
        set: { vid: 0.051704 },
        reads: [
          [(x) => shareQ1(x), 87.712146],
          [idealShare, 88.079708],
        ],
      },
      {
        say: 'Set v_id to −50.0 mV. The steering reverses, Q1 keeps 13.01 % of the tail, and its collector climbs back to 9.356 V.',
        set: { vid: -0.05 },
        reads: [
          [(x) => shareQ1(x), 13.00863],
          ['v.c1', 9.3556034],
        ],
      },
    ],
    whyReads: [[linearityShortfall, 7.1445608]],
    why:
      'One current, two paths, and a junction law that is exponential in the base voltage. The ratio of the two ' +
      'collector currents is therefore e raised to the input difference over V_T, and the two must still add to ' +
      'the tail. That pair of statements fixes both currents. Four thermal voltages of difference put 98 per cent ' +
      'of the tail in one side, so the whole steering happens inside about a tenth of a volt. Near the middle the ' +
      'curve has a straight part, and that part is the amplifier of J2. One thermal voltage of drive already falls ' +
      '7.14 % short of the tangent at the origin, which is the price of using an exponential device as a linear ' +
      'one. The differential pair is the first circuit in this lab whose behaviour is a ratio rather than a value.',
  },

  j2: {
    see:
      'Drive the two bases apart and the two collectors move opposite ways. The difference between them is 93.67 ' +
      'times the difference at the inputs. Each side works at 495.4 µA, so its transconductance is 19.16 mA/V, ' +
      'and the emitter node the two share does not move at all.',
    seeReads: [
      ['gain', -93.673038],
      ['op.Q1.ic', 4.9541946e-4],
      ['op.Q1.gm', 0.01916368],
      [emitterFollow, 0, 1e-9],
    ],
    try: [
      {
        say: 'Set the tail to 0.250 mA. Each side runs at a quarter of the current, so the transconductance falls to 4.792 mA/V and the gain with it.',
        set: { itail: 0.25e-3 },
        reads: [
          ['op.Q1.gm', 0.0047916471],
          ['gain', -23.824066],
        ],
      },
      {
        say: 'Set R_C to 2.50 kΩ. Halving the collector load halves the gain and leaves the transconductance at 19.17 mA/V.',
        set: { rc: 2500 },
        reads: [
          ['gain', -47.377715],
          ['op.Q1.gm', 0.019165668],
        ],
      },
      {
        say: 'Raise the Early voltage to 400 V. The output resistance climbs to 824.3 kΩ, the collector load barely changes, and the gain reaches 95.19.',
        set: { va: 400 },
        reads: [
          ['op.Q1.ro', 824321.4],
          ['gain', -95.188431],
        ],
      },
    ],
    whyReads: [
      ['gain', -93.673038],
      [singleEnded, -46.836465],
      [emitterFollow, 0, 1e-9],
    ],
    why:
      'A balanced drive raises one base by as much as it lowers the other. The extra current one side takes is ' +
      'the current the other gives up, so the node they share carries the same total and stays where it was. ' +
      'That standing still is what makes the half-circuit legitimate. With the emitter at signal ground, each ' +
      'side is the common-emitter stage of a first course, working at half the tail. Its gain is the ' +
      'transconductance times whatever the collector ' +
      'sees, here R_C in parallel with r_o. Taking the output as the difference between the two collectors ' +
      'gives 93.67. Taking it from one collector alone gives 46.84, half as much, because only one of the two ' +
      'sides is being read. The pair costs twice the current for the same gain and buys the rejection of J3.',
  },

  j3: {
    see:
      'R_EE beside the tail source is that source’s own output resistance, 100 kΩ here. A signal applied to both ' +
      'bases together reaches one collector with a gain of 0.02455. A difference between them reaches the two ' +
      'collectors together with a gain of 93.09. The ratio of the two is 71.58 dB of common-mode rejection.',
    seeReads: [
      [gainCM, -0.024545123],
      [gainD, -93.092273],
      [cmrrDb, 71.578968],
    ],
    try: [
      {
        say: 'Set v_cm to 1.00 V. Both collectors fall together by 24.5 mV, and the difference between them stays at zero.',
        set: { vcm: 1 },
        reads: [
          [(x, p, again) => x.sol.v.c1 - again({ vcm: 0 }).sol.v.c1, -0.02454094],
          ['vd.c1.c2', 0, 1e-9],
        ],
      },
      {
        say: 'Set R_EE to 10.0 kΩ. The common-mode gain rises tenfold, to 0.2467, and the rejection falls to 51.03 dB.',
        set: { ree: 1e4 },
        reads: [
          [gainCM, -0.24671479],
          [cmrrDb, 51.03319],
        ],
      },
      {
        say: 'Set R_EE to 1.00 MΩ. The rejection reaches 92.32 dB, more than the closed form below predicts.',
        set: { ree: 1e6 },
        reads: [[cmrrDb, 92.32035]],
      },
    ],
    whyReads: [
      [cmrrDb, 71.578968],
      [gainCM, -0.024545123],
    ],
    why:
      'A common-mode input asks the shared emitter node to follow it. Nothing there can supply the extra ' +
      'current except the tail resistance, so the current that reaches both collectors is the common-mode ' +
      'voltage over twice that resistance. With an ideal source it would be nothing at all. The rejection is ' +
      'the differential gain over this one, and R_C cancels out of the ratio. What is left is twice the ' +
      'transconductance times the tail resistance, 71.58 dB here. A5 measured the same ratio on the op-amp ' +
      'box, where a data sheet had already fixed it. An operational amplifier’s input stage therefore uses a ' +
      'transistor as its tail. A plain resistor cannot reach these numbers, because the same resistor would ' +
      'have to carry the bias current from the supply.',
  },

  j4: {
    see:
      'R_C1 is 1 % larger than R_C2 here, and with no input at all the two collectors sit 24.21 mV apart. Undo ' +
      'that at the input instead, and the voltage it takes is 257.2 µV. That number is the input-referred ' +
      'offset, and it does not depend on the gain.',
    seeReads: [
      ['vd.c1.c2', -0.024213556],
      [offsetOf, -0.00025723414],
    ],
    try: [
      {
        say: 'Set the collector mismatch to 5 %. The offset grows to 1.261 mV, which is not five times the first reading.',
        set: { drc: 5 },
        reads: [[offsetOf, -0.0012610757]],
      },
      {
        say: 'Set the collector mismatch back to 0 % and the device mismatch to 5 %. The offset reads 1.262 mV, the same law from a different cause.',
        set: { drc: 0, dis: 5 },
        reads: [[offsetOf, -0.0012617927]],
      },
      {
        say: 'Set both mismatches to 1 %. The two contributions add, and the offset reads 514.5 µV.',
        set: { drc: 1, dis: 1 },
        reads: [[offsetOf, -0.00051447992]],
      },
    ],
    whyReads: [
      [offsetOf, -0.00025723414],
      [(x, p) => -VT * Math.log(1 + p.drc / 100), -0.00025723595],
    ],
    why:
      'At the null the two collectors are at the same voltage, so the two currents are in the inverse ratio of ' +
      'the two resistors. The junction law turns that ratio into a voltage, and the answer is V_T times the ' +
      'logarithm of one plus the fractional mismatch. A mismatch of the saturation currents gives the same ' +
      'expression, because both enter the ratio the same way. So a 1 % error in either place costs 257.2 µV at ' +
      'the input. Most courses quote V_T times the fraction, which is the logarithm’s first term and half a per ' +
      'cent high at 1 %. Two mismatches add, since two logarithms of a product add. This is the battery A1 put ' +
      'in series with one input, arrived at from the devices rather than assumed.',
  },

  j5: {
    see:
      'Two pnp devices replace the two collector resistors. Q3 carries whatever Q1 carries, Q4 copies it into ' +
      'the output node, and the right side of the pair is already pulling there. Both halves therefore drive ' +
      'one output, which rests at 8.329 V, and the gain to it is 2034.',
    seeReads: [
      ['gain', 2034.2288],
      ['v.c2', 8.329291],
    ],
    try: [
      {
        say: 'Set the mirror’s current gain to 25. The output settles at 5.340 V instead, while the gain barely moves.',
        set: { betap: 25 },
        reads: [
          ['v.c2', 5.3400628],
          ['gain', 2036.622],
        ],
      },
      {
        say: 'Set it to 400 instead. The output climbs to 9.103 V. Three volts of output level for one knob, and the gain is untouched.',
        set: { betap: 400 },
        reads: [
          ['v.c2', 9.1031316],
          ['gain', 2033.0745],
        ],
      },
      {
        say: 'Raise the Early voltage to 400 V. Both output resistances quadruple, and the gain reaches 7839.',
        set: { va: 400 },
        reads: [['gain', 7838.9307]],
      },
    ],
    whyReads: [
      ['gain', 2034.2288],
      [(x) => x.point.Q2.gm * x.point.Q2.ro, 4214.9006],
      [(x, p) => resistiveGain({ ...p, rc: 5000 }), -93.672929],
    ],
    why:
      'A current mirror as a load does two jobs at once. It converts the pair’s two collector currents into one ' +
      'output, so no gain is thrown away by reading a single side. And it presents r_o rather than a resistor, ' +
      'which is a hundred times larger at the same DC drop. The gain is the transconductance times the two ' +
      'output resistances in parallel, 2034 here, against 93.67 for the same pair with resistors at its ' +
      'collectors. One ' +
      'device’s own ceiling is 4215, the intrinsic gain, and no single stage beats it. An active load costs ' +
      'the operating point. Nothing sets the output level except two currents matching, so the mirror’s ' +
      'current gain moves the resting output by volts while leaving the small-signal answer alone. This is ' +
      'the first stage of an operational amplifier.',
  },
}
