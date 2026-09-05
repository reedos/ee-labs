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
export { steadyState, periodMap, waveforms, measures, signalIntegral, average, stateAtPeriod } from './src/steady.js'
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
  capacitorRms,
  switchingCrossover,
  peakEfficiencyLoad,
} from './src/formulas.js'
export {
  CORE_DEFAULTS,
  SATURATION_MODEL,
  coreOf,
  coreArea,
  saturationCurrent,
  fluxDensity,
  fluxSwing,
  fluxTrace,
  saturatingConverter,
} from './src/magnetics.js'
export { saturatingSteadyState, saturatingWalk, saturationEvent, stateAtTime } from './src/saturating.js'
export {
  flyback,
  halfBridge,
  isolated,
  isolatedM,
  ISOLATED_KINDS,
  ISOLATED_DEFAULTS,
} from './src/isolated.js'
export { chainPlan, clockedSteadyState, fourierAt, spectrumOf, statsOf, meanProduct, isPiecewiseConstant } from './src/clocked.js'
export {
  inverter,
  inverterSteadyState,
  inverterMeasures,
  inverterWaveform,
  inverterDistortion,
  pwmEdges,
  carrierRatio,
  lcMagnitude,
  squareFundamentalRms,
  squareThd,
  spwmFundamentalPeak,
  INVERTER_KINDS,
  INVERTER_DEFAULTS,
  INVERTER_SIGNALS,
} from './src/inverter.js'
export { lossLedger, activeMechanisms, LOSS_ROWS } from './src/ledger.js'
export { walkPeriod, eventSteadyState, periodIntegral, signalAverage, signalStats } from './src/events.js'
export { forward, pushPull, fullBridge, pushPullFamily, forwardFamily, forwardM, forwardMeasures, windowedSteadyState, walkWindows, resetCeiling, fluxWalk, FORWARD_KINDS, FORWARD_DEFAULTS } from './src/isolated.js'
export { resonantConverter, resonantSteadyState, resonantMeasures, gainCurve, fhaGain, fhaRatio, seriesResonance, lowerResonance, tankImpedance, tankQ, acLoad, hardSwitchedEdgeLoss, RESONANT_KINDS, RESONANT_DEFAULTS } from './src/resonant.js'
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
