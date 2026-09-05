import { TERMS as AB, TERM_WORDS as AB_WORDS } from './terms/ab.js'
import { TERMS as C, TERM_WORDS as C_WORDS } from './terms/c.js'
import { TERMS as D, TERM_WORDS as D_WORDS } from './terms/d.js'
import { TERMS as E, TERM_WORDS as E_WORDS } from './terms/e.js'
import { TERMS as F, TERM_WORDS as F_WORDS } from './terms/f.js'

// Definitions, delivered where the term first does work.
//
// The registry is one file per group under terms/, merged here. A group's lane
// writes its own definitions and touches no other lane's, which is the same
// split groups/ and lessons/ already use.
//
// TERM_WORDS is the other half of the contract. The words in a `see`, a `try` or
// a `why` that mean a reader has just met the term. terms.test.js scans every
// lesson with these and fails when a word appears in a lesson that does not list
// its term, which is how a definition stops being optional.
//
// CHROME_TERMS are the words the top bar and the readouts use on every screen.
// They count as defined everywhere.

export const TERMS = { ...AB, ...C, ...D, ...E, ...F }

/** The words that mean a reader has met a term, by term id. */
export const TERM_WORDS = { ...AB_WORDS, ...C_WORDS, ...D_WORDS, ...E_WORDS, ...F_WORDS }

/** Words the chrome uses everywhere, defined once in the top bar's own panel. */
export const CHROME_TERMS = ['nyquist', 'specification', 'margin']

/** Every term id a piece of text has just introduced. */
export function termsInText(text) {
  const found = new Set()
  for (const [id, patterns] of Object.entries(TERM_WORDS)) {
    for (const re of patterns) {
      if (re.test(text)) {
        found.add(id)
        break
      }
    }
  }
  return found
}
