export default {
  B1: {
    see: [
      'The expectation is the balance point of the density.',
      'For a uniform on 0 to 1 it is 0.5, as a formula and with no interval.',
      'The sample mean of 1000 draws reads 0.5108.',
      'Its interval reaches 0.0176 each side, and it holds the 0.5.',
    ].join(' '),
    try: [
      { say: 'Switch the source to Gaussian. The balance point moves to µ.', set: { dist: 'gaussian' } },
      { say: 'Switch to exponential. The balance point is 1/λ, right of the peak.', set: { dist: 'exponential' } },
      { say: 'Raise N to 10000. The estimate stays near the formula and the interval narrows.', set: { n: 10000 } },
    ],
    why: [
      'Two numbers sit on this screen and they are different kinds of thing.',
      'The expectation is a property of the density, computed by integration, and it is exact.',
      'The sample mean is computed from data and is therefore random.',
      'The lab prints the first bare and the second with an interval, and never mixes them.',
      'An exponential shows why the balance point is not the peak.',
      'Its density is largest at zero and its expectation is 1/λ, because the long tail pulls the balance to the right.',
      'Reading a mean off the top of a histogram is a habit that fails on any density that is not symmetric.',
    ].join(' '),
  },

  B2: {
    see: [
      'The variance is the expected squared distance from the balance point.',
      'A Rayleigh source with σ = 1 has expectation 1.2533 and variance 0.4292.',
      'Both are formulas.',
      'The measured variance of 4000 draws agrees with the second inside its own interval.',
    ].join(' '),
    try: [
      { say: 'Switch to Gaussian. The variance is σ² exactly, whatever µ is.', set: { dist: 'gaussian' } },
      { say: 'Switch to uniform on 0 to 1. The variance is 1/12, which is 0.0833.', set: { dist: 'uniform' } },
      { say: 'Raise N to 40000. The measured variance moves closer and the interval narrows.', set: { n: 40000 } },
    ],
    why: [
      'The distance is squared for a reason that matters later.',
      'Squared distances of independent quantities add, and unsquared ones do not.',
      'Two independent sources summed have the sum of the variances, so their standard deviations combine as the root of a sum of squares.',
      'Every noise budget in engineering rests on that.',
      'It is also why a power spectral density integrates to a variance and not to a standard deviation.',
      'The units follow: a variance is in signal units squared, and only the square root is in signal units.',
    ].join(' '),
  },

  B3: {
    see: [
      'The sample variance divides by N − 1, not by N.',
      'It is an estimator, so it has a variance of its own and an interval.',
      'For Gaussian data that interval follows 2σ⁴/(N − 1).',
      'This source is exponential, and the Gaussian formula understates the interval by more than 2.5 times.',
    ].join(' '),
    try: [
      { say: 'Switch to Gaussian. The two interval formulas agree within their own noise.', set: { dist: 'gaussian' } },
      { say: 'Switch back to exponential. Read the kurtosis, which is 9 rather than 3.', set: { dist: 'exponential' } },
      { say: 'Compare the two interval widths printed under the estimate.', set: {} },
    ],
    why: [
      'Dividing by N − 1 rather than N corrects a bias.',
      'The sample mean sits inside the data, so distances measured from it are slightly too small.',
      'The larger point is the interval.',
      'The variance of a variance estimate depends on the fourth moment of the data, which the kurtosis measures.',
      'A Gaussian has kurtosis 3 and an exponential has 9, so the same N buys a much wider interval on exponential data.',
      'The panel prints the general formula and the Gaussian one together.',
      'A tool that printed only the Gaussian one would claim a precision this source does not have.',
    ].join(' '),
  },
}
