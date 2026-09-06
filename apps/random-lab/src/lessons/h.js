export default {
  H1: {
    see: [
      'To find a known pulse in noise, correlate the record with the pulse.',
      'The output peaks where the pulse starts, and the peak height is the pulse energy.',
      'That filter gives the largest ratio any linear filter can reach.',
      'A rectangular filter on this half-sine pulse reaches 81.07 % of it.',
    ].join(' '),
    try: [
      { say: 'Read the mismatched ratio. A rectangular filter reaches 81.07 % of this peak.', set: {} },
      { say: 'Switch the pulse to rectangular. The two now agree exactly.', set: { pulse: 'rect' } },
      { say: 'Raise the noise variance to 0.1. The peak stays and the noise around it grows.', set: { noiseVariance: 0.1 } },
    ],
    why: [
      'The claim follows from the Cauchy-Schwarz inequality.',
      'The output at the sampling instant is a sum of the filter times the pulse, and the noise it passes is set by the sum of the filter squared.',
      'The ratio of the first squared to the second is largest when the filter is proportional to the pulse.',
      'Any constant of proportionality works, because a scaling changes signal and noise together.',
      'Every other shape falls short, and this pane lets a reader try one and read the loss.',
      'Nothing about the noise beyond its variance enters, so the result does not need the noise to be Gaussian.',
    ].join(' '),
  },

  H2: {
    see: [
      'The ratio the matched filter reaches is 2E/N0.',
      'At a noise variance of 0.01 and a unit-energy pulse it is 100, which is 20 dB.',
      'A rectangular pulse, a half-sine and a ramp of the same energy all reach it.',
      'The shape does not matter, and neither does the length.',
    ].join(' '),
    try: [
      { say: 'Switch the pulse to a ramp. The ratio does not move.', set: { pulse: 'ramp' } },
      { say: 'Set the pulse length to 256. It still does not move.', set: { pulseLength: 256 } },
      { say: 'Set the noise variance to 0.001. The ratio rises to 30 dB.', set: { noiseVariance: 0.001 } },
    ],
    why: [
      'The pane computes the number two ways and prints both.',
      'One route is the discrete pulse energy divided by the noise variance per sample.',
      'The other converts to continuous time, with E the energy in joules and N0 the one-sided noise density, and forms 2E/N0.',
      'They agree to nine decimals, which is the check that the two currencies describe one quantity.',
      'The practical consequence is large.',
      'A pulse can be reshaped to fit a channel, a mask or a bandwidth, and as long as its energy is kept, detection is not made harder.',
    ].join(' '),
  },

  H3: {
    see: [
      'The decision after the filter is a Gaussian either side of zero.',
      'The error rate is Q of the root of twice Eb/N0.',
      'At 7 dB that is 7.7267 × 10⁻⁴, and 200000 counted symbols give 7.500 × 10⁻⁴.',
      'The counted value carries an interval that holds the curve.',
    ].join(' '),
    try: [
      { say: 'Set Eb/N0 to 12 dB. The count reaches zero and the curve reads 9.006 × 10⁻⁹.', set: { ebN0Db: 12 } },
      { say: 'Read the interval at 12 dB. It reaches 3.8 × 10⁻³, not zero.', set: { ebN0Db: 12 } },
      { say: 'Set Eb/N0 to 4 dB. The count and the curve meet at 1.25 %.', set: { ebN0Db: 4 } },
    ],
    why: [
      'Zero counted errors is the case a naive interval gets wrong.',
      'The usual interval collapses to zero width at a count of zero, which would claim the rate is exactly zero.',
      'The interval here keeps a width, so a reader can see that a thousand symbols say almost nothing about a rate of nine in a billion.',
      'The two signalling schemes differ by 3.0103 dB at every point.',
      'On-off keying places its two symbols half as far apart for the same average energy, and half the distance costs exactly a factor of two in the ratio.',
    ].join(' '),
  },
}
