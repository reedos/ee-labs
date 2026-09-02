/**
 * What the student reads, per experiment, in three registers:
 *
 *   see — what the picture shows at the defaults, in a few lines;
 *   try — knob moves with the reading each one produces;
 *   why — the reasoning, for after the picture has made its point.
 *
 * Every number a step quotes is a measurement. A step's `set` is applied on
 * top of the defaults, its `at` moves the cursor, and each `reads` pair is a
 * quantity path (or a function of the analysis) with the value the sentence
 * quotes; experiments.test.js solves each step and checks both the pair and
 * every number-with-unit in the sentence against it. `refuses` marks a step
 * whose whole point is that the solver declines the circuit.
 *
 * Paths: v.<node>, volt.<id>, i.<id>, p.<id>, vd.<a>.<b> (node a minus node b),
 * state.<tau|alpha|w0|zeta|Q|wd|face>, thevenin.<voc|isc|rth>, mag.<q>.<id> and
 * deg.<q>.<id> (phasor length and angle), lead.<q>.<id> (angle ahead of the
 * source), energy.<stored|dissipated|supplied> at the cursor, omega, period,
 * H.<mag|db|deg>, Z.<mag|deg>, ac.<P|Q|S|pf>.
 */
import { complex as cx } from '@ee-labs/network'
import { atDrive } from './math.js'

const DEG = 180 / Math.PI
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180

/** Linear interpolation of the energy ledger at time t. */
function energyAt(x, t, key) {
  const pts = x.energy.points
  if (t <= pts[0].t) return pts[0][key]
  for (let k = 1; k < pts.length; k++) {
    if (pts[k].t >= t) {
      const a = pts[k - 1]
      const b = pts[k]
      const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t)
      return a[key] + f * (b[key] - a[key])
    }
  }
  return pts[pts.length - 1][key]
}

/** The complex power the source V1 delivers: S = ½·V·conj(I), I flowing out of its + terminal. */
function sourcePower(x) {
  const V = x.ac.volt.V1
  const I = cx.cscale(x.ac.i.V1, -1)
  return cx.cscale(cx.cmul(V, cx.conj(I)), 0.5)
}

/** Read one quantity of an analysis by path (see the module comment); `exp` is needed for H and Z. */
export function readQuantity(x, p, path, exp) {
  const [head, ...rest] = path.split('.')
  const sol = x.sol
  switch (head) {
    case 'v':
    case 'volt':
    case 'i':
    case 'p':
      return sol[head][rest[0]]
    case 'vd':
      return sol.v[rest[0]] - sol.v[rest[1]]
    case 'state':
      return x.state[rest[0]]
    case 'thevenin':
      return rest[0] === 'rth' ? x.thevenin.rth.test : x.thevenin[rest[0]]
    case 'damping':
      return rest[0] === 'at' ? x.damping.at[rest[1]] : x.damping[rest[0]]
    case 'mag':
      return cx.cabs(x.ac[rest[0]][rest[1]])
    case 'deg':
      return cx.carg(x.ac[rest[0]][rest[1]]) * DEG
    case 'lead':
      return wrap((cx.carg(x.ac[rest[0]][rest[1]]) - cx.carg(x.ac.volt.V1)) * DEG)
    case 'energy':
      return energyAt(x, x.cursor, rest[0])
    case 'omega':
      return x.omega
    case 'period':
      return (2 * Math.PI) / x.omega
    case 'H':
    case 'Z': {
      const z = atDrive(exp, x)[head]
      if (rest[0] === 'mag') return cx.cabs(z)
      if (rest[0] === 'db') return 20 * Math.log10(cx.cabs(z))
      return cx.carg(z) * DEG
    }
    case 'ac': {
      const S = sourcePower(x)
      if (rest[0] === 'P') return S[0]
      if (rest[0] === 'Q') return S[1]
      if (rest[0] === 'S') return cx.cabs(S)
      return S[0] / cx.cabs(S)
    }
    default:
      throw new Error(`unknown quantity path ${path}`)
  }
}

/** The largest |q| over the whole trace — the peak a scope would report. */
const peak = (q, id) => (x) => Math.max(...x.tr.samples.map((s) => Math.abs(s.sol[q][id])))
/** Overshoot of a stepped state past its final value, in per cent of the step. */
const overshootPct = (q, id, final) => (x, p) => (100 * (peak(q, id)(x) - final(p))) / final(p)
/** How far the bright trace ever leaves the dim one, as a fraction of the step. */
const offGhost = (q, id) => (x, p) => Math.max(...x.tr.samples.map((s) => Math.abs(s.sol[q][id] - x.ghost.at(s.t).sol[q][id]))) / p.E

export const LESSONS = {
  a1: {
    see:
      'Voltage is energy per unit of charge — how hard each coulomb is pushed. Current is charge passing per second. ' +
      'Here a source holds 12 V, and a resistor turns it into a current: i = E/R = 12 mA. ' +
      'The voltage is the source’s decision; the current is the resistor’s.',
    seeReads: [['i.R1', 0.012]],
    try: [
      { say: 'Turn R down to 100 Ω: the current climbs to 120 mA while the source still reads 12 V.', set: { R1: 100 }, reads: [['i.R1', 0.12], ['volt.V1', 12]] },
      { say: 'Set E to 5 V: the current follows, 5 mA through the same 1 kΩ.', set: { E: 5 }, reads: [['i.R1', 0.005]] },
      { say: 'Switch the meters to voltages: the whole top wire reads 12 V — one node, one voltage.', reads: [['v.in', 12]] },
    ],
    why:
      'A voltage source is a device that holds a fixed voltage E between its two terminals and supplies whatever current ' +
      'that takes. A resistor is a device whose current is proportional to the voltage across it: i = v/R (Ohm’s law). ' +
      'Wire the two together and the source decides the voltage, the resistor decides the current. Turn R down and the ' +
      'current climbs while the source’s voltage does not move by a microvolt — that is what “source” means. The ideal ' +
      'wires between them have no voltage across them at all: the whole top wire is one node — one point, electrically — ' +
      'and it reads E everywhere.',
  },
  a2: {
    see:
      'The other kind of source: this one holds its current, 5 mA, and lets the circuit decide the voltage. ' +
      'Into 1 kΩ that is 5 V — Ohm’s law read the other way, v = I·R.',
    seeReads: [['volt.R1', 5]],
    try: [
      { say: 'Push R up to 1 MΩ: 5 mA now needs 5 kV across the resistor, and the source supplies it.', set: { R1: 1e6 }, reads: [['volt.R1', 5000], ['i.R1', 0.005]] },
      { say: 'Open the switch: 5 mA has nowhere to go, no voltage is large enough, and the solver refuses the circuit and says why.', set: { open: true }, refuses: true },
      { say: 'Drop R to 10 Ω: the voltage falls to 50 mV; the current still reads 5 mA.', set: { R1: 10 }, reads: [['volt.R1', 0.05], ['i.R1', 0.005]] },
    ],
    why:
      'A current source pushes a fixed current I through itself and lets the circuit decide what voltage that takes: turn ' +
      'R up and the voltage climbs, the current does not. An ideal current source is never left unconnected — there is no ' +
      'voltage large enough. Voltage sources are the familiar kind — batteries, supplies — but current sources are how ' +
      'transistors behave, and Group E’s op-amps lean on them.',
  },
  a3: {
    see:
      'Node voltages are measured from the node with the ground symbol, which reads zero. The chain here sits on ' +
      'V_ref = 5 V, so its nodes read 17 V and 13 V — but the resistors see 4 V and 8 V, the same as if V_ref were zero.',
    seeReads: [['v.in', 17], ['v.A', 13], ['volt.R1', 4], ['volt.R2', 8]],
    try: [
      { say: 'Set V_ref to 0 V: every node voltage drops by 5 V; every element voltage and current stays put.', set: { Vref: 0 }, reads: [['v.in', 12], ['v.A', 8], ['volt.R1', 4], ['i.R1', 0.004]] },
      { say: 'Take V_ref to −10 V: the nodes go negative — in reads 2 V, A reads −2 V — and nothing through the resistors changes.', set: { Vref: -10 }, reads: [['v.in', 2], ['v.A', -2], ['i.R1', 0.004]] },
      { say: 'Switch the meters to currents: V_ref carries 0 A. It is renaming zero, not doing anything.', reads: [['i.V0', 0]] },
    ],
    why:
      'A voltage is never a property of one point. It is always the difference between two, and a meter has two probes for ' +
      'that reason. The solver — like a meter’s black lead — takes the ground node as zero, and that choice is free. Slide ' +
      'V_ref and every node voltage moves by exactly that amount, while every element’s voltage and every current stays ' +
      'put, because an element only ever sees the difference across its own two terminals.',
  },
  a4: {
    see:
      'Every element has two terminals, and one must be called + before any number can be written. The resistor’s + is ' +
      'its left end: with E₁ = 12 V and E₂ = 5 V its voltage is 7 V, its current 7 mA flowing in at +, its power 49 mW — absorbed.',
    seeReads: [['volt.R1', 7], ['i.R1', 0.007], ['p.R1', 0.049]],
    try: [
      { say: 'Raise E₂ to 15 V: v = −3 V and i = −3 mA, both negative together — switch the meters to currents and the arrow has reversed — while p = 9 mW stays positive.', set: { E2: 15 }, reads: [['volt.R1', -3], ['i.R1', -0.003], ['p.R1', 0.009]] },
      { say: 'Switch to powers: the source doing the pushing shows −84 mW. Its current leaves its + terminal, so its power comes out negative: it delivers.', reads: [['p.V1', -0.084]] },
    ],
    why:
      'The + label is a choice you make, not a fact about the element. Then two rules, always: the element’s voltage is ' +
      'v = (voltage at +) − (voltage at −), and its current i is measured flowing IN at the + terminal. A resistor’s v and i ' +
      'always share a sign, so its power p = v·i is positive: a resistor only ever absorbs. A negative reading is not an ' +
      'error; it is the answer, with its direction attached.',
  },
  b1: {
    see:
      'Kirchhoff’s current law: charge does not pile up at a junction, so whatever current arrives at node A leaves it. ' +
      '5.45 mA arrives through R₁ and leaves as 3.27 mA through R₂ and 2.18 mA through R₃.',
    seeReads: [['i.R1', 0.0054545], ['i.R2', 0.0032727], ['i.R3', 0.0021818]],
    try: [
      { say: 'Make R₂ tiny — 10 Ω: R₁ now carries 11.9 mA, R₂ takes 11.8 mA of it and R₃ only 39.5 µA. The sum has not moved from what arrives.', set: { R2: 10 }, reads: [['i.R1', 0.011882], ['i.R2', 0.011842], ['i.R3', 0.0000395]] },
      { say: 'Push R₃ to 1 MΩ: it all but leaves the circuit, and R₂ takes 4.00 mA of the 4.01 mA arriving; R₃ 8.0 µA.', set: { R3: 1e6 }, reads: [['i.R1', 0.004005], ['i.R2', 0.003997], ['i.R3', 0.000008]] },
    ],
    why:
      'The arrows are the actual directions and the numbers are the actual amounts — R₁ carries exactly what R₂ and R₃ ' +
      'carry between them, however you set the three. Open the Equations view: the KCL row at A lists each term with its ' +
      'live value, and the sum is zero.',
  },
  b2: {
    see:
      'Kirchhoff’s voltage law: go once around a closed path adding rises and subtracting drops and the total is zero. ' +
      'The source lifts by 12 V; R₁ drops 4 V and R₂ drops 8 V — 12 − 4 − 8 = 0.',
    seeReads: [['volt.R1', 4], ['volt.R2', 8]],
    try: [
      { say: 'Make R₁ 2 kΩ, equal to R₂: the drops become 6 V and 6 V. The same current flows through both, so the split follows the resistances.', set: { R1: 2000 }, reads: [['volt.R1', 6], ['volt.R2', 6]] },
      { say: 'Drop E to 5 V: the resistors drop 1.67 V and 3.33 V — the proportion holds, and the total is still the source.', set: { E: 5 }, reads: [['volt.R1', 1.6667], ['volt.R2', 3.3333]] },
    ],
    why:
      'The source lifts by E and the two resistors drop it all again, in proportion to their resistance because the same ' +
      'current flows through both. The + marks show which end of each element is measured as positive; the Equations view ' +
      'writes the loop out with live values.',
  },
  b3: {
    see:
      'Every element’s power is v × i with the current measured into its + terminal. R₁ absorbs 4 mW, R₂ 8 mW and R₃ ' +
      '12 mW; the source shows −24 mW. Negative means it delivers, and the four add to exactly zero.',
    seeReads: [['p.R1', 0.004], ['p.R2', 0.008], ['p.R3', 0.012], ['p.V1', -0.024]],
    try: [
      { say: 'Set R₃ to 500 Ω: the current rises to 3.43 mA; R₁ now takes 11.8 mW, R₂ 23.5 mW, R₃ 5.88 mW and the source −41.1 mW — still summing to zero.', set: { R3: 500 }, reads: [['i.R1', 0.0034286], ['p.R1', 0.011755], ['p.R2', 0.02351], ['p.R3', 0.005878], ['p.V1', -0.041143]] },
      { say: 'Open the Power view: the delivered bar and the absorbed bar are the same length, element by element.' },
    ],
    why:
      'This is the passive sign convention. A resistor’s current always enters at its higher-voltage end, so its power is ' +
      'positive: it absorbs. The source’s current leaves its + terminal, so its power comes out negative: it delivers. The ' +
      'negative sign is not a mistake to hide; it is the bookkeeping that makes every power in the circuit add to exactly zero.',
  },
  b4: {
    see:
      'Two batteries facing the same way with a resistor between. The current, 30 mA, is set by the difference of the two ' +
      'voltages over R and flows from the stronger source into the weaker — which shows +270 mW: it is being charged.',
    seeReads: [['i.R1', 0.03], ['p.V2', 0.27]],
    try: [
      { say: 'Raise E₂ to 15 V: the current turns round, −30 mA, and the roles swap — E₂ now delivers (−450 mW) and E₁ absorbs (+360 mW).', set: { E2: 15 }, reads: [['i.R1', -0.03], ['p.V2', -0.45], ['p.V1', 0.36]] },
      { say: 'Set E₂ equal to E₁, 12 V: no difference, no current, nothing happens at all.', set: { E2: 12 }, reads: [['i.R1', 0]] },
    ],
    why:
      'The current is (E₁ − E₂)/R, and its sign says which way it flows. Nothing in the algebra changes when E₂ passes E₁; ' +
      'only a sign does, and the sign is the answer.',
  },
  c1: {
    see:
      'Elements in series carry one current, so their resistances add and they split the voltage in proportion: 2 V, 4 V ' +
      'and 6 V across 1, 2 and 3 kΩ. This is the voltage divider — KVL plus Ohm’s law, nothing more.',
    seeReads: [['volt.R1', 2], ['volt.R2', 4], ['volt.R3', 6]],
    try: [
      { say: 'Make R₃ ten times the others — 30 kΩ: it takes 10.9 V of the 12 V, nearly all of it.', set: { R3: 30000 }, reads: [['volt.R3', 10.909]] },
      { say: 'Make R₃ nearly a wire — 1 Ω: it drops 4 mV, and the other two share the source in their 1 : 2 ratio, 4 V and 8 V.', set: { R3: 1 }, reads: [['volt.R3', 0.004], ['volt.R1', 4.0], ['volt.R2', 8.0]] },
    ],
    why:
      'v_k = E · R_k / (R₁ + R₂ + R₃). The same current through every element, each drop proportional to its own resistance, ' +
      'and the drops summing to E: that is all a divider is.',
  },
  c2: {
    see:
      'Elements in parallel share one voltage, so their conductances add and the current splits in proportion to 1/R: ' +
      '12 mA, 6 mA and 4 mA, 22 mA in all from the source. The smallest resistor takes the biggest share.',
    seeReads: [['i.R1', 0.012], ['i.R2', 0.006], ['i.R3', 0.004], ['i.V1', -0.022]],
    try: [
      { say: 'Drop R₁ to 100 Ω: it takes 120 mA and the source total jumps to 130 mA; the other two still take 6 mA and 4 mA — they never noticed.', set: { R1: 100 }, reads: [['i.R1', 0.12], ['i.V1', -0.13], ['i.R2', 0.006], ['i.R3', 0.004]] },
      { say: 'Push R₂ to 1 MΩ: it takes 12 µA and has all but left; the source total falls to 16.0 mA.', set: { R2: 1e6 }, reads: [['i.R2', 0.000012], ['i.V1', -0.01601]] },
    ],
    why:
      '1/R_eq = 1/R₁ + 1/R₂ + 1/R₃. The equivalent is always smaller than the smallest branch, and the total current from ' +
      'the source is E divided by it.',
  },
  c3: {
    see:
      'The divider formula E·R₂/(R₁+R₂) says 6 V. With a 10 kΩ load hung across the output it reads 5.71 V: the load ' +
      'sits in parallel with R₂ and pulls the output down. The load sweep draws the droop against R_L.',
    seeReads: [['thevenin.voc', 6], ['v.A', 5.7143]],
    try: [
      { say: 'Load it with 1 kΩ, equal to R₂: the output falls to 4 V — a third of the way to nothing.', set: { RL: 1000 }, reads: [['v.A', 4]] },
      { say: 'Push R_L to 1 MΩ: 6.00 V, the formula’s value. The droop is small only while the load is much larger than R₂.', set: { RL: 1e6 }, reads: [['v.A', 5.997]] },
    ],
    why:
      'The unloaded formula is true only with nothing connected. Loaded, the output is E·(R₂∥R_L)/(R₁ + R₂∥R_L) — which ' +
      'is the real reason dividers are built from small resistors, and why, in E8, an op-amp buffer fixes this completely.',
  },
  c4: {
    see:
      'Two dividers side by side, the output read between their midpoints. With R₄ = 1010 Ω against 1000 Ω the bridge is ' +
      '24.9 mV off balance: a tiny resistance change became a voltage you can read.',
    seeReads: [['vd.R.L', 0.024876]],
    try: [
      { say: 'Set R₄ to 1000 Ω: all four equal, both midpoints at 5 V, output exactly 0 V — balanced.', set: { R4: 1000 }, reads: [['v.L', 5], ['v.R', 5], ['vd.R.L', 0]] },
      { say: 'Double E to 20 V with R₄ still 1010 Ω and the output doubles to 49.8 mV; balance the bridge and it stays zero whatever the supply does.', set: { E: 20 }, reads: [['vd.R.L', 0.049751]] },
      { say: 'Nudge R₄ to 1100 Ω: 238 mV — about E/4 per unit of fractional change, until the change stops being small.', set: { R4: 1100 }, reads: [['vd.R.L', 0.2381]] },
    ],
    why:
      'When R₁/R₂ = R₃/R₄ the two midpoints sit at the same voltage and the output is exactly zero — balanced, and it ' +
      'stays balanced whatever the supply does. A bridge turns a small resistance change into a voltage, which is how ' +
      'strain gauges and thermistors are read out. Textbooks draw it as a diamond, the supply across the top and bottom ' +
      'corners and the output across the left and right; it is drawn here as two dividers side by side so that each ' +
      'half is visibly B2’s loop — two resistors in series, read at the midpoint — the same four resistors, the same two midpoints.',
  },
  d1: {
    see:
      'Pick a ground, name the other node voltages, and write KCL at each in terms of them: every resistor’s current ' +
      'is (its two node voltages apart)/R. Here there is one unknown, V_A = 6.55 V, and one equation — the Equations view ' +
      'shows it, each term with its live value.',
    seeReads: [['v.A', 6.5455]],
    try: [
      { say: 'Push R₁ to 1 MΩ: node A is nearly cut off from the source and V_A falls to 14.4 mV.', set: { R1: 1e6 }, reads: [['v.A', 0.014383]] },
      { say: 'Push R₂ and R₃ both to 1 MΩ: nothing is left to pull A down and it reads 12.0 V — the source’s own voltage.', set: { R2: 1e6, R3: 1e6 }, reads: [['v.A', 11.976]] },
    ],
    why:
      'That is the whole method, and every experiment in this lab is solved this way. The closed form falls out at once: ' +
      'V_A = (E/R₁)/(1/R₁ + 1/R₂ + 1/R₃).',
  },
  d2: {
    see:
      'A voltage source between nodes A and B fixes their difference, E₂ = 4 V, but says nothing about the current ' +
      'through itself: KCL at A and at B each contain an unknown current. A and B read 7.27 V and 3.27 V — 4 V apart, as promised.',
    seeReads: [['v.A', 7.2727], ['v.B', 3.2727]],
    try: [
      { say: 'Set E₂ to 0 V: A and B become one node at 6.55 V, the nodal experiment’s answer.', set: { E2: 0 }, reads: [['v.A', 6.5455], ['v.B', 6.5455]] },
      { say: 'Flip E₂ to −4 V: B now sits 4 V above A — 9.82 V against 5.82 V — and the source current reverses.', set: { E2: -4 }, reads: [['v.B', 9.8182], ['v.A', 5.8182]] },
    ],
    why:
      'The textbook fix is a supernode: add the two KCL equations so that current cancels, then use V_A − V_B = E₂ as the ' +
      'second equation. The matrix method does the same thing without the trick: it keeps the source current as an extra ' +
      'unknown and adds the constraint as an extra row. Below, the printed system has five unknowns: the three node ' +
      'voltages (in, A, B) and the current through each of the two sources.',
  },
  d3: {
    see:
      'The other method: give each window of the circuit a circulating current and write KVL around it. Two meshes, two ' +
      'unknowns: i₁ = 6 mA round the left loop, i₂ = 3 mA round the right, and the shared R₂ carries their difference, 3 mA.',
    seeReads: [['i.R1', 0.006], ['i.R3', 0.003], ['i.R2', 0.003]],
    try: [
      { say: 'Set E₂ to 8 V — R₂’s share of E₁ — and i₂ is exactly 0 A: the right loop carries nothing.', set: { E2: 8 }, reads: [['i.R3', 0]] },
      { say: 'Raise E₂ to 10 V and i₂ goes negative, −1.2 mA: the right-hand loop runs the other way.', set: { E2: 10 }, reads: [['i.R3', -0.0012]] },
    ],
    why:
      'E₁ = R₁i₁ + R₂(i₁ − i₂) and 0 = R₃i₂ + E₂ + R₂(i₂ − i₁). Solve the 2×2 by hand and the currents match the nodal ' +
      'solution exactly — two methods, one circuit, one answer.',
  },
  d4: {
    see:
      'In a linear circuit the response to several sources is the sum of the responses to each alone. Node A reads 8.5 V: ' +
      '6 V from E₁ with the current source removed, plus 2.5 V from I₁ with the voltage source shorted. The Superposition ' +
      'view runs both halves and adds them.',
    seeReads: [['v.A', 8.5], [(x) => x.superposition.parts.find((q) => q.id === 'V1').sol.v.A, 6], [(x) => x.superposition.parts.find((q) => q.id === 'I1').sol.v.A, 2.5]],
    try: [
      { say: 'Turn I₁ off (0 A): A reads 6 V — the voltage source alone, a plain divider.', set: { I1: 0 }, reads: [['v.A', 6]] },
      { say: 'Set E₁ to 0 V instead: A reads 2.5 V — 5 mA into the two resistors in parallel.', set: { E1: 0 }, reads: [['v.A', 2.5]] },
      { say: 'Switch the meters to powers: R₂ absorbs 72.3 mW, far more than the two halves’ powers added — power does not add.', reads: [['p.R2', 0.07225]] },
    ],
    why:
      'Setting a source to zero means a voltage source becomes a wire and a current source a gap. Every voltage and current ' +
      'is solved once per source and summed, and the sums match the full solution to the last digit. POWER does not add: ' +
      'i² has a cross term 2·i₁·i₂ that the two half-solutions never see. Superposition is a statement about linear quantities only.',
  },
  d5: {
    see:
      'Seen from any two terminals, a linear circuit is indistinguishable from one source in series with one resistor. ' +
      'From node A this one is V_th = 6.55 V behind R_th = 545 Ω. The Thévenin view finds that resistor three ways, and they agree.',
    seeReads: [['thevenin.voc', 6.5455], ['thevenin.rth', 545.45]],
    try: [
      { say: 'Push R₁ to 1 MΩ: V_th collapses to 14.4 mV and R_th becomes R₂∥R₃ = 1.2 kΩ — the source is barely connected.', set: { R1: 1e6 }, reads: [['thevenin.voc', 0.014383], ['thevenin.rth', 1198.6]] },
      { say: 'Remove the two shunts (1 MΩ each): V_th → 12.0 V and R_th → 1 kΩ, R₁ alone.', set: { R2: 1e6, R3: 1e6 }, reads: [['thevenin.voc', 11.976], ['thevenin.rth', 998]] },
    ],
    why:
      'Three ways to find R_th: divide the open-circuit voltage by the short-circuit current; kill the sources and push a ' +
      'test current in, reading the volts; or hang several loads and fit the straight line through the (i, v) points. All three run ' +
      'live below — R_th = R₁∥R₂∥R₃ here — and the load line’s intercepts are V_oc and I_sc.',
  },
  d6: {
    see:
      'A source with internal resistance R_s delivers the most power to a load when R_L = R_s: 72 mW here, with 12 V ' +
      'behind 500 Ω into 500 Ω — and exactly half the power lost inside the source. The sweep draws load power against R_L.',
    seeReads: [['p.RL', 0.072]],
    try: [
      { say: 'Slide R_L to 2 kΩ: the load power falls to 46.1 mW, but the efficiency climbs to 80 %.', set: { RL: 2000 }, reads: [['p.RL', 0.04608], [(x) => (100 * x.sol.p.RL) / -x.sol.p.V1, 80]] },
      { say: 'Drop R_L to 100 Ω: 40 mW, and only 16.7 % of what the source produces reaches the load.', set: { RL: 100 }, reads: [['p.RL', 0.04], [(x) => (100 * x.sol.p.RL) / -x.sol.p.V1, 16.667]] },
    ],
    why:
      'P = E²R_L/(R_s+R_L)² peaks at E²/4R_s. At that point the efficiency is one half, and it keeps climbing toward one as ' +
      'R_L grows while the power falls — which is why radio receivers are matched to their antennas and power grids are not.',
  },
  e1: {
    see:
      'A dependent source’s value is set by a voltage somewhere else: this one produces v_out = A·v_in = 5 V whatever load ' +
      'it drives. It delivers 25 mW to the load while the input source works at 25 µW — a thousand times less.',
    seeReads: [['volt.E1', 5], ['p.RL', 0.025], ['p.V1', -0.000025]],
    try: [
      { say: 'Turn A up to 100: 50 V out, 2.5 W into the load, from the same 25 µW of input.', set: { A: 100 }, reads: [['volt.E1', 50], ['p.RL', 2.5], ['p.V1', -0.000025]] },
      { say: 'Load it with 10 Ω: still 5 V, now 2.5 W — the source holds its voltage into any load.', set: { RL: 10 }, reads: [['volt.E1', 5], ['p.RL', 2.5]] },
    ],
    why:
      'This is a voltage-controlled voltage source, the first element here that can deliver more power than it takes in: ' +
      'its power is negative while the input source barely works at all. That energy comes from a supply the symbol does ' +
      'not show, which is exactly what an op-amp (E2) is.',
  },
  e2: {
    see:
      'An op-amp, from outside: a resistance R_in between its inputs, a source producing A times the input difference, ' +
      'and R_out in series with the output. 10 mV in becomes 9.43 V across the load; the divider R_in/(R_s + R_in) costs ' +
      'a little at the input and R_out/(R_out + R_L) a little at the output.',
    seeReads: [['v.out', 9.4295]],
    try: [
      { say: 'Drop R_in to 10 kΩ, equal to R_s: the input divider now takes half the signal, v₊ = 5 mV, and the output falls to 4.76 V.', set: { Rin: 10000 }, reads: [['v.p', 0.005], ['v.out', 4.7619]] },
      { say: 'Set R_out to 1 Ω: the output holds 9.89 V into the 1 kΩ load.', set: { Rout: 1 }, reads: [['v.out', 9.891]] },
      { say: 'Switch to powers: the load takes 88.9 mW; the source supplies 99 pW. A resistor network could only divide what it is given.', reads: [['p.RL', 0.08892], ['p.V1', -9.9e-11]] },
    ],
    why:
      'An operational amplifier is a packaged circuit of a few dozen transistors — active devices, powered from supply pins ' +
      'the symbol never shows — that behaves, from outside, like this box. Nothing else about the inside matters to a ' +
      'circuit designer, which is the point of a black box. The IDEAL op-amp has A = ∞, R_in = ∞ (its inputs draw no ' +
      'current), R_out = 0 (its output holds its voltage into any load), no offset and no speed limit; a real one has ' +
      'A ≈ 10⁵, R_in from 1 MΩ to 10¹² Ω, R_out of tens of ohms. The ideal recovers as the knobs go to their limits.',
  },
  e3: {
    see:
      'An op-amp with nothing connecting its output back to an input. Ideal — A = ∞ — it has no solution at all: ' +
      'infinity times anything. The solver refuses and says why.',
    seeRefuses: true,
    try: [
      { say: 'Switch the op-amp to finite gain, A = 10⁵: 1 mV in, 100 V out — finite but absurd. A real op-amp would stop at its supply rails.', set: { ideal: false, A: 100000 }, reads: [['v.out', 100]] },
      { say: 'Flip E to −1 mV with A = 10⁵: −100 V. The tiniest difference decides the sign — that is a comparator.', set: { ideal: false, A: 100000, E: -0.001 }, reads: [['v.out', -100]] },
    ],
    why:
      'An op-amp is a dependent source with an enormous gain: v_out = A·(v₊ − v₋). Without feedback the ideal one has ' +
      'nothing to hold its output finite. A real op-amp saturates at its supply rails; that saturation is the comparator’s ' +
      'job, and it lies outside what this linear solver can draw.',
  },
  e4: {
    see:
      'Connect the output back to the − input through a divider and the huge gain works for you: v_out = G·E/(1 + G/A) ' +
      'with G = 1 + R_f/R_g = 10. With A = 1000 the output is 9.90 V, and the op-amp holds only 9.9 mV between its inputs.',
    seeReads: [['v.out', 9.901], ['vd.in.n', 0.0099]],
    try: [
      { say: 'Turn A up to 10⁶: 9.9999 V — the gain converges on G, and the input difference falls to 10 µV.', set: { A: 1e6 }, reads: [['v.out', 9.9999], ['vd.in.n', 0.00001]] },
      { say: 'Drop A to 10: the output is only 5 V. The gain you built is 10, but the op-amp’s own gain is no longer huge next to it.', set: { A: 10 }, reads: [['v.out', 5]] },
    ],
    why:
      'The op-amp only has to hold v₊ − v₋ = v_out/A across its inputs. As A → ∞ that difference → 0 and v_out → G·E: the ' +
      'two “golden rules” (no input current, equal input voltages) are not axioms but the limit of this formula.',
  },
  e5: {
    see:
      'Ground the + input and feed the signal into the − input through R_g, with R_f back from the output. The − input ' +
      'sits at 0 V without being wired to ground — a virtual ground — so the input current is E/R_g = 0.5 mA, all of it ' +
      'flows on through R_f, and v_out = −(R_f/R_g)·E = −5 V.',
    seeReads: [['v.n', 0], ['i.Rg', 0.0005], ['v.out', -5]],
    try: [
      { say: 'Double R_f to 20 kΩ: −10 V. The gain is the ratio of two resistors and nothing else.', set: { Rf: 20000 }, reads: [['v.out', -10]] },
      { say: 'Load the output with 100 Ω: still −5 V, and the 50 mA it takes comes from the op-amp, not from the source, which still supplies 0.5 mA.', set: { RL: 100 }, reads: [['v.out', -5], ['i.RL', -0.05], ['i.V1', -0.0005]] },
    ],
    why:
      'The golden rules make the − input follow the grounded + input, and since no current enters the op-amp everything ' +
      'through R_g continues through R_f. The source sees a load of exactly R_g; the output current comes from the op-amp.',
  },
  e6: {
    see:
      'Two inputs into the same virtual ground. Because that node is held at 0 V, each input current is set by its own ' +
      'resistor alone — 100 µA and 100 µA here — and KCL sends the sum, 200 µA, through R_f: v_out = −R_f(E₁/R₁ + E₂/R₂) = −2 V.',
    seeReads: [['v.n', 0], ['i.R1', 0.0001], ['i.R2', 0.0001], ['i.Rf', 0.0002], ['v.out', -2]],
    try: [
      { say: 'Set E₂ to 0 V: the output is −1 V, E₁’s share alone. Put E₂ back and its share adds — the inputs never see each other.', set: { E2: 0 }, reads: [['v.out', -1]] },
      { say: 'Set R₂ to 10 kΩ, equal to R₁: the weights become equal and v_out = −(1 + 2) V = −3 V.', set: { R2: 10000 }, reads: [['v.out', -3]] },
    ],
    why:
      'The virtual ground is what makes addition possible without interaction. Weighted by the resistor ratios, this is a ' +
      'digital-to-analogue converter waiting to happen.',
  },
  e7: {
    see:
      'Four resistors, two inputs, one output. With R₃/R₄ matched to R₁/R₂ the output is (R₂/R₁)(E₂ − E₁): ten times the ' +
      'difference between 1.2 V and 1 V, so 2 V out, while the 1 V common to both inputs is rejected entirely.',
    seeReads: [['v.out', 2]],
    try: [
      { say: 'Set E₁ = E₂ = 1.2 V: 0 V out. A signal common to both inputs does not get through.', set: { E1: 1.2 }, reads: [['v.out', 0]] },
      { say: 'Now mismatch R₄ by one part in a hundred — 10.1 kΩ — with E₁ = E₂ = 1.2 V: 10.8 mV of common-mode input leaks through.', set: { E1: 1.2, R4: 10100 }, reads: [['v.out', 0.010811]] },
    ],
    why:
      'That ratio, differential gain over common-mode gain, is the CMRR, and it is set by resistor matching, not by the op-amp.',
  },
  e8: {
    see:
      'C3’s divider drooped under load. Put a unity-gain buffer between them — output wired straight back to the − input — ' +
      'and the divider sees no load while the load sees a source with zero resistance: 6 V into 100 Ω, the unloaded ' +
      'divider voltage, with the 60 mA coming from the op-amp.',
    seeReads: [['v.out', 6], ['i.RL', 0.06]],
    try: [
      { say: 'Drop R_L to 10 Ω: still 6.00 V, now 600 mA from the op-amp; the divider still carries its own 6 mA.', set: { RL: 10 }, reads: [['v.out', 6], ['i.RL', 0.6], ['i.R1', 0.006]] },
      { say: 'Open the Load sweep: the line is flat. Compare the same sweep in C3.' },
    ],
    why:
      'The op-amp input draws nothing, so the output is the UNLOADED divider voltage E·R₂/(R₁+R₂) whatever R_L is; the ' +
      'load current comes from the op-amp.',
  },
  f1: {
    see:
      'A capacitor’s current is proportional to how fast its voltage is changing, i = C·dv/dt, not to the voltage. The ' +
      'triangle here climbs at a steady 4·A/T, so the current is a square wave, ±20 mA, flat while the voltage climbs and ' +
      'flipping sign the instant the slope does.',
    seeReads: [['i.C1', 0.02]],
    whyReads: [[(x, p) => p.Rs * p.C1, 0.00001]],
    try: [
      { say: 'Double the amplitude to 10 V: the slope doubles and so does the current, ±40 mA.', set: { A: 10 }, reads: [['i.C1', 0.04]] },
      { say: 'Double the period to 2 ms: the same swing takes twice as long, the slope halves, and the current halves to ±10 mA.', set: { T: 0.002 }, reads: [['i.C1', 0.01]] },
      { say: 'Double C to 2 µF: double the current, ±40 mA, for the same voltage.', set: { C1: 2e-6 }, reads: [['i.C1', 0.04]] },
    ],
    why:
      'A capacitor stores charge, q = C·v, and current is charge per second. The small series R_s is there because an ideal ' +
      'source wired straight to an ideal capacitor would have to supply infinite current at the corners; with it the ' +
      'capacitor voltage lags the source by τ = R_sC = 10 µs and the current settles onto its plateau in the same time. ' +
      'Scrub the cursor: the schematic at each instant is an ordinary resistive circuit with the capacitor standing in as ' +
      'a voltage source at its present voltage — its state, the one number it carries forward — and that is exactly how ' +
      'the solver sees it.',
  },
  f2: {
    see:
      'The dual. An inductor’s voltage is the slope of its current, v = L·di/dt. Push a triangle current through it and ' +
      'the voltage is a square wave, ±0.4 V, flat while the current ramps and flipping when the ramp does.',
    seeReads: [['volt.L1', 0.4]],
    whyReads: [[(x, p) => p.L1 / p.Rp, 0.000001]],
    try: [
      { say: 'Double L to 20 mH: ±0.8 V for the same current.', set: { L1: 0.02 }, reads: [['volt.L1', 0.8]] },
      { say: 'Halve the period to 0.5 ms: the ramp is twice as steep and the voltage doubles to ±0.8 V.', set: { T: 0.0005 }, reads: [['volt.L1', 0.8]] },
    ],
    why:
      'An inductor stores flux, λ = L·i, and voltage is flux per second. The parallel R_p plays the role R_s played in F1: ' +
      'an ideal current source into an ideal inductor would need infinite voltage at each corner, and with R_p the inductor ' +
      'current lags the source by τ = L/R_p = 1 µs. Swap v for i (the state that cannot jump is now the current), C for L, ' +
      'series for parallel, and F1 turns into this experiment word for word — that swap has a name, duality, and it runs ' +
      'through the whole group.',
  },
  f3: {
    see:
      'Close the switch at t = 0 and the capacitor does not jump to 12 V: its voltage is a state, and a state cannot ' +
      'change instantly. It climbs as E(1 − e^(−t/τ)) with τ = RC = 1 ms; at the cursor, one τ in, it has covered ' +
      '63.2 % of the way: 7.59 V.',
    seeReads: [['state.tau', 0.001], ['volt.C1', 7.5854], [(x, p) => (100 * x.sol.volt.C1) / p.E, 63.21]],
    try: [
      { say: 'Drag the cursor to 5 ms, five time constants: 99.3 % of the way, 11.92 V.', at: 0.005, reads: [['volt.C1', 11.919], [(x, p) => (100 * x.sol.volt.C1) / p.E, 99.33]] },
      { say: 'Double R to 2 kΩ: τ doubles to 2 ms; the window stretches with it and the picture does not change shape.', set: { R1: 2000 }, reads: [['state.tau', 0.002]] },
      { say: 'Give the capacitor an initial value, v_C(0) = 6 V: the same curve, closing the same 63.2 % of a smaller gap — 9.79 V at one τ.', set: { v0: 6 }, reads: [['volt.C1', 9.7927], [(x, p) => (100 * (x.sol.volt.C1 - p.v0)) / (p.E - p.v0), 63.21]] },
      { say: 'Put the cursor at the start: the current is (E − v₀)/R = 12 mA — an uncharged capacitor looks like a short.', at: 1e-6, reads: [['i.R1', 0.012]] },
    ],
    why:
      'KVL round the loop gives E = R·i + v_C with i = C·dv_C/dt — a first-order differential equation, ' +
      'RC·dv_C/dt + v_C = E. Its solution is v_C(t) = E + (v₀ − E)e^(−t/τ): the gap to the final value shrinks by a ' +
      'factor e every time constant. The current starts at (E − v₀)/R the instant the switch closes and dies away with ' +
      'the same τ. Give v_C(0) a value and the same formula holds; only the starting point moves.',
  },
  f4: {
    see:
      'The capacitor sits behind a divider and a series resistor, and nothing in F3 seems to apply — until everything to ' +
      'its left is replaced by its Thévenin equivalent (D5): 8 V behind 1.17 kΩ. Then it IS F3, with τ = R_th·C = 1.17 ms.',
    seeReads: [['thevenin.voc', 8], ['thevenin.rth', 1166.7], ['state.tau', 0.0011667]],
    try: [
      { say: 'Push R₂ to 1 MΩ: the divider disappears, V_th → 12.0 V and R_th → R₁ + R₃ = 1.5 kΩ; τ = 1.5 ms.', set: { R2: 1e6 }, reads: [['thevenin.voc', 11.988], ['thevenin.rth', 1499], ['state.tau', 0.001499]] },
      { say: 'Put the cursor at the start: the empty capacitor is a short, so node A sees R₂∥R₃ and reads 3.43 V; it climbs to the divider’s 8 V as the charging current dies.', at: 1e-7, reads: [['v.A', 3.4286], ['thevenin.voc', 8]] },
    ],
    why:
      'Seen from the capacitor the network is a source V_th = E·R₂/(R₁+R₂) behind R_th = R₃ + R₁∥R₂, and then ' +
      'v_B(t) = V_th(1 − e^(−t/τ)) with τ = R_th·C. Every circuit with one capacitor is this circuit; the only work is ' +
      'finding V_th and R_th. Node A moves too, because the charging current passes through the divider.',
  },
  f5: {
    see:
      'Charging a capacitor from a fixed source through a resistor wastes exactly half the energy, and no choice of R can ' +
      'change that. By the end of the window the source has delivered C·E² = 144 µJ; the capacitor holds ½CE² = 72 µJ; ' +
      'the other 72 µJ is heat in the resistor.',
    seeAt: 0.01,
    seeReads: [['energy.supplied', 0.000144], ['energy.stored', 0.000072], ['energy.dissipated', 0.000072]],
    try: [
      { say: 'Try the 100 Ω chip and drag the cursor to the end, 1 ms: charged in a tenth of the time with ten times the current, and the resistor has still burned 72 µJ.', set: { R1: 100 }, at: 0.000999, reads: [['energy.dissipated', 0.000072]] },
      { say: 'The 10 kΩ chip, cursor at the end, 100 ms: a hundred times slower, a small current — and 72 µJ again.', set: { R1: 10000 }, at: 0.0999, reads: [['energy.dissipated', 0.000072]] },
      { say: 'Double E to 24 V: the loss quadruples to 288 µJ — half of the 576 µJ delivered — because it is ½CE² that is lost, not a fraction of R.', set: { E: 24 }, at: 0.00999, reads: [['energy.dissipated', 0.000288], ['energy.supplied', 0.000576]] },
    ],
    why:
      'A small R charges fast with a large current, a large R slowly with a small one, and the integral of i²R over the ' +
      'whole charge comes out the same — because the resistor’s energy is ∫(E − v_C)·i dt = ∫(E − v_C)·C dv_C, which ' +
      'depends only on where v_C starts and ends. The energy view stacks the three as the charge proceeds; after ten ' +
      'time constants the bars have all but stopped moving.',
  },
  f6: {
    see:
      'Before t = 0 the switch has been closed a long time; the inductor is a short at DC and carries 12 mA. Open the ' +
      'switch and that current has nowhere to go — but it is a state and cannot change instantly. Forced through the open ' +
      'switch’s 100 kΩ, it puts 1.2 kV across a gap that had no voltage across it an instant before.',
    seeAt: 1e-9,
    seeReads: [['i.L1', 0.012], ['volt.S1', 1200]],
    try: [
      { say: 'Flip the switch to ideal: the solver refuses, with a reason — di/dt would be infinite and so would the voltage.', set: { ideal: true }, refuses: true },
      { say: 'Make the open switch 1 MΩ: 12 kV. The better the switch, the bigger the spark — the reason relay coils get a diode across them.', set: { Roff: 1e6 }, at: 1e-9, reads: [['volt.S1', 12000]] },
      { say: 'The current then dies with τ = L/(R + R_off) = 9.9 µs — a hundred times faster than the L/R = 1 ms it took to build up.', reads: [['state.tau', 0.0000099], [(x, p) => p.L1 / p.R1, 0.001]] },
    ],
    why:
      'Something has to give, and the real answer is that an open switch is not infinite ohms: the moment it opens the ' +
      'full I₀ = E/R is forced through R_off, putting I₀·R_off across the gap. That is the spark.',
  },
  f7: {
    see:
      'Feedback through a capacitor instead of a resistor. The virtual ground (E5) holds n at 0 V, so the input current ' +
      'is v_in/R = 100 µA exactly and all of it flows into the capacitor: the output is the integral of the input. A ' +
      'square wave in gives a triangle out, swinging 0.25 V either side of zero.',
    seeReads: [['v.n', 0], ['i.R1', -0.0001], ['v.out', -0.25]],
    try: [
      { say: 'Double the input to 2 V: the slope doubles and the triangle grows to 0.5 V either side.', set: { A: 2 }, reads: [['v.out', -0.5]] },
      { say: 'Double C to 0.2 µF: the same current fills a bigger capacitor, and the triangle halves to 0.125 V.', set: { C1: 2e-7 }, reads: [['v.out', -0.125]] },
      { say: 'Flip the op-amp to finite gain (the Gain knob, 10⁵): the integrator becomes a very slow RC with τ = RC(A + 1) = 100 s — the leak every real integrator has.', set: { ideal: false }, reads: [['state.tau', 100.001]] },
    ],
    why:
      'C·dv_C/dt = v_in/R, and the output is −v_C, so dv_out/dt = −v_in/(RC): the output is the integral of the input, ' +
      'scaled by −1/RC. A square wave of amplitude A gives a triangle of A·T/(2RC) peak to peak. With finite gain the ' +
      'output heads for −A·v_in instead of integrating for ever.',
  },
  g1: {
    see:
      'Two states now — the capacitor’s voltage and the inductor’s current — and KVL round the loop becomes a second-order ' +
      'equation. Two numbers describe it: ω₀ = 1/√LC = 10 krad/s and α = R/2L. With R = 800 Ω, α = 40 krad/s > ω₀: the ' +
      'roots are real and the capacitor creeps up to E without overshoot.',
    seeReads: [['state.w0', 10000], ['state.alpha', 40000], ['state.face', 'overdamped']],
    try: [
      { say: 'Try the 200 Ω chip: α = 10 krad/s = ω₀ exactly, the roots merge — critical damping, the next experiment.', set: { R1: 200 }, reads: [['state.alpha', 10000], ['state.zeta', 1]] },
      { say: 'The 50 Ω chip: α = 2.5 krad/s < ω₀, the roots turn complex and the voltage rings past E.', set: { R1: 50 }, reads: [['state.alpha', 2500], ['state.face', 'underdamped']] },
      { say: 'Open the State equation view: dx/dt = A·x + B·u is the pair of first-order equations the solver actually writes, and its characteristic polynomial is the textbook one.' },
    ],
    why:
      'E = R·i + L·di/dt + v_C with i = C·dv_C/dt, so LC·v_C″ + RC·v_C′ + v_C = E. The solver never writes it that way; ' +
      'it writes dx/dt = A·x + B·u, whose characteristic polynomial det(sI − A) = s² + (R/L)s + 1/LC is the same equation. ' +
      'Overdamped, the roots are −1.27×10³ and −7.87×10⁴ s⁻¹ and the natural response — what the loop does on its own once ' +
      'E is applied — is two decaying exponentials of which the slow one sets the pace.',
  },
  g2: {
    see:
      'Lower R until α = ω₀ — R = 2√(L/C) = 200 Ω — and the two real roots merge into one, −10 krad/s, repeated. The ' +
      'response still never overshoots, but it is the fastest that does not (G3 measures that). Nothing in the circuit ' +
      'hints that 200 Ω is special; only the equation does.',
    seeReads: [['state.alpha', 10000], ['state.zeta', 1]],
    try: [
      { say: 'Drag the cursor to 100 µs, t = 1/α: the current is at its peak, E/(Lαe) = 3.68 mA.', at: 0.0001, reads: [['i.R1', 0.0036788]] },
      { say: 'A hair less resistance, 190 Ω, and the roots turn complex (ζ = 0.95); the capacitor voltage will cross E, if only by a hair.', set: { R1: 190 }, reads: [['state.zeta', 0.95], ['state.face', 'underdamped']] },
      { say: 'A hair more, 210 Ω: the roots split, ζ = 1.05, and the slow one slows the approach.', set: { R1: 210 }, reads: [['state.zeta', 1.05], ['state.face', 'overdamped']] },
    ],
    why:
      'v_C = E[1 − (1 + αt)e^(−αt)], and the current i = (E/L)·t·e^(−αt) peaks at t = 1/α.',
  },
  g3: {
    see:
      'Sweep R across its range and measure two things about the step: how far v_C overshoots E, and how long it takes ' +
      'to settle for good (within two per cent). Above 200 Ω there is no overshoot; below it the response rings. The sweep ' +
      'view draws both against R, with the marker at your R.',
    seeReads: [['damping.Rcrit', 200]],
    try: [
      { say: 'The 50 Ω chip: 44.4 % overshoot.', set: { R1: 50 }, reads: [[(x) => 100 * x.damping.at.overshoot, 44.43]] },
      { say: 'Set R to 160 Ω, a little below critical: 1.5 % of overshoot buys the shortest settling time of all — the first peak just fits inside the band.', set: { R1: 160 }, reads: [[(x) => 100 * x.damping.at.overshoot, 1.52]] },
      { say: 'The 800 Ω chip: no overshoot, but the slow root drags the settling out.', set: { R1: 800 }, reads: [[(x) => x.damping.at.overshoot, 0]] },
    ],
    why:
      'Above critical the settling time falls as R does, because the slow root −α + √(α² − ω₀²) speeds up. Below it the ' +
      'overshoot climbs — toward a full step’s worth at zero resistance — and the settling time first keeps falling and then climbs again ' +
      'as the ringing outlasts the decay. Critical damping is the fastest response with no overshoot; the fastest settling ' +
      'of all lies a little below it.',
  },
  g4: {
    see:
      'With R = 50 Ω, α = 2.5 krad/s < ω₀ and the roots are complex, −α ± jω_d with ω_d = 9.68 krad/s. The response rings ' +
      'at ω_d inside an envelope that shrinks as e^(−αt) — the dashed curves. The damping ratio ζ = α/ω₀ = 0.25 fixes the ' +
      'shape whatever the scale.',
    seeReads: [['state.alpha', 2500], ['state.wd', 9682.5], ['state.zeta', 0.25]],
    try: [
      { say: 'Drag the cursor to 324 µs, t = π/ω_d: the first peak, 44.4 % above the step at 1.444 V.', at: 0.0003245, reads: [['volt.C1', 1.4443], [(x, p) => (100 * (x.sol.volt.C1 - p.E)) / p.E, 44.43]] },
      { say: 'Halve R to 25 Ω: ζ = 0.125, the overshoot climbs to 67.3 % and the ringing lasts twice as long.', set: { R1: 25 }, reads: [['state.zeta', 0.125], [overshootPct('volt', 'C1', (p) => p.E), 67.3]] },
    ],
    why:
      'v_C = E[1 − e^(−αt)(cos ω_d t + (α/ω_d) sin ω_d t)] with ω_d = √(ω₀² − α²): it rings at ω_d, slightly slower than ' +
      'ω₀. The first peak overshoots by e^(−πζ/√(1−ζ²)) of the step and each following peak is that same fraction of the ' +
      'one before. Q = 1/2ζ says the same thing another way.',
  },
  g5: {
    see:
      'Take the resistor out entirely and α = 0: the roots are ±jω₀ and nothing decays. The capacitor voltage swings for ' +
      'ever between 0 and 2 V, overshooting the step by a full 100 %, and the current is 10 mA at its peaks. Nothing is ' +
      'dissipated, so every joule the source has delivered is still in the circuit, sloshing between L and C.',
    seeReads: [[peak('volt', 'C1'), 2], [overshootPct('volt', 'C1', (p) => p.E), 100], [peak('i', 'L1'), 0.01]],
    try: [
      { say: 'Drag the cursor to 314 µs, half a cycle in: the capacitor is at its 2 V peak, the current passes through zero, and the energy view shows all 2 µJ of it in C.', at: 0.00031416, reads: [['volt.C1', 2], ['i.L1', 0, 1e-6], ['energy.stored', 0.000002]] },
      { say: 'Now 157 µs, a quarter cycle: v_C = E = 1 V and the current is at its 10 mA peak. The inductor holds ½Li² = 0.5 µJ, exactly what the capacitor holds, ½Cv² = 0.5 µJ: 1 µJ stored, 1 µJ supplied.', at: 0.00015708, reads: [['volt.C1', 1], ['i.L1', 0.01], [(x, p) => 0.5 * p.L1 * x.sol.i.L1 ** 2, 5e-7], [(x, p) => 0.5 * p.C1 * x.sol.volt.C1 ** 2, 5e-7], ['energy.stored', 0.000001], ['energy.supplied', 0.000001]] },
      { say: 'Double the step to 2 V: the swing doubles, 0 to 4 V, and so does the current, 20 mA — the frequency, 1592 Hz, does not move.', set: { E: 2 }, reads: [[peak('volt', 'C1'), 4], [peak('i', 'L1'), 0.02], [(x) => x.state.w0 / (2 * Math.PI), 1591.5]] },
    ],
    why:
      'v_C = E(1 − cos ω₀t) and i = E√(C/L)·sin ω₀t. The capacitor holds ½Cv² when the voltage peaks and the inductor ' +
      '½Li² when the current does, a quarter cycle later, and the two together exactly equal what the source has supplied ' +
      'so far. No real circuit does this — every wire has resistance — but every real oscillator is this circuit with the ' +
      'losses made up.',
  },
  g6: {
    see:
      'The differential equation fixes the shape of the response; the initial conditions fix which response you get. ' +
      'A second-order circuit needs two — the capacitor’s voltage and the inductor’s current at t = 0 — because those ' +
      'are the two quantities that cannot jump. Here they are knobs: the dim traces are the response from rest (G4), ' +
      'the bright ones from v_C(0) = 2 V and i_L(0) = 5 mA.',
    try: [
      { say: 'Set both to zero: bright and dim traces coincide.', set: { v0: 0, i0: 0 }, reads: [[offGhost('volt', 'C1'), 0], [offGhost('i', 'L1'), 0]] },
      { say: 'Start the capacitor at 1 V, already at E, with no current: nothing needs to change, and nothing does — the trace is flat at 1 V.', set: { v0: 1, i0: 0 }, reads: [[(x, p) => Math.max(...x.tr.samples.map((s) => Math.abs(s.sol.volt.C1 - p.E))), 0], ['volt.C1', 1]] },
      { say: 'Cursor to the start: v_C = 2 V and i_L = 5 mA, exactly where the knobs said.', at: 1e-9, reads: [['volt.C1', 2], ['i.L1', 0.005]] },
      { say: 'Cursor to 3 ms: both traces have settled to the same place, 1 V across the capacitor and the current down to microamps, because the forced response is set by the source alone.', at: 0.003, reads: [['volt.C1', 1]] },
    ],
    why:
      'The difference between the two traces is a pure natural response, e^(−αt) times cosines and sines, with its ' +
      'amplitudes chosen so that it starts at exactly v_C(0) and i_L(0). The two traces differ by that natural response ' +
      'and by nothing else.',
  },
  g7: {
    see:
      'Swap every element for its dual — series for parallel, voltage source for current source, R for 1/R — and the ' +
      'equation is the same. The inductor current is the state that steps to 10 mA, overshooting by the same 44.4 % as ' +
      'v_C in series, while the node voltage rings and dies to zero. At R = 200 Ω, ζ = 0.25 — the series circuit’s smallest chip.',
    seeReads: [[overshootPct('i', 'L1', (p) => p.I), 44.43], ['state.zeta', 0.25]],
    try: [
      { say: 'The 50 Ω chip: α = 1/(2RC) = 10 krad/s = ω₀ — critical damping. In a parallel circuit the critical resistance is ½√(L/C) = 50 Ω, not 2√(L/C).', set: { R1: 50 }, reads: [['state.alpha', 10000], ['state.zeta', 1]] },
      { say: 'The 12.5 Ω chip: ζ = 4, overdamped — a SMALL R means heavy damping here, because the resistor is a leak across the tank, and a small leak resistance leaks more.', set: { R1: 12.5 }, reads: [['state.zeta', 4]] },
      { say: 'Push R to 1 MΩ: ζ = 0.00005, and the tank all but rings for ever — the parallel dual of taking the resistor out.', set: { R1: 1e6 }, reads: [['state.zeta', 0.00005]] },
    ],
    why:
      'KCL at the one node, I = v/R + C·dv/dt + i_L with v = L·di_L/dt, is the same second-order equation with ' +
      'α = 1/(2RC) in place of R/2L; ω₀ = 1/√LC does not change. In a parallel circuit a LARGE R means light damping.',
  },
  h1: {
    see:
      'Switch a sine on at t = 0 and the capacitor voltage is two things: a steady sinusoid at the drive frequency ' +
      '— the forced response, dashed — and a decaying exponential, there only because the forced sinusoid would not ' +
      'have started from zero. That exponential is the natural response, F3’s e^(−t/τ) with τ = RC = 1 ms; five time ' +
      'constants later the circuit has forgotten how it started.',
    seeReads: [['state.tau', 0.001]],
    try: [
      { say: 'Drag the cursor to 5 ms: the bright and dashed traces are already within 0.476 % of the forced amplitude of each other.', at: 0.005, reads: [[(x) => (100 * Math.abs(x.sol.volt.C1 - x.acAt.volt.C1)) / cx.cabs(x.ac.volt.C1), 0.476]] },
      { say: 'The 15.92 Hz chip: a period of 62.8 ms against τ = 1 ms — the natural part dies before the first cycle is a tenth done, and the capacitor voltage simply follows the source.', set: { f: 15.92 }, reads: [['period', 0.06283], ['state.tau', 0.001]] },
      { say: 'The 1592 Hz chip: the period, 0.628 ms, is shorter than τ = 1 ms, and the exponential now takes eight cycles to fade — while the forced sinusoid is small, 0.498 V, because the capacitor cannot follow.', set: { f: 1592 }, reads: [['period', 0.0006281], ['mag.volt.C1', 0.4975]] },
    ],
    why:
      'The natural response is −v_f(0)·e^(−t/τ): the source sets its size but not its shape. Everything the phasor views ' +
      '(H2 onward) say is about the steady state alone, once the natural part has died.',
  },
  h2: {
    see:
      'In the steady state every voltage and current is a sinusoid at the drive frequency, fixed by amplitude and phase ' +
      '— so each can be drawn as an arrow, and the height of its spinning tip traces the waveform. At the corner ' +
      'frequency f = 1/(2πRC) = 159.2 Hz the two voltage arrows are the same length, 3.54 V each, and v_C lags the ' +
      'source by exactly 45°.',
    seeReads: [[(x, p) => 1 / (2 * Math.PI * p.R1 * p.C1), 159.15], ['mag.volt.R1', 3.5355], ['mag.volt.C1', 3.5355], ['lead.volt.C1', -45]],
    whyReads: [[(x) => wrap((cx.carg(x.ac.i.R1) - cx.carg(x.ac.volt.C1)) * DEG), 90]],
    try: [
      { say: 'Drag the slider: V_R and V_C laid tip to tail always land on V_s — KVL, drawn.' },
      { say: 'The 15.92 Hz chip: the capacitor’s arrow grows to 4.98 V and swings to only 5.7° behind the source — at low frequency the capacitor has time to follow.', set: { f: 15.92 }, reads: [['mag.volt.C1', 4.975], ['lead.volt.C1', -5.71]] },
      { say: 'The 1592 Hz chip: 0.498 V and 84.3° behind — the current’s arrow, 90° ahead of V_C, now nearly lines up with the source.', set: { f: 1592 }, reads: [['mag.volt.C1', 0.4975], ['lead.volt.C1', -84.29], [(x) => wrap((cx.carg(x.ac.i.R1) - cx.carg(x.ac.volt.C1)) * DEG), 90]] },
    ],
    why:
      'Arrows add like the voltages they stand for, which is KVL. The capacitor’s arrow lies 90° behind the current’s, ' +
      'because i = C·dv/dt puts the current a quarter cycle ahead, and its length is |I|/ωC — the reactance 1/ωC plays the part of R.',
  },
  h3: {
    see:
      'With phasors a capacitor and an inductor obey Ohm’s law, V = Z·I, with Z_C = 1/jωC and Z_L = jωL. In series ' +
      'they add: Z = R + j(ωL − 1/ωC). At 1 kHz the inductor offers 62.8 Ω and the capacitor ' +
      '159.2 Ω; pointing opposite ways they partly cancel, |Z| = 138.8 Ω, and the current, 7.20 mA, leads the source by ' +
      '43.9° — the capacitor is winning.',
    seeReads: [[(x, p) => x.omega * p.L1, 62.83], [(x, p) => 1 / (x.omega * p.C1), 159.15], ['Z.mag', 138.85], ['mag.i.R1', 0.0072021], ['lead.i.R1', 43.93]],
    whyReads: [[(x, p) => 1 / (2 * Math.PI * Math.sqrt(p.L1 * p.C1)), 1591.55]],
    try: [
      { say: 'Read V_C from the arrows: 1.146 V, larger than the 1 V source — the inductor’s 0.453 V is subtracted from it, not added.', reads: [['mag.volt.C1', 1.1462], ['mag.volt.L1', 0.4525]] },
      { say: 'The 2500 Hz chip: now ωL = 157.1 Ω beats 1/ωC = 63.7 Ω, the current swings to lagging (43.1°) and the arrows for V_L and V_C trade lengths.', set: { f: 2500 }, reads: [[(x, p) => x.omega * p.L1, 157.08], [(x, p) => 1 / (x.omega * p.C1), 63.66], ['lead.i.R1', -43.05]] },
      { say: 'The 1591.5 Hz chip: the two reactances are equal, 100 Ω each, and cancel; Z is just R and the current, 10 mA, is in phase — the next experiment.', set: { f: 1591.5 }, reads: [[(x, p) => x.omega * p.L1, 100], [(x, p) => 1 / (x.omega * p.C1), 100], ['mag.i.R1', 0.01], ['lead.i.R1', 0, 0.01]] },
    ],
    why:
      'The current is V_s/Z — one complex division does the whole circuit. Raise the frequency past 1591.5 Hz and the ' +
      'inductor wins instead; the current swings to lagging.',
  },
  h4: {
    see:
      'At one frequency, ω₀ = 1/√LC, the inductor’s reactance equals the capacitor’s and their voltages cancel: ' +
      'the impedance collapses to plain R, and the current, 200 mA, is in phase with the source and at its largest. ' +
      'That is resonance, here at f₀ = 1591.5 Hz. The cancelling voltages are large: each is Q = 20 times the ' +
      'source — 20 V across the capacitor from a 1 V drive.',
    seeReads: [['mag.i.R1', 0.2], [(x, p) => 1 / (2 * Math.PI * Math.sqrt(p.L1 * p.C1)), 1591.55], ['state.Q', 20], ['mag.volt.C1', 20], ['lead.i.R1', 0, 0.1]],
    try: [
      { say: 'The 20 Ω chip: Q drops to 5, the capacitor sees 5 V, and the impedance dip is broader — the half-power points spread four times further apart.', set: { R1: 20 }, reads: [['mag.volt.C1', 5]] },
      { say: 'The 1400 Hz chip: the capacitor wins (1/ωC = 113.7 Ω against ωL = 88.0 Ω), |Z| jumps to 26.2 Ω and the current leads by 79.0°.', set: { f: 1400 }, reads: [[(x, p) => 1 / (x.omega * p.C1), 113.68], [(x, p) => x.omega * p.L1, 87.96], ['Z.mag', 26.2], ['lead.i.R1', 79.0]] },
      { say: 'Watch the scope: the amplitude builds as 1 − e^(−αt), and only after 40 cycles is it within a quarter of one per cent of its final 20 V.', reads: [['mag.volt.C1', 20]] },
    ],
    why:
      'Q = (1/R)√(L/C). The impedance plot shows resonance from outside: |Z| dips to R at f₀ and the phase crosses zero ' +
      'there, capacitive below, inductive above, with the half-power points f₀/Q apart. The scope shows what resonance ' +
      'costs: the amplitude builds with α = R/2L, reaching 1 − 1/e after Q/π cycles.',
  },
  h5: {
    see:
      'Drive an RL load — 100 Ω and 0.3 H — from 10 V peak at 50 Hz. The current is 72.8 mA peak ' +
      'and lags by 43.3°. The instantaneous power p = v·i is a constant plus a sinusoid at 100 Hz, twice the drive ' +
      'frequency. Its average, the real power P = 265 mW, is ' +
      'all in the resistor; the inductor’s power averages exactly zero.',
    seeReads: [['mag.i.R1', 0.07279], ['lead.i.R1', -43.3], [(x) => x.omega / Math.PI, 100], ['ac.P', 0.2649]],
    whyReads: [[(x, p) => p.A / Math.SQRT2, 7.071], [(x) => cx.cabs(x.ac.i.R1) / Math.SQRT2, 0.05147]],
    try: [
      { say: 'Set L to 1 µH, all but nothing: the current comes into phase, 100 mA, P rises to 500 mW and there is no reactive power to speak of.', set: { L1: 1e-6 }, reads: [['mag.i.R1', 0.1], ['lead.i.R1', 0, 0.01], ['ac.P', 0.5]] },
      { say: 'The 400 Hz chip: ωL = 754 Ω swamps R, the current falls to 13.15 mA lagging 82.4°, and of the 65.7 mVA the source carries only 8.65 mW is real.', set: { f: 400 }, reads: [[(x, p) => x.omega * p.L1, 754], ['mag.i.R1', 0.013148], ['lead.i.R1', -82.45], ['ac.S', 0.06574], ['ac.P', 0.008644]] },
      { say: 'Open the AC power view: V_rms·I_rms = 364 mVA is the apparent power the wires must carry; cos φ = 0.728 of it is P, and Q = 250 mvar is the amplitude of the inductor’s to-and-fro.', reads: [['ac.S', 0.36397], ['ac.pf', 0.7278], ['ac.Q', 0.24965]] },
    ],
    why:
      'P = ½R|I|² = V_rms·I_rms·cos φ, with V_rms = 10/√2 = 7.07 V and I_rms = 51.5 mA here. The product V_rms·I_rms is the ' +
      'apparent power; cos φ is the power factor; the remainder Q is reactive power — energy borrowed for a quarter cycle ' +
      'and given back. The instantaneous power crosses zero whenever v or i does — twice a cycle each — which is why it runs at 2f.',
  },
  h6: {
    see:
      'Everything the steady state does at one frequency is a single complex number, H = V_C/V_s = 1/(1 + jωRC). Sweep ' +
      'the frequency and that number traces a curve — the Bode plot: |H| in decibels and the phase in degrees against a ' +
      'logarithmic frequency axis. The marker is the frequency the scope is running at now: 1000 Hz, where |H| is ' +
      '−16.1 dB and the phase −81.0°.',
    seeReads: [['H.db', -16.07], ['H.deg', -80.96]],
    try: [
      { say: 'The 159.2 Hz chip is the corner f_c = 1/(2πRC): |H| = 1/√2, which is −3.01 dB, and the phase is −45°.', set: { f: 159.2 }, reads: [[(x, p) => 1 / (2 * Math.PI * p.R1 * p.C1), 159.15], ['H.db', -3.011], ['H.deg', -45.01]] },
      { say: 'The 15.92 Hz chip, a decade below: −0.043 dB and −5.7° — the capacitor is nearly open and the output follows the input.', set: { f: 15.92 }, reads: [['H.db', -0.0432], ['H.deg', -5.71]] },
      { say: 'The 1592 Hz chip, a decade above: −20.0 dB and −84.3°, and each further tenfold in frequency costs another 20 dB.', set: { f: 1592 }, reads: [['H.db', -20.046], ['H.deg', -84.29], [(x, p, again, exp) => readQuantity(x, p, 'H.db', exp) - readQuantity(again({ f: 10 * p.f }), { ...p, f: 10 * p.f }, 'H.db', exp), 19.96]] },
    ],
    why:
      'Below the corner the capacitor is nearly open and the output follows the input; at the corner |H| = 1/√2 and the ' +
      'phase is −45°; above it the gain falls 20 dB for every tenfold in frequency and the phase heads for −90°. Circuit ' +
      'Lab starts from this plot — it has no time axis at all — so the hand-over below carries your R and C there exactly, ' +
      'and its Bode plot is this one.',
    whyReads: [
      [(x, p, again, exp) => readQuantity(again({ f: 1 / (2 * Math.PI * p.R1 * p.C1) }), { ...p, f: 1 / (2 * Math.PI * p.R1 * p.C1) }, 'H.deg', exp), -45],
      [(x, p, again, exp) => readQuantity(again({ f: 1592 }), { ...p, f: 1592 }, 'H.db', exp) - readQuantity(again({ f: 15920 }), { ...p, f: 15920 }, 'H.db', exp), 19.96],
      [(x, p, again, exp) => readQuantity(again({ f: 1e5 }), { ...p, f: 1e5 }, 'H.deg', exp), -89.91],
    ],
  },
}
