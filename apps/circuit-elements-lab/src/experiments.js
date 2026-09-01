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
// the op-amp as a circuit element.

export const GROUPS = [
  'A · Elements and signs',
  'B · Two laws',
  'C · Series and parallel',
  'D · Analysis and theorems',
  'E · Op-amps',
]

// ------------------------------------------------------------ knobs
const R = (key, label, def, hint) => ({ key, label, unit: 'Ω', min: 1, max: 1e6, scale: 'log', default: def, hint })
const Vs = (key, label, def, hint) => ({ key, label, unit: 'V', min: -24, max: 24, scale: 'linear', default: def, hint })
const Is = (key, label, def, hint) => ({ key, label, unit: 'A', min: -0.1, max: 0.1, scale: 'linear', default: def, hint })
const Gain = (key, label, def) => ({ key, label, unit: '', min: 1, max: 1e6, scale: 'log', default: def })

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
]

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

// ------------------------------------------------------------ lookups
export const byId = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]))

export function defaultsOf(id) {
  const out = {}
  for (const p of byId[id].params) out[p.key] = p.default
  return out
}

/** The netlist for an experiment at these settings. */
export const netOf = (id, params) => byId[id].net(params)

/** The elements as the schematic wants them: id, type, value/gain, and switch state. */
export function drawables(net) {
  return net.elements.map((e) => ({ id: e.id, type: e.type, value: e.value, gain: e.gain, closed: e.closed }))
}
