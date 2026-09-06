// Three phases out: the same bridge leg as the single-phase inverter, three
// times over, 120° apart.
//
// Each leg ties its terminal to +V_dc/2 or −V_dc/2 against the midpoint of
// the rail, so the leg voltage v_ao is a two-level square whatever the
// modulator. The load is a balanced wye of R and L with a floating neutral,
// which is the load a motor or a filter presents and the reason the
// interesting voltages are not the leg voltages:
//
//     v_no = (v_ao + v_bo + v_co)/3        the neutral's own potential
//     v_an = v_ao − v_no                   what phase a's winding sees
//     v_ab = v_ao − v_bo                   what a line-to-line meter sees
//
// Anything common to all three legs lands in v_no and never reaches the
// load. That one line is why triplen harmonics are absent from the line, and
// why a third-harmonic offset added to all three references buys headroom
// for nothing (I2).
//
// The state is [i_a, i_b], with i_c = −i_a − i_b because the neutral carries
// no current. Within one switch combination the circuit is
//
//     L di_k/dt = v_kn − R i_k
//
// with v_kn constant, so A is diagonal and every segment is exact. Eight
// combinations of the three legs give eight states, built as they are
// needed.
//
// The DC bus current is i_dc = Σ u_k i_k with u_k ∈ {0, 1} the upper switch
// of leg k, which is a linear form of the state as well. Since Σ i_k = 0,
// V_dc·i_dc = Σ v_kn i_k identically: the power the rail supplies is the
// power the load receives, instant by instant, and I3 is about what that
// number does over a cycle.
//
// The pattern is fixed before the state is, exactly as in `inverter.js`, so
// one period is an affine map and the periodic state is a linear solve
// (`clocked.js`). Six-step has six segments a cycle. Sine PWM has as many as
// the three comparators produce.

import { clockedSteadyState, statsOf, spectrumOf, fourierAt } from './clocked.js'
import { bisect, sample } from './segment.js'
import { evalSignal } from './topologies.js'

export const THREE_PHASE_KINDS = ['sixstep', 'spwm3']

// `vout` and `iL` are the phase voltage and the phase current under the
// names every pane in the suite already asks a converter for. They are the
// same two forms as `van` and `ia`, and the measures table lists each node
// once (schematics.jsx TOPOLOGY_SIGNALS).
export const THREE_PHASE_SIGNALS = ['vao', 'vab', 'van', 'ia', 'idc', 'vout', 'iL', 'ib', 'ic', 'pa', 'pdc']

export const THREE_PHASE_DEFAULTS = {
  Vdc: 48,
  f1: 60,
  L: 20e-3,
  R: 10,
  ma: 0.8, // modulation index, the reference's height against the carrier's
  fsw: 1260, // requested carrier; snapped to an odd multiple of three
  inject: 0, // amplitude of the third-harmonic offset, as a share of m_a
}

/**
 * The carrier's multiple of f₁: the nearest odd multiple of three, at least
 * three.
 *
 * Odd keeps the waveform half-wave symmetric, so there are no even
 * harmonics. A multiple of three makes the carrier common to all three
 * references, so the carrier's own harmonics are triplens and cancel
 * line-to-line.
 */
export function triplenRatio(fsw, f1) {
  const raw = Math.max(3, fsw / f1) / 3
  const odd = 2 * Math.round((raw - 1) / 2) + 1
  return 3 * Math.max(1, odd)
}

/**
 * The peak of sin θ + h·sin 3θ, which is what a reference of unit m_a
 * reaches.
 *
 * The derivative is cos θ (1 + 9h) − 12h cos³ θ, so the stationary points are
 * θ = π/2 and, once h exceeds one ninth, cos²θ = (9h − 1)/(12h). At h = 1/6
 * the second one is θ = 60°, where the offset is zero and the peak is
 * √3/2 = 0.8660.
 */
export function referencePeak(inject) {
  const h = inject || 0
  if (!(h > 0)) return 1
  const f = (th) => Math.sin(th) + h * Math.sin(3 * th)
  let best = Math.abs(f(Math.PI / 2))
  const c2 = (9 * h - 1) / (12 * h)
  if (c2 > 0 && c2 < 1) best = Math.max(best, Math.abs(f(Math.acos(Math.sqrt(c2)))))
  return best
}

/** The 120°-shifted reference of one leg, with its third-harmonic offset. */
export function legReference({ ma, inject, f1, phase }) {
  const w = 2 * Math.PI * f1
  return (t) => ma * (Math.sin(w * t - phase) + inject * Math.sin(3 * (w * t - phase)))
}

/**
 * The instants at which one leg changes sign over a fundamental period, with
 * the sign it takes after each.
 *
 * The carrier is a triangle from −1 at t = 0 to +1 at half a carrier period
 * and back. Within a ramp it is a straight line, so a crossing is a root and
 * is bisected on it. A ramp the reference never crosses produces no edge,
 * which is what overmodulation is.
 */
export function legEdges({ ref, mf, f1, tol = 1e-14 }) {
  const T = 1 / f1
  const Tc = T / mf
  const edges = []
  for (let q = 0; q < mf; q++) {
    const t0 = q * Tc
    const mid = t0 + Tc / 2
    const t1 = t0 + Tc
    const rise = (t) => ref(t) - (-1 + (4 * (t - t0)) / Tc)
    if (rise(t0) >= 0 && rise(mid) <= 0) edges.push({ t: bisect(rise, t0, mid, tol * T), s: -1 })
    const fall = (t) => -(ref(t) - (1 - (4 * (t - mid)) / Tc))
    if (fall(mid) >= 0 && fall(t1) <= 0) edges.push({ t: bisect(fall, mid, t1, tol * T), s: 1 })
  }
  return edges
}

const lin = (c1, c2, d = 0) => ({ c: [c1, c2], d })

/** One switch combination, as a linear circuit with its signal forms. */
function combination(p, s) {
  const { Vdc, L, R } = p
  const half = Vdc / 2
  const vo = s.map((q) => q * half)
  const vn = (vo[0] + vo[1] + vo[2]) / 3
  const v = vo.map((q) => q - vn)
  const u = s.map((q) => (q + 1) / 2)
  const A = [
    [-R / L, 0],
    [0, -R / L],
  ]
  const ia = lin(1, 0)
  const van = lin(0, 0, v[0])
  return {
    name: s.map((q) => (q > 0 ? '+' : '−')).join(''),
    A,
    f: [v[0] / L, v[1] / L],
    signals: {
      vao: lin(0, 0, vo[0]),
      vab: lin(0, 0, vo[0] - vo[1]),
      van,
      vout: van,
      ia,
      iL: ia,
      ib: lin(0, 1),
      ic: lin(-1, -1),
      idc: lin(u[0] - u[2], u[1] - u[2]),
      // Phase a's own instantaneous power, and the three of them added: the
      // rail's. Within a segment the winding voltage is constant, so both
      // are linear forms of the state like every other signal here.
      pa: lin(v[0], 0),
      pdc: lin(Vdc * (u[0] - u[2]), Vdc * (u[1] - u[2])),
    },
  }
}

/** The six-step sequence, sixty degrees at a time. */
const SIX_STEP = [
  [1, -1, 1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, 1, 1],
  [-1, -1, 1],
]

/**
 * A three-phase bridge: `sixstep` switches each leg once a half cycle,
 * `spwm3` compares three shifted sine references against one carrier.
 */
export function threePhase(kind, params = {}) {
  if (!THREE_PHASE_KINDS.includes(kind)) throw new Error(`unknown three-phase inverter "${kind}"`)
  const p = { ...THREE_PHASE_DEFAULTS, ...params }
  const T = 1 / p.f1
  const cache = new Map()
  const stateFor = (s) => {
    const key = s.join(',')
    if (!cache.has(key)) cache.set(key, combination(p, s))
    return cache.get(key)
  }
  const mf = kind === 'sixstep' ? 1 : triplenRatio(p.fsw, p.f1)
  const plan = []
  let states
  if (kind === 'sixstep') {
    for (const s of SIX_STEP) plan.push({ state: stateFor(s), T: T / 6 })
    states = SIX_STEP.map(stateFor)
  } else {
    const marks = []
    const start = []
    for (let leg = 0; leg < 3; leg++) {
      const ref = legReference({ ma: p.ma, inject: p.inject, f1: p.f1, phase: (leg * 2 * Math.PI) / 3 })
      start.push(ref(0) >= -1 ? 1 : -1)
      for (const e of legEdges({ ref, mf, f1: p.f1 })) marks.push({ ...e, leg })
    }
    marks.sort((a, b) => a.t - b.t)
    let s = start
    let prev = 0
    for (const e of marks) {
      if (e.t > prev) {
        plan.push({ state: stateFor(s), T: e.t - prev })
        prev = e.t
      }
      s = [...s]
      s[e.leg] = e.s
    }
    plan.push({ state: stateFor(s), T: T - prev })
    states = [...cache.values()]
  }
  const peak = referencePeak(p.inject)
  return {
    kind,
    p,
    T,
    mf,
    fsw: kind === 'sixstep' ? p.f1 : mf * p.f1,
    plan,
    states,
    threePhase: true,
    signals: THREE_PHASE_SIGNALS,
    // The reference's own height, and the modulation index at which it
    // reaches the carrier: 1 without an offset, 2/√3 with the classic sixth.
    referencePeak: peak,
    ceiling: 1 / peak,
    // What the modulator asks the line-to-line fundamental to be, at its peak.
    commanded: kind === 'sixstep' ? sixStepLinePeak(p.Vdc) : spwmLinePeak(Math.min(p.ma, 1 / peak), p.Vdc),
  }
}

export function threePhaseSteadyState(conv) {
  const r = clockedSteadyState(conv.plan, 2)
  return { mode: 'threephase', conv, T: conv.T, x0: r.x0, xEnd: r.xEnd, segments: r.segments }
}

// ------------------------------------------------------------ closed forms

/** Six-step: the line-to-line fundamental, RMS and peak. */
export const sixStepLineRms = (Vdc) => (Math.sqrt(6) / Math.PI) * Vdc
export const sixStepLinePeak = (Vdc) => (2 * Math.sqrt(3) / Math.PI) * Vdc
/** Six-step: the phase voltage's fundamental and its total RMS. */
export const sixStepPhaseRms = (Vdc) => (Math.SQRT2 / Math.PI) * Vdc
export const sixStepPhaseTotalRms = (Vdc) => (Math.SQRT2 / 3) * Vdc
export const sixStepLineTotalRms = (Vdc) => Math.sqrt(2 / 3) * Vdc

/** Sine PWM in three phases: the line-to-line fundamental's peak, m_a ≤ ceiling. */
export const spwmLinePeak = (ma, Vdc) => (Math.sqrt(3) / 2) * ma * Vdc
/** ...and the phase voltage's, which is the leg's own m_a·V_dc/2. */
export const spwmPhasePeak = (ma, Vdc) => (ma * Vdc) / 2

/**
 * What a third-harmonic offset of one sixth buys: the reference's peak drops
 * to √3/2, so m_a may rise by 2/√3 before it leaves the carrier.
 */
export const INJECTION = 1 / 6
export const injectionHeadroom = () => 2 / Math.sqrt(3)

// ------------------------------------------------------------ measures

const rms1 = (c) => Math.hypot(c.a, c.b) / Math.SQRT2

/**
 * What a three-phase bridge is judged by: the line-to-line fundamental, the
 * phase voltage's, the distortion of each, the power the load takes, and
 * what the DC bus sees while it is delivering it.
 *
 * `p2` is the amplitude of the bus power at twice the output frequency. It is
 * the number I3 exists for: a balanced three-phase load leaves it at zero,
 * and a single-phase bridge cannot.
 */
export function threePhaseMeasures(ss, { harmonics = 0, dense = 24 } = {}) {
  const conv = ss.conv
  const p = conv.p
  const sig = statsOf(ss, THREE_PHASE_SIGNALS, { dense })
  const kMax = harmonics || (conv.kind === 'sixstep' ? 25 : Math.min(240, 2 * conv.mf + 8))
  const lineSpectrum = spectrumOf(ss, 'vab', kMax)
  const Vll1 = lineSpectrum[0].rms
  const Vph1 = rms1(fourierAt(ss, 'van', 1))
  const I1 = rms1(fourierAt(ss, 'ia', 1))
  const thdOf = (rms, first) => (first > 0 ? Math.sqrt(Math.max(0, rms * rms - first * first)) / first : 0)
  // Every phase carries the same RMS in a balanced load, and the three are
  // measured rather than assumed: the sum is the load's own power.
  const Pout = p.R * (sig.ia.rms ** 2 + sig.ib.rms ** 2 + sig.ic.rms ** 2)
  const Pdc = p.Vdc * sig.idc.avg
  const at = (k) => {
    const c = fourierAt(ss, 'pdc', k)
    return Math.hypot(c.a, c.b)
  }
  const p2 = at(2)
  const p6 = at(6)
  // One phase's own power, for the comparison I3 makes: it swings at twice
  // the output frequency by S/P of its mean, and the other two cancel it.
  const pa2c = fourierAt(ss, 'pa', 2)
  const pa2 = Math.hypot(pa2c.a, pa2c.b)
  const Pa = sig.pa.avg
  const S = 3 * sig.van.rms * sig.ia.rms
  return {
    sig,
    // The line side of the bridge, which is what a meter across two
    // terminals reads.
    Vll1,
    VllRms: sig.vab.rms,
    thdLine: thdOf(sig.vab.rms, Vll1),
    // The load's own phase.
    V1: Vph1,
    Vrms: sig.van.rms,
    thd: thdOf(sig.van.rms, Vph1),
    I1,
    Irms: sig.ia.rms,
    thdCurrent: thdOf(sig.ia.rms, I1),
    // The bus.
    Pin: Pdc,
    Pout,
    Pdc,
    p2,
    p6,
    pa2,
    Pa,
    phaseSwing: Pa !== 0 ? pa2 / Pa : Infinity,
    busSwing: Pdc !== 0 ? p2 / Pdc : 0,
    // The ledger of a lossless bridge into a resistive load: what the rail
    // supplies is what the windings dissipate.
    balance: Pdc - Pout,
    loss: {},
    Ploss: 0,
    eta: Pdc !== 0 ? Pout / Pdc : 1,
    mode: 'threephase',
    harmonics: lineSpectrum,
    mf: conv.mf,
    fsw: conv.fsw,
    S,
    pf: S > 0 ? Pout / S : 1,
    distortion: sig.van.rms > 0 ? Vph1 / sig.van.rms : 1,
    displacement: 1,
    phi1: 0,
    // The spectrum pane draws the line-to-line voltage here.
    spectrum: { unit: 'V', of: 'v_ab', caption: 'Line-to-line voltage, one output cycle' },
    // The pane header's own names, so a three-phase table does not borrow
    // the single-phase bridge's.
    VswRms: sig.vab.rms,
    Vsw1: Vll1,
    thdSw: thdOf(sig.vab.rms, Vll1),
    carrier: null,
    attenuation: null,
  }
}

/** Waveform traces over `periods` output cycles. */
export function threePhaseWaveform(ss, { periods = 1, n = 1200 } = {}) {
  const names = THREE_PHASE_SIGNALS
  const t = []
  const sig = Object.fromEntries(names.map((s) => [s, []]))
  const edges = []
  for (let k = 0; k < periods; k++) {
    const base = k * ss.T
    for (const seg of ss.segments) {
      if (seg.T <= 0) continue
      const m = Math.max(2, Math.round((n * seg.T) / ss.T))
      const dt = seg.T / m
      const xs = sample(seg, m)
      for (let i = 0; i <= m; i++) {
        t.push(base + seg.t0 + i * dt)
        for (const s of names) sig[s].push(evalSignal(seg.state, s, xs[i]))
      }
    }
    // Six-step names its six sixty-degree steps. A carrier at sixty edges a
    // cycle would write a band of dashes over the plot, so sine PWM names
    // the half-cycle boundaries alone.
    if (ss.conv.kind === 'sixstep') {
      for (let q = 0; q < 6; q++) edges.push({ t: base + (q * ss.T) / 6, name: ss.conv.plan[q].state.name })
    } else {
      edges.push({ t: base, name: '0°' }, { t: base + ss.T / 2, name: '180°' })
    }
  }
  return { t, sig, edges, T: ss.T, mf: ss.conv.mf }
}

/**
 * The bus power of the single-phase bridge, for the comparison I3 makes.
 *
 * A single-phase load of the same kind takes p(t) = P(1 − cos 2ωt) +
 * Q sin 2ωt, so the rail must swallow a swing of √(P² + Q²) = S at twice the
 * output frequency. Three phases cancel it.
 */
export function singlePhaseBusRipple({ V1, I1, phi = 0 }) {
  const P = V1 * I1 * Math.cos(phi)
  const S = V1 * I1
  return { P, S, ripple: S, ratio: P > 0 ? S / P : Infinity }
}
