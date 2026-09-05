// @ee-labs/network — exact solutions of lumped circuits.
//
// Resistive networks with independent and dependent sources and ideal or
// finite-gain op-amps are solved by modified nodal analysis; the equations are
// printed from the same stamps; the theorems are computed the ways the books
// give them. Nothing here is approximate except floating point, and every
// solve returns its own KCL residual so that can be checked too.

export { GROUND, KINDS, NetworkError, normalize, connected, incident } from './src/netlist.js'
export { SingularError, solve, solveComplex, matVec } from './src/linalg.js'
export { assemble, diagnose, effective, readout, solveDC, stampsOf } from './src/mna.js'
export { equations, matrixLatex, symbolicSystem, symbolicMatrixLatex, cellLatex, diffSym, vSym, iSym, fmtCell } from './src/equations.js'
export { thevenin, superposition, loadSweep, killed, withElements, lineFit, sourcePower } from './src/theorems.js'

// Time domain: capacitors and inductors as states, solved exactly.
export { expm, expm2, charPoly, matMul, matVecMul, zeros, eye } from './src/expm.js'
export { sourceBefore, sourceValue, sourceAffine, sourceBreaks, allBreaks, omegaOf, pieceValue } from './src/waves.js'
export { dynamics, initialConditions } from './src/dynamics.js'
export { transient, energies, bisect, crossings, extrema, meanRms, refineExtremum, settleTime } from './src/transient.js'

// Piecewise-linear: the diode in four models, the op-amp's rails, and the
// three ways a region is decided — assumed state, Newton, events in time.
export {
  DIODE_DEFAULTS,
  DIODE_MODELS,
  K_B,
  Q_E,
  T_ROOM,
  VT,
  decadeSlope,
  diodeCurrent,
  diodeOf,
  flipTo,
  forwardDrop,
  regionDevices,
  regionEffective,
  regionLabel,
  regionMargins,
  regionsOf,
  restingRegion,
  shockley,
  smallSignalR,
  thermalVoltage,
} from './src/diode.js'
export { assumedState, conduction, newtonDC, GMIN, pnjlim, pwlTransient, solvePWL, solutionScale, vcritOf } from './src/pwl.js'

// The two transistors, and the companion interface Newton iterates over.
export { BJT_DEFAULTS, BJT_MODELS, BJT_REGIONS, bjtCompanion, bjtCurrents, bjtOf, bjtSlopes } from './src/bjt.js'
export { MOSFET_DEFAULTS, MOSFET_MODELS, mosfetCompanion, mosfetCurrent, mosfetOf } from './src/mosfet.js'
export {
  companion,
  companionElements,
  controlsOf,
  guessFor,
  hasCompanion,
  operatingPoint,
  readControls,
  stampCurrents,
  terminalLaw,
} from './src/companion.js'
export { limitTo, vcrit } from './src/physics.js'

// Linearisation is a netlist, and a linear netlist has exact polynomials.
export { AMPLITUDE_GUARD, amplitudeCheck, hd2Estimate, isSignal, labelOf, pointsOf, smallSignal } from './src/smallSignal.js'
export { CHECK_BAND, CHECK_POINTS, CHECK_TOL, compare, corners, evalTF, polesOf, readOutput, readOutputAC, rootsOf, transferOf, zerosOf } from './src/transfer.js'
export { blackman, marginsOf, returnRatio, returnRatioAt } from './src/loop.js'

// Macros: one element that stands for several. The op-amp with a speed, a slew
// rate, an offset, a bias current and an output current limit expands into
// elements this package already stamps, at normalize, before anything solves.
export { expandMacros, expandOpAmp, isMacro, MACRO_FIELDS } from './src/macro.js'

// Noise: the two densities that are physics, the third that is a datasheet
// fact, and the sum of what each of them makes of the output.
export {
  firstOrderFraction,
  flickerCurrent,
  ktOverC,
  noiseBandwidth,
  noiseDensity,
  noiseRms,
  noiseSources,
  perRootHz,
  shotCurrent,
  thermalCurrent,
  thermalVoltageDensity,
} from './src/noise.js'

// The junction: where the exponential, the two capacitances and the
// temperature law come from, as closed forms rather than datasheet facts.
export {
  EG_SI,
  EPS_0,
  EPS_SI,
  N_I_300,
  builtIn,
  depletionWidth,
  diffusionCap,
  doubling,
  isAt,
  junctionCap,
  niAt,
  transitFreq,
  transitLimit,
  vbeSlope,
} from './src/junction.js'

// Frequency domain: the same stamps at s = jω, phasors as [re, im].
export * as complex from './src/complex.js'
export { assembleAC, solveAC, readoutAC, sourcePhasor, phasorMeasures, acPower, drivingPointZ, sweepAC } from './src/phasor.js'
