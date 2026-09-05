import { EXPERIMENTS as A } from './groups/a.js'
import { EXPERIMENTS as B } from './groups/b.js'
import { EXPERIMENTS as C } from './groups/c.js'
import { EXPERIMENTS as E } from './groups/e.js'
import { LESSONS as LA } from './lessons/a.js'
import { LESSONS as LB } from './lessons/b.js'
import { LESSONS as LC } from './lessons/c.js'
import { LESSONS as LE } from './lessons/e.js'

// The course, group by group, in the order DSP_LAB_PLAN.md §5 gives.
//
// The data and the prose are separate files with separate owners, and this is
// where they meet. An experiment with no lesson, or a lesson with no experiment,
// fails here rather than rendering an empty panel.
//
// The array is in sidebar order, so "n of 28" in the lesson nav is the position
// the reader sees, and experiments.test.js pins that.
//
// The order is DSP_LAB_PLAN.md §5's, over the groups that are built. Groups D
// and F are not, so nothing between C and E appears yet, and each of them lands
// in its own place rather than at the end.

export const GROUPS = [
  'Changing the rate',
  'Designing to a specification',
  'Filters that learn',
  'The arithmetic a processor has',
]

const LESSONS = { ...LA, ...LB, ...LC, ...LE }

const merge = (list) =>
  list.map((e) => {
    const lesson = LESSONS[e.id]
    if (!lesson) throw new Error(`experiment ${e.id} has no lesson`)
    return { ...e, ...lesson }
  })

export const EXPERIMENTS = merge([...A, ...B, ...C, ...E])

/** The lesson ids that have no experiment, which is the other half of the check. */
export const ORPHAN_LESSONS = Object.keys(LESSONS).filter(
  (id) => !EXPERIMENTS.some((e) => e.id === id),
)

export const byId = (id) => EXPERIMENTS.find((e) => e.id === id) ?? null
