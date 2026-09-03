import { PLANTS, CONTROLLERS, defaultsOf } from './systems.js'
import { LESSONS, applyLesson } from './lessons.js'

// What the page opens on.
//
// It used to open on a working motor under P control — PM 65°, 4% overshoot,
// Try this folded shut. The student review called it a solved homework
// problem: nothing to ask, nothing to do. Now a bare visit opens on the first
// lesson exactly as clicking it would, so the dashed 1.0 against the 0.9 the
// loop actually reaches is the first picture. A link (a plant handed over
// from Circuit Lab, or any hash at all) keeps its own behaviour: the thing
// the link asked for, no lesson.

export const OPENING_LESSON = 'Proportional cannot get there'

/**
 * @param {object|null} linkedState  what stateFromLink recovered, or null
 * @param {string} hash  window.location.hash ('' when there is none)
 */
export function initialState(linkedState, hash = '') {
  if (linkedState) {
    return {
      plantId: linkedState.plantId ?? 'motor',
      plantP: linkedState.plantP ?? defaultsOf(PLANTS.motor),
      ctrlId: linkedState.ctrlId ?? 'p',
      ctrlP: linkedState.ctrlP ?? defaultsOf(CONTROLLERS.p),
      view: 'step',
      stepInput: 'ref',
      lesson: null,
    }
  }
  if (hash && hash.length > 1) {
    return {
      plantId: 'motor',
      plantP: defaultsOf(PLANTS.motor),
      ctrlId: 'p',
      ctrlP: defaultsOf(CONTROLLERS.p),
      view: 'step',
      stepInput: 'ref',
      lesson: null,
    }
  }
  const l = LESSONS.find((x) => x.name === OPENING_LESSON)
  return { ...applyLesson(l), lesson: l.name }
}
