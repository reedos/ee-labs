import React from 'react'
import { fmt } from './units.js'

/**
 * The one-line diagram, with power-flow arrows and an energy-balance readout.
 *
 * A power system is not drawn as three phases. One line stands for all three,
 * a bar stands for a bus, and what is written beside each is the answer a solve
 * gave. `PROGRAM.md` §4 assigns this canvas to the Grid Lab first and the
 * Energy Lab second, so both labs' needs are in the signature from the first
 * commit rather than added later.
 *
 * The Grid Lab passes a transmission network. Bars are buses, tinted by voltage
 * magnitude, and each branch end carries an arrow whose length is the real flow
 * and whose colour carries the reactive flow. The Energy Lab passes a microgrid:
 * the same bars and lines, with a photovoltaic source, a battery carrying its
 * state of charge and a load hanging off one bus, and `t` moving a day-long
 * cursor. `dc: true` on a bus draws it as a DC bus, which has no angle to show.
 *
 * The renderer draws what it is given. What a meter reads is measured in the
 * app, and arrives here as a number.
 *
 *   buses     [{ id, name, x, y, V, theta, kind, soc, dc, limit }]
 *             kind: 'slack' | 'source' | 'storage' | 'load' | 'bus'
 *   branches  [{ id, from, to, Pf, Qf, Pt, Qt, loss, limit }]
 *             Pf leaves `from`. A negative Pf draws the arrow the other way,
 *             which is the whole lesson about the sign of a flow.
 *   balance   { in, out, stored, curtailed, unserved, unit } — the readout under
 *             the diagram. Whatever is present is shown, and the residual of
 *             what is present is printed beside it.
 *   arrows    'flow' to draw them, 'none' to leave them off. A guard that
 *             cannot vouch for a direction passes 'none' and a `refusal`.
 *   refusal   the sentence printed where the arrows would have been
 *   t         a cursor in hours, for the Energy Lab's day. Shown as a label.
 *   units     'pu' or 'si', which decides how every number is written
 *   base      { S, V } — the base power in VA and voltage in V, for 'si'
 *   lit       ids to draw lit, as `Schematic` takes them
 */
export default function OneLineCanvas({
  buses = [],
  branches = [],
  balance = null,
  arrows = 'flow',
  refusal = null,
  t = null,
  units = 'pu',
  base = null,
  lit = null,
  className = '',
  width = 420,
  height = 220,
}) {
  const litSet = lit instanceof Set ? lit : new Set(lit || [])
  const at = new Map(buses.map((b) => [b.id, b]))
  // The arrows are scaled by the largest flow drawn, so a lightly loaded
  // network is not drawn with invisible arrows and a heavy one does not run
  // its arrows into the next bus.
  const biggest = branches.reduce((m, br) => Math.max(m, Math.abs(br.Pf ?? 0), Math.abs(br.Pt ?? 0)), 0) || 1
  const showArrows = arrows === 'flow'
  const label = (v, unit, si) => (units === 'si' && base ? fmt(v * si, unit, 3) : `${round(v)} pu`)

  return (
    <div className={`one-line ${className}`}>
      <svg className="one-line-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel(buses, branches)}>
        {branches.map((br) => {
          const a = at.get(br.from)
          const b = at.get(br.to)
          if (!a || !b) return null
          return (
            <Branch
              key={br.id}
              br={br}
              a={a}
              b={b}
              biggest={biggest}
              showArrows={showArrows}
              lit={litSet.has(br.id)}
              units={units}
              base={base}
            />
          )
        })}
        {buses.map((b) => (
          <Bus key={b.id} bus={b} lit={litSet.has(b.id)} units={units} base={base} />
        ))}
        {t === null ? null : (
          <text className="one-line-cursor" x={width - 6} y={14} textAnchor="end">
            {`hour ${round(t)}`}
          </text>
        )}
        {refusal ? (
          <text className="one-line-refusal" x={width / 2} y={height - 6} textAnchor="middle">
            {refusal}
          </text>
        ) : null}
      </svg>
      {balance ? <Balance balance={balance} /> : null}
    </div>
  )
}

/** Two decimal places for a per-unit number, and no trailing noise. */
const round = (v) => (Number.isFinite(v) ? +v.toFixed(Math.abs(v) < 10 ? 3 : 1) : '—')

/** What a screen reader is told the picture is. */
const ariaLabel = (buses, branches) =>
  `One-line diagram: ${buses.length} buses and ${branches.length} branches, with the real and reactive flow at each branch end.`

/** How far a bus voltage sits from nominal, as a tint from −1 to 1. */
export function tintOf(V) {
  if (!Number.isFinite(V)) return 0
  return Math.max(-1, Math.min(1, (V - 1) / 0.1))
}

/**
 * The geometry of one branch: the line between two bus bars, and where each
 * end's arrow starts and how long it is. Exported so a test can measure the
 * drawing rather than read the markup.
 */
export function branchGeometry(a, b, br, biggest, { inset = 16, span = 34 } = {}) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const from = { x: a.x + ux * inset, y: a.y + uy * inset }
  const to = { x: b.x - ux * inset, y: b.y - uy * inset }
  const arrow = (P, atEnd) => {
    const scale = Math.min(1, Math.abs(P) / biggest)
    const length = Math.max(6, span * scale)
    // A flow leaving `from` points along the line. A negative one points back,
    // which is how a reader sees a branch reverse.
    const sign = (P >= 0 ? 1 : -1) * (atEnd ? -1 : 1)
    const start = atEnd ? to : from
    return { x1: start.x, y1: start.y, x2: start.x + sign * ux * length, y2: start.y + sign * uy * length, length, sign }
  }
  return { from, to, ux, uy, len, head: arrow(br.Pf ?? 0, false), tail: arrow(br.Pt ?? 0, true) }
}

function Branch({ br, a, b, biggest, showArrows, lit, units, base }) {
  const g = branchGeometry(a, b, br, biggest)
  const over = br.limit && Math.abs(br.Pf ?? 0) > br.limit
  const text = units === 'si' && base ? `${fmt((br.Pf ?? 0) * base.S, 'W', 3)}` : `${round(br.Pf ?? 0)} pu`
  return (
    <g className={`ol-branch${lit ? ' is-lit' : ''}${over ? ' is-over' : ''}`} data-branch={br.id}>
      <line className="ol-line" x1={g.from.x} y1={g.from.y} x2={g.to.x} y2={g.to.y} />
      {showArrows ? (
        <>
          <Arrow g={g.head} kind="from" Q={br.Qf ?? 0} id={br.id} />
          <Arrow g={g.tail} kind="to" Q={br.Qt ?? 0} id={br.id} />
        </>
      ) : null}
      <text className="ol-flow" x={(g.from.x + g.to.x) / 2} y={(g.from.y + g.to.y) / 2 - 5} textAnchor="middle">
        {text}
      </text>
    </g>
  )
}

/**
 * One arrow. Its length is the real flow and its class carries the sign of the
 * reactive flow, so a branch delivering reactive power reads differently from
 * one absorbing it without a second arrow being drawn.
 */
function Arrow({ g, kind, Q, id }) {
  const nx = -(g.y2 - g.y1)
  const ny = g.x2 - g.x1
  const n = Math.hypot(nx, ny) || 1
  const hx = ((g.x2 - g.x1) / (g.length || 1)) * 5
  const hy = ((g.y2 - g.y1) / (g.length || 1)) * 5
  const wing = 3.2
  const pts = [
    [g.x2, g.y2],
    [g.x2 - hx + (nx / n) * wing, g.y2 - hy + (ny / n) * wing],
    [g.x2 - hx - (nx / n) * wing, g.y2 - hy - (ny / n) * wing],
  ]
  return (
    <g className={`ol-arrow is-${kind} ${Q >= 0 ? 'q-out' : 'q-in'}`} data-arrow={`${id}.${kind}`} data-sign={g.sign}>
      <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} />
      <polygon points={pts.map((p) => p.join(',')).join(' ')} />
    </g>
  )
}

/** A bus bar, its name, its voltage, and whatever hangs off it. */
function Bus({ bus, lit, units, base }) {
  const tint = tintOf(bus.V)
  const half = 15
  const volts = units === 'si' && base ? fmt(bus.V * base.V, 'V', 4) : `${round(bus.V)} pu`
  const angle = bus.dc || !Number.isFinite(bus.theta) ? null : `${round((bus.theta * 180) / Math.PI)}°`
  return (
    <g className={`ol-bus is-${bus.kind || 'bus'}${lit ? ' is-lit' : ''}${bus.dc ? ' is-dc' : ''}`} data-bus={bus.id} data-tint={tint.toFixed(2)}>
      <line className="ol-bar" x1={bus.x - half} y1={bus.y} x2={bus.x + half} y2={bus.y} style={{ '--tint': tint }} />
      <text className="ol-name" x={bus.x} y={bus.y - 8} textAnchor="middle">
        {bus.name || bus.id}
      </text>
      <text className="ol-volts" x={bus.x} y={bus.y + 16} textAnchor="middle">
        {angle ? `${volts} ∠ ${angle}` : volts}
      </text>
      {bus.kind && bus.kind !== 'bus' ? <Marker bus={bus} /> : null}
    </g>
  )
}

/**
 * What hangs off a bus. A slack bus and a generator are circles, a source is a
 * circle with the sun's rays, a store is a bar with its state of charge, and a
 * load is an arrow into the ground.
 */
function Marker({ bus }) {
  const y = bus.y + 26
  if (bus.kind === 'load')
    return (
      <g className="ol-marker is-load">
        <line x1={bus.x} y1={bus.y} x2={bus.x} y2={y} />
        <polygon points={`${bus.x - 4},${y} ${bus.x + 4},${y} ${bus.x},${y + 7}`} />
      </g>
    )
  if (bus.kind === 'storage')
    return (
      <g className="ol-marker is-storage">
        <line x1={bus.x} y1={bus.y} x2={bus.x} y2={y - 4} />
        <rect x={bus.x - 8} y={y - 4} width={16} height={12} />
        <rect className="ol-soc" x={bus.x - 7} y={y - 3} width={Math.max(0, Math.min(1, bus.soc ?? 0)) * 14} height={10} />
        <text className="ol-soc-text" x={bus.x} y={y + 20} textAnchor="middle">
          {Number.isFinite(bus.soc) ? `${Math.round(bus.soc * 100)} %` : ''}
        </text>
      </g>
    )
  return (
    <g className={`ol-marker is-${bus.kind}`}>
      <line x1={bus.x} y1={bus.y} x2={bus.x} y2={y - 8} />
      <circle cx={bus.x} cy={y} r={8} />
      {bus.kind === 'source' ? (
        <g className="ol-rays">
          {[0, 1, 2, 3].map((k) => {
            const a = (k * Math.PI) / 4
            return <line key={k} x1={bus.x - Math.cos(a) * 11} y1={y - Math.sin(a) * 11} x2={bus.x + Math.cos(a) * 11} y2={y + Math.sin(a) * 11} />
          })}
        </g>
      ) : null}
    </g>
  )
}

/**
 * The energy balance under the diagram. Whatever the caller passes is shown,
 * and the residual is printed beside it, because a balance shown without its
 * residual is a claim nobody can check.
 */
export function balanceRows(balance) {
  const keys = ['in', 'out', 'stored', 'curtailed', 'unserved', 'loss']
  const label = { in: 'In', out: 'Out', stored: 'Stored', curtailed: 'Curtailed', unserved: 'Unserved', loss: 'Loss' }
  const rows = keys.filter((k) => Number.isFinite(balance[k])).map((k) => ({ key: k, label: label[k], value: balance[k] }))
  // What arrives has to leave, be stored, be spilled or go unmet. The residual
  // is what the rows do not account for.
  const residual = (balance.in ?? 0) - (balance.out ?? 0) - (balance.stored ?? 0) - (balance.curtailed ?? 0) - (balance.loss ?? 0) + (balance.unserved ?? 0)
  return { rows, residual }
}

function Balance({ balance }) {
  const { rows, residual } = balanceRows(balance)
  const unit = balance.unit || 'pu'
  return (
    <dl className="one-line-balance" data-role="balance">
      {rows.map((r) => (
        <React.Fragment key={r.key}>
          <dt>{r.label}</dt>
          <dd>{`${round(r.value)} ${unit}`}</dd>
        </React.Fragment>
      ))}
      <dt>Residual</dt>
      <dd data-role="residual">{`${residual.toExponential(1)} ${unit}`}</dd>
    </dl>
  )
}
