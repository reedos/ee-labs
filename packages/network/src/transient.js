// Exact time response — no timestep.
//
// On each piece of the input (waves.js) the sources are affine, u = U0 + U1·τ,
// and the state equation dx/dt = A x + B u has the closed-form solution
//
//     x(t) = e^{At} x(0) + ∫₀ᵗ e^{A(t−τ)} B (U0 + U1 τ) dτ.
//
// Rather than write out the integrals, the state is augmented with two more
// rows that generate the input — a constant 1 and a clock τ — so the whole
// thing is one exponential:
//
//     z = [x; 1; τ],   dz/dt = M z,   M = [ A  B·U0  B·U1 ]
//                                        [ 0    0     0   ]
//                                        [ 0    1     0   ]
//
// and z(t) = e^{Mt} z(0) exactly. No A⁻¹ is ever formed, so the undamped LC
// works; no step is ever taken, so the tests can say "=" rather than "≈".
// At each breakpoint of the input the state carries straight over — the
// capacitor voltages and inductor currents are continuous — and the next
// piece begins from it.
//
// A sinusoid is generated the same way: for each distinct ω among the sources
// two more rows [c; s] = [cos ωt; sin ωt] rotate under d/dt [c; s] = [0 −ω; ω 0] [c; s],
// and the source's amplitude and phase become the entries of B's new columns.
// So a sine-driven circuit is still one exponential per piece, and the forced
// response the phasor solve predicts (phasor.js) is what this converges to —
// a comparison the tests make to floating point.
//
// For pre-t = 0 the circuit may differ (a switch in its `before` position);
// dynamics.js's initialConditions solves that circuit at DC and continuity
// does the rest: x(0⁺) = x(0⁻). That is the textbook method, in three steps
// the math panel can narrate.

import { NetworkError } from './netlist.js'
import { dynamics, initialConditions } from './dynamics.js'
import { expm, matVecMul, zeros } from './expm.js'
import { allBreaks, pieceValue, sourceAffine } from './waves.js'

/**
 * One piece of the input: the sources' pieces from t0, the distinct
 * frequencies among them, the augmented matrix, and the generator vector
 * g(t) = [1, t − t0, cos ω₁t, sin ω₁t, …] that closes z = [x; g].
 */
function segmentOf(dyn, pieces, t0, t1) {
  const { A, B, c, n, m } = dyn
  const omegas = [...new Set(pieces.flatMap((q) => q.sines.map((s) => s.omega)))].sort((a, b) => a - b)
  const k = omegas.length
  const M = zeros(n + 2 + 2 * k)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) M[i][j] = A[i][j]
    // The affine term of a piecewise-linear region (a conducting diode's V_f,
    // an op-amp against a rail) rides the same constant generator the sources'
    // u0 does. It is zero for every circuit without one.
    if (c) M[i][n] += c[i]
    for (let j = 0; j < m; j++) {
      const q = pieces[j]
      M[i][n] += B[i][j] * q.u0
      M[i][n + 1] += B[i][j] * q.slope
      for (const s of q.sines) {
        const c = n + 2 + 2 * omegas.indexOf(s.omega)
        M[i][c] += B[i][j] * s.a
        M[i][c + 1] += B[i][j] * s.b
      }
    }
  }
  M[n + 1][n] = 1
  omegas.forEach((w, q) => {
    const c = n + 2 + 2 * q
    M[c][c + 1] = -w
    M[c + 1][c] = w
  })
  const gen = (t) => [1, t - t0, ...omegas.flatMap((w) => [Math.cos(w * t), Math.sin(w * t)])]
  const inputs = (t) => pieces.map((q) => pieceValue(q, t0, t))
  return { t0, t1, pieces, omegas, M, gen, inputs }
}

const scaled = (M, t) => M.map((row) => row.map((v) => v * t))

/**
 * Solve the circuit from t0 (0 by default) to tEnd.
 *
 * Options: `points` on the sample grid (breakpoints are added, sampled from
 * both sides so a jump plots as a vertical line); `x0` to impose the initial
 * state instead of solving the pre-switch circuit; `t0` to begin part-way,
 * from a state a caller already has — how pwl.js resumes after an event, with
 * the sources still read at absolute time so a sine keeps its phase; `opts`
 * for the solver.
 *
 * Returns the state description, the segments, the sample grid with a full
 * readout at each point, and `at(t)` — the exact state and readout at any
 * instant, which the time cursor and every measurement use.
 */
export function transient(net, { tEnd, points = 601, x0 = null, t0 = 0, opts = {} } = {}) {
  if (!(tEnd > t0)) throw new NetworkError('value', 'The time window must be positive')
  const dyn = dynamics(net, opts)
  const { norm, states, inputs, n, m } = dyn
  const sources = inputs.map((id) => norm.elements.find((e) => e.id === id))
  if (t0 > 0 && !x0) throw new NetworkError('value', 'A run that starts after t = 0 needs the state it starts from')
  const ic = x0 ? x0.slice() : initialConditions(norm, opts).x0

  // Segments between breakpoints, each with its own augmented matrix and the
  // state it starts from.
  const breaks = allBreaks(sources, tEnd, t0)
  const segments = []
  let x = ic
  for (let k = 0; k + 1 < breaks.length; k++) {
    const t0 = breaks[k]
    const t1 = breaks[k + 1]
    const seg = segmentOf(dyn, sources.map((e) => sourceAffine(e, t0)), t0, t1)
    seg.z0 = [...x, ...seg.gen(t0)]
    segments.push(seg)
    x = matVecMul(expm(scaled(seg.M, t1 - t0)), seg.z0).slice(0, n)
  }

  const segmentAt = (t) => {
    if (t <= t0) return segments[0]
    for (const s of segments) if (t < s.t1) return s
    return segments[segments.length - 1]
  }
  const inputsAt = (seg, t) => seg.inputs(t)

  /** Exact state, inputs and readout at time t (t ≥ 0; a breakpoint reads from the right). */
  const at = (t, side = 'right') => {
    let seg = segmentAt(t)
    if (side === 'left' && t > t0) {
      // The piece that ends at t, for the value just before a jump.
      const prev = segments.find((s) => Math.abs(s.t1 - t) <= 1e-12 * tEnd)
      if (prev) seg = prev
    }
    const zt = matVecMul(expm(scaled(seg.M, t - seg.t0)), seg.z0)
    const x = zt.slice(0, n)
    const u = inputsAt(seg, t)
    const sol = dyn.solveAt(x, u)
    return { t, x, u, sol, dxdt: dyn.derivOf(sol) }
  }

  // The sample grid: uniform, plus every breakpoint from both sides. Within a
  // segment the uniform samples are reached by one exponential per step, so a
  // fine grid costs matrix–vector products, not exponentials.
  const h = tEnd / (points - 1)
  const samples = []
  for (const seg of segments) {
    // Right side of the segment start.
    const push = (t, zz) => {
      const x = zz.slice(0, n)
      const u = inputsAt(seg, t)
      const sol = dyn.solveAt(x, u)
      samples.push({ t, x, u, sol })
    }
    push(seg.t0, seg.z0)
    let k = Math.floor(seg.t0 / h) + 1
    let tg = k * h
    if (tg - seg.t0 < 1e-9 * tEnd) {
      k++
      tg = k * h
    }
    if (tg < seg.t1 - 1e-9 * tEnd) {
      let zz = matVecMul(expm(scaled(seg.M, tg - seg.t0)), seg.z0)
      const step = expm(scaled(seg.M, h))
      while (tg < seg.t1 - 1e-9 * tEnd) {
        push(tg, zz)
        zz = matVecMul(step, zz)
        k++
        tg = k * h
      }
    }
    // Left side of the segment end.
    push(seg.t1, matVecMul(expm(scaled(seg.M, seg.t1 - seg.t0)), seg.z0))
  }

  const t = Float64Array.from(samples, (s) => s.t)
  /** One quantity as an array over the samples: q ∈ v (node) | i | volt | p (element) | x (state index). */
  const series = (q, key) =>
    Float64Array.from(samples, (s) => (q === 'x' ? s.x[key] : q === 'u' ? s.u[key] : s.sol[q][key]))

  return { dyn, norm, states, inputs, x0: ic, t0, tEnd, segments, samples, t, series, at }
}

// Seven-point Gauss–Legendre on [0, 1].
const GL_X = [
  0.025446043828620737, 0.12923440720030277, 0.29707742431130146, 0.5, 0.7029225756886985, 0.8707655927996972,
  0.9745539561713926,
]
const GL_W = [
  0.0647424830844349, 0.13985269574463835, 0.19091502525255949, 0.2089795918367347, 0.19091502525255949,
  0.13985269574463835, 0.0647424830844349,
]

/**
 * Energy bookkeeping along the transient: at every sample, the energy stored
 * in each reactive element (exact: ½Cv², ½Li²), the energy dissipated in
 * resistors so far and the energy the sources have supplied so far. The two
 * integrals are Gauss–Legendre on the exact waveform between samples — the
 * integrand is a sum of exponentials, which seven points integrate to
 * rounding once the grid resolves the time constants. Supplied = stored +
 * dissipated is then an identity the bar can show closing.
 *
 * Elements are classed by what they are: C and L store, R and switches
 * dissipate, everything else (independent and dependent sources, op-amps)
 * supplies.
 */
export function energies(tr) {
  const { dyn, samples, segments } = tr
  const cls = (e) => {
    if (e.type === 'C' || e.type === 'L') return 'stored'
    // A diode absorbs whatever it drops times whatever it passes — heat, like
    // a resistor, and the reason a rectifier's diodes get warm.
    if (e.type === 'R' || e.type === 'SW' || e.type === 'D') return 'dissipated'
    return 'supplied'
  }
  const classes = dyn.norm.elements.map((e) => [e.id, cls(e)])
  const powerSplit = (sol) => {
    let pr = 0
    let ps = 0
    for (const [id, c] of classes) {
      if (c === 'dissipated') pr += sol.p[id]
      else if (c === 'supplied') ps -= sol.p[id]
    }
    return [pr, ps]
  }

  const n = dyn.n
  const stored0 = dyn.stored(tr.x0).reduce((s, w) => s + w, 0)
  const out = []
  let dissipated = 0
  let supplied = 0
  // Per segment, the propagators to the seven nodes of a step of length h are
  // reused across every uniform step in it.
  let cache = null
  for (let k = 0; k < samples.length; k++) {
    const s = samples[k]
    if (k > 0) {
      const prev = samples[k - 1]
      const dt = s.t - prev.t
      if (dt > 0) {
        const seg = segments.find((g) => prev.t >= g.t0 - 1e-12 * tr.tEnd && s.t <= g.t1 + 1e-12 * tr.tEnd)
        if (!cache || cache.seg !== seg || Math.abs(cache.dt - dt) > 1e-12 * tr.tEnd)
          cache = { seg, dt, phis: GL_X.map((c) => expm(seg.M.map((row) => row.map((v) => v * c * dt)))) }
        const z0 = [...prev.x, ...seg.gen(prev.t)]
        // Across a piecewise-linear walk the segments are not all the same
        // circuit; each carries the state space it was solved in.
        const segDyn = seg.dyn || dyn
        let dr = 0
        let ds = 0
        GL_X.forEach((c, j) => {
          const zz = matVecMul(cache.phis[j], z0)
          const x = zz.slice(0, n)
          const u = seg.inputs(prev.t + c * dt)
          const [pr, ps] = powerSplit(segDyn.solveAt(x, u))
          dr += GL_W[j] * pr
          ds += GL_W[j] * ps
        })
        dissipated += dr * dt
        supplied += ds * dt
      }
    }
    const storedEach = dyn.stored(s.x)
    const stored = storedEach.reduce((a, w) => a + w, 0)
    out.push({ t: s.t, stored, storedEach, dissipated, supplied, gap: supplied - (stored - stored0) - dissipated })
  }
  return { points: out, stored0, states: dyn.states }
}

/**
 * The mean and RMS of any quantity over a window, by Gauss–Legendre between
 * consecutive samples of the exact solution. Every corner in the waveform — a
 * source breakpoint, a diode turning on — is itself a sample, so no panel of
 * the integral ever straddles one and the answer is exact to rounding for the
 * sums of exponentials and sinusoids these circuits produce.
 *
 * `pick` reads the quantity from a readout: (sol) => number.
 */
export function meanRms(tr, pick, a = tr.t0 ?? 0, b = tr.tEnd) {
  const ts = [...new Set(tr.samples.map((s) => s.t).filter((t) => t > a && t < b))].sort((x, y) => x - y)
  const nodes = [a, ...ts, b]
  let sum = 0
  let sq = 0
  for (let k = 0; k + 1 < nodes.length; k++) {
    const t0 = nodes[k]
    const dt = nodes[k + 1] - t0
    if (!(dt > 0)) continue
    GL_X.forEach((c, j) => {
      const y = pick(tr.at(t0 + c * dt).sol)
      sum += GL_W[j] * y * dt
      sq += GL_W[j] * y * y * dt
    })
  }
  const span = b - a
  return { mean: sum / span, rms: Math.sqrt(sq / span), span }
}

// ------------------------------------------------------------ measures
// Every measurement below brackets on the sample grid and then refines on the
// exact evaluator, so the numbers are properties of the waveform and not of
// the grid it happened to be drawn on.

const GOLD = (Math.sqrt(5) - 1) / 2

/** Bisection for f(t) = level on [a, b] where f(a) − level and f(b) − level differ in sign. */
export function bisect(f, a, b, level = 0, iters = 80) {
  let fa = f(a) - level
  for (let k = 0; k < iters; k++) {
    const c = (a + b) / 2
    const fc = f(c) - level
    if (fc === 0) return c
    if ((fa < 0) === (fc < 0)) {
      a = c
      fa = fc
    } else b = c
    if (b - a <= 4 * Number.EPSILON * Math.max(Math.abs(a), Math.abs(b))) break
  }
  return (a + b) / 2
}

/**
 * Every time the sampled quantity `y` crosses `level`, refined on `f`. A
 * sample sitting exactly on the level counts as a crossing at that sample.
 */
export function crossings(t, y, f, level = 0) {
  const out = []
  for (let k = 1; k < t.length; k++) {
    const a = y[k - 1] - level
    const b = y[k] - level
    if (t[k] === t[k - 1]) continue
    if (a === 0) out.push(t[k - 1])
    else if ((a < 0) !== (b < 0)) out.push(bisect(f, t[k - 1], t[k], level))
  }
  if (y[y.length - 1] - level === 0) out.push(t[t.length - 1])
  return out
}

/** Golden-section search for the extremum of f on [a, b]; `sign` +1 for a maximum. */
export function refineExtremum(f, a, b, sign = 1, iters = 100) {
  let c = b - GOLD * (b - a)
  let d = a + GOLD * (b - a)
  let fc = sign * f(c)
  let fd = sign * f(d)
  for (let k = 0; k < iters; k++) {
    if (fc > fd) {
      b = d
      d = c
      fd = fc
      c = b - GOLD * (b - a)
      fc = sign * f(c)
    } else {
      a = c
      c = d
      fc = fd
      d = a + GOLD * (b - a)
      fd = sign * f(d)
    }
    if (b - a <= 1e-13 * Math.max(Math.abs(a), Math.abs(b), 1e-300)) break
  }
  const tm = (a + b) / 2
  return { t: tm, y: f(tm) }
}

/** The local maxima and minima of a sampled quantity, each refined on f. Ends are not extrema. */
export function extrema(t, y, f) {
  const out = []
  for (let k = 1; k + 1 < t.length; k++) {
    if (t[k] === t[k - 1] || t[k] === t[k + 1]) continue
    const up = y[k] - y[k - 1]
    const dn = y[k + 1] - y[k]
    if (up > 0 && dn < 0) out.push({ ...refineExtremum(f, t[k - 1], t[k + 1], +1), kind: 'max' })
    else if (up < 0 && dn > 0) out.push({ ...refineExtremum(f, t[k - 1], t[k + 1], -1), kind: 'min' })
  }
  return out
}

/**
 * The last time |y − final| exceeds `band` (an absolute amount), refined on f;
 * 0 if the quantity is inside the band throughout, tEnd if it never enters.
 */
export function settleTime(t, y, f, final, band) {
  let k = y.length - 1
  while (k >= 0 && Math.abs(y[k] - final) <= band) k--
  if (k < 0) return 0
  if (k === y.length - 1) return t[k]
  const g = (tt) => Math.abs(f(tt) - final)
  return bisect(g, t[k], t[k + 1], band)
}
