// The experiments: each is a circuit, the knobs on it, how to draw it, a note
// that makes a claim, and which pane best shows the claim.
//
// The netlist is data for @ee-labs/network, which solves it exactly. The note
// is prose, and prose drifts — so experiments.test.js loads every experiment
// at its defaults and measures the claim its note makes. A claim the test
// cannot measure does not ship.
//
// Groups follow the plan: A the elements themselves and what the signs mean,
// B the two laws, C series/parallel, D the analysis methods and theorems, E
// the op-amp as a circuit element, F the capacitor and inductor — elements
// with a state, so the circuit has a time axis — and G the second-order
// circuit and its three damping faces.
//
// An experiment with a capacitor or inductor in it is dynamic: `window(p)` is
// the span of time shown, `cursor` the fraction of it the schematic's meters
// read at until the reader scrubs, and `scope` which waveforms the scope
// draws on which axis. Everything else is as for the resistive groups.

import { fmt } from '@ee-labs/ui'
import { layoutExtent, placeCallout } from './layoutCheck.js'
import { LESSONS } from './lessons.js'
import { HEADLINES, calloutStandIn } from './headlines.js'
import { THEOREMS } from './theorems.js'

// Every view a lower pane can show, in the order the view switch lists them —
// the same order in every experiment, so a tab sits in the same place from one
// to the next. The reading (every meter at once, the DC groups' opening view)
// and the two universal views lead; the rest follow the curriculum.
export const VIEW_ORDER = ['reading', 'iv', 'assumed', 'equations', 'power', 'thevenin', 'equivalent', 'superposition', 'sweep', 'scope', 'state', 'energy', 'damping', 'phasor', 'impedance', 'bode', 'acpower']

// What the view switch calls each view, and the hover text that says what it shows.
export const VIEW_LABELS = {
  reading: { label: 'Reading', title: 'The one number this experiment is about, and every meter on the circuit at once' },
  iv: { label: 'i–v plane', title: 'Current against voltage: the diode’s curve, the four models of it, the load line the rest of the circuit imposes, and where they meet' },
  assumed: { label: 'Assumed states', title: 'Every combination of diode states, each solved and then checked against its own answer — the three that contradict themselves, and the one that does not' },
  equations: { label: 'Equations', title: 'The equations the solver built: the two laws in words, each row with live values, the matrix in letters and in numbers' },
  power: { label: 'Power', title: 'p = v × i for every element — who delivers, who absorbs, and the two totals matching' },
  thevenin: { label: 'Thévenin', title: 'The equivalent seen at the port, found three ways' },
  equivalent: { label: 'Equivalent', title: 'The Thévenin equivalent drawn as a circuit beside the original, and the load line both obey' },
  superposition: { label: 'Superposition', title: 'Each source alone, and the sum' },
  sweep: { label: 'Load sweep', title: 'The port quantity as the load resistance sweeps' },
  scope: { label: 'Scope', title: 'Voltages and currents against time; drag to move the cursor' },
  state: { label: 'State equation', title: 'ẋ = Ax + Bu as built, its roots, and the state before t = 0' },
  energy: { label: 'Energy', title: 'Where the energy went: stored, dissipated, supplied' },
  damping: { label: 'Damping sweep', title: 'Overshoot and settling time as R sweeps through critical' },
  phasor: { label: 'Phasors', title: 'Each steady-state voltage as a turning arrow, beside the waveform its tip draws' },
  impedance: { label: 'Impedance', title: '|Z| and ∠Z seen by the source against frequency; the marker is the drive' },
  bode: { label: 'Bode', title: '|H| in dB and ∠H against log frequency; the marker is the drive' },
  acpower: { label: 'AC power', title: 'P, Q, |S| and power factor per element from the phasors' },
}
// Before D5 gives the equivalent its name, the view is called by what it is:
// the circuit as the load sees it. C3 uses it that way, one experiment early.
const UNNAMED = {
  thevenin: { label: 'Seen from the load', title: 'What the load sees: the voltage with nothing connected, and one resistance behind it, found three ways' },
}
/** The label and hover text for `view` in `exp`: the name a theorem has only once the curriculum has given it. */
export function viewLabel(view, exp) {
  const before = EXPERIMENTS.findIndex((e) => e.id === exp.id) < EXPERIMENTS.findIndex((e) => e.id === 'd5')
  return (before && UNNAMED[view]) || VIEW_LABELS[view]
}

export const GROUPS = [
  'A · Elements and signs',
  'B · Two laws',
  'C · Series and parallel',
  'D · Analysis and theorems',
  'E · Op-amps',
  'F · Elements that remember',
  'G · Second order',
  'H · Sinusoids and phasors',
  'I · The diode',
]

// ------------------------------------------------------------ knobs
const R = (key, label, def, hint) => ({ key, label, unit: 'Ω', min: 1, max: 1e6, scale: 'log', default: def, hint })
const Vs = (key, label, def, hint) => ({ key, label, unit: 'V', min: -24, max: 24, scale: 'linear', default: def, hint })
const Is = (key, label, def, hint) => ({ key, label, unit: 'A', min: -0.1, max: 0.1, scale: 'linear', default: def, hint })
const Gain = (key, label, def) => ({ key, label, unit: '', min: 1, max: 1e6, scale: 'log', default: def })
const Cap = (key, label, def, hint) => ({ key, label, unit: 'F', min: 1e-9, max: 1e-3, scale: 'log', default: def, hint })
const Ind = (key, label, def, hint) => ({ key, label, unit: 'H', min: 1e-6, max: 10, scale: 'log', default: def, hint })
const Per = (key, label, def, hint) => ({ key, label, unit: 's', min: 1e-6, max: 1, scale: 'log', default: def, hint })
const Freq = (key, label, def, hint) => ({ key, label, unit: 'Hz', min: 1, max: 1e5, scale: 'log', default: def, hint })
// Degrees, not engineering notation: "500 m°" is nobody's phase.
const Deg = (key, label, def) => ({ key, label, unit: '°', min: -180, max: 180, scale: 'linear', default: def, eng: false })
// The time window is measured in the circuit's own unit — time constants or
// cycles — so that whatever the knobs, the trace shows the whole story and the
// sample grid resolves it.
const Win = (key, label, unit, def, min = 1, max = 20) => ({ key, label, unit, min, max, scale: 'linear', default: def })
/** A two-position knob: `on` and `off` are the texts of the two positions. */
const Toggle = (key, label, def, on, off, hint) => ({ key, label, kind: 'toggle', default: def, on, off, hint })
/** More than two positions of the same control — the diode's four models. */
const Choice = (key, label, def, options, hint) => ({ key, label, kind: 'choice', default: def, options, hint })
const DIODE_MODEL = (def = 'drop', hint) =>
  Choice(
    'model',
    'Diode model',
    def,
    [
      { value: 'ideal', label: 'ideal' },
      { value: 'drop', label: '0.7 V' },
      { value: 'pwl', label: '+ r_d' },
      { value: 'exp', label: 'curve' },
    ],
    hint,
  )
/** Resistances the note talks about, offered as chips under the knob. */
// Preset chips carry their unit so 1591.5 reads as 1.59 kHz, not as a bare number.
const chips = (knob, presets) => ({ ...knob, presets: presets.map((v) => ({ value: v, label: fmt(v, knob.unit, 3) })) })

// ------------------------------------------------------------ drawing
// A 420 × 180 canvas. Rails at y = 40 (top) and y = 140 (bottom); the source
// stands on the left at x = 50; vertical legs are centred at y = 90 and carry
// their label and reading on the right, which is why legs sit 90 apart. Every
// layout is checked as geometry in experiments.test.js — no text on any other
// text, symbol or wire — so a change here that crowds the drawing fails a test
// rather than a screenshot.
const W = 420
const H = 180
const TOP = 40
const BOT = 140
const MID = 90
const LEGS = [180, 270, 360]
const leg = (id, x, flip = false) => [{ el: id, x, y: MID, dir: 'v', flip }, { wire: [x, TOP, x, MID - 20] }, { wire: [x, MID + 20, x, BOT] }]
const src = (id, x = 50) => leg(id, x)
const top = (id, x) => [{ el: id, x, y: TOP, dir: 'h' }]
const rail = (x1, x2, y) => ({ wire: [x1, y, x2, y] })
const node = (name, x, y, side = 't') => ({ node: name, x, y, side })
const gnd = (x, y = BOT) => ({ gnd: [x, y] })

/** Source on the left, a series element on top, then N legs to ground. */
function ladder(legs, series = 'R1', flipped = []) {
  const xs = LEGS.slice(0, legs.length)
  const last = xs[xs.length - 1]
  return {
    w: W,
    h: H,
    items: [
      ...src('V1'),
      rail(50, 100, TOP),
      ...top(series, 120),
      rail(140, last, TOP),
      ...legs.flatMap((id, k) => leg(id, xs[k], flipped.includes(id))),
      rail(50, last, BOT),
      gnd(115),
      node('in', 50, TOP, 't'),
      node('A', LEGS[0], TOP, 't'),
    ],
  }
}

/**
 * Source on the left, elements around one loop. `names` renames the nodes
 * between the series elements, for a circuit whose middle node has a name of
 * its own in the netlist — a rectifier's output, say, rather than n1.
 */
function loop(series, names = []) {
  // series: ids along the top and down the right side, in order.
  const items = [...src('V1'), rail(50, 340, BOT), gnd(115), node('in', 50, TOP, 't')]
  const xs = [120, 230]
  let x = 50
  series.slice(0, -1).forEach((id, k) => {
    items.push(rail(x, xs[k] - 20, TOP), ...top(id, xs[k]))
    x = xs[k] + 20
    items.push(node(names[k] || `n${k + 1}`, x + 35, TOP, 't'))
  })
  items.push(rail(x, 340, TOP), ...leg(series[series.length - 1], 340))
  return { w: W, h: H, items }
}

/**
 * The op-amp frame: the triangle at (x, y), inputs at y ∓ 12, output run to a
 * node 70 to the right. `invertTop` false puts the + input on top, for the
 * non-inverting shapes whose feedback then loops under.
 */
const AMP = { x: 230, y: 90 }
const amp = ({ x = AMP.x, y = AMP.y, invertTop = true, side = 'r', run = 70 } = {}) => [
  { el: 'U1', x, y, invertTop },
  { wire: [x + 38, y, x + run, y] },
  node('out', x + run, y, side),
]
// ------------------------------------------------------------ group I shapes
/**
 * The bridge, drawn square rather than as the usual diamond: the two AC
 * terminals face each other across the source, two diodes climb to the + rail
 * and two climb from the − rail, and the load hangs between the rails on the
 * right. `flip` turns a vertical diode over so its anode is the lower end,
 * which is what makes all four point the way the current is allowed to go.
 */
function bridgeLayout() {
  // Two diodes climb from each AC terminal to the + rail and two climb from
  // the − rail to each; the load hangs on the left between the rails. `flip`
  // turns a vertical diode over so its anode is the lower end, which is what
  // makes all four point the way current is allowed to go.
  //
  // This is the one drawing wider than the usual 420: a bridge is four columns
  // of text — two diode labels each side of a source whose own label carries an
  // amplitude AND a frequency — and at 420 they cannot all stand clear of each
  // other. The frame is sized from the drawing, so a wider one simply renders
  // shorter.
  const [xa, xb] = [130, 380]
  const [top, bot] = [36, 150]
  const [hi, lo] = [62, 124]
  const arm = (id, x, y) => [
    { el: id, x, y, dir: 'v', flip: true },
    { wire: [x, y - 20, x, y - 26] },
    { wire: [x, y + 20, x, y + 26] },
  ]
  return {
    w: 500,
    h: H,
    items: [
      ...arm('D1', xa, hi),
      ...arm('D3', xa, lo),
      ...arm('D2', xb, hi),
      ...arm('D4', xb, lo),
      { el: 'V1', x: 275, y: MID, dir: 'h' },
      { wire: [xa, MID, 255, MID] },
      { wire: [295, MID, xb, MID] },
      rail(xa, xb, top),
      rail(xa, xb, bot),
      { wire: [xa, top, 40, top] },
      { el: 'RL', x: 40, y: MID, dir: 'v' },
      { wire: [40, top, 40, MID - 20] },
      { wire: [40, MID + 20, 40, bot] },
      { wire: [40, bot, xa, bot] },
      gnd(200, bot),
      node('a', 180, MID, 't'),
      node('b', xb, MID, 'r'),
      node('p', 250, top, 't'),
    ],
  }
}

/** Source with its own resistance, a diode, then whatever hangs on the output. */
function smoothingLayout(legs) {
  // Source, its own resistance, the diode, then the load and the reservoir
  // side by side. The two node dots sit on the rail between the elements
  // rather than at the corners, where a diode's own label already is.
  // Wide apart: a reading can be as long as "0.0000151 fA" when the capacitor
  // has run right down, and it hangs to the right of the load.
  const xs = [290, 390]
  const items = [
    ...src('V1'),
    rail(50, 100, TOP),
    ...top('RS', 120),
    rail(140, 210, TOP),
    ...top('D1', 230),
    rail(250, xs[0], TOP),
    node('src', 50, TOP, 't'),
    node('in', 175, TOP, 't'),
    node('out', 285, TOP, 't'),
  ]
  legs.forEach((id, k) => {
    if (k) items.push(rail(xs[k - 1], xs[k], TOP))
    items.push(...leg(id, xs[k]))
  })
  items.push(rail(50, xs[legs.length - 1], BOT), gnd(115))
  return { w: 480, h: H, items }
}

/**
 * The clipper: the signal arrives through a resistance and two diodes stand
 * between the node and their own reference rails, one each way up.
 */
function clipperLayout() {
  // The signal arrives through a resistance and two diodes stand between the
  // node and their own reference rails, one each way up. The branches are set
  // well apart — every label on them hangs to the right — and the drawing is
  // wider than the usual 420 to hold them.
  const [xh, xl] = [280, 400]
  // The diode high on the branch and its reference low on it, so the node
  // between them has room for its own label.
  const branch = (d, v, x, flip) => [
    { el: d, x, y: 62, dir: 'v', flip },
    { wire: [x, TOP, x, 42] },
    { wire: [x, 82, x, 100] },
    { el: v, x, y: 120, dir: 'v' },
    { wire: [x, 140, x, BOT] },
  ]
  return {
    w: 500,
    h: H,
    items: [
      ...src('V1'),
      rail(50, 100, TOP),
      ...top('R1', 120),
      rail(140, xl, TOP),
      node('in', 50, TOP, 't'),
      node('out', 180, TOP, 't'),
      ...branch('D1', 'V2', xh, false),
      ...branch('D2', 'V3', xl, true),
      node('hi', xh, 91, 'l'),
      node('lo', xl, 91, 'l'),
      rail(50, xl, BOT),
      gnd(115),
    ],
  }
}

/**
 * The Schmitt trigger: the signal at the − input, the output looping back to
 * the + one. The feedback goes under the op-amp rather than over it, so it
 * never has to cross the input wire — the one thing this shape must not do,
 * since a crossing on a schematic reads as a connection.
 */
function schmittLayout() {
  // The triangle sits right of centre so its own reading, which hangs below
  // it, clears the feedback's climb back up to the + input.
  const a = { x: 250, y: 60, invertTop: true }
  const [minus, plus] = [a.y - 12, a.y + 12]
  const back = 150
  // The source's label is the widest text on this drawing (an amplitude and a
  // frequency), and it hangs to the right of the source across the middle of
  // the picture. Everything else is placed to leave that band alone: the input
  // runs above it, the feedback below and then up the far right of it.
  return {
    w: W,
    h: H,
    items: [
      { el: 'V1', x: 40, y: 95, dir: 'v' },
      { wire: [40, 75, 40, minus] },
      { wire: [40, minus, a.x, minus] },
      { wire: [40, 115, 40, 130] },
      gnd(40, 130),
      node('in', 150, minus, 't'),
      ...amp(a),
      { wire: [a.x + 70, a.y, a.x + 70, back] },
      { el: 'R2', x: 270, y: back, dir: 'h' },
      { wire: [290, back, a.x + 70, back] },
      { wire: [250, back, 214, back] },
      node('p', 214, back, 'b'),
      { wire: [214, back, 214, plus] },
      { wire: [214, plus, a.x, plus] },
      { wire: [214, back, 180, back] },
      { el: 'R1', x: 150, y: back, dir: 'h' },
      { wire: [130, back, 110, back] },
      gnd(110, back),
    ],
  }
}


/** Source, a series resistance, then two legs across the output. */
function regulatorLayout() {
  const xs = [260, 350]
  return {
    w: 440,
    h: H,
    items: [
      ...src('V1'),
      rail(50, 100, TOP),
      ...top('RS', 120),
      rail(140, xs[0], TOP),
      node('in', 50, TOP, 't'),
      node('out', 195, TOP, 't'),
      ...leg('D1', xs[0], true),
      rail(xs[0], xs[1], TOP),
      ...leg('RL', xs[1]),
      rail(50, xs[1], BOT),
      gnd(115),
    ],
  }
}

/** A load hung from the output node: straight down to a ground of its own. */
const outLoad = (id, x = AMP.x + 70, y = AMP.y) => [
  { wire: [x, y, x, y + 20] },
  { el: id, x, y: y + 40, dir: 'v' },
  gnd(x, y + 60),
]

// ------------------------------------------------------------ experiments
export const EXPERIMENTS = [
  // ============================================================== A
  {
    id: 'a1',
    group: GROUPS[0],
    name: 'A voltage source holds its voltage',
    terms: ['charge', 'voltage', 'current', 'vsource', 'resistor', 'node', 'kcl', 'kvl'],
    params: [Vs('E', 'Source V₁', 12), R('R1', 'R', 1000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'gnd'], value: p.R1 },
      ],
    }),
    layout: {
      w: W,
      h: H,
      items: [...src('V1'), rail(50, LEGS[0], TOP), ...leg('R1', LEGS[0]), rail(50, LEGS[0], BOT), gnd(115), node('in', 50, TOP, 't')],
    },
    show: 'i',
    view: 'reading',
    views: ['reading', 'equations', 'power'],
    claim: { ohm: true },
  },
  {
    id: 'a2',
    group: GROUPS[0],
    name: 'A current source holds its current',
    terms: ['isource', 'resistor', 'current', 'kcl'],
    params: [
      Is('I', 'Source I₁', 0.005),
      R('R1', 'R', 1000),
      Toggle('open', 'Switch', false, 'open', 'closed', 'open it and the current has no path'),
    ],
    net: (p) => ({
      elements: [
        { type: 'I', id: 'I1', nodes: ['gnd', 'in'], value: p.I },
        { type: 'SW', id: 'S1', nodes: ['in', 'n1'], closed: !p.open },
        { type: 'R', id: 'R1', nodes: ['n1', 'gnd'], value: p.R1 },
      ],
    }),
    layout: {
      w: W,
      h: H,
      items: [
        // Drawn + end down: the source pushes current up into the top rail.
        { el: 'I1', x: 50, y: MID, dir: 'v', flip: true },
        { wire: [50, TOP, 50, MID - 20] },
        { wire: [50, MID + 20, 50, BOT] },
        rail(50, 100, TOP),
        ...top('S1', 120),
        rail(140, LEGS[0], TOP),
        ...leg('R1', LEGS[0]),
        rail(50, LEGS[0], BOT),
        gnd(115),
        node('in', 50, TOP, 't'),
        node('n1', LEGS[0], TOP, 't'),
      ],
    },
    show: 'v',
    view: 'reading',
    views: ['reading', 'equations', 'power'],
    claim: { ohmOtherWay: true },
  },
  {
    id: 'a3',
    group: GROUPS[0],
    name: 'Voltage is a difference, ground a choice',
    terms: ['voltage', 'ground', 'node', 'kcl'],
    params: [Vs('E', 'Source V₁', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), Vs('Vref', 'Lift V₀', 5)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'ref'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'A'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['A', 'ref'], value: p.R2 },
        { type: 'V', id: 'V0', nodes: ['ref', 'gnd'], value: p.Vref },
      ],
    }),
    layout: {
      w: W,
      h: H,
      items: [
        ...src('V1'),
        rail(50, 100, TOP),
        ...top('R1', 120),
        rail(140, LEGS[0], TOP),
        ...leg('R2', LEGS[0]),
        // The bottom rail is node "ref", lifted above ground by V0 on the right.
        rail(50, 290, BOT),
        node('ref', 115, BOT, 'b'),
        { el: 'V0', x: 310, y: BOT, dir: 'h' },
        { wire: [330, BOT, 350, BOT] },
        gnd(350, BOT),
        node('in', 50, TOP, 't'),
        node('A', LEGS[0], TOP, 't'),
      ],
    },
    show: 'v',
    view: 'reading',
    views: ['reading', 'equations', 'power'],
    claim: { reference: true },
  },
  {
    id: 'a4',
    group: GROUPS[0],
    name: 'The passive sign convention',
    terms: ['passive', 'voltage', 'current', 'power', 'kcl', 'kvl'],
    params: [Vs('E1', 'V₁', 12), Vs('E2', 'V₂', 5), R('R1', 'R', 1000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E1 },
        { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
        { type: 'V', id: 'V2', nodes: ['n1', 'gnd'], value: p.E2 },
      ],
    }),
    layout: loop(['R1', 'V2']),
    show: 'v',
    view: 'power',
    views: ['reading', 'equations', 'power'],
    claim: { signs: true },
  },

  // ============================================================== B
  {
    id: 'b1',
    group: GROUPS[1],
    name: 'Current in equals current out',
    terms: ['kcl', 'node', 'passive'],
    params: [Vs('E', 'Source V₁', 12), R('R1', 'R₁ (series)', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 3000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'A'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['A', 'gnd'], value: p.R2 },
        { type: 'R', id: 'R3', nodes: ['A', 'gnd'], value: p.R3 },
      ],
    }),
    layout: ladder(['R2', 'R3']),
    show: 'i',
    view: 'reading',
    views: ['reading', 'equations', 'power'],
    claim: { kclAt: 'A' },
  },
  {
    id: 'b2',
    group: GROUPS[1],
    name: 'Voltages around a loop add to zero',
    terms: ['kvl', 'passive'],
    params: [Vs('E', 'Source V₁', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['n1', 'gnd'], value: p.R2 },
      ],
    }),
    layout: loop(['R1', 'R2']),
    show: 'v',
    view: 'reading',
    views: ['reading', 'equations', 'power'],
    claim: { kvl: ['V1', 'R1', 'R2'] },
  },
  {
    id: 'b3',
    group: GROUPS[1],
    name: 'Power, and the sign of it',
    terms: ['passive', 'power'],
    // Three resistors, not B2's two: a loop of its own to look at, and four
    // powers to add to zero instead of three.
    params: [Vs('E', 'Source V₁', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 3000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['n1', 'n2'], value: p.R2 },
        { type: 'R', id: 'R3', nodes: ['n2', 'gnd'], value: p.R3 },
      ],
    }),
    layout: loop(['R1', 'R2', 'R3']),
    show: 'p',
    view: 'power',
    views: ['reading', 'equations', 'power'],
    claim: { tellegen: true, sourceNegative: 'V1' },
  },
  {
    id: 'b4',
    group: GROUPS[1],
    name: 'Two sources, one loop',
    terms: ['passive', 'power'],
    // A 12 V and a 9 V battery through 100 Ω — not A4's 12 V, 5 V and 1 kΩ,
    // so the two loops are not the same picture twice.
    params: [Vs('E1', 'V₁', 12), Vs('E2', 'V₂', 9), R('R1', 'R', 100)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E1 },
        { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
        { type: 'V', id: 'V2', nodes: ['n1', 'gnd'], value: p.E2 },
      ],
    }),
    layout: loop(['R1', 'V2']),
    show: 'p',
    view: 'power',
    views: ['reading', 'equations', 'power'],
    claim: { twoSources: true },
  },

  // ============================================================== C
  {
    id: 'c1',
    group: GROUPS[2],
    name: 'Series: one current, shared voltage',
    terms: ['series', 'kvl'],
    params: [Vs('E', 'Source V₁', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 3000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['n1', 'n2'], value: p.R2 },
        { type: 'R', id: 'R3', nodes: ['n2', 'gnd'], value: p.R3 },
      ],
    }),
    layout: loop(['R1', 'R2', 'R3']),
    show: 'v',
    view: 'reading',
    views: ['reading', 'equations', 'power'],
    claim: { series: true },
  },
  {
    id: 'c2',
    group: GROUPS[2],
    name: 'Parallel: one voltage, shared current',
    terms: ['parallel', 'kcl'],
    params: [Vs('E', 'Source V₁', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 3000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'gnd'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['in', 'gnd'], value: p.R2 },
        { type: 'R', id: 'R3', nodes: ['in', 'gnd'], value: p.R3 },
      ],
    }),
    layout: {
      w: W,
      h: H,
      items: [
        // Three legs pulled in 10 from the grid so the rightmost label
        // ("R3 1.19 kΩ") stays on the canvas.
        ...src('V1'),
        rail(50, 350, TOP),
        ...leg('R1', 150),
        ...leg('R2', 250),
        ...leg('R3', 350),
        rail(50, 350, BOT),
        gnd(115),
        node('in', 50, TOP, 't'),
      ],
    },
    show: 'i',
    view: 'reading',
    views: ['reading', 'equations', 'power'],
    claim: { parallel: true },
  },
  {
    id: 'c3',
    group: GROUPS[2],
    name: 'The loaded divider',
    terms: ['series', 'parallel'],
    params: [Vs('E', 'Source V₁', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 1000), R('RL', 'Load R_L', 10000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'A'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['A', 'gnd'], value: p.R2 },
        { type: 'R', id: 'RL', nodes: ['A', 'gnd'], value: p.RL },
      ],
    }),
    layout: ladder(['R2', 'RL']),
    show: 'v',
    view: 'sweep',
    views: ['reading', 'equations', 'thevenin', 'sweep'],
    port: ['A', 'gnd'],
    sweepId: 'RL',
    sweepY: 'v',
    claim: { loadedDivider: true },
  },
  {
    id: 'c4',
    group: GROUPS[2],
    name: 'The Wheatstone bridge',
    terms: ['series', 'kvl'],
    params: [Vs('E', 'Source V₁', 10), R('R1', 'R₁', 1000), R('R2', 'R₂', 1000), R('R3', 'R₃', 1000), R('R4', 'R₄', 1010)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'L'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['L', 'gnd'], value: p.R2 },
        { type: 'R', id: 'R3', nodes: ['in', 'R'], value: p.R3 },
        { type: 'R', id: 'R4', nodes: ['R', 'gnd'], value: p.R4 },
      ],
    }),
    layout: {
      w: W,
      h: H,
      items: [
        ...src('V1'),
        rail(50, 300, TOP),
        { el: 'R1', x: 150, y: 62, dir: 'v' },
        { wire: [150, TOP, 150, 42] },
        { el: 'R2', x: 150, y: 118, dir: 'v' },
        { wire: [150, 138, 150, BOT] },
        { el: 'R3', x: 300, y: 62, dir: 'v' },
        { wire: [300, TOP, 300, 42] },
        { el: 'R4', x: 300, y: 118, dir: 'v' },
        { wire: [300, 138, 300, BOT] },
        rail(50, 300, BOT),
        gnd(100),
        node('in', 50, TOP, 't'),
        node('L', 150, MID, 'r'),
        node('R', 300, MID, 'r'),
        { text: 'output = v_R − v_L', x: 225, y: 172 },
      ],
    },
    show: 'v',
    view: 'reading',
    views: ['reading', 'equations', 'power'],
    claim: { bridge: true },
  },

  // ============================================================== D
  {
    id: 'd1',
    group: GROUPS[3],
    name: 'Nodal analysis: one equation per node',
    terms: ['kcl', 'node', 'nodal'],
    params: [Vs('E', 'Source V₁', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 3000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'A'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['A', 'gnd'], value: p.R2 },
        { type: 'R', id: 'R3', nodes: ['A', 'gnd'], value: p.R3 },
      ],
    }),
    layout: ladder(['R2', 'R3']),
    show: 'i',
    view: 'reading',
    views: ['reading', 'equations', 'power'],
    claim: { nodalClosedForm: true },
  },
  {
    id: 'd2',
    group: GROUPS[3],
    name: 'A source between two nodes: the supernode',
    terms: ['nodal', 'supernode', 'mna'],
    params: [Vs('E1', 'V₁', 12), Vs('E2', 'V₂ (floating)', 4), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 3000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E1 },
        { type: 'R', id: 'R1', nodes: ['in', 'A'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['A', 'gnd'], value: p.R2 },
        { type: 'V', id: 'V2', nodes: ['A', 'B'], value: p.E2 },
        { type: 'R', id: 'R3', nodes: ['B', 'gnd'], value: p.R3 },
      ],
    }),
    layout: {
      w: W,
      h: H,
      items: [
        ...src('V1'),
        rail(50, 100, TOP),
        ...top('R1', 120),
        rail(140, 220, TOP),
        ...leg('R2', 180),
        ...top('V2', 240),
        rail(260, 340, TOP),
        ...leg('R3', 340),
        rail(50, 340, BOT),
        gnd(115),
        node('in', 50, TOP, 't'),
        node('A', 180, TOP, 't'),
        node('B', 300, TOP, 't'),
      ],
    },
    show: 'i',
    view: 'reading',
    views: ['reading', 'equations', 'power'],
    claim: { supernode: true },
  },
  {
    id: 'd3',
    group: GROUPS[3],
    name: 'Mesh analysis: one equation per loop',
    terms: ['kvl', 'mesh'],
    params: [Vs('E1', 'V₁', 12), Vs('E2', 'V₂', 3), R('R1', 'R₁', 1000), R('R2', 'R₂ (shared)', 2000), R('R3', 'R₃', 1000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E1 },
        { type: 'R', id: 'R1', nodes: ['in', 'A'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['A', 'gnd'], value: p.R2 },
        { type: 'R', id: 'R3', nodes: ['A', 'n2'], value: p.R3 },
        { type: 'V', id: 'V2', nodes: ['n2', 'gnd'], value: p.E2 },
      ],
    }),
    layout: {
      w: W,
      h: H,
      items: [
        ...src('V1'),
        rail(50, 100, TOP),
        ...top('R1', 120),
        rail(140, 220, TOP),
        ...leg('R2', 180),
        ...top('R3', 240),
        rail(260, 340, TOP),
        ...leg('V2', 340),
        rail(50, 340, BOT),
        gnd(115),
        node('in', 50, TOP, 't'),
        node('A', 180, TOP, 't'),
        node('n2', 300, TOP, 't'),
        // The mesh currents, read live off R₁ and R₃ (the stand-in text sizes the frame).
        { text: 'i₁ ↻ −1.23 mV', x: 125, y: 112, live: { prefix: 'i₁ ↻ ', q: 'i', key: 'R1', unit: 'A' } },
        { text: 'i₂ ↻ −1.23 mV', x: 260, y: 112, live: { prefix: 'i₂ ↻ ', q: 'i', key: 'R3', unit: 'A' } },
      ],
    },
    show: 'i',
    view: 'reading',
    views: ['reading', 'equations', 'power', 'superposition'],
    claim: { mesh: true },
  },
  {
    id: 'd4',
    group: GROUPS[3],
    name: 'Superposition: one source at a time',
    terms: ['superposition', 'linear'],
    params: [Vs('E1', 'V₁', 12), Is('I1', 'I₁', 0.005), R('R1', 'R₁', 1000), R('R2', 'R₂', 1000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E1 },
        { type: 'R', id: 'R1', nodes: ['in', 'A'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['A', 'gnd'], value: p.R2 },
        { type: 'I', id: 'I1', nodes: ['gnd', 'A'], value: p.I1 },
      ],
    }),
    layout: {
      w: W,
      h: H,
      items: [
        ...src('V1'),
        rail(50, 100, TOP),
        ...top('R1', 120),
        rail(140, LEGS[1], TOP),
        ...leg('R2', 180),
        // Drawn + end down: the source pushes current up into A.
        { el: 'I1', x: LEGS[1], y: MID, dir: 'v', flip: true },
        { wire: [LEGS[1], TOP, LEGS[1], MID - 20] },
        { wire: [LEGS[1], MID + 20, LEGS[1], BOT] },
        rail(50, LEGS[1], BOT),
        gnd(115),
        node('in', 50, TOP, 't'),
        node('A', 180, TOP, 't'),
      ],
    },
    show: 'i',
    view: 'superposition',
    views: ['reading', 'equations', 'power', 'superposition'],
    claim: { superposition: true },
  },
  {
    id: 'd5',
    group: GROUPS[3],
    name: 'Thévenin, three ways',
    terms: ['thevenin', 'linear', 'loadline'],
    params: [Vs('E', 'Source V₁', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 3000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'A'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['A', 'gnd'], value: p.R2 },
        { type: 'R', id: 'R3', nodes: ['A', 'gnd'], value: p.R3 },
      ],
    }),
    layout: ladder(['R2', 'R3']),
    show: 'v',
    view: 'equivalent',
    views: ['reading', 'equations', 'thevenin', 'equivalent'],
    port: ['A', 'gnd'],
    claim: { theveninAgree: true },
  },
  {
    id: 'd6',
    group: GROUPS[3],
    name: 'Maximum power transfer',
    terms: ['thevenin', 'power'],
    params: [Vs('E', 'Source V₁', 12), R('Rs', 'Source R_s', 500), R('RL', 'Load R_L', 500)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'Rs', nodes: ['in', 'A'], value: p.Rs },
        { type: 'R', id: 'RL', nodes: ['A', 'gnd'], value: p.RL },
      ],
    }),
    layout: {
      ...ladder(['RL'], 'Rs'),
    },
    show: 'p',
    view: 'sweep',
    views: ['reading', 'power', 'thevenin', 'sweep'],
    port: ['A', 'gnd'],
    sweepId: 'RL',
    sweepY: 'p',
    sweepEfficiency: true,
    claim: { maxPower: true },
  },

  // ============================================================== E
  {
    id: 'e1',
    group: GROUPS[4],
    name: 'A dependent source',
    terms: ['dependent', 'gain', 'power'],
    params: [Vs('E', 'Input V₁', 0.5), Gain('A', 'Gain A', 10), R('Rin', 'R_in', 10000), R('RL', 'Load R_L', 1000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'Rin', nodes: ['in', 'gnd'], value: p.Rin },
        { type: 'VCVS', id: 'E1', nodes: ['out', 'gnd'], ctrl: ['in', 'gnd'], gain: p.A },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
      ],
    }),
    layout: {
      w: W,
      h: H,
      items: [
        ...src('V1'),
        rail(50, 140, TOP),
        ...leg('Rin', 140),
        rail(50, 140, BOT),
        gnd(95),
        node('in', 50, TOP, 't'),
        ...leg('E1', 240),
        ...leg('RL', 340),
        rail(240, 340, TOP),
        rail(240, 340, BOT),
        gnd(290),
        node('out', 340, TOP, 't'),
        { text: 'A · v_in', x: 240, y: 172 },
      ],
    },
    show: 'p',
    view: 'power',
    views: ['reading', 'equations', 'power'],
    claim: { dependent: true },
  },
  {
    id: 'e2',
    group: GROUPS[4],
    name: 'The op-amp as a black box',
    terms: ['opamp', 'gain', 'ideal', 'impedance', 'active'],
    params: [
      Vs('E', 'Input V₁', 0.01),
      R('Rs', 'Source R_s', 10000),
      Gain('A', 'Open-loop gain A', 1000),
      R('Rin', 'Input R_in', 1e6),
      R('Rout', 'Output R_out', 50),
      R('RL', 'Load R_L', 1000),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'Rs', nodes: ['in', 'p'], value: p.Rs },
        { type: 'R', id: 'Rin', nodes: ['p', 'gnd'], value: p.Rin },
        { type: 'VCVS', id: 'E1', nodes: ['o', 'gnd'], ctrl: ['p', 'gnd'], gain: p.A },
        { type: 'R', id: 'Rout', nodes: ['o', 'out'], value: p.Rout },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
      ],
    }),
    layout: {
      w: W,
      h: H,
      items: [
        // The dashed frame is the package: everything inside is "the op-amp".
        // Six elements across a canvas built for four: the source steps left
        // to 40, and the two legs inside the frame sit 94 apart, the least
        // that keeps Rin's label off E1's arrow.
        { box: [119, 4, 315, 162] },
        { text: 'op-amp, modelled', x: 170, y: 14 },
        ...src('V1', 40),
        rail(40, 70, TOP),
        ...top('Rs', 90),
        rail(110, 140, TOP),
        ...leg('Rin', 140),
        node('in', 40, TOP, 't'),
        node('p', 140, TOP, 'r'),
        ...leg('E1', 234),
        rail(234, 262, TOP),
        ...top('Rout', 282),
        rail(302, 350, TOP),
        ...leg('RL', 350),
        node('o', 234, TOP, 't'),
        node('out', 350, TOP, 't'),
        rail(40, 350, BOT),
        gnd(100),
      ],
    },
    show: 'v',
    view: 'power',
    views: ['reading', 'equations', 'power'],
    claim: { blackBox: true },
  },
  {
    id: 'e3',
    group: GROUPS[4],
    name: 'Comparator: an op-amp with no feedback',
    terms: ['opamp', 'gain', 'feedback', 'saturation'],
    params: [
      Vs('E', 'Input V₁', 0.001),
      Toggle('ideal', 'Op-amp', true, 'ideal', 'finite gain', 'ideal: infinite gain, so any input difference saturates the output. Finite: the gain knob below applies.'),
      Gain('A', 'Gain A', 1e5),
      R('RL', 'Load R_L', 1000),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['in', 'gnd'], gain: p.ideal ? Infinity : p.A },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
      ],
    }),
    layout: {
      w: W,
      h: H,
      items: [
        // Source into the + input (top); − input grounded.
        { el: 'V1', x: 50, y: 100, dir: 'v' },
        { wire: [50, 80, 50, 78] },
        { wire: [50, 78, AMP.x, 78] },
        { wire: [50, 120, 50, 150] },
        { wire: [AMP.x, 102, 150, 102] },
        { wire: [150, 102, 150, 150] },
        rail(50, 150, 150),
        gnd(100, 150),
        node('in', 110, 78, 't'),
        ...amp({ invertTop: false }),
        ...outLoad('RL'),
      ],
    },
    show: 'v',
    view: 'reading',
    views: ['reading', 'equations', 'power'],
    claim: { comparator: true },
  },
  {
    id: 'e4',
    group: GROUPS[4],
    name: 'The golden rules, derived',
    terms: ['opamp', 'feedback', 'gain'],
    params: [Vs('E', 'Input V₁', 1), Gain('A', 'Op-amp gain A', 1000), R('Rf', 'R_f', 9000), R('Rg', 'R_g', 1000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['in', 'n'], gain: p.A },
        { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: p.Rf },
        { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: p.Rg },
      ],
    }),
    layout: nonInvertingLayout(),
    show: 'v',
    view: 'reading',
    views: ['reading', 'equations', 'power'],
    claim: { goldenRules: true },
  },
  {
    id: 'e5',
    group: GROUPS[4],
    name: 'Inverting amplifier and the virtual ground',
    terms: ['opamp', 'feedback', 'virtual'],
    params: [Vs('E', 'Input V₁', 0.5), R('Rf', 'R_f', 10000), R('Rg', 'R_g', 1000), R('RL', 'Load R_L', 10000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'Rg', nodes: ['in', 'n'], value: p.Rg },
        { type: 'R', id: 'Rf', nodes: ['n', 'out'], value: p.Rf },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['gnd', 'n'] },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
      ],
    }),
    layout: invertingLayout(),
    show: 'i',
    view: 'reading',
    views: ['reading', 'equations', 'power'],
    claim: { inverting: true },
  },
  {
    id: 'e6',
    group: GROUPS[4],
    name: 'The summing amplifier',
    terms: ['opamp', 'virtual', 'kcl'],
    params: [Vs('E1', 'V₁', 1), Vs('E2', 'V₂', 2), R('R1', 'R₁', 10000), R('R2', 'R₂', 20000), R('Rf', 'R_f', 10000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in1', 'gnd'], value: p.E1 },
        { type: 'V', id: 'V2', nodes: ['in2', 'gnd'], value: p.E2 },
        { type: 'R', id: 'R1', nodes: ['in1', 'n'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['in2', 'n'], value: p.R2 },
        { type: 'R', id: 'Rf', nodes: ['n', 'out'], value: p.Rf },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['gnd', 'n'] },
      ],
    }),
    layout: summerLayout(),
    show: 'i',
    view: 'reading',
    views: ['reading', 'equations', 'power', 'superposition'],
    claim: { summer: true },
  },
  {
    id: 'e7',
    group: GROUPS[4],
    name: 'The difference amplifier',
    terms: ['opamp', 'feedback', 'cmrr', 'dB'],
    params: [
      Vs('E1', 'V₁ (to −)', 1),
      // 1.2 V, not 1.1: with the gain of 10 that puts 2 V out and a current in
      // every element. At 1.1 V the − input sat at exactly E₁ and R₁, R₂ read 0.
      Vs('E2', 'V₂ (to +)', 1.2),
      R('R1', 'R₁', 1000),
      R('R2', 'R₂', 10000),
      R('R3', 'R₃', 1000),
      R('R4', 'R₄', 10000),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in1', 'gnd'], value: p.E1 },
        { type: 'V', id: 'V2', nodes: ['in2', 'gnd'], value: p.E2 },
        { type: 'R', id: 'R1', nodes: ['in1', 'n'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['n', 'out'], value: p.R2 },
        { type: 'R', id: 'R3', nodes: ['in2', 'p'], value: p.R3 },
        { type: 'R', id: 'R4', nodes: ['p', 'gnd'], value: p.R4 },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['p', 'n'] },
      ],
    }),
    layout: differenceLayout(),
    show: 'v',
    view: 'reading',
    views: ['reading', 'equations', 'power', 'superposition'],
    claim: { difference: true },
  },
  {
    id: 'e8',
    group: GROUPS[4],
    name: 'The buffer fixes the loaded divider',
    terms: ['opamp', 'feedback', 'thevenin'],
    params: [Vs('E', 'Source V₁', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 1000), R('RL', 'Load R_L', 100)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'A'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['A', 'gnd'], value: p.R2 },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['A', 'out'] },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
      ],
    }),
    layout: bufferLayout(),
    show: 'i',
    view: 'sweep',
    views: ['reading', 'equations', 'power', 'sweep'],
    port: ['out', 'gnd'],
    sweepId: 'RL',
    sweepY: 'v',
    claim: { buffer: true },
  },
  {
    id: 'e9',
    group: GROUPS[4],
    name: 'Positive feedback: the Schmitt trigger',
    terms: ['hysteresis', 'saturation', 'feedback'],
    params: [
      Vs('A', 'Input amplitude', 5),
      Freq('f', 'Frequency', 50),
      chips({ key: 'Vsat', label: 'Supply rails ±', unit: 'V', min: 1, max: 24, scale: 'linear', default: 12 }, [5, 12, 15]),
      R('R1', 'R₁', 10000),
      R('R2', 'R₂', 90000),
      Win('N', 'Window', 'cycles', 2),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'sine', amp: p.A, freq: p.f } },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['p', 'in'], vsat: p.Vsat },
        { type: 'R', id: 'R1', nodes: ['p', 'gnd'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['out', 'p'], value: p.R2 },
      ],
    }),
    layout: schmittLayout(),
    window: cyclesWindow,
    // Both rails are consistent at t = 0 and only history decides: this one
    // starts high, and says so rather than letting the search pick.
    start: { U1: 'high' },
    cursor: 0.1,
    scope: {
      left: {
        unit: 'V',
        traces: [
          { q: 'v', key: 'in', label: 'v_in' },
          { q: 'v', key: 'p', label: 'threshold', dim: true },
          { q: 'v', key: 'out', label: 'v_out' },
        ],
      },
    },
    out: { q: 'v', key: 'out', label: 'v_out' },
    show: 'v',
    view: 'scope',
    views: ['reading', 'equations', 'scope'],
    claim: { schmitt: true },
  },

  // ============================================================== F
  {
    id: 'f1',
    group: GROUPS[5],
    name: 'A capacitor’s current is the slope of its voltage',
    terms: ['capacitor', 'state', 'current', 'timeconstant'],
    params: [
      { key: 'A', label: 'Triangle amplitude', unit: 'V', min: 0.1, max: 24, scale: 'linear', default: 5 },
      Per('T', 'Period', 1e-3),
      Cap('C1', 'C', 1e-6),
      R('Rs', 'Series R_s', 10, 'small: the source’s own resistance'),
      Win('N', 'Window', 'cycles', 2, 0.5, 10),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'triangle', amp: p.A, period: p.T } },
        { type: 'R', id: 'Rs', nodes: ['in', 'n1'], value: p.Rs },
        { type: 'C', id: 'C1', nodes: ['n1', 'gnd'], value: p.C1 },
      ],
    }),
    layout: loop(['Rs', 'C1']),
    window: (p) => p.N * p.T,
    cursor: 0.0625,
    scope: {
      left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_in', dim: true }, { q: 'volt', key: 'C1', label: 'v_C' }] },
      right: { unit: 'A', traces: [{ q: 'i', key: 'C1', label: 'i_C' }] },
    },
    show: 'i',
    view: 'scope',
    views: ['equations', 'power', 'scope', 'state'],
    claim: { slope: true },
  },
  {
    id: 'f2',
    group: GROUPS[5],
    name: 'An inductor’s voltage is the slope of its current',
    terms: ['inductor', 'state', 'duality', 'timeconstant'],
    params: [
      { key: 'A', label: 'Triangle amplitude', unit: 'A', min: 1e-3, max: 0.1, scale: 'linear', default: 0.01 },
      Per('T', 'Period', 1e-3),
      Ind('L1', 'L', 10e-3),
      R('Rp', 'Parallel R_p', 1e4, 'large: the source’s own resistance'),
      Win('N', 'Window', 'cycles', 2, 0.5, 10),
    ],
    net: (p) => ({
      elements: [
        { type: 'I', id: 'I1', nodes: ['gnd', 'in'], value: 0, wave: { kind: 'triangle', amp: p.A, period: p.T } },
        { type: 'L', id: 'L1', nodes: ['in', 'gnd'], value: p.L1 },
        { type: 'R', id: 'Rp', nodes: ['in', 'gnd'], value: p.Rp },
      ],
    }),
    layout: tankLayout(['L1', 'Rp']),
    window: (p) => p.N * p.T,
    cursor: 0.0625,
    scope: {
      left: { unit: 'A', traces: [{ q: 'i', key: 'I1', label: 'I_in', dim: true }, { q: 'i', key: 'L1', label: 'i_L' }] },
      right: { unit: 'V', traces: [{ q: 'volt', key: 'L1', label: 'v_L' }] },
    },
    show: 'v',
    view: 'scope',
    views: ['equations', 'power', 'scope', 'state'],
    claim: { slopeDual: true },
  },
  {
    id: 'f3',
    group: GROUPS[5],
    name: 'Charging a capacitor: the time constant',
    terms: ['capacitor', 'state', 'timeconstant', 'initial'],
    params: [Vs('E', 'Source V₁', 12), R('R1', 'R', 1000), Cap('C1', 'C', 1e-6), Vs('v0', 'v_C(0)', 0, 'the capacitor’s charge before the switch closes'), Win('N', 'Window', 'τ', 5)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'SW', id: 'S1', nodes: ['in', 'n1'], closed: true, before: false },
        { type: 'R', id: 'R1', nodes: ['n1', 'n2'], value: p.R1 },
        { type: 'C', id: 'C1', nodes: ['n2', 'gnd'], value: p.C1, x0: p.v0 },
      ],
    }),
    layout: loop(['S1', 'R1', 'C1']),
    window: (p) => p.N * p.R1 * p.C1,
    cursor: 0.2,
    scope: {
      left: { unit: 'V', traces: [{ q: 'volt', key: 'C1', label: 'v_C' }] },
      right: { unit: 'A', traces: [{ q: 'i', key: 'C1', label: 'i_C' }] },
    },
    show: 'i',
    view: 'scope',
    views: ['equations', 'power', 'scope', 'state', 'energy'],
    circuitLab: rcToCircuitLab,
    claim: { tau: true },
  },
  {
    id: 'f4',
    group: GROUPS[5],
    name: 'Every RC circuit is one RC circuit: Thévenin sets τ',
    terms: ['thevenin', 'timeconstant', 'capacitor'],
    params: [Vs('E', 'Step V₁', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 500), Cap('C1', 'C', 1e-6), Win('N', 'Window', 'τ', 5)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'step', from: 0, to: p.E } },
        { type: 'R', id: 'R1', nodes: ['in', 'A'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['A', 'gnd'], value: p.R2 },
        { type: 'R', id: 'R3', nodes: ['A', 'B'], value: p.R3 },
        { type: 'C', id: 'C1', nodes: ['B', 'gnd'], value: p.C1 },
      ],
    }),
    layout: dividerRCLayout(),
    window: (p) => p.N * (p.R3 + (p.R1 * p.R2) / (p.R1 + p.R2)) * p.C1,
    cursor: 0.2,
    scope: {
      left: { unit: 'V', traces: [{ q: 'v', key: 'A', label: 'v_A', dim: true }, { q: 'v', key: 'B', label: 'v_B' }] },
      right: { unit: 'A', traces: [{ q: 'i', key: 'C1', label: 'i_C' }] },
    },
    show: 'v',
    view: 'scope',
    views: ['equations', 'power', 'thevenin', 'scope', 'state'],
    port: ['B', 'gnd'],
    claim: { theveninTau: true },
  },
  {
    id: 'f5',
    group: GROUPS[5],
    name: 'Half the energy is lost, whatever R',
    terms: ['energy', 'capacitor', 'power'],
    params: [Vs('E', 'Source V₁', 12), chips(R('R1', 'R', 1000), [100, 1000, 10000]), Cap('C1', 'C', 1e-6), Win('N', 'Window', 'τ', 10)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'SW', id: 'S1', nodes: ['in', 'n1'], closed: true, before: false },
        { type: 'R', id: 'R1', nodes: ['n1', 'n2'], value: p.R1 },
        { type: 'C', id: 'C1', nodes: ['n2', 'gnd'], value: p.C1, x0: 0 },
      ],
    }),
    layout: loop(['S1', 'R1', 'C1']),
    window: (p) => p.N * p.R1 * p.C1,
    cursor: 0.1,
    scope: {
      left: { unit: 'V', traces: [{ q: 'volt', key: 'C1', label: 'v_C' }] },
      right: { unit: 'W', traces: [{ q: 'p', key: 'R1', label: 'p_R' }] },
    },
    show: 'p',
    view: 'energy',
    views: ['power', 'scope', 'state', 'energy'],
    circuitLab: rcToCircuitLab,
    claim: { half: true },
  },
  {
    id: 'f6',
    group: GROUPS[5],
    name: 'Opening a switch on an inductor: the spark',
    terms: ['inductor', 'state', 'timeconstant', 'diode'],
    params: [
      Vs('E', 'Source V₁', 12),
      R('R1', 'R', 1000),
      Ind('L1', 'L', 1),
      Toggle('ideal', 'Switch', false, 'ideal', 'finite R_off', 'an ideal open switch is infinite ohms'),
      { ...R('Roff', 'R_off of S₁', 1e5, 'the resistance the open switch still has'), of: 'S1' },
      Win('N', 'Window', 'τ', 5),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
        { type: 'SW', id: 'S1', nodes: ['n1', 'n2'], closed: false, before: true, roff: p.ideal ? undefined : p.Roff },
        { type: 'L', id: 'L1', nodes: ['n2', 'gnd'], value: p.L1 },
      ],
    }),
    layout: loop(['R1', 'S1', 'L1']),
    window: (p) => (p.N * p.L1) / (p.R1 + (p.ideal ? 0 : p.Roff)),
    cursor: 0.2,
    scope: {
      left: { unit: 'A', traces: [{ q: 'i', key: 'L1', label: 'i_L' }] },
      // i_L times R_off: the same shape as the left trace, so it is dashed to stay tellable apart.
      right: { unit: 'V', traces: [{ q: 'volt', key: 'S1', label: 'v_switch', dash: true }] },
    },
    show: 'v',
    view: 'scope',
    views: ['equations', 'power', 'scope', 'state', 'energy'],
    claim: { spark: true },
  },
  {
    id: 'f7',
    group: GROUPS[5],
    name: 'The op-amp integrator',
    terms: ['opamp', 'virtual', 'capacitor', 'ideal'],
    params: [
      { key: 'A', label: 'Square amplitude', unit: 'V', min: 0.1, max: 10, scale: 'linear', default: 1 },
      Per('T', 'Period', 1e-3),
      R('R1', 'R', 1e4),
      Cap('C1', 'C', 100e-9),
      Toggle('ideal', 'Op-amp', true, 'ideal', 'finite gain'),
      Gain('G', 'Gain A', 1e5),
      Win('N', 'Window', 'cycles', 3, 0.5, 10),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'square', amp: p.A, period: p.T } },
        { type: 'R', id: 'R1', nodes: ['in', 'n'], value: p.R1 },
        { type: 'C', id: 'C1', nodes: ['n', 'out'], value: p.C1, x0: 0 },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['gnd', 'n'], gain: p.ideal ? Infinity : p.G },
      ],
    }),
    layout: integratorLayout(),
    window: (p) => p.N * p.T,
    cursor: 0.25,
    scope: {
      // No current trace: with a virtual ground i_in is v_in/R, the dashed trace over again.
      left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_in', dim: true }, { q: 'v', key: 'out', label: 'v_out' }] },
    },
    show: 'i',
    view: 'scope',
    views: ['equations', 'power', 'scope', 'state'],
    claim: { integrator: true },
  },

  // ============================================================== G
  // Series RLC throughout, L = 10 mH and C = 1 µF: ω₀ = 10⁴ rad/s and the
  // critical resistance 2√(L/C) = 200 Ω. The capacitor is listed before the
  // inductor so the state vector reads x = [v_C, i_L], as the notes write it.
  ...[
    {
      id: 'g1',
      name: 'Series RLC: the differential equation',
      R: 800,
      view: 'scope',
      terms: ['state', 'characteristic', 'damping', 'natural'],
      claim: { overdamped: true },
    },
    {
      id: 'g2',
      name: 'Critical damping',
      R: 200,
      view: 'scope',
      terms: ['damping', 'characteristic', 'natural'],
      claim: { critical: true },
    },
    {
      id: 'g3',
      name: 'Damping versus speed: the R sweep',
      // Starts on the overdamped side, so the marker is not G2's point again
      // and the first move toward critical shows the settling time falling.
      R: 400,
      view: 'damping',
      terms: ['damping', 'natural', 'timeconstant'],
      claim: { sweep: true },
    },
    {
      id: 'g4',
      name: 'Underdamped: ringing',
      R: 50,
      view: 'scope',
      terms: ['damping', 'natural', 'characteristic', 'j'],
      claim: { underdamped: true },
    },
  ].map((g) => ({
    id: g.id,
    group: GROUPS[6],
    name: g.name,
    terms: g.terms,
    params: [Vs('E', 'Step V₁', 1), chips(R('R1', 'R', g.R), g.id === 'g3' ? [800, 400, 160, 50] : [800, 200, 50]), Ind('L1', 'L', 10e-3), Cap('C1', 'C', 1e-6), Win('N', 'Window', 'cycles', 5)],
    net: seriesRLC,
    layout: loop(['R1', 'L1', 'C1']),
    window: rlcWindow,
    cursor: 0.2,
    scope: rlcScope(),
    show: 'v',
    view: g.view,
    views: g.id === 'g3' ? ['equations', 'scope', 'state', 'energy', 'damping'] : ['equations', 'power', 'scope', 'state', 'energy'],
    sweepId: g.id === 'g3' ? 'R1' : undefined,
    // The same series RLC Circuit Lab draws, so its Bode and pole-zero views
    // are this circuit's, whatever step response is on screen here.
    circuitLab: rlcToCircuitLab,
    claim: g.claim,
  })),
  {
    id: 'g5',
    group: GROUPS[6],
    name: 'Undamped: energy sloshes between L and C',
    terms: ['energy', 'natural', 'inductor', 'capacitor'],
    params: [Vs('E', 'Step V₁', 1), Ind('L1', 'L', 10e-3), Cap('C1', 'C', 1e-6), Win('N', 'Window', 'cycles', 3)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'step', from: 0, to: p.E } },
        { type: 'C', id: 'C1', nodes: ['n1', 'gnd'], value: p.C1 },
        { type: 'L', id: 'L1', nodes: ['in', 'n1'], value: p.L1 },
      ],
    }),
    layout: loop(['L1', 'C1']),
    window: rlcWindow,
    cursor: 0.125,
    scope: rlcScope(),
    show: 'i',
    view: 'energy',
    views: ['equations', 'power', 'scope', 'state', 'energy'],
    claim: { undamped: true },
  },
  {
    id: 'g6',
    group: GROUPS[6],
    name: 'Initial conditions: where the circuit starts from',
    terms: ['initial', 'natural', 'state'],
    params: [
      Vs('E', 'Step V₁', 1),
      R('R1', 'R', 50),
      Ind('L1', 'L', 10e-3),
      Cap('C1', 'C', 1e-6),
      { key: 'v0', label: 'v_C(0)', unit: 'V', min: -5, max: 5, scale: 'linear', default: 2 },
      { key: 'i0', label: 'i_L(0)', unit: 'A', min: -0.02, max: 0.02, scale: 'linear', default: 0.005 },
      Win('N', 'Window', 'cycles', 5),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'step', from: 0, to: p.E } },
        { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
        { type: 'C', id: 'C1', nodes: ['n2', 'gnd'], value: p.C1, x0: p.v0 },
        { type: 'L', id: 'L1', nodes: ['n1', 'n2'], value: p.L1, x0: p.i0 },
      ],
    }),
    layout: loop(['R1', 'L1', 'C1']),
    window: rlcWindow,
    cursor: 0.2,
    scope: rlcScope(),
    ghost: (p) => ({ ...p, v0: 0, i0: 0 }),
    show: 'v',
    view: 'scope',
    views: ['equations', 'power', 'scope', 'state', 'energy'],
    claim: { initial: true },
  },
  {
    id: 'g7',
    group: GROUPS[6],
    name: 'Parallel RLC: the dual',
    terms: ['duality', 'damping', 'natural'],
    params: [
      { key: 'I', label: 'Step I₁', unit: 'A', min: 1e-3, max: 0.1, scale: 'linear', default: 0.01 },
      chips(R('R1', 'R', 200), [12.5, 50, 200]),
      Ind('L1', 'L', 10e-3),
      Cap('C1', 'C', 1e-6),
      Win('N', 'Window', 'cycles', 5),
    ],
    net: (p) => ({
      elements: [
        { type: 'I', id: 'I1', nodes: ['gnd', 'in'], value: 0, wave: { kind: 'step', from: 0, to: p.I } },
        { type: 'R', id: 'R1', nodes: ['in', 'gnd'], value: p.R1 },
        { type: 'C', id: 'C1', nodes: ['in', 'gnd'], value: p.C1 },
        { type: 'L', id: 'L1', nodes: ['in', 'gnd'], value: p.L1 },
      ],
    }),
    layout: tankLayout(['R1', 'L1', 'C1']),
    window: rlcWindow,
    cursor: 0.2,
    scope: {
      left: { unit: 'A', traces: [{ q: 'i', key: 'I1', label: 'I', dim: true }, { q: 'i', key: 'L1', label: 'i_L' }] },
      right: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v' }] },
    },
    show: 'i',
    view: 'scope',
    views: ['equations', 'power', 'scope', 'state', 'energy'],
    claim: { dual: true },
  },

  // ---------------------------------------------------------------- H · phasors
  //
  // Every source here is a sine switched on at t = 0, so the scope still shows
  // the whole story — natural response and all — while the phasor, impedance
  // and power views describe only the steady state the circuit settles into.
  // `ghost: 'forced'` draws that steady state dashed under the real trace; the
  // two must agree once the natural response has died, and math.js measures
  // that they do. Steady-state quantities come from the complex solve
  // (solveAC), never from reading the time trace.
  {
    id: 'h1',
    group: GROUPS[7],
    name: 'Switching on a sine: natural dies, forced stays',
    terms: ['steadystate', 'phasor', 'timeconstant'],
    params: sineRCParams({ f: 159.2 }),
    net: sineRC,
    layout: loop(['R1', 'C1']),
    window: cyclesWindow,
    ghost: 'forced',
    ghostLabel: 'steady state (dashed)',
    // About 2τ in at the defaults (τ = 1 ms, window 25 ms): the natural part is still visible and already fading.
    cursor: 0.08,
    scope: {
      left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_s', dim: true }, { q: 'volt', key: 'C1', label: 'v_C' }] },
      right: { unit: 'A', traces: [{ q: 'i', key: 'R1', label: 'i' }] },
    },
    out: { q: 'volt', key: 'C1', label: 'v_C' },
    show: 'v',
    view: 'scope',
    views: ['equations', 'power', 'scope', 'state', 'phasor'],
    phasor: { volts: ['R1', 'C1'], total: 'V1', current: 'R1' },
    circuitLab: rcToCircuitLab,
    claim: { switchOn: true },
  },
  {
    id: 'h2',
    group: GROUPS[7],
    name: 'Phasors: the arrow that draws the wave',
    terms: ['phasor', 'reactance', 'steadystate'],
    params: sineRCParams({ f: 159.2 }),
    net: sineRC,
    layout: loop(['R1', 'C1']),
    window: cyclesWindow,
    ghost: 'forced',
    ghostLabel: 'steady state (dashed)',
    // 3¼ cycles in: the source at its peak, so at the corner v_R and v_C each read exactly half of it — KVL in the meters.
    cursor: 3.25 / 4,
    scope: {
      left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_s', dim: true }, { q: 'volt', key: 'R1', label: 'v_R' }, { q: 'volt', key: 'C1', label: 'v_C' }] },
      right: { unit: 'A', traces: [{ q: 'i', key: 'R1', label: 'i' }] },
    },
    out: { q: 'volt', key: 'C1', label: 'v_C' },
    show: 'v',
    view: 'phasor',
    views: ['equations', 'power', 'scope', 'state', 'phasor'],
    phasor: { volts: ['R1', 'C1'], total: 'V1', current: 'R1' },
    circuitLab: rcToCircuitLab,
    claim: { phasor: true },
  },
  {
    id: 'h3',
    group: GROUPS[7],
    name: 'Impedance: series RLC',
    terms: ['impedanceac', 'reactance', 'phasor'],
    params: [
      Vs('A', 'Amplitude', 1),
      chips(Freq('f', 'Frequency', 1000), [1000, 1591.5, 2500]),
      R('R1', 'R', 100),
      Ind('L1', 'L', 10e-3),
      Cap('C1', 'C', 1e-6),
      Win('N', 'Window', 'cycles', 6),
    ],
    net: sineRLC,
    layout: loop(['R1', 'L1', 'C1']),
    window: cyclesWindow,
    ghost: 'forced',
    ghostLabel: 'steady state (dashed)',
    cursor: 0.85,
    scope: rlcSineScope(),
    out: { q: 'volt', key: 'C1', label: 'v_C' },
    show: 'v',
    view: 'phasor',
    views: ['equations', 'power', 'scope', 'state', 'phasor', 'impedance'],
    phasor: { volts: ['R1', 'L1', 'C1'], total: 'V1', current: 'R1' },
    circuitLab: rlcToCircuitLab,
    claim: { impedance: true },
  },
  {
    id: 'h4',
    group: GROUPS[7],
    name: 'Resonance',
    terms: ['resonance', 'reactance', 'impedanceac', 'qualityfactor'],
    params: [
      Vs('A', 'Amplitude', 1),
      chips(Freq('f', 'Frequency', 1591.5), [1400, 1591.5, 1800]),
      chips(R('R1', 'R', 5), [5, 20, 100]),
      Ind('L1', 'L', 10e-3),
      Cap('C1', 'C', 1e-6),
      Win('N', 'Window', 'cycles', 40, 1, 80),
    ],
    net: sineRLC,
    layout: loop(['R1', 'L1', 'C1']),
    window: cyclesWindow,
    points: 1601,
    ghost: 'forced',
    ghostLabel: 'steady state (dashed)',
    // 38¼ cycles in: the source at its peak, deep in the steady state, not on a zero crossing.
    cursor: 38.25 / 40,
    scope: rlcSineScope(),
    out: { q: 'volt', key: 'C1', label: 'v_C' },
    show: 'v',
    view: 'impedance',
    views: ['equations', 'power', 'scope', 'state', 'phasor', 'impedance'],
    phasor: { volts: ['R1', 'L1', 'C1'], total: 'V1', current: 'R1' },
    circuitLab: rlcToCircuitLab,
    claim: { resonance: true },
  },
  {
    id: 'h5',
    group: GROUPS[7],
    name: 'AC power: real, reactive, apparent',
    terms: ['rms', 'powerfactor', 'steadystate'],
    params: [
      Vs('A', 'Amplitude', 10),
      chips(Freq('f', 'Frequency', 50), [50, 60, 400]),
      R('R1', 'R', 100),
      Ind('L1', 'L', 0.3),
      Win('N', 'Window', 'cycles', 2),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'sine', amp: p.A, freq: p.f } },
        { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
        { type: 'L', id: 'L1', nodes: ['n1', 'gnd'], value: p.L1 },
      ],
    }),
    layout: loop(['R1', 'L1']),
    window: cyclesWindow,
    ghost: 'forced',
    ghostLabel: 'steady state (dashed)',
    cursor: 0.8,
    scope: {
      left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_s', dim: true }] },
      right: { unit: 'W', traces: [{ q: 'p', key: 'R1', label: 'p_R' }, { q: 'p', key: 'L1', label: 'p_L' }] },
    },
    out: { q: 'i', key: 'R1', label: 'i' },
    show: 'p',
    view: 'acpower',
    views: ['equations', 'power', 'scope', 'state', 'phasor', 'acpower'],
    phasor: { volts: ['R1', 'L1'], total: 'V1', current: 'R1' },
    circuitLab: (p) => (p.L1 <= 1 ? { id: 'rlLow', values: [p.R1, p.L1], output: 'r' } : { decline: `Circuit Lab’s inductor knob stops at 1 H; L = ${fmt(p.L1, 'H', 3)} does not fit.` }),
    claim: { acpower: true },
  },
  {
    id: 'h6',
    group: GROUPS[7],
    name: 'Frequency response: one sine at a time',
    terms: ['bode', 'steadystate', 'phasor', 'dB'],
    params: sineRCParams({ f: 1000 }),
    net: sineRC,
    layout: loop(['R1', 'C1']),
    window: cyclesWindow,
    ghost: 'forced',
    ghostLabel: 'steady state (dashed)',
    // 3¼ cycles in: the source is at its peak, not a zero crossing.
    cursor: 3.25 / 4,
    scope: {
      left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_s', dim: true }, { q: 'volt', key: 'C1', label: 'v_C' }] },
      right: { unit: 'A', traces: [{ q: 'i', key: 'R1', label: 'i' }] },
    },
    out: { q: 'volt', key: 'C1', label: 'v_C' },
    show: 'v',
    view: 'bode',
    views: ['equations', 'power', 'scope', 'state', 'phasor', 'bode'],
    phasor: { volts: ['R1', 'C1'], total: 'V1', current: 'R1' },
    circuitLab: rcToCircuitLab,
    claim: { bode: true },
  },
  // ============================================================== I
  {
    id: 'i1',
    group: GROUPS[8],
    name: 'The diode’s curve, and four ways to approximate it',
    terms: ['diode', 'thermalvoltage'],
    params: [Vs('E', 'Source V₁', 5), chips(R('R1', 'R', 1000), [100, 1000, 10000]), DIODE_MODEL('drop', 'which description of the diode the meters use')],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
        { type: 'D', id: 'D1', nodes: ['n1', 'gnd'], model: p.model },
      ],
    }),
    layout: loop(['R1', 'D1']),
    iv: { element: 'D1', source: 'E', series: 'R1' },
    show: 'v',
    view: 'iv',
    views: ['reading', 'iv', 'equations', 'power'],
    claim: { models: true },
  },
  {
    id: 'i2',
    group: GROUPS[8],
    name: 'The load line, and how a simulator finds the point',
    terms: ['loadline', 'operatingpoint', 'newton'],
    params: [Vs('E', 'Source V₁', 5), chips(R('R1', 'R', 150), [47, 150, 470]), DIODE_MODEL('exp', 'the curve is what Newton’s method is for')],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
        { type: 'D', id: 'D1', nodes: ['n1', 'gnd'], model: p.model },
      ],
    }),
    layout: loop(['R1', 'D1']),
    iv: { element: 'D1', source: 'E', series: 'R1', iterations: true },
    show: 'i',
    view: 'iv',
    views: ['reading', 'iv', 'equations', 'power'],
    claim: { loadline: true },
  },
  {
    id: 'i3',
    group: GROUPS[8],
    name: 'Assume, solve, check',
    terms: ['assumedstate', 'clamp'],
    params: [chips(Vs('E', 'Source V₁', 5), [-5, 0.5, 5]), R('R1', 'R', 1000), DIODE_MODEL('drop')],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'A'], value: p.R1 },
        { type: 'D', id: 'D1', nodes: ['A', 'gnd'], model: p.model },
        { type: 'D', id: 'D2', nodes: ['gnd', 'A'], model: p.model },
      ],
    }),
    layout: ladder(['D1', 'D2'], 'R1', ['D2']),
    show: 'v',
    view: 'assumed',
    views: ['reading', 'assumed', 'equations', 'power'],
    claim: { assumed: true },
  },
  {
    id: 'i4',
    group: GROUPS[8],
    name: 'The half-wave rectifier',
    terms: ['rectifier', 'conduction', 'bisection'],
    params: [Vs('A', 'Amplitude', 10), chips(Freq('f', 'Frequency', 50), [50, 60, 1000]), R('RL', 'R_L', 1000), DIODE_MODEL('drop'), Win('N', 'Window', 'cycles', 2)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'sine', amp: p.A, freq: p.f } },
        { type: 'D', id: 'D1', nodes: ['in', 'out'], model: p.model },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
      ],
    }),
    layout: loop(['D1', 'RL'], ['out']),
    window: cyclesWindow,
    // A quarter cycle in: the source at its peak, the diode conducting.
    cursor: 0.25 / 2,
    scope: {
      left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_s', dim: true }, { q: 'v', key: 'out', label: 'v_out' }] },
      right: { unit: 'A', traces: [{ q: 'i', key: 'D1', label: 'i' }] },
    },
    out: { q: 'v', key: 'out', label: 'v_out' },
    show: 'v',
    view: 'scope',
    views: ['reading', 'equations', 'power', 'scope'],
    claim: { halfwave: true },
  },
  {
    id: 'i5',
    group: GROUPS[8],
    name: 'The full-wave bridge doubles the ripple',
    terms: ['rectifier', 'rms', 'ripple'],
    params: [Vs('A', 'Amplitude', 10), chips(Freq('f', 'Frequency', 50), [50, 60, 1000]), R('RL', 'R_L', 1000), DIODE_MODEL('drop'), Win('N', 'Window', 'cycles', 2)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['a', 'b'], value: 0, wave: { kind: 'sine', amp: p.A, freq: p.f } },
        // Every blocking diode leaks a little, and here that is not a detail:
        // with four perfect open circuits the source's own two terminals touch
        // nothing at all and have no voltage — the solver says so. Ten
        // megohms is a real part's reverse resistance and 0.006 % of the load.
        { type: 'D', id: 'D1', nodes: ['a', 'p'], model: p.model, roff: 1e7 },
        { type: 'D', id: 'D2', nodes: ['b', 'p'], model: p.model, roff: 1e7 },
        { type: 'D', id: 'D3', nodes: ['gnd', 'a'], model: p.model, roff: 1e7 },
        { type: 'D', id: 'D4', nodes: ['gnd', 'b'], model: p.model, roff: 1e7 },
        { type: 'R', id: 'RL', nodes: ['p', 'gnd'], value: p.RL },
      ],
    }),
    layout: bridgeLayout(),
    window: cyclesWindow,
    cursor: 0.25 / 2,
    scope: {
      left: { unit: 'V', traces: [{ q: 'volt', key: 'V1', label: 'v_s', dim: true }, { q: 'v', key: 'p', label: 'v_out' }] },
      right: { unit: 'A', traces: [{ q: 'i', key: 'RL', label: 'i_L' }] },
    },
    out: { q: 'v', key: 'p', label: 'v_out' },
    show: 'v',
    view: 'scope',
    views: ['reading', 'equations', 'power', 'scope'],
    claim: { bridge: true },
  },
  {
    id: 'i6',
    group: GROUPS[8],
    name: 'Smoothing: the peak rectifier, exactly and approximately',
    terms: ['ripple', 'conduction'],
    params: [
      Vs('A', 'Amplitude', 10),
      Freq('f', 'Frequency', 50),
      { key: 'RS', label: 'Source R_S', unit: 'Ω', min: 1, max: 100, scale: 'log', default: 5 },
      R('RL', 'R_L', 1000),
      chips(Cap('C1', 'C', 100e-6), [22e-6, 100e-6, 470e-6]),
      DIODE_MODEL('drop'),
      Win('N', 'Window', 'cycles', 12),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['src', 'gnd'], value: 0, wave: { kind: 'sine', amp: p.A, freq: p.f } },
        { type: 'R', id: 'RS', nodes: ['src', 'in'], value: p.RS },
        { type: 'D', id: 'D1', nodes: ['in', 'out'], model: p.model },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
        { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: p.C1 },
      ],
    }),
    layout: smoothingLayout(['RL', 'C1']),
    window: cyclesWindow,
    points: 1201,
    cursor: 0.9,
    scope: {
      left: { unit: 'V', traces: [{ q: 'v', key: 'src', label: 'v_s', dim: true }, { q: 'v', key: 'out', label: 'v_out' }] },
      right: { unit: 'A', traces: [{ q: 'i', key: 'D1', label: 'i_D' }] },
    },
    out: { q: 'v', key: 'out', label: 'v_out' },
    show: 'v',
    view: 'scope',
    views: ['reading', 'equations', 'power', 'scope', 'energy'],
    claim: { ripple: true },
  },
  {
    id: 'i7',
    group: GROUPS[8],
    name: 'The clipper: a rail the signal cannot pass',
    terms: ['clipper', 'clamp'],
    params: [Vs('A', 'Amplitude', 10), Freq('f', 'Frequency', 50), R('R1', 'R', 1000), chips({ key: 'Vref', label: 'Reference ±', unit: 'V', min: 0.5, max: 20, scale: 'linear', default: 3 }, [1, 3, 6]), DIODE_MODEL('drop'), Win('N', 'Window', 'cycles', 2)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'sine', amp: p.A, freq: p.f } },
        { type: 'R', id: 'R1', nodes: ['in', 'out'], value: p.R1 },
        { type: 'D', id: 'D1', nodes: ['out', 'hi'], model: p.model },
        { type: 'V', id: 'V2', nodes: ['hi', 'gnd'], value: p.Vref },
        { type: 'D', id: 'D2', nodes: ['lo', 'out'], model: p.model },
        { type: 'V', id: 'V3', nodes: ['lo', 'gnd'], value: -p.Vref },
      ],
    }),
    layout: clipperLayout(),
    window: cyclesWindow,
    cursor: 0.25 / 2,
    scope: {
      left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_in', dim: true }, { q: 'v', key: 'out', label: 'v_out' }] },
    },
    out: { q: 'v', key: 'out', label: 'v_out' },
    show: 'v',
    view: 'scope',
    views: ['reading', 'equations', 'power', 'scope'],
    claim: { clipper: true },
  },
  {
    id: 'i8',
    group: GROUPS[8],
    name: 'The Zener regulator, and where it gives up',
    terms: ['zener', 'regulation'],
    params: [
      Vs('E', 'Supply V₁', 12),
      R('RS', 'Series R_S', 470),
      { key: 'Vz', label: 'Breakdown voltage', unit: 'V', min: 1, max: 20, scale: 'linear', default: 5.1 },
      chips(R('RL', 'Load R_L', 1000), [220, 470, 1000]),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'RS', nodes: ['in', 'out'], value: p.RS },
        // Cathode at the output: it is meant to be run backwards, and holds
        // V_z once it is.
        { type: 'D', id: 'D1', nodes: ['gnd', 'out'], model: 'drop', vz: p.Vz },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
      ],
    }),
    layout: regulatorLayout(),
    show: 'i',
    view: 'sweep',
    views: ['reading', 'assumed', 'equations', 'power', 'sweep'],
    port: ['out', 'gnd'],
    sweepId: 'RL',
    sweepY: 'v',
    claim: { zener: true },
  },
]

// What the student reads lives in lessons.js: `see` (the picture at the
// defaults), `try` (knob moves with their readings) and `why` (the reasoning).
// `note` is the two prose registers run together, for the places that quote a
// single paragraph per experiment (the hand-over card, the tests' word counts).
for (const e of EXPERIMENTS) {
  const lesson = LESSONS[e.id]
  if (!lesson) throw new Error(`no lesson for ${e.id}`)
  Object.assign(e, lesson)
  e.note = `${lesson.see} ${lesson.why}`
}

// ------------------------------------------------------------ group H shared
function sineRCParams({ f }) {
  return [
    Vs('A', 'Amplitude', 5),
    chips(Freq('f', 'Frequency', f), [15.92, 159.2, 1592]),
    Deg('phi', 'Phase φ', 0),
    R('R1', 'R', 1000),
    Cap('C1', 'C', 1e-6),
    Win('N', 'Window', 'cycles', 4),
  ]
}
function sineRC(p) {
  return {
    elements: [
      { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'sine', amp: p.A, freq: p.f, phase: ((p.phi || 0) * Math.PI) / 180 } },
      { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
      { type: 'C', id: 'C1', nodes: ['n1', 'gnd'], value: p.C1 },
    ],
  }
}
function sineRLC(p) {
  return {
    elements: [
      { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'sine', amp: p.A, freq: p.f } },
      { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
      { type: 'C', id: 'C1', nodes: ['n2', 'gnd'], value: p.C1 },
      { type: 'L', id: 'L1', nodes: ['n1', 'n2'], value: p.L1 },
    ],
  }
}
/** N cycles of the drive. */
function cyclesWindow(p) {
  return p.N / p.f
}
function rlcSineScope() {
  return {
    left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_s', dim: true }, { q: 'volt', key: 'L1', label: 'v_L' }, { q: 'volt', key: 'C1', label: 'v_C' }] },
    right: { unit: 'A', traces: [{ q: 'i', key: 'R1', label: 'i' }] },
  }
}
// The hand-over to Circuit Lab (plan §5, H6): the catalog circuit whose transfer
// function is this experiment's, with the component values in the catalog's
// order. Circuit Lab's knobs stop where they stop (L ≤ 1 H); a value that does
// not fit is declined with a reason, never clamped into a different circuit.
function rcToCircuitLab(p) {
  return { id: 'rcLow', values: [p.R1, p.C1], output: 'c' }
}
function rlcToCircuitLab(p) {
  if (p.L1 > 1) return { decline: `Circuit Lab’s inductor knob stops at 1 H; L = ${fmt(p.L1, 'H', 3)} does not fit.` }
  return { id: 'rlcSeries', values: [p.R1, p.L1, p.C1], output: 'c' }
}
function rlToCircuitLab(p) {
  if (p.L1 > 1) return { decline: `Circuit Lab’s inductor knob stops at 1 H; L = ${fmt(p.L1, 'H', 3)} does not fit.` }
  return { id: 'rlLow', values: [p.R1, p.L1], output: 'r' }
}

// ------------------------------------------------------------ group G shared
function seriesRLC(p) {
  return {
    elements: [
      { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'step', from: 0, to: p.E } },
      { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
      { type: 'C', id: 'C1', nodes: ['n2', 'gnd'], value: p.C1 },
      { type: 'L', id: 'L1', nodes: ['n1', 'n2'], value: p.L1 },
    ],
  }
}
/** N cycles of the undamped period 2π√LC. */
function rlcWindow(p) {
  return p.N * 2 * Math.PI * Math.sqrt(p.L1 * p.C1)
}
function rlcScope() {
  return {
    left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_in', dim: true }, { q: 'volt', key: 'C1', label: 'v_C' }] },
    right: { unit: 'A', traces: [{ q: 'i', key: 'L1', label: 'i' }] },
  }
}

// ------------------------------------------------------------ op-amp layouts

function nonInvertingLayout() {
  // The textbook shape: + on top fed by the source, Rg from the − input down
  // to its own ground, Rf from the output looping under and back to n.
  const a = { x: AMP.x, y: 65, invertTop: false }
  const [plus, minus] = [a.y - 12, a.y + 12]
  return {
    w: W,
    h: H,
    items: [
      { el: 'V1', x: 50, y: 100, dir: 'v' },
      { wire: [50, 80, 50, plus] },
      { wire: [50, plus, a.x, plus] },
      { wire: [50, 120, 50, 130] },
      gnd(50, 130),
      node('in', 120, plus, 't'),
      { wire: [a.x, minus, 140, minus] },
      node('n', 140, minus, 't'),
      { wire: [140, minus, 140, 90] },
      { el: 'Rg', x: 140, y: 110, dir: 'v' },
      gnd(140, 130),
      ...amp(a),
      { wire: [215, minus, 215, 150] },
      { wire: [215, 150, 230, 150] },
      { el: 'Rf', x: 250, y: 150, dir: 'h' },
      { wire: [270, 150, 300, 150] },
      { wire: [300, 150, 300, a.y] },
    ],
  }
}

function invertingLayout() {
  // Source at left feeding Rg into n (the − input, top); + input to ground;
  // Rf across the top from n to out; RL hung from the output.
  return {
    w: W,
    h: H,
    items: [
      { el: 'V1', x: 50, y: 120, dir: 'v' },
      { wire: [50, 100, 50, 78] },
      { wire: [50, 78, 90, 78] },
      node('in', 50, 78, 't'),
      { el: 'Rg', x: 110, y: 78, dir: 'h' },
      { wire: [130, 78, AMP.x, 78] },
      node('n', 170, 78, 'b'),
      { wire: [50, 140, 50, 150] },
      rail(50, 190, 150),
      gnd(120, 150),
      { wire: [AMP.x, 102, 190, 102] },
      { wire: [190, 102, 190, 150] },
      { wire: [170, 78, 170, 34] },
      { wire: [170, 34, 195, 34] },
      { el: 'Rf', x: 215, y: 34, dir: 'h' },
      { wire: [235, 34, 300, 34] },
      { wire: [300, 34, 300, 90] },
      ...amp(),
      ...outLoad('RL'),
    ],
  }
}

function summerLayout() {
  // Two sources, two input resistors, one virtual ground. V2 runs along the
  // top-left with its − returning to ground down the far left. The amplifier
  // sits a row lower than usual so in1's label clears V2's.
  const a = { x: AMP.x, y: 100 }
  const [minus, plus, rail0] = [a.y - 12, a.y + 12, 160]
  return {
    w: W,
    h: H,
    items: [
      { el: 'V1', x: 50, y: 130, dir: 'v' },
      { wire: [50, 110, 50, minus] },
      { wire: [50, minus, 95, minus] },
      node('in1', 50, minus, 't'),
      { el: 'R1', x: 115, y: minus, dir: 'h' },
      { wire: [135, minus, a.x, minus] },
      node('n', 195, minus, 'b'),
      { el: 'V2', x: 50, y: 35, dir: 'h', flip: true },
      { wire: [30, 35, 20, 35] },
      { wire: [20, 35, 20, rail0] },
      { wire: [70, 35, 145, 35] },
      node('in2', 100, 35, 't'),
      { el: 'R2', x: 165, y: 35, dir: 'h' },
      { wire: [185, 35, 195, 35] },
      { wire: [195, 35, 195, minus] },
      { wire: [200, minus, 200, 34] },
      { wire: [200, 34, 230, 34] },
      { el: 'Rf', x: 250, y: 34, dir: 'h' },
      { wire: [270, 34, 300, 34] },
      { wire: [300, 34, 300, a.y] },
      { wire: [a.x, plus, 210, plus] },
      { wire: [210, plus, 210, rail0] },
      { wire: [50, 150, 50, rail0] },
      rail(20, 210, rail0),
      gnd(120, rail0),
      ...amp(a),
    ],
  }
}

function differenceLayout() {
  // E1 → R1 → n (−) with R2 feedback over the top; E2 → R3 → p (+) along a
  // lower row, R4 from p to ground beside the amplifier. A taller canvas.
  return {
    w: W,
    h: 190,
    items: [
      { el: 'V1', x: 50, y: 110, dir: 'v' },
      { wire: [50, 90, 50, 78] },
      { wire: [50, 78, 130, 78] },
      node('in1', 90, 78, 't'),
      { el: 'R1', x: 150, y: 78, dir: 'h' },
      { wire: [170, 78, AMP.x, 78] },
      node('n', 195, 78, 'b'),
      { wire: [210, 78, 210, 34] },
      { wire: [210, 34, 230, 34] },
      { el: 'R2', x: 250, y: 34, dir: 'h' },
      { wire: [270, 34, 300, 34] },
      { wire: [300, 34, 300, 90] },
      // Each source stands on its own ground: V1 straight down, V2 on a stub
      // of its own along the lower row, so neither looks wired to the other.
      { wire: [50, 130, 50, 140] },
      gnd(50, 140),
      gnd(67, 158),
      { wire: [67, 158, 77, 158] },
      { el: 'V2', x: 97, y: 158, dir: 'h', flip: true },
      { wire: [117, 158, 170, 158] },
      // in2 is named under its wire, which is long enough for the name and a
      // reading to clear both V2's circle and R3's body.
      node('in2', 140, 158, 'b'),
      { el: 'R3', x: 190, y: 158, dir: 'h' },
      { wire: [210, 158, 215, 158] },
      { wire: [215, 158, 215, 102] },
      { wire: [215, 102, AMP.x, 102] },
      // p is named on its riser: the corner is hemmed in by R3 and the amplifier's reading.
      node('p', 215, 118, 'l'),
      { wire: [215, 158, 270, 158] },
      { el: 'R4', x: 290, y: 158, dir: 'h' },
      { wire: [310, 158, 320, 158] },
      gnd(320, 158),
      ...amp(),
    ],
  }
}

function bufferLayout() {
  // The divider from C3 feeding a unity-gain buffer (+ on top), output wired
  // back to − under the amplifier, load hung from the output.
  const a = { x: AMP.x, y: 52, invertTop: false, run: 90 }
  const out = a.x + a.run
  return {
    w: W,
    h: H,
    items: [
      ...src('V1', 45),
      rail(45, 75, TOP),
      ...top('R1', 95),
      rail(115, a.x, TOP),
      ...leg('R2', 145),
      rail(45, 145, BOT),
      gnd(95),
      node('in', 45, TOP, 't'),
      node('A', 145, TOP, 't'),
      ...amp(a),
      { wire: [out - 30, 52, out - 30, 120] },
      { wire: [out - 30, 120, 215, 120] },
      { wire: [215, 120, 215, 64] },
      { wire: [215, 64, a.x, 64] },
      ...outLoad('RL', out, 52),
    ],
  }
}

/** A current source on the left pushing up into a rail, and legs hung from it. */
function tankLayout(legs) {
  // Three legs sit 88 apart (a ten-character label plus the next leg's current
  // arrow) and the last at 340 so "C1 365 µF" stays on the canvas.
  const xs = legs.length === 3 ? [164, 252, 340] : LEGS.slice(0, legs.length)
  const last = xs[xs.length - 1]
  return {
    w: W,
    h: H,
    // The source sits at 36, not 50: its label names the waveform ("I1 ±10.0 mA
    // triangle") and needs the extra room before the first leg.
    items: [
      { el: 'I1', x: 36, y: MID, dir: 'v', flip: true },
      { wire: [36, TOP, 36, MID - 20] },
      { wire: [36, MID + 20, 36, BOT] },
      rail(36, last, TOP),
      ...legs.flatMap((id, k) => leg(id, xs[k])),
      rail(36, last, BOT),
      gnd(100),
      node('in', 36, TOP, 't'),
    ],
  }
}

function dividerRCLayout() {
  // The C3 divider with R3 carrying on to a capacitor: A between R1 and R2, B
  // at the capacitor.
  return {
    w: W,
    h: H,
    items: [
      ...src('V1'),
      rail(50, 100, TOP),
      ...top('R1', 120),
      rail(140, 230, TOP),
      ...leg('R2', LEGS[0]),
      ...top('R3', 250),
      // The capacitor leg at 340, not 360: "C1 1.98 nF" needs the room.
      rail(270, 340, TOP),
      ...leg('C1', 340),
      rail(50, 340, BOT),
      gnd(115),
      node('in', 50, TOP, 't'),
      node('A', LEGS[0], TOP, 't'),
      node('B', 305, TOP, 't'),
    ],
  }
}

function integratorLayout() {
  // E5's inverting shape with the capacitor where R_f was and no load.
  return {
    w: W,
    h: H,
    items: [
      { el: 'V1', x: 50, y: 120, dir: 'v' },
      { wire: [50, 100, 50, 78] },
      { wire: [50, 78, 90, 78] },
      node('in', 50, 78, 't'),
      { el: 'R1', x: 110, y: 78, dir: 'h' },
      { wire: [130, 78, AMP.x, 78] },
      node('n', 170, 78, 'b'),
      { wire: [50, 140, 50, 150] },
      rail(50, 190, 150),
      gnd(120, 150),
      { wire: [AMP.x, 102, 190, 102] },
      { wire: [190, 102, 190, 150] },
      { wire: [170, 78, 170, 34] },
      { wire: [170, 34, 195, 34] },
      { el: 'C1', x: 215, y: 34, dir: 'h' },
      { wire: [235, 34, 300, 34] },
      { wire: [300, 34, 300, 90] },
      ...amp(),
    ],
  }
}

// ------------------------------------------------------------ lookups
export const byId = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]))

export function defaultsOf(id) {
  const out = {}
  for (const p of byId[id].params) out[p.key] = p.default
  return out
}

// Each layout gets the frame it needs — the box around everything it draws,
// so that a one-element circuit does not sit in a canvas sized for six. The
// frame is fixed per experiment (the extent takes readings at their widest),
// and the layout test checks at random settings that nothing leaves it. Layouts
// are copied here because two experiments may share one drawing with
// different parts in it.
//
// The headline (headlines.js) joins the drawing first: where it names an
// element or node, a callout with the number is placed beside it, at its
// widest text so the frame does not move when the number does, and the
// frame is taken around the drawing with the callout in it. App.jsx swaps
// the live number in. An experiment whose callout has no room fails here,
// at load, not in a screenshot. The experiments that are about a theorem
// carry its drawing instructions (theorems.js) as `theorem`.
for (const e of EXPERIMENTS) {
  const headline = HEADLINES[e.id]
  if (!headline) throw new Error(`no headline for ${e.id}`)
  e.headline = headline
  if (THEOREMS[e.id]) e.theorem = THEOREMS[e.id]
  const elements = drawables(e.net(defaultsOf(e.id)))
  if (headline.where) {
    const text = calloutStandIn(headline)
    const at = placeCallout(e.layout, elements, headline.where, text)
    if (!at) throw new Error(`${e.id}: no room for the callout beside ${headline.where}`)
    e.layout = { ...e.layout, items: [...e.layout.items, { callout: true, text, ...at, className: 'sch-callout' }] }
  }
  e.layout = { ...e.layout, crop: layoutExtent(e.layout, elements) }
}

/** The netlist for an experiment at these settings. */
export const netOf = (id, params) => byId[id].net(params)

/** Whether an experiment has a time axis: any capacitor or inductor makes it so. */
export const isDynamic = (exp) => typeof exp.window === 'function'

/**
 * The elements as the schematic wants them: id, type, value/gain, switch
 * state, and — for a source with a waveform or a switch that moves at t = 0 —
 * a label that says so, since the value alone would not.
 */
export function drawables(net) {
  return net.elements.map((e) => ({ id: e.id, type: e.type, value: e.value, gain: e.gain, closed: e.closed, label: labelOf(e) }))
}

function labelOf(e) {
  const w = e.wave
  if (w && w.kind !== 'dc') {
    const unit = e.type === 'V' ? 'V' : 'A'
    switch (w.kind) {
      case 'step':
        return `${e.id} step ${fmt(w.to, unit, 3)}`
      case 'ramp':
        return `${e.id} ramp`
      case 'square':
        return `${e.id} ±${fmt(w.amp, unit, 3)} square`
      case 'triangle':
        return `${e.id} ±${fmt(w.amp, unit, 3)} triangle`
      case 'sine':
        return `${e.id} ${fmt(w.amp, unit, 3)} sine · ${fmt(w.freq, 'Hz', 4)}`
      default:
        return undefined
    }
  }
  if (e.type === 'SW' && e.before !== undefined && !!e.before !== (e.closed !== false))
    return `${e.id} ${e.closed === false ? 'opens' : 'closes'} at 0`
  return undefined
}
