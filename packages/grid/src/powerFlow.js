// Power flow: Newton on companion stamps, in polar coordinates.
//
// A load takes 1.60 + j0.80 pu whatever its voltage is, so the current it
// draws depends on the answer. That makes the network nonlinear, and `solveAC`
// alone cannot state the problem: it wants a source, and what is given is a
// power.
//
// The iteration is `pwl.js`'s `newtonDC`, line for line. Each pass evaluates
// every bus's injection at the present guess, forms the mismatch, solves one
// linear system, applies the step limit, and stops on the same tolerance.
// Every iteration is kept in `iters`, so the view shows the mismatch falling
// the way Circuit Elements Lab's i2 shows a diode's voltage settling.
//
// One thing is forced and is worth stating. A constant-power injection draws
// `I = (P − jQ)/V*`, which is not a differentiable function of the complex V,
// so no complex admittance is its tangent. The tangent exists in the real pair
// (θ, |V|). So this Newton runs in real coordinates over (θ, |V|), and a bus's
// companion returns a real block rather than a complex admittance
// (GRID_LAB_PLAN.md Decision 2). The interface's shape is the Electronics
// Lab's: `g` is the block, `i` is the mismatch, `region` is the bus type in
// force, and `limit` clamps the step.
//
// The three bus types are three companions.
//
//   slack  no equation and no unknown. Its angle is the reference and its
//          magnitude is held. At readout it absorbs the load it does not
//          supply plus every watt of loss.
//   pq     two equations, two unknowns. Its mismatch is the scheduled P and Q
//          less the injections the matrix computes.
//   pv     one equation, one unknown. A generator holds its magnitude, so the
//          ∂/∂|V| column and the Q row are both absent. Its reactive output is
//          read out after convergence rather than solved for.
//
// A PV bus with reactive limits changes region the way a MOSFET crosses into
// triode. When the reading Q leaves [Qmin, Qmax] the bus becomes a PQ bus, Q
// is pinned at the limit it crossed, and |V| is set free. The conversion is
// recorded in that iteration's `region` map and the pane prints it.

import { solve } from '@ee-labs/network'
import { C, cadd } from './cx.js'
import { branchFlows, gbOf, injections, phasors, ybus } from './network.js'

/** The message a run that did not settle gives instead of a number. */
export class PowerFlowError extends Error {
  constructor(message, detail = {}) {
    super(message)
    this.name = 'PowerFlowError'
    this.kind = 'no-solution'
    Object.assign(this, detail)
  }
}

/**
 * The injections at one guess, from the matrix.
 *
 *     P_i = V_i Σ_k V_k (G_ik cos θ_ik + B_ik sin θ_ik)
 *     Q_i = V_i Σ_k V_k (G_ik sin θ_ik − B_ik cos θ_ik)
 */
export function injectionsAt(G, B, V, theta) {
  const n = V.length
  const P = new Array(n).fill(0)
  const Q = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    let p = 0
    let q = 0
    for (let k = 0; k < n; k++) {
      const th = theta[i] - theta[k]
      const c = Math.cos(th)
      const s = Math.sin(th)
      p += V[k] * (G[i][k] * c + B[i][k] * s)
      q += V[k] * (G[i][k] * s - B[i][k] * c)
    }
    P[i] = V[i] * p
    Q[i] = V[i] * q
  }
  return { P, Q }
}

/**
 * One bus's companion at the present guess: its rows of the Jacobian, its
 * mismatch, the region it is in, and the step limit that keeps a magnitude
 * positive.
 *
 * `state` is `{ G, B, V, theta, P, Q, region }` for the whole network, and `i`
 * is this bus's index. The returned `g` is keyed by the unknown it multiplies,
 * so the assembler does not have to know which columns a bus type contributes.
 */
export function busCompanion(net, i, state) {
  const { G, B, V, theta, P, Q, region } = state
  const bus = net.buses[i]
  const kind = region[bus.id]
  if (kind === 'slack') return { id: bus.id, region: 'slack', rows: [], g: {}, i: [], limit: (x) => x }
  const n = V.length
  const dP = { theta: new Array(n).fill(0), V: new Array(n).fill(0) }
  const dQ = { theta: new Array(n).fill(0), V: new Array(n).fill(0) }
  for (let k = 0; k < n; k++) {
    if (k === i) continue
    const th = theta[i] - theta[k]
    const c = Math.cos(th)
    const s = Math.sin(th)
    dP.theta[k] = V[i] * V[k] * (G[i][k] * s - B[i][k] * c)
    dP.V[k] = V[i] * (G[i][k] * c + B[i][k] * s)
    dQ.theta[k] = -V[i] * V[k] * (G[i][k] * c + B[i][k] * s)
    dQ.V[k] = V[i] * (G[i][k] * s - B[i][k] * c)
  }
  dP.theta[i] = -Q[i] - B[i][i] * V[i] * V[i]
  dP.V[i] = P[i] / V[i] + G[i][i] * V[i]
  dQ.theta[i] = P[i] - G[i][i] * V[i] * V[i]
  dQ.V[i] = Q[i] / V[i] - B[i][i] * V[i]
  // A bus that holds its magnitude contributes one equation and one unknown.
  // A bus that does not contributes two of each, whether it was born a PQ bus
  // or became one at its reactive limit.
  const free = kind === 'pq' || kind === 'pqLimited'
  const Qsch = kind === 'pqLimited' ? state.Qpin[bus.id] : bus.Q
  const mismatch = free ? [bus.P - P[i], Qsch - Q[i]] : [bus.P - P[i]]
  return {
    id: bus.id,
    region: kind,
    rows: free ? ['P', 'Q'] : ['P'],
    g: { P: dP, Q: dQ },
    i: mismatch,
    /** A magnitude may not be stepped below a tenth of its present value. */
    limit: (next, now) => Math.max(0.1 * now, Math.min(2 * now, next)),
  }
}

const isPQ = (kind) => kind === 'pq' || kind === 'pqLimited'

/**
 * Solve the power flow. Returns the converged voltages, every iteration, the
 * branch flows, the losses, and the region each bus ended in.
 *
 * @param opts.tol      the mismatch, in per unit, that stops the iteration
 * @param opts.maxIter  the cap past which the run has not converged
 * @param opts.limits   honour a PV bus's Qmin and Qmax by conversion to PQ
 * @param opts.flat     start from 1.00∠0 at every bus rather than the setpoints
 */
export function powerFlow(net, opts = {}) {
  const { tol = 1e-12, maxIter = 30, limits = true, flat = true, stepping = true } = opts
  const Y = ybus(net)
  const { G, B } = gbOf(Y)
  const n = net.n

  const run = (scale, start) => {
    const V = net.buses.map((b, k) => (start ? start.V[k] : b.type === 'pq' || flat ? 1 : b.V))
    const theta = net.buses.map((b, k) => (start ? start.theta[k] : 0))
    for (let k = 0; k < n; k++) if (net.buses[k].type !== 'pq') V[k] = net.buses[k].V
    const region = Object.fromEntries(net.buses.map((b) => [b.id, b.type]))
    const Qpin = {}
    const iters = []
    const conversions = []
    let converged = false
    for (let it = 0; it < maxIter && !converged; it++) {
      const { P, Q } = injectionsAt(G, B, V, theta)
      // A PV bus that cannot make the reactive power it is being asked for
      // gives up its voltage instead. The check runs before the mismatch, so
      // the iteration that converts is the iteration that shows it.
      if (limits) {
        for (let k = 0; k < n; k++) {
          const bus = net.buses[k]
          if (region[bus.id] !== 'pv') continue
          if (Q[k] > bus.Qmax || Q[k] < bus.Qmin) {
            const pin = Q[k] > bus.Qmax ? bus.Qmax : bus.Qmin
            region[bus.id] = 'pqLimited'
            Qpin[bus.id] = pin
            V[k] = bus.V
            conversions.push({ iteration: it, bus: bus.id, Q: Q[k], pinnedAt: pin, to: 'pq' })
          }
        }
        // A bus that has come back inside its limit takes its voltage back.
        // The test is the voltage rather than the reactive power, because a
        // pinned bus reads its limit by construction: a bus pinned at Qmax
        // whose magnitude has risen above its setpoint no longer needs the
        // reactive power the limit denied it.
        for (let k = 0; k < n; k++) {
          const bus = net.buses[k]
          if (region[bus.id] !== 'pqLimited') continue
          const pinnedHigh = Qpin[bus.id] === bus.Qmax
          if ((pinnedHigh && V[k] > bus.V) || (!pinnedHigh && V[k] < bus.V)) {
            region[bus.id] = 'pv'
            delete Qpin[bus.id]
            V[k] = bus.V
            conversions.push({ iteration: it, bus: bus.id, Q: Q[k], pinnedAt: null, to: 'pv' })
          }
        }
      }
      const state = { G, B, V, theta, P, Q, region, Qpin }
      // The unknowns, in the order the Jacobian's columns take them: every
      // angle but the slack's, then every magnitude a bus does not hold.
      const cols = []
      for (let k = 0; k < n; k++) if (region[net.buses[k].id] !== 'slack') cols.push({ k, of: 'theta' })
      for (let k = 0; k < n; k++) if (isPQ(region[net.buses[k].id])) cols.push({ k, of: 'V' })
      const comps = net.buses.map((_, k) => busCompanion(net, k, state))
      const J = []
      const r = []
      const rowsOf = []
      for (let k = 0; k < n; k++) {
        const comp = comps[k]
        comp.rows.forEach((name, ri) => {
          J.push(cols.map(({ k: c, of }) => comp.g[name][of][c]))
          r.push(comp.i[ri])
          rowsOf.push({ bus: net.buses[k].id, row: name })
        })
      }
      const mismatch = r.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
      // The scale is source stepping's: at α < 1 the schedule is ramped, and
      // the mismatch reported is the one at the schedule actually being solved.
      let dx
      try {
        dx = J.length ? solve(J, r) : []
      } catch (err) {
        // A singular Jacobian is the nose of the P–V curve arriving, and it is
        // this run's answer rather than an internal failure.
        iters.push({ k: it, mismatch, step: NaN, rows: rowsOf, region: { ...region }, V: V.slice(), theta: theta.slice(), J, r, singular: true })
        return { V, theta, region, Qpin, iters, conversions, converged: false, scale, singular: err }
      }
      const before = { V: V.slice(), theta: theta.slice() }
      cols.forEach(({ k, of }, c) => {
        if (of === 'theta') theta[k] += dx[c]
        else V[k] = comps[k].limit(V[k] + dx[c], V[k])
      })
      const step = dx.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
      iters.push({
        k: it,
        mismatch,
        step,
        rows: rowsOf,
        region: { ...region },
        V: before.V,
        theta: before.theta,
        J,
        r,
      })
      converged = mismatch <= tol
      if (!Number.isFinite(mismatch) || !Number.isFinite(step)) break
    }
    return { V, theta, region, Qpin, iters, conversions, converged, scale }
  }

  let out = run(1, opts.start || null)
  const steps = []
  if (!out.converged && stepping) {
    // Source stepping, in the loading rather than in the sources: ramp every
    // scheduled injection from a tenth of itself and carry the answer forward.
    // Near the nose of the P–V curve the direct solve overshoots, and the ramp
    // gives each solve a start close to its own answer.
    let start = null
    let last = null
    const eased = net.buses.map((b) => ({ ...b }))
    for (let s = 1; s <= 10; s++) {
      const alpha = s / 10
      const scaled = {
        ...net,
        buses: eased.map((b) => (b.type === 'slack' ? b : { ...b, P: b.P * alpha, Q: b.Q * alpha })),
      }
      last = powerFlow(scaled, { ...opts, stepping: false, flat: start === null, start })
      steps.push({ alpha, iterations: last.iters.length, converged: last.converged })
      if (!last.converged) break
      start = { V: last.V, theta: last.theta }
    }
    // The last step is the schedule itself, so its answer is this network's
    // answer and it is already read out. Nothing is scaled at the end.
    if (last && last.converged) return { ...last, steps, stepped: true }
  }
  if (!out.converged)
    throw new PowerFlowError(
      `The power flow did not settle in ${maxIter} iterations. Past the nose of the P–V curve there is no solution at this loading, and the Jacobian is close to singular as that point is approached.`,
      { iters: out.iters, steps, lastMismatch: out.iters.length ? out.iters[out.iters.length - 1].mismatch : NaN },
    )

  return readout(net, Y, out, steps)
}

/** Turn a converged run into the answer, through the matrix rather than the iteration. */
function readout(net, Y, out, steps) {
  const { V, theta, region } = out
  const Vc = phasors(V, theta)
  const S = injections(net, Vc, Y)
  const flows = branchFlows(net, Vc)
  const loss = flows.reduce((acc, f) => cadd(acc, f.loss), C(0))
  const buses = net.buses.map((b, k) => ({
    id: b.id,
    type: b.type,
    region: region[b.id],
    V: V[k],
    theta: theta[k],
    thetaDeg: (theta[k] * 180) / Math.PI,
    Vc: Vc[k],
    P: S[k][0],
    Q: S[k][1],
    scheduled: { P: b.P, Q: b.Q },
    bus: b,
  }))
  const slack = buses.find((b) => b.type === 'slack')
  return {
    net,
    Y,
    V,
    theta,
    Vc,
    buses,
    byId: Object.fromEntries(buses.map((b) => [b.id, b])),
    flows,
    slack,
    loss,
    Ploss: loss[0],
    Qloss: loss[1],
    iters: out.iters,
    // The Newton updates it took. The last entry of `iters` is the pass that
    // read the mismatch below tolerance and changed nothing, so it is not one
    // of them.
    iterations: Math.max(0, out.iters.length - 1),
    mismatches: out.iters.map((i) => i.mismatch),
    conversions: out.conversions,
    steps,
    converged: true,
    /** What the last Jacobian was, for the equations pane. */
    jacobian: out.iters.length ? out.iters[out.iters.length - 1] : null,
  }
}

/**
 * Every Jacobian entry against a central finite difference of the injection it
 * differentiates. This is the check that the companion is a tangent and not an
 * approximation of one, and the fuzz runs it across the parameter space.
 */
export function jacobianCheck(net, { h = 1e-6 } = {}) {
  const Y = ybus(net)
  const { G, B } = gbOf(Y)
  const n = net.n
  const V = net.buses.map((b) => (b.type === 'pq' ? 1.02 : b.V))
  const theta = net.buses.map((_, k) => 0.01 * (k + 1))
  const { P, Q } = injectionsAt(G, B, V, theta)
  const region = Object.fromEntries(net.buses.map((b) => [b.id, b.type]))
  const state = { G, B, V, theta, P, Q, region, Qpin: {} }
  let worst = 0
  for (let i = 0; i < n; i++) {
    const comp = busCompanion(net, i, state)
    if (!comp.rows.length) continue
    for (const of of ['theta', 'V']) {
      for (let k = 0; k < n; k++) {
        const bump = (d) => {
          const v = V.slice()
          const t = theta.slice()
          if (of === 'theta') t[k] += d
          else v[k] += d
          return injectionsAt(G, B, v, t)
        }
        const up = bump(h)
        const dn = bump(-h)
        for (const name of ['P', 'Q']) {
          const fd = ((name === 'P' ? up.P[i] : up.Q[i]) - (name === 'P' ? dn.P[i] : dn.Q[i])) / (2 * h)
          const got = comp.g[name][of][k]
          const scale = Math.max(1, Math.abs(fd))
          worst = Math.max(worst, Math.abs(got - fd) / scale)
        }
      }
    }
  }
  return worst
}

/**
 * The P–V curve: the low bus's voltage against loading, and the last loading
 * with a solution. Past the nose the iteration has nothing to settle on, and
 * D6 shows that as a refusal with its reason rather than as a number.
 */
export function pvCurve(net, busId, { from = 0.2, to = 4, steps = 60, ...opts } = {}) {
  const points = []
  let last = null
  let reason = null
  for (let k = 0; k <= steps; k++) {
    const alpha = from + ((to - from) * k) / steps
    const scaled = {
      ...net,
      buses: net.buses.map((b) => (b.type === 'pq' ? { ...b, P: b.P * alpha, Q: b.Q * alpha } : b)),
    }
    try {
      const sol = powerFlow(scaled, opts)
      points.push({ alpha, V: sol.byId[busId].V, P: -sol.byId[busId].P, iterations: sol.iterations })
      last = alpha
    } catch (err) {
      if (!(err instanceof PowerFlowError)) throw err
      reason = err.message
      break
    }
  }
  return { points, lastSolved: last, reason, nose: points.length ? points[points.length - 1] : null }
}
