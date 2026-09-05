// The DC power flow, and the guard that governs it.
//
// Three assumptions turn the nonlinear power flow into one linear solve. Drop
// every branch resistance, so there are no losses. Pin every voltage magnitude
// at 1.00 pu. Replace sin θ by θ. What is left is
//
//     θ = B'⁻¹ P,      B'_ik = −1/x_ik,   B'_ii = Σ 1/x_ik
//
// and the branch flow is (θ_i − θ_k)/x_ik.
//
// That is an approximation under Rule 3 of CORE_SCOPE.md, so it ships with a
// guard whose threshold comes from measurement. GRID_LAB_PLAN.md §2.7 gives
// the measurement on the three-bus system at five loadings, and it settles
// which assumption costs the most. At the base case the largest branch angle
// is under five degrees, where sin θ and θ differ by about half of a tenth of
// a percent, while the branch-flow error is several percent. The small-angle
// step is worth almost nothing. The error comes from the resistance and from
// the voltage magnitude.
//
// So the guard is written on what it measures.
//
//   warn    any branch angle past 10°, any bus magnitude outside 0.95 to 1.05,
//           or any branch with R/X above 0.25
//   refuse  any branch angle past 30°, where the linear solve and the AC solve
//           can disagree about which way a branch carries power
//
// Both thresholds are stated on the pane and exercised at both sides by a test.

import { solve } from '@ee-labs/network'
import { powerFlow } from './powerFlow.js'

/** The angles past which the DC flow warns, and past which it declines the arrows. */
export const DC_WARN_DEG = 10
export const DC_REFUSE_DEG = 30
/** The ratio past which a branch's resistance is too big for a lossless model. */
export const DC_RX_LIMIT = 0.25
/** The band a bus magnitude must stay inside for the 1.00 pu assumption to hold. */
export const DC_V_BAND = [0.95, 1.05]

/**
 * The linear solve. Returns the angle at every bus (the slack's is zero), the
 * flow on every branch, and the matrix it inverted.
 */
export function dcFlow(net) {
  const n = net.n
  const slack = net.buses.findIndex((b) => b.type === 'slack')
  const idx = []
  for (let k = 0; k < n; k++) if (k !== slack) idx.push(k)
  const m = idx.length
  const B = Array.from({ length: m }, () => new Array(m).fill(0))
  const P = idx.map((k) => net.buses[k].P)
  const at = new Map(idx.map((k, r) => [k, r]))
  for (const br of net.branches) {
    const f = net.index.get(br.from)
    const t = net.index.get(br.to)
    const b = 1 / (br.x * br.tap)
    if (at.has(f)) B[at.get(f)][at.get(f)] += b
    if (at.has(t)) B[at.get(t)][at.get(t)] += b
    if (at.has(f) && at.has(t)) {
      B[at.get(f)][at.get(t)] -= b
      B[at.get(t)][at.get(f)] -= b
    }
  }
  const x = m ? solve(B, P) : []
  const theta = new Array(n).fill(0)
  idx.forEach((k, r) => (theta[k] = x[r]))
  const flows = net.branches.map((br) => {
    const f = net.index.get(br.from)
    const t = net.index.get(br.to)
    return { id: br.id, from: br.from, to: br.to, Pf: (theta[f] - theta[t] - br.shift) / (br.x * br.tap), angle: theta[f] - theta[t] }
  })
  // The slack takes what is left, and in a lossless model that is exactly the
  // rest of the schedule.
  const slackP = -net.buses.reduce((s, b, k) => s + (k === slack ? 0 : b.P), 0)
  return { theta, flows, B, slack: net.buses[slack].id, slackP, buses: net.buses.map((b, k) => ({ id: b.id, theta: theta[k] })) }
}

/**
 * The guard, read off an AC solution: the largest branch angle, the widest
 * magnitude excursion, the largest R/X, and what each one means.
 */
export function dcGuard(sol) {
  const maxAngle = sol.flows.reduce((m, f) => Math.max(m, Math.abs(f.angle)), 0)
  const rx = sol.flows.reduce((m, f) => Math.max(m, f.branch.x > 0 ? Math.abs(f.branch.r / f.branch.x) : Infinity), 0)
  const mags = sol.buses.map((b) => b.V)
  const minV = Math.min(...mags)
  const maxV = Math.max(...mags)
  const warnDeg = (maxAngle * 180) / Math.PI > DC_WARN_DEG
  const warnV = minV < DC_V_BAND[0] || maxV > DC_V_BAND[1]
  const warnRX = rx > DC_RX_LIMIT
  const refuse = (maxAngle * 180) / Math.PI > DC_REFUSE_DEG
  const reasons = []
  if (warnDeg) reasons.push(`a branch angle of ${((maxAngle * 180) / Math.PI).toFixed(2)}°, past the ${DC_WARN_DEG}° the linear solve is written for`)
  if (warnV) reasons.push(`a bus magnitude of ${minV.toFixed(4)} pu, outside the ${DC_V_BAND[0]} to ${DC_V_BAND[1]} band the model pins every magnitude to`)
  if (warnRX) reasons.push(`a branch with R/X of ${rx.toFixed(3)}, past the ${DC_RX_LIMIT} a lossless model is written for`)
  return {
    maxAngle,
    minV,
    maxV,
    rx,
    warn: warnDeg || warnV || warnRX,
    refuse,
    reasons,
    text: reasons.length ? `The DC power flow is off its assumptions here: ${reasons.join(', ')}.` : 'Every branch angle, bus magnitude and R/X ratio is inside the range the DC power flow is written for.',
    refusal: refuse
      ? `Past ${DC_REFUSE_DEG}° the linear solve and the AC solve can disagree about which way a branch carries power, so the flow arrows are not drawn from the DC angles here.`
      : null,
  }
}

/**
 * The DC answer against the AC answer on the same network: the angle at every
 * bus, the flow on every branch, and the largest error of each.
 */
export function dcCompare(net, opts = {}) {
  const dc = dcFlow(net)
  const sol = opts.ac || powerFlow(net, opts)
  const buses = net.buses.map((b, k) => ({
    id: b.id,
    dc: dc.theta[k],
    ac: sol.theta[k],
    error: dc.theta[k] - sol.theta[k],
  }))
  const branches = net.branches.map((br, k) => {
    const acFlow = sol.flows[k].Pf
    const dcF = dc.flows[k].Pf
    return { id: br.id, dc: dcF, ac: acFlow, error: Math.abs(acFlow) > 1e-12 ? (dcF - acFlow) / acFlow : 0 }
  })
  // Two readings of the same disagreement. `error` is per branch, which is
  // what E1 and E2 quote. `scaled` is against the largest flow the network
  // carries, because a branch carrying a hundredth of a per unit can be 100 %
  // wrong and still be 0.0001 pu wrong, and a guard written on the first
  // reading would be answering the wrong question.
  const largest = branches.reduce((m, r) => Math.max(m, Math.abs(r.ac)), 0) || 1
  for (const r of branches) r.scaled = Math.abs(r.dc - r.ac) / largest
  return {
    dc,
    ac: sol,
    buses,
    branches,
    maxAngleError: buses.reduce((m, r) => Math.max(m, Math.abs(r.error)), 0),
    maxError: branches.reduce((m, r) => Math.max(m, Math.abs(r.error)), 0),
    maxErrorScaled: branches.reduce((m, r) => Math.max(m, r.scaled), 0),
    largestFlow: largest,
    guard: dcGuard(sol),
  }
}

/**
 * What each assumption costs on its own, which is E2's measurement.
 *
 * `resistance` is the AC solve with every branch resistance set to zero.
 * `magnitude` is the AC solve with the magnitudes pinned by a very stiff
 * network of PV buses. `smallAngle` is the largest sin θ against θ difference
 * at the true solution, which is the assumption the name of the method
 * suggests and the one that costs the least.
 */
export function assumptionCost(net, sol) {
  const lossless = powerFlow({ ...net, branches: net.branches.map((br) => ({ ...br, r: 0 })) })
  const maxAngle = sol.flows.reduce((m, f) => Math.max(m, Math.abs(f.angle)), 0)
  const dcOnBase = dcCompare(net, { ac: sol })
  const dcOnLossless = dcCompare({ ...net, branches: net.branches.map((br) => ({ ...br, r: 0 })) }, { ac: lossless })
  return {
    maxAngle,
    sinTheta: Math.sin(maxAngle),
    smallAngleError: (maxAngle - Math.sin(maxAngle)) / Math.sin(maxAngle),
    withResistance: dcOnBase.maxError,
    withoutResistance: dcOnLossless.maxError,
    losslessMinV: Math.min(...lossless.buses.map((b) => b.V)),
  }
}
