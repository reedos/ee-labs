// The glossary, merged from one module per phase of the lab.
//
// Split the way `groups/` and `lessons/` are split, so that the lane building
// the sequential half adds its definitions without touching the lane building
// the combinational half. `terms.test.js` checks the merged registry: every
// term an experiment names is defined, every definition is offered somewhere,
// and each is introduced where it first does work.

import { BASE_TERMS } from './terms/base.js'
import { EF_TERMS } from './terms/ef.js'
import { GH_TERMS } from './terms/gh.js'

export const TERMS = { ...BASE_TERMS, ...EF_TERMS, ...GH_TERMS }
