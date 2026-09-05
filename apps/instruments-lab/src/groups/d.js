// Group D: the spectrum analyser as a swept filter.
//
// An analyser is a tuned filter, a detector and a sweep. The filter here is a
// series RLC read across its resistor, which is exactly rational and has a
// closed-form bandwidth. The lab sweeps the source past a fixed filter rather
// than the filter past a fixed source, and D2's lesson says so. The two traces
// have the same peak and the same width, and they differ in the skirts by first
// order in Δf/f₀.

import { complex as cx } from '@ee-labs/network'
import { Amp, BOT, Cap, Freq, GROUPS, H, Ind, R, TOP, Win, chips, gnd, leg, node, rail, src, top } from '../kit.js'

/**
 * The filter drawn as a loop: L and C along the top, R down to ground. A second
 * tone is a second source in the return rail, where its label has room, rather
 * than stacked on the first.
 */
const filterLayout = (twoTone) => ({
  w: 460,
  h: H,
  items: [
    ...src('V1', 46),
    rail(46, 110, TOP),
    ...top('L1', 130),
    rail(150, 210, TOP),
    node('n1', 180, TOP, 't'),
    ...top('C1', 240),
    rail(260, 340, TOP),
    node('out', 300, TOP, 't'),
    ...leg('R1', 340),
    node('in', 78, TOP, 't'),
    ...(twoTone
      ? [node('m1', 80, BOT, 't'), rail(46, 119, BOT), { el: 'V2', x: 130, y: BOT, dir: 'h' }, rail(141, 340, BOT), gnd(240)]
      : [rail(46, 340, BOT), gnd(150)]),
  ],
})

const sine = (amp, freq) => ({ kind: 'sine', amp, freq })
/** The band-pass magnitude of a series RLC read across R, exactly. */
export const bandpass = (p) => {
  const f0 = 1 / (2 * Math.PI * Math.sqrt(p.L * p.C))
  const q = (2 * Math.PI * f0 * p.L) / p.R
  return { f0, q, rbw: f0 / q, at: (f) => 1 / Math.hypot(1, q * (f / f0 - f0 / f)) }
}
const L0 = 10e-3
const C0 = 1 / ((2 * Math.PI * 1e4) ** 2 * L0)
const R100 = L0 * 2 * Math.PI * 100

const oneTone = (p) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: sine(p.A, p.f) },
    { type: 'L', id: 'L1', nodes: ['in', 'n1'], value: p.L },
    { type: 'C', id: 'C1', nodes: ['n1', 'out'], value: p.C },
    { type: 'R', id: 'R1', nodes: ['out', 'gnd'], value: p.R },
  ],
})

const FILTER = [Ind('L', 'Filter L', L0), Cap('C', 'Filter C', C0), chips(R('R', 'Filter R', R100), [R100, 10 * R100])]
/** The same three knobs, with the two that set the width held: D3 and D4 vary the tuning only. */
const HELD = FILTER.map((k) => (k.key === 'C' ? k : { ...k, fixed: true }))
const around = (p) => {
  const { f0 } = bandpass(p)
  return { from: f0 / 4, to: f0 * 4, mode: 'bode', points: 801 }
}

export const GROUP_D = [
  {
    id: 'd1',
    group: GROUPS[3],
    instrument: 'analyser',
    name: 'The resolution bandwidth is the filter’s bandwidth',
    terms: ['rbw'],
    params: [...FILTER, Amp('A', 'Tone', 1), chips(Freq('f', 'Tone frequency', 1e4), [9950, 1e4, 10050])],
    net: oneTone,
    layout: filterLayout(false),
    sweep: (p) => ({ ...around(p), of: (ac) => cx.cscale(ac.v.out, 1 / p.A) }),
    show: 'v',
    view: 'bode',
    views: ['reading', 'equations', 'bode'],
    claim: { rbw: true },
  },
  {
    id: 'd2',
    group: GROUPS[3],
    instrument: 'analyser',
    name: 'A single tone draws the filter, not the signal',
    terms: ['detector'],
    params: [...FILTER, Amp('A', 'Tone', 1), chips(Freq('f', 'Tone frequency', 1e4), [1e4, 10050, 10200])],
    net: oneTone,
    layout: filterLayout(false),
    sweep: (p) => ({ ...around(p), of: (ac) => cx.cscale(ac.v.out, 1 / p.A) }),
    show: 'v',
    view: 'bode',
    views: ['reading', 'equations', 'bode'],
    claim: { shape: true },
  },
  {
    id: 'd3',
    group: GROUPS[3],
    instrument: 'analyser',
    name: 'Two tones need a bandwidth narrower than their spacing',
    terms: [],
    params: [
      ...HELD,
      Amp('A', 'Each tone', 1),
      // Two tones that differ, and a filter whose width is what the experiment
      // is about, are the premise rather than a setting: the try steps move
      // them and the fuzzer leaves them alone.
      chips({ ...Freq('fa', 'Lower tone', 9900), fixed: true }, [9900, 9950]),
      chips({ ...Freq('fb', 'Upper tone', 10100), fixed: true }, [10050, 10100]),
      Win('N', 'Window', 'beats', 24, 12, 40),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'm1'], value: 0, wave: sine(p.A, p.fa) },
        { type: 'V', id: 'V2', nodes: ['m1', 'gnd'], value: 0, wave: sine(p.A, p.fb) },
        { type: 'L', id: 'L1', nodes: ['in', 'n1'], value: p.L },
        { type: 'C', id: 'C1', nodes: ['n1', 'out'], value: p.C },
        { type: 'R', id: 'R1', nodes: ['out', 'gnd'], value: p.R },
      ],
    }),
    layout: filterLayout(true),
    // Long enough for the filter's own natural response to have gone, and the
    // detector reads only the last half, over a whole number of beat periods.
    window: (p) => p.N / Math.abs(p.fb - p.fa),
    points: 3001,
    cursor: 0.9,
    // The detector reads the last third, a whole number of beat periods in,
    // by which time the filter's own natural response is gone.
    detect: (p) => ({ of: (sol) => sol.v.out, over: Math.floor(p.N / 3) / Math.abs(p.fb - p.fa) }),
    scope: { left: { unit: 'V', traces: [{ q: 'v', key: 'out', label: 'v_out' }] } },
    sweep: (p) => ({ ...around(p), of: (ac) => cx.cscale(ac.v.out, 1 / p.A) }),
    show: 'v',
    view: 'scope',
    views: ['reading', 'equations', 'scope', 'bode'],
    claim: { twotone: true },
  },
  {
    id: 'd4',
    group: GROUPS[3],
    instrument: 'analyser',
    name: 'A filter that narrow needs time',
    terms: [],
    params: [
      ...HELD,
      Amp('A', 'Tone', 1),
      Freq('span', 'Span to sweep', 2000, 'how wide a band the analyser is asked to cover'),
      Win('N', 'Window', 'τ', 10, 4, 20),
    ],
    // The analyser is tuned to the tone, so the tone sits at the filter's own
    // centre whatever L and C are set to.
    net: (p) => oneTone({ ...p, f: 1 / (2 * Math.PI * Math.sqrt(p.L * p.C)) }),
    layout: filterLayout(false),
    window: (p) => (p.N * 2 * p.L) / p.R,
    points: 6001,
    cursor: 0.9,
    scope: { left: { unit: 'V', traces: [{ q: 'v', key: 'out', label: 'v_out' }] } },
    show: 'v',
    view: 'scope',
    views: ['reading', 'equations', 'scope'],
    claim: { settling: true },
  },
]
