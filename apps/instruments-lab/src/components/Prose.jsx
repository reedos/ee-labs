import React from 'react'
import { TERMS } from '../terms.js'
import { introducedIn } from '../glossary.js'

/**
 * Prose with its terms marked where they first do work (student review,
 * Phase 6). A marked word is a <dfn> the student can tap; the definition
 * opens in a card right under the paragraph that used it, not in a fold
 * somewhere else. `marks` are [{ start, end, id }] in offsets of the whole
 * field; `base` is where this slice of the field starts (the live note hands
 * its plain slices over one at a time).
 */
export function Marked({ text, base = 0, marks = [], field, open, onOpen }) {
  const end = base + text.length
  const here = marks.filter((m) => m.start < end && m.end > base).map((m) => ({ ...m, start: Math.max(m.start, base) - base, end: Math.min(m.end, end) - base }))
  if (!here.length) return text
  const out = []
  let at = 0
  here.forEach((m, i) => {
    if (m.start > at) out.push(text.slice(at, m.start))
    out.push(<Term key={i} id={m.id} field={field} open={open} onOpen={onOpen} text={text.slice(m.start, m.end)} />)
    at = m.end
  })
  if (at < text.length) out.push(text.slice(at))
  return out
}

/** The first sentence of a definition — what the desktop hover shows. */
const gist = (def) => def.split(/(?<=\.)\s/)[0]
/** A term's short name for a chip: "KCL (Kirchhoff’s current law)" → "KCL". */
const short = (name) => name.replace(/\s*\(.*\)$/, '')

/** One marked term: a tappable word that opens (or closes) its card. */
export function Term({ id, field, text, open, onOpen }) {
  const t = TERMS[id]
  if (!t) return text
  const isOpen = open && open.id === id && open.field === field
  const toggle = () => onOpen(isOpen ? null : { id, field })
  return (
    <dfn
      className="term"
      data-term={id}
      role="button"
      tabIndex={0}
      aria-expanded={!!isOpen}
      title={gist(t.def)}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggle()
        }
      }}
    >
      {text}
    </dfn>
  )
}

/**
 * The definition, opened under the paragraph that used the word, with a way
 * back to the experiment that introduced it when that was an earlier one.
 */
export function DefCard({ open, field, exp, onClose, choose }) {
  if (!open || open.field !== field) return null
  const t = TERMS[open.id]
  if (!t) return null
  const intro = introducedIn(open.id)
  const earlier = intro && intro !== exp ? intro : null
  return (
    <aside className="def-card" data-role="def" data-term={open.id} aria-live="polite">
      <div className="def-head">
        <b>{t.name}</b>
        {earlier ? (
          <button type="button" className="tag def-since" title={`${earlier.id.toUpperCase()} · ${earlier.name}`} onClick={() => choose(earlier.id)}>
            since {earlier.id.toUpperCase()}
          </button>
        ) : null}
        <button type="button" className="def-close" aria-label="Close the definition" onClick={onClose}>
          ×
        </button>
      </div>
      <p>{t.def}</p>
    </aside>
  )
}

/** The listed terms the prose never spells out: chips under the note that open the same card. */
export function TermChips({ ids, field, open, onOpen }) {
  const known = ids.filter((id) => TERMS[id])
  if (!known.length) return null
  return (
    <span className="term-chips" data-role="term-chips">
      {known.map((id) => {
        const isOpen = open && open.id === id && open.field === field
        return (
          <button
            key={id}
            type="button"
            className={`tag term-chip${isOpen ? ' is-on' : ''}`}
            data-term={id}
            aria-expanded={!!isOpen}
            title={`${TERMS[id].name} — ${gist(TERMS[id].def)}`}
            onClick={() => onOpen(isOpen ? null : { id, field })}
          >
            {short(TERMS[id].name)}
          </button>
        )
      })}
    </span>
  )
}
