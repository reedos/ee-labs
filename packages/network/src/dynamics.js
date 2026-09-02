// From netlist to state space, exactly.
//
// Replace every capacitor by a voltage source at its voltage v_C and every
// inductor by a current source at its current i_L. What is left is resistive,
// so one MNA solve gives each capacitor's current and each inductor's voltage
// as linear functions of the states x and the source values u:
//
//     dv_C/dt = i_C / C,   di_L/dt = v_L / L   ⇒   dx/dt = A x + B u.
//
// That is the substitution theorem, and it is exact. A and B are read off by
// solving with one state (or one source) set to 1 and everything else 0 — a
// column at a time — and every other quantity in the circuit (node voltages,
// element currents, powers) comes from the same resistive solve at (x, u), so
// the schematic at time t is the resistive circuit at time t.

import { NetworkError, connected, incident, normalize } from './netlist.js'
import { assemble, diagnose, readout, solveDC } from './mna.js'
import { SingularError, solve } from './linalg.js'
import { zeros } from './expm.js'
import { sourceBefore as sourceBeforeOf } from './waves.js'

const isState = (e) => e.type === 'C' || e.type === 'L'
const isInput = (e) => e.type === 'V' || e.type === 'I'

/**
 * Re-explain a resistive refusal in the language of the dynamic circuit it
 * came from: the singular cases of the substituted network are the degenerate
 * dynamic circuits — a capacitor whose voltage is dictated, an inductor whose
 * current has nowhere to go.
 */
function rewrap(err, norm, opts) {
  if (!(err instanceof NetworkError)) return err
  if (err.code === 'source-loop' || err.code === 'singular') {
    const caps = norm.elements.filter((e) => e.type === 'C')
    const cap = caps.find((c) => c.id === err.detail.element) || caps[0]
    if (cap)
      return new NetworkError(
        'state-loop',
        `${cap.id} sits in a loop of voltage sources (or other capacitors) with no resistance in it, so its voltage is dictated rather than free: it cannot be a state. Its current would be C·dv/dt of the source itself — infinite at any step. Every real source has some series resistance; put it in.`,
        { element: cap.id, cause: err },
      )
  }
  if (err.code === 'current-cutset') {
    const ind = incident(norm, err.detail.node).find((e) => e.type === 'L')
    if (ind)
      return new NetworkError(
        'inductor-cutset',
        `${ind.id} carries a current with nowhere to go — the path through it is open. An inductor's current cannot change instantly, so di/dt → −∞ and the voltage across it is unbounded. That is the spark across an opening switch. Give the switch a finite off-resistance and the spike gets a number.`,
        { element: ind.id, node: err.detail.node, cause: err },
      )
  }
  return err
}

/**
 * The state-space description of a netlist: which elements are states, which
 * sources are inputs, the matrices A and B, and `solveAt(x, u)` — the full
 * resistive readout with the states and sources at those values. `opts` are
 * passed to the solver (switch states, for the post-switch circuit).
 */
export function dynamics(net, opts = {}) {
  const norm = net.nodeNames ? net : normalize(net)
  const states = norm.elements.filter(isState).map((e) => ({ id: e.id, type: e.type, value: e.value, x0: e.x0 }))
  for (const s of states) if (!(s.value > 0)) throw new NetworkError('value', `${s.id}: a ${s.type === 'C' ? 'capacitance' : 'inductance'} must be positive`)
  const inputs = norm.elements.filter(isInput).map((e) => e.id)
  const n = states.length
  const m = inputs.length

  const solverOpts = (x, u) => {
    const st = {}
    states.forEach((s, k) => (st[s.id] = x[k]))
    const src = {}
    inputs.forEach((id, k) => (src[id] = u[k]))
    return { ...opts, states: st, sources: src }
  }

  // Structure first, once: the diagnosis does not depend on the values.
  const zero = solverOpts(new Array(n).fill(0), new Array(m).fill(0))
  const why = diagnose(norm, zero)
  if (why) throw rewrap(why, norm, opts)
  const sys0 = assemble(norm, zero)
  try {
    solve(sys0.M, sys0.r)
  } catch (err) {
    if (err instanceof SingularError)
      throw rewrap(
        new NetworkError('singular', 'These equations have no unique solution: some voltage or current is left undetermined by the circuit as drawn.', {
          pivot: err.pivot,
        }),
        norm,
        opts,
      )
    throw err
  }

  /** The resistive circuit at (x, u): node voltages, element currents, powers. */
  const solveAt = (x, u) => {
    const o = solverOpts(x, u)
    const sys = assemble(norm, o)
    return readout(norm, sys, solve(sys.M, sys.r))
  }
  /** dx/dt read from a solve: i_C / C and v_L / L, passive sign convention. */
  const derivOf = (sol) => states.map((s) => (s.type === 'C' ? sol.i[s.id] / s.value : sol.volt[s.id] / s.value))

  const A = zeros(n, n)
  const B = zeros(n, m)
  const ex = (len, k) => {
    const v = new Array(len).fill(0)
    v[k] = 1
    return v
  }
  for (let k = 0; k < n; k++) {
    const col = derivOf(solveAt(ex(n, k), new Array(m).fill(0)))
    for (let i = 0; i < n; i++) A[i][k] = col[i]
  }
  for (let j = 0; j < m; j++) {
    const col = derivOf(solveAt(new Array(n).fill(0), ex(m, j)))
    for (let i = 0; i < n; i++) B[i][j] = col[i]
  }

  /** Energy stored in the reactive elements at state x: ½Cv² and ½Li². */
  const stored = (x) => states.map((s, k) => 0.5 * s.value * x[k] * x[k])

  return { norm, states, inputs, n, m, A, B, solveAt, derivOf, stored, opts }
}

/**
 * The state just before t = 0: switches in their `before` position, sources
 * at their pre-step values, capacitors open and inductors shorted (the DC
 * picture) — except a state whose element declares `x0`, which is taken as
 * given and substituted, so a pre-charged capacitor behind an open switch has
 * a voltage even though no DC solve could find one for it.
 */
export function initialConditions(net, opts = {}) {
  const norm = net.nodeNames ? net : normalize(net)
  const switches = { ...(opts.switches || {}) }
  for (const e of norm.elements)
    if (e.type === 'SW' && !(e.id in switches)) switches[e.id] = e.before !== undefined ? !!e.before : e.closed !== false
  const sources = {}
  for (const e of norm.elements) if (isInput(e)) sources[e.id] = sourceBeforeOf(e)
  const fixed = {}
  for (const e of norm.elements) if (isState(e) && Number.isFinite(e.x0)) fixed[e.id] = e.x0
  const assumed = []
  let sol
  for (;;) {
    try {
      sol = solveDC(norm, { ...opts, switches, sources, states: fixed })
      break
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err
      // A node with no DC path to ground before the switch — a capacitor
      // behind an open switch — is the ordinary case of a capacitor nobody
      // has charged: take it as uncharged, and say so.
      if (err.code === 'floating') {
        // Every unfixed capacitor in the island the floating node belongs to
        // (reachable through anything the DC picture does not open).
        const isOpen = (e) => e.type === 'C' || (e.type === 'SW' && !switches[e.id] && !(e.roff > 0))
        const caps = norm.elements.filter(
          (e) => e.type === 'C' && !(e.id in fixed) && e.nodes.some((nd) => nd === err.detail.node || connected(norm, err.detail.node, nd, (q) => !isOpen(q))),
        )
        if (caps.length) {
          for (const c of caps) {
            fixed[c.id] = 0
            assumed.push(c.id)
          }
          continue
        }
      }
      throw new NetworkError(
        'before',
        `Before t = 0 the circuit has no DC solution: ${err.message} Give the element an initial value instead.`,
        { cause: err },
      )
    }
  }
  const x0 = norm.elements.filter(isState).map((e) => (e.id in fixed ? fixed[e.id] : e.type === 'C' ? sol.volt[e.id] : sol.i[e.id]))
  return { x0, sol, switches, sources, assumed }
}
