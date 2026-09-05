import React from 'react'
import { Formula, agrees } from '@ee-labs/explain'
import { cellLatex, fmtCell } from '@ee-labs/network'
import { num, scaleOf } from '../format.js'
import { HUE } from '../palette.js'

// The lower pane's views that are not canvases. Each takes the analysis from
// math.js `analyse` and shows one thing about it. None of them computes
// physics: every number here is read from a solve the engine already did, so a
// pane cannot disagree with the schematic.

// A KCL row's sum is zero up to the arithmetic; its terms are the scale that zero is judged against.
const rowScale = (r) => scaleOf(r.terms.map((t) => t.value))

const T = ({ children }) => <Formula display={false}>{children}</Formula>

const HOW = {
  V: (r) => 'a voltage source: fixes the voltage between its ends',
  C: (r) => 'a capacitor: holds its present voltage, so at this instant it acts as a voltage source',
  L: (r) => (r.type === 'V' ? 'an inductor at DC: a plain wire, so 0 V across it' : 'an inductor: keeps its present current'),
  SW: (r) => 'a closed switch: a wire, 0 V across it',
  OPAMP: (r) => (r.type === 'VCVS' ? 'an op-amp with finite gain: output = gain × (v₊ − v₋)' : 'an ideal op-amp: v₊ = v₋, its output current is whatever that takes'),
  VCVS: (r) => 'a controlled voltage source',
  // A diode's row says which region it is in: the whole of Group I is that
  // question, and "a voltage source" would hide the answer.
  D: (r) =>
    r.type === 'V'
      ? 'a conducting diode: holds its forward drop, so here it is a source of V_f'
      : r.type === 'GI'
        ? 'a conducting diode with a slope: V_f behind r_d, stamped as a conductance and a current'
        : 'a blocking diode: no path, bar the leak its model gives it',
  wire: (r) => 'a resistor of 0 Ω: a wire, 0 V across it',
}
const how = (r) => (r.wire ? HOW.wire(r) : (HOW[r.from] || HOW.V)(r))

/** The row label for a constraint: the element and what kind of thing it is. */
function ConstraintLabel({ row }) {
  return (
    <div className="eq-at">
      <b>{row.id}</b>
      <small>{how(row)}</small>
    </div>
  )
}

const SYMBOL_WHAT = {
  R: (s) => [`resistance of ${s.id}`, 'Ω'],
  switchR: (s) => [`resistance of the switch ${s.id} as it stands`, 'Ω'],
  E: (s) => [`the voltage the source ${s.id} holds`, 'V'],
  I: (s) => [`the current the source ${s.id} pushes`, 'A'],
  vC: (s) => [`the voltage on the capacitor ${s.id} at this instant`, 'V'],
  iL: (s) => [`the current in the inductor ${s.id} at this instant`, 'A'],
  A: (s) => [`gain of ${s.id}`, ''],
  g: (s) => [`transconductance of ${s.id}: output current per volt of input`, 'A/V'],
}

const unknownLatex = (u) => (u.kind === 'v' ? `v_{${u.node}}` : `i_{${u.id}}`)

/**
 * The system of equations the solver actually built, in three passes a reader
 * can follow: the rows in words and symbols with each term's live value, so a
 * KCL row visibly sums to zero; the same rows laid out as a matrix, with every
 * cell in letters and in numbers so it is plain where each entry came from;
 * and a legend tying each letter to a part on the schematic.
 */
export function EquationsPane({ eq, solved, fold = false, onHover = null }) {
  const { symbolic } = eq
  // Pointing at a row lights the node or element it is about on the schematic.
  const hover = (what) => (onHover ? { onMouseEnter: () => onHover(what), onMouseLeave: () => onHover(null) } : {})
  // Under a fold the three steps open on demand, and the fold's summary is what
  // the reader sees first.
  const Wrap = fold ? 'details' : 'div'
  return (
    <div className="equations" data-role="equations">
      <Wrap className={fold ? 'eq-fold' : 'eq-open'} data-role={fold ? 'eq-fold' : undefined}>
      {fold ? (
        <summary>
          The solver’s own working — {eq.rows.length} equation{eq.rows.length === 1 ? '' : 's'} in {eq.unknowns.length} unknown
          {eq.unknowns.length === 1 ? '' : 's'}, and the matrix they make
        </summary>
      ) : null}
      <p className="eq-step">
        <b>1 · The equations.</b> One KCL row per node; then one row for each element that fixes a voltage. The
        amber numbers are the live values.
      </p>
      {eq.rows.map((r, k) =>
        r.kind === 'kcl' ? (
          <div className="eq-row" key={k} data-node={r.node} {...hover({ node: r.node })}>
            <div className="eq-at">
              <span>KCL at</span>
              <b>{r.node}</b>
              <small>currents leaving node {r.node}</small>
            </div>
            <div className="eq-terms">
              {r.terms.map((t, j) => (
                <span className="eq-term" key={j}>
                  {/* Display-style fractions: inline-style ones shrink R and v to a squint. */}
                  <Formula display={false}>{'\\displaystyle ' + (t.sign < 0 ? '-\\,' : j ? '+\\,' : '') + t.latex}</Formula>
                  {/* t.value already carries the term's sign: it is what this term adds to the row. */}
                  {solved ? <span className="eq-val">{num(t.value, 'A', 3, rowScale(r))}</span> : null}
                </span>
              ))}
              <span className="eq-sum">
                = 0{solved && r.terms.length ? <> · adds to <b>{num(r.sum, 'A', 2, rowScale(r))}</b></> : null}
              </span>
            </div>
          </div>
        ) : (
          <div className="eq-row" key={k} data-el={r.id} {...hover({ el: r.id })}>
            <ConstraintLabel row={symbolic.rows.find((s) => s.kind === 'constraint' && s.id === r.id) || { id: r.id, from: 'V' }} />
            <div className="eq-terms">
              <span className="eq-term">
                <Formula display={false}>{'\\displaystyle ' + r.latex}</Formula>
                {solved && Number.isFinite(r.lhs) ? (
                  <span className="eq-val">
                    {num(r.lhs, 'V', 3)}
                    {Number.isFinite(r.rhs) ? ` = ${num(r.rhs, 'V', 3)}` : ''}
                  </span>
                ) : null}
              </span>
            </div>
          </div>
        ),
      )}

      <p className="eq-step">
        <b>2 · The same rows as a matrix.</b> Each row is one equation above; each column is one unknown. A cell holds
        whatever multiplies that unknown in that row — an unknown that does not appear gets a 0. The right-hand side
        holds what the sources set.
      </p>
      <div className="eq-matrix">
        {/* The scroll lives on a wrapper, not the grid item: a grid item that
            scrolls may shrink to nothing when the pane's height is fixed. */}
        <div className="eq-scroll">
          <table className="eq-grid">
            <thead>
              <tr>
                <th aria-label="equation" />
                {symbolic.cols.map((c, j) => (
                  <th key={j}>
                    <T>{c.latex}</T>
                  </th>
                ))}
                <th className="eq-rhs">= right side</th>
              </tr>
            </thead>
            <tbody>
              {symbolic.rows.map((row, i) => (
                <tr key={i}>
                  <th>
                    {row.kind === 'kcl' ? (
                      <>
                        KCL at <b>{row.node}</b>
                      </>
                    ) : (
                      <>
                        <b>{row.id}</b> holds
                      </>
                    )}
                  </th>
                  {symbolic.cells[i].map((terms, j) => (
                    <td key={j}>
                      <Cell terms={terms} value={eq.M[i][j]} />
                    </td>
                  ))}
                  <td className="eq-rhs">
                    <Cell terms={symbolic.rhs[i]} value={eq.r[i]} unit={row.kind === 'kcl' ? 'A' : 'V'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="eq-compact">
          <div>
            <span className="eq-caption">In letters — the reference designators alone:</span>
            <Formula>{eq.symbolicLatex}</Formula>
          </div>
          <div>
            <span className="eq-caption">With this circuit’s values, as the solver sees it:</span>
            <Formula>{eq.matrixLatex}</Formula>
          </div>
        </div>
        <p className="hint">
          The {eq.unknowns.length} unknown{eq.unknowns.length === 1 ? '' : 's'}, in column order:{' '}
          {eq.unknowns.map((u, k) => (
            <React.Fragment key={k}>
              {k ? ', ' : ''}
              <T>{unknownLatex(u)}</T>
            </React.Fragment>
          ))}
          . Every node voltage comes first, then one current for each element whose current Ohm’s law cannot give
          (a voltage source, a wire, an op-amp output).
        </p>
      </div>

      {symbolic.symbols.length ? (
        <>
          <p className="eq-step">
            <b>3 · What the letters are.</b> Each is a part on the schematic, with its present value.
          </p>
          <ul className="eq-legend">
            {symbolic.symbols.map((s) => {
              const [what, unit] = (SYMBOL_WHAT[s.what] || SYMBOL_WHAT.R)(s)
              return (
                <li key={s.latex}>
                  <T>{s.latex}</T>
                  <span className="eq-val">= {unit ? num(s.value, unit, 4) : plain(s.value, 4)}</span>
                  <span className="eq-what">{what}</span>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
      </Wrap>
    </div>
  )
}

/** One matrix cell: the letters, and the number they stand for beneath. */
function Cell({ terms, value, unit = null }) {
  const latex = cellLatex(terms)
  if (latex === '0') return <span className="eq-zero">0</span>
  // A bare ±1 from a current column is already a number; no need to say it twice.
  const trivial = terms.length === 1 && terms[0].latex === '1'
  return (
    <span className="eq-cell">
      <T>{latex}</T>
      {trivial ? null : <span className="eq-val">{unit ? num(value, unit, 3) : <T>{fmtCell(value)}</T>}</span>}
    </span>
  )
}

/** The reason the solver gave, where the plot would have been. */
export function Refusal({ err }) {
  return (
    <div className="refusal" role="status" data-role="refusal" data-code={err.code}>
      <b>No solution — </b>
      {err.message}
    </div>
  )
}

/**
 * Every meter on the circuit at once: each element's voltage from + to −, the
 * current in at its + end, and the power that product is. The schematic shows
 * one of these columns at a time and this is all three, read from the same
 * solve, so a reading here and a reading there are the same number.
 */
export function ReadingsPane({ x, elements, power = true }) {
  const sol = x.sol
  const nodes = Object.keys(sol.v).filter((n) => n !== 'gnd')
  // Each column's noise is judged against the largest reading in it, as the schematic's meters are.
  const scale = { volt: scaleOf(sol.volt), i: scaleOf(sol.i), p: scaleOf(sol.p), v: scaleOf(sol.v) }
  const cell = (q, key, unit) => (Number.isFinite(sol[q][key]) ? num(sol[q][key], unit, 3, scale[q]) : '—')
  return (
    <div className="readings" data-role="readings">
      <table className="table">
        <thead>
          <tr>
            <th>element</th>
            <th className="num">v (+ to −)</th>
            <th className="num">i (in at +)</th>
            {power ? <th className="num">p = v × i</th> : null}
          </tr>
        </thead>
        <tbody>
          {elements.map((e) => (
            <tr key={e.id}>
              <td>
                <b>{e.id}</b>
              </td>
              <td className="num">{cell('volt', e.id, 'V')}</td>
              <td className="num">{cell('i', e.id, 'A')}</td>
              {power ? <td className="num">{cell('p', e.id, 'W')}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Node voltages, against ground:{' '}
        {nodes.map((n, k) => (
          <React.Fragment key={n}>
            {k ? ', ' : ''}v_{n} <b>{cell('v', n, 'V')}</b>
          </React.Fragment>
        ))}
        .
      </p>
    </div>
  )
}
