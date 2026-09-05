// Group I's three registers. Every number here is a reading, checked against
// the solver by experiments.test.js, and every knob move names a setting the
// knob can reach.
//
// The reference current is not a knob reading: it is the current the reference
// resistor actually passes, so it is read off the solve as (V_CC − v_ref)/R_ref
// and quoted from there.

import { gainFrom, portR, VCC } from '../groups/h.js'

const refCurrent = (x, p, e) => (VCC - x.sol.v.ref) / e.net(p).elements.find((q) => q.id === 'Rref').value
const rout = (node, drop = []) => (x) => portR(x, node, drop)

export const LESSONS_I = {
  i1: {
    see:
      'The reference resistor puts 1.00 mA through the left transistor, and the right one copies it as ' +
      '1.02 mA. Two base currents are taken out of the same node, which costs 2/β. The Early effect adds ' +
      'more, because the output sits at 5.00 V while the reference sits at 654 mV. A test source at the ' +
      'output reads 103 kΩ.',
    seeReads: [
      [(x, p, again, e) => refCurrent(x, p, e), 1.00005e-3],
      ['op.Q2.ic', 1.02291e-3],
      ['v.out', 5],
      ['v.ref', 0.654115],
      [rout('out', ['Vout']), 102649],
    ],
    try: [
      {
        say: 'Switch the Early effect off. The copy is 1.96 % low, which is 2/β of the reference, and the output resistance is infinite.',
        set: { early: false },
        reads: [
          [(x, p, again, e) => 100 * (x.point.Q2.ic / refCurrent(x, p, e) - 1), -1.96078],
          [(x) => 1 / portR(x, 'out', ['Vout']), 0],
        ],
      },
      {
        say: 'Raise the output to 9.00 V. Four more volts across the copying transistor add four per cent, and it now runs 6.18 % high.',
        set: { vout: 9 },
        reads: [[(x, p, again, e) => 100 * (x.point.Q2.ic / refCurrent(x, p, e) - 1), 6.18181]],
      },
      {
        say: 'Set β to 1000. The base-current error nearly vanishes and only the Early term is left, 4.11 % at this output voltage.',
        set: { beta: 1000 },
        reads: [[(x, p, again, e) => 100 * (x.point.Q2.ic / refCurrent(x, p, e) - 1), 4.1103]],
      },
    ],
    why:
      'A current mirror is two matched transistors sharing one base-emitter voltage. The left one is wired ' +
      'as a diode, so whatever current is forced into it sets that voltage. The right one then carries the ' +
      'same current, because it is the same device at the same voltage. Matching is the whole mechanism, and ' +
      'it is why mirrors belong on a chip rather than on a breadboard. Two errors keep it from being exact. Both base ' +
      'currents come out of the reference, which costs 2/β of it. And the two collectors sit at different ' +
      'voltages, so the Early effect makes the currents differ in the ratio of their V_A + V_CE. Neither ' +
      'error depends on the supply or on the temperature, which is what a resistor cannot say.',
  },

  i2: {
    see:
      'A resistor under the copying emitter turns 1.00 mA into 9.98 µA. The 120 mV it drops across 11.9 kΩ ' +
      'is what the base-emitter voltage gives up, and every decade of current costs V_T ln 10. The same ' +
      'resistor lifts the output resistance, from the 10.5 MΩ of r_o alone to 56.8 MΩ.',
    seeReads: [
      [(x, p, again, e) => refCurrent(x, p, e), 1.00003e-3],
      ['op.Q2.ic', 9.97696e-6],
      ['v.e2', 0.119918],
      ['op.Q2.ro', 10512300],
      [rout('out', ['Vout']), 56791400],
    ],
    try: [
      {
        say: 'Set R_E to 2 kΩ. The drop falls to 83.2 mV and the output current rises to 41.2 µA.',
        set: { RE: 2000 },
        reads: [
          ['v.e2', 0.0832404],
          ['op.Q2.ic', 4.12272e-5],
        ],
      },
      {
        say: 'Set R_E to 40 kΩ. The output current falls to 3.62 µA and the output resistance reaches 183 MΩ.',
        set: { RE: 40000 },
        reads: [
          ['op.Q2.ic', 3.61877e-6],
          [rout('out', ['Vout']), 182993000],
        ],
      },
    ],
    why:
      'The Widlar source solves a problem a plain mirror has. A microamp from a ten-volt supply would need a ' +
      'megohm of reference resistor, and no chip can afford that much area. One resistor of a few kilohms ' +
      'under the output emitter does it instead, because the current depends on that resistor’s drop through ' +
      'an exponential. A hundred millivolts of drop buys two decades. The same resistor is emitter ' +
      'degeneration seen from the output, so it multiplies the output resistance by about 1 + g_m R_E as ' +
      'well. A current source that is both small and stiff comes out of one extra part.',
  },

  i3: {
    see:
      'The collector resistor is gone, replaced by a matched pnp pair delivering the same current. What ' +
      'loads the stage now is r_o alone, 105 kΩ from below and 103 kΩ from above, so the gain reaches −2030. ' +
      'The ceiling for one transistor is g_m r_o, which is 4108 here.',
    seeReads: [
      ['op.Q1.ro', 105000],
      ['op.Q3.ro', 102649],
      ['gain', -2030.53],
      [(x) => x.point.Q1.gm * x.point.Q1.ro, 4107.57],
    ],
    try: [
      {
        say: 'Set the bias trim to 1.01. One per cent more current in the npn pulls the output down by 522 mV, and the gain hardly moves.',
        set: { trim: 1.01 },
        reads: [
          [(x, p, again) => again({ trim: 1 }).sol.v.c - x.sol.v.c, 0.52235],
          ['gain', -2030.71],
        ],
      },
      {
        say: 'Set the trim to 0.99. The output rises by 528 mV instead, the same current error into the same 52.2 kΩ at that node.',
        set: { trim: 0.99 },
        reads: [
          [(x, p, again) => x.sol.v.c - again({ trim: 1 }).sol.v.c, 0.527541],
          [rout('c'), 52163.4],
        ],
      },
      {
        say: 'Set V_A to 25 V. Every r_o shrinks with it, and the gain falls to −578.',
        set: { va: 25 },
        reads: [
          ['gain', -577.502],
          ['op.Q1.ro', 30000],
        ],
      },
    ],
    why:
      'An active load is a current source used as a resistor. A resistor that large would drop far more ' +
      'voltage than the supply has, and a current source drops whatever is left over. So one stage reaches ' +
      'its intrinsic gain, g_m r_o, which is V_A over V_T and depends on the device rather than on anything ' +
      'a designer picks. The price is the bias. Two currents face each other at one node whose resistance ' +
      'is tens of kilohms. A per cent of mismatch moves the output by half a volt, and a few per cent puts ' +
      'it against a rail. Every real circuit built this way closes a feedback loop around it to hold ' +
      'the point.',
  },

  i4: {
    see:
      'A common base stands on the common emitter and carries its current. The output resistance measured at ' +
      'the top, with R_C lifted off, reads 10.7 MΩ against the 102 kΩ of r_o alone. The lower collector ' +
      'hardly moves, because it looks into 1/g_m. The gain into 5 kΩ is −191.',
    seeReads: [
      [(x) => portR(x, 'c', ['RC']), 10651900],
      ['op.Q1.ro', 101500],
      ['gain', -191.421],
    ],
    try: [
      {
        say: 'Set β to 50. The output resistance falls to 5.50 MΩ, about half of what it was, because the boost is β.',
        set: { beta: 50 },
        reads: [[(x) => portR(x, 'c', ['RC']), 5503780]],
      },
      {
        say: 'Set the lower collector to 3.00 V. Little moves. The output resistance reads 10.4 MΩ and the gain −191.',
        set: { vc1: 3 },
        reads: [
          [(x) => portR(x, 'c', ['RC']), 10356300],
          ['gain', -191.392],
        ],
      },
      {
        say: 'Set R_C to 2 kΩ. The gain falls to −76.6 with the smaller load, while the output resistance stays above 11 MΩ.',
        set: { RC: 2000 },
        reads: [
          ['gain', -76.6112],
          [(x) => portR(x, 'c', ['RC']), 11257500],
        ],
      },
    ],
    why:
      'The cascode answers a question the common emitter cannot. A common emitter’s own output resistance is ' +
      'r_o, and that caps what any load can usefully be. Put a common base on top and the load is driven ' +
      'from the upper collector instead, whose output resistance is r_o multiplied by roughly β. The lower ' +
      'transistor still sets the current, and its own collector barely moves, because it looks into 1/g_m. ' +
      'Two things follow. An active load can now work against a resistance high enough to matter, and the ' +
      'voltage at the lower collector barely swings, which is what keeps a stage fast.',
  },

  i5: {
    see:
      'Two common emitters in a row do not multiply their unloaded gains. The first stage’s output ' +
      'resistance is 4.77 kΩ and the second stage’s input resistance is 2.58 kΩ, so the first delivers 64.8 ' +
      'rather than 185. With the second stage’s 193 the pair reaches 81.9 dB.',
    seeReads: [
      [(x) => portR(x, 'c1', ['CC']), 4772.73],
      [(x) => portR(x, 'b2', ['CC']), 2578.41],
      ['H.db', 81.9341],
      [(x) => gainFrom(x, 'b2', 'c2', ['CC', 'Vs']), -192.947],
      [(x) => x.point.Q1.gm * portR(x, 'c1', ['CC']), 184.617],
    ],
    try: [
      {
        say: 'Set R_C to 1 kΩ. Both stages lose gain and the pair falls to 61.2 dB.',
        set: { RC: 1000 },
        reads: [['H.db', 61.2494]],
      },
      {
        say: 'Set R_C to 3 kΩ. The first stage’s output resistance falls to 2.92 kΩ, so it loses less to the load, and the pair reads 76.1 dB.',
        set: { RC: 3000 },
        reads: [
          [(x) => portR(x, 'c1', ['CC']), 2918.18],
          ['H.db', 76.0831],
        ],
      },
      {
        say: 'Raise the coupling capacitor to 100 µF. Nothing changes at a kilohertz, because its corner was already far below the band.',
        set: { CC: 100e-6 },
        reads: [['H.db', 81.9341]],
      },
    ],
    why:
      'A cascade is not a product of gains. Each stage’s output resistance and the next stage’s input ' +
      'resistance form a divider, and the divider is counted once between them. Here the first stage’s own ' +
      'gain is 185 into an open circuit, and 2.58 kΩ across its 4.77 kΩ takes it to 64.8. That is the rule ' +
      'every multi-stage design obeys, and it is why an emitter follower is worth a stage of its own. A ' +
      'follower has an output resistance of tens of ohms and costs almost no gain, so it makes the divider ' +
      'disappear. The coupling capacitor does nothing to the signal at a kilohertz. It is there so that each ' +
      'stage keeps the bias its own parts set.',
    whyReads: [
      [(x) => portR(x, 'b2', ['CC']), 2578.41],
      [(x) => portR(x, 'c1', ['CC']), 4772.73],
    ],
  },
}
