// Resonant conversion: a tank between the bridge and the rectifier.
//
// Every converter before this one hands the switch a square voltage and a
// current that is whatever the inductor was carrying, so both are present at
// the instant it opens and the edge costs energy. A resonant converter puts
// an LC between the bridge and the load, so the current the switch commutates
// is a piece of a sine. Run above the tank's resonance and that sine lags the
// square that drives it, which means the current is still flowing the wrong
// way when the switch turns on: the node has already swung, and the turn-on
// costs nothing. That is the whole argument, and it is measurable.
//
// The circuit is still piecewise linear, and for the same reason as every
// other converter here. Between events the tank is an LTI circuit, and the
// only thing that changes is which rectifier leg conducts. So the period is
// two clock windows (the half-bridge's two switches) with the rectifier's own
// events inside them, which is `isolated.js`'s `windowedSteadyState` exactly.
//
// ------------------------------------------------------------- the state
//
// The series converter is x = [i_r, v_Cr, v_o]: the tank current, the tank
// capacitor, the output. The LLC adds a magnetising inductance across the
// primary, and the state that makes its rectifier exact is not i_m but
//
//     j = i_r − i_m,      the current the transformer actually carries.
//
// x = [i_r, j, v_Cr, v_o]. The rectifier's rule is a statement about j and
// nothing else — the + leg conducts while j > 0 — and while neither leg
// conducts, j is pinned at zero by a row of zeros rather than by a tolerance.
// A model whose blocked current is exactly zero cannot chatter, and the
// series converter is the same statement with j = i_r.
//
// -------------------------------------------------------- what is modelled
//
// The bridge is a half bridge: the switch node steps between the two rails,
// so the rail supplies i_r for half the period and nothing for the other
// half. The tank capacitor carries half the rail as its own DC, so what the
// tank inductor and the transformer see is ±V_in/2 about that. `v_sw` is the
// switch node itself, the node the schematic probes, and its mean is V_in/2.
// The secondary is centre-tapped, so one diode drop reaches the
// output. `Rs` is the whole tank loop's series resistance — the winding, the
// switches, the capacitor's own — and it is charged as the winding row of the
// ledger, which is where a reader will look for it.
//
// The dead time between the two switches is not modelled. It is what lets the
// switch node swing before the next switch turns on, so the model states the
// condition for zero-voltage switching (the tank current still flowing the
// wrong way at the instant of the edge) and reports it, rather than drawing a
// transition it does not compute.
//
// ---------------------------------------------- the first-harmonic approach
//
// The textbook analyses this circuit by keeping the fundamental and throwing
// the rest away: the square drive becomes its own fundamental, the rectifier
// and load become a resistance of 8R/(π²n²), and the gain is one complex
// division. That is an approximation, so it carries a guard. It is close near
// resonance, where the tank current really is nearly a sine, and it is not
// close well below, where the current is a train of arcs with gaps in it.
// `fhaGain` computes it and the experiments draw it beside the exact answer,
// with the gap between them measured rather than asserted.

import { SIGNALS, evalSignal } from './topologies.js'
import { windowedSteadyState } from './isolated.js'
import { eye } from './linalg.js'
import { quadrature, sample } from './segment.js'
import { measures, average } from './steady.js'

export const RESONANT_KINDS = ['src', 'llc']

export const RESONANT_DEFAULTS = {
  Vin: 48,
  fs: 100e3,
  Lr: 30e-6,
  Cr: 84.4e-9,
  Lm: 150e-6,
  n: 0.5, // turns ratio N_s/N_p, one half of the centre-tapped secondary
  C: 100e-6,
  R: 12,
  Rs: 0,
  Vf: 0,
  tr: 0,
  tf: 0,
}

// ------------------------------------------------------- the closed forms

/** The tank's own resonance, where the series pair is a short. */
export const seriesResonance = ({ Lr, Cr }) => 1 / (2 * Math.PI * Math.sqrt(Lr * Cr))

/**
 * The lower resonance, with the magnetising inductance in series because the
 * rectifier is not conducting. An LLC's gain can exceed one between the two.
 */
export const lowerResonance = ({ Lr, Lm, Cr }) => 1 / (2 * Math.PI * Math.sqrt((Lr + Lm) * Cr))

/** The tank's characteristic impedance, √(L_r/C_r). */
export const tankImpedance = ({ Lr, Cr }) => Math.sqrt(Lr / Cr)

/**
 * The load a rectifier and its filter present to the tank, kept to the
 * fundamental: the secondary sees a square voltage of ±V_out and a current in
 * phase with it, so the ratio of their fundamentals is 8R/π², and the turns
 * ratio brings it to the primary.
 */
export const acLoad = ({ R, n }) => (8 * R) / (Math.PI * Math.PI * n * n)

/** The tank's quality factor against that load: Z_0/R_ac. */
export const tankQ = (p) => tankImpedance(p) / acLoad(p)

/**
 * The first-harmonic gain of the tank, |v_primary/v_square| at the drive
 * frequency. The series converter is a divider between the load and the
 * series pair; the LLC puts the magnetising inductance in parallel with the
 * load first.
 */
export function fhaGain(kind, p) {
  const { Lr, Cr, Lm, fs } = p
  const w = 2 * Math.PI * fs
  const Rac = acLoad(p)
  const X = w * Lr - 1 / (w * Cr) // the series pair's reactance
  if (kind === 'src') return Rac / Math.hypot(Rac, X)
  // Z_p = jωL_m ‖ R_ac, then the divider against jX.
  const wm = w * Lm
  const den = Rac * Rac + wm * wm
  const zpRe = (Rac * wm * wm) / den
  const zpIm = (Rac * Rac * wm) / den
  return Math.hypot(zpRe, zpIm) / Math.hypot(zpRe, zpIm + X)
}

/**
 * The conversion ratio the first-harmonic approach predicts. The square
 * drive's fundamental is (2/π)V_in peak and the rectifier's is (4/π)V_out/n,
 * so the DC ratio is half the AC gain times the turns ratio.
 */
export const fhaRatio = (kind, p) => (p.n / 2) * fhaGain(kind, p)

// -------------------------------------------------------------- the circuit

/**
 * A resonant converter as a switched linear circuit.
 *
 * `kind` is 'src' (L_r and C_r alone) or 'llc' (with the magnetising
 * inductance across the primary). Both are solved by `windowedSteadyState`:
 * two clock windows, the rectifier's events inside them.
 */
export function resonantConverter(kind, params = {}) {
  if (!RESONANT_KINDS.includes(kind)) throw new Error(`unknown resonant converter "${kind}"`)
  const p = { ...RESONANT_DEFAULTS, ...params }
  const { Vin, fs, Lr, Cr, Lm, n, C, R, Rs, Vf } = p
  const llc = kind === 'llc'
  const N = llc ? 4 : 3
  const IR = 0
  const IJ = llc ? 1 : 0
  const VC = llc ? 2 : 1
  const VO = llc ? 3 : 2
  const T = 1 / fs
  const half = T / 2
  // The tank inductance the drive sees while the transformer carries nothing.
  const Lz = llc ? Lr + Lm : Lr
  const zeros = () => Array.from({ length: N }, () => new Array(N).fill(0))
  const form = (entries, d = 0) => {
    const c = new Array(N).fill(0)
    for (const [i, v] of entries) c[i] += v
    return { c, d }
  }
  const nil = form([])

  /** One state: the drive sign s, and which rectifier leg conducts. */
  const build = (s, rho) => {
    const vsq = (s * Vin) / 2
    const A = zeros()
    const f = new Array(N).fill(0)
    let vL
    let iD
    let iC
    if (rho === 0) {
      // Neither leg conducts. The transformer current is pinned at zero and
      // the tank runs through L_r + L_m (the series converter has no L_m, so
      // it simply stops).
      if (llc) {
        A[IR][IR] = -Rs / Lz
        A[IR][VC] = -1 / Lz
        f[IR] = vsq / Lz
        A[VC][IR] = 1 / Cr
        vL = form([[IR, (-Rs * Lr) / Lz], [VC, -Lr / Lz]], (vsq * Lr) / Lz)
      } else {
        vL = nil
      }
      A[VO][VO] = -1 / (R * C)
      iD = nil
      iC = form([[VO, -1 / R]])
    } else {
      A[IR][IR] = -Rs / Lr
      A[IR][VC] = -1 / Lr
      A[IR][VO] = -rho / (n * Lr)
      f[IR] = vsq / Lr - (rho * Vf) / (n * Lr)
      if (llc) {
        A[IJ][IR] = -Rs / Lr
        A[IJ][VC] = -1 / Lr
        A[IJ][VO] = -rho / (n * Lr) - rho / (n * Lm)
        f[IJ] = vsq / Lr - (rho * Vf) / (n * Lr) - (rho * Vf) / (n * Lm)
      }
      A[VC][IR] = 1 / Cr
      A[VO][IJ] = rho / (n * C)
      A[VO][VO] = -1 / (R * C)
      vL = form([[IR, -Rs], [VC, -1], [VO, -rho / n]], vsq - (rho * Vf) / n)
      iD = form([[IJ, rho / n]])
      iC = form([[IJ, rho / n], [VO, -1 / R]])
    }
    // The upper switch carries the tank current for the whole of its own
    // window, in its body diode where the current is the other way, and the
    // rail supplies exactly that.
    const iQ = s > 0 ? form([[IR, 1]]) : nil
    return {
      A,
      f,
      project: rho === 0 ? pin(N, IJ) : null,
      signals: {
        iL: form([[IR, 1]]),
        vC: form([[VC, 1]]),
        vout: form([[VO, 1]]),
        // The switch node, measured where the schematic probes it: between
        // the two rails, so it is 0 or V_in and never negative. The tank's
        // own drive is this less the DC the tank capacitor holds, which is
        // the ±V_in/2 the gain formulas are written in.
        vsw: form([], vsq + Vin / 2),
        vL,
        iC,
        iQ,
        iD,
        iin: iQ,
        // The magnetising current, which is the tank current less what the
        // transformer carries.
        iM: llc ? form([[IR, 1], [IJ, -1]]) : nil,
        // The transformer's own current, signed.
        iT: form([[IJ, 1]]),
      },
    }
  }

  const states = {}
  const key = (s, rho) => `${s > 0 ? 'Q1' : 'Q2'} ${rho > 0 ? 'D+' : rho < 0 ? 'D−' : 'idle'}`
  for (const s of [1, -1]) {
    for (const rho of [1, -1, 0]) {
      const st = build(s, rho)
      st.name = key(s, rho)
      states[st.name] = st
    }
  }

  /** The voltage the transformer primary would see with no leg conducting. */
  const primaryDrive = (s) => (x) =>
    llc ? ((Lm * ((s * Vin) / 2 - x[VC] - Rs * x[IR])) / Lz) : (s * Vin) / 2 - x[VC]

  const windowFor = (s) => {
    const drive = primaryDrive(s)
    const threshold = (x) => (x[VO] + Vf) / n
    const pick = (x) => {
      if (x[IJ] > 0) return key(s, 1)
      if (x[IJ] < 0) return key(s, -1)
      const v = drive(x)
      const t = threshold(x)
      if (v > t) return key(s, 1)
      if (v < -t) return key(s, -1)
      return key(s, 0)
    }
    const guard = (x, name) => {
      if (name === key(s, 1)) return x[IJ]
      if (name === key(s, -1)) return -x[IJ]
      return threshold(x) - Math.abs(drive(x))
    }
    // The event is the transformer current reaching zero, so the state just
    // after it is read with that current at zero rather than extrapolated
    // through the leg that has stopped. Below resonance the two answers
    // differ: the extrapolation says the other leg takes over, and the
    // circuit says neither does.
    const next = (x, from) => {
      const y = [...x]
      y[IJ] = 0
      const nm = pick(y)
      return nm === from ? null : nm
    }
    return { T: half, pick, guard, next }
  }

  return {
    kind,
    resonant: true,
    p: {
      ...p,
      // What `measures` reads: the tank loop's resistance is charged as the
      // winding, the rectifier's drop as the diode, and the switches carry no
      // resistance of their own here.
      D: 0.5,
      L: Lr,
      Ron: 0,
      rd: 0,
      RL: Rs,
      ESR: 0,
      sync: false,
    },
    T,
    tOn: half,
    order: N,
    index: { IR, IJ, VC, VO },
    states,
    signals: [...SIGNALS, 'iM', 'iT'],
    hasDead: true,
    inverted: false,
    isolated: true,
    n,
    windows: [windowFor(1), windowFor(-1)],
    // Newton starts from what the first-harmonic answer says the output is,
    // with the tank empty. The tank's own states settle in a few periods of
    // the search; the output's time constant is a hundred periods long, and
    // starting it at zero is what costs the iterations.
    guess: () => {
      const x = new Array(N).fill(0)
      x[VO] = Math.max(0, fhaRatio(kind, p) * Vin)
      return x
    },
    fr: seriesResonance(p),
    fr2: llc ? lowerResonance(p) : seriesResonance(p),
    Z0: tankImpedance(p),
    Rac: acLoad(p),
    Q: tankQ(p),
    ratio: fs / seriesResonance(p),
    switching: { D: 0.5, fs, T, n },
    blocking: () => Vin,
    stress: Vin,
    idealM: () => fhaRatio(kind, p),
  }
}

/** The projection that pins one component at zero on entering a state. */
function pin(N, i) {
  const P = eye(N)
  P[i][i] = 0
  return P
}

/** The steady state of a resonant converter: the windowed shooting method. */
export const resonantSteadyState = (conv, opts) => windowedSteadyState(conv, opts)

/**
 * What a resonant converter measures, with the switching loss the resonance
 * actually costs rather than the hard-switched model.
 *
 * A switch turns on at zero voltage when the tank current is still flowing
 * out of it at that instant — the body diode has already carried the node
 * across — and then the turn-on costs nothing. Turn-off still costs, at the
 * current the tank happens to be carrying when the gate goes. So the model is
 * the same ½·V·I·t per edge, with the turn-on term present only when the
 * condition fails, and `zvs` says which case the reader is looking at.
 */
export function resonantMeasures(ss) {
  const m = measures(ss)
  const conv = ss.conv
  const p = conv.p
  const { IR } = conv.index
  m.sig.iT = statOf(ss, 'iT')
  if (conv.kind === 'llc') m.sig.iM = statOf(ss, 'iM')
  // The current at the two switching instants, from the exact solution.
  const iOn = ss.x0[IR]
  const iOff = stateAtInstant(ss, conv.tOn)[IR]
  m.iTurnOn = iOn
  m.iTurnOff = iOff
  // Zero-voltage switching needs the tank current still flowing the wrong
  // way at the instant of the edge, by enough to carry the node across. A
  // current that is merely zero there is the other soft case, and it is not
  // the same claim, so it gets its own name.
  const floor = 1e-6 * Math.max(1e-30, m.sig.iL.rms)
  m.zvs = iOn < -floor
  m.zcs = Math.abs(iOn) <= floor
  m.lagging = m.zvs
  // Two switches, so two turn-ons and two turn-offs a period; by the
  // half-wave symmetry each pair commutates the same magnitude.
  const edges = 2 * p.fs
  const turnOn = m.zvs ? 0 : 0.5 * p.Vin * Math.abs(iOn) * p.tr * edges
  const turnOff = 0.5 * p.Vin * Math.abs(iOff) * p.tf * edges
  m.loss.switching = turnOn + turnOff
  m.lossTurnOn = turnOn
  m.lossTurnOff = turnOff
  m.Ploss = m.Pcond + m.loss.switching
  m.eta = m.Pout / (m.Pin + m.loss.switching)
  m.fr = conv.fr
  m.fr2 = conv.fr2
  m.ratio = conv.ratio
  m.Q = conv.Q
  m.Mfha = fhaRatio(conv.kind, p)
  // How far the first-harmonic answer is from the measured one, which is the
  // number the guard on it is about.
  m.fhaError = m.Mfha === 0 ? 0 : m.M / m.Mfha - 1
  return m
}

/** The state at an instant inside the period, from the segment that holds it. */
function stateAtInstant(ss, t) {
  const live = ss.segments.filter((s) => s.T > 0)
  for (const seg of live) {
    if (t >= seg.t0 - 1e-15 && t <= seg.t0 + seg.T + 1e-15) {
      return sample({ ...seg, T: Math.max(0, Math.min(seg.T, t - seg.t0)) }, 1)[1]
    }
  }
  const last = live[live.length - 1]
  return sample(last, 1)[1]
}

function statOf(ss, name, dense = 256) {
  const live = ss.segments.filter((s) => s.T > 0)
  let min = Infinity
  let max = -Infinity
  let ms = 0
  for (const seg of live) {
    for (const x of sample(seg, dense)) {
      const y = evalSignal(seg.state, name, x)
      if (y < min) min = y
      if (y > max) max = y
    }
    ms += quadrature(seg, (x) => evalSignal(seg.state, name, x) ** 2)
  }
  return { avg: average(ss, name), rms: Math.sqrt(Math.max(0, ms / ss.T)), min, max, pp: max - min }
}

/**
 * The gain curve against frequency, measured and predicted at each point.
 * Every point is a solved steady state, so the two curves are independent all
 * the way along.
 */
export function gainCurve(kind, params, { lo, hi, n = 41 } = {}) {
  const base = { ...RESONANT_DEFAULTS, ...params }
  const fr = seriesResonance(base)
  const f0 = lo || 0.5 * fr
  const f1 = hi || 2.5 * fr
  const out = []
  for (let i = 0; i < n; i++) {
    const fs = f0 * Math.pow(f1 / f0, i / (n - 1))
    const conv = resonantConverter(kind, { ...base, fs })
    const ss = resonantSteadyState(conv)
    const m = resonantMeasures(ss)
    out.push({ x: fs, M: m.M, pred: fhaRatio(kind, { ...base, fs }), zvs: m.zvs, eta: m.eta, mode: ss.mode })
  }
  return out
}

// The two switch-loss models the same devices would pay, for the comparison
// K3 is about: the resonant bridge's, and a hard-switched one commutating the
// full load current at every edge.
export const hardSwitchedEdgeLoss = ({ Vin, Iout, tr, tf, fs }) => 0.5 * Vin * Iout * (tr + tf) * 2 * fs
