// Group E: losses, efficiency and the thermal limit.

import { LOSS, SAT } from '../machines.js'
import { Amp, Choice, Fraction, Kelvin, Plain, Seconds, Watt, Wb, chips } from '../knobs.js'

export const GROUP = 'E · Losses and the thermal limit'

const budget = () => [
  Watt('pOut', 'Rated output', LOSS.pOut, 100, 1e5),
  Watt('pCuFull', 'Copper loss, full load', LOSS.pCuFull, 1, 1e4),
  Watt('pCore', 'Core loss', LOSS.pCore, 1, 1e4),
  Watt('pFriction', 'Friction and windage', LOSS.pFriction, 0, 1e4),
  chips(Fraction('x', 'Load, fraction of rated', 1, 0.05, 1.5), [0.25, 0.5, 0.779, 1]),
]

const thermal = () => [
  ...budget(),
  Plain('Rth', 'Thermal resistance, K/W', LOSS.Rth, 0.01, 5),
  Seconds('Cth', 'Thermal capacity, J/K', LOSS.Cth, 10, 1e5),
  Kelvin('ambient', 'Ambient', LOSS.ambient, 0, 80),
  chips(Kelvin('classLimit', 'Insulation class limit', LOSS.classLimit, 90, 220), [130, 155, 180]),
]

export const EXPERIMENTS = [
  {
    id: 'e1',
    group: GROUP,
    kind: 'losses',
    name: 'Where the power goes',
    terms: ['copperloss', 'coreloss', 'strayloss', 'efficiency'],
    params: budget(),
    view: 'power',
    views: ['power', 'efficiency'],
    claim: { split: true },
  },
  {
    id: 'e2',
    group: GROUP,
    kind: 'losses',
    name: 'Efficiency against load',
    terms: ['efficiency', 'copperloss', 'coreloss'],
    params: budget(),
    view: 'efficiency',
    views: ['efficiency', 'power'],
    claim: { peak: true },
  },
  {
    id: 'e3',
    group: GROUP,
    kind: 'losses',
    name: 'The thermal circuit',
    terms: ['thermalresistance', 'thermalcapacitance', 'timeconstant'],
    params: [...thermal(), Plain('cursor', 'Cursor in the window', 1, 0.01, 1)],
    time: true,
    cursor: 1,
    view: 'heat',
    views: ['heat', 'reading', 'efficiency'],
    claim: { thermal: true },
  },
  {
    id: 'e4',
    group: GROUP,
    kind: 'losses',
    name: 'The insulation class sets the rating',
    terms: ['insulationclass', 'thermalresistance', 'efficiency'],
    params: thermal(),
    view: 'heat',
    views: ['heat', 'efficiency', 'power'],
    claim: { rating: true },
  },
  {
    id: 'e5',
    group: GROUP,
    kind: 'sat',
    name: 'Saturation, a labelled toggle',
    terms: ['saturation', 'fluxlinkage', 'magnetising'],
    params: [
      Choice('model', 'Magnetics', 'knee', [
        { value: 'linear', label: 'linear' },
        { value: 'knee', label: 'knee' },
        { value: 'atan', label: 'curve' },
      ]),
      Plain('L0', 'Unsaturated inductance, H', SAT.L0, 0.1, 100),
      Wb('lambdaSat', 'Knee flux', SAT.lambdaSat, 0.05, 10),
      Plain('hard', 'Stiffness past the knee', SAT.hard, 1, 200),
      Amp('i', 'Magnetising current', 0.45, 0, 2),
    ],
    view: 'bh',
    views: ['bh'],
    claim: { saturation: true },
  },
]
