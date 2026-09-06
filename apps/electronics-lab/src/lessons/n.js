// Group N's three registers. Every number here is a reading, checked against
// the solver by experiments.test.js, and every knob move names a setting the
// knob can reach.

import { decayConstant, oscOf, swingAt, wienF0 } from '../groups/n.js'

/** Distortion as the percentage the prose quotes, from the settled waveform. */
const thdPct = (x) => 100 * oscOf(x).thd

export const LESSONS_N = {
  n1: {
    see:
      'The pole plot shows two poles at 1591.5 Hz, the frequency 1/(2πRC) sets, sitting 500 rad/s to the left ' +
      'of the imaginary axis. A gain of 2.90 holds them there, so a disturbance at the + input dies away. Turn ' +
      'the gain up and they move right.',
    seeReads: [
      ['pole.1.hz', 1591.54943],
      ['pole.1.re', -500.420488],
    ],
    try: [
      {
        say: 'Set R_f to 2 kΩ. The gain becomes 3.00 and the pair lands almost on the axis, 0.450 rad/s to the left of it.',
        set: { Rf: 2000 },
        reads: [['pole.1.re', -0.4499865]],
      },
      {
        say: 'Set R_f to 2.1 kΩ. A gain of 3.10 puts the pair 500 rad/s into the right half plane, where every disturbance grows.',
        set: { Rf: 2100 },
        reads: [['pole.1.re', 499.519515]],
      },
      {
        say: 'Set C to 1 nF. Both poles move out tenfold, to 15.9 kHz, and the growth rate moves out with them.',
        set: { Cw: 1e-9 },
        reads: [
          ['pole.1.hz', 15915.4943],
          ['pole.1.re', -5004.20488],
        ],
      },
    ],
    why:
      'Barkhausen’s condition names what an oscillator needs. The gain around one trip of the loop is one, and ' +
      'the phase around it is zero. The Wien network passes a third of the output at 1591.5 Hz and passes it ' +
      'with no phase shift, so the amplifier has to supply a gain of three. Below three the poles sit left of ' +
      'the axis and a disturbance decays. Above three they sit right and it grows. The oscillation threshold is not exactly ' +
      'three. The op-amp’s own gain is finite, and the characteristic polynomial carries a term G²/A₀ that a ' +
      'textbook drops. With A₀ at 10⁵ the crossing happens at a gain of 3.00009 instead. A designer who asks ' +
      'for exactly three therefore gets a decay of 0.450 rad/s, which is slow, but is not oscillation.',
    whyReads: [
      ['pole.1.hz', 1591.54943],
      [(x, p, again) => again({ Rf: 2000 }).poles[0].re, -0.4499865],
    ],
  },

  n2: {
    see:
      'The poles are 999 rad/s into the right half plane, so the amplitude grows by a factor of e every ' +
      'millisecond until the output meets the rails at 12.0 V. It stays there. A rail is a nonlinearity, and a ' +
      'nonlinearity is what fixes an oscillator’s amplitude.',
    seeReads: [
      ['osc.sigma', 999.488016],
      ['peak.out', 12],
    ],
    try: [
      {
        say: 'Set the rails to 6 V. The amplitude follows them to 6.00 V, and the distortion does not move from 8.65 %.',
        set: { vsat: 6 },
        reads: [
          ['peak.out', 6],
          [thdPct, 8.65322997],
        ],
      },
      {
        say: 'Set R_f to 2.02 kΩ. At a gain of 3.02 the growth is ten times slower, and after forty cycles the output has reached only 51.5 mV.',
        set: { Rf: 2020 },
        reads: [
          ['peak.out', 0.0514764185],
          ['osc.sigma', 99.5439938],
        ],
      },
      {
        say: 'Set R_f to 3 kΩ. A gain of 4.00 drives the output deep into the rails, and the distortion rises to 24.1 %.',
        set: { Rf: 3000 },
        reads: [[thdPct, 24.0909645]],
      },
    ],
    why:
      'A linear circuit with poles in the right half plane has no steady amplitude. Its output grows without ' +
      'bound, so every real oscillator carries something that is not linear. Here that something is the pair of ' +
      'rails. As the output starts to clip, the fundamental it delivers per volt of input falls, and the loop ' +
      'settles where that effective gain is three again. The rails therefore set the amplitude and the excess ' +
      'gain sets the shape. At a gain of 3.20 the total harmonic distortion is 8.65 % and at 4.00 it is 24.1 %. The frequency ' +
      'moves as well. Part of each cycle is spent against a rail rather than in the network, and the loop runs ' +
      'at 1562.5 Hz where the network alone would set 1591.5 Hz.',
    whyReads: [
      [thdPct, 8.65301007],
      [(x, p, again) => thdPct(again({ Rf: 3000 })), 24.0909645],
      ['osc.f', 1562.52037],
      [(x, p) => wienF0(p), 1591.54943],
    ],
  },

  n3: {
    see:
      'The capacitor charges toward whichever rail the output is on. At 6.00 V it reaches the threshold, the ' +
      'output flips, and the capacitor turns round. Nothing here resonates. The period comes from the time ' +
      'constant and the hysteresis alone, and it reads 999.7 µs.',
    seeReads: [
      ['osc.period', 0.000999737183],
      [(x) => swingAt(x, 'p', 0.2).high, 6],
    ],
    try: [
      {
        say: 'Set C_t to 1 µF. Ten times the capacitance is ten times the period, which now reads 9.997 ms.',
        set: { Ct: 1e-6 },
        reads: [['osc.period', 0.00999737183]],
      },
      {
        say: 'Set R₁ to 30 kΩ. The threshold rises to 9.00 V, the capacitor has further to travel, and the period reads 1.771 ms.',
        set: { R1: 30000 },
        reads: [
          ['osc.period', 0.00177077824],
          [(x) => swingAt(x, 'p', 0.2).high, 9],
        ],
      },
      {
        say: 'Set the rails to 5 V. The output swings to 5.00 V, the threshold falls with it, and the period does not move at all.',
        set: { vsat: 5 },
        reads: [
          ['clip.high', 5],
          ['osc.period', 0.000999737183],
        ],
      },
    ],
    why:
      'A relaxation oscillator has no resonant network in it. Between edges the capacitor’s voltage is one ' +
      'exponential of time constant R_tC_t, cut short when it reaches the threshold. Both thresholds are the ' +
      'same fraction β of the rail the output sits at, so the share of the exponential the capacitor has to ' +
      'cover does not depend on the rail. Neither does the period. That independence is why the circuit is used ' +
      'as a clock. Its output is a square wave, and a square wave’s harmonics fall only as one over the ' +
      'harmonic number. Counted over the first twelve of them that is 43.9 % of distortion. A resonant ' +
      'oscillator puts almost all of its energy into one line. This one spreads it, and the two are chosen ' +
      'for different jobs.',
    whyReads: [
      [thdPct, 43.8601400],
      [(x) => decayConstant(x, 'n'), 4.55e-4],
    ],
  },

  n4: {
    see:
      'An inductor across two capacitors in series makes a tank that rings at 15.9 kHz. The transconductor ' +
      'reads the tap between the two capacitors and drives the top of the tank, which is the Colpitts ' +
      'arrangement. Its current limit stops the growth, and the tank settles at 3.03 V.',
    seeReads: [
      ['osc.f', 15905.2589],
      [(x) => swingAt(x, 't', 0.7).amp, 3.02679025],
    ],
    try: [
      {
        say: 'Set L to 100 mH. Ten times the inductance is √10 times the period, and the frequency reads 5.00 kHz.',
        set: { L: 100e-3 },
        reads: [['osc.f', 5001.37877]],
      },
      {
        say: 'Set C₂ to 40 nF. The series capacitance rises by a third, the tap falls to a third, and the frequency reads 13.8 kHz.',
        set: { C2: 40e-9 },
        reads: [['osc.f', 13783.3378]],
      },
      {
        say: 'Set I_max to 1 mA. Five times the limit is five times the amplitude, and the tank reaches 15.2 V.',
        set: { ilim: 1e-3 },
        reads: [[(x) => swingAt(x, 't', 0.7).amp, 15.1843748]],
      },
    ],
    why:
      'A Colpitts tank does two jobs at once. The inductor and the series pair of capacitors set the frequency. ' +
      'The divider between those capacitors sets the fraction of the tank voltage that comes back to the ' +
      'transconductor, C₁/(C₁ + C₂), which is a half here. A smaller tap needs a larger g_m to close the loop. ' +
      'The amplitude does not come from the tank at all. It comes from the largest current the transconductor ' +
      'delivers, and the tank turns that current into 3.03 V. A bipolar transistor is a transconductance with a ' +
      'limit of its own, which is why a real Colpitts is drawn with one. The exponential device has no ' +
      'closed-form answer in time, so what runs here is its tangent carrying that limit.',
    whyReads: [
      [(x) => swingAt(x, 't', 0.7).amp, 3.02679025],
      [(x) => swingAt(x, 'p', 0.7).amp / swingAt(x, 't', 0.7).amp, 0.502514],
    ],
  },
}
