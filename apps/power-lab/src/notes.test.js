import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS } from './experiments.js'
import { TERMS } from './terms.js'

// Reading level (POWER_LAB_PLAN.md §11.2.5): a note is one claim, read in
// one breath, and it has to fit above the fold with the schematic and the
// first knob at 1366×768 (verify.mjs section 8). The fold is the binding
// limit: about 80 words of note and two lines of `try`; the first
// experiment of a group carries the group's intro as well, so less.
// Sentences average at most twenty words. Every term of art a note uses is
// one the experiment lists, so the fold under the note defines it.

const words = (s) => s.trim().split(/\s+/).length
// A sentence ends at . ! or ? followed by a space and a capital (or a quote
// or a bracket), or at the end. A decimal point is followed by a digit, and
// does not count.
const sentences = (s) => s.split(/[.!?](?=\s+[A-Z“"(]|\s*$)/).map((x) => x.trim()).filter(Boolean)

const groupFirst = new Set(GROUPS.map((g) => EXPERIMENTS.find((e) => e.group === g).id))

describe('reading level (§11.2.5)', () => {
  it('a note is at most 90 words, 70 on the first experiment of a group', () => {
    for (const e of EXPERIMENTS) {
      const cap = groupFirst.has(e.id) ? 70 : 90
      expect(words(e.note), `${e.id}: ${words(e.note)} words (cap ${cap})`).toBeLessThanOrEqual(cap)
      expect(words(e.note), `${e.id}: too short to make a claim`).toBeGreaterThanOrEqual(35)
    }
  })
  it('its sentences average at most twenty words', () => {
    for (const e of EXPERIMENTS) {
      const ss = sentences(e.note)
      expect(ss.length, `${e.id}: one sentence`).toBeGreaterThan(1)
      const avg = words(e.note) / ss.length
      expect(avg, `${e.id}: ${avg.toFixed(1)} words a sentence`).toBeLessThanOrEqual(20)
    }
  })
  it('the try line is at most sixteen words: two lines beside its chip', () => {
    for (const e of EXPERIMENTS) expect(words(e.try.text), `${e.id}: ${words(e.try.text)} words`).toBeLessThanOrEqual(16)
  })
})

// What a term looks like in prose: its name without the parenthetical, each
// half of an "A and B" name, the abbreviation in the parenthetical when it is
// three letters or more, and a few spellings the names do not carry — the
// plurals that are terms themselves. A verb ("the output ripples", "averages
// to zero") is not a use of the term, so no suffix is matched by default.
const ALIASES = {
  'steady-state': ['steady state'],
  'volt-second': ['volt-seconds'],
  'switch-node': ['switch node'],
  'small-ripple': ['small-ripple'],
  'k-parameter': [],
  'inductor-energy': ['inductor energy'],
  harmonic: ['harmonics'],
  rectifier: ['rectifiers'],
  displacement: ['displacement', 'distortion'],
}
function spellingsOf(id) {
  const name = TERMS[id].name
  const out = new Set(ALIASES[id] || [])
  const abbr = name.match(/\(([A-Za-z]{3,})\)/)
  if (abbr) out.add(abbr[1])
  const bare = name.replace(/\s*\(.*?\)/, '').split(',')[0].trim()
  // A name that is a formula (K = 2·L·f_s/R) is matched by its aliases only.
  if (/^[A-Za-z][A-Za-z -]*$/.test(bare)) for (const part of bare.split(/\s+and\s+/)) out.add(part.trim())
  return [...out]
}
const mentions = (note, s) => new RegExp(`(^|[^A-Za-z-])${s.replace(/[-\s]/g, '[-\\s]')}([^A-Za-z-]|$)`, 'i').test(note)

describe('terms of art (§11.2.5)', () => {
  it('every term a note uses is in that experiment’s list, so the fold beneath it defines it', () => {
    for (const e of EXPERIMENTS) {
      const missing = []
      for (const id of Object.keys(TERMS)) {
        if (e.terms.includes(id)) continue
        const hit = spellingsOf(id).find((s) => mentions(e.note, s))
        if (hit) missing.push(`${id} ("${hit}")`)
      }
      expect(missing, `${e.id} uses ${missing.join(', ')} without listing it`).toEqual([])
    }
  })
  it('spells each term the way the test looks for it', () => {
    expect(spellingsOf('dcm')).toEqual(expect.arrayContaining(['DCM', 'Discontinuous conduction']))
    expect(spellingsOf('piv')).toEqual(expect.arrayContaining(['PIV', 'Peak inverse voltage']))
    expect(spellingsOf('displacement')).toEqual(expect.arrayContaining(['displacement', 'distortion']))
    expect(spellingsOf('k-parameter')).toEqual([])
    expect(mentions('the ripple is 3.65 mV', 'ripple')).toBe(true)
    expect(mentions('it ripples at six times', 'ripple')).toBe(false)
    expect(mentions('volt-second balance', 'Volt-second balance')).toBe(true)
    expect(mentions('the average is', 'average')).toBe(true)
    expect(mentions('averages to zero', 'average')).toBe(false)
  })
})
