// Group E: signal and bias take different paths.
//
// Group D held both of a transistor's voltages by hand. A circuit does not.
// It sets the operating point out of resistors and a supply, and then asks
// the same device to carry a signal on top of it. This group is about the
// first half of that, and about the one element that keeps the two apart.
//
// The four bias circuits are the course's four, in the order a textbook
// meets them. Fixed bias (E2) multiplies β straight into the answer.
// Degeneration (E3) divides it out. Temperature (E4) moves V_BE under both.
// A source resistor does for the MOSFET (E5) what an emitter resistor does
// for the BJT, and a current source (E6) removes β from the answer entirely.
//
// Which model is under each is chosen for what the experiment measures. E2,
// E3 and E5 use the piecewise models, whose closed forms are the ones a hand
// analysis writes. E1, E4 and E6 use the curve, because a fixed V_BE of 0.7 V
// has no temperature in it and no tangent to take.

import { isAt, thermalVoltage } from '@ee-labs/network'
import { Amp, Cap, Freq, Gain, Is, R, Temp, Vs, W, chips, gnd, node, wire } from '../knobs.js'
import { Early, H, Kn, tryPoint } from './d.js'

const GROUP = 'E · Signal and bias take different paths'

const RAIL = 16
const FLOOR = 186
const QX = 300
const QY = 100
const BASE = 280
const COL = 80
const EMIT = 120
const STACK = 340
const VT300 = thermalVoltage(300)

/** A transistor whose saturation current and thermal voltage follow the temperature knob. */
const deviceAt = (p, model = 'exp') => ({
  type: 'Q',
  id: 'Q1',
  nodes: ['c', 'b', 'e'],
  model,
  beta: p.beta,
  va: p.va ?? 100,
  is: isAt({ is: 1e-14 }, p.T ?? 300),
  vt: thermalVoltage(p.T ?? 300),
})

// ------------------------------------------------------------ the circuits

/** E1: the four-resistor stage, with the signal brought in through a capacitor. */
const coupled = (p) => ({
  elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: p.vcc },
    { type: 'R', id: 'R1', nodes: ['vcc', 'b'], value: p.R1 },
    { type: 'R', id: 'R2', nodes: ['b', 'gnd'], value: p.R2 },
    { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: p.RC },
    { type: 'R', id: 'RE', nodes: ['e', 'gnd'], value: p.RE },
    { type: 'V', id: 'Vs', nodes: ['s', 'gnd'], value: 0, wave: { kind: 'sine', amp: p.amp, freq: p.f }, small: true },
    { type: 'C', id: 'CC', nodes: ['s', 'b'], value: p.CC },
    { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'e'], model: 'exp', beta: p.beta, va: 100, is: 1e-14, vt: VT300 },
  ],
})

/** E2: one resistor from the supply to the base, and nothing holding the emitter. */
const fixedBias = (p) => ({
  elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: p.vcc },
    { type: 'R', id: 'RB', nodes: ['vcc', 'b'], value: p.RB },
    { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: p.RC },
    { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'regions', beta: p.beta, vbe: 0.7, vcesat: 0.2 },
  ],
})

/** E3 and E4: the divider, and the emitter resistor that turns β out of the answer. */
const divider = (p, model) => ({
  elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: p.vcc },
    { type: 'R', id: 'R1', nodes: ['vcc', 'b'], value: p.R1 },
    { type: 'R', id: 'R2', nodes: ['b', 'gnd'], value: p.R2 },
    { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: p.RC },
    { type: 'R', id: 'RE', nodes: ['e', 'gnd'], value: p.RE },
    model === 'regions' ? { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'e'], model: 'regions', beta: p.beta, vbe: 0.7, vcesat: 0.2 } : deviceAt(p),
  ],
})
const dividerRegions = (p) => divider(p, 'regions')
const dividerCurve = (p) => divider(p, 'exp')

/** E5: the same idea on a MOSFET, a gate held by a source and a resistor under the source terminal. */
const mosBias = (p) => ({
  elements: [
    { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: p.vdd },
    { type: 'R', id: 'RD', nodes: ['vdd', 'd'], value: p.RD },
    { type: 'V', id: 'VG', nodes: ['g', 'gnd'], value: p.vg },
    { type: 'R', id: 'RS', nodes: ['s', 'gnd'], value: p.RS },
    { type: 'M', id: 'M1', nodes: ['d', 'g', 's'], vt: p.vt, kn: p.kn, lambda: 0 },
  ],
})

/** E6: the emitter current set by a source, so nothing about the device sets it. */
const sourceBias = (p) => ({
  elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: p.vcc },
    { type: 'V', id: 'VEE', nodes: ['vee', 'gnd'], value: -p.vcc },
    { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: p.RC },
    { type: 'R', id: 'RB', nodes: ['b', 'gnd'], value: p.RB },
    { type: 'I', id: 'IE', nodes: ['e', 'vee'], value: p.ie },
    deviceAt(p),
  ],
})

// ------------------------------------------------------------ the drawings
//
// The transistor sits where Group D put it, at (300, 100) drawn horizontally,
// so a reader who has learnt one stage's picture reads the next four at once.
// The supply hangs on the left, the collector load and the emitter resistor
// stack on the right at x = 340, and the bias network is the middle column.

const device = (id = 'Q1') => [{ el: id, x: QX, y: QY }, wire(312, COL, STACK, COL), wire(312, EMIT, STACK, EMIT)]
const upper = (id) => [wire(STACK, RAIL, STACK, 22), { el: id, x: STACK, y: 42, dir: 'v' }, wire(STACK, 62, STACK, COL)]
const lower = (id) => [wire(STACK, EMIT, STACK, 138), { el: id, x: STACK, y: 158, dir: 'v' }, wire(STACK, 178, STACK, FLOOR)]
const supply = (id, x = 40) => [{ el: id, x, y: 100, dir: 'v' }, wire(x, RAIL, x, 80), wire(x, 120, x, FLOOR)]
const rails = (x0 = 40, x1 = STACK) => [wire(x0, RAIL, x1, RAIL), wire(x0, FLOOR, x1, FLOOR)]
const ports = () => [node('c', STACK, COL, 'r'), node('e', STACK, EMIT, 'r')]

const dividerLayout = (extra = []) => ({
  w: W,
  h: H,
  items: [
    ...device(),
    ...upper('RC'),
    ...lower('RE'),
    ...rails(),
    ...supply('VCC'),
    node('vcc', 110, RAIL, 't'),
    ...ports(),
    { el: 'R1', x: 210, y: 42, dir: 'v' },
    wire(210, RAIL, 210, 22),
    wire(210, 62, 210, QY),
    { el: 'R2', x: 210, y: 158, dir: 'v' },
    wire(210, QY, 210, 138),
    wire(210, 178, 210, FLOOR),
    wire(210, QY, BASE, QY),
    node('b', 245, QY, 't'),
    gnd(120, FLOOR),
    ...extra,
  ],
})

const coupledLayout = () => ({
  w: W,
  h: H,
  items: [
    ...device(),
    ...upper('RC'),
    ...lower('RE'),
    ...rails(),
    { el: 'VCC', x: 40, y: 60, dir: 'v' },
    wire(40, RAIL, 40, 40),
    wire(40, 80, 40, FLOOR),
    node('vcc', 110, RAIL, 't'),
    ...ports(),
    { el: 'R1', x: 210, y: 42, dir: 'v' },
    wire(210, RAIL, 210, 22),
    wire(210, 62, 210, QY),
    { el: 'R2', x: 210, y: 158, dir: 'v' },
    wire(210, QY, 210, 138),
    wire(210, 178, 210, FLOOR),
    wire(210, QY, BASE, QY),
    node('b', 245, QY, 't'),
    { el: 'Vs', x: 110, y: 150, dir: 'v' },
    wire(110, 130, 110, QY),
    wire(110, 170, 110, FLOOR),
    node('s', 110, QY, 'l'),
    { el: 'CC', x: 150, y: QY, dir: 'h' },
    wire(110, QY, 130, QY),
    wire(170, QY, 210, QY),
    gnd(265, FLOOR),
  ],
})

const fixedLayout = () => ({
  w: W,
  h: H,
  items: [
    ...device(),
    ...upper('RC'),
    wire(STACK, EMIT, STACK, FLOOR),
    ...rails(),
    ...supply('VCC'),
    node('vcc', 110, RAIL, 't'),
    node('c', STACK, COL, 'r'),
    { el: 'RB', x: 210, y: 42, dir: 'v' },
    wire(210, RAIL, 210, 22),
    wire(210, 62, 210, QY),
    wire(210, QY, BASE, QY),
    node('b', 245, QY, 't'),
    gnd(180, FLOOR),
  ],
})

const mosLayout = () => ({
  w: W,
  h: H,
  items: [
    ...device('M1'),
    ...upper('RD'),
    ...lower('RS'),
    ...rails(),
    ...supply('VDD'),
    node('vdd', 110, RAIL, 't'),
    node('d', STACK, COL, 'r'),
    node('s', STACK, EMIT, 'r'),
    { el: 'VG', x: 210, y: 140, dir: 'v' },
    wire(210, 120, 210, QY),
    wire(210, 160, 210, FLOOR),
    wire(210, QY, BASE, QY),
    node('g', 245, QY, 't'),
    gnd(120, FLOOR),
  ],
})

const sourceLayout = () => ({
  w: W,
  h: H,
  items: [
    ...device(),
    ...upper('RC'),
    wire(STACK, EMIT, STACK, 130),
    { el: 'IE', x: STACK, y: 150, dir: 'v' },
    wire(STACK, 170, STACK, FLOOR),
    ...rails(),
    node('vcc', 150, RAIL, 't'),
    node('vee', 150, FLOOR, 'b'),
    node('c', STACK, COL, 'r'),
    node('e', STACK, EMIT, 'r'),
    { el: 'VCC', x: 40, y: 60, dir: 'v' },
    wire(40, RAIL, 40, 40),
    wire(40, 80, 40, 101),
    { el: 'VEE', x: 40, y: 145, dir: 'v', flip: true },
    wire(40, 125, 40, 101),
    wire(40, 165, 40, FLOOR),
    wire(40, 101, 75, 101),
    gnd(75, 101),
    { el: 'RB', x: 150, y: 132, dir: 'v' },
    wire(150, QY, 150, 112),
    wire(150, 152, 150, 166),
    gnd(150, 166),
    wire(150, QY, BASE, QY),
    node('b', 215, QY, 't'),
  ],
})

// ------------------------------------------------------------ the pictures
//
// One picture for the bias groups: the device's own curve at the base drive
// this circuit settles on, and the resistor line the supply and the two
// resistors draw across it. Both come out of the solver. The curve is the
// same device on a bench, driven by the base current the bias circuit was
// measured to deliver, so the point where the two meet is the point the
// circuit found.

const POINTS = 33
const span = (lo, hi, n = POINTS) => Array.from({ length: n }, (_, k) => lo + ((hi - lo) * k) / (n - 1))

/** The device of `make(p)`, put on a bench and swept in v_CE at a fixed base current. */
function benchCurve(q, ib, xs) {
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
    out.xs.push(v)
    out.ys.push(Math.max(0, r.point.Q1.ic))
  }
  return out
}

/**
 * A family of curves, one per setting of the knob the experiment varies, each
 * at the base current that setting's own bias circuit delivers, with the DC
 * load line the supply and the two resistors draw.
 */
function biasCurves(make, key, values, p, x) {
  const xs = span(0, p.vcc)
  const family = []
  for (const value of values) {
    const q = { ...p, [key]: value }
    const bias = tryPoint(make(q))
    if (!bias || !bias.point.Q1) continue
    const el = make(q).elements.find((e) => e.type === 'Q')
    family.push({ ...benchCurve(el, bias.point.Q1.ib, xs), lit: value === p[key] })
  }
  const load = { xs: [0, p.vcc], ys: [p.vcc / (p.RC + (p.RE ?? 0)), 0] }
  return { family, load, point: x.point.Q1 ? { x: x.point.Q1.vce, y: x.point.Q1.ic } : null, xLabel: 'v_CE (V)', yLabel: 'i_C (A)' }
}

const fixedCurves = (p, x) => biasCurves(fixedBias, 'beta', [50, 100, 150, 200], p, x)
const dividerCurves = (p, x) => biasCurves(dividerRegions, 'beta', [50, 100, 150, 200], p, x)
const tempCurves = (p, x) => biasCurves(dividerCurve, 'T', [250, 300, 350, 400], p, x)

// ------------------------------------------------------------ the knobs

const BETA = chips(Gain('beta', 'Current gain β', 100), [50, 100, 200])
const VCC = (def) => chips(Vs('vcc', 'Supply V_CC', def), [5, 10, 15])
const QLABEL = { Q1: 'Q1' }
const MLABEL = { M1: 'M1' }

export const GROUP_E = [
  {
    id: 'e1',
    group: GROUP,
    name: 'The coupling capacitor',
    terms: ['coupling'],
    params: [
      chips(Cap('CC', 'Coupling C_C', 10e-6), [1e-7, 1e-6, 10e-6]),
      chips(Freq('f', 'Signal frequency', 1000), [1.7476, 10, 1000]),
      chips(Amp('amp', 'Source amplitude', 0.001), [0.001, 0.005, 0.01]),
      R('R1', 'Upper divider R₁', 55600),
      R('R2', 'Lower divider R₂', 12200),
      R('RC', 'Collector R_C', 5000),
      R('RE', 'Emitter R_E', 1000),
      VCC(10),
      BETA,
    ],
    net: coupled,
    layout: coupledLayout(),
    labels: QLABEL,
    show: 'both',
    view: 'bode',
    views: ['reading', 'bode', 'pz', 'equations'],
    signal: { input: 'Vs', output: 'b' },
    at: 1000,
    probe: (p) => p.f,
    headline: { path: 'corner.low', label: 'f_L', unit: 'Hz' },
  },
  {
    id: 'e2',
    group: GROUP,
    name: 'Fixed bias multiplies β into the answer',
    terms: ['fixedbias'],
    params: [BETA, chips(R('RB', 'Base resistor R_B', 1.3e6), [0.65e6, 1.3e6, 2.6e6]), chips(R('RC', 'Collector R_C', 10000), [5000, 10000, 20000]), VCC(15)],
    net: fixedBias,
    layout: fixedLayout(),
    labels: QLABEL,
    show: 'dc',
    view: 'curves',
    views: ['reading', 'curves', 'equations'],
    curves: fixedCurves,
    headline: { path: 'op.Q1.ic', label: 'I_C', unit: 'A' },
  },
  {
    id: 'e3',
    group: GROUP,
    name: 'Emitter degeneration holds the point',
    terms: ['degeneration'],
    params: [
      BETA,
      chips(R('RE', 'Emitter R_E', 1000), [100, 1000, 4000]),
      R('R1', 'Upper divider R₁', 55600),
      R('R2', 'Lower divider R₂', 12200),
      chips(R('RC', 'Collector R_C', 5000), [2000, 5000, 10000]),
      VCC(10),
    ],
    net: dividerRegions,
    layout: dividerLayout(),
    labels: QLABEL,
    show: 'dc',
    view: 'curves',
    views: ['reading', 'curves', 'equations'],
    curves: dividerCurves,
    headline: { path: 'op.Q1.ic', label: 'I_C', unit: 'A' },
  },
  {
    id: 'e4',
    group: GROUP,
    name: 'Temperature moves the bias point',
    terms: [],
    params: [
      chips(Temp('T', 'Temperature T', 300), [250, 300, 350]),
      chips(R('RE', 'Emitter R_E', 1000), [10, 1000, 4000]),
      chips(R('R2', 'Lower divider R₂', 12200), [4200, 12200, 20000]),
      R('R1', 'Upper divider R₁', 55600),
      chips(R('RC', 'Collector R_C', 5000), [2000, 5000, 10000]),
      VCC(10),
      BETA,
      chips(Early('va', 'Early voltage V_A', 100), [25, 100, 400]),
    ],
    net: dividerCurve,
    layout: dividerLayout(),
    labels: QLABEL,
    show: 'dc',
    view: 'curves',
    views: ['reading', 'curves', 'equations'],
    curves: tempCurves,
    headline: { path: 'op.Q1.ic', label: 'I_C', unit: 'A' },
  },
  {
    id: 'e5',
    group: GROUP,
    name: 'MOSFET bias and the threshold spread',
    terms: ['thresholdspread'],
    params: [
      chips(Vs('vt', 'Threshold V_t', 0.7), [0.7, 0.8, 0.9]),
      chips(R('RS', 'Source resistor R_S', 2500), [1, 1000, 2500]),
      chips(Vs('vg', 'Gate voltage V_G', 1.9), [0.9, 1.4, 1.9]),
      chips(R('RD', 'Drain resistor R_D', 5000), [2000, 5000, 10000]),
      chips(Kn('kn', 'Transconductance k_n', 20e-3), [5e-3, 20e-3, 80e-3]),
      chips(Vs('vdd', 'Supply V_DD', 5), [5, 10, 15]),
    ],
    net: mosBias,
    layout: mosLayout(),
    labels: MLABEL,
    show: 'dc',
    view: 'transfer',
    views: ['reading', 'transfer', 'equations'],
    sweepOver: { key: 'vg', from: 0, to: 3, points: 121, label: 'V_G' },
    headline: { path: 'op.M1.id_', label: 'I_D', unit: 'A' },
  },
  {
    id: 'e6',
    group: GROUP,
    name: 'Bias from a current source',
    terms: ['currentsourcebias'],
    params: [
      chips(Is('ie', 'Emitter current I_E', 1e-3), [0.5e-3, 1e-3, 2e-3]),
      BETA,
      chips(Temp('T', 'Temperature T', 300), [250, 300, 350]),
      chips(R('RC', 'Collector R_C', 5000), [2000, 5000, 10000]),
      R('RB', 'Base resistor R_B', 10000),
      VCC(10),
    ],
    net: sourceBias,
    layout: sourceLayout(),
    labels: QLABEL,
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    headline: { path: 'op.Q1.ic', label: 'I_C', unit: 'A' },
  },
]
