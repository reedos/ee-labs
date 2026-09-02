import React, { useMemo, useState } from 'react'
import katex from 'katex'

// The math behind whatever is currently on screen.
//
// Two halves, and the second is the point. A formula alone is something to take
// on trust; a formula next to the number this tool just measured is something
// you can check. So each entry may carry rows of predicted-versus-measured, and
// they are computed from the live state rather than written down — if a claim
// stops holding, the panel says so instead of continuing to assert it.

function tex(src, display) {
  try {
    return katex.renderToString(src, {
      displayMode: !!display,
      throwOnError: false,
      output: 'html',
    })
  } catch {
    return null
  }
}

/** A block-level formula. */
export function Formula({ children, display = true }) {
  const html = useMemo(() => tex(children, display), [children, display])
  if (!html) return <code>{children}</code>
  return <span className="tex" dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * One predicted/measured pair.
 *
 * Judged on a relative tolerance, so it stays meaningful whether the quantity is
 * 1.27 or 4e-5, plus an optional absolute floor — a row that predicts exactly
 * zero has no relative scale to be judged against.
 */
export function agrees({ predicted, measured, tol = 0.02, abs = 0 }) {
  if (!Number.isFinite(predicted) || !Number.isFinite(measured)) return false
  const slack = Math.max(tol * Math.abs(predicted), abs)
  return Math.abs(measured - predicted) <= slack
}

/**
 * A row's name, set as mathematics when the caller supplies TeX for it. The
 * label stays the plain-text one either way: it is what the tests report and
 * what a reader gets if KaTeX fails to parse.
 */
function RowName({ label, tex }) {
  return tex ? <Formula display={false}>{tex}</Formula> : label
}

function Row({ label, tex = null, predicted, measured, unit = '', tol = 0.02, abs = 0, unchecked = null, mark = '' }) {
  // A missing measurement is not a failed comparison. Without this, a value the
  // current settings never produced renders as a cross against correct physics.
  const why = unchecked || (Number.isFinite(measured) ? null : 'Not measurable with these settings.')
  const ok = agrees({ predicted, measured, tol, abs })
  const fmt = (v) =>
    !Number.isFinite(v)
      ? '—'
      : Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0)
        ? v.toExponential(3)
        : v.toFixed(4)
  return (
    <tr>
      <th scope="row"><RowName label={label} tex={tex} /></th>
      <td>{fmt(predicted)}</td>
      <td>{why ? '—' : fmt(measured)}</td>
      {why ? (
        <td className="unchecked" title={why}>
          {mark}
        </td>
      ) : (
        <td className={ok ? 'agree' : 'disagree'}>{ok ? '✓' : '✗'}</td>
      )}
      <td className="unit">{unit}</td>
    </tr>
  )
}

/**
 * Quantities worked out from the current settings.
 *
 * One column, no tick. These are not comparisons, and marking them correct
 * would be marking 1 = 1 correct.
 */
export function Values({ rows }) {
  if (!rows || !rows.length) return null
  const fmt = (v) =>
    !Number.isFinite(v)
      ? '—'
      : Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0)
        ? v.toExponential(3)
        : Number(v.toFixed(4)).toString()
  return (
    <table className="math-values">
      <caption>from these settings</caption>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <th scope="row"><RowName label={r.label} tex={r.tex} /></th>
            <td>{fmt(r.value)}</td>
            <td className="unit">{r.unit || ''}</td>
            <td className="unit">{r.note || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Check({ rows }) {
  if (!rows || !rows.length) return null
  // A row the current settings make unmeasurable is footnoted rather than
  // marked wrong. The theory has not stopped holding; this frame just cannot
  // see it, and saying so is more use than a cross.
  const notes = []
  for (const r of rows) {
    if (r.unchecked && !notes.includes(r.unchecked)) notes.push(r.unchecked)
  }
  const marked = rows.map((r) =>
    r.unchecked ? { ...r, mark: `[${notes.indexOf(r.unchecked) + 1}]` } : r,
  )
  return (
    <>
    <table className="math-check">
      <thead>
        <tr>
          <th scope="col">quantity</th>
          <th scope="col">theory</th>
          <th scope="col">measured</th>
          <th scope="col" aria-label="agreement" />
          <th scope="col" />
        </tr>
      </thead>
      <tbody>
        {marked.map((r, i) => (
          <Row key={i} {...r} />
        ))}
      </tbody>
    </table>
    {notes.length ? (
      <ol className="math-notes">
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ol>
    ) : null}
    </>
  )
}

/**
 * The collapsible panel under a preset's note.
 *
 * Collapsed by default: someone who just wants to drag a slider should not have
 * to scroll past a derivation to reach it, and someone who wants the derivation
 * knows to open it.
 */
export default function MathPanel({ entry, getEntry, label = 'The math' }) {
  const [open, setOpen] = useState(false)
  // Built only once opened. A block's panel measures its own impulse response
  // to check itself, which is not work worth doing on every keystroke for a
  // panel nobody has looked at.
  const built = useMemo(() => (open ? entry || (getEntry && getEntry()) : null), [open, entry, getEntry])
  if (!entry && !getEntry) return null

  return (
    <div className={`math ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="math-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> {label}
      </button>
      {open && built && <MathBody entry={built} />}
    </div>
  )
}

/**
 * The panel's content without the fold: the blocks of an entry, rendered.
 * For a lab that gives the math a pane of its own rather than a toggle under
 * the note (Power Lab), where hiding it behind a click is the thing to avoid.
 */
export function MathBody({ entry }) {
  if (!entry) return null
  return (
    <div className="math-body">
      {entry.blocks.map((b, i) => {
        if (b.kind === 'text') return <p key={i}>{b.text}</p>
        if (b.kind === 'formula')
          return (
            <div key={i} className="math-formula">
              <Formula>{b.tex}</Formula>
              {b.caption ? <p className="math-caption">{b.caption}</p> : null}
            </div>
          )
        if (b.kind === 'check') return <Check key={i} rows={b.rows} />
        if (b.kind === 'values') return <Values key={i} rows={b.rows} />
        return null
      })}
    </div>
  )
}
