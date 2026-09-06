import React, { useState } from 'react'
import { flowPropsFor, levelPropsFor, numberRowsFor, tablePropsFor } from '../view.js'
import { ip3Guard } from '../math.js'
import { db, dbm } from '../format.js'

// The three panes below the flow strip, and the strip itself. Each draws what
// `view.js` hands it and computes nothing of its own.

/**
 * The chain as a row of blocks, always visible above the view.
 *
 * Each block shows its four numbers and the signal level leaving it. On a phone
 * the row scrolls inside itself rather than widening the page, which is the one
 * place in this lab where a horizontal scroll is correct: the chain is longer
 * than the screen and a reader expects to slide along it.
 */
export function FlowStrip({ x }) {
  const v = flowPropsFor(null, null, x)
  if (!v.blocks.length) return null
  return (
    <nav className="chain" aria-label="The chain, block by block" data-role="chain">
      <span className="chain-end">
        {v.input.label}
        <em>{v.input.value}</em>
      </span>
      {v.blocks.map((b) => (
        <React.Fragment key={b.id}>
          <span className="chain-arrow" aria-hidden="true">
            →
          </span>
          <span className={`chain-block${b.passive ? ' is-passive' : ''}`} data-block={b.id} title={`${b.name}: gain ${b.gain}, noise figure ${b.nf}, input IP3 ${b.iip3}, ${b.power}`}>
            <strong>{b.name}</strong>
            <em data-role="block-gain">{b.gain}</em>
            <em data-role="block-nf">{b.nf}</em>
            <em data-role="block-signal">{b.signal}</em>
          </span>
        </React.Fragment>
      ))}
      <span className="chain-arrow" aria-hidden="true">
        →
      </span>
      <span className="chain-end is-out">
        {v.out.label}
        <em>{v.out.value}</em>
      </span>
    </nav>
  )
}

/**
 * The budget table: rows are blocks, columns are budgets.
 *
 * The switch under it turns every cell from the cumulative value to that
 * block's share of the budget, which is the reading that names the block to
 * change. Below about 900 px the table transposes into one card per block,
 * because six columns do not fit a phone and a sideways scroll on the lab's
 * signature view would be the first thing a reader hits.
 */
export function TablePane({ x }) {
  const [mode, setMode] = useState('cumulative')
  const v = tablePropsFor(null, null, x)
  const guard = ip3Guard(x)
  const cellOf = (row, col) => {
    const cell = row.cells[col.key]
    if (mode === 'share') return cell.share === null ? cell.own : cell.share
    return cell.value
  }

  return (
    <div className="sys-table-pane">
      <div className="sys-table-head">
        <div className="segmented sm" role="group" aria-label="What each cell shows">
          <button type="button" className={mode === 'cumulative' ? 'on' : ''} aria-pressed={mode === 'cumulative'} onClick={() => setMode('cumulative')} title="The running total up to and including each block">
            Cumulative
          </button>
          <button type="button" className={mode === 'share' ? 'on' : ''} aria-pressed={mode === 'share'} onClick={() => setMode('share')} title="Each block’s share of the budget, or its own number where a share has no meaning">
            Share
          </button>
        </div>
      </div>

      <div className="sys-table-scroll">
        <table className="sys-table" data-role="budget-table" data-mode={mode}>
          <thead>
            <tr>
              <th scope="col">Block</th>
              {v.columns.map((c) => (
                <th scope="col" key={c.key} title={c.title} data-col={c.key}>
                  {c.label}
                  <em>{c.unit}</em>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {v.rows.map((row) => (
              <tr key={row.id} data-row={row.id} className={row.passive ? 'is-passive' : ''}>
                <th scope="row">{row.name}</th>
                {v.columns.map((c) => (
                  <td key={c.key} data-cell={`${row.id}-${c.key}`} data-label={c.label}>
                    {cellOf(row, c)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="is-total" data-row="total">
              <th scope="row">Whole chain</th>
              {v.columns.map((c) => (
                <td key={c.key} data-cell={`total-${c.key}`} data-label={c.label}>
                  {v.totals[c.key]}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="sys-legend" data-role="table-caption">
        {v.caption}
      </p>
      {guard ? (
        <p className="sys-guard" data-role="ip3-guard">
          {guard}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The signal and the noise at every node, on one decibel axis.
 *
 * The gap between the two lines is the ratio, and it never widens. The numbers
 * are under the plot rather than in a tooltip, because A4 quotes them and a
 * reader checking a quote should not have to hover.
 */
export function LevelsPane({ x }) {
  const v = levelPropsFor(null, null, x)
  const W = 440
  const H = 180
  const left = 46
  const right = W - 10
  const top = 12
  const bottom = H - 34
  const n = Math.max(1, v.nodes.length - 1)
  const nx = (i) => left + ((right - left) * i) / n
  const ny = (dbmValue) => bottom - ((bottom - top) * (dbmValue - v.from)) / Math.max(1e-9, v.to - v.from)
  const path = (key) => v.nodes.map((node, i) => `${i === 0 ? 'M' : 'L'}${nx(i).toFixed(2)} ${ny(node[key]).toFixed(2)}`).join(' ')
  const ticks = []
  for (let level = v.from; level <= v.to + 1e-9; level += Math.max(10, Math.round((v.to - v.from) / 60) * 10)) ticks.push(level)

  return (
    <div className="sys-plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="The signal and the noise in dBm at every node of the chain">
        <line className="sys-axis" x1={left} y1={bottom} x2={right} y2={bottom} />
        <line className="sys-axis" x1={left} y1={top} x2={left} y2={bottom} />
        {ticks.map((level) => (
          <g key={level}>
            <line className="sys-grid" x1={left} y1={ny(level)} x2={right} y2={ny(level)} />
            <text className="sys-axis-tick" x={left - 5} y={ny(level) + 3} textAnchor="end">
              {level}
            </text>
          </g>
        ))}
        {v.nodes.map((node, i) => (
          <line key={node.index} className="sys-gap" x1={nx(i)} y1={ny(node.signalDbm)} x2={nx(i)} y2={ny(node.noiseDbm)} data-gap={node.id} />
        ))}
        <path className="sys-trace is-noise" d={path('noiseDbm')} data-role="noise-line" />
        <path className="sys-trace is-signal" d={path('signalDbm')} data-role="signal-line" />
        {v.nodes.map((node, i) => (
          <g key={node.index}>
            <circle className="sys-dot is-signal" cx={nx(i)} cy={ny(node.signalDbm)} r={2.4} />
            <circle className="sys-dot is-noise" cx={nx(i)} cy={ny(node.noiseDbm)} r={2.4} />
            <text className="sys-node-tick" x={nx(i)} y={bottom + 12} textAnchor="middle">
              {node.index}
            </text>
          </g>
        ))}
        <text className="sys-axis-label" x={(left + right) / 2} y={H - 6} textAnchor="middle">
          Node, from the input to the output
        </text>
        <text className="sys-axis-label" x={12} y={(top + bottom) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(top + bottom) / 2})`}>
          Level, dBm
        </text>
      </svg>

      <div className="sys-levels" data-role="level-rows">
        {v.nodes.map((node) => (
          <div className="sys-level-row" key={node.index} data-level={node.id}>
            <span className="sys-level-name">
              {node.index}. {node.name}
            </span>
            <span className="sys-level-value" data-role="signal">
              {dbm(node.signalDbm)}
            </span>
            <span className="sys-level-value" data-role="noise">
              {dbm(node.noiseDbm)}
            </span>
            <span className="sys-level-value" data-role="snr">
              {db(node.snrDb)}
            </span>
          </div>
        ))}
      </div>

      <p className="sys-legend" data-role="levels-caption">
        {v.caption}
      </p>
    </div>
  )
}

/** Every closed form the experiment used, with the formula it came from. */
export function NumbersPane({ exp, x, p }) {
  const rows = numberRowsFor(exp, p, x)
  if (!rows.length) return <p className="hint">Nothing to compute at this setting.</p>
  return (
    <div className="sys-numbers">
      {rows.map((r) => (
        <div className="sys-row" key={r.label} data-row={r.label}>
          <span className="sys-row-label">{r.label}</span>
          <span className="sys-row-value">{r.value}</span>
          <span className="sys-row-formula">{r.formula}</span>
        </div>
      ))}
    </div>
  )
}
