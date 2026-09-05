// Group A: carriers and doping.
//
// One piece of silicon, doped. Nothing is bent yet and there is no junction, so
// the whole group runs on the neutrality solve and the law of mass action. The
// band diagram is four flat lines, and the only one that moves when the doping
// moves is the Fermi level.
//
// Every doping here is in m⁻³, so 10¹⁶ cm⁻³ is 10²² and 10¹⁷ cm⁻³ is 10²³.

import { Dope, Gap, Temp, chips } from '../knobs.js'

const GROUP = 'A · Carriers and doping'

const DONORS = chips(Dope('nd', 'Donors N_D', 1e22), [1e21, 1e22, 1e23])
const ACCEPTORS = chips(Dope('na', 'Acceptors N_A', 1e16), [1e16, 1e22, 1e23])
const TEMP = Temp('T', 'Temperature T', 300)
const VIEWS = ['reading', 'band', 'equations']

export const GROUP_A = [
  {
    id: 'a1',
    group: GROUP,
    name: 'Two carriers, one product',
    terms: ['carrier', 'doping', 'massaction', 'intrinsic'],
    params: [DONORS, ACCEPTORS, TEMP],
    structure: 'bulk',
    view: 'reading',
    views: VIEWS,
    headline: { path: 'carrier.p', label: 'p', unit: 'm⁻³' },
  },
  {
    id: 'a2',
    group: GROUP,
    name: 'Where n_i comes from, and why books differ',
    terms: ['bandgap', 'bandedge'],
    params: [
      chips(Gap('eg', 'Band gap E_g', 1.12), [1.0, 1.12, 1.2]),
      chips(Dope('nc', 'Conduction edge N_c', 2.86e25), [2.5e25, 2.86e25, 3.2e25]),
      chips(Dope('nv', 'Valence edge N_v', 2.66e25), [2.2e25, 2.66e25, 3.0e25]),
      TEMP,
      DONORS,
    ],
    structure: 'bulk',
    view: 'reading',
    views: VIEWS,
    headline: { path: 'carrier.niComputed', label: 'n_i computed', unit: 'm⁻³' },
  },
  {
    id: 'a3',
    group: GROUP,
    name: 'Temperature runs the intrinsic carriers',
    terms: ['extrinsic'],
    params: [chips(TEMP, [250, 300, 400]), chips(Dope('nd', 'Donors N_D', 1e22), [1e19, 1e22, 1e23]), ACCEPTORS],
    structure: 'bulk',
    view: 'reading',
    views: VIEWS,
    headline: { path: 'carrier.ni', label: 'n_i', unit: 'm⁻³' },
  },
  {
    id: 'a4',
    group: GROUP,
    name: 'The Fermi level as a reading of doping',
    terms: ['fermilevel'],
    params: [DONORS, ACCEPTORS, TEMP],
    structure: 'bulk',
    view: 'band',
    views: VIEWS,
    headline: { path: 'carrier.efi', label: 'E_F − E_i', unit: 'V' },
  },
  {
    id: 'a5',
    group: GROUP,
    name: 'The band diagram of one piece of silicon',
    terms: ['banddiagram'],
    params: [DONORS, ACCEPTORS, chips(Gap('eg', 'Band gap E_g', 1.12), [1.0, 1.12, 1.2]), TEMP],
    structure: 'bulk',
    view: 'band',
    views: VIEWS,
    headline: { path: 'carrier.barrier', label: 'E_c − E_F', unit: 'V' },
  },
]
