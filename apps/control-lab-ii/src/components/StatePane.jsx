import React from 'react'
import { fmtNum } from '@ee-labs/ui'

/**
 * The state, written out. Group A's own pane.
 *
 * A state space is four matrices and the whole of Group A is about reading
 * them, so this pane prints them rather than plotting anything. Each row of A
 * is one state's derivative, and each state carries its name and its unit,
 * because "position" and "speed" are easier to reason about than x₁ and x₂.
 * That naming is the reason the plan makes the motor the reference plant.
 */
const Matrix = ({ rows, label }) => (
  <div className="matrix">
    <span className="matrix-label">{label}</span>
    <table>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((v, j) => (
              <td key={j}>{fmtNum(v, 4)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export default function StatePane({ ss, states, ctrl, obs, place, lqr, observer, declined }) {
  return (
    <div className="state-pane">
      <div className="state-names">
        {states.map((s, i) => (
          <div key={i} className="state-name">
            <b>{s.symbol}</b> {s.name}
            {s.unit ? <span className="unit"> ({s.unit})</span> : null}
          </div>
        ))}
      </div>

      <div className="matrices">
        <Matrix rows={ss.A} label="A" />
        <Matrix rows={ss.B.map((v) => [v])} label="B" />
        <Matrix rows={[ss.C]} label="C" />
        <Matrix rows={[[ss.D]]} label="D" />
      </div>

      <dl className="readouts">
        <dt>Controllability rank</dt>
        <dd>
          {ctrl.rank} of {ctrl.n}
          <span className="aside"> condition {Number.isFinite(ctrl.condition) ? fmtNum(ctrl.condition, 4) : '∞'}</span>
        </dd>
        <dt>Observability rank</dt>
        <dd>
          {obs.rank} of {obs.n}
          <span className="aside"> condition {Number.isFinite(obs.condition) ? fmtNum(obs.condition, 4) : '∞'}</span>
        </dd>
        {place ? (
          <>
            <dt>Feedback gain K</dt>
            <dd>[{place.K.map((v) => fmtNum(v, 5)).join(', ')}]</dd>
          </>
        ) : null}
        {lqr ? (
          <>
            <dt>Optimal gain K</dt>
            <dd>
              [{lqr.K.map((v) => fmtNum(v, 5)).join(', ')}]
              {/* The residual is never optional. A gain whose residual is not
                  small is not the optimal gain. */}
              <span className="aside"> Riccati residual {lqr.relResidual.toExponential(1)}</span>
            </dd>
          </>
        ) : null}
        {observer ? (
          <>
            <dt>Observer gain L</dt>
            <dd>[{observer.L.map((v) => fmtNum(v, 5)).join(', ')}]</dd>
          </>
        ) : null}
      </dl>

      {declined ? (
        <p className="declined" role="status">
          {declined.message}
        </p>
      ) : null}
    </div>
  )
}
