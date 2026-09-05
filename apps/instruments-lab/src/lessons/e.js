// Group E's three registers. Every number is a reading the solver produced.

/** M, τ, the filter's corner and its equivalent noise bandwidth, from the knobs. */
const M = (p) => (p.gm * p.Rf * p.A * p.Vr) / (2 * p.Vu)
const TAU = (p) => p.Rf * p.Cf
const F3 = (p) => 1 / (2 * Math.PI * p.Rf * p.Cf)
const ENBW = (p) => 1 / (4 * p.Rf * p.Cf)
const pass = (p, f) => 1 / Math.hypot(1, f / F3(p))

export const LESSONS_E = {
  e1: {
    see:
      'A 10 mV signal at 1 kHz meets a 1 V reference at the same frequency. Their product is two terms ' +
      'of 5 mV each, one at 0 Hz and one at 2 kHz. The filter keeps the first and cuts the second, so ' +
      'the output settles at 5.00 mV with 793 µV of ripple.',
    seeReads: [
      ['detect.mean', 0.005],
      [(x, p) => M(p), 0.005],
      [(x, p) => 2 * M(p) * pass(p, p.fs + p.fr), 7.93267e-4],
      [(x, p) => p.fs + p.fr, 2000],
    ],
    try: [
      {
        say: 'Put the cursor at 1 ms, one time constant in. The output has reached 3.14 mV, on its way to 5 mV, and the ripple rides on it.',
        at: 1e-3,
        reads: [
          [(x) => x.sol.v.out, 0.00314],
          [(x, p) => M(p) * (1 - Math.exp(-1)), 0.0031606],
        ],
      },
      {
        say: 'Drop the signal to 1 mV. The output falls to 500 µV, ten times smaller, and the ripple falls with it to 79.3 µV.',
        set: { A: 1e-3 },
        reads: [
          ['detect.mean', 5e-4],
          [(x, p) => 2 * M(p) * pass(p, p.fs + p.fr), 7.93267e-5],
        ],
      },
      {
        say: 'Halve the reference to 500 mV. The output halves to 2.50 mV, because the product carries both amplitudes.',
        set: { Vr: 0.5 },
        reads: [['detect.mean', 0.0025]],
      },
    ],
    why:
      'The product of two sinusoids is exactly two sinusoids, at the difference of their frequencies and ' +
      'at their sum, each of half the amplitude product. That identity is where this lab does its one ' +
      'line of algebra by hand, and the math panel checks it at four hundred instants. With the ' +
      'reference on the signal the difference term is at 0 Hz, so it is a constant the filter passes ' +
      'whole. Everything else in the product is at 2 kHz or above, and the filter takes it down by more ' +
      'than a hundred.',
    whyReads: [
      [(x, p) => p.fs + p.fr, 2000],
      [(x, p) => 1 / pass(p, p.fs + p.fr), 125.668],
    ],
  },

  e2: {
    see:
      'The output filter does two jobs at once. Its 1 ms time constant is how long the reading takes to ' +
      'settle, and its rejection at 2 kHz is what leaves 397 µV of ripple on a 5 mV reading. Its ' +
      'equivalent noise bandwidth, 250 Hz, is the band the instrument is listening in.',
    seeReads: [
      [(x, p) => TAU(p), 1e-3],
      [(x, p) => M(p) * pass(p, p.fs + p.fr), 3.96633e-4],
      [(x, p) => M(p), 0.005],
      [(x, p) => ENBW(p), 250],
      [(x, p) => p.fs + p.fr, 2000],
    ],
    try: [
      {
        say: 'Raise the filter capacitor ten times. The time constant becomes 10 ms, the ripple falls to 39.8 µV, and the band narrows to 25 Hz.',
        set: { Cf: 1e-5 },
        reads: [
          [(x, p) => TAU(p), 1e-2],
          [(x, p) => M(p) * pass(p, p.fs + p.fr), 3.97875e-5],
          [(x, p) => ENBW(p), 25],
        ],
      },
      {
        say: 'Raise it a hundred times instead. The time constant is 100 ms, the ripple 3.98 µV, and the band 2.5 Hz.',
        set: { Cf: 1e-4 },
        reads: [
          [(x, p) => TAU(p), 0.1],
          [(x, p) => M(p) * pass(p, p.fs + p.fr), 3.97887e-6],
          [(x, p) => ENBW(p), 2.5],
        ],
      },
      {
        say: 'Raise the filter resistance ten times with the capacitor back. The time constant is 10 ms again, and so is everything else, because only the product matters.',
        set: { Rf: 1e4 },
        reads: [
          [(x, p) => TAU(p), 1e-2],
          [(x, p) => ENBW(p), 25],
        ],
      },
    ],
    why:
      'One pole passes 1/√(1 + (f/f₃)²), so the ripple at twice the reference falls in proportion to the ' +
      'time constant. The same pole passes noise over an equivalent bandwidth of 1/(4RC), which is π/2 ' +
      'times its −3 dB frequency exactly. Narrowing the filter by ten therefore improves both the ' +
      'ripple and the noise by ten, and costs ten times the settling time. A lock-in on a slow ' +
      'experiment uses seconds of time constant and reads a band under a hertz wide.',
    whyReads: [
      [(x, p) => ENBW(p) / F3(p), 1.5708],
      [(x, p) => F3(p), 159.155],
    ],
  },

  e3: {
    see:
      'The signal and the reference are at the same frequency, and the output depends on the angle ' +
      'between them. At 0° the reading is 5.00 mV. The output follows the cosine of that angle and ' +
      'nothing else, so the phase knob is the instrument’s second control.',
    seeReads: [
      ['detect.mean', 0.005],
      [(x, p) => M(p) * Math.cos((p.phi * Math.PI) / 180), 0.005],
      [(x, p) => p.phi, 0],
    ],
    try: [
      {
        say: 'Set the phase to 60°. The reading halves to 2.50 mV, which is the cosine of 60°.',
        set: { phi: 60 },
        reads: [['detect.mean', 0.0025]],
      },
      {
        say: 'Set it to 90°. The reading is zero. The signal is still there and the instrument is in quadrature with it.',
        set: { phi: 90 },
        reads: [['detect.mean', 0, 2e-7]],
      },
      {
        say: 'Set it to 180°. The reading is −5.00 mV, the same size with the sign turned over.',
        set: { phi: 180 },
        reads: [['detect.mean', -0.005]],
      },
    ],
    why:
      'The difference term of the product is M cos φ, where φ is the angle between the signal and the ' +
      'reference. So a lock-in reading zero has not lost the signal. It is ninety degrees away from it, ' +
      'and one more degree of reference phase would bring it back. Real instruments run two channels, ' +
      'one at the reference phase and one at ninety degrees from it, and report the size of the pair ' +
      'and the angle between them. Then the reading does not depend on the phase at all.',
  },

  e4: {
    see:
      'Move the signal 200 Hz off the reference and the difference term is no longer a constant. It is ' +
      'a 200 Hz beat, which the 1 ms filter passes at 0.6227, so the output swings ±3.11 mV every 5 ms ' +
      'instead of standing still.',
    seeReads: [
      [(x, p) => Math.abs(p.fs - p.fr), 200],
      [(x, p) => pass(p, Math.abs(p.fs - p.fr)), 0.622677],
      [(x, p) => M(p) * pass(p, Math.abs(p.fs - p.fr)), 0.00311338],
      [(x, p) => 1 / Math.abs(p.fs - p.fr), 5e-3],
    ],
    try: [
      {
        say: 'Move the signal to 1.05 kHz, only 50 Hz off. The filter passes the beat at 0.954, so the swing is ±4.77 mV and slower, once every 20 ms.',
        set: { fs: 1050 },
        reads: [
          [(x, p) => pass(p, Math.abs(p.fs - p.fr)), 0.954028],
          [(x, p) => M(p) * pass(p, Math.abs(p.fs - p.fr)), 0.00477014],
          [(x, p) => 1 / Math.abs(p.fs - p.fr), 0.02],
        ],
      },
      {
        say: 'Raise the filter capacitor a hundred times with the signal 200 Hz off. The swing collapses to 39.8 µV, and the band is now 2.5 Hz wide.',
        set: { Cf: 1e-4 },
        reads: [
          [(x, p) => M(p) * pass(p, Math.abs(p.fs - p.fr)), 3.97883e-5],
          [(x, p) => ENBW(p), 2.5],
        ],
      },
      {
        say: 'Move the signal to 1.5 kHz with the fast filter back. The swing is 793 µV, and a signal that far off is all but gone.',
        set: { fs: 1500 },
        reads: [[(x, p) => M(p) * pass(p, Math.abs(p.fs - p.fr)), 7.93267e-4]],
      },
    ],
    why:
      'The difference term sits at |f_s − f_r| whatever that is, and the output filter treats it like ' +
      'any other signal. So the instrument answers only within its own equivalent noise bandwidth of ' +
      'the reference, which is 250 Hz here and 2.5 Hz with a hundred times the capacitor. That band is ' +
      'the whole point. It is why a lock-in finds a signal buried under noise a thousand times larger, ' +
      'and why the reference has to come from whatever is driving the experiment rather than from a ' +
      'separate oscillator.',
    whyReads: [
      [(x, p) => ENBW(p), 250],
      [() => 2.5, 2.5],
    ],
  },
}
