// Group K: frequency response.
//
// Six experiments on where an amplifier stops amplifying. The low end is the
// coupling and bypass capacitors a bias network needs, each making a high-pass
// with the resistance it sees. The high end is the two capacitances inside the
// device, and the Miller effect that multiplies one of them by the gain across
// it. Between them sits the midband, which is every gain the earlier groups
// measured.
//
// Every pole here is a root of the exact polynomials `transferOf` builds from
// the small-signal netlist, not a reading off a curve. The two hand methods a
// course teaches, the Miller estimate and the sum of open-circuit time
// constants, are drawn beside those roots with their errors printed, which is
// CORE_SCOPE.md's Rule 3 for an approximation that ships.
//
// The bias in K1 and K3 to K6 is an ideal source in series with the signal,
// rather than the divider of K2. That is the textbook's stage, and it is the
// one whose poles the brief's §3.4 contract quotes. The knob is the collector
// current the reader wants, and `baseBias` reads the device law backwards to
// find the voltage that gives it, so turning the knob moves the operating
// point rather than the exponential.

import { evalTF, newtonDC, normalize, polesOf, smallSignal, solveDC, thermalVoltage, transferOf } from '@ee-labs/network'
import { chips } from '../knobs.js'

const GROUP = 'K · Frequency response'

const VT = thermalVoltage(300)
/** The saturation current every device in this group is built on. */
const IS = 1e-14
/** The supply the stages work from. */
const VCC = 10

// ------------------------------------------------------------ the knobs

const Ic = (key, label, def, hint) => ({ key, label, unit: 'A', min: 1e-4, max: 1.5e-3, scale: 'log', default: def, hint })
const Res = (key, label, def, min, max, hint) => ({ key, label, unit: 'Ω', min, max, scale: 'log', default: def, hint })
const Cap = (key, label, def, min, max, hint) => ({ key, label, unit: 'F', min, max, scale: 'log', default: def, hint })
const Beta = (key, label, def, hint) => ({ key, label, unit: '', min: 10, max: 1000, scale: 'log', default: def, hint })
const Early = (key, label, def, hint) => ({ key, label, unit: 'V', min: 10, max: 400, scale: 'linear', default: def, hint })
const Volts = (key, label, def, min, max, hint) => ({ key, label, unit: 'V', min, max, scale: 'linear', default: def, hint })

const IC = () => chips(Ic('ic', 'Collector current I_C', 1e-3), [0.25e-3, 1e-3, 1.5e-3])
const RC = () => chips(Res('rc', 'Collector R_C', 5000, 1000, 6000), [1000, 2500, 5000])
const RS = () => chips(Res('rs', 'Source R_s', 1000, 100, 10000), [100, 1000, 10000])
const CPI = () => chips(Cap('cpi', 'Base capacitance C_π', 20e-12, 1e-12, 100e-12), [5e-12, 20e-12, 80e-12])
const CMU = () => chips(Cap('cmu', 'Collector capacitance C_µ', 2e-12, 2e-13, 20e-12), [0.2e-12, 2e-12, 10e-12])
const BETA = () => chips(Beta('beta', 'Current gain β', 100), [25, 100, 400])
const EARLY = () => chips(Early('va', 'Early voltage V_A', 100), [25, 100, 400])

// ------------------------------------------------------------ the bias
//
// The device law, read backwards. i_C = I_S e^{v_BE/V_T}(1 + V_CE/V_A), so a
// target collector current names a base-emitter voltage; the base current is
// i_C/(βf) rather than i_C/β, because the Early factor multiplies the
// collector current and not the base's; and the source resistance drops that
// base current on the way in. At every setting these knobs reach, the current
// the circuit settles on is the current the knob asked for, to ten figures.

/** The base voltage a common-emitter stage needs for a target collector current. */
export function baseBias({ ic, rc, rs, beta, va, ve = 0 }) {
  const vce = VCC - ic * rc - ve
  const f = 1 + vce / va
  return ve + VT * Math.log(ic / (IS * f)) + (ic / (beta * f)) * rs
}

/** The same for an emitter follower, whose emitter sits at I_E R_E. */
export function followerBias({ ic, re, rs, beta, va }) {
  let ve = 0
  for (let k = 0; k < 4; k++) {
    const f = 1 + (VCC - ve) / va
    ve = ic * (1 + 1 / (beta * f)) * re
  }
  const f = 1 + (VCC - ve) / va
  return { ve, vbb: ve + VT * Math.log(ic / (IS * f)) + (ic / (beta * f)) * rs }
}

/** The middle node and base voltage a cascode needs, from its own base bias. */
export function cascodeBias({ ic, rc, rs, beta, va, vcas }) {
  let vm = vcas - 0.65
  let vbb = 0
  for (let k = 0; k < 4; k++) {
    const f2 = 1 + (VCC - ic * rc - vm) / va
    vm = vcas - VT * Math.log(ic / (IS * f2))
    const f1 = 1 + vm / va
    vbb = VT * Math.log(ic / (IS * f1)) + (ic / (beta * f1)) * rs
  }
  return { vm, vbb }
}

// ------------------------------------------------------------ the netlists

const device = (p, over = {}) => ({ model: 'exp', beta: p.beta, va: p.va, cpi: p.cpi, cmu: p.cmu, ...over })

/**
 * K1: the short-circuit current gain. The base is driven by a current source
 * and biased by a second one beside it, and the collector is held at a fixed
 * voltage through a one-ohm sense resistor. That resistor is what an ammeter
 * is, and it is also what keeps C_π and C_µ from lying across the same pair of
 * nodes, which no state-space form can carry.
 */
export const currentGainNet = (p) => ({
  elements: [
    { type: 'V', id: 'VCE', nodes: ['cs', 'gnd'], value: p.vce },
    { type: 'R', id: 'Rsense', nodes: ['c', 'cs'], value: 1 },
    { type: 'I', id: 'IB', nodes: ['gnd', 'b'], value: p.ic / (p.beta * (1 + p.vce / p.va)) },
    { type: 'I', id: 'Iin', nodes: ['gnd', 'b'], value: 0, wave: { kind: 'sine', amp: 1e-6, freq: 1000 } },
    { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], ...device(p) },
  ],
})

/** The divider-biased stage of K2, with its coupling and bypass capacitors. */
export const dividerNet = (p) => ({
  elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: VCC },
    { type: 'R', id: 'R1', nodes: ['vcc', 'b'], value: 55600 },
    { type: 'R', id: 'R2', nodes: ['b', 'gnd'], value: 12200 },
    { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: 5000 },
    { type: 'R', id: 'RE', nodes: ['e', 'gnd'], value: 1000 },
    { type: 'C', id: 'CE', nodes: ['e', 'gnd'], value: p.ce },
    { type: 'V', id: 'Vs', nodes: ['s', 'gnd'], value: 0, wave: { kind: 'sine', amp: 1e-3, freq: 1e4 } },
    { type: 'R', id: 'Rs', nodes: ['s', 'sin'], value: p.rs },
    { type: 'C', id: 'CC', nodes: ['sin', 'b'], value: p.cc },
    { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'e'], model: 'exp', beta: p.beta, va: p.va },
  ],
})

/** The common emitter of K3 and K4, biased by an ideal source in series. */
export const ceNet = (p) => ({
  elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: VCC },
    { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: p.rc },
    { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: baseBias(p) },
    { type: 'V', id: 'Vs', nodes: ['s', 'bb'], value: 0, wave: { kind: 'sine', amp: 1e-3, freq: 1000 } },
    { type: 'R', id: 'Rs', nodes: ['s', 'b'], value: p.rs },
    { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], ...device(p) },
  ],
})

/** The emitter follower of K5: the same device, the output at the emitter. */
export const followerNet = (p) => ({
  elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: VCC },
    { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: followerBias(p).vbb },
    { type: 'V', id: 'Vs', nodes: ['s', 'bb'], value: 0, wave: { kind: 'sine', amp: 1e-3, freq: 1000 } },
    { type: 'R', id: 'Rs', nodes: ['s', 'b'], value: p.rs },
    { type: 'Q', id: 'Q1', nodes: ['vcc', 'b', 'e'], ...device(p) },
    { type: 'R', id: 'RE', nodes: ['e', 'gnd'], value: p.re },
  ],
})

/**
 * The cascode of K6: a common base standing on the common emitter. Its base
 * needs a low impedance to hold it still, and the hundred ohms here is what
 * gives it one. Without a resistance there C_π of the upper device and both
 * capacitances of the lower one lie in a loop of shorts, which has no
 * state-space form.
 */
export const cascodeNet = (p) => {
  const bias = cascodeBias(p)
  return {
    elements: [
      { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: VCC },
      { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: p.rc },
      { type: 'Q', id: 'Q2', nodes: ['c', 'cas', 'm'], ...device(p) },
      { type: 'V', id: 'VCAS', nodes: ['vb', 'gnd'], value: p.vcas },
      { type: 'R', id: 'Rcas', nodes: ['vb', 'cas'], value: 100 },
      { type: 'Q', id: 'Q1', nodes: ['m', 'b', 'gnd'], ...device(p) },
      { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: bias.vbb },
      { type: 'V', id: 'Vs', nodes: ['s', 'bb'], value: 0, wave: { kind: 'sine', amp: 1e-3, freq: 1000 } },
      { type: 'R', id: 'Rs', nodes: ['s', 'b'], value: p.rs },
    ],
  }
}

// ------------------------------------------------------------ the drawings
//
// The same grid Group J uses: a device at y = 156 with its collector lead
// leaving at 136 and its emitter at 176, and a clear band of ±42 around it for
// the label and the reading. The transistor labels are the bare ids, because
// the glyph says npn or pnp and the fuller text would sit under the device's
// own emitter lead.

const wire = (x1, y1, x2, y2) => ({ wire: [x1, y1, x2, y2] })
const node = (name, x, y, side = 't') => ({ node: name, x, y, side })
const gnd = (x, y) => ({ gnd: [x, y] })

export const LABELS_K = { Q1: 'Q1', Q2: 'Q2' }

/** K1: two current sources into the base, and a held collector. */
function currentGainLayout() {
  return {
    w: 580,
    h: 270,
    items: [
      { el: 'Q1', x: 300, y: 156 },
      wire(280, 156, 80, 156),
      node('b', 240, 156, 't'),
      wire(80, 156, 80, 176),
      { el: 'IB', x: 80, y: 196, dir: 'v' },
      wire(80, 216, 80, 226),
      gnd(80, 226),
      wire(180, 156, 180, 176),
      { el: 'Iin', x: 180, y: 196, dir: 'v' },
      wire(180, 216, 180, 226),
      gnd(180, 226),
      wire(312, 176, 312, 216),
      gnd(312, 216),
      wire(312, 136, 420, 136),
      node('c', 380, 136, 't'),
      { el: 'Rsense', x: 440, y: 136, dir: 'h' },
      wire(460, 136, 500, 136),
      node('cs', 500, 136, 't'),
      wire(500, 136, 500, 176),
      { el: 'VCE', x: 500, y: 196, dir: 'v' },
      wire(500, 216, 500, 226),
      gnd(500, 226),
    ],
  }
}

/** The rail, the supply and the base chain K3, K5 and K6 all share. */
const railAndSupply = (railTo) => [
  wire(60, 16, railTo, 16),
  wire(60, 16, 60, 36),
  { el: 'VCC', x: 60, y: 56, dir: 'v' },
  wire(60, 76, 60, 88),
  gnd(60, 88),
  node('vcc', 150, 16, 't'),
]

/** The source, its resistance and the bias under it, feeding a base at (base, y). */
const sourceChain = (base, y) => [
  wire(base, y, 320, y),
  node('b', 350, y, 't'),
  { el: 'Rs', x: 280, y, dir: 'h' },
  wire(260, y, 200, y),
  node('s', 230, y, 't'),
  { el: 'Vs', x: 160, y, dir: 'h' },
  wire(140, y, 80, y),
  node('bb', 110, y, 't'),
  wire(80, y, 80, y + 20),
  { el: 'VBB', x: 80, y: y + 40, dir: 'v' },
  wire(80, y + 60, 80, y + 70),
  gnd(80, y + 70),
]

/** K3, K4: the common emitter with an ideal bias in series with the source. */
function ceLayout() {
  return {
    w: 580,
    h: 290,
    items: [
      ...railAndSupply(480),
      wire(480, 16, 480, 36),
      { el: 'RC', x: 480, y: 56, dir: 'v' },
      wire(480, 76, 480, 136),
      wire(480, 136, 412, 136),
      node('c', 480, 110, 'r'),
      { el: 'Q1', x: 400, y: 156 },
      wire(412, 176, 412, 216),
      gnd(412, 216),
      ...sourceChain(380, 156),
    ],
  }
}

/** K5: the follower, with the load at the emitter and the collector on the rail. */
function followerLayout() {
  return {
    w: 580,
    h: 320,
    items: [
      ...railAndSupply(470),
      wire(412, 136, 470, 136),
      wire(470, 136, 470, 16),
      { el: 'Q1', x: 400, y: 156 },
      wire(412, 176, 510, 176),
      node('e', 470, 176, 't'),
      wire(510, 176, 510, 216),
      { el: 'RE', x: 510, y: 236, dir: 'v' },
      wire(510, 256, 510, 266),
      gnd(510, 266),
      ...sourceChain(380, 156),
    ],
  }
}

/** K6: the common base stacked on the common emitter. */
function cascodeLayout() {
  return {
    w: 600,
    h: 400,
    items: [
      ...railAndSupply(520),
      wire(520, 16, 520, 36),
      { el: 'RC', x: 520, y: 56, dir: 'v' },
      wire(520, 76, 520, 136),
      wire(520, 136, 412, 136),
      node('c', 520, 110, 'r'),
      { el: 'Q2', x: 400, y: 156 },
      wire(380, 156, 320, 156),
      node('cas', 350, 156, 't'),
      { el: 'Rcas', x: 280, y: 156, dir: 'h' },
      wire(260, 156, 160, 156),
      node('vb', 220, 156, 't'),
      wire(160, 156, 160, 176),
      { el: 'VCAS', x: 160, y: 196, dir: 'v' },
      wire(160, 216, 160, 226),
      gnd(160, 226),
      wire(412, 176, 470, 176),
      wire(470, 176, 470, 256),
      wire(470, 256, 412, 256),
      node('m', 470, 216, 'r'),
      { el: 'Q1', x: 400, y: 276 },
      wire(412, 296, 412, 336),
      gnd(412, 336),
      ...sourceChain(380, 276),
    ],
  }
}

/** K2: the divider-biased stage, with a coupling capacitor and a bypass. */
function dividerLayout() {
  return {
    w: 640,
    h: 310,
    items: [
      ...railAndSupply(500),
      wire(300, 16, 300, 36),
      { el: 'R1', x: 300, y: 56, dir: 'v' },
      wire(300, 76, 300, 156),
      node('b', 300, 110, 'r'),
      wire(300, 156, 380, 156),
      wire(300, 156, 300, 196),
      { el: 'R2', x: 300, y: 216, dir: 'v' },
      wire(300, 236, 300, 246),
      gnd(300, 246),
      { el: 'Q1', x: 400, y: 156 },
      wire(500, 16, 500, 36),
      { el: 'RC', x: 500, y: 56, dir: 'v' },
      wire(500, 76, 500, 136),
      wire(500, 136, 412, 136),
      node('c', 500, 110, 'r'),
      wire(412, 176, 412, 216),
      node('e', 412, 200, 'r'),
      wire(412, 216, 510, 216),
      { el: 'RE', x: 412, y: 236, dir: 'v' },
      { el: 'CE', x: 510, y: 236, dir: 'v' },
      wire(412, 256, 510, 256),
      gnd(461, 256),
      wire(240, 156, 300, 156),
      { el: 'CC', x: 220, y: 156, dir: 'h' },
      wire(200, 156, 140, 156),
      node('sin', 170, 156, 't'),
      { el: 'Rs', x: 120, y: 156, dir: 'h' },
      wire(100, 156, 40, 156),
      node('s', 70, 156, 't'),
      wire(40, 156, 40, 196),
      { el: 'Vs', x: 40, y: 216, dir: 'v' },
      wire(40, 236, 40, 246),
      gnd(40, 246),
    ],
  }
}

// ------------------------------------------------------------ measurements

/**
 * The frequency at which a gain crosses one, by bisection on the exact
 * polynomials. For K1's short-circuit current gain that frequency is f_T.
 */
export function unityGain(tf, lo = 1e2, hi = 1e12) {
  if (!tf) return NaN
  const mag = (f) => Math.hypot(...evalTF(tf, [0, 2 * Math.PI * f]))
  if (mag(lo) < 1) return NaN
  let a = lo
  let b = hi
  for (let k = 0; k < 200; k++) {
    const m = Math.sqrt(a * b)
    if (mag(m) > 1) a = m
    else b = m
  }
  return Math.sqrt(a * b)
}

/** |H| at a frequency, off the same polynomials the poles come from. */
export const magAt = (tf, f) => (tf ? Math.hypot(...evalTF(tf, [0, 2 * Math.PI * f])) : NaN)

/**
 * The short-circuit time constants, which are what set a low corner. Each
 * capacitor is measured with every OTHER capacitor shorted, because at the low
 * end the others are already low impedances. The sum of the reciprocals
 * estimates the corner from below, and the largest of them is the pole that
 * dominates it.
 */
export function sctcOf(x) {
  if (!x.ss) return null
  const caps = x.ss.elements.filter((e) => e.type === 'C')
  if (!caps.length) return null
  const rest = x.ss.elements.filter((e) => e.type !== 'C')
  const taus = caps.map((c) => {
    const [a, b] = c.nodes
    const shorted = caps.filter((o) => o.id !== c.id).map((o) => ({ type: 'V', id: o.id, nodes: o.nodes, value: 0 }))
    const sol = solveDC({ elements: [...rest, ...shorted, { type: 'I', id: 'Itest', nodes: [b, a], value: 1 }] })
    const r = (sol.v[a] ?? 0) - (sol.v[b] ?? 0)
    return { id: c.id, r, tau: r * c.value, hz: 1 / (2 * Math.PI * r * c.value) }
  })
  const fl = taus.reduce((s, t) => s + t.hz, 0)
  const worst = taus.reduce((m, t) => (t.hz > m.hz ? t : m), taus[0])
  return { taus, fl, worst }
}

/**
 * The open-circuit time constants: for each capacitor, the resistance the rest
 * of the small-signal circuit presents across it with every other capacitor
 * open, times its own value.
 *
 * The resistance is measured the way the definition says to measure it, with a
 * test current source across the pair of nodes and the voltage read off the
 * solve. Nothing here is a formula. The sum is an estimate of 1/(2π f_H), and
 * the error it carries is what K4 exists to show.
 */
export function octcOf(x) {
  if (!x.ss) return null
  const caps = x.ss.elements.filter((e) => e.type === 'C')
  if (!caps.length) return null
  const others = x.ss.elements.filter((e) => e.type !== 'C')
  const taus = caps.map((c) => {
    const [a, b] = c.nodes
    const sol = solveDC({ elements: [...others, { type: 'I', id: 'Itest', nodes: [b, a], value: 1 }] })
    const r = (sol.v[a] ?? 0) - (sol.v[b] ?? 0)
    return { id: c.id, r, tau: r * c.value }
  })
  const sum = taus.reduce((s, t) => s + t.tau, 0)
  return { taus, sum, fh: 1 / (2 * Math.PI * sum) }
}

/** The Miller estimate of the input capacitance and the corner it gives. */
export function millerOf(x, p) {
  const q = x.point.Q1
  if (!q || !(q.gm > 0)) return null
  const rl = (p.rc * q.ro) / (p.rc + q.ro)
  const rin = (p.rs * q.rpi) / (p.rs + q.rpi)
  const cin = p.cpi + p.cmu * (1 + q.gm * rl)
  return { rl, rin, cin, fh: 1 / (2 * Math.PI * rin * cin), multiplier: 1 + q.gm * rl }
}

/** The lowest pole a transfer function has, in hertz. */
export const dominant = (x) => (x.poles && x.poles.length ? Math.min(...x.poles.map((q) => q.hz)) : NaN)
/** The second-lowest pole, in hertz. */
export const second = (x) => {
  if (!x.poles || x.poles.length < 2) return NaN
  const hz = x.poles.map((q) => q.hz).sort((a, b) => a - b)
  return hz[1]
}

/** Is every device of this circuit in its active region? */
export const allActive = (x) => Object.values(x.point || {}).every((q) => q.region === 'active')

/** The common-emitter stage's dominant pole at the same device and source. */
export function cePoleFor(p) {
  const norm = normalize(ceNet(p))
  const op = newtonDC(norm, {})
  const ss = smallSignalOf(norm, op)
  const tf = transferFor(ss, { input: 'Vs', output: 'c' })
  return tf ? Math.min(...polesFor(tf)) : NaN
}

/**
 * What one capacitance of that same common-emitter stage sees, by the
 * open-circuit method, at this experiment's own device and source.
 *
 * K5 and K6 both quote the resistance K3's collector capacitance looks into,
 * because the whole point of a follower and of a cascode is how much smaller
 * their own is. The number is solved on K3's netlist at the knobs in front of
 * the reader rather than carried across as a constant, so turning a knob these
 * three experiments share moves both sides of the comparison.
 */
export function ceSeenBy(p, id) {
  const norm = normalize(ceNet(p))
  const o = octcOf({ ss: smallSignalOf(norm, newtonDC(norm, {})) })
  const t = o && o.taus.find((c) => c.id === id)
  return t ? t.r : NaN
}

/**
 * |H| in decibels and ∠H in degrees at one frequency, both against the
 * midband value, so a phase reads as the lag the poles have added rather than
 * as the 180° an inverting stage starts from.
 */
export function relativeAt(x, f) {
  if (!x.tf) return { db: NaN, deg: NaN }
  const a = evalTF(x.tf, [0, 1e-9])
  const b = evalTF(x.tf, [0, 2 * Math.PI * f])
  return {
    db: 20 * Math.log10(Math.hypot(b[0], b[1]) / Math.hypot(a[0], a[1])),
    deg: ((Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0])) * 180) / Math.PI,
  }
}

// These three are here so that `cePoleFor` reads as one sentence, and so that
// a change to how a stage is linearised happens in one place.
const smallSignalOf = (norm, op) => smallSignal(norm, op, { caps: true })
const transferFor = (ss, io) => transferOf({ elements: ss.elements }, { ...io, check: false })
const polesFor = (tf) => polesOf(tf).map((q) => q.hz)

// ------------------------------------------------------------ the math panel
//
// The rows that can be exact are exact: the two poles of the common emitter
// come out of the quadratic a hand analysis writes, and the sum of the time
// constants is not an estimate at all but the s coefficient of the denominator
// polynomial, which is why the method works. The rows that are estimates are
// not checked against the exact answer, because an estimate that agreed would
// not be one. They sit in the values block with their error beside them, which
// is CORE_SCOPE.md's Rule 3.

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.02, extra = {}) => ({ label, predicted, measured, unit, tol, ...extra })

const OFF_REGION =
  'The device has left its active region at this setting, and the small-signal model of a saturated transistor is a different circuit.'

/**
 * How far apart the two poles have to be for a one-pole estimate of the high
 * corner to be worth reading.
 *
 * Both hand methods in this group put the whole of the input time constant on
 * the lowest pole. The second pole holds some of it back, so an estimate is
 * worth what the spacing leaves it. At the defaults the two poles are 624
 * apart and both estimates are inside 3.2 per cent. At 17 apart both are
 * within 5.6 per cent. At 6.7 apart the Miller estimate is 31 per cent high
 * and the sum of the time constants 13 per cent low, and the knobs reach 3.3.
 * Ten is the line between those two behaviours. Under it the panel says to
 * read the exact pole instead, rather than printing a number the reader would
 * take at face value. That is the threshold CORE_SCOPE.md's Rule 3 asks an
 * approximation to carry, and `experiments.test.js` crosses it both ways.
 */
export const SPACING = 10

/** How many times the second pole sits above the first. */
export const poleSpacing = (x) => second(x) / dominant(x)

/** The note an estimate of the high corner carries at this pole spacing. */
export function spacingNote(x, far) {
  const s = poleSpacing(x)
  if (!Number.isFinite(s)) return far
  return s < SPACING ? `the two poles are ${s.toFixed(1)} apart, under the ${SPACING} this estimate needs, so read the exact pole above` : far
}

/** Why a small-signal row cannot be checked here, or null. */
const signalWhy = (x) => (!allActive(x) ? OFF_REGION : !x.tf ? 'This circuit has no polynomials at this setting, so there is nothing to read the poles off.' : null)

/**
 * The denominator's s coefficient, which the sum of the open-circuit time
 * constants equals exactly: a(s) = Π(s − p_i), so a_{n−1}/a_n is −Σ 1/p_i,
 * and that sum is what the method adds up one capacitor at a time.
 */
const sCoefficient = (x) => {
  if (!x.tf || x.tf.a.length < 2) return NaN
  const a = x.tf.a
  return a[a.length - 2] / a[a.length - 1]
}

export const MATH_K = {
  k1(p, x) {
    const q = x.point.Q1
    const o = octcOf(x)
    const fT = unityGain(x.tf)
    const simple = q.gm / (2 * Math.PI * (p.cpi + p.cmu))
    return {
      blocks: [
        T('With the collector held still, all the base current has to charge the two capacitances before any of it reaches the base junction. The current gain therefore falls, and the frequency where it reaches one is the device’s own speed.'),
        F('\\beta(s) = \\frac{g_m r_\\pi}{1 + s r_\\pi (C_\\pi + C_\\mu)}, \\qquad f_T = \\frac{g_m}{2\\pi (C_\\pi + C_\\mu)}'),
        C([
          row('the transconductance at this current', q.ic / thermalVoltage(300), q.gm, 'A/V', 1e-6),
          row('the corner of the current gain', 1 / (2 * Math.PI * q.rpi * (p.cpi + p.cmu)), x.corner ? x.corner.high : NaN, 'Hz', 0.04, { unchecked: signalWhy(x) }),
          row('Σ τ, against the denominator’s s coefficient', o ? o.sum : NaN, sCoefficient(x), 's', 1e-6, { unchecked: signalWhy(x) }),
        ]),
        V([
          { label: 'the frequency the gain reaches one', value: fT, unit: 'Hz', note: 'found by bisection on the exact polynomials' },
          { label: 'what g_m/2π(C_π + C_µ) gives', value: simple, unit: 'Hz', note: 'the textbook’s form, which drops the zero the collector capacitance also makes' },
          { label: 'the current gain at low frequency', value: q.gm * q.rpi, unit: '', note: 'β raised by the Early factor, since I_C is and I_B is not' },
        ]),
      ],
    }
  },

  k2(p, x) {
    const q = x.point.Q1
    const s = sctcOf(x)
    const rb = (55600 * 12200) / (55600 + 12200)
    const rsb = (p.rs * rb) / (p.rs + rb)
    const rBypass = 1 / (1 / 1000 + 1 / (1 / q.gm + rsb / (q.beta + 1)))
    const rCoup = p.rs + (rb * q.rpi) / (rb + q.rpi)
    const byCap = Object.fromEntries((s ? s.taus : []).map((t) => [t.id, t]))
    return {
      blocks: [
        T('Each capacitor makes a high-pass with the resistance it sees when the others are already low impedances. The one that sees the smallest resistance has the highest corner, and that corner is where the amplifier stops.'),
        F('f_{CC} = \\frac{1}{2\\pi C_C (R_s + R_B \\parallel r_\\pi)}, \\qquad f_{CE} = \\frac{1}{2\\pi C_E \\left(R_E \\parallel \\left(\\frac{1}{g_m} + \\frac{R_s \\parallel R_B}{\\beta + 1}\\right)\\right)}'),
        C([
          row('the transconductance at this current', q.ic / thermalVoltage(300), q.gm, 'A/V', 1e-6),
          row('the resistance the coupling capacitor sees', rCoup, byCap.CC ? byCap.CC.r : NaN, 'Ω', 1e-3, { unchecked: signalWhy(x) }),
          // The bypass capacitor looks into the emitter, and what it finds
          // there carries r_o as well as r_π. The hand form drops r_o, which
          // is a few per cent of a resistance this small.
          row('the resistance the bypass capacitor sees', rBypass, byCap.CE ? byCap.CE.r : NaN, 'Ω', 0.08, { unchecked: signalWhy(x) }),
        ]),
        V([
          { label: 'the corner the bypass capacitor sets', value: byCap.CE ? byCap.CE.hz : NaN, unit: 'Hz' },
          { label: 'the corner the coupling capacitor sets', value: byCap.CC ? byCap.CC.hz : NaN, unit: 'Hz' },
          { label: 'the two added, as an estimate', value: s ? s.fl : NaN, unit: 'Hz', note: 'the sum of the reciprocals, which lies above the exact corner' },
          { label: 'the exact −3 dB corner', value: x.corner ? x.corner.low : NaN, unit: 'Hz', note: 'from the roots of the denominator' },
        ]),
      ],
    }
  },

  k3(p, x) {
    const q = x.point.Q1
    const m = millerOf(x, p)
    const exact = dominant(x)
    const b1 = m ? p.cpi * m.rin + p.cmu * (m.rin + m.rl + q.gm * m.rin * m.rl) : NaN
    const b2 = m ? p.cpi * p.cmu * m.rin * m.rl : NaN
    const disc = Math.sqrt(b1 * b1 - 4 * b2)
    const lo = (b1 - disc) / (2 * b2) / (2 * Math.PI)
    const hi = (b1 + disc) / (2 * b2) / (2 * Math.PI)
    return {
      blocks: [
        T('The collector capacitance bridges the input and the output of an inverting stage, so both of its plates move and in opposite directions. At the base it therefore draws the current of a much larger capacitance.'),
        F('C_{in} = C_\\pi + C_\\mu(1 + g_m R_L), \\qquad f_H \\approx \\frac{1}{2\\pi R_{in} C_{in}}'),
        C([
          row('the dominant pole, from the quadratic', lo, exact, 'Hz', 1e-4, { unchecked: signalWhy(x) }),
          row('the second pole, from the same quadratic', hi, second(x), 'Hz', 1e-4, { unchecked: signalWhy(x) }),
          row('the zero, at g_m/C_µ', q.gm / (2 * Math.PI * p.cmu), x.zeros && x.zeros.length ? x.zeros[x.zeros.length - 1].hz : NaN, 'Hz', 1e-6, { unchecked: signalWhy(x) }),
        ]),
        V([
          { label: 'the Miller multiplier, 1 + g_m R_L', value: m ? m.multiplier : NaN, unit: '' },
          { label: 'the input capacitance it makes', value: m ? m.cin : NaN, unit: 'F' },
          { label: 'the corner that estimate gives', value: m ? m.fh : NaN, unit: 'Hz' },
          {
            label: 'how far above the exact pole it lands',
            value: m ? m.fh / exact - 1 : NaN,
            unit: '',
            note: spacingNote(x, 'the estimate keeps only one pole, and drops the second one’s pull on the first'),
          },
        ]),
      ],
    }
  },

  k4(p, x) {
    const q = x.point.Q1
    const m = millerOf(x, p)
    const o = octcOf(x)
    const exact = dominant(x)
    const byCap = Object.fromEntries((o ? o.taus : []).map((t) => [t.id, t]))
    return {
      blocks: [
        T('Open every capacitance but one, measure the resistance across the one that is left, and multiply. The sum of those products is the s coefficient of the denominator exactly, and one over 2π times it estimates the corner.'),
        F('\\sum \\tau = C_\\pi R_{in} + C_\\mu (R_{in} + R_L + g_m R_{in} R_L), \\qquad f_H \\approx \\frac{1}{2\\pi \\sum \\tau}'),
        C([
          row('the resistance C_π sees', m ? m.rin : NaN, byCap['Q1.cpi'] ? byCap['Q1.cpi'].r : NaN, 'Ω', 1e-4, { unchecked: signalWhy(x) }),
          row('the resistance C_µ sees', m ? m.rin + m.rl + q.gm * m.rin * m.rl : NaN, byCap['Q1.cmu'] ? byCap['Q1.cmu'].r : NaN, 'Ω', 1e-4, { unchecked: signalWhy(x) }),
          row('Σ τ, against the denominator’s s coefficient', o ? o.sum : NaN, sCoefficient(x), 's', 1e-6, { unchecked: signalWhy(x) }),
        ]),
        V([
          { label: 'the corner the sum estimates', value: o ? o.fh : NaN, unit: 'Hz' },
          {
            label: 'how far below the exact pole it lands',
            value: o ? o.fh / exact - 1 : NaN,
            unit: '',
            note: spacingNote(x, 'the estimate spends the whole sum on one pole, and the second pole has some of it'),
          },
          { label: 'how far apart the two poles are', value: poleSpacing(x), unit: '', note: `under ${SPACING} the row above says to read the exact pole instead` },
        ]),
      ],
    }
  },

  k5(p, x) {
    const q = x.point.Q1
    const o = octcOf(x)
    const rl = (p.re * q.ro) / (p.re + q.ro)
    const rmu = (p.rs * (q.rpi + (q.beta + 1) * rl)) / (p.rs + q.rpi + (q.beta + 1) * rl)
    const byCap = Object.fromEntries((o ? o.taus : []).map((t) => [t.id, t]))
    return {
      blocks: [
        T('The output follows the input, so the collector capacitance has a gain of about one across it rather than a gain of a hundred. What it sees at the base is the source resistance in parallel with the base looking into the follower, which is large.'),
        F('R_{\\mu} = R_s \\parallel \\left(r_\\pi + (\\beta + 1)(R_E \\parallel r_o)\\right), \\qquad A_v = \\frac{v_e}{v_s} \\to 1'),
        C([
          row('the transconductance at this current', q.ic / thermalVoltage(300), q.gm, 'A/V', 1e-6),
          // The hand form takes the base's own load as (β + 1) times what the
          // emitter sees. The device also feeds r_o from the supply, which
          // this drops, and that is a few per cent of a large resistance.
          row('the resistance C_µ sees', rmu, byCap['Q1.cmu'] ? byCap['Q1.cmu'].r : NaN, 'Ω', 0.08, { unchecked: signalWhy(x) }),
          row('Σ τ, against the denominator’s s coefficient', o ? o.sum : NaN, sCoefficient(x), 's', 1e-6, { unchecked: signalWhy(x) }),
        ]),
        V([
          { label: 'the gain from the source to the emitter', value: x.tf ? x.gain : NaN, unit: '' },
          { label: 'the dominant pole', value: dominant(x), unit: 'Hz' },
          { label: 'the same device as a common emitter', value: cePoleFor({ ...p, rc: 5000 }), unit: 'Hz', note: 'K3’s stage at this source resistance and this current' },
        ]),
      ],
    }
  },

  k6(p, x) {
    const q = x.point.Q1
    const q2 = x.point.Q2
    const o = octcOf(x)
    const m = millerOf(x, { ...p, rc: 1 / q2.gm })
    const byCap = Object.fromEntries((o ? o.taus : []).map((t) => [t.id, t]))
    const re2 = q2.gm > 0 ? 1 / q2.gm + 100 / (q2.beta + 1) : NaN
    const rin = (p.rs * q.rpi) / (p.rs + q.rpi)
    return {
      blocks: [
        T('The upper device holds the lower one’s collector still. What the lower collector sees is the resistance looking into an emitter, which is one over the transconductance, so the gain across its collector capacitance is about one.'),
        F('R_{L1} = \\frac{1}{g_{m2}} + \\frac{R_{cas}}{\\beta + 1}, \\qquad C_{in} = C_\\pi + C_\\mu (1 + g_{m1} R_{L1})'),
        C([
          row('the transconductance of the lower device', q.ic / thermalVoltage(300), q.gm, 'A/V', 1e-6),
          row('the resistance C_π of the lower device sees', rin, byCap['Q1.cpi'] ? byCap['Q1.cpi'].r : NaN, 'Ω', 1e-4, { unchecked: signalWhy(x) }),
          row('the resistance C_µ of the lower device sees', rin + re2 * (1 + q.gm * rin), byCap['Q1.cmu'] ? byCap['Q1.cmu'].r : NaN, 'Ω', 0.06, { unchecked: signalWhy(x) }),
          row('Σ τ, against the denominator’s s coefficient', o ? o.sum : NaN, sCoefficient(x), 's', 1e-6, { unchecked: signalWhy(x) }),
        ]),
        V([
          { label: 'what the lower collector sees', value: re2, unit: 'Ω', note: 'an emitter, not a load resistor' },
          { label: 'the input capacitance it leaves', value: byCap['Q1.cpi'] && byCap['Q1.cmu'] ? (byCap['Q1.cpi'].tau + byCap['Q1.cmu'].tau) / rin : NaN, unit: 'F' },
          { label: 'the −3 dB corner', value: x.corner ? x.corner.high : NaN, unit: 'Hz' },
          { label: 'the same device as a plain common emitter', value: cePoleFor(p), unit: 'Hz', note: 'K3’s stage at this current, source and collector resistor' },
        ]),
      ],
    }
  },
}

// ------------------------------------------------------------ the experiments

export const GROUP_K = [
  {
    id: 'k1',
    group: GROUP,
    name: 'The capacitors inside the device set f_T',
    terms: ['currentgain', 'transitfreq'],
    params: [IC(), CPI(), CMU(), chips(Volts('vce', 'Collector voltage V_CE', 5, 1, 9), [2, 5, 8]), BETA(), EARLY()],
    net: currentGainNet,
    labels: LABELS_K,
    layout: currentGainLayout(),
    show: 'ac',
    view: 'bode',
    views: ['reading', 'bode', 'pz', 'equations'],
    caps: true,
    at: 1e3,
    probe: 1e3,
    signal: { input: 'Iin', output: { through: 'VCE' } },
    headline: { path: 'corner.high', label: 'f_β', unit: 'Hz' },
  },
  {
    id: 'k2',
    group: GROUP,
    name: 'Coupling and bypass set the low corner',
    terms: ['coupling', 'bypass'],
    params: [
      chips(Cap('ce', 'Bypass C_E', 47e-6, 1e-6, 1e-3), [4.7e-6, 47e-6, 470e-6]),
      chips(Cap('cc', 'Coupling C_C', 10e-6, 1e-6, 1e-4), [1e-6, 10e-6, 100e-6]),
      RS(),
      BETA(),
      EARLY(),
    ],
    net: dividerNet,
    labels: LABELS_K,
    layout: dividerLayout(),
    show: 'ac',
    view: 'bode',
    views: ['reading', 'bode', 'pz', 'equations'],
    caps: false,
    at: 1e4,
    probe: 1e4,
    signal: { input: 'Vs', output: 'c' },
    headline: { path: 'corner.low', label: 'f_L', unit: 'Hz' },
  },
  {
    id: 'k3',
    group: GROUP,
    name: 'The Miller effect, and what it costs',
    terms: ['miller'],
    params: [RS(), IC(), RC(), CPI(), CMU(), BETA(), EARLY()],
    net: ceNet,
    labels: LABELS_K,
    layout: ceLayout(),
    show: 'ac',
    view: 'bode',
    views: ['reading', 'bode', 'pz', 'equations'],
    caps: true,
    at: 1e3,
    probe: 1e3,
    signal: { input: 'Vs', output: 'c' },
    headline: { path: 'pole.1.hz', label: 'f_H', unit: 'Hz' },
  },
  {
    id: 'k4',
    group: GROUP,
    name: 'Open-circuit time constants estimate the corner',
    terms: ['octc'],
    params: [CMU(), CPI(), RS(), IC(), RC(), BETA(), EARLY()],
    net: ceNet,
    labels: LABELS_K,
    layout: ceLayout(),
    show: 'ac',
    view: 'bode',
    views: ['reading', 'bode', 'pz', 'equations'],
    caps: true,
    at: 1e3,
    probe: 1e3,
    signal: { input: 'Vs', output: 'c' },
    headline: { path: 'pole.1.hz', label: 'f_H', unit: 'Hz' },
  },
  {
    id: 'k5',
    group: GROUP,
    name: 'A follower has no gain across C_µ',
    terms: ['follower'],
    params: [chips(Res('re', 'Emitter R_E', 5000, 500, 10000), [1000, 5000, 10000]), RS(), IC(), CPI(), CMU(), BETA(), EARLY()],
    net: followerNet,
    labels: LABELS_K,
    layout: followerLayout(),
    show: 'ac',
    view: 'bode',
    views: ['reading', 'bode', 'pz', 'equations'],
    caps: true,
    at: 1e3,
    probe: 1e3,
    signal: { input: 'Vs', output: 'e' },
    headline: { path: 'pole.1.hz', label: 'f_H', unit: 'Hz' },
  },
  {
    id: 'k6',
    group: GROUP,
    name: 'The cascode keeps the gain and the bandwidth',
    terms: ['cascode'],
    params: [chips(Volts('vcas', 'Cascode bias V_CAS', 2.65, 1.5, 5), [2, 2.65, 4]), RS(), IC(), RC(), CPI(), CMU(), BETA(), EARLY()],
    net: cascodeNet,
    labels: LABELS_K,
    layout: cascodeLayout(),
    show: 'ac',
    view: 'bode',
    views: ['reading', 'bode', 'pz', 'equations'],
    caps: true,
    at: 1e3,
    probe: 1e3,
    signal: { input: 'Vs', output: 'c' },
    headline: { path: 'corner.high', label: 'f_H', unit: 'Hz' },
  },
]
