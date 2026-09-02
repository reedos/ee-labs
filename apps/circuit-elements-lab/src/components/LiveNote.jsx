import React from 'react'
import { liveSee, provenance } from '../live.js'

/**
 * The lesson's note with its numbers alive: each one re-reads the current
 * solution, keeping the author's words while they still stand and reprinting
 * (marked) when they do not. Under it, once a knob has moved, one line says
 * so — and warns when the settings have left the regime the note was written
 * in. `children` are appended inside the paragraph (the term chips).
 */
export default function LiveNote({ exp, x, params, pristine, children, dfn }) {
  const segs = liveSee(exp, x, params)
  const prov = provenance(exp, x, pristine)
  return (
    <p className="hint see" data-role="note" data-pristine={pristine}>
      {segs.map((s, i) =>
        !s.live ? (
          dfn ? dfn(s, i) : s.text
        ) : (
          <b className="live" key={i} data-key={s.key} data-changed={s.changed}>
            {s.text}
          </b>
        ),
      )}
      {prov ? <em className="prov"> {prov}</em> : null}
      {children}
    </p>
  )
}
