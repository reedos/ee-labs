// @ee-labs/comms: the link, as a chain of exact blocks.
//
// The admission test for this package, from CORE_SCOPE.md Rule 1 restated for a
// communications link:
//
//   A mapper, a pulse shaper, a tapped delay line, a transform pair and a
//   decision region are exact arithmetic, and each is returned as a bare number
//   with no hedge.
//
//   A counted error rate is an estimate. It goes through `ber.js` and comes
//   back with the interval `@ee-labs/random` builds, which is the guard Rule 3
//   requires. A pane that draws the count without it is incomplete.
//
//   Flat fading is a labelled statistical model. It is neither exact nor
//   guarded by a threshold, so it carries its three assumptions wherever its
//   numbers go.
//
// The three are never mixed in one return value. The closed form is a line and
// the count is a marker, and where a lesson compares them the distance between
// them is the content.
//
// This package imports `fft`, `ifft` and the FIR machinery from `@ee-labs/dsp`,
// and the generator, the Q function and the interval from `@ee-labs/random`. It
// rewrites neither.

export { createComplexChain, at, put, cmul, cdiv, cabs, rot } from './src/chain.js'

export {
  CONSTELLATIONS,
  CONSTELLATION_NAMES,
  gray,
  hamming,
  constellation,
  neighbourPairs,
  adjacency,
  naturalLabels,
  randomBits,
  mapBits,
  decide,
  demapSymbols,
  errorVectorMagnitude,
} from './src/mappers.js'

export {
  SHAPES,
  SHAPE_NAMES,
  SPAN_GUARD,
  raisedCosine,
  rootRaisedCosine,
  shapeTaps,
  convolve,
  residualIsi,
  shapedBandwidth,
  streamPeak,
  eyeOpening,
} from './src/shape.js'

export {
  FADING_ASSUMPTIONS,
  noiseVariance,
  awgn,
  multipath,
  twoRay,
  realTaps,
  tapsReal,
  channelAt,
  channelResponse,
  rayleighGains,
  applyFading,
  rayleighBer,
  rayleighThreshold,
} from './src/channel.js'

export {
  PULSES,
  matchedSample,
  matchedFilterSnr,
  softMetric,
  fskCoherentBer,
  fskNoncoherentBer,
  toneCorrelation,
  outsideRegion,
} from './src/detect.js'

export {
  SCHEMES,
  HOLLOW_BELOW,
  bitsPerSymbol,
  berClosed,
  serClosed,
  ebN0For,
  relativeHalfWidth,
  errorsFor,
  symbolsFor,
  berCount,
  berCurve,
} from './src/ber.js'

export {
  ofdmModulate,
  ofdmDemodulate,
  subcarrierResponse,
  ofdmRoundTrip,
  worstError,
  papr,
  paprCcdf,
  paprLevel,
  ofdmRate,
  subcarrierCorrelation,
} from './src/ofdm.js'

export {
  loopFilter,
  costasRun,
  earlyLate,
  loopSnrDb,
  phaseErrorLossDb,
  rotationDeg,
} from './src/sync.js'

export {
  besselJ,
  firstZeroJ0,
  fmLines,
  carsonFraction,
  carsonBandwidth,
  amSidebandDb,
  amSidebandPower,
  meritAm,
  meritFm,
  meritDb,
  amWaveform,
  dsbWaveform,
  fmWaveform,
  envelopeDetect,
  coherentDetect,
  thd,
} from './src/analog.js'

export {
  LIGHT,
  T_REF,
  HARD_DECISION_DB,
  ktDbm,
  noiseFloorDbm,
  wavelength,
  pathLossDb,
  rangeFor,
  friisNoiseFigure,
  linkBudget,
  implementationLoss,
} from './src/budget.js'

export { linearEqualiser, cascade, equaliserQuality, lmsEqualiser, lmsStable } from './src/eq.js'
