// Where each machine's circuit is drawn.
//
// `packages/ui`'s Schematic draws from data. An element symbol occupies the
// segment 20 either side of its centre, so a wire runs from one element's edge
// to the next one's. These layouts follow that idiom, and each one returns the
// SUBSET of the solved netlist a reader should see. The sense branch of
// `port.js` is not in any of them, because it has no voltage and no current of
// its own. Its two elements are replaced by the wire they are equivalent to.
//
// Two rules these drawings had to learn.
//
// **A label belongs to the element, not to the layout item.** `valueText` in
// `schematicGeometry.js` reads `e.label`, and ignores a `label` on the item
// that places it. The item-level labels here were silently dropped, so every
// AC source drew its DC value: the transformer's primary read "Vs 0 V" beside
// a knob set to 240 V, and the induction machine's read "V₁ 0 V" beside 230.9.
//
// **Spacing is measured, not eyeballed.** `layout.test.js` runs
// `layoutCheck.js` over every drawing at its defaults and at both ends of
// every knob, and no text may touch anything or leave the frame. A vertical
// element hangs its label to the right, so two of them need about 100 units
// between their centres; a horizontal one centres its label underneath and
// puts its reading above, so a caption on the same row as a reading collides
// with it. The crop comes from `layoutExtent`, which sizes the frame to the
// widest text the drawing can ever carry, so it does not breathe as knobs move.

import { fmt } from '@ee-labs/ui'
import { layoutExtent } from './layoutCheck.js'

const pick = (net, ids) => ids.map((id) => net.elements.find((e) => e.id === id)).filter(Boolean)

/** An element with a label of its own, which replaces the value text. */
const named = (net, id, label) => {
  const e = net.elements.find((q) => q.id === id)
  return e ? { ...e, label } : null
}

/** The drawing, with the frame sized to what it holds. */
const framed = (elements, layout) => ({ elements, layout: { ...layout, crop: layoutExtent(layout, elements) } })

// The columns every drawing here uses: one wire along the top, one along the
// bottom, and shunt elements hung between them.
const TOP = 50
const BOTTOM = 170
const MID = 110
const CAPTION = 196

/** A shunt element between the two rails, with the wires that reach it. */
const shunt = (el, x, extra = {}) => [
  { wire: [x, TOP, x, MID - 20] },
  { el, x, y: MID, dir: 'v', ...extra },
  { wire: [x, MID + 20, x, BOTTOM] },
]

/** The DC machine's armature loop. The shaft is drawn beside it, not in it. */
export function dcDraw(x) {
  const net = x.net
  const elements = [
    // The armature is driven from a step in the transient experiments, so the
    // element's own value is zero there. The supply the reader set is what
    // belongs on the drawing.
    named(net, 'Va', `Va ${fmt(x.spec.Va, 'V', 3)}`),
    ...pick(net, ['Ra', 'La']),
    named(net, 'Eb', 'E = k·ω'),
  ].filter(Boolean)
  return framed(elements, {
    w: 480,
    h: 210,
    items: [
      ...shunt('Va', 60),
      { wire: [60, TOP, 150, TOP] },
      { el: 'Ra', x: 170, y: TOP, dir: 'h' },
      { wire: [190, TOP, 260, TOP] },
      { el: 'La', x: 280, y: TOP, dir: 'h' },
      { wire: [300, TOP, 400, TOP] },
      ...shunt('Eb', 400),
      { wire: [60, BOTTOM, 400, BOTTOM] },
      { gnd: [60, BOTTOM] },
      { node: 'arm', x: 60, y: TOP, side: 't' },
      { node: 'n1', x: 225, y: TOP, side: 't' },
      { node: 'n2', x: 400, y: TOP, side: 'r' },
      { node: 'n3', x: 400, y: BOTTOM, side: 'r' },
      { text: 'armature, and the back-EMF the shaft makes', x: 230, y: CAPTION },
    ],
  })
}

/** The transformer, at whichever stage the experiment has reached. */
export function transformerDraw(x) {
  const net = x.net
  const stage = x.spec.stage || 'full'
  const elements = [named(net, 'Vs', `Vs ${fmt(x.spec.Vp, 'V', 3)}`)]
  const items = [...shunt('Vs', 60)]
  let at = 60

  // A wire leaves the previous column's edge: a series element's body ends 20
  // past its centre, a shunt's does not sit on the top rail at all.
  let onRail = false
  const series = (id, gap = 80) => {
    items.push({ wire: [at + (onRail ? 20 : 0), TOP, at + gap - 20, TOP] }, { el: id, x: at + gap, y: TOP, dir: 'h' })
    at += gap
    onRail = true
  }
  const drop = (id, gap, extra) => {
    items.push({ wire: [at + (onRail ? 20 : 0), TOP, at + gap, TOP] }, ...shunt(id, at + gap, extra))
    at += gap
    onRail = false
  }

  if (stage !== 'ideal') {
    elements.push(...pick(net, ['R1', 'X1']))
    series('R1', 90)
    series('X1')
  }
  if (stage === 'full') {
    elements.push(...pick(net, ['Rc', 'Xm']))
    drop('Rc', stage === 'full' && at === 60 ? 90 : 90)
    drop('Xm', 100)
  }
  elements.push(named(net, 'T1.Es', `ideal ${x.spec.n}:1`))
  drop('T1.Es', 110)
  const core = at
  // The dashed frame holds the ideal transformer's own label. A label that
  // straddles the edge says nothing about what is inside it.
  items.push({ box: [core - 34, MID - 36, core + 78, MID + 40] })
  if (stage !== 'ideal') {
    elements.push(...pick(net, ['R2', 'X2']))
    series('R2', 140)
    series('X2')
  }
  elements.push(net.elements.find((e) => e.id === 'RL'))
  drop('RL', stage === 'ideal' ? 150 : 100)

  items.push({ wire: [60, BOTTOM, at, BOTTOM] }, { gnd: [60, BOTTOM] })
  items.push({ text: 'primary', x: 150, y: CAPTION }, { text: 'secondary', x: at - 60, y: CAPTION })
  return framed(elements.filter(Boolean), { w: at + 140, h: 210, items })
}

/** The induction machine's per-phase equivalent circuit. */
export function perPhaseDraw(x) {
  const net = x.net
  const has = (id) => !!net.elements.find((e) => e.id === id)
  const elements = [
    named(net, 'V1', `V₁ ${fmt(x.machine.V, 'V', 4)}`),
    ...pick(net, ['R1', 'X1']),
    ...(has('Rc') ? pick(net, ['Rc']) : []),
    ...pick(net, ['Xm', 'X2']),
    named(net, 'R2s', `R₂/s ${fmt(net.elements.find((e) => e.id === 'R2s').value, 'Ω', 4)}`),
  ].filter(Boolean)

  const items = [
    ...shunt('V1', 60),
    { wire: [60, TOP, 120, TOP] },
    { el: 'R1', x: 140, y: TOP, dir: 'h' },
    { wire: [160, TOP, 190, TOP] },
    { el: 'X1', x: 210, y: TOP, dir: 'h' },
    { wire: [230, TOP, 350, TOP] },
    ...shunt('Xm', 350),
    { wire: [350, TOP, 440, TOP] },
    { el: 'X2', x: 460, y: TOP, dir: 'h' },
    { wire: [480, TOP, 560, TOP] },
    ...shunt('R2s', 560),
    { wire: [60, BOTTOM, 560, BOTTOM] },
    { gnd: [60, BOTTOM] },
    { node: 'g', x: 300, y: TOP, side: 't' },
    { text: 'stator, one phase of three', x: 150, y: CAPTION },
    { text: 'rotor, referred to the stator', x: 470, y: CAPTION },
  ]
  if (has('Rc')) items.splice(6, 0, ...shunt('Rc', 250))
  return framed(elements, { w: 700, h: 210, items })
}

/**
 * The thermal model, which is an R and a C with the loss as a current.
 *
 * The analogy runs in thermal units, and this drawing says so. The Schematic
 * prints a node voltage in volts and a branch current in amps, which is right
 * for every other circuit in the suite and wrong for this one: the loss is
 * 429 W and not 429 A, the rise is 72.9 K and not 72.9 V, and the capacity is
 * 6 kJ/K and not 6 kF. So no meters are shown here, and each element carries
 * its own value in the unit it is measured in.
 */
export function thermalDraw(x) {
  const net = x.net
  const elements = [
    named(net, 'Ploss', `P_loss ${fmt(x.split.loss, 'W', 4)}`),
    named(net, 'Rth', `R_th ${fmt(x.machine.Rth, 'K/W', 3)}`),
    named(net, 'Cth', `C_th ${fmt(x.machine.Cth, 'J/K', 3)}`),
  ].filter(Boolean)
  return framed(elements, {
    w: 520,
    h: 210,
    meters: false,
    items: [
      ...shunt('Ploss', 60),
      { wire: [60, TOP, 190, TOP] },
      ...shunt('Rth', 190),
      { wire: [190, TOP, 320, TOP] },
      ...shunt('Cth', 320),
      { wire: [60, BOTTOM, 320, BOTTOM] },
      { gnd: [60, BOTTOM] },
      { text: 'loss in watts, rise in kelvins, ambient at the bottom rail', x: 190, y: CAPTION },
    ],
  })
}

/** The drawing for one analysis, or null when the model has no circuit. */
export function drawOf(x) {
  if (x.kind === 'dc') return dcDraw(x)
  if (x.kind === 'transformer') return transformerDraw(x)
  if (x.kind === 'im') return perPhaseDraw(x)
  if (x.kind === 'losses' && x.net) return { ...thermalDraw(x), meters: false }
  return null
}
