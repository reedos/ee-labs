import React from 'react'
import { fmt } from '@ee-labs/ui'
import { Formula, agrees } from '@ee-labs/explain'

// The lower pane's views. Each takes the analysis from math.js `analyse` and
// shows one thing about it. None of them computes physics: every number here
// is read from a solve the engine already did, so the pane cannot disagree
// with the schematic.

const num = (v, unit, sig = 4) => (Number.isFinite(v) ? fmt(v, unit, sig) : v === Infinity ? '∞' : '—')

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
                  <Formula display={false}>{(t.sign < 0 ? '-\\,' : j ? '+\\,' : '') + t.latex}</Formula>
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
                <Formula display={false}>{r.latex}</Formula>
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
        Σ p over every element = <b>{num(sol.pTotal, 'W', 2)}</b> — Tellegen’s theorem, from KVL and KCL alone. Delivering to
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

/** The solver said no. The message is the lesson; show it whole. */
export function Refusal({ err }) {
  return (
    <div className="refusal" role="status" data-role="refusal" data-code={err.code}>
      <b>No solution — </b>
      {err.message}
    </div>
  )
}
