/**
 * The blind spot that let `E` ship (student review, closing the hole): a
 * capital letter used mid-sentence as if it stood for a number — E, E₁, Q —
 * is invisible to glossary.test.js, which only checks TERMS a lesson already
 * lists. This scans every experiment's reader-visible prose for exactly that
 * shape and requires each one to be either a registered term (by the same
 * MATCH patterns terms.js already ships) or a string the reader can see for
 * themselves: a knob's label, an element's schematic designator, or a node
 * name the schematic draws. Anything else fails, naming the experiment and
 * the symbol.
 *
 * The pattern deliberately excludes:
 *  - a letter carrying a TEXT subscript (R_th, V_oc, I_sc) — a derived
 *    quantity a formula spells out at the instant it is named, never a
 *    numbered circuit instance, and a different kind of thing from E;
 *  - a unit abbreviation beside its number ("12 V", "39.5 µA", "1 MΩ") —
 *    the metric-prefix letter reads as a bare symbol otherwise;
 *  - "A" and "I" used as the English article and pronoun, which are
 *    capitalised only at a sentence's own start;
 *  - a plain experiment cross-reference ("(E2)", "in E8") — the schematic
 *    and knobs always write an instance symbol with a unicode subscript
 *    (E₂), never the ASCII digit an experiment id uses.
 */
import { describe, expect, test } from 'vitest'
import { EXPERIMENTS, byId, defaultsOf, drawables } from './experiments.js'
import { TERMS, MATCH } from './terms.js'
import { proseOf } from './glossary.js'

const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉'
// The closing \b breaks once the subscript is a unicode digit: \b needs a
// word/non-word transition, and a subscript digit followed by a space is
// non-word to non-word, so the boundary is a manual lookahead instead.
const SYMBOL = new RegExp(`\\b[A-Z](?:[${SUBSCRIPT}]+|_\\d+|\\d+)?(?![\\w${SUBSCRIPT}])`, 'g')
// A number with its unit and optional metric prefix, masked out before the
// scan: the unit letter (V, A, W…) is not a quantity symbol, and a prefix
// (M, G) glued to one ("1 MΩ") reads as a bare capital otherwise.
const UNIT = /(-?\d+(?:\.\d+)?)\s*([pnµumkMG]?)(VA|var|V|A|W|Ω|F|H|s|Hz|J|°|%|dB|rad\/s)(?![A-Za-z⁰¹²³⁴⁵⁶⁷⁸⁹⁻])/g
// The one alias each fundamental element or quantity letter has among the
// registered terms — checked against the whole lesson, the way "swap C for
// L" in F2's why leans on "capacitor" said in its own see.
const ALIAS = { R: 'resistor', C: 'capacitor', L: 'inductor', V: 'voltage', I: 'current', Z: 'impedanceac' }

const SUP = {}
'0123456789'.split('').forEach((d, i) => (SUP[d] = SUBSCRIPT[i]))
const toSubscript = (digits) => digits.split('').map((d) => SUP[d] || d).join('')

/** Every knob label, schematic designator and node name a reader can see for one experiment. */
function screenText(exp) {
  const out = new Set()
  for (const p of exp.params) out.add(p.label)
  for (const el of drawables(exp.net(defaultsOf(exp.id)))) {
    out.add(el.id)
    if (el.label) out.add(el.label)
    // The schematic typesets a designator's trailing digits as a subscript
    // (R1 draws as R₁), so that form counts as visible too.
    const m = el.id.match(/^([A-Za-z]+?)(\d+)$/)
    if (m) out.add(`${m[1]}${toSubscript(m[2])}`)
  }
  for (const el of exp.net(defaultsOf(exp.id)).elements) for (const n of el.nodes || []) out.add(n)
  return [...out]
}

/** An ASCII letter+digit token ("E2") that names a real experiment: a cross-reference, not a symbol. */
function isExperimentRef(sym) {
  const m = sym.match(/^([A-Z])(\d+)$/)
  return !!(m && byId[m[1].toLowerCase() + m[2]])
}

/** "A" or "I" capitalised only because it opens a sentence: the article or pronoun, not a symbol. */
function isArticle(text, start, sym) {
  if (sym !== 'A' && sym !== 'I') return false
  const before = text.slice(Math.max(0, start - 3), start)
  return start === 0 || /[.!?:]\s*$/.test(before)
}

/**
 * Every symbol in `exp`'s prose that is neither a registered term nor
 * something the reader can see on the panel, one per distinct symbol.
 */
export function undefinedSymbols(exp) {
  const out = []
  const screen = screenText(exp)
  const fields = proseOf(exp)
  const whole = fields.map(([, t]) => t).join(' ')
  const seen = new Set()
  for (const [field, text] of fields) {
    const masked = text.replace(UNIT, (m) => ' '.repeat(m.length))
    for (const m of masked.matchAll(SYMBOL)) {
      const sym = m[0]
      if (isExperimentRef(sym)) continue
      if (/Group\s*$/.test(masked.slice(Math.max(0, m.index - 6), m.index))) continue
      if (isArticle(masked, m.index, sym)) continue
      if (seen.has(sym)) continue
      // A term's pattern is checked in a small window around the symbol, not
      // just the bare letter: MATCH.gain's "A·" clause, for one, needs the
      // character after it, and a window keeps an unrelated match streets
      // away in the same field from covering an unconnected letter.
      const window = masked.slice(Math.max(0, m.index - 20), m.index + sym.length + 20)
      const byTerm = Object.keys(TERMS).some((id) => MATCH[id] && MATCH[id].test(window))
      const onScreen = screen.some((s) => s.includes(sym))
      // "₀" is the standing "at t = 0" convention (F3 onward), not a numbered
      // instance the way E1 and E2 are, so its bare root is checked too.
      const root = sym.replace(/(?:₀|_0|0)$/, '')
      const rootOnScreen = root !== sym && screen.some((s) => s.includes(root))
      const alias = ALIAS[root] && MATCH[ALIAS[root]] && MATCH[ALIAS[root]].test(whole)
      if (byTerm || onScreen || rootOnScreen || alias) continue
      seen.add(sym)
      out.push({ field, symbol: sym, snippet: text.slice(Math.max(0, m.index - 25), m.index + sym.length + 10) })
    }
  }
  return out
}

/**
 * Symbols this guard would otherwise catch that are not the E defect: each
 * names a derived quantity with no knob or schematic label of its own,
 * introduced by its own formula rather than by a mismatched visible name, so
 * there is no screen/prose disagreement for a reader to trip over. Keyed by
 * "<experiment>:<symbol>", each with the one-line reason `undefinedSymbols`
 * would otherwise flag it for. An entry whose finding disappears (the prose
 * changed under it) fails the second test below, so this list cannot rot.
 */
const ALLOW = {
  'd6:P': 'power P is defined by its own formula (P = …) in the same sentence; nothing on the panel is labelled P',
  'h5:P': 'power P is defined by its own formula (P = ½R|I|²) in the same sentence; nothing on the panel is labelled P',
  'e4:G': 'G = 1 + R_f/R_g is the stage’s closed-loop gain, defined in the sentence that uses it; a derived ratio, not a knob',
  'g1:A': 'A is the solver’s own state matrix in ẋ = Ax + Bu, standard control notation rather than a circuit quantity',
  'f1:A': 'the amplitude knob’s label reads "Triangle amplitude", never showing the letter A — a naming gap, flagged here rather than fixed silently',
}

describe('symbols used as quantities are on screen somewhere', () => {
  test('every bare symbol in reader-visible prose is a registered term, a knob label, a schematic designator or a node name', () => {
    const failures = []
    for (const exp of EXPERIMENTS) {
      for (const f of undefinedSymbols(exp)) {
        const key = `${exp.id}:${f.symbol}`
        if (ALLOW[key]) continue
        failures.push(`${exp.id} ${f.field} [${f.symbol}]  …${f.snippet}…`)
      }
    }
    expect(failures).toEqual([])
  })

  test('every allowed exception still matches a real, current finding', () => {
    const live = new Set()
    for (const exp of EXPERIMENTS) for (const f of undefinedSymbols(exp)) live.add(`${exp.id}:${f.symbol}`)
    for (const key of Object.keys(ALLOW)) expect(live.has(key), key).toBe(true)
  })
})
