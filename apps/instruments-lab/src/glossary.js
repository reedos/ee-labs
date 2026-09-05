/**
 * Terms where they first do work (student review, Phase 6).
 *
 * Each experiment lists the terms its note leans on. Instead of a folded
 * "Terms used here" list, the first place the prose uses a term — in the note,
 * a try step or the why — is marked, and its definition opens on tap. A term
 * the prose never spells out becomes a chip under the note. And a term is
 * introduced by the first experiment that lists it: glossary.test.js checks
 * that no earlier experiment uses the word, so nothing arrives before its
 * meaning.
 */
import { EXPERIMENTS } from './experiments.js'
import { TERMS, MATCH } from './terms.js'

/** The first experiment (in course order) that lists a term, or undefined. */
export function introducedIn(termId) {
  return EXPERIMENTS.find((e) => (e.terms || []).includes(termId))
}

/** The fields of an experiment's prose, in reading order: [key, text]. */
export function proseOf(exp) {
  const out = [['see', exp.see || '']]
  ;(exp.try || []).forEach((t, i) => out.push([`try.${i}`, t.say || '']))
  out.push(['why', exp.why || ''])
  return out
}

/** Every match of a term's pattern in a text: [{ start, end }]. */
function matchesIn(text, re) {
  const out = []
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  for (const m of text.matchAll(g)) out.push({ start: m.index, end: m.index + m[0].length })
  return out
}

/**
 * Where each listed term is first used in the experiment's prose:
 * { <fieldKey>: [{ start, end, id }] } sorted by start, plus `unplaced`, the
 * ids the prose never spells out. When two terms want the same words
 * ("current source" and "current") the longer wins and the other takes its
 * next appearance.
 */
export function firstUses(exp) {
  const ids = (exp.terms || []).filter((id) => TERMS[id] && MATCH[id])
  const prose = proseOf(exp)
  // Every candidate, in reading order; at the same start the longer match
  // comes first, so "current source" claims its words before "current".
  const all = []
  prose.forEach(([field, text], order) => {
    for (const id of ids) for (const m of matchesIn(text, MATCH[id])) all.push({ ...m, id, field, order })
  })
  all.sort((a, b) => a.order - b.order || a.start - b.start || b.end - b.start - (a.end - a.start))
  const taken = {}
  const placed = new Set()
  for (const m of all) {
    if (placed.has(m.id)) continue
    if ((taken[m.field] || []).some((t) => m.start < t.end && t.start < m.end)) continue
    ;(taken[m.field] ||= []).push({ start: m.start, end: m.end, id: m.id })
    placed.add(m.id)
  }
  taken.unplaced = ids.filter((id) => !placed.has(id))
  return taken
}

/**
 * Whether a text points ahead to where a term is defined: it names an
 * experiment at or after the introducer ("in E8, an op-amp buffer") or that
 * experiment's group ("Group E’s op-amps"). Only the why — the fold for
 * whoever wants more — may look ahead like this; the note and the try steps
 * never use a word before its meaning.
 */
export function pointsAhead(text, intro) {
  const at = EXPERIMENTS.indexOf(intro)
  for (const m of text.matchAll(/\b([A-F])(\d)\b/g)) {
    const i = EXPERIMENTS.findIndex((e) => e.id === m[1].toLowerCase() + m[2])
    if (i >= at) return true
  }
  for (const m of text.matchAll(/\bGroup ([A-F])\b/g)) if (m[1].toLowerCase() >= intro.id[0]) return true
  return false
}

/** Any listed term whose pattern fires in an experiment that comes before the one introducing it. */
export function earlyUses() {
  const out = []
  for (const id of Object.keys(TERMS)) {
    const intro = introducedIn(id)
    if (!intro || !MATCH[id]) continue
    const at = EXPERIMENTS.indexOf(intro)
    for (const e of EXPERIMENTS.slice(0, at)) {
      for (const [field, text] of proseOf(e)) {
        const m = text.match(MATCH[id])
        if (m && !(field === 'why' && pointsAhead(text, intro))) out.push({ term: id, exp: e.id, field, text: m[0], introducedIn: intro.id })
      }
    }
  }
  return out
}
