// @ee-labs/grid — the power system at 60 Hz.
//
// CORE_SCOPE.md governs this package. What is here is exact for the model it
// is, and the model is always named.
//
//   Admitted exactly. Per unit, which is a change of variables and loses
//   nothing. The bus admittance matrix and every branch flow read off a solved
//   network. The symmetrical-component transform, which is a change of basis.
//   The four shunt faults, which are four closed-form connections between
//   three networks. The relay characteristics, which are definitions, and the
//   apparent impedance, which is a ratio of two exact phasors. The equal-area
//   criterion, which is one integration of the swing equation with nothing
//   dropped. Economic dispatch, whose first-order condition is exact. Every
//   one of these is presented without a hedge.
//
//   Approximated behind a guard. Two things, both labelled where they are
//   made. The DC power flow drops resistance, pins every magnitude at 1.00 pu
//   and replaces sin θ by θ; `dcFlow.js` warns past 10° and declines the flow
//   arrows past 30°, and the thresholds come from measurement. The lumped π
//   line model is replaced by the exact hyperbolic form past 250 km, and
//   `line.js` says which model is in force.
//
//   Declined. The swing equation is not linear and not a circuit, so it cannot
//   go through `packages/network`'s `dynamics`, which builds dx/dt = Ax + Bu
//   from a netlist and solves it by the matrix exponential. `swing.js` uses a
//   fixed-step RK4 of its own, names the method and the step on the pane, and
//   halves the step until the integrated peak matches the closed form.
//
// The power-flow Newton is this package's own (GRID_LAB_PLAN.md Decision 2).
// A power-flow bus and a diode are the same object with different state
// vectors: the diode linearises in real terminal voltages for `newtonDC`, and
// a bus linearises in the real pair (θ, |V|). Nothing in `packages/network` is
// edited to build this.

export { bases, zoneBases, changeBase, toPu, fromPu, loadFromPf, zipModels } from './src/perUnit.js'
export {
  LONG_LINE_KM,
  lineConstants,
  surgeLoading,
  nominalPi,
  exactPi,
  lineModel,
  openEndRise,
  reactiveBalance,
  piElements,
} from './src/line.js'
export { BUS_TYPES, networkOf, branchY, tapOf, ybus, gbOf, phasors, injections, branchFlows, lossAudit } from './src/network.js'
export { PowerFlowError, injectionsAt, busCompanion, powerFlow, jacobianCheck, pvCurve } from './src/powerFlow.js'
export { DC_WARN_DEG, DC_REFUSE_DEG, DC_RX_LIMIT, DC_V_BAND, dcFlow, dcGuard, dcCompare, assumptionCost } from './src/dcFlow.js'
export {
  A_OP,
  A2_OP,
  A_MAT,
  A_INV,
  matrixProduct,
  toSequence,
  toPhase,
  neutral,
  unbalanceFactor,
  balancedSet,
  sets,
  roundTripError,
} from './src/sequence.js'
export { FAULT_KINDS, FAULT_LABELS, ZERO_PATH, sequenceImpedances, faultStudy, faultTable, crossoverRatio } from './src/faults.js'
export {
  IEC_CURVES,
  IEEE_CURVES,
  multiple,
  iecTime,
  ieeeTime,
  definiteTime,
  curvePoints,
  coordinate,
  distanceZones,
  apparentZ,
  measuredZ,
  zoneOf,
} from './src/relay.js'
export { outputAt, costOf, incrementalOf, dispatch, marginalCost, costCurves } from './src/dispatch.js'
export { PEAK_GUARD_DEG, STEP_START, STEP_FLOOR, stability } from './src/swing.js'
export { lineToNeutral, phaseVoltages, wyeLoad, instantaneousPower, deltaToWye, wyeToDelta, deltaLoad } from './src/threePhase.js'
export { LINE_PU, lineBranch, threeBus, twoBus, fourBus, radial, FAULT_NETWORK, DISPATCH_UNITS, MACHINE, NETWORKS } from './src/library.js'
export * as cx from './src/cx.js'
