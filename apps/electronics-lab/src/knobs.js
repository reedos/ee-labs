// The knobs and the drawing grid, shared by every group file.
//
// They live apart from experiments.js because the group files import them and
// experiments.js imports the group files. One direction of import, and no
// cycle to reason about.

import { fmt } from '@ee-labs/ui'

export const R = (key, label, def, hint) => ({ key, label, unit: 'Ω', min: 1, max: 1e7, scale: 'log', default: def, hint })
export const Vs = (key, label, def, hint) => ({ key, label, unit: 'V', min: -24, max: 24, scale: 'linear', default: def, hint })
export const Amp = (key, label, def, hint) => ({ key, label, unit: 'V', min: 1e-6, max: 12, scale: 'log', default: def, hint })
export const Is = (key, label, def, hint) => ({ key, label, unit: 'A', min: 1e-9, max: 0.1, scale: 'log', default: def, hint })
// A saturation current is twelve decades below a bias current, so it gets its
// own range rather than sharing the one a bias current uses.
export const SatI = (key, label, def, hint) => ({ key, label, unit: 'A', min: 1e-18, max: 1e-9, scale: 'log', default: def, hint })
export const Cap = (key, label, def, hint) => ({ key, label, unit: 'F', min: 1e-15, max: 1e-3, scale: 'log', default: def, hint })
export const Freq = (key, label, def, hint) => ({ key, label, unit: 'Hz', min: 0.1, max: 1e9, scale: 'log', default: def, hint })
export const Gain = (key, label, def, hint) => ({ key, label, unit: '', min: 1, max: 1e7, scale: 'log', default: def, hint })
export const Temp = (key, label, def, hint) => ({ key, label, unit: 'K', min: 200, max: 450, scale: 'linear', default: def, hint })
export const Dope = (key, label, def, hint) => ({ key, label, unit: 'm⁻³', min: 1e20, max: 1e25, scale: 'log', default: def, hint })
/** A two-position knob: `on` and `off` are the texts of the two positions. */
export const Toggle = (key, label, def, on, off, hint) => ({ key, label, kind: 'toggle', default: def, on, off, hint })
/** More than two positions of the same control — a device's models. */
export const Choice = (key, label, def, options, hint) => ({ key, label, kind: 'choice', default: def, options, hint })
/** Values the note talks about, offered as chips under the knob. */
export const chips = (knob, presets) => ({ ...knob, presets: presets.map((v) => ({ value: v, label: fmt(v, knob.unit, 3) })) })

/** The two transistor models, as a choice knob. */
export const BJT_MODEL = (def = 'regions', hint) =>
  Choice(
    'model',
    'Transistor model',
    def,
    [
      { value: 'regions', label: 'three regions' },
      { value: 'exp', label: 'curve' },
    ],
    hint,
  )

// ------------------------------------------------------------ drawing
// A 420 × 180 canvas, the Elements lab's grid. Rails at y = 40 and y = 140,
// the source on the left at x = 50, vertical legs centred at y = 90.
export const W = 420
export const H = 180
export const TOP = 40
export const BOT = 140
export const MID = 90
export const wire = (x1, y1, x2, y2) => ({ wire: [x1, y1, x2, y2] })
export const node = (name, x, y, side = 't') => ({ node: name, x, y, side })
export const gnd = (x, y = BOT) => ({ gnd: [x, y] })
export const leg = (id, x, y = MID, flip = false) => [
  { el: id, x, y, dir: 'v', flip },
  wire(x, y - 40, x, y - 20),
  wire(x, y + 20, x, y + 40),
]
export const across = (id, x, y) => [{ el: id, x, y, dir: 'h' }]

/**
 * The op-amp frame: the triangle at (x, y), inputs at y ∓ 12, output run to a
 * node 70 to the right. `invertTop` false puts the + input on top.
 */
export function opAmpFrame(x, y, { invertTop = true } = {}) {
  return [{ el: 'U1', x, y, invertTop }]
}

