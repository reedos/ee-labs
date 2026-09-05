// DC in, AC out: the full-bridge inverter, square wave and sine PWM.
//
// Four switches put ±V_dc across an LC filter and a resistive load, so the
// state is the buck's, [i_L, v_C], and the only question is when the sign
// changes. For the square wave it changes twice a fundamental cycle. For
// sine PWM a comparator answers it: a sine reference of amplitude m_a
// against a triangular carrier of unit amplitude at m_f times the
// fundamental, and the bridge takes the sign of their difference.
//
// The comparator's crossings are the whole of the modulator. Within one
// ramp of the carrier the triangle is a straight line, so a crossing is the
// root of
//
//     m_a sin(ω₁ t) − (a + b t) = 0
//
// found by bisection to 1e-14 of the fundamental period. There is at most
// one root per ramp whenever the reference moves slower than the ramp,
// which holds while 2π m_a < 4 m_f. Where the reference is outside ±1 there
// is no root at all, and the bridge simply stays where it is: that is
// overmodulation, and it comes out of the same code rather than out of a
// special case.
//
// m_f is an odd integer, so the pattern repeats every fundamental period and
// the waveform is half-wave symmetric: no even harmonics, and the fundamental
// period is the period of the whole circuit. An inverter's carrier is locked
// to its reference for exactly this reason, and `carrierRatio` snaps a
// requested switching frequency to the nearest odd multiple.

import { clockedSteadyState, statsOf, spectrumOf, fourierAt, meanProduct } from './clocked.js'
import { bisect, sample } from './segment.js'
import { evalSignal } from './topologies.js'

export const INVERTER_KINDS = ['square', 'spwm']

export const INVERTER_SIGNALS = ['vsw', 'vout', 'vL', 'vC', 'iL', 'iC', 'iR', 'iin']

export const INVERTER_DEFAULTS = {
  Vdc: 48,
  f1: 60,
  L: 1e-3,
  C: 10e-6,
  R: 10,
  ma: 0.8, // modulation index, the reference's amplitude against the carrier's
  fsw: 3780, // requested carrier frequency; snapped to an odd multiple of f1
  Ron: 0,
  RL: 0,
  ESR: 0,
}

/** The nearest odd integer at least 3: the carrier's multiple of f₁. */
export function carrierRatio(fsw, f1) {
  const raw = Math.max(3, fsw / f1)
  const odd = 2 * Math.round((raw - 1) / 2) + 1
  return Math.max(3, odd)
}

/**
 * The instants at which a bipolar sine-PWM bridge changes sign, over one
 * fundamental period, in seconds. The bridge starts at +V_dc (at t = 0 the
 * reference is zero and the carrier is at its trough).
 */
export function pwmEdges({ ma, mf, f1 = 1, tol = 1e-14 }) {
  const T = 1 / f1
  const Tc = T / mf
  const ref = (t) => ma * Math.sin((2 * Math.PI * t) / T)
  const edges = []
  for (let q = 0; q < mf; q++) {
    const t0 = q * Tc
    // Rising ramp: carrier goes −1 → +1 across the first half.
    const rise = (t) => ref(t) - (-1 + (4 * (t - t0)) / Tc)
    if (rise(t0) >= 0 && rise(t0 + Tc / 2) <= 0) edges.push(bisect(rise, t0, t0 + Tc / 2, tol * T))
    // Falling ramp: +1 → −1 across the second.
    const mid = t0 + Tc / 2
    const fall = (t) => -(ref(t) - (1 - (4 * (t - mid)) / Tc))
    if (fall(mid) >= 0 && fall(t0 + Tc) <= 0) edges.push(bisect(fall, mid, t0 + Tc, tol * T))
  }
  return edges
}

/** The two bridge states and the plan that alternates between them. */
function bridgeStates(p) {
  const { Vdc, L, C, R, Ron, RL, ESR } = p
  const alpha = R / (R + ESR)
  const rTot = 2 * Ron + RL + alpha * ESR
  const A = [
    [-rTot / L, -alpha / L],
    [alpha / C, -alpha / (R * C)],
  ]
  const lin = (c1, c2, d = 0) => ({ c: [c1, c2], d })
  const make = (sign, name) => ({
    name,
    A,
    f: [(sign * Vdc) / L, 0],
    signals: {
      // The bridge output, which is the switched voltage the filter sees.
      vsw: lin(-2 * Ron, 0, sign * Vdc),
      vout: lin(alpha * ESR, alpha),
      vC: lin(0, 1),
      vL: lin(-rTot, -alpha, sign * Vdc),
      iL: lin(1, 0),
      iC: lin(alpha, -alpha / R),
      // i_R is the output voltage over the load.
      iR: lin((alpha * ESR) / R, alpha / R),
      // The current the rail supplies: the bridge reverses it with the
      // voltage, so the product is the same either way.
      iin: lin(sign, 0),
    },
  })
  return { pos: make(1, '+V_dc'), neg: make(-1, '−V_dc'), alpha }
}

export function inverter(kind, params = {}) {
  if (!INVERTER_KINDS.includes(kind)) throw new Error(`unknown inverter "${kind}"`)
  const p = { ...INVERTER_DEFAULTS, ...params }
  const T = 1 / p.f1
  const { pos, neg, alpha } = bridgeStates(p)
  const mf = kind === 'square' ? 1 : carrierRatio(p.fsw, p.f1)
  const edges = kind === 'square' ? [T / 2] : pwmEdges({ ma: p.ma, mf, f1: p.f1 })
  // The plan: +V_dc until the first edge, alternating after it.
  const plan = []
  let prev = 0
  edges.forEach((t, i) => {
    plan.push({ state: i % 2 === 0 ? pos : neg, T: t - prev })
    prev = t
  })
  plan.push({ state: edges.length % 2 === 0 ? pos : neg, T: T - prev })
  return {
    kind,
    p,
    T,
    alpha,
    mf,
    fsw: mf * p.f1,
    edges,
    plan,
    states: { pos, neg },
    signals: INVERTER_SIGNALS,
    // The fundamental the modulator asks for, before the filter.
    commanded: kind === 'square' ? (4 / Math.PI) * p.Vdc : Math.min(p.ma, 1) * p.Vdc,
  }
}

export function inverterSteadyState(conv) {
  const r = clockedSteadyState(conv.plan, 2)
  return { mode: 'inverter', conv, T: conv.T, x0: r.x0, xEnd: r.xEnd, segments: r.segments }
}

/**
 * What the inverter is judged by: the fundamental of the bridge output and
 * of the load voltage, the total harmonic distortion of each, the filter's
 * attenuation at the carrier, and the power books.
 *
 * THD is taken as √(V_rms² − V₁²)/V₁, from the exact total RMS rather than a
 * truncated sum, so a square wave's 48.34 % comes out whole instead of the
 * 46 % that twenty-five terms leave.
 */
export function inverterMeasures(ss, { harmonics = 0, dense = 24 } = {}) {
  const conv = ss.conv
  const p = conv.p
  const sig = statsOf(ss, INVERTER_SIGNALS, { dense })
  const kMax = harmonics || Math.min(240, 2 * conv.mf + 8)
  const swSpectrum = spectrumOf(ss, 'vsw', kMax)
  const sw1 = swSpectrum[0]
  const out1c = fourierAt(ss, 'vout', 1)
  const out1 = Math.hypot(out1c.a, out1c.b) / Math.SQRT2
  const thdOf = (rms, first) => (first > 0 ? Math.sqrt(Math.max(0, rms * rms - first * first)) / first : 0)
  const Pin = p.Vdc * sig.iin.avg
  const Pout = sig.vout.rms ** 2 / p.R
  const loss = {
    switch: 2 * p.Ron * sig.iL.rms ** 2,
    inductor: p.RL * sig.iL.rms ** 2,
    esr: p.ESR * sig.iC.rms ** 2,
  }
  const Pcond = loss.switch + loss.inductor + loss.esr
  // The carrier cluster: the largest harmonic within four orders of m_f, and
  // what the filter did to it.
  const near = (k0) => swSpectrum.filter((h) => Math.abs(h.k - k0) <= 4).reduce((a, h) => (h.rms > a.rms ? h : a), { k: k0, rms: 0 })
  const carrier = conv.kind === 'spwm' ? near(conv.mf) : null
  let attenuation = null
  if (carrier && carrier.rms > 0) {
    const c = fourierAt(ss, 'vout', carrier.k)
    attenuation = Math.hypot(c.a, c.b) / Math.SQRT2 / carrier.rms
  }
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
    // The bridge output.
    Vsw1: sw1.rms,
    VswRms: sig.vsw.rms,
    thdSw: thdOf(sig.vsw.rms, sw1.rms),
    // The load.
    V1: out1,
    Vrms: sig.vout.rms,
    thd: thdOf(sig.vout.rms, out1),
    Irms: sig.iR.rms,
    I1: out1 / p.R,
    harmonics: swSpectrum,
    carrier,
    attenuation,
    mf: conv.mf,
    fsw: conv.fsw,
    // The spectrum pane draws volts here, not amps.
    spectrum: { unit: 'V', of: 'v_sw', caption: 'Bridge output, one fundamental cycle' },
    S: sig.vout.rms * sig.iR.rms,
    pf: sig.vout.rms * sig.iR.rms > 0 ? Pout / (sig.vout.rms * sig.iR.rms) : 1,
    distortion: sig.vout.rms > 0 ? out1 / sig.vout.rms : 1,
    displacement: 1,
    phi1: 0,
  }
}

/**
 * The load voltage's fundamental and distortion alone, without the spectrum
 * or the power books: what a sweep over the carrier frequency needs, at a
 * fraction of the cost of the whole measure.
 */
export function inverterDistortion(ss) {
  const sig = statsOf(ss, ['vout'], { dense: 16 })
  const c = fourierAt(ss, 'vout', 1)
  const V1 = Math.hypot(c.a, c.b) / Math.SQRT2
  return { V1, Vrms: sig.vout.rms, thd: V1 > 0 ? Math.sqrt(Math.max(0, sig.vout.rms ** 2 - V1 * V1)) / V1 : 0 }
}

/** Waveform traces over `periods` fundamental cycles. */
export function inverterWaveform(ss, { periods = 1, n = 1200 } = {}) {
  const names = INVERTER_SIGNALS
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
    // A square wave is named at its two edges. A carrier at a hundred and
    // twenty-six edges would write a band of dashes over the plot, so sine
    // PWM names the half-cycle boundaries alone.
    edges.push({ t: base, name: '+V_dc' }, { t: base + ss.T / 2, name: '\u2212V_dc' })
  }
  return { t, sig, edges, T: ss.T, mf: ss.conv.mf }
}

/** Ideal closed forms the inverter lessons quote. */
export const squareFundamentalRms = (Vdc) => (4 / Math.PI) * Vdc * Math.SQRT1_2
export const squareThd = () => Math.sqrt(Math.PI ** 2 / 8 - 1)
export const spwmFundamentalPeak = (ma, Vdc) => ma * Vdc

/** |H| of the output LC into R at frequency f: the filter's own job. */
export function lcMagnitude({ L, C, R }, f) {
  const w = 2 * Math.PI * f
  const re = 1 - w * w * L * C
  const im = (w * L) / R
  return 1 / Math.hypot(re, im)
}

export { meanProduct }
