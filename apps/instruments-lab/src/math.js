// The math for the instrument on screen.
//
// Same discipline as the rest of the suite: the "theory" column is a closed
// form written by hand in terms of the knobs, and the "measured" column is read
// off the solved circuit. Those are different paths, one algebra and one a
// matrix solve, so a wrong sign or a dropped parallel term separates them at
// once. experiments.test.js runs every row here at the defaults and at
// twenty-five random settings and requires the tick.
//
// `analyse` is the one entry point every pane and every lesson reads. It solves
// the netlist, and then adds whatever the experiment asked for: the exact
// transient, the phasor solve at the drive, a frequency sweep, the sample dots,
// the detector's reading, the meter's arithmetic and the sensitivity rows.

import {
  NetworkError,
  complex as cx,
  drivingPointZ,
  extrema,
  crossings,
  meanRms,
  omegaOf,
  solveAC,
  solveDC,
  sweepAC,
  thevenin,
  transient,
} from '@ee-labs/network'
import { isDynamic } from './kit.js'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 1e-9, abs = 1e-12) => ({ label, predicted, measured, unit, tol, abs })
const val = (label, value, unit = '', note = '') => ({ label, value, unit, note })

export const par = (...rs) => 1 / rs.reduce((s, r) => s + 1 / r, 0)
const TWO_PI = 2 * Math.PI

// ------------------------------------------------------------ closed forms
/** Boltzmann's constant, for the two noise formulas of F4. Nothing else uses it. */
export const K_B = 1.380649e-23

/** The −3 dB frequency of one pole, in hertz. */
export const cornerOf = (r, c) => 1 / (TWO_PI * r * c)

/** The magnitude of a one-pole response at f, relative to its low-frequency value. */
export const onePole = (f, f0) => 1 / Math.hypot(1, f / f0)

/** The equivalent noise bandwidth of one pole, in hertz: ∫|H|² df over the whole axis. */
export const enbwOf = (r, c) => 1 / (4 * r * c)

/**
 * The alias of `f` sampled at `rate`: |f − m·f_s| for the nearest whole m, and
 * whether the fold turned the phase over (m·f_s above f rather than below).
 */
export function aliasOf(f, rate) {
  const m = Math.round(f / rate)
  const d = f - m * rate
  return { m, f: Math.abs(d), folded: d < 0 }
}

/**
 * What a meter of `counts` counts shows for `read` on a `fullScale` range, and
 * the accuracy its specification claims. All exact arithmetic over a reading
 * the solver produced. `pct` is per cent of reading, `terms` a number of counts.
 */
export function meterOf(read, { counts, fullScale, pct = 0, terms = 0 }) {
  const step = fullScale / (counts + 1)
  const shown = Math.round(read / step) * step
  const spec = (pct / 100) * Math.abs(shown) + terms * step
  return {
    step,
    shown,
    spec,
    halfCount: step / 2,
    pct: Math.abs(shown) > 0 ? (100 * spec) / Math.abs(shown) : Infinity,
    resPct: Math.abs(read) > 0 ? (100 * (step / 2)) / Math.abs(read) : Infinity,
  }
}

/**
 * The logarithmic sensitivity of a readout to each named knob, ∂ln y/∂ln x, by
 * a central difference on the solver at ±h. The lesson states the closed form
 * and this measures it, so the two are different paths to the same number.
 *
 * `parts` are the per-cent contributions each knob's tolerance makes. `quad` is
 * the quadrature sum, which assumes the errors are independent, and `worst` is
 * the sum of magnitudes, which assumes nothing.
 */
export function sensitivities(exp, p, read, knobs, h = 1e-6) {
  const y0 = read(p)
  const rows = knobs.map(({ key, tol }) => {
    const up = read({ ...p, [key]: p[key] * (1 + h) })
    const dn = read({ ...p, [key]: p[key] * (1 - h) })
    const s = (up - dn) / (2 * h * y0)
    return { key, s, tol, part: s * tol }
  })
  return {
    rows,
    quad: Math.hypot(...rows.map((r) => r.part)),
    worst: rows.reduce((sum, r) => sum + Math.abs(r.part), 0),
    y0,
  }
}

/** The 10 % to 90 % rise time of a step response, refined on the exact solution. */
export function riseTime(tr, pick, asymptote = null) {
  const y = Float64Array.from(tr.samples, (s) => pick(s.sol))
  const g = (t) => pick(tr.at(t).sol)
  const final = asymptote ?? pick(tr.at(tr.tEnd).sol)
  const lo = crossings(tr.t, y, g, 0.1 * final)[0]
  const hi = crossings(tr.t, y, g, 0.9 * final)[0]
  return { t10: lo, t90: hi, tr: hi - lo, final }
}

/**
 * The −3 dB frequency of a swept magnitude, found on the sweep and refined by
 * interpolating in log-log, which is exact for a single pole between two close
 * points and good to a part in 10⁵ on the grids this lab uses.
 */
export function cornerFrom(freq, ref = null) {
  const mag = freq.H.map(cx.cabs)
  const base = ref ?? mag[0]
  const target = base / Math.SQRT2
  for (let k = 1; k < mag.length; k++) {
    if (mag[k - 1] >= target && mag[k] < target) {
      const t = (Math.log(target) - Math.log(mag[k - 1])) / (Math.log(mag[k]) - Math.log(mag[k - 1]))
      return Math.exp(Math.log(freq.f[k - 1]) + t * (Math.log(freq.f[k]) - Math.log(freq.f[k - 1])))
    }
  }
  return NaN
}

/**
 * The peak of the analyser's filter and its two −3 dB points, by golden-section
 * search and then bisection on the solver itself. The drawn sweep is a few
 * hundred points across two decades, which is far coarser than a 100 Hz
 * resolution bandwidth at 10 kHz, so the grid is used for nothing but a
 * bracket. Every number returned is in hertz.
 */
export function peakBand(exp, p, lo, hi) {
  const mag = (f) => magAt(exp, p, f)
  // Golden-section on the log axis for the peak.
  const g = (Math.sqrt(5) - 1) / 2
  let a = Math.log(lo)
  let b = Math.log(hi)
  let c = b - g * (b - a)
  let d = a + g * (b - a)
  let fc = mag(Math.exp(c))
  let fd = mag(Math.exp(d))
  for (let k = 0; k < 200; k++) {
    if (fc > fd) {
      b = d
      d = c
      fd = fc
      c = b - g * (b - a)
      fc = mag(Math.exp(c))
    } else {
      a = c
      c = d
      fc = fd
      d = a + g * (b - a)
      fd = mag(Math.exp(d))
    }
    if (b - a < 1e-13) break
  }
  const f0 = Math.exp((a + b) / 2)
  const peak = mag(f0)
  const target = peak / Math.SQRT2
  const edge = (from, to) => {
    let x = Math.log(from)
    let y = Math.log(to)
    for (let k = 0; k < 200; k++) {
      const mid = (x + y) / 2
      if (mag(Math.exp(mid)) > target) x = mid
      else y = mid
      if (Math.abs(y - x) < 1e-14) break
    }
    return Math.exp((x + y) / 2)
  }
  const f1 = edge(f0, lo)
  const f2 = edge(f0, hi)
  return { peak, f0, f1, f2, bw: f2 - f1, geo: Math.sqrt(f1 * f2) }
}

/**
 * The envelope of a ringing waveform at time t, interpolated between the two
 * peaks that straddle it. The peaks themselves are refined on the exact
 * solution, so this is the waveform's own envelope and not the sample grid's.
 */
export function envelopeAt(peaks, t) {
  if (!peaks.length) return NaN
  if (t <= peaks[0].t) return peaks[0].y
  for (let k = 1; k < peaks.length; k++) {
    if (peaks[k].t >= t) {
      const a = peaks[k - 1]
      const b = peaks[k]
      return a.y + ((t - a.t) / (b.t - a.t)) * (b.y - a.y)
    }
  }
  return peaks[peaks.length - 1].y
}

// ------------------------------------------------------------ the analysis
const FREQ_MEMO = new Map()

/** The frequency sweep an experiment asked for, memoised on the knobs that shape it. */
function freqSweep(exp, p, net) {
  const spec = exp.sweep(p)
  const key = JSON.stringify([exp.id, exp.params.map((k) => p[k.key])])
  const hit = FREQ_MEMO.get(key)
  if (hit) return hit
  const points = spec.points ?? 401
  const sw = sweepAC(net, TWO_PI * spec.from, TWO_PI * spec.to, points, (ac, w) => spec.of(ac, w), { anyFreq: true })
  const out = {
    omega: sw.omega,
    f: Float64Array.from(sw.omega, (w) => w / TWO_PI),
    H: sw.value,
    Z: sw.value,
    mode: spec.mode || 'bode',
    // A narrow sweep is drawn against frequency itself: a log axis carries no
    // tick at all across 9.4 to 10.6 kHz, and the shape it draws is a needle.
    axis: spec.axis || 'log',
  }
  FREQ_MEMO.clear()
  FREQ_MEMO.set(key, out)
  return out
}

/**
 * The instrument at one setting: the netlist, the solve, and whatever else the
 * experiment declared. `cursor` is in seconds for a dynamic experiment; absent,
 * the experiment's own fraction of its window is used.
 */
export function analyse(exp, p, cursor) {
  const net = exp.net(p)
  const x = { net, exp, p, sol: null, refusal: null, tr: null, ac: null, freq: null, samples: null, snap: null, snapAt: null }
  const dyn = isDynamic(exp)
  const tEnd = dyn ? exp.window(p) : null
  if (dyn) {
    x.tEnd = tEnd
    x.cursor = Number.isFinite(cursor) ? Math.min(Math.max(cursor, 0), tEnd) : exp.cursor * tEnd
  }
  try {
    if (dyn) {
      x.tr = transient(net, { tEnd, points: exp.points ?? 601 })
      x.now = x.tr.at(x.cursor)
      x.sol = x.now.sol
    } else {
      x.sol = solveDC(net)
    }
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err
    x.refusal = err
    return x
  }
  // A sine drive has a steady state, and the steady state has a phasor solve:
  // the same stamps at s = jω. The two solvers never share a number, so their
  // agreement in the long-time limit is a real check of both.
  const sine = net.elements.find((e) => e.wave && e.wave.kind === 'sine')
  if (sine) {
    x.omega = omegaOf(sine.wave)
    try {
      x.ac = solveAC(net, x.omega)
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err
    }
  }
  // What the meters read on an experiment that has no time axis.
  //
  // `solveDC` evaluates a wave source at t = 0, and a sine is zero there. So
  // A3, A5, B2, D1, D2 and F4 opened with every meter on the schematic, every
  // node in the readout and every row of the reading table showing 0 V, beside
  // an amplitude knob set to 1 V. The circuit was not dead; it was being read
  // at the one instant in the cycle where nothing is happening.
  //
  // The steady state is exact here, so the meters read it at the instant the
  // drive is at its peak. Every quantity is a signed instantaneous value, as it
  // is for the experiments that do have a cursor, so the schematic's polarity
  // marks and current arrows keep their meaning.
  if (!dyn && x.ac && sine) {
    const w = x.omega
    const phase = sine.wave.phase || 0
    // ωt + φ = π/2, brought into the first cycle.
    const period = w > 0 ? TWO_PI / w : 0
    const raw = w > 0 ? (Math.PI / 2 - phase) / w : 0
    const at = period > 0 ? ((raw % period) + period) % period : 0
    const snap = x.ac.at(at)
    x.snap = { ...snap, pTotal: Object.values(snap.p).reduce((s, v) => s + v, 0) }
    x.snapAt = at
  }
  if (exp.sweep) {
    try {
      x.freq = freqSweep(exp, p, net)
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err
    }
  }
  // The sample dots: the exact solution read at t = k/f_s, never an
  // interpolation of the drawn trace (the plan's §2.2).
  if (exp.samples && x.tr) {
    const { rate, of, alias } = exp.samples(p)
    const read = of || ((sol) => sol.v.in)
    const t = []
    const y = []
    for (let k = 0; k / rate <= tEnd + 1e-15; k++) {
      t.push(k / rate)
      y.push(read(x.tr.at(k / rate).sol))
    }
    x.samples = { rate, t: Float64Array.from(t), y: Float64Array.from(y) }
    // The other tone the same dots belong to, when the experiment names one.
    // It is drawn as a guide across the scope, so "from the dots alone the two
    // cannot be told apart" is a thing the reader can check rather than read.
    if (alias && x.ac) x.samples.alias = alias(x.ac)
  }
  // What the instrument's detector reads: a mean for a lock-in, an rms for an
  // analyser, both over the last whole period the experiment names.
  if (exp.detect && x.tr) {
    const { of, over } = exp.detect(p)
    const a = Math.max(0, tEnd - over)
    x.detector = meanRms(x.tr, of, a, tEnd)
    x.detector.from = a
  }
  if (exp.port) {
    try {
      x.thevenin = thevenin({ elements: net.elements.filter((e) => e.id !== exp.portOff) }, exp.port[0], exp.port[1])
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err
    }
  }
  if (exp.meter) x.meter = exp.meter(x, p)
  if (exp.sens) x.sens = exp.sens(x, p)
  return x
}

/** The magnitude and angle at the drive frequency, for the marker on the frequency view. */
export function atDrive(exp, x) {
  if (!x.ac || !exp.sweep) return null
  const spec = exp.sweep(x.p)
  const z = spec.of(x.ac, x.omega)
  return { H: z, Z: z }
}

/**
 * The meters' readings with float noise read as zero: a sine sampled exactly at
 * its zero crossing comes back as a few femtovolts, and a meter that shows
 * "−3.67 fV" on a 5 V source is reporting the arithmetic, not the circuit.
 */
export function snapNoise(sol) {
  const snap = (obj) => {
    const scale = Math.max(0, ...Object.values(obj).map(Math.abs))
    const out = {}
    for (const [k, v] of Object.entries(obj)) out[k] = Math.abs(v) <= 1e-12 * scale ? 0 : v
    return out
  }
  return { v: snap(sol.v), i: snap(sol.i), volt: snap(sol.volt), p: snap(sol.p) }
}

/** Σ p for the meters, with the residual Tellegen leaves shown as the zero it is. */
export function netPower(sol) {
  const scale = Math.max(0, ...Object.values(sol.p).map(Math.abs))
  return Math.abs(sol.pTotal) <= 1e-9 * scale ? 0 : sol.pTotal
}

/** The reason the solver gave, as a sentence. */
export const refusalReason = (err) => (err ? err.message : '')

// ------------------------------------------------------------ the math panel
/**
 * The math entry for an experiment: a formula or two, then the check rows that
 * compare a closed form against the solve. Which block an experiment gets is
 * `exp.claim`, one key per block, so a group's circuit declares its own math.
 */
export function experimentMath(exp, p, x) {
  if (!x.sol) return { title: exp.name, blocks: [T(refusalReason(x.refusal))] }
  const blocks = []
  for (const [key, on] of Object.entries(exp.claim || {})) {
    if (!on) continue
    const build = CLAIMS[key]
    if (!build) throw new Error(`${exp.id}: unknown claim "${key}"`)
    blocks.push(...build(exp, p, x))
  }
  if (!blocks.length) blocks.push(T('This experiment reads the circuit directly, and has no closed form beside it.'))
  return { title: exp.name, blocks }
}

/** The magnitude of the frequency view's quantity at a given frequency, from its own solve. */
const magAt = (exp, p, f) => {
  const spec = exp.sweep(p)
  return cx.cabs(spec.of(solveAC(exp.net(p), TWO_PI * f, { anyFreq: true }), TWO_PI * f))
}

/**
 * The −3 dB frequency, by bisection on the solver itself rather than on the
 * drawn sweep. Fifty solves cost nothing and the answer is the circuit's, not
 * the grid's.
 */
/** The analyser's band, over the span its own sweep declares. */
export const bandOf = (exp, p) => {
  const spec = exp.sweep(p)
  return peakBand(exp, p, spec.from, spec.to)
}

export function cornerSolve(exp, p, lo = 1e-3, hi = 1e12) {
  const ref = magAt(exp, p, lo)
  const target = ref / Math.SQRT2
  for (let k = 0; k < 200; k++) {
    const mid = Math.sqrt(lo * hi)
    if (magAt(exp, p, mid) > target) lo = mid
    else hi = mid
    if (hi / lo < 1 + 1e-13) break
  }
  return Math.sqrt(lo * hi)
}

const CLAIMS = {
  // A1: the input impedance of R in parallel with C.
  inputz: (exp, p, x) => {
    const f = p.f
    const z = cx.cabs(x.ac.v.in) / p.I
    return [
      F('|Z_{in}| = \\left(\\tfrac{1}{R^2} + (\\omega C)^2\\right)^{-1/2}', 'a resistor and a capacitor in parallel, at the drive frequency'),
      C([
        row('|Z_in| at the drive', 1 / Math.hypot(1 / p.R2, TWO_PI * f * p.C2), z, 'Ω'),
        row('the corner, 1/(2πRC)', cornerOf(p.R2, p.C2), cornerSolve(exp, p), 'Hz', 1e-9),
      ]),
    ]
  },
  // A2, A5: the corner a source resistance and the input capacitance make.
  loaded: (exp, p, x) => {
    const rs = p.Rs
    const dcNet = { elements: exp.net(p).elements.map((e) => (e.wave ? { ...e, wave: undefined, value: 1 } : e)) }
    const dc = solveDC({ elements: dcNet.elements.filter((e) => e.type !== 'C') })
    // A compensated probe in front of the input is exactly one pole: the two
    // resistors in series, the two capacitors in series, and the same time
    // constant as either leg on its own. The experiment supplies C₁, because
    // it is the one that holds the compensation (groups/a.js).
    const c1 = exp.probeC1 ? exp.probeC1(p) : p.C1
    const rin = exp.probeIn ? p.R1 + p.R2 : p.R2
    const cin = exp.probeIn ? (c1 * p.C2) / (c1 + p.C2) : p.C2
    const div = exp.probeIn ? (p.R2 / (p.R1 + p.R2)) * (rin / (rs + rin)) : rin / (rs + rin)
    return [
      F('f_3 = \\frac{1}{2\\pi (R_s \\parallel R_{in}) C_{in}}', 'the source resistance and the instrument’s own capacitance, in parallel'),
      C([
        row('the ratio at DC', div, dc.v.in, '', 1e-9),
        row('the corner', cornerOf(par(rs, rin), cin), cornerSolve(exp, p), 'Hz', 1e-9),
      ]),
      V([val('the instrument shows', rin, 'Ω'), val('in parallel with', cin, 'F')]),
    ]
  },
  // A3: the divider, and the one setting at which it is flat.
  flat: (exp, p, x) => {
    const dc = p.R2 / (p.R1 + p.R2)
    const hf = p.C1 / (p.C1 + p.C2)
    // The exact magnitude of the divider at any C₁: Z₂/(Z₁+Z₂) with each leg a
    // resistor and a capacitor in parallel. The two agree at every frequency
    // only when R₁C₁ = R₂C₂, which is what the flatness row below measures.
    const hand = (f) => {
      const w = TWO_PI * f
      const leg = (r, c) => cx.cdiv(cx.C(r), cx.C(1, w * r * c))
      const z1 = leg(p.R1, p.C1)
      const z2 = leg(p.R2, p.C2)
      return cx.cabs(cx.cdiv(z2, cx.cadd(z1, z2)))
    }
    const decades = [1, 1e2, 1e4, 1e6, 1e8]
    const mags = decades.map((f) => magAt(exp, p, f))
    return [
      F('\\frac{V_{in}}{V_{tip}} = \\frac{R_2 \\parallel 1/sC_2}{R_1 \\parallel 1/sC_1 + R_2 \\parallel 1/sC_2}', 'flat at every frequency when R₁C₁ = R₂C₂'),
      C([
        row('the ratio at DC, R₂/(R₁+R₂)', dc, magAt(exp, p, 1e-6), '', 1e-9),
        row('the ratio at high frequency, C₁/(C₁+C₂)', hf, magAt(exp, p, 1e12), '', 1e-9),
        ...decades.map((f, k) => row(`|H| at ${f >= 1e6 ? `${f / 1e6} MHz` : f >= 1e3 ? `${f / 1e3} kHz` : `${f} Hz`}`, hand(f), mags[k], '', 1e-9)),
      ]),
      V([
        val('the probe’s time constant, R₁C₁', p.R1 * p.C1, 's'),
        val('the scope’s time constant, R₂C₂', p.R2 * p.C2, 's'),
        val('the flattest and the least flat of the five', Math.min(...mags), '', `the largest is ${Math.max(...mags).toPrecision(6)}`),
        val('C₁ that would make them equal, R₂C₂/R₁', (p.R2 * p.C2) / p.R1, 'F'),
      ]),
    ]
  },
  // A4: the step of a mis-compensated probe, both ends and the time between.
  compensation: (exp, p, x) => {
    const amp = p.A
    // Two time constants, far apart. The calibrator's own resistance charges
    // the capacitive divider in Rcal(C₁+C₂), and the probe's resistors then
    // take (R₁∥R₂)(C₁+C₂) to reach the settled value. The edge is read twenty
    // of the fast ones in, where the fast mode is 2 × 10⁻⁹ of the step and the
    // slow one is still where the closed form says it is.
    const edge = (amp * p.C1) / (p.C1 + p.C2)
    const settled = (amp * p.R2) / (p.Rcal + p.R1 + p.R2)
    const tau = par(p.R1, p.R2) * (p.C1 + p.C2)
    const tFast = 20 * p.Rcal * (p.C1 + p.C2)
    // Both of the last two rows are read inside one half period of the
    // calibrator, at 0.45 of its period, and what is left of the transient
    // there is exp(−t/τ) of the step. They are honest only while that is well
    // under their own tolerance, which wants the reading sixteen time
    // constants in; at the defaults it is thirty. A calibrator too fast for
    // the probe in front of it never shows a settled value, and the panel says
    // so rather than checking a number the waveform does not contain.
    const tRead = 0.45 / p.fc
    const settles = tRead > 16.2 * tau
    return [
      F('v(0^+) = \\frac{C_1}{C_1 + C_2}\\,v_{tip}, \\qquad v(\\infty) = \\frac{R_2}{R_1 + R_2}\\,v_{tip}', 'the capacitors share the edge, the resistors share the settled value'),
      C([
        // The guard: the fast mode is 2 x 10^-9 of the step twenty of its own
        // time constants in, and what is left is the slow mode moving by the
        // ratio of the two, R_cal over R1 in parallel with R2. That ratio is
        // the small parameter of the approximation, and a sweep of the whole
        // knob range puts the actual error at up to 1.7 times it, so the
        // guard carries a margin of three.
        row('just after the edge', settled + (edge - settled) * Math.exp(-tFast / tau), x.tr.at(tFast).sol.v.in, 'V', Math.max(1e-6, (3 * p.Rcal) / par(p.R1, p.R2))),
        ...(settles
          ? [
              row('settled', settled, x.tr.at(tRead).sol.v.in, 'V', 1e-6),
              // The step is the calibrator's, so both readings live inside one
              // half period of it and the search for the time constant is
              // bounded there. Past that the square wave turns over, and a
              // search that ran on would find the next edge and call it a time
              // constant.
              row('the time constant between them, (R₁∥R₂)(C₁+C₂)', tau, tauFromStep(x, settled, edge, tRead), 's', 5e-3),
            ]
          : []),
      ]),
      V([
        val('the value the edge lands at', edge, 'V'),
        val('the overshoot', 100 * (edge / settled - 1), '%'),
        ...(settles ? [] : [val('the calibrator’s half period', 0.5 / p.fc, 's', `too few of the probe’s ${tau.toPrecision(3)} s time constants to settle in, so the settled value is not read`)]),
      ]),
    ]
  },
  // A6: rise time and bandwidth are one number.
  risetime: (exp, p, x) => {
    const tau = par(p.Rs, p.R2) * p.C2
    // The asymptote is the divider's, not the last sample's: a window of a
    // dozen time constants is still six parts in a million short of it.
    const rt = riseTime(x.tr, (sol) => sol.v.in, (p.A * p.R2) / (p.Rs + p.R2))
    const f3 = cornerOf(par(p.Rs, p.R2), p.C2)
    return [
      F('t_r = \\tau \\ln 9, \\qquad t_r \\cdot f_3 = \\frac{\\ln 9}{2\\pi} = 0.3497', 'the same number written twice, for one pole'),
      C([
        row('the rise time, 10 % to 90 %', Math.log(9) * tau, rt.tr, 's', 1e-6),
        row('rise time times bandwidth', Math.log(9) / TWO_PI, rt.tr * f3, '', 1e-6),
      ]),
      V([val('the bandwidth', f3, 'Hz'), val('the time constant', tau, 's')]),
    ]
  },
  // B1: the alias identity.
  alias: (exp, p, x) => {
    const a = aliasOf(p.f, p.fs)
    const A = cx.cabs(x.ac.v.in)
    const th = cx.carg(x.ac.v.in)
    // A fold turns the sine over and its phase with it, because
    // sin(2πkm − x) = −sin(x). Above the fold the two are the same sequence.
    const sign = a.folded ? -1 : 1
    // The source is switched on at t = 0, so the front end's own natural
    // response rides on the first few samples. The identity below is claimed
    // to a part in 10¹², and e⁻³⁰ is 9 × 10⁻¹⁴ of the step, so thirty time
    // constants in there is nothing left of the switch-on but the tone.
    const settled = 30 * par(p.Rs, p.R2) * p.C2
    let worst = 0
    let counted = 0
    for (let k = 0; k < x.samples.t.length; k++) {
      const t = x.samples.t[k]
      if (t < settled) continue
      counted++
      worst = Math.max(worst, Math.abs(x.samples.y[k] - sign * A * Math.sin(TWO_PI * a.f * t + sign * th)))
    }
    return [
      F('A\\sin(2\\pi f\\,k/f_s + \\theta) = \\pm A\\sin(2\\pi (f - m f_s)\\,k/f_s \\pm \\theta)', 'because 2πmk is a whole number of turns'),
      C([
        row('the alias frequency', a.f, Math.abs(p.f - a.m * p.fs), 'Hz', 1e-12),
        // A window too short, or a sample rate too slow, can leave no sample
        // at all after the switch-on has died. Then there is no sequence to
        // compare and the row says so by not being there.
        // The identity is exact algebra, and at the defaults the two sequences
        // agree to a part in 10¹⁴. What this row compares is the solver's
        // sampled output against it, so it also carries the transient's own
        // floor: a sweep of every knob's range puts that at 6 × 10⁻¹² of the
        // tone by a few hundred cycles in, and the row is judged at 10⁻¹⁰.
        ...(counted >= 4 ? [row('worst gap between the two sampled sequences', 0, worst, 'V', 1, 1e-10 * (A || 1))] : []),
      ]),
      V([
        val('the tone at the input', A, 'V'),
        val('samples compared', counted, '', a.folded ? 'the fold turns the phase over' : 'below the fold, its own representative'),
        ...(counted >= 4 ? [] : [val('the window, in the front end’s own time constants', tEndOf(x) / par(p.Rs, p.R2) / p.C2, '', 'too few samples clear of the switch-on to compare the two sequences')]),
      ]),
    ]
  },
  // B2: one pole as an anti-alias filter.
  antialias: (exp, p, x) => {
    const f0 = cornerOf(p.Rb, p.Cb)
    const need = Math.sqrt(10 ** (p.reject / 10) - 1)
    return [
      F('|H| = \\frac{1}{\\sqrt{1 + (f/f_0)^2}}', 'one pole, so 20 dB a decade and no more'),
      C([
        row('|H| at the signal', onePole(p.f, f0), magAt(exp, p, p.f), '', 1e-6),
        row('|H| at the interferer', onePole(p.fi, f0), magAt(exp, p, p.fi), '', 1e-6),
        row('the corner', f0, cornerSolve(exp, p), 'Hz', 1e-9),
      ]),
      V([
        val('the interferer aliases to', aliasOf(p.fi, p.fs).f, 'Hz'),
        val(`the frequency ${p.reject} dB down`, need * f0, 'Hz'),
        val('which is a multiple of the corner of', need, '×'),
      ]),
    ]
  },
  // C1: a voltmeter loads what it measures.
  voltmeter: (exp, p, x) => {
    const truth = solveDC({ elements: exp.net(p).elements.filter((e) => e.id !== 'Rm') })
    const rth = x.thevenin ? x.thevenin.rth.test : par(p.R1, p.R2)
    return [
      F('\\frac{v_{read}}{v_{true}} = \\frac{R_m}{R_m + R_{th}}', 'the meter and the source resistance are a divider'),
      C([
        row('the true value', p.E * (p.R2 / (p.R1 + p.R2)), truth.v.out, 'V'),
        row('the reading', truth.v.out * (p.Rm / (p.Rm + rth)), x.sol.v.out, 'V', 1e-9),
        row('R_th the meter sees', par(p.R1, p.R2), rth, 'Ω', 1e-6),
      ]),
      V([val('the error', (100 * (x.sol.v.out - truth.v.out)) / truth.v.out, '%')]),
    ]
  },
  // C2: the range divider, and what the buffer is for.
  ranges: (exp, p, x) => {
    const { Rtop, Rbot } = exp.tap(p)
    const ratio = Rbot / (Rtop + Rbot)
    const unbuffered = par(Rbot, p.Radc) / (Rtop + par(Rbot, p.Radc))
    return [
      F('\\frac{v_{tap}}{v_{in}} = \\frac{R_{bot}}{R_{top} + R_{bot}}', 'with the buffer in, the converter draws no current from the tap'),
      C([
        row('the tap', p.E * (p.buffer ? ratio : unbuffered), x.sol.v.tap, 'V', 1e-9),
        row('the input resistance', p.buffer ? Rtop + Rbot : Rtop + par(Rbot, p.Radc), p.E / -x.sol.i.V1, 'Ω', 1e-9),
      ]),
      V([
        val('the divider’s ratio', ratio, ''),
        val('the ratio the converter would see unbuffered', unbuffered, ''),
        val('the error the buffer removes', (100 * (unbuffered - ratio)) / ratio, '%'),
      ]),
    ]
  },
  // C3: the shunt, and the burden voltage it costs.
  ammeter: (exp, p, x) => {
    const truth = p.E / p.RL
    return [
      F('i_{read} = \\frac{E}{R_L + R_{sh}}, \\qquad v_{burden} = i_{read}\\,R_{sh}', 'the shunt is in the circuit, so the circuit knows about it'),
      C([
        row('the true current', truth, p.E / p.RL, 'A'),
        row('the reading', p.E / (p.RL + p.Rsh), x.sol.i.RL, 'A', 1e-9),
        row('the burden voltage', (p.E / (p.RL + p.Rsh)) * p.Rsh, x.sol.v.sh, 'V', 1e-9),
      ]),
      V([
        val('the error', (100 * (x.sol.i.RL - truth)) / truth, '%'),
        val('the shunt for the range', p.vfs / p.ifs, 'Ω'),
        val('and its dissipation at full scale', p.vfs * p.ifs, 'W'),
      ]),
    ]
  },
  // C4, C5: two wires and four.
  ohmmeter: (exp, p, x) => {
    const four = !!exp.fourWire
    const readV = four ? x.sol.v.s1 - x.sol.v.s2 : x.sol.v.f1
    const read = readV / p.Itest
    // Two wires: the leads are in series with the resistor, and the meter is
    // across the three of them. Four: the meter is across the resistor alone,
    // through the sense leads, and only its own finite resistance matters.
    const predicted = four ? (p.Rx * p.Rm) / (p.Rx + 2 * p.Rlead + p.Rm) : par(p.Rx + 2 * p.Rlead, p.Rm)
    return [
      four
        ? F('R_{read} = \\frac{R_x R_m}{R_x + R_{s1} + R_m + R_{s2}}', 'the sense pair is a divider with the resistor, and the meter is most of it')
        : F('R_{read} = R_x + 2 R_{lead}', 'the forcing current runs through the leads and the resistor alike'),
      C([
        row('the reading', predicted, read, 'Ω', 1e-9),
        ...(four ? [row('the current down a sense lead', readV / p.Rm, x.sol.i.Rs1, 'A', 1e-6)] : []),
      ]),
      V([val('the leads add', 2 * p.Rlead, 'Ω'), val('the error', (100 * (read - p.Rx)) / p.Rx, '%')]),
    ]
  },
  // D1: the resolution bandwidth is the filter's bandwidth.
  rbw: (exp, p, x) => {
    const f0 = 1 / (TWO_PI * Math.sqrt(p.L * p.C))
    const q = (TWO_PI * f0 * p.L) / p.R
    const band = bandOf(exp, p)
    const half = Math.sqrt(1 + 1 / (4 * q * q))
    return [
      F('f_0 = \\frac{1}{2\\pi\\sqrt{LC}}, \\quad Q = \\frac{\\omega_0 L}{R}, \\quad \\Delta f = \\frac{f_0}{Q}', 'a series RLC read across R is a band-pass whose width is R/L'),
      C([
        row('the centre', f0, band.f0, 'Hz', 1e-4),
        row('the lower −3 dB point', f0 * (half - 1 / (2 * q)), band.f1, 'Hz', 1e-4),
        row('the upper −3 dB point', f0 * (half + 1 / (2 * q)), band.f2, 'Hz', 1e-4),
        row('the width', f0 / q, band.bw, 'Hz', 1e-3),
        row('√(f₁f₂), which is f₀ and not their average', f0, band.geo, 'Hz', 1e-4),
      ]),
      V([val('Q', q, ''), val('their arithmetic mean, for comparison', (band.f1 + band.f2) / 2, 'Hz')]),
    ]
  },
  // D2: a tone draws the filter.
  shape: (exp, p, x) => {
    const f0 = 1 / (TWO_PI * Math.sqrt(p.L * p.C))
    const q = (TWO_PI * f0 * p.L) / p.R
    const rlc = (f) => 1 / Math.hypot(1, q * (f / f0 - f0 / f))
    return [
      F('|H(f)| = \\left[1 + Q^2\\left(\\frac{f}{f_0} - \\frac{f_0}{f}\\right)^2\\right]^{-1/2}', 'the band-pass magnitude, exactly'),
      C([
        row('at the tone', rlc(p.f), cx.cabs(x.ac.v.out) / p.A, '', 1e-9),
        // `magAt` reads the sweep's own quantity, which is already the ratio to
        // the drive; dividing by the amplitude again would measure 1/A².
        ...[50, 200, 1000].map((d) => row(`${d} Hz above the centre`, rlc(f0 + d), magAt(exp, { ...p, f: f0 + d }, f0 + d), '', 1e-6)),
      ]),
      V([val('the resolution bandwidth', f0 / q, 'Hz'), val('the tone is off centre by', p.f - f0, 'Hz')]),
    ]
  },
  // D3: two tones, and the detector's rms.
  twotone: (exp, p, x) => {
    // One phasor solve per tone. Without `anyFreq` a sine source is its own
    // phasor at its own frequency and zero at every other, so each solve is
    // the response to one tone alone. That is superposition, and it is exact.
    const net = exp.net(p)
    const a = cx.cabs(solveAC(net, TWO_PI * p.fa).v.out)
    const b = cx.cabs(solveAC(net, TWO_PI * p.fb).v.out)
    const f0 = 1 / (TWO_PI * Math.sqrt(p.L * p.C))
    const q = (TWO_PI * f0 * p.L) / p.R
    return [
      F('v_{rms} = \\sqrt{\\tfrac{1}{2}\\left(a_1^2 + a_2^2\\right)}', 'over a whole number of beat periods the cross term averages to zero'),
      C([row('the detector’s reading', Math.sqrt((a * a + b * b) / 2), x.detector.rms, 'V', 1e-6)]),
      V([
        val('the lower tone through the filter', a, 'V'),
        val('the upper tone through the filter', b, 'V'),
        val('the resolution bandwidth', f0 / q, 'Hz'),
        val('the tones are apart by', Math.abs(p.fb - p.fa), 'Hz'),
      ]),
    ]
  },
  // D4: the filter needs time.
  settling: (exp, p, x) => {
    const tau = (2 * p.L) / p.R
    const f0 = 1 / (TWO_PI * Math.sqrt(p.L * p.C))
    const q = (TWO_PI * f0 * p.L) / p.R
    const rbw = f0 / q
    const peaks = envelope(x.tr, (sol) => sol.v.out)
    const settled = cx.cabs(x.ac.v.out)
    // The decay rate is the state matrix's own: the trace of A is −R/L for a
    // series RLC, whatever the netlist looks like from outside.
    const A = x.tr.dyn.A
    const alpha = -(A[0][0] + A[1][1]) / 2
    const t90 = 0.9 * settled
    // Where the envelope, interpolated between its own peaks, crosses 90 %.
    let cross = NaN
    for (let k = 1; k < peaks.length; k++) {
      if (peaks[k - 1].y < t90 && peaks[k].y >= t90) {
        const g = (t90 - peaks[k - 1].y) / (peaks[k].y - peaks[k - 1].y)
        cross = peaks[k - 1].t + g * (peaks[k].t - peaks[k - 1].t)
        break
      }
    }
    return [
      F('\\tau = \\frac{2L}{R} = \\frac{1}{\\pi\\,\\Delta f}', 'the envelope of a band-pass rises with twice the energy time constant'),
      C([
        row('the decay rate the state matrix carries, R/2L', 1 / tau, alpha, '1/s', 1e-9),
        // The envelope of a band-pass driven at its own centre is the settled
        // amplitude times 1 − e^(−t/τ), so the last peak is checked where it
        // stands rather than against a value a short window never reaches.
        // The departure from that shape is first order in 1/Q, which is the
        // threshold, the same one the 90 % row carries.
        row('the envelope at the last peak, (1 − e^(−t/τ)) of the settled value', settled * (1 - Math.exp(-(peaks.length ? peaks[peaks.length - 1].t : NaN) / tau)), peaks.length ? peaks[peaks.length - 1].y : NaN, 'V', 3 / q),
        // The envelope reaches 90 % at τ·ln 10 for a first-order rise. The
        // ringing one here departs from that by about 1/Q, which is the
        // threshold the row is judged against and the number the note states.
        row('the envelope’s 90 % point, τ ln 10', tau * Math.log(10), cross, 's', 3 / q),
      ]),
      V([
        val('the time constant', tau, 's', `1/(π·Δf) is ${(1 / (Math.PI * rbw)).toPrecision(6)} s`),
        val('the resolution bandwidth', rbw, 'Hz'),
        val('the sweep a span of this size needs', (p.span / rbw) * tau, 's', `at one time constant per resolution bandwidth of the ${p.span} Hz span`),
      ]),
    ]
  },
  // E1, E2, E3: the mixer, the filter and the phase.
  lockin: (exp, p, x) => {
    const M = (p.A * p.Vr) / (2 * p.Vu)
    const phi = (p.phi * Math.PI) / 180
    const gain = p.gm * p.Rf
    const ripple = M * gain * onePole(p.fs + p.fr, cornerOf(p.Rf, p.Cf))
    let worst = 0
    for (let k = 0; k < 400; k++) {
      const t = (k / 400) * (4 / p.fr)
      const prod = (p.A * Math.sin(TWO_PI * p.fs * t + phi) * p.Vr * Math.sin(TWO_PI * p.fr * t)) / p.Vu
      const sum = M * Math.cos(TWO_PI * (p.fs - p.fr) * t + phi) - M * Math.cos(TWO_PI * (p.fs + p.fr) * t + phi)
      worst = Math.max(worst, Math.abs(prod - sum))
    }
    const rows = [row('the product against its two-term sum', 0, worst, 'V', 1, 1e-14)]
    // On tune the difference term is a step through one pole, so the mean the
    // detector reports over [a, b] is M·G·cos φ times the mean of 1 − e^(−t/τ)
    // over that span, exactly. The row states that mean rather than the
    // asymptote, and is left off entirely when the span starts so early that
    // the sum term's own switch-on has not gone either.
    if (p.fs === p.fr && x.detector) {
      const tau = p.Rf * p.Cf
      const a = x.detector.from
      const b = x.tEnd
      const rise = 1 - (tau / (b - a)) * (Math.exp(-a / tau) - Math.exp(-b / tau))
      if (a >= 6 * tau) rows.push(row('the detector’s mean, M cos φ over the filter’s rise', M * gain * Math.cos(phi) * rise, x.detector.mean, 'V', 2e-3))
    }
    return [
      F('A\\sin(\\omega_s t + \\varphi)\\,V_r\\sin(\\omega_r t)/V_u = M[\\cos((\\omega_s-\\omega_r)t+\\varphi) - \\cos((\\omega_s+\\omega_r)t+\\varphi)]', 'M = A·V_r/2V_u, and the identity is exact'),
      C(rows),
      V([
        val('M', M, 'V'),
        val('the filter’s time constant', p.Rf * p.Cf, 's'),
        val('its −3 dB frequency', cornerOf(p.Rf, p.Cf), 'Hz'),
        val('its equivalent noise bandwidth, 1/(4RC)', enbwOf(p.Rf, p.Cf), 'Hz'),
        val('the ripple at the sum frequency', ripple, 'V'),
      ]),
    ]
  },
  // E4: off frequency.
  detune: (exp, p, x) => {
    const M = (p.A * p.Vr) / (2 * p.Vu)
    const gain = p.gm * p.Rf
    const df = Math.abs(p.fs - p.fr)
    const f3 = cornerOf(p.Rf, p.Cf)
    const swing = M * gain * onePole(df, f3)
    const acD = df > 0 ? cx.cabs(solveAC(exp.net(p), TWO_PI * df).v.out) : NaN
    return [
      F('|H(\\Delta f)| = \\frac{1}{\\sqrt{1 + (\\Delta f/f_3)^2}}', 'the difference term is a signal like any other, and the filter treats it as one'),
      C([row('the swing at the difference frequency', swing, acD, 'V', 1e-6)]),
      V([
        val('the difference frequency', df, 'Hz'),
        val('its beat period', df > 0 ? 1 / df : Infinity, 's'),
        val('the sum term that rides on it', M * gain * onePole(p.fs + p.fr, f3), 'V'),
        val('the detection band, ± the equivalent noise bandwidth', enbwOf(p.Rf, p.Cf), 'Hz'),
      ]),
    ]
  },
  // F1: resolution, the count the display steps in.
  resolution: (exp, p, x) => {
    const m = x.meter
    return [
      F('\\text{count} = \\frac{F}{N+1}', 'a range of F volts over N counts, plus the zero'),
      C([
        row('the count', p.range / (p.counts + 1), m.step, 'V'),
        row('what the display shows', Math.round(m.read / m.step) * m.step, m.shown, 'V'),
      ]),
      V([
        val('the true value behind the reading', m.true, 'V'),
        val('half a count', m.halfCount, 'V', `${m.resPct.toPrecision(3)} % of the reading`),
        val('the loading error, for comparison', m.errorPct, '%'),
      ]),
    ]
  },
  // F2: accuracy, the maker's two terms around it.
  accuracy: (exp, p, x) => {
    const m = x.meter
    return [
      F('\\text{spec} = \\frac{a}{100}\\,|v| + b\\,\\text{count}', 'a per cent of the reading, plus a number of counts'),
      C([
        row('the per-cent term', (p.pct / 100) * Math.abs(m.shown), m.spec - p.terms * m.step, 'V'),
        row('the whole specification', (p.pct / 100) * Math.abs(m.shown) + p.terms * m.step, m.spec, 'V'),
      ]),
      V([
        val('the counts term', p.terms * m.step, 'V'),
        val('the specification, as a fraction of the reading', m.pct, '%'),
        val('the loading error', m.errorPct, '%'),
        val('which is larger than the specification by', Math.abs(m.error / m.spec), '×'),
      ]),
    ]
  },
  // F3: sensitivities through a divider.
  propagate: (exp, p, x) => {
    const s = x.sens
    const dc = p.R1 / (p.R1 + p.R2)
    return [
      F('S_x = \\frac{\\partial \\ln y}{\\partial \\ln x}, \\qquad \\sigma_{quad} = \\sqrt{\\textstyle\\sum (S_i t_i)^2}', 'a per cent in gives a per cent out, to first order'),
      C([
        row('the sensitivity to R₁, −R₁/(R₁+R₂)', -dc, s.rows[0].s, '', 1e-5),
        row('the sensitivity to R₂, +R₁/(R₁+R₂)', dc, s.rows[1].s, '', 1e-5),
      ]),
      V([
        val('each contributes', Math.abs(s.rows[0].part), '%'),
        val('in quadrature, if they are independent', s.quad, '%'),
        val('worst case, if they are not', s.worst, '%'),
        val('both moved the same way', 100 * (exp.readOut({ ...p, R1: p.R1 * (1 + p.tol / 100), R2: p.R2 * (1 + p.tol / 100) }) / s.y0 - 1), '%'),
      ]),
    ]
  },
  // F4: the noise floor, stated.
  noise: (exp, p, x) => {
    const density = Math.sqrt(4 * K_B * p.T * p.R2)
    const bw = enbwOf(p.R2, p.C2)
    return [
      F('e_n = \\sqrt{4kTR}, \\qquad v_{rms} = e_n\\sqrt{\\tfrac{1}{4RC}} = \\sqrt{kT/C}', 'the resistance cancels, so only the capacitance sets the floor'),
      C([row('the two multiplied against √(kT/C)', Math.sqrt((K_B * p.T) / p.C2), density * Math.sqrt(bw), 'V', 1e-9)]),
      V([
        val('the thermal density', density, 'V/√Hz'),
        val('the noise bandwidth the capacitance sets', bw, 'Hz'),
        val('the rms across the capacitor', Math.sqrt((K_B * p.T) / p.C2), 'V'),
        val('six of those, peak to peak', 6 * Math.sqrt((K_B * p.T) / p.C2), 'V'),
        val('the meter’s count, for comparison', p.range / (p.counts + 1), 'V'),
      ]),
    ]
  },
}

/**
 * The time constant of a mis-compensated probe's step, read off the exact
 * solution: the instant the gap to the settled value has fallen by a factor e.
 * `until` bounds the search, and it has to: the drive is a square wave, so the
 * response is monotone only until the calibrator turns over.
 */
function tauFromStep(x, settled, edge, until = null) {
  if (Math.abs(edge - settled) < 1e-12 * Math.abs(settled)) return NaN
  const target = settled + (edge - settled) / Math.E
  const f = (t) => x.tr.at(t).sol.v.in
  let lo = 0
  let hi = Math.min(until ?? Infinity, x.tEnd / 2)
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    const above = (f(mid) - target) * Math.sign(edge - settled) > 0
    if (above) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** How long a dynamic experiment's window is, for a note that needs to say so. */
const tEndOf = (x) => x.tEnd

/** The maxima of a quantity along a transient, which is its envelope. */
export function envelope(tr, pick) {
  const y = Float64Array.from(tr.samples, (s) => pick(s.sol))
  return extrema(tr.t, y, (t) => pick(tr.at(t).sol)).filter((e) => e.kind === 'max')
}
