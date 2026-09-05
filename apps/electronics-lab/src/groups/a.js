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

/** The non-inverting amplifier, drawn once and shared by A1, A3, A4 and A5. */
export function nonInverting() {
  return {
    w: W,
    h: H,
    items: [
      ...leg('V1', 50),
      wire(50, TOP, 105, TOP),
      wire(105, TOP, 105, 82),
      wire(105, 82, 150, 82),
      { el: 'U1', x: 150, y: 70 },
      wire(150, 58, 130, 58),
      wire(130, 58, 130, 18),
      wire(130, 18, 170, 18),
      { el: 'Rf', x: 190, y: 18, dir: 'h' },
      wire(210, 18, 250, 18),
      wire(250, 18, 250, 70),
      wire(188, 70, 250, 70),
      wire(250, 70, 330, 70),
      wire(130, 58, 90, 58),
      wire(90, 58, 90, 85),
      { el: 'Rg', x: 90, y: 105, dir: 'v' },
      wire(90, 125, 90, BOT),
      wire(330, 70, 330, 85),
      { el: 'RL', x: 330, y: 105, dir: 'v' },
      wire(330, 125, 330, BOT),
      wire(50, BOT, 330, BOT),
      gnd(190, BOT),
      node('in', 50, TOP, 't'),
      node('n', 130, 58, 'b'),
      node('out', 250, 70, 't'),
    ],
  }
}

/** The inverting amplifier of A2, with a balancing resistor at the + input. */
function inverting() {
  return {
    w: W,
    h: H,
    items: [
      ...leg('V1', 50),
      wire(50, TOP, 70, TOP),
      wire(70, TOP, 70, 58),
      { el: 'Rg', x: 95, y: 58, dir: 'h' },
      wire(115, 58, 150, 58),
      { el: 'U1', x: 150, y: 70 },
      wire(130, 58, 130, 18),
      wire(130, 18, 170, 18),
      { el: 'Rf', x: 190, y: 18, dir: 'h' },
      wire(210, 18, 250, 18),
      wire(250, 18, 250, 70),
      wire(188, 70, 250, 70),
      wire(150, 82, 120, 82),
      wire(120, 82, 120, 95),
      { el: 'Rp', x: 120, y: 115, dir: 'v' },
      wire(120, 135, 120, BOT),
      wire(250, 70, 330, 70),
      wire(330, 70, 330, 85),
      { el: 'RL', x: 330, y: 105, dir: 'v' },
      wire(330, 125, 330, BOT),
      wire(50, BOT, 330, BOT),
      gnd(190, BOT),
      node('in', 50, TOP, 't'),
      node('n', 130, 58, 't'),
      node('p', 120, 82, 'l'),
      node('out', 250, 70, 't'),
    ],
  }
}

/** The precision rectifier of A6: the diode inside the loop. */
function rectifier() {
  return {
    w: W,
    h: H,
    items: [
      ...leg('V1', 50),
      wire(50, TOP, 105, TOP),
      wire(105, TOP, 105, 58),
      wire(105, 58, 150, 58),
      { el: 'U1', x: 150, y: 70 },
      wire(188, 70, 215, 70),
      { el: 'D1', x: 245, y: 70, dir: 'h' },
      wire(275, 70, 340, 70),
      wire(340, 70, 340, 85),
      { el: 'RL', x: 340, y: 105, dir: 'v' },
      wire(340, 125, 340, BOT),
      wire(215, 70, 215, 85),
      { el: 'Rx', x: 215, y: 105, dir: 'v' },
      wire(215, 125, 215, BOT),
      wire(150, 82, 128, 82),
      wire(128, 82, 128, 120),
      wire(128, 120, 285, 120),
      wire(285, 120, 285, 70),
      wire(50, BOT, 340, BOT),
      gnd(180, BOT),
      node('in', 50, TOP, 't'),
      node('x', 215, 70, 't'),
      node('out', 285, 70, 't'),
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
    terms: ['opampmacro', 'offset', 'looopgain'],
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
    ],
    net: (p) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E, small: true },
        opamp(['cmrr'], { imax: p.imax }),
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
    terms: ['precision', 'looopgain'],
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
