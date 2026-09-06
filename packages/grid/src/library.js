// The networks every experiment runs on, with fixed names.
//
// Bus names are fixed so that a lesson's readings, a layout and a test all
// name the same bus. Every impedance is per unit on 100 MVA and 230 kV, and
// GRID_LAB_PLAN.md §4.3 is where the numbers come from: the line is
// 0.05 + j0.40 Ω/km with 3.0 µS/km of charging, which is 0.01 + j0.08 pu and
// 0.08 pu of shunt at each end per 100 km.
//
// Each network carries bus positions on a small grid, in the idiom
// `packages/ui/src/schematicGeometry.js` uses, so the one-line canvas draws
// the network the solver solved.

import { networkOf } from './network.js'

/** Per unit per 100 km of the reference line, rounded as the library rounds it. */
export const LINE_PU = { r: 0.01, x: 0.08, b: 0.16 }

/** A branch of `km` kilometres of the reference line. */
export const lineBranch = (id, from, to, km, over = {}) => ({
  id,
  from,
  to,
  km,
  r: (LINE_PU.r * km) / 100,
  x: (LINE_PU.x * km) / 100,
  b: (LINE_PU.b * km) / 100,
  ...over,
})

/**
 * The three-bus system: a slack, a generator holding its voltage, and a load.
 *
 * Bus 1 is the slack at 1.00∠0. Bus 2 is a PV bus at 1.00 pu generating
 * 0.60 pu. Bus 3 is a PQ bus taking 1.60 + j0.80 pu. The branches are 100,
 * 150 and 80 km of the reference line.
 */
export function threeBus({ load = 1, gen = null, Qmax = Infinity, Qmin = -Infinity, V2 = 1 } = {}) {
  // The loading knob moves the generation with the load, so that raising it
  // loads the network rather than pushing the whole increase onto the slack.
  // GRID_LAB_PLAN.md §2.7's five-loading table is measured that way.
  const P2 = gen === null ? 0.6 * load : gen
  return networkOf({
    name: 'Three buses',
    baseMVA: 100,
    baseKV: 230,
    buses: [
      { id: 'bus1', name: 'Bus 1', type: 'slack', V: 1, x: 60, y: 40 },
      { id: 'bus2', name: 'Bus 2', type: 'pv', V: V2, P: P2, Qmin, Qmax, x: 300, y: 40 },
      { id: 'bus3', name: 'Bus 3', type: 'pq', P: -1.6 * load, Q: -0.8 * load, x: 180, y: 170 },
    ],
    branches: [lineBranch('br12', 'bus1', 'bus2', 100), lineBranch('br13', 'bus1', 'bus3', 150), lineBranch('br23', 'bus2', 'bus3', 80)],
  })
}

/**
 * A two-bus radial network: one source, one transformer reactance, one load.
 * C4's voltage drop, its tap and its shunt compensation all run on this.
 */
export function twoBus({ x = 0.1, P = 0.8, Q = 0.6, tap = 1, Bsh = 0 } = {}) {
  return networkOf({
    name: 'Two buses',
    baseMVA: 100,
    baseKV: 230,
    buses: [
      { id: 'send', name: 'Sending', type: 'slack', V: 1, x: 60, y: 100 },
      { id: 'recv', name: 'Receiving', type: 'pq', P: -P, Q: -Q, B: Bsh, x: 300, y: 100 },
    ],
    branches: [{ id: 'tx', from: 'send', to: 'recv', r: 0, x, b: 0, tap, transformer: true }],
  })
}

/**
 * The four-bus loop, for the fuzz and for a network with a branch whose
 * resistance exceeds its reactance. Two generators, two loads, one loop.
 */
export function fourBus({ load = 1 } = {}) {
  return networkOf({
    name: 'Four buses',
    baseMVA: 100,
    baseKV: 230,
    buses: [
      { id: 'bus1', name: 'Bus 1', type: 'slack', V: 1.02, x: 60, y: 40 },
      { id: 'bus2', name: 'Bus 2', type: 'pv', V: 1.01, P: 0.9, Qmin: -1, Qmax: 1.2, x: 320, y: 40 },
      { id: 'bus3', name: 'Bus 3', type: 'pq', P: -1.2 * load, Q: -0.5 * load, x: 320, y: 180 },
      { id: 'bus4', name: 'Bus 4', type: 'pq', P: -0.9 * load, Q: -0.4 * load, x: 60, y: 180 },
    ],
    branches: [
      lineBranch('br12', 'bus1', 'bus2', 120),
      lineBranch('br23', 'bus2', 'bus3', 90),
      lineBranch('br34', 'bus3', 'bus4', 110),
      lineBranch('br14', 'bus1', 'bus4', 140),
    ],
  })
}

/**
 * A radial feeder with no loop at all, which is the hostile corner the fuzz
 * needs: every branch carries the whole downstream load and there is one path
 * to the slack.
 */
export function radial({ load = 1 } = {}) {
  return networkOf({
    name: 'A radial feeder',
    baseMVA: 100,
    baseKV: 230,
    buses: [
      { id: 'bus1', name: 'Bus 1', type: 'slack', V: 1, x: 40, y: 100 },
      { id: 'bus2', name: 'Bus 2', type: 'pq', P: -0.4 * load, Q: -0.2 * load, x: 160, y: 100 },
      { id: 'bus3', name: 'Bus 3', type: 'pq', P: -0.5 * load, Q: -0.25 * load, x: 280, y: 100 },
      { id: 'bus4', name: 'Bus 4', type: 'pq', P: 0, Q: 0, x: 400, y: 100 },
    ],
    branches: [lineBranch('br12', 'bus1', 'bus2', 60), lineBranch('br23', 'bus2', 'bus3', 60), lineBranch('br34', 'bus3', 'bus4', 60)],
  })
}

/**
 * The fault network of §4.3: a generator behind its reactances, a delta to
 * grounded-wye transformer, and a line. Every entry is a reactance in per
 * unit, and the winding connection is what decides the zero-sequence path.
 */
export const FAULT_NETWORK = {
  generator: { X1: 0.15, X2: 0.15, X0: 0.05, Zn: 0 },
  transformer: { X: 0.1, connection: 'delta-wyeg' },
  line: { X1: 0.2, X2: 0.2, X0: 0.6 },
  prefault: 1,
}

/** The three units J1 and J2 dispatch, with their quadratic costs. */
export const DISPATCH_UNITS = [
  { id: 'unit1', name: 'Unit 1', a: 500, b: 5.3, c: 0.004, min: 100, max: 600 },
  { id: 'unit2', name: 'Unit 2', a: 400, b: 5.5, c: 0.006, min: 50, max: 400 },
  { id: 'unit3', name: 'Unit 3', a: 200, b: 5.8, c: 0.009, min: 50, max: 300 },
]

/** The machine of §4.3, in the Machines Lab's own spec shape. */
export const MACHINE = { f: 60, H: 4, Pm: 1, Xdp: 0.3, Xdpp: 0.2, X2: 0.2, X0: 0.05 }

/** The library, by name, for the app's network picker. */
export const NETWORKS = {
  threeBus,
  twoBus,
  fourBus,
  radial,
}
