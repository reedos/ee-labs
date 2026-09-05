// Group C: the multimeter.
//
// A meter is three circuits behind one pair of leads. A voltmeter is a
// resistance across the port, and it changes the reading by being there. A
// range switch is a tap on one divider, and a buffer is what keeps the input
// resistance the divider's. An ammeter is a shunt in the loop, and its burden
// voltage comes straight out of the circuit under test. An ohmmeter forces a
// current, and whether the leads are inside the answer is the whole difference
// between two wires and four.

import { Amp, BOT, Choice, GROUPS, H, Is, R, TOP, Toggle, Vs, amp, chips, gnd, leg, node, rail, src, top } from '../kit.js'

/** Source, one series resistance, then N legs across the output. */
function dividerLayout(legs, series = 'R1') {
  const xs = [250, 350]
  return {
    w: 460,
    h: H,
    items: [
      ...src('V1', 50),
      rail(50, 130, TOP),
      ...top(series, 150),
      rail(170, xs[0], TOP),
      node('in', 50, TOP, 't'),
      node('out', 205, TOP, 't'),
      ...legs.flatMap((id, k) => [...leg(id, xs[k]), ...(k ? [rail(xs[k - 1], xs[k], TOP)] : [])]),
      rail(50, xs[legs.length - 1], BOT),
      gnd(115),
    ],
  }
}

/**
 * The forcing source on the left, the leads and the resistor along the top, and
 * the return along the bottom. Four wires add a sense pair dropping from the
 * resistor's own terminals into a meter of its own.
 */
function ohmLayout(four) {
  const RET = four ? 210 : BOT
  const items = [
    { el: 'I1', x: 46, y: 90, dir: 'v', flip: true },
    { wire: [46, TOP, 46, 70] },
    { wire: [46, 110, 46, RET] },
    rail(46, 170, TOP),
    node('f1', 76, TOP, 't'),
    ...top(four ? 'Rf1' : 'Rl1', 190),
    rail(210, 250, TOP),
    node('a', 250, TOP, 't'),
    rail(250, 280, TOP),
    ...top('Rx', 300),
    rail(320, 360, TOP),
    node('b', 360, TOP, 't'),
    rail(360, 420, TOP),
    ...top(four ? 'Rf2' : 'Rl2', 440),
    rail(460, 510, TOP),
    { wire: [510, TOP, 510, RET] },
    rail(46, 510, RET),
    gnd(300, RET),
  ]
  if (!four) {
    // Two wires: the meter hangs across the pair the current was forced down.
    // The meter hangs at 140 rather than closer in: the forcing source's own
    // label runs to about x = 115 once its reading is a milliamp wide, and a
    // label on a symbol is what the geometry test calls a collision.
    items.push({ wire: [140, TOP, 140, 84] }, { el: 'Rm', x: 140, y: 104, dir: 'v' }, { wire: [140, 124, 140, RET] })
    return { w: 560, h: 180, items }
  }
  items.push(
    { wire: [250, TOP, 250, 80] },
    { el: 'Rs1', x: 250, y: 100, dir: 'v' },
    { wire: [250, 120, 250, 150] },
    node('s1', 250, 150, 'l'),
    { wire: [250, 150, 300, 150] },
    { el: 'Rm', x: 320, y: 150, dir: 'h' },
    { wire: [340, 150, 390, 150] },
    node('s2', 390, 150, 'r'),
    { wire: [390, 150, 390, 120] },
    { el: 'Rs2', x: 390, y: 100, dir: 'v' },
    { wire: [390, 80, 390, TOP] },
  )
  return { w: 580, h: 240, items }
}

const RANGES = [
  { value: 2, label: '2 V' },
  { value: 20, label: '20 V' },
  { value: 200, label: '200 V' },
]
/** The divider a range setting makes on a chain of `Rtot` with an `vfs` converter. */
export const tapOf = (p) => {
  const Rbot = (p.Rtot * p.vfs) / p.range
  return { Rtop: p.Rtot - Rbot, Rbot }
}

export const GROUP_C = [
  {
    id: 'c1',
    group: GROUPS[2],
    instrument: 'dmm',
    name: 'A voltmeter is a resistor across the circuit',
    terms: [],
    params: [
      Vs('E', 'Source V₁', 10),
      chips(R('R1', 'R₁', 1e6), [1e4, 1e6]),
      chips(R('R2', 'R₂', 1e6), [1e4, 1e6]),
      chips(R('Rm', 'Meter R_in', 1e7), [1e6, 1e7, 1e8]),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'R1', nodes: ['in', 'out'], value: p.R1 },
        { type: 'R', id: 'R2', nodes: ['out', 'gnd'], value: p.R2 },
        { type: 'R', id: 'Rm', nodes: ['out', 'gnd'], value: p.Rm },
      ],
    }),
    layout: dividerLayout(['R2', 'Rm']),
    port: ['out', 'gnd'],
    portOff: 'Rm',
    show: 'i',
    view: 'reading',
    views: ['reading', 'equations'],
    claim: { voltmeter: true },
  },
  {
    id: 'c2',
    group: GROUPS[2],
    instrument: 'dmm',
    name: 'The range switch is a tap on one divider',
    terms: ['buffer'],
    params: [
      Vs('E', 'Input V₁', 20),
      Choice('range', 'Range', 20, RANGES, 'where the tap sits on the same chain'),
      chips(R('Rtot', 'Input chain', 1e7), [1e6, 1e7]),
      Amp('vfs', 'Converter full scale', 0.2),
      chips(R('Radc', 'Converter R_in', 1e6), [1e5, 1e6, 1e8]),
      Toggle('buffer', 'Buffer', true, 'in', 'out', 'take it out and the converter loads the tap'),
    ],
    tap: tapOf,
    net: (p) => {
      const { Rtop, Rbot } = tapOf(p)
      return {
        elements: [
          { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
          { type: 'R', id: 'Rtop', nodes: ['in', 'tap'], value: Rtop },
          { type: 'R', id: 'Rbot', nodes: ['tap', 'gnd'], value: Rbot },
          ...(p.buffer
            ? [
                { type: 'OPAMP', id: 'U1', nodes: ['adc'], ctrl: ['tap', 'adc'] },
                { type: 'R', id: 'Radc', nodes: ['adc', 'gnd'], value: p.Radc },
              ]
            : [{ type: 'R', id: 'Radc', nodes: ['tap', 'gnd'], value: p.Radc }]),
        ],
      }
    },
    layout: (p) => {
      const a = { x: 264, y: 60, invertTop: false, run: 100 }
      const out = a.x + a.run
      const base = [
        ...src('V1', 40),
        rail(40, 80, TOP),
        ...top('Rtop', 100),
        rail(120, 164, TOP),
        node('in', 40, TOP, 't'),
        // The tap's label is the widest text on this drawing, so its dot sits at
      // the junction itself rather than back along the rail, where the label
      // would reach over R_top's symbol.
      node('tap', 164, TOP, 't'),
        ...leg('Rbot', 164),
        rail(40, 164, BOT),
        gnd(84),
      ]
      if (!p.buffer) return { w: 460, h: H, items: [...base, rail(164, 300, TOP), ...leg('Radc', 300), rail(164, 300, BOT)] }
      return {
        w: 460,
        h: 200,
        items: [
          ...base,
          rail(164, a.x, TOP),
          { wire: [a.x, TOP, a.x, a.y - 12] },
          ...amp({ ...a, out: 'adc' }),
          // The feedback runs under the triangle and climbs outside Rbot's label.
          { wire: [out - 30, a.y, out - 30, 126] },
          { wire: [out - 30, 126, 244, 126] },
          { wire: [244, 126, 244, a.y + 12] },
          { wire: [244, a.y + 12, a.x, a.y + 12] },
          { wire: [out, a.y, out, a.y + 20] },
          { el: 'Radc', x: out, y: a.y + 40, dir: 'v' },
          gnd(out, a.y + 60),
        ],
      }
    },
    show: 'v',
    view: 'reading',
    views: ['reading', 'equations'],
    claim: { ranges: true },
  },
  {
    id: 'c3',
    group: GROUPS[2],
    instrument: 'dmm',
    name: 'A shunt reads current, and burden voltage is the cost',
    terms: ['shunt', 'burden'],
    params: [
      Vs('E', 'Supply V₁', 5),
      chips(R('RL', 'Load R_L', 50), [50, 500]),
      chips(R('Rsh', 'Shunt R_sh', 1), [0.01, 0.1, 1]),
      Amp('vfs', 'Full scale', 0.1, 'the volts the meter reads across its shunt'),
      Is('ifs', 'Range', 10, 'the current that full scale stands for'),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
        { type: 'R', id: 'RL', nodes: ['in', 'sh'], value: p.RL },
        { type: 'R', id: 'Rsh', nodes: ['sh', 'gnd'], value: p.Rsh },
      ],
    }),
    layout: {
      w: 420,
      h: H,
      items: [
        ...src('V1', 50),
        rail(50, 130, TOP),
        ...top('RL', 150),
        rail(170, 290, TOP),
        node('in', 50, TOP, 't'),
        node('sh', 230, TOP, 't'),
        ...leg('Rsh', 290),
        rail(50, 290, BOT),
        gnd(115),
      ],
    },
    show: 'i',
    view: 'reading',
    views: ['reading', 'equations'],
    claim: { ammeter: true },
  },
  {
    id: 'c4',
    group: GROUPS[2],
    instrument: 'dmm',
    name: 'A two-wire resistance reading has the leads in it',
    terms: [],
    params: [
      Is('Itest', 'Test current', 1e-3),
      chips(R('Rx', 'The resistor R_x', 1), [1, 100, 10000]),
      chips(R('Rlead', 'Each lead', 0.1), [0.01, 0.1, 0.5]),
      R('Rm', 'Meter R_in', 1e7),
    ],
    net: (p) => ({
      elements: [
        { type: 'I', id: 'I1', nodes: ['gnd', 'f1'], value: p.Itest },
        { type: 'R', id: 'Rl1', nodes: ['f1', 'a'], value: p.Rlead },
        { type: 'R', id: 'Rx', nodes: ['a', 'b'], value: p.Rx },
        { type: 'R', id: 'Rl2', nodes: ['b', 'gnd'], value: p.Rlead },
        { type: 'R', id: 'Rm', nodes: ['f1', 'gnd'], value: p.Rm },
      ],
    }),
    layout: ohmLayout(false),
    show: 'v',
    view: 'reading',
    views: ['reading', 'equations'],
    claim: { ohmmeter: true },
  },
  {
    id: 'c5',
    group: GROUPS[2],
    instrument: 'dmm',
    name: 'Four wires put the leads outside the answer',
    terms: ['fourwire'],
    params: [
      Is('Itest', 'Test current', 1e-3),
      chips(R('Rx', 'The resistor R_x', 1), [1, 100, 10000]),
      chips(R('Rlead', 'Each lead', 0.1), [0.01, 0.1, 0.5]),
      chips(R('Rm', 'Meter R_in', 1e7), [1e5, 1e7, 1e9]),
    ],
    net: (p) => ({
      elements: [
        { type: 'I', id: 'I1', nodes: ['gnd', 'f1'], value: p.Itest },
        { type: 'R', id: 'Rf1', nodes: ['f1', 'a'], value: p.Rlead },
        { type: 'R', id: 'Rx', nodes: ['a', 'b'], value: p.Rx },
        { type: 'R', id: 'Rf2', nodes: ['b', 'gnd'], value: p.Rlead },
        { type: 'R', id: 'Rs1', nodes: ['a', 's1'], value: p.Rlead },
        { type: 'R', id: 'Rs2', nodes: ['b', 's2'], value: p.Rlead },
        { type: 'R', id: 'Rm', nodes: ['s1', 's2'], value: p.Rm },
      ],
    }),
    layout: ohmLayout(true),
    fourWire: true,
    show: 'i',
    view: 'reading',
    views: ['reading', 'equations'],
    claim: { ohmmeter: true },
  },
]
