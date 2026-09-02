// Netlists: the circuit as data.
//
// A circuit is a list of elements, each naming the nodes it connects. Nothing
// here knows how to solve anything; this file normalises the description,
// numbers the nodes, and answers structural questions (is there a path from
// here to there through these kinds of element?) that both the solver's
// refusals and the equation printer need.
//
// Conventions, used everywhere downstream and stated once:
//
//   nodes[0] is the element's + terminal, nodes[1] its − terminal.
//   The element's voltage is v(nodes[0]) − v(nodes[1]).
//   The element's current flows IN at nodes[0] and OUT at nodes[1] — the
//   passive sign convention, so power = v·i is positive for anything that
//   absorbs energy and negative for anything that delivers it. A source
//   doing its job therefore shows negative power, and the sum over every
//   element is zero. That sign is not a nuisance to hide; Group A makes it
//   an experiment.
//
//   Ground is the node named 'gnd' (or '0'). Exactly one is required.

export const GROUND = 'gnd'

/** Element kinds and which of them carry an MNA current unknown. */
export const KINDS = {
  R: { name: 'resistor', unknownCurrent: false },
  V: { name: 'voltage source', unknownCurrent: true },
  I: { name: 'current source', unknownCurrent: false },
  VCVS: { name: 'voltage-controlled voltage source', unknownCurrent: true },
  VCCS: { name: 'voltage-controlled current source', unknownCurrent: false },
  OPAMP: { name: 'op-amp', unknownCurrent: true },
  SW: { name: 'switch', unknownCurrent: false }, // resolved to a short or an open
  C: { name: 'capacitor', unknownCurrent: false }, // open at DC; a state in time
  L: { name: 'inductor', unknownCurrent: true }, // short at DC; a state in time
  D: { name: 'diode', unknownCurrent: false }, // resolved by its region: a source, a slope or an open
}

export class NetworkError extends Error {
  constructor(code, message, detail = {}) {
    super(message)
    this.name = 'NetworkError'
    this.code = code
    this.detail = detail
  }
}

const isGround = (n) => n === GROUND || n === '0' || n === 0

/**
 * Normalise a netlist: check every element, collect the nodes, give ground the
 * index −1 and every other node an index from 0. Returns a frozen description
 * the solver and printer both consume.
 */
export function normalize(net) {
  const elements = (net.elements || []).map((e, k) => {
    if (!e.type || !KINDS[e.type]) throw new NetworkError('kind', `Unknown element type "${e.type}"`)
    const id = e.id || `${e.type}${k + 1}`
    const nodes = (e.nodes || []).map((n) => (isGround(n) ? GROUND : String(n)))
    const need = e.type === 'OPAMP' ? 1 : 2
    if (nodes.length < need) throw new NetworkError('nodes', `${id} needs ${need} node(s)`)
    const ctrl = (e.ctrl || []).map((n) => (isGround(n) ? GROUND : String(n)))
    if ((e.type === 'VCVS' || e.type === 'VCCS' || e.type === 'OPAMP') && ctrl.length !== 2)
      throw new NetworkError('ctrl', `${id} needs two controlling nodes`)
    return { ...e, id, nodes, ctrl }
  })

  const names = new Set()
  for (const e of elements) for (const n of [...e.nodes, ...e.ctrl]) if (n !== GROUND) names.add(n)
  const hasGround = elements.some((e) => [...e.nodes, ...e.ctrl].includes(GROUND))
  if (!hasGround && elements.length)
    throw new NetworkError(
      'ground',
      'No ground: every voltage is a difference, so one node has to be called zero before any of them has a number.',
    )
  const nodeNames = [...names].sort()
  const index = new Map(nodeNames.map((n, k) => [n, k]))
  index.set(GROUND, -1)
  return { elements, nodeNames, index, n: nodeNames.length }
}

/**
 * Is there a path between two nodes through elements accepted by `through`?
 * Used for structural refusals: an op-amp with no feedback path, a part of the
 * circuit with no path to ground.
 */
export function connected(norm, from, to, through) {
  const adj = new Map()
  const add = (a, b, e) => {
    if (!adj.has(a)) adj.set(a, [])
    adj.get(a).push([b, e])
  }
  for (const e of norm.elements) {
    if (!through(e)) continue
    const [a, b] = e.type === 'OPAMP' ? [e.nodes[0], GROUND] : e.nodes
    add(a, b, e)
    add(b, a, e)
  }
  const seen = new Set([from])
  const queue = [from]
  while (queue.length) {
    const cur = queue.shift()
    if (cur === to) return true
    for (const [nxt] of adj.get(cur) || []) {
      if (!seen.has(nxt)) {
        seen.add(nxt)
        queue.push(nxt)
      }
    }
  }
  return false
}

/** Every element touching a node (op-amp inputs count: they touch, at zero current). */
export function incident(norm, node) {
  return norm.elements.filter((e) => e.nodes.includes(node) || (e.type === 'OPAMP' && e.ctrl.includes(node)))
}
