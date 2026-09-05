// Group A: the op-amp as a user meets it.
//
// Circuit Elements Lab drew the op-amp as a box with three numbers and said
// the rest were datasheet facts. A user meets those facts on the first
// breadboard, before any transistor, and every course teaches them here. Each
// one is a toggle on that same box, and Group M builds every one of them out
// of transistors and derives the number.
//
// The circuit under all six is the non-inverting amplifier of the plan's §5,
// gain 1 + R_f/R_g. The op-amp element is the macro: with none of the extra
// fields it is Elements E2 exactly, and each toggle adds one piece of the
// circuit §2.2 of the plan describes.

import { Amp, Freq, Gain, Is, R, Toggle, Vs, W, H, TOP, BOT, chips, gnd, leg, node, wire } from '../knobs.js'

const GROUP = 'A · The op-amp as a user meets it'

/** The op-amp's datasheet numbers, the 741's, and Group M's targets. */
export const OPAMP = { gain: 1e5, vsat: 12, rout: 75, gbw: 1e6, slew: 0.5e6, vos: 1e-3, ib: 100e-9, cmrr: 90, imax: 25e-3 }

/**
 * The op-amp element with only the named non-idealities switched on. Every
 * other field is absent, and an absent field costs no nodes: the macro expands
 * to exactly what the toggles ask for.
 */
export const opamp = (on, over = {}) => ({
  type: 'OPAMP',
  id: 'U1',
  nodes: ['out'],
  ctrl: ['in', 'n'],
  gain: OPAMP.gain,
  vsat: OPAMP.vsat,
  ...Object.fromEntries(on.map((k) => [k, OPAMP[k]])),
  ...over,
})

/**
 * The non-inverting amplifier, drawn once and shared by A1, A3, A4 and A5.
 *
 * The Elements lab's idiom: the source is a leg on the left, the signal runs
 * along the top rail into the + input, and the feedback network comes back
 * along a rail low enough to clear the amplifier's own label. R_g goes on to
 * ground at the same height, so the divider reads left to right the way it is
 * written, R_g then R_f then the output.
 */
export function nonInverting() {
  return {
    w: W,
    h: H,
    items: [
      { el: 'V1', x: 50, y: 100, dir: 'v' },
      wire(50, 80, 50, 40),
      wire(50, 120, 50, 145),
      wire(50, 145, 70, 145),
      node('in', 50, 40, 't'),
      wire(50, 40, 215, 40),
      wire(215, 40, 215, 48),
      wire(215, 48, 230, 48),
      { el: 'U1', x: 230, y: 60, invertTop: false },
      wire(268, 60, 320, 60),
      node('out', 320, 60, 'r'),
      wire(320, 60, 320, 80),
      { el: 'RL', x: 320, y: 100, dir: 'v' },
      gnd(320, 120),
      wire(290, 60, 290, 145),
      wire(290, 145, 255, 145),
      { el: 'Rf', x: 235, y: 145, dir: 'h' },
      wire(215, 145, 170, 145),
      node('n', 170, 145, 'b'),
      wire(170, 145, 170, 72),
      wire(170, 72, 230, 72),
      wire(170, 145, 140, 145),
      { el: 'Rg', x: 120, y: 145, dir: 'h' },
      wire(100, 145, 70, 145),
      gnd(70, 145),
    ],
  }
}

/**
 * The inverting amplifier of A2, with a balancing resistor at the + input.
 * The signal chain is the top rail, R_g into the summing node, and the
 * feedback returns along the same rail from the output's riser. R_p hangs
 * from the + input on the far side of the amplifier's label.
 */
function inverting() {
  return {
    w: W,
    h: H,
    items: [
      { el: 'V1', x: 50, y: 95, dir: 'v' },
      wire(50, 75, 50, 40),
      wire(50, 115, 50, 155),
      node('in', 50, 40, 't'),
      wire(50, 40, 90, 40),
      { el: 'Rg', x: 110, y: 40, dir: 'h' },
      wire(130, 40, 170, 40),
      node('n', 170, 40, 't'),
      wire(170, 40, 170, 83),
      wire(170, 83, 230, 83),
      { el: 'U1', x: 230, y: 95, invertTop: true },
      wire(230, 107, 150, 107),
      node('p', 150, 107, 't'),
      wire(150, 107, 150, 115),
      { el: 'Rp', x: 150, y: 135, dir: 'v' },
      wire(150, 155, 50, 155),
      gnd(100, 155),
      wire(268, 95, 320, 95),
      node('out', 320, 95, 'r'),
      wire(320, 95, 320, 40),
      wire(320, 40, 270, 40),
      { el: 'Rf', x: 250, y: 40, dir: 'h' },
      wire(230, 40, 170, 40),
      wire(320, 95, 320, 115),
      { el: 'RL', x: 320, y: 135, dir: 'v' },
      gnd(320, 155),
    ],
  }
}

/**
 * The precision rectifier of A6: the diode inside the loop, and the feedback
 * taken from the load rather than from the amplifier's own output. The return
 * runs over the top, because underneath is where the pull-down hangs.
 */
function rectifier() {
  return {
    w: W,
    h: H,
    items: [
      { el: 'V1', x: 50, y: 90, dir: 'v' },
      wire(50, 70, 50, 40),
      wire(50, 110, 50, 140),
      node('in', 50, 40, 't'),
      wire(50, 40, 105, 40),
      wire(105, 40, 105, 82),
      wire(105, 82, 150, 82),
      { el: 'U1', x: 150, y: 70, invertTop: true },
      wire(188, 70, 245, 70),
      node('x', 215, 70, 't'),
      { el: 'D1', x: 265, y: 70, dir: 'h' },
      wire(285, 70, 340, 70),
      node('out', 340, 70, 'r'),
      wire(340, 70, 340, 90),
      { el: 'RL', x: 340, y: 110, dir: 'v' },
      wire(340, 130, 340, 140),
      wire(215, 70, 215, 100),
      { el: 'Rx', x: 215, y: 120, dir: 'v' },
      wire(215, 140, 215, 140),
      wire(50, 140, 340, 140),
      gnd(130, 140),
      wire(285, 70, 285, 25),
      wire(285, 25, 128, 25),
      wire(128, 25, 128, 58),
      wire(128, 58, 150, 58),
    ],
  }
}

const GAIN_KNOBS = [chips(R('Rf', 'R_f', 10000), [1000, 10000, 100000]), R('Rg', 'R_g', 1000)]
const LOAD = R('RL', 'Load R_L', 10000)

export const GROUP_A = [
  {
    id: 'a1',
    group: GROUP,
    name: 'Offset voltage, and what it does to gain',
    terms: ['opampmacro', 'offset', 'loopgain'],
    params: [Vs('E', 'Input V₁', 0), ...GAIN_KNOBS, LOAD, chips(Amp('vos', 'Offset V_OS', 1e-3), [1e-4, 1e-3, 5e-3])],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E, small: true },
        opamp([], { vos: p.vos }),
        { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: p.Rf },
        { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: p.Rg },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
      ],
    }),
    layout: nonInverting(),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    headline: { path: 'v.out', label: 'v_out', unit: 'V' },
  },
  {
    id: 'a2',
    group: GROUP,
    name: 'Bias current, and the resistor that cancels it',
    terms: ['biascurrent'],
    params: [
      chips(R('Rf', 'R_f', 100000), [10000, 100000, 1000000]),
      R('Rg', 'R_g', 10000),
      chips(R('Rp', 'Balance R_p', 1, 'set it to R_f ∥ R_g and the two errors cancel'), [1, 9090.909090909092, 100000]),
      LOAD,
      chips(Is('ib', 'Bias current I_B', 100e-9), [1e-9, 100e-9, 1e-6]),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, small: true },
        opamp([], { ctrl: ['p', 'n'], ib: p.ib }),
        { type: 'R', id: 'Rp', nodes: ['p', 'gnd'], value: p.Rp },
        { type: 'R', id: 'Rg', nodes: ['in', 'n'], value: p.Rg },
        { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: p.Rf },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
      ],
    }),
    layout: inverting(),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    headline: { path: 'v.out', label: 'v_out', unit: 'V' },
  },
  {
    id: 'a3',
    group: GROUP,
    name: 'Gain and bandwidth trade against each other',
    terms: ['gbw', 'pole', 'corner'],
    params: [...GAIN_KNOBS, LOAD, chips(Freq('gbw', 'Gain-bandwidth f_t', 1e6), [1e5, 1e6, 1e7]), Gain('A0', 'Open-loop gain A₀', 1e5)],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'sine', amp: 0.01, freq: 1000 }, small: true },
        opamp([], { gain: p.A0, gbw: p.gbw }),
        { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: p.Rf },
        { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: p.Rg },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
      ],
    }),
    layout: nonInverting(),
    show: 'ac',
    view: 'bode',
    views: ['reading', 'bode', 'pz', 'equations'],
    signal: { input: 'V1', output: 'out' },
    headline: { path: 'corner.high', label: 'f_3dB', unit: 'Hz' },
  },
  {
    id: 'a4',
    group: GROUP,
    name: 'Slew rate, and the ramp it makes of a step',
    terms: ['slew', 'currentlimit'],
    params: [
      chips(Amp('step', 'Output step', 10), [1, 5, 10]),
      chips(Vs('slewv', 'Slew rate SR', 0.5), [0.1, 0.5, 2]),
      R('Rf', 'R_f', 10000),
      R('Rg', 'R_g', 1000),
      R('RL', 'Load R_L', 1000),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], wave: { kind: 'step', from: 0, to: (p.step * p.Rg) / (p.Rf + p.Rg) } },
        opamp(['gbw'], { slew: p.slewv * 1e6 }),
        { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: p.Rf },
        { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: p.Rg },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
      ],
    }),
    layout: nonInverting(),
    show: 'dc',
    view: 'scope',
    views: ['reading', 'scope', 'equations'],
    // Long enough to hold the ramp and the settling after it, whatever the
    // step and the rate are.
    window: (p) => (2.5 * p.step) / (p.slewv * 1e6),
    cursor: 0.5,
    scope: { traces: [{ q: 'v', key: 'out', label: 'v_out' }] },
    headline: { path: 'slope', label: 'dv/dt', unit: 'V/s' },
  },
  {
    id: 'a5',
    group: GROUP,
    name: 'Common-mode rejection, and the output’s limits',
    terms: ['cmrr', 'currentlimit'],
    params: [
      chips(Vs('E', 'Input V₁', 1), [0.1, 1, 5]),
      R('Rf', 'R_f', 10000),
      R('Rg', 'R_g', 1000),
      chips(R('RL', 'Load R_L', 100), [100, 1000, 10000]),
      chips(Is('imax', 'Output limit I_max', 25e-3), [5e-3, 25e-3, 100e-3]),
      chips(Vs('vsat', 'Rails ±V_sat', 12), [5, 12, 15]),
      chips(Gain('cmrr', 'Rejection CMRR', 90, 'in decibels'), [60, 90, 120]),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E, small: true },
        opamp([], { cmrr: p.cmrr, imax: p.imax, vsat: p.vsat }),
        { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: p.Rf },
        { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: p.Rg },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
      ],
    }),
    layout: nonInverting(),
    show: 'dc',
    view: 'reading',
    views: ['reading', 'equations'],
    headline: { path: 'v.out', label: 'v_out', unit: 'V' },
  },
  {
    id: 'a6',
    group: GROUP,
    name: 'The precision rectifier',
    terms: ['precision', 'loopgain'],
    params: [
      chips(Amp('amp', 'Input amplitude', 0.01), [0.001, 0.01, 0.1]),
      Freq('f', 'Input frequency', 1000),
      R('RL', 'Load R_L', 10000),
      Toggle('loop', 'Diode', true, 'inside the loop', 'on its own', 'the same diode, driven by the source rather than by the amplifier'),
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], wave: { kind: 'sine', amp: p.amp, freq: p.f }, small: true },
        p.loop
          ? { type: 'OPAMP', id: 'U1', nodes: ['x'], ctrl: ['in', 'out'], gain: OPAMP.gain, vsat: OPAMP.vsat }
          : { type: 'OPAMP', id: 'U1', nodes: ['x'], ctrl: ['in', 'x'], gain: OPAMP.gain, vsat: OPAMP.vsat },
        { type: 'D', id: 'D1', nodes: ['x', 'out'], model: 'drop' },
        // The pull-down every breadboard has. While the diode blocks, the
        // amplifier's own output has nothing else on it, and a node with
        // nothing on it has no voltage the solver can name.
        { type: 'R', id: 'Rx', nodes: ['x', 'gnd'], value: 100000 },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
      ],
    }),
    layout: rectifier(),
    show: 'dc',
    view: 'scope',
    views: ['reading', 'scope', 'equations'],
    window: (p) => 2 / p.f,
    cursor: 0.125,
    scope: { traces: [{ q: 'v', key: 'in', label: 'v_in' }, { q: 'v', key: 'out', label: 'v_out' }] },
    headline: { path: 'peak.out', label: 'peak v_out', unit: 'V' },
  },
]
