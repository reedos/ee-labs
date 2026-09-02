// Definitions, delivered where the term first does work — the suite's pattern
// (see signal-lab/src/terms.js). Each experiment lists the terms its note
// leans on and the sidebar offers them folded under the note.
//
// House rules: two or three sentences; the first says what the thing IS, the
// rest why it matters here; concrete numbers over abstraction; no term defined
// using an undefined term.

export const TERMS = {
  efficiency: {
    name: 'Efficiency',
    def:
      'Output power over input power, η = P_out/P_in. The difference is heat, somewhere in the ' +
      'converter; at 5 W out, 92.7 % means 0.39 W to get rid of and 41.7 % means 7 W.',
  },
  'linear-regulator': {
    name: 'Linear regulator',
    def:
      'A transistor in series with the load, driven so that the output holds at the wanted voltage. ' +
      'It works by dropping the excess across itself, so its loss is (V_in − V_out) times the load ' +
      'current and its efficiency can never exceed V_out/V_in.',
  },
  duty: {
    name: 'Duty (D)',
    def:
      'The fraction of each switching period the switch is on, from 0 to 1. It is the one thing the ' +
      'controller adjusts; in a buck in continuous conduction the output is D times the input.',
  },
  average: {
    name: 'Average',
    def:
      'The mean of a waveform over one period — what a DC meter, or a slow load, sees. A capacitor ' +
      'passes current only when the voltage changes, so it holds the average and lets the rest ' +
      'through as ripple.',
  },
  rms: {
    name: 'RMS',
    def:
      'Root of the mean of the square: the steady value that would heat a resistor as much as this ' +
      'waveform does. A square wave at duty D has RMS √D·V_in, which is above its average D·V_in ' +
      'unless D = 1 — heating goes as the square, and the square of a spiky thing is bigger.',
  },
  buck: {
    name: 'Buck converter',
    def:
      'A switch chopping the input, then an inductor and capacitor that pass the average to the load. ' +
      'It steps a voltage down; its output is D·V_in in continuous conduction, and its parts store ' +
      'energy rather than dissipate it.',
  },
  ripple: {
    name: 'Ripple',
    def:
      'The periodic wobble left on a signal the converter meant to hold steady, measured ' +
      'peak-to-peak. The inductor current ripples by V_out·(1 − D)/(L·f_s) and the output voltage by ' +
      'that over 8·f_s·C; both shrink with frequency, which is why converters switch fast.',
  },
  'switch-node': {
    name: 'Switch node',
    def:
      'The point between the switch, the diode and the inductor. It is the one node that swings the ' +
      'full input voltage every period — 0 ↔ 12 V here — and everything downstream exists to average it.',
  },
  'volt-second': {
    name: 'Volt-second balance',
    def:
      'An inductor’s current changes at v/L, so over any interval it changes by the integral of its ' +
      'voltage (volt-seconds) over L. In periodic steady state the current returns to its start, so ' +
      'the volt-seconds over a period sum to zero — the equation every converter’s ratio comes from.',
  },
  'charge-balance': {
    name: 'Charge balance',
    def:
      'The capacitor’s counterpart: its voltage changes by the charge (ampere-seconds) it receives over ' +
      'C, so in steady state the capacitor current averages to zero and the inductor’s average current ' +
      'all goes to the load.',
  },
  'steady-state': {
    name: 'Periodic steady state',
    def:
      'The condition where every waveform repeats exactly each switching period — the state a ' +
      'converter settles into after its start-up transient. The engine finds it directly: one period is ' +
      'an affine map on the state, and the steady state is that map’s fixed point.',
  },
  'conversion-ratio': {
    name: 'Conversion ratio (M)',
    def:
      'Output voltage over input voltage, M = V_out/V_in. For a buck it is at most 1; for the boost ' +
      'and buck-boost of later groups it can exceed 1. In continuous conduction it depends only on D.',
  },
  'small-ripple': {
    name: 'Small-ripple approximation',
    def:
      'Treating the output voltage as constant while working out the ripple that shows it is not. It ' +
      'is what makes the ripple formulas one-liners, and it costs a fraction of a percent when the ' +
      'ripple is a fraction of a percent — the panel shows exactly how much.',
  },
  dcm: {
    name: 'Discontinuous conduction (DCM)',
    def:
      'The mode in which the inductor current falls to zero and stays there for part of each period, ' +
      'because a diode cannot carry it backwards. The switch node floats to V_out meanwhile, the ' +
      'volt-second balance gains a term, and the output rises above D·V_in and starts to depend on load.',
  },
  ccm: {
    name: 'Continuous conduction (CCM)',
    def:
      'The mode in which the inductor current never reaches zero: it ripples about its average with ' +
      'the switch on or the diode conducting at every instant. Here, and only here, M = D for the buck.',
  },
  synchronous: {
    name: 'Synchronous switch',
    def:
      'A second transistor in the diode’s place, driven on whenever the main switch is off. It has a ' +
      'resistance rather than a forward drop, so it loses less at high current; and it conducts both ' +
      'ways, so the converter never enters discontinuous conduction.',
  },
  boost: {
    name: 'Boost converter',
    def:
      'A converter whose inductor charges from the source and then discharges in series with it, so the ' +
      'output is higher than the input: M = 1/(1 − D) with ideal parts. The load is fed only while the ' +
      'switch is off, which is why its output capacitor carries far more ripple current than a buck’s.',
  },
  'buck-boost': {
    name: 'Buck-boost converter',
    def:
      'A converter in which the inductor is charged by the source and then discharged into the load ' +
      'through a separate path, so input and output never conduct at the same time. The output can be ' +
      'above or below the input and comes out inverted: M = −D/(1 − D).',
  },
  inverting: {
    name: 'Inverting output',
    def:
      'An output whose voltage is negative with respect to the ground both it and the input share. It ' +
      'is a consequence of which way the inductor is connected when it discharges, not an extra part: ' +
      'the current leaves the inductor into the load’s ground end and returns through the output node.',
  },
  'winding-resistance': {
    name: 'Winding resistance (R_L)',
    def:
      'The resistance of the wire the inductor is wound from, in series with it at all times. In a buck ' +
      'it costs a little voltage; in a boost or buck-boost it carries the load current divided by ' +
      '(1 − D), so at high duty it dominates and the conversion ratio turns back down.',
  },
  'inductor-energy': {
    name: 'Inductor energy, ½L·i²',
    def:
      'The energy an inductor holds at current i. In discontinuous conduction it starts each cycle at ' +
      'zero and ends the cycle back at zero, so ½L·i_pk²·f_s is exactly the power passing through — ' +
      'which for a buck-boost is the whole output power.',
  },
  'k-parameter': {
    name: 'K = 2·L·f_s/R',
    def:
      'The dimensionless number that decides the conduction mode: the ratio of the inductor’s ' +
      'reluctance to change current to the load’s appetite for it. Conduction is continuous while K ' +
      'exceeds a critical value that depends only on D — for the buck, 1 − D.',
  },
  'conduction-loss': {
    name: 'Conduction loss',
    def:
      'Power lost in the resistances and diode drops that carry the current: I²R in the switch, ' +
      'winding and ESR, and V_f·I in the diode. It grows with load — twice the current, four times the ' +
      'I²R loss — and the diode’s share is why synchronous converters exist.',
  },
  'switching-loss': {
    name: 'Switching loss',
    def:
      'Energy lost each time the switch changes state, while it briefly holds both voltage and ' +
      'current. Modelled here as ½·V·I·t per edge, it scales with switching frequency — the price of ' +
      'the smaller ripple that a higher f_s buys.',
  },
  rectifier: {
    name: 'Rectifier',
    def:
      'Diodes arranged so current can only flow one way into the load, turning AC into a pulsing DC. ' +
      'With a capacitor after them it becomes a peak detector: the diodes conduct only near each peak, ' +
      'in short gulps, and the capacitor carries the load between.',
  },
  'conduction-angle': {
    name: 'Conduction angle',
    def:
      'The part of each 360° line cycle during which a diode conducts, in degrees. A capacitor-input ' +
      'rectifier conducts for a few tens of degrees per pulse; the smaller the angle, the taller the ' +
      'current spike that must carry the same charge, and the source resistance sets its floor.',
  },
  'form-factor': {
    name: 'Form factor',
    def:
      'RMS over average of a current, 1 for pure DC. Heating in a winding goes as RMS squared, so a ' +
      'form factor of 3.2 means the winding dissipates 10× more than the DC it delivers would suggest — ' +
      'the reason transformer ratings for capacitor-input rectifiers are derated.',
  },
  piv: {
    name: 'Peak inverse voltage (PIV)',
    def:
      'The largest reverse voltage a diode must block while off. A half-wave rectifier’s diode sees the ' +
      'negative source peak on one side and the charged capacitor on the other, nearly 2·V_p; in a ' +
      'bridge each diode blocks only V_p, and in a six-pulse bridge the peak line-to-line voltage.',
  },
  'power-factor': {
    name: 'Power factor',
    def:
      'Real power over apparent power, P/(V_rms·I_rms): the fraction of the current the supply carries ' +
      'that does work. It is the product of a displacement factor (phase of the fundamental) and a ' +
      'distortion factor (share of the current that is fundamental at all); rectifiers lose it to the second.',
  },
  displacement: {
    name: 'Displacement and distortion',
    def:
      'The two factors of power factor. Displacement is cos φ₁, the cosine of the angle between the ' +
      'voltage and the fundamental of the current — what a capacitor across the line can correct. ' +
      'Distortion is I₁/I_rms, the fundamental’s share of the current — what only a filter or a ' +
      'better front end can.',
  },
  thd: {
    name: 'Total harmonic distortion (THD)',
    def:
      'The RMS of everything in a current except its fundamental, over the fundamental: ' +
      '√(I_rms² − I₁²)/I₁. Zero for a sine; over 100 % when the harmonics together outweigh the ' +
      'fundamental, as a capacitor-input rectifier’s spikes do. Distortion factor = 1/√(1 + THD²).',
  },
  harmonic: {
    name: 'Harmonic',
    def:
      'A sine at an integer multiple of the line frequency. Any periodic current is a sum of them, and ' +
      'only the one at the line frequency — the fundamental — can carry power from a sinusoidal source; ' +
      'the rest heat wires and transformers. A waveform whose two half-cycles mirror has only odd ones.',
  },
  'phase-cut': {
    name: 'Phase-cut',
    def:
      'Delaying the turn-on of a switch by an angle α into each half-cycle and letting it conduct to ' +
      'the zero crossing, which is what a triac in a light dimmer does. It controls power with no ' +
      'dissipation in the switch, at the cost of a sharp current edge every half-cycle.',
  },
  'six-pulse': {
    name: 'Six-pulse bridge',
    def:
      'Six diodes on three phases: the two phases furthest apart at each instant conduct, the pair ' +
      'changes every 60°, and the output has six pulses per line cycle. Its output sits near the ' +
      'peak line-to-line voltage, √3 times a phase peak, and its line current has no triplen harmonics.',
  },
}

export function termsFor(ids = []) {
  return ids.map((id) => ({ id, ...TERMS[id] })).filter((t) => t.name)
}
