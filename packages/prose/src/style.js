// The house style, measured.
//
// STYLE.md states fourteen rules for every word a reader can see. This module
// counts the constructions those rules ban, so a note that drifts back into the
// old voice fails a test instead of shipping. It is the prose equivalent of
// packages/explain/testing: the rule lives where the work happens.
//
// The sentence splitter is the one apps/power-lab/src/notes.test.js arrived at:
// a sentence ends at . ! or ? followed by a space and a capital, a quote or a
// bracket, or at the end of the string. A decimal point is followed by a digit
// and does not end a sentence.

import { BANNED } from './banned.js'

export const words = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0)

export const sentences = (s) =>
  s
    // A sentence ends at . ! or ? followed by a space and anything that is not
    // a lowercase letter: a capital, a digit, a quote, a bracket, a backtick,
    // or a symbol ("|H| = 1 at every frequency", "τ = RC = 1 ms"). A decimal
    // point has its digit hard against it, with no space, so it never ends one.
    .split(/[.!?](?=\s+(?![a-z])|\s*$)/)
    .map((x) => x.trim())
    .filter(Boolean)

/** An em dash used as punctuation. En dashes between numbers (5–12 V) are not. */
const emDashes = (s) => (s.match(/—/g) || []).length

/**
 * A colon that reveals rather than introducing a list, a definition or a value.
 *
 * S4 allows "Admissible: every block" and "Ohm's law read the other way: v = I·R"
 * — a colon introducing a list, a definition or a value. What it bans is the
 * rhetorical shape, two full clauses joined by a colon so the second lands as a
 * reveal: "The cutoff is not a convention: it is the frequency where…". So a hit
 * needs a finite verb on BOTH sides of the colon.
 */
const CLAUSE_VERB =
  /\b(is|are|was|were|has|have|had|does|do|did|means|becomes|sets|holds|gives|takes|reads|shows|makes|falls|rises|stays|carries|equals|leaves|keeps|comes|goes|refuses|decides|follows|produces|drives|dissipates|wastes|climbs)\b/i

const colonReveals = (s) =>
  (s.match(/[^.!?:;]{6,}?: [a-z][^.!?:;]{6,}/g) || []).filter((seg) => {
    const [before, after] = seg.split(/: /)
    return CLAUSE_VERB.test(before) && CLAUSE_VERB.test(after)
  }).length

/**
 * A fragment: a "sentence" with no finite verb. Cheap heuristic, deliberately
 * conservative: it fires only on sentences of six words or fewer, which is
 * where the mannered fragments live ("One sine, one line.", "Four descriptions,
 * one curve."). A longer clause-heavy sentence is never reported as one.
 */
const VERBS =
  /\b(is|are|was|were|be|been|being|has|have|had|do|does|did|can|cannot|could|will|would|shall|should|may|might|must|sets?|holds?|gives?|takes?|reads?|shows?|makes?|moves?|falls?|rises?|stays?|carries|carry|equals?|becomes?|opens?|closes?|drops?|adds?|needs?|means?|comes?|goes|turns?|leaves?|keeps?|puts?|draws?|runs?|works?|follows?|states?|reports?|passes|pass|starts?|ends?|costs?|dissipates?|supplies|supply|measures?|counts?|defines?|marks?|names?|lists?|uses?|applies|apply|see|set|switch|drag|tap|press|open|close|change|raise|lower|turn|read|watch|add|remove|reset|give|replace|lighten|dim|wire|connect|apply|choose|pick|load|peaks?|sags?|sits?|conducts?|charges?|floors?|lags?|leads?|climbs?|delivers?|reaches|ripples?|lifts?|splits?|says?|rings?|arrives?|decays?|oscillates?|fixes|swings?|lags?|rejects?|divides?|divide|multiply|subtract|brings?|sends?|pushes|invents?|cancels?|resonates?|survives?|paints?|folds?|repeats?|settles?)\b/i

/** A verb by shape, for the ones the list does not name: produces, folding, settled. */
const VERB_SHAPE = /\b[a-z]{3,}(?:es|ed|ing)\b/i

/**
 * A line that is an equation, not a sentence: "Distortion factor = 1/√(1 + THD²)."
 * It carries its verb in the equals sign.
 */
const EQUATION = /[=∝→]/

const fragments = (s, skipFirst = false) =>
  sentences(s)
    .slice(skipFirst ? 1 : 0)
    .filter((x) => words(x) <= 6 && !VERBS.test(x) && !VERB_SHAPE.test(x) && !EQUATION.test(x))
    .length

/**
 * Everything STYLE.md counts, for one string.
 *
 * `banned` carries one entry per hit: { rule, match, hint }. The hint is the
 * replacement STYLE.md's table gives, so a failing test tells the writer what to
 * write instead of only what not to.
 */
export function styleReport(text, opts = {}) {
  const s = String(text ?? '')
  const ss = sentences(s)
  const w = words(s)
  const banned = []
  for (const { rule, re, hint } of BANNED) {
    for (const m of s.match(re) || []) banned.push({ rule, match: m.trim(), hint })
  }
  return {
    words: w,
    sentences: ss.length,
    avgSentence: ss.length ? w / ss.length : 0,
    maxSentence: ss.reduce((n, x) => Math.max(n, words(x)), 0),
    emDash: emDashes(s),
    semicolon: (s.match(/;/g) || []).length,
    colonReveal: colonReveals(s),
    fragments: fragments(s, opts.fragmentsSkipFirst === true),
    banned,
  }
}

/** The per-field budgets of STYLE.md, by field name. */
export const BUDGETS = {
  see: { maxWords: 70, avgSentence: 20 },
  // A try line is an instruction and the reading it produces: "At 10 Ω, 0.417."
  // is the register, so S6 does not apply.
  // A try step names a setting and the reading it produces. Circuit Elements
  // Lab's plan already fixes its length at 45 words; Power Lab's single line is
  // 16 (tryText).
  try: { maxWords: 45, fragments: false },
  tryText: { maxWords: 16, fragments: false },
  // `why` is the folded explanation, read at a slower pace than the note above
  // it, so it carries the document sentence cap rather than the note's.
  why: { maxWords: 160, avgSentence: 22, maxSentenceWords: 34 },
  note: { maxWords: 90, avgSentence: 20 },
  noteGroupFirst: { maxWords: 70, avgSentence: 20 },
  // Chrome is named, not written: a label or a caption is a noun phrase, so the
  // fragment rule (S6) does not apply to it. Everything a reader reads as prose
  // keeps it.
  caption: { maxWords: 20, avgSentence: 20, fragments: false },
  // A definition is three or four sentences carrying numbers, units and the
  // occasional formula, which is the convention every terms.js already follows.
  // Symbols count as words, so a math-heavy entry (damping, impedance) needs
  // more room than a prose one; 65 holds the shape without forcing content out.
  // A definition opens the way a dictionary opens, with a noun phrase naming
  // the thing ("Output power over input power, η = P_out/P_in."), so S6 starts
  // at its second sentence.
  term: { maxWords: 65, avgSentence: 22, fragmentsSkipFirst: true },
  label: { maxWords: 4, fragments: false },
  // An experiment's name is a title, not a control label. Circuit Elements Lab
  // states the lesson's claim in the name ("A voltage source holds its
  // voltage"), so the cap is a sidebar row's worth of words, not a label's.
  title: { maxWords: 10, fragments: false },
  tooltip: { maxWords: 15, emDash: 0, fragments: false },
  empty: { maxWords: 12, fragments: false },
  // A markdown paragraph may legitimately open with a bold label ("**Signal
  // Lab.** Admissible: …"), which reads as a fragment and is not one, so S6 is
  // off for documents and stays on for every field a lab renders.
  doc: { maxWords: 110, avgSentence: 22, maxSentenceWords: 34, fragments: false },
}

/**
 * Violations of one budget, as sentences a person can act on. Returns [] when
 * the text is clean. `emDash` defaults to a budget of one per 150 words, per S3.
 */
export function violations(text, budget = {}, label = 'text') {
  const r = styleReport(text, { fragmentsSkipFirst: budget.fragmentsSkipFirst })
  const out = []
  const dashAllowance = budget.emDash ?? Math.floor(r.words / 150)
  if (budget.maxWords && r.words > budget.maxWords)
    out.push(`${label}: ${r.words} words, cap ${budget.maxWords}`)
  if (budget.avgSentence && r.avgSentence > budget.avgSentence)
    out.push(`${label}: ${r.avgSentence.toFixed(1)} words a sentence, cap ${budget.avgSentence}`)
  if (r.maxSentence > (budget.maxSentenceWords ?? 30))
    out.push(`${label}: one sentence of ${r.maxSentence} words, cap ${budget.maxSentenceWords ?? 30} (S2)`)
  if (r.emDash > dashAllowance)
    out.push(`${label}: ${r.emDash} em dashes, budget ${dashAllowance} at one per 150 words (S3)`)
  if (r.semicolon > 0) out.push(`${label}: ${r.semicolon} semicolons, use two sentences (S5)`)
  if (r.colonReveal > 0) out.push(`${label}: colon used as a reveal (S4)`)
  if (budget.fragments !== false && r.fragments > 0)
    out.push(`${label}: ${r.fragments} sentence fragments (S6)`)
  for (const b of r.banned) out.push(`${label}: "${b.match}" (${b.rule}) — ${b.hint}`)
  return out
}
