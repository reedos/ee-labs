// The knobs and the drawing grid, shared by every group file.
//
// A group file imports from here rather than from experiments.js, which
// imports the group files: two modules that need each other at load time
// leave one of them half built. This one depends on nothing in the app.

import { fmt } from '@ee-labs/ui'

// Every view a lower pane can show, in the order the view switch lists them.
// The same order in every experiment, so a tab sits in the same place from one
// experiment to the next.
export const VIEW_ORDER = ['reading', 'equations', 'scope', 'bode', 'impedance', 'errorbar', 'contrib']

export const VIEW_LABELS = {
  reading: { label: 'Reading', title: 'The one number this experiment is about, and every meter on the circuit at once' },
  equations: { label: 'Equations', title: 'The equations the solver built: one row per node, one per element that fixes a voltage, with live values' },
  scope: { label: 'Scope', title: 'Voltages and currents against time; drag to move the cursor' },
  bode: { label: 'Response', title: '|H| in dB and ∠H against log frequency; the marker is the drive' },
  impedance: { label: 'Impedance', title: '|Z| and ∠Z the instrument shows against frequency; the marker is the drive' },
  errorbar: { label: 'Error bar', title: 'The true value, the reading, what the display shows, and the accuracy claimed around it' },
  contrib: { label: 'Contributions', title: 'One bar per input: its sensitivity times its tolerance, against the quadrature sum and the worst case' },
}

export const GROUPS = [
  'A · The oscilloscope’s input',
  'B · The sampling scope',
  'C · The multimeter',
  'D · The spectrum analyser',
  'E · The lock-in amplifier',
  'F · Uncertainty',
]

// ------------------------------------------------------------ knobs
// The same helpers Circuit Elements Lab uses, with the ranges this lab needs.
// An instrument's resistances run from milliohms (a shunt) to tens of megohms
// (a meter's input), and its capacitances from picofarads to microfarads.
export const R = (key, label, def, hint) => ({ key, label, unit: 'Ω', min: 1e-3, max: 1e8, scale: 'log', default: def, hint })
export const Vs = (key, label, def, hint) => ({ key, label, unit: 'V', min: -24, max: 24, scale: 'linear', default: def, hint })
export const Is = (key, label, def, hint) => ({ key, label, unit: 'A', min: 1e-6, max: 10, scale: 'log', default: def, hint })
export const Cap = (key, label, def, hint) => ({ key, label, unit: 'F', min: 1e-13, max: 1e-3, scale: 'log', default: def, hint })
export const Ind = (key, label, def, hint) => ({ key, label, unit: 'H', min: 1e-6, max: 10, scale: 'log', default: def, hint })
export const Freq = (key, label, def, hint) => ({ key, label, unit: 'Hz', min: 1, max: 1e7, scale: 'log', default: def, hint })
export const Amp = (key, label, def, hint) => ({ key, label, unit: 'V', min: 1e-4, max: 10, scale: 'log', default: def, hint })
/** A current a source pushes, from a nanoamp of leakage to ten amps through a shunt. */
export const Cur = (key, label, def, hint) => ({ key, label, unit: 'A', min: 1e-9, max: 10, scale: 'log', default: def, hint })
/** A transconductance, in amps per volt. */
export const Gm = (key, label, def, hint) => ({ key, label, unit: 'A/V', min: 1e-6, max: 1, scale: 'log', default: def, hint })
// Degrees, not engineering notation: "500 m°" is nobody's phase.
export const Deg = (key, label, def, hint) => ({ key, label, unit: '°', min: -180, max: 180, scale: 'linear', default: def, eng: false, hint })
export const Pct = (key, label, def, hint) => ({ key, label, unit: '%', min: 0, max: 20, scale: 'linear', default: def, eng: false, hint })
export const Db = (key, label, def, hint) => ({ key, label, unit: 'dB', min: 6, max: 120, scale: 'linear', default: def, eng: false, hint })
// The time window is measured in the circuit's own unit, time constants or
// cycles, so that whatever the knobs, the trace shows the whole story.
export const Win = (key, label, unit, def, min = 1, max = 40) => ({ key, label, unit, min, max, scale: 'linear', default: def, eng: false })
/** A two-position knob: `on` and `off` are the texts of the two positions. */
export const Toggle = (key, label, def, on, off, hint) => ({ key, label, kind: 'toggle', default: def, on, off, hint })
/** More than two positions of the same control. */
export const Choice = (key, label, def, options, hint) => ({ key, label, kind: 'choice', default: def, options, hint })
/** Values the lesson talks about, offered as chips under the knob, each carrying its unit. */
export const chips = (knob, presets) => ({ ...knob, presets: presets.map((v) => ({ value: v, label: fmt(v, knob.unit, 3) })) })

// ------------------------------------------------------------ drawing
// A 420 × 180 canvas, the Elements lab's grid. Rails at y = 40 (top) and
// y = 140 (bottom); the source stands on the left at x = 50; vertical legs are
// centred at y = 90 and carry their label and reading on the right, which is
// why legs sit 90 apart.
export const W = 420
export const H = 180
export const TOP = 40
export const BOT = 140
export const MID = 90
export const LEGS = [180, 270, 360]
export const leg = (id, x, flip = false) => [
  { el: id, x, y: MID, dir: 'v', flip },
  { wire: [x, TOP, x, MID - 20] },
  { wire: [x, MID + 20, x, BOT] },
]
export const src = (id, x = 50, flip = false) => leg(id, x, flip)
export const top = (id, x) => [{ el: id, x, y: TOP, dir: 'h' }]
export const rail = (x1, x2, y) => ({ wire: [x1, y, x2, y] })
export const node = (name, x, y, side = 't') => ({ node: name, x, y, side })
export const gnd = (x, y = BOT) => ({ gnd: [x, y] })
export const box = (x0, y0, x1, y1) => ({ box: [x0, y0, x1, y1] })
export const text = (t, x, y, anchor = 'middle') => ({ text: t, x, y, anchor })

/** Source on the left, a series element on top, then N legs to ground. */
export function ladder(legs, series = 'R1', flipped = [], srcId = 'V1') {
  const xs = LEGS.slice(0, legs.length)
  const last = xs[xs.length - 1]
  return {
    w: W,
    h: H,
    items: [
      ...src(srcId),
      rail(50, 100, TOP),
      ...top(series, 120),
      rail(140, last, TOP),
      ...legs.flatMap((id, k) => leg(id, xs[k], flipped.includes(id))),
      rail(50, last, BOT),
      gnd(115),
      node('in', 50, TOP, 't'),
    ],
  }
}

/**
 * Source on the left, elements around one loop. `names` renames the nodes
 * between the series elements, for a circuit whose middle node has a name of
 * its own in the netlist.
 */
export function loop(series, names = [], srcId = 'V1') {
  const items = [...src(srcId), rail(50, 340, BOT), gnd(115), node('in', 50, TOP, 't')]
  const xs = [120, 230]
  let x = 50
  series.slice(0, -1).forEach((id, k) => {
    items.push(rail(x, xs[k] - 20, TOP), ...top(id, xs[k]))
    x = xs[k] + 20
    items.push(node(names[k] || `n${k + 1}`, x + 35, TOP, 't'))
  })
  items.push(rail(x, 340, TOP), ...leg(series[series.length - 1], 340))
  return { w: W, h: H, items }
}


/** The layout for a setting: an experiment whose toggle changes the parts draws a function. */
export const layoutOf = (exp, p) => (typeof exp.layout === 'function' ? exp.layout(p) : exp.layout)

/** Whether an experiment has a time axis: it has a window, so it has a state. */
export const isDynamic = (exp) => typeof exp.window === 'function'

/**
 * The op-amp frame: the triangle at (x, y), inputs at y ∓ 12, output run to a
 * node `run` to the right. `invertTop` false puts the + input on top, which is
 * the shape a follower takes so its feedback loops under.
 */
export const AMP = { x: 230, y: 90 }
export const amp = ({ x = AMP.x, y = AMP.y, invertTop = true, side = 'r', run = 70, out = 'out' } = {}) => [
  { el: 'U1', x, y, invertTop },
  { wire: [x + 38, y, x + run, y] },
  node(out, x + run, y, side),
]

/** A load hung from a node: straight down to a ground of its own. */
export const outLoad = (id, x = AMP.x + 70, y = AMP.y) => [
  { wire: [x, y, x, y + 20] },
  { el: id, x, y: y + 40, dir: 'v' },
  gnd(x, y + 60),
]
