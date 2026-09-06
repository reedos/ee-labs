import React from 'react'
import { Formula, agrees } from '@ee-labs/explain'
import { cellLatex, fmtCell } from '@ee-labs/network'
import { acTable, powerLedger } from '../math.js'
import { num, rate, rootRate, scaleOf } from '../format.js'
import { Term, DefCard } from './Prose.jsx'

// The lower pane's views. Each takes the analysis from math.js `analyse` and
// shows one thing about it. None of them computes physics: every number here
// is read from a solve the engine already did, so the pane cannot disagree
// with the schematic.

// A KCL row's sum is zero up to the arithmetic; its terms are the scale that zero is judged against.
const rowScale = (r) => scaleOf(r.terms.map((t) => t.value))
// A dimensionless ratio (ζ, Q): no SI prefix — "0.250", never "250 m".
const plain = (v, sig = 3) => (Number.isFinite(v) ? v.toPrecision(sig) : v === Infinity ? '∞' : '—')

const T = ({ children }) => <Formula display={false}>{children}</Formula>

/**
 * The two laws, said once in plain words before any row uses them. Group B
 * takes each apart in its own experiments; this is the primer Groups A and B
 * read above their equations, so "KCL at in" is never a name without a meaning.
 */
export function LawsPrimer() {
  return (
    <div className="eq-primer" data-role="primer">
      <p>
        <b>KVL and KCL produce every row below.</b>
      </p>
      <p>
        <b>KCL</b> — Kirchhoff’s current law. Charge cannot pile up at a junction, so at every node the currents{' '}
        <em>leaving</em> it add to zero: what flows in flows out. Each node gets one row.
      </p>
      <p>
        <b>KVL</b> — Kirchhoff’s voltage law. Around any closed loop the voltage rises and drops add to zero. Writing
        each element’s voltage as the difference of two node voltages, <T>{'v_a - v_b'}</T>, makes every loop add to
        zero automatically — so KVL is built into the rows rather than being one of them.
      </p>
      <p>
        <b>Ohm’s law</b> turns a resistor’s voltage into its current, <T>{'i = (v_a - v_b)/R'}</T>, which is how a
        resistor appears in a KCL row. A voltage source has no such law — its current is whatever the rest of the
        circuit demands — so its current becomes an unknown, and it gets a row of its own stating the voltage it
        holds.
      </p>
    </div>
  )
}

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
export function EquationsPane({ eq, solved, primer = false, fold = false, contradiction = [], onHover = null }) {
  const { symbolic } = eq
  // Pointing at a row lights the node or element it is about on the schematic.
  const hover = (what) => (onHover ? { onMouseEnter: () => onHover(what), onMouseLeave: () => onHover(null) } : {})
  // Under a fold the three steps open on demand; the fold's summary is what the
  // reader sees first — unless rows are marked as contradicting, which is the
  // one time the working is the point.
  const Wrap = fold ? 'details' : 'div'
  const open = fold && contradiction.length > 0 ? true : undefined
  return (
    <div className="equations" data-role="equations">
      {primer === 'ohm' ? <OhmLine /> : primer === 'brief' ? <PrimerLine /> : primer ? <LawsPrimer /> : null}
      <Wrap className={fold ? 'eq-fold' : 'eq-open'} data-role={fold ? 'eq-fold' : undefined} open={open}>
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
          <div className={contradiction.includes(r.id) ? 'eq-row is-contradiction' : 'eq-row'} key={k} data-el={r.id} {...hover({ el: r.id })}>
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

/**
 * A1's primer: Ohm's law, the one law its circuit needs, and where the row
 * names come from — the two laws themselves wait for Group B.
 */
export function OhmLine() {
  return (
    <p className="eq-primer eq-primer-line" data-role="primer">
      <b>Ohm’s law builds the resistor’s row:</b> its current is its voltage over its resistance, <T>{'i = v/R'}</T>. The
      source’s row states the voltage it holds. The row marked KCL is the junction rule — what flows into a node flows
      out — which Group B takes apart.
    </p>
  )
}

/** Group A's primer: the two laws in one line each, before Group B takes them apart. */
export function PrimerLine() {
  return (
    <p className="eq-primer eq-primer-line" data-role="primer">
      <b>KVL and KCL produce every row.</b> <b>KCL</b>: at every junction, what flows in flows out — one row per node.{' '}
      <b>KVL</b>: around any loop the rises and drops add to zero — built in by writing each voltage as a difference of
      two node voltages. Group B takes each apart.
    </p>
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

/**
 * Power, as a ledger. Each element's voltage (+ to −), the current flowing in
 * at its + end, and their product; the passive sign convention makes that
 * product positive for an element absorbing power and negative for one
 * delivering it. The two totals sit side by side and match, and the theorem
 * behind that is named and, on a tap, defined (student review: Tellegen's
 * theorem used to be an aside with nowhere to go).
 */
export function PowerPane({ sol, open = null, onOpen = () => {}, exp = null, choose = () => {} }) {
  const ledger = powerLedger(sol)
  const total = Math.max(ledger.delivered, ledger.absorbed, 1e-300)
  const WORD = { absorbs: 'absorbs', delivers: 'delivers', idle: '—' }
  return (
    <div className="power" data-role="power">
      <p className="eq-step">
        <b>p = v × i</b> for every element, with <i>v</i> measured from its + end to its − end and <i>i</i> the current
        flowing <em>in</em> at the + end (the passive sign convention). A positive product means the element takes
        power in; a negative one means it gives power out.
      </p>
      <table className="table power-table">
        <thead>
          <tr>
            <th>element</th>
            <th className="num">v (+ to −)</th>
            <th className="num">i (in at +)</th>
            <th className="num">p = v × i</th>
            <th>which means it</th>
          </tr>
        </thead>
        <tbody>
          {ledger.rows.map((r) => (
            <tr key={r.id} className={`is-${r.role}`}>
              <td>
                <b>{r.id}</b>
              </td>
              <td className="num">{num(r.v, 'V', 3)}</td>
              <td className="num">{num(r.i, 'A', 3)}</td>
              <td className="num">{num(r.p, 'W', 3)}</td>
              <td className="role">{WORD[r.role]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="power-bars">
        {['delivers', 'absorbs'].map((role) => {
          const rows = ledger.rows.filter((r) => r.role === role)
          const sum = role === 'delivers' ? ledger.delivered : ledger.absorbed
          return (
            <div className="power-bar" key={role}>
              <span className="power-bar-label">
                {role === 'delivers' ? 'delivered' : 'absorbed'} <b>{num(sum, 'W', 3)}</b>
              </span>
              <span className={`bar is-${role}`} aria-hidden="true">
                {rows.map((r) => (
                  <i key={r.id} style={{ width: `${(100 * Math.abs(r.p)) / total}%` }} title={`${r.id} ${num(Math.abs(r.p), 'W', 3)}`}>
                    <span>{r.id}</span>
                  </i>
                ))}
              </span>
            </div>
          )
        })}
      </div>
      <p className="power-total">
        Delivered <b>{num(ledger.delivered, 'W', 3)}</b> = absorbed <b>{num(ledger.absorbed, 'W', 3)}</b>
        {ledger.net === 0 ? ' — the two bars are the same length.' : ` (net ${num(ledger.net, 'W', 2, ledger.delivered)}).`} Every watt a
        source gives out is taken in somewhere else in the same circuit. That follows from KCL and KVL alone, with no
        element law needed.{' '}
        <Term id="tellegen" field="power" text="Tellegen’s theorem" open={open} onOpen={onOpen} /> is the name for it.
      </p>
      <DefCard open={open} field="power" exp={exp} onClose={() => onOpen(null)} choose={choose} />
    </div>
  )
}

/**
 * The Thévenin equivalent, three ways, with the agreement shown rather than
 * claimed. `named` false (C3, before D5 names the theorem) says what V_oc is
 * instead of whose it is.
 */
export function TheveninPane({ th, port, named = true }) {
  const rows = [
    ['V_oc / I_sc', th.rth.ratio],
    ['1 A test source, sources killed', th.rth.test],
    ['load-line fit (5 loads)', th.rth.fit],
  ]
  const ref = Number.isFinite(th.rth.test) ? th.rth.test : th.rth.ratio
  return (
    <div className="pane-grid two" data-role="thevenin">
      <table className="table">
        <caption>
          R_th seen at {port[0]}–{port[1]}
        </caption>
        <thead>
          <tr>
            <th>method</th>
            <th>R_th</th>
            <th aria-label="agreement" />
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, r]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className="num">{num(r, 'Ω', 5)}</td>
              <td className={agrees({ predicted: ref, measured: r, tol: 1e-6 }) ? 'agree' : 'disagree'}>
                {Number.isFinite(r) && Number.isFinite(ref) ? (agrees({ predicted: ref, measured: r, tol: 1e-6 }) ? '✓' : '✗') : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="table">
        <caption>the equivalent</caption>
        <tbody>
          <tr>
            <td>{named ? 'V_oc (Thévenin voltage)' : 'V_oc (the voltage with nothing connected)'}</td>
            <td className="num">{num(th.voc, 'V', 5)}</td>
          </tr>
          <tr>
            <td>{named ? 'I_sc (Norton current)' : 'I_sc (the current a short would draw)'}</td>
            <td className="num">{num(th.isc, 'A', 5)}</td>
          </tr>
          <tr>
            <td>load line v = V_oc − R_th·i, fit intercept</td>
            <td className="num">{num(th.fitVoc, 'V', 5)}</td>
          </tr>
          <tr>
            <td>largest fit residual</td>
            <td className="num">{num(th.fitResidual, 'V', 2, th.voc)}</td>
          </tr>
          {th.points.map((q) => (
            <tr key={q.R}>
              <td className="prov">loaded with {num(q.R, 'Ω', 3)}</td>
              <td className="num">
                {num(q.v, 'V', 4)}, {num(q.i, 'A', 4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Each source alone, the sum, and the full solve — voltages add, powers do not. */
export function SuperpositionPane({ sp }) {
  const nodes = Object.keys(sp.full.v).filter((n) => n !== 'gnd')
  const ids = Object.keys(sp.full.i)
  const cols = sp.parts.map((q) => q.id)
  return (
    <div className="pane-grid" data-role="superposition">
      <table className="table">
        <caption>node voltages — each source alone, then the sum, then everything on at once</caption>
        <thead>
          <tr>
            <th>node</th>
            {cols.map((c) => (
              <th key={c}>{c} alone</th>
            ))}
            <th>sum</th>
            <th>full</th>
            <th aria-label="agreement" />
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => (
            <tr key={n}>
              <td>{n}</td>
              {sp.parts.map((q) => (
                <td className="num" key={q.id}>
                  {num(q.sol.v[n], 'V', 4)}
                </td>
              ))}
              <td className="num">{num(sp.sumV[n], 'V', 4)}</td>
              <td className="num">{num(sp.full.v[n], 'V', 4)}</td>
              <td className={agrees({ predicted: sp.full.v[n], measured: sp.sumV[n], tol: 1e-9, abs: 1e-12 }) ? 'agree' : 'disagree'}>
                {agrees({ predicted: sp.full.v[n], measured: sp.sumV[n], tol: 1e-9, abs: 1e-12 }) ? '✓' : '✗'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="table">
        <caption>power — the parts do NOT add, and the gap is the cross term</caption>
        <thead>
          <tr>
            <th>element</th>
            {cols.map((c) => (
              <th key={c}>{c} alone</th>
            ))}
            <th>sum of parts</th>
            <th>full</th>
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => (
            <tr key={id}>
              <td>{id}</td>
              {sp.parts.map((q) => (
                <td className="num" key={q.id}>
                  {num(q.sol.p[id], 'W', 3)}
                </td>
              ))}
              <td className="num">{num(sp.sumP[id], 'W', 3)}</td>
              <td className="num">{num(sp.full.p[id], 'W', 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const FACE_WORDS = {
  overdamped: 'overdamped — two real roots, no overshoot',
  critical: 'critically damped — one repeated real root',
  underdamped: 'underdamped — a complex pair, it rings',
  undamped: 'undamped — roots on the axis, it rings forever',
}

/**
 * The state equation the propagator integrates: ẋ = A x + B u with the
 * matrices the engine actually built from this circuit, its characteristic
 * polynomial and roots, and the state just before t = 0. The last table reads
 * each state's derivative at the cursor from the exact solution and checks it
 * against the element law (C·dv/dt is the capacitor's current, L·di/dt the
 * inductor's voltage) — the differential equation being true at this instant,
 * not being asserted.
 */
export function StatePane({ x }) {
  const { state: s, before, now, dyn } = x
  const xSym = s.states.map((q) => (q.type === 'C' ? `v_{${q.id}}` : `i_{${q.id}}`))
  const uSym = s.inputs.map((id) => (dyn.norm.elements.find((e) => e.id === id)?.type === 'I' ? `I_{${id}}` : `V_{${id}}`))
  const col = (items) => `\\begin{bmatrix} ${items.join(' \\\\ ')} \\end{bmatrix}`
  const mat = (M) => `\\begin{bmatrix} ${M.map((row) => row.map(fmtCell).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`
  const dot = (sym) => `\\dot{${sym}}`
  const eq = `${col(xSym.map(dot))} = ${mat(s.A)} ${col(xSym)} ${s.inputs.length ? `+ ${mat(s.B)} ${col(uSym)}` : ''}`
  const charEq =
    s.n === 1
      ? `\\det(sI - A) = s ${s.poly[1] >= 0 ? '+' : '-'} ${fmtCell(Math.abs(s.poly[1]))}`
      : `\\det(sI - A) = s^2 ${s.poly[1] >= 0 ? '+' : '-'} ${fmtCell(Math.abs(s.poly[1]))}\\,s ${s.poly[2] >= 0 ? '+' : '-'} ${fmtCell(Math.abs(s.poly[2]))}`
  const rows =
    s.n === 1
      ? [['τ = −1/A₁₁', s.tau === Infinity ? '∞ (a pure integrator)' : num(s.tau, 's', 4)]]
      : [
          ['α (neper frequency)', rate(s.alpha, 's⁻¹', 4)],
          ['ω₀ (undamped natural)', num(s.w0, 'rad/s', 4)],
          ['ζ = α/ω₀', plain(s.zeta)],
          ['Q = ω₀/2α', plain(s.Q)],
          ['ω_d = √(ω₀² − α²)', num(s.wd, 'rad/s', 4)],
          ['face', FACE_WORDS[s.face] || s.face],
        ]
  return (
    <div className="state" data-role="state" data-face={s.face || (s.n === 1 ? 'first-order' : '')}>
      <div className="eq-matrix">
        <Formula>{eq}</Formula>
        <p className="hint">
          {s.n} state{s.n === 1 ? '' : 's'}: {xSym.map((q) => q.replace(/[{}]/g, '')).join(', ')} — a voltage for each capacitor, a
          current for each inductor. The resistive network in between gives A and B; the exact solution is x(t) = e^At x(0) plus the
          driven part.
        </p>
        <Formula>{charEq}</Formula>
      </div>
      <div className="pane-grid two">
        <table className="table">
          <caption>{s.n === 1 ? 'the root and the time constant' : 'the roots and the damping'}</caption>
          <tbody>
            {s.roots.map((r, k) => (
              <tr key={k}>
                <td>
                  root s{s.n > 1 ? <sub>{k + 1}</sub> : null}
                </td>
                <td className="num">{rootRate(r.re, r.im, 4)}</td>
              </tr>
            ))}
            {rows.map(([label, v]) => (
              <tr key={label}>
                <td>{label}</td>
                <td className="num">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="table">
          <caption>at the cursor, t = {num(x.cursor, 's', 3)}</caption>
          <thead>
            <tr>
              {/* The numeric heads carry `num` so they right-align over their
                  own column. Without it the general `.table th` rule leaves
                  them left while `.table td.num` right-aligns the values, and
                  the head sits visibly off its column — the wider the number,
                  the further off. The CSS for `.table th.num` was already
                  there; the heads just never asked for it. */}
              <th>state</th>
              <th className="num">x(0⁻)</th>
              <th className="num">x(t)</th>
              <th className="num">ẋ(t)</th>
              <th className="num">element law</th>
              <th aria-label="agreement" />
            </tr>
          </thead>
          <tbody>
            {s.states.map((q, k) => {
              const isC = q.type === 'C'
              const law = isC ? now.sol.i[q.id] / q.value : now.sol.volt[q.id] / q.value
              const ok = agrees({ predicted: law, measured: now.dxdt[k], tol: 1e-6, abs: 1e-12 })
              return (
                <tr key={q.id}>
                  <td>
                    {isC ? 'v' : 'i'}
                    <sub>{q.id}</sub>
                  </td>
                  <td className="num">{num(before.x0[k], isC ? 'V' : 'A', 4)}</td>
                  <td className="num">{num(now.x[k], isC ? 'V' : 'A', 4)}</td>
                  <td className="num">{rate(now.dxdt[k], isC ? 'V/s' : 'A/s', 4)}</td>
                  <td className="num">
                    {isC ? `i_${q.id}/C` : `v_${q.id}/L`} = {rate(law, isC ? 'V/s' : 'A/s', 4)}
                  </td>
                  <td className={ok ? 'agree' : 'disagree'}>{ok ? '✓' : '✗'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">
        x(0⁻) is the DC picture before the step — switches in their <i>before</i> position, sources at their pre-step values,
        capacitors open and inductors shorted
        {before.assumed.length ? `; ${before.assumed.join(', ')} had no DC path and is taken as uncharged` : ''}. A state cannot
        jump, so x(0⁺) = x(0⁻); everything else may.
      </p>
    </div>
  )
}

/**
 * AC power per element from the phasors: S = ½·V·I* under the passive sign
 * convention, so P is the time-average of v·i (the resistor's heat), Q the
 * amplitude of the power that only sloshes (the reactive element's), and the
 * source's row comes out negative as its DC meter does. Both sums are zero —
 * Tellegen's theorem holds for complex power too, and the last row shows it.
 */
export function AcPowerPane({ x }) {
  const rows = acTable(x)
  const sumP = rows.reduce((a, r) => a + r.P, 0)
  const sumQ = rows.reduce((a, r) => a + r.Q, 0)
  const scale = Math.max(1e-30, ...rows.map((r) => r.apparent))
  const okP = Math.abs(sumP) <= 1e-12 * scale
  const okQ = Math.abs(sumQ) <= 1e-12 * scale
  // Wrapped to ±180°, and "−0.0°" (a resistor's φ from the rounding side of zero) reads as 0.0°.
  const deg = (a) => `${((Math.atan2(Math.sin(a), Math.cos(a)) * 180) / Math.PI).toFixed(1).replace(/^-0\.0$/, '0.0')}°`
  return (
    <div className="acpower" data-role="acpower">
      <div className="table-scroll">
      <table className="table">
        <caption>steady state at {num(x.omega / (2 * Math.PI), 'Hz', 4)} — peak phasors, S = ½·V·I*</caption>
        <thead>
          <tr>
            <th>element</th>
            <th>|V|</th>
            <th>|I|</th>
            <th>φ = ∠V − ∠I</th>
            <th>P</th>
            <th>Q</th>
            <th>|S|</th>
            <th>pf</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td className="num">{num(r.V, 'V', 4)}</td>
              <td className="num">{num(r.I, 'A', 4)}</td>
              <td className="num">{deg(r.phi)}</td>
              <td className="num">{num(r.P, 'W', 4)}</td>
              <td className="num">{num(r.Q, 'var', 4)}</td>
              <td className="num">{num(r.apparent, 'VA', 4)}</td>
              <td className="num">{plain(Math.abs(r.pf))}{r.type === 'V' ? '' : r.Q > 1e-15 * scale ? ' lag' : r.Q < -1e-15 * scale ? ' lead' : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Σ over every element</td>
            <td />
            <td />
            <td />
            <td className={`num ${okP ? 'agree' : 'disagree'}`}>{okP ? '0 W' : num(sumP, 'W', 2)}</td>
            <td className={`num ${okQ ? 'agree' : 'disagree'}`}>{okQ ? '0 var' : num(sumQ, 'var', 2)}</td>
            <td />
            <td />
          </tr>
        </tfoot>
      </table>
      </div>
      <p className="hint">
        Peak values throughout; RMS is peak/√2 and P = V_rms·I_rms·cos φ is the same number. P is what a wattmeter averages,
        Q the to-and-fro that heats nothing but still has to be carried, |S| = √(P² + Q²) what the wires see. A positive Q
        (current lagging) is an inductor’s; a capacitor’s is negative.
      </p>
    </div>
  )
}

/** The solver said no. The message is the lesson; show it whole. */
/**
 * Assume, solve, check — every combination on screen, with the contradiction
 * that killed each one in its own words (I3).
 *
 * The point of showing all four rather than the answer is that this IS the
 * method: a student who can say why "both conducting" is impossible has
 * learned something a single correct number would not have taught them.
 */
export function AssumedPane({ tried, devices, regions }) {
  if (!tried || !tried.length) return null
  const name = (r) => devices.map((d) => `${d.id} ${r[d.id] === 'on' ? 'on' : r[d.id] === 'zener' ? 'in breakdown' : 'off'}`).join(', ')
  const isAnswer = (r) => devices.every((d) => r[d.id] === regions[d.id])
  return (
    <div className="assumed" data-role="assumed">
      <p className="hint">
        Each row assumes a state for every diode, solves the linear circuit that assumption describes, and then checks the assumption against
        its own answer. Exactly one survives.
      </p>
      <ol className="assumed-list">
        {tried.map((row, k) => (
          <li key={k} className={isAnswer(row.regions) ? 'is-answer' : 'is-rejected'} data-role="assumed-row">
            <div className="assumed-head">
              <span className="assumed-state">{name(row.regions)}</span>
              <span className="assumed-verdict">{isAnswer(row.regions) ? 'consistent' : 'contradicts itself'}</span>
            </div>
            {isAnswer(row.regions) ? (
              <ul className="assumed-checks">
                {row.checks.map((c, j) => (
                  <li key={j}>
                    {c.says} <b>✓</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="assumed-why">{row.why}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function Refusal({ err }) {
  return (
    <div className="refusal" role="status" data-role="refusal" data-code={err.code}>
      <b>No solution — </b>
      {err.message}
    </div>
  )
}
