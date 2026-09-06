// The one number each experiment is about.
//
// A student who opens an experiment should meet its answer before its
// method: R_eq = 3 kΩ, τ = 1 ms, v_out = 25 mV. Each experiment here names
// that quantity, says where in the drawing it lives, and reads it off the
// solution — never off a formula, so the headline is a measurement of the
// circuit and experiments.test.js checks it against the closed form.
//
//   label   what the number is, in the words of the lesson
//   tag     how it is written next to the drawing: "R_eq", "τ", "v_out"
//   unit    its unit; `plain` marks a ratio (ζ, |H| in dB) that takes no prefix
//   where   the element id or node name the number belongs to — the schematic
//           carries a callout there — or null when it belongs to no one place
//   value   (x, p) → the number, from the analysis `x` at the knobs `p`
//   refused what to say when the circuit has no solution to read

import { complex as cx, meanRms } from '@ee-labs/network'
import { peakAt } from './math.js'
import { num } from './format.js'

const mag = (z) => cx.cabs(z)
// ½·Re(V·I*): the average power a phasor pair carries.
const realPower = (V, I) => 0.5 * (V[0] * I[0] + V[1] * I[1])

export const HEADLINES = {
  a1: { label: 'the current the resistor lets through', tag: 'i', unit: 'A', where: 'R1', value: (x) => x.sol.i.R1 },
  a2: {
    label: 'the voltage the source has to make to keep its current',
    tag: 'v_in', unit: 'V', where: 'in',
    value: (x) => x.sol.v.in,
    refused: 'no path — a current source with nowhere to send its current has no voltage to settle on',
  },
  a3: { label: 'the voltage across R₁ — the lift V₀ is not in it', tag: 'v_R1', unit: 'V', where: 'R1', value: (x) => x.sol.volt.R1 },
  a4: { label: 'the power R turns to heat', tag: 'p_R', unit: 'W', where: 'R1', value: (x) => x.sol.p.R1 },
  b1: { label: 'the current arriving at A — all of it leaves through R₂ and R₃', tag: 'i_R1', unit: 'A', where: 'A', value: (x) => x.sol.i.R1 },
  b2: { label: 'the one current around the loop', tag: 'i', unit: 'A', where: 'R1', value: (x) => x.sol.i.R1 },
  b3: { label: 'the power the source delivers — negative, because it supplies', tag: 'p_V1', unit: 'W', where: 'V1', value: (x) => x.sol.p.V1 },
  b4: { label: 'the current, set by the difference of the two sources', tag: 'i', unit: 'A', where: 'R1', value: (x) => x.sol.i.R1 },
  c1: { label: 'what the source sees: R₁ + R₂ + R₃', tag: 'R_eq', unit: 'Ω', where: 'V1', value: (x) => x.sol.volt.V1 / -x.sol.i.V1 },
  c2: { label: 'what the source sees: below the smallest branch', tag: 'R_eq', unit: 'Ω', where: 'V1', value: (x) => x.sol.volt.V1 / -x.sol.i.V1 },
  c3: { label: 'the divider’s output with the load on it', tag: 'v_A', unit: 'V', where: 'A', value: (x) => x.sol.v.A },
  c4: { label: 'the bridge output, v_R − v_L', tag: 'v_out', unit: 'V', where: null, value: (x) => x.sol.v.R - x.sol.v.L },
  d1: { label: 'the node voltage, from one KCL row', tag: 'v_A', unit: 'V', where: 'A', value: (x) => x.sol.v.A },
  d2: { label: 'the voltage at B, from the supernode row', tag: 'v_B', unit: 'V', where: 'B', value: (x) => x.sol.v.B },
  d3: { label: 'the left mesh current i₁', tag: 'i₁', unit: 'A', where: 'R1', value: (x) => x.sol.i.R1 },
  d4: { label: 'v_A — the V₁-alone part plus the I₁-alone part', tag: 'v_A', unit: 'V', where: 'A', value: (x) => x.sol.v.A },
  d5: { label: 'the resistance seen at A with the source killed', tag: 'R_th', unit: 'Ω', where: 'A', value: (x) => x.thevenin.rth.test },
  d6: { label: 'the power the load gets', tag: 'P_L', unit: 'W', where: 'RL', value: (x) => x.sol.p.RL },
  e1: { label: 'the output — A times the input', tag: 'v_out', unit: 'V', where: 'out', value: (x) => x.sol.v.out },
  e2: { label: 'the output — short of A·V₁ at both ends', tag: 'v_out', unit: 'V', where: 'out', value: (x) => x.sol.v.out },
  e3: {
    label: 'the output — A times the difference at the inputs',
    tag: 'v_out', unit: 'V', where: 'out',
    value: (x) => x.sol.v.out,
    refused: 'any difference × infinite gain — the output saturates, no finite value',
  },
  e4: { label: 'the output — the closed-loop gain times the input', tag: 'v_out', unit: 'V', where: 'out', value: (x) => x.sol.v.out },
  e5: { label: 'the output — −R_f/R_g times the input', tag: 'v_out', unit: 'V', where: 'out', value: (x) => x.sol.v.out },
  e6: { label: 'the output — a weighted sum of the inputs, inverted', tag: 'v_out', unit: 'V', where: 'out', value: (x) => x.sol.v.out },
  e7: { label: 'the output — the difference of the inputs, scaled', tag: 'v_out', unit: 'V', where: 'out', value: (x) => x.sol.v.out },
  e8: { label: 'the output — the divider’s own voltage, load or not', tag: 'v_out', unit: 'V', where: 'out', value: (x) => x.sol.v.out },
  f1: { label: 'the capacitor current now — C times the slope of v_C', tag: 'i_C', unit: 'A', where: 'C1', value: (x) => x.sol.i.C1 },
  f2: { label: 'the inductor voltage now — L times the slope of i_L', tag: 'v_L', unit: 'V', where: 'L1', value: (x) => x.sol.volt.L1 },
  f3: { label: 'the time constant, R × C', tag: 'τ', unit: 's', where: 'C1', value: (x) => x.state.tau },
  f4: { label: 'the time constant — the Thévenin resistance times C', tag: 'τ', unit: 's', where: 'C1', value: (x) => x.state.tau },
  f5: {
    label: 'the heat in R so far — heading for ½CE², whatever R is',
    tag: 'W_R', unit: 'J', where: 'R1',
    // Supplied − stored, both from the capacitor's charge: E·q − q²/2C.
    value: (x, p) => p.C1 * p.E * x.sol.volt.C1 - 0.5 * p.C1 * x.sol.volt.C1 ** 2,
  },
  f6: {
    label: 'the switch voltage the instant it opens — I₀ × R_off',
    tag: 'v_S1', unit: 'V', where: 'S1',
    value: (x) => x.tr.at(0).sol.volt.S1,
    refused: 'I₀ × infinite ohms — an unbounded spark; give the switch a finite R_off to read it',
  },
  f7: { label: 'the output now — minus the running integral of v_in over RC', tag: 'v_out', unit: 'V', where: 'out', value: (x) => x.sol.v.out },
  g1: { label: 'the damping ratio ζ = α/ω₀ — above 1, no oscillation', tag: 'ζ', unit: '', plain: true, where: 'R1', value: (x) => x.state.zeta },
  g2: { label: 'the damping ratio — exactly 1 at R = 2√(L/C)', tag: 'ζ', unit: '', plain: true, where: 'R1', value: (x) => x.state.zeta },
  g3: { label: 'the damping ratio at this R', tag: 'ζ', unit: '', plain: true, where: 'R1', value: (x) => x.state.zeta },
  g4: { label: 'the ringing frequency ω_d = √(ω₀² − α²)', tag: 'ω_d', unit: 'rad/s', where: 'C1', value: (x) => x.state.wd },
  g5: { label: 'the natural frequency ω₀ = 1/√(LC)', tag: 'ω₀', unit: 'rad/s', where: 'L1', value: (x) => x.state.w0 },
  g6: { label: 'v_C the instant after the step — the same as the instant before', tag: 'v_C(0⁺)', unit: 'V', where: 'C1', value: (x) => x.tr.at(0).sol.volt.C1 },
  g7: { label: 'the decay time 1/α = 2RC of the tank — the series circuit’s 2L/R, turned over', tag: '1/α', unit: 's', where: 'R1', value: (x) => 1 / x.state.alpha },
  h1: { label: 'the time constant — how long the natural part takes to die', tag: 'τ', unit: 's', where: 'C1', value: (x) => x.state.tau },
  h2: { label: 'the capacitor’s steady amplitude — the length of its arrow', tag: '|V_C|', unit: 'V', where: 'C1', value: (x) => mag(x.ac.volt.C1) },
  h3: { label: 'the impedance the source sees, |V|/|I|', tag: '|Z|', unit: 'Ω', where: 'V1', value: (x) => mag(x.ac.volt.V1) / mag(x.ac.i.V1) },
  h4: { label: 'the resonant frequency f₀ = 1/(2π√LC), where |Z| = R', tag: 'f₀', unit: 'Hz', where: 'C1', value: (x) => x.state.w0 / (2 * Math.PI) },
  h5: { label: 'the real power — the part that heats R', tag: 'P', unit: 'W', where: 'R1', value: (x) => realPower(x.ac.volt.R1, x.ac.i.R1) },
  h6: { label: 'the gain at this frequency, |V_C|/|V_s| in dB', tag: '|H|', unit: 'dB', plain: true, where: 'C1', value: (x) => 20 * Math.log10(mag(x.ac.volt.C1) / mag(x.ac.volt.V1)) },
  h7: {
    label: 'the gain here, ω₀² over the two distances to the roots',
    tag: '|H|', unit: 'dB', plain: true, where: 'C1',
    value: (x) => 20 * Math.log10(mag(x.ac.volt.C1) / mag(x.ac.volt.V1)),
  },
  e9: { label: 'the threshold the input has to pass to flip it', tag: 'V_trip', unit: 'V', where: 'p', value: (x) => Math.abs(x.tr.at(0).sol.v.p) },
  i1: { label: 'the drop the diode takes, on this model', tag: 'v_D', unit: 'V', where: 'D1', value: (x) => x.sol.volt.D1 },
  i2: { label: 'the operating point: where the curve meets the load line', tag: 'i_D', unit: 'A', where: 'D1', value: (x) => x.sol.i.D1 },
  i3: { label: 'the node, clamped by whichever diode is conducting', tag: 'v_A', unit: 'V', where: 'A', value: (x) => x.sol.v.A },
  i4: { label: 'the average of the rectified output — its DC value', tag: 'V_dc', unit: 'V', where: 'RL', value: (x, p) => cycleMean(x, (sol) => sol.v.out, p.f) },
  i5: { label: 'the average out of the bridge — twice a half-wave’s', tag: 'V_dc', unit: 'V', where: 'RL', value: (x, p) => cycleMean(x, (sol) => sol.v.p, p.f) },
  i6: { label: 'the ripple: how far it falls between two humps', tag: 'ΔV', unit: 'V', where: 'C1', value: (x) => dischargeDrop(x) },
  i8: { label: 'the output the Zener holds, whatever the load does', tag: 'v_out', unit: 'V', where: 'D1', value: (x) => x.sol.v.out },
  i7: { label: 'the level the output cannot pass: V_ref + V_f', tag: 'v_clip', unit: 'V', where: 'D1', value: (x) => peakAt(x, (sol) => sol.v.out) },
  i9: { label: 'the level the output is held at, one drop below ground', tag: 'v_min', unit: 'V', where: 'D1', value: (x) => clampLevel(x) },
  i10: { label: 'the doubled output at its peak', tag: 'v_peak', unit: 'V', where: 'C2', value: (x) => settledPeak(x) },
}

/**
 * The level a clamper holds its output at: v_out read inside the last window
 * where the diode conducts, which is where the diode is setting it. Falls back
 * to the lowest sample when the signal never reaches the diode at all.
 */
function clampLevel(x) {
  const on = x.tr.runs.filter((r) => r.regions.D1 === 'on' && r.t1 > r.t0)
  const last = on[on.length - 1]
  if (!last) return Math.min(...x.tr.samples.map((s) => s.sol.v.out))
  return x.tr.at((last.t0 + last.t1) / 2).sol.v.out
}

/**
 * The doubled output at its peak: v_out where the last complete gap between
 * humps begins, since the reservoir only ever falls across such a gap. Read on
 * the exact solution at the event time rather than off the drawn samples,
 * which need not land on the peak.
 */
function settledPeak(x) {
  const gap = lastGap(x)
  return gap ? x.tr.at(gap.t0).sol.v.out : Math.max(...x.tr.samples.map((s) => s.sol.v.out))
}

/** The last complete run with D2 blocking: the reservoir alone with the load. */
export function lastGap(x) {
  const off = x.tr.runs.filter((r) => r.regions.D2 === 'off' && r.t1 > r.t0 && r.t1 < x.tEnd)
  return off[off.length - 1] || null
}

/**
 * The rectifier headlines read the waveform rather than a formula: the mean of
 * the output over the whole window, and the peak-to-peak ripple over the last
 * cycle of it (the steady state, not the first charge-up). Each is an integral
 * or an extremum of the exact solution, so the number in the callout is the
 * number the plot draws.
 */
/** The average over the last whole cycle: the DC a rectifier makes, whatever the window happens to be. */
const cycleMean = (x, read, f) => meanRms(x.tr, read, Math.max(0, x.tEnd - 1 / f), x.tEnd).mean
/**
 * How far a smoothed output falls across the last complete gap between humps.
 * The gap is a run of the walk with the diode blocking, and across it the
 * capacitor sees only the load — so this is the ripple, read where the
 * waveform actually is rather than by scanning a window that might not hold a
 * whole discharge.
 */
function dischargeDrop(x) {
  const off = x.tr.runs.filter((r) => r.regions.D1 === 'off' && r.t1 > r.t0 && r.t1 < x.tEnd)
  const last = off[off.length - 1]
  if (!last) return 0
  return x.tr.at(last.t0).sol.v.out - x.tr.at(last.t1, 'left').sol.v.out
}

/**
 * The widest text a callout can carry: the tag, " = " and the widest value its
 * unit can print — "−1.23 mV" for a unit that takes a prefix (the stand-in the
 * frame is sized with), "−0.00123" for a bare ratio. The layout is placed and
 * checked with this text, so the live number always fits;
 * experiments.test.js holds every live text to this length.
 */
export const widestValue = (h) => (h.plain ? (h.unit === 'dB' ? '−123.4 dB' : '−0.00123') : `−1.23 m${h.unit}`)
export const calloutStandIn = (h) => `${h.tag} = ${widestValue(h)}`

/** A headline's number as the student reads it: 3 significant figures, its unit, noise and ∞ spelled out. */
export function headlineValue(h, x, p) {
  if (!x || !x.sol) return null
  const v = h.value(x, p)
  if (v === null || v === undefined || Number.isNaN(v)) return null
  if (!h.plain) return num(v, h.unit, 3)
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞'
  // Ratios: three figures with no prefix; dB to a tenth, the way a Bode plot is read.
  const text = h.unit === 'dB' ? v.toFixed(1).replace('-0.0', '0.0') : Number(v.toPrecision(3)).toString()
  return text.replace('-', '−') + (h.unit ? ` ${h.unit}` : '')
}

/** The callout as drawn on the schematic: "R_eq = 6.00 kΩ", or null when there is nothing to read. */
export function calloutText(h, x, p) {
  const v = headlineValue(h, x, p)
  return v === null ? null : `${h.tag} = ${v}`
}

/**
 * The bridge: one sentence tying the view to the lesson, so a pane never opens
 * cold. Each view type has a lead saying what the pane adds to the headline;
 * the experiment's own first sentence (from `see`) follows it.
 */
export const VIEW_LEADS = {
  reading: 'Every meter on the circuit at once, the one that matters first.',
  iv: 'Here is the diode’s own curve, the line the rest of the circuit imposes, and where they meet.',
  assumed: 'Here is every assumption about the diodes, and what each one said when it was solved.',
  equations: 'Here are the rows the solver wrote, and the matrix they make.',
  power: 'Here is where the power goes while it does.',
  thevenin: 'Here is the whole network folded into one source and one resistor.',
  equivalent: 'Here is that equivalent drawn out beside the original.',
  superposition: 'Here is the same answer built one source at a time.',
  sweep: 'Here is how it moves as the load sweeps.',
  scope: 'Here is how it got there, against time.',
  state: 'Here is the differential equation it obeys, as the engine built it.',
  energy: 'Here is the energy account behind it.',
  damping: 'Here is how the response changes as R sweeps through critical.',
  phasor: 'Here it is as a turning arrow.',
  impedance: 'Here is what the source sees across frequency.',
  bode: 'Here is the gain across frequency.',
  acpower: 'Here is the power split into real, reactive and apparent.',
}

/**
 * The first sentence of a lesson paragraph — up to the first full stop that
 * ends a sentence. A sentence too short to say anything on its own ("The
 * dual.") brings the next one with it.
 */
export function firstSentence(text) {
  const re = /[\s\S]*?[.!?](?=\s|$)/y
  let out = ''
  let m
  while (out.length < 20 && (m = re.exec(text || ''))) out += m[0]
  return (out || text || '').trim()
}

export function bridgeText(exp, view) {
  const lead = VIEW_LEADS[view]
  if (!lead) throw new Error(`no bridge lead for view ${view}`)
  return `${lead} ${firstSentence(exp.see)}`
}

const GREEK = { τ: '\\tau', ζ: '\\zeta', ω: '\\omega', α: '\\alpha', Ω: '\\Omega' }
const SUBS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3' }

/**
 * A tag as KaTeX: "v_out" → v_{out}, "ω₀" → \omega_{0}, "v_C(0⁺)" → v_{C}(0^{+}),
 * "|V_C|" → |V_{C}|, "1/α" → 1/\alpha. Letters after an underscore are one
 * subscript, set upright when they name an element or a node.
 */
export function tagLatex(tag) {
  return tag
    .replace(/[τζωαΩ]/g, (c) => GREEK[c] + ' ')
    .replace(/[₀₁₂₃]/g, (c) => `_{${SUBS[c]}}`)
    .replace(/⁺/g, '^{+}')
    .replace(/_([A-Za-z]+)(\d*)/g, (m, word, digits) => {
      const w = word.length > 1 ? `\\mathrm{${word}}` : word
      return digits ? `_{${w}_{${digits}}}` : `_{${w}}`
    })
    .replace(/\s+\}/g, '}')
    .trim()
}
