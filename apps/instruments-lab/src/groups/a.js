// Group A: the oscilloscope's input, and the probe in front of it.
//
// Every scope reading is a divider between the circuit and the scope. These six
// experiments are that divider: the input's own RC, what a source resistance
// does to it, the 10× probe as a divider that can be made flat, the square wave
// that shows when it is not, what the probe buys, and the one number that ties
// rise time to bandwidth.

import { complex as cx } from '@ee-labs/network'
import { Amp, BOT, Cap, Cur, Freq, GROUPS, H, R, TOP, Win, chips, gnd, leg, node, rail, src, top } from '../kit.js'

const SCOPE_R = R('R2', 'Scope R_in', 1e6, 'the resistance the scope shows at DC')
const SCOPE_C = Cap('C2', 'Scope C_in', 15e-12, 'the capacitance across it, cable included')

/** The scope input drawn as two legs, with whatever feeds it along the top. */
function inputLayout({ srcId = 'V1', series = null, seriesLabel = null, srcNode = 'src', flip = false } = {}) {
  const xs = [260, 350]
  const items = [
    ...src(srcId, 50, flip),
    ...(series
      ? [rail(50, 130, TOP), ...top(series, 150), rail(170, xs[0], TOP), node(srcNode, 50, TOP, 't'), node('in', 215, TOP, 't')]
      : [rail(50, xs[0], TOP), node('in', 150, TOP, 't')]),
    ...leg('R2', xs[0]),
    rail(xs[0], xs[1], TOP),
    ...leg('C2', xs[1]),
    rail(50, xs[1], BOT),
    gnd(115),
  ]
  return { w: 460, h: H, items }
}

/**
 * The 10× probe in front of the scope input: R1 along the rail with C1 in
 * parallel below it, and a dashed frame round the pair.
 */
function probeLayout(feedId, feedNode) {
  const [x0, x1] = [200, 320]
  const legs = [400, 490]
  return {
    w: 600,
    h: H,
    items: [
      ...src('V1', 44),
      rail(44, 90, TOP),
      ...top(feedId, 110),
      rail(130, x0, TOP),
      node(feedNode, 44, TOP, 't'),
      // `tip` sits well clear of the feed resistor's body on one side and
      // R1's on the other — both symbols are ±20 wide and the widest reading
      // this node ever carries ("−1.23 mV") needs about 32 either way.
      node('tip', 170, TOP, 't'),
      // R1 on the rail, C1 on a branch below it, meeting again at `in`.
      rail(x0, x0 + 20, TOP),
      ...top('R1', x0 + 40),
      rail(x0 + 60, x1, TOP),
      { wire: [x0, TOP, x0, 100] },
      { wire: [x0, 100, x0 + 20, 100] },
      { el: 'C1', x: x0 + 40, y: 100, dir: 'h' },
      { wire: [x0 + 60, 100, x1, 100] },
      { wire: [x1, 100, x1, TOP] },
      rail(x1, legs[0], TOP),
      node('in', 360, TOP, 't'),
      ...leg('R2', legs[0]),
      rail(legs[0], legs[1], TOP),
      ...leg('C2', legs[1]),
      rail(44, legs[1], BOT),
      gnd(115),
    ],
  }
}

const scopeIn = (p) => [
  { type: 'R', id: 'R2', nodes: ['in', 'gnd'], value: p.R2 },
  { type: 'C', id: 'C2', nodes: ['in', 'gnd'], value: p.C2 },
]
const probe = (p) => [
  { type: 'R', id: 'R1', nodes: ['tip', 'in'], value: p.R1 },
  { type: 'C', id: 'C1', nodes: ['tip', 'in'], value: p.C1 },
]
const sine = (amp, freq) => ({ kind: 'sine', amp, freq })
const cycles = (p) => (p.N / p.f)

export const GROUP_A = [
  {
    id: 'a1',
    group: GROUPS[0],
    instrument: 'scope',
    name: 'The scope input is a resistor and a capacitor',
    terms: ['inputz', 'bandwidth'],
    params: [
      SCOPE_R,
      SCOPE_C,
      chips(Freq('f', 'Frequency', 1000), [1000, 10610.3, 1e6]),
      Cur('I', 'Test current', 1e-6, 'pushed into the input, so the volts read as ohms'),
      Win('N', 'Window', 'cycles', 6),
    ],
    net: (p) => ({
      elements: [{ type: 'I', id: 'I1', nodes: ['gnd', 'in'], value: 0, wave: sine(p.I, p.f) }, ...scopeIn(p)],
    }),
    layout: {
      w: 460,
      h: H,
      items: [
        ...src('I1', 50, true),
        rail(50, 350, TOP),
        node('in', 150, TOP, 't'),
        ...leg('R2', 260),
        rail(260, 350, TOP),
        ...leg('C2', 350),
        rail(50, 350, BOT),
        gnd(115),
      ],
    },
    window: cycles,
    cursor: 0.85,
    scope: {
      left: { unit: 'V', traces: [{ q: 'v', key: 'in', label: 'v_in' }] },
      right: { unit: 'A', traces: [{ q: 'i', key: 'C2', label: 'i_C' }] },
    },
    sweep: (p) => ({ from: 1, to: 1e7, mode: 'impedance', of: (ac) => cx.cscale(ac.v.in, 1 / p.I) }),
    show: 'i',
    view: 'impedance',
    views: ['reading', 'equations', 'scope', 'impedance'],
    claim: { inputz: true },
  },
  {
    id: 'a2',
    group: GROUPS[0],
    instrument: 'scope',
    name: 'A probe loads what it measures',
    terms: ['loading', 'probe'],
    params: [
      chips(R('Rs', 'Source R_s', 1e5), [1e3, 1e5, 1e6]),
      SCOPE_R,
      SCOPE_C,
      Amp('A', 'Amplitude', 1),
      chips(Freq('f', 'Frequency', 1000), [1000, 116714, 1e6]),
      Win('N', 'Window', 'cycles', 6),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['src', 'gnd'], value: 0, wave: sine(p.A, p.f) },
        { type: 'R', id: 'Rs', nodes: ['src', 'in'], value: p.Rs },
        ...scopeIn(p),
      ],
    }),
    layout: inputLayout({ series: 'Rs' }),
    window: cycles,
    cursor: 0.85,
    scope: {
      left: {
        unit: 'V',
        traces: [
          { q: 'v', key: 'src', label: 'v_src', dim: true },
          { q: 'v', key: 'in', label: 'v_in' },
        ],
      },
    },
    sweep: (p) => ({ from: 1, to: 1e7, mode: 'bode', of: (ac) => cx.cscale(ac.v.in, 1 / p.A) }),
    show: 'v',
    view: 'bode',
    views: ['reading', 'equations', 'scope', 'bode'],
    claim: { loaded: true },
  },
  {
    id: 'a3',
    group: GROUPS[0],
    instrument: 'scope',
    name: 'The 10× probe is a divider that can be flat',
    terms: ['compensation'],
    params: [
      R('R1', 'Probe R₁', 9e6),
      chips(Cap('C1', 'Probe C₁', 1.6666666666666667e-12), [1e-12, 1.6666666666666667e-12, 3e-12]),
      SCOPE_R,
      SCOPE_C,
      Amp('A', 'Amplitude', 1),
      Freq('f', 'Frequency', 1000),
    ],
    net: (p) => ({
      elements: [{ type: 'V', id: 'V1', nodes: ['tip', 'gnd'], value: 0, wave: sine(p.A, p.f) }, ...probe(p), ...scopeIn(p)],
    }),
    layout: {
      w: 520,
      h: H,
      items: [
        ...src('V1', 44),
        rail(44, 120, TOP),
        node('tip', 95, TOP, 't'),
        rail(120, 140, TOP),
        ...top('R1', 160),
        rail(180, 240, TOP),
        { wire: [120, TOP, 120, 100] },
        { wire: [120, 100, 140, 100] },
        { el: 'C1', x: 160, y: 100, dir: 'h' },
        { wire: [180, 100, 240, 100] },
        { wire: [240, 100, 240, TOP] },
        rail(240, 320, TOP),
        node('in', 280, TOP, 't'),
        ...leg('R2', 320),
        rail(320, 410, TOP),
        ...leg('C2', 410),
        rail(44, 410, BOT),
        gnd(80),
      ],
    },
    sweep: (p) => ({ from: 1, to: 1e8, mode: 'bode', of: (ac) => cx.cscale(ac.v.in, 1 / p.A) }),
    show: 'v',
    view: 'bode',
    views: ['reading', 'equations', 'bode'],
    claim: { flat: true },
  },
  {
    id: 'a4',
    group: GROUPS[0],
    instrument: 'scope',
    name: 'Compensation, on a square wave',
    terms: [],
    params: [
      chips(Cap('C1', 'Probe C₁', 1e-12), [1e-12, 1.6666666666666667e-12, 3e-12]),
      R('R1', 'Probe R₁', 9e6),
      SCOPE_R,
      SCOPE_C,
      Amp('A', 'Calibrator', 1),
      Freq('fc', 'Calibrator rate', 1000),
      R('Rcal', 'Calibrator R_out', 50, 'a square-wave generator has one, and the probe needs it'),
      Win('N', 'Window', 'periods', 2, 1, 6),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['cal', 'gnd'], value: 0, wave: { kind: 'square', amp: p.A, offset: 0, period: 1 / p.fc } },
        { type: 'R', id: 'Rcal', nodes: ['cal', 'tip'], value: p.Rcal },
        ...probe(p),
        ...scopeIn(p),
      ],
    }),
    layout: probeLayout('Rcal', 'cal'),
    window: (p) => p.N / p.fc,
    points: 2401,
    cursor: 0.18,
    scope: {
      left: {
        unit: 'V',
        traces: [
          { q: 'v', key: 'cal', label: 'v_cal', dim: true },
          { q: 'v', key: 'in', label: 'v_in' },
        ],
      },
    },
    show: 'v',
    view: 'scope',
    views: ['reading', 'equations', 'scope'],
    claim: { compensation: true },
  },
  {
    id: 'a5',
    group: GROUPS[0],
    instrument: 'scope',
    name: 'What the probe buys, and what it costs',
    terms: [],
    params: [
      chips(R('Rs', 'Source R_s', 1e5), [1e3, 1e5, 1e6]),
      R('R1', 'Probe R₁', 9e6),
      Cap('C1', 'Probe C₁', 1.6666666666666667e-12),
      SCOPE_R,
      SCOPE_C,
      Amp('A', 'Amplitude', 1),
      Freq('f', 'Frequency', 1000),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['src', 'gnd'], value: 0, wave: sine(p.A, p.f) },
        { type: 'R', id: 'Rs', nodes: ['src', 'tip'], value: p.Rs },
        ...probe(p),
        ...scopeIn(p),
      ],
    }),
    layout: probeLayout('Rs', 'src'),
    probeIn: true,
    sweep: (p) => ({ from: 1, to: 1e8, mode: 'bode', of: (ac) => cx.cscale(ac.v.in, 1 / p.A) }),
    show: 'v',
    view: 'bode',
    views: ['reading', 'equations', 'bode'],
    claim: { loaded: true },
  },
  {
    id: 'a6',
    group: GROUPS[0],
    instrument: 'scope',
    name: 'Rise time and bandwidth are one number',
    terms: ['risetime'],
    params: [chips(R('Rs', 'Source R_s', 1e5), [1e4, 1e5, 1e6]), SCOPE_R, SCOPE_C, Amp('A', 'Step', 1), Win('N', 'Window', 'τ', 12, 4, 30)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['src', 'gnd'], value: 0, wave: { kind: 'step', from: 0, to: p.A } },
        { type: 'R', id: 'Rs', nodes: ['src', 'in'], value: p.Rs },
        ...scopeIn(p),
      ],
    }),
    layout: inputLayout({ series: 'Rs' }),
    window: (p) => (p.N * (p.Rs * p.R2) * p.C2) / (p.Rs + p.R2),
    points: 1601,
    cursor: 0.25,
    scope: {
      left: {
        unit: 'V',
        traces: [
          { q: 'v', key: 'src', label: 'v_src', dim: true },
          { q: 'v', key: 'in', label: 'v_in' },
        ],
      },
    },
    show: 'v',
    view: 'scope',
    views: ['reading', 'equations', 'scope'],
    claim: { risetime: true },
  },
]
