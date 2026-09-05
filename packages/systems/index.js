// Transfer functions: the currency the whole suite trades in.
//
// A circuit produces one, a control loop produces one, and a digital filter is
// one after a change of variable. Frequency response, poles, step response and
// stability are written once here so each tool can describe its own subject and
// hand the analysis over.
//
// ── ADMISSION TEST (Rule 1 of /CORE_SCOPE.md — read it before extending) ──
//
// An object goes into this package only if it is expressible EXACTLY as a
// rational function of s or z: finite poles and zeros, real coefficients.
// No adapter that "mostly" converts an inadmissible object. Padé, averaging
// and linearization do not make an object admissible — they create a NEW,
// labeled approximation governed by Rule 3, never silently substituted for
// the thing it approximates. Unsure whether something is admissible? Then it
// is not, until shown otherwise with a test. Transcendentals (a transmission
// line's e^{−jβl}) and piecewise systems (a switched converter) are refused
// at this boundary by design: the boundary is content, not a limitation.

export {
  evalAt,
  evalAtFreq,
  magnitudeAt,
  phaseAt,
  dcGain,
  bode,
  roots,
  polesZeros,
  isStable,
  toStateSpace,
  simulate,
  stepResponse,
  secondOrderMetrics,
  bilinear,
  polyMul,
  polyAdd,
  series,
  closeLoop,
  errorLoop,
  margins,
  rootLocus,
} from './src/tf.js'

// ── Control Lab II's additions ──
//
// State space, the sampled loop, the describing function and its guard, the
// exact piecewise-linear trajectory, and the step fit with its residual. Each
// module's header states which of CORE_SCOPE's three cases it is in.

export {
  StateSpaceError,
  stateSpace,
  toTransferFunction,
  charPoly,
  eigenvalues,
  controllability,
  observability,
  polyFromRoots,
  placePoles,
  observerGain,
  lyapunov,
  lqr,
  ssSeries,
  ssTrajectory,
  expmWithHold,
  similarity,
} from './src/ss.js'

export {
  DiscreteError,
  SAMPLES_PER_CYCLE,
  ZOH_TF_DECLINED,
  zoh,
  discretize,
  isStableDiscrete,
  simulateDiscrete,
  stepDiscrete,
  stepDiscreteTF,
  zohGain,
  zohPhaseLag,
  zohDelay,
  zohTransferFunction,
  substituteS,
  emulate,
  emulationGuard,
  discreteLoop,
  sOfZ,
} from './src/discrete.js'

export {
  NonlinearError,
  SMOOTH_DECLINED,
  RELAY_DECLINED,
  PWL_KINDS,
  pwlValue,
  pwlRegions,
  pwlRegionOf,
} from './src/nonlinear.js'

export {
  HARMONIC_LIMIT,
  saturationDescribing,
  deadzoneDescribing,
  saturationHarmonic,
  saturationAmplitudeFor,
  negativeRealCrossings,
  describingLimitCycle,
  predictionError,
} from './src/describing.js'

export {
  PhaseError,
  ALGEBRAIC_LOOP_DECLINED,
  loopRegions,
  pwlTrajectory,
  oscillationOf as pwlOscillationOf,
  phaseField,
  switchingLines,
  equilibria,
  lyapunovRate,
} from './src/phase.js'

export {
  IdentError,
  ZETA_MAX,
  firstOrderStep,
  secondOrderStep,
  fitFirstOrder,
  fitSecondOrder,
  fitStep,
} from './src/ident.js'
