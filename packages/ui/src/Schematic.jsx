import React from 'react'
import { fmt } from './units.js'
import {
  labelParts,
  elementReading,
  elementTextPlaces,
  opampTextPlaces,
  nodeTextPlace,
  signPlaces,
  transistorTextPlaces,
} from './schematicGeometry.js'

/**
 * A schematic drawn from data, with live meters.
 *
 * Circuit Lab hand-draws its nine diagrams; a lab with fifty experiments
 * cannot, so this one takes a layout — element positions on a small grid plus
 * wires, node dots and ground symbols — and draws the symbols itself. What
 * makes it more than a picture is `meters`: given the solved node voltages and
 * element currents it writes each voltage at its node and each current on its
 * element, with an arrow that points the way the current actually flows. The
 * convention is the one the solver uses — an element's + terminal is the left
 * end when drawn horizontally and the top end when drawn vertically, unless
 * the item says `flip` — so a negative current draws as an arrow the other
 * way, which is the whole lesson about signs.
 *
 * Layout items:
 *   { el: id, x, y, dir: 'h' | 'v', flip?, label? }   an element centred at (x, y)
 *   { wire: [x1, y1, x2, y2] }                       a straight wire
 *   { node: name, x, y, side?: 'l' | 'r' | 't' | 'b' } a node dot with its name and live voltage
 *   { gnd: [x, y] }                                  ground symbol hanging below (x, y)
 *   { text, x, y }                                   a caption
 *   { box: [x0, y0, x1, y1] }                        a dashed outline — "these parts are one device"
 *
 * A layout may also carry `crop: [x0, y0, x1, y1]`, the part of the canvas
 * actually drawn on. The SVG then shows only that box, and publishes its width
 * in canvas units and its aspect ratio as CSS variables (--crop-w, --ar) so a
 * stylesheet can size every frame to the same scale: a small circuit gets a
 * small frame, not a big frame with a small circuit in it.
 *
 * Elements are { id, type, value, label? }; types R V I C L SW OPAMP VCVS VCCS
 * Q M. A Q (BJT) or M (MOSFET) also carries `polarity`: 'npn' | 'pnp' for a Q,
 * 'n' | 'p' for an M. Its nodes are three, [collector, base, emitter] or
 * [drain, gate, source], and its layout item is the same { el, x, y, dir,
 * flip } shape — the base or gate sits on the left at (x − 20, y), the
 * collector or drain at (x + 12, y − 20), the emitter or source at
 * (x + 12, y + 20), so a vertical device stacks between two rails.
 * Meters are { v: { node: volts }, i: { id: amps }, p: { id: watts } }; `show`
 * chooses which of 'i', 'v', 'p' is written on the elements (node voltages
 * appear whenever meters are given). A transistor's default current reading
 * is `meters.i[id]`, the collector or drain current, the same slot every
 * other element reads from; a caller that measures more than one terminal
 * passes those values in through the same map under whichever id it likes.
 *
 * Optional, all additive (the Elements lab's schematic answers back):
 *   overlay    { mode: 'dc' | 'ac' | 'both', v: { node: amplitude } }: the
 *              Electronics lab's two circuits on one drawing. In 'dc' the node
 *              text is the operating point, as everywhere else. In 'ac' it is
 *              the signal amplitude the app measured, written with the sine it
 *              rides on ("0.184 V·sin"). In 'both' the node carries the sum it
 *              really is, "5.00 V + 0.184 V·sin". What an AC meter reads is
 *              the app's to decide: this draws what it is given.
 *   lit        { nodes, elements }: names to draw lit (Sets or arrays) — the
 *              places a lesson step says to read, or the row under the pointer
 *   reference  the node currently taken as the zero of voltage, when it is not
 *              ground: that node is marked and the ground symbol steps aside
 *   onNode     (name) => …  makes every node dot a button ("Make A the reference")
 *   onElement  (id) => …    makes every switch a button ("Throw S1")
 * Every node carries data-node and every element data-el whatever is passed.
 */
export default function Schematic({ elements, layout, meters = null, show = 'i', className = '', overlay = null, lit = null, reference = null, onNode = null, onElement = null }) {
  const byId = new Map(elements.map((e) => [e.id, e]))
  const { w = 320, h = 160, items = [], crop = null } = layout
  const [cx0, cy0, cx1, cy1] = crop || [0, 0, w, h]
  const cw = cx1 - cx0
  const ch = cy1 - cy0
  const litNodes = toSet(lit && lit.nodes)
  const litEls = toSet(lit && lit.elements)
  const interactive = !!(onNode || onElement)
  const name = `Schematic: ${elements.map((e) => e.label || e.id).join(', ')}`
  return (
    <svg
      className={`schematic ${className}`}
      viewBox={`${cx0} ${cy0} ${cw} ${ch}`}
      style={{ '--crop-w': cw, '--ar': cw / ch }}
      role={interactive ? 'group' : 'img'}
      aria-label={name}
    >
      {items.map((it, k) => {
        if (it.box) return <Frame key={k} pts={it.box} />
        if (it.wire) return <Wire key={k} pts={it.wire} />
        if (it.gnd) return <Gnd key={k} x={it.gnd[0]} y={it.gnd[1]} aside={!!reference && reference !== 'gnd'} />
        if (it.node)
          return (
            <NodeDot
              key={k}
              name={it.node}
              x={it.x}
              y={it.y}
              side={it.side || 'r'}
              volts={meters ? meters.v[it.node] : undefined}
              overlay={overlay}
              lit={litNodes.has(it.node)}
              isRef={reference === it.node}
              onTap={onNode}
            />
          )
        if (it.text)
          return (
            <text key={k} className={it.className ? `sch-note ${it.className}` : 'sch-note'} x={it.x} y={it.y} textAnchor={it.anchor || 'middle'}>
              {it.text}
            </text>
          )
        if (it.el) {
          const e = byId.get(it.el)
          if (!e) return null
          return <Element key={k} item={it} e={e} meters={meters} show={show} lit={litEls.has(e.id)} onTap={onElement} />
        }
        return null
      })}
    </svg>
  )
}

const toSet = (v) => (v instanceof Set ? v : new Set(v || []))

/** Enter and space press a thing drawn as a button, as they would a real one. */
const onKey = (fn) => (ev) => {
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault()
    fn()
  }
}

const Wire = ({ pts: [x1, y1, x2, y2] }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line-bright)" strokeWidth="1.5" />
)

/** A dashed outline around the parts that make up one device. List it first in the layout so it sits under everything. */
const Frame = ({ pts: [x0, y0, x1, y1] }) => (
  <rect
    x={x0}
    y={y0}
    width={x1 - x0}
    height={y1 - y0}
    rx="4"
    fill="none"
    stroke="var(--dim)"
    strokeWidth="1"
    strokeDasharray="4 3"
  />
)

const Gnd = ({ x, y, aside = false }) => (
  <g stroke="var(--dim)" strokeWidth="1.5" className={aside ? 'sch-gnd is-aside' : 'sch-gnd'} data-node="gnd">
    <line x1={x} y1={y} x2={x} y2={y + 8} />
    <line x1={x - 9} y1={y + 8} x2={x + 9} y2={y + 8} />
    <line x1={x - 5} y1={y + 12} x2={x + 5} y2={y + 12} />
    <line x1={x - 2} y1={y + 16} x2={x + 2} y2={y + 16} />
  </g>
)

/**
 * An element's label, typeset like the equations: the letter in the maths
 * italic, its subscript small, then the value upright — R₁ 1 kΩ. A custom
 * label is written as given.
 */
function Label({ e, at }) {
  const l = labelParts(e)
  if (!l.sym) {
    return (
      <text className="sch-label" x={at.x} y={at.y} textAnchor={at.anchor}>
        {l.text}
      </text>
    )
  }
  const digits = /^\d+$/.test(l.sub)
  return (
    <text className="sch-label" x={at.x} y={at.y} textAnchor={at.anchor} aria-label={l.text}>
      <tspan className="sch-sym">{l.sym}</tspan>
      {l.sub ? (
        <tspan className={digits ? 'sch-sub' : 'sch-sub sch-sub-it'} dy="2.5">
          {l.sub}
        </tspan>
      ) : null}
      {l.value ? (
        <tspan className="sch-val" dy={l.sub ? '-2.5' : '0'} dx="3.5">
          {l.value}
        </tspan>
      ) : null}
    </text>
  )
}

/**
 * The node's own text: its name, then what it reads.
 *
 * With no overlay that is the solved voltage. With one it is whichever of the
 * two circuits the reader asked for, or both of them written as the sum they
 * are — which is the whole content of "signal and bias take different paths".
 */
function nodeMeter(name, volts, overlay) {
  const dc = Number.isFinite(volts) ? fmt(volts, 'V', 3) : null
  if (!overlay) return dc
  const ac = overlay.v ? overlay.v[name] : undefined
  const acText = Number.isFinite(ac) ? `${fmt(ac, 'V', 3)}·sin` : null
  if (overlay.mode === 'ac') return acText
  if (overlay.mode === 'both') return dc && acText ? `${dc} + ${acText}` : dc || acText
  return dc
}

function NodeDot({ name, x, y, side, volts, overlay = null, lit = false, isRef = false, onTap = null }) {
  const meter = nodeMeter(name, volts, overlay)
  const at = nodeTextPlace({ x, y, side })
  const cls = ['sch-node', lit ? 'is-lit' : '', isRef ? 'is-ref' : '', onTap ? 'is-tappable' : ''].filter(Boolean).join(' ')
  const tap = onTap ? () => onTap(name) : undefined
  return (
    <g
      className={cls}
      data-node={name}
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      aria-label={onTap ? (isRef ? `${name} is the reference` : `Make ${name} the reference`) : undefined}
      aria-pressed={onTap ? isRef : undefined}
      onClick={tap}
      onKeyDown={onTap ? onKey(tap) : undefined}
    >
      {/* A finger-sized target behind the dot when the node can be tapped; the ring marks the reference. */}
      {onTap ? <circle className="sch-hit" cx={x} cy={y} r="11" fill="transparent" stroke="none" /> : null}
      {isRef ? <circle className="sch-ref" cx={x} cy={y} r="6.5" fill="none" strokeWidth="1.5" /> : null}
      <circle className="sch-dot" cx={x} cy={y} r="3" fill="var(--line-bright)" />
      <text className="sch-port" x={at.x} y={at.y} textAnchor={at.anchor}>
        {name}
        {meter ? (
          <tspan className={overlay && overlay.mode === 'ac' ? 'sch-meter is-ac' : 'sch-meter'} dx="4">
            {meter}
          </tspan>
        ) : null}
      </text>
    </g>
  )
}

/**
 * One element: the symbol, its label, and — when meters are on — its reading.
 * Everything is drawn along +x from −20 to +20 and then rotated into place, so
 * the symbol code never thinks about orientation. The + terminal is at −20.
 */
function Element({ item, e, meters, show, lit = false, onTap = null }) {
  const { x, y, dir = 'h', flip = false } = item
  if (e.type === 'OPAMP') return <OpAmp item={item} e={e} meters={meters} show={show} lit={lit} />
  if (e.type === 'Q' || e.type === 'M') return <Transistor item={item} e={e} meters={meters} show={show} lit={lit} />
  const rot = (dir === 'v' ? 90 : 0) + (flip ? 180 : 0)
  // Text must stay upright: it is drawn in an un-rotated group at the same place.
  const { label: below, reading: above } = elementTextPlaces(item)
  const signs = signPlaces(item)
  const i = meters ? meters.i[e.id] : undefined
  const reading = elementReading(e, meters, show)
  // Arrow along the element in the direction the current flows: + to − when
  // positive. In local coordinates + is at −20, so positive points along +x.
  const arrow = meters && show === 'i' && Number.isFinite(i) && Math.abs(i) > 1e-15 ? Math.sign(i) : 0
  // Only a switch is a button: it is the one element a hand can change.
  const tap = onTap && e.type === 'SW' ? () => onTap(e.id) : null
  const cls = ['sch-el', lit ? 'is-lit' : '', tap ? 'is-tappable' : ''].filter(Boolean).join(' ')
  return (
    <g
      className={cls}
      data-el={e.id}
      role={tap ? 'button' : undefined}
      tabIndex={tap ? 0 : undefined}
      aria-label={tap ? `Throw ${labelParts(e).text || e.id}` : undefined}
      onClick={tap || undefined}
      onKeyDown={tap ? onKey(tap) : undefined}
    >
      <g transform={`rotate(${rot} ${x} ${y}) translate(${x} ${y})`}>
        {tap ? <rect className="sch-hit" x={-22} y={-14} width={44} height={28} fill="transparent" stroke="none" /> : null}
        <Symbol e={e} />
        {arrow ? (
          // Beside the symbol, on the side away from its label: above a
          // horizontal element, left of a vertical one (local +y maps to −x
          // after the 90° turn). A negative current mirrors the arrow along
          // the element rather than rotating it, and a flipped element mirrors
          // it across, so it stays on that side whatever the sign and never
          // lands on the text — the geometry module counts on this.
          <g
            fill="var(--warn)"
            stroke="var(--warn)"
            strokeWidth="1.5"
            transform={arrow < 0 || flip ? `scale(${arrow < 0 ? -1 : 1} ${flip ? -1 : 1})` : undefined}
          >
            {/* 16 off the axis: clear of a round source's rim (11) as well as a zigzag (6). */}
            <line x1={-9} y1={dir === 'v' ? 16 : -16} x2={9} y2={dir === 'v' ? 16 : -16} />
            <polygon points={`9,${dir === 'v' ? 16 : -16} 4,${dir === 'v' ? 13 : -19} 4,${dir === 'v' ? 19 : -13}`} />
          </g>
        ) : null}
      </g>
      <Label e={e} at={below} />
      {show === 'v' && meters ? (
        // Both terminals marked, so the reader can see which way the voltage is
        // measured: from + to −, the way the reading and the equations take it.
        <>
          <text className="sch-sign sch-plus" x={signs.plus.x} y={signs.plus.y} textAnchor="middle">
            +
          </text>
          <text className="sch-sign sch-minus" x={signs.minus.x} y={signs.minus.y} textAnchor="middle">
            −
          </text>
        </>
      ) : null}
      {reading ? (
        <text className="sch-meter" x={above.x} y={above.y} textAnchor={above.anchor}>
          {reading}
        </text>
      ) : null}
    </g>
  )
}

/** Symbols, each drawn on the segment from (−20, 0) to (20, 0). */
function Symbol({ e }) {
  switch (e.type) {
    case 'R': {
      const n = 6
      const pts = []
      for (let k = 0; k <= n * 2; k++) {
        const t = (k / (n * 2)) * 40 - 20
        const off = k === 0 || k === n * 2 ? 0 : (k % 2 ? 1 : -1) * 6
        pts.push(`${t},${off}`)
      }
      return <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
    }
    case 'C':
      return (
        <g stroke="var(--amber)" strokeWidth="1.8" fill="none">
          <line x1={-20} y1={0} x2={-4} y2={0} />
          <line x1={4} y1={0} x2={20} y2={0} />
          <line x1={-4} y1={-9} x2={-4} y2={9} />
          <line x1={4} y1={-9} x2={4} y2={9} />
        </g>
      )
    case 'L': {
      let d = ''
      for (let k = 0; k < 4; k++) d += `M ${-20 + k * 10} 0 A 5 5 0 0 1 ${-10 + k * 10} 0 `
      return <path d={d} fill="none" stroke="var(--blue)" strokeWidth="1.8" />
    }
    case 'V':
      return (
        <g stroke="var(--text)" strokeWidth="1.5" fill="none">
          <line x1={-20} y1={0} x2={-11} y2={0} />
          <line x1={11} y1={0} x2={20} y2={0} />
          <circle cx={0} cy={0} r={11} fill="var(--panel-2)" />
          <line x1={-7} y1={0} x2={-3} y2={0} />
          <line x1={-5} y1={-2} x2={-5} y2={2} />
          <line x1={3} y1={0} x2={7} y2={0} />
        </g>
      )
    case 'I':
      // Arrow inside the circle points the way the source's current flows
      // through it: in at the + terminal (nodes[0], local −20), out at the
      // other end into the circuit. Same convention as every other element,
      // which is why a delivering source shows negative power.
      return (
        <g stroke="var(--text)" strokeWidth="1.5" fill="none">
          <line x1={-20} y1={0} x2={-11} y2={0} />
          <line x1={11} y1={0} x2={20} y2={0} />
          <circle cx={0} cy={0} r={11} fill="var(--panel-2)" />
          <line x1={-6} y1={0} x2={6} y2={0} />
          <polygon points="7,0 2,-3 2,3" fill="var(--text)" />
        </g>
      )
    case 'SW': {
      const closed = e.closed !== false
      return (
        <g stroke="var(--text)" strokeWidth="1.5" fill="none">
          <line x1={-20} y1={0} x2={-10} y2={0} />
          <line x1={10} y1={0} x2={20} y2={0} />
          <circle cx={-10} cy={0} r={1.8} fill="var(--text)" />
          <circle cx={10} cy={0} r={1.8} fill="var(--text)" />
          <line x1={-10} y1={0} x2={closed ? 10 : 7} y2={closed ? 0 : -10} />
        </g>
      )
    }
    case 'D': {
      // Anode at the local −20 end, so the triangle points the way current is
      // allowed through — the same direction the arrow of the symbol means on
      // paper, and the same as nodes[0] → nodes[1] everywhere else here. A
      // Zener gets the bent bar that says it is meant to be run backwards.
      const zener = Number.isFinite(e.vz) && e.vz > 0
      const bar = zener ? 'M 7,-9 L 7,9 M 7,-9 L 2,-9 M 7,9 L 12,9' : 'M 7,-9 L 7,9'
      return (
        <g stroke="var(--red, #f07474)" strokeWidth="1.6" fill="none">
          <line x1={-20} y1={0} x2={-7} y2={0} />
          <line x1={7} y1={0} x2={20} y2={0} />
          <polygon points="-7,-9 -7,9 7,0" fill="var(--red, #f07474)" stroke="none" />
          <path d={bar} />
        </g>
      )
    }
    case 'VCVS':
    case 'VCCS':
      return (
        <g stroke="#b98cf0" strokeWidth="1.5" fill="none">
          <line x1={-20} y1={0} x2={-11} y2={0} />
          <line x1={11} y1={0} x2={20} y2={0} />
          <polygon points="-11,0 0,-11 11,0 0,11" fill="var(--panel-2)" />
          {e.type === 'VCVS' ? (
            <>
              <line x1={-6} y1={0} x2={-2} y2={0} />
              <line x1={-4} y1={-2} x2={-4} y2={2} />
              <line x1={2} y1={0} x2={6} y2={0} />
            </>
          ) : (
            <>
              <line x1={-5} y1={0} x2={5} y2={0} />
              <polygon points="6,0 2,-3 2,3" fill="#b98cf0" />
            </>
          )}
        </g>
      )
    case 'Q':
    case 'M':
      return <TransistorGlyph e={e} />
    default:
      return <line x1={-20} y1={0} x2={20} y2={0} stroke="var(--text)" />
  }
}

/**
 * The four transistor glyphs, one row each. Both device kinds share the same
 * control lead and the same pair of output leads (schematicGeometry's
 * `transistorPinPlaces`); a row says only which body the control lead meets —
 * a BJT's solid bar, or a MOSFET's bar held off by a gap, since the gate is
 * capacitive and never touches the channel — and which way the arrowhead on
 * the lower lead points. A fifth glyph, a JFET or an IGBT, is one more row.
 */
const TRANSISTOR_GLYPHS = {
  'Q:npn': { shape: 'bjt', arrow: 'out' }, // current leaves at the emitter
  'Q:pnp': { shape: 'bjt', arrow: 'in' }, // current enters at the emitter
  'M:n': { shape: 'mosfet', arrow: 'out' }, // current leaves at the source
  'M:p': { shape: 'mosfet', arrow: 'in' }, // current enters at the source
}

/** A small triangle at the midpoint of (x1,y1)–(x2,y2), tip toward (x2,y2) when `out`, back toward (x1,y1) otherwise. */
function leadArrow(x1, y1, x2, y2, out) {
  const [dx, dy] = [x2 - x1, y2 - y1]
  const len = Math.hypot(dx, dy)
  const [ux, uy] = [dx / len, dy / len]
  const [px, py] = [-uy, ux]
  const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2]
  const s = out ? 1 : -1
  const [tipX, tipY] = [mx + ux * 4 * s, my + uy * 4 * s]
  const [bx, by] = [mx - ux * 4 * s, my - uy * 4 * s]
  return `${tipX},${tipY} ${bx + px * 3},${by + py * 3} ${bx - px * 3},${by - py * 3}`
}

/**
 * The BJT and MOSFET glyphs. The control lead runs from the local −20 end to
 * the bar (a BJT) or to the gate plate held off from the bar by a gap (a
 * MOSFET); the bar meets the two output leads, which splay to (12, −20) and
 * (12, 20) — the same points `transistorPinPlaces` names `hi` and `lo`. The
 * arrowhead on the lower lead is the one textbook mark that says which way is
 * npn or pnp, n-channel or p-channel: it points the way conventional current
 * actually flows through that terminal.
 */
function TransistorGlyph({ e }) {
  const row = TRANSISTOR_GLYPHS[`${e.type}:${e.polarity}`]
  if (!row) return null
  const isMosfet = row.shape === 'mosfet'
  const barX = isMosfet ? -6 : -8
  const leadEnd = isMosfet ? -9 : barX
  const arrow = leadArrow(barX, 6, 12, 20, row.arrow === 'out')
  return (
    <g stroke="var(--text)" strokeWidth="1.5" fill="none">
      <line x1={-20} y1={0} x2={leadEnd} y2={0} />
      {isMosfet ? <line x1={-9} y1={-10} x2={-9} y2={10} /> : null}
      <line x1={barX} y1={-10} x2={barX} y2={10} />
      <line x1={barX} y1={-6} x2={12} y2={-20} />
      <line x1={barX} y1={6} x2={12} y2={20} />
      <polygon points={arrow} fill="var(--text)" stroke="none" />
    </g>
  )
}

/**
 * A three-terminal device: control lead at the local −20 end, output leads
 * splayed to (12, −20) and (12, 20) as `Symbol`'s `TransistorGlyph` draws
 * them. `dir` and `flip` rotate and mirror it about (x, y) exactly as they do
 * a two-terminal element; the label and reading hang further off because the
 * glyph spans the full ±20 on both axes, not just along its length.
 *
 * Example, a common-emitter stage between two rails — Vcc at the top,
 * ground at the bottom, R_C from Vcc down to the collector, R_E from the
 * emitter down to ground, the base fed from a bias node on the left. Q1 at
 * (100, 90), dir 'h', puts its base at (80, 90), its collector at (112, 70)
 * and its emitter at (112, 110); R_C and R_E are short one wire on each side
 * because their own ±20 leads fall a little short of the rail and the pin:
 *
 *   const layout = {
 *     w: 200, h: 180,
 *     items: [
 *       { wire: [40, 20, 160, 20] },             // the Vcc rail
 *       { wire: [112, 20, 112, 25] },            // Vcc down to R_C
 *       { el: 'RC', x: 112, y: 45, dir: 'v' },
 *       { wire: [112, 65, 112, 70] },            // R_C down to the collector
 *       { el: 'Q1', x: 100, y: 90, dir: 'h' },
 *       { el: 'RB', x: 60, y: 90, dir: 'h' },    // its right lead meets the base at (80, 90)
 *       { node: 'bias', x: 40, y: 90, side: 'l' },
 *       { wire: [112, 110, 112, 115] },          // the emitter down to R_E
 *       { el: 'RE', x: 112, y: 135, dir: 'v' },
 *       { wire: [112, 155, 112, 160] },          // R_E down to the ground rail
 *       { wire: [40, 160, 160, 160] },           // the ground rail
 *       { gnd: [100, 160] },
 *     ],
 *   }
 *   // Q1: { id: 'Q1', type: 'Q', polarity: 'npn', nodes: ['c', 'b', 'e'] }
 */
function Transistor({ item, e, meters, show, lit = false }) {
  const { x, y, dir = 'h', flip = false } = item
  const rot = (dir === 'v' ? 90 : 0) + (flip ? 180 : 0)
  const reading = elementReading(e, meters, show)
  const { label: below, reading: above } = transistorTextPlaces(item)
  return (
    <g className={lit ? 'sch-el is-lit' : 'sch-el'} data-el={e.id}>
      <g transform={`rotate(${rot} ${x} ${y}) translate(${x} ${y})`}>
        <Symbol e={e} />
      </g>
      <Label e={e} at={below} />
      {reading ? (
        <text className="sch-meter" x={above.x} y={above.y} textAnchor={above.anchor}>
          {reading}
        </text>
      ) : null}
    </g>
  )
}

/**
 * Op-amp: the triangle, inputs on the left (+ on top unless `invertTop`),
 * output at the tip 38 px to the right of x. The layout wires up to
 * (x, y − 12), (x, y + 12) and (x + 38, y). Reading and label both hang
 * below, leaving the top clear for the feedback path.
 */
function OpAmp({ item, e, meters, show, lit = false }) {
  const { x, y, invertTop = true } = item
  const reading = elementReading(e, meters, show)
  const at = opampTextPlaces(item)
  return (
    <g className={lit ? 'sch-el is-lit' : 'sch-el'} data-el={e.id}>
      <polygon
        points={`${x},${y - 22} ${x},${y + 22} ${x + 38},${y}`}
        fill="var(--panel-2)"
        stroke="var(--line-bright)"
        strokeWidth="1.5"
      />
      <text className="sch-sign" x={x + 7} y={y - 8}>
        {invertTop ? '−' : '+'}
      </text>
      <text className="sch-sign" x={x + 7} y={y + 16}>
        {invertTop ? '+' : '−'}
      </text>
      <Label e={e} at={at.label} />
      {reading ? (
        <text className="sch-meter" x={at.reading.x} y={at.reading.y} textAnchor={at.reading.anchor}>
          {reading}
        </text>
      ) : null}
    </g>
  )
}
