export default {
  D1: {
    see: [
      'The plot is the signal multiplied by a shifted copy of itself, against the shift.',
      'At zero lag it is 1 by construction.',
      'This signal has been through a 500 Hz filter, whose time constant is 15.28 samples.',
      'The curve falls to 1/e after 16 lags.',
    ].join(' '),
    try: [
      { say: 'Raise the corner to 4000 Hz. The curve narrows to about two samples.', set: { fc: 4000 } },
      { say: 'Lower it to 200 Hz. The curve widens, and the signal in time looks slower.', set: { fc: 200 } },
      { say: 'Switch the filter off. Every lag past zero falls inside the noise band.', set: { filtered: false } },
    ],
    why: [
      'Correlation at lag m asks how much of the signal now is predictable from the signal m samples ago.',
      'White noise answers nothing at every non-zero lag, so its curve is a single spike.',
      'A filter changes that, because its output is a weighted sum of recent inputs and two nearby outputs share most of those inputs.',
      'How far the correlation reaches is set by the filter and not by the noise.',
      'The 1/e crossing lands within one sample of the time constant here.',
      'The same object, seen in frequency instead, is the power spectral density, and D2 is that step.',
    ].join(' '),
  },

  D2: {
    see: [
      'The autocorrelation and the power spectral density are one object seen twice.',
      'The Fourier transform of one is the other.',
      'On this finite record the two routes agree to eleven digits.',
      'That is arithmetic rather than a statistical claim.',
    ].join(' '),
    try: [
      { say: 'Read the gap printed under the plot. It is 5.8 × 10⁻¹¹.', set: {} },
      { say: 'Raise the record to 16384 samples. The gap stays at floating-point size.', set: { wkN: 16384 } },
      { say: 'Switch to the density view. It is the same numbers on a frequency axis.', set: {}, view: 'density' },
    ],
    why: [
      'Wiener-Khinchin is usually stated about a process, where it is a limit.',
      'On a finite record it is also an identity, provided the autocorrelation estimate divides by N rather than by the number of overlapping terms.',
      'That biased estimate transforms exactly to the periodogram.',
      'The unbiased one does not, and its transform can go negative, which would be a density with negative power in it.',
      'So the biased estimate is the one this lab uses, and the two panels are guaranteed to agree rather than merely observed to.',
    ].join(' '),
  },

  D3: {
    see: [
      'The value at zero lag is the mean square of the signal.',
      'It is also the area under the density.',
      'Both read 1.00 for this source.',
      'Two routes reach one number.',
    ].join(' '),
    try: [
      { say: 'Raise the source rms to 2. Both readings become 4, not 2.', set: { noiseRms: 2 } },
      { say: 'Return it to 1. Both readings return to 1.', set: { noiseRms: 1 } },
      { say: 'Read the end-panel note under the integral.', set: {} },
    ],
    why: [
      'The zero lag of an autocorrelation is the signal multiplied by itself, averaged, which is the mean square.',
      'The area under the density is the same quantity by the transform, since a transform at zero frequency is a sum over all lags.',
      'The panel prints a small correction with the integral.',
      'The area under a plotted curve is a trapezoid rule, which takes half of each end panel, while the exact sum takes all of both.',
      'The gap between the two numbers is those two half panels and nothing else.',
      'Stating it is cheaper than leaving a reader to wonder about a fifth digit.',
    ].join(' '),
  },

  D4: {
    see: [
      'The view shows 800 runs of one process at once.',
      'Averaging along a single run gives one number per run.',
      'For this process those numbers spread by 0.1313 at length 64 and 0.0310 at length 1024.',
      'A longer run gives a better answer.',
    ].join(' '),
    try: [
      { say: 'Set the length to 1024. The spread falls fourfold, as one over the root of the length.', set: { length: 1024 } },
      { say: 'Switch the process to the constant one. Each run is a flat line at its own level.', set: { ensembleKind: 'constant' } },
      { say: 'Set the length to 1024 again. The spread does not move at all.', set: { ensembleKind: 'constant', length: 1024 } },
    ],
    why: [
      'A process is ergodic when averaging along one run reaches the same answer as averaging across runs.',
      'Most useful processes are, which is what lets one long measurement stand in for many.',
      'The second process here is not.',
      'Its value is drawn once per run and then held, so a longer run adds no information and the spread stays at 0.9907 whatever the length.',
      'It is still stationary, because its statistics do not depend on when you look.',
      'The two properties are separate, and a component tolerance is the everyday example of the second without the first.',
    ].join(' '),
  },
}
