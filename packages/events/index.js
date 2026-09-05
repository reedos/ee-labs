// Discrete events with exact delays, and no continuous state between them.
//
// This is the switched-converter engine's event idea with the differential
// equations taken out. `@ee-labs/switched` propagates a state vector between
// switching instants because a converter's inductor keeps moving between them.
// A gate does not. Between two events every signal in a logic netlist holds
// its value, so there is nothing to propagate and the whole waveform is the
// list of instants at which something changed.
//
// The admission test, from CORE_SCOPE.md Rule 1, restated for this package:
//
//   An object goes in here only if it is a **finite-valued signal whose whole
//   history is a finite list of transitions at whole picoseconds.** A gate
//   with a propagation delay qualifies, and every answer about it is exact.
//
// Declined, with the reason, rather than approximated:
//
//   - A rise time. A transition here takes no time; a signal that spends time
//     between the levels is the Electronics Lab's transfer characteristic and
//     the VLSI Lab's Elmore delay, not this engine's.
//   - A voltage. There are two values, and the noise margins that separate
//     them are Electronics D6, which is not built.
//   - Metastability as a waveform. What a flip-flop does when its setup time
//     is violated is not a finite list of transitions. `metastability.js`
//     gives the standard rate model, labelled, with its parameters printed
//     and its assumptions listed (CORE_SCOPE Rule 3).
//
// Both delay models the package ships are exact, and each is labelled where it
// is used. Transport delay passes a pulse of any width and is what shows a
// hazard. Inertial delay rejects a pulse shorter than the gate's own delay and
// is what a real cell does. Neither is an approximation of the other, and the
// waveform pane says which one produced the picture.

export { PS, ns, seconds, KINDS, KIND_ORDER, WIRE_DELAY, FLOP, libDelay, evalKind } from './src/library.js'
export { EventsError, normalize, topoOrder, findLoop } from './src/netlist.js'
export { EventQueue } from './src/queue.js'
export { initialValue, transitions } from './src/sources.js'
export { simulate, relax, valueAt, edgesOf } from './src/simulate.js'
export { evaluate, truthTable, pulsesOf, hazardOf, timingPaths, criticalPath, fMax } from './src/analyse.js'
export { grayOrder, cubeMinterms, literals, primeImplicants, minimalCover, expressionOf, netFromCover } from './src/boolean.js'
export { META, mtbf, settlingFor, synchroniser } from './src/metastability.js'
export {
  oneGate,
  nandOnly,
  hazardNet,
  mux2,
  decoder24,
  halfAdder,
  fullAdder,
  rippleGates,
  rippleAdder,
  srLatch,
  dLatch,
  masterSlave,
  onePath,
  pipelinedAdder,
  ring,
  counter,
  fsmTable,
  fsmEquations,
  fsmNet,
} from './src/build.js'
