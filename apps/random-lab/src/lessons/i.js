export default {
  I1: {
    see: [
      'One weight on one noisy sample gives the best linear estimate of the signal.',
      'The weight is the signal variance over the total, which is 0.8 here.',
      'It leaves a mean-square error of 0.2, against 0.25 for doing nothing.',
      'It does not change the signal-to-noise ratio at all.',
    ].join(' '),
    try: [
      { say: 'Set the noise variance to 4. The weight falls to 0.2 and the estimate shrinks.', set: { wienerNoiseVariance: 4 } },
      { say: 'Set it to 0.01. The weight rises to 0.99 and the sample is passed nearly intact.', set: { wienerNoiseVariance: 0.01 } },
      { say: 'Read the decibel gain. It is zero at every setting.', set: {} },
    ],
    why: [
      'A single weight scales the signal and the noise together, so the ratio between them cannot move.',
      'What the weight buys is mean-square error, by shrinking the estimate towards zero.',
      'That is worse as a scaling and better as an estimate, and the two goals are genuinely different.',
      'A filter with more than one tap can move the ratio, because it sees more than one sample and can use the correlation between them.',
      'At equal signal and noise power here, one weight leaves 0.0692 and sixteen taps leave 0.0507.',
      'The gain comes from memory, which is the idea the Kalman filter then makes recursive.',
    ].join(' '),
  },

  I2: {
    see: [
      'The Kalman filter computes the same best estimate one sample at a time.',
      'Its gain settles to 0.21533 and stays there.',
      'The settled value depends only on the ratio of process noise to measurement noise.',
      'It is decided before any measurement arrives.',
    ].join(' '),
    try: [
      { say: 'Set the measurement noise to 0.01. The gain rises to 0.9148 and tracking is quick.', set: { r: 0.01 } },
      { say: 'Set it to 100. The gain falls to 0.005124 and the estimate barely moves.', set: { r: 100 } },
      { say: 'Set the process noise to 0.001 and r back to 1. The same 0.005124 returns.', set: { q: 0.001, r: 1 } },
    ],
    why: [
      'The gain is a variance ratio, the prior variance over the prior plus the measurement noise.',
      'Only the ratio of the two noises matters, which is why two very different settings give the same gain.',
      'It settles because its recursion has a fixed point, and the panel prints the closed form for that point beside the running value.',
      'From a start 500 away it settles by step 8.',
      'Against the one-shot estimate of I1 it leaves 62.44 % of the error, and that gap is what the earlier measurements are worth.',
      'Control Lab II takes this further, with a plant state in place of the scalar.',
    ].join(' '),
  },
}
