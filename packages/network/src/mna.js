// Modified nodal analysis.
//
// Unknowns are the node voltages (ground removed) followed by one current per
// element that has no admittance form — voltage sources, dependent voltage
// sources, op-amp outputs, inductors at DC. Each element adds its "stamp" to
// the matrix; the assembled system M x = r is then one LU solve.
//
// The stamps ARE the equations the reader is shown (equations.js walks the same
// rules to print them), so the solver and the printer cannot drift apart. What
// keeps them honest is the residual: after solving, every element's current is
// recomputed from its own law and summed at every node, and that sum has to be
// zero. KCL is checked, not assumed.

import { GROUND, KINDS, NetworkError, connected, incident, normalize } from './netlist.js'
import { SingularError, solve } from './linalg.js'

/**
 * How a capacitor or inductor is treated in this solve.
 *   dc:      C is an open circuit, L a short — the t → ∞ picture.
 *   states:  C is a voltage source at its state value, L a current source at
 *            its — the substitution that turns one resistive solve into the
 *            state derivatives (see state.js).
 */
function reactive(e, opts) {
  if (opts.states && e.id in opts.states) {
    if (e.type === 'C') return { type: 'V', value: opts.states[e.id] }
    if (e.type === 'L') return { type: 'I', value: opts.states[e.id] }
  }
  if (e.type === 'C') return { type: 'OPEN' }
  if (e.type === 'L') return { type: 'V', value: 0 }
  return null
}

/**
 * The effective element for stamping: switches become shorts, opens or
 * resistors; reactive elements follow `reactive`; a finite-gain op-amp is a
 * VCVS. Returns { type, value, gain, nodes, ctrl }.
 */
export function effective(e, opts = {}) {
  if (e.type === 'SW') {
    const closed = opts.switches && e.id in opts.switches ? opts.switches[e.id] : e.closed !== false
    if (closed) return e.ron > 0 ? { ...e, type: 'R', value: e.ron } : { ...e, type: 'V', value: 0 }
    return Number.isFinite(e.roff) && e.roff > 0 ? { ...e, type: 'R', value: e.roff } : { ...e, type: 'OPEN' }
  }
  const r = reactive(e, opts)
  if (r) return { ...e, ...r }
  if (e.type === 'OPAMP' && Number.isFinite(e.gain)) {
    return { ...e, type: 'VCVS', nodes: [e.nodes[0], GROUND], gain: e.gain }
  }
  // A source's value at some instant, for the time-domain engine.
  if ((e.type === 'V' || e.type === 'I') && opts.sources && e.id in opts.sources) return { ...e, value: opts.sources[e.id] }
  // A resistor of exactly zero ohms is a wire: it fixes a voltage difference of
  // zero and its current becomes an unknown, the way a 0 V source's does. The
  // undamped LC (R = 0) is a real circuit and gets solved as one.
  if (e.type === 'R' && e.value === 0) return { ...e, type: 'V', value: 0, wire: true }
  return e
}

const needsCurrent = (eff) => eff.type === 'V' || eff.type === 'VCVS' || eff.type === 'OPAMP'

/** Assemble M x = r for the normalised netlist. */
export function assemble(norm, opts = {}) {
  const effs = norm.elements.map((e) => effective(e, opts))
  const currentIdx = new Map()
  let m = norm.n
  for (const eff of effs) if (needsCurrent(eff)) currentIdx.set(eff.id, m++)
  const M = Array.from({ length: m }, () => new Array(m).fill(0))
  const r = new Array(m).fill(0)
  const ix = (node) => norm.index.get(node)
  const addG = (a, b, g) => {
    const ia = ix(a)
    const ib = ix(b)
    if (ia >= 0) M[ia][ia] += g
    if (ib >= 0) M[ib][ib] += g
    if (ia >= 0 && ib >= 0) {
      M[ia][ib] -= g
      M[ib][ia] -= g
    }
  }
  const inject = (node, I) => {
    const k = ix(node)
    if (k >= 0) r[k] += I
  }
  // A current j leaving node a into the element and re-entering at node b.
  const branch = (row, a, b) => {
    const ia = ix(a)
    const ib = ix(b)
    if (ia >= 0) {
      M[ia][row] += 1
      M[row][ia] += 1
    }
    if (ib >= 0) {
      M[ib][row] -= 1
      M[row][ib] -= 1
    }
  }

  for (const eff of effs) {
    const [a, b] = eff.nodes
    switch (eff.type) {
      case 'OPEN':
        break
      case 'R':
        if (!(eff.value > 0)) throw new NetworkError('value', `${eff.id}: a resistor needs a positive resistance`)
        addG(a, b, 1 / eff.value)
        break
      case 'I':
        inject(a, -eff.value)
        inject(b, eff.value)
        break
      case 'V': {
        const row = currentIdx.get(eff.id)
        branch(row, a, b)
        r[row] = eff.value
        break
      }
      case 'VCVS': {
        const row = currentIdx.get(eff.id)
        branch(row, a, b)
        const [c, d] = eff.ctrl
        if (ix(c) >= 0) M[row][ix(c)] -= eff.gain
        if (ix(d) >= 0) M[row][ix(d)] += eff.gain
        break
      }
      case 'VCCS': {
        const [c, d] = eff.ctrl
        const g = eff.gain
        const ia = ix(a)
        const ib = ix(b)
        const ic = ix(c)
        const id = ix(d)
        if (ia >= 0 && ic >= 0) M[ia][ic] += g
        if (ia >= 0 && id >= 0) M[ia][id] -= g
        if (ib >= 0 && ic >= 0) M[ib][ic] -= g
        if (ib >= 0 && id >= 0) M[ib][id] += g
        break
      }
      case 'OPAMP': {
        // The nullor: the output current is whatever it must be (an unknown
        // with a column at the output node), and the row it buys is the
        // constraint v₊ = v₋ — the golden rule, as a line of algebra.
        const row = currentIdx.get(eff.id)
        const out = ix(a)
        if (out >= 0) M[out][row] += 1
        const [p, q] = eff.ctrl
        if (ix(p) >= 0) M[row][ix(p)] += 1
        if (ix(q) >= 0) M[row][ix(q)] -= 1
        break
      }
      default:
        throw new NetworkError('kind', `Cannot stamp ${eff.type}`)
    }
  }
  const unknowns = [
    ...norm.nodeNames.map((node) => ({ kind: 'v', node })),
    ...[...currentIdx.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => ({ kind: 'i', id })),
  ]
  return { M, r, unknowns, currentIdx, effs }
}

/**
 * Is there a signal path from an op-amp's output back to one of its inputs?
 * Ground and independent sources do not count as path — a comparator's output
 * "reaches" its input through ground and the source, and that is precisely
 * not feedback. Resistors, closed switches, inductors (shorts at DC) and other
 * op-amps (input → output) do carry the signal.
 */
function feedbackPath(norm, effs, amp, input) {
  const adj = new Map()
  const add = (a, b) => {
    if (a === GROUND || b === GROUND) return
    if (!adj.has(a)) adj.set(a, [])
    adj.get(a).push(b)
  }
  effs.forEach((eff, k) => {
    const orig = norm.elements[k]
    if (eff.id === amp.id) return
    if (eff.type === 'R' || (eff.type === 'V' && orig.type !== 'V')) {
      add(eff.nodes[0], eff.nodes[1])
      add(eff.nodes[1], eff.nodes[0])
    } else if (eff.type === 'OPAMP' || eff.type === 'VCVS' || eff.type === 'VCCS') {
      for (const c of eff.ctrl) for (const o of eff.type === 'OPAMP' ? [eff.nodes[0]] : eff.nodes) add(c, o)
    }
  })
  const seen = new Set([amp.nodes[0]])
  const queue = [amp.nodes[0]]
  while (queue.length) {
    const cur = queue.shift()
    if (cur === input) return true
    for (const nxt of adj.get(cur) || []) {
      if (!seen.has(nxt)) {
        seen.add(nxt)
        queue.push(nxt)
      }
    }
  }
  return false
}

/**
 * Structural checks run BEFORE the solve, so a singular matrix comes with the
 * reason a person would give. Each returns a NetworkError or null.
 */
export function diagnose(norm, opts = {}) {
  const effs = norm.elements.map((e) => effective(e, opts))
  const conducts = (e) => e.type !== 'OPEN' && e.type !== 'I' && e.type !== 'VCCS'

  // An ideal op-amp with no path from its output back to either input has no
  // solution: the row v₊ = v₋ cannot be satisfied by any output current.
  for (const e of effs) {
    if (e.type !== 'OPAMP') continue
    const back = e.ctrl.some((inp) => feedbackPath(norm, effs, e, inp))
    if (!back)
      return new NetworkError(
        'opamp-open-loop',
        `${e.id} has no feedback path from its output to either input. An ideal op-amp with no feedback has no solution — its output would have to be infinite. A real one saturates: give it a finite gain and rails to see what it does.`,
        { element: e.id },
      )
  }

  // A node whose every connection is a current source (or nothing) has
  // nowhere for the current to go.
  for (const node of norm.nodeNames) {
    const inc = incident(norm, node).map((x) => effective(x, opts))
    const real = inc.filter((x) => x.type !== 'OPEN')
    if (real.length && real.every((x) => x.type === 'I' || x.type === 'VCCS'))
      return new NetworkError(
        'current-cutset',
        `Node ${node} is fed only by current sources, so the current arriving there has nowhere to go. A current source needs a path to close its loop.`,
        { node },
      )
    // A node with no conducting path to ground has no defined voltage.
    if (!connected(norm, node, GROUND, (x) => conducts(effective(x, opts))))
      return new NetworkError(
        'floating',
        `Node ${node} has no path to ground, so its voltage is not defined — a voltage is a difference, and this one has nothing to differ from.`,
        { node },
      )
  }

  // A loop of voltage sources (shorts count) fixes one voltage twice.
  const vs = effs.filter((e) => e.type === 'V')
  for (let k = 0; k < vs.length; k++) {
    const e = vs[k]
    const others = (x) => {
      const f = effective(x, opts)
      return f.type === 'V' && x.id !== e.id
    }
    if (connected(norm, e.nodes[0], e.nodes[1], others))
      return new NetworkError(
        'source-loop',
        `${e.id} is in a loop with other voltage sources (or shorts), so two things are trying to set the same voltage. Unless they agree exactly, there is no answer; if they do, the current between them is undefined.`,
        { element: e.id },
      )
  }
  return null
}

/**
 * The DC solution: node voltages, every element's current and power (passive
 * sign convention), the KCL residual at every node, and the assembled system
 * for the equations view.
 */
export function solveDC(net, opts = {}) {
  const norm = net.nodeNames ? net : normalize(net)
  const why = diagnose(norm, opts)
  if (why) throw why
  const sys = assemble(norm, opts)
  let x
  try {
    x = solve(sys.M, sys.r)
  } catch (err) {
    if (err instanceof SingularError)
      throw new NetworkError(
        'singular',
        'These equations have no unique solution: some voltage or current is left undetermined by the circuit as drawn.',
        { pivot: err.pivot },
      )
    throw err
  }
  return readout(norm, sys, x)
}

/** Turn a solution vector into the numbers a reader sees. */
export function readout(norm, sys, x) {
  const v = { [GROUND]: 0 }
  norm.nodeNames.forEach((n, k) => (v[n] = x[k]))
  const vAt = (n) => v[n]
  const i = {}
  const volt = {}
  const p = {}
  for (const eff of sys.effs) {
    const [a, b] = eff.nodes
    const vab = eff.type === 'OPAMP' ? vAt(a) : vAt(a) - vAt(b)
    let cur
    switch (eff.type) {
      case 'OPEN':
        cur = 0
        break
      case 'R':
        cur = vab / eff.value
        break
      case 'I':
        cur = eff.value
        break
      case 'VCCS':
        cur = eff.gain * (vAt(eff.ctrl[0]) - vAt(eff.ctrl[1]))
        break
      default:
        cur = x[sys.currentIdx.get(eff.id)]
    }
    i[eff.id] = cur
    volt[eff.id] = vab
    p[eff.id] = vab * cur
  }
  // KCL at every node from the element laws, not from the matrix.
  const residual = {}
  let maxResidual = 0
  for (const node of norm.nodeNames) {
    let s = 0
    for (const eff of sys.effs) {
      if (eff.type === 'OPAMP') {
        if (eff.nodes[0] === node) s += i[eff.id]
        continue
      }
      if (eff.nodes[0] === node) s += i[eff.id]
      if (eff.nodes[1] === node) s -= i[eff.id]
    }
    residual[node] = s
    maxResidual = Math.max(maxResidual, Math.abs(s))
  }
  const pTotal = Object.values(p).reduce((s, w) => s + w, 0)
  return { v, i, volt, p, pTotal, residual, maxResidual, x, sys, norm }
}
