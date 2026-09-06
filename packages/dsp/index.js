// Signal generation, transforms, filters, and the chain that runs them.
//
// Nothing here knows what an application's blocks are. `createChain` takes a
// block registry and returns the chain functions bound to it, which is what
// keeps this package reusable across tools that define different blocks.

export { fft, ifft, binFreq, magnitude } from './src/fft.js'
export { spectrum, spectrumComplex, windowFn, toDb, WINDOWS } from './src/spectrum.js'
export { WAVEFORMS, APERIODIC, hash01, sample, render, rms, peak } from './src/signals.js'
export {
  BIQUAD_MODES,
  FREQ_MIN,
  FREQ_MAX_RATIO,
  Q_MIN,
  Q_MAX,
  designBiquad,
  biquadResponse,
  biquadPhase,
  poleRadius,
  isStable,
  settleSamples,
  makeBiquad,
  biquadPolesZeros,
  butterworthQs,
  designFirstOrder,
  designCascade,
} from './src/biquad.js'
export {
  FIR_MODES,
  TAPS_MIN,
  TAPS_MAX,
  sinc,
  movingAverage,
  designFir,
  firAt,
  firResponse,
  firPhase,
  firGroupDelay,
  firZeros,
  isSymmetric,
  makeFir,
} from './src/fir.js'
export { createChain } from './src/chain.js'
export { sincInterp } from './src/reconstruct.js'

// The second course: rate changes, design to a specification, adaptive filters,
// fixed point, and the estimators. Every module below is new work that leaves
// everything above it untouched.
export {
  convolveFir,
  downsample,
  upsample,
  expandTaps,
  decimate,
  interpolate,
  polyphase,
  polyphaseDecimate,
  polyphaseInterpolate,
  designDecimationFir,
  designInterpolationFir,
  multirateCost,
  makeDecimateHold,
  makeInterpolateFill,
} from './src/multirate.js'
export {
  WINDOW_SPECS,
  windowTransition,
  windowTaps,
  windowedSinc,
  measureFir,
  stopbandDepth,
  specMargin,
  lowpassSpec,
  passbandRefDb,
  specMarginRef,
  remezOrder,
  designFirSpec,
  remez,
  designRemezSpec,
  analogPrototype,
  iirOrderFor,
  designIir,
  designIirSpec,
} from './src/design.js'
export {
  ADAPTIVE_ALGORITHMS,
  autocorr,
  crosscorr,
  wiener,
  lmsStepBound,
  misadjustment,
  makeLms,
  makeNlms,
  makeRls,
  makeAdaptive,
  runAdaptive,
  weightError,
  tailPower,
} from './src/adaptive.js'
export {
  ROUNDING,
  OVERFLOW,
  quantizer,
  quantizeBiquad,
  poleGrid,
  makeFixedBiquad,
  findLimitCycle,
  roundingNoise,
  scalingNorms,
} from './src/fixpoint.js'
export {
  windowPower,
  periodogram,
  bartlett,
  welch,
  bandStats,
  levinson,
  arYuleWalker,
  arSpectrum,
  arOrderCriteria,
  fftCost,
  bitReversal,
  butterfly,
  dft,
} from './src/estimate.js'

// The same chain over complex baseband samples, for the labs that carry an
// in-phase and a quadrature part together (EE_LABS_MAP §2, track B).
export {
  createComplexChain,
  renderComplex,
  complexBuffer,
  toComplex,
  realOf,
  imagOf,
  magnitudeOf,
} from './src/complexChain.js'
