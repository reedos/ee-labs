// Macros: one element that stands for several, expanded before anything solves.
//
// The op-amp a user meets on a breadboard has an offset, a bias current, a
// gain that falls with frequency, a slew rate, a common-mode error and an
// output current limit. Every one of those is a circuit of elements this
// package already stamps, so none of them needs a new solver. `expandMacros`
// replaces the macro element by that circuit at `normalize`, which means the
// DC solve, the phasor solve, the state-space form and the equations view all
// see ordinary elements and none of them has a case for the op-amp's speed.
//
// The expansion is written in §2.2 of ELECTRONICS_LAB_PLAN.md and pinned by
// macro.test.js. An op-amp with none of the extra fields expands to itself,
// so every circuit written before this file existed is untouched.

/** The fields whose presence makes an OPAMP element a macro. */
export const MACRO_FIELDS = ['gbw', 'slew', 'vos', 'ib', 'cmrr', 'imax', 'rin', 'rout']

/** Is this element a macro, or an ordinary element that stamps as itself? */
export function isMacro(e) {
  if (!e || e.type !== 'OPAMP') return false
  return MACRO_FIELDS.some((k) => Number.isFinite(e[k]) && e[k] !== 0)
}

/**
 * Expand every macro element in a list, in place of the element it replaces,
 * and leave everything else exactly as it was. Called once from `normalize`.
 *
 * The body lives in `expandOpAmp`; this function is the seam every lane builds
 * against, so its contract is: a list of elements in, a list of elements out,
 * same order, and identity for a list with no macro in it.
 */
export function expandMacros(elements) {
  if (!elements.some(isMacro)) return elements
  return elements.flatMap((e) => (isMacro(e) ? expandOpAmp(e) : [e]))
}

/**
 * The op-amp macro, as elements.
 *
 *   V(vos)     in series with the + input, so the output sits at A₀·V_OS with
 *              both inputs earthed
 *   I(ib)      out of each input node, the base current of an input pair
 *   R(rin)     between the two inputs
 *   VCCS(g)    from the input difference into the internal node, current
 *              limited at ±slew·C so the ramp is exact
 *   VCCS(g/2·CMRR) twice, from each input to the internal node: the
 *              common-mode error, g·v_cm/CMRR
 *   R, C       from the internal node to ground: A₀ = g·R and f_p = 1/(2πRC)
 *   OPAMP(1)   from the internal node to the output, carrying the rails and
 *              the output current limit
 *   R(rout)    from that output to the pin
 *
 * The internal resistance is fixed at 1 MΩ. It is a scale, not a parameter:
 * every measurable quantity depends on g·R and on R·C, never on R alone.
 */
export function expandOpAmp(e) {
  const id = e.id
  const gain = Number.isFinite(e.gain) ? e.gain : 1e5
  const rint = Number.isFinite(e.rint) && e.rint > 0 ? e.rint : 1e6
  const g = gain / rint
  const [p, n] = e.ctrl
  const out = e.nodes[0]
  const int = `${id}.int`
  // The + input after the offset battery, and the output before R_out. Both
  // collapse to the outside node when the part they separate is absent.
  const vos = Number.isFinite(e.vos) && e.vos !== 0 ? e.vos : 0
  const rout = Number.isFinite(e.rout) && e.rout > 0 ? e.rout : 0
  const pin = vos ? `${id}.p` : p
  const core = rout ? `${id}.o` : out

  const parts = []
  if (vos) parts.push({ type: 'V', id: `${id}.Vos`, nodes: [pin, p], value: vos, of: id, from: 'OPAMP' })
  if (Number.isFinite(e.ib) && e.ib !== 0) {
    parts.push({ type: 'I', id: `${id}.Ibp`, nodes: [p, 'gnd'], value: e.ib, of: id, from: 'OPAMP' })
    parts.push({ type: 'I', id: `${id}.Ibn`, nodes: [n, 'gnd'], value: e.ib, of: id, from: 'OPAMP' })
  }
  if (Number.isFinite(e.rin) && e.rin > 0) parts.push({ type: 'R', id: `${id}.Rin`, nodes: [pin, n], value: e.rin, of: id, from: 'OPAMP' })

  // The transconductance stage. Its current limit is what a slew rate is:
  // the capacitor below can only be charged at I_max, so dv/dt tops out at
  // I_max/C, and pwlTransient solves that ramp exactly.
  const cint = Number.isFinite(e.gbw) && e.gbw > 0 ? g / (2 * Math.PI * e.gbw) : 0
  const gm = { type: 'VCCS', id: `${id}.G`, nodes: ['gnd', int], ctrl: [pin, n], gain: g, of: id, from: 'OPAMP' }
  if (cint > 0 && Number.isFinite(e.slew) && e.slew > 0) gm.ilimit = e.slew * cint
  parts.push(gm)

  // Common-mode rejection: the output responds to (v₊ + v₋)/2 as well, by
  // g/CMRR. Two sources rather than one, because a controlled source reads a
  // difference and this one reads a sum.
  if (Number.isFinite(e.cmrr) && e.cmrr > 0) {
    const gc = g / (2 * Math.pow(10, e.cmrr / 20))
    parts.push({ type: 'VCCS', id: `${id}.Gcp`, nodes: ['gnd', int], ctrl: [pin, 'gnd'], gain: gc, of: id, from: 'OPAMP' })
    parts.push({ type: 'VCCS', id: `${id}.Gcn`, nodes: ['gnd', int], ctrl: [n, 'gnd'], gain: gc, of: id, from: 'OPAMP' })
  }

  parts.push({ type: 'R', id: `${id}.Rp`, nodes: [int, 'gnd'], value: rint, of: id, from: 'OPAMP' })
  if (cint > 0) parts.push({ type: 'C', id: `${id}.Cp`, nodes: [int, 'gnd'], value: cint, of: id, from: 'OPAMP' })

  // The output buffer keeps the element's own type, so the rails and the
  // output current limit stay the region model they already are.
  const buf = { type: 'OPAMP', id, nodes: [core], ctrl: [int, 'gnd'], gain: 1, of: id }
  if (Number.isFinite(e.vsat)) buf.vsat = e.vsat
  if (Number.isFinite(e.imax) && e.imax > 0) buf.imax = e.imax
  if (e.label) buf.label = e.label
  parts.push(buf)
  if (rout) parts.push({ type: 'R', id: `${id}.Rout`, nodes: [core, out], value: rout, of: id, from: 'OPAMP' })
  return parts
}
