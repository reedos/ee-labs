// The MOSFET, in two models.
//
//   square  the three regions of the square law: cutoff, triode and
//           saturation. It is nonlinear INSIDE two of the three, so it is a
//           Newton model with region tracking, not a piecewise-linear one —
//           which is the difference between it and the three-region BJT, and
//           the reason D4 and D3 look different on screen.
//   switch  Power Lab's model: R_on when the gate is above threshold, open
//           when it is not. Piecewise-linear, and exact in time.
//
// Node order is the datasheet's: [drain, gate, source]. Every law is written
// for the n-channel device and a p-channel turns the sign, so `s` is +1 or −1
// and the device's own v_GS is s(v_G − v_S).
//
// The gate draws no current at all — no stamp touches it — which is the whole
// reason for the device and what F6 measures. A gate with nothing else on its
// node therefore has no path to ground, and the solver says so.
//
// Channel-length modulation is applied in both regions rather than only in
// saturation. The two pieces then meet with the same value AND the same slope
// at v_DS = V_OV, which is what keeps Newton from chattering across the knee.

import { NetworkError } from './netlist.js'
import { GMIN, limitTo } from './physics.js'

/** What a MOSFET is, with the defaults of the plan's device. */
export const MOSFET_DEFAULTS = {
  polarity: 'n',
  model: 'square',
  vt: 0.7,
  kn: 20e-3,
  lambda: 0,
  ron: 1,
  roff: null,
  cgs: 0,
  cgd: 0,
}

export const MOSFET_MODELS = {
  square: { label: 'square law', about: 'cutoff, triode and saturation, with λ for the slope in saturation' },
  switch: { label: 'switch', about: 'R_on above threshold, open below it — Power Lab’s model, piecewise-linear' },
}

/** A MOSFET element's parameters, defaults filled in and checked. */
export function mosfetOf(e) {
  const d = { ...MOSFET_DEFAULTS, ...e }
  if (!MOSFET_MODELS[d.model]) throw new NetworkError('kind', `${e.id}: unknown transistor model "${d.model}"`)
  if (d.polarity !== 'n' && d.polarity !== 'p') throw new NetworkError('kind', `${e.id}: polarity is "n" or "p"`)
  if (!(d.kn > 0)) throw new NetworkError('value', `${e.id}: the transconductance parameter must be positive`)
  if (!(d.lambda >= 0)) throw new NetworkError('value', `${e.id}: λ cannot be negative`)
  if (d.model === 'switch' && !(d.ron > 0)) throw new NetworkError('value', `${e.id}: R_on must be positive`)
  return d
}

/** +1 for an n-channel, −1 for a p-channel. */
export const signOf = (d) => (d.polarity === 'p' ? -1 : 1)

/** The switch model's two regions, in the order the search enumerates them. */
export const MOSFET_SWITCH_REGIONS = ['on', 'off']

export const mosfetRegionLabel = (region) =>
  region === 'triode' ? 'in triode' : region === 'saturation' ? 'in saturation' : region === 'on' ? 'conducting' : region === 'off' ? 'blocking' : 'cut off'

/**
 * The drain current of the square law at the device's own voltages, and its
 * two slopes. Everything is written for v_DS ≥ 0; a negative v_DS is the same
 * device with drain and source swapped, which is what the last branch does.
 */
export function mosfetCurrent(d, { vgs, vds }) {
  if (vds < 0) {
    // Swapped: the terminal that was the drain is now the source.
    const r = mosfetCurrent(d, { vgs: vgs - vds, vds: -vds })
    // i flows the other way, and the derivatives follow the chain rule of the
    // swap: v_GS' = v_GS − v_DS and v_DS' = −v_DS.
    return { id: -r.id, gm: r.gm, gds: r.gds + r.gm, region: r.region }
  }
  const vov = vgs - d.vt
  if (vov <= 0) return { id: 0, gm: 0, gds: 0, region: 'cutoff' }
  const lam = 1 + d.lambda * vds
  if (vds < vov) {
    const id = d.kn * (vov * vds - 0.5 * vds * vds) * lam
    return {
      id,
      gm: d.kn * vds * lam,
      gds: d.kn * (vov - vds) * lam + d.kn * (vov * vds - 0.5 * vds * vds) * d.lambda,
      region: 'triode',
    }
  }
  return {
    id: 0.5 * d.kn * vov * vov * lam,
    gm: d.kn * vov * lam,
    gds: 0.5 * d.kn * vov * vov * d.lambda,
    region: 'saturation',
  }
}

/**
 * The companion of the square law at the terminal voltages `{ vgs, vds }`.
 *
 * Two stamps and a source: the output conductance between drain and source,
 * the transconductance as a controlled source from the gate, and the current
 * source that carries the affine part. The gate is not stamped at all.
 */
export function mosfetCompanion(e, { vgs, vds }) {
  const d = mosfetOf(e)
  const s = signOf(d)
  const [drain, gate, source] = e.nodes
  const r = mosfetCurrent(d, { vgs: s * vgs, vds: s * vds })
  const gds = Math.max(r.gds, GMIN)
  const ieq = s * r.id - r.gm * vgs - gds * vds
  return {
    g: [[drain, source, gds]],
    gm: [[drain, source, gate, source, r.gm]],
    i: [[drain, source, ieq]],
    region: r.region,
    // The point is reported in terminal voltages, the way a probe reads them,
    // so a p-channel device shows the negative v_GS it really has. `vov` is
    // the device's own overdrive, which is positive whenever it conducts.
    point: { id_: s * r.id, vgs, vds, vov: s * vgs - d.vt, region: r.region, gm: r.gm, ro: r.gds > 0 ? 1 / r.gds : Infinity },
    // No junction, so no junction limiting: a plain cap on the step keeps a
    // square law from overshooting into the far side of its own parabola.
    limit: (vNew, vOld) => ({ vgs: limitTo(vNew.vgs, vOld.vgs, 1), vds: limitTo(vNew.vds, vOld.vds, 2) }),
  }
}

/** The switch model as elements: a resistance when on, an open when off. */
export function mosfetRegionElements(e, region) {
  const d = mosfetOf(e)
  const [drain, , source] = e.nodes
  const id = `${e.id}.ds`
  const mark = { of: e.id, from: 'M' }
  if (region === 'on') return [{ ...mark, type: 'R', id, nodes: [drain, source], value: d.ron }]
  return d.roff > 0
    ? [{ ...mark, type: 'R', id, nodes: [drain, source], value: d.roff }]
    : [{ ...mark, type: 'OPEN', id, nodes: [drain, source] }]
}

/** The switch model's guard: the gate decides, and the gate alone. */
export function mosfetMargins(e, region, sol) {
  const d = mosfetOf(e)
  const s = signOf(d)
  const [, gate, source] = e.nodes
  const vgs = s * (sol.v[gate] - sol.v[source])
  return region === 'on'
    ? [{ what: 'vgs', margin: vgs - d.vt, says: `v_GS ≥ V_t` }]
    : [{ what: 'vgs', margin: d.vt - vgs, says: `v_GS ≤ V_t` }]
}

export const mosfetFlipTo = (region) => (region === 'on' ? 'off' : 'on')

/** The operating point of a switch-model device, read off a solved circuit. */
export function mosfetRegionPoint(e, region, sol) {
  const d = mosfetOf(e)
  const [drain, gate, source] = e.nodes
  return {
    id_: sol.i[`${e.id}.ds`] ?? 0,
    vds: sol.v[drain] - sol.v[source],
    vgs: sol.v[gate] - sol.v[source],
    region,
    gm: 0,
    ro: region === 'on' ? d.ron : Infinity,
  }
}

/** A starting guess for Newton: the gate a little above threshold, the drain out of triode. */
export function mosfetGuess(e) {
  const d = mosfetOf(e)
  const s = signOf(d)
  return { vgs: s * (d.vt + 0.2), vds: s * 1 }
}
