// The knobs, and the shapes an experiment is built from.
//
// A knob is the Energy Lab's: a key, a label, a unit, a range and a default,
// or a `choice` with named positions. Every knob an experiment lists has to
// change that experiment's analysis, and `experiments.test.js` moves each one
// to check that it does.

/** A numeric knob. */
export const num = (key, label, unit, def, min, max, over = {}) => ({
  key,
  label,
  unit,
  default: def,
  min,
  max,
  scale: 'linear',
  ...over,
})

/** A knob with named positions. */
export const choice = (key, label, def, options, hint) => ({ key, label, kind: 'choice', default: def, options, hint })

/** A two-position knob. */
export const toggle = (key, label, def, on, off, hint) => ({ key, label, kind: 'toggle', default: def, on, off, hint })

// ------------------------------------------------------------ per unit
export const Sbase = (def = 100) => num('Sbase', 'Base power', 'MVA', def, 10, 500, { step: 5, eng: false, hint: 'The three-phase base every per-unit number is written on' })
export const Vbase = (def = 230) => num('Vbase', 'Base voltage', 'kV', def, 60, 765, { step: 1, eng: false, hint: 'Line to line, at the high-voltage zone' })
export const VbaseLow = (def = 13.8) => num('VbaseLow', 'Low-side base', 'kV', def, 4, 40, { step: 0.1, eng: false, hint: 'Line to line, on the other side of the transformer' })
export const Zgen = (def = 0.2) => num('zGen', 'Generator reactance', 'pu', def, 0.05, 0.5, { step: 0.01, eng: false, hint: 'On the generator’s own rating' })
export const Sgen = (def = 90) => num('Sgen', 'Generator rating', 'MVA', def, 20, 400, { step: 5, eng: false, hint: 'The rating the reactance was quoted on' })
export const Ztx = (def = 0.1) => num('zTx', 'Transformer reactance', 'pu', def, 0.02, 0.3, { step: 0.005, eng: false, hint: 'On the transformer’s own rating' })
export const Stx = (def = 150) => num('Stx', 'Transformer rating', 'MVA', def, 20, 500, { step: 5, eng: false, hint: 'The rating the reactance was quoted on' })
export const Pmw = (def = 60) => num('Pmw', 'Load', 'MW', def, 5, 200, { step: 1, eng: false, hint: 'Real power the load takes' })
export const Pf = (def = 0.85) => num('pf', 'Power factor', '', def, 0.5, 1, { step: 0.01, eng: false, hint: 'Lagging, so the load takes reactive power too' })
export const Vpu = (def = 0.9) => num('Vpu', 'Voltage at the load', 'pu', def, 0.8, 1.05, { step: 0.01, eng: false, hint: 'Where the two load models are compared' })

// ------------------------------------------------------------ three phase
export const Vll = (def = 230) => num('Vll', 'Line voltage', 'kV', def, 60, 765, { step: 1, eng: false, hint: 'Between two lines, which is what a nameplate quotes' })
export const Rphase = (def = 100) => num('R', 'R per phase', 'Ω', def, 10, 400, { step: 1, eng: false, hint: 'The resistance of one leg of the wye' })
export const Xphase = (def = 50) => num('X', 'X per phase', 'Ω', def, 0, 300, { step: 1, eng: false, hint: 'The reactance of one leg of the wye' })
export const Rdelta = (def = 300) => num('Rdelta', 'R per leg', 'Ω', def, 30, 1200, { step: 5, eng: false, hint: 'One leg of the delta, which is three times the wye' })
export const Ia = (def = 10) => num('Ia', 'I_a', 'A', def, 0, 20, { step: 0.1, eng: false, hint: 'Magnitude of the first phase current' })
export const Ib = (def = 6) => num('Ib', 'I_b', 'A', def, 0, 20, { step: 0.1, eng: false, hint: 'Magnitude of the second phase current' })
export const Ic = (def = 8) => num('Ic', 'I_c', 'A', def, 0, 20, { step: 0.1, eng: false, hint: 'Magnitude of the third phase current' })
export const AngB = (def = -150) => num('angB', 'Angle of I_b', '°', def, -180, 180, { step: 1, eng: false, hint: 'A balanced set would put it at −120°' })
export const AngC = (def = 100) => num('angC', 'Angle of I_c', '°', def, -180, 180, { step: 1, eng: false, hint: 'A balanced set would put it at +120°' })

// ------------------------------------------------------------ the line
export const Km = (def = 100) => num('km', 'Line length', 'km', def, 20, 900, { step: 10, eng: false, hint: 'The whole line, lumped into one π model' })
export const Loading = (def = 1) => num('loading', 'Loading', 'SIL', def, 0.1, 3, { step: 0.05, eng: false, hint: 'In multiples of the surge impedance loading' })
export const Xtx = (def = 0.1) => num('X', 'Transformer X', 'pu', def, 0.02, 0.3, { step: 0.005, eng: false, hint: 'The series reactance between the two buses' })
export const Pload = (def = 0.8) => num('Pload', 'Load P', 'pu', def, 0.1, 1.5, { step: 0.05, eng: false, hint: 'Real power at the receiving bus' })
export const Qload = (def = 0.6) => num('Qload', 'Load Q', 'pu', def, 0, 1.2, { step: 0.05, eng: false, hint: 'Reactive power at the receiving bus' })
export const Tap = (def = 1) => num('tap', 'Tap ratio', '', def, 0.9, 1.15, { step: 0.00625, eng: false, hint: 'Off-nominal, in the 0.625 % steps a tap changer takes' })
export const Bsh = (def = 0) => num('Bsh', 'Shunt capacitance', 'pu', def, 0, 1.2, { step: 0.05, eng: false, hint: 'A capacitor bank at the receiving bus' })

// ------------------------------------------------------------ power flow
export const Load = (def = 1) => num('load', 'Loading', '×', def, 0.2, 4.3, { step: 0.05, eng: false, hint: 'Every load and every generator, scaled together' })
export const Qmax = (def = 3) => num('Qmax', 'Bus 2 Q_max', 'pu', def, 0.1, 8, { step: 0.01, eng: false, hint: 'The most reactive power the generator can make' })
export const V2 = (def = 1) => num('V2', 'Bus 2 setpoint', 'pu', def, 0.95, 1.06, { step: 0.005, eng: false, hint: 'The magnitude the generator holds while it can' })

// ------------------------------------------------------------ faults
export const Xg = (def = 0.15) => num('Xg', 'Generator X″', 'pu', def, 0.05, 0.4, { step: 0.01, eng: false, hint: 'The subtransient reactance a breaker sees' })
export const Xg0 = (def = 0.05) => num('Xg0', 'Generator X_0', 'pu', def, 0.01, 0.3, { step: 0.01, eng: false, hint: 'Its zero-sequence reactance' })
export const Xt = (def = 0.1) => num('Xt', 'Transformer X', 'pu', def, 0.02, 0.3, { step: 0.005, eng: false, hint: 'The same in all three sequence networks' })
export const Xl = (def = 0.2) => num('Xl', 'Line X_1', 'pu', def, 0.05, 0.6, { step: 0.01, eng: false, hint: 'Positive and negative sequence are equal on a line' })
export const Xl0 = (def = 0.6) => num('Xl0', 'Line X_0', 'pu', def, 0.1, 1.5, { step: 0.05, eng: false, hint: 'A separate number, not a multiple of X_1' })
export const Zn = (def = 0) => num('Zn', 'Neutral impedance', 'pu', def, 0, 0.4, { step: 0.01, eng: false, hint: 'Between the generator’s star point and earth' })
export const Zf = (def = 0) => num('Zf', 'Fault impedance', 'pu', def, 0, 0.5, { step: 0.01, eng: false, hint: 'Between the conductor and what it touches' })
export const WINDING = choice(
  'connection',
  'Winding connection',
  'delta-wyeg',
  [
    { value: 'delta-wyeg', label: 'Δ–Yg' },
    { value: 'wyeg-wyeg', label: 'Yg–Yg' },
    { value: 'delta-delta', label: 'Δ–Δ' },
  ],
  'Which windings the transformer has, and so where zero-sequence current can go',
)
export const FAULT_KIND = choice(
  'fault',
  'Fault',
  '3ph',
  [
    { value: '3ph', label: 'Three phase' },
    { value: 'slg', label: 'To ground' },
    { value: 'll', label: 'Line to line' },
    { value: 'dlg', label: 'Two to ground' },
  ],
  'Which conductors the fault joins, and whether the ground is one of them',
)

// ------------------------------------------------------------ protection
export const Pickup = (def = 400) => num('pickup', 'Pickup', 'A', def, 100, 1200, { step: 10, eng: false, hint: 'The current above which the relay starts timing' })
export const Tds = (def = 0.1) => num('tds', 'Time dial', '', def, 0.05, 1, { step: 0.01, eng: false, hint: 'Multiplies the whole curve' })
export const Ifault = (def = 1600) => num('Ifault', 'Fault current', 'A', def, 500, 8000, { step: 50, eng: false, hint: 'What flows through the relay when the fault is on' })
export const Margin = (def = 0.3) => num('margin', 'Margin', 's', def, 0.1, 0.6, { step: 0.05, eng: false, hint: 'How long the upstream relay waits behind the downstream one' })
export const CURVE = choice(
  'curve',
  'Curve',
  'veryInverse',
  [
    { value: 'standardInverse', label: 'Standard' },
    { value: 'veryInverse', label: 'Very' },
    { value: 'extremelyInverse', label: 'Extremely' },
  ],
  'Which IEC characteristic the relay follows',
)
export const Zline = (def = 40) => num('Zline', 'Line impedance', 'Ω', def, 10, 100, { step: 1, eng: false, hint: 'The whole line the distance relay protects' })
export const FaultKm = (def = 60) => num('faultKm', 'Fault position', 'km', def, 5, 130, { step: 1, eng: false, hint: 'How far along the line the fault is' })
export const TapKm = (def = 30) => num('tapKm', 'Tapped bus', 'km', def, 5, 90, { step: 1, eng: false, hint: 'Where the second source joins the line' })
export const Infeed = (def = 1) => num('infeed', 'Remote infeed', '×', def, 0, 2, { step: 0.05, eng: false, hint: 'The tapped source’s current, as a multiple of the relay’s own' })

// ------------------------------------------------------------ stability
export const H = (def = 4) => num('H', 'Inertia constant', 's', def, 1, 10, { step: 0.1, eng: false, hint: 'H in MJ per MVA, which has units of seconds' })
export const Pm = (def = 1) => num('Pm', 'Mechanical power', 'pu', def, 0.2, 1.6, { step: 0.05, eng: false, hint: 'What the turbine puts into the shaft' })
export const Pre = (def = 2) => num('pre', 'Transfer before', 'pu', def, 1.2, 3, { step: 0.05, eng: false, hint: 'The most power the network could carry before the fault' })
export const During = (def = 0.5) => num('during', 'Transfer during', 'pu', def, 0, 1, { step: 0.05, eng: false, hint: 'What is left while the fault is on' })
export const Post = (def = 1.5) => num('post', 'Transfer after', 'pu', def, 1.05, 2.2, { step: 0.05, eng: false, hint: 'What is left once a line has tripped' })
export const Tc = (def = 0.15) => num('tc', 'Clearing time', 's', def, 0.01, 0.4, { step: 0.005, eng: false, hint: 'How long the fault stays on' })
export const Step = (def = 0.001) => num('step', 'Integrator step', 's', def, 0.0001, 0.05, { scale: 'log', eng: false, hint: 'The fixed step the RK4 solver takes' })

// ------------------------------------------------------------ dispatch
export const Demand = (def = 800) => num('demand', 'Demand', 'MW', def, 200, 1200, { step: 5, eng: false, hint: 'What the three units must total' })
export const Cap1 = (def = 600) => num('cap1', 'Unit 1 maximum', 'MW', def, 200, 600, { step: 10, eng: false, hint: 'The most unit 1 may put out' })
