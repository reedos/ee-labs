import GROUP_A_LIST, { GROUP_A } from './groups/a.js'
import GROUP_B_LIST, { GROUP_B } from './groups/b.js'
import GROUP_C_LIST, { GROUP_C } from './groups/c.js'
import GROUP_D_LIST, { GROUP_D } from './groups/d.js'
import GROUP_E_LIST, { GROUP_E } from './groups/e.js'
import GROUP_F_LIST, { GROUP_F } from './groups/f.js'

// The course, in the plan's order.
//
// Each group file owns its own experiments and carries the physics and the
// three registers together, which is Control Lab's shape. This file only puts
// them in order and hands the app the two things it needs: the list, and the
// state one entry asks for.

export const EXPERIMENTS = [
  ...GROUP_A_LIST,
  ...GROUP_B_LIST,
  ...GROUP_C_LIST,
  ...GROUP_D_LIST,
  ...GROUP_E_LIST,
  ...GROUP_F_LIST,
]

// The plan's order, minus any group that has not been written yet. A group
// with no experiments in it would otherwise draw an empty heading in the
// sidebar, which reads as a defect rather than as a phase boundary.
export const GROUPS = [GROUP_A, GROUP_B, GROUP_C, GROUP_D, GROUP_E, GROUP_F].filter((g) =>
  EXPERIMENTS.some((e) => e.group === g),
)

/** One experiment by its id, or undefined. */
export const byId = (id) => EXPERIMENTS.find((e) => e.id === id)

/** The experiments of one group, in order. */
export const inGroup = (group) => EXPERIMENTS.filter((e) => e.group === group)

/**
 * The state an experiment asks for.
 *
 * A patch is a whole state rather than a diff, because a lesson that inherited
 * half of the previous one's settings would draw a picture its own note does
 * not describe. Control Lab paid for that lesson and this file does not repeat
 * it. The copy is deep enough that moving a knob afterwards cannot write back
 * into the experiment's own definition.
 */
export function applyExperiment(exp) {
  const p = exp.patch
  return {
    ...p,
    plantP: { ...p.plantP },
    ctrlP: { ...p.ctrlP },
    design: p.design ? { ...p.design } : undefined,
  }
}

/**
 * The state one try step asks for, applied on top of the experiment's own.
 *
 * A step's `set` names knobs rather than a whole state, so it reads as the one
 * thing the reader is asked to change. Where the knob is a plant or controller
 * parameter it lands in the right bag, and where it is the experiment's own
 * design or sampling knob it lands at the top level.
 */
export function applyStep(exp, step) {
  const base = applyExperiment(exp)
  const plant = base.plantP
  const ctrl = base.ctrlP
  const design = base.design ? { ...base.design } : {}
  const top = {}
  for (const [key, value] of Object.entries(step.set || {})) {
    if (key in plant) plant[key] = value
    else if (key in ctrl) ctrl[key] = value
    else if (key in design) design[key] = value
    else top[key] = value
  }
  const out = { ...base, plantP: plant, ctrlP: ctrl, ...top }
  if (base.design) out.design = design
  // A step that switches the plant brings that plant's own defaults with it,
  // because the previous plant's knob names mean nothing to the new one.
  return out
}

/**
 * Has the reader moved away from the picture the note describes?
 *
 * Compared on the knobs a reader can reach, so an internal field the app added
 * for its own drawing never makes a note look retired when it is not.
 */
export function isDirty(state, exp) {
  if (!exp) return false
  const want = applyExperiment(exp)
  const same = (a, b) => {
    if (a === b) return true
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) if (a[k] !== b[k]) return false
    return true
  }
  for (const key of ['plantId', 'ctrlId', 'nlId', 'Ts', 'perCycle', 'delta', 'emulation', 'noise', 'reference']) {
    if ((state[key] ?? null) !== (want[key] ?? null)) return true
  }
  if (!same(state.plantP, want.plantP)) return true
  if (!same(state.ctrlP, want.ctrlP)) return true
  if (!same(state.design ?? {}, want.design ?? {})) return true
  return false
}
