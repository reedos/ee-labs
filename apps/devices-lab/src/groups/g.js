// Group G: fabrication, and the number each step sets.
//
// The two structures the earlier groups used, built step by step. The step
// slider walks the cross-section, and each step carries the one quantity a
// previous group took as a knob: the implant dose sets the doping, the oxide
// growth sets C_ox, and the threshold implant sets V_T.
//
// This is the arithmetic of each step, not a process simulation. A diffusion
// profile from a real thermal budget needs a tool this suite does not have.

import { Choice, Dope, Len, Mob, Ratio, Sheet, Temp, Thin, Volt, chips } from '../knobs.js'

const GROUP = 'G · Fabrication'

const TEMP = Temp('T', 'Temperature T', 300)
const STEP = (steps) =>
  Choice(
    'step',
    'Process step',
    steps - 1,
    Array.from({ length: steps }, (_, k) => ({ value: k, label: String(k + 1) })),
    'Which step of the sequence the cross-section shows',
  )

export const GROUP_G = [
  {
    id: 'g1',
    group: GROUP,
    name: 'A junction, step by step',
    terms: ['implantdose', 'drivein'],
    params: [
      chips(Sheet('dose', 'Implant dose', 1e16), [1e15, 1e16, 1e17]),
      chips(Len('depth', 'Junction depth', 0.1e-6), [0.05e-6, 0.1e-6, 0.5e-6]),
      chips(Dope('nd', 'Substrate N_D', 1e22), [1e21, 1e22, 1e23]),
      STEP(6),
      TEMP,
    ],
    structure: 'fab',
    recipe: 'junction',
    view: 'sequence',
    views: ['reading', 'sequence', 'equations'],
    headline: { path: 'fab.v0', label: 'V₀', unit: 'V' },
  },
  {
    id: 'g2',
    group: GROUP,
    name: 'A MOSFET, step by step',
    terms: [],
    params: [
      chips(Thin('tox', 'Gate oxide t_ox', 10e-9), [5e-9, 10e-9, 20e-9]),
      chips(Sheet('implant', 'Threshold implant', 8.15193e15), [1e12, 8.15193e15]),
      chips(Sheet('dose', 'Substrate implant dose', 1e16), [1e15, 1e16, 1e17]),
      chips(Len('depth', 'Implant depth', 0.1e-6), [0.05e-6, 0.1e-6, 0.5e-6]),
      chips(Volt('vgs', 'Gate voltage V_GS', 1.2), [0.9, 1.2, 1.7]),
      Volt('vds', 'Drain voltage V_DS', 1),
      Ratio('wOverL', 'Width over length W/L', 10),
      Mob('mun', 'Electron mobility µ_n', 0.05),
      STEP(6),
      TEMP,
    ],
    structure: 'fab',
    recipe: 'mosfet',
    view: 'sequence',
    views: ['reading', 'sequence', 'equations'],
    headline: { path: 'fab.id', label: 'I_D', unit: 'A' },
  },
]
