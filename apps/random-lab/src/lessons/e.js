export default {
  E1: {
    see: [
      'This is one periodogram frame of white noise, and it is spray.',
      'Each bin scatters as widely as its own mean.',
      'The measured spread across the bins reads 0.974 against a predicted 1.',
      'The spray is a property of the estimator, not a fault in the transform.',
    ].join(' '),
    try: [
      { say: 'Read the degrees of freedom under the plot. One frame has 2.', set: {} },
      { say: 'Change the seed. The spray changes and its width does not.', set: { seed: 32 } },
      { say: 'Go to E2 and raise the averages.', set: {} },
    ],
    why: [
      'A periodogram bin is a sum of two squared Gaussians, one for the real part and one for the imaginary.',
      'That sum follows a chi-square with two degrees of freedom, whose standard deviation equals its mean.',
      'So the relative spread of a single frame is 1, whatever the record length is.',
      'A longer frame gives more bins and finer resolution, and each bin is still as noisy as before.',
      'Only averaging independent frames improves it.',
      'This is the one place where more data in a single transform does not buy a better estimate.',
    ].join(' '),
  },

  E2: {
    see: [
      'Cutting the record into M frames and averaging them narrows the spread.',
      'At 4 frames it reads 0.491, at 25 it is 0.205, at 100 it is 0.105.',
      'At 400 it is 0.0496.',
      'Each is one over the root of M.',
    ].join(' '),
    try: [
      { say: 'Set the averages to 4. The floor is still visibly rough.', set: { averages: 4 } },
      { say: 'Set them to 100. The spread is a tenth and the floor reads flat.', set: { averages: 100 } },
      { say: 'Set them to 400. Sixteen times the frames give a fourfold improvement.', set: { averages: 400 } },
    ],
    why: [
      'Averaging M independent frames gives an estimate with 2M degrees of freedom, and the relative spread is the root of two over that.',
      'So it falls as one over the root of M, and a sixteenfold increase buys a factor of four.',
      'The cost is resolution or record length.',
      'A fixed record cut into more frames gives shorter frames and wider bins, so a smooth spectrum is bought with a coarser frequency axis.',
      'The panel prints the segment length and the bin width together for that reason.',
      'Overlapping the frames buys a little more, and the frames are then correlated, so the panel says the degrees of freedom are no longer exact.',
    ].join(' '),
  },

  E3: {
    see: [
      'The shaded ribbon is the interval on the density, bin by bin.',
      'At 100 averages there are 200 degrees of freedom.',
      'The interval runs from 0.830 to 1.229 of the estimate.',
      'It is wider above than below, because a chi-square is not symmetric.',
    ].join(' '),
    try: [
      { say: 'Set the averages to 10. The ribbon widens sharply and its skew is obvious.', set: { averages: 10 } },
      { say: 'Set the level to 0.99. The ribbon widens at every average count.', set: { level: 0.99 } },
      { say: 'Set the averages to 400. The ribbon closes on the estimate.', set: { averages: 400 } },
    ],
    why: [
      'The averaged estimate is the true density times a chi-square divided by its degrees of freedom.',
      'So the interval is a chi-square interval and is asymmetric.',
      'At 200 degrees of freedom the estimate can be 17 % low and 23 % high, and those two are not the same number.',
      'A normal interval would be symmetric and would be visibly wrong below about twenty averages.',
      'That range is where a reader starts, so the chi-square points are computed here rather than approximated.',
      'A noise floor quoted without this ribbon is a number with an unstated precision.',
    ].join(' '),
  },

  E4: {
    see: [
      'The area under the density is the mean square of the signal.',
      'At 100 averages it returns 0.99626 mV against the 1 mV that went in.',
      'The bin width is 93.75 Hz at 512 samples and 48 kHz.',
      'The two end bins sit at half the level of the rest.',
    ].join(' '),
    try: [
      { say: 'Set the segment to 2048. The bins narrow to 23.44 Hz and the area does not move.', set: { segment: 2048 } },
      { say: 'Set the source rms to 2 mV. The area quadruples, because it is a mean square.', set: { noiseRms: 2e-3 } },
      { say: 'Read the end bins against the floor. They sit at half of it.', set: {} },
    ],
    why: [
      'A one-sided density folds each negative frequency onto its positive partner, so every bin between DC and Nyquist is doubled.',
      'DC and Nyquist have no partner and are not doubled, so their estimates sit at half the flat level and carry half the degrees of freedom.',
      'They are still plotted and still counted in the area.',
      'They are left out of the spread across bins, because two half-height outliers in 129 bins would double the measured variance.',
      'Spectral estimation past this point, meaning fitting a model to the density, belongs to the DSP Lab.',
    ].join(' '),
  },
}
