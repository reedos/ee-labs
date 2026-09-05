// @ee-labs/photonics — the optical engine.
//
// CORE_SCOPE.md's admission test, restated where the work happens (its §"Where
// this lives" asks for exactly this comment):
//
//   Rule 1. An object goes into a package exactly, or it is guarded, or it is
//   declined with a reason. In this package the three classes are:
//
//   EXACT, and never hedged:
//     photon energy, the optical frequency, the responsivity, the cut-off
//     wavelength of a bandgap and the photon flux (photon.js); the photodiode
//     as a circuit, which @ee-labs/network solves with the same Newton
//     iteration as any other diode (photon.js); the attenuation of a length of
//     fibre and the power ratio it stands for (fibre.js); the numerical
//     aperture, the acceptance angle, the normalised frequency V, the index
//     contrast and the single-mode core diameter (fibre.js); the conversion
//     between the dispersion parameter D and the group-velocity term β₂
//     (fibre.js); the wavelength width of a frequency grid and the channel
//     count of a band (fibre.js); the optical link budget as a sum of named
//     line items (fibre.js); and the Airy transmission, the free spectral
//     range, the finesse, the linewidth, the contrast, the facet reflectance,
//     the mirror loss and the photon lifetime (cavity.js).
//
//   EXACT FOR THE MODEL THEY NAME, which the pane states:
//     the pulse spread `Δτ = D L Δλ`, which is first-order dispersion, with
//     `dispersionNote` saying what first order leaves out; and the bandwidth
//     limit, which needs a criterion, so `B σ ≤ 0.25` is an argument with a
//     default and is returned beside every limit it produces.
//
//   APPROXIMATE, and never without a guard carrying a threshold:
//     the mode count `V² / 2`, whose guard is V against twice the 2.405
//     cut-off. `modeCount` returns the verdict and the sentence with the
//     number. And the cavity linewidth as the free spectral range over the
//     finesse, which is the half-power width of the Airy peak only when the
//     round trip loses little. `linewidthGuard` compares it against the exact
//     `halfPowerWidth` and gives its verdict at a finesse of 10.
//
//   DECLINED, with the reason as content:
//     the FABRY-PEROT CAVITY AS A RATIONAL H(s). One round trip carries the
//     factor `e^{−j2βL}`, which is transcendental and has no finite poles or
//     zeros, the same reason a transmission line has none. `refuseRational`
//     throws with that reason and `rationalAvailable` returns it as a
//     sentence. The transmission itself is exact at every frequency, and the
//     message says so.
//     NONLINEAR PROPAGATION and higher-order dispersion, declined in
//     `refuseNonlinear` because each needs the propagation equation solved
//     along the fibre rather than a closed form over its length.
//
// See /CORE_SCOPE.md. A change that adds an object to this package states which
// of the four classes it is in, in its own comment, before it is written.

export {
  C0,
  EV_UM,
  H_PLANCK,
  K_B,
  M_PER_KM,
  PhotonicsError,
  Q_E,
  T_ROOM,
  dbm,
  finite,
  fraction,
  nonNegative,
  positive,
  require_,
  wattsOf,
} from './src/const.js'

export {
  bandgapOf,
  collectedPower,
  cutoffWavelength,
  darkCrossover,
  detectorCapacitance,
  detectorCorner,
  idealResponsivity,
  junctionCurrent,
  opticalFrequency,
  photodiodeNet,
  photocurrent,
  photonEnergy,
  photonEnergyEv,
  photonFlux,
  quantumEfficiencyOf,
  responsivity,
  wavelengthOf,
} from './src/photon.js'

export {
  CRITERION,
  LINK_ITEMS,
  V_CUTOFF,
  acceptanceAngle,
  bandChannels,
  bandwidthDistance,
  bandwidthLimit,
  beta2FromD,
  bindingLimit,
  dFromBeta2,
  dispersionLimitedReach,
  dispersionNote,
  gridWavelength,
  indexContrast,
  linkBudget,
  lossDb,
  lossLimitedReach,
  modeCount,
  numericalAperture,
  powerRatio,
  pulseSpread,
  ratioDb,
  refuseNonlinear,
  singleModeCore,
  throughFibre,
  vNumber,
} from './src/fibre.js'

export {
  LINEWIDTH_GUARD,
  airy,
  contrast,
  facetReflectance,
  finesse,
  freeSpectralRange,
  fsrWavelength,
  halfPowerWidth,
  linewidth,
  linewidthGuard,
  mirrorLoss,
  photonLifetime,
  rationalAvailable,
  refuseRational,
  roundTrip,
  roundTripPhase,
  spectrum,
  transmissionAt,
} from './src/cavity.js'
