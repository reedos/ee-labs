// Group C lessons. see / try / why, in the budgets STYLE.md sets.

export default {
  C1: {
    see: [
      'The kernel on screen is a rectangle one symbol wide, which is eight samples.',
      'Its spectrum is a sinc, with its first null at 1000 Hz and sidelobes that never stop.',
      'A rectangle is the simplest pulse and the widest one in frequency.',
      'The raised cosine beside it is 1 at its own instant and nothing at the next.',
    ].join(' '),
    try: [
      { say: 'Set the roll-off to 1. The raised cosine widens in time and narrows in frequency.', set: { beta: 1 } },
      { say: 'Set the roll-off to 0. It narrows in frequency to 500 Hz and its tail grows.', set: { beta: 0 } },
      { say: 'Set the roll-off back to 0.35.', set: { beta: 0.35 } },
    ],
    why: [
      'A rectangle in time is a sinc in frequency, and a sinc has energy at every frequency.',
      'Its first sidelobe is 13.3 dB below the main lobe and the rest fall as one over the frequency.',
      'A transmitter that sends rectangles therefore interferes with every neighbouring channel.',
      'Narrowing the spectrum means spreading the pulse in time, and a pulse that is longer than a symbol overlaps the next one.',
      'The whole of this group is about which overlaps are harmless.',
      'C2 gives the answer, and it is more forgiving than it first looks.',
    ].join(' '),
  },

  C2: {
    see: [
      'The raised cosine, sampled at the symbol instants.',
      'It reads 1 at its own instant and below 10 to the minus fifteen at every other one.',
      'Between the instants it is not zero, and that does not matter.',
      'A pulse with this property causes no interference between symbols.',
    ].join(' '),
    try: [
      { say: 'Set the roll-off to 0. The samples stay at 1 and 0, and the tail decays as one over time.', set: { beta: 0 } },
      { say: 'Set the roll-off to 1. The samples are unchanged and the tail is much shorter.', set: { beta: 1 } },
      { say: 'Set the roll-off back to 0.35.', set: { beta: 0.35 } },
    ],
    why: [
      'A receiver reads the sum of every pulse at one instant, once a symbol.',
      "Nyquist's criterion is that the pulse be zero at every symbol instant other than its own.",
      'Every other pulse then contributes nothing to the reading, however wide it is in time.',
      'The condition in frequency is that the folded spectrum sum to a constant.',
      'The raised cosine is built to satisfy that at every roll-off, which is why it is the standard pulse.',
      'This is an exact property rather than an approximate one, and the samples show it to floating point.',
      'What follows in this group is what happens when the instant moves or the channel changes the pulse.',
    ].join(' '),
  },

  C3: {
    see: [
      'The bandwidth reads 675 Hz for a symbol rate of 1000 a second.',
      'That is one plus the roll-off, times half the symbol rate.',
      'At a roll-off of 0 it would be 500 Hz, which is the least any pulse can use.',
      'A random stream of these pulses peaks at 1.727 times one symbol, which is 4.746 dB.',
    ].join(' '),
    try: [
      { say: 'Set the roll-off to 0. The bandwidth falls to 500 Hz and the peak rises to 3.606.', set: { beta: 0 } },
      { say: 'Set the roll-off to 1. The bandwidth rises to 1000 Hz and the peak falls to 1.066.', set: { beta: 1 } },
      { say: 'Set the roll-off back to 0.35.', set: { beta: 0.35 } },
    ],
    why: [
      'The minimum bandwidth for a given symbol rate is half that rate, and no pulse beats it.',
      'A roll-off buys back some of the sharpness of that limit, and it pays for it in bandwidth.',
      'What it buys is a shorter tail, and the tail is what a sum over a random stream adds up.',
      'At a roll-off of 0 the tail decays as one over time and the worst-case peak reaches 3.606 over 40 symbols.',
      'At 0.35 the tail decays much faster and the same sum reaches 1.727.',
      'The peak matters because an amplifier has to hold it, and holding 11.141 dB is expensive.',
      'The measurement here is over a stated window, and the number is quoted with that window.',
    ].join(' '),
  },

  C4: {
    see: [
      'Two symbol periods of a long stream, drawn one over another.',
      'The traces cross in the middle of each period and separate at the decision instant.',
      'The opening at that instant reads 1.0000, because the pulse is a Nyquist pulse.',
      'The width of the crossing region says how much timing error the link tolerates.',
    ].join(' '),
    try: [
      { say: 'Set the roll-off to 0. The crossing region widens and the eye becomes a narrow slit.', set: { beta: 0 } },
      { say: 'Set the roll-off to 1. The crossings pull together and the eye opens out.', set: { beta: 1 } },
      { say: 'Set the roll-off back to 0.35.', set: { beta: 0.35 } },
    ],
    why: [
      'An eye diagram is every two-symbol window of a long stream, drawn over the same axes.',
      'The height of the opening at the decision instant is the margin against noise.',
      'The width of the region where traces cross zero is the margin against a timing error.',
      'Both margins come from the same pulse, and a roll-off trades bandwidth for both of them.',
      'The picture answers a question no single number does, which is what a whole stream looks like at once.',
      'This canvas carries two extra props for the Mixed-Signal Lab, which draws a converter output on it.',
      'One colours each trace by a clock phase and the other names the unit the axis is measured in.',
    ].join(' '),
  },

  C5: {
    see: [
      'The decision instant has moved a twentieth of a symbol away from the middle.',
      'The opening falls from 1.0000 to 0.8619, which is 1.291 dB of margin.',
      'At a tenth of a symbol it falls to 0.7166, and at a fifth to 0.4108.',
      'At a roll-off of 0 the same fifth of a symbol closes the eye entirely.',
    ].join(' '),
    try: [
      { say: 'Set the timing error to 0.1. The opening falls to 0.7166.', set: { timingError: 0.1 } },
      { say: 'Set the timing error to 0.2. The opening falls to 0.4108.', set: { timingError: 0.2 } },
      { say: 'Set the timing error back to 0.05.', set: { timingError: 0.05 } },
    ],
    why: [
      'Away from the symbol instant the other pulses are no longer zero.',
      'Each of them contributes, and the worst case is when every one contributes with the sign that hurts.',
      'The opening is the wanted sample less that sum, so it falls as the instant moves.',
      'How fast it falls depends on the roll-off, because the roll-off sets the tail.',
      'At 0.35 a fifth of a symbol still leaves 0.4108, and at 0 the same offset leaves a negative number.',
      'A negative opening means the eye is closed and no threshold reads the stream correctly.',
      'E4 builds the loop that finds the instant, and H4 charges the 1.291 dB to the budget.',
    ].join(' '),
  },

  C6: {
    see: [
      'The shaping is split, with a root raised cosine at each end of the link.',
      'The cascade of the two is a raised cosine, so the Nyquist property survives.',
      'The receive filter is then the matched filter, which Group D shows is the best one.',
      'The truncation leaves 7.44 in a hundred thousand of interference from the nearest neighbours.',
    ].join(' '),
    try: [
      { say: 'Set the span to 4 symbols. The nearest-neighbour residual rises to 4.76 in a hundred.', set: { span: 4 } },
      { say: 'Set the span to 16. It falls to 2.83 in a hundred thousand.', set: { span: 16 } },
      { say: 'Set the span back to 12.', set: { span: 12 } },
    ],
    why: [
      'Splitting the shaping puts half at each end, and the receive filter becomes a copy of the transmitted pulse.',
      'That is the matched filter, so the same choice that shapes the spectrum also maximises the signal-to-noise ratio.',
      'The identity is exact in continuous time and the app truncates both filters to a finite span.',
      'What the truncation leaves is measured three ways, because the three differ by an order of magnitude.',
      'The nearest two neighbours leave 7.44 in a hundred thousand at a span of 12.',
      'The largest residual over every lag is nearer a thousandth, and it sits at half the span where the two windows half overlap.',
      'Below a span of 6 the first figure passes a hundredth, and the pane says so.',
    ].join(' '),
  },
}
