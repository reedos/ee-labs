import {
  closeLoop,
  controllability,
  describingLimitCycle,
  discreteLoop,
  discretize,
  emulate,
  emulationGuard,
  equilibria,
  fitStep,
  isStable,
  isStableDiscrete,
  loopRegions,
  lqr,
  lyapunov,
  lyapunovRate,
  margins,
  observability,
  observerGain,
  phaseField,
  placePoles,
  polesZeros,
  predictionError,
  pwlOscillationOf,
  pwlTrajectory,
  roots,
  similarity,
  sOfZ,
  ssTrajectory,
  stepDiscreteTF,
  stepResponse,
  switchingLines,
  toStateSpace,
  toTransferFunction,
  zohGain,
} from '@ee-labs/systems'
import { PLANTS, CONTROLLERS, buildLoop } from './systems.js'

// One function turns a state into every number the app can show.
//
// The rule this file exists to keep: a number is computed once. A pane reads it
// from here and a test reads it from here, so the two cannot disagree. Control
// Lab learned that the hard way, with a readout claiming 16.3 per cent over a
// plot drawing 29.8.
//
// `analyse(state)` branches on `state.mode`, because the six groups ask six
// different questions of the same loop and computing all of them on every
// keystroke would be work nobody asked for. Everything cheap is computed for
// every mode.

/** The frequency grid every margin and crossing is found on, in hertz. */
export const GRID = Float64Array.from({ length: 6000 }, (_, i) => Math.pow(10, -4 + 8 * (i / 5999)))

/** A conjugate pair from a natural frequency and a damping ratio. */
export function polePair(wn, zeta) {
  if (zeta >= 1) {
    const root = wn * Math.sqrt(zeta * zeta - 1)
    return [[-wn * zeta + root, 0], [-wn * zeta - root, 0]]
  }
  const wd = wn * Math.sqrt(1 - zeta * zeta)
  return [[-wn * zeta, wd], [-wn * zeta, -wd]]
}

/**
 * A seeded normal generator, so the noise in the Fit view is the same noise on
 * every load and in every test. A fit whose residual changed between two runs
 * would be a number nobody could pin.
 */
export function noiseSeries(n, seed) {
  let s = seed >>> 0
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const u = Math.max(rand(), 1e-12)
    const v = rand()
    out[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  return out
}

/** The 2 % settling time of a sampled response, or null when it has not settled. */
export function settleTime(t, y, final) {
  if (!y.length || !Number.isFinite(final)) return null
  let peak = 0
  for (let i = 0; i < y.length; i++) peak = Math.max(peak, Math.abs(y[i]))
  const size = Math.abs(final) > 1e-12 ? Math.abs(final) : peak
  if (!(size > 0)) return 0
  const band = 0.02 * size
  if (Math.abs(y[y.length - 1] - final) > band) return null
  let i = y.length - 1
  while (i > 0 && Math.abs(y[i] - final) <= band) i--
  return i === y.length - 1 ? t[i] : t[i + 1]
}

/** How far a response peaks past its destination, as a fraction of the step. */
export function overshootOf(y, final) {
  if (!(Math.abs(final) > 1e-12)) return null
  let peak = -Infinity
  for (let i = 0; i < y.length; i++) if (y[i] > peak) peak = y[i]
  return (peak - final) / Math.abs(final)
}

/** The scale-free stability verdict every topbar reads. */
export function verdictOf(tf) {
  const p = roots(tf.a)
  if (!p.length) return 'stable'
  const worst = Math.max(...p.map(([re, im]) => re / Math.max(Math.hypot(re, im), Number.MIN_VALUE)))
  if (worst > 1e-9) return 'unstable'
  if (worst > -1e-9) return 'marginal'
  return 'stable'
}

/** The same verdict inside the unit circle. */
export function verdictDiscrete(tfz) {
  const p = roots(tfz.a)
  if (!p.length) return 'stable'
  const worst = Math.max(...p.map(([re, im]) => Math.hypot(re, im)))
  if (worst > 1 + 1e-9) return 'unstable'
  if (worst > 1 - 1e-9) return 'marginal'
  return 'stable'
}

// --------------------------------------------------------------- group A

function stateAnalysis(state) {
  const plant = PLANTS[state.plantId]
  const ss = plant.ss(state.plantP)
  const tf = plant.tf(state.plantP)
  const canonical = toStateSpace(tf)
  const ctrl = controllability(ss)
  const obs = observability(ss)
  const design = state.design || {}
  // The same motor with its speed measured in degrees a second rather than
  // radians a second. That is a change of coordinates and nothing else, and
  // it is what A3 is about. The controllable canonical form is NOT a second
  // basis for this plant: for the motor it comes out equal to the physical
  // one, which is a coincidence of that plant rather than a general truth, and
  // a lesson built on it would be claiming something false.
  const T = design.T || [[1, 0], [0, Math.PI / 180]]
  const rotated = ss.n === T.length ? similarity(ss, T) : null

  const out = {
    ss,
    canonical,
    rotated,
    fromSs: toTransferFunction(ss),
    fromCanonical: toTransferFunction(canonical),
    fromRotated: rotated ? toTransferFunction(rotated) : null,
    ctrl,
    obs,
    place: null,
    lqr: null,
    observer: null,
    closed: null,
    step: null,
    overshoot: null,
    dcGain: null,
    trajectories: null,
    declined: null,
  }

  // A1: the same input from two different initial states.
  if (design.compareStates) {
    out.trajectories = design.compareStates.map((x0) => ({
      x0,
      run: ssTrajectory(ss, () => (design.input ?? 0), {
        duration: design.duration ?? 4,
        points: 401,
        x0,
      }),
    }))
  }

  const wanted = design.poles || (design.wn ? polePair(design.wn, design.zeta ?? 0.7) : null)

  if (design.method === 'place' && wanted) {
    try {
      out.place = placePoles(ss, wanted)
    } catch (e) {
      out.declined = { where: 'place', message: e.message, code: e.code }
    }
  }
  if (design.method === 'lqr') {
    const n = ss.n
    const Q = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === 0 && j === 0 ? (design.q ?? 1) : 0)),
    )
    try {
      out.lqr = lqr(ss, Q, design.r ?? 1)
    } catch (e) {
      out.declined = { where: 'lqr', message: e.message, code: e.code }
    }
  }
  if (design.observer && wanted) {
    const factor = design.observerFactor ?? 4
    try {
      out.observer = observerGain(
        ss,
        wanted.map(([re, im]) => [factor * re, factor * im]),
      )
    } catch (e) {
      out.declined = { where: 'observer', message: e.message, code: e.code }
    }
  }

  const gain = out.place?.K || out.lqr?.K
  const Acl = out.place?.Acl || out.lqr?.Acl
  if (gain && Acl) {
    const raw = toTransferFunction({ A: Acl, B: ss.B, C: ss.C, D: 0 })
    const dc = raw.b[raw.b.length - 1] / raw.a[raw.a.length - 1]
    out.dcGain = dc
    out.closed = dc === 0 ? raw : { b: raw.b.map((v) => v / dc), a: raw.a }
    const duration = design.duration ?? 3
    out.step = stepResponse(out.closed, { duration, points: 1200 })
    out.overshoot = overshootOf(out.step.y, 1)
    out.gain = gain
  }
  return out
}

// --------------------------------------------------------------- group B

function sampledAnalysis(state) {
  const plant = PLANTS[state.plantId].tf(state.plantP)
  const ctrl = CONTROLLERS[state.ctrlId].tf(state.ctrlP)
  const { open } = buildLoop(state.plantId, state.plantP, state.ctrlId, state.ctrlP)
  const marg = margins(open, GRID)
  // A reader thinks in samples per cycle at crossover, not in milliseconds,
  // and the guard's threshold is written in those units too. So a state may
  // set either, and setting the rate computes the sample time the loop's own
  // crossover asks for rather than making the lesson carry a hand-computed
  // constant.
  const Ts =
    state.perCycle && marg.gainCrossover > 0
      ? 1 / (marg.gainCrossover * state.perCycle)
      : state.Ts
  const method = state.emulation || 'tustin'
  const controllerZ = emulate(ctrl, Ts, method)
  const loop = discreteLoop(plant, controllerZ, Ts)
  const Pz = loop.plant
  const guard = emulationGuard(marg.gainCrossover, Ts)
  const contClosed = closeLoop(open)
  const steps = Math.max(8, Math.round((state.duration ?? 4) / Ts) + 1)
  const digital = stepDiscreteTF(loop.closed, steps)
  const continuous = stepResponse(contClosed, { duration: Ts * (steps - 1), points: steps })
  let worst = 0
  for (let k = 0; k < steps; k++) worst = Math.max(worst, Math.abs(digital.y[k] - continuous.y[k]))
  const zPoles = roots(loop.closed.a)
  // The PLANT under its hold, against the continuous plant at the same
  // instants. This is the exact one, and it is a different number from the
  // loop's disagreement below, which carries the emulated controller's error
  // as well. B1 reads this one and B6 reads that one.
  const plantSteps = stepDiscreteTF(Pz, steps)
  // Exact, by the same matrix exponential the hold itself uses, rather than
  // by the RK4 integrator. Comparing the sampled model with a numerically
  // integrated curve would measure the integrator's error and call it the
  // hold's.
  const plantCont = ssTrajectory(toStateSpace(plant), () => 1, {
    duration: Ts * (steps - 1),
    points: steps,
  })
  let plantWorst = 0
  for (let k = 0; k < steps; k++) plantWorst = Math.max(plantWorst, Math.abs(plantSteps.y[k] - plantCont.y[k]))
  // All three rules on the same controller, so B7 can put the verdicts side by
  // side rather than reloading the experiment three times.
  const rules = {}
  for (const rule of ['tustin', 'backward', 'forward']) {
    const cz = emulate(ctrl, Ts, rule)
    rules[rule] = { ...cz, stable: isStableDiscrete(cz), poles: roots(cz.a) }
  }
  return {
    plant,
    ctrl,
    open,
    Ts,
    method,
    controllerZ,
    loop,
    Pz,
    alpha: -Pz.a[1],
    margins: marg,
    guard,
    contClosed,
    contVerdict: verdictOf(contClosed),
    zVerdict: verdictDiscrete(loop.closed),
    stableDiscrete: isStableDiscrete(loop.closed),
    stableContinuous: isStable(contClosed),
    digital,
    continuous,
    disagreement: worst,
    plantDisagreement: plantWorst,
    plantSteps,
    plantCont,
    rules,
    zPoles,
    plantZ: { poles: roots(Pz.a), zeros: roots(Pz.b) },
    sOfPoles: zPoles.map((z) => sOfZ(z, Ts)),
    holdLagDeg: guard.phaseLagDeg,
    holdDelay: Ts / 2,
  }
}

// ----------------------------------------------------------- groups C and D

function nonlinearAnalysis(state) {
  const plantSS = PLANTS[state.plantId].ss(state.plantP)
  const ctrlSS = CONTROLLERS[state.ctrlId].ss(state.ctrlP)
  const { open } = buildLoop(state.plantId, state.plantP, state.ctrlId, state.ctrlP)
  const spec = {
    ctrl: ctrlSS,
    plant: plantSS,
    kind: state.nlId === 'none' ? 'saturation' : state.nlId,
    delta: state.nlId === 'none' ? 1e9 : state.delta,
    reference: state.reference ?? 0,
  }
  const n = ctrlSS.n + plantSS.n
  const x0 = state.x0 && state.x0.length === n ? state.x0 : new Array(n).fill(0)
  const trajectory = pwlTrajectory(spec, {
    x0,
    duration: state.duration ?? 30,
    points: state.points ?? 3001,
  })
  const out = {
    spec,
    n,
    open,
    trajectory,
    wind: Math.max(...trajectory.x.map((z) => z[0])),
    peak: Math.max(...trajectory.y),
    final: trajectory.y[trajectory.y.length - 1],
    settle: settleTime(trajectory.t, trajectory.y, trajectory.y[trajectory.y.length - 1]),
    equilibria: equilibria(spec),
    field: null,
    lines: null,
    lyapunov: null,
    predicted: null,
    measured: null,
    error: null,
  }
  if (n === 2) {
    const span = state.span || {
      xMin: -0.5,
      xMax: Math.max(1, out.wind * 1.3),
      yMin: -0.2,
      yMax: Math.max(1.4, out.peak * 1.2),
    }
    out.span = span
    out.field = phaseField(spec, { ...span, nx: 15, ny: 15 })
    out.lines = switchingLines(spec)
    // The Lyapunov function of the linear region, about the origin. It is an
    // argument only where the loop is linear, and lyapunovRate reports which
    // region each point is in, so a pane can shade the rest.
    const home = { ...spec, reference: 0, delta: 1e9 }
    const A0 = loopRegions(home).regions['0'].M
    const P = lyapunov(A0, [[1, 0], [0, 1]])
    if (P) {
      out.lyapunov = {
        A: A0,
        P,
        eigenvalues: roots([1, -(P[0][0] + P[1][1]), P[0][0] * P[1][1] - P[0][1] * P[1][0]]),
        along: trajectory.x
          .filter((_, i) => i % Math.ceil(trajectory.x.length / 60) === 0)
          .map((z) => lyapunovRate({ ...spec, reference: 0 }, P, z)),
      }
    }
  }
  if (state.mode === 'describing') {
    const pred = describingLimitCycle(open, { delta: state.delta }, GRID)
    out.predicted = pred
    const osc = pwlOscillationOf(trajectory.t, trajectory.u, { tailFraction: 0.25 })
    out.measured = osc
    out.error = predictionError(pred.predicted, osc)
  }
  return out
}

// --------------------------------------------------------------- group E

function fitAnalysis(state) {
  const plant = PLANTS[state.plantId].tf(state.plantP)
  const duration = state.duration ?? 6
  const points = state.points ?? 400
  const clean = stepResponse(plant, { duration, points })
  const sigma = state.noise ?? 0
  const gain = clean.y[clean.y.length - 1]
  const noise = noiseSeries(points, state.seed ?? 1234)
  const y = Float64Array.from(clean.y, (v, i) => v + sigma * Math.abs(gain) * noise[i])
  const fits = fitStep(clean.t, y)
  return {
    plant,
    data: { t: clean.t, y, clean: clean.y },
    sigma,
    ...fits,
    truePoles: polesZeros(plant).poles,
  }
}

// --------------------------------------------------------------- group F

function filterAnalysis(state) {
  const ss = PLANTS[state.plantId].ss(state.plantP)
  const design = state.design || {}
  const qw = design.qw ?? 1
  const rv = design.rv ?? 1
  const n = ss.n
  // The filter's gain solves the regulator's equation on the transposed
  // system. That duality is the whole of F2, so it is computed that way here
  // rather than by a second routine that could drift from it.
  const dual = {
    A: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => ss.A[j][i])),
    B: [...ss.C],
    C: [...ss.B],
    D: 0,
  }
  const Q = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? qw : 0)),
  )
  const solved = lqr(dual, Q, rv)
  const L = [...solved.K]
  const Aobs = ss.A.map((row, i) => row.map((v, j) => v - L[i] * ss.C[j]))
  return {
    ss,
    dual,
    L,
    Aobs,
    poles: solved.poles,
    residual: solved.residual,
    relResidual: solved.relResidual,
    qw,
    rv,
    ratio: qw / rv,
  }
}

// ------------------------------------------------------------------ entry

/**
 * Everything the app and the tests read, for one state.
 *
 * `mode` decides which branch runs. The linear loop, its poles and its margins
 * are computed for every mode, because the topbar shows them everywhere.
 */
export function analyse(state) {
  const { open } = buildLoop(state.plantId, state.plantP, state.ctrlId, state.ctrlP)
  const closed = closeLoop(open)
  const base = {
    state,
    open,
    closed,
    pz: polesZeros(closed),
    openPz: polesZeros(open),
    margins: margins(open, GRID),
    verdict: verdictOf(closed),
    plantTf: PLANTS[state.plantId].tf(state.plantP),
  }
  if (state.mode === 'state') return { ...base, state_: stateAnalysis(state) }
  if (state.mode === 'sampled') return { ...base, sampled: sampledAnalysis(state) }
  if (state.mode === 'phase' || state.mode === 'describing') {
    return { ...base, nonlinear: nonlinearAnalysis(state) }
  }
  if (state.mode === 'fit') return { ...base, fit: fitAnalysis(state) }
  if (state.mode === 'filter') return { ...base, filter: filterAnalysis(state) }
  return base
}

// ---------------------------------------------------------- quantity paths

/**
 * The dotted names a lesson's `reads` pair may quote, resolved against one
 * analysis.
 *
 * `AGENT_BRIEF.md` section 4 lists them. They exist so a try step can name the
 * number it expects to change without the note and the test computing it two
 * different ways. A path that does not resolve throws rather than returning
 * undefined, because a `reads` pair quietly reading nothing is exactly the
 * defect this seam was built to stop.
 *
 * `pole.N.re` indexes the pole list, so `place.pole.0.im` is the imaginary
 * part of the first placed pole.
 */
export function readPath(a, path) {
  const parts = String(path).split('.')
  const at = (list, i, which) => {
    const p = list?.[Number(i)]
    if (!p) return undefined
    return which === 'im' ? p[1] : which === 'mag' ? Math.hypot(p[0], p[1]) : which === 'arg' ? Math.atan2(p[1], p[0]) : p[0]
  }
  const [head, ...rest] = parts
  const key = rest.join('.')

  if (head === 'ss') {
    const s = a.state_
    if (!s) return undefined
    if (key === 'rank') return s.ctrl.rank
    if (key === 'condition') return s.ctrl.condition
    if (key === 'controllable') return s.ctrl.controllable
    if (key === 'observable') return s.obs.observable
    if (key === 'n') return s.ss.n
  }
  if (head === 'place' || head === 'lqr') {
    const d = head === 'place' ? a.state_?.place : a.state_?.lqr
    if (!d) return undefined
    if (key === 'k1') return d.K[0]
    if (key === 'k2') return d.K[1]
    if (key === 'overshoot') return a.state_.overshoot
    if (key === 'dcgain') return a.state_.dcGain
    if (key === 'residual') return d.relResidual
    if (key === 'cost') return d.cost ? d.cost([1, 0]) : undefined
    if (rest[0] === 'pole') return at(d.poles || d.achieved, rest[1], rest[2])
  }
  if (head === 'obs') {
    const o = a.state_?.observer
    if (!o) return undefined
    if (key === 'l1') return o.L[0]
    if (key === 'l2') return o.L[1]
    if (key === 'settling') {
      const re = o.achieved?.[0]?.[0]
      return re < 0 ? -4 / re : undefined
    }
    if (rest[0] === 'pole') return at(o.achieved, rest[1], rest[2])
  }
  if (head === 'z') {
    const s = a.sampled
    if (!s) return undefined
    if (key === 'alpha') return s.alpha
    if (key === 'b1') return s.Pz.b[s.Pz.b.length - 1]
    if (key === 'stable') return s.stableDiscrete
    if (key === 'disagreement') return s.disagreement
    if (rest[0] === 'pole') return at(s.zPoles, rest[1], rest[2])
  }
  if (head === 'hold') {
    const s = a.sampled
    if (!s) return undefined
    if (key === 'delay') return s.holdDelay
    if (key === 'lagdeg') return s.holdLagDeg
    if (key === 'gain') return zohGain(s.Ts, 2 * Math.PI * s.margins.gainCrossover)
  }
  if (head === 'guard') {
    if (a.sampled) {
      if (key === 'perCycle') return a.sampled.guard.samplesPerCycle
      if (key === 'threshold') return a.sampled.guard.threshold
      if (key === 'holds') return a.sampled.guard.holds
    }
    if (a.nonlinear?.predicted) {
      if (key === 'ratio') return a.nonlinear.predicted.harmonicRatio
      if (key === 'threshold') return a.nonlinear.predicted.threshold
      if (key === 'holds') return a.nonlinear.predicted.holds
    }
    if (a.fit && key === 'residual') return a.fit.first.relResidual
  }
  if (head === 'nl') {
    const n = a.nonlinear
    if (!n) return undefined
    if (key === 'predicted') return n.predicted?.amplitude
    if (key === 'measured') return n.measured?.amplitude
    if (key === 'amplitude') return n.measured?.amplitude ?? n.predicted?.amplitude
    if (key === 'omega') return n.measured?.omega ?? n.predicted?.omega
    if (key === 'N') return n.predicted?.N
    if (key === 'error') return n.error?.amplitude
  }
  if (head === 'phase') {
    const n = a.nonlinear
    if (!n) return undefined
    if (key === 'wind') return n.wind
    if (key === 'peak') return n.peak
    if (key === 'events') return n.trajectory.events.length
    if (key === 'equilibria') return n.equilibria.filter((e) => e.real).length
  }
  if (head === 'fit') {
    const f = a.fit
    if (!f) return undefined
    if (key === 'improvement') return f.improvement
    const which = rest[0] === 'second' ? f.second : f.first
    const field = rest[0] === 'second' || rest[0] === 'first' ? rest[1] : rest[0]
    if (field in which) return which[field]
  }
  throw new Error(`unknown quantity path: ${path}`)
}
