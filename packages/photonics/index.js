// @ee-labs/photonics — the optical engine.
//
// CORE_SCOPE.md's admission test, restated where the work happens (its §"Where
// this lives" asks for exactly this comment):
//
//   Rule 1. An object goes into a package exactly, or it is guarded, or it is
//   declined with a reason. In this package the three classes are:
//
//   EXACT, and never hedged:
//     the photon's energy and the flux a power carries (photon.js); the
//     responsivity and the cut-off wavelength of a material (photon.js); the
//     photodiode's operating point, which is a @ee-labs/network circuit solved
//     by the same Newton iteration as any other diode (photon.js); the
//     attenuation of a length of fibre and the pulse spread D L dLambda, with
//     the conversion between D and beta_2 (fibre.js); the numerical aperture,
//     the normalised frequency V and the single-mode condition (fibre.js); the
//     channel grid and the band it fits in (fibre.js); the link budget, which
//     is a sum of stated line items (fibre.js); the Airy transmission of a
//     two-mirror cavity, its free spectral range, its finesse, its linewidth
//     and its contrast (cavity.js).
//
//   EXACT FOR A STATED CRITERION, with the criterion returned beside the
//   number so a pane can print it: the bit rate a pulse spread allows, under
//   B sigma <= 0.25 (fibre.js). A different criterion is a different number and
//   neither is more correct.
//
//   A LABELLED ESTIMATE, with `estimate: true` in its return: the mode count of
//   a large core, about V^2/2 (fibre.js).
//
//   DECLINED, with the reason as content:
//     THE CAVITY AS A RATIONAL H(s). The round trip carries the factor
//     e^(-j2betaL), which is transcendental, so no ratio of polynomials equals
//     it and no finite set of poles describes it. `refuseRational` throws with
//     that reason and `rationalAvailable` returns it as a sentence. The
//     transmission over frequency is exact at every frequency. This is the
//     transmission line's refusal, made about the other object that carries a
//     round-trip phase.
//     NONLINEAR PROPAGATION AND HIGHER-ORDER DISPERSION. Each changes the field
//     as it travels, so the answer is the propagation equation solved along the
//     fibre and not a closed form at its end. `refuseNonlinear` throws with that
//     reason.
//
//   THE SOURCES AND THE RATE EQUATIONS (source.js, rate.js), added in the
//   second sitting. Each module's own header states its classes. In short:
//   the forward junction both devices are is a @ee-labs/network circuit and is
//   exact; the LED's linear output, its one-pole bandwidth and the laser's
//   slope efficiency are exact for a stated model, and MODEL names each where
//   it is printed; the threshold and the steady state of the rate equations
//   are exact algebra; the linearisation about that steady state is an exactly
//   rational H(s) and is admitted to @ee-labs/systems without a hedge; the
//   linear answer USED AS A PREDICTION OF A LARGE STEP is guarded by a
//   modulation depth whose thresholds are measured rather than chosen; and the
//   rate equations solved in time as an answer are DECLINED, with the reason
//   diode.js gives.
//
// See /CORE_SCOPE.md. A change that adds an object to this package states which
// of the classes it is in, in its own comment, before it is written.

export {
  C0,
  H_PLANCK,
  HC_EV,
  K_B,
  PhotonicsError,
  Q_E,
  T_ROOM,
  fromDb,
  fromDbm,
  toDb,
  toDbm,
} from './src/const.js'

export {
  DEPLETION_0,
  EPS_INGAAS,
  PD_DEFAULTS,
  capPerArea,
  collectedPower,
  cutoffWavelength,
  darkEqualsLight,
  detectorArea,
  detectorSpeed,
  photocurrent,
  photodiode,
  photodiodeNet,
  photodiodeSweep,
  photonEnergy,
  photonFlux,
  quantumEfficiency,
  responsivity,
  wavelengthOf,
} from './src/photon.js'

export {
  BANDWIDTH_CRITERION,
  CRITERION_TEXT,
  V_SINGLE_MODE,
  attenuation,
  bandChannels,
  bandwidthDistance,
  bandwidthLimit,
  beta2,
  bindingLimit,
  channelGrid,
  dispersion,
  dispersionFromBeta2,
  dispersionReach,
  lengthForLoss,
  linkBudget,
  lossReach,
  modeCount,
  nonlinearAvailable,
  numericalAperture,
  powerAfter,
  refuseNonlinear,
  singleModeDiameter,
  vNumber,
} from './src/fibre.js'

export {
  airy,
  contrast,
  describeCavity,
  facetReflectance,
  finesse,
  freeSpectralRange,
  mirrorLoss,
  photonLifetime,
  rationalAvailable,
  refuseRational,
  roundTripPhase,
  sweep,
  transmissionAt,
} from './src/cavity.js'

export {
  DEPTH_DECLINE,
  DEPTH_WARN,
  LASER_CHIP,
  LASER_DEFAULTS,
  depthGuard,
  largeSignalAvailable,
  laserSpec,
  linearStep,
  modulationAt,
  modulationPhase,
  rateTerms,
  refuseLargeSignal,
  smallSignal,
  steadyState,
  stepOvershoot,
  threshold,
} from './src/rate.js'

export {
  MODEL,
  SOURCE_DEFAULTS,
  VT_ROOM,
  drive,
  driveNet,
  driveSweep,
  forwardVoltage,
  laserOutput,
  ledBandwidth,
  ledOutput,
  ledPhase,
  ledResponse,
  slopeEfficiency,
  voltsPerPhoton,
  wallPlug,
  widthInWavelength,
} from './src/source.js'
