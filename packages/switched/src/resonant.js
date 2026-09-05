// Resonant conversion: a tank driven by a square wave, loaded through a
// rectifier.
//
// A resonant converter switches at a frequency that is not the tank's, so its
// waveform is not a triangle and its ratio is not a duty. What it is, is a
// linear circuit per segment like everything else in this package: the tank
// is LTI, and the only thing that changes within a period is which way the
// output rectifier is pointing. So the same propagator carries it, and the
// rectifier's diode events are found the way `rectifier.js` finds a line
// rectifier's — as roots of a margin, bisected on the exact solution.
//
// ------------------------------------------------------------ the two tanks
//
// **Series resonant (SRC).** A half-bridge puts ±V_in/2 on a series L_r–C_r
// tank feeding the transformer. State is x = [i_Lr, v_Cr, v_Co]:
//
//     L_r·di/dt = v_ab − v_Cr − v_p − R_s·i
//     C_r·dv_Cr/dt = i
//     C_o·dv_Co/dt = |i_s| − v_Co/R,     i_s = i/n
//
// with v_p the primary voltage the rectifier clamps: while the secondary
// conducts it is s·(v_Co + V_d)/n with s the sign of the secondary current,
// so it is a linear form in the state and the segment stays LTI. When the
// current reaches zero and the drive cannot push it back through the
// rectifier, the tank sits: that is the discontinuous mode, and it is a
// state of its own with i pinned at zero.
//
// **LLC.** Add the magnetising inductance across the primary and the state
// grows to x = [i_Lr, v_Cr, i_Lm, v_Co]. While the rectifier conducts, L_m
// is clamped at ±(v_Co + V_d)/n and its current is a ramp; the resonance is
// L_r with C_r. When i_Lr meets i_Lm the secondary current is zero, the
// rectifier blocks, and the two inductances resonate in series with C_r at a
// lower frequency. Two resonances, and the gain between them can exceed one,
// which is the whole reason the topology exists.
//
// ------------------------------------------------------- half-wave symmetry
//
// The bridge alternates, so the second half of every period is the first with
// the sign of every current and of v_Cr reversed, and v_Co unchanged. The
// solve is therefore over a half period with the condition x(T/2) = S·x(0),
// S = diag(−1, −1, −1, +1). That is the symmetry rather than an assumption
// about it, and it halves the work. `resonantWaveform` mirrors the half back
// into a whole period so the scope shows the switching period the switches
// live in.
//
// The periodicity itself is a shooting problem, because the rectifier's
// instants depend on the state. With the pattern held fixed the half-period
// map is affine, x(T/2) = Φ x(0) + d, so (S − Φ) x(0) = d is a linear solve;
// the walk then re-places the events and the solve is repeated. It converges
// in a handful of iterations because the durations move smoothly with the
// state.

import { propagator01 } from './propagator.js'
import { solve, matVec, vecAdd, matAdd } from './linalg.js'
import { stateAt, sample, illinois } from './segment.js'
import { statsOf, meanProduct, spectrumOf } from './clocked.js'

export const RESONANT_KINDS = ['src', 'llc']

/** Every signal a resonant pane may ask for. */
export const RESONANT_SIGNALS = ['vsw', 'vrect', 'vCr', 'vout', 'iL', 'iLm', 'iD', 'iC', 'iR', 'iin']

export const RESONANT_DEFAULTS = {
  Vin: 400,
  fs: 100e3,
  Lr: 60e-6,
  Cr: 40e-9,
  Lm: 300e-6,
  n: 0.05, // N_s/N_p
  C: 100e-6, // output capacitor
  R: 5,
  Ron: 0, // one switch in the tank's path
  RLr: 0.1, // the tank's own winding resistance
  Vf: 0.5, // per rectifier diode
  rd: 0, // rectifier slope resistance, on the secondary side
}

/** The two frequencies a resonant tank has, and how sharply it resonates. */
export function resonantFrequencies({ Lr, Cr, Lm = 0, R = 1, n = 1 }) {
  const fr = 1 / (2 * Math.PI * Math.sqrt(Lr * Cr))
  const fm = Lm > 0 ? 1 / (2 * Math.PI * Math.sqrt((Lr + Lm) * Cr)) : fr
  // The load a first-harmonic analysis puts across the tank: a rectifier fed
  // by a square current wave into a stiff output presents 8/π² of the load,
  // reflected through the turns ratio.
  const Rac = (8 / (Math.PI * Math.PI)) * (R / (n * n))
  const Z0 = Math.sqrt(Lr / Cr)
  return { fr, fm, Rac, Z0, Q: Z0 / Rac, ratio: Lm > 0 ? Lm / Lr : Infinity }
}

/**
 * The gain a first-harmonic analysis predicts, which is the tank's response
 * to the fundamental of the square wave with the rectifier replaced by the
 * resistance it looks like.
 *
 * It is an approximation, and `fhaValid` is its guard: the analysis keeps
 * only the fundamental, so it is honest while the tank current is nearly a
 * sine, and it is not once the rectifier stops conducting for part of the
 * cycle. The measured waveform's own harmonic content is what says which
 * case a setting is in.
 */
export function fhaGain(p, f) {
  const { Lr, Cr, Lm, n, R } = { ...RESONANT_DEFAULTS, ...p }
  const { Rac } = resonantFrequencies({ Lr, Cr, Lm, R, n })
  const w = 2 * Math.PI * f
  const zLm = Lm > 0 ? w * Lm : Infinity
  // The tank as a divider: the series branch against the parallel pair of the
  // magnetising reactance and the reflected load.
  const zs = { re: 0, im: w * Lr - 1 / (w * Cr) }
  // Parallel of jωL_m and R_ac.
  let pr
  if (!(zLm < Infinity)) pr = { re: Rac, im: 0 }
  else {
    const den = Rac * Rac + zLm * zLm
    pr = { re: (Rac * zLm * zLm) / den, im: (Rac * Rac * zLm) / den }
  }
  const tr = { re: zs.re + pr.re, im: zs.im + pr.im }
  const mag = Math.hypot(pr.re, pr.im) / Math.hypot(tr.re, tr.im)
  // The bridge's fundamental is (2/π)·V_in for a half-bridge's ±V_in/2 swing,
  // and the rectified output is (π/2)·... the two shape factors cancel, so
  // the DC-to-DC gain is n times the tank's magnitude.
  return n * mag
}

const zeros = (m, k) => Array.from({ length: m }, () => Array.from({ length: k }, () => 0))

/**
 * Build the states of a resonant converter, for the half period the bridge
 * holds v_ab = +V_in/2.
 *
 * `states` are keyed by the sign the rectifier is carrying: 'P+' and 'P−' for
 * the two conducting directions and 'P0' for the interval the rectifier
 * blocks. The mirrored half's names are the same with N, and `mirrorOf` maps
 * one to the other.
 */
function buildStates(kind, p) {
  const { Vin, Lr, Cr, Lm, n, C, R, Ron, RLr, Vf, rd } = p
  const llc = kind === 'llc'
  const N = llc ? 4 : 3 // [i, v_Cr, (i_m), v_Co]
  const iM = llc ? 2 : -1
  const iV = llc ? 3 : 2
  const rs = Ron + RLr
  const Vd = 2 * Vf // two rectifier drops in the secondary's path
  const rdp = rd / (n * n) // the rectifier's slope, referred to the primary

  const form = (c, d = 0) => ({ c, d })
  const zero = form(Array.from({ length: N }, () => 0))

  /** One conducting state: drive sign `q` (±1) and rectifier sign `s` (±1). */
  const conducting = (q, s) => {
    const A = zeros(N, N)
    const f = Array.from({ length: N }, () => 0)
    // The secondary current is (i − i_m)/n for the LLC and i/n for the SRC.
    const secC = Array.from({ length: N }, () => 0)
    secC[0] = 1 / n
    if (llc) secC[iM] = -1 / n
    // v_p = s·(v_Co + V_d)/n + rd'·(i − i_m)
    const vpC = Array.from({ length: N }, () => 0)
    vpC[iV] = s / n
    vpC[0] = rdp
    if (llc) vpC[iM] = -rdp
    const vpD = (s * Vd) / n
    // L_r: di/dt = (q·V_in/2 − v_Cr − v_p − r_s·i)/L_r
    A[0][0] = (-rs - vpC[0]) / Lr
    A[0][1] = -1 / Lr
    A[0][iV] = -vpC[iV] / Lr
    if (llc) A[0][iM] = -vpC[iM] / Lr
    f[0] = ((q * Vin) / 2 - vpD) / Lr
    // C_r: dv_Cr/dt = i/C_r
    A[1][0] = 1 / Cr
    // L_m: di_m/dt = v_p/L_m
    if (llc) {
      A[iM][0] = vpC[0] / Lm
      A[iM][iM] = vpC[iM] / Lm
      A[iM][iV] = vpC[iV] / Lm
      f[iM] = vpD / Lm
    }
    // C_o: dv_Co/dt = s·i_s/C − v_Co/(R·C)
    for (let j = 0; j < N; j++) A[iV][j] = (s * secC[j]) / C
    A[iV][iV] += -1 / (R * C)
    const vp = form(vpC.slice(), vpD)
    const iD = form(secC.map((v) => s * v))
    const iR = form(Array.from({ length: N }, (_, j) => (j === iV ? 1 / R : 0)))
    const iC = form(iD.c.map((v, j) => v - iR.c[j]))
    return {
      name: `${q > 0 ? 'P' : 'N'}${s > 0 ? '+' : '−'}`,
      A,
      f,
      signals: {
        vsw: form(Array.from({ length: N }, () => 0), (q * Vin) / 2),
        vrect: vp,
        vCr: form(Array.from({ length: N }, (_, j) => (j === 1 ? 1 : 0))),
        vout: form(Array.from({ length: N }, (_, j) => (j === iV ? 1 : 0))),
        iL: form(Array.from({ length: N }, (_, j) => (j === 0 ? 1 : 0))),
        iLm: form(Array.from({ length: N }, (_, j) => (llc && j === iM ? 1 : 0))),
        iD,
        iC,
        iR,
        iin: form(Array.from({ length: N }, (_, j) => (j === 0 ? q / 2 : 0))),
      },
    }
  }

  /** The blocked state: the rectifier carries nothing. */
  const blocked = (q) => {
    const A = zeros(N, N)
    const f = Array.from({ length: N }, () => 0)
    if (llc) {
      // The two inductances are in series with C_r, and the primary voltage
      // is whatever L_m's share of the drive is.
      const Lt = Lr + Lm
      A[0][0] = -rs / Lt
      A[0][1] = -1 / Lt
      f[0] = (q * Vin) / 2 / Lt
      A[iM][0] = A[0][0]
      A[iM][1] = A[0][1]
      f[iM] = f[0]
      A[1][0] = 1 / Cr
    }
    // The SRC's tank simply stops: i is pinned at zero and v_Cr holds.
    A[iV][iV] = -1 / (R * C)
    const vpC = Array.from({ length: N }, () => 0)
    if (llc) {
      // v_Lm = L_m·(q·V_in/2 − v_Cr − r_s·i)/(L_r + L_m)
      const k = Lm / (Lr + Lm)
      vpC[0] = -k * rs
      vpC[1] = -k
    } else {
      // With no current the primary sits at the drive less the capacitor.
      vpC[1] = -1
    }
    const vpD = llc ? ((Lm / (Lr + Lm)) * q * Vin) / 2 : (q * Vin) / 2
    const iR = form(Array.from({ length: N }, (_, j) => (j === iV ? 1 / R : 0)))
    return {
      name: `${q > 0 ? 'P' : 'N'}0`,
      A,
      f,
      signals: {
        vsw: form(Array.from({ length: N }, () => 0), (q * Vin) / 2),
        vrect: form(vpC, vpD),
        vCr: form(Array.from({ length: N }, (_, j) => (j === 1 ? 1 : 0))),
        vout: form(Array.from({ length: N }, (_, j) => (j === iV ? 1 : 0))),
        iL: form(Array.from({ length: N }, (_, j) => (j === 0 ? 1 : 0))),
        iLm: form(Array.from({ length: N }, (_, j) => (llc && j === iM ? 1 : 0))),
        iD: zero,
        iC: form(iR.c.map((v) => -v)),
        iR,
        iin: form(Array.from({ length: N }, (_, j) => (j === 0 ? q / 2 : 0))),
      },
    }
  }

  const states = {}
  for (const q of [1, -1]) {
    for (const s of [1, -1]) {
      const st = conducting(q, s)
      states[st.name] = st
    }
    const b = blocked(q)
    states[b.name] = b
  }
  return { states, N, iM, iV, Vd }
}

/** The name the other half of the period calls a state. */
export const mirrorOf = (name) => {
  const q = name[0] === 'P' ? 'N' : 'P'
  const rest = name.slice(1)
  const flip = rest === '+' ? '−' : rest === '−' ? '+' : '0'
  return `${q}${flip}`
}

export function resonant(kind, params = {}) {
  if (!RESONANT_KINDS.includes(kind)) throw new Error(`unknown resonant converter "${kind}"`)
  const p = { ...RESONANT_DEFAULTS, ...params }
  const { states, N, iM, iV, Vd } = buildStates(kind, p)
  const llc = kind === 'llc'
  const Thalf = 1 / (2 * p.fs)
  const freq = resonantFrequencies(p)

  /** The secondary current at state x, in the rectifier's own direction. */
  const secondary = (x) => (llc ? x[0] - x[iM] : x[0]) / p.n
  /** What the tank would have to overcome to push current through the rectifier. */
  const clamp = (x) => (x[iV] + Vd) / p.n

  // Which state holds at x, under drive sign q. Written as "what makes this
  // one stop" rather than "what makes that one start": the instant the
  // secondary current reaches zero belongs to both sides, and a memoryless
  // rule hands it back to the state it just left.
  const pick = (q, name, x) => {
    const is = secondary(x)
    const s = name.endsWith('+') ? 1 : name.endsWith('−') ? -1 : 0
    if (s !== 0) {
      if (s * is > 0) return name
      // The rectifier has run out of current. It can only take up the other
      // direction if the tank can drive it there.
      return blockedOrNext(q, x)
    }
    return blockedOrNext(q, x)
  }
  const blockedOrNext = (q, x) => {
    // Referred to the primary, the drive that is left after the tank's
    // capacitor, against the voltage the rectifier clamps at.
    const push = llc ? (p.Lm / (p.Lr + p.Lm)) * ((q * p.Vin) / 2 - x[1]) : (q * p.Vin) / 2 - x[1]
    const c = clamp(x)
    if (push > c) return `${q > 0 ? 'P' : 'N'}+`
    if (push < -c) return `${q > 0 ? 'P' : 'N'}−`
    return `${q > 0 ? 'P' : 'N'}0`
  }
  /** Positive while state `name` holds at x. */
  const margin = (q, name, x) => {
    const s = name.endsWith('+') ? 1 : name.endsWith('−') ? -1 : 0
    if (s !== 0) return s * secondary(x)
    const push = llc ? (p.Lm / (p.Lr + p.Lm)) * ((q * p.Vin) / 2 - x[1]) : (q * p.Vin) / 2 - x[1]
    return clamp(x) - Math.abs(push)
  }

  return {
    kind,
    resonant: true,
    p,
    N,
    iM,
    iV,
    llc,
    n: p.n,
    T: Thalf,
    Tsw: 1 / p.fs,
    Vd,
    states,
    signals: RESONANT_SIGNALS,
    ...freq,
    fRatio: p.fs / freq.fr,
    pick,
    margin,
    secondary,
    entry: (x) => blockedOrNext(1, x),
    // Half-wave symmetry: currents and the tank capacitor reverse, the output
    // capacitor does not.
    sign: Array.from({ length: N }, (_, j) => (j === iV ? 1 : -1)),
    idealM: () => fhaGain(p, p.fs),
  }
}

/**
 * Walk one half period from x0, cutting the segment wherever the rectifier
 * changes what it is doing. `pinned` holds the state on the manifold the
 * event defines: entering the blocked state the secondary current is zero, so
 * the SRC's tank current is pinned at zero and the LLC's magnetising current
 * at the tank's.
 */
export function resonantWalk(conv, x0, { scan = 400, tol = 1e-13, maxSegments = 40 } = {}) {
  const { T, states } = conv
  const pin = (name, x) => {
    if (!name.endsWith('0')) return x
    const y = x.slice()
    if (conv.llc) y[conv.iM] = y[0]
    else y[0] = 0
    return y
  }
  const segs = []
  let t = 0
  let x = pin(conv.entry(x0), x0)
  let name = conv.entry(x)
  while (t < T && segs.length <= maxSegments) {
    const state = states[name]
    const remain = T - t
    const seg = { name, state, A: state.A, f: state.f, x0: x, T: remain, t0: t }
    const m = Math.max(8, Math.ceil((scan * remain) / T))
    const pts = sample(seg, m)
    const dt = remain / m
    let k = 1
    while (k <= m && conv.pick(1, name, pts[k]) === name) k++
    if (k > m) {
      segs.push(seg)
      x = pts[m]
      t = T
      break
    }
    const lo = (k - 1) * dt
    const hi = k * dt
    const g = (tau) => conv.margin(1, name, stateAt(seg, tau))
    const rlo = g(lo)
    const rhi = g(hi)
    let root
    if (rlo > 0 && rhi < 0) root = illinois(g, lo, hi, tol * T, { rlo, rhi })
    else {
      // The margin does not bracket the event, so the rule that named this
      // segment is what gets bisected.
      let a = lo
      let b = hi
      while (b - a > tol * T) {
        const mid = (a + b) / 2
        if (conv.pick(1, name, stateAt(seg, mid)) === name) a = mid
        else b = mid
      }
      root = b
    }
    seg.T = root
    segs.push(seg)
    const xEvent = stateAt(seg, root)
    const next = conv.pick(1, name, pts[k])
    x = pin(next, xEvent)
    t += root
    name = next
  }
  return { segs, xEnd: x }
}

/**
 * The periodic steady state: the half period walked, the affine map its
 * pattern makes read off, and x(T/2) = S·x(0) solved for x(0). Repeat until
 * the pattern and the state stop moving.
 */
export function resonantSteadyState(conv, { iterations = 40, tol = 1e-12 } = {}) {
  const N = conv.N
  const S = conv.sign
  let x0 = Array.from({ length: N }, (_, j) => (j === conv.iV ? conv.p.Vin * conv.n : 0))
  let walk = null
  let converged = false
  let used = 0
  for (let it = 0; it < iterations; it++) {
    used = it + 1
    walk = resonantWalk(conv, x0)
    // Φ and d for the pattern this walk found.
    let Phi = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => (i === j ? 1 : 0)))
    let d = Array.from({ length: N }, () => 0)
    for (const seg of walk.segs) {
      if (seg.T <= 0) continue
      const { phi0, phi1 } = propagator01(seg.A, seg.T)
      Phi = phi0.map((row) => row.map((_, j) => row.reduce((a, v, q) => a + v * Phi[q][j], 0)))
      d = vecAdd(matVec(phi0, d), matVec(phi1, seg.f))
    }
    // (S − Φ)x0 = d, with S the diagonal sign map.
    const Smat = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => (i === j ? S[i] : 0)))
    const next = solve(matAdd(Smat, Phi, -1), d)
    const scale = Math.max(1e-12, ...next.map(Math.abs))
    const moved = Math.max(...next.map((v, i) => Math.abs(v - x0[i]))) / scale
    x0 = next
    if (moved < tol) {
      converged = true
      break
    }
  }
  const run = resonantWalk(conv, x0)
  return {
    mode: 'resonant',
    conv,
    T: conv.T,
    Tsw: conv.Tsw,
    x0,
    xEnd: run.xEnd,
    segments: run.segs,
    iterations: used,
    converged,
  }
}

/**
 * The whole switching period, from the half that was solved: the second half
 * is the first with every current and the tank capacitor reversed, so it is
 * built by mirroring the segments rather than by solving again.
 */
export function resonantPeriod(ss) {
  const conv = ss.conv
  const S = conv.sign
  const flip = (x) => x.map((v, i) => S[i] * v)
  const segs = ss.segments.filter((s) => s.T > 0).map((s) => ({ ...s }))
  const half = conv.T
  for (const s of ss.segments) {
    if (s.T <= 0) continue
    const state = conv.states[mirrorOf(s.name)]
    segs.push({ name: state.name, state, A: state.A, f: state.f, x0: flip(s.x0), T: s.T, t0: s.t0 + half })
  }
  return { ...ss, T: conv.Tsw, segments: segs }
}

/** Scope traces over `periods` switching periods, both ends of every segment. */
export function resonantWaveform(ss, { periods = 2, n = 400 } = {}) {
  const full = resonantPeriod(ss)
  const names = RESONANT_SIGNALS
  const t = []
  const sig = Object.fromEntries(names.map((s) => [s, []]))
  const edges = []
  for (let k = 0; k < periods; k++) {
    const base = k * full.T
    for (const seg of full.segments) {
      if (seg.T <= 0) continue
      const m = Math.max(8, Math.round((n * seg.T) / full.T))
      const pts = sample(seg, m)
      const dt = seg.T / m
      for (let i = 0; i <= m; i++) {
        t.push(base + seg.t0 + i * dt)
        for (const s of names) sig[s].push(evalForm(seg.state.signals[s], pts[i]))
      }
      edges.push({ t: base + seg.t0, name: seg.name })
    }
  }
  return { t, sig, edges, T: full.T }
}

const evalForm = (fm, x) => {
  let y = fm.d
  for (let i = 0; i < fm.c.length; i++) y += fm.c[i] * x[i]
  return y
}

/**
 * What a resonant converter is judged by: the ratio it delivers, whether the
 * switches turn on at zero voltage, and how far the tank current is from the
 * sine the first-harmonic analysis assumes it is.
 */
export function resonantMeasures(ss, { harmonics = 9 } = {}) {
  const conv = ss.conv
  const p = conv.p
  const full = resonantPeriod(ss)
  const sig = statsOf(full, RESONANT_SIGNALS, { dense: 128 })
  const Pin = p.Vin * sig.iin.avg
  const Pout = sig.vout.rms ** 2 / p.R
  const iD2 = sig.iD.rms ** 2
  const loss = {
    // The tank's own series resistance, and the switch that is in it.
    switch: p.Ron * sig.iL.rms ** 2,
    inductor: p.RLr * sig.iL.rms ** 2,
    diodes: conv.Vd * sig.iD.avg + p.rd * iD2,
  }
  const Pcond = loss.switch + loss.inductor + loss.diodes
  // The current at the switching instant. Above resonance it is still
  // negative when the bridge steps up, so the switch node is already at the
  // rail when the device turns on and the turn-on loss is zero.
  const iTurnOn = ss.x0[0]
  const iTurnOff = ss.xEnd[0]
  const spec = spectrumOf(full, 'iL', harmonics)
  const i1 = spec[0].rms
  const thd = i1 > 0 ? Math.sqrt(Math.max(0, sig.iL.rms ** 2 - i1 * i1)) / i1 : 0
  const M = sig.vout.avg / p.Vin
  return {
    sig,
    Pin,
    Pout,
    loss,
    Pcond,
    Ploss: Pcond,
    balance: Pin - Pout - Pcond,
    eta: Pin > 0 ? Pout / Pin : 0,
    M,
    Mfha: fhaGain(p, p.fs),
    Iout: sig.vout.avg / p.R,
    mode: 'resonant',
    zvs: iTurnOn < 0,
    iTurnOn,
    iTurnOff,
    // Whether the rectifier ever stops: the mode the first-harmonic analysis
    // has no account of.
    blocked: ss.segments.some((s) => s.T > 0 && s.name.endsWith('0')),
    blockedShare: ss.segments.filter((s) => s.name.endsWith('0')).reduce((a, s) => a + s.T, 0) / ss.T,
    harmonics: spec,
    I1: i1,
    thd,
    fRatio: conv.fRatio,
    fr: conv.fr,
    fm: conv.fm,
    Q: conv.Q,
    Rac: conv.Rac,
    meanProduct: (a, b) => meanProduct(full, a, b),
  }
}

/**
 * The gain curve: M against switching frequency, every point a solved steady
 * state, with the first-harmonic prediction beside it.
 */
export function resonantSweepF(kind, params, { lo = 0.4, hi = 2, n = 41 } = {}) {
  const p = { ...RESONANT_DEFAULTS, ...params }
  const { fr } = resonantFrequencies(p)
  const out = []
  for (let i = 0; i < n; i++) {
    const fs = fr * lo * (hi / lo) ** (i / (n - 1))
    const conv = resonant(kind, { ...p, fs })
    const m = resonantMeasures(resonantSteadyState(conv), { harmonics: 1 })
    out.push({ x: fs, M: m.M, pred: m.Mfha, eta: m.eta, zvs: m.zvs, blocked: m.blocked, mode: 'resonant' })
  }
  return out
}

/**
 * What a hard-switched bridge would pay for the same edges, for the
 * comparison K3 is about: half the blocked voltage times the current being
 * commutated, once per edge, twice a switching period. A resonant converter
 * pays it only at turn-off, and only if the current has not already reversed.
 */
export function resonantSwitchingLoss(m, { Vblk, tr = 0, tf = 0, fs }) {
  const hard = 0.5 * Vblk * (Math.abs(m.iTurnOn) * tr + Math.abs(m.iTurnOff) * tf) * fs
  const soft = 0.5 * Vblk * Math.abs(m.iTurnOff) * tf * fs
  return { hard, soft, saved: hard - soft, zvs: m.zvs }
}
