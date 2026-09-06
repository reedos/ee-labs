// Group A: the line at one frequency.
//
// Five experiments, and one argument. A mismatch sends a wave back, that one
// number wears four names, a length of line turns one impedance into another,
// loss shrinks what comes back, and none of it is a transfer function.
//
// The reference line is PTFE, and its length is COMPUTED from the phase
// velocity and 1.000 GHz rather than typed as 5.1719 cm. A quarter wave has to
// be exactly a quarter wave, or the note that says the input impedance is
// exactly 25.000 ohms is wrong in its last digit.

import { phaseVelocity } from '@ee-labs/rf'
import { Alpha, Count, Eps, Freq, Len, Ohms, React_, Ref } from '../knobs.js'

export const GROUP = 'A · The line at one frequency'

const EPSR = 2.1
const F0 = 1e9
/** A quarter wavelength on PTFE at 1.000 GHz, which is 5.1719 cm. */
export const QUARTER = phaseVelocity(EPSR) / (4 * F0)

const OHM = 'Ω'

/** The load knobs every experiment in this group and the next shares. */
export const loadKnobs = (R = 100, X = 0) => [
  Ohms('RL', 'Load resistance', R, 'The real part of what the line is terminated in'),
  React_('XL', 'Load reactance', X, 'Negative is a capacitor, positive an inductor'),
  Ref('z0', 'Reference impedance', 50, 'What every reflection is measured against'),
]

/** The line knobs A3 to A5 and B3 share. */
export const lineKnobs = (alpha = 0) => [
  Freq('f', 'Frequency', F0, 'One sine at a time, and this is the one'),
  Len('len', 'Line length', QUARTER, 'A quarter wave at 1.000 GHz on this dielectric'),
  Ohms('RL', 'Load resistance', 100, 'What the far end is terminated in'),
  React_('XL', 'Load reactance', 0),
  Ref('z0line', 'Line impedance', 50, 'The characteristic impedance of the line itself'),
  Eps('epsr', 'Dielectric constant', EPSR, 'PTFE is 2.1, so the wave travels at 69.007 per cent of c'),
  Alpha('alpha', 'Attenuation', alpha, 'Nepers per metre, and zero is a lossless line'),
]

export const A = [
  {
    id: 'a1',
    group: GROUP,
    kind: 'mismatch',
    name: 'A mismatched load sends a wave back',
    terms: ['reflection', 'reference', 'incidentwave'],
    params: loadKnobs(100, 0),
    view: 'numbers',
    views: ['numbers', 'chart'],
    headline: (x) => ({ value: x.m.mag, unit: '', label: 'Reflection coefficient magnitude' }),
  },
  {
    id: 'a2',
    group: GROUP,
    kind: 'mismatch',
    name: 'One number in four costumes',
    terms: ['vswr', 'returnloss', 'mismatchloss'],
    params: loadKnobs(100, 0),
    view: 'numbers',
    views: ['numbers', 'chart'],
    headline: (x) => ({ value: x.m.vswr, unit: '', label: 'Standing-wave ratio' }),
  },
  {
    id: 'a3',
    group: GROUP,
    kind: 'line',
    name: 'A length of line transforms impedance',
    terms: ['electricallength', 'wavelength', 'quarterwave'],
    params: lineKnobs(0),
    view: 'line',
    views: ['line', 'chart', 'sweep', 'numbers'],
    headline: (x) => ({ value: x.zin.Z[0], unit: OHM, label: 'Resistance looking into the line' }),
  },
  {
    id: 'a4',
    group: GROUP,
    kind: 'line',
    name: 'Loss shrinks what comes back',
    terms: ['attenuation', 'neper'],
    params: lineKnobs(0.05),
    view: 'line',
    views: ['line', 'chart', 'sweep', 'numbers'],
    headline: (x) => ({ value: x.source.mag, unit: '', label: 'Reflection magnitude at the source' }),
  },
  {
    id: 'a5',
    group: GROUP,
    kind: 'line',
    name: 'The line has no transfer function',
    terms: ['rational', 'transcendental'],
    params: [...lineKnobs(0), Count('points', 'Points in the sweep', 241, 'Each one an exact solve')],
    view: 'sweep',
    views: ['sweep', 'line', 'numbers'],
    sweep: { from: 0.1e9, to: 4.1e9 },
    headline: (x) => ({ value: x.repeat, unit: 'Hz', label: 'Spacing the response repeats by' }),
  },
]
