// @ee-labs/rf — the radio front end, exact at every frequency.
//
// CORE_SCOPE.md's admission test, restated where the work happens (its "Where
// this lives" section asks for exactly this comment):
//
//   Rule 1. An object goes into a package exactly, or it is guarded with a
//   threshold, or it is declined with a reason. In this package the three
//   classes are:
//
//   EXACT, and never hedged:
//     the scattering matrix of a lumped linear circuit at one frequency, read
//     off two exact AC solves (sparam.js); the conversions between S, Z, Y and
//     ABCD, each a bilinear map on two by two complex matrices (convert.js);
//     the two ways of cascading two-ports, the ABCD product and the closed S
//     composition (cascade.js); the Smith chart's circle families, which are
//     the image of a line or a circle under a Mobius map (smith.js); the
//     uniform line's ABCD matrix at any one frequency, lossy or not (line.js,
//     on the Fields Lab's derivation).
//
//   APPROXIMATE, and never without a guard carrying a threshold:
//     nothing in this sitting. The unilateral approximation, the IP3
//     extrapolation and Leeson's model arrive with stability.js, linearity.js
//     and leeson.js, each with the threshold RF_LAB_PLAN.md §2.2 states.
//
//   DECLINED, with the reason as content:
//     THE LINE AS A RATIONAL H(s). The factor e^(-gamma l) is transcendental.
//     It has no finite poles and no finite zeros, so no ratio of polynomials
//     equals it. `refuseRational` throws with that reason and
//     `rationalAvailable` returns it as a sentence. The same line's response is
//     exact at every single frequency, and the message says so.
//     A CONVERSION THROUGH A SINGULAR MATRIX. An ideal transformer has no
//     Z-matrix and a finite S-matrix, and `minv` names the determinant rather
//     than returning a large number.
//     A CASCADE THROUGH A LOSSLESS RESONANCE. When A22 B11 = 1 the wave
//     between two mismatched ports never dies, and `cascadeS` says so.
//
// See /CORE_SCOPE.md. A change that adds an object to this package states which
// of the three classes it is in, in its own comment, before it is written.

export {
  RfError,
  angleDeg,
  fromEntries,
  fromPolar,
  gammaFromNetlist,
  magDb,
  maxSingularValue,
  mismatch,
  mismatchLossDb,
  onePort,
  polarDeg,
  powerBalance,
  reciprocityError,
  reflection,
  require_,
  returnLossDb,
  sFromNetlist,
  toC,
  twoPort,
  unitarityError,
  vswr,
} from './src/sparam.js'

export {
  abcdToS,
  abcdToY,
  abcdToZ,
  asRecord,
  eye2,
  m2,
  madd,
  matrixOf,
  mdet,
  minv,
  mmul,
  mnorm,
  mscale,
  msub,
  roundTrip,
  sToAbcd,
  sToY,
  sToZ,
  yToAbcd,
  yToS,
  yToZ,
  zToAbcd,
  zToS,
  zToY,
} from './src/convert.js'

export {
  cascade,
  cascadeAbcd,
  cascadeByAbcd,
  cascadeS,
  gammaIn,
  gammaOut,
  seriesTwoPort,
  shuntTwoPort,
  transformerTwoPort,
} from './src/cascade.js'

export {
  R_GRID,
  X_GRID,
  arcPoints,
  chart,
  conductanceCircle,
  gammaOfY,
  gammaToZ,
  impedanceAt,
  inWavelengths,
  magnitudeCircle,
  markerAt,
  normalise,
  onCircle,
  pathTowardsGenerator,
  pointOn,
  qArc,
  qOf,
  reactanceCircle,
  resistanceCircle,
  standingWaveRatio,
  susceptanceCircle,
  towardsGenerator,
  turnDegrees,
  vswrCircle,
  zToGamma,
} from './src/smith.js'

export {
  describeLine,
  inputImpedance,
  lineAbcd,
  lineAt,
  lineStandingWave,
  lineTwoPort,
  rationalAvailable,
  refuseRational,
  sweepLine,
} from './src/line.js'
