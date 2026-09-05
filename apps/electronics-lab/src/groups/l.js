// Group L: feedback.
//
// Everything before this group is an amplifier read forwards, from the input
// to the output. Feedback is the same circuit read round: what the output
// sends back to the input, and what that return trip does to every number the
// amplifier has. Six experiments, one measurement each, and the same quantity
// under all six is the return ratio T.
//
// The circuits are written out of controlled sources and resistors rather
// than drawn as an op-amp triangle, for one reason. A return ratio is the
// property of a controlled source, and the loop is broken at the source the
// experiment names. An ideal op-amp has infinite gain, so its return ratio is
// infinite and 1 + T carries no information — `packages/network`'s loop.js
// declines to break the loop there and says so. Writing the amplifier as a
// VCVS, or as the transconductance and the pole that make one, puts the
// element the loop is broken at on the drawing.
//
// The feedback network is drawn as its own controlled source where the
// experiment breaks the loop there (L5). A VCVS of gain β is exactly a
// feedback network that does not load what it samples, which is what makes
// the loop gain of that circuit readable as one number.

import { complex as cx, evalTF, marginsOf, polesOf, returnRatio, returnRatioAt, solveDC } from '@ee-labs/network'
import { Cap, Freq, Gain, Is, R, Vs, chips, gnd, node, wire } from '../knobs.js'

const GROUP = 'L · Feedback'

// ------------------------------------------------------------ measurements
//
// Five numbers that no quantity path names, each read out of the same solver
// the panes read. They live here because Groups L and M are the only groups
// that ask for them, and both group files and both lesson files use them.

/**
 * The resistance at a port, by the definition: kill every source, push a test
 * current into the node, and divide the voltage that appears by the current.
 * `drop` names elements to take out first, which is how the source driving a
 * port is removed before that port is measured.
 */
export function portResistance(elements, node, drop = []) {
  const els = elements.filter((e) => !drop.includes(e.id)).concat([{ type: 'I', id: 'L.test', nodes: ['gnd', node], value: 1 }])
  const sources = {}
  for (const e of els) if (e.type === 'V' || e.type === 'I') sources[e.id] = e.id === 'L.test' ? 1 : 0
  return solveDC({ elements: els }, { sources }).v[node]
}

/** The netlist an analysis was linearised to, or the netlist itself when it is already linear. */
export const tangent = (x) => ({ elements: x.ss ? x.ss.elements : x.norm.elements })

/** The return ratio of one controlled source at DC, the number 1 + T is built from. */
export const loopT = (x, source) => returnRatioAt(tangent(x), source)[0]

/** The return ratio as polynomials, for the margins and the Bode plot of the loop. */
export const loopTF = (x, source) => returnRatio(tangent(x), source, { check: false })

/** Gain crossover and phase margin of a loop gain given as polynomials. */
export const loopMargins = (tf) => marginsOf((hz) => evalTF(tf, [0, 2 * Math.PI * hz]))

/**
 * The damping ratio of a complex pole pair, and the overshoot a step gets from
 * it. Real poles have no overshoot and return null, which is the case the pane
 * footnotes rather than printing a zero.
 */
export function ringOf(poles) {
  const p = (poles || []).find((q) => Math.abs(q.im) > 1e-9)
  if (!p) return { zeta: null, overshoot: null }
  const zeta = -p.re / Math.hypot(p.re, p.im)
  if (!(zeta > 0 && zeta < 1)) return { zeta, overshoot: null }
  return { zeta, overshoot: 100 * Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)) }
}

/**
 * The amplitude of each harmonic of a trace, over one whole cycle of the
 * drive, by correlation against a sine and a cosine at that harmonic. The
 * walk is resampled on a uniform grid over the cycle, so the sum is the
 * discrete Fourier coefficient and not a quadrature of unevenly spaced events.
 */
export function harmonics(x, node, freq, count = 9, points = 512) {
  const T = 1 / freq
  const t0 = Math.max(0, x.tEnd - T)
  const ys = []
  for (let k = 0; k < points; k++) ys.push(x.tr.at(t0 + (k * T) / points).sol.v[node])
  const out = []
  for (let h = 1; h <= count; h++) {
    let re = 0
    let im = 0
    for (let k = 0; k < points; k++) {
      const a = (2 * Math.PI * h * k) / points
      re += ys[k] * Math.cos(a)
      im -= ys[k] * Math.sin(a)
    }
    out.push((2 * Math.hypot(re, im)) / points)
  }
  return out
}

/** Total harmonic distortion, as a percentage of the fundamental. */
export function thdOf(x, node, freq) {
  const h = harmonics(x, node, freq)
  const rest = Math.sqrt(h.slice(1).reduce((s, v) => s + v * v, 0))
  return (100 * rest) / h[0]
}

/**
 * Power delivered to a load over one cycle, and power taken from the two
 * supplies, both as means over that cycle. Efficiency is the ratio.
 */
export function powerOver(x, { load, supplies, freq, points = 512 }) {
  const T = 1 / freq
  const t0 = Math.max(0, x.tEnd - T)
  let out = 0
  let inn = 0
  for (let k = 0; k < points; k++) {
    const sol = x.tr.at(t0 + (k * T) / points).sol
    out += Math.abs(sol.p[load])
    for (const s of supplies) inn += Math.abs(sol.p[s])
  }
  return { load: out / points, supply: inn / points, efficiency: (100 * out) / inn }
}

/** |H| at one frequency, from polynomials. */
export const magAt = (tf, hz) => cx.cabs(evalTF(tf, [0, 2 * Math.PI * hz]))

/** The frequency at which |H| falls through one, by bisection over twelve decades. */
export function unityGain(tf, lo = 1, hi = 1e12) {
  if (magAt(tf, lo) < 1) return null
  let a = lo
  let b = hi
  for (let k = 0; k < 200; k++) {
    const m = Math.sqrt(a * b)
    if (magAt(tf, m) > 1) a = m
    else b = m
  }
  return Math.sqrt(a * b)
}

/** The poles of a transfer function, lowest frequency first. */
export const polesLowFirst = (tf) => polesOf(tf).sort((a, b) => a.hz - b.hz)

// ------------------------------------------------------------ the drawing
//
// A wider canvas than the Elements grid, because these circuits carry six to
// nine parts and a vertical element's label runs 65 px to its right. The
// schematic crops to what is drawn, so the empty part costs the reader
// nothing.
export const LW = 520
export const LH = 200

/** A vertical element centred between two rails, with the wires to each. */
export const vleg = (id, x, top, bot, flip = false) => {
  const y = (top + bot) / 2
  return [{ el: id, x, y, dir: 'v', flip }, wire(x, top, x, y - 20), wire(x, y + 20, x, bot)]
}

/** A horizontal element on a rail, with the wires out to each end. */
export const hspan = (id, x, y, left, right, flip = false) => [
  { el: id, x, y, dir: 'h', flip },
  wire(left, y, x - 20, y),
  wire(x + 20, y, right, y),
]

const TOPR = 45
const BOTR = 155

/**
 * The amplifier and its divider: the source on the left, the amplifier as a
 * leg in the middle with a caption saying what it senses, and the feedback
 * divider on the right between the output rail and ground.
 *
 * `extra` legs go between the amplifier and the divider, which is where the
 * pole of L3 and the ladder of L5 hang.
 */
function ampFrame({ amp = 'E1', caption, divider = true, outAt = 430, tap = 'n', extras = [], captionY = 186 }) {
  const items = [
    ...vleg('V1', 55, TOPR, BOTR),
    wire(55, TOPR, 120, TOPR),
    wire(55, BOTR, 120, BOTR),
    gnd(88, BOTR),
    node('in', 55, TOPR, 't'),
    ...vleg(amp, 175, TOPR, BOTR, true),
    wire(175, TOPR, 260, TOPR),
    wire(175, BOTR, 260, BOTR),
    { text: caption, x: 175, y: captionY },
    ...extras,
  ]
  if (divider) {
    items.push(
      node('out', outAt, TOPR, 't'),
      ...vleg('Rf', outAt, TOPR, 100),
      node(tap, outAt, 100, 'r'),
      ...vleg('Rg', outAt, 100, BOTR),
    )
  }
  return { w: LW, h: LH, items }
}

// ------------------------------------------------------------ the netlists

/** The amplifier of L1 and L2: one controlled source and one divider. */
const loopAmp = (p) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E, small: true },
    { type: 'VCVS', id: 'E1', nodes: ['out', 'gnd'], ctrl: ['in', 'n'], gain: p.A0 },
    { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: p.Rf },
    { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: p.Rg },
  ],
})

/** The same amplifier given a speed: a transconductance into one R and one C, then a buffer. */
const pacedAmp = (p) => {
  const rint = 1e6
  const g = p.A0 / rint
  return {
    elements: [
      { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'sine', amp: 0.01, freq: 1000 }, small: true },
      { type: 'VCCS', id: 'G1', nodes: ['gnd', 'x'], ctrl: ['in', 'n'], gain: g },
      { type: 'R', id: 'Rp', nodes: ['x', 'gnd'], value: rint },
      { type: 'C', id: 'Cp', nodes: ['x', 'gnd'], value: g / (2 * Math.PI * p.ft) },
      { type: 'VCVS', id: 'E1', nodes: ['out', 'gnd'], ctrl: ['x', 'gnd'], gain: 1 },
      { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: p.Rf },
      { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: p.Rg },
    ],
  }
}

/** The amplifier with both of its own port resistances, and a test source at the output. */
const portAmp = (p) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E, small: true },
    { type: 'R', id: 'Ri', nodes: ['in', 'n'], value: p.Ri },
    { type: 'VCVS', id: 'E1', nodes: ['x', 'gnd'], ctrl: ['in', 'n'], gain: p.A0 },
    { type: 'R', id: 'Ro', nodes: ['x', 'out'], value: p.Ro },
    { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: p.Rf },
    { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: p.Rg },
    { type: 'I', id: 'It', nodes: ['gnd', 'out'], value: p.It },
  ],
})

/** Three lag sections inside one loop, and the feedback drawn as its own block. */
const ladder = (p) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'sine', amp: 0.01, freq: 100 }, small: true },
    { type: 'VCVS', id: 'E1', nodes: ['a', 'gnd'], ctrl: ['in', 'n'], gain: p.A0 },
    { type: 'R', id: 'R1', nodes: ['a', 'b'], value: p.R },
    { type: 'C', id: 'C1', nodes: ['b', 'gnd'], value: p.C },
    { type: 'R', id: 'R2', nodes: ['b', 'c'], value: p.R },
    { type: 'C', id: 'C2', nodes: ['c', 'gnd'], value: p.C },
    { type: 'R', id: 'R3', nodes: ['c', 'out'], value: p.R },
    { type: 'C', id: 'C3', nodes: ['out', 'gnd'], value: p.C3 },
    { type: 'VCVS', id: 'Efb', nodes: ['n', 'gnd'], ctrl: ['out', 'gnd'], gain: 1 },
  ],
})

/** The op-amp buffer of L6, with its own output resistance and a test source on it. */
const buffer = (p) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E, small: true },
    { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['in', 'out'], gain: p.A0, rout: p.rout },
    { type: 'I', id: 'It', nodes: ['gnd', 'out'], value: p.It },
  ],
})

// ------------------------------------------------------------ the layouts

const ampLayout = (caption) => ampFrame({ caption })

/** L3: the transconductance, the pole that paces it, the buffer, and the divider under them. */
function pacedLayout() {
  return {
    w: 600,
    h: 250,
    items: [
      ...vleg('V1', 55, 45, 155),
      wire(55, 45, 170, 45),
      wire(55, 155, 170, 155),
      gnd(100, 155),
      node('in', 55, 45, 't'),
      ...vleg('G1', 170, 45, 155, true),
      { text: 'g · (v_in − v_n)', x: 170, y: 186 },
      node('x', 265, 45, 't'),
      ...vleg('Rp', 265, 45, 155),
      ...vleg('Cp', 360, 45, 155),
      wire(170, 45, 360, 45),
      wire(170, 155, 460, 155),
      ...vleg('E1', 460, 45, 155),
      gnd(410, 155),
      wire(460, 45, 545, 45),
      node('out', 545, 45, 't'),
      wire(545, 45, 545, 205),
      ...hspan('Rf', 490, 205, 430, 545),
      node('n', 430, 205, 'b'),
      ...hspan('Rg', 390, 205, 330, 430),
      gnd(330, 205),
    ],
  }
}

/** L4: the amplifier's own port resistances, and the test source that reads the output port. */
function portLayout() {
  return {
    w: 600,
    h: 275,
    items: [
      ...vleg('V1', 55, 45, 155),
      gnd(55, 155),
      node('in', 55, 45, 't'),
      ...hspan('Ri', 120, 45, 55, 185),
      node('n', 185, 45, 't'),
      wire(185, 45, 185, 225),
      ...vleg('E1', 280, 45, 155),
      node('x', 280, 45, 'l'),
      gnd(280, 155),
      { text: 'A₀ · (v_in − v_n)', x: 280, y: 186 },
      ...hspan('Ro', 340, 45, 280, 400),
      node('out', 400, 45, 't'),
      wire(400, 45, 470, 45),
      ...vleg('It', 470, 45, 155, true),
      gnd(470, 155),
      wire(400, 45, 400, 225),
      ...hspan('Rf', 320, 225, 185, 400),
      ...hspan('Rg', 120, 225, 60, 185),
      gnd(60, 225),
    ],
  }
}

/** L5: the amplifier, three lag sections in a row, and the feedback block that closes the loop. */
function ladderLayout() {
  return {
    w: 640,
    h: 260,
    items: [
      ...vleg('V1', 55, 45, 155),
      wire(55, 45, 110, 45),
      wire(55, 155, 110, 155),
      gnd(84, 155),
      node('in', 55, 45, 't'),
      ...vleg('E1', 150, 45, 155),
      wire(150, 155, 545, 155),
      { text: 'A₀ · (v_in − v_n)', x: 150, y: 186 },
      node('a', 150, 45, 't'),
      ...hspan('R1', 210, 45, 150, 250),
      node('b', 250, 45, 't'),
      ...vleg('C1', 250, 45, 155),
      ...hspan('R2', 310, 45, 250, 350),
      node('c', 350, 45, 't'),
      ...vleg('C2', 350, 45, 155),
      ...hspan('R3', 410, 45, 350, 450),
      node('out', 450, 45, 't'),
      ...vleg('C3', 450, 45, 155),
      ...vleg('Efb', 545, 45, 155),
      node('n', 545, 45, 't'),
      gnd(500, 155),
      { text: 'v_out, sent back', x: 545, y: 196 },
    ],
  }
}

/** L6: the buffer, its loop closed on itself, and the test source that reads its output. */
function bufferLayout() {
  return {
    w: 520,
    h: 200,
    items: [
      ...vleg('V1', 55, 45, 155),
      gnd(55, 155),
      node('in', 55, 45, 't'),
      wire(55, 45, 200, 45),
      wire(200, 45, 200, 78),
      { el: 'U1', x: 200, y: 90, invertTop: false },
      wire(238, 90, 330, 90),
      node('out', 330, 90, 'r'),
      wire(330, 90, 330, 145),
      wire(330, 145, 170, 145),
      wire(170, 145, 170, 102),
      wire(170, 102, 200, 102),
      wire(330, 90, 330, 45),
      wire(330, 45, 420, 45),
      ...vleg('It', 420, 45, 155, true),
      gnd(420, 155),
    ],
  }
}

// ------------------------------------------------------------ the knobs

const A0 = (def = 1e5) => chips(Gain('A0', 'Open-loop gain A₀', def), [1e3, 1e4, def])
const DIVIDER = [chips(R('Rf', 'R_f', 9000), [1000, 9000, 90000]), R('Rg', 'R_g', 1000)]

export const GROUP_L = [
  {
    id: 'l1',
    group: GROUP,
    name: 'The loop, broken',
    terms: ['returnratio', 'blackman'],
    params: [Vs('E', 'Input V₁', 1), A0(), ...DIVIDER],
    net: loopAmp,
    layout: ampLayout('A₀ · (v_in − v_n)'),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    headline: { path: 'v.out', label: 'v_out', unit: 'V' },
  },
  {
    id: 'l2',
    group: GROUP,
    name: 'Desensitivity, and what it costs',
    terms: ['desensitivity'],
    params: [Vs('E', 'Input V₁', 1), A0(), ...DIVIDER],
    net: loopAmp,
    layout: ampLayout('A₀ · (v_in − v_n)'),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    headline: { path: 'v.out', label: 'v_out', unit: 'V' },
  },
  {
    id: 'l3',
    group: GROUP,
    name: 'Gain and bandwidth, from the loop',
    terms: ['returnratio'],
    params: [chips(R('Rf', 'R_f', 10000), [1000, 10000, 100000]), R('Rg', 'R_g', 1000), A0(), chips(Freq('ft', 'Gain-bandwidth f_t', 1e6), [1e5, 1e6, 1e7])],
    net: pacedAmp,
    layout: pacedLayout(),
    show: 'ac',
    view: 'bode',
    views: ['reading', 'bode', 'pz', 'equations'],
    signal: { input: 'V1', output: 'out' },
    headline: { path: 'corner.high', label: 'f_3dB', unit: 'Hz' },
  },
  {
    id: 'l4',
    group: GROUP,
    name: 'What feedback does to the ports',
    terms: ['mixing', 'portresistance'],
    params: [
      Vs('E', 'Input V₁', 1),
      chips(Is('It', 'Test current I_t', 1e-6), [1e-6, 1e-4, 1e-3]),
      A0(),
      chips(R('Ri', 'Amplifier R_i', 1e6), [1e4, 1e6, 1e7]),
      chips(R('Ro', 'Amplifier R_o', 1000), [100, 1000, 10000]),
      ...DIVIDER,
    ],
    net: portAmp,
    layout: portLayout(),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    headline: { path: 'v.out', label: 'v_out', unit: 'V' },
  },
  {
    id: 'l5',
    group: GROUP,
    name: 'Two poles ring, three oscillate',
    terms: ['phasemargin', 'righthalfplane'],
    params: [
      chips(Gain('A0', 'Forward gain A₀', 8), [4, 8, 29]),
      chips(R('R', 'Section R', 10000), [1000, 10000, 100000]),
      chips(Cap('C', 'Sections one and two C', 10e-9), [1e-9, 10e-9, 100e-9]),
      chips(Cap('C3', 'Third section C₃', 10e-9), [1e-12, 10e-9, 100e-9]),
    ],
    net: ladder,
    layout: ladderLayout(),
    show: 'ac',
    view: 'pz',
    views: ['reading', 'pz', 'equations'],
    signal: { input: 'V1', output: 'out' },
    headline: { path: 'pole.1.hz', label: 'ringing f', unit: 'Hz' },
  },
  {
    id: 'l6',
    group: GROUP,
    name: 'The buffer, from the inside',
    terms: ['portresistance'],
    params: [
      Vs('E', 'Input V₁', 1),
      chips(Is('It', 'Test current I_t', 1e-3), [1e-6, 1e-4, 1e-3]),
      A0(),
      chips(R('rout', 'Amplifier R_out', 75), [10, 75, 1000]),
    ],
    net: buffer,
    layout: bufferLayout(),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    headline: { path: 'v.out', label: 'v_out', unit: 'V' },
  },
]
