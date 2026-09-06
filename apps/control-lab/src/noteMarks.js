import { CUES, TERMS } from './terms.js'

// Definitions on contact, for a reader who does not go looking (student
// review, item 3 of the cold walk): the terms fold used to sit only after
// the WHOLE note, behind a small "terms used here" link a skim reader never
// noticed — two of two skim readers on Circuit Lab concluded that lab had no
// glossary at all under the identical pattern, while zero of the same
// reviewers missed Circuit Elements Lab's glossary, which marks a term's
// first use right in the prose instead. This copies that pattern rather than
// reinventing it: find where each of a lesson's own listed terms first does
// work in its note, using the SAME cue patterns (CUES, terms.js) the picker
// glossary scan and terms.test.js already hold every lesson to, so a marked
// word can never disagree with what the suite already calls a use of that
// term. NEEDS.md records the fold itself as a deliberate trade for the fold
// budget — this does not unfold it, it makes the first sentence carry its
// own way in.

/**
 * Where each of `ids` first appears in `text`, as `{ id, start, end }`
 * sorted by position. Only the FIRST match per id is marked — a term used
 * twice in one note only needs one door in. Two ids wanting the same words
 * keep the earlier-starting (then longer) match; the loser is simply not
 * marked inline, and stays reachable from the "terms used here" fold same
 * as ever.
 */
export function markTerms(text, ids = []) {
  const candidates = []
  for (const id of ids) {
    const re = CUES[id]
    if (!re || !TERMS[id]) continue
    const m = re.exec(text)
    if (m) candidates.push({ id, start: m.index, end: m.index + m[0].length })
  }
  candidates.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const placed = []
  for (const c of candidates) {
    if (placed.some((p) => c.start < p.end && p.start < c.end)) continue
    placed.push(c)
  }
  return placed.sort((a, b) => a.start - b.start)
}
