// @ee-labs/network — exact solutions of lumped circuits.
//
// Resistive networks with independent and dependent sources and ideal or
// finite-gain op-amps are solved by modified nodal analysis; the equations are
// printed from the same stamps; the theorems are computed the ways the books
// give them. Nothing here is approximate except floating point, and every
// solve returns its own KCL residual so that can be checked too.

export { GROUND, KINDS, NetworkError, normalize, connected, incident } from './src/netlist.js'
export { SingularError, solve, solveComplex, matVec } from './src/linalg.js'
export { assemble, diagnose, effective, readout, solveDC } from './src/mna.js'
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
  shockley,
  smallSignalR,
  thermalVoltage,
} from './src/diode.js'
export { assumedState, conduction, newtonDC, pnjlim, pwlTransient, solvePWL, solutionScale, vcritOf } from './src/pwl.js'

// Frequency domain: the same stamps at s = jω, phasors as [re, im].
export * as complex from './src/complex.js'
export { assembleAC, solveAC, readoutAC, sourcePhasor, phasorMeasures, acPower, drivingPointZ, sweepAC } from './src/phasor.js'
