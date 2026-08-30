// Signal generation, transforms, filters, and the chain that runs them.
//
// Nothing here knows what an application's blocks are. `createChain` takes a
// block registry and returns the chain functions bound to it, which is what
// keeps this package reusable across tools that define different blocks.

export { fft, magnitude } from './src/fft.js'
export { spectrum, windowFn, toDb, WINDOWS } from './src/spectrum.js'
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
