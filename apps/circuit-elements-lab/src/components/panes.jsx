import React from 'react'
import { fmt } from '@ee-labs/ui'
import { Formula, agrees } from '@ee-labs/explain'
import { fmtCell } from '@ee-labs/network'
import { netPower } from '../math.js'

// The lower pane's views. Each takes the analysis from math.js `analyse` and
// shows one thing about it. None of them computes physics: every number here
// is read from a solve the engine already did, so the pane cannot disagree
// with the schematic.

const num = (v, unit, sig = 4) => (Number.isFinite(v) ? fmt(v, unit, sig) : v === Infinity ? '∞' : '—')
// A dimensionless ratio (ζ, Q): no SI prefix — "0.250", never "250 m".
const plain = (v, sig = 3) => (Number.isFinite(v) ? v.toPrecision(sig) : v === Infinity ? '∞' : '—')

/**
 * The system of equations the solver actually built: one KCL row per node
 * with each term's live value, then the constraints from sources and op-amps,
 * then the matrix. When a term's values are shown, the row visibly sums to
 * zero — that is KCL being true, not being asserted.
 */
export function EquationsPane({ eq, solved }) {
  return (
    <div className="equations" data-role="equations">
      {eq.rows.map((r, k) =>
        r.kind === 'kcl' ? (
          <div className="eq-row" key={k}>
            <div className="eq-at">
              KCL at <b>{r.node}</b>
            </div>
            <div className="eq-terms">
              {r.terms.map((t, j) => (
                <span className="eq-term" key={j}>
                  {/* Display-style fractions: inline-style ones shrink R and v to a squint. */}
                  <Formula display={false}>{'\\displaystyle ' + (t.sign < 0 ? '-\\,' : j ? '+\\,' : '') + t.latex}</Formula>
                  {solved ? <span className="eq-val">{num(t.sign < 0 ? -Math.abs(t.value) : t.value, 'A', 3)}</span> : null}
                </span>
              ))}
              <span className="eq-sum">
                = 0{solved && r.terms.length ? <> · sums to <b>{num(r.sum, 'A', 2)}</b></> : null}
              </span>
            </div>
          </div>
        ) : (
          <div className="eq-row" key={k}>
            <div className="eq-at">
              <b>{r.id}</b> sets
            </div>
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
      <div className="eq-matrix">
        <Formula>{eq.matrixLatex}</Formula>
        <p className="hint">
          {eq.unknowns.length} unknown{eq.unknowns.length === 1 ? '' : 's'}:{' '}
          {eq.unknowns.map((u) => (u.kind === 'v' ? `v_${u.node}` : `i_${u.id}`)).join(', ')}. Node voltages
          first, then one current for each element whose current Ohm’s law cannot give.
        </p>
      </div>
    </div>
  )
}

/** Power per element under the passive sign convention, and the sum. */
export function PowerPane({ sol }) {
  const ids = sol.sys.effs.map((e) => e.id)
  const max = Math.max(1e-30, ...ids.map((id) => Math.abs(sol.p[id])))
  return (
    <div className="power-list" data-role="power">
      {ids.map((id) => {
        const p = sol.p[id]
        const frac = Math.abs(p) / max
        return (
          <div className="power-row" key={id}>
            <span>{id}</span>
            <span className="bar" aria-hidden="true">
              <i
                className={p >= 0 ? 'absorbs' : 'delivers'}
                style={p >= 0 ? { left: '50%', width: `${frac * 50}%` } : { right: '50%', width: `${frac * 50}%` }}
              />
            </span>
            <span className="val">
              {num(p, 'W', 3)} <span className="prov">{p > 1e-15 ? 'absorbs' : p < -1e-15 ? 'delivers' : ''}</span>
            </span>
          </div>
        )
      })}
      <p className="power-total">
        Σ p over every element = <b>{num(netPower(sol), 'W', 2)}</b> — Tellegen’s theorem, from KVL and KCL alone. Delivering to
        the left, absorbing to the right.
      </p>
    </div>
  )
}

/** The Thévenin equivalent, three ways, with the agreement shown rather than claimed. */
export function TheveninPane({ th, port }) {
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
            <td>V_oc (Thévenin voltage)</td>
            <td className="num">{num(th.voc, 'V', 5)}</td>
          </tr>
          <tr>
            <td>I_sc (Norton current)</td>
            <td className="num">{num(th.isc, 'A', 5)}</td>
          </tr>
          <tr>
            <td>load line v = V_oc − R_th·i, fit intercept</td>
            <td className="num">{num(th.fitVoc, 'V', 5)}</td>
          </tr>
          <tr>
            <td>largest fit residual</td>
            <td className="num">{num(th.fitResidual, 'V', 2)}</td>
          </tr>
          {th.points.map((q) => (
            <tr key={q.R}>
              <td className="prov">loaded with {fmt(q.R, 'Ω', 3)}</td>
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
  const root = (r) => (r.im ? `${num(r.re, '', 4)} ${r.im > 0 ? '+' : '−'} j${num(Math.abs(r.im), '', 4)}` : num(r.re, '', 4))
  const rows =
    s.n === 1
      ? [['τ = −1/A₁₁', s.tau === Infinity ? '∞ (a pure integrator)' : num(s.tau, 's', 4)]]
      : [
          ['α (neper frequency)', num(s.alpha, 's⁻¹', 4)],
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
                <td className="num">{root(r)} s⁻¹</td>
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
              <th>state</th>
              <th>x(0⁻)</th>
              <th>x(t)</th>
              <th>ẋ(t)</th>
              <th>element law</th>
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
                  <td className="num">{num(now.dxdt[k], isC ? 'V/s' : 'A/s', 4)}</td>
                  <td className="num">
                    {isC ? `i_${q.id}/C` : `v_${q.id}/L`} = {num(law, isC ? 'V/s' : 'A/s', 4)}
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

/** The solver said no. The message is the lesson; show it whole. */
export function Refusal({ err }) {
  return (
    <div className="refusal" role="status" data-role="refusal" data-code={err.code}>
      <b>No solution — </b>
      {err.message}
    </div>
  )
}
