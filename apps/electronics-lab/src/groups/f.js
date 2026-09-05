// Group F: small signals, the tangent at the point.
//
// Every amplifier in the rest of this lab is a straight line drawn against a
// curve. This group is where the line is taken, named and measured, and where
// the amplitude past which it stops describing the curve is read off the
// curve itself rather than asserted.
//
// Three circuits carry the six experiments.
//
//   the pair      a junction and a transistor side by side, each held at its
//                 own bias, so the diode's r_d and the transistor's 1/g_m are
//                 two readings of one exponential (F1).
//   the bench     the smallest stage that has an operating point and a
//                 tangent: a collector resistor, a base voltage, and a signal
//                 source in series with it. F2, F4 and F5 are the same five
//                 elements at three settings.
//   the pair of
//   devices       a bipolar transistor and a MOSFET, each held at 5 V by an
//                 ideal source, so g_m is read as a slope at a fixed output
//                 voltage rather than through a load line (F3). F6 is the
//                 MOSFET on its own bench.
//
// The bias voltages are not typed in. `vbeFor` inverts the device's own law
// for the collector current asked of it, so a chip labelled 1.00 mA puts
// 1.00 mA in the collector whatever I_S, V_A and V_CE are set to.

import { newtonDC, normalize, pointsOf, sourceValue, thermalVoltage } from '@ee-labs/network'
import { fmt } from '@ee-labs/ui'
import { Amp, Gain, Is, R, W, H, TOP, BOT, MID, chips, gnd, node, wire } from '../knobs.js'

export const GROUP_F_NAME = 'F · Small signals, the tangent at the point'

// ------------------------------------------------------------ the device
// The plan's §4.3 numbers, which every group past D shares.
const VT = thermalVoltage(300)
const IS = 1e-14
const BETA = 100
const VA = 100
const VCC = 10
const RC0 = 5000
const VCE0 = 5
const KN = 20e-3
const VTH = 0.7
const LAMBDA = 0.02
const VDD = 5
const RD0 = 5000

/**
 * The base voltage that puts `ic` in the collector, from the device's own law
 * rather than from a table: i_C = I_S e^{v_BE/V_T}(1 + V_CE/V_A). Every chip
 * on a base-voltage knob is this function of the current it names, so the
 * chip labelled 1.00 mA still means 1.00 mA when I_S or V_A moves.
 */
export const vbeFor = (ic, { is = IS, va = VA, vce = VCE0 } = {}) => VT * Math.log(ic / (is * (1 + vce / va)))

/** The gate voltage that puts `id` in the drain of the square-law device. */
export const vgsFor = (id, { kn = KN, vt = VTH, lambda = LAMBDA, vds = VCE0 } = {}) => vt + Math.sqrt((2 * id) / (kn * (1 + lambda * vds)))

/** A base or gate voltage: a narrow range, because outside it there is no bias point. */
const Vbias = (key, label, def, hint) => ({ key, label, unit: 'V', min: 0.4, max: 1.4, scale: 'linear', default: def, hint })
/** A supply or an Early voltage: tens of volts, and never negative. */
const Volt = (key, label, def, hint) => ({ key, label, unit: 'V', min: 0.5, max: 200, scale: 'log', default: def, hint })
/** The square law's transconductance parameter, in amps per volt squared. */
const Kparam = (key, label, def, hint) => ({ key, label, unit: 'A/V²', min: 1e-4, max: 0.2, scale: 'log', default: def, hint })
/** Channel-length modulation, per volt. */
const Lambda = (key, label, def, hint) => ({ key, label, unit: 'V⁻¹', min: 1e-3, max: 0.2, scale: 'log', default: def, hint })

const VBE1 = vbeFor(1e-3)

// ------------------------------------------------------------ the circuits

/**
 * F1: a junction held at a current beside a transistor held at a voltage.
 * The two are separate branches on purpose. Each device's own bias knob sets
 * its own current, and the claim is that the two slopes are the same function
 * of whatever current each one carries.
 */
const tangentPair = (p) => ({
  elements: [
    { type: 'I', id: 'I1', nodes: ['gnd', 'a'], value: p.i },
    { type: 'D', id: 'D1', nodes: ['a', 'gnd'], model: 'exp', is: IS },
    { type: 'V', id: 'VB', nodes: ['b', 'gnd'], value: p.vbe },
    { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'exp', is: IS, beta: BETA, va: p.va },
    { type: 'V', id: 'VC', nodes: ['c', 'gnd'], value: p.vce },
  ],
})

/**
 * The bench stage of F2, F4 and F5: a collector resistor, a base held at a
 * voltage, and a signal source in series with that voltage. Five elements,
 * and every number Group F quotes about a bipolar stage comes off them.
 *
 * `drive` is a second DC volt on the base, which is how F5 walks along the
 * curve without leaving the same circuit.
 */
const bench = (p) => ({
  elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: VCC },
    { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: p.RC },
    { type: 'V', id: 'Vs', nodes: ['b', 'x'], value: p.amp ?? 1e-3, wave: { kind: 'sine', amp: p.amp ?? 1e-3, freq: 1000 }, small: true },
    { type: 'V', id: 'VB', nodes: ['x', 'gnd'], value: p.vbe + (p.drive ?? 0) },
    { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'exp', is: IS, beta: p.beta ?? BETA, va: p.va ?? VA },
  ],
})

/**
 * F3: one bipolar transistor and one MOSFET, each with its output terminal
 * held at 5 V by an ideal source and its control terminal driven by another.
 * No load resistor, so the current read at each source is the device's own
 * law and nothing else, and g_m is the slope of that law.
 */
const twoDevices = (p) => ({
  elements: [
    { type: 'V', id: 'VB', nodes: ['b', 'gnd'], value: p.vbe },
    { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'exp', is: IS, beta: BETA, va: VA },
    { type: 'V', id: 'VC', nodes: ['c', 'gnd'], value: VCE0 },
    { type: 'V', id: 'VG', nodes: ['g', 'gnd'], value: p.vgs },
    { type: 'M', id: 'M1', nodes: ['d', 'g', 'gnd'], model: 'square', vt: p.vt, kn: p.kn, lambda: LAMBDA },
    { type: 'V', id: 'VD', nodes: ['d', 'gnd'], value: VCE0 },
  ],
})

/** F6: the same bench, with the MOSFET in the socket and a drain resistor. */
const mosBench = (p) => ({
  elements: [
    { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: VDD },
    { type: 'R', id: 'RD', nodes: ['vdd', 'd'], value: p.RD },
    { type: 'V', id: 'Vs', nodes: ['g', 'x'], value: p.amp, wave: { kind: 'sine', amp: p.amp, freq: 1000 }, small: true },
    { type: 'V', id: 'VG', nodes: ['x', 'gnd'], value: p.vgs },
    { type: 'M', id: 'M1', nodes: ['d', 'g', 'gnd'], model: 'square', vt: p.vt, kn: p.kn, lambda: p.lambda },
  ],
})

// ------------------------------------------------------------ the drawings
// A transistor's label is the one place this lab departs from the shared
// label text. `valueText` writes "Q1 npn" centred 24 below the device, and
// the emitter's lead comes down 12 to the right of that centre, so anything
// wider than three characters is written across the lead. The glyph already
// says npn, so the label says which device it is and nothing more.
const TRANSISTOR_LABELS = { Q1: 'Q1', M1: 'M1' }

/**
 * A vertical element between two rails, with its leads reaching both. The
 * shared `leg` stops 10 short of a rail on this canvas, and a drawing that
 * stops short of a rail has a gap in it where the circuit has a wire.
 */
const legTo = (id, x, y, top, bot, flip = false) => [
  { el: id, x, y, dir: 'v', flip },
  wire(x, top, x, y - 20),
  wire(x, y + 20, x, bot),
]

// Where the rails run, and where a device sits between them.
//
// A transistor is the tallest symbol the suite draws: 40 across and 40 down,
// with its label 34 below its centre and its reading 34 above. So these
// drawings move the rails out from the shared 40 and 140 to 32 and 160, and
// nothing else is written within 8 of the device's own column.
const RAIL = 32
const GROUND = 160
const DEV_Y = 100

/** F1's drawing: the junction on the left, the transistor on the right. */
function pairLayout() {
  return {
    w: W,
    h: H,
    items: [
      // the junction, held at a current
      ...legTo('I1', 45, 96, RAIL, GROUND, true),
      wire(45, RAIL, 125, RAIL),
      ...legTo('D1', 125, 96, RAIL, GROUND),
      wire(45, GROUND, 125, GROUND),
      gnd(85, GROUND),
      node('a', 85, RAIL, 't'),
      // the transistor, held at a voltage of its own
      ...legTo('VB', 200, 120, DEV_Y, GROUND),
      wire(200, DEV_Y, 280, DEV_Y),
      node('b', 250, DEV_Y, 't'),
      { el: 'Q1', x: 300, y: DEV_Y, dir: 'h' },
      wire(312, RAIL, 312, 80),
      wire(312, 120, 312, GROUND),
      wire(312, RAIL, 360, RAIL),
      ...legTo('VC', 360, 96, RAIL, GROUND),
      node('c', 336, RAIL, 't'),
      wire(200, GROUND, 360, GROUND),
      gnd(336, GROUND),
    ],
  }
}

/**
 * The bench stage's drawing, shared by F2, F4, F5 and F6: the supply on the
 * left, the load resistor along the top rail, the device under its right end,
 * and the control terminal fed from the bias source through the signal source.
 */
function benchLayout(ids = { supply: 'VCC', load: 'RC', rail: 'vcc', out: 'c', bias: 'VB', dev: 'Q1', ctrl: 'b' }) {
  return {
    w: W,
    h: H,
    items: [
      ...legTo(ids.supply, 45, 80, RAIL, GROUND),
      wire(45, RAIL, 205, RAIL),
      { el: ids.load, x: 225, y: RAIL, dir: 'h' },
      wire(245, RAIL, 312, RAIL),
      node(ids.rail, 120, RAIL, 't'),
      node(ids.out, 285, RAIL, 't'),
      wire(312, RAIL, 312, 80),
      { el: ids.dev, x: 300, y: DEV_Y, dir: 'h' },
      wire(312, 120, 312, GROUND),
      ...legTo(ids.bias, 100, 120, DEV_Y, GROUND),
      wire(100, DEV_Y, 180, DEV_Y),
      node('x', 140, DEV_Y, 't'),
      { el: 'Vs', x: 200, y: DEV_Y, dir: 'h', flip: true },
      wire(220, DEV_Y, 280, DEV_Y),
      node(ids.ctrl, 250, DEV_Y, 't'),
      wire(45, GROUND, 312, GROUND),
      gnd(170, GROUND),
    ],
  }
}

/**
 * Half of F3's drawing: a device with its output terminal held by a source
 * and its control terminal driven by another. The two halves are the same
 * shape, so what differs on screen is the glyph and the numbers.
 */
function halfLayout(x0, bias, dev, out, ctrlNode, outNode) {
  return [
    ...legTo(bias, x0 - 90, 120, DEV_Y, GROUND),
    wire(x0 - 90, DEV_Y, x0 - 20, DEV_Y),
    node(ctrlNode, x0 - 48, DEV_Y, 't'),
    { el: dev, x: x0, y: DEV_Y, dir: 'h' },
    wire(x0 + 12, RAIL, x0 + 12, 80),
    wire(x0 + 12, 120, x0 + 12, GROUND),
    wire(x0 + 12, RAIL, x0 + 40, RAIL),
    ...legTo(out, x0 + 40, 96, RAIL, GROUND),
    node(outNode, x0 + 26, RAIL, 't'),
    wire(x0 - 90, GROUND, x0 + 40, GROUND),
    gnd(x0 - 20, GROUND),
  ]
}

function devicesLayout() {
  return {
    w: W,
    h: H,
    items: [...halfLayout(112, 'VB', 'Q1', 'VC', 'b', 'c'), ...halfLayout(312, 'VG', 'M1', 'VD', 'g', 'd')],
  }
}

// ------------------------------------------------------------ the harmonics
// Route 2 of the plan's §2.8, read for its second harmonic. A slow sine on
// the base is mapped through the stage's own DC characteristic, one exact
// solve per phase, and the result is projected onto its first two harmonics.
// The projection is a Fourier coefficient of the sampled waveform, so the
// only approximation between the device's law and the number printed is the
// number of phases, and 64 of them puts the fourth harmonic and above below a
// part in a thousand of the second at these amplitudes.

const PHASES = 64

/**
 * The DC point of an experiment at one setting, with every source read at
 * t = 0, which is `math.js`'s rule for what a DC pane shows. It is repeated
 * here rather than imported because `math.js` reaches this file through the
 * math panel, and a group file that imported it back would close the ring.
 */
function solveAt(exp, p) {
  const norm = normalize(exp.net(p))
  const sources = {}
  for (const e of norm.elements) if (e.type === 'V' || e.type === 'I') sources[e.id] = sourceValue(e, 0)
  const op = newtonDC(norm, { sources })
  return { norm, op, sol: op.sol }
}

/** The same, as the solution alone. */
const dcAt = (exp, p) => solveAt(exp, p).sol

/**
 * The bench stage with its drive at zero: where the collector sits, and the
 * slope of the tangent taken there. The straight line the guard governs is
 * this pair, so both come off one solve of the same circuit.
 */
export function biasTangent(exp, p) {
  const { norm, op, sol } = solveAt(exp, { ...p, drive: 0 })
  const q = pointsOf(norm, op).Q1
  const rl = (p.RC * q.ro) / (p.RC + q.ro)
  return { vc: sol.v.c, slope: -q.gm * rl, q }
}

/** The amplitude of the nth harmonic of a waveform sampled over one cycle. */
export function harmonic(ys, n) {
  let re = 0
  let im = 0
  for (let k = 0; k < ys.length; k++) {
    const th = (2 * Math.PI * n * k) / ys.length
    re += ys[k] * Math.cos(th)
    im += ys[k] * Math.sin(th)
  }
  return (2 * Math.hypot(re, im)) / ys.length
}

/**
 * Second-harmonic distortion of a sine of amplitude `amp` on the knob `key`,
 * mapped through the experiment's own transfer characteristic, as a fraction
 * of the fundamental.
 */
export function hd2Of(exp, p, key, base, amp, read = (sol) => sol.v.c) {
  const ys = []
  for (let k = 0; k < PHASES; k++) {
    const th = (2 * Math.PI * k) / PHASES
    ys.push(read(dcAt(exp, { ...p, [key]: base + amp * Math.sin(th) })))
  }
  return harmonic(ys, 2) / harmonic(ys, 1)
}

// ------------------------------------------------------------ the guard
// The tangent is an approximation, so it carries a threshold and the panel
// changes at it. The exponential's second harmonic is v̂/(4V_T) of its
// fundamental, and the guard is the drive at which that reaches four per
// cent. It is written as a function of V_T rather than as a millivolt, so it
// follows the temperature the device is held at.

export const HD2_GUARD = 0.04

/** The drive past which the panel footnotes the tangent instead of checking it. */
export const driveGuard = (vt = VT) => 4 * vt * HD2_GUARD

// ------------------------------------------------------------ the knobs

const BIAS_CHIPS = [vbeFor(0.25e-3), VBE1, vbeFor(4e-3)]
const LOAD = chips(R('RC', 'Collector R_C', RC0), [1000, 5000, 20000])

export const GROUP_F = [
  {
    id: 'f1',
    group: GROUP_F_NAME,
    name: 'The tangent, again',
    terms: ['smallsignalslope', 'operatingpoint'],
    params: [
      chips(Is('i', 'Junction current I', 1e-3), [0.25e-3, 1e-3, 4e-3]),
      chips(Vbias('vbe', 'Base voltage V_BE', VBE1, 'the chips put 0.25, 1 and 4 mA in the collector at V_CE = 5 V and V_A = 100 V'), BIAS_CHIPS),
      Volt('vce', 'Collector voltage V_CE', VCE0),
      Volt('va', 'Early voltage V_A', VA),
    ],
    net: tangentPair,
    labels: { ...TRANSISTOR_LABELS, D1: 'D1 exp' },
    layout: pairLayout(),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    headline: { path: 'op.Q1.gm', label: 'g_m', unit: 'A/V' },
  },
  {
    id: 'f2',
    group: GROUP_F_NAME,
    name: 'DC plus AC, on one wire',
    terms: ['superposition', 'operatingpoint'],
    params: [
      chips(Amp('amp', 'Signal amplitude', 1e-3), [1e-4, 1e-3, 5e-3]),
      chips(Vbias('vbe', 'Base voltage V_BE', VBE1), BIAS_CHIPS),
      LOAD,
    ],
    net: bench,
    labels: TRANSISTOR_LABELS,
    layout: benchLayout(),
    show: 'both',
    view: 'reading',
    views: ['reading', 'equations'],
    signal: { input: 'Vs', output: 'c' },
    probe: 1000,
    headline: { path: 'v.c', label: 'V_C', unit: 'V' },
  },
  {
    id: 'f3',
    group: GROUP_F_NAME,
    name: 'Transconductance is the slope',
    terms: ['squarelaw', 'overdrive'],
    params: [
      chips(Vbias('vbe', 'Base voltage V_BE', vbeFor(0.44e-3)), [vbeFor(0.44e-3), vbeFor(0.88e-3), vbeFor(1.76e-3)]),
      chips(Vbias('vgs', 'Gate voltage V_GS', 0.9), [0.9, vgsFor(0.88e-3), 1.1]),
      Vbias('vt', 'Threshold V_t', VTH),
      Kparam('kn', 'Square-law k_n', KN),
    ],
    net: twoDevices,
    labels: TRANSISTOR_LABELS,
    layout: devicesLayout(),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    headline: { path: 'op.Q1.gm', label: 'g_m', unit: 'A/V' },
  },
  {
    id: 'f4',
    group: GROUP_F_NAME,
    name: 'The hybrid-π, printed',
    terms: ['hybridpi', 'quasistatic'],
    params: [
      chips(Vbias('vbe', 'Base voltage V_BE', VBE1), BIAS_CHIPS),
      LOAD,
      Gain('beta', 'Current gain β', BETA),
      Volt('va', 'Early voltage V_A', VA),
      Amp('amp', 'Signal amplitude', 1e-3),
    ],
    net: bench,
    labels: TRANSISTOR_LABELS,
    layout: benchLayout(),
    show: 'ac',
    view: 'transfer',
    views: ['reading', 'transfer', 'equations'],
    signal: { input: 'Vs', output: 'c' },
    probe: 1000,
    sweepOver: { key: 'vbe', from: VBE1 - 0.06, to: VBE1 + 0.02, points: 121, label: 'V_BE' },
    headline: { path: 'gain', label: 'A_v', unit: '' },
  },
  {
    id: 'f5',
    group: GROUP_F_NAME,
    name: 'How small is small',
    terms: ['harmonic', 'amplitudeguard'],
    params: [
      chips(Amp('drive', 'Drive amplitude', 5e-3), [1e-3, 5e-3, 10e-3, 20e-3]),
      chips(Vbias('vbe', 'Base voltage V_BE', VBE1), BIAS_CHIPS),
      LOAD,
      chips(Volt('va', 'Early voltage V_A', VA, 'the collector’s own voltage feeds back through this term, and a larger V_A feeds back less'), [100, 200]),
    ],
    net: bench,
    labels: TRANSISTOR_LABELS,
    layout: benchLayout(),
    show: 'dc',
    view: 'transfer',
    views: ['reading', 'transfer', 'equations'],
    signal: { input: 'Vs', output: 'c' },
    probe: 1000,
    sweepOver: { key: 'drive', from: -0.02, to: 0.02, points: 121, label: 'drive' },
    headline: { path: 'gain', label: 'A_v', unit: '' },
  },
  {
    id: 'f6',
    group: GROUP_F_NAME,
    name: 'The MOSFET’s small-signal model',
    terms: ['channelmodulation'],
    params: [
      chips(Vbias('vgs', 'Gate voltage V_GS', 0.9), [0.8, 0.9, 0.95]),
      chips(R('RD', 'Drain R_D', RD0), [1000, 5000, 10000]),
      Vbias('vt', 'Threshold V_t', VTH),
      Kparam('kn', 'Square-law k_n', KN),
      chips(Lambda('lambda', 'Channel modulation λ', LAMBDA), [0.01, 0.02, 0.04]),
      Amp('amp', 'Signal amplitude', 1e-3),
    ],
    net: mosBench,
    labels: TRANSISTOR_LABELS,
    layout: benchLayout({ supply: 'VDD', load: 'RD', rail: 'vdd', out: 'd', bias: 'VG', dev: 'M1', ctrl: 'g' }),
    show: 'ac',
    view: 'reading',
    views: ['reading', 'equations'],
    signal: { input: 'Vs', output: 'd' },
    probe: 1000,
    headline: { path: 'gain', label: 'A_v', unit: '' },
  },
]

// ------------------------------------------------------------ the math panel
// The formula behind each number on screen, and the closed form checked
// against what the solver measured. A row whose closed form the current
// settings cannot see is footnoted with the reason rather than crossed out,
// because the formula has not stopped being true: the device has left the
// region the formula describes.

const T = (text) => ({ kind: 'text', text })
const FRM = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.02, extra = {}) => ({ label, predicted, measured, unit, tol, ...extra })

// Two tolerances recur below. A row written against the transport model's own
// law is checked to a part in a million rather than to floating point, because
// the collector junction's term is still a part in ten million of the answer
// at a nanoamp of bias. A row that reads a small difference of two large
// voltages carries an absolute floor of a microvolt beside its relative one,
// which is the scale Newton stops at on a ten-volt circuit.

/** Why a bipolar row cannot be read here, or null when it can. */
const notActive = (pt) => (pt && pt.region === 'active' ? null : `The transistor is ${pt ? pt.region : 'not solved'} at this setting, and the active-region tangent below does not describe it.`)
/**
 * Why a bipolar row cannot be read at a bias this faint, or null when it can.
 * Every junction carries a small fixed conductance for the solver's benefit,
 * and below about a microamp of collector current that conductance is a
 * measurable part of the base current, so the model's own β is not what the
 * terminals show.
 */
const tooFaint = (pt) => (pt && Math.abs(pt.ic) < 1e-6 ? 'The collector carries under a microamp here, where the conductance every junction is given for convergence is a measurable part of the base current.' : null)

/**
 * Why a row written without r_μ cannot be read here, or null when it can.
 *
 * The region label says active while the collector junction is still below
 * half of V_BE(on), and a little before that boundary r_μ from base to
 * collector has already begun to carry signal the textbook forms leave out.
 * What each of those forms is wrong by is the resistance it is about divided
 * by r_μ, so the threshold is the millionth the rows are checked to.
 */
const muCarries = (pt, r) =>
  pt && Number.isFinite(pt.rmu) && pt.rmu < 1e6 * r
    ? 'The collector junction has begun to conduct at this bias, so r_μ from base to collector carries a share of the signal that the two-element formula leaves out.'
    : null

/**
 * Why the tangent's own prediction is footnoted rather than checked, or null
 * while the drive is inside the guard. The threshold is `driveGuard`, and the
 * message names it, so a reader who crosses it is told the number as well as
 * the reason.
 */
const overdriven = (p) =>
  p.drive >= driveGuard()
    ? `The drive is past the amplitude guard at ${fmt(driveGuard(), 'V', 3)}, where the series puts the second harmonic at ${100 * HD2_GUARD} % of the fundamental. The straight line is not what this stage does here.`
    : null

/** The same for the square law. */
const notSaturated = (pt) => (pt && pt.region === 'saturation' ? null : `The MOSFET is in ${pt ? pt.region : 'no region'} here, and the saturation formulas below do not describe it.`)

export const MATH_F = {
  f1(p, x) {
    const d = x.point.D1
    const q = x.point.Q1
    return {
      blocks: [
        T('One exponential, read twice. The junction’s slope is a resistance and the transistor’s is a current per volt, and both are the thermal voltage divided by the current the device carries.'),
        FRM('r_d = \\frac{nV_T}{I}, \\qquad g_m = \\frac{I_C}{V_T}'),
        C([
          row('the junction’s slope at its current', VT / (p.i + IS), d.rd, 'Ω', 1e-9),
          row('the transistor’s slope at its current', q.ic / VT, q.gm, 'A/V', 1e-6, { unchecked: notActive(q) || tooFaint(q) }),
          row('the collector current the base voltage asks for', IS * Math.exp(q.vbe / VT) * (1 + q.vce / p.va), q.ic, 'A', 1e-6, { unchecked: notActive(q) || tooFaint(q) }),
        ]),
        V([{ label: 'the junction’s slope inverted', value: 1 / d.rd, unit: 'A/V', note: 'the same number as g_m when the two carry the same current' }]),
      ],
    }
  },

  f2(p, x) {
    const q = x.point.Q1
    const rl = (p.RC * q.ro) / (p.RC + q.ro)
    const vbe = x.ac ? x.ac.v.b - x.ac.v.x : 0
    return {
      blocks: [
        T('The bias and the signal travel the same wire and are read separately. The bias comes from the DC solve, and the signal from the tangent taken at the point that solve found.'),
        FRM('V_C = V_{CC} - I_C R_C, \\qquad \\hat{v}_c = g_m \\hat{v}_{be}\\,(R_C \\parallel r_o)'),
        C([
          row('the collector’s bias', VCC - q.ic * p.RC, x.sol.v.c, 'V', 1e-8, { abs: 1e-6 }),
          row('the signal at the collector', q.gm * vbe * rl, x.ac ? x.ac.v.c : NaN, 'V', 1e-5, { unchecked: notActive(q) || tooFaint(q) || muCarries(q, rl) }),
        ]),
        V([
          { label: 'the signal current the transconductance makes', value: q.gm * vbe, unit: 'A', note: 'g_m times the signal on the base' },
          { label: 'the resistance that current works into', value: rl, unit: 'Ω' },
        ]),
      ],
    }
  },

  f3(p, x) {
    const q = x.point.Q1
    const m = x.point.M1
    return {
      blocks: [
        T('Both slopes are derivatives of the device’s own law. The exponential differentiates to itself over V_T, so g_m follows the current. The square differentiates to a straight line, so it follows the square root of the current.'),
        FRM('g_m = \\frac{I_C}{V_T} \\quad\\text{against}\\quad g_m = \\frac{2I_D}{V_{OV}} = \\sqrt{2k_n I_D}'),
        C([
          row('the bipolar slope', q.ic / VT, q.gm, 'A/V', 1e-6, { unchecked: notActive(q) || tooFaint(q) }),
          row('the square-law slope', (2 * m.id_) / m.vov, m.gm, 'A/V', 1e-9, { unchecked: notSaturated(m) }),
          row('the drain current the square law asks for', 0.5 * p.kn * m.vov * m.vov * (1 + LAMBDA * m.vds), m.id_, 'A', 1e-9, { unchecked: notSaturated(m) }),
        ]),
        V([{ label: 'how much larger the bipolar slope is', value: q.gm / m.gm, unit: '', note: 'at the currents the two knobs set' }]),
      ],
    }
  },

  f4(p, x) {
    const q = x.point.Q1
    const rl = (p.RC * q.ro) / (p.RC + q.ro)
    return {
      blocks: [
        T('Three numbers make the tangent, and each is a derivative of the same law at the same point. The gain is the transconductance working into whatever resistance the collector sees.'),
        FRM('r_\\pi = \\frac{\\beta}{g_m}, \\quad r_o = \\frac{V_A + V_{CE}}{I_C}, \\quad A_v = -g_m (R_C \\parallel r_o)'),
        C([
          row('the gain', -q.gm * rl, x.gain, '', 1e-6, { unchecked: notActive(q) || tooFaint(q) || muCarries(q, rl) }),
          row('r_π at the measured current gain', q.ic / q.ib / q.gm, q.rpi, 'Ω', 1e-6, { unchecked: notActive(q) || tooFaint(q) || muCarries(q, q.rpi) }),
          row('r_o from the Early voltage', (p.va + q.vce) / q.ic, q.ro, 'Ω', 1e-5, { unchecked: notActive(q) || tooFaint(q) || muCarries(q, q.ro) }),
        ]),
        V([{ label: 'the current gain the device really has', value: q.ic / q.ib, unit: '', note: 'β times the Early factor, which is what r_π is written against' }]),
      ],
    }
  },

  f5(p, x) {
    const q = x.point.Q1
    const rl = (p.RC * q.ro) / (p.RC + q.ro)
    // Where the collector sits with the drive at zero, which is the point the
    // tangent is taken at and the foot of the straight line below.
    const bias = biasTangent(x.exp, p)
    return {
      blocks: [
        T('The tangent is taken where the base is now. Push the base up and the slope is steeper, because the exponential is steeper there, and a signal large enough to move along the curve carries a second harmonic.'),
        FRM('\\mathrm{HD2} \\approx \\frac{\\hat{v}_{be}}{4V_T}'),
        C([
          row('the tangent where the base now sits', -q.gm * rl, x.gain, '', 1e-6, { unchecked: notActive(q) || tooFaint(q) || muCarries(q, rl) }),
          row('the collector’s bias', VCC - q.ic * p.RC, x.sol.v.c, 'V', 1e-8, { abs: 1e-6 }),
          row('the collector’s change, from the straight line', bias.slope * p.drive, x.sol.v.c - bias.vc, 'V', 0.1, {
            unchecked: notActive(q) || tooFaint(q) || muCarries(q, rl) || overdriven(p),
          }),
        ]),
        V([
          { label: 'the second harmonic this drive predicts', value: p.drive / (4 * VT), unit: '', note: 'the leading term of the series, as a fraction of the fundamental' },
          { label: 'the drive the guard warns at', value: driveGuard(), unit: 'V', note: `where that estimate reaches ${100 * HD2_GUARD} %` },
        ]),
      ],
    }
  },

  f6(p, x) {
    const m = x.point.M1
    const rl = (p.RD * m.ro) / (p.RD + m.ro)
    return {
      blocks: [
        T('The MOSFET’s tangent has two elements and no third. There is no resistance from gate to source, because no current crosses the oxide, and the output resistance comes from channel-length modulation alone.'),
        FRM('g_m = \\frac{2I_D}{V_{OV}}, \\quad r_o = \\frac{1}{\\lambda I_{D0}}, \\quad A_v = -g_m (R_D \\parallel r_o)'),
        C([
          row('the slope', (2 * m.id_) / m.vov, m.gm, 'A/V', 1e-9, { unchecked: notSaturated(m) }),
          row('the output resistance', 1 / (p.lambda * 0.5 * p.kn * m.vov * m.vov), m.ro, 'Ω', 1e-9, { unchecked: notSaturated(m) }),
          row('the gain', -m.gm * rl, x.gain, '', 1e-6, { unchecked: notSaturated(m) }),
        ]),
        V([{ label: 'the current the gate draws', value: x.sol.i.VG, unit: 'A', note: 'exactly zero, at every bias and every frequency below the capacitances' }]),
      ],
    }
  },
}
