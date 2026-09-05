// Group J: the differential pair.
//
// One tail current, two matched transistors, and two bases. Everything an
// operational amplifier does at its input is here: the steering law, the
// half-circuit that turns a pair into a common emitter, the rejection a tail
// with output resistance buys, the offset a mismatch costs, and the mirror
// load that turns two collectors into one output.
//
// The circuit is the plan's §5 pair with the brief's node names — vcc, c1,
// c2, b1, b2 and e. The two inputs are written as two sources to ground,
// `Vb1` at v_cm + v_id/2 and `Vb2` at v_cm − v_id/2, rather than as a
// floating source between the bases with a second one under it. The two are
// the same circuit at every setting. Two sources to ground can be drawn
// without a wire from one base across to the other, and the reader sets v_id
// and v_cm on their own knobs either way.
//
// The tail returns to ground rather than to a negative rail, and `REE` beside
// it is the tail source's own output resistance, which is what J3 measures.
// A real sink works from a rail below ground and this one is ideal, so the
// emitters sit at −0.63 V and the drawing has one supply instead of two.

import { newtonDC, normalize, pointsOf, thermalVoltage } from '@ee-labs/network'
import { chips } from '../knobs.js'

const GROUP = 'J · The differential pair'

// ------------------------------------------------------------ the knobs
//
// Every range is chosen so that both transistors stay in their active region
// across it, whatever else is turned: the tail cannot ask more of R_C than
// the supply has. The math panel still checks the region before it checks a
// small-signal formula, because a knob is not the only way into saturation.

const Vin = (key, label, def, hint) => ({ key, label, unit: 'V', min: -0.15, max: 0.15, scale: 'linear', default: def, hint })
const Vcm = (key, label, def, hint) => ({ key, label, unit: 'V', min: -2, max: 2, scale: 'linear', default: def, hint })
const Tail = (key, label, def, hint) => ({ key, label, unit: 'A', min: 1e-4, max: 1.5e-3, scale: 'log', default: def, hint })
const Rc = (key, label, def, hint) => ({ key, label, unit: 'Ω', min: 1000, max: 5000, scale: 'log', default: def, hint })
const Ree = (key, label, def, hint) => ({ key, label, unit: 'Ω', min: 1e4, max: 1e7, scale: 'log', default: def, hint })
const Beta = (key, label, def, hint) => ({ key, label, unit: '', min: 10, max: 1000, scale: 'log', default: def, hint })
const Early = (key, label, def, hint) => ({ key, label, unit: 'V', min: 10, max: 400, scale: 'linear', default: def, hint })
const Mismatch = (key, label, def, hint) => ({ key, label, unit: '%', min: 0, max: 10, scale: 'linear', default: def, hint })

const TAIL = () => chips(Tail('itail', 'Tail current I', 1e-3), [0.25e-3, 1e-3, 1.5e-3])
const RC = () => chips(Rc('rc', 'Collector R_C', 5000), [1000, 2500, 5000])
const BETA = () => chips(Beta('beta', 'Current gain β', 100), [25, 100, 400])
const EARLY = () => chips(Early('va', 'Early voltage V_A', 100), [25, 100, 400])
const VID = () => chips(Vin('vid', 'Differential input v_id', 0), [-0.05, 0, 0.05])
const VCM = () => chips(Vcm('vcm', 'Common-mode input v_cm', 0), [-1, 0, 1])

// ------------------------------------------------------------ the netlists

/** The two matched transistors, and the two bases they are driven from. */
const pairCore = (p) => [
  { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
  { type: 'I', id: 'Itail', nodes: ['e', 'gnd'], value: p.itail },
  { type: 'Q', id: 'Q1', nodes: ['c1', 'b1', 'e'], model: 'exp', beta: p.beta, va: p.va, is: 1e-14 * (1 + (p.dis ?? 0) / 100) },
  { type: 'Q', id: 'Q2', nodes: ['c2', 'b2', 'e'], model: 'exp', beta: p.beta, va: p.va, is: 1e-14 },
  { type: 'V', id: 'Vb1', nodes: ['b1', 'gnd'], value: p.vcm + p.vid / 2, wave: { kind: 'sine', amp: 1e-4, freq: 1000, offset: p.vcm + p.vid / 2 } },
  // The two bases are driven in antiphase, so the drive on the schematic's
  // signal overlay is the balanced one the half-circuit of J2 describes and
  // the shared emitter node reads the zero that lesson claims for it. The
  // antiphase is a negative amplitude rather than a phase of π, because
  // sin(π) is not zero in floating point and the bias would carry the
  // remainder into every DC reading on the drawing.
  { type: 'V', id: 'Vb2', nodes: ['b2', 'gnd'], value: p.vcm - p.vid / 2, wave: { kind: 'sine', amp: -1e-4, freq: 1000, offset: p.vcm - p.vid / 2 } },
]

/** The resistively loaded pair of J1 to J4. */
export const pairNet = (p) => ({
  elements: [
    ...pairCore(p),
    { type: 'R', id: 'RC1', nodes: ['vcc', 'c1'], value: p.rc * (1 + (p.drc ?? 0) / 100) },
    { type: 'R', id: 'RC2', nodes: ['vcc', 'c2'], value: p.rc },
    ...(p.ree ? [{ type: 'R', id: 'REE', nodes: ['e', 'gnd'], value: p.ree }] : []),
  ],
})

/** The mirror-loaded pair of J5: two pnp devices where R_C1 and R_C2 were. */
export const loadedNet = (p) => ({
  elements: [
    ...pairCore(p),
    { type: 'Q', id: 'Q3', nodes: ['c1', 'c1', 'vcc'], polarity: 'pnp', model: 'exp', beta: p.betap, va: p.va },
    { type: 'Q', id: 'Q4', nodes: ['c2', 'c1', 'vcc'], polarity: 'pnp', model: 'exp', beta: p.betap, va: p.va },
  ],
})

// ------------------------------------------------------------ the drawings
//
// A transistor's label and reading hang 34 above and below its centre, so a
// device needs a clear band of ±42 around it and a row of them costs eighty
// pixels of height. Two rows do not fit the 420 × 180 canvas the two-terminal
// groups use, so these drawings are wider and taller in the same proportion:
// a phone renders them at the same height as Group A's.
//
// The labels are the bare ids. A transistor's own glyph already says npn or
// pnp, and the default text ("Q1 npn") is wide enough to sit under its own
// emitter lead.

const wire = (x1, y1, x2, y2) => ({ wire: [x1, y1, x2, y2] })
const node = (name, x, y, side = 't') => ({ node: name, x, y, side })
const gnd = (x, y) => ({ gnd: [x, y] })

/** The devices, their bases and their tail: everything J1 to J5 share. */
function pairCoreItems() {
  return [
    { el: 'Q1', x: 200, y: 156 },
    { el: 'Q2', x: 360, y: 156 },
    // each base from its own source to ground
    wire(180, 156, 140, 156),
    wire(140, 156, 140, 176),
    { el: 'Vb1', x: 140, y: 196, dir: 'v' },
    wire(140, 216, 140, 226),
    gnd(140, 226),
    node('b1', 160, 156, 't'),
    wire(340, 156, 300, 156),
    wire(300, 156, 300, 176),
    { el: 'Vb2', x: 300, y: 196, dir: 'v' },
    wire(300, 216, 300, 226),
    gnd(300, 226),
    node('b2', 320, 156, 't'),
    // the emitters, joined, with the tail hanging off the right end
    wire(212, 176, 212, 256),
    wire(212, 256, 460, 256),
    wire(372, 176, 372, 256),
    node('e', 250, 256, 't'),
    wire(460, 256, 460, 266),
    { el: 'Itail', x: 460, y: 286, dir: 'v' },
    wire(460, 306, 460, 316),
    gnd(460, 316),
  ]
}

/** J1 to J4: the pair with a resistor at each collector. */
function pairLayout({ ree = false } = {}) {
  const items = [
    wire(60, 16, 420, 16),
    wire(60, 16, 60, 36),
    { el: 'VCC', x: 60, y: 56, dir: 'v' },
    wire(60, 76, 60, 88),
    gnd(60, 88),
    node('vcc', 150, 16, 't'),
    ...pairCoreItems(),
    wire(260, 16, 260, 36),
    { el: 'RC1', x: 260, y: 56, dir: 'v' },
    wire(260, 76, 260, 136),
    wire(260, 136, 212, 136),
    node('c1', 260, 110, 'r'),
    wire(420, 16, 420, 36),
    { el: 'RC2', x: 420, y: 56, dir: 'v' },
    wire(420, 76, 420, 136),
    wire(420, 136, 372, 136),
    node('c2', 420, 110, 'r'),
  ]
  if (ree) {
    items.push(wire(330, 256, 330, 266), { el: 'REE', x: 330, y: 286, dir: 'v' }, wire(330, 306, 330, 316), wire(330, 316, 460, 316))
  }
  return { w: 540, h: 340, items }
}

/**
 * J5: the same pair with a pnp mirror where the two resistors were. The load
 * devices are mirrored (`flip`), which puts their emitters on the rail above
 * and their collectors on the pair's below, and their two bases meet on the
 * diode-connected side.
 */
function loadedLayout() {
  return {
    w: 540,
    h: 340,
    items: [
      wire(60, 16, 470, 16),
      wire(60, 16, 60, 36),
      { el: 'VCC', x: 60, y: 56, dir: 'v' },
      wire(60, 76, 60, 88),
      gnd(60, 88),
      node('vcc', 150, 16, 't'),
      ...pairCoreItems(),
      { el: 'Q3', x: 272, y: 68, dir: 'h', flip: true },
      wire(260, 48, 215, 48),
      wire(215, 48, 215, 16),
      wire(260, 88, 230, 88),
      wire(230, 88, 230, 136),
      wire(230, 136, 212, 136),
      node('c1', 230, 120, 'r'),
      { el: 'Q4', x: 432, y: 68, dir: 'h', flip: true },
      wire(420, 48, 470, 48),
      wire(470, 48, 470, 16),
      wire(420, 88, 420, 136),
      wire(420, 136, 372, 136),
      node('c2', 410, 136, 'b'),
      // The mirror's two bases meet under the pair of them. Where the link
      // passes Q4's collector lead it is drawn with a gap, the schematic
      // convention for two wires that cross and do not join.
      wire(292, 68, 292, 108),
      wire(292, 108, 414, 108),
      wire(426, 108, 452, 108),
      wire(452, 108, 452, 68),
    ],
  }
}

export const LABELS_J = { Q1: 'Q1', Q2: 'Q2', Q3: 'Q3', Q4: 'Q4' }

// ------------------------------------------------------------ measurements
//
// The gains here are read the way a bench reads them: change one input by a
// known amount and see what the collectors do. A centred difference of the
// exact DC solve is the tangent to the curve at the operating point, which is
// invariant 2 of the plan's §2.12 measured on the circuit itself rather than
// asserted about it.

/** The step each finite difference uses, in volts, small enough to be linear. */
export const STEP = { vid: 2e-4, vcm: 0.2 }

/** A centred difference of `read` against knob `key`, over ±step/2. */
export function slopeAgainst(again, key, at, step, read) {
  const hi = again({ [key]: at + step / 2 })
  const lo = again({ [key]: at - step / 2 })
  return (read(hi) - read(lo)) / step
}

const vod = (x) => x.sol.v.c1 - x.sol.v.c2
const vc1 = (x) => x.sol.v.c1

/** The differential gain, v_od/v_id, at this operating point. */
export const gainD = (x, p, again) => slopeAgainst(again, 'vid', p.vid, STEP.vid, vod)
/** The common-mode gain at one collector, v_c1/v_cm. */
export const gainCM = (x, p, again) => slopeAgainst(again, 'vcm', p.vcm, STEP.vcm, vc1)
/** The rejection ratio: the differential gain over the common-mode gain. */
export const cmrr = (x, p, again) => Math.abs(gainD(x, p, again) / gainCM(x, p, again))
/** The same in decibels. */
export const cmrrDb = (x, p, again) => 20 * Math.log10(cmrr(x, p, again))

/**
 * The input voltage that nulls the output, found by Newton on the circuit.
 *
 * The null depends on the mismatch and on nothing else, so the search starts
 * at zero rather than at wherever v_id happens to sit. One step of the secant
 * from a steered pair overshoots, because the transfer curve is a hyperbolic
 * tangent and its slope there is almost nothing. Three damped steps from the
 * middle land inside a nanovolt.
 */
export function offsetOf(x, p, again) {
  let v = 0
  for (let k = 0; k < 3; k++) {
    const slope = slopeAgainst(again, 'vid', v, STEP.vid, vod)
    v = Math.max(-0.05, Math.min(0.05, v - vod(again({ vid: v })) / slope))
  }
  return v
}

/** The share of the tail in Q1, as a percentage. */
export const shareQ1 = (x) => (100 * x.point.Q1.ic) / (x.point.Q1.ic + x.point.Q2.ic)

/** The difference between the two collector currents. */
const idiff = (x) => x.point.Q1.ic - x.point.Q2.ic

/**
 * How far short of its own tangent the steering curve falls at one thermal
 * voltage of drive, as a percentage. The tangent is the slope at the origin,
 * measured on the circuit; the curve is a hyperbolic tangent, so it drops
 * below the straight line as soon as the drive is comparable with V_T.
 */
export function linearityShortfall(x, p, again) {
  const d = 1e-6
  const slope = (idiff(again({ vid: d })) - idiff(again({ vid: -d }))) / (2 * d)
  const vt = thermalVoltage(300)
  return 100 * (1 - idiff(again({ vid: vt })) / (slope * vt))
}

/**
 * A stand-in for the harness's `again`, for a math entry, which is handed the
 * analysis and the knobs and nothing else. It solves the same netlist at
 * changed knobs, which is what every finite difference above needs, and
 * returns the two fields they read.
 */
export const solverFor = (x, p) => (over) => {
  const norm = normalize(x.exp.net({ ...p, ...over }))
  const sol = newtonDC(norm, {}).sol
  return { sol, point: pointsOf(norm, { sol }) }
}

/** Is every device of this circuit in its active region? */
export const allActive = (x) => Object.values(x.point || {}).every((q) => q.region === 'active')

/** The Early factor a device's own collector voltage gives it, 1 + V_CE/V_A. */
const earlyFactor = (q, va) => 1 + q.vce / va

// ------------------------------------------------------------ the math panel
//
// Every predicted column is written from the knobs and from the operating
// point the solver found, never from a number typed here. A row whose closed
// form does not describe the current settings carries the reason instead of a
// cross, which is REVIEW_PLAYBOOK.md item 1.

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.02, extra = {}) => ({ label, predicted, measured, unit, tol, ...extra })

/** Why the half-circuit gain is not checkable at these settings, or null. */
const adWhy = (p, x, vt) =>
  !allActive(x)
    ? OFF_REGION
    : Math.abs(p.vid) > 2 * vt
      ? 'The pair is steered here rather than balanced, so the two sides no longer share the tail and neither one is the half-circuit this expression describes.'
      : null

const OFF_REGION =
  'One of the devices has left its active region at this setting, and the small-signal model of a saturated transistor is a different circuit.'

export const MATH_J = {
  j1(p, x) {
    const vt = thermalVoltage(300)
    const q1 = x.point.Q1
    const q2 = x.point.Q2
    const early = earlyFactor(q1, p.va) / earlyFactor(q2, p.va)
    return {
      blocks: [
        T('The two emitters share one node and one current. The junction law then fixes how that current divides, from the difference between the two bases and from nothing else.'),
        F('\\frac{i_{C1}}{i_{C2}} = e^{v_{id}/V_T}, \\qquad i_{C1} = \\frac{\\alpha I}{1 + e^{-v_{id}/V_T}}'),
        C([
          row('the ratio of the two collector currents', Math.exp(p.vid / vt) * early, q1.ic / q2.ic, '', 0.01, {
            unchecked: allActive(x) ? null : OFF_REGION,
          }),
          row('the tail the two emitters share', p.itail, -(q1.ie + q2.ie), 'A', 1e-9),
        ]),
        V([
          { label: 'the share in Q1', value: shareQ1(x), unit: '%', note: 'the same fraction whatever the tail current is' },
          { label: 'the Early correction to the ratio', value: early, unit: '', note: 'the two collectors sit at different voltages, so their currents are scaled differently' },
        ]),
      ],
    }
  },

  j2(p, x) {
    const q = x.point.Q1
    const q2 = x.point.Q2
    const rl = (p.rc * q.ro) / (p.rc + q.ro)
    const rl2 = (p.rc * q2.ro) / (p.rc + q2.ro)
    // Away from balance the two sides no longer share the tail, and what
    // reaches the collectors is set by the two transconductances in series
    // with each other. At balance the expression is g_m(R_C ∥ r_o) again.
    const ad = (-(rl + rl2) * q.gm * q2.gm) / (q.gm + q2.gm)
    const vt = thermalVoltage(300)
    // Past a couple of thermal voltages one side has most of the tail, its
    // own r_o is a large part of what the other side sees, and the two
    // transconductances alone stop describing the gain.
    return {
      blocks: [
        T('A balanced drive leaves the shared emitter node still, so each side is a common-emitter stage with its emitter at signal ground, working at half the tail current.'),
        F('A_d = \\frac{v_{od}}{v_{id}} = -g_m (R_C \\parallel r_o), \\qquad g_m = \\frac{I_C}{V_T}'),
        C([
          row('the transconductance of one side', q.ic / vt, q.gm, 'A/V', 1e-6),
          row('the differential gain', ad, x.tf ? x.gain : NaN, '', 0.02, { unchecked: adWhy(p, x, vt) }),
        ]),
        V([
          { label: 'the collector load, R_C ∥ r_o', value: rl, unit: 'Ω' },
          { label: 'the gain at balance, −g_m(R_C ∥ r_o)', value: -q.gm * rl, unit: '', note: 'the same expression with the two sides sharing the tail equally' },
          { label: 'the gain a single collector gives', value: (q.gm * rl) / 2, unit: '', note: 'half the differential gain, because only one of the two collectors is read' },
        ]),
      ],
    }
  },

  j3(p, x) {
    const again = solverFor(x, p)
    const acm = gainCM(x, p, again)
    const ad = gainD(x, p, again)
    const q = x.point.Q1
    const q2 = x.point.Q2
    // The hand model of a common-mode input: both bases rise together, the
    // shared node follows all but v_cm/(1 + (g1 + g2)R_EE) of the way, and
    // what is left drives each collector in proportion to its own
    // transconductance. With a large tail resistance this is −R_C/(2R_EE).
    const acmP = (-p.rc * q.gm) / (1 + (q.gm + q2.gm) * p.ree)
    const rl1 = (p.rc * q.ro) / (p.rc + q.ro)
    const rl2 = (p.rc * q2.ro) / (p.rc + q2.ro)
    const adP = (-(rl1 + rl2) * q.gm * q2.gm) / (q.gm + q2.gm)
    const vt = thermalVoltage(300)
    // Both expressions are written for a balanced pair with no Early effect
    // in them. Steer the pair and the two sides stop sharing the tail, so the
    // current a common-mode input makes no longer divides evenly. Raise the
    // tail resistance past a few hundred kilohms and r_o, not R_EE, is what
    // limits the rejection. Each case is named rather than crossed out.
    const why = !allActive(x)
      ? OFF_REGION
      : Math.abs(p.vid) > vt / 4
        ? 'The pair is steered here rather than balanced, so a common-mode current no longer divides evenly between the two sides and these expressions describe neither.'
        : p.ree > 3e5
          ? 'Past a few hundred kilohms the tail resistance is no longer what limits the rejection. The Early effect inside each transistor is, and these two closed forms do not carry it.'
          : null
    return {
      blocks: [
        T('A signal common to both inputs asks the shared emitter node to move with it. Only the current the tail resistance passes gets through, so that resistance and the transconductance set the rejection.'),
        F('A_{cm} = \\frac{-R_C g_m}{1 + 2 g_m R_{EE}} \\to -\\frac{R_C}{2R_{EE}}, \\qquad \\mathrm{CMRR} = \\left|\\frac{A_d}{A_{cm}}\\right| \\to 2 g_m R_{EE}'),
        C([
          row('the common-mode gain at one collector', acmP, acm, '', 0.03, { unchecked: why }),
          row('the rejection ratio', Math.abs(adP / acmP), Math.abs(ad / acm), '', 0.03, { unchecked: why }),
        ]),
        V([
          { label: 'the rejection in decibels', value: 20 * Math.log10(Math.abs(ad / acm)), unit: 'dB' },
          { label: 'the differential gain, for the ratio', value: ad, unit: '' },
          { label: 'the large-tail form, −R_C/2R_EE', value: -p.rc / (2 * p.ree), unit: '', note: 'the row above with the 1/g_m at the shared node dropped' },
          { label: 'the large-tail rejection, 2 g_m R_EE', value: 2 * q.gm * p.ree, unit: '' },
        ]),
      ],
    }
  },

  j4(p, x) {
    const again = solverFor(x, p)
    const vt = thermalVoltage(300)
    const predicted = -vt * (Math.log(1 + p.drc / 100) + Math.log(1 + p.dis / 100))
    const vos = offsetOf(x, p, again)
    return {
      blocks: [
        T('At the null the two collectors sit at the same voltage, so the two collector currents stand in the inverse ratio of the two resistors. The junction law then says which input holds them there.'),
        F('V_{OS} = -V_T \\ln\\!\\left(1 + \\frac{\\Delta R_C}{R_C}\\right) - V_T \\ln\\!\\left(1 + \\frac{\\Delta I_S}{I_S}\\right)'),
        C([row('the input that nulls the output', predicted, vos, 'V', 0.01, { abs: 1e-8, unchecked: allActive(x) ? null : OFF_REGION })]),
        V([
          { label: 'the textbook’s first term, V_T ΔR_C/R_C', value: (vt * p.drc) / 100, unit: 'V', note: 'the logarithm’s leading term, half a per cent high at a mismatch of one per cent' },
          { label: 'the output offset it makes', value: x.sol.v.c1 - x.sol.v.c2, unit: 'V' },
        ]),
      ],
    }
  },

  j5(p, x) {
    const q2 = x.point.Q2
    const q4 = x.point.Q4
    const vt = thermalVoltage(300)
    const rl = (q2.ro * q4.ro) / (q2.ro + q4.ro)
    return {
      blocks: [
        T('The mirror carries whatever the left side of the pair carries and delivers it into the output node, where the right side is already pulling. Both halves drive one output, into the two output resistances in parallel.'),
        F('A_d = g_m (r_{o2} \\parallel r_{o4}), \\qquad g_m r_o = \\frac{V_A + V_{CE}}{V_T}'),
        C([
          row('the gain into the mirror’s output', q2.gm * rl, x.tf ? x.gain : NaN, '', 1e-3, { unchecked: allActive(x) ? null : OFF_REGION }),
          row('one device’s intrinsic gain', (p.va + q2.vce) / vt, q2.gm * q2.ro, '', 1e-6, { unchecked: allActive(x) ? null : OFF_REGION }),
        ]),
        V([
          { label: 'the output’s own resting voltage', value: x.sol.v.c2, unit: 'V', note: 'set by two currents matching rather than by a resistor, so it moves with the mirror’s current gain' },
          { label: 'the load the two output resistances make', value: rl, unit: 'Ω' },
        ]),
      ],
    }
  },
}

// ------------------------------------------------------------ the experiments

export const GROUP_J = [
  {
    id: 'j1',
    group: GROUP,
    name: 'The tail current steers between the two',
    terms: ['diffpair', 'tailcurrent'],
    params: [VID(), VCM(), TAIL(), RC(), BETA(), EARLY()],
    net: pairNet,
    labels: LABELS_J,
    layout: pairLayout(),
    show: 'dc',
    view: 'transfer',
    views: ['reading', 'transfer', 'equations'],
    sweepOver: { key: 'vid', from: -0.15, to: 0.15, points: 121, label: 'v_id', read: (sol) => sol.v.c1 },
    headline: { path: 'op.Q1.ic', label: 'I_C1', unit: 'A' },
  },
  {
    id: 'j2',
    group: GROUP,
    name: 'Each side is a common emitter at half the tail',
    terms: ['halfcircuit'],
    params: [VID(), VCM(), TAIL(), RC(), BETA(), EARLY()],
    net: pairNet,
    labels: LABELS_J,
    layout: pairLayout(),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    at: 1000,
    signal: { input: 'Vb1', output: { across: ['c1', 'c2'] } },
    headline: { path: 'gain', label: 'A_d', unit: '' },
  },
  {
    id: 'j3',
    group: GROUP,
    name: 'The tail’s resistance sets the rejection',
    terms: ['tailresistance', 'cmrr'],
    params: [chips(Ree('ree', 'Tail resistance R_EE', 1e5), [1e4, 1e5, 1e6]), VCM(), VID(), TAIL(), RC(), BETA(), EARLY()],
    net: pairNet,
    labels: LABELS_J,
    layout: pairLayout({ ree: true }),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    headline: { path: 'v.c1', label: 'v_c1', unit: 'V' },
  },
  {
    id: 'j4',
    group: GROUP,
    name: 'Mismatch reads as an offset at the input',
    terms: ['inputoffset', 'offset'],
    params: [
      chips(Mismatch('drc', 'Collector mismatch ΔR_C/R_C', 1), [1, 5, 10]),
      chips(Mismatch('dis', 'Device mismatch ΔI_S/I_S', 0), [0, 5, 10]),
      VID(),
      VCM(),
      TAIL(),
      RC(),
      BETA(),
      EARLY(),
    ],
    net: pairNet,
    labels: LABELS_J,
    layout: pairLayout(),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'transfer', 'equations'],
    sweepOver: { key: 'vid', from: -0.01, to: 0.01, points: 121, label: 'v_id', read: (sol) => sol.v.c1 - sol.v.c2 },
    headline: { path: 'vd.c1.c2', label: 'v_od', unit: 'V' },
  },
  {
    id: 'j5',
    group: GROUP,
    name: 'A mirror load makes one output of two',
    terms: ['mirror', 'activeload'],
    params: [VID(), VCM(), TAIL(), BETA(), chips(Beta('betap', 'Load current gain β_p', 100), [25, 100, 400]), EARLY()],
    net: loadedNet,
    labels: LABELS_J,
    layout: loadedLayout(),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    at: 1000,
    signal: { input: 'Vb1', output: 'c2' },
    headline: { path: 'gain', label: 'A_d', unit: '' },
  },
]
