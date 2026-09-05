// Group H: the single-stage amplifiers.
//
// Every stage here is the same transistor at the same operating point, wired
// three ways. Which terminal takes the signal in and which passes it out is
// the whole difference between them, and it sets the gain, the input
// resistance and the output resistance. Those three numbers are what Group I
// cascades, so each one is measured here by its definition rather than quoted
// from a formula.
//
// The bias is an ideal source at the base, the emitter or the gate, set by
// `vbeFor` or `vgsFor` to put the collector current exactly where the knob
// asks. That is deliberate. A resistor divider puts its own resistance across
// the input port and hides the number this group is about, and the divider is
// Group E's subject rather than this one's. So an input resistance measured
// here is the transistor's own.
//
// Two measurements have no quantity path in lessons.js, because each is made
// by a method rather than read off one solve. A port resistance is a test
// source at the port with the ratio read off. Harmonic distortion is a sine
// mapped through the quasi-static characteristic, one exact solve per sample.
// Both are functions here, and every lesson that quotes one names the
// function it came from.
//
// The drawings use a 480 by 200 canvas rather than the 420 by 180 of Groups A
// and C. A transistor glyph spans the full ±20 on both axes and hangs its
// label below it and its reading above it, so it needs a clear column about
// 44 wide and 80 tall, which is more than a two-terminal element asks for.

import { NetworkError, normalize, smallSignal, solveDC, thermalVoltage } from '@ee-labs/network'
import { solvePoint } from '../math.js'
import { Amp, Freq, Gain, Is, R, Toggle, Vs, chips, gnd, node, wire } from '../knobs.js'

const GROUP = 'H · Single-stage amplifiers'

/** The canvas these drawings share. */
export const W = 480
export const H = 200
/** The three rails every bipolar drawing hangs from. */
export const TOP = 30
export const MID = 105
export const BOT = 160

/** The thermal voltage the group is written against, 25.9 mV at 300 K. */
export const VT = thermalVoltage(300)

/** The lab's transistor, the plan's §4.3 device. */
export const NPN = { beta: 100, va: 100, is: 1e-14 }

/** The supply every bipolar stage in the group runs from. */
export const VCC = 10
/** The supply the two MOSFET stages run from. */
export const VDD = 5

/**
 * The base-emitter voltage that puts `ic` through the exponential model at
 * `vce`. Inverting the transport law rather than typing 0.7 V is what lets the
 * bias follow the current knob, so that every g_m below is I_C/V_T at the
 * current the knob asks for.
 */
export const vbeFor = ({ ic, is = NPN.is, n = 1, vt = VT, va = NPN.va, vce }) => n * vt * Math.log(1 + ic / is / (1 + vce / va))

/** A MOSFET's drain current at an overdrive, the square law with its slope. */
export const idOf = ({ kn, vov, lambda = 0, vds = 0 }) => 0.5 * kn * vov * vov * (1 + lambda * vds)

// ------------------------------------------------------------ measurement

/** The tangent netlist of a solved experiment, whether or not it asked for one. */
const tangent = (x) => (x.ss ? x.ss.elements : smallSignal(x.norm, x.op, {}).elements)

/** A source with nothing left in it: the small-signal netlist's zero. */
const killed = (e) => (e.type === 'V' || e.type === 'I' ? { ...e, value: 0, wave: undefined } : e)

/**
 * A port resistance, by the one method that still works when a dependent
 * source is inside: kill every source, push one amp into the port, and read
 * the volts that appear. `drop` names the elements to lift off the port
 * first, so that "the resistance looking into the base" is not measured with
 * the source resistance wired across it.
 *
 * A port with nothing conductive on it has no solution, and that is the
 * answer rather than a failure: an ideal current source looking out of a
 * collector has an infinite output resistance, and I1 with the Early effect
 * switched off is exactly that circuit.
 */
export function portR(x, at, drop = []) {
  const els = tangent(x)
    .filter((e) => !drop.includes(e.id))
    .map(killed)
  els.push({ type: 'I', id: '__test', nodes: ['gnd', at], value: 1 })
  try {
    return solveDC(normalize({ elements: els })).v[at]
  } catch (err) {
    if (err instanceof NetworkError && err.code === 'singular') return Infinity
    throw err
  }
}

/**
 * The small-signal gain between two nodes of the tangent netlist, measured by
 * holding `from` at one volt. This is the stage's own gain, with whatever the
 * signal passed through to reach that node left out of it.
 */
export function gainFrom(x, from, out, drop = []) {
  const els = tangent(x)
    .filter((e) => !drop.includes(e.id))
    .map(killed)
  els.push({ type: 'V', id: '__drive', nodes: [from, 'gnd'], value: 1 })
  return solveDC(normalize({ elements: els })).v[out]
}

/**
 * The harmonics of the output when a sine of amplitude `amp` is mapped through
 * the stage's quasi-static characteristic: one exact solve per sample, then a
 * discrete transform of what comes out. This is route 2 of the plan's §2.8,
 * and it describes an input slow enough that no capacitor matters. Every stage
 * in this group is resistive, so that holds at any frequency here.
 */
export function harmonics(exp, p, { key, amp, node: out, points = 32 }) {
  const y = []
  for (let k = 0; k < points; k++) y.push(solvePoint(exp.net({ ...p, [key]: amp * Math.sin((2 * Math.PI * k) / points) })).sol.v[out])
  const coef = (n) => {
    let re = 0
    let im = 0
    for (let k = 0; k < points; k++) {
      const th = (2 * Math.PI * n * k) / points
      re += y[k] * Math.cos(th)
      im += y[k] * Math.sin(th)
    }
    return (2 / points) * Math.hypot(re, im)
  }
  const [c1, c2, c3] = [coef(1), coef(2), coef(3)]
  return { c1, c2, c3, hd2: c2 / c1, hd3: c3 / c1 }
}

/** The second-harmonic distortion of a stage, in per cent. */
export const hd2Of = (exp, p, opts) => 100 * harmonics(exp, p, opts).hd2

// ------------------------------------------------------------ knobs

/** A MOSFET's transconductance parameter, which has a unit no other knob uses. */
const Kn = (key, label, def, hint) => ({ key, label, unit: 'A/V²', min: 1e-4, max: 1, scale: 'log', default: def, hint })

const IC = () => chips(Is('ic', 'Collector current I_C', 1e-3), [0.25e-3, 1e-3, 1.5e-3])
const BETA = () => chips(Gain('beta', 'Current gain β', NPN.beta), [50, 100, 200])
const VA = () => chips(Gain('va', 'Early voltage V_A', NPN.va, 'in volts'), [25, 100, 1000])
const RCK = () => chips(R('RC', 'Collector R_C', 5000), [1000, 5000, 20000])
const DRIVE = () => Vs('vin', 'Input v_in', 0, 'the signal, riding on the bias')
const VTK = () => Vs('vt', 'Threshold V_t', 0.7)
const KNK = () => chips(Kn('kn', 'Transconductance k_n', 20e-3), [5e-3, 20e-3, 80e-3])
const VOV = (presets = [0.1, 0.2, 0.4]) => chips(Amp('vov', 'Overdrive V_OV', 0.2), presets)
const LAM = () => chips(Amp('lambda', 'Channel modulation λ', 0.02, 'per volt'), [0.005, 0.02, 0.08])

// ------------------------------------------------------------ netlists

const npn = (p, nodes, over = {}) => ({ type: 'Q', id: 'Q1', nodes, model: 'exp', beta: p.beta, va: p.va, is: NPN.is, ...over })
const nmos = (p, nodes) => ({ type: 'M', id: 'M1', nodes, model: 'square', vt: p.vt, kn: p.kn, lambda: p.lambda })

/** The common-emitter stage, with an emitter resistance that may be absent. */
export function ceStage(p, RE = 0) {
  const va = p.early === false ? Infinity : p.va
  const ie = (p.ic * (p.beta + 1)) / p.beta
  const ve = ie * RE
  const vce = VCC - p.ic * p.RC - ve
  const vbb = vbeFor({ ic: p.ic, va, vce }) + ve
  const els = [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: VCC },
    { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: p.RC },
    { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: vbb },
    { type: 'V', id: 'Vs', nodes: ['b', 'bb'], value: p.vin, small: true },
    npn(p, ['c', 'b', RE ? 'e' : 'gnd'], { va }),
  ]
  if (RE) els.splice(4, 0, { type: 'R', id: 'RE', nodes: ['e', 'gnd'], value: RE })
  return { elements: els }
}

/** The emitter follower: the collector on the supply, the load in the emitter. */
export function follower(p) {
  const ie = (p.ic * (p.beta + 1)) / p.beta
  const ve = ie * p.RL
  const vbb = vbeFor({ ic: p.ic, va: p.va, vce: VCC - ve }) + ve + (p.ic / p.beta) * p.Rs
  return { elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: VCC },
    { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: vbb },
    { type: 'V', id: 'Vs', nodes: ['s', 'bb'], value: p.vin, small: true },
    { type: 'R', id: 'Rs', nodes: ['s', 'b'], value: p.Rs },
    { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
    npn(p, ['vcc', 'b', 'out']),
  ] }
}

/** The common-base stage: the signal drives the emitter and the base is held. */
export function commonBase(p) {
  const ie = (p.ic * (p.beta + 1)) / p.beta
  const vce = VCC - p.ic * p.RC - ie * p.Rs
  const vbb = vbeFor({ ic: p.ic, va: p.va, vce }) + ie * p.Rs
  return { elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: VCC },
    { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: p.RC },
    { type: 'V', id: 'VBB', nodes: ['b', 'gnd'], value: vbb },
    { type: 'V', id: 'Vs', nodes: ['s', 'gnd'], value: p.vin, small: true },
    { type: 'R', id: 'Rs', nodes: ['s', 'e'], value: p.Rs },
    npn(p, ['c', 'b', 'e']),
  ] }
}

/** The common-source stage, the MOSFET's common emitter. */
export function commonSource(p) {
  return { elements: [
    { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: VDD },
    { type: 'R', id: 'RD', nodes: ['vdd', 'd'], value: p.RD },
    { type: 'V', id: 'VGG', nodes: ['gg', 'gnd'], value: p.vt + p.vov },
    { type: 'V', id: 'Vs', nodes: ['g', 'gg'], value: p.vin, small: true },
    nmos(p, ['d', 'g', 'gnd']),
  ] }
}

/** The source follower, whose source node is also the common-gate input port. */
export function sourceFollower(p) {
  const flat = idOf({ kn: p.kn, vov: p.vov })
  const id = idOf({ kn: p.kn, vov: p.vov, lambda: p.lambda, vds: VDD - flat * p.RL })
  return { elements: [
    { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: VDD },
    { type: 'V', id: 'VGG', nodes: ['gg', 'gnd'], value: p.vt + p.vov + id * p.RL },
    { type: 'V', id: 'Vs', nodes: ['g', 'gg'], value: p.vin, small: true },
    { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
    nmos(p, ['vdd', 'g', 'out']),
  ] }
}

/**
 * The stage H7 drives hard: the same collector load, a base resistance in
 * front of the transistor, and a sine large enough to run out of supply at one
 * end and out of transistor at the other. R_B is what makes the three-region
 * model an amplifier at all. That model pins v_BE at 0.7 V, so what R_B lets
 * through is the base current, and β times it is the collector current.
 */
export function clipper(p) {
  return { elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: VCC },
    { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: p.RC },
    { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: 0.7 + (p.ic / p.beta) * p.RB + p.vin },
    { type: 'V', id: 'Vs', nodes: ['s', 'bb'], wave: { kind: 'sine', amp: p.amp, freq: p.f }, small: true },
    { type: 'R', id: 'RB', nodes: ['s', 'b'], value: p.RB },
    { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: p.model, beta: p.beta, va: p.va, is: NPN.is },
  ] }
}

// ------------------------------------------------------------ drawings
//
// One shape, shared. The supply runs down the left edge to its own ground. The
// device sits at (360, 105) with its collector or drain load up the right edge
// to the top rail. The bias chain runs along the middle rail where it fits and
// along a lower rail at y = 145 where a series resistance has to fit beside
// it, because three node labels and three symbols do not share one rail with a
// transistor.

/** A device's label is its id alone, so a lead can leave a pin without landing on the writing. */
export const IDS = { Q1: 'Q1', Q2: 'Q2', Q3: 'Q3', M1: 'M1' }

const DEV = 360
const CPIN = DEV + 12

/** The supply on the left, from the top rail down to its own ground. */
const supply = (id, gy = BOT) => [
  { el: id, x: 45, y: 60, dir: 'v' },
  wire(45, TOP, 45, 40),
  wire(45, 80, 45, gy),
  gnd(45, gy),
  node(id === 'VCC' ? 'vcc' : 'vdd', 200, TOP, 't'),
  wire(45, TOP, 410, TOP),
]

/** The collector or drain load: up the right edge to the top rail, with the output node. */
const load = (id, out) => [
  wire(CPIN, 85, 410, 85),
  wire(410, 105, 410, 80),
  { el: id, x: 410, y: 60, dir: 'v' },
  wire(410, 40, 410, TOP),
  node(out, 410, 105, 'r'),
]

/** The bias chain along the middle rail, straight into the device's control pin. */
const midChain = (biasId, bbNode, ctrlNode) => [
  { el: biasId, x: 105, y: MID, dir: 'h' },
  wire(85, MID, 70, MID),
  wire(70, MID, 70, BOT),
  wire(45, BOT, 70, BOT),
  wire(125, MID, 155, MID),
  node(bbNode, 155, MID, 't'),
  { el: 'Vs', x: 200, y: MID, dir: 'h' },
  wire(155, MID, 180, MID),
  wire(220, MID, DEV - 20, MID),
  node(ctrlNode, 280, MID, 't'),
]

/** The emitter or source straight down to its own ground. */
const toGround = [wire(CPIN, 125, CPIN, 175), gnd(CPIN, 175)]

/** The emitter or source into a resistance of its own, on the way to ground. */
const legLoad = (id, outNode) => [
  wire(CPIN, 125, CPIN, 142),
  node(outNode, CPIN, 133, 'r'),
  { el: id, x: CPIN, y: 162, dir: 'v' },
  gnd(CPIN, 182),
]

/**
 * The lower rail at y = 145: the bias source, its node, the signal source, its
 * node, and the series resistance, ending under the device's control pin.
 */
const lowChain = (biasId, bbNode, sNode, seriesId, ctrlNode) => [
  { el: biasId, x: 80, y: 145, dir: 'h' },
  wire(60, 145, 45, 145),
  wire(100, 145, 160, 145),
  node(bbNode, 130, 145, 't'),
  { el: 'Vs', x: 180, y: 145, dir: 'h' },
  wire(200, 145, 250, 145),
  node(sNode, 225, 145, 't'),
  { el: seriesId, x: 270, y: 145, dir: 'h' },
  wire(290, 145, DEV - 20, 145),
  node(ctrlNode, 315, 145, 't'),
  wire(DEV - 20, 145, DEV - 20, MID),
]

/** The common-emitter drawing, with the emitter resistor when there is one. */
function ceLayout(withRE) {
  const items = [...supply('VCC'), ...load('RC', 'c'), { el: 'Q1', x: DEV, y: MID, dir: 'h' }, ...midChain('VBB', 'bb', 'b')]
  items.push(...(withRE ? legLoad('RE', 'e') : toGround))
  return { w: W, h: H, items, labels: IDS }
}

/** The common-source drawing, the same shape with a MOSFET in it. */
function csLayout(withRL) {
  const items = [...supply('VDD'), { el: 'M1', x: DEV, y: MID, dir: 'h' }, ...midChain('VGG', 'gg', 'g')]
  if (withRL) items.push(wire(CPIN, 85, 410, 85), wire(410, 85, 410, TOP), ...legLoad('RL', 'out'))
  else items.push(...load('RD', 'd'), ...toGround)
  return { w: W, h: H, items, labels: IDS }
}

/** The emitter follower: the collector on the top rail, the load under the emitter. */
function followerLayout() {
  return { w: W, h: H, items: [
    ...supply('VCC', 175),
    wire(CPIN, 85, 410, 85),
    wire(410, 85, 410, TOP),
    { el: 'Q1', x: DEV, y: MID, dir: 'h' },
    ...lowChain('VBB', 'bb', 's', 'Rs', 'b'),
    ...legLoad('RL', 'out'),
  ], labels: IDS }
}

/** The common base: the base held by its own supply, the signal into the emitter. */
function commonBaseLayout() {
  return { w: W, h: H, items: [
    ...supply('VCC'),
    ...load('RC', 'c'),
    { el: 'Q1', x: DEV, y: MID, dir: 'h' },
    wire(DEV - 20, MID, 325, MID),
    wire(325, MID, 325, 70),
    node('b', 325, 90, 'l'),
    wire(325, 70, 255, 70),
    { el: 'VBB', x: 235, y: 70, dir: 'h' },
    wire(215, 70, 100, 70),
    wire(100, 70, 100, 175),
    gnd(100, 175),
    wire(CPIN, 125, CPIN, 145),
    wire(CPIN, 145, 290, 145),
    node('e', 315, 145, 't'),
    { el: 'Rs', x: 270, y: 145, dir: 'h' },
    wire(250, 145, 190, 145),
    node('s', 215, 145, 't'),
    { el: 'Vs', x: 168, y: 145, dir: 'h' },
    wire(148, 145, 135, 145),
    wire(135, 145, 135, 175),
    gnd(135, 175),
  ], labels: IDS }
}

/** The stage driven into both limits, with the base resistance in front of it. */
function clipLayout() {
  return { w: W, h: H, items: [
    ...supply('VCC', 175),
    ...load('RC', 'c'),
    { el: 'Q1', x: DEV, y: MID, dir: 'h' },
    ...lowChain('VBB', 'bb', 's', 'RB', 'b'),
    ...toGround,
  ], labels: IDS }
}

// ------------------------------------------------------------ the experiments

export const GROUP_H = [
  {
    id: 'h1',
    group: GROUP,
    name: 'The common emitter, and its three numbers',
    terms: ['commonemitter', 'transconductance', 'inputresistance', 'outputresistance'],
    params: [IC(), RCK(), BETA(), VA(), Toggle('early', 'Early effect', true, 'on', 'off', 'with it off, r_o is infinite and the tangent is the textbook’s'), DRIVE()],
    net: (p) => ceStage(p),
    layout: ceLayout(false),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'transfer', 'equations'],
    signal: { input: 'Vs', output: 'c' },
    sweepOver: { key: 'vin', from: -0.04, to: 0.04, label: 'v_in' },
    small: 'Vs',
    headline: { path: 'gain', label: 'A_v', unit: '' },
  },
  {
    id: 'h2',
    group: GROUP,
    name: 'Emitter degeneration trades gain for linearity',
    terms: ['degeneration', 'distortion'],
    params: [
      chips(R('RE', 'Emitter R_E', 100), [1, 100, 1000]),
      chips(Amp('amp', 'Drive amplitude', 5e-3), [1e-3, 5e-3, 2e-2]),
      IC(),
      RCK(),
      BETA(),
      VA(),
      DRIVE(),
    ],
    net: (p) => ceStage(p, p.RE),
    layout: ceLayout(true),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'transfer', 'equations'],
    signal: { input: 'Vs', output: 'c' },
    sweepOver: { key: 'vin', from: -0.1, to: 0.1, label: 'v_in' },
    small: 'Vs',
    headline: { path: 'gain', label: 'A_v', unit: '' },
  },
  {
    id: 'h3',
    group: GROUP,
    name: 'The emitter follower buys resistance, not gain',
    terms: ['follower'],
    params: [chips(R('RL', 'Load R_L', 1000), [200, 1000, 3000]), chips(R('Rs', 'Source R_s', 1000), [10, 1000, 4000]), IC(), BETA(), VA(), DRIVE()],
    net: follower,
    layout: followerLayout(),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'transfer', 'equations'],
    signal: { input: 'Vs', output: 'out' },
    sweepOver: { key: 'vin', from: -1, to: 1, label: 'v_in' },
    small: 'Vs',
    headline: { path: 'gain', label: 'A_v', unit: '' },
  },
  {
    id: 'h4',
    group: GROUP,
    name: 'The common base has a low input resistance',
    terms: ['commonbase'],
    params: [chips(R('Rs', 'Source R_s', 1000), [10, 1000, 3000]), RCK(), IC(), BETA(), VA(), DRIVE()],
    net: commonBase,
    layout: commonBaseLayout(),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'transfer', 'equations'],
    signal: { input: 'Vs', output: 'c' },
    sweepOver: { key: 'vin', from: -0.05, to: 0.05, label: 'v_in' },
    small: 'Vs',
    headline: { path: 'gain', label: 'A_v', unit: '' },
  },
  {
    id: 'h5',
    group: GROUP,
    name: 'The common source, and a gate that draws nothing',
    terms: ['commonsource'],
    params: [chips(R('RD', 'Drain R_D', 10000), [2000, 10000, 20000]), VOV([0.1, 0.15, 0.2]), KNK(), VTK(), LAM(), DRIVE()],
    net: commonSource,
    layout: csLayout(false),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'transfer', 'equations'],
    signal: { input: 'Vs', output: 'd' },
    sweepOver: { key: 'vin', from: -0.2, to: 0.2, label: 'v_in' },
    small: 'Vs',
    headline: { path: 'gain', label: 'A_v', unit: '' },
  },
  {
    id: 'h6',
    group: GROUP,
    name: 'One port, two names: follower out, gate in',
    terms: ['sourcefollower'],
    params: [chips(R('RL', 'Load R_L', 1000), [100, 1000, 10000]), VOV(), KNK(), VTK(), LAM(), DRIVE()],
    net: sourceFollower,
    layout: csLayout(true),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'transfer', 'equations'],
    signal: { input: 'Vs', output: 'out' },
    sweepOver: { key: 'vin', from: -0.4, to: 0.4, label: 'v_in' },
    small: 'Vs',
    headline: { path: 'gain', label: 'A_v', unit: '' },
  },
  {
    id: 'h7',
    group: GROUP,
    name: 'Swing, and the two ends it runs into',
    terms: ['swing', 'clipping'],
    params: [
      chips(Amp('amp', 'Drive amplitude', 0.03), [0.01, 0.03, 0.1]),
      chips(R('RB', 'Base R_B', 2700), [1000, 2700, 10000]),
      RCK(),
      IC(),
      BETA(),
      VA(),
      { key: 'f', label: 'Frequency', unit: 'Hz', min: 100, max: 1e5, scale: 'log', default: 1000 },
      Vs('vin', 'Bias shift', 0, 'moves the operating point along the load line'),
      {
        key: 'model',
        label: 'Transistor model',
        kind: 'choice',
        default: 'regions',
        options: [
          { value: 'regions', label: 'three regions' },
          { value: 'exp', label: 'curve' },
        ],
        hint: 'the curve has an operating point but no closed-form response in time',
      },
    ],
    net: clipper,
    layout: clipLayout(),
    show: 'dc',
    view: 'scope',
    views: ['reading', 'scope', 'transfer', 'equations'],
    sweepOver: { key: 'vin', from: -0.1, to: 0.1, label: 'bias shift', read: (sol) => sol.v.c },
    window: (p) => 2 / p.f,
    cursor: 0.25,
    scope: { traces: [{ q: 'v', key: 'c', label: 'v_out' }, { q: 'v', key: 's', label: 'v_in' }] },
    headline: { path: 'clip.low.c', label: 'lowest v_out', unit: 'V' },
  },
]
