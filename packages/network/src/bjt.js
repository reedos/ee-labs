// The bipolar transistor, in two models.
//
// The diode has four models, each an approximation of the next, and the lab
// teaches them as such. The transistor gets two.
//
//   regions  the three-region model: cutoff (everything open), active
//            (v_BE = 0.7 V and i_C = β i_B) and saturation (v_BE = 0.7 V and
//            v_CE = 0.2 V). Three straight pieces, so it is PIECEWISE-LINEAR
//            and every exact method in this package applies to it — assumed
//            states at DC, events in time.
//   exp      Ebers–Moll in transport form: two of the diode's junctions and one
//            controlled source, with β_F, β_R and the Early voltage. A curve,
//            so it has an operating point found by Newton and a tangent taken
//            there, and in time it is declined for the reason diode.js gives.
//
// Node order is the datasheet's: [collector, base, emitter]. Every law below is
// written for an npn and a pnp turns the sign, so `s` is +1 or −1 and the
// device's own v_BE is s(v_B − v_E). The conductances of the tangent are the
// same either way — two sign flips cancel — and only the equivalent current
// sources carry s.
//
// Sign convention, as everywhere: a terminal current is positive flowing INTO
// that terminal, so a working npn has i_C > 0, i_B > 0 and i_E < 0, and the
// three add to zero.

import { NetworkError } from './netlist.js'
import { GMIN, VT, pnjlim, vcrit } from './physics.js'

/** What a BJT is, with the defaults of the small-signal npn the lab is built on. */
export const BJT_DEFAULTS = {
  polarity: 'npn',
  model: 'regions',
  beta: 100,
  br: 1,
  is: 1e-14,
  n: 1,
  va: 100,
  vbe: 0.7,
  vcesat: 0.2,
  cpi: 0,
  cmu: 0,
  vt: VT,
}

/** The two models, in the order the curriculum meets them. */
export const BJT_MODELS = {
  regions: { label: 'three regions', about: 'cutoff, active with v_BE = 0.7 V and i_C = β i_B, saturation with v_CE = 0.2 V' },
  exp: { label: 'exponential', about: 'Ebers–Moll: two junctions and one controlled source, with β_F, β_R and the Early voltage' },
}

/** A BJT element's parameters, defaults filled in and checked. */
export function bjtOf(e) {
  const d = { ...BJT_DEFAULTS, ...e }
  if (!BJT_MODELS[d.model]) throw new NetworkError('kind', `${e.id}: unknown transistor model "${d.model}"`)
  if (d.polarity !== 'npn' && d.polarity !== 'pnp') throw new NetworkError('kind', `${e.id}: polarity is "npn" or "pnp"`)
  if (!(d.beta > 0)) throw new NetworkError('value', `${e.id}: β must be positive`)
  if (!(d.br > 0)) throw new NetworkError('value', `${e.id}: the reverse β must be positive`)
  if (!(d.vt > 0)) throw new NetworkError('value', `${e.id}: the thermal voltage must be positive`)
  if (d.model === 'exp' && !(d.is > 0)) throw new NetworkError('value', `${e.id}: I_S must be positive`)
  if (d.model === 'exp' && !(d.n > 0)) throw new NetworkError('value', `${e.id}: the emission coefficient must be positive`)
  if (d.model === 'regions' && !(d.vbe >= 0)) throw new NetworkError('value', `${e.id}: V_BE(on) cannot be negative`)
  if (d.model === 'regions' && !(d.vcesat >= 0)) throw new NetworkError('value', `${e.id}: V_CE(sat) cannot be negative`)
  if (!(d.va > 0)) throw new NetworkError('value', `${e.id}: the Early voltage must be positive, or Infinity for no Early effect`)
  return d
}

/** +1 for an npn, −1 for a pnp. Every law is written for the npn and this turns it. */
export const signOf = (d) => (d.polarity === 'pnp' ? -1 : 1)

/** The three regions, in the order the assumed-state search enumerates them. */
export const BJT_REGIONS = ['active', 'saturation', 'cutoff']

/** How a region reads in a sentence. */
export const bjtRegionLabel = (region) => (region === 'active' ? 'in its active region' : region === 'saturation' ? 'saturated' : 'cut off')

/**
 * The Early factor, the textbook's: i_C rises as (1 + v_CE/V_A), so every
 * curve of the family extrapolates back to v_CE = −V_A. It is floored at a
 * thousandth so that a Newton step wandering past −V_A cannot hand the matrix a
 * negative conductance; the model does not describe that region and the floor
 * is flat there, which is what stops the iteration rather than turning it over.
 */
const EARLY_FLOOR = 1e-3
function early(d, vce) {
  if (!Number.isFinite(d.va)) return { f: 1, df: 0 }
  const f = 1 + vce / d.va
  return f > EARLY_FLOOR ? { f, df: 1 / d.va } : { f: EARLY_FLOOR, df: 0 }
}

/**
 * The terminal currents of the exponential model at the device's own junction
 * voltages, in amps into each terminal.
 *
 * Transport form: one current i_T crosses the base, forward from the emitter
 * junction and backward from the collector junction, and each junction takes
 * its own share of base current, i_T/β. D1 draws exactly this: two diodes and
 * one source.
 */
export function bjtCurrents(d, { vbe, vbc }) {
  const nvt = d.n * d.vt
  const ebe = Math.exp(vbe / nvt)
  const ebc = Math.exp(vbc / nvt)
  const { f } = early(d, vbe - vbc)
  const iT = d.is * (ebe - ebc) * f
  const ibe = (d.is / d.beta) * (ebe - 1)
  const ibc = (d.is / d.br) * (ebc - 1)
  const ic = iT - ibc
  const ib = ibe + ibc
  return { ic, ib, ie: -(ic + ib), iT, ibe, ibc }
}

/**
 * The tangent of the exponential model: the four partial derivatives a
 * hybrid-π is made of.
 *
 *   gpi  = ∂i_B/∂v_BE = 1/r_π        gmu   = ∂i_B/∂v_BC = 1/r_μ
 *   gm   = ∂i_C/∂v_BE                gobc  = ∂i_C/∂v_BC
 *
 * In the active region gpi is g_m/β, gmu is nothing, and −gobc is 1/r_o, which
 * is where r_π = β/g_m and r_o = V_A/I_C come from.
 */
export function bjtSlopes(d, { vbe, vbc }) {
  const nvt = d.n * d.vt
  const ebe = Math.exp(vbe / nvt)
  const ebc = Math.exp(vbc / nvt)
  const { f, df } = early(d, vbe - vbc)
  const core = d.is * (ebe - ebc)
  const dbe = (d.is / nvt) * ebe
  const dbc = (d.is / nvt) * ebc
  const gmu = dbc / d.br
  return {
    gpi: dbe / d.beta,
    gmu,
    gm: dbe * f + core * df,
    gobc: -dbc * f - core * df - gmu,
  }
}

/**
 * The companion of the exponential model at the terminal voltages
 * `{ vbe, vbc }` — v_B − v_E and v_B − v_C as the circuit reads them, not the
 * device's own.
 *
 * Five stamps: the two junction conductances, the transconductance, the output
 * conductance written as a second controlled source, and the equivalent
 * current source that carries the affine part. The conductance between base and
 * collector appears in the collector's law with the wrong sign, so the second
 * controlled source carries `gobc + gmu` and the two together leave exactly
 * `gobc` there.
 */
export function bjtCompanion(e, { vbe, vbc }) {
  const d = bjtOf(e)
  const s = signOf(d)
  const [c, b, em] = e.nodes
  const dev = { vbe: s * vbe, vbc: s * vbc }
  const cur = bjtCurrents(d, dev)
  const sl = bjtSlopes(d, dev)
  const gpi = Math.max(sl.gpi, GMIN)
  const gmu = Math.max(sl.gmu, GMIN)
  const ieqB = s * cur.ib - gpi * vbe - gmu * vbc
  const ieqC = s * cur.ic - sl.gm * vbe - sl.gobc * vbc
  return {
    g: [
      [b, em, gpi],
      [b, c, gmu],
    ],
    gm: [
      [c, em, b, em, sl.gm],
      [c, em, b, c, sl.gobc + gmu],
    ],
    i: [
      [b, em, ieqB],
      [c, em, ieqC],
    ],
    region: bjtRegionOf(d, dev),
    point: bjtPoint(d, dev, cur, sl, s),
    limit: (vNew, vOld) => {
      const nvt = d.n * d.vt
      const vc = vcrit(nvt, d.is)
      return {
        vbe: s * pnjlim(s * vNew.vbe, s * vOld.vbe, nvt, vc),
        vbc: s * pnjlim(s * vNew.vbc, s * vOld.vbc, nvt, vc),
      }
    },
  }
}

/** Which region the exponential model is in, for the label the pane prints. */
export function bjtRegionOf(d, { vbe, vbc }) {
  const on = (v) => v > 0.5 * d.vbe
  if (!on(vbe) && !on(vbc)) return 'cutoff'
  if (on(vbe) && on(vbc)) return 'saturation'
  return on(vbe) ? 'active' : 'reverse'
}

/** The operating point a pane prints, and the small-signal numbers taken at it. */
export function bjtPoint(d, dev, cur, sl, s) {
  const vce = dev.vbe - dev.vbc
  const region = bjtRegionOf(d, dev)
  const gm = sl.gm
  const rpi = sl.gpi > 0 ? 1 / sl.gpi : Infinity
  const ro = sl.gobc < 0 ? -1 / sl.gobc : Infinity
  return { ic: s * cur.ic, ib: s * cur.ib, ie: s * cur.ie, vbe: s * dev.vbe, vbc: s * dev.vbc, vce: s * vce, region, gm, rpi, ro, beta: d.beta }
}

// ------------------------------------------------------------ three regions

/**
 * The three-region model as elements. Node order is the datasheet's, so the
 * base–emitter branch keeps the id `<id>.be` and the collector branch `<id>.ce`
 * whatever region the device is in, and a reading can be traced to a terminal.
 *
 * The active region is where the current-controlled source earns its place:
 * v_BE is pinned by a source, which makes i_B an unknown of the system, and
 * i_C = β i_B is that unknown multiplied.
 */
export function bjtRegionElements(e, region) {
  const d = bjtOf(e)
  const s = signOf(d)
  const [c, b, em] = e.nodes
  const be = `${e.id}.be`
  const ce = `${e.id}.ce`
  const mark = { of: e.id, from: 'Q' }
  switch (region) {
    case 'active':
      return [
        { ...mark, type: 'V', id: be, nodes: [b, em], value: s * d.vbe },
        { ...mark, type: 'CCCS', id: ce, nodes: [c, em], over: be, gain: d.beta },
      ]
    case 'saturation':
      return [
        { ...mark, type: 'V', id: be, nodes: [b, em], value: s * d.vbe },
        { ...mark, type: 'V', id: ce, nodes: [c, em], value: s * d.vcesat },
      ]
    case 'cutoff':
    default:
      return [
        { ...mark, type: 'OPEN', id: be, nodes: [b, em] },
        { ...mark, type: 'OPEN', id: ce, nodes: [c, em] },
      ]
  }
}

/**
 * How far inside its region the three-region model is, from a solved circuit.
 * Each margin is the quantity a student would check by hand: is the base
 * current still forward, is the collector still above the knee, is the
 * collector current still less than β times the base current.
 */
export function bjtMargins(e, region, sol) {
  const d = bjtOf(e)
  const s = signOf(d)
  const [c, b, em] = e.nodes
  const vbe = s * (sol.v[b] - sol.v[em])
  const vce = s * (sol.v[c] - sol.v[em])
  const ib = s * (sol.i[`${e.id}.be`] ?? 0)
  const ic = s * (sol.i[`${e.id}.ce`] ?? 0)
  switch (region) {
    case 'active':
      return [
        { what: 'ib', margin: ib, says: `i_B ≥ 0` },
        { what: 'vce', margin: vce - d.vcesat, says: `v_CE ≥ V_CE(sat)` },
      ]
    case 'saturation':
      return [
        { what: 'ib', margin: ib, says: `i_B ≥ 0` },
        { what: 'ic', margin: d.beta * ib - ic, says: `i_C ≤ β i_B` },
      ]
    case 'cutoff':
    default:
      return [{ what: 'vbe', margin: d.vbe - vbe, says: `v_BE ≤ V_BE(on)` }]
  }
}

/** The region a violated margin sends the device to. */
export function bjtFlipTo(region, what) {
  if (region === 'cutoff') return 'active'
  if (region === 'active') return what === 'ib' ? 'cutoff' : 'saturation'
  return what === 'ib' ? 'cutoff' : 'active'
}

/** The operating point of a three-region device, read off a solved circuit. */
export function bjtRegionPoint(e, region, sol) {
  const d = bjtOf(e)
  const s = signOf(d)
  const [c, b, em] = e.nodes
  const ib = sol.i[`${e.id}.be`] ?? 0
  const ic = sol.i[`${e.id}.ce`] ?? 0
  const gm = (s * ic) / d.vt
  return {
    ic,
    ib,
    ie: -(ic + ib),
    vbe: sol.v[b] - sol.v[em],
    vce: sol.v[c] - sol.v[em],
    region,
    gm,
    rpi: gm > 0 ? d.beta / gm : Infinity,
    ro: Number.isFinite(d.va) && s * ic > 0 ? (d.va + s * (sol.v[c] - sol.v[em])) / (s * ic) : Infinity,
    beta: d.beta,
  }
}

/** A starting guess for Newton: the emitter junction just on, the collector reverse-biased. */
export function bjtGuess(e) {
  const d = bjtOf(e)
  const s = signOf(d)
  return { vbe: s * Math.min(0.6, vcrit(d.n * d.vt, d.is)), vbc: -s * 0.5 }
}
