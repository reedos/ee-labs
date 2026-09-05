// Linearisation is a netlist.
//
// The small-signal view of an amplifier is not a different kind of object. It
// is an ordinary circuit of resistors, capacitors and controlled sources —
// the tangent of every nonlinear element at the operating point, with every
// DC source killed — and once it is written out as one, every method in this
// package applies to it unchanged. `solveDC` gives the gain, `sweepAC` the
// response, `transferOf` the polynomials, and the equations view prints it as
// elements a reader can name.
//
// That is the CORE_SCOPE worked example made concrete. The small-signal
// network is exactly rational and is admitted to `systems` in full. What it
// carries with it is the label: the operating point the tangent was taken at,
// and the amplitude past which the tangent stops describing the curve.
//
// What is killed, and why:
//   a DC voltage source   becomes a short. Its voltage does not move, so it
//                         presents no voltage to the signal.
//   a DC current source   becomes an open. Its current does not move, so it
//                         presents no current to the signal. A node left with
//                         nothing but opens on it really is floating at
//                         signal frequencies, and the solver says so — which
//                         is the whole content of J3.
//   a signal source       stays. A source is a signal source when it carries a
//                         wave, or when it is marked `small`.

import { GROUND, NetworkError, normalize } from './netlist.js'
import { diodeOf, regionsOf } from './diode.js'
import { bjtOf, bjtRegionPoint } from './bjt.js'
import { mosfetOf, mosfetRegionPoint } from './mosfet.js'
import { companion, hasCompanion, readControls } from './companion.js'
import { VT } from './physics.js'

/** Is this source carrying the signal, rather than holding the bias? */
export const isSignal = (e) => !!(e.wave && e.wave.kind !== 'dc') || e.small === true

/** The operating point of every device in a solved circuit, whichever model it is on. */
export function pointsOf(norm, op) {
  const sol = op.sol ?? op
  const regions = op.regions || {}
  const point = {}
  for (const e of norm.elements) {
    if (e.type === 'Q') {
      point[e.id] = hasCompanion(e) ? companion(e, readControls(e, sol.v)).point : bjtRegionPoint(e, regions[e.id] || 'active', sol)
    } else if (e.type === 'M') {
      point[e.id] = hasCompanion(e) ? companion(e, readControls(e, sol.v)).point : mosfetRegionPoint(e, regions[e.id] || 'off', sol)
    } else if (e.type === 'D' && hasCompanion(e)) {
      point[e.id] = companion(e, readControls(e, sol.v)).point
    }
  }
  return point
}

/**
 * The linear netlist tangent to `net` at its operating point.
 *
 * @param net   a netlist with Q, M, D and OPAMP elements
 * @param op    the result of newtonDC or solvePWL (or a plain solution)
 * @param opts  { caps: true } to include cpi, cmu, cgs, cgd
 * @returns {{ elements, point, label }}
 */
export function smallSignal(net, op, opts = {}) {
  const norm = net.nodeNames ? net : normalize(net)
  const sol = op.sol ?? op
  if (!sol || !sol.v) throw new NetworkError('value', 'The small-signal netlist needs an operating point to be taken at')
  const regions = op.regions || {}
  const caps = !!opts.caps
  const point = pointsOf(norm, op)
  const elements = []
  const keep = (e) => elements.push({ ...e })

  for (const e of norm.elements) {
    switch (e.type) {
      case 'R':
      case 'C':
      case 'L':
      case 'VCVS':
        keep(e)
        break
      case 'VCCS':
        // A current limit is a large-signal fact. At the tangent the source is
        // whatever it is delivering, and the region it sits in says which.
        if (regions[e.id] === 'ipos' || regions[e.id] === 'ineg') elements.push({ type: 'I', id: e.id, nodes: e.nodes, value: 0, of: e.id })
        else elements.push({ ...e, ilimit: undefined })
        break
      case 'OPAMP':
        // A railed op-amp delivers no signal: at the rail its output is a
        // source that does not move, which is a short to ground.
        if (regions[e.id] === 'high' || regions[e.id] === 'low') elements.push({ type: 'V', id: e.id, nodes: [e.nodes[0], GROUND], value: 0, of: e.id })
        else elements.push({ ...e, vsat: undefined, imax: undefined })
        break
      case 'V':
        if (isSignal(e)) keep(e)
        else elements.push({ type: 'V', id: e.id, nodes: e.nodes, value: 0, of: e.id, from: 'kill' })
        break
      case 'I':
        if (isSignal(e)) keep(e)
        else elements.push({ type: 'I', id: e.id, nodes: e.nodes, value: 0, of: e.id, from: 'kill' })
        break
      case 'SW':
        keep(e)
        break
      case 'D':
        elements.push(...diodeTangent(e, regions[e.id], point[e.id]))
        break
      case 'Q':
        elements.push(...bjtTangent(e, point[e.id], caps))
        break
      case 'M':
        elements.push(...mosfetTangent(e, point[e.id], caps))
        break
      default:
        keep(e)
    }
  }
  return { elements, point, label: labelOf(point), caps }
}

/** A diode's tangent: its slope where it conducts, an open where it does not. */
function diodeTangent(e, region, pt) {
  const d = diodeOf(e)
  if (!regionsOf(e)) return [{ type: 'R', id: e.id, nodes: e.nodes, value: pt ? 1 / pt.g : d.n * d.vt / 1e-3, of: e.id, from: 'D' }]
  if ((region || 'off') === 'off') return [{ type: 'I', id: e.id, nodes: e.nodes, value: 0, of: e.id, from: 'D' }]
  if (d.model === 'pwl') return [{ type: 'R', id: e.id, nodes: e.nodes, value: d.rd, of: e.id, from: 'D' }]
  // A constant-drop diode holds its voltage whatever the current, so at signal
  // frequencies it is a short.
  return [{ type: 'V', id: e.id, nodes: e.nodes, value: 0, of: e.id, from: 'D' }]
}

/**
 * The hybrid-π: r_π between base and emitter, g_m·v_be as a controlled source
 * from collector to emitter, r_o beside it, and the two capacitances when the
 * frequency toggles are on. Every one of them is positive, and the model is the
 * same for a pnp as for an npn — a rise at the base raises the collector
 * current in the terminal frame either way.
 */
function bjtTangent(e, pt, caps) {
  const d = bjtOf(e)
  const [c, b, em] = e.nodes
  const mark = { of: e.id, from: 'Q' }
  const out = []
  if (!pt || !(pt.gm > 0)) {
    // Cut off: no tangent to take, and the device is three open terminals.
    out.push({ ...mark, type: 'I', id: `${e.id}.rpi`, nodes: [b, em], value: 0 })
    out.push({ ...mark, type: 'I', id: `${e.id}.ro`, nodes: [c, em], value: 0 })
    return out
  }
  out.push({ ...mark, type: 'R', id: `${e.id}.rpi`, nodes: [b, em], value: pt.rpi })
  out.push({ ...mark, type: 'VCCS', id: `${e.id}.gm`, nodes: [c, em], ctrl: [b, em], gain: pt.gm })
  if (Number.isFinite(pt.ro)) out.push({ ...mark, type: 'R', id: `${e.id}.ro`, nodes: [c, em], value: pt.ro })
  // r_μ is a teraohm in the active region and worth nothing there. Once the
  // collector junction starts to conduct it is the whole story, so it is drawn
  // whenever it is finite rather than only when it is large.
  if (Number.isFinite(pt.rmu)) out.push({ ...mark, type: 'R', id: `${e.id}.rmu`, nodes: [b, c], value: pt.rmu })
  if (caps && d.cpi > 0) out.push({ ...mark, type: 'C', id: `${e.id}.cpi`, nodes: [b, em], value: d.cpi })
  if (caps && d.cmu > 0) out.push({ ...mark, type: 'C', id: `${e.id}.cmu`, nodes: [b, c], value: d.cmu })
  return out
}

/** The MOSFET's: g_m and r_o, and no r_π at all, which is the reason for the device. */
function mosfetTangent(e, pt, caps) {
  const d = mosfetOf(e)
  const [drain, gate, source] = e.nodes
  const mark = { of: e.id, from: 'M' }
  const out = []
  if (!pt || !(pt.gm > 0)) {
    out.push({ ...mark, type: 'I', id: `${e.id}.ro`, nodes: [drain, source], value: 0 })
  } else {
    out.push({ ...mark, type: 'VCCS', id: `${e.id}.gm`, nodes: [drain, source], ctrl: [gate, source], gain: pt.gm })
    if (Number.isFinite(pt.ro)) out.push({ ...mark, type: 'R', id: `${e.id}.ro`, nodes: [drain, source], value: pt.ro })
  }
  if (caps && d.cgs > 0) out.push({ ...mark, type: 'C', id: `${e.id}.cgs`, nodes: [gate, source], value: d.cgs })
  if (caps && d.cgd > 0) out.push({ ...mark, type: 'C', id: `${e.id}.cgd`, nodes: [gate, drain], value: d.cgd })
  return out
}

/** "(V_CE = 5.00 V, I_C = 1.00 mA)" — the point the tangent was taken at. */
export function labelOf(point) {
  const parts = []
  for (const [id, p] of Object.entries(point)) {
    if (p.ic !== undefined) parts.push(`${id}: V_CE = ${fmt(p.vce, 'V')}, I_C = ${fmt(p.ic, 'A')}`)
    else if (p.id_ !== undefined) parts.push(`${id}: V_DS = ${fmt(p.vds, 'V')}, I_D = ${fmt(p.id_, 'A')}`)
    else if (p.rd !== undefined) parts.push(`${id}: I = ${fmt(p.i, 'A')}`)
  }
  return parts.length ? `(${parts.join('; ')})` : ''
}

const PREFIX = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
]
function fmt(x, unit) {
  if (!Number.isFinite(x)) return `— ${unit}`
  const a = Math.abs(x)
  const [scale, p] = PREFIX.find(([s]) => a >= s) || [1e-12, 'p']
  return `${(x / scale).toFixed(2)} ${p}${unit}`
}

/**
 * How far the tangent describes the exponential: the second harmonic of a
 * bipolar stage is about v_be/(4V_T), so 5 mV of peak drive costs 4.8 % and
 * 10 mV costs 9.7 %. Past `warn` the small-signal ghost turns amber, and past
 * `refuse` the pane declines to draw it as the answer.
 */
export const AMPLITUDE_GUARD = { warn: 5e-3, refuse: 20e-3 }

/** The estimated second-harmonic distortion of a bipolar stage at a drive amplitude. */
export const hd2Estimate = (vbe, vt = VT) => Math.abs(vbe) / (4 * vt)

/** Whether a drive amplitude is inside the guard, with the estimate it is judged on. */
export function amplitudeCheck(vbe, vt = VT) {
  const hd2 = hd2Estimate(vbe, vt)
  const state = Math.abs(vbe) > AMPLITUDE_GUARD.refuse ? 'refuse' : Math.abs(vbe) > AMPLITUDE_GUARD.warn ? 'warn' : 'ok'
  return { hd2, state, ...AMPLITUDE_GUARD }
}
