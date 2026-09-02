// Definitions, delivered where the term first does work — the suite's pattern
// (see signal-lab/src/terms.js). Each experiment lists the terms its note
// leans on and the sidebar offers them folded under the note.
//
// House rules: two or three sentences; the first says what the thing IS, the
// rest why it matters here; concrete numbers over abstraction; no term defined
// using an undefined term.

export const TERMS = {
  voltage: {
    name: 'Voltage',
    def:
      'The energy it takes to move a unit of charge from one point to another, in volts (joules ' +
      'per coulomb) — always between two points, never at one. A meter has two probes because of ' +
      'this; the one at the ground symbol is the point everything else is measured from.',
  },
  current: {
    name: 'Current',
    def:
      'Charge passing a point per second, in amperes (coulombs per second). It has a direction, ' +
      'and the sign of a current reading says whether it flows the way the arrow was drawn or ' +
      'the other way — a negative current is a real current, going the other direction.',
  },
  vsource: {
    name: 'Voltage source',
    def:
      'An element that holds a fixed voltage between its terminals whatever current the circuit ' +
      'draws — the model of a battery or a regulated supply. Its current is decided by what it ' +
      'is connected to; a short across an ideal one has no answer, which is why a real one has ' +
      'a small internal resistance (D6).',
  },
  isource: {
    name: 'Current source',
    def:
      'An element that pushes a fixed current through itself whatever voltage that takes. Its ' +
      'voltage is decided by what it is connected to; an open circuit across an ideal one has no ' +
      'answer. Rarer as a component than a battery, but it is how a transistor’s output behaves, ' +
      'and so how amplifiers are modelled.',
  },
  resistor: {
    name: 'Resistor and Ohm’s law',
    def:
      'An element whose voltage and current are proportional: v = i·R, with R in ohms (volts ' +
      'per ampere). Given the voltage it decides the current; given the current it decides the ' +
      'voltage. It turns the power v·i into heat, and never gives any back.',
  },
  ground: {
    name: 'Ground (reference node)',
    def:
      'The node chosen to be called 0 V, so that every other node can be given one number ' +
      'instead of a difference. Any node will do; moving the choice shifts every node voltage by ' +
      'one constant and changes nothing an element can feel.',
  },
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
      'A differential amplifier in a package: v_out = A·(v₊ − v₋) with A around 10⁵ or more, ' +
      'built from transistors and powered from supply pins the symbol leaves out. Its inputs draw ' +
      'almost no current. Used almost always with feedback, so that the enormous gain becomes a ' +
      'tool for forcing v₊ ≈ v₋ rather than a number the output reaches.',
  },
  ideal: {
    name: 'Ideal op-amp',
    def:
      'Infinite gain, infinite input resistance (no input current), zero output resistance (the ' +
      'output holds its voltage into any load), zero offset between the inputs, and no limit on ' +
      'speed or output swing. Real parts miss each of these by a known, small amount — the data ' +
      'sheet is the list — and the circuits in this group work because feedback makes those ' +
      'amounts nearly irrelevant.',
  },
  impedance: {
    name: 'Input and output impedance',
    def:
      'What a device looks like as a resistor to whatever connects to it. A high input impedance ' +
      'draws little current from the source feeding it, so the source’s own voltage is not pulled ' +
      'down; a low output impedance keeps the output voltage steady when a load draws current. The ' +
      'ideal op-amp has infinite and zero; an op-amp circuit with feedback comes remarkably close.',
  },
  active: {
    name: 'Active vs passive',
    def:
      'A passive element — resistor, capacitor, inductor — can only absorb or store the energy it ' +
      'is given, so a network of them never delivers more power to a load than the source puts in ' +
      'and never makes a voltage larger than the source’s. An active device draws on a separate ' +
      'supply, so it can amplify: more power out than the signal brought in.',
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
  capacitor: {
    name: 'Capacitor',
    def:
      'Two plates that store charge in proportion to the voltage between them, q = C·v, with C ' +
      'in farads (coulombs per volt). Since current is charge per second, i = C·dv/dt: it passes ' +
      'current only while its voltage is changing, and holds ½Cv² of energy. Its voltage cannot ' +
      'jump — that would take infinite current — so it is a state of the circuit.',
  },
  inductor: {
    name: 'Inductor',
    def:
      'A coil that stores magnetic flux in proportion to the current through it, λ = L·i, with L ' +
      'in henries. Since voltage is flux per second, v = L·di/dt: it has voltage across it only ' +
      'while its current is changing, and holds ½Li² of energy. Its current cannot jump — that ' +
      'would take infinite voltage — so it is a state of the circuit.',
  },
  state: {
    name: 'State',
    def:
      'The set of numbers that, together with the inputs from now on, decide everything the ' +
      'circuit does next: one voltage per capacitor and one current per inductor. Everything else ' +
      '— resistor currents, node voltages — is found from them by an ordinary resistive solve, ' +
      'which is why the schematic at any instant is just a DC circuit with the states standing in ' +
      'as sources.',
  },
  timeconstant: {
    name: 'Time constant τ',
    def:
      'For one capacitor or one inductor and a resistive network, the response to any step is ' +
      'an exponential e^(−t/τ) with τ = RC or L/R, R being the resistance the element sees. In one ' +
      'τ the response has gone 63.2 % of the way; in 5τ, 99.3 %. Double R or C and everything ' +
      'takes twice as long, with the same shape.',
  },
  initial: {
    name: 'Initial conditions',
    def:
      'The state just before the step, x(0⁻): switches where they were, sources at their old ' +
      'values, capacitors open and inductors shorted. Because a state cannot jump, x(0⁺) = x(0⁻), ' +
      'and that one fact fixes every voltage and current the instant after — the resistive ' +
      'solve with the states as sources.',
  },
  natural: {
    name: 'Natural response',
    def:
      'What the circuit does with its inputs held still, decaying from whatever state it was ' +
      'left in: a sum of e^(st) terms, one for each root s of the characteristic polynomial. The ' +
      'forced response is what the input drives it to; the full response is the two added, with ' +
      'the natural part’s amplitudes chosen to meet the initial conditions.',
  },
  characteristic: {
    name: 'Characteristic polynomial',
    def:
      'det(sI − A) for the state matrix A: for two states s² + 2αs + ω₀², where α is the neper ' +
      'frequency (how fast things decay) and ω₀ the undamped natural frequency (how fast they ' +
      'would ring with no loss). Its roots are the exponents of the natural response; their ' +
      'real parts decay and their imaginary parts oscillate.',
  },
  damping: {
    name: 'Damping (ζ)',
    def:
      'The ratio ζ = α/ω₀, which fixes the shape of a second-order response independent of its ' +
      'speed. ζ > 1 is overdamped (two real roots, a slow creep with no overshoot); ζ = 1 is ' +
      'critical (the quickest approach without overshoot, at R = 2√(L/C) for series RLC); ζ < 1 ' +
      'is underdamped (a complex pair, it rings at ω_d = ω₀√(1 − ζ²) inside an e^(−αt) envelope). ' +
      'Q = 1/2ζ says the same thing as a count of cycles to ring down.',
  },
  duality: {
    name: 'Duality',
    def:
      'Swap voltage for current, capacitor for inductor, series for parallel, resistance for ' +
      'conductance, KCL for KVL, and every true statement about a circuit becomes another true ' +
      'statement about its dual. i = C·dv/dt and v = L·di/dt are the same law read twice; a series ' +
      'RLC with 2α = R/L and a parallel RLC with 2α = 1/RC have identical waveforms.',
  },
  energy: {
    name: 'Energy bookkeeping',
    def:
      'Power is energy per second, so integrating each element’s p = v·i over time says where ' +
      'every joule went: into a capacitor or inductor (stored, ½Cv² or ½Li², recoverable), into a ' +
      'resistor (dissipated as heat, gone), or out of a source (supplied). Since the powers sum to ' +
      'zero at every instant, supplied = stored − stored₀ + dissipated at every instant too.',
  },
  steadystate: {
    name: 'Steady state (sinusoidal)',
    def:
      'What is left once the natural response has decayed: every voltage and current a sinusoid ' +
      'at the drive frequency, and nothing else. It is the forced response alone; how the circuit ' +
      'was switched on no longer matters. In this lab the dashed trace is the steady state, and ' +
      'the solid one is the circuit getting there.',
  },
  phasor: {
    name: 'Phasor',
    def:
      'A sinusoid at a known frequency is fixed by its amplitude and phase, so it can be written ' +
      'as one complex number X = |X|∠φ, with x(t) = Im{X·e^(jωt)} = |X| sin(ωt + φ). Drawn as an ' +
      'arrow, its length is the amplitude and its angle the phase; spin it at ω and the height of ' +
      'the tip is the waveform. Adding sinusoids becomes adding arrows, and d/dt becomes ' +
      'multiplying by jω — a quarter turn and a stretch.',
  },
  reactance: {
    name: 'Reactance',
    def:
      'The ohms of a capacitor or inductor at one frequency: X_L = ωL and X_C = 1/ωC, with the ' +
      'voltage a quarter cycle ahead of the current for the inductor and a quarter cycle behind ' +
      'for the capacitor. Both are real ohms in the sense that |V| = X·|I|; they differ from ' +
      'resistance in the 90° and in dissipating nothing.',
  },
  impedanceac: {
    name: 'Impedance Z',
    def:
      'Ohm’s law for phasors: V = Z·I with Z complex. A resistor’s Z is R; an inductor’s jωL; a ' +
      'capacitor’s 1/jωC = −j/ωC. Series impedances add, parallel ones combine as resistors do, ' +
      'and the whole of steady-state analysis is nodal analysis with Z in place of R. |Z| is the ' +
      'ratio of amplitudes and ∠Z the angle by which the voltage leads the current.',
  },
  resonance: {
    name: 'Resonance',
    def:
      'The frequency ω₀ = 1/√LC at which an inductor’s reactance equals a capacitor’s. In series ' +
      'their voltages cancel, the impedance drops to R alone and the current peaks; each reactive ' +
      'voltage is Q = (1/R)√(L/C) times the source. The response is Q times narrower than it is ' +
      'tall: the half-power bandwidth is ω₀/Q, and it takes about Q/π cycles to build up.',
  },
  rms: {
    name: 'RMS value',
    def:
      'The root of the mean of the square: the constant that would heat a resistor as much as ' +
      'the waveform does, because power is v²/R and heat follows the average of v². For a ' +
      'sinusoid it is the peak over √2, so a 10 V peak sine is 7.07 V RMS — and mains "230 V" is ' +
      'the RMS of a 325 V peak.',
  },
  powerfactor: {
    name: 'Power factor',
    def:
      'The ratio of the power actually delivered, P, to the apparent power V_rms·I_rms that the ' +
      'wires must carry: cos φ, with φ the angle between voltage and current. A resistor is 1; ' +
      'a pure inductor or capacitor is 0, current flowing and heating the wires while nothing is ' +
      'delivered. The rest, Q = V_rms·I_rms·sin φ, is reactive power — energy borrowed and ' +
      'returned every half cycle.',
  },
  bode: {
    name: 'Bode plot',
    def:
      'The frequency response drawn as two curves against a logarithmic frequency axis: the ' +
      'magnitude |H| in decibels (20·log₁₀|H|) and the phase in degrees. Logarithms turn a ' +
      'product of stages into a sum and a factor-of-ten rolloff into a straight line: a single ' +
      'RC falls 20 dB per decade above its corner, where |H| = 1/√2 (−3 dB) and the phase is −45°.',
  },
}

/** The definitions an experiment asks for, in the order it lists them. */
export function termsFor(ids = []) {
  return ids.filter((id) => TERMS[id]).map((id) => ({ id, ...TERMS[id] }))
}
