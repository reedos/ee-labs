// Group D: the MOSFET.
//
// The same capacitor as Group C with a source, a drain and a channel between
// them. The threshold carries the implant of C5, so every current here is the
// current of a device with a 700 mV threshold, which is the one the Electronics
// Lab was given.
//
// The gradual-channel argument is the labelled model, and D2 shows the closed
// form beside the integral it came from rather than asserting the two agree.

import { Dope, Lam, Len, Mob, Ratio, Sheet, Temp, Thin, Volt, chips } from '../knobs.js'

const GROUP = 'D · The MOSFET'

const NA = chips(Dope('na', 'Substrate N_A', 1e23), [1e22, 1e23, 1e24])
const TOX = chips(Thin('tox', 'Oxide thickness t_ox', 10e-9), [5e-9, 10e-9, 20e-9])
const IMPLANT = Sheet('implant', 'Threshold implant', 8.15193e15)
const MUN = chips(Mob('mun', 'Electron mobility µ_n', 0.05), [0.03, 0.05, 0.11])
const WL = chips(Ratio('wOverL', 'Width over length W/L', 10), [1, 10, 100])
const VGS = chips(Volt('vgs', 'Gate voltage V_GS', 1.2), [0.9, 1.2, 1.7])
const VDS = chips(Volt('vds', 'Drain voltage V_DS', 1), [0.25, 0.5, 1, 2])
const VSB = chips(Volt('vsb', 'Source-to-body bias V_SB', 0), [0, 1, 2])
const TEMP = Temp('T', 'Temperature T', 300)
const VIEWS = ['reading', 'curves', 'equations']

export const GROUP_D = [
  {
    id: 'd1',
    group: GROUP,
    name: 'The channel is the inversion layer',
    terms: ['channel', 'overdrive'],
    params: [VGS, TOX, NA, IMPLANT, MUN, WL, VDS, VSB, TEMP],
    structure: 'mosfet',
    view: 'reading',
    views: VIEWS,
    headline: { path: 'fet.charge', label: 'Channel charge', unit: 'C/m²' },
  },
  {
    id: 'd2',
    group: GROUP,
    name: 'The square law, integrated',
    terms: ['gradualchannel', 'triode'],
    params: [chips(Volt('vds', 'Drain voltage V_DS', 0.25), [0.1, 0.25, 0.5, 1]), VGS, TOX, NA, IMPLANT, MUN, WL, VSB, TEMP],
    structure: 'mosfet',
    view: 'curves',
    views: VIEWS,
    headline: { path: 'fet.id', label: 'I_D', unit: 'A' },
  },
  {
    id: 'd3',
    group: GROUP,
    name: 'Pinch-off and saturation',
    terms: ['pinchoff'],
    params: [VDS, VGS, TOX, NA, IMPLANT, MUN, WL, VSB, chips(Lam('lambda', 'Channel-length modulation λ', 0), [0, 0.05, 0.1]), TEMP],
    structure: 'mosfet',
    view: 'curves',
    views: VIEWS,
    headline: { path: 'fet.id', label: 'I_D', unit: 'A' },
  },
  {
    id: 'd4',
    group: GROUP,
    name: 'Transconductance and the body effect',
    terms: ['transconductance', 'bodyeffect'],
    params: [VSB, VGS, VDS, TOX, NA, IMPLANT, MUN, WL, TEMP],
    structure: 'mosfet',
    view: 'curves',
    views: VIEWS,
    headline: { path: 'fet.gm', label: 'g_m', unit: 'A/V' },
  },
  {
    id: 'd5',
    group: GROUP,
    name: 'Where the square law stops',
    terms: ['subthreshold', 'velocitysaturation'],
    params: [
      chips(Len('length', 'Channel length L', 1e-6), [1e-7, 1e-6, 1e-5]),
      chips({ key: 'floor', label: 'Off current I_off', unit: 'A', min: 1e-15, max: 1e-6, scale: 'log', default: 1e-9 }, [1e-12, 1e-9, 1e-6]),
      VGS,
      VDS,
      TOX,
      NA,
      IMPLANT,
      MUN,
      WL,
      VSB,
      TEMP,
    ],
    structure: 'mosfet',
    view: 'reading',
    views: VIEWS,
    headline: { path: 'fet.dv', label: 'Gate swing to I_off', unit: 'V' },
  },
]
