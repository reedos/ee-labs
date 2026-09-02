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

export const GROUPS = [
  'A · Elements and signs',
  'B · Two laws',
  'C · Series and parallel',
  'D · Analysis and theorems',
  'E · Op-amps',
  'F · Elements that remember',
  'G · Second order',
  'H · Sinusoids and phasors',
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
/** Resistances the note talks about, offered as chips under the knob. */
const chips = (knob, presets) => ({ ...knob, presets })

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
const leg = (id, x) => [{ el: id, x, y: MID, dir: 'v' }, { wire: [x, TOP, x, MID - 20] }, { wire: [x, MID + 20, x, BOT] }]
const src = (id, x = 50) => leg(id, x)
const top = (id, x) => [{ el: id, x, y: TOP, dir: 'h' }]
const rail = (x1, x2, y) => ({ wire: [x1, y, x2, y] })
const node = (name, x, y, side = 't') => ({ node: name, x, y, side })
const gnd = (x, y = BOT) => ({ gnd: [x, y] })

/** Source on the left, a series element on top, then N legs to ground. */
function ladder(legs, series = 'R1') {
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
      ...legs.flatMap((id, k) => leg(id, xs[k])),
      rail(50, last, BOT),
      gnd(115),
      node('in', 50, TOP, 't'),
      node('A', LEGS[0], TOP, 't'),
    ],
  }
}

/** Source on the left, elements around one loop. */
function loop(series) {
  // series: ids along the top and down the right side, in order.
  const items = [...src('V1'), rail(50, 340, BOT), gnd(115), node('in', 50, TOP, 't')]
  const xs = [120, 230]
  let x = 50
  series.slice(0, -1).forEach((id, k) => {
    items.push(rail(x, xs[k] - 20, TOP), ...top(id, xs[k]))
    x = xs[k] + 20
    items.push(node(`n${k + 1}`, x + 35, TOP, 't'))
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
    terms: ['voltage', 'vsource', 'resistor', 'current'],
    note:
      'Two elements and two wires, and already the whole idea. A voltage source is a device ' +
      'that holds a fixed voltage E between its two terminals and supplies whatever current ' +
      'that takes. A resistor is a device whose current is proportional to the voltage across ' +
      'it: i = v/R (Ohm’s law). Wire the two together and the source decides the voltage, the ' +
      'resistor decides the current: i = E/R. Turn R down and the current climbs while the ' +
      'source’s voltage does not move by a microvolt — that is what “source” means. The ' +
      'ideal wires between them have no voltage across them at all: the whole top rail is one ' +
      'node, and it reads E everywhere.',
    params: [Vs('E', 'Source E', 12), R('R1', 'R', 1000)],
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
    view: 'equations',
    views: ['equations', 'power'],
    claim: { ohm: true },
  },
  {
    id: 'a2',
    group: GROUPS[0],
    name: 'A current source holds its current',
    terms: ['isource', 'resistor', 'current'],
    note:
      'The other kind of source. A current source pushes a fixed current I through itself ' +
      'and lets the circuit decide what voltage that takes. Into a resistor, Ohm’s law read ' +
      'the other way gives v = I·R: turn R up and the voltage climbs, the current does not. ' +
      'Push R to a megohm and 5 mA needs 5 kV — an ideal current source into an open circuit ' +
      'would need an infinite voltage, which is why a current source is never left ' +
      'unconnected (the solver refuses such a circuit outright). Voltage sources are the ' +
      'familiar kind — batteries, supplies — but current sources are how transistors behave, ' +
      'and the op-amp group leans on them.',
    params: [Is('I', 'Source I', 0.005), R('R1', 'R', 1000)],
    net: (p) => ({
      elements: [
        { type: 'I', id: 'I1', nodes: ['gnd', 'in'], value: p.I },
        { type: 'R', id: 'R1', nodes: ['in', 'gnd'], value: p.R1 },
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
        rail(50, LEGS[0], TOP),
        ...leg('R1', LEGS[0]),
        rail(50, LEGS[0], BOT),
        gnd(115),
        node('in', 50, TOP, 't'),
      ],
    },
    show: 'v',
    view: 'equations',
    views: ['equations', 'power'],
    claim: { ohmOtherWay: true },
  },
  {
    id: 'a3',
    group: GROUPS[0],
    name: 'Voltage is a difference; ground is a choice',
    terms: ['voltage', 'ground', 'node'],
    note:
      'A voltage is never a property of one point. It is always the difference between two, ' +
      'and a meter has two probes for that reason. The numbers at the nodes here are ' +
      'measured against the node marked with the ground symbol, which the solver — like a ' +
      'meter’s black lead — takes as 0 V. That choice is free. The divider on the left is ' +
      'built on top of a source V_ref instead of directly on ground: slide V_ref and every ' +
      'node voltage moves by exactly that amount, while every element’s voltage, every ' +
      'current and every power stays put, because an element only ever sees the difference ' +
      'across its own two terminals. V_ref carries no current at all. It is not doing ' +
      'anything to the circuit; it is renaming zero.',
    params: [Vs('E', 'Source E', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), Vs('Vref', 'Lift V_ref', 5)],
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
    view: 'equations',
    views: ['equations', 'power'],
    claim: { reference: true },
  },
  {
    id: 'a4',
    group: GROUPS[0],
    name: 'Which way is +: the passive sign convention',
    terms: ['passive', 'voltage', 'current', 'power'],
    note:
      'Every element has two terminals, and before a single number can be written down one ' +
      'of them must be called +. That is a label you choose, not a fact about the element. ' +
      'Then two rules, always: the element’s voltage is v = (voltage at +) − (voltage at −), ' +
      'and its current i is measured flowing IN at the + terminal. Here the resistor’s + is ' +
      'its left end. With E₁ > E₂ its v and i are both positive; slide E₂ above E₁ and both ' +
      'turn negative together — switch the meters to i and watch the arrow reverse — while ' +
      'its power p = v·i stays positive, because a resistor only ever absorbs. The source ' +
      'that is pushing has current LEAVING its +, so its power comes out negative. A negative ' +
      'reading is not an error; it is the answer, with its direction attached.',
    params: [Vs('E1', 'E₁', 12), Vs('E2', 'E₂', 5), R('R1', 'R', 1000)],
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
    views: ['power', 'equations'],
    claim: { signs: true },
  },

  // ============================================================== B
  {
    id: 'b1',
    group: GROUPS[1],
    name: 'Current in equals current out',
    terms: ['kcl', 'node', 'passive'],
    note:
      'Kirchhoff’s current law: charge does not pile up at a junction, so whatever current ' +
      'arrives at node A leaves it. The arrows are the actual directions and the numbers are ' +
      'the actual amounts — R₁ carries exactly what R₂ and R₃ carry between them, however you ' +
      'set the three. Try making R₂ tiny: it takes almost everything, and R₃ almost nothing, ' +
      'but the sum never moves.',
    params: [Vs('E', 'Source E', 12), R('R1', 'R₁ (series)', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 3000)],
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
    view: 'equations',
    views: ['equations', 'power'],
    claim: { kclAt: 'A' },
  },
  {
    id: 'b2',
    group: GROUPS[1],
    name: 'Voltages around a loop add to zero',
    terms: ['kvl', 'passive'],
    note:
      'Kirchhoff’s voltage law: go once around any closed path adding the voltage rises and ' +
      'subtracting the drops and you are back where you started, so the total is zero. Here ' +
      'the source lifts by E and the two resistors drop it all again, in proportion to their ' +
      'resistance because the same current flows through both. The + marks show which end of ' +
      'each element is measured as positive.',
    params: [Vs('E', 'Source E', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['n1', 'gnd'], value: p.R2 },
      ],
    }),
    layout: loop(['R1', 'R2']),
    show: 'v',
    view: 'equations',
    views: ['equations', 'power'],
    claim: { kvl: ['V1', 'R1', 'R2'] },
  },
  {
    id: 'b3',
    group: GROUPS[1],
    name: 'Power, and the sign of it',
    terms: ['passive', 'power'],
    note:
      'Every element’s power is v × i with the current measured INTO its + terminal — the ' +
      'passive sign convention. A resistor’s current always enters at its higher-voltage end, ' +
      'so its power is positive: it absorbs. The source’s current leaves its + terminal, so its ' +
      'power comes out negative: it delivers. The negative sign is not a mistake to hide; it is ' +
      'the bookkeeping that makes every power in the circuit add to exactly zero.',
    params: [Vs('E', 'Source E', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['n1', 'gnd'], value: p.R2 },
      ],
    }),
    layout: loop(['R1', 'R2']),
    show: 'p',
    view: 'power',
    views: ['power', 'equations'],
    claim: { tellegen: true, sourceNegative: 'V1' },
  },
  {
    id: 'b4',
    group: GROUPS[1],
    name: 'Two sources, one loop',
    terms: ['passive', 'power'],
    note:
      'Two batteries facing the same way with a resistor between them. The current is set by ' +
      'the DIFFERENCE of the two voltages over R, and it flows from the stronger source into ' +
      'the weaker one — which then shows positive power: it is being charged. Raise E₂ past E₁ ' +
      'and the arrow turns round, and the roles swap. Nothing in the algebra changed; only a ' +
      'sign did, and the sign is the answer.',
    params: [Vs('E1', 'E₁', 12), Vs('E2', 'E₂', 5), R('R1', 'R', 100)],
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
    views: ['power', 'equations'],
    claim: { twoSources: true },
  },

  // ============================================================== C
  {
    id: 'c1',
    group: GROUPS[2],
    name: 'Series: one current, shared voltage',
    terms: ['series', 'kvl'],
    note:
      'Elements in series carry the same current, so they add as resistances and split the ' +
      'voltage in proportion: v_k = E · R_k / (R₁ + R₂ + R₃). This is the voltage divider, ' +
      'and it is nothing more than KVL plus Ohm’s law. A resistor ten times the others takes ' +
      'ten times the voltage — and nearly all of it.',
    params: [Vs('E', 'Source E', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 3000)],
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
    view: 'equations',
    views: ['equations', 'power'],
    claim: { series: true },
  },
  {
    id: 'c2',
    group: GROUPS[2],
    name: 'Parallel: one voltage, shared current',
    terms: ['parallel', 'kcl'],
    note:
      'Elements in parallel share a voltage, so their CONDUCTANCES add: 1/R_eq = 1/R₁ + 1/R₂ ' +
      '+ 1/R₃, and the current splits in proportion to 1/R. The equivalent is always smaller ' +
      'than the smallest branch. Watch the total current from the source: it equals E divided ' +
      'by that equivalent, and the smallest resistor takes the biggest share.',
    params: [Vs('E', 'Source E', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 3000)],
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
    view: 'equations',
    views: ['equations', 'power'],
    claim: { parallel: true },
  },
  {
    id: 'c3',
    group: GROUPS[2],
    name: 'The loaded divider',
    terms: ['series', 'parallel', 'thevenin'],
    note:
      'The divider formula E·R₂/(R₁+R₂) is true only with nothing connected. Hang a load R_L ' +
      'across the output and it sits in parallel with R₂, pulling the voltage down to ' +
      'E·(R₂∥R_L)/(R₁ + R₂∥R_L). The droop is small only while R_L is much larger than R₂ — ' +
      'which is the real reason dividers are built from small resistors and why, in E8, an ' +
      'op-amp buffer fixes this completely.',
    params: [Vs('E', 'Source E', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 1000), R('RL', 'Load R_L', 10000)],
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
    views: ['sweep', 'equations', 'thevenin'],
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
    note:
      'Two dividers side by side, output read between their midpoints. When R₁/R₂ = R₃/R₄ the ' +
      'two midpoints sit at the same voltage and the output is exactly zero — the bridge is ' +
      'balanced, and it stays balanced whatever the supply does. Nudge R₄ by 1% and the output ' +
      'moves by about E/4 × 1%: a bridge turns a tiny resistance change into a voltage you can ' +
      'read, which is how strain gauges and thermistors are read out.',
    params: [Vs('E', 'Source E', 10), R('R1', 'R₁', 1000), R('R2', 'R₂', 1000), R('R3', 'R₃', 1000), R('R4', 'R₄', 1010)],
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
    view: 'equations',
    views: ['equations', 'power'],
    claim: { bridge: true },
  },

  // ============================================================== D
  {
    id: 'd1',
    group: GROUPS[3],
    name: 'Nodal analysis: one equation per node',
    terms: ['kcl', 'node', 'nodal'],
    note:
      'Pick a ground, name the other node voltages, and write KCL at each in terms of them: ' +
      'every resistor’s current is (its two node voltages apart)/R. That is the whole method. ' +
      'Here there is one unknown, V_A, and one equation; the pane below shows it, with each ' +
      'term’s live value so you can see them sum to zero. The closed form falls out at once: ' +
      'V_A = (E/R₁)/(1/R₁ + 1/R₂ + 1/R₃).',
    params: [Vs('E', 'Source E', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 3000)],
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
    view: 'equations',
    views: ['equations', 'power'],
    claim: { nodalClosedForm: true },
  },
  {
    id: 'd2',
    group: GROUPS[3],
    name: 'A source between two nodes: the supernode',
    terms: ['nodal', 'supernode', 'mna'],
    note:
      'A voltage source between nodes A and B fixes their difference but says nothing about ' +
      'the current through itself — KCL at A and at B each contain an unknown current. The ' +
      'textbook fix is a supernode: add the two KCL equations so that current cancels, then ' +
      'use V_A − V_B = E₂ as the second equation. The matrix method does the same thing without ' +
      'the trick: it keeps the source current as an extra unknown and adds the constraint as ' +
      'an extra row. Below, the printed system has three unknowns for two nodes.',
    params: [Vs('E1', 'E₁', 12), Vs('E2', 'E₂ (floating)', 4), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 3000)],
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
    view: 'equations',
    views: ['equations', 'power'],
    claim: { supernode: true },
  },
  {
    id: 'd3',
    group: GROUPS[3],
    name: 'Mesh analysis: one equation per loop',
    terms: ['kvl', 'mesh'],
    note:
      'The other method: assign a circulating current to each window of the circuit and write ' +
      'KVL around it. Two meshes, two unknowns: E₁ = R₁i₁ + R₂(i₁ − i₂) and 0 = R₃i₂ + E₂ + ' +
      'R₂(i₂ − i₁). The shared resistor carries the difference i₁ − i₂. Solve the 2×2 by hand ' +
      'and the currents match the nodal solution exactly — two methods, one circuit, one ' +
      'answer. Make E₂ larger than E₁·R₂/(R₁+R₂) and i₂ goes negative: the right-hand loop runs ' +
      'the other way.',
    params: [Vs('E1', 'E₁', 12), Vs('E2', 'E₂', 3), R('R1', 'R₁', 1000), R('R2', 'R₂ (shared)', 2000), R('R3', 'R₃', 1000)],
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
        { text: 'i₁ ↻', x: 125, y: 112 },
        { text: 'i₂ ↻', x: 260, y: 112 },
      ],
    },
    show: 'i',
    view: 'equations',
    views: ['equations', 'superposition', 'power'],
    claim: { mesh: true },
  },
  {
    id: 'd4',
    group: GROUPS[3],
    name: 'Superposition: one source at a time',
    terms: ['superposition', 'linear'],
    note:
      'In a linear circuit the response to several sources is the sum of the responses to ' +
      'each alone — the others set to zero, which means a voltage source becomes a wire and a ' +
      'current source a gap. Below, every voltage and current is solved once per source and ' +
      'summed, and the sums match the full solution to the last digit. POWER does not add: ' +
      'i² has a cross term 2·i₁·i₂ that the two half-solutions never see. Superposition is a ' +
      'statement about linear quantities only.',
    params: [Vs('E1', 'E₁', 12), Is('I1', 'I₁', 0.005), R('R1', 'R₁', 1000), R('R2', 'R₂', 1000)],
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
    views: ['superposition', 'equations', 'power'],
    claim: { superposition: true },
  },
  {
    id: 'd5',
    group: GROUPS[3],
    name: 'Thévenin, three ways',
    terms: ['thevenin', 'linear'],
    note:
      'Seen from any two terminals, a linear circuit is indistinguishable from one source in ' +
      'series with one resistor. Three ways to find that resistor: divide the open-circuit ' +
      'voltage by the short-circuit current; kill the sources and push 1 A in, reading the ' +
      'volts; or hang several loads and fit the straight line through the (i, v) points. Below, ' +
      'all three run live and agree — R_th = R₁∥R₂∥R₃ here — and the load line’s intercepts ' +
      'are V_oc and I_sc.',
    params: [Vs('E', 'Source E', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 3000)],
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
    view: 'thevenin',
    views: ['thevenin', 'equations'],
    port: ['A', 'gnd'],
    claim: { theveninAgree: true },
  },
  {
    id: 'd6',
    group: GROUPS[3],
    name: 'Maximum power transfer',
    terms: ['thevenin', 'power'],
    note:
      'A source with internal resistance R_s delivers the most power to a load when R_L = R_s: ' +
      'P = E²R_L/(R_s+R_L)² peaks at E²/4R_s. At that point exactly half the power is lost ' +
      'inside the source, so the efficiency is 50% — which is why radio receivers match ' +
      'impedances and power grids do not. Slide R_L to either side and watch the load power ' +
      'fall while the efficiency keeps climbing toward 100% as R_L grows.',
    params: [Vs('E', 'Source E', 12), R('Rs', 'Source R_s', 500), R('RL', 'Load R_L', 500)],
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
    views: ['sweep', 'power', 'thevenin'],
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
    terms: ['dependent', 'power'],
    note:
      'A dependent source is an element whose value is set by a voltage or current somewhere ' +
      'else in the circuit. This one is a voltage-controlled voltage source: v_out = A·v_in, ' +
      'whatever load it drives. It is the first element here that can deliver more power than ' +
      'it takes in — its power is negative while the input source barely works at all. That ' +
      'energy comes from a supply the symbol does not show, which is exactly what an op-amp is.',
    params: [Vs('E', 'Input E', 0.5), Gain('A', 'Gain A', 10), R('Rin', 'R_in', 10000), R('RL', 'Load R_L', 1000)],
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
    views: ['power', 'equations'],
    claim: { dependent: true },
  },
  {
    id: 'e2',
    group: GROUPS[4],
    name: 'The op-amp as a black box',
    terms: ['opamp', 'ideal', 'impedance', 'active'],
    note:
      'An operational amplifier is a packaged circuit of a few dozen transistors — active ' +
      'devices, powered from supply pins the symbol never shows — that behaves, from outside, ' +
      'like the box drawn here: a resistance R_in between its two inputs, a dependent source ' +
      'that produces A times the input difference, and a resistance R_out in series with the ' +
      'output. Nothing else about the inside matters to a circuit designer, which is the point ' +
      'of a black box. The IDEAL op-amp has A = ∞, R_in = ∞ (its inputs draw no current), ' +
      'R_out = 0 (its output holds its voltage into any load), no offset and no speed limit; a ' +
      'real one has A ≈ 10⁵, R_in from 1 MΩ to 10¹² Ω, R_out of tens of ohms. Turn the three ' +
      'knobs: the input divider R_in/(R_s + R_in) costs a little of the signal, R_out/(R_out + ' +
      'R_L) costs a little of the output, and the ideal recovers as both go to their limits. ' +
      'The payoff over any circuit of resistors alone: this one delivers far more power to the ' +
      'load than the source supplies — a resistor network can only divide what it is given.',
    params: [
      Vs('E', 'Input E', 0.01),
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
    views: ['power', 'equations'],
    claim: { blackBox: true },
  },
  {
    id: 'e3',
    group: GROUPS[4],
    name: 'Comparator: an op-amp with no feedback',
    terms: ['opamp', 'gain'],
    note:
      'An op-amp is a dependent source with an enormous gain: v_out = A·(v₊ − v₋). With ' +
      'nothing connecting the output back to an input, an IDEAL op-amp has no solution at all ' +
      '— infinity times anything — and the solver refuses, saying so. Give it a finite gain ' +
      'and the answer is finite but absurd: 1 mV in, 100 V out. A real op-amp would stop at its ' +
      'supply rails; that saturation is the comparator’s job, and it arrives with the ' +
      'non-linear elements later in this lab.',
    params: [
      Vs('E', 'Input E', 0.001),
      { key: 'A', label: 'Gain A (0 = ideal)', unit: '', min: 0, max: 1e6, scale: 'linear', default: 0, hint: 'Set 0 for an ideal op-amp' },
      R('RL', 'Load R_L', 1000),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['in', 'gnd'], gain: p.A > 0 ? p.A : Infinity },
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
    view: 'equations',
    views: ['equations', 'power'],
    claim: { comparator: true },
  },
  {
    id: 'e4',
    group: GROUPS[4],
    name: 'The golden rules, derived',
    terms: ['opamp', 'feedback', 'gain'],
    note:
      'Connect the output back to the − input through a divider and the huge gain works FOR ' +
      'you. Exactly: v_out = G·E / (1 + G/A) where G = 1 + R_f/R_g is the gain you built. The ' +
      'op-amp only has to hold v₊ − v₋ = v_out/A across its inputs — microvolts. As A → ∞ that ' +
      'difference → 0 and v_out → G·E: the two “golden rules” (no input current, equal input ' +
      'voltages) are not axioms but the limit of this formula. Slide A and watch the gain ' +
      'converge on G.',
    params: [Vs('E', 'Input E', 1), Gain('A', 'Op-amp gain A', 1000), R('Rf', 'R_f', 9000), R('Rg', 'R_g', 1000)],
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
    view: 'equations',
    views: ['equations', 'power'],
    claim: { goldenRules: true },
  },
  {
    id: 'e5',
    group: GROUPS[4],
    name: 'Inverting amplifier and the virtual ground',
    terms: ['opamp', 'feedback', 'virtual'],
    note:
      'Ground the + input and feed the signal into the − input through R_g, with R_f back ' +
      'from the output. The golden rules make the − input sit at 0 V without being connected ' +
      'to ground — a virtual ground — so the input current is simply E/R_g, and since none of ' +
      'it enters the op-amp it all flows through R_f: v_out = −(R_f/R_g)·E. The source sees a ' +
      'load of exactly R_g, and the output current comes from the op-amp, not the source.',
    params: [Vs('E', 'Input E', 0.5), R('Rf', 'R_f', 10000), R('Rg', 'R_g', 1000), R('RL', 'Load R_L', 10000)],
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
    view: 'equations',
    views: ['equations', 'power'],
    claim: { inverting: true },
  },
  {
    id: 'e6',
    group: GROUPS[4],
    name: 'The summing amplifier',
    terms: ['opamp', 'virtual', 'kcl'],
    note:
      'Two inputs into the same virtual ground. Because that node is held at 0 V, each input ' +
      'current is set by its own resistor alone — E₁/R₁ and E₂/R₂ — and KCL at the node sends ' +
      'the sum through R_f: v_out = −R_f(E₁/R₁ + E₂/R₂). The inputs never see each other; the ' +
      'virtual ground is what makes addition possible without interaction. Weighted by the ' +
      'resistor ratios, this is a digital-to-analogue converter waiting to happen.',
    params: [Vs('E1', 'E₁', 1), Vs('E2', 'E₂', 2), R('R1', 'R₁', 10000), R('R2', 'R₂', 20000), R('Rf', 'R_f', 10000)],
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
    view: 'equations',
    views: ['equations', 'superposition', 'power'],
    claim: { summer: true },
  },
  {
    id: 'e7',
    group: GROUPS[4],
    name: 'The difference amplifier',
    terms: ['opamp', 'feedback', 'cmrr'],
    note:
      'Four resistors, two inputs, one output: with R₃/R₄ matched to R₁/R₂ the output is ' +
      '(R₂/R₁)(E₂ − E₁) and a voltage common to both inputs is rejected entirely. Mismatch the ' +
      'ratio by 1% and a common-mode input leaks through at about 1% of the differential ' +
      'gain’s worth — set E₁ = E₂ to see exactly how much. That ratio, differential gain over ' +
      'common-mode gain, is the CMRR, and it is set by resistor matching, not by the op-amp.',
    params: [
      Vs('E1', 'E₁ (to −)', 1),
      Vs('E2', 'E₂ (to +)', 1.1),
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
    view: 'equations',
    views: ['equations', 'superposition', 'power'],
    claim: { difference: true },
  },
  {
    id: 'e8',
    group: GROUPS[4],
    name: 'The buffer fixes the loaded divider',
    terms: ['opamp', 'feedback', 'thevenin'],
    note:
      'C3’s divider drooped under load. Put a unity-gain buffer between them — output wired ' +
      'straight back to the − input — and the divider sees no load at all (the op-amp input ' +
      'draws nothing) while the load sees a source with zero resistance. The output is the ' +
      'UNLOADED divider voltage E·R₂/(R₁+R₂) whatever R_L is; the load current comes from the ' +
      'op-amp. Sweep R_L below and the line is flat. Compare the same sweep in C3.',
    params: [Vs('E', 'Source E', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 1000), R('RL', 'Load R_L', 100)],
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
    views: ['sweep', 'equations', 'power'],
    port: ['out', 'gnd'],
    sweepId: 'RL',
    sweepY: 'v',
    claim: { buffer: true },
  },

  // ============================================================== F
  {
    id: 'f1',
    group: GROUPS[5],
    name: 'A capacitor’s current is the slope of its voltage',
    terms: ['capacitor', 'state', 'current'],
    note:
      'A capacitor stores charge, q = C·v, and current is charge per second, so i = C·dv/dt: a ' +
      'capacitor’s current is proportional to how fast its voltage is CHANGING, not to the ' +
      'voltage. Drive it with a triangle wave — voltage rising at a steady 4A/T — and the ' +
      'current is a square wave, ±C·4A/T = ±20 mA here, flat while the voltage climbs and ' +
      'flipping sign the instant the slope does. The small series R_s is there because an ideal ' +
      'source wired straight to an ideal capacitor would have to supply infinite current at the ' +
      'corners; with it the capacitor voltage lags the source by τ = R_sC = 10 µs and the ' +
      'current settles onto its plateau in the same time. Scrub the cursor: the schematic at ' +
      'each instant is an ordinary resistive circuit with the capacitor standing in as a voltage ' +
      'source at its present voltage — that is exactly how the solver sees it.',
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
    views: ['scope', 'state', 'equations', 'power'],
    claim: { slope: true },
  },
  {
    id: 'f2',
    group: GROUPS[5],
    name: 'An inductor’s voltage is the slope of its current',
    terms: ['inductor', 'state', 'duality'],
    note:
      'The dual. An inductor stores flux, λ = L·i, and voltage is flux per second: v = L·di/dt. ' +
      'Push a triangle current through it — rising at 4A/T — and the voltage is a square wave of ' +
      '±L·4A/T = ±0.4 V, flat while the current ramps and flipping when the ramp does. The ' +
      'parallel R_p plays the role R_s played in F1: an ideal current source into an ideal ' +
      'inductor would need infinite voltage at each corner, and with R_p the inductor current ' +
      'lags the source by τ = L/R_p = 1 µs. Swap v for i, C for L, series for parallel, and F1 ' +
      'turns into this experiment word for word — that swap has a name, duality, and it runs ' +
      'through the whole group.',
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
    views: ['scope', 'state', 'equations', 'power'],
    claim: { slopeDual: true },
  },
  {
    id: 'f3',
    group: GROUPS[5],
    name: 'Charging a capacitor: the time constant',
    terms: ['capacitor', 'state', 'timeconstant', 'initial'],
    note:
      'Close the switch at t = 0 and the capacitor does not jump to E: its voltage is a state, ' +
      'and a state cannot change instantly (that would take infinite current). KVL round the ' +
      'loop gives E = R·i + v_C with i = C·dv_C/dt — a first-order differential equation, ' +
      'RC·dv_C/dt + v_C = E. Its solution is v_C(t) = E + (v₀ − E)e^(−t/τ) with τ = RC = 1 ms: ' +
      'the gap to the final value shrinks by a factor e every time constant, so after one τ the ' +
      'capacitor has covered 63.2 % of the way and after five 99.3 %. The current starts at ' +
      '(E − v₀)/R = 12 mA the instant the switch closes — an uncharged capacitor looks like a ' +
      'short — and dies away with the same τ. Give v_C(0) a value and the same formula holds; ' +
      'only the starting point moves.',
    params: [Vs('E', 'Source E', 12), R('R1', 'R', 1000), Cap('C1', 'C', 1e-6), Vs('v0', 'v_C(0)', 0, 'the capacitor’s charge before the switch closes'), Win('N', 'Window', 'τ', 5)],
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
    views: ['scope', 'state', 'energy', 'equations', 'power'],
    claim: { tau: true },
  },
  {
    id: 'f4',
    group: GROUPS[5],
    name: 'Every RC circuit is one RC circuit: Thévenin sets τ',
    terms: ['thevenin', 'timeconstant', 'capacitor'],
    note:
      'The capacitor here sits behind a divider and a series resistor, and nothing in F3 seems ' +
      'to apply — until you replace everything to the left of it by its Thévenin equivalent ' +
      '(D5). Seen from the capacitor the network is a source V_th = E·R₂/(R₁+R₂) = 8 V behind ' +
      'R_th = R₃ + R₁∥R₂ = 1.167 kΩ, and then it IS F3: v_B(t) = V_th(1 − e^(−t/τ)) with ' +
      'τ = R_th·C = 1.167 ms. Every circuit with one capacitor is this circuit; the only work is ' +
      'finding V_th and R_th. Node A moves too, because the charging current passes through the ' +
      'divider: the instant the source steps, the empty capacitor is a short and A sees ' +
      'R₂∥R₃, so it starts at 3.43 V and climbs to the divider’s own 8 V as the current dies.',
    params: [Vs('E', 'Step E', 12), R('R1', 'R₁', 1000), R('R2', 'R₂', 2000), R('R3', 'R₃', 500), Cap('C1', 'C', 1e-6), Win('N', 'Window', 'τ', 5)],
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
    views: ['scope', 'state', 'thevenin', 'equations', 'power'],
    port: ['B', 'gnd'],
    claim: { theveninTau: true },
  },
  {
    id: 'f5',
    group: GROUPS[5],
    name: 'Half the energy is lost, whatever R',
    terms: ['energy', 'capacitor', 'power'],
    note:
      'Charging a capacitor from a fixed source through a resistor wastes exactly half the ' +
      'energy, and no choice of R can change that. The source delivers E·q = C·E² = 144 µJ in ' +
      'all; the capacitor ends up holding ½CE² = 72 µJ; the other 72 µJ is heat in the ' +
      'resistor. Try the chips: a small R charges fast with a large current, a large R slowly ' +
      'with a small one, and the integral of i²R over the whole charge comes out the same — ' +
      'because the resistor’s energy is ∫(E − v_C)·i dt = ∫(E − v_C)·C dv_C, which depends only ' +
      'on where v_C starts and ends. The energy view stacks the three as the charge proceeds; ' +
      'after ten time constants the bars have all but stopped moving.',
    params: [Vs('E', 'Source E', 12), chips(R('R1', 'R', 1000), [100, 1000, 10000]), Cap('C1', 'C', 1e-6), Win('N', 'Window', 'τ', 10)],
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
    views: ['energy', 'scope', 'state', 'power'],
    claim: { half: true },
  },
  {
    id: 'f6',
    group: GROUPS[5],
    name: 'Opening a switch on an inductor: the spark',
    terms: ['inductor', 'state', 'timeconstant'],
    note:
      'Before t = 0 the switch has been closed a long time, the inductor is a short at DC and ' +
      'carries I₀ = E/R = 12 mA. Open the switch and that current has nowhere to go — but an ' +
      'inductor’s current is a state and cannot change instantly. Something has to give. Flip ' +
      'the switch to ideal and the solver refuses, with a reason: di/dt would be infinite and so ' +
      'would the voltage. The real answer is that an open switch is not infinite ohms: give it ' +
      'R_off = 100 kΩ and the moment it opens the full 12 mA is forced through it, putting ' +
      'I₀·R_off = 1.2 kV across a gap that was at 0 V an instant before. That is the spark, and ' +
      'the reason relay coils get a diode across them. The current then decays with ' +
      'τ = L/(R + R_off) = 9.9 µs — a hundred times faster than the L/R = 1 ms it took to build up.',
    params: [
      Vs('E', 'Source E', 12),
      R('R1', 'R', 1000),
      Ind('L1', 'L', 1),
      Toggle('ideal', 'Switch', false, 'ideal', 'finite R_off', 'an ideal open switch is infinite ohms'),
      R('Roff', 'Open-switch R_off', 1e5),
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
      right: { unit: 'V', traces: [{ q: 'volt', key: 'S1', label: 'v_switch' }] },
    },
    show: 'v',
    view: 'scope',
    views: ['scope', 'state', 'energy', 'equations', 'power'],
    claim: { spark: true },
  },
  {
    id: 'f7',
    group: GROUPS[5],
    name: 'The op-amp integrator',
    terms: ['opamp', 'virtual', 'capacitor', 'ideal'],
    note:
      'Feedback through a capacitor instead of a resistor. The virtual ground (E5) holds n at ' +
      '0 V, so the input current is v_in/R = 100 µA exactly, and all of it must flow into the ' +
      'capacitor: C·dv_C/dt = v_in/R. The output is −v_C, so dv_out/dt = −v_in/(RC): the output ' +
      'is the integral of the input, scaled by −1/RC. A square wave in gives a triangle out — ' +
      'slope 1 V/ms here for 1 V in, peak to peak A·T/(2RC) = 0.5 V. Flip the op-amp to finite ' +
      'gain and the integrator becomes a very slow RC: the output heads for −A·v_in with ' +
      'τ = RC(A + 1) = 100 s instead of integrating for ever, which is the leak every real ' +
      'integrator has.',
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
      left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_in', dim: true }, { q: 'v', key: 'out', label: 'v_out' }] },
      right: { unit: 'A', traces: [{ q: 'i', key: 'R1', label: 'i_in' }] },
    },
    show: 'i',
    view: 'scope',
    views: ['scope', 'state', 'equations', 'power'],
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
      view: 'state',
      terms: ['state', 'characteristic', 'damping', 'natural'],
      note:
        'Two states now — the capacitor’s voltage and the inductor’s current — and KVL round the ' +
        'loop, E = R·i + L·di/dt + v_C with i = C·dv_C/dt, becomes a second-order differential ' +
        'equation: LC·v_C″ + RC·v_C′ + v_C = E. The solver never writes it that way; it writes ' +
        'the pair of first-order equations dx/dt = A·x + B·u shown underneath, whose ' +
        'characteristic polynomial det(sI − A) = s² + (R/L)s + 1/LC is the same equation. Two ' +
        'numbers describe everything: ω₀ = 1/√LC = 10⁴ rad/s and α = R/2L. With R = 800 Ω, ' +
        'α = 4×10⁴ > ω₀, the roots are real, −1.27×10³ and −7.87×10⁴ s⁻¹, and the response is ' +
        'two decaying exponentials of which the slow one sets the pace. The capacitor creeps up ' +
        'to E and never overshoots. Try the chips for the other two faces.',
      claim: { overdamped: true },
    },
    {
      id: 'g2',
      name: 'Critical damping',
      R: 200,
      view: 'scope',
      terms: ['damping', 'characteristic', 'natural'],
      note:
        'Lower R until α = ω₀ — R = 2√(L/C) = 200 Ω — and the two real roots merge into one, ' +
        's = −α = −10⁴ s⁻¹, repeated. The response is then v_C = E[1 − (1 + αt)e^(−αt)]: it ' +
        'still never overshoots, but it is the fastest response that does not (G3 measures ' +
        'that). A hair less resistance and the roots turn complex and the capacitor voltage ' +
        'crosses E; a hair more and the slow root slows the approach. The current ' +
        'i = (E/L)·t·e^(−αt) peaks at t = 1/α = 100 µs, at E/(Lαe) = 3.68 mA. Nothing in the ' +
        'circuit hints that 200 Ω is special; only the equation does.',
      claim: { critical: true },
    },
    {
      id: 'g3',
      name: 'Damping versus speed: the R sweep',
      R: 200,
      view: 'damping',
      terms: ['damping', 'natural', 'timeconstant'],
      note:
        'Sweep R across its whole range and measure two things about the step response: how far ' +
        'the capacitor voltage overshoots E, and how long it takes to settle within 2 % of E for ' +
        'good. Above 200 Ω there is no overshoot at all, and the settling time falls as R does, ' +
        'because the slow root −α + √(α² − ω₀²) speeds up. Below 200 Ω the response rings, the ' +
        'overshoot climbs — 44 % at 50 Ω, 100 % at zero — and the settling time first keeps ' +
        'falling and then climbs again as the ringing outlasts the decay. Critical damping is ' +
        'the fastest response with no overshoot; the fastest settling of all lies a little below ' +
        'it, near 160 Ω, where the first peak just fits inside the 2 % band — a 1.5 % overshoot ' +
        'buys a settling time a third shorter.',
      claim: { sweep: true },
    },
    {
      id: 'g4',
      name: 'Underdamped: ringing',
      R: 50,
      view: 'scope',
      terms: ['damping', 'natural', 'characteristic'],
      note:
        'With R = 50 Ω, α = 2.5×10³ < ω₀ and the roots are complex: −α ± jω_d with ' +
        'ω_d = √(ω₀² − α²) = 9682 rad/s. The response is a decaying oscillation, ' +
        'v_C = E[1 − e^(−αt)(cos ω_d t + (α/ω_d) sin ω_d t)]: it rings at ω_d, slightly slower ' +
        'than ω₀, inside an envelope that shrinks as e^(−αt) — the dashed curves. The damping ' +
        'ratio ζ = α/ω₀ = 0.25 fixes the shape whatever the scale: the first peak overshoots ' +
        'by e^(−πζ/√(1−ζ²)) = 44.4 % of the step and arrives at t = π/ω_d = 324 µs, and each ' +
        'following peak is that same fraction of the one before. Q = 1/2ζ = 2 says the same ' +
        'thing another way.',
      claim: { underdamped: true },
    },
  ].map((g) => ({
    id: g.id,
    group: GROUPS[6],
    name: g.name,
    terms: g.terms,
    note: g.note,
    params: [Vs('E', 'Step E', 1), chips(R('R1', 'R', g.R), [800, 200, 50]), Ind('L1', 'L', 10e-3), Cap('C1', 'C', 1e-6), Win('N', 'Window', 'cycles', 5)],
    net: seriesRLC,
    layout: loop(['R1', 'L1', 'C1']),
    window: rlcWindow,
    cursor: 0.2,
    scope: rlcScope(),
    show: 'v',
    view: g.view,
    views: g.id === 'g3' ? ['damping', 'scope', 'state', 'energy', 'equations'] : ['scope', 'state', 'energy', 'equations', 'power'],
    sweepId: g.id === 'g3' ? 'R1' : undefined,
    claim: g.claim,
  })),
  {
    id: 'g5',
    group: GROUPS[6],
    name: 'Undamped: energy sloshes between L and C',
    terms: ['energy', 'natural', 'inductor', 'capacitor'],
    note:
      'Take the resistor out entirely and α = 0: the roots are ±jω₀ and nothing decays. The ' +
      'capacitor voltage swings for ever between 0 and 2E — v_C = E(1 − cos ω₀t) — ' +
      'overshooting the step by a full 100 %, and the current i = E√(C/L)·sin ω₀t is 10 mA at ' +
      'its peaks. Nothing is dissipated, so every joule the source delivers is still in the ' +
      'circuit, moving back and forth: the capacitor holds ½Cv² when the voltage peaks and the ' +
      'inductor holds ½Li² when the current does, a quarter cycle later, and the two together ' +
      'exactly equal what the source has supplied so far. No real circuit does this — every ' +
      'wire has resistance — but every real oscillator is this circuit with the losses made up.',
    params: [Vs('E', 'Step E', 1), Ind('L1', 'L', 10e-3), Cap('C1', 'C', 1e-6), Win('N', 'Window', 'cycles', 3)],
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
    views: ['energy', 'scope', 'state', 'equations', 'power'],
    claim: { undamped: true },
  },
  {
    id: 'g6',
    group: GROUPS[6],
    name: 'Initial conditions: where the circuit starts from',
    terms: ['initial', 'natural', 'state'],
    note:
      'The differential equation fixes the shape of the response; the initial conditions fix ' +
      'which particular response you get. A second-order circuit needs two — the capacitor’s ' +
      'voltage and the inductor’s current at t = 0 — because those are the two quantities that ' +
      'cannot jump. Here they are knobs: the dim traces are the response from rest (G4), the ' +
      'bright ones from your starting point. Both settle to the same place, E across the ' +
      'capacitor and no current, because the forced response is set by the source alone; the ' +
      'difference between them is a pure natural response, e^(−αt) times cosines and sines, ' +
      'with its amplitudes chosen so that it starts at exactly v_C(0) and i_L(0). The two ' +
      'traces differ by that natural response and by nothing else.',
    params: [
      Vs('E', 'Step E', 1),
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
    views: ['scope', 'state', 'energy', 'equations', 'power'],
    claim: { initial: true },
  },
  {
    id: 'g7',
    group: GROUPS[6],
    name: 'Parallel RLC: the dual',
    terms: ['duality', 'damping', 'natural'],
    note:
      'Swap every element for its dual — series for parallel, voltage source for current ' +
      'source, R for 1/R — and the mathematics repeats itself exactly. KCL at the one node, ' +
      'I = v/R + C·dv/dt + i_L with v = L·di_L/dt, is the same second-order equation with ' +
      'α = 1/(2RC) in place of R/2L; ω₀ = 1/√LC does not change. The roles trade places: the ' +
      'inductor current is now the state that steps from 0 to the full I = 10 mA the way v_C ' +
      'stepped to E in the series circuit, overshooting by the same 44.4 %, and the node ' +
      'voltage is the one that rings and dies away to zero. At R = 200 Ω this circuit is as ' +
      'underdamped as the series one was at 50 Ω — ζ = 0.25 both times — because the critical ' +
      'resistance is now ½√(L/C) = 50 Ω rather than 2√(L/C) = 200 Ω. In a parallel circuit a ' +
      'LARGE R means light damping: the resistor is a leak across the tank, and a bigger leak ' +
      'resistance leaks less.',
    params: [
      { key: 'I', label: 'Step I', unit: 'A', min: 1e-3, max: 0.1, scale: 'linear', default: 0.01 },
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
    views: ['scope', 'state', 'energy', 'equations', 'power'],
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
    note:
      'Switch a sine on at t = 0 and the capacitor voltage is two things added together: a ' +
      'steady sinusoid at the drive frequency — the forced response, dashed — and a decaying ' +
      'exponential −v_f(0)·e^(−t/τ) that exists only because the forced sinusoid would not have ' +
      'started from zero on its own. The exponential is the natural response, the same e^(−t/τ) ' +
      'as F2 with τ = RC = 1 ms; the source sets its size but not its shape. After 5τ the two ' +
      'traces differ by less than 1 % of the forced amplitude, after 25τ by less than one part ' +
      'in 10⁹, and from then on the circuit has forgotten how it started. Everything the phasor ' +
      'views (H2 onward) say is about that steady state alone.',
    params: sineRCParams({ f: 159.2 }),
    net: sineRC,
    layout: loop(['R1', 'C1']),
    window: cyclesWindow,
    ghost: 'forced',
    ghostLabel: 'steady state (dashed)',
    cursor: 0.3,
    scope: {
      left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_s', dim: true }, { q: 'volt', key: 'C1', label: 'v_C' }] },
      right: { unit: 'A', traces: [{ q: 'i', key: 'R1', label: 'i' }] },
    },
    out: { q: 'volt', key: 'C1', label: 'v_C' },
    show: 'v',
    view: 'scope',
    views: ['scope', 'phasor', 'state', 'equations', 'power'],
    phasor: { volts: ['R1', 'C1'], total: 'V1', current: 'R1' },
    circuitLab: rcToCircuitLab,
    claim: { switchOn: true },
  },
  {
    id: 'h2',
    group: GROUPS[7],
    name: 'Phasors: the arrow that draws the wave',
    terms: ['phasor', 'reactance', 'steadystate'],
    note:
      'In the steady state every voltage and current is a sinusoid at the one drive frequency, ' +
      'so each is fixed by two numbers — amplitude and phase — and can be drawn as an arrow. ' +
      'Spin all the arrows together at ω and the height of each tip traces its waveform; the ' +
      'slider sets how far they have turned. Arrows add like the voltages they stand for: V_R ' +
      'and V_C laid tip to tail land exactly on V_s, which is KVL. The capacitor’s arrow lies ' +
      '90° behind the current’s, because i = C·dv/dt puts the current a quarter cycle ahead, ' +
      'and its length is |I|/ωC — the reactance 1/ωC plays the part of R. At the corner ' +
      'frequency f = 1/(2πRC) = 159.2 Hz the two voltage arrows are the same length, each ' +
      '1/√2 of the source, and v_C lags the source by exactly 45°.',
    params: sineRCParams({ f: 159.2 }),
    net: sineRC,
    layout: loop(['R1', 'C1']),
    window: cyclesWindow,
    ghost: 'forced',
    ghostLabel: 'steady state (dashed)',
    cursor: 0.75,
    scope: {
      left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_s', dim: true }, { q: 'volt', key: 'R1', label: 'v_R' }, { q: 'volt', key: 'C1', label: 'v_C' }] },
      right: { unit: 'A', traces: [{ q: 'i', key: 'R1', label: 'i' }] },
    },
    out: { q: 'volt', key: 'C1', label: 'v_C' },
    show: 'v',
    view: 'phasor',
    views: ['phasor', 'scope', 'state', 'equations', 'power'],
    phasor: { volts: ['R1', 'C1'], total: 'V1', current: 'R1' },
    circuitLab: rcToCircuitLab,
    claim: { phasor: true },
  },
  {
    id: 'h3',
    group: GROUPS[7],
    name: 'Impedance: series RLC',
    terms: ['impedanceac', 'reactance', 'phasor'],
    note:
      'With phasors, a capacitor and an inductor obey Ohm’s law: V = Z·I with Z_C = 1/jωC ' +
      'and Z_L = jωL. Impedances in series add like resistors, Z = R + j(ωL − 1/ωC), and the ' +
      'current is V_s/Z — one complex division does the whole circuit. At 1 kHz the inductor ' +
      'offers ωL = 62.8 Ω and the capacitor 1/ωC = 159.2 Ω; their arrows point opposite ways, ' +
      'so the reactances partly cancel to −96.3 Ω and |Z| = 138.8 Ω. The current leads the ' +
      'source by 43.9° — the capacitor is winning — and the capacitor voltage, 1.146 V, is ' +
      'larger than the 1 V source: the inductor’s voltage is subtracted from it, not added. ' +
      'Raise the frequency past 1591.5 Hz and the inductor wins instead; the current swings ' +
      'to lagging and the arrows for V_L and V_C trade lengths.',
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
    views: ['phasor', 'impedance', 'scope', 'state', 'equations', 'power'],
    phasor: { volts: ['R1', 'L1', 'C1'], total: 'V1', current: 'R1' },
    circuitLab: rlcToCircuitLab,
    claim: { impedance: true },
  },
  {
    id: 'h4',
    group: GROUPS[7],
    name: 'Resonance',
    terms: ['resonance', 'reactance', 'impedanceac'],
    note:
      'At one frequency, ω₀ = 1/√LC, the inductor’s reactance equals the capacitor’s and their ' +
      'voltages cancel exactly: V_L + V_C = 0, the impedance collapses to plain R, and the ' +
      'current is in phase with the source and as large as it can ever be. That is resonance, ' +
      'here at f₀ = 1591.5 Hz. The two cancelling voltages are not small — each is Q times the ' +
      'source, with Q = (1/R)√(L/C) = 20 at R = 5 Ω, so a 1 V drive puts 20 V across the ' +
      'capacitor. The impedance plot shows the same thing from outside: |Z| dips to R at f₀ ' +
      'and the phase crosses zero there, capacitive below, inductive above, with the half-power ' +
      'points f₀/Q = 79.6 Hz apart. The scope shows what resonance costs: the amplitude builds ' +
      'as 1 − e^(−αt) with α = R/2L, reaching 1 − 1/e after Q/π = 6.4 cycles, and only after 40 ' +
      'cycles is it within a quarter of one percent of its final 20 V.',
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
    cursor: 0.95,
    scope: rlcSineScope(),
    out: { q: 'volt', key: 'C1', label: 'v_C' },
    show: 'v',
    view: 'impedance',
    views: ['impedance', 'phasor', 'scope', 'state', 'equations', 'power'],
    phasor: { volts: ['R1', 'L1', 'C1'], total: 'V1', current: 'R1' },
    circuitLab: rlcToCircuitLab,
    claim: { resonance: true },
  },
  {
    id: 'h5',
    group: GROUPS[7],
    name: 'AC power: real, reactive, apparent',
    terms: ['rms', 'powerfactor', 'steadystate'],
    note:
      'Drive an RL load — 100 Ω and 0.3 H, roughly a small motor — from 10 V peak at 50 Hz. ' +
      'The current is 72.8 mA peak and lags by 43.3°. The instantaneous power p = v·i is not ' +
      'a sinusoid at 50 Hz but a constant plus a sinusoid at 100 Hz — twice the frequency, ' +
      'because v and i pass through zero together twice a cycle. Its average is the real power ' +
      'P = ½R|I|² = 265 mW, all of it in the resistor: the inductor’s power swings both ways ' +
      'and averages exactly zero, borrowing energy for a quarter cycle and giving it back. ' +
      'With RMS values, V_rms = 10/√2 = 7.07 V and I_rms = 51.5 mA, the product ' +
      'V_rms·I_rms = 364 mVA is the apparent power the wires must carry; only cos φ = 0.728 of ' +
      'it — the power factor — is P. The rest, Q = 250 mvar, is reactive power: the amplitude ' +
      'of the inductor’s to-and-fro.',
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
    views: ['acpower', 'scope', 'phasor', 'state', 'equations', 'power'],
    phasor: { volts: ['R1', 'L1'], total: 'V1', current: 'R1' },
    circuitLab: (p) => (p.L1 <= 1 ? { id: 'rlLow', values: [p.R1, p.L1], output: 'r' } : { decline: `Circuit Lab’s inductor knob stops at 1 H; L = ${fmt(p.L1, 'H', 3)} does not fit.` }),
    claim: { acpower: true },
  },
  {
    id: 'h6',
    group: GROUPS[7],
    name: 'Frequency response: one sine at a time, then all of them',
    terms: ['bode', 'steadystate', 'phasor'],
    note:
      'Everything the steady state does at one frequency is a single complex number, ' +
      'H = V_C/V_s = 1/(1 + jωRC). Sweep the frequency and that number traces a curve: this is ' +
      'the Bode plot, |H| in decibels and the phase in degrees against a logarithmic frequency ' +
      'axis. Below the corner f_c = 1/(2πRC) = 159.2 Hz the capacitor is nearly open and the ' +
      'output follows the input; at the corner |H| = 1/√2, which is −3.01 dB, and the phase ' +
      'is −45°; above it the gain falls 20 dB for every tenfold in frequency and the phase ' +
      'heads for −90°. The marker is the frequency the scope is running at right now. Circuit ' +
      'Lab starts from this plot — it has no time axis at all — so the hand-over below carries ' +
      'your R and C there exactly, and its Bode plot is this one.',
    params: sineRCParams({ f: 1000 }),
    net: sineRC,
    layout: loop(['R1', 'C1']),
    window: cyclesWindow,
    ghost: 'forced',
    ghostLabel: 'steady state (dashed)',
    cursor: 0.75,
    scope: {
      left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_s', dim: true }, { q: 'volt', key: 'C1', label: 'v_C' }] },
      right: { unit: 'A', traces: [{ q: 'i', key: 'R1', label: 'i' }] },
    },
    out: { q: 'volt', key: 'C1', label: 'v_C' },
    show: 'v',
    view: 'bode',
    views: ['bode', 'phasor', 'scope', 'state', 'equations', 'power'],
    phasor: { volts: ['R1', 'C1'], total: 'V1', current: 'R1' },
    circuitLab: rcToCircuitLab,
    claim: { bode: true },
  },
]

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
      { wire: [50, 130, 50, 158] },
      { el: 'V2', x: 75, y: 158, dir: 'h', flip: true },
      { wire: [55, 158, 50, 158] },
      gnd(50, 158),
      { wire: [95, 158, 150, 158] },
      node('in2', 118, 158, 't'),
      { el: 'R3', x: 170, y: 158, dir: 'h' },
      { wire: [190, 158, 205, 158] },
      { wire: [205, 158, 205, 102] },
      { wire: [205, 102, AMP.x, 102] },
      // p is named on its riser: the corner is hemmed in by R3 and the amplifier's reading.
      node('p', 205, 118, 'l'),
      { wire: [205, 158, 270, 158] },
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
