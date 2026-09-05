// What a converter puts back into its own supply, and what rings on its
// switch node.
//
// Everything so far has looked at the output. A switching converter's input
// is the louder side: the buck draws its current in rectangular pulses, and a
// pulse train is a fundamental at f_s and a comb of harmonics above it. That
// comb is the interference, and two parts of the circuit answer it. The input
// capacitor takes the alternating part locally. The input filter keeps what
// is left off the line.
//
// ------------------------------------------------------- the input side
//
// The converter, its input capacitor and the filter are one linear circuit
// with four states,
//
//     x = [i_Lf, v_Cin, i_L, v_C]
//
// and the switch chooses between two of them. The freewheel is synchronous,
// so the pattern is fixed before the state is and one period is the same
// linear solve continuous conduction has always been. That choice is the
// model, not an oversight: the lesson is about the input current's spectrum,
// and a dead interval would put a third shape in it that has nothing to do
// with the filter.
//
// The filter's damping is a resistance across the inductor, which costs no
// state and is what a real input filter carries. Undamped, an LC filter's
// output impedance peaks near √(L_f/C_in) times its Q, and a regulated
// converter looks like a negative resistance −V_in²/P_in at frequencies its
// loop can follow. Middlebrook's criterion is that the first stays well under
// the second. This lab runs its converters open loop, so the criterion is
// computed from the operating point and reported as the design rule it is. No
// instability is claimed from a simulation that cannot show one.
//
// ------------------------------------------------------- the switch node
//
// The loop from the rail through the switch to the node has inductance, and
// the node has capacitance. Together they are a series RLC that the switch
// steps twice a period, so the node rings at 1/(2π√(L_p C_p)) and its
// envelope decays as e^{−R_p t/2L_p}. That is five states with the output
// filter still hanging on the node,
//
//     x = [i_Lp, v_sw, i_L, v_C, v_Csn]
//
// and it is solved exactly by the same propagator. A snubber is a resistor
// and a capacitor across the node. It damps the ring, and it charges and
// discharges C_sn every period, so it costs C_sn·V²·f_s whatever R_sn is.

import { fft } from '@ee-labs/dsp'
import { clockedSteadyState, statsOf, spectrumOf, fourierAt } from './clocked.js'
import { propagator01 } from './propagator.js'
import { matVec, vecAdd } from './linalg.js'
import { quadrature, stateAt } from './segment.js'
import { evalSignal } from './topologies.js'

export const EMI_KINDS = ['emi', 'ringing']

/** The input side's signals: the line, the capacitor, and the pulses. */
export const EMI_SIGNALS = ['vcin', 'vsw', 'vout', 'iL', 'icin', 'iin', 'iline']
/** The switch node's: the loop, the node, and the filter beyond it. */
export const RING_SIGNALS = ['vsw', 'vout', 'vL', 'iL', 'iin']

export const EMI_DEFAULTS = {
  Vin: 24,
  D: 0.5,
  fs: 100e3,
  L: 100e-6,
  C: 100e-6,
  R: 6,
  Ron: 0,
  RL: 0,
  // The input side.
  Lf: 1e-6,
  Cin: 10e-6,
  Rf: 0.05,
  Rd: 1e4,
}

export const RING_DEFAULTS = {
  Vin: 24,
  D: 0.5,
  fs: 1e6,
  L: 10e-6,
  C: 10e-6,
  R: 6,
  RL: 0,
  // The parasitic loop and the node.
  Lp: 100e-9,
  Cp: 1e-9,
  Rp: 50,
  // The snubber, off unless it is switched on. Off it is not a large
  // resistance, it is absent: a resistor and capacitor whose time constant
  // approaches zero is a state the quadrature has to chase in picoseconds,
  // for a branch that carries nothing.
  snubber: 0,
  Csn: 470e-12,
  Rsn: 10,
}

const form = (c, d = 0) => ({ c, d })

/**
 * The converter with its input filter, as a four-state switched circuit.
 *
 * `iin` is what the converter itself draws, which is the pulse train the
 * lesson is about. `iline` is what the source supplies through the filter,
 * and `icin` is the difference the input capacitor carries.
 */
export function emiConverter(params = {}) {
  const p = { ...EMI_DEFAULTS, ...params }
  const { Vin, L, C, R, Ron, RL, Lf, Cin, Rf, Rd } = p
  const T = 1 / p.fs
  const D = Math.min(0.98, Math.max(0.02, p.D))
  const g = 1 / Rd
  // Row 0 is the filter inductor, row 1 the input capacitor, rows 2 and 3 the
  // converter. `s` is 1 while the high-side switch conducts and 0 while the
  // low-side one does.
  const stateOf = (name, s) => ({
    name,
    A: [
      [-Rf / Lf, -1 / Lf, 0, 0],
      [1 / Cin, -g / Cin, -s / Cin, 0],
      [0, s / L, -(Ron + RL) / L, -1 / L],
      [0, 0, 1 / C, -1 / (R * C)],
    ],
    f: [Vin / Lf, (g * Vin) / Cin, 0, 0],
    signals: {
      vcin: form([0, 1, 0, 0]),
      vsw: form([0, s, -Ron, 0]),
      vout: form([0, 0, 0, 1]),
      vL: form([0, s, -(Ron + RL), -1]),
      iL: form([0, 0, 1, 0]),
      iin: form([0, 0, s, 0]),
      iline: form([1, -g, 0, 0], g * Vin),
      icin: form([1, -g, -s, 0], g * Vin),
      // The filter inductor's own current, and the voltage its damping
      // resistor stands across: the two branches the line current is made of.
      ilf: form([1, 0, 0, 0]),
      vrd: form([0, -1, 0, 0], Vin),
    },
  })
  const on = stateOf('on', 1)
  const off = stateOf('off', 0)
  return {
    kind: 'emi',
    p: { ...p, D },
    T,
    n: 4,
    states: { on, off },
    plan: [
      { state: on, T: D * T },
      { state: off, T: (1 - D) * T },
    ],
    signals: EMI_SIGNALS,
    hasDead: false,
    filter: inputFilter(p),
    blocking: () => Vin,
  }
}

/**
 * The switch node with its parasitic loop, its capacitance and a snubber,
 * feeding the output filter. Five states and no events: the freewheel is
 * synchronous, so the node is driven to the rail and back on the clock.
 */
export function ringConverter(params = {}) {
  const p = { ...RING_DEFAULTS, ...params }
  const { Vin, L, C, R, RL, Lp, Cp, Rp, Csn, Rsn } = p
  const T = 1 / p.fs
  const D = Math.min(0.98, Math.max(0.02, p.D))
  const on = !!p.snubber
  const n = on ? 5 : 4
  const s = on ? 1 / Rsn : 0
  const d = 1 / Rp
  const pad = (row) => (on ? row : row.slice(0, 4))
  // The loop's damping is a resistance ACROSS L_p, not in series with it, so
  // it carries none of the load current and the node's average is the drive's
  // average exactly. A series resistance large enough to give the ring a
  // finite Q would drop volts at DC, which no real loop does.
  const stateOf = (name, drive) => ({
    name,
    A: [
      pad([0, -1 / Lp, 0, 0, 0]),
      pad([1 / Cp, -(d + s) / Cp, -1 / Cp, 0, s / Cp]),
      pad([0, 1 / L, -RL / L, -1 / L, 0]),
      pad([0, 0, 1 / C, -1 / (R * C), 0]),
      ...(on ? [[0, s / Csn, 0, 0, -s / Csn]] : []),
    ],
    f: pad([(drive * Vin) / Lp, (drive * Vin * d) / Cp, 0, 0, 0]),
    signals: {
      vsw: form(pad([0, 1, 0, 0, 0])),
      vout: form(pad([0, 0, 0, 1, 0])),
      vL: form(pad([0, 1, -RL, -1, 0])),
      iL: form(pad([0, 0, 1, 0, 0])),
      // What the rail supplies: the whole loop, inductor and damping both,
      // and only while the high-side switch is closed.
      iin: form(pad([drive, -drive * d, 0, 0, 0]), drive * drive * Vin * d),
      isn: form(pad([0, s, 0, 0, -s])),
      vsn: form(pad([0, 0, 0, 0, on ? 1 : 0])),
      // Across the parasitic inductance, which is what its damping stands on.
      vlp: form(pad([0, -1, 0, 0, 0]), drive * Vin),
    },
  })
  const onState = stateOf('on', 1)
  const offState = stateOf('off', 0)
  return {
    kind: 'ringing',
    p: { ...p, D },
    T,
    n,
    snubbed: on,
    states: { on: onState, off: offState },
    plan: [
      { state: onState, T: D * T },
      { state: offState, T: (1 - D) * T },
    ],
    signals: RING_SIGNALS,
    hasDead: false,
    ring: ringOf({ ...p, Csn: on ? Csn : 0 }),
    blocking: () => Vin,
  }
}

/** The periodic steady state of either: a fixed pattern, so one linear solve. */
export function emiSteadyState(conv) {
  const ss = clockedSteadyState(conv.plan, conv.n)
  return {
    conv,
    T: conv.T,
    mode: conv.kind === 'emi' ? 'emi' : 'ring',
    x0: ss.x0,
    segments: ss.segments,
    tOn: conv.plan[0].T,
    td: conv.plan[conv.plan.length - 1].T,
  }
}

/**
 * The k-th harmonic of a rectangular pulse train of unit height and duty D,
 * as a peak amplitude: 2·|sin(kπD)|/(kπ). Its DC term is D. At D = 1/2 every
 * even harmonic is zero, which is why the input spectrum of a half-duty
 * converter is a comb of odd multiples of f_s.
 */
export function pulseHarmonic(k, D) {
  if (k === 0) return D
  return (2 * Math.abs(Math.sin(k * Math.PI * D))) / (k * Math.PI)
}

/**
 * Harmonics of a signal on a solved waveform, by exact Fourier integral.
 * `rms` is the harmonic's own RMS and `peak` its amplitude.
 */
export function emiHarmonics(ss, name, kMax = 12) {
  return spectrumOf(ss, name, kMax).map((h) => ({ ...h, peak: Math.hypot(h.a, h.b) }))
}

/**
 * The same harmonics read a second way: the exact waveform sampled on a
 * uniform grid and transformed by `@ee-labs/dsp`'s FFT. Two codebases, one
 * answer, which is the independent check §6 asks for and the number a
 * spectrum analyser would show.
 */
export function fftHarmonics(ss, name, kMax = 12, { n = 4096 } = {}) {
  const y = sampleUniform(ss, name, n)
  const re = Array.from(y)
  const im = new Array(n).fill(0)
  fft(re, im)
  const out = []
  for (let k = 1; k <= kMax && k < n / 2; k++) {
    // A real signal's k-th coefficient folds its two halves together, so the
    // peak amplitude is twice the magnitude over the length.
    const peak = (2 * Math.hypot(re[k], im[k])) / n
    out.push({ k, peak, rms: peak / Math.SQRT2, a: (2 * re[k]) / n, b: (-2 * im[k]) / n })
  }
  return out
}

/**
 * `n` samples of a signal over one period at equal spacing.
 *
 * Each segment is stepped with one propagator, so the cost is two matrix
 * exponentials a segment rather than one a sample.
 */
export function sampleUniform(ss, name, n) {
  const live = ss.segments.filter((s) => s.T > 0)
  const out = new Float64Array(n)
  const dt = ss.T / n
  const eps = 1e-12 * ss.T
  for (const seg of live) {
    const i0 = Math.max(0, Math.ceil((seg.t0 - eps) / dt))
    const i1 = Math.min(n - 1, Math.floor((seg.t0 + seg.T - eps) / dt))
    if (i1 < i0) continue
    const off = i0 * dt - seg.t0
    let x = off <= eps ? seg.x0 : stateAt(seg, off)
    const { phi0, phi1 } = propagator01(seg.A, dt)
    const drive = matVec(phi1, seg.f)
    for (let i = i0; i <= i1; i++) {
      out[i] = evalSignal(seg.state, name, x)
      x = vecAdd(matVec(phi0, x), drive)
    }
  }
  return out
}

/**
 * The input filter as an impedance and an attenuation.
 *
 * The source is a DC rail, so it carries no alternating voltage, and at the
 * converter's own node Kirchhoff gives i_conv = i_line + i_Cin with
 * i_line = −v/Z_branch and i_Cin = −jωC_in·v. Dividing,
 *
 *     i_line / i_conv = 1 / (1 + jωC_in Z_branch(jω))
 *
 * with no reference to what the converter is. This is an identity of the
 * network rather than a small-signal approximation, so it holds at every
 * harmonic and at every setting, and it is stated without qualification.
 *
 * `zoutAt` is what the converter sees looking back, which is the two in
 * parallel, and is the left-hand side of Middlebrook's criterion.
 */
export function inputFilter({ Lf, Cin, Rf = 0, Rd = Infinity }) {
  const f0 = 1 / (2 * Math.PI * Math.sqrt(Lf * Cin))
  const Z0 = Math.sqrt(Lf / Cin)
  // The damping resistor sits across the inductor and its series resistance
  // both, which is where the state equations put it: R_d carries
  // (V_src − v_Cin)/R_d whatever the inductor is doing. So the branch is
  // (R_f + jωL_f) in parallel with R_d.
  const branch = (f) => {
    const wl = 2 * Math.PI * f * Lf
    if (!Number.isFinite(Rd)) return [Rf, wl]
    const sr = Rf + Rd
    const dd = sr * sr + wl * wl
    if (dd === 0) return [0, 0]
    // (Rf + j wl)·Rd / ((Rf + Rd) + j wl)
    const nr = Rf * Rd
    const ni = wl * Rd
    return [(nr * sr + ni * wl) / dd, (ni * sr - nr * wl) / dd]
  }
  const attenuationAt = (f) => {
    const wc = 2 * Math.PI * f * Cin
    const [br, bi] = branch(f)
    return 1 / Math.hypot(1 - wc * bi, wc * br)
  }
  const zoutAt = (f) => {
    const w = 2 * Math.PI * f
    if (w === 0) return 0
    const [br, bi] = branch(f)
    const zi = -1 / (w * Cin)
    // (br + j bi) · (j zi) / (br + j(bi + zi))
    const pr = -bi * zi
    const pi = br * zi
    const sr = br
    const si = bi + zi
    const dd = sr * sr + si * si
    if (dd === 0) return Infinity
    return Math.hypot((pr * sr + pi * si) / dd, (pi * sr - pr * si) / dd)
  }
  // The peak of |Z_out| over a decade either side of the corner.
  let zoutPeak = 0
  let zoutPeakF = f0
  for (let i = 0; i <= 400; i++) {
    const f = f0 * Math.pow(100, i / 400 - 0.5)
    const z = zoutAt(f)
    if (z > zoutPeak) {
      zoutPeak = z
      zoutPeakF = f
    }
  }
  return { f0, Z0, Q: Rf > 0 ? Z0 / Rf : Infinity, branch, attenuationAt, zoutAt, zoutPeak, zoutPeakF }
}

/**
 * Middlebrook's criterion, as a ratio.
 *
 * A converter holding its output takes constant power from its input, so a
 * rise in input voltage buys a proportionally smaller current. Its input
 * impedance is −V_in²/P_in. A filter whose output impedance approaches that
 * magnitude near its own resonance destabilises the loop. The rule is that
 * |Z_out| stays well below |Z_in|, and `margin` is the factor between them.
 */
export function middlebrook(filter, { Vin, Pin }) {
  const Zin = Pin > 0 ? (Vin * Vin) / Pin : Infinity
  const Zout = filter.zoutPeak
  const ratio = Number.isFinite(Zin) && Zin > 0 ? Zout / Zin : 0
  return {
    Zin,
    Zout,
    atF: filter.zoutPeakF,
    ratio,
    margin: ratio > 0 ? 1 / ratio : Infinity,
    safe: ratio < 0.5,
  }
}

/**
 * The switch node's ring, in closed form.
 *
 * A series R_p–L_p–C_p stepped by V_in rings at ω_0√(1 − ζ²) with
 * ω_0 = 1/√(L_p C_p) and ζ = (R_p/2)√(C_p/L_p), and it overshoots its final
 * value by e^{−ζπ/√(1−ζ²)}. `Psn` is the snubber's own cost, which is
 * C_sn·V_in²·f_s whatever R_sn is, because the capacitor is charged and
 * discharged once each period.
 */
export function ringOf({ Lp, Cp, Rp, Vin, fs, Csn = 0 }) {
  // A snubber's capacitance sits on the node beside the diode's own, so it is
  // part of what rings. Its resistance damps, and the panel says where that
  // stops being a small correction.
  const Ct = Cp + Csn
  const w0 = 1 / Math.sqrt(Lp * Ct)
  const zeta = Math.sqrt(Lp / Ct) / (2 * Rp)
  const wd = zeta < 1 ? w0 * Math.sqrt(1 - zeta * zeta) : 0
  const over = zeta < 1 ? Math.exp((-zeta * Math.PI) / Math.sqrt(1 - zeta * zeta)) : 0
  const fr = wd / (2 * Math.PI)
  return {
    f0: w0 / (2 * Math.PI),
    fr,
    zeta,
    Q: zeta > 0 ? 1 / (2 * zeta) : Infinity,
    tau: Rp > 0 ? (2 * Lp) / Rp : Infinity,
    overshoot: over,
    peak: Vin * (1 + over),
    // How many ring cycles fit in one switching period.
    cycles: fr / fs,
    Esn: Csn * Vin * Vin,
    Psn: Csn * Vin * Vin * fs,
    Ep: 0.5 * Cp * Vin * Vin,
  }
}

/** Average, RMS and extremes of the input side, with its power books. */
export function emiMeasures(ss, { dense = 256, harmonics = 12 } = {}) {
  const conv = ss.conv
  const p = conv.p
  const sig = statsOf(ss, [...EMI_SIGNALS, 'vL', 'ilf', 'vrd'], { dense })
  const live = ss.segments.filter((s) => s.T > 0)
  const meanSq = (a) => live.reduce((acc, seg) => acc + quadrature(seg, (x) => evalSignal(seg.state, a, x) ** 2), 0) / ss.T
  const Pin = p.Vin * sig.iline.avg
  const Pout = meanSq('vout') / p.R
  // Exactly one of the two switches carries the inductor current at every
  // instant, so their conduction is one R_on against i_L.
  const loss = {
    switch: p.Ron * meanSq('iL'),
    inductor: p.RL * meanSq('iL'),
    filter: p.Rf * meanSq('ilf'),
    damping: meanSq('vrd') / p.Rd,
  }
  const Pcond = loss.switch + loss.inductor + loss.filter + loss.damping
  const hConv = emiHarmonics(ss, 'iin', harmonics)
  const hLine = emiHarmonics(ss, 'iline', harmonics)
  const f = conv.filter
  return {
    sig,
    Pin,
    Pout,
    loss,
    Pcond,
    Ploss: Pcond,
    balance: Pin - Pout - Pcond,
    eta: Pin !== 0 ? Pout / Pin : 0,
    mode: 'emi',
    harmonics: hConv,
    lineHarmonics: hLine,
    // The pulse train the converter draws, and what reaches the line.
    Iconv: sig.iin.avg,
    convRipple: sig.iin.pp,
    lineRipple: sig.iline.pp,
    cinRipple: sig.vcin.pp,
    // The first harmonic on both sides of the filter, and the ratio.
    conv1: hConv[0].peak,
    line1: hLine[0].peak,
    attenuation: hConv[0].peak > 0 ? hLine[0].peak / hConv[0].peak : 0,
    predicted: f.attenuationAt(p.fs),
    filter: f,
    middlebrook: middlebrook(f, { Vin: p.Vin, Pin }),
  }
}

/** The switch node's measures, with the ring read off the exact waveform. */
export function ringMeasures(ss, { dense = 512 } = {}) {
  const conv = ss.conv
  const p = conv.p
  const sig = statsOf(ss, [...RING_SIGNALS, 'isn', 'vsn', 'vlp'], { dense })
  const live = ss.segments.filter((s) => s.T > 0)
  const meanSq = (a) => live.reduce((acc, seg) => acc + quadrature(seg, (x) => evalSignal(seg.state, a, x) ** 2), 0) / ss.T
  const Pin = p.Vin * sig.iin.avg
  const Pout = meanSq('vout') / p.R
  const loss = {
    parasitic: meanSq('vlp') / p.Rp,
    snubber: conv.snubbed ? p.Rsn * meanSq('isn') : 0,
    inductor: p.RL * meanSq('iL'),
  }
  const Pcond = loss.parasitic + loss.snubber + loss.inductor
  return {
    sig,
    Pin,
    Pout,
    loss,
    Pcond,
    Ploss: Pcond,
    balance: Pin - Pout - Pcond,
    eta: Pin !== 0 ? Pout / Pin : 0,
    mode: 'ring',
    ring: conv.ring,
    // What the node reached, against the rail it was stepped to.
    peak: sig.vsw.max,
    overshoot: p.Vin > 0 ? sig.vsw.max / p.Vin - 1 : 0,
    snubberLoss: loss.snubber,
    // The ring read off the waveform rather than from L_p and C_p.
    measured: ringPeriodOf(ss),
  }
}

/**
 * The ring's own period, read off the waveform.
 *
 * The node is sampled densely across the on interval and the first interior
 * maxima are found, each refined by fitting a parabola to its three samples.
 * The gap between two of them is one ring period, and the ratio of their
 * heights above the rail is the envelope's decay across it.
 */
export function ringPeriodOf(ss, { n = 4096 } = {}) {
  const seg = ss.segments.find((s) => s.T > 0 && s.name === 'on')
  if (!seg) return null
  const one = { conv: ss.conv, T: seg.T, segments: [{ ...seg, t0: 0 }] }
  const y = sampleUniform(one, 'vsw', n)
  const rail = ss.conv.p.Vin
  const dt = seg.T / n
  const peaks = []
  for (let i = 1; i < n - 1; i++) {
    if (y[i] > y[i - 1] && y[i] >= y[i + 1]) {
      const den = y[i - 1] - 2 * y[i] + y[i + 1]
      const shift = den !== 0 ? (0.5 * (y[i - 1] - y[i + 1])) / den : 0
      peaks.push({ t: (i + shift) * dt, v: y[i] })
      if (peaks.length >= 3) break
    }
  }
  if (peaks.length < 2) return null
  const period = peaks[1].t - peaks[0].t
  const a = peaks[0].v - rail
  const b = peaks[1].v - rail
  return { period, f: 1 / period, peaks, decay: a !== 0 ? b / a : 0 }
}

/** The fundamental of a signal, for a caller that wants one number. */
export function fundamentalOf(ss, name) {
  const { a, b } = fourierAt(ss, name, 1)
  return { peak: Math.hypot(a, b), rms: Math.hypot(a, b) / Math.SQRT2, a, b }
}
