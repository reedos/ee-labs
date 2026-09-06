// Group E: the lock-in amplifier.
//
// A lock-in multiplies its input by a reference at a known frequency and
// averages the result. The multiplier is the one place in this lab where a line
// of algebra is done by hand: for two sinusoids the product is exactly two
// sinusoids, one at the difference of the frequencies and one at their sum, so
// the mixer's output is carried by two sources in series. Everything after it
// is a circuit, and `transient` solves it exactly.
//
//   A sin(ω_s t + φ) · V_r sin(ω_r t) / V_u
//       = M [ cos((ω_s − ω_r) t + φ) − cos((ω_s + ω_r) t + φ) ],   M = A·V_r/2V_u
//
// cos x is sin(x + π/2), and −cos x is sin(x + 3π/2), which is how the two
// sources below carry their phases.

import { Amp, BOT, Cap, Deg, Gm, Freq, GROUPS, H, R, TOP, Win, chips, gnd, leg, node, rail, src } from '../kit.js'

/** M, the amplitude of each of the mixer's two terms. */
export const mixerM = (p) => (p.A * p.Vr) / (2 * p.Vu)

/**
 * How long the detector averages, and from when.
 *
 * A whole number of periods of the mixer's sum term, so that term's mean over
 * the span is zero rather than nearly zero; at most two reference periods, so
 * the reading is quick; and at most a quarter of the window, so what is
 * averaged is the settled output rather than the rise to it. At the defaults
 * that is four periods of the 2 kHz term, 2 ms, ending 8 time constants in.
 */
export const detectOver = (p) => {
  const period = 1 / (p.fs + p.fr)
  const want = Math.min(2 / p.fr, (p.N * p.Rf * p.Cf) / 4)
  return Math.max(1, Math.floor(want / period)) * period
}

/** The lock-in's netlist: the mixer as two sources, a VCCS, and the output RC. */
export function lockinNet(p) {
  const M = mixerM(p)
  const phi = (p.phi * Math.PI) / 180
  const fd = Math.abs(p.fs - p.fr)
  const sign = p.fs >= p.fr ? 1 : -1
  return {
    elements: [
      fd === 0
        ? // On tune the difference term is a constant, switched on at t = 0 so
          // the output's rise is the filter's step response.
          { type: 'V', id: 'Vd', nodes: ['p1', 'gnd'], value: 0, wave: { kind: 'step', from: 0, to: M * Math.cos(phi) } }
        : { type: 'V', id: 'Vd', nodes: ['p1', 'gnd'], value: 0, wave: { kind: 'sine', amp: M, freq: fd, phase: sign * phi + Math.PI / 2 } },
      { type: 'V', id: 'Vs', nodes: ['prod', 'p1'], value: 0, wave: { kind: 'sine', amp: M, freq: p.fs + p.fr, phase: phi + Math.PI / 2 + Math.PI } },
      { type: 'VCCS', id: 'G1', nodes: ['gnd', 'out'], ctrl: ['prod', 'gnd'], gain: p.gm },
      { type: 'R', id: 'Rf', nodes: ['out', 'gnd'], value: p.Rf },
      { type: 'C', id: 'Cf', nodes: ['out', 'gnd'], value: p.Cf },
    ],
  }
}

/**
 * The mixer's two sources stacked on the left, the transconductance driving the
 * output node, and the filter as two legs across it.
 */
const lockinLayout = {
  w: 470,
  h: H,
  items: [
    // The sum term stands on the left and the difference term lies in the
    // return rail, where its own label has room.
    ...src('Vs', 44),
    rail(44, 130, TOP),
    node('prod', 130, TOP, 't'),
    { wire: [130, TOP, 176, TOP] },
    { el: 'G1', x: 196, y: TOP, dir: 'h' },
    { wire: [216, TOP, 270, TOP] },
    node('out', 270, TOP, 't'),
    rail(270, 300, TOP),
    ...leg('Rf', 300),
    rail(300, 390, TOP),
    ...leg('Cf', 390),
    node('p1', 80, BOT, 't'),
    rail(44, 119, BOT),
    { el: 'Vd', x: 130, y: BOT, dir: 'h' },
    rail(141, 390, BOT),
    gnd(340, BOT),
  ],
}

export const GROUP_E = [
  {
    id: 'e1',
    group: GROUPS[4],
    instrument: 'lockin',
    name: 'Multiply by the reference and one term stops moving',
    terms: ['lockin', 'mixer'],
    params: [
      Amp('A', 'Signal', 0.01),
      Amp('Vr', 'Reference', 1),
      Amp('Vu', 'Mixer unit', 1, 'the volts the multiplier divides by, so its output is in volts'),
      // The reference sitting on the signal is the premise of E1 to E3, not a
      // setting, so the try steps move it and the fuzzer leaves it alone.
      { ...Freq('fs', 'Signal frequency', 1000), fixed: true },
      { ...Freq('fr', 'Reference frequency', 1000), fixed: true },
      Deg('phi', 'Signal phase', 0),
      Gm('gm', 'Transconductance', 1e-3),
      R('Rf', 'Filter R', 1000),
      chips(Cap('Cf', 'Filter C', 1e-6), [1e-6, 1e-5, 1e-4]),
      Win('N', 'Window', 'τ', 10, 4, 30),
    ],
    net: lockinNet,
    layout: lockinLayout,
    window: (p) => p.N * p.Rf * p.Cf,
    points: 2401,
    cursor: 0.9,
    detect: (p) => ({ of: (sol) => sol.v.out, over: detectOver(p) }),
    scope: {
      left: {
        unit: 'V',
        traces: [
          { q: 'v', key: 'prod', label: 'v_prod', dim: true },
          { q: 'v', key: 'out', label: 'v_out' },
        ],
      },
    },
    show: 'v',
    view: 'scope',
    views: ['reading', 'equations', 'scope'],
    claim: { lockin: true },
  },
  {
    id: 'e2',
    group: GROUPS[4],
    instrument: 'lockin',
    name: 'The filter sets both the ripple and the speed',
    terms: ['enbw'],
    params: [
      Amp('A', 'Signal', 0.01),
      Amp('Vr', 'Reference', 1),
      Amp('Vu', 'Mixer unit', 1),
      // The reference sitting on the signal is the premise of E1 to E3, not a
      // setting, so the try steps move it and the fuzzer leaves it alone.
      { ...Freq('fs', 'Signal frequency', 1000), fixed: true },
      { ...Freq('fr', 'Reference frequency', 1000), fixed: true },
      Deg('phi', 'Signal phase', 0),
      Gm('gm', 'Transconductance', 1e-3),
      chips(R('Rf', 'Filter R', 1000), [1000, 10000]),
      chips(Cap('Cf', 'Filter C', 1e-6), [1e-6, 1e-5, 1e-4]),
      Win('N', 'Window', 'τ', 10, 4, 30),
    ],
    net: lockinNet,
    layout: lockinLayout,
    window: (p) => p.N * p.Rf * p.Cf,
    points: 2401,
    cursor: 0.9,
    detect: (p) => ({ of: (sol) => sol.v.out, over: detectOver(p) }),
    scope: { left: { unit: 'V', traces: [{ q: 'v', key: 'out', label: 'v_out' }] } },
    show: 'v',
    view: 'scope',
    views: ['reading', 'equations', 'scope'],
    claim: { lockin: true },
  },
  {
    id: 'e3',
    group: GROUPS[4],
    instrument: 'lockin',
    name: 'The output follows the cosine of the phase',
    terms: ['quadrature'],
    params: [
      Amp('A', 'Signal', 0.01),
      Amp('Vr', 'Reference', 1),
      Amp('Vu', 'Mixer unit', 1),
      // The reference sitting on the signal is the premise of E1 to E3, not a
      // setting, so the try steps move it and the fuzzer leaves it alone.
      { ...Freq('fs', 'Signal frequency', 1000), fixed: true },
      { ...Freq('fr', 'Reference frequency', 1000), fixed: true },
      chips(Deg('phi', 'Signal phase', 0), [0, 60, 90, 180]),
      Gm('gm', 'Transconductance', 1e-3),
      R('Rf', 'Filter R', 1000),
      Cap('Cf', 'Filter C', 1e-6),
      Win('N', 'Window', 'τ', 10, 4, 30),
    ],
    net: lockinNet,
    layout: lockinLayout,
    window: (p) => p.N * p.Rf * p.Cf,
    points: 2401,
    cursor: 0.9,
    detect: (p) => ({ of: (sol) => sol.v.out, over: detectOver(p) }),
    scope: { left: { unit: 'V', traces: [{ q: 'v', key: 'out', label: 'v_out' }] } },
    show: 'v',
    view: 'scope',
    views: ['reading', 'equations', 'scope'],
    claim: { lockin: true },
  },
  {
    id: 'e4',
    group: GROUPS[4],
    instrument: 'lockin',
    name: 'Off frequency, the output beats instead of settling',
    terms: [],
    params: [
      Amp('A', 'Signal', 0.01),
      Amp('Vr', 'Reference', 1),
      Amp('Vu', 'Mixer unit', 1),
      chips({ ...Freq('fs', 'Signal frequency', 1200), fixed: true }, [1050, 1200, 1500]),
      { ...Freq('fr', 'Reference frequency', 1000), fixed: true },
      Deg('phi', 'Signal phase', 0),
      Gm('gm', 'Transconductance', 1e-3),
      R('Rf', 'Filter R', 1000),
      chips(Cap('Cf', 'Filter C', 1e-6), [1e-6, 1e-5, 1e-4]),
      Win('N', 'Window', 'beats', 6, 2, 12),
    ],
    net: lockinNet,
    layout: lockinLayout,
    window: (p) => p.N / Math.abs(p.fs - p.fr),
    points: 3001,
    cursor: 0.9,
    scope: { left: { unit: 'V', traces: [{ q: 'v', key: 'out', label: 'v_out' }] } },
    show: 'v',
    view: 'scope',
    views: ['reading', 'equations', 'scope'],
    claim: { detune: true },
  },
]
