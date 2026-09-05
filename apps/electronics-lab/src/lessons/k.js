// Group K's three registers. Every number here is a reading, checked against
// the solver by experiments.test.js. The poles are roots of the exact
// polynomials, and the two hand methods are read beside them with the error
// each one carries, rather than in place of them.

import { cePoleFor, ceSeenBy, dominant, magAt, millerOf, octcOf, relativeAt, sctcOf, second, unityGain } from '../groups/k.js'

/** The frequency at which the short-circuit current gain reaches one. */
const fT = (x) => unityGain(x.tf)
/** How far the current gain falls over the decade below that frequency. */
const decadeSlope = (x) => 20 * Math.log10(magAt(x.tf, fT(x) / 10) / magAt(x.tf, fT(x)))
/** The same fall over the octave below it, which is the other unit courses use. */
const octaveSlope = (x) => 20 * Math.log10(magAt(x.tf, fT(x) / 2) / magAt(x.tf, fT(x)))
/** How far the response is below the midband gain at the dominant pole. */
const dropAtPole = (x) => relativeAt(x, dominant(x)).db
/** How far the phase has fallen behind the midband value there. */
const lagAtPole = (x) => -relativeAt(x, dominant(x)).deg
/** The corner the sum of the open-circuit time constants estimates. */
const octcCorner = (x) => octcOf(x).fh
/** How far that estimate lands from the exact dominant pole, as a percentage. */
const octcError = (x) => 100 * (octcOf(x).fh / dominant(x) - 1)
/** The corner the Miller estimate gives, and its error the same way. */
const millerCorner = (x, p) => millerOf(x, p).fh
const millerError = (x, p) => 100 * (millerOf(x, p).fh / dominant(x) - 1)
/** One capacitance's open-circuit time constant, and the resistance behind it. */
const tau = (id) => (x) => octcOf(x).taus.find((t) => t.id === id).tau
const seenBy = (id) => (x) => octcOf(x).taus.find((t) => t.id === id).r
/** The same two at the low end, where the other capacitors are shorts. */
const lowSeenBy = (id) => (x) => sctcOf(x).taus.find((t) => t.id === id).r
const lowCorner = (id) => (x) => sctcOf(x).taus.find((t) => t.id === id).hz
/** The common emitter's dominant pole at the same device and source. */
const cePole = (rc) => (x, p) => cePoleFor({ ...p, rc: rc ?? p.rc })
/** What the same capacitance sees in that common emitter, at these knobs. */
const ceSeen = (rc) => (x, p) => ceSeenBy({ ...p, rc: rc ?? p.rc }, 'Q1.cmu')

export const LESSONS_K = {
  k1: {
    see:
      'The collector is held at a fixed voltage, so the only place the base current can go is into the two ' +
      'capacitances and the base junction. The short-circuit current gain is 105.0 at low frequency and starts ' +
      'falling at 2.656 MHz. It reaches one at 280.0 MHz, which is this device’s f_T.',
    seeReads: [
      ['corner.high', 2655758.2],
      [fT, 279986190],
      [(x) => x.point.Q1.gm * x.point.Q1.rpi, 104.998],
    ],
    try: [
      {
        say: 'Set the collector current to 0.250 mA. The transconductance falls fourfold and f_T falls with it, to 70.18 MHz.',
        set: { ic: 0.25e-3 },
        reads: [
          [fT, 70184033],
          ['op.Q1.gm', 0.0096704088],
        ],
      },
      {
        say: 'Set it to 1.50 mA instead. f_T climbs to 419.2 MHz, because g_m rises with current and the two capacitances here do not.',
        set: { ic: 1.5e-3 },
        reads: [[fT, 419231350]],
      },
      {
        say: 'Set C_π to 80.0 pF, a slower device at the same current. f_T falls to 75.02 MHz, and the slope over the decade below it is still 19.96 dB.',
        set: { cpi: 80e-12 },
        reads: [
          [fT, 75024536],
          [decadeSlope, 19.958648],
        ],
      },
    ],
    whyReads: [
      [fT, 279986190],
      [(x, p) => x.point.Q1.gm / (2 * Math.PI * (p.cpi + p.cmu)), 279833160],
      [decadeSlope, 19.926111],
      [octaveSlope, 5.9926511],
    ],
    why:
      'Hold the collector still and the device has one job left. It charges its own capacitances. The base ' +
      'current divides between them and r_π. Above the corner where their impedance falls below r_π, almost ' +
      'all of it goes to the capacitors. One pole costs 6 dB per octave, which is 20 dB per decade. This one ' +
      'measures 5.99 dB per octave and 19.93 dB per decade. Multiply the low-frequency gain by the corner and ' +
      'r_π cancels. What is left is g_m over the two ' +
      'capacitances. That product is 279.8 MHz here, against the 280.0 MHz the polynomials give. The small ' +
      'gap is the zero the collector capacitance also makes. f_T is the number a data sheet quotes, and every ' +
      'corner in this group is some fraction of it.',
  },

  k2: {
    see:
      'Two capacitors separate the signal from the bias. The coupling capacitor passes the signal into the ' +
      'base and blocks the divider. The bypass capacitor holds the emitter still for the signal, while the ' +
      'emitter resistor goes on setting 1.035 mA. The gain falls away below 103.6 Hz.',
    seeReads: [
      ['corner.low', 103.56977],
      ['op.Q1.ic', 0.0010349463],
    ],
    try: [
      {
        say: 'Set the bypass capacitor to 4.70 µF, a tenth of what it was. The corner moves up tenfold, to 992.4 Hz.',
        set: { ce: 4.7e-6 },
        reads: [['corner.low', 992.39888]],
      },
      {
        say: 'Set it back to 47.0 µF and the coupling capacitor to 1.00 µF. The corner moves to 141.6 Hz, much less than tenfold.',
        set: { ce: 47e-6, cc: 1e-6 },
        reads: [['corner.low', 141.60704]],
      },
      {
        say: 'Set the bypass capacitor to 470 µF. The corner falls to 14.16 Hz, and the coupling capacitor is what limits it now.',
        set: { ce: 470e-6 },
        reads: [
          ['corner.low', 14.163485],
          [lowCorner('CC'), 5.203078],
        ],
      },
    ],
    whyReads: [
      [lowSeenBy('CE'), 33.867867],
      [lowSeenBy('CC'), 3058.8614],
      [lowCorner('CE'), 99.984902],
      [lowCorner('CC'), 5.203078],
      ['corner.low', 103.56977],
    ],
    why:
      'Each capacitor makes a high-pass with the resistance across it. The resistance is what tells the two ' +
      'apart. The coupling capacitor sees the source resistance and the base network, 3.059 kΩ, so at 10.0 µF ' +
      'its corner is 5.203 Hz. The bypass capacitor looks into an emitter instead. What it finds there is one ' +
      'over the transconductance plus a share of the base circuit, 33.87 Ω. At 47.0 µF that gives 99.98 Hz, ' +
      'nineteen times higher, and the exact corner of 103.6 Hz follows it. A course often raises the ' +
      'wrong capacitor first and sees almost nothing change. The one to raise is the one seeing the smallest ' +
      'resistance, and on a stage like this that is always the bypass. The two capacitances inside the device ' +
      'are left out of this circuit, so the curve above stays flat to the top of the axis. K3 puts them back.',
  },

  k3: {
    see:
      'The collector capacitance is 2.00 pF, and it bridges the base and the collector. Between those two ' +
      'nodes the gain is −134.9, so both plates move and in opposite directions. That is the Miller effect, ' +
      'and it makes the base see 391.2 pF. The dominant pole sits at 539.5 kHz.',
    seeReads: [
      ['gain', -134.91498],
      ['pole.1.hz', 539545.49],
      [(x, p) => millerOf(x, p).cin, 3.9123467e-10],
    ],
    try: [
      {
        say: 'Set the collector capacitance to 0.200 pF. The multiplied part falls tenfold and the pole climbs to 3.756 MHz.',
        set: { cmu: 0.2e-12 },
        reads: [['pole.1.hz', 3756306.7]],
      },
      {
        say: 'Set it back to 2.00 pF and the source resistance to 10.0 kΩ. The same capacitance now charges through more, so the pole falls to 188.5 kHz.',
        set: { cmu: 2e-12, rs: 10000 },
        reads: [
          ['pole.1.hz', 188499.7],
          ['gain', -39.414664],
        ],
      },
      {
        say: 'Set the collector capacitance to 10.0 pF. The pole falls to 112.2 kHz, and the zero it also makes moves down to 615.6 MHz.',
        set: { cmu: 10e-12 },
        reads: [
          ['pole.1.hz', 112214.6],
          ['zero.1.hz', 615638810],
        ],
      },
      {
        say: 'Read the response at that pole rather than the pole itself. The magnitude is 3.01 dB under the midband gain, and the phase has fallen 45.1° behind it.',
        reads: [
          [dropAtPole, -3.010311],
          [lagAtPole, 45.101908],
        ],
      },
    ],
    whyReads: [
      [(x, p) => millerOf(x, p).multiplier, 185.61733],
      [(x, p) => millerCorner(x, p), 556666.44],
      ['pole.1.hz', 539545.49],
      [(x, p) => millerError(x, p), 3.1732169],
      [(x, p) => p.cmu * millerOf(x, p).multiplier, 3.7123467e-10],
      [(x, p) => millerOf(x, p).cin, 3.9123467e-10],
      ['zero.1.hz', 3078194000],
    ],
    why:
      'A capacitance between two nodes that move opposite ways carries the current of a much larger one. The ' +
      'base end moves by v and the collector end by −g_m R_L v, so the charge that flows is (1 + g_m R_L) ' +
      'C_µ v. The multiplier is 185.6 here, which turns 2.00 pF into 371 pF at the base. Adding C_π gives ' +
      '391.2 pF, and one over 2π R_in C_in is 556.7 kHz. The exact pole is 539.5 kHz, so the estimate is ' +
      '3.17 % high. It spends the whole capacitance on one pole, and the second pole holds some of it back. ' +
      'The same capacitance also feeds the signal forward to the collector. That makes a zero at g_m/C_µ, ' +
      '3.078 GHz here, far above anything that matters.',
  },

  k4: {
    see:
      'The two capacitances carry 14.62 ns and 280.8 ns of time constant, each measured with the other one ' +
      'open. Their sum is 295.5 ns, and one over 2π times that is 538.7 kHz. The exact dominant pole is ' +
      '539.5 kHz, so the estimate is 0.16 % low.',
    seeReads: [
      [tau('Q1.cpi'), 1.4615635e-8],
      [tau('Q1.cmu'), 2.8083698e-7],
      [(x) => octcOf(x).sum, 2.9545261e-7],
      [octcCorner, 538681.79],
      ['pole.1.hz', 539545.49],
      [(x) => -octcError(x), 0.16007902],
    ],
    try: [
      {
        say: 'Set the collector capacitance to 0.200 pF. The sum of the time constants falls to 42.70 ns, and the estimate is now 0.77 % low.',
        set: { cmu: 0.2e-12 },
        reads: [
          [(x) => octcOf(x).sum, 4.2699333e-8],
          [(x) => -octcError(x), 0.7711416],
        ],
      },
      {
        say: 'Read the two poles at that setting. They are 128.7 apart rather than 623.7, and the estimate cost more because of it.',
        set: { cmu: 0.2e-12 },
        reads: [
          [(x) => second(x) / dominant(x), 128.67787],
          [(x, p, again) => second(again({ cmu: 2e-12 })) / dominant(again({ cmu: 2e-12 })), 623.69149],
        ],
      },
      {
        say: 'Set the source resistance to 10.0 kΩ instead. The poles spread to 1749 apart and the estimate is 0.06 % low.',
        set: { rs: 10000 },
        reads: [
          [(x) => second(x) / dominant(x), 1749.0691],
          [(x) => -octcError(x), 0.057140601],
        ],
      },
    ],
    whyReads: [
      [(x) => octcOf(x).sum, 2.9545261e-7],
      [seenBy('Q1.cmu'), 140418.49],
      [tau('Q1.cmu'), 2.8083698e-7],
      [(x) => -octcError(x), 0.16007902],
    ],
    why:
      'The method is called open-circuit time constants, and it is one line of arithmetic per capacitance. ' +
      'Open every capacitance but one, measure the resistance across the one left, multiply, and add. Here ' +
      'C_µ sees 140.4 kΩ, because the current it draws at the base comes back multiplied at the collector. ' +
      'That is where 280.8 ns of the 295.5 ns comes from. The sum is not an approximation at all. It is the ' +
      's coefficient of the denominator polynomial exactly, which the panel below checks. The approximation ' +
      'is reading it as one over the corner, which spends the whole sum on the lowest pole. That costs ' +
      '0.16 % while the second pole is six hundred times up, and more as the two come together.',
  },

  k5: {
    see:
      'The same device, the same source, and the output taken at the emitter. The gain is 0.9927, so the two ' +
      'ends of the collector capacitance move together rather than apart. The dominant pole is 74.56 MHz, ' +
      'against 539.5 kHz for K3’s common emitter.',
    seeReads: [
      ['gain', 0.99271036],
      ['pole.1.hz', 74556783],
      [cePole(5000), 539545.49],
    ],
    try: [
      {
        say: 'Set the emitter resistor to 1.00 kΩ. The gain falls to 0.9662 and the pole to 61.32 MHz, still more than a hundred times K3’s.',
        set: { re: 1000 },
        reads: [
          ['gain', 0.96615829],
          ['pole.1.hz', 61322780],
        ],
      },
      {
        say: 'Set the source resistance to 10.0 kΩ. The pole falls to 7.697 MHz, and the common emitter at the same source falls to 188.5 kHz.',
        set: { rs: 10000 },
        reads: [
          ['pole.1.hz', 7697065.5],
          [cePole(5000), 188499.7],
        ],
      },
      {
        say: 'Read what the collector capacitance sees here. It is 998.0 Ω, against the 140.4 kΩ the same capacitance sees in K3.',
        reads: [
          [seenBy('Q1.cmu'), 998.03685],
          [ceSeen(5000), 140418.49],
        ],
      },
    ],
    whyReads: [
      [seenBy('Q1.cmu'), 998.03685],
      ['pole.1.hz', 74556783],
      [cePole(5000), 539545.49],
      ['gain', 0.99271036],
    ],
    why:
      'The Miller multiplier is one minus the gain across the capacitance. In a common emitter that gain is a ' +
      'large negative number and the multiplier is a large positive one. In an emitter follower the gain is ' +
      '0.9927, so the multiplier is a small fraction. What is left is the plain capacitance in parallel with ' +
      'a large resistance. C_µ sees 998.0 Ω here, and the pole lands at 74.56 MHz rather than 539.5 kHz. The ' +
      'follower buys bandwidth and current gain, and gives up voltage gain to do it. Every wideband circuit ' +
      'in a first course uses that trade somewhere. The next experiment keeps the voltage gain as well.',
  },

  k6: {
    see:
      'A second device stands on the first, its base held at 2.65 V. The lower collector now looks into an ' +
      'emitter rather than a resistor, so it sees 26.10 Ω. The gain is −138.8, as much as K3’s, and the ' +
      'corner climbs to 7.712 MHz from 539.5 kHz.',
    seeReads: [
      ['gain', -138.77708],
      ['corner.high', 7712408.9],
      [(x) => 1 / x.point.Q2.gm, 26.10304],
      [cePole(), 539545.49],
    ],
    try: [
      {
        say: 'Read what the lower collector capacitance sees. It is 1540 Ω, against 140.4 kΩ in K3, and its time constant is 3.081 ns.',
        reads: [
          [seenBy('Q1.cmu'), 1540.4439],
          [tau('Q1.cmu'), 3.0808877e-9],
          [ceSeen(), 140418.49],
        ],
      },
      {
        say: 'Set the cascode bias to 4.00 V. The middle node rises with it, the corner reads 7.693 MHz, and nothing else moves.',
        set: { vcas: 4 },
        reads: [
          ['corner.high', 7692772.3],
          ['gain', -139.25824],
        ],
      },
      {
        say: 'Set the source resistance to 10.0 kΩ. The corner falls to 3.182 MHz, and the plain common emitter at the same source falls to 188.5 kHz.',
        set: { rs: 10000 },
        reads: [
          ['corner.high', 3182010.5],
          [cePole(), 188499.7],
        ],
      },
    ],
    whyReads: [
      [(x) => 1 / x.point.Q2.gm, 26.10304],
      ['corner.high', 7712408.9],
      [cePole(), 539545.49],
      ['gain', -138.77708],
    ],
    why:
      'The Miller multiplier is set by the gain across the capacitance. That gain is set by what the ' +
      'collector sees. Put an emitter there instead of a resistor and it sees 26.10 Ω. The gain across C_µ ' +
      'is then about one, and the multiplier is two. The current still has to go somewhere. The upper device ' +
      'carries it to the load at full gain, because a common base has a current gain of α. The stage ' +
      'therefore keeps −138.8 of voltage gain. Its corner moves from 539.5 kHz to 7.712 MHz. This is the ' +
      'arrangement inside almost every wideband amplifier, and it costs one more device and one more volt of ' +
      'headroom.',
  },
}
