// @ee-labs/random: seeded generators, ensembles, and estimators that carry
// their own intervals.
//
// The admission test for this package, from CORE_SCOPE.md Rule 1 restated for
// statistics:
//
//   A closed form goes in `dist.js`, `noise.js`, `detect.js`, `wiener.js` or
//   `kalman.js`, and is returned as a bare number with no hedge.
//
//   Anything computed from data goes in `estimate.js`, `psd.js`, `corr.js` or
//   `ensemble.js`, and returns an object carrying the variance of the estimator
//   and a confidence interval. That interval is the guard required by Rule 3,
//   and a pane that prints the value without it is incomplete.
//
// The two are never mixed in one return value. Where a lesson compares them, it
// holds both objects and the comparison is the content.
//
// Nothing here is random in the ordinary sense. Every number is a function of a
// seed, so a lesson's claim is reproducible in the same way a solved circuit is.

export { rng, seedState, splitmix32, runSeed } from './src/prng.js'

export {
  erf,
  erfc,
  qFunction,
  qInv,
  phi,
  Phi,
  zFor,
  gammaP,
  gammaQ,
  chi2Inv,
  DISTRIBUTIONS,
  DISTRIBUTION_NAMES,
  distribution,
} from './src/dist.js'

export {
  estimate,
  mean,
  sampleMean,
  sampleVariance,
  proportion,
  histogram,
  histogramError,
} from './src/estimate.js'

export { ensemble, ergodicity, quantileOfSorted, SAMPLE_CAP } from './src/ensemble.js'

export { autocorrelation, psdFromAcf, acfFromPsd, crossCorrelation } from './src/corr.js'

export {
  periodogram,
  averagedPeriodogram,
  overlapCorrelation,
  integratePsd,
  relativeSpread,
  whitePsd,
  filteredPsd,
} from './src/psd.js'

export {
  BOLTZMANN,
  ELEMENTARY_CHARGE,
  T_ROOM,
  thermalDensity,
  shotDensity,
  noiseBandwidthFirstOrder,
  capacitorNoise,
  whiteNoise,
  firstOrderMagnitude,
  firstOrderLowpass,
} from './src/noise.js'

export {
  energy,
  matchedFilter,
  filterSnr,
  matchedSnr,
  errorRateAntipodal,
  errorRateOrthogonal,
  errorRateAntipodalDb,
  errorRateOrthogonalDb,
  detectionRun,
  PULSES,
} from './src/detect.js'

export {
  wienerScalar,
  wienerFir,
  wienerResponse,
  solveToeplitz,
  levinsonDurbin,
} from './src/wiener.js'

export { kalmanSteadyState, kalmanRun, stationaryVariance } from './src/kalman.js'
