import React from 'react'
import { Marked } from './Prose.jsx'

// What each wrong pick says about the habit behind it.
const HABIT = {
  same: 'You guessed nothing would change.',
  proportional: 'You guessed it scales with the knob.',
  inverse: 'You guessed it scales the other way.',
  double: 'You guessed it doubles.',
  half: 'You guessed it halves.',
}

/**
 * Predict before you turn (student review, Phase 6). The experiment's first
 * knob-turning step is posed as a question in its place in the try list:
 * three answers, one the solver's. Picking one sets the knob (so the meters
 * show the truth at once) and the step's own sentence appears as the reason,
 * with the habit behind a wrong pick named. `picked` is the rule of the chosen
 * answer, kept by the app so it survives re-renders and resets per experiment.
 */
export default function Predict({ q, picked, onPick, marks, field, open, onOpen }) {
  if (!q) return null
  const answer = q.options.find((o) => o.rule === 'solver')
  const right = picked === 'solver'
  const state = picked ? (right ? 'right' : 'wrong') : 'open'
  return (
    <div className="predict" data-role="predict" data-state={state}>
      <p className="predict-ask">
        <span className="predict-tag">predict</span> {q.ask}
      </p>
      <div className="predict-options" role="group" aria-label="Your prediction">
        {q.options.map((o) => (
          <button
            key={o.rule}
            type="button"
            className={`predict-option${picked === o.rule ? ' is-picked' : ''}${picked && o.rule === 'solver' ? ' is-answer' : ''}`}
            data-rule={o.rule}
            disabled={!!picked}
            aria-pressed={picked === o.rule}
            onClick={() => onPick(o.rule)}
          >
            {o.text}
          </button>
        ))}
        {picked ? <span className={`predict-mark ${state}`}>{right ? 'right' : 'not quite'}</span> : null}
      </div>
      {picked ? (
        <p className="predict-reveal" data-role="predict-reveal">
          {right ? null : (
            <>
              <em>{HABIT[picked]}</em> It reads <b>{answer.text}</b>.{' '}
            </>
          )}
          <Marked text={q.reason} marks={marks} field={field} open={open} onOpen={onOpen} />
        </p>
      ) : null}
    </div>
  )
}
