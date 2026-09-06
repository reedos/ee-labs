// Definitions, delivered where the term first does work. Each experiment lists
// the terms its notes lean on, and the sidebar offers them under the note.
//
// House rules: two to four sentences, the first saying what the thing IS and
// the rest why it matters here, concrete numbers over abstraction, and no term
// defined using an undefined term. terms.test.js checks the last of those by
// walking the experiments in order.

import { MATCH_A, TERMS_A } from './terms/a.js'
import { MATCH_B, TERMS_B } from './terms/b.js'
import { MATCH_C, TERMS_C } from './terms/c.js'
import { MATCH_D, TERMS_D } from './terms/d.js'

export const TERMS = { ...TERMS_A, ...TERMS_B, ...TERMS_C, ...TERMS_D }

/** How a word is recognised in prose. A pattern per term, because the prose
 * says "standing-wave ratio" where the term is `vswr`, and a rule that only
 * caught the headword would pass a lesson that never says it. */
export const MATCH = { ...MATCH_A, ...MATCH_B, ...MATCH_C, ...MATCH_D }

/** The definitions an experiment's `terms` list names, in that order, for the sidebar's fold. */
export const termsFor = (ids = []) => ids.map((id) => ({ id, ...TERMS[id] })).filter((t) => t.name)
