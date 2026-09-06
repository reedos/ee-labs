import React from 'react'
import { SmithCanvas } from '@ee-labs/ui'
import { chartPropsFor, linePropsFor, numberRowsFor, sweepPropsFor } from '../view.js'
import { num, plain } from '../format.js'

// The three panes beside the chart. Each draws what `view.js` hands it and
// computes nothing of its own.

export function ChartPane({ exp, x, p }) {
  return (
    <div className="rf-plot">
      <SmithCanvas {...chartPropsFor(exp, p, x)} />
    </div>
  )
}

/**
 * The line, drawn against the wavelength at the frequency in use.
 *
 * The bar is the physical length and the marks are quarter wavelengths, so a
 * quarter-wave section shows one mark at its far end and shows four when the
 * frequency is quadrupled. Above it is the standing wave, normalised to its own
 * largest value, with the largest and the smallest marked.
 */
export function LinePane({ exp, x, p }) {
  const v = linePropsFor(exp, p, x)
  const W = 420
  const H = 150
  const left = 10
  const right = W - 10
  const span = right - left
  const at = (d) => left + (span * d) / Math.max(v.length, 1e-12)
  const baseline = H - 34
  const path = v.samples
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${at(s.d).toFixed(2)} ${(baseline - 78 * s.v).toFixed(2)}`)
    .join(' ')

  return (
    <div className="rf-plot rf-line">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A line ${plain(v.degrees, 5)} degrees long, with its standing wave drawn above it`}>
        <path className="rf-standing" d={path} data-role="standing" />
        <rect className="rf-conductor" x={left} y={baseline} width={span} height={9} />
        {v.ticks.marks.map((m) => (
          <g key={m.d} className={`rf-tick${m.major ? ' is-major' : ''}`} data-tick={m.wavelengths}>
            <line x1={at(m.d)} y1={baseline - 4} x2={at(m.d)} y2={baseline + 17} />
            {m.major ? (
              <text x={at(m.d)} y={baseline + 29} textAnchor="middle">
                {`${m.wavelengths}λ`}
              </text>
            ) : null}
          </g>
        ))}
        <text className="rf-end" x={left} y={baseline - 88} textAnchor="start" data-role="source-end">
          source
        </text>
        <text className="rf-end" x={right} y={baseline - 88} textAnchor="end" data-role="load-end">
          {v.load}
        </text>
      </svg>
      <p className="rf-legend" data-role="line-legend">
        {`${num(v.length, 'm')} of line, ${plain(v.degrees, 5)}° at ${num(p.f, 'Hz')}. Wavelength ${num(v.lambda, 'm')}, marks every ${plain(v.ticks.every / 4, 3)} of one. `}
        {`Standing-wave ratio ${plain(v.swr, 5)}, with the smallest voltage ${num(v.dMin, 'm')} from the load.`}
      </p>
    </div>
  )
}

/**
 * The sweep: one exact answer per frequency, and nothing between them.
 *
 * This is the pane that carries A5's refusal, and the message sits under the
 * plot rather than in a tooltip, because a reader looking for a pole-zero view
 * is looking here.
 */
export function SweepPane({ exp, x, p }) {
  const v = sweepPropsFor(exp, p, x)
  const W = 420
  const H = 170
  const left = 44
  const right = W - 10
  const top = 12
  const bottom = H - 30
  const fx = (f) => left + ((right - left) * (f - v.from)) / Math.max(1e-12, v.to - v.from)
  const gy = (m) => bottom - (bottom - top) * Math.min(1, m)
  const path = v.points.map((q, i) => `${i === 0 ? 'M' : 'L'}${fx(q.f).toFixed(2)} ${gy(q.mag).toFixed(2)}`).join(' ')
  const repeats = []
  for (let f = v.from + v.repeat; f < v.to; f += v.repeat) repeats.push(f)

  return (
    <div className="rf-plot rf-sweep">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="The reflection magnitude against frequency, at exact points">
        <line className="rf-axis" x1={left} y1={bottom} x2={right} y2={bottom} />
        <line className="rf-axis" x1={left} y1={top} x2={left} y2={bottom} />
        {repeats.map((f) => (
          <line key={f} className="rf-repeat" x1={fx(f)} y1={top} x2={fx(f)} y2={bottom} data-repeat={f} />
        ))}
        <path className="rf-trace" d={path} data-role="sweep" />
        {v.points.length <= 121
          ? v.points.map((q) => <circle key={q.f} className="rf-dot" cx={fx(q.f)} cy={gy(q.mag)} r={1.6} />)
          : null}
        <line className="rf-marker" x1={fx(v.marker)} y1={top} x2={fx(v.marker)} y2={bottom} data-role="marker" />
        <text className="rf-axis-label" x={(left + right) / 2} y={H - 8} textAnchor="middle">
          {`Frequency, ${num(v.from, 'Hz')} to ${num(v.to, 'Hz')}`}
        </text>
        <text className="rf-axis-label" x={12} y={(top + bottom) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(top + bottom) / 2})`}>
          Reflection magnitude
        </text>
        <text className="rf-axis-tick" x={left - 6} y={top + 4} textAnchor="end">
          1
        </text>
        <text className="rf-axis-tick" x={left - 6} y={bottom} textAnchor="end">
          0
        </text>
      </svg>
      <p className="rf-legend">
        {`${v.points.length} exact points, ${num((v.to - v.from) / (v.points.length - 1), 'Hz')} apart. The response repeats every ${num(v.repeat, 'Hz')}, and the lines mark where.`}
      </p>
      {v.says ? (
        <p className="rf-declined" data-role="declined">
          {v.says}
        </p>
      ) : null}
    </div>
  )
}

/** Every closed form the experiment used, with the formula it came from. */
export function NumbersPane({ exp, x, p }) {
  const rows = numberRowsFor(exp, p, x)
  if (!rows.length) return <p className="hint">Nothing to compute at this setting.</p>
  return (
    <div className="rf-numbers">
      {rows.map((r) => (
        <div className="rf-row" key={r.label} data-row={r.label}>
          <span className="rf-row-label">{r.label}</span>
          <span className="rf-row-value">{r.value}</span>
          <span className="rf-row-formula">{r.formula}</span>
        </div>
      ))}
    </div>
  )
}
