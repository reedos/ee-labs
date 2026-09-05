// Group B: the junction in depth.
//
// The same step junction throughout, at 10¹⁷ and 10¹⁶ cm⁻³ over 10⁻⁴ cm². The
// bias knob is the one every pane in the group redraws on, because the whole
// group is one structure read at different biases.
//
// B1 to B3 walk Poisson's equation. B4 turns the barrier into a current, B5
// turns the charge into a capacitance, and B6 turns the field into a rating.

import { Area, Bias, Diff, Dope, Field, Life, Mob, Temp, chips } from '../knobs.js'

const GROUP = 'B · The junction in depth'

const NA = chips(Dope('na', 'Acceptors N_A', 1e23), [1e21, 1e23, 1e25])
const ND = chips(Dope('nd', 'Donors N_D', 1e22), [1e21, 1e22, 1e24])
const AREA = Area('area', 'Junction area', 1e-8)
const TEMP = Temp('T', 'Temperature T', 300)
const BIAS = chips(Bias('v', 'Applied bias v', 0), [-10, -5, -1, 0, 0.5])
const VIEWS = ['reading', 'profile', 'equations']

export const GROUP_B = [
  {
    id: 'b1',
    group: GROUP,
    name: 'The charge that is left behind',
    terms: ['depletion', 'neutrality', 'stepjunction'],
    params: [NA, ND, BIAS, AREA, TEMP],
    structure: 'junction',
    view: 'profile',
    views: VIEWS,
    headline: { path: 'j.xn', label: 'x_n', unit: 'm' },
  },
  {
    id: 'b2',
    group: GROUP,
    name: 'Integrate once for the field',
    terms: ['poisson', 'gauss'],
    params: [NA, ND, BIAS, AREA, TEMP],
    structure: 'junction',
    view: 'profile',
    views: VIEWS,
    headline: { path: 'j.emax', label: 'E_max', unit: 'V/m' },
  },
  {
    id: 'b3',
    group: GROUP,
    name: 'Integrate again for the potential',
    terms: ['builtin'],
    params: [NA, ND, BIAS, AREA, TEMP],
    structure: 'junction',
    view: 'profile',
    views: VIEWS,
    headline: { path: 'j.v0', label: 'V₀', unit: 'V' },
  },
  {
    id: 'b4',
    group: GROUP,
    name: 'The exponential, from the barrier',
    terms: ['saturationcurrent', 'diffusionlength', 'einstein'],
    params: [
      NA,
      ND,
      AREA,
      chips(Mob('mup', 'Hole mobility µ_p', 0.045), [0.02, 0.045, 0.1]),
      chips(Mob('mun', 'Electron mobility µ_n', 0.11), [0.05, 0.11, 0.14]),
      chips(Life('taup', 'Hole lifetime τ_p', 1e-6), [1e-7, 1e-6, 1e-5]),
      chips(Life('taun', 'Electron lifetime τ_n', 1e-6), [1e-7, 1e-6, 1e-5]),
      TEMP,
      BIAS,
    ],
    structure: 'junction',
    view: 'reading',
    views: VIEWS,
    headline: { path: 'j.is', label: 'I_S', unit: 'A' },
  },
  {
    id: 'b5',
    group: GROUP,
    name: 'The capacitance is the profile’s derivative',
    terms: ['junctioncap'],
    params: [chips(Bias('v', 'Applied bias v', -5), [-10, -5, -1, 0, 0.5]), NA, ND, AREA, TEMP],
    structure: 'junction',
    view: 'profile',
    views: VIEWS,
    headline: { path: 'j.cj', label: 'C_j', unit: 'F/m²' },
  },
  {
    id: 'b6',
    group: GROUP,
    name: 'Breakdown is a field reaching a number',
    terms: ['breakdown', 'avalanche', 'tunnelling'],
    params: [
      chips(Dope('na', 'Acceptors N_A', 1e25), [1e23, 1e25]),
      chips(Dope('nd', 'Donors N_D', 1e21), [1e21, 1e22, 1e23, 1e24]),
      chips(Field('ecrit', 'Critical field E_crit', 3e7), [3e7, 1e8]),
      chips(Bias('v', 'Applied bias v', -3), [-10, -5, -3, 0]),
      AREA,
      TEMP,
    ],
    structure: 'junction',
    view: 'profile',
    views: VIEWS,
    headline: { path: 'j.vbr', label: 'V_BR', unit: 'V' },
  },
]
