// Group G: ports, and what loads them.
//
// Every amplifier from here on is described by three numbers: what it looks
// like at its input, what it produces open-circuit, and what it looks like at
// its output. Circuit Elements Lab found a Thévenin resistance by killing the
// independent sources and looking in, and that method gives the wrong answer
// the moment a dependent source is inside the box. This group replaces it
// with the one that always works, and then applies it to the box.
//
// Two circuits.
//
//   the port    one resistor and one dependent source that watches the port's
//               own voltage. A test source pushes a known current in and the
//               voltage that appears is the answer (G1).
//   the box     Circuit Elements Lab's op-amp model, source resistance and
//               load included, so that each of the three numbers is read at
//               the terminals rather than off the netlist (G2).

import { Amp, Gain, R, Vs, W, H, TOP, BOT, MID, chips, gnd, node, wire } from '../knobs.js'

export const GROUP_G_NAME = 'G · Ports, and what loads them'

/** A transconductance in siemens, either sign: the one knob G1 turns. */
const Gm = (key, label, def, hint) => ({ key, label, unit: 'S', min: -0.1, max: 0.1, scale: 'linear', default: def, hint })

/**
 * G1: a test source, a resistor, and a dependent source controlled by the
 * port's own voltage. The test source carries a sine so that the port is
 * measured the way an instrument measures it, and so that a negative
 * resistance shows on the scope as a voltage that runs backwards.
 */
const port = (p) => ({
  elements: [
    { type: 'I', id: 'It', nodes: ['gnd', 'x'], value: p.it, wave: { kind: 'sine', amp: p.it, freq: 1000 } },
    { type: 'R', id: 'R1', nodes: ['x', 'gnd'], value: p.R1 },
    { type: 'VCCS', id: 'G1', nodes: ['x', 'gnd'], ctrl: ['x', 'gnd'], gain: p.g },
  ],
})

/**
 * G2: Circuit Elements Lab's op-amp model with a source and a load on it.
 * `Rin`, the controlled source and `Rout` are what the box is; `Rs` and `RL`
 * are what the world does to it.
 */
const box = (p) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E, wave: { kind: 'sine', amp: p.E, freq: 1000 }, small: true },
    { type: 'R', id: 'Rs', nodes: ['in', 'p'], value: p.Rs },
    { type: 'R', id: 'Rin', nodes: ['p', 'gnd'], value: p.Rin },
    { type: 'VCVS', id: 'A1', nodes: ['o', 'gnd'], ctrl: ['p', 'gnd'], gain: p.A },
    { type: 'R', id: 'Rout', nodes: ['o', 'out'], value: p.Rout },
    { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
  ],
})

// ------------------------------------------------------------ the drawings

const legTo = (id, x, y, top, bot, flip = false) => [
  { el: id, x, y, dir: 'v', flip },
  wire(x, top, x, y - 20),
  wire(x, y + 20, x, bot),
]

/** G1's drawing: three elements across one port. */
function portLayout() {
  return {
    w: W,
    h: H,
    items: [
      ...legTo('It', 60, MID, TOP, BOT, true),
      wire(60, TOP, 160, TOP),
      ...legTo('R1', 160, MID, TOP, BOT),
      wire(160, TOP, 270, TOP),
      ...legTo('G1', 270, MID, TOP, BOT),
      wire(60, BOT, 270, BOT),
      gnd(110, BOT),
      node('x', 110, TOP, 't'),
      { text: 'i = g · v_x', x: 270, y: 172 },
    ],
  }
}

/**
 * G2's drawing: Circuit Elements Lab's, so a reader who met the box there
 * meets the same picture here. The dashed frame is the box, and everything
 * outside it is the world the box is wired into.
 */
function boxLayout() {
  return {
    w: W,
    h: H,
    items: [
      { box: [119, 4, 315, 162] },
      { text: 'the amplifier, modelled', x: 185, y: 14 },
      ...legTo('V1', 40, MID, TOP, BOT),
      wire(40, TOP, 70, TOP),
      { el: 'Rs', x: 90, y: TOP, dir: 'h' },
      wire(110, TOP, 140, TOP),
      ...legTo('Rin', 140, MID, TOP, BOT),
      node('in', 40, TOP, 't'),
      node('p', 140, TOP, 'r'),
      ...legTo('A1', 234, MID, TOP, BOT),
      wire(234, TOP, 262, TOP),
      { el: 'Rout', x: 282, y: TOP, dir: 'h' },
      wire(302, TOP, 350, TOP),
      ...legTo('RL', 350, MID, TOP, BOT),
      node('o', 234, TOP, 't'),
      node('out', 350, TOP, 't'),
      wire(40, BOT, 350, BOT),
      gnd(100, BOT),
    ],
  }
}

// ------------------------------------------------------------ the list

export const GROUP_G = [
  {
    id: 'g1',
    group: GROUP_G_NAME,
    name: 'A port with a dependent source inside',
    terms: ['port', 'testsource', 'negativeresistance', 'oscillator'],
    params: [
      chips(Gm('g', 'Source g', 0.01, 'zero switches the dependent source off, and the port is then the resistor alone'), [-0.01, 0, 0.01]),
      chips(R('R1', 'Resistor R₁', 1000), [100, 1000, 10000]),
      Amp('it', 'Test current', 1e-3),
    ],
    net: port,
    layout: portLayout(),
    show: 'ac',
    view: 'reading',
    views: ['reading', 'scope', 'equations'],
    signal: { input: 'It', output: 'x' },
    probe: 1000,
    window: () => 2e-3,
    cursor: 0.125,
    scope: { traces: [{ q: 'v', key: 'x', label: 'v_x' }] },
    headline: { path: 'gain', label: 'R_port', unit: 'Ω' },
  },
  {
    id: 'g2',
    group: GROUP_G_NAME,
    name: 'The amplifier as a two-port',
    terms: ['twoport', 'loadingrule'],
    params: [
      Amp('E', 'Input V₁', 0.01),
      chips(R('Rs', 'Source R_s', 1000), [100, 1000, 10000]),
      chips(R('Rin', 'Input R_in', 10000), [1000, 10000, 100000]),
      Gain('A', 'Open-circuit gain A_vo', 10),
      chips(R('Rout', 'Output R_out', 1000), [100, 1000, 10000]),
      chips(R('RL', 'Load R_L', 1000), [1000, 10000, 1000000]),
    ],
    net: box,
    layout: boxLayout(),
    show: 'ac',
    view: 'reading',
    views: ['reading', 'scope', 'equations'],
    signal: { input: 'V1', output: 'out' },
    probe: 1000,
    window: () => 2e-3,
    cursor: 0.125,
    scope: {
      traces: [
        { q: 'v', key: 'in', label: 'v_in' },
        { q: 'v', key: 'out', label: 'v_out' },
      ],
    },
    headline: { path: 'gain', label: 'A_v', unit: '' },
  },
]

// ------------------------------------------------------------ the math panel

const T = (text) => ({ kind: 'text', text })
const FRM = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.02, extra = {}) => ({ label, predicted, measured, unit, tol, ...extra })

export const MATH_G = {
  g1(p, x) {
    const denom = 1 + p.g * p.R1
    const open = Math.abs(denom) < 1e-6 ? 'The dependent source cancels the resistor exactly at this setting, so the port has no finite resistance to check.' : null
    return {
      blocks: [
        T('The test source states the definition. Push a known current into the port, read the voltage that appears, and divide. The dependent source is still there while it is done, which is why the answer is not the resistor.'),
        FRM('R_{port} = \\frac{v_x}{i_x} = \\frac{R_1}{1 + gR_1}'),
        C([
          row('the port’s resistance', p.R1 / denom, x.gain, 'Ω', 1e-9, { unchecked: open }),
          row('the voltage the test current makes', (p.R1 / denom) * x.sol.i.It, x.sol.v.x, 'V', 1e-9, { unchecked: open }),
        ]),
        V([
          { label: 'what the resistor alone would say', value: p.R1, unit: 'Ω', note: 'the answer from killing the sources and adding up resistors' },
          { label: 'the current the dependent source carries', value: x.sol.i.G1, unit: 'A' },
        ]),
      ],
    }
  },

  g2(p, x) {
    const inDiv = p.Rin / (p.Rin + p.Rs)
    const outDiv = p.RL / (p.RL + p.Rout)
    return {
      blocks: [
        T('Three numbers describe the box and two dividers describe what the world does to it. The source loses part of its voltage in its own resistance, and the output loses part of its in the amplifier’s.'),
        FRM('\\frac{v_{out}}{v_{in}} = A_{vo}\\,\\frac{R_{in}}{R_{in} + R_s}\\,\\frac{R_L}{R_L + R_{out}}'),
        C([
          row('the gain, both dividers counted', p.A * inDiv * outDiv, x.gain, '', 1e-9),
          row('the input resistance, from v and i at the port', p.Rin, x.sol.v.p / x.sol.i.Rs, 'Ω', 1e-9),
          row('the output divider', outDiv, x.sol.v.out / x.sol.v.o, '', 1e-9),
        ]),
        V([
          { label: 'the input divider', value: inDiv, unit: '', note: 'what reaches the amplifier from the source' },
          { label: 'the open-circuit output', value: p.A * inDiv * p.E, unit: 'V', note: 'what the box would deliver into nothing' },
        ]),
      ],
    }
  },
}
