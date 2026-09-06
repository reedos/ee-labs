// @ee-labs/rf — the radio front end, exact at every frequency.
//
// CORE_SCOPE.md's admission test, restated where the work happens (its §"Where
// this lives" asks for exactly this comment). Every object in this package is
// in one of three classes, and a change that adds an object says which class it
// is in, in its own comment, before it is written.
//
//   EXACT, and never hedged:
//     the S-matrix of a lumped linear circuit at one frequency, read off two
//     exact AC solves (sparam.js); the conversions between S, Z, Y and ABCD,
//     each a closed form on two-by-two complex matrices (convert.js); the
//     cascade of two two-ports, by the matrix product and by the closed
//     composition (cascade.js); the Smith chart's families, which are the
//     images of lines and circles under a Möbius map (smith.js); the uniform
//     line's chain matrix at a frequency, in complex hyperbolic functions
//     (line.js); the L network and the quarter-wave transformer, which are two
//     equations in two unknowns solved in closed form (match.js).
//
//   APPROXIMATE, and never without a guard carrying a threshold:
//     nothing yet. The unilateral approximation, the third-order
//     extrapolation of IP3 and Leeson's phase-noise model arrive with their
//     own guards in later phases, and the plan states each threshold.
//
//   DECLINED, with the reason as content:
//     the line as a rational H(s). e^(-gamma l) is transcendental, with no
//     finite poles and no finite zeros, so no ratio of polynomials equals it
//     at any order. `refuseRational` throws with that reason and
//     `rationalAvailable` returns it as a sentence. The same line's frequency
//     response is exact at every frequency, and `sweepLine` computes it.
//     A conversion whose matrix has no inverse is declined by name rather
//     than returned as a large number: an ideal transformer has a finite
//     S-matrix and no Z-matrix, and the message says which description is the
//     one it does not have.
//
// See /CORE_SCOPE.md and /RF_LAB_PLAN.md §2.2, which is this table object by
// object.

export { RfError, dB, deg, fromDb, nonNegative, positive, rad, require_ } from './src/const.js'

export {
  abcdToS,
  eye2,
  madd,
  mdagger,
  mdet,
  mdiff,
  minv,
  mmul,
  mnorm,
  mscale,
  msub,
  sToAbcd,
  sToY,
  sToZ,
  yToS,
  yToZ,
  zToS,
  zToY,
} from './src/convert.js'

export {
  dissipated,
  entryOf,
  fromPolarDeg,
  gammaFromVswr,
  largestSingular,
  loadFrom,
  mismatch,
  mismatchLossDb,
  reciprocityError,
  reflection,
  returnLossDb,
  s11FromNetlist,
  sDiff,
  sFromNetlist,
  sparam,
  toComplex,
  unitarityError,
  vswr,
} from './src/sparam.js'

export {
  abcdToSparam,
  cascadeAbcd,
  cascadeS,
  chainAbcd,
  chainS,
  chainViaAbcd,
  elementAbcd,
  seriesAbcd,
  shuntAbcd,
  sparamToAbcd,
  transformerAbcd,
} from './src/cascade.js'

export {
  CHART_R,
  CHART_X,
  chartFamilies,
  circleError,
  circlePoints,
  conductanceCircle,
  denormalise,
  gammaToZ,
  lineLocus,
  meetsUnitDisc,
  normalise,
  onCircle,
  place,
  qArc,
  qOf,
  reactanceCircle,
  resistanceCircle,
  susceptanceCircle,
  towardsGenerator,
  vswrCircle,
  zToGamma,
} from './src/smith.js'

export {
  C0,
  NP_TO_DB,
  dbPerMetre,
  describeLine,
  electricalLength,
  inputImpedance,
  lineAbcd,
  lineAt,
  lineSparam,
  npPerMetre,
  phaseVelocity,
  quarterWaveZ0,
  rationalAvailable,
  refuseRational,
  repeatFrequency,
  standingWave,
  sweepLine,
  uniformLine,
} from './src/line.js'

export {
  bandwidthOf,
  elementAbcdOf,
  elementFor,
  inputZ,
  lMatch,
  lSolutions,
  loadedQBandwidth,
  matchAt,
  matchBandwidth,
  matchMag,
  matchNetlist,
  matchPath,
  matchQ,
  networkAbcd,
  quarterWaveMatch,
  quarterWaveRepeats,
  reactanceOf,
  sweepMatch,
  sweepQuarterWave,
  transformerPath,
} from './src/match.js'
