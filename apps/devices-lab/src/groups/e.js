// Group E: the BJT from two junctions.
//
// Two junctions sharing a base is a transistor when the base is thin. The
// structure is the plan's: an emitter doped 10¹⁹ cm⁻³ over 0.3 µm, a base at
// 10¹⁷ cm⁻³ over 0.5 µm, and a collector at 10¹⁶ cm⁻³.
//
// The two diffusion constants are data here, because a mobility at a doping is
// a measured curve rather than a consequence. Everything else in the group
// comes off the two Gummel numbers.

import { Amps, Area, Diff, Dope, Len, Temp, Volt, chips } from '../knobs.js'

const GROUP = 'E · The BJT from two junctions'

const NE = chips(Dope('ne', 'Emitter N_E', 1e25), [1e24, 1e25, 1e26])
const WE = chips(Len('we', 'Emitter thickness W_E', 0.3e-6), [0.15e-6, 0.3e-6, 0.6e-6])
const NB = chips(Dope('nb', 'Base N_B', 1e23), [1e22, 1e23, 1e24])
const WB = chips(Len('wb', 'Base thickness W_B', 0.5e-6), [0.25e-6, 0.5e-6, 1e-6])
const NC = chips(Dope('nc', 'Collector N_C', 1e22), [1e21, 1e22, 1e23])
const AREA = Area('area', 'Emitter area', 1e-8)
const DB = Diff('db', 'Base diffusion D_B', 1.0341e-3)
const DE = Diff('de', 'Emitter diffusion D_E', 1.2926e-4)
const VCB = chips(Volt('vcb', 'Collector–base bias V_CB', 5), [0, 2, 5, 10])
const IC = chips(Amps('ic', 'Collector current I_C', 1e-3), [1e-4, 1e-3, 1e-2])
const TEMP = Temp('T', 'Temperature T', 300)
const VIEWS = ['reading', 'equations']

export const GROUP_E = [
  {
    id: 'e1',
    group: GROUP,
    name: 'Two junctions, one thin base',
    terms: ['neutralbase'],
    params: [VCB, WB, NB, NC, NE, WE, AREA, DB, DE, IC, TEMP],
    structure: 'bjt',
    view: 'reading',
    views: VIEWS,
    headline: { path: 'bjt.neutralBase', label: 'Neutral base', unit: 'm' },
  },
  {
    id: 'e2',
    group: GROUP,
    name: 'The Gummel numbers set I_S and β',
    terms: ['gummelnumber', 'currentgain'],
    params: [NE, WE, NB, WB, AREA, DB, DE, IC, NC, VCB, TEMP],
    structure: 'bjt',
    view: 'reading',
    views: VIEWS,
    headline: { path: 'bjt.is', label: 'I_S', unit: 'A' },
  },
  {
    id: 'e3',
    group: GROUP,
    name: 'The base transit time caps the speed',
    terms: ['transittime'],
    params: [WB, DB, NB, NE, WE, AREA, DE, NC, VCB, IC, TEMP],
    structure: 'bjt',
    view: 'reading',
    views: VIEWS,
    headline: { path: 'bjt.tauB', label: 'τ_B', unit: 's' },
  },
  {
    id: 'e4',
    group: GROUP,
    name: 'The Early voltage from the profile',
    terms: ['earlyvoltage'],
    params: [VCB, NC, NB, WB, NE, WE, AREA, DB, DE, IC, TEMP],
    structure: 'bjt',
    view: 'reading',
    views: VIEWS,
    headline: { path: 'bjt.va', label: 'V_A', unit: 'V' },
  },
]
