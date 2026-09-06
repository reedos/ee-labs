// Group C: matching networks.
//
// Five experiments, and one argument. Two reactances match two resistances in
// closed form, the enumeration holds four arrangements and two of them exist,
// the price of the match is its bandwidth, a quarter wave of line does the same
// job wider, and a complex load is cancelled before it is transformed.
//
// Nothing here searches for element values. `packages/rf/src/match.js` solves
// two equations in two unknowns and returns the answer, and the app reads it.
// The frequency and the resistances are the knobs, and every element value on
// screen is a function of them.

import { Choice, Eps, Freq, Ohms, Ratio, React_ } from '../knobs.js'

export const GROUP = 'C · Matching networks'

const F0 = 1e9
const EPSR = 2.1

/** Which of the enumeration's two matching arrangements is on screen. */
export const pickKnob = (def = 'lowpass') =>
  Choice('pick', 'Topology', def, [
    { value: 'lowpass', label: 'Series L, shunt C' },
    { value: 'highpass', label: 'Series C, shunt L' },
  ], 'The two arrangements that match this pair, and they differ away from the design frequency')

/** The source and load knobs every experiment in this group shares. */
export const pairKnobs = (RL = 100, XL = 0, RS = 50) => [
  Ohms('RL', 'Load resistance', RL, 'What the network transforms into the source resistance', 0.5, 5000),
  Ohms('RS', 'Source resistance', RS, 'What the network has to look like from the left', 0.5, 5000),
  Freq('f', 'Frequency', F0, 'The one frequency the network is matched at'),
]

/** The standing-wave ratio a bandwidth is measured to. */
export const targetKnob = (def = 1.5) => Ratio('target', 'Bandwidth measured to', def, 'The standing-wave ratio the edges of the band are read at', 1.05, 4)

export const C = [
  {
    id: 'c1',
    group: GROUP,
    kind: 'match',
    name: 'Two reactances match two resistances',
    terms: ['lnetwork', 'matching', 'loadedq'],
    params: [...pairKnobs(100), pickKnob(), React_('XL', 'Load reactance', 0)],
    view: 'numbers',
    views: ['numbers', 'chart', 'sweep'],
    headline: (x) => ({ value: x.design.Q, unit: '', label: 'Loaded Q of the match' }),
  },
  {
    id: 'c2',
    group: GROUP,
    kind: 'match',
    name: 'Four arrangements, and the two that match',
    terms: ['orientation'],
    params: [pickKnob(), ...pairKnobs(100), React_('XL', 'Load reactance', 0)],
    view: 'numbers',
    views: ['numbers', 'chart', 'sweep'],
    headline: (x) => ({ value: x.solutions.filter((s) => s.ok).length, unit: '', label: 'Arrangements that match this pair' }),
  },
  {
    id: 'c3',
    group: GROUP,
    kind: 'match',
    name: 'Bandwidth is the price of the transformation',
    terms: ['fractionalbandwidth'],
    params: [...pairKnobs(100), targetKnob(1.5), pickKnob(), React_('XL', 'Load reactance', 0)],
    view: 'sweep',
    views: ['sweep', 'numbers', 'chart'],
    sweep: { from: 0.2e9, to: 2.2e9 },
    headline: (x) => ({ value: x.bw.fractional, unit: '', label: 'Fractional bandwidth, measured' }),
  },
  {
    id: 'c4',
    group: GROUP,
    kind: 'qwave',
    name: 'A quarter wave of line does the same job',
    terms: ['transformer', 'geometricmean'],
    params: [
      Ohms('RL', 'Load resistance', 100, 'The resistance the section transforms', 0.5, 5000),
      Ohms('RS', 'Source resistance', 50, 'What the section has to look like from the left', 0.5, 5000),
      Freq('f', 'Frequency', F0, 'The frequency the section is a quarter wave at'),
      targetKnob(1.2222),
      Eps('epsr', 'Dielectric constant', EPSR, 'PTFE is 2.1, and it sets the length of the section'),
    ],
    view: 'sweep',
    views: ['sweep', 'numbers', 'chart'],
    sweep: { from: 0.05e9, to: 5.05e9 },
    headline: (x) => ({ value: x.qw.Z0, unit: 'Ω', label: 'Impedance the section needs' }),
  },
  {
    id: 'c5',
    group: GROUP,
    kind: 'match',
    name: 'A complex load is cancelled, then transformed',
    terms: ['absorb'],
    params: [
      Ohms('RL', 'Load resistance', 30, 'The real part of the load', 0.5, 5000),
      React_('XL', 'Load reactance', -40, 'Negative is a capacitor, and it is cancelled first'),
      Ohms('RS', 'Source resistance', 50, 'What the network has to look like from the left', 0.5, 5000),
      Freq('f', 'Frequency', F0, 'The one frequency the network is matched at'),
      pickKnob(),
    ],
    view: 'chart',
    views: ['chart', 'numbers'],
    headline: (x) => ({ value: x.design.Q, unit: '', label: 'Loaded Q of the match' }),
  },
]
