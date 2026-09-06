import React from 'react'
import { TERMS } from '../terms.js'

/** The first sentence of a definition — a compact hover hint for the mark itself. */
const gist = (def) => def.split(/(?<=\.)\s/)[0]

/**
 * Note text with its first-use terms marked (student review, item 3): a
 * tappable word, rather than a definition reachable only from a small link
 * after the whole note. `marks` is the output of noteMarks.js's markTerms —
 * `[{ id, start, end }]`, in reading order, already non-overlapping.
 *
 * No `role="button"`, deliberately: a marked word is a few characters INSIDE
 * a running sentence, and WCAG 2.5.8's own Target Size rule exempts exactly
 * this case ("inline: the target ... is otherwise constrained by the
 * line-height of non-target text"). Carrying the button role would also
 * enter it into this app's OWN 44px touch-target probe (verify.mjs item 34,
 * packages/ui's tapTargetProbe — SELECTOR includes `[role="button"]`), which
 * an inline word can never clear without inflating every line of prose that
 * uses one. tabIndex plus the keydown handler below still make it reachable
 * and operable from a keyboard; a tap or a click already works on any
 * element regardless of role.
 */
export function MarkedNote({ text, marks, open, onOpen }) {
  if (!marks.length) return text
  const out = []
  let at = 0
  marks.forEach((m, i) => {
    if (m.start > at) out.push(text.slice(at, m.start))
    const isOpen = open === m.id
    out.push(
      <dfn
        key={i}
        className="term"
        data-term={m.id}
        tabIndex={0}
        aria-expanded={isOpen}
        title={gist(TERMS[m.id].def)}
        onClick={() => onOpen(isOpen ? null : m.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen(isOpen ? null : m.id)
          }
        }}
      >
        {text.slice(m.start, m.end)}
      </dfn>,
    )
    at = m.end
  })
  if (at < text.length) out.push(text.slice(at))
  return out
}

/**
 * The definition of whichever marked term was tapped, opened right under
 * the note that used it — not two folds away. Closed by its own × or by
 * tapping the same word again (MarkedNote's onClick toggles).
 */
export function NoteDefCard({ openId, onClose }) {
  const t = openId ? TERMS[openId] : null
  if (!t) return null
  return (
    <aside className="def-card" data-role="def" data-term={openId} aria-live="polite">
      <div className="def-head">
        <b>{t.name}</b>
        <button type="button" className="def-close" aria-label="Close the definition" onClick={onClose}>
          ×
        </button>
      </div>
      <p>{t.def}</p>
    </aside>
  )
}
