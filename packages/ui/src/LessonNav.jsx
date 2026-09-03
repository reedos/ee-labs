import React from 'react'

/**
 * The course's spine: previous / "n of N" / next, and a reset that appears
 * only once the student has moved the knobs away from the lesson's defaults.
 *
 * One shared strip so the three labs step through their Try-this lists the
 * same way. The labs own the list and the loading — this only knows an index,
 * a count, and three callbacks. `dirty` is the lab's judgement that the note
 * has retired (a knob moved since the lesson loaded); the reset button is the
 * way back to the picture the note describes.
 *
 * `noun` is what the lab calls an item: Signal Lab says "experiment", the
 * other two say "lesson". It only reaches the accessible names.
 */
export default function LessonNav({ index, total, onPrev, onNext, onReset, dirty = false, noun = 'lesson' }) {
  if (index == null || total == null) return null
  const hasPrev = index > 0
  const hasNext = index < total - 1
  return (
    <div className="lesson-nav" role="group" aria-label={`${noun} navigation`}>
      <button
        type="button"
        className="lesson-nav-step"
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label={`Previous ${noun}`}
        title={`Previous ${noun}`}
      >
        ‹ prev
      </button>
      <span className="lesson-nav-count" aria-live="polite">
        {index + 1} of {total}
      </span>
      <button
        type="button"
        className="lesson-nav-step"
        onClick={onNext}
        disabled={!hasNext}
        aria-label={`Next ${noun}`}
        title={`Next ${noun}`}
      >
        next ›
      </button>
      {dirty ? (
        <button
          type="button"
          className="lesson-nav-reset"
          onClick={onReset}
          aria-label={`Reset to this ${noun}'s defaults`}
          title="You moved away from the defaults — put them back"
        >
          ↺ reset
        </button>
      ) : null}
    </div>
  )
}
