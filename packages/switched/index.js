// Switched linear circuits, solved exactly.
//
// A converter between switching events is a linear circuit with a constant
// drive, and its state moves by a matrix exponential. This package builds the
// basic converters as such circuits, finds their periodic steady state
// without time-stepping (a linear solve in CCM, one scalar bisection in DCM),
// and measures them with closed-form averages and Gauss–Legendre RMS on the
// analytic solution. The textbook closed forms sit beside it so a lab can
// show where they hold and where they don't.

export { propagator, propagator01, expm2Closed, cosSinhc, damping } from './src/propagator.js'
export { stateAt, endState, integral, sample, quadrature, firstDownCrossing, bisect } from './src/segment.js'
export { zeros, eye, matMul, matVec, matAdd, matScale, vecAdd, vecScale, norm1, solve } from './src/linalg.js'
export { converter, DEFAULTS, KINDS, SIGNALS, evalSignal, idealM } from './src/topologies.js'
export { steadyState, periodMap, waveforms, measures, signalIntegral, average } from './src/steady.js'
export { runPeriods } from './src/transient.js'
export {
  conversionRatio,
  ratioWithRL,
  boostPeak,
  inductorRipple,
  outputRipple,
  K,
  Kcrit,
  Rcrit,
  dcmRatio,
  predictedRatio,
  linearRegulator,
  chopper,
} from './src/formulas.js'
export { walkPeriod, eventSteadyState, periodIntegral, signalAverage, signalStats } from './src/events.js'
export {
  rectifier,
  rectifierSteadyState,
  rectifierMeasures,
  harmonic,
  dimmer,
  dimmerHarmonic,
  dimmerWaveform,
  RECT_SIGNALS,
  RECT_DEFAULTS,
  RECT_KINDS,
} from './src/rectifier.js'
