// Group C: the MOS capacitor.
//
// A gate, an oxide and a doped substrate. The process is the plan's: 10¹⁷ cm⁻³
// under 10 nm of oxide with an n⁺ polysilicon gate. The gate knob is what every
// pane here redraws on, because the three regimes are three ranges of it.
//
// C5 is where this lab and the Electronics Lab meet. The derivation lands on
// 322 mV and that lab's transistor was given 700 mV, and the implant knob is
// the difference.

import { Choice, Dope, GATE, Sheet, Temp, Thin, Volt, chips } from '../knobs.js'

const GROUP = 'C · The MOS capacitor'

const NA = chips(Dope('na', 'Substrate N_A', 1e23), [1e21, 1e22, 1e23, 1e24])
const TOX = chips(Thin('tox', 'Oxide thickness t_ox', 10e-9), [5e-9, 10e-9, 20e-9, 50e-9])
const TEMP = Temp('T', 'Temperature T', 300)
const VG = chips(
  { key: 'vg', label: 'Gate voltage V_G', unit: 'V', min: -5, max: 5, scale: 'linear', default: 0 },
  [-2, 0, 1, 2],
)
const IMPLANT = chips(Sheet('implant', 'Threshold implant', 1e12), [1e12, 8.15193e15])
const QF = chips(Sheet('qf', 'Fixed oxide charge Q_f', 1e12), [1e12, 2.15528e15])
const FREQ = Choice(
  'freq',
  'Measurement frequency',
  'high',
  [
    { value: 'high', label: 'high' },
    { value: 'low', label: 'low' },
  ],
  'Which of the two curves the readout follows',
)
const VIEWS = ['reading', 'cv', 'equations']

export const GROUP_C = [
  {
    id: 'c1',
    group: GROUP,
    name: 'Three layers, one capacitor',
    terms: ['oxidecap', 'moscapacitor'],
    params: [TOX, NA, VG, GATE(), TEMP],
    structure: 'mos',
    view: 'reading',
    views: VIEWS,
    headline: { path: 'mos.cox', label: 'C_ox', unit: 'F/m²' },
  },
  {
    id: 'c2',
    group: GROUP,
    name: 'Accumulation, depletion, inversion',
    terms: ['accumulation', 'inversion', 'bulkpotential', 'surfacepotential', 'threshold'],
    params: [VG, NA, TOX, GATE(), TEMP],
    structure: 'mos',
    view: 'cv',
    views: VIEWS,
    headline: { path: 'mos.wmax', label: 'W_max', unit: 'm' },
  },
  {
    id: 'c3',
    group: GROUP,
    name: 'The C–V curve, and what it reads',
    terms: ['cvcurve'],
    params: [NA, TOX, VG, GATE(), TEMP],
    structure: 'mos',
    view: 'cv',
    views: VIEWS,
    headline: { path: 'mos.ratio', label: 'C_min/C_ox', unit: '' },
  },
  {
    id: 'c4',
    group: GROUP,
    name: 'Two frequencies, two curves',
    terms: ['generationrate'],
    params: [FREQ, chips({ ...VG, default: 2 }, [-2, 0, 1, 2]), NA, TOX, GATE(), TEMP],
    structure: 'mos',
    view: 'cv',
    views: VIEWS,
    headline: { path: 'mos.c', label: 'C', unit: 'F/m²' },
  },
  {
    id: 'c5',
    group: GROUP,
    name: 'The threshold, in four terms',
    terms: ['flatband', 'implant'],
    params: [IMPLANT, QF, NA, TOX, GATE(), VG, TEMP],
    structure: 'mos',
    view: 'reading',
    views: VIEWS,
    headline: { path: 'mos.vt', label: 'V_T', unit: 'V' },
  },
]
