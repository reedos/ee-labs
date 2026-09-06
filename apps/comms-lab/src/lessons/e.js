// Group E lessons. see / try / why, in the budgets STYLE.md sets.

export default {
  E1: {
    see: [
      'The local carrier is 30 degrees away from the one the transmitter used.',
      'The whole constellation has turned by that angle.',
      'The wanted component is scaled by the cosine of the error, which is 0.866.',
      'That costs 1.249 dB, and at 90 degrees nothing is left.',
    ].join(' '),
    try: [
      { say: 'Set the phase offset to 0. The constellation returns to its axes.', set: { phaseOffsetDeg: 0 } },
      { say: 'Set the phase offset to 45. QPSK points sit on the decision boundaries.', set: { phaseOffsetDeg: 45 } },
      { say: 'Set the phase offset back to 30.', set: { phaseOffsetDeg: 30 } },
    ],
    why: [
      'Every experiment before this one gave the receiver the transmitter phase for nothing.',
      'A real receiver has a local oscillator that is close to the right frequency and not on the right phase.',
      'The effect is a rotation of the whole constellation by the phase error.',
      'A decision made against fixed boundaries then reads the wrong point once the rotation is large enough.',
      'For QPSK that limit is 45 degrees, where the points sit on the boundaries themselves.',
      'The error vector reading rises long before that, which is how an instrument sees the fault.',
      'E2 removes the assumption by building a loop that finds the phase from the signal.',
    ].join(' '),
  },

  E2: {
    see: [
      'A Costas loop recovers the carrier phase from a signal with no carrier line.',
      'Its error signal is the product of the in-phase and quadrature arms.',
      'At a normalised loop bandwidth of 0.02 the loop bandwidth is 20.00 Hz.',
      'The phase error settles below half a degree from a 40 degree start.',
    ].join(' '),
    try: [
      { say: 'Set the loop bandwidth to 0.05. The loop acquires sooner and jitters more.', set: { bnT: 0.05 } },
      { say: 'Set the loop bandwidth to 0.005. It acquires later and jitters less.', set: { bnT: 0.005 } },
      { say: 'Set the loop bandwidth back to 0.02.', set: { bnT: 0.02 } },
    ],
    why: [
      'A suppressed-carrier signal has no line for a loop to lock to, because the modulation removed it.',
      'The Costas error signal is the product of the two arms, which is proportional to the sine of twice the phase error.',
      'The sign of that product says which way to turn, and its size says how far.',
      'A proportional and integral filter on that signal makes a second-order loop.',
      'The pane prints the loop transfer function, its two poles and the radius they sit at.',
      'That design is Control Lab II digital group work, and this lab computes the numbers rather than teaching the design.',
      'When that lab is built the loop travels to it as a plant.',
    ].join(' '),
  },

  E3: {
    see: [
      'The local oscillator is now 5 Hz away as well as out of phase.',
      'A second-order loop follows the offset and leaves nothing behind.',
      'A first-order loop leaves a static error that does not go away.',
      'The two traces are the same run with one term of the filter removed.',
    ].join(' '),
    try: [
      { say: 'Set the frequency offset to 10 Hz. The first-order error doubles.', set: { freqOffsetHz: 10 } },
      { say: 'Set the frequency offset to 0. Both loops settle to nothing.', set: { freqOffsetHz: 0 } },
      { say: 'Set the frequency offset back to 5 Hz.', set: { freqOffsetHz: 5 } },
    ],
    why: [
      'A frequency offset is a phase that ramps, so following it needs a filter output that holds a constant value.',
      'A proportional term produces an output only while an error is present, so a first-order loop keeps an error.',
      'An integral term holds its output with no input, so a second-order loop can hold the ramp with no error left.',
      'That is the final-value theorem, and Control Lab already teaches it for continuous loops.',
      'The static error of the first-order loop is proportional to the offset and inversely proportional to the loop gain.',
      'Widening the loop reduces it without removing it, which is what makes the second term necessary rather than convenient.',
      'The same argument decides the order of a timing loop in E4.',
    ].join(' '),
  },

  E4: {
    see: [
      'Two correlations are taken a quarter of a symbol either side of the decision instant.',
      'Their difference is the error signal, and it is zero at the right instant.',
      'The slope through zero says which way to move and by how much.',
      'The curve turns over past a fifth of a symbol, which bounds the range the loop pulls in from.',
    ].join(' '),
    try: [
      { say: 'Set the gate spacing to 0.25. The curve steepens and the pull-in range narrows.', set: { gate: 0.25 } },
      { say: 'Set the gate spacing to 1. The curve flattens and the range widens.', set: { gate: 1 } },
      { say: 'Set the gate spacing back to 0.5.', set: { gate: 0.5 } },
    ],
    why: [
      'A pulse is symmetric about its own instant, so two samples either side of it are equal there.',
      'Away from it one sample is larger than the other, and which one says which way the instant moved.',
      'The difference of the two is the error signal, and the whole loop is that signal through a filter.',
      'The slope through zero is the detector gain, and it enters the loop bandwidth the same way any gain does.',
      'A wide gate gives a shallow curve and a wide pull-in range, and a narrow one gives the opposite.',
      'Past the turning point a larger error produces a smaller correction, so the loop no longer pulls in.',
      'C5 measured what a timing error costs, and this is the loop that removes it.',
    ].join(' '),
  },

  E5: {
    see: [
      'The loop settles inside one per cent in 173 symbols at a normalised bandwidth of 0.02.',
      'That is 172.7 ms at 1000 symbols a second.',
      'The loop ratio reads 13.98 dB, which is one over twice the normalised bandwidth.',
      'Narrowing the loop fourfold buys 6.02 dB and costs four times the settling.',
    ].join(' '),
    try: [
      { say: 'Set the loop bandwidth to 0.005. The settling grows to 691 symbols and the ratio to 20.00 dB.', set: { bnT: 0.005 } },
      { say: 'Set the loop bandwidth to 0.05. The settling falls to 70 symbols and the ratio to 10.00 dB.', set: { bnT: 0.05 } },
      { say: 'Set the loop bandwidth back to 0.02.', set: { bnT: 0.02 } },
    ],
    why: [
      'A loop passes what is inside its bandwidth and rejects what is outside.',
      'The signal it follows is inside, and the noise is spread over everything.',
      'So less noise reaches the phase estimate through a narrow loop, and the estimate jitters less.',
      'The same narrowness slows the response to anything that changes, including the initial acquisition.',
      'The two move together, one as ten log of the bandwidth and the other as one over it.',
      'A designer picks a point on that line from the largest offset the link has to acquire.',
      'Nothing here is a rule of thumb, and every number is a function of the two knobs the pane offers.',
    ].join(' '),
  },
}
