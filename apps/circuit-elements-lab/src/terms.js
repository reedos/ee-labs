// Definitions, delivered where the term first does work — the suite's pattern
// (see signal-lab/src/terms.js). Each experiment lists the terms its note
// leans on and the sidebar offers them folded under the note.
//
// House rules: two or three sentences; the first says what the thing IS, the
// rest why it matters here; concrete numbers over abstraction; no term defined
// using an undefined term.

export const TERMS = {
  kcl: {
    name: 'KCL (Kirchhoff’s current law)',
    def:
      'The currents flowing into any junction sum to exactly the currents flowing out — charge ' +
      'does not accumulate at a point. Written as "everything leaving the node sums to zero", it ' +
      'is one equation per node, and those equations are the whole of nodal analysis.',
  },
  kvl: {
    name: 'KVL (Kirchhoff’s voltage law)',
    def:
      'Around any closed loop the voltage rises and drops sum to zero, because voltage is a ' +
      'difference in potential and you end where you started. It is why elements in series ' +
      'share a supply between them in proportion to their resistances.',
  },
  node: {
    name: 'Node',
    def:
      'A set of points joined by wire — all at one voltage, since an ideal wire has none across ' +
      'it. Voltages are only ever measured between two nodes, so one is named ground and called ' +
      '0 V; every other node voltage is relative to it.',
  },
  passive: {
    name: 'Passive sign convention',
    def:
      'Mark one terminal of an element +, and measure its current as flowing IN at that ' +
      'terminal. Then p = v·i is positive for anything absorbing energy and negative for anything ' +
      'delivering it. One rule, applied to every element, and the powers always sum to zero.',
  },
  power: {
    name: 'Power',
    def:
      'Energy per second, in watts: p = v·i for any element. For a resistor it is also i²R and ' +
      'v²/R, always positive — a resistor only ever heats up. A source’s power is negative when ' +
      'it is doing the pushing.',
  },
  series: {
    name: 'Series',
    def:
      'Elements connected end to end so the same current flows through each. Their resistances ' +
      'add, and the voltage splits between them in proportion — the voltage divider.',
  },
  parallel: {
    name: 'Parallel',
    def:
      'Elements connected across the same two nodes so they share one voltage. Their ' +
      'conductances (1/R) add, so the combination is always smaller than the smallest member: ' +
      'two 1 kΩ resistors in parallel are 500 Ω.',
  },
  thevenin: {
    name: 'Thévenin equivalent',
    def:
      'Any linear circuit, seen from two terminals, behaves exactly like one voltage source ' +
      'V_oc in series with one resistor R_th. V_oc is what a meter reads with nothing connected; ' +
      'R_th is V_oc divided by the current a short would draw. Everything a load can learn about ' +
      'the circuit is those two numbers.',
  },
  nodal: {
    name: 'Nodal analysis',
    def:
      'Choose a ground, treat every other node voltage as an unknown, and write KCL at each node ' +
      'with every resistor current expressed as (voltage difference)/R. Linear equations, one per ' +
      'node; solve them and every current follows from Ohm’s law.',
  },
  supernode: {
    name: 'Supernode',
    def:
      'A voltage source between two non-ground nodes fixes their difference but has an unknown ' +
      'current. Merge the two nodes’ KCL equations so that current cancels, and use the fixed ' +
      'difference as the equation you gave up. The matrix method instead keeps the current as an ' +
      'unknown — same answer, no trick.',
  },
  mna: {
    name: 'Modified nodal analysis',
    def:
      'Nodal analysis with one extra unknown for each element whose current cannot be written ' +
      'from its voltage — voltage sources, op-amp outputs — and one extra equation for each: the ' +
      'constraint it imposes. This is how every circuit simulator, including this one, builds its ' +
      'matrix.',
  },
  mesh: {
    name: 'Mesh analysis',
    def:
      'The dual of nodal: assign a circulating current to each window of a planar circuit and ' +
      'write KVL around it. An element shared by two windows carries the difference of their ' +
      'currents. Fewer unknowns when a circuit has few loops and many nodes.',
  },
  superposition: {
    name: 'Superposition',
    def:
      'In a linear circuit the response to several sources acting together is the sum of the ' +
      'responses to each acting alone, the others set to zero (a voltage source becomes a short, ' +
      'a current source a gap). True for voltages and currents; false for power, which is ' +
      'quadratic.',
  },
  linear: {
    name: 'Linear',
    def:
      'Doubling every source doubles every voltage and current. Resistors, ideal sources, and ' +
      'dependent sources with fixed gain are linear; diodes and saturating op-amps are not, and ' +
      'superposition and Thévenin stop applying to them.',
  },
  dependent: {
    name: 'Dependent source',
    def:
      'A source whose value is a fixed multiple of a voltage or current elsewhere in the circuit ' +
      '— written as a diamond. It is the model of every amplifying device: the op-amp is a ' +
      'voltage-controlled voltage source with a very large gain.',
  },
  opamp: {
    name: 'Op-amp',
    def:
      'A differential amplifier: v_out = A·(v₊ − v₋) with A around 10⁵ or more. Its inputs draw ' +
      'no current. Used almost always with feedback, so that the enormous gain becomes a tool ' +
      'for forcing v₊ ≈ v₋ rather than a number the output reaches.',
  },
  gain: {
    name: 'Gain',
    def:
      'Output divided by input. The op-amp’s own gain A is huge and poorly controlled; the ' +
      'circuit’s gain, set by two resistors around it, is modest and exact — and the second ' +
      'depends on the first only as G/A, which is nothing.',
  },
  feedback: {
    name: 'Negative feedback',
    def:
      'Some of the output is returned to the inverting input, so any rise in output pushes the ' +
      'input difference down. The op-amp then settles where v₊ − v₋ is almost zero — and where ' +
      'that is depends only on the resistors that route the feedback.',
  },
  virtual: {
    name: 'Virtual ground',
    def:
      'A node held at 0 V by feedback without being wired to ground. The inverting input of an ' +
      'inverting amplifier: no current flows into it, yet its voltage is zero, so every input ' +
      'current is set by its own resistor alone and continues through the feedback resistor.',
  },
  cmrr: {
    name: 'CMRR (common-mode rejection ratio)',
    def:
      'How much more a difference amplifier amplifies the difference between its inputs than ' +
      'what they have in common, in dB. Ideally infinite; in a four-resistor circuit it is set by ' +
      'how well the two ratios match — 1 % mismatch gives roughly 40 dB.',
  },
}

/** The definitions an experiment asks for, in the order it lists them. */
export function termsFor(ids = []) {
  return ids.filter((id) => TERMS[id]).map((id) => ({ id, ...TERMS[id] }))
}
