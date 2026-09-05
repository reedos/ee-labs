// Group D: the transistor as a controlled source.
//
// The first six groups worked with elements whose law is written in one
// variable. A transistor's is written in two, and every picture in this group
// is that second variable made visible: a family of curves instead of a line,
// a region instead of a slope, a point where a load line crosses a curve.
//
// Two devices and four models. The BJT arrives as Ebers–Moll (D1, D2), which
// is two of Circuit Elements Lab's junctions and one controlled source, and
// then as the three straight lines a hand analysis uses (D3, D5, D7). The
// MOSFET arrives as the square law (D4, D6). Which model is in use is a knob
// wherever both apply, and the experiment that compares them prints the gap.
//
// Node order on every device is the datasheet's, [collector, base, emitter]
// and [drain, gate, source], and the node names are the brief's, so a reading
// path written here means the same thing in Groups E and beyond.

import { newtonDC, normalize, pointsOf, solvePWL, thermalVoltage } from '@ee-labs/network'
import { BJT_MODEL, Gain, Is, R, W, chips, gnd, node, wire } from '../knobs.js'

const GROUP = 'D · The transistor as a controlled source'

// The canvas is the Elements lab's 420 wide, and taller than its 180: a
// transistor is three terminals with a rail above and a rail below, and the
// glyph's label and reading hang 34 off its centre instead of 24.
export const H = 206
const RAIL = 16
const FLOOR = 186

/**
 * The knobs this group needs that the shared set has no shape for.
 *
 * Each range is the range the device model describes rather than the range
 * the field could hold. A junction drive above a volt is an exponential of
 * forty and a threshold of −13 V is a device nobody built, and a knob that
 * can reach those makes the panel's own checks meaningless where it does.
 */
export const Early = (key, label, def, hint) => ({ key, label, unit: 'V', min: 1, max: 1000, scale: 'log', default: def, hint })
export const Lambda = (key, label, def, hint) => ({ key, label, unit: '1/V', min: 0, max: 0.1, scale: 'linear', default: def, hint })
export const Kn = (key, label, def, hint) => ({ key, label, unit: 'A/V²', min: 1e-4, max: 0.2, scale: 'log', default: def, hint })
export const Drive = (key, label, def, hint) => ({ key, label, unit: 'V', min: 0, max: 0.9, scale: 'linear', default: def, hint })
export const Gate = (key, label, def, hint) => ({ key, label, unit: 'V', min: 0, max: 3, scale: 'linear', default: def, hint })
export const Rail = (key, label, def, hint) => ({ key, label, unit: 'V', min: 0.05, max: 24, scale: 'linear', default: def, hint })
export const Thresh = (key, label, def, hint) => ({ key, label, unit: 'V', min: 0.2, max: 1.5, scale: 'linear', default: def, hint })
export const In = (key, label, def, hint) => ({ key, label, unit: 'V', min: 0, max: 5, scale: 'linear', default: def, hint })

/** One operating point, by whichever method the models in the circuit need. */
export function pointOf(net) {
  const norm = normalize(net)
  const curved = norm.elements.some(
    (e) => (e.type === 'Q' && (e.model ?? 'regions') === 'exp') || (e.type === 'M' && (e.model ?? 'square') === 'square') || (e.type === 'D' && e.model === 'exp'),
  )
  const op = curved ? newtonDC(norm, {}) : solvePWL(norm, {})
  return { op, sol: op.sol, point: pointsOf(norm, op) }
}

/** The same, returning null where the circuit has no answer, for drawing a family. */
export function tryPoint(net) {
  try {
    return pointOf(net)
  } catch {
    return null
  }
}

// ------------------------------------------------------------ the circuits

/**
 * The device on a bench: one source across the emitter junction, one across
 * the collector, and nothing else. Both of the transistor's own voltages are
 * then set by hand, which is what a curve tracer does and what D1 and D2 need.
 */
const probe = (p) => ({
  elements: [
    { type: 'V', id: 'VBE', nodes: ['b', 'gnd'], value: p.vbe },
    { type: 'V', id: 'VCC', nodes: ['c', 'gnd'], value: p.vcc },
    { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'exp', beta: p.beta, va: p.va ?? Infinity, is: p.is ?? 1e-14, vt: thermalVoltage(300) },
  ],
})

/** The same bench with the base fed a current instead of a voltage, so that both models run. */
const drivenBase = (p) => ({
  elements: [
    { type: 'I', id: 'IB', nodes: ['gnd', 'b'], value: p.ib },
    { type: 'V', id: 'VCE', nodes: ['c', 'gnd'], value: p.vce },
    { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: p.model, beta: p.beta, va: p.va, is: 1e-14, vt: thermalVoltage(300) },
  ],
})

/** The MOSFET on the same bench: gate and drain each held by a source. */
const mosProbe = (p) => ({
  elements: [
    { type: 'V', id: 'VGS', nodes: ['g', 'gnd'], value: p.vgs },
    { type: 'V', id: 'VDS', nodes: ['d', 'gnd'], value: p.vds },
    { type: 'M', id: 'M1', nodes: ['d', 'g', 'gnd'], vt: p.vt, kn: p.kn, lambda: p.lam },
  ],
})

/** A load driven from cutoff to saturation: the switch of D5. */
const switched = (p) => ({
  elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: p.vcc },
    { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: p.RC },
    { type: 'V', id: 'Vin', nodes: ['in', 'gnd'], value: p.vin },
    { type: 'R', id: 'RB', nodes: ['in', 'b'], value: p.RB },
    { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'regions', beta: p.beta, vbe: 0.7, vcesat: 0.2 },
  ],
})

/** The CMOS inverter of D6, matched, both devices on the same gate node. */
const inverter = (p) => ({
  elements: [
    { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: 5 },
    { type: 'V', id: 'Vin', nodes: ['in', 'gnd'], value: p.vin },
    { type: 'M', id: 'Mp', nodes: ['out', 'in', 'vdd'], polarity: 'p', vt: p.vt, kn: p.kn, lambda: 0 },
    { type: 'M', id: 'Mn', nodes: ['out', 'in', 'gnd'], polarity: 'n', vt: p.vt, kn: p.kn, lambda: 0 },
  ],
})

/** The load line of D7: a collector resistor, and a base current to slide along it. */
const loaded = (p) => ({
  elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: p.vcc },
    { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: p.RC },
    { type: 'I', id: 'IB', nodes: ['gnd', 'b'], value: p.ib },
    { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: p.model, beta: p.beta, va: p.va, is: 1e-14, vt: thermalVoltage(300) },
  ],
})

// ------------------------------------------------------------ the drawings
//
// One idiom under all of them. The transistor sits at (300, 100) drawn
// horizontally, so its base is at (280, 100), its collector at (312, 80) and
// its emitter at (312, 120). Both output leads run sideways to x = 340 before
// they turn, which keeps the rails clear of the glyph's own label and reading.

const QX = 300
const QY = 100
const BASE = [280, QY]
const COL = [312, 80]
const EMIT = [312, 120]
const STACK = 340

/** The transistor, its two output leads, and the turn each of them makes. */
const device = (id = 'Q1') => [
  { el: id, x: QX, y: QY },
  wire(COL[0], COL[1], STACK, COL[1]),
  wire(EMIT[0], EMIT[1], STACK, EMIT[1]),
]

/** A vertical element between the top rail and the collector's turn. */
const upper = (id) => [wire(STACK, RAIL, STACK, 22), { el: id, x: STACK, y: 42, dir: 'v' }, wire(STACK, 62, STACK, COL[1])]

/**
 * The same drawing moved sideways. The three bench circuits carry no supply
 * rail on the left, so drawn at the shared width they would sit against the
 * right edge with a sixth of the frame empty. `PW` is the frame they need.
 */
const shift = (items, dx) =>
  items.map((it) => {
    if (it.wire) return { wire: [it.wire[0] + dx, it.wire[1], it.wire[2] + dx, it.wire[3]] }
    if (it.gnd) return { gnd: [it.gnd[0] + dx, it.gnd[1]] }
    return { ...it, x: it.x + dx }
  })
const PW = W - 60
const bench = (items) => ({ w: PW, h: H, items: shift(items, -60) })

const probeLayout = () =>
  bench([
    ...device(),
    // The collector's source hangs off the same turn the load would use.
    wire(STACK, COL[1], STACK, 80),
    { el: 'VCC', x: STACK, y: 100, dir: 'v' },
    wire(STACK, 120, STACK, FLOOR),
    node('c', 250, COL[1], 't'),
    // The base source, and the wire that carries it across.
    { el: 'VBE', x: 120, y: 140, dir: 'v' },
    wire(120, 120, 120, QY),
    wire(120, QY, BASE[0], QY),
    wire(120, 160, 120, FLOOR),
    node('b', 190, QY, 't'),
    wire(120, FLOOR, STACK, FLOOR),
    gnd(230, FLOOR),
  ])

const drivenLayout = () =>
  bench([
    ...device(),
    wire(STACK, COL[1], STACK, 80),
    { el: 'VCE', x: STACK, y: 100, dir: 'v' },
    wire(STACK, 120, STACK, FLOOR),
    node('c', 250, COL[1], 't'),
    { el: 'IB', x: 120, y: 140, dir: 'v', flip: true },
    wire(120, 120, 120, QY),
    wire(120, QY, BASE[0], QY),
    wire(120, 160, 120, FLOOR),
    node('b', 190, QY, 't'),
    wire(120, FLOOR, STACK, FLOOR),
    gnd(230, FLOOR),
  ])

const mosLayout = () =>
  bench([
    { el: 'M1', x: QX, y: QY },
    wire(COL[0], COL[1], STACK, COL[1]),
    wire(EMIT[0], EMIT[1], STACK, EMIT[1]),
    wire(STACK, COL[1], STACK, 80),
    { el: 'VDS', x: STACK, y: 100, dir: 'v' },
    wire(STACK, 120, STACK, FLOOR),
    node('d', 250, COL[1], 't'),
    { el: 'VGS', x: 120, y: 140, dir: 'v' },
    wire(120, 120, 120, QY),
    wire(120, QY, BASE[0], QY),
    wire(120, 160, 120, FLOOR),
    node('g', 190, QY, 't'),
    wire(120, FLOOR, STACK, FLOOR),
    gnd(230, FLOOR),
  ])

const switchLayout = () => ({
  w: W,
  h: H,
  items: [
    ...device(),
    ...upper('RC'),
    wire(STACK, EMIT[1], STACK, FLOOR),
    node('c', 250, COL[1], 't'),
    node('vcc', 150, RAIL, 't'),
    wire(40, RAIL, STACK, RAIL),
    { el: 'VCC', x: 40, y: 100, dir: 'v' },
    wire(40, RAIL, 40, 80),
    wire(40, 120, 40, FLOOR),
    { el: 'RB', x: 200, y: QY, dir: 'h' },
    wire(220, QY, BASE[0], QY),
    wire(120, QY, 180, QY),
    node('b', 250, QY, 'b'),
    node('in', 120, QY, 't'),
    { el: 'Vin', x: 120, y: 140, dir: 'v' },
    wire(120, 120, 120, QY),
    wire(120, 160, 120, FLOOR),
    wire(40, FLOOR, STACK, FLOOR),
    gnd(240, FLOOR),
  ],
})

const loadLineLayout = () => ({
  w: W,
  h: H,
  items: [
    ...device(),
    ...upper('RC'),
    wire(STACK, EMIT[1], STACK, FLOOR),
    node('c', 250, COL[1], 't'),
    node('vcc', 150, RAIL, 't'),
    wire(40, RAIL, STACK, RAIL),
    { el: 'VCC', x: 40, y: 100, dir: 'v' },
    wire(40, RAIL, 40, 80),
    wire(40, 120, 40, FLOOR),
    { el: 'IB', x: 150, y: 140, dir: 'v', flip: true },
    wire(150, 120, 150, QY),
    wire(150, QY, BASE[0], QY),
    wire(150, 160, 150, FLOOR),
    node('b', 220, QY, 't'),
    wire(40, FLOOR, STACK, FLOOR),
    gnd(250, FLOOR),
  ],
})

/**
 * The inverter: two devices in a column between the rails, the p-channel above
 * and the n-channel below, both gates on the same input node.
 */
const inverterLayout = () => ({
  w: W,
  h: H,
  items: [
    wire(40, RAIL, 300, RAIL),
    node('vdd', 150, RAIL, 't'),
    { el: 'VDD', x: 40, y: 100, dir: 'v' },
    wire(40, RAIL, 40, 80),
    wire(40, 120, 40, FLOOR),
    { el: 'Mp', x: 260, y: 56 },
    wire(272, 36, 300, 36),
    wire(300, 36, 300, RAIL),
    wire(272, 76, 300, 76),
    { el: 'Mn', x: 260, y: 146 },
    wire(272, 126, 300, 126),
    wire(300, 76, 300, 126),
    wire(272, 166, 300, 166),
    wire(300, 166, 300, FLOOR),
    node('out', 340, 101, 'r'),
    wire(300, 101, 340, 101),
    { el: 'Vin', x: 120, y: 140, dir: 'v' },
    wire(120, 120, 120, 101),
    wire(120, 101, 240, 101),
    wire(240, 56, 240, 146),
    node('in', 180, 101, 't'),
    wire(120, 160, 120, FLOOR),
    wire(40, FLOOR, 300, FLOOR),
    gnd(210, FLOOR),
  ],
})

// ------------------------------------------------------------ the pictures
//
// A curve family is one solve per point, so the picture and the operating
// point come out of the same solver rather than out of a formula written
// beside it. The counts below are what a phone can draw and a test can run.

const POINTS = 33
const span = (lo, hi, n = POINTS) => Array.from({ length: n }, (_, k) => lo + ((hi - lo) * k) / (n - 1))

/**
 * i_C against v_CE for one setting of the base drive, as far as the circuit
 * solves. The x written down is the device's own measured v_CE and not the
 * source that was turned, because a bench holds the two equal and a circuit
 * with a load in it does not. A point drawn at the source's value on an axis
 * named v_CE would be a curve of the supply wearing the device's label.
 */
function collectorCurve(make, p, over, xs) {
  const out = { xs: [], ys: [] }
  for (const v of xs) {
    const r = tryPoint(make({ ...p, ...over, vcc: v, vce: v }))
    if (!r) continue
    const pt = r.point.Q1 || r.point.M1
    out.xs.push(r.point.Q1 ? pt.vce : pt.vds)
    out.ys.push(Math.max(0, r.point.Q1 ? pt.ic : pt.id_))
  }
  return out
}

/**
 * The device of a circuit put on a bench, swept in v_CE at a fixed base
 * current. This is what a curve tracer draws, and it is the only way to reach
 * the flat part of a curve whose own circuit never takes it there. Settings
 * the model has no answer for are left out rather than guessed at, so the
 * three-region model's curve begins at its own knee.
 */
export function benchCurve(q, ib, xs) {
  const out = { xs: [], ys: [] }
  for (const v of xs) {
    const r = tryPoint({
      elements: [
        { type: 'I', id: 'IB', nodes: ['gnd', 'b'], value: Math.max(ib, 1e-12) },
        { type: 'V', id: 'VCE', nodes: ['c', 'gnd'], value: v },
        { ...q, nodes: ['c', 'b', 'gnd'] },
      ],
    })
    if (!r || !r.point.Q1) continue
    out.xs.push(r.point.Q1.vce)
    out.ys.push(Math.max(0, r.point.Q1.ic))
  }
  return out
}

/** D1 and D2: a family stepped in v_BE, 20 mV apart about the setting on the knob. */
function bjtFamily(p, x) {
  const xs = span(0, Math.max(1, 2 * p.vcc))
  const steps = [-2, -1, 0, 1, 2].map((k) => p.vbe + 0.02 * k)
  return {
    family: steps.map((vbe) => ({ ...collectorCurve(probe, p, { vbe }, xs), lit: vbe === p.vbe })),
    point: x.point.Q1 ? { x: x.point.Q1.vce, y: x.point.Q1.ic } : null,
    xLabel: 'v_CE (V)',
    yLabel: 'i_C (A)',
  }
}

/** D3: the same axes, one curve per model, so the gap between them is the picture. */
function modelFamily(p, x) {
  const xs = span(0, Math.max(1, 2 * p.vce))
  const family = ['exp', 'regions'].map((model) => ({
    ...collectorCurve(drivenBase, p, { model }, xs),
    lit: model === p.model,
  }))
  return {
    family,
    point: x.point.Q1 ? { x: x.point.Q1.vce, y: x.point.Q1.ic } : null,
    xLabel: 'v_CE (V)',
    yLabel: 'i_C (A)',
  }
}

/** D4: i_D against v_DS stepped in v_GS, with the triode boundary drawn through the knees. */
function mosFamily(p, x) {
  const xs = span(0, Math.max(0.5, 2 * p.vds))
  const steps = [-0.1, -0.05, 0, 0.05, 0.1].map((k) => p.vgs + k)
  const family = steps.map((vgs) => {
    const out = { xs: [], ys: [], lit: vgs === p.vgs }
    for (const v of xs) {
      const r = tryPoint(mosProbe({ ...p, vgs, vds: v }))
      if (!r) continue
      out.xs.push(v)
      out.ys.push(Math.max(0, r.point.M1.id_))
    }
    return out
  })
  // v_DS = V_OV is where every curve turns, and on that line i_D is ½k_n v_DS².
  // It is drawn only as far as the largest overdrive in the family, because
  // past that no curve has a knee for it to pass through. Carried further it
  // climbs as the square while the curves stay flat, and it would set the
  // frame's height at a current no curve on the plane reaches.
  const ovMax = Math.min(Math.max(...xs), Math.max(0, ...steps.map((vgs) => vgs - p.vt)))
  const edge = { xs: [], ys: [] }
  for (const v of span(0, ovMax, 17)) {
    edge.xs.push(v)
    edge.ys.push(0.5 * p.kn * v * v * (1 + p.lam * v))
  }
  return { family, load: edge, point: x.point.M1 ? { x: x.point.M1.vds, y: x.point.M1.id_ } : null, xLabel: 'v_DS (V)', yLabel: 'i_D (A)' }
}

/**
 * D5 and D7: the curve family, and the resistor's straight line across it.
 *
 * The curves come off the same device on a bench, one per base current, over
 * the whole span the supply allows. Sweeping the circuit's own supply instead
 * would trace only the part of each curve that supply can reach, which for a
 * saturated switch is the vertical edge alone. The line is Ohm's law for
 * everything outside the device, so the two meet where the circuit sits.
 */
function loadLineCurves(make, p, x, currents) {
  const xs = span(0, p.vcc)
  const q = make(p).elements.find((e) => e.type === 'Q')
  const family = currents.map(({ ib, lit }) => ({ ...benchCurve(q, ib, xs), lit: !!lit }))
  const load = { xs: [0, p.vcc], ys: [p.vcc / p.RC, 0] }
  return { family, load, point: x.point.Q1 ? { x: x.point.Q1.vce, y: x.point.Q1.ic } : null, xLabel: 'v_CE (V)', yLabel: 'i_C (A)' }
}

// A curve of the switch is taken at a base current rather than a base voltage,
// because that is what the drive resistor delivers. The family is stepped in
// fractions of that current rather than of the drive, so that it spans the
// load line instead of stacking four saturated curves on top of each other.
const switchCurves = (p, x) => {
  const ib = Math.max(1e-9, (p.vin - 0.7) / p.RB)
  const steps = [0.05, 0.1, 0.25, 1].map((k) => ({ ib: k * ib, lit: k === 1 }))
  return { ...loadLineCurves(switched, p, x, steps), ib }
}

const loadLineD7 = (p, x) => loadLineCurves(loaded, p, x, [0.25, 0.5, 1, 2, 3].map((k) => ({ ib: k * p.ib, lit: k === 1 })))

/**
 * The inverter's noise margins: the two inputs where the transfer curve's
 * slope is exactly −1. Bisected on the slope of the solved curve rather than
 * read off a grid, so the answer does not depend on how many points are drawn.
 */
export function inverterMargins(p) {
  const vout = (v) => {
    const r = tryPoint(inverter({ ...p, vin: v }))
    return r ? r.sol.v.out : NaN
  }
  const slope = (v) => {
    const h = 2e-3
    return (vout(v + h) - vout(v - h)) / (2 * h)
  }
  const vm = 5 / 2
  const find = (lo, hi) => {
    let a = lo
    let b = hi
    if (!Number.isFinite(slope(a)) || !Number.isFinite(slope(b))) return NaN
    for (let k = 0; k < 40; k++) {
      const m = (a + b) / 2
      if (slope(m) > -1) a = m
      else b = m
    }
    return (a + b) / 2
  }
  return { vil: find(p.vt + 0.05, vm - 0.05), vih: find(5 - p.vt - 0.05, vm + 0.05), vm }
}

// ------------------------------------------------------------ the knobs

// The drawn label is the reference designator alone. A transistor's label
// hangs over the run of its own output lead, so a longer one would be written
// across that lead. The polarity is in the glyph's arrow, the model is on its
// own knob, and the region is in the topbar and the reading pane.
const QLABEL = { Q1: 'Q1' }
const MLABEL = { M1: 'M1' }

const BETA = (def = 100) => chips(Gain('beta', 'Current gain β', def), [50, 100, 200])
const VA = chips(Early('va', 'Early voltage V_A', 100), [25, 100, 400])
const VT_KNOB = chips(Thresh('vt', 'Threshold V_t', 0.7), [0.5, 0.7, 0.9])
const KN = chips(Kn('kn', 'Transconductance k_n', 20e-3), [5e-3, 20e-3, 80e-3])

export const GROUP_D = [
  {
    id: 'd1',
    group: GROUP,
    name: 'Two junctions and a thin base',
    terms: ['ebersmoll', 'currentgain', 'operatingpoint'],
    params: [chips(Drive('vbe', 'Base drive v_BE', 0.65479), [0.6, 0.65479, 0.7]), chips(Rail('vcc', 'Collector supply v_CE', 5), [2, 5, 10]), BETA()],
    net: probe,
    labels: QLABEL,
    layout: probeLayout(),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'curves', 'equations'],
    curves: bjtFamily,
    headline: { path: 'op.Q1.ic', label: 'I_C', unit: 'A' },
  },
  {
    id: 'd2',
    group: GROUP,
    name: 'The curves, and what their slope means',
    terms: ['earlyvoltage', 'outputresistance'],
    params: [chips(Drive('vbe', 'Base drive v_BE', 0.65479), [0.6, 0.65479, 0.71432]), chips(Rail('vcc', 'Collector supply v_CE', 5), [2, 5, 10]), BETA(), VA],
    net: probe,
    labels: QLABEL,
    layout: probeLayout(),
    show: 'dc',
    view: 'curves',
    views: ['reading', 'curves', 'equations'],
    curves: bjtFamily,
    headline: { path: 'op.Q1.ro', label: 'r_o', unit: 'Ω' },
  },
  {
    id: 'd3',
    group: GROUP,
    name: 'Three regions, and the model with three lines',
    terms: ['threeregions'],
    params: [
      BJT_MODEL('exp', 'the curve, or the three straight lines a hand analysis uses'),
      chips(Is('ib', 'Base current i_B', 10e-6), [1e-6, 10e-6, 100e-6]),
      chips(Rail('vce', 'Collector voltage v_CE', 5), [0.1, 1, 5]),
      BETA(),
      VA,
    ],
    net: drivenBase,
    labels: QLABEL,
    layout: drivenLayout(),
    show: 'dc',
    view: 'curves',
    views: ['reading', 'curves', 'equations'],
    curves: modelFamily,
    headline: { path: 'op.Q1.ic', label: 'I_C', unit: 'A' },
  },
  {
    id: 'd4',
    group: GROUP,
    name: 'The MOSFET’s curves and the square law',
    terms: ['squarelaw', 'overdrive', 'channelmod'],
    params: [
      chips(Gate('vgs', 'Gate drive v_GS', 0.9), [0.8, 0.9, 1.2]),
      chips(Rail('vds', 'Drain voltage v_DS', 2), [0.1, 0.2, 2]),
      VT_KNOB,
      KN,
      chips(Lambda('lam', 'Channel modulation λ', 0.02), [0, 0.02, 0.05]),
    ],
    net: mosProbe,
    labels: MLABEL,
    layout: mosLayout(),
    show: 'dc',
    view: 'curves',
    views: ['reading', 'curves', 'equations'],
    curves: mosFamily,
    headline: { path: 'op.M1.id_', label: 'I_D', unit: 'A' },
  },
  {
    id: 'd5',
    group: GROUP,
    name: 'The transistor as a switch',
    terms: ['forcedbeta'],
    params: [
      chips(Rail('vin', 'Drive v_in', 5), [0.05, 1, 5]),
      chips(R('RB', 'Base resistor R_B', 10000), [10000, 100000, 1000000]),
      chips(R('RC', 'Load R_C', 1000), [500, 1000, 5000]),
      chips(Rail('vcc', 'Supply V_CC', 10), [5, 10, 15]),
      BETA(),
    ],
    net: switched,
    labels: QLABEL,
    layout: switchLayout(),
    show: 'dc',
    view: 'curves',
    views: ['reading', 'curves', 'equations'],
    curves: switchCurves,
    headline: { path: 'op.Q1.vce', label: 'V_CE', unit: 'V' },
  },
  {
    id: 'd6',
    group: GROUP,
    name: 'The CMOS inverter, and its noise margins',
    terms: ['noisemargin', 'matching'],
    params: [chips(In('vin', 'Input v_in', 2.5), [0, 2.5, 5]), VT_KNOB, KN],
    net: inverter,
    labels: { Mp: 'Mp', Mn: 'Mn' },
    layout: inverterLayout(),
    show: 'dc',
    view: 'transfer',
    views: ['reading', 'transfer', 'equations'],
    sweepOver: { key: 'vin', from: 0, to: 5, points: 161, label: 'v_in' },
    headline: { path: 'v.out', label: 'v_out', unit: 'V' },
  },
  {
    id: 'd7',
    group: GROUP,
    name: 'The load line, and the point on it',
    terms: ['loadline'],
    params: [
      chips(Is('ib', 'Base current i_B', 10e-6), [1e-6, 10e-6, 20e-6]),
      chips(R('RC', 'Load R_C', 5000), [2000, 5000, 10000]),
      chips(Rail('vcc', 'Supply V_CC', 10), [5, 10, 15]),
      BJT_MODEL('regions', 'the three straight lines, or the curve underneath them'),
      BETA(),
      VA,
    ],
    net: loaded,
    labels: QLABEL,
    layout: loadLineLayout(),
    show: 'dc',
    view: 'curves',
    views: ['reading', 'curves', 'equations'],
    curves: loadLineD7,
    headline: { path: 'op.Q1.vce', label: 'V_CE', unit: 'V' },
  },
]
