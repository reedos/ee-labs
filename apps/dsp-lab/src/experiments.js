import { EXPERIMENTS as A } from './groups/a.js'
import { EXPERIMENTS as B } from './groups/b.js'
import { LESSONS as LA } from './lessons/a.js'
import { LESSONS as LB } from './lessons/b.js'

// The course, group by group, in the order DSP_LAB_PLAN.md §5 gives.
//
// The data and the prose are separate files with separate owners, and this is
// where they meet. An experiment with no lesson, or a lesson with no experiment,
// fails here rather than rendering an empty panel.
//
// The array is in sidebar order, so "n of 15" in the lesson nav is the position
// the reader sees, and experiments.test.js pins that.

export const GROUPS = ['Changing the rate', 'Designing to a specification']

const LESSONS = { ...LA, ...LB }

const merge = (list) =>
  list.map((e) => {
    const lesson = LESSONS[e.id]
    if (!lesson) throw new Error(`experiment ${e.id} has no lesson`)
    return { ...e, ...lesson }
  })

export const EXPERIMENTS = merge([...A, ...B])

/** The lesson ids that have no experiment, which is the other half of the check. */
export const ORPHAN_LESSONS = Object.keys(LESSONS).filter(
  (id) => !EXPERIMENTS.some((e) => e.id === id),
)

export const byId = (id) => EXPERIMENTS.find((e) => e.id === id) ?? null
