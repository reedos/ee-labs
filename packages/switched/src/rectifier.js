// Line-frequency circuits: the diode rectifiers and the phase-cut dimmer.
//
// A rectifier is a source, a series resistance, diodes, a capacitor and a
// load. The series resistance R_s is load-bearing, not a blemish: an ideal
// diode straight into a capacitor would draw an infinite current at the
// instant it conducts, so the circuit only computes because something limits
// the gulp — the transformer's winding, the wiring, the diode's own slope.
// Every peak current and conduction angle in these lessons is R_s's doing.
//
// State is x = [v_C, s, c] with (s, c) the source oscillator (events.js):
// s = V_p sin ωt is the phase-a voltage and every other phase is a linear
// form in (s, c). Each topology — which diode pair conducts, or none — is an
// LTI circuit in x, and `pick` chooses it from x alone: a pair conducts when
// its line voltage exceeds the capacitor by the diode drops, and stops when
// that excess (which is R_s times its current) falls through zero.
//
// Signals: vin the phase-a source voltage; vrect what the diodes would pass
// with no capacitor (the rectified source the conducting pair sees); vout
// the capacitor; iD the current through the conducting pair; iin the phase-a
// line current; iC, iR the capacitor's and the load's; vD the voltage across
// the first diode (anode to cathode), which is where the peak inverse voltage
// is read.

import { eventSteadyState, signalStats, periodIntegral } from './events.js'
import { stateAt } from './segment.js'

export const RECT_SIGNALS = ['vin', 'vrect', 'vout', 'iD', 'iin', 'iC', 'iR', 'vD']

export const RECT_DEFAULTS = {
  Vs: 12.6, // RMS, phase to neutral
  f: 60,
  Rs: 0.5,
  Vf: 0.7,
  C: 1000e-6,
  R: 100,
}

export const RECT_KINDS = ['half', 'bridge', 'six']

const lin = (c, d = 0) => ({ c, d })
const scaleForm = (f, k) => lin(f.c.map((v) => v * k), f.d * k)
const addForm = (a, b, kb = 1) => lin(a.c.map((v, i) => v + kb * b.c[i]), a.d + kb * b.d)
const ZERO = lin([0, 0, 0])

/** The phase lagging phase a by θ, as a form in x = [v, s, c]. */
const phaseForm = (theta) => lin([0, Math.cos(theta), -Math.sin(theta)])

export function rectifier(kind, params = {}) {
  if (!RECT_KINDS.includes(kind)) throw new Error(`unknown rectifier "${kind}"`)
  const p = { ...RECT_DEFAULTS, ...params }
  const { Vs, f, Rs, Vf, C, R } = p
  const Vp = Math.SQRT2 * Vs
  const w = 2 * Math.PI * f
  const T = 1 / f

  // Phases and the diode pairs that can conduct between them. The
  // single-phase bridge is the two-phase case: a source centred on a
  // virtual midpoint, with a diode pair for each polarity. The half-wave
  // circuit is one phase against neutral through one diode.
  let phases
  let pairs
  let nD
  if (kind === 'half') {
    phases = [phaseForm(0), ZERO]
    pairs = [[0, 1]]
    nD = 1
  } else if (kind === 'bridge') {
    phases = [scaleForm(phaseForm(0), 0.5), scaleForm(phaseForm(0), -0.5)]
    pairs = [
      [0, 1],
      [1, 0],
    ]
    nD = 2
  } else {
    phases = [phaseForm(0), phaseForm((2 * Math.PI) / 3), phaseForm((4 * Math.PI) / 3)]
    pairs = [
      [0, 1],
      [0, 2],
      [1, 2],
      [1, 0],
      [2, 0],
      [2, 1],
    ]
    nD = 2
  }
  const drop = nD * Vf
  const vC = lin([1, 0, 0])
  const iR = lin([1 / R, 0, 0])
  const oscRows = [
    [0, 0, w],
    [0, -w, 0],
  ]
  // The phase-a terminal voltage, which the half-wave circuit measures
  // against neutral and the others against their own midpoint.
  const vin = kind === 'bridge' ? scaleForm(phases[0], 2) : phases[0]

  const states = {}
  for (const [top, bot] of pairs) {
    const key = `${top}${bot}`
    const vll = addForm(phases[top], phases[bot], -1) // line voltage the pair sees
    // Conducting: C v̇ = (v_ll − drop − v)/R_s − v/R.
    const iD = scaleForm(addForm(vll, vC, -1), 1 / Rs)
    iD.d -= drop / Rs
    const condA = [[-(1 / Rs + 1 / R) / C, vll.c[1] / (Rs * C), vll.c[2] / (Rs * C)], ...oscRows]
    // R_s is taken in the return path, so the conducting diode shows V_f.
    const vPlusCond = addForm(phases[top], ZERO)
    vPlusCond.d -= Vf
    states[`cond${key}`] = {
      name: `cond${key}`,
      A: condA,
      f: [-drop / (Rs * C), 0, 0],
      signals: {
        vin,
        vrect: vll,
        vout: vC,
        iD,
        iin: top === 0 ? iD : bot === 0 ? scaleForm(iD, -1) : ZERO,
        iC: addForm(iD, iR, -1),
        iR,
        vD: addForm(phases[0], vPlusCond, -1),
      },
    }
    // Holding: the capacitor alone feeds the load; the pair's line voltage
    // is still what it would rectify, for the trace.
    const vPlusHold =
      kind === 'half' ? vC : addForm(scaleForm(addForm(phases[top], phases[bot]), 0.5), scaleForm(vC, 0.5))
    states[`hold${key}`] = {
      name: `hold${key}`,
      A: [[-1 / (R * C), 0, 0], ...oscRows],
      f: [0, 0, 0],
      signals: {
        vin,
        vrect: vll,
        vout: vC,
        iD: ZERO,
        iin: ZERO,
        iC: scaleForm(iR, -1),
        iR,
        vD: addForm(phases[0], vPlusHold, -1),
      },
    }
  }

  const evalForm = (fm, x) => fm.c[0] * x[0] + fm.c[1] * x[1] + fm.c[2] * x[2] + fm.d
  // Which pair has the highest line voltage right now, and whether it clears
  // the capacitor: that is the whole switching rule.
  const pairKey = pairs.map((pr) => `${pr[0]}${pr[1]}`)
  const lineVoltages = (x) => pairs.map((pr) => evalForm(phases[pr[0]], x) - evalForm(phases[pr[1]], x))
  const pick = (x) => {
    const v = lineVoltages(x)
    let best = 0
    for (let i = 1; i < v.length; i++) if (v[i] > v[best]) best = i
    return v[best] - drop - x[0] > 0 ? `cond${pairKey[best]}` : `hold${pairKey[best]}`
  }
  // How far state x is from leaving topology `name`: positive while it
  // stays. Two ways out — the pair stops being the highest line voltage, or
  // the excess over the capacitor changes sign.
  const guard = (x, name) => {
    const v = lineVoltages(x)
    const i = pairKey.indexOf(name.slice(4))
    let others = -Infinity
    for (let j = 0; j < v.length; j++) if (j !== i && v[j] > others) others = v[j]
    const excess = v[i] - drop - x[0]
    return Math.min(v[i] - others, name.startsWith('cond') ? excess : -excess)
  }

  return {
    kind,
    p,
    T,
    w,
    Vp,
    nD,
    pulses: pairs.length,
    states,
    signals: RECT_SIGNALS,
    pick,
    guard,
    // At t = 0 the source is at its zero crossing, rising; the capacitor
    // voltage is the unknown, somewhere between empty and the peak line
    // voltage.
    start: (v) => [v, 0, Vp],
    unknown: { index: 0, lo: 0, hi: Vp * (kind === 'six' ? Math.sqrt(3) : 1) },
    threePhase: kind === 'six',
  }
}

export function rectifierSteadyState(conv, opts) {
  const ss = eventSteadyState(conv, opts)
  ss.mode = 'line'
  return ss
}

/**
 * Fourier coefficients of a signal at harmonic k of the line frequency:
 * { a, b } for a·cos kωt + b·sin kωt, integrated exactly on the segments.
 */
export function harmonic(ss, name, k) {
  const w = ss.conv.w
  const sigAt = (x, st) => {
    const s = st.signals[name]
    return s.c[0] * x[0] + s.c[1] * x[1] + s.c[2] * x[2] + s.d
  }
  let a = 0
  let b = 0
  for (const sg of ss.segments) {
    if (sg.T <= 0) continue
    a += periodIntegral({ segments: [sg] }, (x, t) => sigAt(x, sg.state) * Math.cos(k * w * t))
    b += periodIntegral({ segments: [sg] }, (x, t) => sigAt(x, sg.state) * Math.sin(k * w * t))
  }
  return { a: (2 * a) / ss.T, b: (2 * b) / ss.T }
}

export function rectifierMeasures(ss, { harmonics = 25 } = {}) {
  const conv = ss.conv
  const p = conv.p
  const T = ss.T
  const sig = signalStats(ss, RECT_SIGNALS)
  const sigAt = (x, st, name) => {
    const s = st.signals[name]
    return s.c[0] * x[0] + s.c[1] * x[1] + s.c[2] * x[2] + s.d
  }
  const meanProd = (a, b) =>
    ss.segments.reduce((acc, sg) => {
      if (sg.T <= 0) return acc
      return acc + periodIntegral({ segments: [sg] }, (x) => sigAt(x, sg.state, a) * sigAt(x, sg.state, b))
    }, 0) / T
  const phasesIn = conv.threePhase ? 3 : 1
  const Pin = phasesIn * meanProd('vin', 'iin')
  const Pout = sig.vout.rms ** 2 / p.R
  const iD2 = sig.iD.rms ** 2
  const loss = {
    series: p.Rs * iD2,
    diodes: conv.nD * p.Vf * sig.iD.avg,
  }
  const Ploss = loss.series + loss.diodes

  // Conduction: each pulse's angle, and how much of the period the diodes
  // carry current at all.
  const cond = ss.segments.filter((s) => s.name.startsWith('cond') && s.T > 0)
  const condTime = cond.reduce((a, s) => a + s.T, 0)
  // Pulses: runs of conducting segments (the six-pulse circuit changes pair
  // without a break), a run split by the period boundary being one pulse.
  // The gaps between them are the capacitor's discharges.
  const live = ss.segments.filter((s) => s.T > 0)
  const runs = []
  for (const s of live) {
    const on = s.name.startsWith('cond')
    const last = runs[runs.length - 1]
    const vEnd = stateAt(s, s.T)[0]
    if (last && last.on === on) {
      last.T += s.T
      last.vEnd = vEnd
    } else runs.push({ on, T: s.T, vStart: s.x0[0], vEnd })
  }
  if (runs.length > 1 && runs[0].on === runs[runs.length - 1].on) {
    const tail = runs.pop()
    runs[0].T += tail.T
    runs[0].vStart = tail.vStart
  }
  const pulseTimes = runs.filter((r) => r.on).map((r) => r.T)
  const gaps = runs.filter((r) => !r.on)
  const angle = pulseTimes.length ? (Math.max(...pulseTimes) / T) * 360 : 0
  // The longest discharge: how long the capacitor is on its own, from what
  // voltage, and how far it falls. (The peak-to-peak ripple is a little
  // more: the capacitor keeps falling after the diode turns on, until the
  // diode current has climbed to the load's.)
  const gap = gaps.reduce((best, g) => (g.T > (best ? best.T : 0) ? g : best), null)
  const tHold = gap ? gap.T : 0
  const holdFrom = gap ? gap.vStart : 0
  const holdDrop = gap ? gap.vStart - gap.vEnd : 0

  // The line current's make-up: fundamental and harmonics, from exact
  // integrals; the power factor split into its two factors.
  const Vrms = p.Vs
  const Irms = sig.iin.rms
  const h = []
  for (let k = 1; k <= harmonics; k++) {
    const { a, b } = harmonic(ss, 'iin', k)
    h.push({ k, a, b, rms: Math.hypot(a, b) / Math.SQRT2 })
  }
  const I1 = h[0].rms
  // The source is sin ωt; the fundamental b·sin + a·cos leads it by atan2(a, b).
  const phi1 = Math.atan2(h[0].a, h[0].b)
  const S = phasesIn * Vrms * Irms
  const pf = S > 0 ? Pin / S : 0
  const distortion = Irms > 0 ? I1 / Irms : 0
  const displacement = Math.cos(phi1)
  const thd = I1 > 0 ? Math.sqrt(Math.max(0, Irms * Irms - I1 * I1)) / I1 : 0

  return {
    sig,
    Pin,
    Pout,
    loss,
    Ploss,
    Pcond: Ploss,
    balance: Pin - Pout - Ploss,
    eta: Pout / Pin,
    Vdc: sig.vout.avg,
    Iout: sig.vout.avg / p.R,
    ripple: sig.vout.pp,
    angle,
    tHold,
    holdFrom,
    holdDrop,
    condFraction: condTime / T,
    pulses: pulseTimes.length,
    iPeak: sig.iD.max,
    formFactor: sig.iD.avg > 0 ? sig.iD.rms / sig.iD.avg : 0,
    piv: -sig.vD.min,
    Vrms,
    Irms,
    S,
    pf,
    distortion,
    displacement,
    phi1,
    thd,
    I1,
    harmonics: h,
    mode: 'line',
  }
}

// ------------------------------------------------------------ the dimmer
// A triac fired at angle α into a resistor: no state, so it is written
// down. The load sees the sine from α to π in each half-cycle.

/**
 * Fourier coefficients of the phase-cut sine V_p·sin θ on [α, π] and its
 * negative on [π + α, 2π], at harmonic k: a·cos kθ + b·sin kθ. The waveform
 * is half-wave symmetric, so even orders vanish and the odd ones are twice
 * the first arc's integral, which is elementary.
 */
export function dimmerHarmonic({ Vs, alpha }, k) {
  const Vp = Math.SQRT2 * Vs
  if (k % 2 === 0) return { a: 0, b: 0 }
  const a = alpha
  let ia
  let ib
  if (k === 1) {
    // ∫ sin θ cos θ = sin²θ/2, ∫ sin²θ = θ/2 − sin 2θ/4, from α to π
    ia = -(Math.sin(a) ** 2) / 2
    ib = (Math.PI - a) / 2 + Math.sin(2 * a) / 4
  } else {
    const F = (th) => (-Math.cos((k + 1) * th) / (k + 1) + Math.cos((k - 1) * th) / (k - 1)) / 2
    const G = (th) => (Math.sin((k - 1) * th) / (k - 1) - Math.sin((k + 1) * th) / (k + 1)) / 2
    ia = F(Math.PI) - F(a)
    ib = G(Math.PI) - G(a)
  }
  return { a: (2 * Vp * ia) / Math.PI, b: (2 * Vp * ib) / Math.PI }
}

export function dimmer({ Vs, alpha, R }, { harmonics = 25 } = {}) {
  const Vp = Math.SQRT2 * Vs
  const a = alpha
  const share = 1 - a / Math.PI + Math.sin(2 * a) / (2 * Math.PI) // P / P_full
  const Vrms = Vs * Math.sqrt(share)
  const Pfull = (Vs * Vs) / R
  // Fundamental of the load voltage, a·cos + b·sin.
  const b1 = Vp * share
  const a1 = -(Vp / Math.PI) * Math.sin(a) ** 2
  const V1 = Math.hypot(a1, b1) / Math.SQRT2
  const phi1 = Math.atan2(a1, b1)
  const h = []
  for (let k = 1; k <= harmonics; k++) {
    const c = dimmerHarmonic({ Vs, alpha }, k)
    h.push({ k, a: c.a / R, b: c.b / R, rms: Math.hypot(c.a, c.b) / Math.SQRT2 / R })
  }
  return {
    harmonics: h,
    I1: V1 / R,
    Vp,
    share,
    P: Pfull * share,
    Pfull,
    Vrms,
    Irms: Vrms / R,
    pf: Math.sqrt(share),
    distortion: V1 / Vrms,
    displacement: Math.cos(phi1),
    phi1,
    V1,
    a1,
    b1,
    thd: V1 > 0 ? Math.sqrt(Math.max(0, Vrms * Vrms - V1 * V1)) / V1 : 0,
  }
}

/** The dimmer's waveform over `periods` line cycles, both sides of every edge. */
export function dimmerWaveform({ Vs, f, alpha, R }, { periods = 2, n = 360 } = {}) {
  const Vp = Math.SQRT2 * Vs
  const T = 1 / f
  const t = []
  const vin = []
  const vout = []
  const edges = []
  const push = (tt, on) => {
    const th = 2 * Math.PI * f * tt
    t.push(tt)
    vin.push(Vp * Math.sin(th))
    vout.push(on ? Vp * Math.sin(th) : 0)
  }
  for (let k = 0; k < periods; k++) {
    const base = k * T
    for (const half of [0, 1]) {
      const h0 = base + (half * T) / 2
      const tf = h0 + (alpha / (2 * Math.PI)) * T
      const hEnd = h0 + T / 2
      // blocked from the zero crossing to the firing angle
      const mb = Math.max(2, Math.round((n * (tf - h0)) / T))
      for (let i = 0; i <= mb; i++) push(h0 + ((tf - h0) * i) / mb, false)
      edges.push({ t: tf, name: 'fire' })
      const mc = Math.max(2, Math.round((n * (hEnd - tf)) / T))
      for (let i = 0; i <= mc; i++) push(tf + ((hEnd - tf) * i) / mc, true)
      edges.push({ t: hEnd, name: 'zero' })
    }
  }
  const iin = vout.map((v) => v / R)
  return { t, T, edges, sig: { vin, vout, iin, vrect: vout, iD: iin, iR: iin, iC: iin.map(() => 0), vD: vin.map((v, i) => v - vout[i]) } }
}
