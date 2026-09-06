// Group C: the rotating field, and the induction machine that runs on it.

import { IM } from '../machines.js'
import { Amp, Freq, Fraction, Inertia, Ohm, Plain, Torque, Volt, chips } from '../knobs.js'

export const GROUP = 'C · The rotating field and induction'

const stator = () => [
  Volt('V', 'Phase voltage', IM.V, 20, 500),
  Freq('f', 'Frequency', IM.f, 5, 200),
  chips(Plain('poles', 'Poles', IM.poles, 2, 12), [2, 4, 6, 8]),
  Ohm('R1', 'Stator resistance', IM.R1, 0.05, 50),
  Ohm('X1', 'Stator leakage', IM.X1, 0.05, 50),
  chips(Ohm('R2', 'Rotor resistance', IM.R2, 0.05, 50), [1.2, 2.4, 4.913]),
  Ohm('X2', 'Rotor leakage', IM.X2, 0.05, 50),
  Ohm('Xm', 'Magnetising reactance', IM.Xm, 5, 500),
  Ohm('Rc', 'Core-loss resistance', IM.Rc, 100, 1e5),
  Torque('TL', 'Load torque', IM.TL, 0, 80),
]

const withSlip = (def) => [...stator(), chips(Plain('slip', 'Slip', def, 1e-4, 1), [0.0277, 0.2443, 1])]

export const EXPERIMENTS = [
  {
    id: 'c1',
    group: GROUP,
    kind: 'field',
    name: 'Three phases make one travelling wave',
    terms: ['rotatingfield', 'mmf', 'threephase'],
    params: [
      Amp('amp', 'Phase current', 1, 0.1, 20),
      Freq('f', 'Frequency', 50, 5, 200),
      chips(Plain('poles', 'Poles', 4, 2, 12), [2, 4, 6]),
      Plain('turns', 'Turns per phase', 1, 1, 500),
      Plain('t', 'Time, in periods', 0, 0, 1),
    ],
    view: 'field',
    views: ['field'],
    claim: { travelling: true },
  },
  {
    id: 'c2',
    group: GROUP,
    kind: 'field',
    name: 'Synchronous speed, poles and frequency',
    terms: ['synchronousspeed', 'rotatingfield'],
    params: [
      Amp('amp', 'Phase current', 1, 0.1, 20),
      chips(Freq('f', 'Frequency', 50, 5, 200), [50, 60]),
      chips(Plain('poles', 'Poles', 4, 2, 12), [2, 4, 6, 8]),
      Plain('turns', 'Turns per phase', 1, 1, 500),
      Plain('t', 'Time, in periods', 0, 0, 1),
    ],
    view: 'field',
    views: ['field'],
    // The topbar carries the model's first meter, which for the rotating field
    // is the wave amplitude. This lesson is the synchronous speed, and its
    // only view is the field plot, so without this the number it teaches was
    // nowhere on its screen.
    lead: 'Synchronous speed',
    claim: { sync: true },
  },
  {
    id: 'c3',
    group: GROUP,
    kind: 'im',
    name: 'Slip: the rotor runs behind',
    terms: ['slip', 'synchronousspeed', 'induction'],
    params: withSlip(0.0277),
    view: 'curve',
    views: ['curve', 'reading'],
    claim: { slip: true },
  },
  {
    id: 'c4',
    group: GROUP,
    kind: 'im',
    name: 'The per-phase equivalent circuit',
    terms: ['perphase', 'slip', 'magnetising', 'turnsratio'],
    params: withSlip(0.0277),
    view: 'reading',
    views: ['reading', 'power', 'curve'],
    claim: { circuit: true },
  },
  {
    id: 'c5',
    group: GROUP,
    kind: 'im',
    name: 'The air gap splits into heat and shaft',
    terms: ['airgap', 'slip', 'rotorcopper'],
    params: withSlip(0.0277),
    view: 'power',
    views: ['power', 'reading', 'curve'],
    claim: { split: true },
  },
  {
    id: 'c6',
    group: GROUP,
    kind: 'im',
    name: 'The torque curve',
    terms: ['torquecurve', 'slip', 'operatingpoint'],
    params: stator(),
    runUp: true,
    view: 'curve',
    views: ['curve', 'reading'],
    claim: { curve: true },
  },
  {
    id: 'c7',
    group: GROUP,
    kind: 'im',
    name: 'Breakdown, the largest torque there is',
    terms: ['breakdown', 'torquecurve'],
    params: withSlip(0.2443),
    view: 'curve',
    views: ['curve', 'reading'],
    claim: { breakdown: true },
  },
  {
    id: 'c8',
    group: GROUP,
    kind: 'im',
    name: 'Starting, across the line',
    terms: ['startingcurrent', 'breakdown', 'slip'],
    params: withSlip(1),
    view: 'curve',
    views: ['curve', 'reading', 'power'],
    claim: { starting: true },
  },
  {
    id: 'c9',
    group: GROUP,
    kind: 'im',
    name: 'Rotor resistance moves the breakdown',
    terms: ['breakdown', 'rotorresistance', 'torquecurve'],
    params: withSlip(0.2443),
    rotorSweep: [1, 2, 4],
    view: 'curve',
    views: ['curve', 'reading'],
    claim: { rotor: true },
  },
]
