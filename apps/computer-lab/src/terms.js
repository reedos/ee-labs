// The glossary, merged from one module per half of the lab.
//
// Split the way `groups/` and `lessons/` are split, so that the lane building
// the pipeline adds its definitions without touching the lane building the
// arithmetic. `terms.test.js` checks the merged registry: every term an
// experiment names is defined, every definition is offered somewhere, and each
// is introduced where it first does work.

import { BASE_TERMS } from './terms/base.js'
import { PIPE_TERMS } from './terms/pipe.js'

export const TERMS = { ...BASE_TERMS, ...PIPE_TERMS }
