import React from 'react'
import { fmt, fmtNum } from '@ee-labs/ui'

// The readouts.
//
// One rule, and it is the rule of this lab. `Closed` prints a formula as a bare
// number. `Counted` prints a measured rate with its interval and the error count
// behind it, and there is no way to render one without them. `Against` puts the
// two beside each other and names which is which.

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
 * A counted rate. The interval is not optional, and a caller that passes
 * something without one gets a visible failure rather than a tidy number.
 *
 * Below the hollow threshold the value is replaced by the interval, because at
 * that count the interval spans a factor of two and the point estimate is not
 * the reading.
 */
export function Counted({ label, est, sig = 4 }) {
  if (!est || !est.ci) {
    return (
      <div className="readout counted bad">
        <span className="label">{label}</span>
        <span className="value">no interval</span>
      </div>
    )
  }
  const half = (est.ci[1] - est.ci[0]) / 2
  return (
    <div className={`readout counted${est.hollow ? ' hollow' : ''}`}>
      <span className="label">{label}</span>
      <span className="value">
        {est.hollow ? (
          `${fmtNum(est.ci[0], 2)} to ${fmtNum(est.ci[1], 2)}`
        ) : (
          <>
            {fmtNum(est.value, sig)}
            <span className="pm"> ± {fmtNum(half, 2)}</span>
          </>
        )}
      </span>
      <span className="note">
        {est.errors} error{est.errors === 1 ? '' : 's'} in {est.bits} bits,{' '}
        {(est.level * 100).toFixed(0)} % interval
        {est.hollow ? ', too few to read a value' : ''}
      </span>
    </div>
  )
}

/** A closed form and a count side by side, with the gap between them named. */
export function Against({ label, measured, predicted, sig = 4, unit = '' }) {
  const ratio = predicted === 0 ? NaN : measured / predicted
  return (
    <div className="readout against">
      <span className="label">{label}</span>
      <span className="value">
        {unit ? fmt(measured, unit, sig) : fmtNum(measured, sig)}
        <span className="pm"> against {unit ? fmt(predicted, unit, sig) : fmtNum(predicted, sig)}</span>
      </span>
      <span className="note">
        {Number.isFinite(ratio) ? `${((ratio - 1) * 100).toFixed(2)} % apart` : 'no comparison'}
      </span>
    </div>
  )
}

/** A model's assumptions, printed with its numbers rather than beside them. */
export function Assumptions({ title, items }) {
  return (
    <div className="assumptions">
      <h4>{title}</h4>
      <ul>
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
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
