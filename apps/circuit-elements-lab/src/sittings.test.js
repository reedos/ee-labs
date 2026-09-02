import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { SCRIPT, SEATS, TARGETS, validate, score, statusLine } from './sittings.js'
import { byId } from './experiments.js'
import { LESSONS } from './lessons.js'
import { measurable } from './progress.js'

// Students score it (student review, Phase 9). The record of the sittings and
// the document about them are held to each other here: every entry is
// well-formed and names a real experiment, the seats are real experiments with
// a `see` to match a sentence against and a first step a student can act on,
// the scoring is what SITTINGS.md says it is, and the status line the document
// prints is the one the record computes.

const here = dirname(fileURLToPath(import.meta.url))
const lab = join(here, '..')
const record = JSON.parse(readFileSync(join(lab, 'sittings.json'), 'utf8'))
const doc = readFileSync(join(lab, 'SITTINGS.md'), 'utf8')

const sitting = (over = {}) => ({
  who: 'P1',
  date: '2026-09-06',
  device: 'phone',
  experiment: 'a1',
  firstKnobSeconds: 6,
  recall: 'The source stays at 12 whatever the resistor does.',
  recallMatches: true,
  clarity: 5,
  ...over,
})

/** Nine sittings, all on target: three seats, one person each. */
const nine = (over = () => ({})) => ({
  sittings: SEATS.flatMap((seat, s) => seat.map((experiment, i) => sitting({ who: `P${s + 1}`, experiment, device: i === 0 ? 'phone' : 'laptop', ...over(s, i, experiment) }))),
})

describe('the record', () => {
  it('is well-formed and every sitting names an experiment in the course', () => {
    expect(validate(record, byId)).toEqual([])
  })

  it('the seats are real experiments, each with a see sentence to match and a first step a student can act on', () => {
    expect(SEATS.length).toBe(3)
    for (const seat of SEATS) {
      expect(seat.length).toBe(3)
      expect(seat[0]).toBe('a1')
      for (const id of seat) {
        expect(byId[id], id).toBeTruthy()
        expect(LESSONS[id].see.split(/\s+/).length).toBeGreaterThan(8)
        // The clock stops at the first act: the first step turns a knob, drags the cursor or switches the meters.
        expect(measurable(LESSONS[id].try[0]), `${id}'s first step is one the student acts on`).toBe(true)
      }
    }
    // Every seat's later experiments are one of the two choices the plan names.
    for (const [, method, dynamic] of SEATS) {
      expect(['c2', 'd5']).toContain(method)
      expect(['f3', 'g4']).toContain(dynamic)
    }
  })

  it('the script is four lines and the document prints them in order', () => {
    expect(SCRIPT.length).toBe(4)
    let at = 0
    for (const line of SCRIPT) {
      const i = doc.indexOf(line, at)
      expect(i, line).toBeGreaterThan(-1)
      at = i
    }
  })
})

describe('validate', () => {
  it('lists every field that is wrong, by sitting', () => {
    const bad = {
      sittings: [
        sitting(),
        sitting({ who: '', date: '6 Sep', device: 'tablet', experiment: 'z9', firstKnobSeconds: -1, recall: '', recallMatches: 'yes', clarity: 6, stumbled: 3 }),
        null,
      ],
    }
    const out = validate(bad, byId)
    expect(out.filter((s) => s.startsWith('sitting 1'))).toEqual([])
    expect(out.filter((s) => s.startsWith('sitting 2')).length).toBe(9)
    expect(out).toContain('sitting 2: experiment "z9" is not in the course')
    expect(out).toContain('sitting 3 is not an object')
    expect(validate(null, byId)).toEqual(['the record is not an object'])
    expect(validate({}, byId)).toEqual(['the record has no sittings list'])
  })
})

describe('score', () => {
  it('is empty for no sittings and the four numbers for nine on target', () => {
    expect(score({ sittings: [] })).toEqual({ n: 0, firstKnobMax: null, recall: 0, clarityMean: null, blocked: [] })
    const r = score(nine())
    expect(r).toEqual({ n: 9, firstKnobMax: 6, recall: 9, clarityMean: 5, blocked: [] })
  })

  it('a slow first knob blocks that experiment’s group and no other', () => {
    const r = score(nine((s, i, id) => (id === 'g4' && s === 1 ? { firstKnobSeconds: 14 } : {})))
    expect(r.firstKnobMax).toBe(14)
    expect(r.blocked).toEqual(['G'])
    // Exactly on the target is on target.
    expect(score(nine(() => ({ firstKnobSeconds: TARGETS.firstKnobSeconds }))).blocked).toEqual([])
  })

  it('one recall miss is allowed; a second blocks the groups the misses happened in', () => {
    const one = score(nine((s, i, id) => (s === 0 && id === 'f3' ? { recallMatches: false } : {})))
    expect(one.recall).toBe(8)
    expect(one.blocked).toEqual([])
    const two = score(nine((s, i, id) => ((s === 0 && id === 'f3') || (s === 1 && id === 'd5') ? { recallMatches: false } : {})))
    expect(two.recall).toBe(7)
    expect(two.blocked).toEqual(['D', 'F'])
    // Before all nine are in, a count short of 8 is not yet a miss.
    const early = score({ sittings: [sitting({ recallMatches: false }), sitting({ experiment: 'c2' })] })
    expect(early.recall).toBe(1)
    expect(early.blocked).toEqual([])
  })

  it('clarity is a mean per experiment; under 4.5 blocks that group', () => {
    // A1 rated 5, 4, 4 → 4.33: blocked. C2 rated 4 and 5 → 4.5: not.
    const r = score(nine((s, i, id) => (id === 'a1' && s > 0 ? { clarity: 4 } : id === 'c2' && s === 0 ? { clarity: 4 } : {})))
    expect(r.clarityMean).toBeCloseTo((9 * 5 - 3) / 9)
    expect(r.blocked).toEqual(['A'])
  })
})

describe('the status line', () => {
  it('says there are no sittings and claims nothing when the record is empty', () => {
    expect(statusLine({ sittings: [] })).toBe('Status: no sittings yet — the 9.5 is not claimed for any group.')
  })

  it('prints the four numbers against their targets and the verdict', () => {
    expect(statusLine(nine())).toBe('Status: 9 sittings — first knob 6 s (target ≤ 10), recall 9/9 (target ≥ 8/9), clarity 5.00 (target ≥ 4.5) — every target met.')
    expect(statusLine({ sittings: [sitting({ firstKnobSeconds: 12 })] })).toBe('Status: 1 sitting — first knob 12 s (target ≤ 10), recall 1/1 (target ≥ 8/9), clarity 5.00 (target ≥ 4.5) — 9.5 blocked for group A.')
    expect(statusLine({ sittings: [sitting(), sitting({ experiment: 'c2' })] })).toMatch(/— 7 sittings to go\.$/)
  })

  it('is the line SITTINGS.md prints — the document cannot get ahead of the record', () => {
    const printed = doc.split(/\r?\n/).filter((l) => l.startsWith('Status:'))
    expect(printed).toEqual([statusLine(record)])
  })
})
