// Group F lessons. see / try / why, in the budgets STYLE.md sets.

export default {
  F1: {
    see: [
      'Sixty four subcarriers, spaced 125 Hz apart on an 8 kHz grid.',
      'Their spectra overlap heavily, and they still do not interfere.',
      'Two of them correlate to below 10 to the minus twelve over one symbol.',
      'Two spaced 5 Hz off the grid correlate to a hundredth or more.',
    ].join(' '),
    try: [
      { say: 'Set the subcarriers to 128. The spacing halves to 62.5 Hz.', set: { ofdmN: 128 } },
      { say: 'Set the subcarriers to 32. The spacing doubles to 250 Hz.', set: { ofdmN: 32 } },
      { say: 'Set the subcarriers back to 64.', set: { ofdmN: 64 } },
    ],
    why: [
      'Two tones are orthogonal over a window when the window holds a whole number of cycles of their difference.',
      'The subcarrier spacing is one over the useful symbol, so every pair meets that condition exactly.',
      'The overlap in the spectrum is real, and the correlation over the symbol is still nothing.',
      'This is Signal Lab spectral leakage read from the other side.',
      'There a tone off the bin grid leaked into its neighbours, and here every tone is on the grid by construction.',
      'Off the grid the correlation returns, which is why a frequency offset is worse for this modulation than for a single carrier.',
      'The transform in F2 is what puts every tone on the grid without generating them one at a time.',
    ].join(' '),
  },

  F2: {
    see: [
      'Sixty four complex symbols go into an inverse transform and 64 samples come out.',
      'The forward transform at the receiver returns the same 64 symbols.',
      'Through a channel of one tap the worst error is below 10 to the minus twelve.',
      'The useful symbol is 8.00 ms long.',
    ].join(' '),
    try: [
      { say: 'Set the subcarriers to 128. The useful symbol grows to 16.00 ms.', set: { ofdmN: 128 } },
      { say: 'Set the subcarriers to 32. It falls to 4.00 ms.', set: { ofdmN: 32 } },
      { say: 'Set the subcarriers back to 64.', set: { ofdmN: 64 } },
    ],
    why: [
      'A modulator that generated 64 tones one at a time would need 64 oscillators and 64 multipliers.',
      'An inverse transform produces the sum of all of them in one pass over the block.',
      'That is why this modulation waited for the transform to be cheap before it was used.',
      'The output is a sum of many independent components, so its samples look Gaussian rather than like a constellation.',
      'One consequence is a large peak against the average, which F5 measures.',
      'Another is that a clipping amplifier spreads energy outside the band, which Signal Lab already shows for a single tone.',
      'The transform used here is the one in the shared package, and this lab adds nothing to it.',
    ].join(' '),
  },

  F3: {
    see: [
      'The last 16 samples of every symbol are copied to the front of it.',
      'Through a channel of five taps the worst error is below 10 to the minus twelve.',
      'Through a channel of 17 taps it is the same, because the prefix covers 17.',
      'At 18 taps the error jumps to a hundredth, which is not floating point.',
    ].join(' '),
    try: [
      { say: 'Set the prefix to 8. The boundary moves to a channel of nine taps.', set: { ofdmCp: 8 } },
      { say: 'Set the prefix to 32. It moves to 33 taps.', set: { ofdmCp: 32 } },
      { say: 'Set the prefix back to 16.', set: { ofdmCp: 16 } },
    ],
    why: [
      'A channel convolves the transmitted samples with its impulse response, and the convolution is linear.',
      'A transform diagonalises a circular convolution rather than a linear one.',
      'Prepending a copy of the tail makes the block look periodic to the channel over the samples that are kept.',
      'The receiver drops the prefix and what is left is the circular convolution of the body with the channel.',
      'That holds while the channel reaches back no further than the prefix, which is the prefix length plus one tap.',
      'One tap further and the first kept sample reaches back past the copy into nothing.',
      'The failure is abrupt rather than gradual, and the two numbers either side of it are what this experiment shows.',
    ].join(' '),
  },

  F4: {
    see: [
      'A frequency-selective channel becomes 64 flat ones, one for each subcarrier.',
      'Each is undone by dividing by the channel value at that subcarrier.',
      'The worst symbol error after that divide is below 10 to the minus twelve.',
      'Four of the 52 used subcarriers carry known symbols, so the channel can be estimated.',
    ].join(' '),
    try: [
      { say: 'Set the pilots to 8. The cost rises from 0.348 dB to 0.712 dB.', set: { ofdmPilots: 8 } },
      { say: 'Set the pilots to 2. It falls to 0.170 dB.', set: { ofdmPilots: 2 } },
      { say: 'Set the pilots back to 4.', set: { ofdmPilots: 4 } },
    ],
    why: [
      'A single-carrier receiver in this channel needs an equaliser of many taps, which Group G builds.',
      'Every subcarrier here is narrow enough that the channel is one complex number across it.',
      'Undoing one complex number is one complex division, so the whole equaliser is 64 divisions.',
      'The receiver has to know those 64 numbers, and pilots are how it learns them.',
      'A pilot carries a symbol the receiver already knows, so the ratio of what arrives to what was sent is the channel.',
      'Between the pilots the estimate is interpolated, which works while the channel is smooth over that spacing.',
      'The subcarriers a pilot uses carry no data, and F6 charges that to the rate.',
    ].join(' '),
  },

  F5: {
    see: [
      'The time waveform is a sum of 64 components that can all line up at once.',
      'When they do the peak power is 64 times the average, which is 18.062 dB.',
      'One symbol in 345 exceeds 10 dB and one in 119 000 exceeds 12 dB.',
      'The level exceeded once in ten thousand symbols is 11.261 dB.',
    ].join(' '),
    try: [
      { say: 'Set the subcarriers to 256. The worst case rises to 24.082 dB.', set: { ofdmN: 256 } },
      { say: 'Set the subcarriers to 16. It falls to 12.041 dB.', set: { ofdmN: 16 } },
      { say: 'Set the subcarriers back to 64.', set: { ofdmN: 64 } },
    ],
    why: [
      'The worst case needs all 64 subcarriers to reach their peak at one sample, which one particular input does.',
      'Random data almost never does that, so the worst case is a bound rather than a reading.',
      'What matters to an amplifier is how often a given level is exceeded, which is the distribution rather than the bound.',
      'On the Nyquist-rate samples that distribution has a closed form, and it is exact for those samples.',
      'The continuous-time waveform between the samples peaks higher, so the pane names which it is quoting.',
      'An amplifier driven past its limit clips, and Signal Lab already shows what clipping does to a spectrum.',
      'The energy that appears outside the band is the reason this ratio is a design number rather than a curiosity.',
    ].join(' '),
  },

  F6: {
    see: [
      'The prefix is 16 samples on a body of 64, so it is a fifth of every symbol.',
      'That fifth carries no data, and it costs 0.969 dB of rate.',
      'Four pilots in 52 used subcarriers cost a further 0.348 dB.',
      'What is left carries 19 200 bit a second uncoded, in 6500 Hz.',
    ].join(' '),
    try: [
      { say: 'Set the subcarriers to 128 with the same prefix. The prefix cost halves to 0.512 dB.', set: { ofdmN: 128 } },
      { say: 'Set the prefix to 32. The cost returns to 0.969 dB.', set: { ofdmCp: 32 } },
      { say: 'Set the subcarriers and prefix back to 64 and 16.', set: { ofdmN: 64, ofdmCp: 16 } },
    ],
    why: [
      'The prefix has to be as long as the channel, and the channel does not care how long the symbol is.',
      'So a longer symbol pays the same absolute cost over more data, and the fraction falls.',
      'Doubling the transform length at a fixed prefix halves the loss, from 0.969 dB to 0.512 dB.',
      'The limit on that is how long the channel holds still.',
      'A symbol longer than the coherence time meets a channel that changed during it, and one divide no longer undoes it.',
      'The pilots are the other cost, and they buy the channel estimate that the divide needs.',
      'Both losses are charged to the link budget in H4, along with two more this lab has already measured.',
    ].join(' '),
  },
}
