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
export { equations, matrixLatex, diffSym, vSym, iSym, fmtCell } from './src/equations.js'
export { thevenin, superposition, loadSweep, killed, withElements, lineFit, sourcePower } from './src/theorems.js'
