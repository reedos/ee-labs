// @ee-labs/machines — the machine as a circuit and a rotor.
//
// CORE_SCOPE.md governs this package. What is here is exact for the model it
// is, and the model is always named:
//
//   Admitted exactly. The DC machine's two-state coupled system, and every
//   number the steady-state line gives. The ideal transformer's voltage and
//   current ratios, and the equivalent circuit around it. The induction
//   machine's per-phase phasor circuit and its torque against slip. The dq
//   transform, which is an orthogonal change of variables and loses nothing.
//   The synchronous machine's power angle and pull-out. The rotating field,
//   which is a trigonometric identity. Every one of these is a rational or
//   closed-form object with no step and no hedge.
//
//   Approximated behind a guard. Two things, both labelled where they are
//   made. Magnetic saturation is a model of a curve, and `saturation.js`
//   reports which model and refuses to be read as physics. The induction
//   machine's run-up integrates a nonlinear mechanical equation, and
//   `integrate.js` returns the error it estimates and refuses the answer when
//   that error is too large to state.
//
//   Declined. The induction machine in the dq frame with the rotor speed as a
//   state is bilinear, so it is not a linear state space and not a transfer
//   function. `induction.js` says so where a reader would ask, and gives the
//   quasi-static run-up instead, which is a different object and is labelled
//   one.
//
// Nothing in this package edits @ee-labs/network. The coupling that a machine
// needs and MNA does not have — a source controlled by a current — is built
// out of the stamps that exist, exactly, in port.js.

export { MECH, rpmToRad, radToRpm, senseBranch, shaft } from './src/port.js'
export { DC_DEFAULTS, dcOf, dcNetlist, line, operating, timeConstants, control, powerAudit } from './src/dc.js'
export {
  IDEAL_SENSE,
  idealTransformer,
  TRANSFORMER_DEFAULTS,
  transformerOf,
  transformerNetlist,
  reflected,
  openShort,
  regulation,
  transformerEfficiency,
} from './src/transformer.js'
export {
  IM_DEFAULTS,
  imOf,
  perPhase,
  imThevenin,
  torqueOfSlip,
  breakdown,
  torqueCurve,
  slipFor,
  imOperating,
  runUp,
  rotorResistanceFor,
} from './src/induction.js'
export {
  CONVENTIONS,
  clarke,
  invClarke,
  park,
  invPark,
  dq0,
  invDq0,
  dqMatrix,
  power,
  rotatingField,
  fieldAt,
} from './src/dq.js'
export {
  SYNC_DEFAULTS,
  REACTANCES,
  syncOf,
  reactance,
  internalEmf,
  swing,
  syncPhasor,
  powerAngle,
  pullOut,
  syncCurve,
  PMSM_DEFAULTS,
  pmsmOf,
  pmsmState,
  pmsmTorque,
  focPlant,
} from './src/sync.js'
export { LOSS_DEFAULTS, lossesOf, lossSplit, efficiencyCurve, bestEfficiency, thermal, thermalNetlist } from './src/losses.js'
export { SATURATION_MODELS, saturationOf, saturate, saturationLabel } from './src/saturation.js'
export { rk4, integrate, INTEGRATOR_GUARD } from './src/integrate.js'
