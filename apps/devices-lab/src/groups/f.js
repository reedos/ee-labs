// Group F: the solar cell and the LED.
//
// The same junction, run both ways. A photocurrent in parallel with Shockley's
// law is a solar cell, and every quantity on the curve is a closed form except
// the maximum power point, which is a root-find on dP/dV.
//
// F3 turns the junction round. The photon carries the band gap away, so the
// wavelength is hc/E_g and four materials are four numbers taken from data.

import { Amps, Area, MATERIAL, Res, SatI, Sun, Temp, chips } from '../knobs.js'

const GROUP = 'F · The solar cell and the LED'

const IS = chips(SatI('is', 'Saturation current I_S', 1e-12), [1e-14, 1e-12, 1e-10])
const IL = chips(Amps('il', 'Photocurrent I_L', 35e-3), [3.5e-3, 35e-3, 350e-3])
const AREA = Area('area', 'Cell area', 1e-4)
const RS = chips(Res('rs', 'Series resistance R_s', 0), [0, 1, 10])
const SUN = chips(Sun('irradiance', 'Irradiance', 1000), [100, 1000, 10000])
const TEMP = Temp('T', 'Temperature T', 300)
const VIEWS = ['reading', 'curves', 'equations']

export const GROUP_F = [
  {
    id: 'f1',
    group: GROUP,
    name: 'A junction with a photocurrent',
    terms: ['photocurrent', 'opencircuit'],
    params: [IL, IS, AREA, RS, SUN, TEMP],
    structure: 'cell',
    view: 'curves',
    views: VIEWS,
    headline: { path: 'pv.voc', label: 'V_oc', unit: 'V' },
  },
  {
    id: 'f2',
    group: GROUP,
    name: 'The maximum power point, and the fill factor',
    terms: ['maxpower', 'fillfactor', 'efficiency'],
    params: [IL, IS, AREA, SUN, RS, TEMP],
    structure: 'cell',
    view: 'curves',
    views: VIEWS,
    headline: { path: 'pv.pmax', label: 'P_max', unit: 'W' },
  },
  {
    id: 'f3',
    group: GROUP,
    name: 'The two losses, and the junction run backwards',
    terms: ['emission'],
    params: [MATERIAL(), IS, IL, RS, AREA, SUN, TEMP],
    structure: 'led',
    view: 'reading',
    views: VIEWS,
    headline: { path: 'led.wavelength', label: 'Wavelength', unit: 'm' },
  },
]
