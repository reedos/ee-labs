// Group B's three registers. Signal Lab's Sampling group is the full treatment
// of both, and both lessons hand over to it by name.

export const LESSONS_B = {
  b1: {
    see:
      'The trace behind the dots is the exact waveform, and the dots are what the instrument keeps. A ' +
      '9 kHz tone sampled at 10 kSa/s leaves the same forty numbers as a 1 kHz tone with its phase ' +
      'turned over. From the dots alone the two cannot be told apart.',
    seeReads: [['alias', 1000]],
    try: [
      {
        say: 'Set the tone to 4 kHz, below half the sample rate. The alias is 4 kHz, which is the tone itself, and the dots now follow the trace.',
        set: { f: 4000 },
        reads: [['alias', 4000]],
      },
      {
        say: 'Set the tone to 19 kHz. The alias is 1 kHz again, because 19 kHz is the same distance from twice the sample rate.',
        set: { f: 19000 },
        reads: [['alias', 1000]],
      },
      {
        say: 'Raise the sample rate to 20 kSa/s with the tone at 9 kHz. The alias is 9 kHz, and the dots have caught the tone.',
        set: { fs: 20000, f: 9000 },
        reads: [['alias', 9000]],
      },
    ],
    why:
      'Write the tone as A sin(2πf t + θ) and read it at t = k/f_s. With m the nearest whole number of ' +
      'sample rates to f, the argument is 2π(f − m·f_s)k/f_s plus 2πmk plus θ, and the second term is a ' +
      'whole number of turns. So the samples are those of a tone at |f − m·f_s|, and when the fold is ' +
      'downward the sine turns over and takes its phase with it. This is not distortion and no filter ' +
      'after the sampler removes it. Signal Lab’s Aliasing preset is the same fact with a spectrum ' +
      'beside it.',
  },

  b2: {
    see:
      'Put an anti-alias filter at 20.00 kHz in front of the sampler. A 5 kHz signal keeps 0.9701 of its ' +
      'amplitude. A 95 kHz interferer keeps 0.2060, and at a 100 kSa/s sample rate it aliases onto ' +
      '5 kHz, on top of the signal.',
    seeReads: [
      ['corner', 20000],
      ['H.mag', 0.970143],
      [(x, p) => 1 / Math.hypot(1, p.fi / (1 / (2 * Math.PI * p.Rb * p.Cb))), 0.20601],
      ['alias', 5000],
    ],
    try: [
      {
        say: 'Set the frequency to 20 kHz, the corner. The reading is 0.7071, which is one pole’s definition of its own bandwidth.',
        set: { f: 20000 },
        reads: [['H.mag', 0.707107]],
      },
      {
        say: 'Set the frequency to 2 MHz. Only now is the reading 0.01, a hundredth, which is 40 dB down and a hundred times past the corner.',
        set: { f: 1999900 },
        reads: [
          ['H.mag', 0.0099995],
          [(x, p) => p.reject, 40],
        ],
      },
      {
        say: 'Move the interferer to 190 kHz. It still aliases onto 10 kHz, and one pole has it only 0.1044 down.',
        set: { fi: 190000 },
        reads: [
          ['alias', 5000],
          [(x, p) => 1 / Math.hypot(1, p.fi / (1 / (2 * Math.PI * p.Rb * p.Cb))), 0.104385],
          [(x, p) => Math.abs(p.fi - Math.round(p.fi / p.fs) * p.fs), 10000],
        ],
      },
    ],
    why:
      'One pole falls as 1/√(1 + (f/f₀)²), so a hundredth of the amplitude needs a hundred times the ' +
      'corner. Anything a sampler is to be protected from has to sit up there, which means the sample ' +
      'rate has to be about two hundred times the corner rather than twice it. That is why a digital ' +
      'scope samples far above its own analog bandwidth instead of filtering harder. A steeper filter ' +
      'is the alternative, and it costs phase in the passband, which Circuit Lab’s order group measures.',
  },
}
