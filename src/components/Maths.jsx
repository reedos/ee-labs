import React, { useMemo, useState } from 'react'
import katex from 'katex'

// The maths behind whatever is currently on screen.
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

function Row({ label, predicted, measured, unit = '', tol = 0.02, abs = 0, unchecked = null, mark = '' }) {
  const ok = agrees({ predicted, measured, tol, abs })
  const fmt = (v) =>
    !Number.isFinite(v)
      ? '—'
      : Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0)
        ? v.toExponential(3)
        : v.toFixed(4)
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{fmt(predicted)}</td>
      <td>{unchecked ? '—' : fmt(measured)}</td>
      {unchecked ? (
        <td className="unchecked" title={unchecked}>
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
    <table className="maths-values">
      <caption>from these settings</caption>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <th scope="row">{r.label}</th>
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
    <table className="maths-check">
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
      <ol className="maths-notes">
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
export default function Maths({ entry }) {
  const [open, setOpen] = useState(false)
  if (!entry) return null

  return (
    <div className={`maths ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="maths-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> The maths
      </button>
      {open && (
        <div className="maths-body">
          {entry.blocks.map((b, i) => {
            if (b.kind === 'text') return <p key={i}>{b.text}</p>
            if (b.kind === 'formula')
              return (
                <div key={i} className="maths-formula">
                  <Formula>{b.tex}</Formula>
                  {b.caption ? <p className="maths-caption">{b.caption}</p> : null}
                </div>
              )
            if (b.kind === 'check') return <Check key={i} rows={b.rows} />
            if (b.kind === 'values') return <Values key={i} rows={b.rows} />
            return null
          })}
        </div>
      )}
    </div>
  )
}
