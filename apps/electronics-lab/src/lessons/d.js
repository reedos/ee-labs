// Group D's three registers. Every number here is a reading, checked against
// the solver by experiments.test.js, and every knob move names a setting the
// knob can reach. Nothing is typed in from a datasheet: the device laws are
// packages/network's, and the numbers below are what they produce at the
// settings each step names.

import { inverterMargins } from '../groups/d.js'

/** The three-region model's answer at the same settings, for a step that compares them. */
const flat = (again) => again({ model: 'regions' })

export const LESSONS_D = {
  d1: {
    see:
      'The transistor here is two junction diodes and one controlled source, drawn as such. Forward bias ' +
      'across the emitter junction sends 1.000 mA out of the collector, and only 10.00 µA comes back out of ' +
      'the base. The base is thin, so almost everything injected into it crosses instead of recombining.',
    seeReads: [
      ['op.Q1.ic', 0.00099997205],
      ['op.Q1.ib', 9.9997205e-6],
    ],
    try: [
      {
        say: 'Set the drive to 0.600 V. The collector current falls to 120.1 µA, because the law between the two is an exponential rather than a line.',
        set: { vbe: 0.6 },
        reads: [['op.Q1.ic', 1.201037e-4]],
      },
      {
        say: 'Set it to 0.700 V instead. Now 5.748 mA crosses the base, and the base itself still takes a hundredth of that, 57.48 µA.',
        set: { vbe: 0.7 },
        reads: [
          ['op.Q1.ic', 5.7475457e-3],
          ['op.Q1.ib', 5.7475457e-5],
        ],
      },
      {
        say: 'Set β to 50. The collector current does not move, because the drive across the junction sets it. The base current doubles to 20.00 µA.',
        set: { beta: 50 },
        reads: [
          ['op.Q1.ic', 0.00099997205],
          ['op.Q1.ib', 1.9999441e-5],
        ],
      },
    ],
    why:
      'Ebers–Moll is the whole model, and it has three parts. One diode across the emitter junction, one ' +
      'across the collector junction, and one source carrying what the first passes straight over to the ' +
      'collector. What crosses is the same exponential Circuit Elements Lab gave the diode. What fails to ' +
      'cross recombines in the base, and that share is the base current. The ratio of the two is the current ' +
      'gain β, a property of how thin the base is rather than of how hard the device is driven. Its companion ' +
      'α is the collector current over the emitter current, β/(β + 1). Every operating point in this lab is ' +
      'one current and one voltage read off this law, and every slope a later group takes is taken there.',
  },

  d2: {
    see:
      'The curves are i_C against v_CE, one for each base drive. At the drive on the knob the collector ' +
      'passes 1.050 mA, and the curve rises gently instead of running flat. That slope is an output ' +
      'resistance of 100.0 kΩ, and it is the only thing on this plane that the collector voltage changes.',
    seeReads: [
      ['op.Q1.ic', 1.0499706e-3],
      ['op.Q1.ro', 100002.81],
    ],
    try: [
      {
        say: 'Raise the collector to 10.0 V. The current climbs to 1.100 mA with the drive untouched, which is the whole content of the slope.',
        set: { vcc: 10 },
        reads: [['op.Q1.ic', 1.0999693e-3]],
      },
      {
        say: 'Drop it to 2.00 V. The current falls to 1.020 mA. Carry the line through both readings back to zero current and it arrives at −100 V.',
        set: { vcc: 2 },
        reads: [
          ['op.Q1.ic', 1.0199715e-3],
          [
            (x, p, again) => {
              const far = again({ vcc: 10 })
              const slope = (far.point.Q1.ic - x.point.Q1.ic) / (far.point.Q1.vce - x.point.Q1.vce)
              return x.point.Q1.vce - x.point.Q1.ic / slope
            },
            -100,
          ],
        ],
      },
      {
        say: 'Cut V_A to 25.0 V. The same drive now passes 1.200 mA and the output resistance falls to 25.00 kΩ, a curve four times steeper.',
        set: { va: 25 },
        reads: [
          ['op.Q1.ic', 1.1999665e-3],
          ['op.Q1.ro', 25000.699],
        ],
      },
      {
        say: 'Raise the drive to 0.71432 V. The current is ten times larger, 10.50 mA, which is the decade a junction gives for V_T ln 10 of extra drive.',
        set: { vbe: 0.71432 },
        reads: [['op.Q1.ic', 1.0501157e-2]],
      },
    ],
    why:
      'Two facts are on this plane. Along a curve, the collector current rises with v_CE as (1 + v_CE/V_A), ' +
      'because a wider collector junction leaves a thinner base for the carriers to cross. The number V_A ' +
      'that names the effect is the Early voltage, and it is the one place every curve of the family ' +
      'extrapolates back to. Across the curves, each decade of current costs the same extra drive, V_T ln 10, ' +
      'which is Shockley’s law read the other way round. The ratio i_C/i_B is larger than β by the same Early ' +
      'factor, because the base current carries no v_CE in it at all. So a device sold as β = 100 measures ' +
      '105 on a curve tracer at 5 V, and the difference is not a fault in either number.',
    whyReads: [[(x) => x.point.Q1.ic / x.point.Q1.ib, 105]],
  },

  d3: {
    see:
      'Two descriptions of one device, on the same axes. The curve passes 1.050 mA at the base current on ' +
      'the knob, and needs 654.8 mV across the emitter junction to do it. The three-region model passes ' +
      'exactly 1.000 mA and puts 700.0 mV there, whatever the collector is doing.',
    seeReads: [
      ['op.Q1.ic', 1.05e-3],
      ['op.Q1.vbe', 0.65479072],
      [(x, p, again) => flat(again).point.Q1.ic, 1e-3],
      [(x, p, again) => flat(again).point.Q1.vbe, 0.7],
    ],
    try: [
      {
        say: 'Switch the model to three regions. The current drops to exactly 1.000 mA, β times the base current, and v_BE snaps to 700.0 mV.',
        set: { model: 'regions' },
        reads: [
          ['op.Q1.ic', 1e-3],
          ['op.Q1.vbe', 0.7],
        ],
      },
      {
        say: 'Set the collector to 1.00 V. The curve reads 1.010 mA against the flat model’s 1.000 mA, so the two agree to a part in a hundred here.',
        set: { vce: 1 },
        reads: [
          ['op.Q1.ic', 1.01e-3],
          [(x, p, again) => flat(again).point.Q1.ic, 1e-3],
        ],
      },
      {
        say: 'Drop the collector to 0.100 V. The curve rolls off to 310.5 µA, and the three-region model has no answer at all down here.',
        set: { vce: 0.1 },
        reads: [
          ['op.Q1.ic', 3.1045118e-4],
          [(x, p, again) => (flat(again).sol ? 'an answer' : 'no answer'), 'no answer'],
        ],
      },
      {
        say: 'Raise the base current to 100.0 µA. Both models scale with it, the curve to 10.50 mA and the flat model to 10.00 mA.',
        set: { ib: 100e-6 },
        reads: [
          ['op.Q1.ic', 1.05e-2],
          [(x, p, again) => flat(again).point.Q1.ic, 1e-2],
        ],
      },
    ],
    why:
      'The three-region model is the device drawn as three straight pieces. Cut off, everything is open. ' +
      'Active, v_BE is 0.700 V and i_C is β i_B, exactly flat. Saturated, v_BE is 0.700 V and v_CE is pinned ' +
      'at its own knee. The gap between it and the curve in the active region is exactly v_CE/V_A, the factor the ' +
      'flat model leaves out. Near the knee the two part company completely. The curve rounds into saturation ' +
      'over about a tenth of a volt, and the flat model has a wall there instead of a curve. Below its own ' +
      'V_CE(sat) it is not a poor description but no description at all, because that state pins v_CE and the ' +
      'source is setting it too. The app gives that reason rather than an empty pane.',
    whyReads: [[(x, p, again) => flat(again).point.Q1.vbe, 0.7]],
  },

  d4: {
    see:
      'The MOSFET’s curves are i_D against v_DS, one for each gate voltage. At the gate setting on the knob ' +
      'the overdrive is 200.0 mV and the drain passes 416.0 µA. Each curve turns where v_DS reaches the ' +
      'overdrive, and past that turn it is nearly flat.',
    seeReads: [
      ['op.M1.id_', 4.16e-4],
      ['op.M1.vov', 0.2],
    ],
    try: [
      {
        say: 'Set λ to zero. The current falls to exactly 400.0 µA, which is half of k_n times the overdrive squared, and the curves run flat.',
        set: { lam: 0 },
        reads: [['op.M1.id_', 4e-4]],
      },
      {
        say: 'Set the gate to 1.20 V. The overdrive is 500.0 mV, two and a half times as much, and the current is 2.600 mA, six and a quarter times as much.',
        set: { vgs: 1.2 },
        reads: [
          ['op.M1.id_', 2.6e-3],
          ['op.M1.vov', 0.5],
        ],
      },
      {
        say: 'Drop the drain to 0.100 V, below the overdrive. The device is in triode there and passes 300.6 µA, less than the flat part of its curve would.',
        set: { vds: 0.1 },
        reads: [
          ['op.M1.id_', 3.006e-4],
          ['op.M1.region', 'triode'],
        ],
      },
      {
        say: 'Set the drain to 0.200 V, exactly the overdrive. The two pieces of the law meet there at 401.6 µA, with the same value and the same slope.',
        set: { vds: 0.2 },
        reads: [['op.M1.id_', 4.016e-4]],
      },
    ],
    why:
      'The square law is a parabola where the junction gave an exponential. In saturation the drain current ' +
      'is half of k_n times the overdrive squared, and the overdrive is how far the gate is driven past the ' +
      'threshold. Below v_DS = V_OV the channel still reaches the drain and the device behaves as a ' +
      'resistor, so the current follows the drain instead of ignoring it. The two pieces meet at the knee ' +
      'with the same value and the same slope, which is what stops a solver from chattering across it. The ' +
      'gentle rise past the knee is channel-length modulation, the MOSFET’s version of the Early effect, and ' +
      'λ is its one number. Set λ to zero and the curves are flat and the output resistance is unbounded, ' +
      'which no real device manages.',
  },

  d5: {
    see:
      'Driven hard enough, the transistor stops amplifying and becomes a closed switch. 430.0 µA into the ' +
      'base carries 9.800 mA through the load, and the collector sits at 200.0 mV. The ratio of those two ' +
      'currents is the forced β, 22.79 here, far below what the device could deliver.',
    seeReads: [
      ['op.Q1.ib', 4.3e-4],
      ['op.Q1.ic', 9.8e-3],
      ['op.Q1.vce', 0.2],
      [(x) => x.point.Q1.ic / x.point.Q1.ib, 22.790698],
    ],
    try: [
      {
        say: 'Set the drive to 0.500 V. Nothing conducts, and the collector rises to the supply, 10.00 V.',
        set: { vin: 0.5 },
        reads: [
          ['op.Q1.vce', 10],
          ['op.Q1.region', 'cutoff'],
        ],
      },
      {
        say: 'Set it to 1.00 V. Now 30.00 µA of base current carries 3.000 mA, exactly β times as much, and the collector holds at 7.000 V.',
        set: { vin: 1 },
        reads: [
          ['op.Q1.ib', 3e-5],
          ['op.Q1.ic', 3e-3],
          ['op.Q1.vce', 7],
        ],
      },
      {
        say: 'Raise R_B to 100 kΩ. The base gets 43.00 µA, less than the load asks of it, so the device stays in its active region at 5.700 V.',
        set: { RB: 100000 },
        reads: [
          ['op.Q1.ib', 4.3e-5],
          ['op.Q1.vce', 5.7],
        ],
      },
      {
        say: 'Raise the load to 5.00 kΩ. It asks for only 1.960 mA now, and the same base drive still holds the collector down at 200.0 mV.',
        set: { RC: 5000 },
        reads: [
          ['op.Q1.ic', 1.96e-3],
          ['op.Q1.vce', 0.2],
        ],
      },
    ],
    why:
      'A switch is a transistor driven so hard that the load decides the current. In the active region β ' +
      'sets i_C from i_B. Past the point where β i_B exceeds what the load can pass, the collector cannot ' +
      'fall any further and the extra base current goes nowhere useful. The device is then saturated, the ' +
      'drop across it is 0.2 V under this model, and the ratio i_C/i_B has fallen to a forced β that the ' +
      'circuit rather than the device chose. Designers give a switch three to ten times the base current the ' +
      'load needs, so that the lowest β in the batch still saturates it. The MOSFET does the same job with ' +
      'R_on instead of a fixed drop, and every switch in Power Lab is that element.',
    whyReads: [['op.Q1.vce', 0.2]],
  },

  d6: {
    see:
      'Two devices on one gate, and one of them is off whenever the other is on. Below 2.050 V the output ' +
      'is high and above 2.950 V it is low. At the midpoint both conduct and the output sits at 2.500 V, ' +
      'half of the 5.000 V supply.',
    seeReads: [
      [(x, p) => inverterMargins(p).vil, 2.0499978],
      [(x, p) => inverterMargins(p).vih, 2.9500022],
      ['v.out', 2.5000002],
      [(x) => x.sol.v.vdd, 5],
    ],
    try: [
      {
        say: 'Set the input to 0 V. The output goes to the supply, 5.000 V, and the pair draws no supply current at all.',
        set: { vin: 0 },
        reads: [
          ['v.out', 5],
          [(x) => Math.abs(x.sol.i.VDD), 0],
        ],
      },
      {
        say: 'Set it to 5 V. The output goes to ground, and the supply current is zero again. A gate that is not switching costs nothing.',
        set: { vin: 5 },
        reads: [
          ['v.out', 0],
          [(x) => Math.abs(x.sol.i.VDD), 0],
        ],
      },
      {
        say: 'Set the input to 2.05 V, where the slope first reaches −1. The output is still 4.550 V, so the gate has given up almost none of its high level.',
        set: { vin: 2.05 },
        reads: [['v.out', 4.55]],
      },
      {
        say: 'Raise the threshold to 0.900 V. Both noise margins move inward, to 2.100 V and 2.900 V, so the gate has less room on either side.',
        set: { vt: 0.9 },
        reads: [
          [(x, p) => inverterMargins(p).vil, 2.0999975],
          [(x, p) => inverterMargins(p).vih, 2.9000025],
        ],
      },
    ],
    why:
      'The two noise margins are the inputs where the transfer curve’s slope is exactly −1. Inside them the ' +
      'pair amplifies, so a small error at the input comes out larger. Outside them it attenuates, so an ' +
      'error comes out smaller and a long chain of gates cleans itself up rather than drifting. Matched ' +
      'devices put the switching threshold at half the supply and the margins symmetrically about it, at ' +
      '(3V_DD + 2V_t)/8 and (5V_DD − 2V_t)/8. Neither number carries k_n, because the two devices divide it ' +
      'out between them. At either end of the sweep one device is cut off, so the supply current is exactly ' +
      'zero and the only power a gate spends is spent switching. That is the door from this lab to Logic Lab.',
  },

  d7: {
    see:
      'The supply and the collector resistor draw a straight line across the curves, from 10.00 V at no ' +
      'current to 2.000 mA at no volts. The device has to sit somewhere on that load line. With the base ' +
      'current on the knob the point lands at 1.000 mA and 5.000 V, halfway along it.',
    seeReads: [
      ['op.Q1.ic', 1e-3],
      ['op.Q1.vce', 5],
      [(x, p) => p.vcc / p.RC, 2e-3],
    ],
    try: [
      {
        say: 'Cut the base current to 1.00 µA. The point slides up the line toward cutoff, to 100.0 µA and 9.500 V.',
        set: { ib: 1e-6 },
        reads: [
          ['op.Q1.ic', 1e-4],
          ['op.Q1.vce', 9.5],
        ],
      },
      {
        say: 'Raise it to 20.0 µA. β asks for 2.000 mA, more than the line allows, so the device saturates at 1.960 mA and 200.0 mV.',
        set: { ib: 20e-6 },
        reads: [
          ['op.Q1.ic', 1.96e-3],
          ['op.Q1.vce', 0.2],
          [(x, p) => p.beta * p.ib, 2e-3],
        ],
      },
      {
        say: 'Switch to the curve model. The same base current gives 1.048 mA and 4.762 V, because the curve it crosses is lifted by the Early factor.',
        set: { model: 'exp' },
        reads: [
          ['op.Q1.ic', 1.047619e-3],
          ['op.Q1.vce', 4.7619048],
        ],
      },
      {
        say: 'Halve the load to 2.00 kΩ. The line is steeper, so the same current leaves the collector higher, at 8.000 V.',
        set: { RC: 2000 },
        reads: [['op.Q1.vce', 8]],
      },
    ],
    why:
      'A device law and a load line are two conditions on the same pair of numbers. The circuit satisfies ' +
      'both at once. The line is Ohm’s law for everything outside the transistor, i_C = (V_CC − v_CE)/R_C. ' +
      'It moves only when the supply or the resistor moves. The curve is the device, and the base current ' +
      'chooses which of the family is in play. Turning the drive slides the point along the line, from 10 V ' +
      'at cutoff to 0.2 V at saturation. What lies between those two ends is the room an output signal has ' +
      'to swing in. Putting the point in the middle of that room is what the next group is about.',
    whyReads: [[(x, p, again) => again({ ib: 20e-6 }).point.Q1.vce, 0.2]],
  },
}
