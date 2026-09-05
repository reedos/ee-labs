import { fmt } from './units.js'

/**
 * Where the schematic puts things, as numbers.
 *
 * Schematic.jsx draws from these so that a layout can be checked for
 * collisions without a browser: a test that knows where every label, reading
 * and symbol lands can say "R2's label sits on R3's reading" before anyone
 * looks. The rules the numbers encode:
 *
 *   - a symbol is drawn on the segment (−20, 0)…(20, 0) about its centre,
 *     then rotated: `dir:'v'` turns it 90°, `flip` a further 180°;
 *   - a horizontal element has its label centred 24 below and its reading
 *     centred 24 above; a vertical one has both to its right, the reading
 *     stacked over the label — the arrow lives on the left;
 *   - a node's name goes on the side the layout asks for, 7 off the dot
 *     sideways or clear of it above and below;
 *   - an op-amp's reading and label both hang under the triangle, reading first.
 *
 * Text metrics are estimates for the fonts in styles.css: labels and node
 * names in the KaTeX faces the equations use (so R₁ on the drawing is the R₁
 * in the maths), meters in 9 px monospace (0.6 em advance), notes in sans.
 * The label estimate was measured in a browser against every label the
 * elements lab draws and sits a little above the widest of them.
 */

export const FONT = {
  label: { size: 10, cw: 5.4 },
  meter: { size: 9, cw: 5.4 },
  port: { size: 10.5, cw: 5.6 },
  note: { size: 9, cw: 5.2 },
  sign: { size: 11, cw: 6 },
}

/** Value text for the label under a symbol. */
export function valueText(e) {
  if (e.label) return e.label
  switch (e.type) {
    case 'R':
      return `${e.id} ${fmt(e.value, 'Ω', 3)}`
    case 'V':
      return `${e.id} ${fmt(e.value, 'V', 3)}`
    case 'I':
      return `${e.id} ${fmt(e.value, 'A', 3)}`
    case 'C':
      return `${e.id} ${fmt(e.value, 'F', 3)}`
    case 'L':
      return `${e.id} ${fmt(e.value, 'H', 3)}`
    case 'SW':
      return `${e.id} ${e.closed === false ? 'open' : 'closed'}`
    case 'D':
      // The model is what a reader needs beside a diode — 0.7 V assumed, or a
      // curve — since every number in the answer depends on which one it is.
      switch (e.model || 'drop') {
        case 'ideal':
          return `${e.id} ideal`
        case 'pwl':
          return `${e.id} ${fmt(e.vf ?? 0.7, 'V', 2)} + ${fmt(e.rd ?? 10, 'Ω', 2)}`
        case 'exp':
          return `${e.id} I_s ${fmt(e.is ?? 1e-14, 'A', 2)}`
        default:
          return `${e.id} ${fmt(e.vf ?? 0.7, 'V', 2)}`
      }
    case 'OPAMP':
      return Number.isFinite(e.gain) ? `${e.id} A=${fmt(e.gain, '', 3)}` : `${e.id} ideal`
    case 'VCVS':
      return `${e.id} ×${fmt(e.gain, '', 3)}`
    case 'VCCS':
      return `${e.id} ${fmt(e.gain, 'S', 3)}`
    default:
      return e.id
  }
}

/**
 * The label split the way the equations typeset it: a letter, a subscript,
 * then the value — so `R1 1 kΩ` draws as R₁ 1 kΩ and the reader sees the R₁
 * of the matrix on the drawing. `text` is the whole string, for width
 * estimates and screen readers; a custom `label` is left as written.
 */
export function labelParts(e) {
  const text = valueText(e)
  if (e.label) return { text }
  const m = e.id.match(/^([A-Za-z]+?)(\d+|[a-z]+|[A-Z])$/)
  const value = text.slice(e.id.length).trimStart()
  return m ? { text, sym: m[1], sub: m[2], value } : { text, sym: e.id, sub: '', value }
}

/**
 * The + and − marks at a two-terminal element's ends when voltages are shown.
 * Local + is at −20; both marks sit just inside the terminals on the side away
 * from the label (above a horizontal element, left of a vertical one).
 *
 * The offsets clear the widest body a two-terminal element draws, which is the
 * resistor's zigzag: it runs the full −20…+20 between the terminals and swings
 * ±6 off the axis, ±6.8 counting its own 1.6 stroke. The capacitor's plates
 * reach ±9 but only at x = ±4, the inductor's arcs ±5, and a round source's rim
 * 11 — all inside what clearing the zigzag already buys.
 *
 * The HORIZONTAL marks used to land on that zigzag. They sat at y = −6, so a
 * mark's baseline was 0.8px inside the zigzag's own envelope and its glyph ran
 * up through the teeth. Measured in the browser at 1440×900, the + and − boxes
 * overlapped the resistor's by 4.9×19.4 and 4.7×21.8 on one experiment and
 * 14.6×5.0 on another. `SIGN_CLEAR` now pushes the baseline past the body's own
 * half-extent with room to spare: 6.8 of body, then 4 of air. A glyph grows
 * upward from its baseline, so hanging the baseline there puts the whole mark
 * above the body.
 *
 * A VERTICAL element's marks were hitting the same zigzag turned on its side,
 * and that is a distance in x rather than in y. The number has to account for
 * the mark's BOX, not its ink: an 11px `<text>` measures 16px wide once font
 * metrics and side bearings are counted, and it is centred on the anchor, so
 * half of it reaches back toward the body. Measured on a2, whose resistor is
 * vertical: body half 9.6 screen px, the mark's right edge at −4.6, biting 5px
 * into the teeth. Clearing it needs the anchor at −17.6 screen px, and the
 * drawing scales SVG to screen by 1.41, so −12.5 in these units. `SIGN_SIDE`
 * takes that with a little to spare.
 *
 * It is deliberately no further out than that. An earlier pass used −13.8 and
 * drove the + of a vertical capacitor into the callout on its left, which
 * rendered as "f₀ = 1.59 kHz+" on h4. There is a label in that space, so the
 * mark takes what it needs to clear the body and no more.
 */
const BODY_HALF = 6.8
const SIGN_CLEAR = BODY_HALF + 4
const SIGN_SIDE = 13

export function signPlaces({ x, y, dir = 'h', flip = false }) {
  const plus =
    dir === 'v'
      ? { x: x - SIGN_SIDE, y: y + (flip ? 17 : -11) }
      : { x: x + (flip ? 16 : -16), y: y - SIGN_CLEAR }
  const minus =
    dir === 'v'
      ? { x: x - SIGN_SIDE, y: y + (flip ? -11 : 17) }
      : { x: x + (flip ? -16 : 16), y: y - SIGN_CLEAR }
  return { plus: { ...plus, anchor: 'middle' }, minus: { ...minus, anchor: 'middle' } }
}

/** The meter text on an element for this `show`, or null when there is none. */
export function elementReading(e, meters, show) {
  if (!meters || show === 'none') return null
  const i = meters.i[e.id]
  if (e.type === 'OPAMP') {
    if (show === 'v') return null
    if (show === 'i') return Number.isFinite(i) ? `${fmt(Math.abs(i), 'A', 3)} ${i >= 0 ? 'in' : 'out'}` : null
    return fmt(meters.p[e.id], 'W', 3)
  }
  if (show === 'i') return Number.isFinite(i) ? fmt(Math.abs(i), 'A', 3) : null
  if (show === 'v') return fmt(meters.volt[e.id], 'V', 3)
  return fmt(meters.p[e.id], 'W', 3)
}

/** Label and reading positions for a two-terminal element at `item`. */
export function elementTextPlaces({ x, y, dir = 'h' }) {
  return dir === 'v'
    ? { label: { x: x + 14, y: y + 4, anchor: 'start' }, reading: { x: x + 14, y: y - 8, anchor: 'start' } }
    : { label: { x, y: y + 24, anchor: 'middle' }, reading: { x, y: y - 24, anchor: 'middle' } }
}

/**
 * The op-amp triangle's texts, both under it: reading first, label below.
 * Nothing goes over the top because that is where the feedback resistor
 * usually runs, and its label would land on anything written there.
 */
export function opampTextPlaces({ x, y }) {
  return { reading: { x: x + 19, y: y + 34, anchor: 'middle' }, label: { x: x + 19, y: y + 46, anchor: 'middle' } }
}

/** Where a node's name starts, relative to its dot, for each side. */
export function nodeTextPlace({ x, y, side = 'r' }) {
  const dx = side === 'l' ? -7 : side === 'r' ? 7 : 0
  const dy = side === 't' ? -7 : side === 'b' ? 13 : 4
  const anchor = side === 'l' ? 'end' : side === 'r' ? 'start' : 'middle'
  return { x: x + dx, y: y + dy, anchor }
}

/**
 * The rectangle a text occupies: `chars` advance widths from the anchor,
 * 0.8 em above the baseline and 0.25 em below.
 */
export function textBox({ x, y, anchor }, width, size) {
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2
  return { x0, x1: x0 + width, y0: y - 0.8 * size, y1: y + 0.25 * size }
}

/**
 * The ink of a two-terminal symbol, as boxes in canvas coordinates: the
 * symbol itself (round sources are ±11 with lead wires; the rest span the
 * full ±20 and are ±9 tall) and, when a current arrow is drawn, its strip
 * on the side away from the label.
 */
export function elementBodyBoxes({ x, y, dir = 'h' }, e, arrow = false) {
  const round = e.type === 'V' || e.type === 'I' || e.type === 'VCVS' || e.type === 'VCCS'
  const along = round ? 11 : 20
  const across = round ? 11 : 9
  const boxes = []
  const local = (a0, a1, b0, b1) =>
    dir === 'v' ? { x0: x + b0, x1: x + b1, y0: y + a0, y1: y + a1 } : { x0: x + a0, x1: x + a1, y0: y + b0, y1: y + b1 }
  boxes.push(local(-along, along, -across, across))
  if (round) boxes.push(local(-20, -11, -0.75, 0.75), local(11, 20, -0.75, 0.75))
  // The arrow sits at local y = −16 (horizontal) / +16 (vertical → −x), head ±3.
  if (arrow) boxes.push(dir === 'v' ? { x0: x - 19, x1: x - 13, y0: y - 9, y1: y + 9 } : { x0: x - 9, x1: x + 9, y0: y - 19, y1: y - 13 })
  return boxes
}

/** The op-amp triangle's bounding box. */
export const opampBodyBox = ({ x, y }) => ({ x0: x, x1: x + 38, y0: y - 22, y1: y + 22 })

/** The ground symbol hanging below (x, y). */
export const gndBox = ([x, y]) => ({ x0: x - 9, x1: x + 9, y0: y, y1: y + 16 })
