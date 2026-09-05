// Group I: mirrors, active loads, and stacking stages.
//
// Group H measured one stage's three numbers. This group builds the parts an
// integrated amplifier is made of rather than the parts a breadboard is made
// of. A resistor sets a current badly, because it divides a supply that moves
// and drops a voltage that changes with temperature. A transistor matched to
// another one sets a current well, and the same trick used as a load rather
// than as a source is what takes a single stage past a gain of a thousand.
//
// Everything here is the exponential model, because every claim in the group
// is about one current following another, and the three-region model pins
// v_BE at 0.7 V and cannot describe matching at all.
//
// The two measurement methods are Group H's, imported rather than repeated. A
// port resistance is a test source at the port with the ratio read off, and a
// stage's own gain is one volt held at a node of the tangent netlist.
//
// A transistor's leads leave its pins sideways in every drawing here, for the
// reason Group H's file gives: the glyph writes its label below it and its
// reading above it, and a lead that turns too early lands on the writing.

import { Cap, Gain, Is, R, Toggle, Vs, chips, gnd, node, wire } from '../knobs.js'
import { NPN, VCC, VT, gainFrom, portR, vbeFor } from './h.js'

const GROUP = 'I · Mirrors, active loads, and stacking'

const W = 480
const H = 220
const W2 = 560
const H2 = 240
const TOP = 30

/** A device's label is its id alone, so a lead can leave a pin without landing on the writing. */
const IDS = { Q1: 'Q1', Q2: 'Q2', Q3: 'Q3' }

const q = (id, nodes, p, over = {}) => ({ type: 'Q', id, nodes, model: 'exp', beta: p.beta, va: p.va, is: NPN.is, ...over })

/** The resistor that puts `iref` through a diode-connected transistor from the supply. */
function refResistor(p, va) {
  const vbe = vbeFor({ ic: p.iref, va, vce: 0.7 })
  return (VCC - vbeFor({ ic: p.iref, va, vce: vbe })) / p.iref
}

// ------------------------------------------------------------ netlists

/** The two-transistor mirror: one diode-connected, one copying it. */
export function mirror(p) {
  const va = p.early === false ? Infinity : p.va
  return { elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: VCC },
    { type: 'R', id: 'Rref', nodes: ['vcc', 'ref'], value: refResistor(p, va) },
    q('Q1', ['ref', 'ref', 'gnd'], p, { va }),
    q('Q2', ['out', 'ref', 'gnd'], p, { va }),
    { type: 'V', id: 'Vout', nodes: ['out', 'gnd'], value: p.vout },
  ] }
}

/** The Widlar source: the same mirror with a resistor under the copying emitter. */
export function widlar(p) {
  return { elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: VCC },
    { type: 'R', id: 'Rref', nodes: ['vcc', 'ref'], value: refResistor(p, p.va) },
    q('Q1', ['ref', 'ref', 'gnd'], p),
    q('Q2', ['out', 'ref', 'e2'], p),
    { type: 'R', id: 'RE', nodes: ['e2', 'gnd'], value: p.RE },
    { type: 'V', id: 'Vout', nodes: ['out', 'gnd'], value: p.vout },
  ] }
}

/**
 * The active load: a pnp mirror in place of the collector resistor. `trim` is
 * the ratio between the current the npn is biased for and the current the
 * mirror delivers, and it is a knob because one per cent of mismatch is what
 * moves the output.
 */
export function activeLoad(p) {
  const veb = vbeFor({ ic: p.iref, va: p.va, vce: 0.7 })
  return { elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: VCC },
    q('Q2', ['ref', 'ref', 'vcc'], p, { polarity: 'pnp' }),
    { type: 'R', id: 'Rref', nodes: ['ref', 'gnd'], value: (VCC - veb) / p.iref },
    q('Q3', ['c', 'ref', 'vcc'], p, { polarity: 'pnp' }),
    { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: vbeFor({ ic: p.iref * p.trim, va: p.va, vce: VCC / 2 }) },
    { type: 'V', id: 'Vs', nodes: ['b', 'bb'], value: p.vin, small: true },
    q('Q1', ['c', 'b', 'gnd'], p),
  ] }
}

/** The cascode: a common base standing on a common emitter. */
export function cascode(p) {
  const vb2 = p.vc1 + vbeFor({ ic: p.ic, va: p.va, vce: VCC - p.ic * p.RC - p.vc1 })
  return { elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: VCC },
    { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: p.RC },
    { type: 'V', id: 'VB2', nodes: ['b2', 'gnd'], value: vb2 },
    q('Q2', ['c', 'b2', 'c1'], p),
    { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: vbeFor({ ic: p.ic, va: p.va, vce: p.vc1 }) },
    { type: 'V', id: 'Vs', nodes: ['b', 'bb'], value: p.vin, small: true },
    q('Q1', ['c1', 'b', 'gnd'], p),
  ] }
}

/** Two common-emitter stages, coupled by a capacitor so each keeps its own bias. */
export function twoStage(p) {
  const vbb = vbeFor({ ic: p.ic, va: p.va, vce: VCC - p.ic * p.RC })
  return { elements: [
    { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: VCC },
    { type: 'R', id: 'RC1', nodes: ['vcc', 'c1'], value: p.RC },
    { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: vbb },
    { type: 'V', id: 'Vs', nodes: ['b1', 'bb'], value: p.vin, small: true },
    q('Q1', ['c1', 'b1', 'gnd'], p),
    { type: 'C', id: 'CC', nodes: ['c1', 'b2'], value: p.CC },
    { type: 'R', id: 'RB2', nodes: ['vcc', 'b2'], value: (VCC - vbb) / (p.ic / p.beta) },
    { type: 'R', id: 'RC2', nodes: ['vcc', 'c2'], value: p.RC },
    q('Q2', ['c2', 'b2', 'gnd'], p),
  ] }
}

// ------------------------------------------------------------ knobs

const IREF = () => chips(Is('iref', 'Reference current I_ref', 1e-3), [0.25e-3, 1e-3, 2e-3])
const BETA = () => chips(Gain('beta', 'Current gain β', NPN.beta), [50, 100, 1000])
const VA = () => chips(Gain('va', 'Early voltage V_A', NPN.va, 'in volts'), [25, 100, 1000])
const VOUT = () => chips(Vs('vout', 'Output voltage', 5), [1, 5, 9])
const DRIVE = (span = 0.2) => ({ key: 'vin', label: 'Input v_in', unit: 'V', min: -span, max: span, scale: 'linear', default: 0, hint: 'the signal, riding on the bias' })

// ------------------------------------------------------------ drawings
//
// The two mirrors share one drawing. The three circuits with two or three
// transistors on them need a larger canvas: a transistor's glyph is 40 across
// and 40 down, its label hangs 34 below it and its reading 34 above it, and a
// node's name and voltage are 50 wide wherever they land.

/** The mirror, with the emitter resistor of the Widlar source when there is one. */
function mirrorLayout(withRE) {
  const items = [
    { el: 'VCC', x: 45, y: 60, dir: 'v' },
    wire(45, TOP, 45, 40),
    wire(45, 80, 45, 180),
    gnd(45, 180),
    wire(45, TOP, 280, TOP),
    node('vcc', 110, TOP, 't'),
    wire(280, TOP, 280, 45),
    { el: 'Rref', x: 280, y: 65, dir: 'v' },
    wire(280, 85, 280, 95),
    wire(150, 95, 280, 95),
    node('ref', 200, 95, 't'),
    wire(150, 95, 150, 140),
    wire(150, 140, 180, 140),
    { el: 'Q1', x: 200, y: 140, dir: 'h' },
    wire(212, 120, 240, 120),
    wire(240, 120, 240, 95),
    wire(212, 160, 212, 180),
    gnd(212, 180),
    { el: 'Q2', x: 380, y: 140, dir: 'h' },
    wire(330, 95, 330, 140),
    wire(330, 140, 360, 140),
    wire(392, 120, 450, 120),
    node('out', 425, 120, 'b'),
    { el: 'Vout', x: 470, y: 120, dir: 'h' },
    wire(490, 120, 510, 120),
    wire(510, 120, 510, 180),
    gnd(510, 180),
  ]
  if (withRE) {
    items.push(
      wire(392, 160, 392, 185),
      node('e2', 392, 185, 'r'),
      wire(320, 185, 392, 185),
      { el: 'RE', x: 300, y: 185, dir: 'h' },
      wire(280, 185, 260, 185),
      wire(260, 185, 260, 200),
      gnd(260, 200),
    )
  } else {
    items.push(wire(392, 160, 392, 180), gnd(392, 180))
  }
  return { w: 540, h: withRE ? 220 : 200, items, labels: IDS }
}

/**
 * The active load. The pnp mirror runs along the top with its reference on the
 * right, its output transistor on the left, and the amplifying npn under that
 * one, so the output column never has to cross the mirror's base rail.
 */
function activeLoadLayout() {
  return { w: 500, h: 250, items: [
    { el: 'VCC', x: 45, y: 60, dir: 'v' },
    wire(45, TOP, 45, 40),
    wire(45, 80, 45, 195),
    gnd(45, 195),
    wire(45, TOP, 470, TOP),
    node('vcc', 110, TOP, 't'),
    { el: 'Q3', x: 250, y: 90, dir: 'h', flip: true },
    wire(238, 70, 210, 70),
    wire(210, 70, 210, TOP),
    wire(270, 90, 285, 90),
    wire(285, 90, 285, 145),
    { el: 'Q2', x: 420, y: 90, dir: 'h', flip: true },
    wire(408, 70, 470, 70),
    wire(470, 70, 470, TOP),
    wire(440, 90, 455, 90),
    wire(455, 90, 455, 145),
    wire(408, 110, 408, 145),
    wire(285, 145, 455, 145),
    node('ref', 330, 145, 't'),
    wire(355, 145, 355, 155),
    { el: 'Rref', x: 355, y: 175, dir: 'v' },
    wire(355, 195, 355, 215),
    gnd(355, 215),
    wire(238, 110, 238, 170),
    node('c', 238, 150, 'l'),
    { el: 'Q1', x: 300, y: 190, dir: 'h' },
    wire(238, 170, 312, 170),
    wire(312, 210, 312, 232),
    wire(312, 232, 260, 232),
    gnd(260, 232),
    wire(280, 190, 225, 190),
    node('b', 250, 190, 't'),
    { el: 'Vs', x: 205, y: 190, dir: 'h' },
    wire(185, 190, 130, 190),
    node('bb', 155, 190, 't'),
    { el: 'VBB', x: 110, y: 190, dir: 'h' },
    wire(90, 190, 70, 190),
    wire(70, 190, 70, 215),
    gnd(70, 215),
  ], labels: IDS }
}

/** The cascode: the common base standing on the common emitter. */
function cascodeLayout() {
  return { w: 560, h: 250, items: [
    { el: 'VCC', x: 45, y: 60, dir: 'v' },
    wire(45, TOP, 45, 40),
    wire(45, 80, 45, 200),
    gnd(45, 200),
    wire(45, TOP, 470, TOP),
    node('vcc', 110, TOP, 't'),
    wire(470, TOP, 470, 45),
    { el: 'RC', x: 470, y: 65, dir: 'v' },
    wire(470, 85, 470, 105),
    node('c', 470, 105, 'r'),
    wire(430, 105, 470, 105),
    wire(430, 105, 430, 85),
    { el: 'Q2', x: 400, y: 105, dir: 'h' },
    wire(412, 85, 430, 85),
    wire(412, 125, 430, 125),
    wire(430, 125, 430, 160),
    node('c1', 430, 145, 'r'),
    wire(380, 105, 350, 105),
    node('b2', 350, 105, 't'),
    wire(310, 105, 350, 105),
    { el: 'VB2', x: 290, y: 105, dir: 'h' },
    wire(270, 105, 240, 105),
    wire(240, 105, 240, 225),
    gnd(240, 225),
    { el: 'Q1', x: 400, y: 180, dir: 'h' },
    wire(412, 160, 430, 160),
    wire(412, 200, 412, 215),
    wire(412, 215, 460, 215),
    gnd(460, 215),
    wire(380, 180, 350, 180),
    node('b', 350, 180, 't'),
    { el: 'Vs', x: 310, y: 180, dir: 'h' },
    wire(330, 180, 350, 180),
    node('bb', 266, 180, 't'),
    wire(240, 180, 290, 180),
    { el: 'VBB', x: 180, y: 180, dir: 'h' },
    wire(200, 180, 240, 180),
    wire(160, 180, 130, 180),
    wire(130, 180, 130, 225),
    gnd(130, 225),
  ], labels: IDS }
}

/** Two stages side by side, the capacitor between them. */
function twoStageLayout() {
  return { w: 600, h: 250, items: [
    { el: 'VCC', x: 45, y: 60, dir: 'v' },
    wire(45, TOP, 45, 40),
    wire(45, 80, 45, 200),
    gnd(45, 200),
    wire(45, TOP, 510, TOP),
    node('vcc', 110, TOP, 't'),
    wire(260, TOP, 260, 45),
    { el: 'RC1', x: 260, y: 65, dir: 'v' },
    wire(260, 85, 260, 120),
    wire(227, 120, 260, 120),
    node('c1', 285, 120, 'b'),
    wire(260, 120, 310, 120),
    { el: 'Q1', x: 215, y: 140, dir: 'h' },
    wire(227, 160, 227, 205),
    gnd(227, 205),
    wire(195, 140, 140, 140),
    node('b1', 165, 140, 't'),
    { el: 'Vs', x: 120, y: 140, dir: 'h' },
    node('bb', 70, 140, 't'),
    wire(100, 140, 70, 140),
    wire(70, 140, 70, 170),
    { el: 'VBB', x: 70, y: 190, dir: 'v' },
    wire(70, 210, 70, 225),
    gnd(70, 225),
    { el: 'CC', x: 330, y: 120, dir: 'h' },
    wire(350, 120, 410, 120),
    node('b2', 378, 120, 'b'),
    wire(410, 120, 410, 140),
    wire(410, 140, 430, 140),
    wire(410, 120, 410, 95),
    { el: 'RB2', x: 410, y: 65, dir: 'v' },
    wire(410, 45, 410, TOP),
    { el: 'Q2', x: 450, y: 140, dir: 'h' },
    wire(462, 120, 510, 120),
    node('c2', 510, 120, 'r'),
    wire(510, 120, 510, 85),
    { el: 'RC2', x: 510, y: 65, dir: 'v' },
    wire(510, 45, 510, TOP),
    wire(462, 160, 462, 205),
    gnd(462, 205),
  ], labels: IDS }
}

// ------------------------------------------------------------ the experiments

export const GROUP_I = [
  {
    id: 'i1',
    group: GROUP,
    name: 'The current mirror copies a current',
    terms: ['mirror', 'matching'],
    params: [IREF(), VOUT(), BETA(), VA(), Toggle('early', 'Early effect', true, 'on', 'off', 'with it off the two collector currents differ only by the base currents')],
    net: mirror,
    layout: mirrorLayout(false),
    labels: IDS,
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    headline: { path: 'op.Q2.ic', label: 'I_out', unit: 'A' },
  },
  {
    id: 'i2',
    group: GROUP,
    name: 'The Widlar source makes a small current',
    terms: ['widlar'],
    params: [chips(R('RE', 'Emitter R_E', 11906), [2000, 11906, 40000]), IREF(), VOUT(), BETA(), VA()],
    net: widlar,
    layout: mirrorLayout(true),
    labels: IDS,
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    headline: { path: 'op.Q2.ic', label: 'I_out', unit: 'A' },
  },
  {
    id: 'i3',
    group: GROUP,
    name: 'An active load reaches the intrinsic gain',
    terms: ['activeload', 'intrinsicgain'],
    params: [IREF(), { key: 'trim', label: 'Bias trim', unit: '', min: 0.97, max: 1.03, scale: 'linear', default: 1, hint: 'the npn’s current against the mirror’s' }, BETA(), VA(), DRIVE(0.02)],
    net: activeLoad,
    layout: activeLoadLayout(),
    labels: IDS,
    show: 'dc',
    view: 'reading',
    views: ['reading', 'transfer', 'equations'],
    signal: { input: 'Vs', output: 'c' },
    sweepOver: { key: 'vin', from: -0.004, to: 0.004, label: 'v_in' },
    small: 'Vs',
    headline: { path: 'gain', label: 'A_v', unit: '' },
  },
  {
    id: 'i4',
    group: GROUP,
    name: 'The cascode raises the output resistance',
    terms: ['cascode'],
    params: [
      chips(R('RC', 'Collector R_C', 5000), [2000, 5000, 8000]),
      chips(Vs('vc1', 'Lower collector V_C1', 1.5), [1, 1.5, 3]),
      chips(Is('ic', 'Collector current I_C', 1e-3), [0.25e-3, 1e-3, 1.5e-3]),
      BETA(),
      VA(),
      DRIVE(),
    ],
    net: cascode,
    layout: cascodeLayout(),
    labels: IDS,
    show: 'dc',
    view: 'reading',
    views: ['reading', 'transfer', 'equations'],
    signal: { input: 'Vs', output: 'c' },
    sweepOver: { key: 'vin', from: -0.03, to: 0.03, label: 'v_in' },
    small: 'Vs',
    headline: { path: 'gain', label: 'A_v', unit: '' },
  },
  {
    id: 'i5',
    group: GROUP,
    name: 'Two stages, and what the second one loads',
    terms: ['cascade'],
    params: [
      chips(R('RC', 'Collector R_C', 5000), [1000, 3000, 5000]),
      chips(Is('ic', 'Collector current I_C', 1e-3), [0.25e-3, 1e-3, 1.5e-3]),
      Cap('CC', 'Coupling C_C', 10e-6),
      BETA(),
      VA(),
      DRIVE(),
    ],
    net: twoStage,
    layout: twoStageLayout(),
    labels: IDS,
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    signal: { input: 'Vs', output: 'c2' },
    probe: 1000,
    at: 1000,
    small: 'Vs',
    headline: { path: 'H.db', label: 'gain', unit: 'dB' },
  },
]
