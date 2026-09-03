import React from 'react'

/**
 * The lesson's one imperative, rendered apart from the note, with the chips
 * that do it in one click.
 *
 * A note says what the picture shows; the try line says which knob to touch
 * and what should happen. Keeping it its own element means the eye finds it
 * without re-reading the paragraph, and a verify probe can find it too. Chips
 * are the playbook's "switch the block to X must be one click": each carries a
 * label and whatever the lab needs to apply it — this component only hands the
 * chip back through `onChip`.
 *
 * Renders nothing when there is no text, so a lesson without a `try` field
 * costs no layout.
 */
export default function TryLine({ text, chips = [], onChip, activeChip = null }) {
  if (!text && !chips.length) return null
  return (
    <div className="try-line">
      {text ? (
        <p className="try-text">
          <b>Try</b> {text}
        </p>
      ) : null}
      {chips.length ? (
        <div className="try-chips" role="group" aria-label="One-click settings">
          {chips.map((c) => (
            <button
              type="button"
              key={c.label}
              className={`chip${activeChip === c.label ? ' is-on' : ''}`}
              onClick={() => onChip && onChip(c)}
              title={c.title || undefined}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
