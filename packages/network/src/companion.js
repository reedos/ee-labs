// The companion interface: one nonlinear element, one tangent, one set of stamps.
//
// `newtonDC` used to linearise exponential diodes by hand, because the diode
// was the only curve in the package. A transistor's tangent is three things at
// once — a junction conductance, a transconductance and an output conductance —
// so the loop cannot go on knowing what it is linearising. It asks instead.
//
// An element with a nonlinear law provides `companion(element, v)`, returning
// the linear elements that stamp its tangent at the controlling voltages `v`:
//
//   g   [[nodeA, nodeB, siemens]]                 conductances
//   gm  [[outA, outB, ctrlA, ctrlB, siemens]]     transconductances
//   i   [[nodeA, nodeB, amps]]                    current sources
//   region  the name the pane prints
//   limit   (vNew, vOld) => vLimited, the device's own step damping
//
// Every entry uses the package's one convention: the current is positive
// flowing IN at the first node and out at the second. `v` is keyed by the
// element's own names — a diode { v }, a BJT { vbe, vbc }, a MOSFET
// { vgs, vds } — and each of those is a difference of TERMINAL voltages, not
// the device's own, so a pnp and an npn are read the same way and the polarity
// lives inside the device module.

import { NetworkError } from './netlist.js'
import { diodeOf, shockley } from './diode.js'
import { GMIN, pnjlim, vcrit } from './physics.js'
import { bjtCompanion, bjtCurrents, bjtGuess, bjtOf, signOf as bjtSign } from './bjt.js'
import { mosfetCompanion, mosfetCurrent, mosfetGuess, mosfetOf, signOf as mosfetSign } from './mosfet.js'

/** Does this element carry a curve rather than straight pieces? */
export function hasCompanion(e) {
  if (e.type === 'D') return diodeOf(e).model === 'exp'
  if (e.type === 'Q') return (e.model ?? 'regions') === 'exp'
  if (e.type === 'M') return (e.model ?? 'square') === 'square'
  return false
}

/** The voltages that control the element, by name. */
export function controlsOf(e) {
  if (e.type === 'D') return ['v']
  if (e.type === 'Q') return ['vbe', 'vbc']
  if (e.type === 'M') return ['vgs', 'vds']
  return []
}

/** Those voltages read off a solved circuit's node voltages. */
export function readControls(e, v) {
  if (e.type === 'D') return { v: v[e.nodes[0]] - v[e.nodes[1]] }
  if (e.type === 'Q') {
    const [c, b, em] = e.nodes
    return { vbe: v[b] - v[em], vbc: v[b] - v[c] }
  }
  const [d, g, s] = e.nodes
  return { vgs: v[g] - v[s], vds: v[d] - v[s] }
}

/** Where Newton starts, when nothing else says. */
export function guessFor(e) {
  if (e.type === 'D') {
    const d = diodeOf(e)
    return { v: Math.min(0.5, vcrit(d.n * d.vt, d.is)) }
  }
  if (e.type === 'Q') return bjtGuess(e)
  return mosfetGuess(e)
}

/** The diode's own companion, in the shape every other device uses. */
function diodeCompanion(e, { v }) {
  const d = diodeOf(e)
  const nvt = d.n * d.vt
  const { i, g } = shockley(d, v)
  const gg = Math.max(g, GMIN)
  const [a, b] = e.nodes
  return {
    g: [[a, b, gg]],
    gm: [],
    i: [[a, b, i - gg * v]],
    region: v > 0 ? 'forward' : 'reverse',
    point: { v, i, g: gg, rd: nvt / (i + d.is) },
    limit: (vNew, vOld) => ({ v: pnjlim(vNew.v, vOld.v, nvt, vcrit(nvt, d.is)) }),
  }
}

/**
 * The tangent of any nonlinear element at `v`. The one entry point the Newton
 * loop and the small-signal netlist both use.
 */
export function companion(e, v) {
  if (e.type === 'D') return diodeCompanion(e, v)
  if (e.type === 'Q') return bjtCompanion(e, v)
  if (e.type === 'M') return mosfetCompanion(e, v)
  throw new NetworkError('kind', `${e.id}: ${e.type} has no companion`)
}

/**
 * A companion as elements the solver stamps. Ids are stable — `<id>.g0`,
 * `<id>.m1`, `<id>.i0` — so a reading can be traced to the device and a second
 * solve at a different point lines up with the first.
 */
export function companionElements(e, c) {
  const mark = { of: e.id, from: e.type }
  const out = []
  const left = c.i.map((row) => row.slice())
  // A device whose whole tangent is one conductance and one source beside it —
  // the diode — keeps its own id, so every reading written against it before
  // this interface existed still reads.
  const sole = c.g.length === 1 && c.gm.length === 0 && left.every(([a, b]) => a === c.g[0][0] && b === c.g[0][1])
  const name = (suffix) => (sole ? e.id : `${e.id}.${suffix}`)
  c.g.forEach(([a, b, g], k) => {
    // A conductance with the affine current source folded in where they share
    // a node pair, which is the companion form the package already stamps.
    const src = left.findIndex(([x, y]) => x === a && y === b)
    const i0 = src >= 0 ? left[src][2] : 0
    if (src >= 0) left[src][2] = 0
    out.push({ ...mark, type: 'GI', id: name(`g${k}`), nodes: [a, b], g: Math.max(g, GMIN), i0 })
  })
  c.gm.forEach(([a, b, cn, dn, g], k) => {
    out.push({ ...mark, type: 'VCCS', id: `${e.id}.m${k}`, nodes: [a, b], ctrl: [cn, dn], gain: g })
  })
  left.forEach(([a, b, amps], k) => {
    if (amps !== 0) out.push({ ...mark, type: 'I', id: `${e.id}.i${k}`, nodes: [a, b], value: amps })
  })
  return out
}

/**
 * The element's own law: the current into each terminal at the controlling
 * voltages `v`, with no linearisation anywhere. This is the curve the
 * companion is the tangent of, and companion.test.js differences it.
 */
export function terminalLaw(e, v) {
  if (e.type === 'D') {
    const d = diodeOf(e)
    const [a, b] = e.nodes
    const { i } = shockley(d, v.v)
    return { [a]: i, [b]: -i }
  }
  if (e.type === 'Q') {
    const d = bjtOf(e)
    const sq = bjtSign(d)
    const [c, b, em] = e.nodes
    const cur = bjtCurrents(d, { vbe: sq * v.vbe, vbc: sq * v.vbc })
    return { [c]: sq * cur.ic, [b]: sq * cur.ib, [em]: sq * cur.ie }
  }
  const d = mosfetOf(e)
  const sm = mosfetSign(d)
  const [dr, gate, src] = e.nodes
  const r = mosfetCurrent(d, { vgs: sm * v.vgs, vds: sm * v.vds })
  return { [dr]: sm * r.id, [gate]: 0, [src]: -sm * r.id }
}

/**
 * The current the stamps of `c` deliver into each terminal when the
 * controlling voltages are `v` — the companion held fixed and the circuit
 * moved, which is exactly what the solver does between two iterations. At
 * `v` itself it returns the element's own law, and its slope is the tangent.
 */
export function stampCurrents(e, c, v) {
  const cur = {}
  const add = (node, amps) => (cur[node] = (cur[node] || 0) + amps)
  for (const node of e.nodes) add(node, 0)
  const at = (node) => terminalPotential(e, v, node)
  for (const [a, b, g] of c.g) {
    const drop = at(a) - at(b)
    add(a, g * drop)
    add(b, -g * drop)
  }
  for (const [a, b, cn, dn, g] of c.gm) {
    const drop = at(cn) - at(dn)
    add(a, g * drop)
    add(b, -g * drop)
  }
  for (const [a, b, amps] of c.i) {
    add(a, amps)
    add(b, -amps)
  }
  return cur
}

/** A terminal's potential, taking the last node of the element as zero. */
function terminalPotential(e, v, node) {
  if (e.type === 'D') {
    const [a] = e.nodes
    return node === a ? v.v : 0
  }
  if (e.type === 'Q') {
    const [c, b, em] = e.nodes
    if (node === em) return 0
    if (node === b) return v.vbe
    if (node === c) return v.vbe - v.vbc
    return 0
  }
  const [d, g, s] = e.nodes
  if (node === s) return 0
  if (node === d) return v.vds
  if (node === g) return v.vgs
  return 0
}

/**
 * The operating point of every nonlinear device in a solved circuit, keyed by
 * element id: the currents, the voltages, the region and the small-signal
 * numbers taken there. This is what the topbar prints and what `smallSignal`
 * builds its netlist from.
 */
export function operatingPoint(norm, sol) {
  const out = {}
  for (const e of norm.elements) {
    if (!hasCompanion(e)) continue
    out[e.id] = companion(e, readControls(e, sol.v)).point
  }
  return out
}

/** Is this element a MOSFET in its switch model, which has regions rather than a curve? */
export const isSwitchMosfet = (e) => e.type === 'M' && mosfetOf(e).model === 'switch'
