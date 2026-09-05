import React from 'react'
import { fmt, fmtNum } from '@ee-labs/ui'

// The readouts.
//
// One rule, and it is the rule of this lab. `Closed` prints a formula as a bare
// number. `Estimate` prints a measurement with its interval, always, and there
// is no way to render an estimate without one. That is what keeps the guard on
// the screen rather than in a comment.

/** A closed form. No interval, no hedge (CORE_SCOPE counter-rule). */
export function Closed({ label, value, unit = '', sig = 4, note = null }) {
  return (
    <div className="readout closed">
      <span className="label">{label}</span>
      <span className="value">{unit ? fmt(value, unit, sig) : fmtNum(value, sig)}</span>
      {note ? <span className="note">{note}</span> : null}
    </div>
  )
}

/**
 * A measurement. The interval is not optional, and a caller that passes
 * something without `ci` gets a visible failure rather than a tidy number.
 */
export function Estimate({ label, est, unit = '', sig = 4, scale = 1 }) {
  if (!est || !est.ci) {
    return (
      <div className="readout estimate bad">
        <span className="label">{label}</span>
        <span className="value">no interval</span>
      </div>
    )
  }
  const half = ((est.ci[1] - est.ci[0]) / 2) * scale
  return (
    <div className="readout estimate">
      <span className="label">{label}</span>
      <span className="value">
        {unit ? fmt(est.value * scale, unit, sig) : fmtNum(est.value * scale, sig)}
        <span className="pm"> ± {unit ? fmt(half, unit, 2) : fmtNum(half, 2)}</span>
      </span>
      <span className="note">
        {(est.level * 100).toFixed(0)} % interval, n = {est.n}
      </span>
    </div>
  )
}

/** A ratio between a measurement and a closed form, with the gap named. */
export function Against({ label, measured, predicted, sig = 4, unit = '' }) {
  const ratio = predicted === 0 ? NaN : measured / predicted
  return (
    <div className="readout against">
      <span className="label">{label}</span>
      <span className="value">
        {unit ? fmt(measured, unit, sig) : fmtNum(measured, sig)}
        <span className="pm"> against {unit ? fmt(predicted, unit, sig) : fmtNum(predicted, sig)}</span>
      </span>
      <span className="note">{Number.isFinite(ratio) ? `${((ratio - 1) * 100).toFixed(2)} % apart` : 'no comparison'}</span>
    </div>
  )
}

/** A group of readouts under one heading. */
export function Pane({ title, children }) {
  return (
    <section className="pane">
      <h3>{title}</h3>
      <div className="readouts">{children}</div>
    </section>
  )
}

/** Terms used here, folded, exactly as the other labs deliver them. */
export function Terms({ terms }) {
  if (!terms.length) return null
  return (
    <details className="terms">
      <summary>Terms used here</summary>
      <dl>
        {terms.map((t) => (
          <React.Fragment key={t.id}>
            <dt>{t.name}</dt>
            <dd>{t.def}</dd>
          </React.Fragment>
        ))}
      </dl>
    </details>
  )
}
