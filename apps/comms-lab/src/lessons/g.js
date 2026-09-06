// Group G lessons. see / try / why, in the budgets STYLE.md sets.

export default {
  G1: {
    see: [
      'An echo arrives four samples late at half the amplitude of the direct path.',
      'Where the two add the response peaks at 3.522 dB.',
      'Where they cancel it notches at minus 6.021 dB.',
      'The notches repeat every 2000 Hz, and the first sits at 1000 Hz.',
    ].join(' '),
    try: [
      { say: 'Set the echo to 0.9. The notch deepens to minus 20.000 dB.', set: { echo: 0.9 } },
      { say: 'Set the echo delay to 8. The notches move to every 1000 Hz.', set: { echoDelay: 8 } },
      { say: 'Set the echo back to 0.5 and the delay to 4.', set: { echo: 0.5, echoDelay: 4 } },
    ],
    why: [
      'Two paths of different length arrive at different times, and the receiver adds them.',
      'At a frequency where the delay is a whole number of cycles the two add, and where it is half a cycle they subtract.',
      'So the response is a cosine in frequency, with a peak of one plus the echo and a notch of one less it.',
      'The spacing of the notches is the sample rate over the delay, and nothing else enters it.',
      'This is a tapped delay line, which is exactly rational in z, so the shared FIR machinery draws its response and its zeros.',
      'The coherence bandwidth is how wide a band the channel treats alike, and here it is 1000 Hz.',
      'The signal occupies 1350 Hz, so different parts of it meet different gains.',
    ].join(' '),
  },

  G2: {
    see: [
      'The signal occupies 1350 Hz and the channel treats only 1000 Hz alike.',
      'Parts of the signal meet a peak and parts meet a notch.',
      'The shaping left almost no interference between symbols, and the echo puts a great deal back.',
      'Equalising the channel takes the residual back below a thousandth.',
    ].join(' '),
    try: [
      { say: 'Set the echo to 0.1. The notch is shallow and the eye stays open.', set: { echo: 0.1 } },
      { say: 'Set the echo to 0.9. The notch is deep and the equaliser works harder.', set: { echo: 0.9 } },
      { say: 'Set the echo back to 0.5.', set: { echo: 0.5 } },
    ],
    why: [
      'A pulse that met Nyquist at the transmitter no longer meets it after a channel with an echo.',
      'The echo is a delayed copy, so every symbol now lands at a second instant as well as its own.',
      'The eye closes, and the error rate stops falling when the noise falls, because the interference stays.',
      'That is an error floor, and it is the difference between a noise problem and a channel problem.',
      'More power fixes the first and does nothing for the second.',
      'What fixes the second is an equaliser, which is a filter that undoes what the channel did.',
      'G3 builds one and G4 says what it costs.',
    ].join(' '),
  },

  G3: {
    see: [
      'The equaliser is 41 taps long, and it is the channel inverse truncated to that length.',
      'The cascade of channel and equaliser reads 1 at the decision instant.',
      'It reads below a thousandth at every other symbol instant.',
      'The design picked a delay of nothing, because this channel has a causal inverse.',
    ].join(' '),
    try: [
      { say: 'Set the equaliser taps to 21. The residual rises to 1.17 in a hundred.', set: { eqTaps: 21 } },
      { say: 'Set the equaliser taps to 11. It rises to 9.5 in a hundred.', set: { eqTaps: 11 } },
      { say: 'Set the equaliser taps back to 41.', set: { eqTaps: 41 } },
    ],
    why: [
      'The channel here is one plus half a delay of four samples, and its inverse is an alternating series.',
      'That series has a tap every four samples, falling by half each time, and it never quite ends.',
      'Truncating it to 41 taps keeps six terms, and what is left over is 3.66 in ten thousand.',
      'At 21 taps only three terms fit and the residual is 1.17 in a hundred.',
      'The plan asked for a thousandth at 21 taps, and the arithmetic gives it at 41.',
      'The equaliser is an ordinary finite kernel, so Signal Lab z-plane view draws its zeros unchanged.',
      'Its zeros sit where the channel would have put its poles.',
    ].join(' '),
  },

  G4: {
    see: [
      'The echo is now 0.9, so the notch is 20.000 dB deep.',
      'An equaliser that inverts that notch has to apply 20 dB of gain there.',
      'The noise at that frequency is amplified by the same 20 dB.',
      'The minimum mean-square solution applies less gain and leaves some interference instead.',
    ].join(' '),
    try: [
      { say: 'Set the echo to 0.5. Both solutions converge and the noise cost falls.', set: { echo: 0.5 } },
      { say: 'Set the echo to 0.95. The notch deepens and the gap between the two widens.', set: { echo: 0.95 } },
      { say: 'Set the echo back to 0.9.', set: { echo: 0.9 } },
    ],
    why: [
      'Zero forcing removes the interference exactly, and it makes no reference to the noise.',
      'Where the channel is small its inverse is large, and the noise there is multiplied by the same amount.',
      'On a deep notch that trade is a bad one, because the amplified noise costs more than the interference did.',
      'The minimum mean-square solution is the same linear system with the noise variance added to its diagonal.',
      'That one term stops the gain running away where the channel is small.',
      'What it leaves behind is some interference, and the reader sees both numbers move together.',
      'A designer picks between them from the depth of the notch and the noise the receiver has.',
    ].join(' '),
  },

  G5: {
    see: [
      'The equaliser starts with every tap at zero and learns from a known training sequence.',
      'Each step moves every tap by the error times the input, scaled by the step size.',
      'The mean square error falls from its starting value and settles.',
      'The taps it reaches are within 0.15 of the direct solution.',
    ].join(' '),
    try: [
      { say: 'Set the step size to 0.002. It converges more slowly and settles lower.', set: { mu: 0.002 } },
      { say: 'Set the step size to 0.15. The recursion no longer converges.', set: { mu: 0.15 } },
      { say: 'Set the step size back to 0.02.', set: { mu: 0.02 } },
    ],
    why: [
      'A receiver that does not know the channel cannot solve for the equaliser directly.',
      'It can compare its output against a known sequence and move each tap the way that reduces the error.',
      'That is the least mean square algorithm, and it belongs to the DSP Lab adaptive group.',
      'This lab uses it rather than restating it, and what is on screen is the learning curve.',
      'The step size decides both the speed and the noise left in the taps.',
      'Above two over the tap count times the input power the recursion grows instead of settling.',
      'The pane reports that bound and says when the run crossed it, rather than returning a kernel of infinities.',
    ].join(' '),
  },

  G6: {
    see: [
      'The channel gain is now one complex Gaussian per symbol rather than a constant.',
      'The average bit error rate at 10 dB is 2.3269 in a hundred.',
      'Reaching one error in a hundred thousand takes 43.98 dB.',
      'Without fading the same rate takes 9.588 dB, so the penalty is 34.39 dB.',
    ].join(' '),
    try: [
      { say: 'Set Eb over N0 to 20 dB. The rate falls only to 2.4814 in a thousand.', set: { ebN0Db: 20 } },
      { say: 'Set Eb over N0 to 30 dB. It falls to about 2.5 in ten thousand.', set: { ebN0Db: 30 } },
      { say: 'Set Eb over N0 back to 10 dB.', set: { ebN0Db: 10 } },
    ],
    why: [
      'This is the one object in the lab that is neither exact nor guarded by a threshold.',
      'It is a statistical model, and three assumptions are printed with every number it produces.',
      'Many scattered paths of similar strength reach the receiver, none has a line of sight, and the channel holds still for a symbol.',
      'Under those assumptions the gain is a complex Gaussian and its magnitude squared is exponential.',
      'Averaging the error rate over that distribution gives the closed form the pane prints.',
      'The rate then falls as one over the power rather than as a Gaussian tail, which is why the penalty is so large.',
      'Nothing here says the assumptions hold on any real link, and the label is what makes that a statement rather than an omission.',
    ].join(' '),
  },
}
