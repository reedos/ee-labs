// Definitions, delivered where the term first does work — the suite's pattern
// (see signal-lab/src/terms.js). Each experiment lists the terms its note
// leans on and the sidebar offers them folded under the note.
//
// House rules: two or three sentences; the first says what the thing IS, the
// rest why it matters here; concrete numbers over abstraction; no term defined
// using an undefined term.

export const TERMS = {
  charge: {
    name: 'Charge',
    def:
      'The thing that moves in a circuit, in coulombs, carried by electrons, about 6.24 × 10¹⁸ of them to the ' +
    'coulomb. Voltage is the energy given to each coulomb. Current is coulombs passing per second. Everything ' +
    'below is bookkeeping for where charge goes and what it costs to move it.',
  },
  voltage: {
    name: 'Voltage',
    def:
      'The energy it takes to move a unit of charge from one point to another, in volts (joules per coulomb), ' +
    'always between two points, never at one. A meter has two probes because of this. The one at the ground ' +
    'symbol is the point everything else is measured from.',
  },
  current: {
    name: 'Current',
    def:
      'Charge passing a point per second, in amperes (coulombs per second). It has a direction. The sign of a ' +
    'reading says whether it flows the way the arrow was drawn or the other way. A negative current is a real ' +
    'current, in the opposite direction.',
  },
  vsource: {
    name: 'Voltage source',
    def:
      'An element that holds a fixed voltage between its terminals whatever current the circuit draws, the ' +
    'model of a battery or a regulated supply. Its current is decided by what it is connected to. A short ' +
    'across an ideal one has no answer, which is why a real one has a small internal resistance (D6).',
  },
  isource: {
    name: 'Current source',
    def:
      'An element that pushes a fixed current through itself whatever voltage that takes. Its voltage is ' +
    'decided by what it is connected to. An open circuit across an ideal one has no answer. Rarer as a ' +
    'component than a battery, but it is how a transistor’s output behaves, and so how amplifiers are ' +
    'modelled.',
  },
  resistor: {
    name: 'Resistor and Ohm’s law',
    def:
      'An element whose voltage and current are proportional: v = i·R, with R in ohms (volts per ampere). Given ' +
    'the voltage it decides the current. Given the current it decides the voltage. It turns the power v·i ' +
    'into heat, and never gives any back.',
  },
  ground: {
    name: 'Ground (reference node)',
    def:
      'The node chosen to be called 0 V, so that every other node can be given one number instead of a ' +
    'difference. Any node will do. Moving the choice shifts every node voltage by one constant and changes ' +
    'nothing an element can feel.',
  },
  kcl: {
    name: 'KCL (Kirchhoff’s current law)',
    def:
      'The currents flowing into any junction sum to exactly the currents flowing out, because charge does not ' +
    'accumulate at a point. Written as "everything leaving the node sums to zero", it is one equation per ' +
    'node. Those equations are the rows the Analysis pane writes out.',
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
      'A set of points joined by wire, all at one voltage, since an ideal wire has none across it. Voltages are ' +
    'only ever measured between two nodes, so one is named ground and called 0 V. Every other node voltage is ' +
    'relative to it.',
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
      'Energy per second, in watts: p = v·i for any element. For a resistor it is also i²R and v²/R, always ' +
    'positive, a resistor only ever heats up. A source’s power is negative when it is doing the pushing.',
  },
  series: {
    name: 'Series',
    def:
      'Elements connected end to end so the same current flows through each. Their resistances add, and the ' +
    'voltage splits between them in proportion, the voltage divider.',
  },
  parallel: {
    name: 'Parallel',
    def:
      'Elements connected across the same two nodes so they share one voltage. Their conductances (1/R) add, so ' +
    'the combination is always smaller than the smallest member. Two 1 kΩ resistors in parallel are 500 Ω.',
  },
  thevenin: {
    name: 'Thévenin equivalent',
    def:
      'Any linear circuit, seen from two terminals, behaves exactly like one voltage source V_oc in series with ' +
    'one resistor R_th. V_oc is what a meter reads with nothing connected. R_th is V_oc divided by the ' +
    'current a short would draw. Those two numbers are everything a load can learn about the circuit.',
  },
  nodal: {
    name: 'Nodal analysis',
    def:
      'Choose a ground, treat every other node voltage as an unknown, and write KCL at each node with every ' +
    'resistor current expressed as (voltage difference)/R. That gives one linear equation per node. Solve ' +
    'them and every current follows from Ohm’s law.',
  },
  supernode: {
    name: 'Supernode',
    def:
      'A voltage source between two non-ground nodes fixes their difference but has an unknown current. Merge ' +
    'the two nodes’ KCL equations so that current cancels, and use the fixed difference as the equation you ' +
    'gave up. The matrix method instead keeps the current as an unknown, same answer, no trick.',
  },
  mna: {
    name: 'Modified nodal analysis',
    def:
      'Nodal analysis with one extra unknown for each element whose current cannot be written from its voltage, ' +
    'such as a voltage source or an op-amp output. Each adds one equation, the constraint it imposes. This is ' +
    'how every circuit simulator, including this one, builds its matrix.',
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
      'In a linear circuit the response to several sources acting together is the sum of the responses to each ' +
    'acting alone, with the others set to zero. A voltage source becomes a short and a current source a gap. ' +
    'It holds for voltages and currents, and fails for power, which is quadratic.',
  },
  linear: {
    name: 'Linear',
    def:
      'Doubling every source doubles every voltage and current. Resistors, ideal sources, and dependent sources ' +
    'with fixed gain are linear. Diodes and saturating op-amps are not, and superposition and Thévenin stop ' +
    'applying to them.',
  },
  dependent: {
    name: 'Dependent source',
    def:
      'A source whose value is a fixed multiple of a voltage or current elsewhere in the circuit, written as a ' +
    'diamond. It is the model of every amplifying device. The op-amp is a voltage-controlled voltage source ' +
    'with a very large gain.',
  },
  opamp: {
    name: 'Op-amp',
    def:
      'A differential amplifier in a package: v_out = A·(v₊ − v₋) with A around 10⁵ or more. It is built from ' +
    'transistors and powered from supply pins the symbol leaves out, and its inputs draw almost no current. ' +
    'It is nearly always used with feedback, which turns the large gain into a way of forcing v₊ ≈ v₋.',
  },
  ideal: {
    name: 'Ideal op-amp',
    def:
      'Infinite gain, infinite input resistance, zero output resistance, zero offset between the inputs, and no ' +
    'limit on speed or output swing. Real parts miss each by a known, small amount that the data sheet lists. ' +
    'The circuits in this group work because feedback makes those amounts nearly irrelevant.',
  },
  impedance: {
    name: 'Input and output impedance',
    def:
      'What a device looks like as a resistor to whatever connects to it. A high input impedance draws little ' +
    'current from the source feeding it, so the source’s voltage is not pulled down. A low output impedance ' +
    'keeps the output steady under load. The ideal op-amp has infinite input and zero output impedance.',
  },
  active: {
    name: 'Active vs passive',
    def:
      'A passive element, such as a resistor, capacitor or inductor, only absorbs or stores the energy it is ' +
    'given. A network of them never delivers more power than the source puts in, and never makes a voltage ' +
    'larger than the source’s. An active device draws on a separate supply, so it can amplify.',
  },
  gain: {
    name: 'Gain',
    def:
      'Output divided by input. The op-amp’s own gain A is huge and poorly controlled. The circuit’s gain, set ' +
    'by two resistors around it, is modest and exact, and the second depends on the first only as G/A, which ' +
    'is nothing.',
  },
  feedback: {
    name: 'Negative feedback',
    def:
      'Some of the output is returned to the inverting input, so any rise in output pushes the input difference ' +
    'down. The op-amp then settles where v₊ − v₋ is almost zero, and where that is depends only on the ' +
    'resistors that route the feedback.',
  },
  virtual: {
    name: 'Virtual ground',
    def:
      'A node held at 0 V by feedback without being wired to ground. The inverting input of an inverting ' +
    'amplifier is the example. No current flows into it, yet its voltage is zero, so every input current is ' +
    'set by its own resistor alone and continues through the feedback resistor.',
  },
  cmrr: {
    name: 'CMRR (common-mode rejection ratio)',
    def:
      'How much more a difference amplifier amplifies the difference between its inputs than what they have in ' +
    'common, in dB. An ideal one is infinite. In a four-resistor circuit it is set by how well the two ratios ' +
    'match, and a 1 % mismatch gives roughly 40 dB.',
  },
  capacitor: {
    name: 'Capacitor',
    def:
      'Two plates that store charge in proportion to the voltage between them, q = C·v, with C in farads. Since ' +
    'current is charge per second, i = C·dv/dt. It passes current only while its voltage changes, and holds ' +
    '½Cv² of energy. Its voltage cannot jump, so it is a state of the circuit.',
  },
  inductor: {
    name: 'Inductor',
    def:
      'A coil that stores magnetic flux in proportion to the current through it, λ = L·i, with L in henries. ' +
    'Since voltage is flux per second, v = L·di/dt. It has voltage across it only while its current is ' +
    'changing, and holds ½Li² of energy. Its current cannot jump, so it is a state of the circuit.',
  },
  state: {
    name: 'State',
    def:
      'The numbers that, with the inputs from now on, fix everything the circuit does next: one voltage per ' +
    'capacitor and one current per inductor. Resistor currents and node voltages follow from them by an ' +
    'ordinary resistive solve. That is why the schematic at any instant is a DC circuit with the states ' +
    'standing in as sources.',
  },
  timeconstant: {
    name: 'Time constant τ',
    def:
      'For one capacitor or inductor in a resistive network, the response to a step is an exponential e^(−t/τ), ' +
    'with τ = RC or L/R. R is the resistance the element sees. In one τ the response has gone 63.2 % of the ' +
    'way, and in 5τ, 99.3 %. Double R or C and it takes twice as long.',
  },
  initial: {
    name: 'Initial conditions',
    def:
      'The state just before the step, x(0⁻): switches where they were, sources at their old values, capacitors ' +
    'open and inductors shorted. Because a state cannot jump, x(0⁺) = x(0⁻). That one fact fixes every ' +
    'voltage and current the instant after, through the resistive solve with the states as sources.',
  },
  natural: {
    name: 'Natural response',
    def:
      'What the circuit does with its inputs held still, decaying from whatever state it was left in. It is a ' +
    'sum of e^(st) terms, one per root s of the characteristic polynomial. The forced response is what the ' +
    'input drives it to. The full response adds the two, with the natural amplitudes set by the initial ' +
    'conditions.',
  },
  characteristic: {
    name: 'Characteristic polynomial',
    def:
      'det(sI − A) for the state matrix A. For two states it is s² + 2αs + ω₀². Here α is the neper frequency, ' +
    'how fast things decay, and ω₀ the undamped natural frequency, how fast they would ring with no loss. Its ' +
    'roots are the exponents of the natural response, whose real parts set the decay and imaginary parts the ' +
    'oscillation.',
  },
  damping: {
    name: 'Damping (ζ)',
    def:
      'The ratio ζ = α/ω₀, which fixes the shape of a second-order response independent of its speed. Above 1 ' +
    'it is overdamped: two real roots, a slow creep, no overshoot. At 1 it is critical, the quickest approach ' +
    'without overshoot, at R = 2√(L/C) for a series RLC. Below 1 it rings at ω_d = ω₀√(1 − ζ²) inside an ' +
    'e^(−αt) envelope.',
  },
  duality: {
    name: 'Duality',
    def:
      'Swap voltage for current, capacitor for inductor, series for parallel, resistance for conductance, and ' +
    'KCL for KVL. Every true statement about a circuit becomes true of its dual. i = C·dv/dt and v = L·di/dt ' +
    'are the same law read twice. A series RLC with 2α = R/L and a parallel one with 2α = 1/RC have identical ' +
    'waveforms.',
  },
  energy: {
    name: 'Energy bookkeeping',
    def:
      'Power is energy per second, so integrating each element’s p = v·i says where every joule went. It is ' +
    'stored in a capacitor or inductor (½Cv² or ½Li²), dissipated as heat in a resistor, or supplied by a ' +
    'source. The powers sum to zero at every instant, so supplied = stored − stored₀ + dissipated.',
  },
  steadystate: {
    name: 'Steady state (sinusoidal)',
    def:
      'What is left once the natural response has decayed: every voltage and current a sinusoid at the drive ' +
    'frequency, and nothing else. It is the forced response alone. How the circuit was switched on no longer ' +
    'matters. In this lab the dashed trace is the steady state, and the solid one is the circuit getting ' +
    'there.',
  },
  phasor: {
    name: 'Phasor',
    def:
      'A sinusoid at a known frequency is fixed by its amplitude and phase. It can therefore be written as one ' +
    'complex number X = |X|∠φ, with x(t) = |X| sin(ωt + φ). Drawn as an arrow, its length is the amplitude ' +
    'and its angle the phase. Adding sinusoids becomes adding arrows, and d/dt becomes multiplying by jω.',
  },
  reactance: {
    name: 'Reactance',
    def:
      'The ohms of a capacitor or inductor at one frequency: X_L = ωL and X_C = 1/ωC. The voltage runs a ' +
    'quarter cycle ahead of the current for the inductor, and a quarter cycle behind for the capacitor. Both ' +
    'are real ohms, in that |V| = X·|I|. They differ from resistance in the 90° and in dissipating nothing.',
  },
  impedanceac: {
    name: 'Impedance Z',
    def:
      'Ohm’s law for phasors: V = Z·I with Z complex. A resistor’s Z is R, an inductor’s is jωL, and a ' +
    'capacitor’s is 1/jωC. Series impedances add and parallel ones combine as resistors do. Steady-state ' +
    'analysis is then nodal analysis with Z in place of R. |Z| is the ratio of amplitudes, and ∠Z the angle ' +
    'by which voltage leads current.',
  },
  resonance: {
    name: 'Resonance',
    def:
      'The frequency ω₀ = 1/√LC at which an inductor’s reactance equals a capacitor’s. In series their voltages ' +
    'cancel, the impedance drops to R alone, and the current peaks. Each reactive voltage is Q = (1/R)√(L/C) ' +
    'times the source. The half-power bandwidth is ω₀/Q, and it takes about Q/π cycles to build up.',
  },
  rms: {
    name: 'RMS value',
    def:
      'The root of the mean of the square: the constant that would heat a resistor as much as the waveform ' +
    'does. Power is v²/R, so heat follows the average of v². For a sinusoid it is the peak over √2. A 10 V ' +
    'peak sine is 7.07 V RMS, and mains "230 V" is a 325 V peak.',
  },
  powerfactor: {
    name: 'Power factor',
    def:
      'The ratio of the power delivered, P, to the apparent power V_rms·I_rms the wires must carry. It equals ' +
    'cos φ, with φ the angle between voltage and current. A resistor gives 1. A pure inductor or capacitor ' +
    'gives 0, with current heating the wires while nothing is delivered. The rest, Q = V_rms·I_rms·sin φ, is ' +
    'reactive power.',
  },
  saturation: {
    name: 'Saturation',
    def:
      'An amplifier’s output running into the supply that feeds it and going no further. An op-amp asked for ' +
    '100 V from a ±12 V supply gives 12 V and stops. Inside that limit it is the linear element the golden ' +
    'rules describe, and outside it is simply a source at the rail.',
  },
  hysteresis: {
    name: 'Hysteresis',
    def:
      'When what a circuit does now depends on where it has been, not only on its input. A Schmitt trigger ' +
    'flips up at one threshold and back down at a lower one. An input hovering between them leaves the output ' +
    'where it already was, which is what stops noise chattering.',
  },
  diode: {
    name: 'Diode',
    def:
      'An element that lets current one way and blocks it the other. The arrow of its symbol points the way ' +
    'current is allowed. Unlike a resistor it has no ratio of its own. It settles at a drop of about 0.7 V, ' +
    'and the rest of the circuit sets the current.',
  },
  thermalvoltage: {
    name: 'Thermal voltage V_T',
    def:
      'kT/q, 25.9 mV at room temperature, the voltage scale on which a diode’s exponential runs. Everything ' +
    'about a junction that is not a property of the part is set by this number. It gives the rule that ten ' +
    'times the current costs about 60 mV more.',
  },
  loadline: {
    name: 'Load line',
    def:
      'The straight line the rest of the circuit imposes on a nonlinear element. With a source E behind a ' +
    'resistance R, the element can only have i = (E − v)/R. Draw it across the element’s own curve, and the ' +
    'crossing is the answer.',
  },
  operatingpoint: {
    name: 'Operating point',
    def:
      'The one pair of values (v, i) at which a nonlinear element and the circuit around it agree, where the ' +
    'curve meets the load line. Everything a designer says about a diode or a transistor is said about its ' +
    'behaviour near this point.',
  },
  newton: {
    name: 'Newton’s method',
    def:
      'How a simulator solves a curve. Replace it by its tangent at a guess, solve that linear circuit, and ' +
    'take the answer as the next guess. Close to the solution each error is about the square of the last, so ' +
    'the final digits arrive together.',
  },
  assumedstate: {
    name: 'The assumed-state method',
    def:
      'Guess which way each diode is, conducting or blocking, solve the linear circuit that guess describes, ' +
    'and then check the guess against its own answer. A conducting diode must come out with forward current. ' +
    'A blocking one with less than V_f across it. One guess survives.',
  },
  clamp: {
    name: 'Clamp',
    def:
      'To hold a node at a fixed voltage once it tries to go past it. A diode clamps because it will ' +
      'conduct as much current as it takes to stop the node rising more than V_f beyond wherever its ' +
      'other end is tied.',
  },
  conduction: {
    name: 'Conduction angle',
    def:
      'How much of each cycle a rectifier’s diode passes current, measured in degrees of the drive. It is less ' +
    'than the 180° of a half cycle, because the source must climb past V_f before the diode conducts. It ' +
    'falls further once a smoothing capacitor is added.',
  },
  rectifier: {
    name: 'Rectifier',
    def:
      'A circuit that turns alternating current into one-way current. Half-wave uses one diode and throws away ' +
    'half the input. Full-wave uses four and turns the other half over, giving twice the average and a ripple ' +
    'at twice the frequency.',
  },
  ripple: {
    name: 'Ripple',
    def:
      'What is left of the alternating input after smoothing: the peak-to-peak wobble on a supply ' +
      'that should be flat. It falls as the smoothing capacitor grows, because the load has less ' +
      'time to drain it between peaks.',
  },
  clipper: {
    name: 'Clipper',
    def:
      'A circuit that lets a signal through untouched between two levels and refuses to pass it beyond them. ' +
    'Two diodes tied to two references do it. Outside the window one of them conducts and holds the output ' +
    'there while the series resistor absorbs the difference.',
  },
  zener: {
    name: 'Zener diode',
    def:
      'A diode built to be run backwards. Past a reverse voltage V_z, set when it is made and ranging from a ' +
    'couple of volts to a couple of hundred, it conducts freely and holds that voltage. That makes it the ' +
    'cheapest voltage reference there is.',
  },
  regulation: {
    name: 'Regulation',
    def:
      'Holding an output steady while its supply or its load moves. A regulator only regulates ' +
      'inside a band: take more current than its series resistor can pass and there is nothing left ' +
      'to hold the voltage up, and it drops out.',
  },
  bode: {
    name: 'Bode plot',
    def:
      'The frequency response drawn as two curves against a logarithmic frequency axis: |H| in decibels ' +
    '(20·log₁₀|H|) and the phase in degrees. Logarithms turn a product of stages into a sum, and a ' +
    'factor-of-ten rolloff into a straight line. A single RC falls 20 dB per decade above its corner, where ' +
    '|H| = 1/√2 (−3 dB) and the phase is −45°.',
  },
  pole: {
    name: 'Pole',
    def:
      'A root of the denominator of H(s). The series RLC has two, the roots of s² + (R/L)s + 1/LC, and they ' +
    'are the exponents of its natural response. |H| at a frequency is fixed by how far jω sits from them, so ' +
    'a root close to the axis gives a tall peak there.',
  },
  splane: {
    name: 'The s-plane',
    def:
      'The plane the complex frequency s is drawn on, with the real part across and the imaginary part up. ' +
    'A real root sits on the horizontal axis, and a complex pair sits above and below it at equal heights. ' +
    'The Bode plot is |H(s)| read along the vertical axis, where s = jω.',
  },
  clamper: {
    name: 'Clamper',
    def:
      'A capacitor in series with the signal and a diode across the output. The capacitor charges until the ' +
    'output’s lowest point sits at the diode’s drop below ground, and the whole waveform then rides on that ' +
    'offset. The shape is unchanged and only the DC level moves.',
  },
  doubler: {
    name: 'Voltage doubler',
    def:
      'A clamper feeding a peak rectifier. The clamper lifts the waveform until its peak reaches nearly twice ' +
    'the source peak, and the rectifier holds that peak on a second capacitor. The output is 2V_p less one ' +
    'diode drop in each stage.',
  },
}

/** The definitions an experiment asks for, in the order it lists them. */
export function termsFor(ids = []) {
  return ids.filter((id) => TERMS[id]).map((id) => ({ id, ...TERMS[id] }))
}

/**
 * How each term is written in a lesson's prose, so its first use can carry
 * its definition (student review, Phase 6). Patterns are deliberately narrow:
 * "energy" alone is a word A1 needs before F5 defines the bookkeeping, and
 * "impedance" after "input" is E2's R_in, not H3's Z. glossary.js tests that no
 * pattern fires in an experiment earlier than the one that introduces its term.
 */
export const MATCH = {
  charge: /\bcharge\b/i,
  voltage: /\bvoltage\b/i,
  current: /\bcurrent\b/i,
  vsource: /\b(?:voltage sources?|batter(?:y|ies)|sources?)\b/i,
  isource: /\bcurrent sources?\b/i,
  resistor: /\bresistors?\b|Ohm’s law/i,
  ground: /\bground\b/i,
  kcl: /\bKCL\b|Kirchhoff’s current law/,
  kvl: /\bKVL\b|Kirchhoff’s voltage law/,
  node: /\bnodes?\b/i,
  passive: /sign convention|called \+|into its \+/i,
  power: /\bpower\b/i,
  series: /\bseries\b/i,
  parallel: /\bparallel\b/i,
  thevenin: /Th[eé]venin/i,
  nodal: /\bnodal\b|write KCL at each/i,
  supernode: /\bsupernodes?\b/i,
  mna: /modified nodal|\bMNA\b|unknown current/i,
  mesh: /\bmesh(?:es)?\b|circulating current/i,
  superposition: /\bsuperposition\b|sum of the responses/i,
  linear: /\blinear\b/i,
  dependent: /\bdependent sources?\b/i,
  opamp: /\bop-amp\b/i,
  ideal: /\bideal op-amp\b|\bIdeal — A\b/i, // "ideal source" in A1 is the everyday word
  impedance: /input (?:and output )?impedance|\bR_in\b|\bR_out\b|input resistance/i,
  active: /\bactive\b/i,
  gain: /\bgain\b|\bA·|\bA times\b/i,
  feedback: /\bfeedback\b|back to (?:an|the) [−-]? ?input|back from the output/i,
  virtual: /\bvirtual ground\b/i,
  cmrr: /\bCMRR\b|common[- ]mode|rejected/i,
  capacitor: /\bcapacitors?\b/i,
  inductor: /\binductors?\b/i,
  state: /(?<!steady[ -])\bstates?\b/i,
  timeconstant: /time constants?|τ/,
  initial: /initial conditions?|initial value/i,
  natural: /\bnatural\b/i,
  characteristic: /\bcharacteristic\b|second-order equation/i,
  damping: /damp|ζ|α|overshoot/i,
  duality: /\bdual\b|\bduality\b/i,
  energy: /energy (?:bookkeeping|stored)|half the energy|\bjoules?\b|\b[µm]J\b/i,
  steadystate: /steady[ -]state|steady sinusoid/i,
  phasor: /\bphasors?\b|as an arrow/i,
  reactance: /\breactance\b|\boffers\b/i,
  impedanceac: /(?<!input |output |source |load )\bimpedances?\b|\|Z\|/i,
  resonance: /\bresonan(?:ce|t)\b/i,
  rms: /\bRMS\b|[VI]_rms/,
  powerfactor: /power factor|cos ?φ/i,
  bode: /\bBode\b/,
  saturation: /\bsaturat/i,
  hysteresis: /\bhysteresis\b/i,
  diode: /\bdiodes?\b/i,
  thermalvoltage: /thermal voltage|V_T/,
  loadline: /\bload line\b/i,
  operatingpoint: /operating point/i,
  newton: /\bNewton’s method\b|\bNewton\b/,
  assumedstate: /assumed? state|assume, solve/i,
  // "conductance" is C2's word and must not be caught by this one.
  clamp: /\bclamp(?:s|ed|ing)?\b/i,
  conduction: /conduction (?:window|angle)|conducts? for|conducting \d/i,
  rectifier: /\brectifier\b/i,
  ripple: /\bripple\b/i,
  clipper: /\bclipper\b|\bclipped\b|\bclips\b/i,
  zener: /\bZener\b/,
  regulation: /regulat(?:e|es|ed|ion|ing)\b|out of regulation|drops? out/i,
  // H7's two, and Group I's last two circuits. Each word is used nowhere
  // earlier in the course, so the first experiment that lists it introduces it.
  pole: /\bpoles?\b/i,
  splane: /s-plane/i,
  clamper: /\bclamper\b/i,
  doubler: /\bdoubler\b/i,
}
