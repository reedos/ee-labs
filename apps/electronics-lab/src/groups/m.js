// Group M: inside the op-amp.
//
// Group A showed the op-amp's limits as toggles on a box. This group builds
// the box out of transistors and derives the numbers those toggles carry:
// the open-loop gain, the input and output resistances, the gain-bandwidth
// product, the phase margin, the slew rate, the offset and the bias current,
// and the output stage's distortion.
//
// One circuit carries M1, M2, M3 and M5. It is the two-stage amplifier every
// bipolar op-amp is: a pnp differential pair biased by a tail current source,
// an npn current mirror as its load, an npn common-emitter second stage, and
// one capacitor from that stage's input to its output. The feedback network
// is a controlled source of gain β, which is what makes the loop gain of the
// whole amplifier one number that `returnRatio` can read. At β = 0 the loop
// is open and the amplifier is measured on its own.
//
// M4 and M6 need waveforms in time, and the exponential model is declined
// there for the reason `diode.js` gives. Both use the three-region model,
// which is piecewise-linear, so `pwlTransient` solves them exactly.
//
// Drawing a five-transistor amplifier. `packages/ui`'s transistor symbol puts
// the base or gate on one side and the two output leads on the other, and
// `flip` turns the whole glyph through 180°. Two devices of the same kind
// therefore always have their bases on the same side, so one base of a
// differential pair always faces inward. Where a wire from such a pin would
// have to cross the circuit, the connection is made by a node dot with the
// same name at both ends, which is the net-label convention. A name repeated
// on two dots is one node.

import { R, chips, gnd, node, wire } from '../knobs.js'
import { hspan, vleg } from './l.js'

const GROUP = 'M · Inside the op-amp'

/** The amplifier's own numbers: the tail, the loads, and the two capacitors. */
export const OPAMP_M = { itail: 15e-6, rc1: 93e3, rc: 100e3, cc: 30e-12, cl: 100e-12, beta: 100, va: 100 }

// ------------------------------------------------------------ the netlists

/**
 * The two-stage op-amp. `p.fb` is the feedback factor: 0 opens the loop, 1
 * makes a unity-gain follower, 0.1 an amplifier of ten. `p.ratio` is the
 * mismatch in the second input transistor's saturation current, which is
 * where the input offset comes from.
 */
export const twoStage = (p) => ({
  elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
    { type: 'V', id: 'VEE', nodes: ['vee', 'gnd'], value: -10 },
    { type: 'I', id: 'It', nodes: ['vcc', 'e'], value: p.itail },
    { type: 'V', id: 'Vin', nodes: ['inp', 'gnd'], value: p.vin ?? 0, small: true },
    { type: 'Q', id: 'Q1', nodes: ['c1', 'inn', 'e'], polarity: 'pnp', model: 'exp', beta: p.beta, va: p.va },
    { type: 'Q', id: 'Q2', nodes: ['c2', 'inp', 'e'], polarity: 'pnp', model: 'exp', beta: p.beta, va: p.va, is: 1e-14 * (p.ratio ?? 1) },
    { type: 'Q', id: 'Q3', nodes: ['c1', 'c1', 'vee'], polarity: 'npn', model: 'exp', beta: p.beta, va: p.va },
    { type: 'Q', id: 'Q4', nodes: ['c2', 'c1', 'vee'], polarity: 'npn', model: 'exp', beta: p.beta, va: p.va },
    { type: 'Q', id: 'Q5', nodes: ['out', 'c2', 'vee'], polarity: 'npn', model: 'exp', beta: p.beta, va: p.va },
    { type: 'R', id: 'RC', nodes: ['vcc', 'out'], value: p.rc },
    { type: 'C', id: 'Cc', nodes: ['c2', 'out'], value: p.cc },
    { type: 'C', id: 'CL', nodes: ['out', 'gnd'], value: p.cl },
    { type: 'VCVS', id: 'Efb', nodes: ['inn', 'gnd'], ctrl: ['out', 'gnd'], gain: p.fb },
  ],
})

/**
 * The first stage steering all of its tail into the compensation capacitor.
 * The tail steps on at t = 0, which is what a large input step does to the
 * pair: one side takes the whole current and the other takes none. The
 * transistor is on the three-region model, so the ramp and the instant it
 * ends are both exact.
 */
export const slewStage = (p) => ({
  elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
    { type: 'V', id: 'VEE', nodes: ['vee', 'gnd'], value: -10 },
    { type: 'I', id: 'It', nodes: ['vcc', 'e'], wave: { kind: 'step', from: 0, to: p.itail } },
    { type: 'Q', id: 'Q2', nodes: ['c2', 'gnd', 'e'], polarity: 'pnp', model: 'regions', beta: p.beta },
    { type: 'R', id: 'RC', nodes: ['c2', 'vee'], value: p.rc },
    { type: 'R', id: 'Rs', nodes: ['c2', 'cx'], value: 100 },
    { type: 'C', id: 'Cc', nodes: ['cx', 'gnd'], value: p.cc },
  ],
})

/**
 * The output stage: one npn sourcing, one pnp sinking, each with a ballast
 * resistor in its emitter. `p.vbias` is half the voltage held between the two
 * bases, so 0 V is class B with its dead band and 0.7 V is the class AB the
 * two forward-biased diodes of a real stage give.
 */
export const outputStage = (p) => ({
  elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: p.vsup },
    { type: 'V', id: 'VEE', nodes: ['vee', 'gnd'], value: -p.vsup },
    { type: 'V', id: 'Vin', nodes: ['in', 'gnd'], wave: { kind: 'sine', amp: p.amp, freq: p.f } },
    { type: 'V', id: 'Vbn', nodes: ['bn', 'in'], value: p.vbias },
    { type: 'V', id: 'Vbp', nodes: ['in', 'bp'], value: p.vbias },
    { type: 'Q', id: 'Qn', nodes: ['vcc', 'bn', 'en'], polarity: 'npn', model: 'regions', beta: p.beta },
    { type: 'Q', id: 'Qp', nodes: ['vee', 'bp', 'ep'], polarity: 'pnp', model: 'regions', beta: p.beta },
    { type: 'R', id: 'Ren', nodes: ['en', 'out'], value: p.re },
    { type: 'R', id: 'Rep', nodes: ['ep', 'out'], value: p.re },
    { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
  ],
})

// ------------------------------------------------------------ the layouts

/**
 * The two-stage amplifier. Top rail V_CC, bottom rail V_EE, the pair under
 * the tail source, the mirror under the pair, the second stage on the right,
 * and the compensation capacitor across it. `c1`, `c2` and `inn` each appear
 * as a dot at both ends of the connection they make.
 */
function twoStageLayout() {
  return {
    w: 840,
    h: 530,
    items: [
      // V_CC and the tail
      ...vleg('VCC', 200, 60, 140),
      gnd(200, 140),
      node('vcc', 260, 60, 't'),
      wire(200, 60, 700, 60),
      ...vleg('It', 340, 60, 170),
      wire(288, 170, 468, 170),
      node('e', 400, 170, 't'),
      // the pnp pair
      { el: 'Q1', x: 300, y: 220, dir: 'h', flip: true },
      wire(288, 200, 288, 170),
      wire(288, 240, 288, 290),
      wire(288, 290, 312, 290),
      wire(312, 290, 312, 330),
      node('c1', 312, 290, 'r'),
      wire(320, 220, 360, 220),
      node('inn', 360, 220, 'b'),
      { el: 'Q2', x: 480, y: 220, dir: 'h', flip: true },
      wire(468, 200, 468, 170),
      wire(468, 240, 468, 290),
      wire(468, 290, 492, 290),
      wire(492, 290, 492, 330),
      node('c2', 492, 290, 'r'),
      wire(500, 220, 540, 220),
      node('inp', 540, 220, 'r'),
      // the npn mirror
      { el: 'Q3', x: 300, y: 350, dir: 'h' },
      wire(280, 350, 250, 350),
      node('c1', 250, 350, 'l'),
      wire(312, 370, 312, 410),
      { el: 'Q4', x: 480, y: 350, dir: 'h' },
      wire(460, 350, 430, 350),
      node('c1', 430, 350, 'l'),
      wire(492, 370, 492, 410),
      // the second stage, its load, and the capacitor across it
      { el: 'Q5', x: 640, y: 350, dir: 'h' },
      wire(620, 350, 590, 350),
      wire(590, 350, 590, 270),
      node('c2', 590, 310, 'l'),
      wire(652, 330, 652, 240),
      wire(652, 370, 652, 410),
      ...vleg('RC', 652, 60, 240),
      ...hspan('Cc', 626, 270, 590, 652),
      wire(652, 240, 740, 240),
      node('out', 700, 240, 't'),
      ...vleg('CL', 740, 240, 330),
      gnd(740, 330),
      // V_EE, the input, and the feedback block
      wire(200, 410, 652, 410),
      node('vee', 260, 410, 'b'),
      ...vleg('VEE', 200, 410, 490),
      gnd(200, 490),
      ...vleg('Efb', 120, 240, 330),
      node('inn', 120, 240, 't'),
      gnd(120, 330),
      { text: 'β · v_out', x: 120, y: 366 },
      ...vleg('Vin', 60, 380, 460),
      node('inp', 60, 380, 't'),
      gnd(60, 460),
    ],
  }
}

/** M4: the tail steered into the capacitor, and the resistor that gives the node a bias. */
function slewLayout() {
  return {
    w: 560,
    h: 500,
    items: [
      ...vleg('VCC', 150, 60, 140),
      gnd(150, 140),
      wire(150, 60, 300, 60),
      node('vcc', 220, 60, 't'),
      ...vleg('It', 300, 60, 170),
      node('e', 300, 170, 'r'),
      { el: 'Q2', x: 300, y: 220, dir: 'h', flip: true },
      wire(288, 200, 288, 170),
      wire(288, 170, 300, 170),
      wire(320, 220, 360, 220),
      gnd(360, 220),
      wire(288, 240, 288, 300),
      node('c2', 288, 300, 'l'),
      ...vleg('RC', 288, 300, 400),
      wire(150, 400, 288, 400),
      node('vee', 220, 400, 'b'),
      ...vleg('VEE', 150, 400, 480),
      gnd(150, 480),
      ...hspan('Rs', 380, 300, 288, 460),
      node('cx', 460, 300, 'r'),
      ...vleg('Cc', 460, 300, 390),
      gnd(460, 390),
    ],
  }
}

/** M6: the two output devices in one column, their ballast resistors, and the load. */
function outputLayout() {
  return {
    w: 720,
    h: 620,
    items: [
      wire(312, 60, 600, 60),
      node('vcc', 450, 60, 't'),
      ...vleg('VCC', 600, 60, 140),
      gnd(600, 140),
      { el: 'Qn', x: 300, y: 140, dir: 'h' },
      wire(312, 120, 312, 60),
      wire(312, 160, 312, 200),
      node('en', 312, 180, 'r'),
      ...vleg('Ren', 312, 200, 250),
      wire(312, 250, 500, 250),
      node('out', 400, 250, 't'),
      ...vleg('RL', 500, 250, 340),
      gnd(500, 340),
      ...vleg('Rep', 312, 250, 330, true),
      // The jog to the pnp's emitter runs at 338 rather than 350, and the
      // node sits at 366 rather than 360. Q_p's reading is written 34 px
      // above its centre, which is a band from 349 to 358 across the width of
      // the number, and both the wire and the label were inside it.
      wire(312, 330, 312, 338),
      wire(312, 338, 288, 338),
      wire(288, 338, 288, 370),
      node('ep', 288, 366, 'l'),
      { el: 'Qp', x: 300, y: 390, dir: 'h', flip: true },
      wire(288, 410, 288, 460),
      wire(288, 460, 560, 460),
      node('vee', 450, 460, 'b'),
      ...vleg('VEE', 560, 460, 540),
      gnd(560, 540),
      wire(280, 140, 180, 140),
      node('bn', 230, 140, 't'),
      ...vleg('Vbn', 180, 140, 220),
      node('in', 140, 220, 't'),
      wire(180, 220, 100, 220),
      ...vleg('Vin', 100, 220, 300),
      gnd(100, 300),
      ...vleg('Vbp', 180, 220, 560),
      wire(180, 560, 660, 560),
      wire(660, 560, 660, 390),
      wire(660, 390, 320, 390),
      node('bp', 450, 390, 't'),
    ],
  }
}

// ------------------------------------------------------------ the knobs

// Each knob's range is the range the device model describes, not the range
// the field can print. A transistor with a negative Early voltage, or a tail
// of a hundred milliamps in a circuit biased at microamps, is not a setting a
// reader can learn anything from, and Newton would be asked to find a point
// the model does not have.
const Tail = (def) => ({ key: 'itail', label: 'Tail current I_tail', unit: 'A', min: 1e-6, max: 1e-3, scale: 'log', default: def })
const Beta = (def) => ({ key: 'beta', label: 'Transistor β', unit: '', min: 10, max: 1000, scale: 'log', default: def })
const Early = (def) => ({ key: 'va', label: 'Early voltage V_A', unit: 'V', min: 10, max: 500, scale: 'log', default: def })
const Comp = (key, label, def) => ({ key, label, unit: 'F', min: 1e-12, max: 1e-9, scale: 'log', default: def })

const TAIL = chips(Tail(OPAMP_M.itail), [5e-6, 15e-6, 60e-6])
const BETA = chips(Beta(100), [50, 100, 200])
const VA = chips(Early(100), [20, 50, 100])
const CC = chips(Comp('cc', 'Compensation C_c', 30e-12), [5e-12, 10e-12, 30e-12])
const CC3 = chips(Comp('cc', 'Compensation C_c', 10e-12), [5e-12, 10e-12, 30e-12])
const CL = chips(Comp('cl', 'Load C_L', 10e-12), [10e-12, 33e-12, 100e-12])
const CL3 = chips(Comp('cl', 'Load C_L', 100e-12), [33e-12, 100e-12, 330e-12])
const RCL = chips(R('rc', 'Second-stage load R_C', 100e3), [50e3, 100e3, 200e3])

/**
 * A transistor's label on the drawing is its id alone. The default text adds
 * the polarity, which is wide enough to reach the collector and emitter leads
 * that leave the glyph 12 px either side of its centre. The arrowhead on the
 * emitter lead is what names the polarity on a schematic, and the model and β
 * are on the knobs beside it.
 */
const QLABELS = { Q1: 'Q1', Q2: 'Q2', Q3: 'Q3', Q4: 'Q4', Q5: 'Q5', Qn: 'Qn', Qp: 'Qp' }

export const GROUP_M = [
  {
    id: 'm1',
    group: GROUP,
    name: 'The two-stage op-amp, assembled',
    terms: ['twostage', 'mirror'],
    params: [TAIL, RCL, BETA, VA, CC, CL],
    net: (p) => twoStage({ ...p, fb: 0 }),
    layout: twoStageLayout(),
    labels: QLABELS,
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    model: 'exp',
    signal: { input: 'Vin', output: 'out' },
    caps: true,
    headline: { path: 'gain', label: 'A₀', unit: '' },
  },
  {
    id: 'm2',
    group: GROUP,
    name: 'Gain-bandwidth from one capacitor',
    terms: ['miller'],
    params: [CC, TAIL, RCL, BETA, VA, CL],
    net: (p) => twoStage({ ...p, fb: 0 }),
    layout: twoStageLayout(),
    labels: QLABELS,
    show: 'ac',
    view: 'bode',
    views: ['reading', 'bode', 'pz', 'equations'],
    model: 'exp',
    signal: { input: 'Vin', output: 'out' },
    caps: true,
    headline: { path: 'pole.1.hz', label: 'f_p', unit: 'Hz' },
  },
  {
    id: 'm3',
    group: GROUP,
    name: 'Phase margin and the second pole',
    terms: ['phasemargin', 'rhpzero'],
    params: [CC3, CL3, TAIL, RCL, BETA, VA],
    net: (p) => twoStage({ ...p, fb: 1 }),
    layout: twoStageLayout(),
    labels: QLABELS,
    show: 'ac',
    view: 'pz',
    views: ['reading', 'bode', 'pz', 'equations'],
    model: 'exp',
    signal: { input: 'Vin', output: 'out' },
    caps: true,
    headline: { path: 'pole.1.hz', label: 'closed pole', unit: 'Hz' },
  },
  {
    id: 'm4',
    group: GROUP,
    name: 'Slew rate, from the tail current',
    terms: ['slewderived'],
    params: [
      TAIL,
      chips(Comp('cc', 'Compensation C_c', 30e-12), [10e-12, 30e-12, 100e-12]),
      chips({ key: 'rc', label: 'Bias resistor R_C', unit: 'Ω', min: 1e5, max: 1e7, scale: 'log', default: 10e6 }, [1e6, 10e6]),
      BETA,
    ],
    net: slewStage,
    layout: slewLayout(),
    labels: QLABELS,
    show: 'dc',
    view: 'scope',
    views: ['reading', 'scope', 'equations'],
    model: 'regions',
    window: (p) => (1.4 * 10.5 * p.cc) / p.itail,
    cursor: 0.3,
    scope: { traces: [{ q: 'v', key: 'c2', label: 'v_c2' }] },
    headline: { path: 'slope.c2', label: 'dv/dt', unit: 'V/s' },
  },
  {
    id: 'm5',
    group: GROUP,
    name: 'Offset and bias current, derived',
    terms: ['pairoffset'],
    params: [
      chips({ key: 'ratio', label: 'I_S mismatch, Q2 over Q1', unit: '', min: 1, max: 2, scale: 'linear', default: 1.01 }, [1.01, 1.05, 1.1]),
      TAIL,
      BETA,
      RCL,
      VA,
      CC,
      CL,
    ],
    net: (p) => twoStage({ ...p, fb: 0 }),
    layout: twoStageLayout(),
    labels: QLABELS,
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    model: 'exp',
    signal: { input: 'Vin', output: 'out' },
    caps: true,
    headline: { path: 'op.Q1.ib', label: 'I_B', unit: 'A' },
  },
  {
    id: 'm6',
    group: GROUP,
    name: 'The output stage, and its dead band',
    terms: ['classb', 'crossoverdist', 'efficiency'],
    params: [
      chips(Amp0('amp', 'Drive amplitude', 1), [1, 5, 9]),
      chips({ key: 'vbias', label: 'Bias per side', unit: 'V', min: 0, max: 0.9, scale: 'linear', default: 0 }, [0, 0.35, 0.69]),
      chips({ key: 'RL', label: 'Load R_L', unit: 'Ω', min: 10, max: 1e5, scale: 'log', default: 1000 }, [100, 1000, 10000]),
      chips({ key: 're', label: 'Ballast R_E', unit: 'Ω', min: 1, max: 1000, scale: 'log', default: 10 }, [1, 10, 100]),
      { key: 'f', label: 'Drive frequency', unit: 'Hz', min: 10, max: 1e5, scale: 'log', default: 1000 },
      chips({ key: 'vsup', label: 'Supplies ±V', unit: 'V', min: 3, max: 24, scale: 'linear', default: 10 }, [5, 10, 15]),
      BETA,
    ],
    net: outputStage,
    layout: outputLayout(),
    labels: QLABELS,
    show: 'dc',
    view: 'scope',
    views: ['reading', 'scope', 'equations'],
    model: 'regions',
    window: (p) => 2 / p.f,
    // Two hundred samples over two cycles, rather than the six hundred every
    // other experiment takes. A class B stage switches at an instant the
    // sample grid can land exactly on, and where it does the region search
    // finds the same event for ever and the walk ends in the chatter refusal.
    // The refusal is correct and it names the reason; what a coarser grid buys
    // is that reaching it costs seconds rather than minutes. The trace is a
    // hundred points a cycle, and the harmonics are resampled from the walk
    // itself rather than from these points.
    points: 201,
    cursor: 0.25,
    scope: { traces: [{ q: 'v', key: 'in', label: 'v_in' }, { q: 'v', key: 'out', label: 'v_out' }] },
    headline: { path: 'peak.out', label: 'peak v_out', unit: 'V' },
  },
]

/** An amplitude in volts, on a linear scale, for a large-signal drive. */
function Amp0(key, label, def, hint) {
  return { key, label, unit: 'V', min: 0.1, max: 9, scale: 'linear', default: def, hint }
}
