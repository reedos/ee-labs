// @ee-labs/fields — the electromagnetics engine.
//
// CORE_SCOPE.md's admission test, restated where the work happens (its §"Where
// this lives" asks for exactly this comment):
//
//   Rule 1. An object goes into a package exactly, or it is guarded, or it is
//   declined with a reason. In this package the three classes are:
//
//   EXACT, and never hedged:
//     the closed-form capacitance, resistance and inductance of the canonical
//     geometries (closed.js); Coulomb and Gauss (electrostatics.js);
//     Biot-Savart on a wire path and Ampere's law (magnetics.js); the plane
//     wave, its polarisation and its reflection at an interface (wave.js); the
//     transmission line at one frequency, lossy or not (line.js); the lossless
//     line with resistive ends in time (bounce.js); the waveguide's cutoffs and
//     the cavity's resonances (waveguide.js); the dipole's pattern (antenna.js).
//
//   APPROXIMATE, and never without a guard carrying a threshold:
//     the relaxation solver, whose guard is the change between two mesh
//     refinements (relax.js); the magnetic circuit's series reluctance, guarded
//     by the gap against the core's width (magnetics.js); the eddy-current
//     sheet loss and the round wire's high-frequency resistance, both guarded
//     by a skin depth (induction.js); the cavity's Q, guarded by the skin depth
//     against the cavity (waveguide.js); the thin-wire dipole and the Friis
//     equation's far field (antenna.js).
//
//   DECLINED, with the reason as content:
//     a LOSSY LINE IN TIME. Every frequency travels at its own speed, so a step
//     spreads as it goes and there is no finite set of arrivals to schedule.
//     `refuseLossyTime` throws with that reason and `timeDomainAvailable`
//     returns it as a sentence. The same line's frequency-domain response is
//     exact at every frequency, and the message says so.
//     Oblique incidence onto a CONDUCTING medium, whose transmitted angle is
//     complex, is declined in wave.js for the same kind of reason.
//
// See /CORE_SCOPE.md. A change that adds an object to this package states which
// of the three classes it is in, in its own comment, before it is written.

export {
  C0,
  EPS0,
  ETA0,
  MU0,
  SIGMA_AL,
  SIGMA_CU,
  FieldsError,
} from './src/const.js'

export { DIM_NAMES, KINDS, describeGeometry, epsOf, hasClosedForm, labelOf, muOf } from './src/geometry.js'

export { capacitance, fieldEnergy, inductance, peakField, rcProduct, resistance } from './src/closed.js'

export { gaussLegendre, quad, quad2, quadTo, quadVec } from './src/integrate.js'

export {
  K_E,
  coulombForce,
  gaussFlux,
  lineChargeField,
  pointChargeField,
  pointChargePotential,
  ringCharges,
  ringOnAxis,
  sheetChargeField,
  traceEquipotential,
} from './src/electrostatics.js'

export {
  agreesWithin,
  capacitancePerMetre,
  chargeInside,
  conductancePerMetre,
  converge,
  energyPerMetre,
  fieldAt,
  figuresOf,
  fluxThrough,
  nodeAt,
  nodeV,
  normalIntegral,
  normalizeSpec,
  quoted,
  solveLaplace,
  staircaseFraction,
  valueAt,
} from './src/relax.js'

export {
  barResistance,
  currentDensity,
  fourPointProbe,
  pointContactPotential,
  powerDensity,
  sheetResistanceOf,
  spreadingResistance,
  squaresOf,
} from './src/conduction.js'

export {
  ampereLoop,
  biotSavart,
  circlePath,
  closePath,
  enclosedCurrent,
  loopOnAxis,
  magneticCircuit,
  segmentField,
  solenoidOnAxis,
  solenoidPath,
  toroidField,
  transformer,
  wireField,
} from './src/magnetics.js'

export {
  eddyLossSheet,
  faradayEmf,
  guardText,
  motionalEmf,
  planarCurrent,
  rotatingLoop,
  skinDepth,
  surfaceImpedance,
  wireHighFrequency,
  wireImpedance,
} from './src/induction.js'

export {
  csqrt,
  describeMedium,
  planeWave,
  polarisation,
  reflectNormal,
  reflectOblique,
  standingWave,
  standingWaveRatio,
} from './src/wave.js'

export {
  ccosh,
  csinh,
  ctanh,
  describeLine,
  gammaToZ,
  inputImpedance,
  lineAt,
  lineFromGeometry,
  lineStandingWave,
  loadFromGamma,
  normalise,
  quarterWave,
  reactanceCircle,
  reflectionCoefficient,
  refuseLossyTime,
  resistanceCircle,
  sMatrix,
  timeDomainAvailable,
  toComplex,
  towardsGenerator,
  zToGamma,
} from './src/line.js'

export { bounceDiagram, loadTrace, requireLossless, resistiveGamma, snapshot } from './src/bounce.js'

export {
  cavityQ,
  cavityResonance,
  cutoff,
  describeGuide,
  modeAt,
  modes,
  resonances,
  singleModeBand,
  te10Field,
} from './src/waveguide.js'

export {
  arrayFactor,
  cosineIntegral,
  directivityOf,
  dipole,
  dipolePattern,
  effectiveAperture,
  efficiencyOf,
  friis,
  gainOf,
  hertzianDipole,
  sineIntegral,
} from './src/antenna.js'
