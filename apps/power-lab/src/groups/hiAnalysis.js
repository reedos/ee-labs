// What Groups H and I add to the analysis: the averaged model beside a
// switched converter, and the three-phase bridge as a topology of its own.
//
// `analysis.js` reaches this file by one line each. The loop experiments are
// ordinary clocked converters, so they go through `analysePwm` first and this
// file adds the model, its guard and the step to what comes back. The
// three-phase bridge is its own engine, so it is analysed here whole, in the
// shape every pane already expects: `p`, `conv`, `ss`, `m`, `wf`, `formulas`.

import {
  converter,
  gvd,
  gvdClosedForm,
  averagingGuard,
  stepAgreement,
  dcGainMeasured,
  threePhase,
  threePhaseSteadyState,
  threePhaseMeasures,
  threePhaseWaveform,
  triplenRatio,
  referencePeak,
  injectionHeadroom,
  sixStepLineRms,
  sixStepPhaseRms,
  sixStepLineTotalRms,
  sixStepPhaseTotalRms,
  spwmLinePeak,
  spwmPhasePeak,
  INJECTION,
  THREE_PHASE_KINDS,
} from '@ee-labs/switched'

export const HI_KINDS = THREE_PHASE_KINDS

/** The converter the step lands on: one knob moved, everything else held. */
function afterParams(exp, p, params) {
  const st = exp.step
  const out = { ...p }
  if (st.to) out[st.param] = params[st.to]
  else if (st.by) out[st.param] = Math.min(0.95, Math.max(0.02, p[st.param] + params[st.by]))
  return out
}

/**
 * The loop fields, added to a solved clocked converter (H1, H2, H3).
 *
 * `plant` is the control-to-output transfer function of the averaged
 * circuit, `guard` is the applicability check that ships with it, and `step`
 * is the exact switched walk with the averaged curve laid over it.
 */
export function loopFields(x, exp, params) {
  const kind = x.kind
  const plant = gvd(x.conv)
  const ideal = gvdClosedForm(kind, x.p)
  const guard = averagingGuard(plant, x.p.fs)
  const dcMeasured = dcGainMeasured(x.conv, (D) => converter(kind, { ...x.p, D }), { dD: 1e-5 })
  let step = null
  if (exp.step) {
    const after = converter(kind, afterParams(exp, x.p, params))
    step = stepAgreement(x.conv, after, {
      periods: exp.step.periods || 200,
      n: exp.step.n || 24,
      out: exp.step.out || 'vout',
    })
    step.afterP = after.p
  }
  return {
    ...x,
    loop: true,
    plant,
    guard,
    step,
    formulas: {
      ...x.formulas,
      f0plant: plant.w0 / (2 * Math.PI),
      Qplant: plant.Q,
      fz: Number.isFinite(plant.wz) ? plant.wz / (2 * Math.PI) : Infinity,
      dcPlant: plant.dc,
      dcIdeal: ideal.dc,
      f0ideal: ideal.f0,
      Qideal: ideal.Q,
      fzIdeal: ideal.fz,
      dcMeasured,
      ceiling: guard.limit,
      slope0: plant.slope0,
    },
  }
}

/** The three-phase bridge's parameters from the knobs. */
export function threePhaseParams(params) {
  const p = { Vdc: 48, f1: 60, L: 20e-3, R: 10, ma: 0.8, fsw: 1260, inject: 0, ...params }
  return {
    Vdc: p.Vdc,
    f1: p.f1,
    L: p.L,
    R: p.R,
    ma: p.ma,
    fsw: p.fsw,
    // The knob is a two-position switch; the model wants the offset's own
    // amplitude, which is one sixth of the reference.
    inject: p.inject ? INJECTION : 0,
  }
}

/** The three-phase bridge, whole (I1, I2, I3). */
export function analyseThreePhase(params, exp) {
  const p = threePhaseParams(params)
  const conv = threePhase(exp.kind, p)
  const ss = threePhaseSteadyState(conv)
  const m = threePhaseMeasures(ss)
  const wf = threePhaseWaveform(ss, { periods: exp.periods || 1, n: 1200 })
  const six = exp.kind === 'sixstep'
  const w = 2 * Math.PI * p.f1
  const phi = Math.atan2(w * p.L, p.R)
  const formulas = {
    mf: conv.mf,
    fsw: conv.fsw,
    inject: p.inject,
    ceiling: conv.ceiling,
    referencePeak: conv.referencePeak,
    headroom: injectionHeadroom(),
    commanded: conv.commanded,
    // What the plan writes down for each modulator.
    Vll1ideal: six ? sixStepLineRms(p.Vdc) : spwmLinePeak(Math.min(p.ma, conv.ceiling), p.Vdc) / Math.SQRT2,
    Vph1ideal: six ? sixStepPhaseRms(p.Vdc) : spwmPhasePeak(Math.min(p.ma, conv.ceiling), p.Vdc) / Math.SQRT2,
    VllRmsIdeal: six ? sixStepLineTotalRms(p.Vdc) : null,
    VphRmsIdeal: six ? sixStepPhaseTotalRms(p.Vdc) : null,
    // The staircase's own two levels, which every two-level bridge gives.
    step1: p.Vdc / 3,
    step2: (2 * p.Vdc) / 3,
    thdIdeal: six ? Math.sqrt((Math.PI * Math.PI) / 9 - 1) : null,
    // The load, which is what decides the current.
    Z: Math.hypot(p.R, w * p.L),
    phi,
    phiDeg: (phi * 180) / Math.PI,
    // One phase's power swings by S/P of its mean; three of them do not.
    onePhaseSwing: 1 / Math.cos(phi),
    triplen: triplenRatio(p.fsw, p.f1),
    peakPlain: referencePeak(0),
  }
  return { kind: exp.kind, threePhase: true, T: ss.T, p, conv, ss, m, wf, formulas, inverted: false, sign: 1 }
}

/**
 * The line-to-line fundamental against the modulation index, with and
 * without the third-harmonic offset (I2).
 *
 * Both curves are drawn, because the lesson is where they part: the plain
 * sine leaves the line at m_a = 1 and the offset follows it to 2/√3.
 */
export function sweepMa3(params, n = 25) {
  const base = threePhaseParams(params)
  const out = []
  for (let i = 0; i < n; i++) {
    const ma = 0.2 + (1.15 - 0.2) * (i / (n - 1))
    const one = (inject) => {
      const conv = threePhase('spwm3', { ...base, ma, inject })
      return threePhaseMeasures(threePhaseSteadyState(conv), { harmonics: 1, dense: 8 }).Vll1 * Math.SQRT2
    }
    out.push({ x: ma, vll1: one(0), vll1off: one(INJECTION), pred: spwmLinePeak(ma, base.Vdc) })
  }
  return out
}
