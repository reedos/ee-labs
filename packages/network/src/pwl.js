// Piecewise-linear circuits: which region, and when it changes.
//
// Everything else in this package solves ONE linear circuit. A diode or a
// railed op-amp asks a question first — which region is it in? — and there are
// only three ways anybody answers it:
//
//   assumedState  guess, solve, check the guess against its own answer. Two
//                 diodes give four guesses, three of which contradict
//                 themselves. This is the method a textbook teaches and the
//                 one I3 puts on screen, contradictions and all.
//   newtonDC      for the exponential diode, whose law is a curve and not two
//                 straight pieces: linearise at a guess, solve, repeat. The
//                 iterations are kept because watching them converge is the
//                 lesson of I2 ("this is what a simulator does").
//   pwlTransient  in time: solve exactly inside a region, find the instant a
//                 region ends by bisection on that exact solution, carry the
//                 state across (it is continuous) and go on. No timestep, so a
//                 rectifier's conduction angle is a number, not an estimate.
//
// The regions and their guards live in diode.js; this file is the search.

import { NetworkError, normalize } from './netlist.js'
import { solveDC } from './mna.js'
import { diodeOf, flipTo, regionDevices, regionLabel, regionMargins, regionsOf } from './diode.js'
import { transient, bisect } from './transient.js'
import { initialConditions } from './dynamics.js'
import { sourceValue } from './waves.js'

/**
 * The scale a margin is judged against. Currents and voltages in one circuit
 * can be milliamps and kilovolts at once, so "is this zero?" has to be asked
 * relative to the size of the numbers in the answer, never against a fixed
 * epsilon — a lesson this suite has learned the hard way.
 */
export function solutionScale(sol) {
  let v = 0
  let i = 0
  for (const key of Object.keys(sol.volt)) v = Math.max(v, Math.abs(sol.volt[key]))
  for (const key of Object.keys(sol.i)) i = Math.max(i, Math.abs(sol.i[key]))
  return { v: v || 1, i: i || 1 }
}

const marginTol = (m, scale) => 1e-9 * (m.what === 'i' ? scale.i : scale.v)

/**
 * Assume, solve, check — every combination, with the reason each rejected one
 * rejects itself. Returns the consistent assignments (usually exactly one) and
 * the full enumeration, which is what the assumed-state view draws.
 */
export function assumedState(net, opts = {}) {
  const norm = net.nodeNames ? net : normalize(net)
  const devices = regionDevices(norm)
  if (!devices.length) return { consistent: [{ regions: {}, sol: solveDC(norm, opts) }], tried: [], devices }

  const combos = devices.reduce(
    (acc, d) => acc.flatMap((r) => d.regions.map((region) => ({ ...r, [d.id]: region }))),
    [{}],
  )
  const tried = []
  const consistent = []
  for (const regions of combos) {
    const row = { regions, ok: false, sol: null, checks: [], why: null }
    try {
      const sol = solveDC(norm, { ...opts, regions })
      const scale = solutionScale(sol)
      row.sol = sol
      let ok = true
      for (const d of devices) {
        for (const m of regionMargins(d.element, regions[d.id], sol)) {
          const held = m.margin >= -marginTol(m, scale)
          row.checks.push({ id: d.id, region: regions[d.id], ...m, held })
          if (!held) {
            ok = false
            if (!row.why)
              row.why = `${d.id} was assumed ${regionLabel(d.element, regions[d.id])}, but then ${m.says} fails: ${fmtMargin(m, d.element, row.sol)}.`
          }
        }
      }
      row.ok = ok
      if (ok) consistent.push({ regions, sol, checks: row.checks })
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err
      // A region can make the circuit itself impossible — a node with nothing
      // conducting to ground once both diodes are open. That is a rejection
      // like any other, with the solver's own reason.
      row.why = err.message
      row.error = err
    }
    tried.push(row)
  }
  return { consistent, tried, devices }
}

/**
 * Nothing fits. The useful half of that message is not "nothing fits" but what
 * each candidate said as it failed — and when a candidate could not even be
 * solved (a conducting ideal diode between a source and a capacitor is a loop
 * of voltage sources), that solver refusal is the real answer, so it leads.
 */
function noState(devices, tried) {
  const broke = tried.find((t) => t.error)
  const reasons = tried
    .filter((t) => t.why)
    .slice(0, 4)
    .map((t) => `  · ${devices.map((d) => `${d.id} ${t.regions[d.id]}`).join(', ')} — ${t.why}`)
  return new NetworkError(
    'no-state',
    broke
      ? `No combination of ${devices.map((d) => d.id).join(', ')} works here. ${broke.why}`
      : `No assumed state is consistent: every combination of ${devices.map((d) => d.id).join(', ')} contradicts itself once solved.\n${reasons.join('\n')}`,
    { tried, cause: broke?.error },
  )
}

const fmtMargin = (m, e, sol) => {
  const i = sol.i[e.id]
  const v = sol.volt[e.id]
  if (m.what === 'i') return `i_${e.id} = ${sig(i)} A`
  if (m.what === 'diff') return `v₊ − v₋ = ${sig(sol.v[e.ctrl[0]] - sol.v[e.ctrl[1]])} V`
  if (m.what === 'high' || m.what === 'low') return `v_out = ${sig(sol.v[e.nodes[0]])} V`
  return `v_${e.id} = ${sig(v)} V`
}
const sig = (x) => (Math.abs(x) < 1e-12 ? '0' : Number(x.toPrecision(3)).toString())

/**
 * The DC solution of a piecewise-linear circuit: the one consistent state.
 *
 * More than one consistent state is not a bug — it is what positive feedback
 * means, and the Schmitt trigger of E9 lives on it. Without a history to say
 * which one holds, the refusal says so rather than picking.
 */
export function solvePWL(net, opts = {}) {
  const { consistent, tried, devices } = assumedState(net, opts)
  if (consistent.length === 1) return { ...consistent[0], tried, devices }
  if (consistent.length === 0) throw noState(devices, tried)
  if (opts.prefer) {
    const want = consistent.find((c) => devices.every((d) => c.regions[d.id] === opts.prefer[d.id]))
    if (want) return { ...want, tried, devices }
  }
  throw new NetworkError(
    'multi-state',
    `${consistent.length} states are consistent at once, so this circuit's answer depends on how it got here — that is hysteresis, not an error. Ask for it in time, from a starting state, rather than as a DC operating point.`,
    { tried, states: consistent.map((c) => c.regions) },
  )
}

// ------------------------------------------------------------ Newton

/**
 * SPICE's junction limiting: an exponential rises so fast that an unguarded
 * Newton step overflows on the first iteration. This is the standard damping —
 * beyond the critical voltage the step is taken in the log, not in volts.
 */
export function pnjlim(vnew, vold, vt, vcrit) {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt
      return arg > 0 ? vold + vt * Math.log(arg) : vcrit
    }
    return vnew > 0 ? vt * Math.log(vnew / vt) : vnew
  }
  return vnew
}

/** The voltage above which the exponential is steeper than the limiter allows. */
export const vcritOf = (d) => d.n * d.vt * Math.log((d.n * d.vt) / (Math.SQRT2 * d.is))

/**
 * The DC operating point of a circuit with exponential diodes, by
 * Newton–Raphson on the companion linearisation, every iteration kept.
 *
 * Each iteration replaces the curve by its tangent at the current guess — a
 * conductance g = di/dv beside a current source — solves that linear circuit,
 * and reads the new voltage off the answer. Near the solution the error
 * squares each time, which is why five iterations is a lot and fifty is a
 * circuit that is not converging.
 */
export function newtonDC(net, opts = {}) {
  const norm = net.nodeNames ? net : normalize(net)
  const diodes = norm.elements.filter((e) => e.type === 'D' && diodeOf(e).model === 'exp').map((e) => ({ e, d: diodeOf(e) }))
  if (!diodes.length) return { sol: solveDC(norm, opts), iters: [], converged: true }
  const { maxIter = 100, vtol = 1e-12, reltol = 1e-12 } = opts

  const v = new Map(diodes.map(({ e, d }) => [e.id, Math.min(0.5, vcritOf(d))]))
  const iters = []
  let sol = null
  let converged = false
  for (let k = 0; k < maxIter && !converged; k++) {
    const companions = {}
    const before = {}
    for (const { e, d } of diodes) {
      const vk = v.get(e.id)
      const ex = Math.exp(vk / (d.n * d.vt))
      const i = d.is * (ex - 1)
      const g = (d.is / (d.n * d.vt)) * ex
      companions[e.id] = { g, i0: i - g * vk }
      before[e.id] = { v: vk, i, g }
    }
    sol = solveDC(norm, { ...opts, companions })
    let step = 0
    const after = {}
    for (const { e, d } of diodes) {
      const raw = sol.volt[e.id]
      const limited = pnjlim(raw, before[e.id].v, d.n * d.vt, vcritOf(d))
      step = Math.max(step, Math.abs(limited - before[e.id].v))
      after[e.id] = limited
      v.set(e.id, limited)
    }
    const scale = Math.max(...diodes.map(({ e }) => Math.abs(after[e.id])), 1e-3)
    iters.push({
      k,
      v: { ...before },
      next: { ...after },
      step,
      residual: sol.maxResidual,
    })
    converged = step <= vtol + reltol * scale
  }
  if (!converged)
    throw new NetworkError(
      'newton',
      `Newton's method did not settle in ${maxIter} iterations. An exponential is a steep curve; if the circuit has no operating point (a diode driven backwards through a current source, say) there is nothing for it to settle on.`,
      { iters },
    )
  // One last solve at the converged voltages, so the readout matches the point.
  const companions = {}
  for (const { e, d } of diodes) {
    const vk = v.get(e.id)
    const ex = Math.exp(vk / (d.n * d.vt))
    companions[e.id] = { g: (d.is / (d.n * d.vt)) * ex, i0: d.is * (ex - 1) - (d.is / (d.n * d.vt)) * ex * vk }
  }
  return { sol: solveDC(norm, { ...opts, companions }), iters, converged, v: Object.fromEntries(v) }
}

// ------------------------------------------------------------ in time

const EVENT_LIMIT = 2000

/**
 * The response of a piecewise-linear circuit in time.
 *
 * Inside a region the circuit is linear and transient() solves it exactly; the
 * region ends where one of its guards reaches zero, and that instant is found
 * by bisection on the exact solution, not by looking between samples. At the
 * event the states carry straight over — a capacitor's voltage and an
 * inductor's current are continuous through any switching, which is the whole
 * reason they are the states — and the next region starts from them.
 *
 * Returns the same shape transient() does (t, series, at, samples) plus `runs`,
 * one per region, and `events`, the instants and what changed at each.
 */
export function pwlTransient(net, { tEnd, points = 601, opts = {}, x0 = null, start = null } = {}) {
  const norm = net.nodeNames ? net : normalize(net)
  const devices = regionDevices(norm)
  for (const e of norm.elements)
    if (e.type === 'D' && !regionsOf(e))
      throw new NetworkError(
        'exp-diode',
        `${e.id} is an exponential diode. Its curve has an operating point at any instant, but no closed-form response in time — and a solver that stepped its way through would report an error this suite could not tell apart from physics. Use the ideal, constant-drop or V_f + r_d model in time, and the exponential for the operating point.`,
        { element: e.id },
      )
  if (!devices.length) return { ...transient(net, { tEnd, points, x0, opts }), runs: [], events: [], regionsAt: () => ({}) }

  // Where it starts: the state before t = 0 (switches in their `before`
  // position), and the region each device is in at that state.
  const ic = x0 ? { x0: x0.slice() } : initialConditions(norm, { ...opts, regions: startRegions(norm, opts) })
  let x = ic.x0
  let t0 = 0
  // Where it starts. An experiment that knows its own history says so (a
  // Schmitt trigger has to: both rails are consistent at t = 0 and only the
  // past decides which); otherwise the assumed-state search is asked.
  let regions = start ? { ...regionsAtState(norm, x, 0, opts), ...start } : regionsAtState(norm, x, 0, opts)

  const runs = []
  const events = []
  for (let guard = 0; ; guard++) {
    if (guard > EVENT_LIMIT)
      throw new NetworkError(
        'chatter',
        `The regions changed more than ${EVENT_LIMIT} times in this window: the circuit is switching faster than the window can show. A diode with no resistance anywhere near it can do this — give the model a slope (V_f + r_d) or the source a source resistance.`,
        { events },
      )
    const tr = transient(net, { tEnd, points, x0: x, t0, opts: { ...opts, regions } })
    const ev = firstEvent(tr, devices, regions, t0, tEnd)
    if (!ev) {
      runs.push({ t0, t1: tEnd, regions, tr })
      break
    }
    runs.push({ t0, t1: ev.t, regions, tr })
    const at = tr.at(ev.t)
    x = at.x
    t0 = ev.t
    const from = regions[ev.id]
    // At the instant of the event the region just left is exactly on its own
    // boundary — its margin is zero, which still counts as holding. Left to
    // itself the search would step straight back into it and the same event
    // would fire for ever, so for this instant that region is closed.
    regions = settle(norm, { ...regions, [ev.id]: ev.to }, x, t0, opts, devices, { [ev.id]: from })
    events.push({ t: ev.t, id: ev.id, from, to: regions[ev.id], says: ev.says, x })
  }

  return stitch(runs, events, devices, tEnd)
}

/** The regions to assume for the pre-t = 0 circuit: whatever is consistent there. */
function startRegions(norm, opts) {
  const switches = {}
  for (const e of norm.elements) if (e.type === 'SW') switches[e.id] = e.before !== undefined ? !!e.before : e.closed !== false
  try {
    const { consistent } = assumedState(norm, { ...opts, switches, before: true })
    if (consistent.length) return consistent[0].regions
  } catch {
    /* fall through to the default: everything off */
  }
  const out = {}
  for (const d of regionDevices(norm)) out[d.id] = d.type === 'OPAMP' ? 'linear' : 'off'
  return out
}

/** The consistent regions with the states frozen at x and the sources read at t. */
function regionsAtState(norm, x, t, opts) {
  const o = frozen(norm, x, t, opts)
  const { consistent, tried, devices } = assumedState(norm, o)
  if (!consistent.length) throw noState(devices, tried)
  return consistent[0].regions
}

/**
 * Solver options with the states pinned at x and every source at its value at
 * t — the resistive circuit at that instant, which is the circuit whose region
 * is in question. The state order is the netlist's, exactly as dynamics.js
 * takes it.
 */
function frozen(norm, x, t, opts) {
  const states = {}
  norm.elements.filter((e) => e.type === 'C' || e.type === 'L').forEach((e, k) => (states[e.id] = x[k]))
  const sources = {}
  for (const e of norm.elements) if (e.type === 'V' || e.type === 'I') sources[e.id] = sourceValue(e, Math.max(0, t))
  return { ...opts, states, sources }
}

/**
 * After a device flips, the others may no longer be consistent with the new
 * circuit — one diode turning off can turn another on in the same instant.
 * Re-check, flip what is contradicted, and repeat; a handful of passes settles
 * every circuit in this course.
 */
function settle(norm, regions, x, t, opts, devices, forbid = {}) {
  let cur = { ...regions }
  for (let pass = 0; pass < devices.length * 4 + 4; pass++) {
    const o = { ...frozen(norm, x, t, opts), regions: cur }
    let sol
    try {
      sol = solveDC(norm, o)
    } catch {
      // This combination is not even solvable; fall back to the enumeration.
      const { consistent, tried } = assumedState(norm, frozen(norm, x, t, opts))
      if (consistent.length) return consistent[0].regions
      throw noState(devices, tried)
    }
    const scale = solutionScale(sol)
    let changed = false
    for (const d of devices) {
      for (const m of regionMargins(d.element, cur[d.id], sol)) {
        if (m.margin < -marginTol(m, scale)) {
          cur = { ...cur, [d.id]: flipTo(d.element, cur[d.id], m.what) }
          changed = true
          break
        }
      }
    }
    if (!changed) return preferRail(norm, cur, x, t, opts, devices, forbid)
  }
  const { consistent, tried } = assumedState(norm, frozen(norm, x, t, opts))
  const allowed = consistent.filter((c) => Object.entries(forbid).every(([id, region]) => c.regions[id] !== region))
  if (allowed.length) return allowed[0].regions
  if (consistent.length) return consistent[0].regions
  throw noState(devices, tried)
}

/**
 * An op-amp that has just left a rail lands, by the neutral move, in its
 * linear region — and for an amplifier coming out of saturation that is
 * exactly right. For POSITIVE feedback it is not: there the other rail is
 * consistent too, and the linear state between them is the unstable one no
 * real circuit sits in. So wherever a rail is available and consistent, it
 * wins. Two solves per op-amp, and only when one is sitting in `linear`.
 */
function preferRail(norm, regions, x, t, opts, devices, forbid = {}) {
  let cur = regions
  for (const d of devices) {
    if (d.type !== 'OPAMP' || cur[d.id] !== 'linear') continue
    for (const rail of ['high', 'low']) {
      if (forbid[d.id] === rail) continue
      const trial = { ...cur, [d.id]: rail }
      try {
        const sol = solveDC(norm, { ...frozen(norm, x, t, opts), regions: trial })
        const scale = solutionScale(sol)
        const holds = devices.every((q) => regionMargins(q.element, trial[q.id], sol).every((m) => m.margin >= -marginTol(m, scale)))
        if (holds) {
          cur = trial
          break
        }
      } catch {
        /* that rail makes the circuit unsolvable; try the other */
      }
    }
  }
  return cur
}

/**
 * The first instant in this run at which a guard reaches zero. The margins are
 * scanned on the run's own sample grid to bracket the crossing, then bisected
 * on the exact evaluator — so the event time is a property of the waveform and
 * not of the grid.
 */
function firstEvent(tr, devices, regions, t0, tEnd) {
  const eps = 1e-12 * (tEnd - 0)
  let best = null
  for (const d of devices) {
    const walls = regionMargins(d.element, regions[d.id], tr.samples[0].sol)
    for (let w = 0; w < walls.length; w++) {
      const margin = (sol) => regionMargins(d.element, regions[d.id], sol)[w].margin
      const f = (t) => margin(tr.at(t).sol)
      let prev = null
      for (const s of tr.samples) {
        const m = margin(s.sol)
        if (prev && s.t > prev.t + eps && prev.m >= 0 && m < 0) {
          // Bracketed: the guard held at the previous sample and does not now.
          const t = bisect(f, prev.t, s.t, 0)
          if (!best || t < best.t) best = { t, id: d.id, to: flipTo(d.element, regions[d.id], walls[w].what), says: walls[w].says }
          break
        }
        prev = { t: s.t, m }
      }
    }
  }
  if (!best) return null
  // An event at the very start would not advance the walk; nudge past it only
  // if the guard really is violated after the nudge, otherwise ignore it.
  if (best.t <= t0 + eps) best.t = Math.min(tEnd, t0 + Math.max(eps, (tEnd - t0) * 1e-12))
  return best.t >= tEnd ? null : best
}

/** One walk out of many runs: the samples in order, and `at(t)` sent to the run that owns t. */
function stitch(runs, events, devices, tEnd) {
  const samples = []
  for (const r of runs) for (const s of r.tr.samples) if (s.t >= r.t0 - 1e-15 && s.t <= r.t1 + 1e-15) samples.push(s)
  samples.sort((a, b) => a.t - b.t)
  const runAt = (t) => {
    for (const r of runs) if (t < r.t1) return r
    return runs[runs.length - 1]
  }
  const at = (t, side = 'right') => {
    if (side === 'left') {
      const prev = runs.find((r) => Math.abs(r.t1 - t) <= 1e-12 * tEnd)
      if (prev) return prev.tr.at(t, 'left')
    }
    return runAt(t).tr.at(t, side)
  }
  const first = runs[0].tr
  const t = Float64Array.from(samples, (s) => s.t)
  const series = (q, key) => Float64Array.from(samples, (s) => (q === 'x' ? s.x[key] : q === 'u' ? s.u[key] : s.sol[q][key]))
  // Each run solves from its own start all the way to tEnd, so its segment
  // list runs past the event that ended it. Publishing them all would hand
  // anything that looks a time up in `segments` — energies(), for one — two
  // overlapping answers and no way to choose. Keep only the part of each run
  // that the walk actually used.
  // Each segment also carries the state space it was solved in, because across
  // a walk that is not one thing: a conducting diode and a blocking one are
  // different circuits, and anything integrating over a segment (energies())
  // has to solve in the right one.
  const segments = runs.flatMap((r) =>
    r.tr.segments.filter((s) => s.t0 < r.t1 - 1e-15).map((s) => ({ ...s, dyn: r.tr.dyn, t1: Math.min(s.t1, r.t1) })),
  )
  return {
    dyn: first.dyn,
    norm: first.norm,
    states: first.states,
    inputs: first.inputs,
    x0: first.x0,
    t0: 0,
    tEnd,
    segments,
    samples,
    t,
    series,
    at,
    runs,
    events,
    devices,
    regionsAt: (tt) => runAt(tt).regions,
  }
}

/**
 * How long each device spent in each region over the window, and — for the
 * rectifiers — the conduction angle in degrees of the drive.
 */
export function conduction(walk, omega = null) {
  const out = {}
  for (const d of walk.devices) {
    const spans = []
    for (const r of walk.runs) if (r.regions[d.id] === 'on') spans.push([r.t0, r.t1])
    const on = spans.reduce((s, [a, b]) => s + (b - a), 0)
    out[d.id] = { on, spans, fraction: on / (walk.tEnd - (walk.runs[0]?.t0 ?? 0)) }
    if (omega) out[d.id].angle = (on * omega * 180) / Math.PI
  }
  return out
}
