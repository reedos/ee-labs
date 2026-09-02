import { predictFor } from './predict.js'

/**
 * Where the student is (student review, Phase 8).
 *
 * The Try list is a path, and the app keeps track of how far along it the
 * student has come. A step is done when the screen shows what the step asked
 * for: its knobs read the settings it names (a toggle exactly, a number within
 * 0.5 % — C4's bridge starts 1 % off balance and its first step is to balance
 * it), the cursor sits at the instant it names (within 2 % of the window), and
 * the meters are in the mode it tells the student to switch to. A step that
 * asks for none of those — "drag the cursor and watch" — is a watch step: it is
 * done when the student says so, or when any later step is done. Done is
 * sticky: a knob turned on past the step's setting does not undo it.
 *
 * The first step not yet done is the active one. The lesson leads with it: its
 * knob is the one open in the Knobs section, and what it says to read is lit on
 * the schematic. Progress is kept per experiment in localStorage, so a student
 * coming back sees where they left off, and the picker marks what is complete.
 */

/** The localStorage key. */
export const STORE_KEY = 'ee-labs/elements/progress'

/** The meter mode a step tells the student to switch to, from its sentence; null when it does not. */
export function meterOf(step) {
  const m = /\bswitch(?:\s+the\s+meters)?\s+to\s+(voltage|current|power)s?\b/i.exec(step.say || '')
  return m ? { voltage: 'v', current: 'i', power: 'p' }[m[1].toLowerCase()] : null
}

/** The knobs a step turns. */
export const knobsOf = (step) => Object.keys(step.set || {})

/** Whether a step asks for anything the app can see happen. */
export const measurable = (step) => knobsOf(step).length > 0 || step.at != null || meterOf(step) !== null

/**
 * Whether the screen shows what the step asked for. `state` is
 * { params, cursor, tEnd, show }. Null for a watch step: nothing to measure.
 */
export function stepMet(step, state) {
  if (!measurable(step)) return null
  const set = step.set || {}
  for (const k of knobsOf(step)) {
    const want = set[k]
    const have = state.params[k]
    if (typeof want === 'boolean') {
      if (!!have !== want) return false
    } else if (typeof want === 'string') {
      // A choice — which diode model the circuit uses — is met exactly, like a
      // toggle: there is nothing between "the curve" and "0.7 V".
      if (have !== want) return false
    } else if (!(Math.abs(have - want) <= Math.max(0.005 * Math.abs(want), 1e-12))) return false
  }
  if (step.at != null) {
    if (!Number.isFinite(state.cursor) || !(state.tEnd > 0)) return false
    if (Math.abs(state.cursor - step.at) > 0.02 * state.tEnd) return false
  }
  const mode = meterOf(step)
  if (mode !== null && state.show !== mode) return false
  return true
}

/** The index of the first step not done; −1 when every step is. */
export function activeStep(steps, done) {
  for (let i = 0; i < steps.length; i++) if (!done.has(i)) return i
  return -1
}

/**
 * The done set after looking at the screen: every measurable step the screen
 * meets is added, and a watch step is done once any step after it is. Returns
 * the same Set when nothing changed, so an effect can compare by identity.
 */
export function advance(done, steps, state) {
  let next = null
  const add = (i) => {
    if (done.has(i) || (next && next.has(i))) return
    if (!next) next = new Set(done)
    next.add(i)
  }
  steps.forEach((s, i) => {
    if (stepMet(s, state) === true) add(i)
  })
  const isDone = (i) => done.has(i) || (next !== null && next.has(i))
  steps.forEach((s, i) => {
    if (!measurable(s) && steps.some((_, j) => j > i && isDone(j))) add(i)
  })
  return next || done
}

/** A watch step ticked by hand — and, as ever, the watch steps before it. */
export function tick(done, steps, i) {
  const next = new Set(done)
  next.add(i)
  steps.forEach((s, j) => {
    if (j < i && !measurable(s)) next.add(j)
  })
  return next
}

/**
 * What a step says to read, as the places on the schematic that show it:
 * `v.<node>` and `vd.<a>.<b>` name nodes; `volt.`, `i.` and `p.<id>` name
 * elements. Other paths (thevenin, state, energy, mag…) belong to the Analysis
 * pane and light nothing.
 */
export function readsOf(step) {
  const nodes = new Set()
  const elements = new Set()
  for (const [path] of step.reads || []) {
    if (typeof path !== 'string') continue
    const [q, ...rest] = path.split('.')
    if (q === 'v' && rest.length === 1) nodes.add(rest[0])
    else if (q === 'vd') rest.forEach((n) => nodes.add(n))
    else if ((q === 'volt' || q === 'i' || q === 'p') && rest.length === 1) elements.add(rest[0])
  }
  return { nodes, elements }
}

/** Whether an experiment is complete: every step done and, if one is posed, the prediction made. */
export function complete(exp, entry) {
  if (!entry) return false
  const steps = exp.try || []
  const done = new Set(entry.steps || [])
  if (!steps.every((_, i) => done.has(i))) return false
  return !predictFor(exp) || !!entry.predicted
}

/** How many of a group's experiments are complete. */
export function groupArc(exps, progress) {
  return { done: exps.filter((e) => complete(e, progress[e.id])).length, total: exps.length }
}

/** The stored record, or {} when there is none or the store is not to be had. */
export function load(storage) {
  try {
    const raw = storage.getItem(STORE_KEY)
    const p = raw ? JSON.parse(raw) : null
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {}
  } catch {
    return {}
  }
}

/** Write the record; a store that refuses (private mode, quota) is no error. */
export function save(storage, progress) {
  try {
    storage.setItem(STORE_KEY, JSON.stringify(progress))
    return true
  } catch {
    return false
  }
}

/** The record with an experiment's done steps replaced; the same object when they already match. */
export function withSteps(progress, id, done) {
  const steps = [...done].sort((a, b) => a - b)
  const had = (progress[id] && progress[id].steps) || []
  if (had.length === steps.length && had.every((s, i) => s === steps[i])) return progress
  return { ...progress, [id]: { ...(progress[id] || {}), steps } }
}

/** The record with an experiment's prediction marked made. */
export function withPredicted(progress, id) {
  if (progress[id] && progress[id].predicted) return progress
  return { ...progress, [id]: { ...(progress[id] || {}), steps: (progress[id] && progress[id].steps) || [], predicted: true } }
}
