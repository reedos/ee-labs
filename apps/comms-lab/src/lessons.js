// The lesson text, merged from the group files.
//
// Three registers, as every lab in the suite has them.
//   see   what is on screen right now, with the quantity named first
//   try   one imperative per step, with the setting and the reading it produces
//   why   the folded explanation, read at a slower pace
//
// The budgets are STYLE.md's, and `prose.test.js` measures every string against
// them. Each group lane owns its own file, so two lanes never edit one.

import A from './lessons/a.js'
import B from './lessons/b.js'
import C from './lessons/c.js'
import D from './lessons/d.js'
import E from './lessons/e.js'
import F from './lessons/f.js'
import G from './lessons/g.js'
import H from './lessons/h.js'

export const LESSONS = { ...A, ...B, ...C, ...D, ...E, ...F, ...G, ...H }

/** The lesson for one experiment id, or undefined. */
export const lessonFor = (id) => LESSONS[id]
