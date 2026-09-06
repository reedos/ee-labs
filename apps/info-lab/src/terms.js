// The glossary, merged from one module per half of the lab.
//
// Split the way `groups/` and `lessons/` are split, so the lane building the
// decoders adds its definitions without touching the lane building the source
// coders. `terms.test.js` checks the merged registry: every term an experiment
// names is defined, every definition is offered somewhere, and each is
// introduced where it first does work.

import { SOURCE_TERMS } from './terms/source.js'
import { CODE_TERMS } from './terms/codes.js'
import { DECODER_TERMS } from './terms/decoders.js'

export const TERMS = { ...SOURCE_TERMS, ...CODE_TERMS, ...DECODER_TERMS }
