// Group B: the sampling scope.
//
// The front end is analog and the display is not. The circuit stops at the
// sampler, and the samples are the exact solution read at t = k/f_s, which is
// what `exp.samples` asks the analysis for. Nothing in the circuit changes when
// the sample rate changes, which is the point B1 makes. Signal Lab's Sampling
// group is the full treatment of both experiments.

import { complex as cx } from '@ee-labs/network'
import { Amp, BOT, Cap, Db, Freq, GROUPS, H, R, TOP, Win, chips, gnd, leg, node, rail, src, top } from '../kit.js'

const sine = (amp, freq) => ({ kind: 'sine', amp, freq })

/** Source, one series resistance, then the two legs the instrument is. */
const frontEnd = (series, legs) => ({
  w: 460,
  h: H,
  items: [
    ...src('V1', 50),
    rail(50, 130, TOP),
    ...top(series, 150),
    rail(170, 260, TOP),
    node('src', 50, TOP, 't'),
    node('in', 215, TOP, 't'),
    ...leg(legs[0], 260),
    rail(260, 350, TOP),
    ...(legs[1] ? leg(legs[1], 350) : []),
    rail(50, legs[1] ? 350 : 260, BOT),
    gnd(115),
  ],
})

export const GROUP_B = [
  {
    id: 'b1',
    group: GROUPS[1],
    instrument: 'scope',
    name: 'A tone above half the sample rate arrives as another tone',
    terms: ['samplerate', 'alias'],
    params: [
      chips(Freq('f', 'Tone', 9000), [4000, 9000, 19000]),
      chips(Freq('fs', 'Sample rate', 10000), [10000, 20000]),
      Amp('A', 'Amplitude', 1),
      R('Rs', 'Source R_s', 1e5),
      R('R2', 'Scope R_in', 1e6),
      Cap('C2', 'Scope C_in', 15e-12),
      Win('N', 'Window', 'ms', 4, 1, 10),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['src', 'gnd'], value: 0, wave: sine(p.A, p.f) },
        { type: 'R', id: 'Rs', nodes: ['src', 'in'], value: p.Rs },
        { type: 'R', id: 'R2', nodes: ['in', 'gnd'], value: p.R2 },
        { type: 'C', id: 'C2', nodes: ['in', 'gnd'], value: p.C2 },
      ],
    }),
    layout: frontEnd('Rs', ['R2', 'C2']),
    window: (p) => p.N * 1e-3,
    points: 2001,
    cursor: 0.5,
    samples: (p) => ({ rate: p.fs, of: (sol) => sol.v.in }),
    scope: { left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_in' }] } },
    show: 'v',
    view: 'scope',
    views: ['reading', 'equations', 'scope'],
    claim: { alias: true },
  },
  {
    id: 'b2',
    group: GROUPS[1],
    instrument: 'scope',
    name: 'One pole is a poor anti-alias filter',
    terms: ['antialias'],
    params: [
      R('Rb', 'Limit R', 1000),
      Cap('Cb', 'Limit C', 1 / (2 * Math.PI * 20000 * 1000)),
      Amp('A', 'Amplitude', 1),
      chips(Freq('f', 'Signal', 5000), [5000, 20000]),
      chips(Freq('fi', 'Interferer', 95000), [95000, 190000]),
      Freq('fs', 'Sample rate', 100000),
      Db('reject', 'Rejection wanted', 40, 'how far down the interferer has to be'),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['src', 'gnd'], value: 0, wave: sine(p.A, p.f) },
        { type: 'R', id: 'Rb', nodes: ['src', 'in'], value: p.Rb },
        { type: 'C', id: 'Cb', nodes: ['in', 'gnd'], value: p.Cb },
      ],
    }),
    layout: frontEnd('Rb', ['Cb']),
    sweep: (p) => ({ from: 10, to: 1e7, mode: 'bode', of: (ac) => cx.cscale(ac.v.in, 1 / p.A) }),
    show: 'v',
    view: 'bode',
    views: ['reading', 'equations', 'bode'],
    claim: { antialias: true },
  },
]
