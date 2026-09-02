import React from 'react'
import { fmt } from './units.js'
import { labelParts, elementReading, elementTextPlaces, opampTextPlaces, nodeTextPlace, signPlaces } from './schematicGeometry.js'

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
 * Elements are { id, type, value, label? }; types R V I C L SW OPAMP VCVS VCCS.
 * Meters are { v: { node: volts }, i: { id: amps }, p: { id: watts } }; `show`
 * chooses which of 'i', 'v', 'p' is written on the elements (node voltages
 * appear whenever meters are given).
 */
export default function Schematic({ elements, layout, meters = null, show = 'i', className = '' }) {
  const byId = new Map(elements.map((e) => [e.id, e]))
  const { w = 320, h = 160, items = [], crop = null } = layout
  const [cx0, cy0, cx1, cy1] = crop || [0, 0, w, h]
  const cw = cx1 - cx0
  const ch = cy1 - cy0
  return (
    <svg
      className={`schematic ${className}`}
      viewBox={`${cx0} ${cy0} ${cw} ${ch}`}
      style={{ '--crop-w': cw, '--ar': cw / ch }}
      role="img"
      aria-label={`Schematic: ${elements.map((e) => e.label || e.id).join(', ')}`}
    >
      {items.map((it, k) => {
        if (it.box) return <Frame key={k} pts={it.box} />
        if (it.wire) return <Wire key={k} pts={it.wire} />
        if (it.gnd) return <Gnd key={k} x={it.gnd[0]} y={it.gnd[1]} />
        if (it.node)
          return (
            <NodeDot
              key={k}
              name={it.node}
              x={it.x}
              y={it.y}
              side={it.side || 'r'}
              volts={meters ? meters.v[it.node] : undefined}
            />
          )
        if (it.text)
          return (
            <text key={k} className="sch-note" x={it.x} y={it.y} textAnchor={it.anchor || 'middle'}>
              {it.text}
            </text>
          )
        if (it.el) {
          const e = byId.get(it.el)
          if (!e) return null
          return <Element key={k} item={it} e={e} meters={meters} show={show} />
        }
        return null
      })}
    </svg>
  )
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

const Gnd = ({ x, y }) => (
  <g stroke="var(--dim)" strokeWidth="1.5">
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

function NodeDot({ name, x, y, side, volts }) {
  const at = nodeTextPlace({ x, y, side })
  return (
    <g>
      <circle cx={x} cy={y} r="3" fill="var(--line-bright)" />
      <text className="sch-port" x={at.x} y={at.y} textAnchor={at.anchor}>
        {name}
        {Number.isFinite(volts) ? (
          <tspan className="sch-meter" dx="4">
            {fmt(volts, 'V', 3)}
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
function Element({ item, e, meters, show }) {
  const { x, y, dir = 'h', flip = false } = item
  if (e.type === 'OPAMP') return <OpAmp item={item} e={e} meters={meters} show={show} />
  const rot = (dir === 'v' ? 90 : 0) + (flip ? 180 : 0)
  // Text must stay upright: it is drawn in an un-rotated group at the same place.
  const { label: below, reading: above } = elementTextPlaces(item)
  const signs = signPlaces(item)
  const i = meters ? meters.i[e.id] : undefined
  const reading = elementReading(e, meters, show)
  // Arrow along the element in the direction the current flows: + to − when
  // positive. In local coordinates + is at −20, so positive points along +x.
  const arrow = meters && show === 'i' && Number.isFinite(i) && Math.abs(i) > 1e-15 ? Math.sign(i) : 0
  return (
    <g>
      <g transform={`rotate(${rot} ${x} ${y}) translate(${x} ${y})`}>
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
    default:
      return <line x1={-20} y1={0} x2={20} y2={0} stroke="var(--text)" />
  }
}

/**
 * Op-amp: the triangle, inputs on the left (+ on top unless `invertTop`),
 * output at the tip 38 px to the right of x. The layout wires up to
 * (x, y − 12), (x, y + 12) and (x + 38, y). Reading and label both hang
 * below, leaving the top clear for the feedback path.
 */
function OpAmp({ item, e, meters, show }) {
  const { x, y, invertTop = true } = item
  const reading = elementReading(e, meters, show)
  const at = opampTextPlaces(item)
  return (
    <g>
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
