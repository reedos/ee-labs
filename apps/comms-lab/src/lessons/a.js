// Group A lessons. see / try / why, in the budgets STYLE.md sets.

export default {
  A1: {
    see: [
      'A 250 Hz message rides on a 1000 Hz carrier.',
      'The spectrum shows three lines, at 750, 1000 and 1250 Hz.',
      'The two outer lines are the sidebands, and each sits 12.041 dB below the middle one.',
      'That level is the modulation index divided by two, written in decibels.',
    ].join(' '),
    try: [
      { say: 'Set the modulation index to 0.25. Each sideband falls to 18.062 dB below the carrier.', set: { m: 0.25 } },
      { say: 'Set the modulation index to 1. Each sideband rises to 6.021 dB below it.', set: { m: 1 } },
      { say: 'Read the two sideband levels. They stay equal at every index.', set: { m: 0.5 } },
    ],
    why: [
      'A carrier multiplied by one plus a message is a carrier plus two shifted copies of the message.',
      'The shift is what a multiply does, and Signal Lab measures the same fact in its ring modulator.',
      'Each copy carries half the modulation index, so each line reads twenty times the log of that.',
      'The two copies are mirror images about the carrier and carry the same information twice.',
      'The upper one is the message spectrum shifted up, and the lower one is that spectrum reversed.',
      'Nothing here depends on the message being a single tone.',
      'A message with many components puts a copy of every component either side of the carrier.',
    ].join(' '),
  },

  A2: {
    see: [
      'The same three lines, read as power rather than as amplitude.',
      'The two sidebands together hold 11.111 per cent of what the transmitter sends.',
      'The carrier holds the rest, and it carries no information at all.',
      'That fraction is the modulation index squared over two plus the index squared.',
    ].join(' '),
    try: [
      { say: 'Set the modulation index to 1. The sidebands rise to 33.333 per cent of the power.', set: { m: 1 } },
      { say: 'Set the modulation index to 0.25. They fall to 3.030 per cent.', set: { m: 0.25 } },
      { say: 'Read the fraction. It never reaches one half, whatever the index is.', set: { m: 0.5 } },
    ],
    why: [
      'The carrier line exists so that a receiver can follow the outline of the waveform with a diode.',
      'That is a cheap receiver, and the price of it is paid at the transmitter.',
      'At an index of one half the transmitter spends 89 per cent of its power on a tone that says nothing.',
      'An index above one would improve the fraction and it folds the outline instead, which A3 measures.',
      'A4 removes the carrier entirely and spends the whole budget on the message.',
      'The receiver then has to supply its own carrier, and that is the trade this group is about.',
    ].join(' '),
  },

  A3: {
    see: [
      'The waveform, with its outline following the message.',
      'A rectifier and a low-pass filter recover that outline, which is an envelope detector.',
      'At a modulation index of 0.5 the recovered message is the 250 Hz tone that went in.',
      'The distortion reading is under 5 per cent.',
    ].join(' '),
    try: [
      { say: 'Set the modulation index to 1. The outline just touches zero and stays clean.', set: { m: 1 } },
      { say: 'Set the modulation index to 1.5. The outline folds and the distortion rises threefold.', set: { m: 1.5 } },
      { say: 'Set the modulation index back to 0.5. The distortion falls again.', set: { m: 0.5 } },
    ],
    why: [
      'The outline of the waveform is one plus the modulation index times the message.',
      'While that quantity stays positive the outline is the message with an offset.',
      'A rectifier takes the absolute value, so a quantity that goes negative comes back positive.',
      'The recovered waveform then has a fold in it where the outline crossed zero.',
      'A fold at the message rate produces a component at twice that rate, and the reading rises.',
      'The index of one is the boundary, and it is a property of the detector rather than of the modulation.',
      'A coherent detector has no such boundary, which is what A4 shows.',
    ].join(' '),
  },

  A4: {
    see: [
      'The offset before the multiplier is gone, so the carrier line is gone with it.',
      'All of the power now sits in the two sidebands.',
      'An envelope detector gives the wrong answer here, because the outline no longer follows the message.',
      'A multiply by a local carrier gives the right one.',
    ].join(' '),
    try: [
      { say: 'Read the carrier line. It is a millionth of a sideband rather than larger than one.', set: {} },
      { say: 'Set the local phase error to 30 degrees. The recovered message falls to 0.866 of its level.', set: { localPhaseDeg: 30 } },
      { say: 'Set the local phase error to 0. The full level returns.', set: { localPhaseDeg: 0 } },
    ],
    why: [
      'A multiply by a local carrier shifts the sidebands back down to where the message started.',
      'It also shifts them up to twice the carrier, and the low-pass filter removes that copy.',
      'The local carrier has to be at the right frequency and at the right phase.',
      'At a phase error the recovered message is scaled by the cosine of that error.',
      'Thirty degrees leaves 0.866 of it, which is 1.249 dB of loss.',
      'At ninety degrees nothing is left, and the receiver reads silence from a signal that is present.',
      'Group E is where the receiver recovers that phase for itself, with a loop.',
    ].join(' '),
  },

  A5: {
    see: [
      'The two sidebands are mirror images, so one of them is enough.',
      'Sending both occupies 500 Hz for a 250 Hz message.',
      'Sending one occupies 250 Hz and delivers the same message.',
      'The reading is the occupied bandwidth in each case.',
    ].join(' '),
    try: [
      { say: 'Set the message to 500 Hz. Both bandwidths double, and the ratio stays at two.', set: { message: 500 } },
      { say: 'Set the message to 125 Hz. Both halve.', set: { message: 125 } },
      { say: 'Set the message back to 250 Hz.', set: { message: 250 } },
    ],
    why: [
      'The lower sideband is the message spectrum reversed and the upper one is the message spectrum.',
      'Either alone determines the message, so the second copy is redundant.',
      'Removing one halves the occupied bandwidth and leaves the recovered amplitude unchanged.',
      'Building a single sideband takes either a sharp filter or a Hilbert transform.',
      'The Hilbert transform is a finite kernel here, so it has a delay of its own that is on screen.',
      'The cost of the saving is that the receiver now needs the exact carrier frequency as well as its phase.',
      'A small frequency error shifts every component of the message by the same number of hertz.',
    ].join(' '),
  },

  A6: {
    see: [
      'The message now moves the frequency of the carrier rather than its amplitude.',
      'A deviation of 500 Hz on a 250 Hz message gives a modulation index of 2.',
      'The spectrum has many lines, spaced 250 Hz apart, and their heights are Bessel functions.',
      'The first three read 0.5767, 0.3528 and 0.1289 of the unmodulated carrier.',
    ].join(' '),
    try: [
      { say: 'Set the deviation to 250 Hz. The index falls to 1 and the outer lines shrink.', set: { deviation: 250 } },
      { say: 'Set the deviation to 601 Hz. The index reaches 2.404 and the carrier line vanishes.', set: { deviation: 601 } },
      { say: 'Set the deviation back to 500 Hz.', set: { deviation: 500 } },
    ],
    why: [
      'A frequency-modulated carrier has a constant amplitude and a phase that follows the message integral.',
      'Expanding that gives a sum of lines at the carrier plus every multiple of the message frequency.',
      'The amplitude of the line at the nth multiple is the Bessel function of order n at the modulation index.',
      'The lines are not a copy of the message spectrum, which is what makes this modulation nonlinear.',
      'The carrier line is the Bessel function of order zero, and that function crosses zero at 2.404826.',
      'At that index the transmitter sends no power at the carrier frequency, and all of it sits in the sidebands.',
      'The suite computes these from the series rather than from a table.',
    ].join(' '),
  },

  A7: {
    see: [
      'The lines fall away above the third one, but they never stop.',
      'Carson names a bandwidth of twice the deviation plus the message frequency, which is 1500 Hz here.',
      'That band holds 99.759 per cent of the power rather than all of it.',
      'The figure of merit reads 7.782 dB against an amplitude figure of minus 4.771 dB.',
    ].join(' '),
    try: [
      { say: 'Set the deviation to 1000 Hz. Carson widens to 2500 Hz and the merit rises to 13.8 dB.', set: { deviation: 1000 } },
      { say: 'Set the deviation to 250 Hz. Carson narrows to 1000 Hz and the merit falls to 1.76 dB.', set: { deviation: 250 } },
      { say: 'Set the deviation back to 500 Hz.', set: { deviation: 500 } },
    ],
    why: [
      'Carson is a rule of thumb rather than a bound, and this pane prints what it actually holds.',
      'The rule counts the lines out to the modulation index plus one and stops there.',
      'What is outside is small, and it is not nothing, so the number beside the rule is the honest one.',
      'The figure of merit says what the detector delivers for a given received power.',
      'Frequency modulation reads one and a half times the index squared, which grows without limit.',
      'The bandwidth grows with it, so the gain is bought rather than free.',
      'At an index of 2 the merit is 12.6 dB better than amplitude modulation and the band is three times wider.',
    ].join(' '),
  },
}
