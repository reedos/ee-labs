// Group L's three registers. Every number here is a reading, checked against
// the solver by experiments.test.js, and every knob move names a setting the
// knob can reach.
//
// Several of the readings are quantities no path names: a return ratio, a
// phase margin, a port resistance. Those are read by a function of the
// analysis, which the test solves and compares exactly as it does a path.

import { solveDC } from '@ee-labs/network'
import { loopMargins, loopT, loopTF, ringOf } from '../groups/l.js'
import { polesOf } from '@ee-labs/network'

/** The return ratio of the source the experiment breaks its loop at. */
const T = (source) => (x) => loopT(x, source)

/** The resistance the input source sees, from the current it delivers at one volt. */
const rIn = (x) => 1 / -solveDC(x.norm, { sources: { V1: 1, It: 0 } }).i.V1

/** The resistance at the output port, from the voltage a unit test current makes. */
const rOut = (x) => solveDC(x.norm, { sources: { V1: 0, It: 1 } }).v.out

/**
 * The same two ports with the controlled source dead, which is the loop
 * opened. Dead means a gain of zero, the reference Blackman's impedance form
 * is written against and the one the math panel's own rows use. A gain of one
 * is not dead: it still returns a ninth of the output and raises the input
 * port by nine per cent.
 */
const rInDead = (x, p, again) => 1 / -solveDC(again({ A0: 0 }).norm, { sources: { V1: 1, It: 0 } }).i.V1
const rOutDead = (x, p, again) => solveDC(again({ A0: 0 }).norm, { sources: { V1: 0, It: 1 } }).v.out

/** The loop's phase margin, and the pole of the loop itself. */
const pmOf = (source) => (x) => loopMargins(loopTF(x, source)).pm
const loopPole = (source) => (x) => polesOf(loopTF(x, source)).sort((a, b) => a.hz - b.hz)[0].hz

export const LESSONS_L = {
  l1: {
    see:
      'The amplifier’s gain is 100 000. The divider sends a tenth of the output back to the inverting input. ' +
      'Break the loop at that controlled source, drive it with one unit of its own controlling signal, and ' +
      '10 000 comes back. That is the return ratio. The output reads 9.999 V, short of ten times the input by ' +
      'one part in it.',
    seeReads: [
      ['v.out', 9.9990001],
      [T('V2'), 10000],
    ],
    try: [
      {
        say: 'Set A₀ to 1 000. The return ratio falls to 100 with it, and the output reads 9.90 V, a full one per cent short of what the resistors ask for.',
        set: { A0: 1e3 },
        reads: [
          ['v.out', 9.9009901],
          [T('V2'), 100],
        ],
      },
      {
        say: 'Set R_f to 90 kΩ. The divider now returns a hundredth of the output, the return ratio drops to 1 099, and the output climbs to 90.9 V.',
        set: { Rf: 90000 },
        reads: [
          ['v.out', 90.917265],
          [T('V2'), 1098.9011],
        ],
      },
      {
        say: 'Set V₁ to 0.5 V. The circuit is linear, so the output halves to 5.00 V while the return ratio does not move at all.',
        set: { E: 0.5 },
        reads: [
          ['v.out', 4.9995],
          [T('V2'), 10000],
        ],
      },
    ],
    why:
      'A return ratio belongs to one controlled source rather than to the circuit as a whole, and the measurement ' +
      'is the one a designer makes on the bench. Kill the input, cut the loop at one point, drive one side of the ' +
      'cut, and read what comes back to the other. Blackman’s form then writes the answer as A∞·T/(1 + T) + d, ' +
      'where A∞ is the gain an infinite source would give and d is what gets through with that source dead. Here ' +
      'A∞ is ten, the divider read backwards, and d is nothing at all. The form assumes nothing about which ' +
      'topology the loop is, so series and shunt feedback are described by the same three numbers. An ideal ' +
      'op-amp has infinite gain, so its return ratio is infinite and 1 + T carries no information. That is what ' +
      'makes this group write its amplifiers out as sources with a finite gain.',
  },

  l2: {
    see:
      'Halve the amplifier’s own gain and almost nothing changes outside it. The output moves from 9.999 V to ' +
      '9.998 V, one part in ten thousand, because the loop divides every fractional change in the forward gain by ' +
      '1 + T. What it costs is the gain itself, from 100 000 down to ten.',
    seeReads: [
      ['v.out', 9.9990001],
      [(x, p, again) => again({ A0: 5e4 }).sol.v.out, 9.9980004],
    ],
    try: [
      {
        say: 'Set A₀ to 1 000. The output falls to 9.90 V, and halving the gain from here would cost nearly one per cent instead of one part in ten thousand.',
        set: { A0: 1e3 },
        reads: [
          ['v.out', 9.9009901],
          [(x, p, again) => again({ A0: 500 }).sol.v.out / x.sol.v.out - 1, -0.0098029],
        ],
      },
      {
        say: 'Set R_f to 1 kΩ. The divider returns half the output, the return ratio rises to 50 000, and the output settles at 2.00 V.',
        set: { Rf: 1000 },
        reads: [
          ['v.out', 1.99996],
          [T('V2'), 50000],
        ],
      },
      {
        say: 'Set A₀ to 10 000. The output reads 9.99 V, and a one per cent rise in the amplifier now moves it by a thousandth of that one per cent.',
        set: { A0: 1e4 },
        reads: [
          ['v.out', 9.99001],
          [(x, p, again) => again({ A0: 1.01e4 }).sol.v.out / x.sol.v.out - 1, 9.8912e-6],
        ],
      },
    ],
    why:
      'Feedback does not make an amplifier better. It trades gain, which is cheap, for insensitivity, which is ' +
      'not. The forward amplifier here has a gain of 100 000 and the closed loop has a gain of ten, so a factor ' +
      'of 1 + T has been spent. What that buys is desensitivity, and it applies to every fractional change in the ' +
      'forward path. Temperature, supply voltage and the spread from one transistor to the next all move the ' +
      'forward gain, and none of them moves the closed-loop gain by much. The closed-loop gain is set by the two ' +
      'resistors instead, and a pair of resistors is the most stable thing on a board. The rule has an edge. Above the loop’s own ' +
      'bandwidth there is no loop gain left to divide by, so there is nothing left to buy.',
  },

  l3: {
    see:
      'The amplifier is written out as a transconductance into one resistor and one capacitor, then a buffer. ' +
      'That gives the loop a pole at 10.0 Hz. Closing the loop moves the closed-loop pole out by 1 + T, so at a ' +
      'gain of eleven the response is flat to 90.9 kHz.',
    seeReads: [
      ['corner.high', 90919.09],
      [loopPole('G1'), 10],
    ],
    try: [
      {
        say: 'Set R_f to 100 kΩ. The gain rises to 100.9 and the corner comes in to 9.91 kHz, so the product of the two hardly moves.',
        set: { Rf: 100000 },
        reads: [
          ['gain', 100.8981],
          ['corner.high', 9910.99],
        ],
      },
      {
        say: 'Set R_f to 1 kΩ. At a gain of 2.00 the loop still has 50 000 of return ratio to spend, and the corner is out at 500 kHz.',
        set: { Rf: 1000 },
        reads: [
          ['gain', 1.99996],
          ['corner.high', 500010],
        ],
      },
      {
        say: 'Raise f_t to 10 MHz. Every corner moves out tenfold with it, and this one reads 909 kHz.',
        set: { ft: 1e7 },
        reads: [['corner.high', 909190.9]],
      },
    ],
    why:
      'The open-loop gain has one pole, so the return ratio has the same pole and the same shape. Closing the ' +
      'loop leaves the numerator alone and adds one to the denominator, which moves the pole out by exactly ' +
      '1 + T. Since T at DC is A₀β and the closed-loop gain is near 1/β, the product of gain and bandwidth is ' +
      'near the amplifier’s own f_t. It is not exactly f_t. The product is f_t plus the closed-loop gain times ' +
      'f_p, and that second term is what a textbook drops. Reading the result from the loop rather than from the ' +
      'closed-loop response says why it holds. The return ratio falls at twenty decibels per decade from f_p and ' +
      'reaches one at f_t, whatever the divider is set to. Where the loop gain has gone, so has everything it ' +
      'was buying.',
  },

  l4: {
    see:
      'The source sees 1.00 MΩ with the loop dead and 9.09 GΩ with it closed. Series mixing puts the fed-back ' +
      'voltage in series with the input, so the source has to push against 1 + T times as much. A load sees ' +
      '909 Ω dead and 100 mΩ closed, because shunt sampling lowers that port by the same factor.',
    seeReads: [
      [rIn, 9091910000],
      [rOut, 0.100079],
      [rInDead, 1000909],
      [rOutDead, 909.0827],
    ],
    try: [
      {
        say: 'Set A₀ to 1. Almost no loop gain is left, so the input port reads 1.09 MΩ and the output port 833 Ω, both within a tenth of what the resistors alone give.',
        set: { A0: 1 },
        reads: [
          [rIn, 1091818],
          [rOut, 833.3888],
        ],
      },
      {
        say: 'Set the test current to 1 mA and V₁ to 0 V. The output reads 100 µV, which is that current through the closed-loop output resistance.',
        set: { It: 1e-3, E: 0 },
        reads: [['v.out', 1.00079e-4]],
      },
      {
        say: 'Raise R_o to 10 kΩ. The amplifier’s own output resistance is ten times worse and the closed-loop figure follows it, to 1.00 Ω.',
        set: { Ro: 10000 },
        reads: [[rOut, 1.0007]],
      },
    ],
    why:
      'A port’s resistance is measured the way it is defined. Kill every source, drive one terminal with a test ' +
      'source, and divide the voltage by the current. Nothing about the circuit inside has to be known for that ' +
      'to work, which is why it survives dependent sources. What feedback does to a port depends on two things, ' +
      'how the loop mixes the fed-back signal into the input and how it samples the output. Mixing in series ' +
      'raises the input resistance by 1 + T, and mixing in shunt lowers it by the same factor. Sampling the ' +
      'output voltage lowers the output resistance, and sampling the output current raises it. The four ' +
      'combinations make four topologies, and one factor covers all of them. An emitter resistor is the ' +
      'series-series case, and it raises both ports at once.',
  },

  l5: {
    see:
      'Three lag sections sit inside one loop. At a forward gain of eight the closed-loop poles are a complex ' +
      'pair at 2.37 kHz with a damping of 0.313, so a step overshoots badly. Raise the gain and the pair walks ' +
      'toward the imaginary axis.',
    seeReads: [
      ['pole.1.hz', 2367],
      [(x) => ringOf(x.poles).zeta, 0.3129917],
    ],
    try: [
      {
        say: 'Set A₀ to 29. The pair lands on the imaginary axis at 3.90 kHz, the phase margin reads 0°, and the circuit oscillates there rather than settling.',
        set: { A0: 29 },
        reads: [
          ['pole.1.hz', 3898.5],
          [pmOf('Vfb'), 0, 0.02],
        ],
      },
      {
        say: 'Set A₀ to 40. The pair has crossed into the right half plane and its real part is positive, so any disturbance grows instead of dying away.',
        set: { A0: 40 },
        reads: [[(x) => x.poles[0].re, 1603.1]],
      },
      {
        say: 'Set C₃ to 1 pF and A₀ to 1 000. With the third pole far out of the way the pair rings hard, at a damping of 0.0458, and still stays left of the axis.',
        set: { C3: 1e-12, A0: 1000 },
        reads: [
          [(x) => ringOf(x.poles).zeta, 0.0458309],
          [(x) => x.poles[0].re, -14499],
        ],
      },
    ],
    why:
      'Each lag section can cost the loop ninety degrees of phase, and it takes half a turn to make feedback add ' +
      'rather than subtract. Two sections approach that limit without reaching it, so the closed-loop poles climb ' +
      'the plane as the gain rises and the response rings, and they never cross. Three sections do reach it. The ' +
      'characteristic polynomial here is the ladder’s own denominator plus the gain, so only its constant term ' +
      'moves. Every other coefficient belongs to the ladder, which is why the three poles keep the same sum ' +
      'however hard the loop is driven. Three equal sections reach half a turn at √6/RC, and the forward gain ' +
      'that puts the poles on the axis there is 29. Above it the amplifier is an oscillator, which is a subject ' +
      'of its own.',
  },

  l6: {
    see:
      'The buffer feeds all of its output back, so its return ratio is the whole open-loop gain of 100 000. Its ' +
      'own output resistance is 75 Ω, and the loop divides that by 1 + T. A test source at the output measures ' +
      '750 µΩ, which is what a load actually meets.',
    seeReads: [[rOut, 0.000749993]],
    try: [
      {
        say: 'Set A₀ to 1 000. There is a hundred times less loop gain to divide by, so the output resistance rises a hundredfold, to 74.9 mΩ.',
        set: { A0: 1e3 },
        reads: [[rOut, 0.0749251]],
      },
      {
        say: 'Set R_out to 1 kΩ. The amplifier is thirteen times worse on its own, and the closed-loop figure follows it to 10.0 mΩ.',
        set: { rout: 1000 },
        reads: [[rOut, 0.0099999]],
      },
      {
        say: 'Set V₁ to 0 V. With no input applied the output rests at 750 nV, which is the test current through that resistance.',
        set: { E: 0 },
        reads: [['v.out', 7.49993e-7]],
      },
    ],
    why:
      'A buffer has a low output resistance before any loop is closed, and feedback lowers it again by 1 + T. ' +
      'The reason is the one that raises an input resistance, read the other way round. A current pushed into ' +
      'the output moves the output voltage, the loop sees that move at its input, and it drives the output stage ' +
      'to oppose the move. What is left is the resistance the stage started with divided by the loop gain. Two ' +
      'limits sit behind the number. Loop gain falls with frequency, so the output resistance climbs with ' +
      'frequency and a buffer looks inductive well below its bandwidth. And the output stage still has a current ' +
      'limit, which no amount of loop gain moves. A milliohm of output resistance promises nothing about how ' +
      'much current the part can deliver.',
  },
}
