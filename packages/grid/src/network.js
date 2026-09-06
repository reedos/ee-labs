// The network: buses, branches, and the bus admittance matrix.
//
// A power system is drawn as a one-line diagram, so its data is one bus list
// and one branch list rather than a netlist of two-terminal elements. Every
// quantity here is per unit on the system base (perUnit.js), which is what
// makes the transformer's turns ratio disappear.
//
// The matrix is the ordinary nodal admittance matrix. For a branch of series
// admittance y between buses f and t, with total line charging b split between
// the two ends and an off-nominal tap `a = tap · e^{j shift}` on the f side:
//
//     Y_ff += y/|a|² + jb/2      Y_ft -= y/conj(a)
//     Y_tt += y     + jb/2       Y_tf -= y/a
//
// A line is that with a = 1, so the two cases are one stamp. GRID_LAB_PLAN.md
// §2.3 gives the three-bus system's matrix, and `network.test.js` pins every
// entry against a hand-built one.
//
// Bus positions travel with the network, in the idiom
// `packages/ui/src/schematicGeometry.js` already uses, so the one-line canvas
// draws the same network the solver solves.

import { C, cabs, cadd, cdiv, cmul, conj, cscale, csub } from './cx.js'

/** A bus's type decides what it holds fixed and what it contributes. */
export const BUS_TYPES = ['slack', 'pv', 'pq']

// A deep copy that keeps what JSON does not: a bus with no reactive limit
// carries Infinity, and JSON turns that into null.
const clone = (o) =>
  Array.isArray(o) ? o.map(clone) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, clone(v)])) : o

/**
 * Fill in a network's defaults and check what a solve depends on.
 *
 * A bus is `{ id, type, V, theta, P, Q, Qmin, Qmax, G, B, x, y }`, where `P`
 * and `Q` are the NET injection scheduled at the bus, generation less load, in
 * per unit. `G` and `B` are a shunt to ground at the bus.
 *
 * A branch is `{ id, from, to, r, x, b, tap, shift }`, with `b` the total line
 * charging susceptance, half at each end.
 */
export function networkOf(spec) {
  const net = clone(spec)
  if (!Array.isArray(net.buses) || !net.buses.length) throw new Error('a network needs at least one bus')
  net.buses = net.buses.map((b, k) => ({
    type: 'pq',
    V: 1,
    theta: 0,
    P: 0,
    Q: 0,
    Qmin: -Infinity,
    Qmax: Infinity,
    G: 0,
    B: 0,
    x: 40 + 120 * k,
    y: 60,
    ...b,
  }))
  for (const b of net.buses) {
    if (!BUS_TYPES.includes(b.type)) throw new Error(`${b.id}: a bus type is slack, pv or pq`)
    if (!(b.V > 0)) throw new Error(`${b.id}: a bus voltage magnitude must be positive`)
    if (b.type === 'pv' && b.Qmin > b.Qmax) throw new Error(`${b.id}: Qmin above Qmax`)
  }
  const slack = net.buses.filter((b) => b.type === 'slack')
  if (slack.length !== 1) throw new Error(`a network needs exactly one slack bus, this one has ${slack.length}`)
  const index = new Map(net.buses.map((b, k) => [b.id, k]))
  net.branches = (net.branches || []).map((br, k) => ({ id: `br${k + 1}`, r: 0, x: 0.1, b: 0, tap: 1, shift: 0, ...br }))
  for (const br of net.branches) {
    if (!index.has(br.from) || !index.has(br.to)) throw new Error(`${br.id}: joins a bus that is not in the list`)
    if (br.from === br.to) throw new Error(`${br.id}: a branch joins two different buses`)
    if (!(Math.hypot(br.r, br.x) > 0)) throw new Error(`${br.id}: a branch needs a nonzero impedance`)
    if (!(br.tap > 0)) throw new Error(`${br.id}: a tap ratio must be positive`)
  }
  net.index = index
  net.n = net.buses.length
  return net
}

/** The series admittance of one branch, `1/(r + jx)`. */
export const branchY = (br) => cdiv(C(1), C(br.r, br.x))

/** The complex tap `a = tap · e^{j shift}`, with the shift in radians. */
export const tapOf = (br) => [br.tap * Math.cos(br.shift), br.tap * Math.sin(br.shift)]

/**
 * The bus admittance matrix, as an n × n array of [re, im] pairs, in bus order.
 */
export function ybus(net) {
  const n = net.n
  const Y = Array.from({ length: n }, () => Array.from({ length: n }, () => C(0)))
  const add = (i, j, z) => (Y[i][j] = cadd(Y[i][j], z))
  for (const br of net.branches) {
    const f = net.index.get(br.from)
    const t = net.index.get(br.to)
    const y = branchY(br)
    const a = tapOf(br)
    const a2 = a[0] * a[0] + a[1] * a[1]
    add(f, f, cadd(cscale(y, 1 / a2), C(0, br.b / 2)))
    add(t, t, cadd(y, C(0, br.b / 2)))
    add(f, t, cscale(cdiv(y, conj(a)), -1))
    add(t, f, cscale(cdiv(y, a), -1))
  }
  net.buses.forEach((b, k) => add(k, k, C(b.G, b.B)))
  return Y
}

/** The real and imaginary parts of the matrix, which the Jacobian reads. */
export function gbOf(Y) {
  return { G: Y.map((row) => row.map((z) => z[0])), B: Y.map((row) => row.map((z) => z[1])) }
}

/** Bus voltage phasors from magnitudes and angles. */
export const phasors = (V, theta) => V.map((v, k) => [v * Math.cos(theta[k]), v * Math.sin(theta[k])])

/**
 * The complex power injected at every bus by the network, `S = V · (Y V)*`.
 * This is the readout the power flow's answer is checked against, and it uses
 * the matrix rather than the iteration, so invariant 1 is not circular.
 */
export function injections(net, Vc, Y = ybus(net)) {
  const n = net.n
  const out = []
  for (let i = 0; i < n; i++) {
    let sum = C(0)
    for (let k = 0; k < n; k++) sum = cadd(sum, cmul(Y[i][k], Vc[k]))
    out.push(cmul(Vc[i], conj(sum)))
  }
  return out
}

/**
 * Every branch's flow at both of its ends, its loss, and the current in it.
 *
 * The flow leaving bus f is `V_f · I_ft*`, with the current taken through the
 * series admittance and the sending-end shunt. Signs are the network's: a
 * positive `Sf` leaves bus f along the branch.
 */
export function branchFlows(net, Vc) {
  return net.branches.map((br) => {
    const f = net.index.get(br.from)
    const t = net.index.get(br.to)
    const y = branchY(br)
    const a = tapOf(br)
    const a2 = a[0] * a[0] + a[1] * a[1]
    const Vf = Vc[f]
    const Vt = Vc[t]
    // The same four entries the matrix was stamped from, so a flow and the
    // injection it feeds cannot disagree.
    const If = csub(cmul(cadd(cscale(y, 1 / a2), C(0, br.b / 2)), Vf), cmul(cdiv(y, conj(a)), Vt))
    const It = csub(cmul(cadd(y, C(0, br.b / 2)), Vt), cmul(cdiv(y, a), Vf))
    const Sf = cmul(Vf, conj(If))
    const St = cmul(Vt, conj(It))
    const loss = cadd(Sf, St)
    const Iseries = cmul(csub(cdiv(Vf, a), Vt), y)
    return {
      id: br.id,
      from: br.from,
      to: br.to,
      branch: br,
      Sf,
      St,
      Pf: Sf[0],
      Qf: Sf[1],
      Pt: St[0],
      Qt: St[1],
      loss,
      Ploss: loss[0],
      Qloss: loss[1],
      Iseries,
      Imag: cabs(Iseries),
      angle: Math.atan2(Vf[1], Vf[0]) - br.shift - Math.atan2(Vt[1], Vt[0]),
    }
  })
}

/**
 * The losses summed two ways: from the branch currents, and as the difference
 * between what is injected and what is taken. Invariant 2 requires the two to
 * agree to floating point.
 */
export function lossAudit(net, Vc, Y = ybus(net)) {
  const S = injections(net, Vc, Y)
  const injected = S.reduce((acc, s) => cadd(acc, s), C(0))
  const flows = branchFlows(net, Vc)
  const branchLoss = flows.reduce((acc, f) => cadd(acc, f.loss), C(0))
  // A shunt at a bus, and the line charging, are not losses. The reactive
  // audit has to carry them, and the real audit is untouched by them because
  // both are lossless.
  const shunt = net.buses.reduce((acc, b, k) => {
    const v2 = Vc[k][0] ** 2 + Vc[k][1] ** 2
    return cadd(acc, C(b.G * v2, -b.B * v2))
  }, C(0))
  return {
    injections: S,
    injected,
    flows,
    branchLoss,
    shunt,
    Ploss: branchLoss[0],
    residual: injected[0] - branchLoss[0] - shunt[0],
  }
}
