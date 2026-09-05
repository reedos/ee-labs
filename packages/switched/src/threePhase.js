// Three legs instead of two: the three-phase inverter.
//
// The single-phase bridge of `inverter.js` puts one voltage across one filter.
// A three-phase bridge is three half-bridges across the same rail, each with
// its own filter and its own third of a balanced load, and the three loads
// meet at a neutral that is connected to nothing else. That floating neutral
// is what makes the circuit worth its own module.
//
// Write s_k ∈ {0, 1} for whether leg k's upper switch is closed. The leg's
// pole voltage against the negative rail is s_k·V_dc. The load's neutral sits
// wherever it must for the three phase currents to sum to zero, which for a
// balanced load is
//
//     v_nN = (s_a + s_b + s_c)·V_dc / 3,
//
// so the voltage each phase of the load actually sees is
//
//     v_kn = σ_k·V_dc,   σ_k = s_k − (s_a + s_b + s_c)/3.
//
// σ is the whole of the coupling between the phases. Anything common to all
// three legs cancels out of it exactly: the third harmonic a modulator adds
// on purpose, and the carrier's own harmonics when m_f is a multiple of
// three. That cancellation is I2's lesson and it is exact, not approximate.
//
// With σ known the three phases are three independent second-order circuits,
// [i_L, v_C] each, driven by σ_k·V_dc. So the steady state is three linear
// solves of the kind `clocked.js` does, over the same list of intervals, and
// the bridge's own voltages are piecewise constant and integrate against a
// sine in closed form. Nothing here time-steps and nothing here iterates.
//
// Six-step is the same machine with six intervals a cycle instead of a few
// hundred, so both modulators share every line below the pattern.

import { clockedSteadyState, statsOf, spectrumOf, fourierAt } from './clocked.js'
import { bisect, sample, integral } from './segment.js'
import { evalSignal } from './topologies.js'
import { signalIntegral } from './steady.js'

export const THREE_KINDS = ['sixstep', 'spwm3']

export const THREE_DEFAULTS = {
  Vdc: 48,
  f1: 60,
  L: 2e-3,
  C: 33e-6,
  R: 10,
  ma: 0.8,
  fsw: 1980, // requested carrier; snapped to an odd multiple of three times f₁
  injection: 0, // amplitude of the third harmonic added to each reference
}

/** The third-harmonic amplitude that flattens the reference the most. */
export const INJECTION_SIXTH = 1 / 6

/** The peak of sin θ + a·sin 3θ, which at a = 1/6 is exactly √3/2. */
export function referencePeak(a) {
  if (a === 0) return 1
  let peak = 0
  const n = 4000
  for (let i = 0; i <= n; i++) {
    const th = (Math.PI * i) / n
    peak = Math.max(peak, Math.abs(Math.sin(th) + a * Math.sin(3 * th)))
  }
  return peak
}

/** The modulation index the carrier can still contain, given the injection. */
export const modulationCeiling = (a) => 1 / referencePeak(a)

/**
 * The carrier's multiple of the fundamental: an odd multiple of three, at
 * least three.
 *
 * Odd keeps the waveform half-wave symmetric, so no even harmonic survives.
 * A multiple of three puts the carrier's own harmonics in the triplen family,
 * which the floating neutral removes from the load. Both are why a real
 * three-phase modulator locks its carrier to its reference.
 */
export function carrierRatio3(fsw, f1) {
  const raw = Math.max(3, fsw / f1)
  return Math.max(3, 6 * Math.round((raw - 3) / 6) + 3)
}

/** The three references' phase offsets, a leading b leading c. */
export const PHASES = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]

/**
 * The instants at which one leg changes state over a fundamental period, and
 * the state it starts in.
 *
 * The carrier is a triangle from −1 to +1 and back over each of its m_f
 * periods, so a crossing is a root inside one ramp and there is at most one.
 * Where the reference is outside the carrier there is no root at all: the leg
 * stays where it is, and that is overmodulation.
 */
export function legSwitching({ ma, mf, f1, phase = 0, injection = 0, tol = 1e-14 }) {
  const T = 1 / f1
  const Tc = T / mf
  const w = (2 * Math.PI) / T
  const ref = (t) => ma * (Math.sin(w * t - phase) + injection * Math.sin(3 * (w * t - phase)))
  const carrier = (t) => {
    const u = t - Math.floor(t / Tc) * Tc
    return u <= Tc / 2 ? -1 + (4 * u) / Tc : 1 - (4 * (u - Tc / 2)) / Tc
  }
  const g = (t) => ref(t) - carrier(t)
  const edges = []
  for (let q = 0; q < mf; q++) {
    const t0 = q * Tc
    const mid = t0 + Tc / 2
    const t1 = t0 + Tc
    for (const [a, b] of [
      [t0, mid],
      [mid, t1],
    ]) {
      const ga = g(a)
      const gb = g(b)
      if (ga >= 0 !== gb >= 0) edges.push(bisect(g, a, b, tol * T))
    }
  }
  return { edges, start: g(0) >= 0 ? 1 : 0 }
}

/** The six-step pattern: which legs are high through each sixth of a cycle. */
export const SIX_STEP = [
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 1, 1],
  [0, 0, 1],
  [1, 0, 1],
]

/** What the sector is called: the legs held high through it. */
const sectorName = (s) => ['a', 'b', 'c'].filter((_, i) => s[i]).join('') || 'none'

/**
 * The switching pattern over one fundamental period: a list of intervals,
 * each with the three legs' states, their durations and the neutral-referred
 * σ the load sees.
 */
export function threePhasePattern(kind, p) {
  const T = 1 / p.f1
  if (kind === 'sixstep') {
    return {
      mf: 1,
      fsw: p.f1,
      intervals: SIX_STEP.map((s, i) => ({ s, T: T / 6, t0: (i * T) / 6, name: sectorName(s) })),
    }
  }
  const mf = carrierRatio3(p.fsw, p.f1)
  const legs = PHASES.map((phase) => legSwitching({ ma: p.ma, mf, f1: p.f1, phase, injection: p.injection }))
  const marks = []
  legs.forEach((leg, k) => leg.edges.forEach((t) => marks.push({ t, k })))
  marks.sort((a, b) => a.t - b.t)
  const s = legs.map((l) => l.start)
  const intervals = []
  let t0 = 0
  for (const mk of marks) {
    if (mk.t > t0 + 1e-15 * T) {
      intervals.push({ s: s.slice(), T: mk.t - t0, t0, name: sectorName(s) })
      t0 = mk.t
    }
    s[mk.k] = 1 - s[mk.k]
  }
  if (T > t0) intervals.push({ s: s.slice(), T: T - t0, t0, name: sectorName(s) })
  return { mf, fsw: mf * p.f1, intervals }
}

const lin = (c1, c2, d = 0) => ({ c: [c1, c2], d })
const k0 = (d) => ({ c: [0], d })

/** σ_k for an interval: the leg's own state less the average of the three. */
export const sigmaOf = (s) => s.map((v) => v - (s[0] + s[1] + s[2]) / 3)

/**
 * A three-phase inverter: the pattern, the per-phase circuit, and the states
 * each phase runs through.
 */
export function threePhase(kind, params = {}) {
  if (!THREE_KINDS.includes(kind)) throw new Error(`unknown three-phase inverter "${kind}"`)
  const p = { ...THREE_DEFAULTS, ...params }
  const T = 1 / p.f1
  const { Vdc, L, C, R } = p
  // Group I is about what the modulator puts on the load, so the filter and
  // the load are the only impedances: a lossy leg would move every number in
  // the group without changing a single claim in it.
  const A = [
    [0, -1 / L],
    [1 / C, -1 / (R * C)],
  ]
  const pattern = threePhasePattern(kind, p)
  // One per-phase state per interval, differing only in the drive σ·V_dc.
  const phaseState = (sigma, name) => ({
    name,
    A,
    f: [(sigma * Vdc) / L, 0],
    signals: {
      // The leg's voltage against the load's neutral: what this phase is
      // actually driven by, and a constant within the interval.
      vsw: k0(sigma * Vdc),
      vout: lin(0, 1),
      vC: lin(0, 1),
      vL: lin(0, -1, sigma * Vdc),
      iL: lin(1, 0),
      iC: lin(1, -1 / R),
      iR: lin(0, 1 / R),
    },
  })
  const intervals = pattern.intervals.map((q) => {
    const sigma = sigmaOf(q.s)
    return { ...q, sigma, phases: sigma.map((v, k) => phaseState(v, `${q.name}·${'abc'[k]}`)) }
  })
  return {
    kind,
    p,
    T,
    mf: pattern.mf,
    fsw: pattern.fsw,
    intervals,
    signals: THREE_SIGNALS,
    ceiling: modulationCeiling(p.injection),
    // What the modulator asks the line-to-line fundamental to be, at its peak.
    commanded:
      kind === 'sixstep'
        ? (2 * Math.sqrt(3) * Vdc) / Math.PI
        : (Math.sqrt(3) / 2) * Math.min(p.ma, modulationCeiling(p.injection)) * Vdc,
  }
}

export const THREE_SIGNALS = ['vpole', 'vsw', 'vll', 'vout', 'vb', 'vc', 'vL', 'iL', 'iC', 'iR', 'iin']

/** The bridge's own voltages: piecewise constant, so a one-state carrier for them. */
function bridgeSolution(conv) {
  const { Vdc } = conv.p
  const segments = conv.intervals.map((q) => {
    const state = {
      name: q.name,
      A: [[0]],
      f: [0],
      signals: {
        // Leg a against the middle of the rail, which is where a modulator's
        // own third harmonic is visible.
        vpole: k0((q.s[0] - 0.5) * Vdc),
        // Leg a against the load's neutral: the six-level staircase.
        vsw: k0(q.sigma[0] * Vdc),
        // Between two legs, where the neutral cannot reach.
        vll: k0((q.s[0] - q.s[1]) * Vdc),
      },
    }
    return { name: q.name, state, A: state.A, f: state.f, x0: [0], T: q.T, t0: q.t0 }
  })
  return { T: conv.T, x0: [0], segments, conv }
}

/**
 * The periodic steady state: one linear solve per phase over the shared list
 * of intervals, plus the bridge's own piecewise-constant voltages.
 */
export function threePhaseSteadyState(conv) {
  const phases = [0, 1, 2].map((k) => {
    const plan = conv.intervals.map((q) => ({ state: q.phases[k], T: q.T }))
    const r = clockedSteadyState(plan, 2)
    return { mode: 'inverter', conv, T: conv.T, x0: r.x0, xEnd: r.xEnd, segments: r.segments }
  })
  return { mode: 'inverter', conv, T: conv.T, phases, bridge: bridgeSolution(conv), x0: phases[0].x0, segments: phases[0].segments }
}

/** Every signal at one instant of one interval, from the three phase states. */
function readAt(conv, i, xs, name) {
  const q = conv.intervals[i]
  if (name === 'vpole') return (q.s[0] - 0.5) * conv.p.Vdc
  if (name === 'vll') return (q.s[0] - q.s[1]) * conv.p.Vdc
  if (name === 'vb') return evalSignal(q.phases[1], 'vout', xs[1])
  if (name === 'vc') return evalSignal(q.phases[2], 'vout', xs[2])
  if (name === 'iin') return q.s.reduce((a, s, k) => a + s * evalSignal(q.phases[k], 'iL', xs[k]), 0)
  return evalSignal(q.phases[0], name, xs[0])
}

/**
 * Traces over `periods` fundamental cycles. Every interval contributes both
 * of its ends, so a switching edge plots vertical.
 */
export function threePhaseWaveform(ss, { periods = 1, n = 900 } = {}) {
  const conv = ss.conv
  const names = THREE_SIGNALS
  const t = []
  const sig = Object.fromEntries(names.map((s) => [s, []]))
  const p = []
  const edges = []
  const R = conv.p.R
  for (let c = 0; c < periods; c++) {
    const base = c * ss.T
    conv.intervals.forEach((q, i) => {
      const m = Math.max(2, Math.round((n * q.T) / ss.T))
      const pts = [0, 1, 2].map((k) => sample(ss.phases[k].segments[i], m))
      const dt = q.T / m
      for (let j = 0; j <= m; j++) {
        const xs = [pts[0][j], pts[1][j], pts[2][j]]
        t.push(base + q.t0 + j * dt)
        for (const s of names) sig[s].push(readAt(conv, i, xs, s))
        const va = readAt(conv, i, xs, 'vout')
        const vb = readAt(conv, i, xs, 'vb')
        const vc = readAt(conv, i, xs, 'vc')
        p.push((va * va + vb * vb + vc * vc) / R)
      }
    })
    // Six intervals a cycle can be named; a few hundred cannot, so a
    // modulated pattern names its half cycles as the single-phase bridge does.
    if (conv.kind === 'sixstep') conv.intervals.forEach((q) => edges.push({ t: base + q.t0, name: q.name }))
    else edges.push({ t: base, name: 'a b c' }, { t: base + ss.T / 2, name: 'a b c' })
  }
  return { t, sig, p, edges, T: ss.T, mf: conv.mf }
}

/**
 * The instantaneous power the balanced load takes, and how much of it moves.
 *
 * A balanced set of sines makes Σcos²(θ − k·120°) = 3/2 whatever θ is, so the
 * three-phase load's power does not breathe and the rail does not have to
 * carry a swing at twice the line frequency. `swing` is the peak-to-peak of
 * p(t) over its mean, which is 2 for a single-phase sine and near zero here.
 */
export function loadPower(ss, { dense = 12 } = {}) {
  const conv = ss.conv
  const R = conv.p.R
  let min = Infinity
  let max = -Infinity
  conv.intervals.forEach((q, i) => {
    const pts = [0, 1, 2].map((k) => sample(ss.phases[k].segments[i], dense))
    for (let j = 0; j <= dense; j++) {
      let acc = 0
      for (let k = 0; k < 3; k++) {
        const v = evalSignal(q.phases[k], 'vout', pts[k][j])
        acc += (v * v) / R
      }
      if (acc < min) min = acc
      if (acc > max) max = acc
    }
  })
  return { min, max, pp: max - min }
}

/**
 * What the three-phase bridge is judged by.
 *
 * The bridge's own voltages are piecewise constant, so their harmonics are
 * closed-form integrals. The load's are not, so its fundamental is one
 * integral and its distortion comes from the exact total RMS, the same route
 * `inverterMeasures` takes.
 */
export function threePhaseMeasures(ss, { dense = 16, harmonics = 0 } = {}) {
  const conv = ss.conv
  const p = conv.p
  const bridge = ss.bridge
  const kMax = harmonics || Math.min(200, 2 * conv.mf + 8)
  const bStats = statsOf(bridge, ['vpole', 'vsw', 'vll'], { dense: 2 })
  const phase = [0, 1, 2].map((k) => statsOf(ss.phases[k], ['vout', 'vL', 'iL', 'iC', 'iR'], { dense }))
  const sig = {
    vpole: bStats.vpole,
    vsw: bStats.vsw,
    vll: bStats.vll,
    vout: phase[0].vout,
    vb: phase[1].vout,
    vc: phase[2].vout,
    vL: phase[0].vL,
    iL: phase[0].iL,
    iC: phase[0].iC,
    iR: phase[0].iR,
    iin: railCurrent(ss, { dense }),
  }
  const llSpectrum = spectrumOf(bridge, 'vll', kMax)
  const swSpectrum = spectrumOf(bridge, 'vsw', kMax)
  const poleSpectrum = spectrumOf(bridge, 'vpole', kMax)
  const Vll1 = llSpectrum[0].rms
  const Vsw1 = swSpectrum[0].rms
  const out1c = fourierAt(ss.phases[0], 'vout', 1)
  const V1 = Math.hypot(out1c.a, out1c.b) / Math.SQRT2
  const thdOf = (rms, first) => (first > 0 ? Math.sqrt(Math.max(0, rms * rms - first * first)) / first : 0)
  const power = loadPower(ss, { dense: Math.max(8, Math.round(dense / 2)) })
  const Pout = (phase[0].vout.rms ** 2 + phase[1].vout.rms ** 2 + phase[2].vout.rms ** 2) / p.R
  const Pin = p.Vdc * sig.iin.avg
  const loss = {
    inductor: p.RL * (phase[0].iL.rms ** 2 + phase[1].iL.rms ** 2 + phase[2].iL.rms ** 2),
    esr: p.ESR * (phase[0].iC.rms ** 2 + phase[1].iC.rms ** 2 + phase[2].iC.rms ** 2),
  }
  const Pcond = loss.inductor + loss.esr
  return {
    sig,
    Pin,
    Pout,
    loss,
    Pcond,
    Ploss: Pcond,
    balance: Pin - Pout - Pcond,
    eta: Pin !== 0 ? Pout / Pin : 1,
    mode: 'inverter',
    // The bridge, line to line and phase to neutral.
    Vll1,
    VllRms: sig.vll.rms,
    thdLL: thdOf(sig.vll.rms, Vll1),
    Vsw1,
    VswRms: sig.vsw.rms,
    thdSw: thdOf(sig.vsw.rms, Vsw1),
    // The load.
    V1,
    Vrms: sig.vout.rms,
    thd: thdOf(sig.vout.rms, V1),
    Irms: sig.iR.rms,
    I1: V1 / p.R,
    harmonics: llSpectrum,
    poleHarmonics: poleSpectrum,
    phaseHarmonics: swSpectrum,
    // The third harmonic, in the three places it may or may not be.
    triplen: {
      pole: poleSpectrum[2] ? poleSpectrum[2].rms : 0,
      phase: swSpectrum[2] ? swSpectrum[2].rms : 0,
      line: llSpectrum[2] ? llSpectrum[2].rms : 0,
    },
    power: { ...power, avg: Pout, swing: Pout > 0 ? power.pp / Pout : 0 },
    mf: conv.mf,
    fsw: conv.fsw,
    spectrum: { unit: 'V', of: 'v_ab', caption: 'Bridge line-to-line voltage, one fundamental cycle' },
    S: 3 * sig.vout.rms * sig.iR.rms,
    pf: sig.vout.rms * sig.iR.rms > 0 ? Pout / (3 * sig.vout.rms * sig.iR.rms) : 1,
    distortion: sig.vout.rms > 0 ? V1 / sig.vout.rms : 1,
    displacement: 1,
    phi1: 0,
  }
}

/**
 * The current the rail supplies: whichever inductor currents are connected to
 * it at each instant. Its average is exact, from the segment integrals; its
 * spread is read off the same intervals.
 */
export function railCurrent(ss, { dense = 16 } = {}) {
  const conv = ss.conv
  let avg = 0
  let ms = 0
  let min = Infinity
  let max = -Infinity
  conv.intervals.forEach((q, i) => {
    for (let k = 0; k < 3; k++) {
      if (!q.s[k]) continue
      avg += signalIntegral(ss.phases[k].segments[i], 'iL', integral(ss.phases[k].segments[i]))
    }
    const pts = [0, 1, 2].map((k) => sample(ss.phases[k].segments[i], dense))
    for (let j = 0; j <= dense; j++) {
      let acc = 0
      for (let k = 0; k < 3; k++) if (q.s[k]) acc += evalSignal(q.phases[k], 'iL', pts[k][j])
      if (acc < min) min = acc
      if (acc > max) max = acc
      ms += (acc * acc * q.T) / (dense + 1)
    }
  })
  return { avg: avg / ss.T, rms: Math.sqrt(Math.max(0, ms / ss.T)), min, max, pp: max - min }
}

// The closed forms Group I quotes, each a function of the rail alone.

/** Six-step, line to line: a quasi-square with a 60° gap. */
export const sixStepLineRms = (Vdc) => (Math.sqrt(6) / Math.PI) * Vdc
export const sixStepLineTotalRms = (Vdc) => Math.sqrt(2 / 3) * Vdc
/** Six-step, phase to the load's neutral: the six-level staircase. */
export const sixStepPhaseRms = (Vdc) => (Math.SQRT2 / Math.PI) * Vdc
export const sixStepPhaseTotalRms = (Vdc) => (Math.SQRT2 / 3) * Vdc
/** Both waveforms have the same distortion: √(π²/9 − 1). */
export const sixStepThd = () => Math.sqrt(Math.PI ** 2 / 9 - 1)
/** Sine PWM, line to line, at the peak: (√3/2)·m_a·V_dc while m_a fits the carrier. */
export const spwm3LinePeak = (ma, Vdc) => (Math.sqrt(3) / 2) * ma * Vdc
