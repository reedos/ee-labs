// Group F: uncertainty.
//
// A reading is not a value. This group takes C1's circuit and does three exact
// things to its reading: quantises it to the meter's count, puts the maker's
// accuracy specification around it, and propagates the resistors' tolerances
// through the divider by their sensitivities. Then it states the instrument's
// own noise floor as a closed form, and labels it a model. No noise is
// generated anywhere in this lab.

import { solveDC } from '@ee-labs/network'
import { BOT, Cap, Choice, Cur, GROUPS, H, Pct, R, Range, TOP, Vs, chips, gnd, leg, node, rail, src, top } from '../kit.js'
import { meterOf, sensitivities } from '../math.js'

/** Source, one series resistance, then the legs across the output. */
const dividerLayout = (legs) => ({
  w: 460,
  h: H,
  items: [
    ...src('V1', 50),
    rail(50, 130, TOP),
    ...top('R1', 150),
    rail(170, 250, TOP),
    node('in', 50, TOP, 't'),
    node('out', 205, TOP, 't'),
    ...legs.flatMap((id, k) => [...leg(id, 250 + 100 * k), ...(k ? [rail(150 + 100 * k, 250 + 100 * k, TOP)] : [])]),
    rail(50, 250 + 100 * (legs.length - 1), BOT),
    gnd(115),
  ],
})

const METERS = [
  { value: 1999, label: '3½ digits' },
  { value: 19999, label: '4½ digits' },
  { value: 1999999, label: '6½ digits' },
]

const loadedDivider = (p) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
    { type: 'R', id: 'R1', nodes: ['in', 'out'], value: p.R1 },
    { type: 'R', id: 'R2', nodes: ['out', 'gnd'], value: p.R2 },
    { type: 'R', id: 'Rm', nodes: ['out', 'gnd'], value: p.Rm },
  ],
})

/** The reading, the true value behind it, and the meter's arithmetic over both. */
const meterOn = (x, p) => {
  const read = x.sol.v.out
  const truth = solveDC({ elements: loadedDivider(p).elements.filter((e) => e.id !== 'Rm') }).v.out
  const m = meterOf(read, { counts: p.counts, fullScale: p.range, pct: p.pct ?? 0, terms: p.terms ?? 0 })
  return { ...m, read, true: truth, error: read - truth, errorPct: (100 * (read - truth)) / truth }
}

const METER_KNOBS = [
  Vs('E', 'Source V₁', 10),
  chips(R('R1', 'R₁', 1e6), [1e4, 1e6]),
  chips(R('R2', 'R₂', 1e6), [1e4, 1e6]),
  chips(R('Rm', 'Meter R_in', 1e7), [1e6, 1e7, 1e9]),
  Choice('counts', 'Display', 1999, METERS, 'how many counts the display has'),
  chips(Range('range', 'Range', 20), [2, 20, 200]),
]

export const GROUP_F = [
  {
    id: 'f1',
    group: GROUPS[5],
    instrument: 'dmm',
    name: 'Resolution is the last count',
    terms: ['count'],
    params: METER_KNOBS,
    net: loadedDivider,
    layout: dividerLayout(['R2', 'Rm']),
    meter: meterOn,
    show: 'v',
    view: 'errorbar',
    views: ['reading', 'equations', 'errorbar'],
    claim: { resolution: true },
  },
  {
    id: 'f2',
    group: GROUPS[5],
    instrument: 'dmm',
    name: 'Accuracy is two terms, and one of them wins',
    terms: ['accuracy'],
    params: [
      ...METER_KNOBS,
      Pct('pct', 'Per cent of reading', 0.5),
      chips({ key: 'terms', label: 'Plus counts', unit: '', min: 0, max: 20, scale: 'linear', default: 2, eng: false }, [1, 2, 5]),
    ],
    net: loadedDivider,
    layout: dividerLayout(['R2', 'Rm']),
    meter: meterOn,
    show: 'v',
    view: 'errorbar',
    views: ['reading', 'equations', 'errorbar'],
    claim: { resolution: true, accuracy: true },
  },
  {
    id: 'f3',
    group: GROUPS[5],
    instrument: 'dmm',
    name: 'Errors through a divider add by their sensitivities',
    terms: ['sensitivity'],
    params: [Vs('E', 'Source V₁', 10), chips(R('R1', 'R₁', 1e4), [1e4, 9e4]), chips(R('R2', 'R₂', 1e4), [1e4, 1e5]), Pct('tol', 'Resistor tolerance', 1)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'out'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['out', 'gnd'], value: p.R2 },
      ],
    }),
    layout: dividerLayout(['R2']),
    readOut: (p) => (p.E * p.R2) / (p.R1 + p.R2),
    sens: (x, p) =>
      sensitivities(
        x.exp,
        p,
        (q) => solveDC({ elements: [
          { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: q.E },
          { type: 'R', id: 'R1', nodes: ['in', 'out'], value: q.R1 },
          { type: 'R', id: 'R2', nodes: ['out', 'gnd'], value: q.R2 },
        ] }).v.out,
        [
          { key: 'R1', tol: p.tol },
          { key: 'R2', tol: p.tol },
        ],
      ),
    show: 'v',
    view: 'contrib',
    views: ['reading', 'equations', 'contrib'],
    claim: { propagate: true },
  },
  {
    id: 'f4',
    group: GROUPS[5],
    instrument: 'scope',
    name: 'The instrument has a floor of its own',
    terms: ['noisefloor'],
    params: [
      chips(R('R2', 'Input R', 1e6), [1e3, 1e6, 1e7]),
      chips(Cap('C2', 'Input C', 15e-12), [15e-12, 1e-9]),
      { key: 'T', label: 'Temperature', unit: 'K', min: 4, max: 400, scale: 'linear', default: 300, eng: false },
      Choice('counts', 'A meter, for comparison', 1999, METERS),
      chips(Range('range', 'Its range', 20), [2, 20, 200]),
      Cur('I', 'Test current', 1e-6),
      { key: 'f', label: 'Frequency', unit: 'Hz', min: 1, max: 1e7, scale: 'log', default: 1000 },
    ],
    net: (p) => ({
      elements: [
        { type: 'I', id: 'I1', nodes: ['gnd', 'in'], value: 0, wave: { kind: 'sine', amp: p.I, freq: p.f } },
        { type: 'R', id: 'R2', nodes: ['in', 'gnd'], value: p.R2 },
        { type: 'C', id: 'C2', nodes: ['in', 'gnd'], value: p.C2 },
      ],
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
    show: 'v',
    view: 'reading',
    views: ['reading', 'equations'],
    claim: { noise: true },
  },
]
