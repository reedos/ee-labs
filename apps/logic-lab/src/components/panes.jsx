import React from 'react'
import { expressionOf, grayOrder, cubeMinterms } from '@ee-labs/events'
import { ps } from '../format.js'

// The panes that are tables rather than drawings: the truth table, the Karnaugh
// map, the path list and the event list. Each reads the one analysis object the
// app already has, so no pane can disagree with another about a number.

/** Every row of the truth table, with the row the knobs currently sit in lit. */
export function TruthTable({ x }) {
  if (!x.table) return <Empty>This experiment has no truth table.</Empty>
  const { inputs, outputs, rows } = x.table
  const here = rows.findIndex((r) => inputs.every((s, i) => x.res.final[s] === r.in[i]))
  return (
    <div className="pane-scroll">
      <table className="truth">
        <thead>
          <tr>
            {inputs.map((s) => (
              <th key={s} className="in">
                {s}
              </th>
            ))}
            {outputs.map((s) => (
              <th key={s}>{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.index} className={r.index === here ? 'is-here' : undefined}>
              {r.in.map((v, i) => (
                <td key={inputs[i]} className="in">
                  {v}
                </td>
              ))}
              {r.out.map((v, i) => (
                <td key={outputs[i]} className={v ? 'is-one' : undefined}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pane-note">
        {rows.length} rows for {inputs.length} inputs. The lit row is the one the knobs sit in.
      </p>
    </div>
  )
}

/**
 * The Karnaugh map, in Gray-code order, with the minimum cover written under it.
 *
 * The cells are laid out so that neighbours differ in one variable, which is
 * the whole reason the map exists. Cells the cover reaches are marked, so the
 * loops a reader would draw are the loops the minimiser found.
 */
export function KarnaughMap({ x }) {
  if (!x.minimise) return <Empty>This experiment does not minimise a function.</Empty>
  const { names, minterms, cover, cubes, literals, primes } = x.minimise
  const n = names.length
  const rowBits = n > 2 ? n - 2 : n - 1
  const colBits = n - rowBits
  const rowOrder = grayOrder(rowBits)
  const colOrder = grayOrder(colBits)
  const indexOf = (r, c) => (r << colBits) | c
  const covered = new Map()
  cover.forEach((cube, i) => {
    for (const m of cubeMinterms(cube, n)) covered.set(m, i)
  })
  const bits = (v, w) => v.toString(2).padStart(w, '0')
  return (
    <div className="pane-scroll">
      <table className="kmap">
        <thead>
          <tr>
            <th className="corner">
              {names.slice(0, rowBits).join('')} \ {names.slice(rowBits).join('')}
            </th>
            {colOrder.map((c) => (
              <th key={c}>{bits(c, colBits)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowOrder.map((r) => (
            <tr key={r}>
              <th>{bits(r, rowBits)}</th>
              {colOrder.map((c) => {
                const m = indexOf(r, c)
                const one = minterms.includes(m)
                const k = covered.get(m)
                return (
                  <td key={c} className={`${one ? 'is-one' : ''} ${k != null ? `loop-${k % 4}` : ''}`.trim() || undefined} title={`minterm ${m}`}>
                    {one ? 1 : 0}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pane-note">
        {primes.length} prime implicants. The minimum cover is {cubes} terms and {literals} literals: <code>{expressionOf(cover, names)}</code>
      </p>
    </div>
  )
}

/** Every endpoint's longest and shortest arrival, and the gates along each. */
export function PathList({ x }) {
  if (!x.paths) return <Empty>This experiment does not time its paths.</Empty>
  const ends = [...x.paths.endpoints].sort((a, b) => b.long - a.long)
  return (
    <div className="pane-scroll">
      <table className="paths">
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Longest</th>
            <th>Shortest</th>
            <th>The path</th>
          </tr>
        </thead>
        <tbody>
          {ends.map((e) => (
            <tr key={e.signal} className={e.long === x.paths.long.delay ? 'is-critical' : undefined}>
              <td>{e.signal}</td>
              <td className="num">{ps(e.long)}</td>
              <td className="num">{ps(e.short)}</td>
              <td className="path">{e.path.join(' → ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pane-note">
        The critical path is {ps(x.paths.long.delay)}, from {x.paths.long.from} to {x.paths.long.to}.
      </p>
    </div>
  )
}

/** The event list: what changed, when, and which event caused it. */
export function EventTable({ x }) {
  const events = x.res.events
  if (!events.length) return <Empty>Nothing changed in this run. Every gate agrees with its inputs.</Empty>
  return (
    <div className="pane-scroll">
      <table className="events">
        <thead>
          <tr>
            <th>Time</th>
            <th>Signal</th>
            <th>To</th>
            <th>Delay</th>
            <th>Caused by</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i}>
              <td className="num">{ps(e.t)}</td>
              <td>{e.signal}</td>
              <td className={e.to ? 'is-one' : undefined}>{e.to}</td>
              <td className="num">{e.delay ? ps(e.delay) : '—'}</td>
              <td>{e.cause ? `${e.cause.signal} at ${ps(e.cause.t)}` : 'a source'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {x.res.swallowed.length ? (
        <p className="pane-note">
          {x.res.swallowed.length} pulse{x.res.swallowed.length > 1 ? 's' : ''} did not reach an output. The narrowest was {ps(Math.min(...x.res.swallowed.map((s) => s.width)))} wide,
          removed by the {x.res.swallowed[0].mode} delay model.
        </p>
      ) : (
        <p className="pane-note">{events.length} events, and no pulse was removed by the delay model.</p>
      )}
    </div>
  )
}

/** What the engine declined, and why. A refusal is content, not a failure. */
export function Refusal({ refusal }) {
  return (
    <div className="refusal">
      <p className="refusal-code">{refusal.code}</p>
      <p>{refusal.message}</p>
    </div>
  )
}

const Empty = ({ children }) => <p className="pane-empty">{children}</p>
