// Group B: the transformer, a machine that does not turn.

import { XF } from '../machines.js'
import { Fraction, Freq, Ohm, Ratio, Volt, chips } from '../knobs.js'

export const GROUP = 'B · The transformer'

const windings = () => [
  Volt('Vp', 'Primary voltage', XF.Vp, 12, 600),
  Freq('f', 'Frequency', XF.f, 10, 400),
  chips(Ratio('n', 'Turns ratio', XF.n, 0.2, 12), [1, 2, 4]),
  Ohm('R1', 'Primary resistance', XF.R1, 0.01, 100),
  Ohm('X1', 'Primary leakage', XF.X1, 0.01, 100),
  Ohm('R2', 'Secondary resistance', XF.R2, 0.01, 100),
  Ohm('X2', 'Secondary leakage', XF.X2, 0.01, 100),
  Ohm('Rc', 'Core-loss resistance', XF.Rc, 100, 1e5),
  Ohm('Xm', 'Magnetising reactance', XF.Xm, 50, 1e5),
  chips(Ohm('RL', 'Load resistance', XF.RL, 0.5, 1e4), [3, 6, 12, 1e4]),
]

const ideal = () => [
  Volt('Vp', 'Primary voltage', XF.Vp, 12, 600),
  Freq('f', 'Frequency', XF.f, 10, 400),
  chips(Ratio('n', 'Turns ratio', XF.n, 0.2, 12), [0.5, 1, 2, 4]),
  chips(Ohm('RL', 'Load resistance', XF.RL, 0.5, 1e4), [1.5, 6, 24]),
]

export const EXPERIMENTS = [
  {
    id: 'b1',
    group: GROUP,
    kind: 'transformer',
    name: 'Volts per turn, and ampere-turns',
    terms: ['turnsratio', 'idealtransformer', 'tellegen'],
    machine: { ...XF, stage: 'ideal' },
    params: ideal(),
    view: 'reading',
    views: ['reading', 'power'],
    claim: { ratios: true },
  },
  {
    id: 'b2',
    group: GROUP,
    kind: 'transformer',
    name: 'Reflected impedance',
    terms: ['reflected', 'turnsratio'],
    machine: { ...XF, stage: 'ideal' },
    params: ideal(),
    view: 'reading',
    views: ['reading', 'power'],
    claim: { reflected: true },
  },
  {
    id: 'b3',
    group: GROUP,
    kind: 'transformer',
    name: 'The equivalent circuit',
    terms: ['leakage', 'magnetising', 'reflected'],
    params: windings(),
    view: 'reading',
    views: ['reading', 'power', 'phasors'],
    claim: { drop: true },
  },
  {
    id: 'b4',
    group: GROUP,
    kind: 'transformer',
    name: 'Open circuit and short circuit',
    terms: ['opencircuit', 'shortcircuit', 'magnetising'],
    params: windings(),
    view: 'reading',
    views: ['reading', 'power'],
    claim: { bench: true },
  },
  {
    id: 'b5',
    group: GROUP,
    kind: 'transformer',
    name: 'Regulation',
    terms: ['regulation', 'leakage', 'powerfactor'],
    params: [...windings(), Ohm('XL', 'Load reactance', 0, 0, 100)],
    view: 'phasors',
    views: ['phasors', 'reading', 'power'],
    claim: { regulation: true },
  },
  {
    id: 'b6',
    group: GROUP,
    kind: 'transformer',
    name: 'Efficiency, and where it peaks',
    terms: ['efficiency', 'coreloss', 'copperloss'],
    params: windings(),
    view: 'power',
    views: ['power', 'reading'],
    claim: { efficiency: true },
  },
]
