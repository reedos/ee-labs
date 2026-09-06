// Group D: the rate equations.
//
// Four experiments and one object. Two coupled equations describe a laser's
// carriers and its photons, their steady state is algebra, and the
// linearisation about that steady state is an exactly rational second order.
// Between them they carry every claim this lab makes about a laser's speed.
//
// The group is the least circuit-like content in the suite, so every pane
// prints the reader's own numbers term by term rather than a formula with
// symbols in it. D1 exists for that reason alone.
//
// D4 is the only experiment in the lab that carries a guard. The guard is a
// modulation depth, and the number behind it is measured by integrating the
// same pair and comparing the overshoot with what the linear answer predicted.

import { ActiveVolume, Coupling, Density, Depth, DiffGain, Drive, Fraction, Lifetime } from '../knobs.js'

export const GROUP = 'D · The rate equations'

const TAU_P = Lifetime('tauP', 'Photon lifetime', 1.9862e-12, 'How long a photon stays in the cavity', 1e-13, 1e-10)
const TAU_C = Lifetime('tauC', 'Carrier lifetime', 2e-9, 'How long a carrier lasts before it recombines', 1e-10, 1e-7)
const GAIN = DiffGain('g0', 'Differential gain', 2.5e-12, 'How fast the gain grows with carrier density')
const NTR = Density('ntr', 'Transparency density', 1e24, 'Below it the material absorbs rather than amplifies')
const CONFINE = Fraction('gamma', 'Confinement factor', 0.3, 'The share of the mode that sits in the active region')
const VOLUME = ActiveVolume('V', 'Active volume', 1e-16, 'The stripe the carriers are held in')
const BETA = Coupling('beta', 'Spontaneous coupling', 0, 'The share of spontaneous light landing in the mode')

/** The six parameters every experiment in this group carries, in reading order. */
const RATE_KNOBS = [TAU_P, TAU_C, GAIN, NTR, CONFINE, VOLUME, BETA]

/** Twice threshold, which is where the plan quotes every relaxation number. */
const BIAS = 26.777e-3

export const D = [
  {
    id: 'd1',
    group: GROUP,
    kind: 'rate',
    name: 'Two equations, and what each term is',
    terms: ['rateequations', 'carrierdensity', 'photondensity', 'pump', 'steadystate'],
    params: [Drive('current', 'Drive current', BIAS, 'Straight through the junction'), ...RATE_KNOBS],
    view: 'equations',
    views: ['equations', 'numbers'],
    headline: (x) => ({ value: x.s, unit: 'm⁻³', label: 'Photon density' }),
  },
  {
    id: 'd2',
    group: GROUP,
    kind: 'rate',
    name: 'The steady state, exactly',
    terms: ['steadystate', 'thresholddensity'],
    params: [Drive('current', 'Drive current', BIAS, 'Straight through the junction'), ...RATE_KNOBS],
    view: 'curve',
    views: ['curve', 'equations', 'numbers'],
    headline: (x) => ({ value: x.ith, unit: 'A', label: 'Threshold current' }),
    curve: (x, p) => ({
      x: { from: 0, to: 4 * x.ith, label: 'Drive current', unit: 'A' },
      series: [
        { read: (i) => x.at({ current: i }).s, label: 'Photon density', unit: 'm⁻³' },
        { read: (i) => x.at({ current: i }).n, label: 'Carrier density', unit: 'm⁻³', axis: 'right' },
      ],
      marks: [
        { at: x.ith, label: 'threshold' },
        { at: p.current, label: 'here' },
      ],
      yLabel: 'Photon density',
      yUnit: 'm⁻³',
      yFromZero: true,
      rightLabel: 'Carrier density',
      rightUnit: 'm⁻³',
    }),
  },
  {
    id: 'd3',
    group: GROUP,
    kind: 'rate',
    linearise: true,
    name: 'The relaxation oscillation',
    terms: ['relaxation', 'dampingratio', 'linearisation'],
    params: [Drive('current', 'Drive current', BIAS, 'Straight through the junction'), ...RATE_KNOBS],
    view: 'modulation',
    views: ['modulation', 'curve', 'numbers'],
    headline: (x) => ({ value: x.sm.fr, unit: 'Hz', label: 'Relaxation frequency' }),
    curve: (x, p) => ({
      // The sweep starts above threshold, because below it at zero coupling
      // there are no photons and no oscillation to plot.
      x: { from: 1.05 * x.ith, to: 6 * x.ith, label: 'Drive current', unit: 'A' },
      series: [
        { read: (i) => x.at({ current: i }).sm.fr, label: 'Relaxation frequency', unit: 'Hz' },
        { read: (i) => x.at({ current: i }).sm.frText, label: 'The textbook form', unit: 'Hz' },
      ],
      marks: [{ at: p.current, label: 'here' }],
      yLabel: 'Relaxation frequency',
      yUnit: 'Hz',
      yFromZero: true,
    }),
  },
  {
    id: 'd4',
    group: GROUP,
    kind: 'rate',
    linearise: true,
    name: 'Where the linearisation stops',
    terms: ['modulationdepth', 'overshoot', 'guard'],
    params: [
      Depth('depth', 'Modulation depth', 0.05, 'How far the step moves the current'),
      Drive('current', 'Drive current', BIAS, 'Straight through the junction'),
      ...RATE_KNOBS,
    ],
    // No curve view. Every point on a curve of error against depth is one
    // integration of the pair, and a hundred and sixty of them would make the
    // pane slower than the reader's own patience. The five depths the plan
    // names are on the numbers pane instead, each measured.
    view: 'step',
    views: ['step', 'numbers'],
    headline: (x) => ({ value: x.guard.error, unit: '', label: 'Error in the predicted overshoot' }),
  },
]
