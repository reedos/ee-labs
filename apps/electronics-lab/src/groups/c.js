// Group C: inside the junction.
//
// Circuit Elements Lab gave Shockley's law as a fact. Every later number in
// this lab that is not a resistor value comes from the junction, and this is
// where the reader sees that. Four closed forms, each read at the bias a real
// circuit sets, so C_d follows the current rather than a number typed beside
// it and the slope of V_BE follows where the junction is actually working.
//
// Two circuits, because the two halves of the group ask two different
// questions. C1 and C2 hold a voltage across the junction and ask what the
// depletion region does. C3 and C4 hold a current through it and ask what the
// stored charge and the temperature do, which is how a mirror biases a
// transistor and how every later group meets the junction.
//
// The doping is the plan's: 10¹⁷ and 10¹⁶ cm⁻³, written here in m⁻³ because
// that is what the formulas take.

import { Cap, Dope, Is, R, SatI, Temp, Vs, W, H, TOP, BOT, chips, gnd, leg, node, wire } from '../knobs.js'

const GROUP = 'C · Inside the junction'

/** The junction's own parameters, the plan's §4.3 defaults. */
export const JUNCTION = { na: 1e23, nd: 1e22, cj0: 2e-12, tauF: 0.5e-9, cje: 0.7e-12, cmu: 2e-12, is: 1e-14, T: 300 }

const kT_q = (T) => (1.380649e-23 * T) / 1.602176634e-19

/** The junction held at a voltage: a source, a resistor, and the diode. */
const heldAtVoltage = (p) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.vsrc },
    { type: 'R', id: 'R1', nodes: ['in', 'a'], value: p.R1 },
    { type: 'D', id: 'D1', nodes: ['a', 'gnd'], model: 'exp', is: p.is, vt: kT_q(p.T) },
  ],
})

/** The junction held at a current, which is what a mirror does. */
const heldAtCurrent = (p) => ({
  elements: [
    { type: 'I', id: 'I1', nodes: ['gnd', 'a'], value: p.i },
    { type: 'D', id: 'D1', nodes: ['a', 'gnd'], model: 'exp', is: p.is, vt: kT_q(p.T) },
  ],
})

function voltageLayout() {
  return {
    w: W,
    h: H,
    items: [
      ...leg('V1', 60),
      wire(60, TOP, 130, TOP),
      { el: 'R1', x: 160, y: TOP, dir: 'h' },
      wire(190, TOP, 260, TOP),
      wire(260, TOP, 260, 70),
      { el: 'D1', x: 260, y: 90, dir: 'v' },
      wire(260, 110, 260, BOT),
      wire(60, BOT, 260, BOT),
      gnd(160, BOT),
      node('in', 60, TOP, 't'),
      node('a', 260, 40, 't'),
    ],
  }
}

function currentLayout() {
  return {
    w: W,
    h: H,
    items: [
      ...leg('I1', 120, 90, true),
      wire(120, TOP, 260, TOP),
      wire(260, TOP, 260, 70),
      { el: 'D1', x: 260, y: 90, dir: 'v' },
      wire(260, 110, 260, BOT),
      wire(120, BOT, 260, BOT),
      gnd(190, BOT),
      node('a', 260, 40, 't'),
    ],
  }
}

const DOPING = [chips(Dope('na', 'Acceptors N_A', JUNCTION.na), [1e22, 1e23, 1e24]), chips(Dope('nd', 'Donors N_D', JUNCTION.nd), [1e21, 1e22, 1e23])]
const SAT = SatI('is', 'Saturation current I_S', JUNCTION.is)
const TEMP = Temp('T', 'Temperature T', 300)

export const GROUP_C = [
  {
    id: 'c1',
    group: GROUP,
    name: 'Where the exponential comes from',
    terms: ['junction', 'depletion', 'builtin'],
    params: [chips(Vs('vsrc', 'Applied bias', 0), [-10, -5, 0]), ...DOPING, R('R1', 'Series R₁', 1000), TEMP, SAT],
    net: heldAtVoltage,
    layout: voltageLayout(),
    show: 'dc',
    view: 'junction',
    views: ['reading', 'junction', 'equations'],
    junction: true,
    headline: { path: 'junction.v0', label: 'V₀', unit: 'V' },
  },
  {
    id: 'c2',
    group: GROUP,
    name: 'Junction capacitance follows the width',
    terms: ['junction', 'depletion', 'junctioncap'],
    params: [
      chips(Vs('vsrc', 'Applied bias', -5), [-10, -5, 0]),
      chips(Cap('cj0', 'Zero-bias C_j0', 2e-12), [1e-12, 2e-12, 10e-12]),
      ...DOPING,
      R('R1', 'Series R₁', 1000),
      TEMP,
      SAT,
    ],
    net: heldAtVoltage,
    layout: voltageLayout(),
    show: 'dc',
    view: 'junction',
    views: ['reading', 'junction', 'equations'],
    junction: true,
    headline: { path: 'junction.cj', label: 'C_j', unit: 'F' },
  },
  {
    id: 'c3',
    group: GROUP,
    name: 'Diffusion capacitance and the transit time',
    terms: ['diffusioncap', 'transit', 'transitfreq'],
    params: [
      chips(Is('i', 'Bias current I', 1e-3), [0.25e-3, 1e-3, 4e-3]),
      chips(Cap('tauF', 'Transit time τ_F', 0.5e-9), [0.1e-9, 0.5e-9, 2e-9]),
      Cap('cje', 'Emitter C_je', 0.7e-12),
      Cap('cmu', 'Collector C_µ', 2e-12),
      TEMP,
      SAT,
      ...DOPING,
    ],
    net: heldAtCurrent,
    layout: currentLayout(),
    show: 'dc',
    view: 'junction',
    views: ['reading', 'junction', 'equations'],
    junction: true,
    headline: { path: 'junction.cd', label: 'C_d', unit: 'F' },
  },
  {
    id: 'c4',
    group: GROUP,
    name: 'Temperature moves the whole curve',
    terms: ['saturationcurrent', 'tempco'],
    params: [chips(TEMP, [250, 300, 350]), chips(Is('i', 'Bias current I', 5.77e-3), [0.12e-3, 1e-3, 5.77e-3]), SAT, ...DOPING],
    net: heldAtCurrent,
    layout: currentLayout(),
    show: 'dc',
    view: 'junction',
    views: ['reading', 'junction', 'equations'],
    junction: true,
    headline: { path: 'junction.slope', label: 'dV_BE/dT', unit: 'V/K' },
  },
]
