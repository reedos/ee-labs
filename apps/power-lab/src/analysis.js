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
  saturatingConverter,
  saturatingSteadyState,
  saturationEvent,
  saturationCurrent,
  fluxDensity,
  fluxSwing,
  fluxTrace,
  isolated,
  isolatedM,
  ISOLATED_KINDS,
  inverter,
  inverterSteadyState,
  inverterMeasures,
  inverterWaveform,
  inverterDistortion,
  squareFundamentalRms,
  squareThd,
  spwmFundamentalPeak,
  lcMagnitude,
  INVERTER_KINDS,
  lossLedger,
  capacitorRms,
  switchingCrossover,
  peakEfficiencyLoad,
} from '@ee-labs/switched'
import { LMN_KINDS, analyseLmn } from './groups/lmn.js'

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

/** The three numbers that decide when a core runs out of flux, from the knobs. */
export function coreParams(params) {
  const p = { N: 40, Ae: 40, Bsat: 0.3, hard: 20, ...params }
  // The knob is in mm², which is the unit a core is sold in.
  return { N: p.N, Ae: p.Ae * 1e-6, Bsat: p.Bsat, hard: p.hard }
}

export function analyse(exp, params) {
  if (LMN_KINDS.includes(exp.kind)) return analyseLmn(exp, params)
  if (exp.kind === 'linreg') return analyseLinear(params)
  if (exp.kind === 'chopper') return analyseChopper(params)
  if (exp.kind === 'rectifier') return analyseRectifier(params, exp)
  if (exp.kind === 'dimmer') return analyseDimmer(params, exp)
  if (INVERTER_KINDS.includes(exp.kind)) return analyseInverter(params, exp)
  if (ISOLATED_KINDS.includes(exp.kind)) return analyseIsolated(params, exp)
  if (exp.core) return analyseCore(params, exp)
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
    // With no filter the switch node is the output, and the load current is the
    // source current is the switch current: the same two waveforms under every
    // name the panes might ask for. The measures table lists v_out and i_R
    // (schematics.jsx TOPOLOGY_SIGNALS), once each.
    wf: { t, T, edges, sig: { vsw: v, vout: v, iL: i, iin: i, iQ: i, iR: i, iD: z, vL: z, iC: z, vC: v } },
    m: {
      sig: { vsw: vS, vout: vS, iL: iS, iin: iS, iQ: iS, iR: iS, iD: stat(0, 0, 0, 0), vL: stat(0, 0, 0, 0), iC: stat(0, 0, 0, 0), vC: vS },
      Pin: ch.P,
      Pout: ch.P,
      // The losses pane shows the one part that could lose, losing nothing.
      loss: { switch: 0 },
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

// ------------------------------------------------------------ magnetics

/**
 * A buck whose inductor is wound on a core (D1, D2).
 *
 * The converter is the same one Group B solves; what is added is the knee at
 * |i_L| = I_sat, where the inductance collapses and the period grows two more
 * segments. With the peak current under the knee the solver's answer is the
 * two-interval one to the last bits, which `magnetics.test.js` holds.
 */
function analyseCore(params, exp) {
  const p = buckParams(params)
  const core = coreParams(params)
  const conv = saturatingConverter('buck', { ...p, ...core })
  const ss = saturatingSteadyState(conv)
  const m = measures(ss)
  const wf = waveforms(ss, { periods: exp.periods || 2, n: 240 })
  const flux = fluxTrace(conv, wf)
  const event = saturationEvent(ss)
  const spec = { L: p.L, ...conv.core }
  // The on interval's volt-seconds, which are the flux excursion times N·A_e.
  const onVs = ss.segments.filter((s) => s.T > 0 && s.name.startsWith('on')).reduce((a, s) => a + signalIntegral(s, 'vL'), 0)
  const k = K(p)
  const formulas = {
    M: conversionRatio('buck', p.D),
    Mreal: ratioWithRL('buck', p.D, p.RL / p.R),
    dI: inductorRipple('buck', p),
    dV: outputRipple('buck', p),
    K: k,
    Kcrit: Kcrit('buck', p.D),
    Rcrit: Rcrit('buck', p),
    Mdcm: dcmRatio('buck', p.D, k),
    Mpred: predictedRatio('buck', p),
    IL: (p.Vin * p.D) / p.R,
    fo: 1 / (2 * Math.PI * Math.sqrt(p.L * p.C)),
    Epk: 0.5 * p.L * m.sig.iL.max ** 2,
    Ecyc: 0.5 * p.L * m.sig.iL.max ** 2 * p.fs,
    // The magnetics' own row.
    Isat: conv.Isat,
    Lsat: conv.Lsat,
    Bsat: conv.core.Bsat,
    coreArea: conv.core.N * conv.core.Ae,
    onVs,
    dB: fluxSwing(conv.core, onVs),
    Bpk: fluxDensity(spec, m.sig.iL.max),
    // The closed form beside it: (V_in − V_out)·D·T over N·A_e.
    dBideal: ((p.Vin - m.sig.vout.avg) * p.D) / p.fs / (conv.core.N * conv.core.Ae),
    satShare: ss.segments.filter((s) => s.T > 0 && s.name.endsWith('·sat')).reduce((a, s) => a + s.T, 0) / ss.T,
    tSat: event ? event.t : null,
    iSat: event ? event.i : null,
  }
  return { kind: 'buck', saturating: true, T: ss.T, p, core: conv.core, conv, ss, m, wf, flux, formulas, inverted: false, sign: 1, balance: balanceOf(ss) }
}

// ------------------------------------------------------------ isolated

/**
 * The flyback and the half-bridge (D3, D4).
 *
 * The knob is the turns ratio as a transformer is labelled, primary to
 * secondary; the engine's n is its reciprocal. The half-bridge is solved over
 * half a switching period at twice the duty, so `switching` carries the
 * numbers the reader set and `p` carries the ones the solver ran with.
 */
function analyseIsolated(params, exp) {
  const base = buckParams(params)
  const n = 1 / (params.Np || 2)
  const conv = isolated(exp.kind, { ...base, n })
  const ss = steadyState(conv)
  const m = measures(ss)
  const wf = waveforms(ss, { periods: (exp.periods || 2) * (exp.kind === 'halfbridge' ? 2 : 1), n: 240 })
  if (exp.kind === 'halfbridge') {
    // The output side repeats every half period, so two of them are one
    // switching period, and the second is the other switch's.
    wf.edges = wf.edges.map((e, i) => ({ ...e, name: e.name === 'Q1 on' && i >= 2 ? 'Q2 on' : e.name }))
  }
  const p = conv.p
  const fly = exp.kind === 'flyback'
  // The duty and the frequency the reader set, which for the half-bridge are
  // half of the ones the solver ran with.
  const sw = conv.switching || { D: p.D, fs: p.fs, T: conv.T }
  const M = isolatedM(exp.kind, sw.D, n)
  const Vo = p.Vin * M
  // The pulse the filter is fed, and the ripple it leaves. The flyback's
  // capacitor is alone with the load for the D of each period; the
  // half-bridge's carries the output inductor's triangle at twice f_s.
  const vpulse = fly ? null : (n * p.Vin) / 2
  const dI = fly ? (p.Vin * sw.D) / (base.L * sw.fs) : ((vpulse - Vo) * sw.D) / (base.L * sw.fs)
  const dV = fly ? (Math.abs(M * p.Vin) / base.R) * (sw.D / (base.C * sw.fs)) : dI / (8 * (2 * sw.fs) * base.C)
  const formulas = {
    n,
    Np: params.Np || 2,
    M,
    Vo,
    K: K(p),
    Kcrit: fly ? Kcrit('buckboost', p.D) : Kcrit('buck', p.D),
    // The load at which conduction stops being continuous. The flyback's
    // boundary is the buck-boost's with the load reflected through n².
    Rcrit: fly ? (2 * base.L * sw.fs * n * n) / (1 - sw.D) ** 2 : Rcrit('buck', p),
    dI,
    dV,
    fo: 1 / (2 * Math.PI * Math.sqrt(base.L * base.C)),
    blocking: conv.blocking(m.sig.vout.avg),
    rail: p.Vin,
    vpulse,
    switching: sw,
    ripplePulses: fly ? 1 : 2,
    // What the same filter would leave if it were fed once a period rather
    // than twice: the half-bridge's saving, stated as a number.
    dVatFs: fly ? null : dI / (8 * sw.fs * base.C),
    headroom: conv.headroom,
  }
  return { kind: exp.kind, isolated: true, T: ss.T, p, base, conv, ss, m, wf, formulas, inverted: false, sign: 1, balance: balanceOf(ss) }
}

// ------------------------------------------------------------ inverters

/** Inverter parameters from the knobs. */
export function inverterParams(params) {
  const p = { Vdc: 48, f1: 60, L: 1e-3, C: 10e-6, R: 10, ma: 0.8, fsw: 3780, Ron: 0, RL: 0, ESR: 0, ...params }
  return { Vdc: p.Vdc, f1: p.f1, L: p.L, C: p.C, R: p.R, ma: p.ma, fsw: p.fsw, Ron: p.Ron, RL: p.RL, ESR: p.ESR }
}

function analyseInverter(params, exp) {
  const p = inverterParams(params)
  const conv = inverter(exp.kind, p)
  const ss = inverterSteadyState(conv)
  const m = inverterMeasures(ss)
  const wf = inverterWaveform(ss, { periods: exp.periods || 1, n: 1200 })
  const formulas = {
    mf: conv.mf,
    fsw: conv.fsw,
    commanded: conv.commanded,
    V1ideal: exp.kind === 'square' ? squareFundamentalRms(p.Vdc) : (Math.min(p.ma, 1) * p.Vdc) / Math.SQRT2,
    thdIdeal: exp.kind === 'square' ? squareThd() : null,
    peakIdeal: spwmFundamentalPeak(Math.min(p.ma, 1), p.Vdc),
    fo: 1 / (2 * Math.PI * Math.sqrt(p.L * p.C)),
    Q: p.R * Math.sqrt(p.C / p.L),
    Hcarrier: exp.kind === 'spwm' ? lcMagnitude(p, conv.fsw) : null,
    Hthird: lcMagnitude(p, 3 * p.f1),
    Hfund: lcMagnitude(p, p.f1),
  }
  return { kind: exp.kind, inverterKind: exp.kind, T: ss.T, p, conv, ss, m, wf, formulas, inverted: false, sign: 1 }
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
/**
 * The converter a sweep point runs, whichever engine it belongs to: the three
 * bare ones, a saturating one, or an isolated one. `opts.core` carries the
 * core's three numbers and `opts.n` the turns ratio.
 */
function convOf(kind, p, opts = {}) {
  if (opts.core) return saturatingConverter(kind, { ...p, ...opts.core })
  if (ISOLATED_KINDS.includes(kind)) return isolated(kind, { ...p, n: opts.n })
  return converter(kind, p)
}
const solveOf = (conv) => (conv.saturating ? saturatingSteadyState(conv) : steadyState(conv))

/** The ratio a textbook predicts at this point, for the curve drawn beside the measured one. */
function predictedAt(kind, p, opts) {
  if (ISOLATED_KINDS.includes(kind)) {
    const n = opts.n
    if (kind === 'halfbridge') return isolatedM(kind, p.D, n)
    const k = (2 * p.L * p.fs * n * n) / p.R
    return k >= (1 - p.D) ** 2 ? isolatedM(kind, p.D, n) : (n * p.D) / Math.sqrt(k)
  }
  const k = K(p)
  return k >= Kcrit(kind, p.D) ? ratioWithRL(kind, p.D, p.RL / p.R) : dcmRatio(kind, p.D, k)
}

function ratioAt(kind, p, sgn, opts = {}) {
  const conv = convOf(kind, p, opts)
  const ss = solveOf(conv)
  const m = measures(ss)
  // predictedRatio's own choice of formula — the boundary the textbook draws,
  // not the mode the engine found, so b5's two curves still meet where the
  // books say they do — with the winding carried in the CCM branch, which at
  // R_L = 0 is the ideal formula unchanged.
  const pred = predictedAt(kind, p, opts)
  const ideal = ISOLATED_KINDS.includes(kind) ? isolatedM(kind, p.D, opts.n) : conversionRatio(kind, p.D)
  return {
    M: sgn * (average(ss, 'vout') / p.Vin),
    mode: ss.mode,
    ideal: sgn * ideal,
    pred: sgn * pred,
    eta: m.eta,
    Pout: m.Pout,
    Vout: sgn * m.sig.vout.avg,
  }
}

const sgnOf = (kind) => (kind === 'buckboost' ? -1 : 1)

/** The knobs a sweep needs beyond the buck's: the core, or the turns ratio. */
export function sweepOpts(exp, params) {
  if (!exp) return {}
  if (exp.core) return { core: coreParams(params) }
  if (ISOLATED_KINDS.includes(exp.kind)) return { n: 1 / (params.Np || 2) }
  return {}
}

/**
 * M against duty, at the current load. A half-bridge's switches are on for at
 * most half the period each, so its sweep stops where its knob does.
 */
export function sweepD(params, kind = 'buck', n = 61, opts = {}) {
  const base = buckParams(params)
  const sgn = sgnOf(kind)
  const hi = kind === 'halfbridge' ? 0.49 : 0.98
  return linSpace(0.02, hi, n).map((D) => ({ x: D, ...ratioAt(kind, { ...base, D }, sgn, opts) }))
}

/** M against load resistance, across the CCM/DCM boundary. */
export function sweepR(params, kind = 'buck', n = 61, opts = {}) {
  const base = buckParams(params)
  const sgn = sgnOf(kind)
  return logSpace(0.5, 1000, n).map((R) => ({ x: R, ...ratioAt(kind, { ...base, R }, sgn, opts) }))
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
export function sweepEta(params, kind = 'buck', n = 41, opts = {}) {
  const base = buckParams(params)
  return logSpace(0.5, 1000, n).map((R) => {
    const p = { ...base, R }
    const ss = solveOf(convOf(kind, p, opts))
    const m = measures(ss)
    return { x: R, eta: m.eta, mode: ss.mode }
  })
}

/**
 * Efficiency against switching frequency, with the losses in the knobs: the
 * edges charge per cycle, so this is where t_sw shows (B8). Across the knob's
 * own range; at the slow end the converter may run dry, and the point says so.
 */
export function sweepFs(params, kind = 'buck', n = 41, opts = {}) {
  const base = buckParams(params)
  return logSpace(10e3, 2e6, n).map((fs) => {
    const p = { ...base, fs }
    const ss = solveOf(convOf(kind, p, opts))
    const m = measures(ss)
    return { x: fs, eta: m.eta, mode: ss.mode }
  })
}

/**
 * The chopper against its duty: the average the load gets, D·V_in, and the
 * RMS it heats by, √D·V_in — both from the engine's closed forms (A2). No
 * mode and no `pred`: there is no waveform to solve and nothing to predict.
 */
export function sweepChopper(params, n = 61) {
  const { Vin, R } = params
  return linSpace(0.02, 0.98, n).map((D) => {
    const ch = chopper({ Vin, D, R })
    return { x: D, vavg: ch.avg, vrms: ch.rms, P: ch.P }
  })
}

/**
 * The sine-PWM bridge against its modulation index: the fundamental follows
 * m_a·V_dc up to 1 and then falls behind it, which is F2's whole claim. The
 * ideal line is drawn beside the measured one, so where they part is on the
 * screen rather than in the note alone.
 */
export function sweepMa(params, n = 29) {
  const base = inverterParams(params)
  return linSpace(0.05, 1.4, n).map((ma) => {
    const conv = inverter('spwm', { ...base, ma })
    const m = inverterMeasures(inverterSteadyState(conv), { harmonics: 1, dense: 12 })
    return { x: ma, v1: m.Vsw1 * Math.SQRT2, pred: spwmFundamentalPeak(Math.min(ma, 1), base.Vdc) }
  })
}

/**
 * The load voltage's distortion against the carrier frequency (F4). Every
 * point is a solved fundamental period, and the carrier snaps to an odd
 * multiple, so the curve is a staircase in m_f drawn against the frequency
 * the knob asks for.
 */
export function sweepFsw(params, n = 21) {
  const base = inverterParams(params)
  return logSpace(300, 8e3, n).map((fsw) => {
    const conv = inverter('spwm', { ...base, fsw })
    const d = inverterDistortion(inverterSteadyState(conv))
    return { x: fsw, thd: d.thd, mf: conv.mf, v1: d.V1 * Math.SQRT2 }
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
