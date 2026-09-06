import React from 'react'
import { sparamPropsFor } from '../view.js'
import { num, plain } from '../format.js'

// The S-parameter view: the four entries in decibels against frequency, their
// angles below, and a marker that reads all four at one frequency.
//
// `PROGRAM.md` §4's rule about a second lab is answered in the props rather
// than in the file's location. The Instruments Lab's network analyser group is
// this view's second user, and what that group needs is a calibration plane it
// can move. `plane` is that offset in degrees, it turns the angle of every
// entry and leaves every magnitude alone, and the caption says when it has
// moved. Promoting this file into `packages/ui` is then a move rather than a
// rewrite, which is what `apps/rf-lab/NEEDS.md` §3 asks the director to decide.

const COLOURS = { 11: 'is-s11', 21: 'is-s21', 12: 'is-s12', 22: 'is-s22' }

export function SparamPane({ exp, x, p, plane = 0 }) {
  const v = sparamPropsFor(exp, p, x, plane)
  const W = 420
  const H = 210
  const left = 40
  const right = W - 8
  const top = 10
  const mid = 118
  const bottom = H - 26
  const fx = (f) => left + ((right - left) * (f - v.from)) / Math.max(1e-12, v.to - v.from)
  const dy = (db) => {
    const clipped = Math.max(v.floor, Math.min(v.ceiling, Number.isFinite(db) ? db : v.floor))
    return mid - 8 - (mid - 8 - top) * ((clipped - v.floor) / Math.max(1e-12, v.ceiling - v.floor))
  }
  const ay = (deg) => (mid + bottom) / 2 - ((bottom - mid) / 2) * (deg / 180)
  const trace = (points, y, key) => points.map((q, i) => `${i === 0 ? 'M' : 'L'}${fx(q.f).toFixed(2)} ${y(q[key]).toFixed(2)}`).join(' ')

  return (
    <div className="rf-plot rf-sparam">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`The four S-parameters of ${v.name} against frequency, in decibels, with their angles below`}>
        <line className="rf-axis" x1={left} y1={mid - 8} x2={right} y2={mid - 8} />
        <line className="rf-axis" x1={left} y1={top} x2={left} y2={mid - 8} />
        <line className="rf-axis" x1={left} y1={bottom} x2={right} y2={bottom} />
        <line className="rf-axis" x1={left} y1={mid} x2={left} y2={bottom} />
        <line className="rf-zero" x1={left} y1={ay(0)} x2={right} y2={ay(0)} />

        {v.traces.map((t) => (
          <path key={`db-${t.key}`} className={`rf-strace ${COLOURS[t.key]}`} data-trace={`S${t.key}`} d={trace(t.points, dy, 'db')} />
        ))}
        {v.traces.map((t) => (
          <path key={`deg-${t.key}`} className={`rf-strace ${COLOURS[t.key]}`} data-angle={`S${t.key}`} d={trace(t.points, ay, 'deg')} />
        ))}

        <line className="rf-marker" x1={fx(v.marker)} y1={top} x2={fx(v.marker)} y2={bottom} data-role="marker" />

        <text className="rf-axis-tick" x={left - 5} y={top + 8} textAnchor="end">
          {`${plain(v.ceiling, 3)}`}
        </text>
        <text className="rf-axis-tick" x={left - 5} y={mid - 10} textAnchor="end">
          {`${plain(v.floor, 3)}`}
        </text>
        <text className="rf-axis-tick" x={left - 5} y={mid + 10} textAnchor="end">
          180
        </text>
        <text className="rf-axis-tick" x={left - 5} y={bottom} textAnchor="end">
          −180
        </text>
        <text className="rf-axis-label" x={11} y={(top + mid) / 2} textAnchor="middle" transform={`rotate(-90 11 ${(top + mid) / 2})`}>
          Magnitude, dB
        </text>
        <text className="rf-axis-label" x={11} y={(mid + bottom) / 2} textAnchor="middle" transform={`rotate(-90 11 ${(mid + bottom) / 2})`}>
          Angle, degrees
        </text>
        <text className="rf-axis-label" x={(left + right) / 2} y={H - 6} textAnchor="middle">
          {`Frequency, ${num(v.from, 'Hz')} to ${num(v.to, 'Hz')}`}
        </text>
      </svg>
      <div className="rf-marker-read" data-role="marker-read">
        {v.at.map((e) => (
          <span key={e.key} className={`rf-chip ${COLOURS[e.key]}`} data-entry={e.label}>
            <em>{e.label}</em>
            {`${plain(e.mag)} ∠ ${e.deg.toFixed(2)}°`}
            <i>{Number.isFinite(e.db) ? `${plain(e.db)} dB` : 'nothing gets through'}</i>
          </span>
        ))}
      </div>
      <p className="rf-legend" data-role="sparam-legend">
        {`${v.name}, ${x.trace.length} exact points, read at ${num(v.marker, 'Hz')}. `}
        {v.plane
          ? `The reference plane has moved ${plain(v.plane, 4)}° towards the generator, so every angle is turned and no magnitude is.`
          : 'The reference plane is at the connector, so the angles are the ones the circuit itself produces.'}
      </p>
    </div>
  )
}

export default SparamPane
