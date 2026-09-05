// Group N: oscillators.
//
// Every circuit before this one settles. An oscillator is the case where it
// does not, and the reason is always the same: the loop's poles have crossed
// the jω axis. So the group opens on the poles (N1), then asks what stops the
// growth once they have crossed (N2), then builds the two oscillators that do
// not use a resonant network at all (N3) and the one that does (N4).
//
// The Wien bridge is the plan's: R = 10 kΩ, C = 10 nF, so f₀ = 1/(2πRC) =
// 1591.5 Hz. Its characteristic polynomial is
//
//     s² + [(3 − G) + G²/A₀]/(RC) · s + 1/(RC)²
//
// with G = 1 + R_f/R_g the closed-loop gain and A₀ the op-amp's own gain. The
// G²/A₀ term is what a textbook drops, and it is why the threshold sits a
// little above three rather than at three. Both halves are checked in the math
// panel against the polynomials the solver builds.
//
// N2, N3 and N4 are solved in time by `pwlTransient`, so every rail crossing
// and every current limit is an event at an exact instant and the period is a
// number rather than an estimate. Each of the three starts from a charged
// capacitor (`x0`), because a circuit sitting exactly at its own unstable
// equilibrium stays there, and a real one never does.

import { charPoly, complex as cx, crossings, dynamics, normalize, polesOf, solveAC } from '@ee-labs/network'
import { Amp, Cap, Gain, Is, R, chips, gnd, node, wire } from '../knobs.js'

const GROUP = 'N · Oscillators'

/** An inductance knob. Group N is the first place in this lab that needs one. */
const Ind = (key, label, def, hint) => ({ key, label, unit: 'H', min: 1e-6, max: 1, scale: 'log', default: def, hint })

/** A supply rail. It is a magnitude, so unlike a source it cannot go negative. */
const Rail = (key, label, def, hint) => ({ key, label, unit: 'V', min: 1, max: 24, scale: 'linear', default: def, hint })

/** A transconductance knob, siemens. */
const Gs = (key, label, def, hint) => ({ key, label, unit: 'S', min: 1e-9, max: 1, scale: 'log', default: def, hint })

// ------------------------------------------------------------ the circuits

/** The gain the two feedback resistors set. */
export const gainOf = (p) => 1 + p.Rf / p.Rg

/** The Wien network's own frequency, 1/(2πRC). */
export const wienF0 = (p) => 1 / (2 * Math.PI * p.Rw * p.Cw)

/**
 * The Wien bridge oscillator. `probe` adds the test current source N1 injects
 * at the + input, so that the loop has an input and `transferOf` has
 * polynomials to return. N2 drops it and starts from a charged capacitor
 * instead, because a probe that keeps injecting would hide the growth.
 */
const wienNet = (p, probe) => ({
  elements: [
    ...(probe ? [{ type: 'I', id: 'Ik', nodes: ['gnd', 'p'], value: p.ik, small: true }] : []),
    { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['p', 'n'], gain: p.A0, vsat: p.vsat },
    { type: 'R', id: 'Rs', nodes: ['out', 'w'], value: p.Rw },
    { type: 'C', id: 'Cs', nodes: ['w', 'p'], value: p.Cw },
    { type: 'R', id: 'Rp', nodes: ['p', 'gnd'], value: p.Rw },
    { type: 'C', id: 'Cp', nodes: ['p', 'gnd'], value: p.Cw, ...(probe ? {} : { x0: p.kick }) },
    { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: p.Rf },
    { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: p.Rg },
  ],
})

/** Elements E9's Schmitt trigger with an RC hung on its inverting input. */
const relaxNet = (p) => ({
  elements: [
    { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['p', 'n'], vsat: p.vsat },
    { type: 'R', id: 'R1', nodes: ['p', 'gnd'], value: p.R1 },
    { type: 'R', id: 'R2', nodes: ['out', 'p'], value: p.R2 },
    { type: 'R', id: 'Rt', nodes: ['out', 'n'], value: p.Rt },
    { type: 'C', id: 'Ct', nodes: ['n', 'gnd'], value: p.Ct, x0: p.kick },
  ],
})

/**
 * The Colpitts tank with a transconductor across it.
 *
 * The transistor of the plan's N4 is here as what the small-signal netlist
 * makes of it, a transconductance `g_m` with a current limit. That limit is
 * piecewise-linear, so the amplitude is solved exactly, which the exponential
 * device in time is not (§2.8 of the plan declines it).
 */
const colpittsNet = (p) => ({
  elements: [
    { type: 'VCCS', id: 'Gm', nodes: ['gnd', 't'], ctrl: ['p', 'gnd'], gain: p.g, ilimit: p.ilim },
    { type: 'L', id: 'L1', nodes: ['t', 'gnd'], value: p.L },
    { type: 'C', id: 'C1', nodes: ['t', 'p'], value: p.C1 },
    { type: 'C', id: 'C2', nodes: ['p', 'gnd'], value: p.C2, x0: p.kick },
    { type: 'R', id: 'Rb', nodes: ['p', 'gnd'], value: p.Rb },
  ],
})

/**
 * What the Wien network alone sends back to the + input, per volt at the
 * output, as [re, im].
 *
 * Barkhausen's condition is a statement about the loop, so the loop has to be
 * broken to measure it. `returnRatio` breaks a loop at a controlled source and
 * declines an `OPAMP` by type, so the break is made here instead: the two arms
 * are driven by a one-volt source where the amplifier's output sits, and what
 * arrives at the + input is read. The op-amp's own input draws no current in
 * this circuit, so the network loaded by it is the network alone. An input
 * resistance on `U1` would change that, and the row below would have to move
 * on to the return ratio.
 */
export function wienBeta(p, hz) {
  const net = {
    elements: [
      { type: 'V', id: 'Vd', nodes: ['out', 'gnd'], value: 1 },
      { type: 'R', id: 'Rs', nodes: ['out', 'w'], value: p.Rw },
      { type: 'C', id: 'Cs', nodes: ['w', 'p'], value: p.Cw },
      { type: 'R', id: 'Rp', nodes: ['p', 'gnd'], value: p.Rw },
      { type: 'C', id: 'Cp', nodes: ['p', 'gnd'], value: p.Cw },
    ],
  }
  const ac = solveAC(net, 2 * Math.PI * hz, { sources: { Vd: [1, 0] } })
  return ac.v.p
}

/** The magnitude of that, and its phase in degrees. */
export const wienBetaMag = (p, hz) => cx.cabs(wienBeta(p, hz))
export const wienBetaDeg = (p, hz) => {
  const b = wienBeta(p, hz)
  return (Math.atan2(b[1], b[0]) * 180) / Math.PI
}

/** The Colpitts tank's series capacitance, C₁C₂/(C₁ + C₂). */
export const seriesC = (p) => (p.C1 * p.C2) / (p.C1 + p.C2)

/** The tank's own frequency, 1/(2π√(L·C₁C₂/(C₁+C₂))). */
export const colpittsF0 = (p) => 1 / (2 * Math.PI * Math.sqrt(p.L * seriesC(p)))

// ------------------------------------------------------------ measurement

/**
 * What an oscillator does, read off the walk the solver made.
 *
 * The period comes from upward crossings of the waveform's own mean, refined
 * by bisection on the exact solution between samples, so it is a property of
 * the waveform and not of the sample grid. The amplitude and the harmonics are
 * read over whole periods after the run has settled, which is what `settle`
 * names as a fraction of the window.
 *
 * `f0` and `sigma` are the linear circuit's own numbers: the imaginary and
 * real parts of the pole pair, from the polynomials where the experiment has
 * them and from the state matrix where it does not.
 */
export function oscOf(x) {
  if (x._osc) return x._osc
  const spec = x.exp.osc || {}
  const key = spec.node || 'out'
  const out = { node: key }
  const pair = polePair(x)
  if (pair) {
    out.f0 = Math.abs(pair.im) / (2 * Math.PI)
    out.sigma = pair.re
    out.wn = Math.hypot(pair.re, pair.im)
  }
  if (x.tr) {
    const from = (spec.settle ?? 0.6) * x.tEnd
    const win = window(x, key, from, x.tEnd)
    Object.assign(out, win)
    if (win.period > 0) {
      out.f = 1 / win.period
      const h = harmonics(x, key, win.t0, win.period, spec.cycles ?? 4, spec.samples ?? 128)
      out.thd = h.thd
      out.hd2 = h.hd2
      out.fundamental = h.a1
    }
    // The envelope early on, where the growth is still exponential: two peaks
    // a whole number of periods apart give the rate the poles predict.
    const g = growth(x, key, spec)
    if (g) Object.assign(out, g)
  }
  x._osc = out
  return out
}

/** The dominant complex pole pair, from the polynomials or from the state matrix. */
function polePair(x) {
  let poles = x.poles
  if (!poles) {
    try {
      const norm = x.norm.nodeNames ? x.norm : normalize(x.norm)
      const sys = dynamics(norm, { regions: linearRegions(norm) })
      poles = polesOf({ b: [1], a: charPoly(sys.A) })
    } catch {
      return null
    }
  }
  const pairs = poles.filter((q) => Math.abs(q.im) > 1e-12)
  if (!pairs.length) return null
  return pairs.reduce((best, q) => (q.re > best.re ? q : best), pairs[0])
}

/** Every region device taken in its linear region: the circuit the poles belong to. */
function linearRegions(norm) {
  const out = {}
  for (const e of norm.elements) if (e.type === 'OPAMP' || e.type === 'VCCS') out[e.id] = 'linear'
  return out
}

/** The settled waveform: its mean, its half swing, and the period between upward crossings. */
function window(x, key, from, to) {
  const inside = x.tr.samples.filter((s) => s.t >= from && s.t <= to)
  if (inside.length < 8) return { period: 0 }
  const ys = inside.map((s) => s.sol.v[key])
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length
  const high = Math.max(...ys)
  const low = Math.min(...ys)
  const f = (t) => x.tr.at(t).sol.v[key]
  const ups = crossings(
    inside.map((s) => s.t),
    ys.map((v) => v - mean),
    (t) => f(t) - mean,
  ).filter((t, k, all) => k === 0 || t - all[k - 1] > 1e-9 * (to - from))
  // Only the crossings that go the same way: two neighbours a half period
  // apart would halve the answer.
  const same = ups.filter((t) => f(t + (to - from) * 1e-4) > mean)
  if (same.length < 2) return { period: 0, mean, amp: (high - low) / 2, high, low }
  const period = (same[same.length - 1] - same[0]) / (same.length - 1)
  return { period, mean, amp: (high - low) / 2, high, low, t0: same[0], cycles: same.length - 1 }
}

/**
 * The harmonics of one settled stretch, by correlating it against each
 * harmonic of its own period. The record is a whole number of periods long, so
 * every harmonic falls on a bin and no window is needed.
 */
function harmonics(x, key, t0, period, cycles, per) {
  const n = cycles * per
  const span = cycles * period
  if (!(span > 0) || t0 + span > x.tEnd) return { thd: NaN, hd2: NaN, a1: NaN }
  const y = new Float64Array(n)
  for (let i = 0; i < n; i++) y[i] = x.tr.at(t0 + (span * i) / n).sol.v[key]
  const amp = (h) => {
    let re = 0
    let im = 0
    for (let i = 0; i < n; i++) {
      const th = (2 * Math.PI * h * cycles * i) / n
      re += y[i] * Math.cos(th)
      im += y[i] * Math.sin(th)
    }
    return (2 * Math.hypot(re, im)) / n
  }
  const a1 = amp(1)
  let rest = 0
  const a2 = amp(2)
  for (let h = 2; h <= 12; h++) rest += amp(h) ** 2
  return { a1, hd2: a2 / a1, thd: Math.sqrt(rest) / a1 }
}

/**
 * The envelope's exponential rate, by fitting a straight line to the logarithm
 * of the waveform's own peaks.
 *
 * One peak divided by another is one measurement of the rate and carries all
 * of that pair's error. Every peak in the window on a log axis is a straight
 * line whose slope is σ, and the least-squares fit of that line uses them all.
 * The window has to end before the limiter takes hold, which is what `growAt`
 * names as two fractions of the run.
 */
function growth(x, key, spec) {
  const [a0, a1] = (spec.growAt ?? [0.05, 0.2]).map((f) => f * x.tEnd)
  const f = (t) => x.tr.at(t).sol.v[key]
  const steps = 600
  const ts = []
  const ys = []
  let prev = f(a0)
  let cur = f(a0 + (a1 - a0) / steps)
  for (let k = 1; k < steps; k++) {
    const t = a0 + ((a1 - a0) * (k + 1)) / steps
    const next = f(t)
    if (cur > prev && cur > next && cur > 0) {
      ts.push(a0 + ((a1 - a0) * k) / steps)
      ys.push(Math.log(cur))
    }
    prev = cur
    cur = next
  }
  if (ts.length < 3) return null
  const n = ts.length
  const mt = ts.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let k = 0; k < n; k++) {
    num += (ts[k] - mt) * (ys[k] - my)
    den += (ts[k] - mt) ** 2
  }
  if (!(den > 0)) return null
  return { growthRate: num / den, peaks: n, envelope: [Math.exp(ys[0]), Math.exp(ys[n - 1])] }
}

// ------------------------------------------------------------ the drawings

/**
 * The Wien bridge, drawn the way it is written: the amplifier in the middle,
 * the series arm along the top from the output back to the + input, the
 * parallel arm hanging from that same node, and the gain-setting divider along
 * the bottom to the − input. The canvas is wider than this lab's usual 420
 * because eight elements and five named nodes do not fit in it without a
 * reading landing on a symbol.
 */
function wienLayout(probe) {
  return {
    w: 480,
    h: 190,
    items: [
      { el: 'U1', x: 280, y: 96, invertTop: false },
      wire(318, 96, 445, 96),
      node('out', 380, 96, 't'),
      wire(445, 96, 445, 40),
      { el: 'Cs', x: 425, y: 40, dir: 'h' },
      wire(405, 40, 372, 40),
      node('w', 372, 40, 't'),
      wire(372, 40, 340, 40),
      { el: 'Rs', x: 320, y: 40, dir: 'h' },
      wire(300, 40, probe ? 36 : 116, 40),
      node('p', 245, 40, 't'),
      wire(280, 40, 280, 84),
      wire(196, 40, 196, 76),
      { el: 'Cp', x: 196, y: 96, dir: 'v' },
      wire(196, 116, 196, 150),
      wire(116, 40, 116, 76),
      { el: 'Rp', x: 116, y: 96, dir: 'v' },
      wire(116, 116, 116, 150),
      ...(probe ? [wire(36, 40, 36, 76), { el: 'Ik', x: 36, y: 96, dir: 'v' }, wire(36, 116, 36, 150)] : []),
      wire(probe ? 36 : 116, 150, 212, 150),
      gnd(150, 150),
      wire(445, 96, 445, 150),
      { el: 'Rf', x: 410, y: 150, dir: 'h' },
      wire(430, 150, 445, 150),
      wire(390, 150, 252, 150),
      node('n', 340, 150, 'b'),
      { el: 'Rg', x: 232, y: 150, dir: 'h' },
      wire(258, 150, 258, 108),
      wire(258, 108, 280, 108),
    ],
  }
}

/**
 * The relaxation oscillator: the Schmitt trigger's divider along the bottom to
 * the + input, and the timing resistor and capacitor along the top to the −
 * input. The two paths are drawn apart because the lesson is that they are two
 * different loops, one positive and one negative.
 */
function relaxLayout() {
  return {
    w: 420,
    h: 190,
    items: [
      { el: 'U1', x: 250, y: 96, invertTop: true },
      wire(288, 96, 390, 96),
      node('out', 330, 96, 't'),
      wire(390, 96, 390, 40),
      { el: 'Rt', x: 330, y: 40, dir: 'h' },
      wire(350, 40, 390, 40),
      wire(310, 40, 160, 40),
      node('n', 250, 40, 't'),
      wire(220, 40, 220, 84),
      wire(220, 84, 250, 84),
      wire(160, 40, 160, 76),
      { el: 'Ct', x: 160, y: 96, dir: 'v' },
      wire(160, 116, 160, 150),
      gnd(160, 150),
      wire(390, 96, 390, 150),
      { el: 'R2', x: 330, y: 150, dir: 'h' },
      wire(350, 150, 390, 150),
      wire(310, 150, 215, 150),
      node('p', 270, 150, 'b'),
      { el: 'R1', x: 195, y: 150, dir: 'h' },
      wire(175, 150, 160, 150),
      wire(228, 150, 228, 108),
      wire(228, 108, 250, 108),
    ],
  }
}

/**
 * The Colpitts tank: the inductor and the transconductor across the whole
 * tank on the left, the capacitive divider on the right, and the tap between
 * the two capacitors, which is the fraction of the tank voltage the
 * transconductor reads.
 */
function colpittsLayout() {
  return {
    w: 420,
    h: 180,
    items: [
      wire(60, 35, 190, 35),
      node('t', 98, 35, 't'),
      wire(190, 35, 200, 35),
      { el: 'C1', x: 220, y: 35, dir: 'h' },
      wire(240, 35, 250, 35),
      wire(250, 35, 356, 35),
      node('p', 314, 35, 't'),
      wire(60, 35, 60, 75),
      { el: 'Gm', x: 60, y: 95, dir: 'v' },
      wire(60, 115, 60, 155),
      wire(136, 35, 136, 75),
      { el: 'L1', x: 136, y: 95, dir: 'v' },
      wire(136, 115, 136, 155),
      wire(272, 35, 272, 75),
      { el: 'C2', x: 272, y: 95, dir: 'v' },
      wire(272, 115, 272, 155),
      wire(356, 35, 356, 75),
      { el: 'Rb', x: 356, y: 95, dir: 'v' },
      wire(356, 115, 356, 155),
      wire(60, 155, 356, 155),
      gnd(199, 155),
      { text: 'G_m reads the tap at p', x: 199, y: 135, anchor: 'middle' },
    ],
  }
}

// ------------------------------------------------------------ the experiments

const WIEN_KNOBS = [
  chips(R('Rf', 'Feedback R_f', 1900), [1900, 2000, 2100]),
  R('Rg', 'Divider R_g', 1000),
  chips(R('Rw', 'Wien R', 10000), [4700, 10000, 22000]),
  chips(Cap('Cw', 'Wien C', 10e-9), [1e-9, 10e-9, 100e-9]),
]

const LABELS = { Rs: 'R_s', Cs: 'C_s', Rp: 'R_p', Cp: 'C_p', Rf: 'R_f', Rg: 'R_g', Ik: 'I_k', Rt: 'R_t', Ct: 'C_t', L1: 'L', C1: 'C₁', C2: 'C₂', Gm: 'G_m', Rb: 'R_b' }

export const GROUP_N = [
  {
    id: 'n1',
    group: GROUP,
    name: 'The Wien bridge at the threshold',
    terms: ['oscillator', 'barkhausen', 'threshold'],
    params: [...WIEN_KNOBS, chips(Gain('A0', 'Open-loop gain A₀', 1e5), [1e4, 1e5, 1e6]), Rail('vsat', 'Rails ±V_sat', 12), Is('ik', 'Probe current I_k', 1e-6)],
    net: (p) => wienNet(p, true),
    labels: LABELS,
    layout: wienLayout(true),
    show: 'dc',
    view: 'pz',
    views: ['reading', 'bode', 'pz', 'equations'],
    signal: { input: 'Ik', output: 'out' },
    probe: (p) => wienF0(p),
    osc: {},
    headline: { path: 'pole.1.hz', label: 'f₀', unit: 'Hz' },
  },
  {
    id: 'n2',
    group: GROUP,
    name: 'Amplitude needs a nonlinearity',
    terms: ['limitcycle', 'thd'],
    params: [
      chips(R('Rf', 'Feedback R_f', 2200), [2020, 2200, 3000]),
      R('Rg', 'Divider R_g', 1000),
      chips(R('Rw', 'Wien R', 10000), [4700, 10000, 22000]),
      chips(Cap('Cw', 'Wien C', 10e-9), [1e-9, 10e-9, 100e-9]),
      Gain('A0', 'Open-loop gain A₀', 1e5),
      chips(Rail('vsat', 'Rails ±V_sat', 12), [3, 6, 12]),
      Amp('kick', 'Starting voltage on C_p', 1e-3),
    ],
    net: (p) => wienNet(p, false),
    labels: LABELS,
    layout: wienLayout(false),
    show: 'dc',
    view: 'scope',
    views: ['reading', 'scope', 'equations'],
    window: (p) => 40 / wienF0(p),
    points: 801,
    cursor: 0.9,
    osc: { node: 'out', settle: 0.75, cycles: 4, samples: 128, growAt: [0.06, 0.24] },
    scope: { traces: [{ q: 'v', key: 'out', label: 'v_out' }, { q: 'v', key: 'p', label: 'v_p' }] },
    headline: { path: 'peak.out', label: 'peak v_out', unit: 'V' },
  },
  {
    id: 'n3',
    group: GROUP,
    name: 'The relaxation oscillator',
    terms: ['relaxation', 'hysteresis'],
    params: [
      chips(R('Rt', 'Timing R_t', 4550), [2275, 4550, 9100]),
      chips(Cap('Ct', 'Timing C_t', 100e-9), [10e-9, 100e-9, 1e-6]),
      chips(R('R1', 'Threshold R₁', 10000), [3333, 10000, 30000]),
      R('R2', 'Threshold R₂', 10000),
      chips(Rail('vsat', 'Rails ±V_sat', 12), [5, 12, 15]),
      Amp('kick', 'Starting voltage on C_t', 1e-3),
    ],
    net: relaxNet,
    labels: LABELS,
    layout: relaxLayout(),
    show: 'dc',
    view: 'scope',
    views: ['reading', 'scope', 'equations'],
    window: (p) => 3.2 * 2 * p.Rt * p.Ct * Math.log((1 + betaOf(p)) / (1 - betaOf(p))),
    points: 1201,
    cursor: 0.5,
    osc: { node: 'out', settle: 0.2, cycles: 1, samples: 256 },
    scope: { traces: [{ q: 'v', key: 'out', label: 'v_out' }, { q: 'v', key: 'n', label: 'v_C' }] },
    headline: { path: 'osc.period', label: 'period T', unit: 's' },
  },
  {
    id: 'n4',
    group: GROUP,
    name: 'The LC oscillator and its tapped tank',
    terms: ['tank', 'colpitts'],
    params: [
      chips(Ind('L', 'Inductance L', 10e-3), [1e-3, 10e-3, 100e-3]),
      chips(Cap('C1', 'Top C₁', 20e-9), [10e-9, 20e-9, 40e-9]),
      chips(Cap('C2', 'Tap C₂', 20e-9), [10e-9, 20e-9, 40e-9]),
      chips(Gs('g', 'Transconductance g_m', 1e-3), [3e-4, 1e-3, 3e-3]),
      chips(Is('ilim', 'Current limit I_max', 2e-4), [1e-4, 2e-4, 1e-3]),
      chips(R('Rb', 'Tank loss R_b', 3000), [1000, 3000, 10000]),
      Amp('kick', 'Starting voltage on C₂', 1e-3),
    ],
    net: colpittsNet,
    labels: LABELS,
    layout: colpittsLayout(),
    show: 'dc',
    view: 'scope',
    views: ['reading', 'scope', 'equations'],
    window: (p) => 40 / colpittsF0(p),
    points: 801,
    cursor: 0.9,
    osc: { node: 't', settle: 0.7, cycles: 4, samples: 128, growAt: [0.02, 0.14] },
    scope: { traces: [{ q: 'v', key: 't', label: 'v_tank' }, { q: 'v', key: 'p', label: 'v_tap' }] },
    headline: { path: 'osc.f', label: 'f', unit: 'Hz' },
  },
]

/**
 * The half swing of any node over the settled part of the run, and its mean.
 * The math panel reads the threshold a Schmitt trigger switches at and the
 * fraction of the tank a Colpitts taps off this.
 */
export function swingAt(x, key, settle = 0.5) {
  if (!x.tr) return null
  const from = settle * x.tEnd
  const ys = x.tr.samples.filter((s) => s.t >= from).map((s) => s.sol.v[key])
  if (ys.length < 4) return null
  const high = Math.max(...ys)
  const low = Math.min(...ys)
  return { high, low, amp: (high - low) / 2, mean: (high + low) / 2 }
}

/**
 * The time constant of the stretch between the last two edges, from the walk.
 *
 * Between two events the circuit is one linear circuit and the capacitor's
 * voltage is one exponential. Three samples equally spaced inside that stretch
 * give the time constant without needing the level it is heading for, because
 * the ratio of the two differences is e^{Δ/τ} whatever that level is. The
 * samples are taken an eighth of the stretch clear of both edges, so a solve
 * exactly on an event never lands in the fit.
 */
export function decayConstant(x, key) {
  const ev = (x.tr && x.tr.events) || []
  for (let k = ev.length - 1; k > 0; k--) {
    const a = ev[k - 1].t
    const b = ev[k].t
    if (!(b - a > 0) || b > x.tEnd) continue
    const inset = (b - a) / 8
    const dt = (b - a - 2 * inset) / 2
    const f = (t) => x.tr.at(t).sol.v[key]
    const r = (f(a + inset) - f(a + inset + dt)) / (f(a + inset + dt) - f(a + inset + 2 * dt))
    if (r > 0 && Number.isFinite(r) && Math.abs(r - 1) > 1e-9) return dt / Math.log(r)
  }
  return NaN
}

/** The Schmitt trigger's feedback fraction, R₁/(R₁ + R₂). */
export function betaOf(p) {
  return p.R1 / (p.R1 + p.R2)
}

/** The relaxation oscillator's period, 2R_tC_t ln((1 + β)/(1 − β)). */
export function relaxPeriod(p) {
  const b = betaOf(p)
  return 2 * p.Rt * p.Ct * Math.log((1 + b) / (1 - b))
}
