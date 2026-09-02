// From an experiment and its knobs to everything the panes draw.
//
// The linear regulator, the bare chopper and the dimmer have no state, so
// their waveforms and measures are written down directly. The three clocked
// converters — buck, boost and buck-boost — go through @ee-labs/switched's
// clocked steady state; the rectifiers through its event-driven one, where the
// diodes decide the topology. Every number a pane or a note shows comes out of
// here, so the tests can read the same ones.

import {
  converter,
  steadyState,
  waveforms,
  measures,
  average,
  signalIntegral,
  integral,
  conversionRatio,
  ratioWithRL,
  boostPeak,
  inductorRipple,
  outputRipple,
  K,
  Kcrit,
  Rcrit,
  dcmRatio,
  predictedRatio,
  linearRegulator,
  chopper,
  rectifier,
  rectifierSteadyState,
  rectifierMeasures,
  dimmer,
  dimmerWaveform,
  RECT_DEFAULTS,
} from '@ee-labs/switched'

// The knobs a buck experiment may omit take the plan's defaults.
export const BUCK_DEFAULTS = {
  Vin: 12,
  D: 5 / 12,
  L: 100e-6,
  C: 100e-6,
  R: 5,
  fs: 100e3,
  Ron: 0,
  Vf: 0,
  RL: 0,
  ESR: 0,
  tsw: 0,
  sync: 0,
}

/** Converter parameters from the knobs (tsw is both edges; sync is a toggle). */
export function buckParams(params) {
  const p = { ...BUCK_DEFAULTS, ...params }
  return {
    Vin: p.Vin,
    D: p.D,
    L: p.L,
    C: p.C,
    R: p.R,
    fs: p.fs,
    Ron: p.Ron,
    Vf: p.Vf,
    rd: 0,
    RL: p.RL,
    ESR: p.ESR,
    sync: !!p.sync,
    tr: p.tsw,
    tf: p.tsw,
  }
}

const stat = (avg, rms, min, max) => ({ avg, rms, min, max, pp: max - min })

export function analyse(exp, params) {
  if (exp.kind === 'linreg') return analyseLinear(params)
  if (exp.kind === 'chopper') return analyseChopper(params)
  if (exp.kind === 'rectifier') return analyseRectifier(params, exp)
  if (exp.kind === 'dimmer') return analyseDimmer(params, exp)
  return analysePwm(params, exp)
}

function analyseLinear(params) {
  const { Vin, Vo, R } = params
  const lr = linearRegulator({ Vin, Vo, R })
  const T = 10e-6
  const t = [0, T, 2 * T]
  const flat = (v) => t.map(() => v)
  return {
    kind: 'linreg',
    p: { Vin, Vo, R },
    T,
    wf: {
      t,
      T,
      edges: [],
      sig: { vsw: flat(Vin), vout: flat(Vo), iL: flat(lr.Io), iin: flat(lr.Io), iQ: flat(lr.Io), iD: flat(0), vL: flat(Vin - Vo), iC: flat(0), vC: flat(Vo) },
    },
    m: {
      sig: {
        vsw: stat(Vin, Vin, Vin, Vin),
        vout: stat(Vo, Vo, Vo, Vo),
        iL: stat(lr.Io, lr.Io, lr.Io, lr.Io),
        iin: stat(lr.Io, lr.Io, lr.Io, lr.Io),
        iQ: stat(lr.Io, lr.Io, lr.Io, lr.Io),
        vL: stat(Vin - Vo, Vin - Vo, Vin - Vo, Vin - Vo),
        iC: stat(0, 0, 0, 0),
        iD: stat(0, 0, 0, 0),
        vC: stat(Vo, Vo, Vo, Vo),
      },
      Pin: lr.Pin,
      Pout: lr.Pout,
      loss: { pass: lr.Pdiss },
      Ploss: lr.Pdiss,
      eta: lr.eta,
      M: Vo / Vin,
      Iout: lr.Io,
      mode: 'linear',
    },
    lr,
  }
}

function analyseChopper(params) {
  const { Vin, D, R, fs } = params
  const ch = chopper({ Vin, D, R })
  const T = 1 / fs
  // Two periods, both sides of every edge.
  const t = []
  const v = []
  for (let k = 0; k < 2; k++) {
    const b = k * T
    t.push(b, b + D * T, b + D * T, b + T)
    v.push(Vin, Vin, 0, 0)
  }
  const i = v.map((x) => x / R)
  const z = v.map(() => 0)
  const edges = [0, D * T, T, T + D * T].map((tt, k) => ({ t: tt, name: k % 2 ? 'off' : 'on' }))
  const vS = stat(ch.avg, ch.rms, 0, Vin)
  const iS = stat(ch.avg / R, ch.rms / R, 0, Vin / R)
  return {
    kind: 'chopper',
    p: { Vin, D, R, fs },
    T,
    wf: { t, T, edges, sig: { vsw: v, vout: v, iL: i, iin: i, iQ: i, iD: z, vL: z, iC: z, vC: v } },
    m: {
      sig: { vsw: vS, vout: vS, iL: iS, iin: iS, iQ: iS, iD: stat(0, 0, 0, 0), vL: stat(0, 0, 0, 0), iC: stat(0, 0, 0, 0), vC: vS },
      Pin: ch.P,
      Pout: ch.P,
      loss: {},
      Ploss: 0,
      eta: 1,
      M: D,
      Iout: ch.avg / R,
      mode: 'chopped',
    },
    ch,
  }
}

// A statistic seen through a sign flip: the average and the extremes change
// sign and swap, the RMS and the peak-to-peak are magnitudes and do not.
const flipStat = (t) => ({ avg: -t.avg, rms: t.rms, min: -t.max, max: -t.min, pp: t.pp })

/**
 * The three clocked converters. `exp.kind` is the converter's own name, so
 * the buck's experiments reach the same code the boost's do.
 *
 * The buck-boost inverts, and the model carries its output as a magnitude
 * (topologies.js). The flip happens here, once, where the model meets the
 * app: v_out and v_C are shown against ground, so they are negative, and M
 * with them. The currents keep the direction the parts carry them in — i_D
 * and i_C are positive in the model's own loop — which the note and the math
 * panel say out loud rather than leaving the reader to wonder.
 */
function analysePwm(params, exp) {
  const kind = exp.kind
  const p = buckParams(params)
  const conv = converter(kind, p)
  const ss = steadyState(conv)
  const raw = measures(ss)
  const wf = waveforms(ss, { periods: exp.periods || 2, n: 240 })
  const inverted = conv.inverted
  const sgn = inverted ? -1 : 1
  const m = inverted
    ? { ...raw, M: -raw.M, sig: { ...raw.sig, vout: flipStat(raw.sig.vout), vC: flipStat(raw.sig.vC) } }
    : raw
  if (inverted) for (const key of ['vout', 'vC']) if (wf.sig[key]) wf.sig[key] = wf.sig[key].map((v) => -v)
  const k = K(p)
  const kc = Kcrit(kind, p.D)
  const r = p.RL / p.R
  const formulas = {
    M: sgn * conversionRatio(kind, p.D),
    // The same ratio with the winding resistance in it; at R_L = 0 it is the
    // line above, so the lossy experiments need no second formula.
    Mreal: sgn * ratioWithRL(kind, p.D, r),
    r,
    dI: inductorRipple(kind, p),
    dV: outputRipple(kind, p),
    K: k,
    Kcrit: kc,
    Rcrit: Rcrit(kind, p),
    Mdcm: sgn * dcmRatio(kind, p.D, k),
    Mpred: sgn * predictedRatio(kind, p),
    // Ideal-parts current figures the ripple derivation uses.
    IL: (p.Vin * p.D) / p.R,
    fo: 1 / (2 * Math.PI * Math.sqrt(p.L * p.C)),
    // The energy the inductor picks up each cycle and, in DCM, hands over
    // whole: ½L·i_pk²·f_s is then the output power, whatever the load.
    Epk: 0.5 * p.L * m.sig.iL.max ** 2,
    Ecyc: 0.5 * p.L * m.sig.iL.max ** 2 * p.fs,
  }
  if (kind === 'boost' && r > 0) {
    const peak = boostPeak(r)
    formulas.Dpeak = peak.D
    formulas.Mpeak = peak.M
  }
  return { kind, T: ss.T, p, conv, ss, m, wf, formulas, inverted, sign: sgn, balance: balanceOf(ss) }
}

// ------------------------------------------------------------ line frequency

/** Rectifier parameters from the knobs; the plan's defaults fill what an experiment omits. */
export function rectParams(params) {
  const p = { ...RECT_DEFAULTS, ...params }
  return { Vs: p.Vs, f: p.f, Rs: p.Rs, Vf: p.Vf, C: p.C, R: p.R }
}

const PHASE_NAMES = ['a', 'b', 'c']

/**
 * What the scope's edge band says at each event. Two-phase circuits conduct or
 * hold; the six-pulse one names the pair that took over, and says nothing
 * when the pair changes while holding (the line marks it).
 */
function edgeLabel(kind, name) {
  const on = name.startsWith('cond')
  if (kind !== 'six') return on ? 'on' : 'off'
  return on ? `${PHASE_NAMES[+name[4]]}${PHASE_NAMES[+name[5]]}` : ''
}

function analyseRectifier(params, exp) {
  const p = rectParams(params)
  const conv = rectifier(exp.rect, p)
  const ss = rectifierSteadyState(conv)
  const m = rectifierMeasures(ss)
  const wf = waveforms(ss, { periods: exp.periods || 2, n: 360 })
  wf.edges = wf.edges.map((e) => ({ ...e, name: edgeLabel(exp.rect, e.name) }))
  const Vpk = conv.Vp * (conv.threePhase ? Math.sqrt(3) : 1)
  const formulas = {
    Vp: conv.Vp,
    Vpk, // the peak the capacitor can be charged towards: phase or line-to-line
    Vll: conv.threePhase ? Math.sqrt(3) * p.Vs : p.Vs,
    ceiling: Vpk - conv.nD * p.Vf,
    // First-order ripple: the load current drawn from C for a whole pulse interval.
    dVfirst: m.Iout / (conv.pulses * p.f * p.C),
    // The discharge the hold interval actually is: an RC decay from where the diode let go.
    dVhold: m.holdFrom * (1 - Math.exp(-m.tHold / (p.R * p.C))),
    // The no-capacitor averages a first course quotes.
    VdcNoC: conv.threePhase ? (3 * Math.sqrt(3) * conv.Vp) / Math.PI : conv.pulses === 2 ? (2 * conv.Vp) / Math.PI : conv.Vp / Math.PI,
    RC: p.R * p.C,
  }
  return {
    kind: 'rectifier',
    rect: exp.rect,
    T: ss.T,
    p,
    conv,
    ss,
    m: {
      ...m,
      pinLabel: conv.threePhase
        ? 'P_{in} = 3\\,\\langle v_a i_a \\rangle'
        : 'P_{in} = \\langle v_{in} i_{in} \\rangle',
      sLabel: conv.threePhase ? 'S = 3\\,V_s I_a' : 'S = V_s I_{rms}',
    },
    wf,
    formulas,
  }
}

/** Dimmer parameters: the firing angle knob is in degrees, the engine wants radians. */
export function dimmerParams(params) {
  const { Vs = 120, f = 60, R = 100, alphaDeg = 90 } = params
  return { Vs, f, R, alpha: (alphaDeg * Math.PI) / 180 }
}

function analyseDimmer(params, exp) {
  const p = dimmerParams(params)
  const d = dimmer(p)
  const wf = dimmerWaveform(p, { periods: exp.periods || 2, n: 360 })
  const Vp = d.Vp
  const T = 1 / p.f
  const vmax = Math.max(...wf.sig.vout)
  const vmin = Math.min(...wf.sig.vout)
  const vDrms = Math.sqrt(Math.max(0, p.Vs ** 2 - d.Vrms ** 2)) // v_in − v_out is the blocked part
  const sig = {
    vin: stat(0, p.Vs, -Vp, Vp),
    vout: stat(0, d.Vrms, vmin, vmax),
    vrect: stat(0, d.Vrms, vmin, vmax),
    iin: stat(0, d.Irms, vmin / p.R, vmax / p.R),
    iR: stat(0, d.Irms, vmin / p.R, vmax / p.R),
    vD: stat(0, vDrms, Math.min(...wf.sig.vD), Math.max(...wf.sig.vD)),
  }
  return {
    kind: 'dimmer',
    T,
    p,
    d,
    wf,
    m: {
      sig,
      Pin: d.P,
      Pout: d.P,
      loss: {},
      Ploss: 0,
      eta: 1,
      Iout: d.Irms,
      Vrms: p.Vs,
      Irms: d.Irms,
      S: p.Vs * d.Irms,
      pf: d.pf,
      distortion: d.distortion,
      displacement: d.displacement,
      phi1: d.phi1,
      thd: d.thd,
      I1: d.I1,
      harmonics: d.harmonics,
      share: d.share,
      Pfull: d.Pfull,
      mode: 'dimmer',
      pinLabel: 'P = \\langle v_{out}^2 \\rangle / R',
      sLabel: 'S = V_s I_{rms}',
    },
    formulas: { Vp, share: d.share, Pfull: d.Pfull },
  }
}

/**
 * The two balances as areas: ∫v_L over each segment (volt-seconds) and ∫i_C
 * (coulombs), exactly. Their sums over the period are the two invariants
 * the whole steady state rests on.
 */
export function balanceOf(ss) {
  const segs = ss.segments
    .filter((s) => s.T > 0)
    .map((seg) => {
      const ix = integral(seg)
      return { name: seg.name, t0: seg.t0, T: seg.T, vs: signalIntegral(seg, 'vL', ix), q: signalIntegral(seg, 'iC', ix) }
    })
  return {
    segs,
    vsTotal: segs.reduce((a, s) => a + s.vs, 0),
    qTotal: segs.reduce((a, s) => a + s.q, 0),
  }
}

// ------------------------------------------------------------ sweeps
// Each point is a full steady state at that setting, so the curve is what
// the converter does — the formula is drawn beside it, not instead of it.

const logSpace = (lo, hi, n) => Array.from({ length: n }, (_, i) => lo * (hi / lo) ** (i / (n - 1)))
const linSpace = (lo, hi, n) => Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1))

/**
 * One point of a converter sweep: the measured ratio and the two curves drawn
 * beside it — the ideal D-formula and the prediction that knows about the
 * mode and the winding. Signed, so the buck-boost's curves sit below the axis
 * where its output does.
 */
function ratioAt(kind, p, sgn) {
  const ss = steadyState(converter(kind, p))
  const m = measures(ss)
  const r = p.RL / p.R
  const k = K(p)
  // predictedRatio's own choice of formula — the boundary the textbook draws,
  // not the mode the engine found, so b5's two curves still meet where the
  // books say they do — with the winding carried in the CCM branch, which at
  // R_L = 0 is the ideal formula unchanged.
  const pred = k >= Kcrit(kind, p.D) ? ratioWithRL(kind, p.D, r) : dcmRatio(kind, p.D, k)
  return {
    M: sgn * (average(ss, 'vout') / p.Vin),
    mode: ss.mode,
    ideal: sgn * conversionRatio(kind, p.D),
    pred: sgn * pred,
    eta: m.eta,
    Pout: m.Pout,
    Vout: sgn * m.sig.vout.avg,
  }
}

const sgnOf = (kind) => (kind === 'buckboost' ? -1 : 1)

/** M against duty, at the current load. */
export function sweepD(params, kind = 'buck', n = 61) {
  const base = buckParams(params)
  const sgn = sgnOf(kind)
  return linSpace(0.02, 0.98, n).map((D) => ({ x: D, ...ratioAt(kind, { ...base, D }, sgn) }))
}

/** M against load resistance, across the CCM/DCM boundary. */
export function sweepR(params, kind = 'buck', n = 61) {
  const base = buckParams(params)
  const sgn = sgnOf(kind)
  return logSpace(0.5, 1000, n).map((R) => ({ x: R, ...ratioAt(kind, { ...base, R }, sgn) }))
}

/** Efficiency against duty for the linear regulator: it is V_out/V_in, and nothing else. */
export function sweepLinear(params, n = 61) {
  const { Vin, R } = params
  return linSpace(0.02, 0.98, n).map((D) => {
    const Vo = D * Vin
    return { x: D, eta: linearRegulator({ Vin, Vo, R }).eta }
  })
}

/** Efficiency against load, with the losses in the knobs. */
export function sweepEta(params, kind = 'buck', n = 41) {
  const base = buckParams(params)
  return logSpace(0.5, 1000, n).map((R) => {
    const p = { ...base, R }
    const ss = steadyState(converter(kind, p))
    const m = measures(ss)
    return { x: R, eta: m.eta, mode: ss.mode }
  })
}

/**
 * The rectifier against its capacitor: as C grows the output smooths, the
 * conduction angle narrows and the diode current spikes. Every point is a
 * solved steady state.
 */
export function sweepC(params, exp, n = 25) {
  const base = rectParams(params)
  return logSpace(10e-6, 10e-3, n).map((C) => {
    const p = { ...base, C }
    const m = rectifierMeasures(rectifierSteadyState(rectifier(exp.rect, p)))
    return { x: C, angle: m.angle, iPeak: m.iPeak, formFactor: m.formFactor, ripple: m.ripple, pf: m.pf, Vdc: m.Vdc }
  })
}

/**
 * The dimmer against its firing angle: the power share measured on the
 * waveform (trapezoid on a trace that carries both sides of every edge),
 * the closed form beside it, and the power factor.
 */
export function sweepAlpha(params, n = 61) {
  return linSpace(0, 180, n).map((alphaDeg) => {
    const p = dimmerParams({ ...params, alphaDeg })
    const w = dimmerWaveform(p, { periods: 1, n: 720 })
    let ms = 0
    for (let i = 1; i < w.t.length; i++) ms += ((w.sig.vout[i] ** 2 + w.sig.vout[i - 1] ** 2) / 2) * (w.t[i] - w.t[i - 1])
    const d = dimmer(p, { harmonics: 1 })
    return { x: alphaDeg, share: ms / w.T / (p.Vs * p.Vs), pred: d.share, pf: d.pf }
  })
}
