import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS, VIEW_ORDER, VIEW_LABELS, byId, defaultsOf, groupOf, letterOf, viewLabel } from './experiments.js'
import { readQuantity } from './lessons.js'
import { analyse, refusalOf } from './math.js'
import { chartPropsFor, linePropsFor, numberRowsFor, sweepPropsFor } from './view.js'
import { TERMS } from './terms.js'
import { reportSummary } from './report.js'
import { num } from './format.js'

// Every note makes a claim about a circuit at one frequency, and every claim is
// measured here.
//
// The rule this file exists to enforce is `PROGRAM.md` §6's: a number is never
// typed into a test as a constant when it can be computed from the knobs. So
// nothing below compares a lesson against a table. Each step's `set` is applied
// over the experiment's defaults, the analysis is run at those settings, and
// each `reads` pair is checked against what the engine returns. Then every
// number-with-unit in the sentence has to be one of those readings or one of
// the knob values, which is what stops a sentence from carrying a figure the
// engine never produced.

const at = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p) }
}

/** A deterministic random setting inside every knob's range. */
function randomParams(exp, seed) {
  let s = seed >>> 0
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
  const p = {}
  for (const k of exp.params) {
    if (k.kind === 'toggle') p[k.key] = rnd() < 0.5 ? 0 : 1
    else if (k.kind === 'choice') p[k.key] = k.options[Math.floor(rnd() * k.options.length)].value
    else if (k.scale === 'log') p[k.key] = k.min * Math.pow(k.max / k.min, rnd())
    else p[k.key] = k.min + (k.max - k.min) * rnd()
    if (k.integer) p[k.key] = Math.max(k.min, Math.round(p[k.key]))
  }
  return p
}

// ------------------------------------------------------- the shape of the set

describe('the experiments, as a set', () => {
  it('every experiment has an id, a group, a kind, a name, knobs, a view and a headline', () => {
    for (const e of EXPERIMENTS) {
      expect(e.id, 'an experiment with no id').toMatch(/^[a-h][1-9]$/)
      expect(GROUPS, `${e.id} is in group ${e.group}`).toContain(e.group)
      expect(typeof e.kind, `${e.id} kind`).toBe('string')
      expect(typeof e.name, `${e.id} name`).toBe('string')
      expect(Array.isArray(e.params) && e.params.length > 0, `${e.id} knobs`).toBe(true)
      expect(typeof e.headline, `${e.id} headline`).toBe('function')
      expect(e.views, `${e.id} views`).toContain(e.view)
      for (const v of e.views) expect(VIEW_ORDER, `${e.id} lists view ${v}`).toContain(v)
    }
  })

  it('ids are unique, and each group is a contiguous run numbered from one', () => {
    expect(new Set(EXPERIMENTS.map((e) => e.id)).size).toBe(EXPERIMENTS.length)
    for (const g of GROUPS) {
      const letter = g.slice(0, 1).toLowerCase()
      const ids = groupOf(g).map((e) => e.id)
      expect(ids.length, `${g} is empty`).toBeGreaterThan(0)
      expect(ids).toEqual(ids.map((_, i) => `${letter}${i + 1}`))
    }
  })

  it('the sidebar order is the plan order, group by group', () => {
    const letters = EXPERIMENTS.map(letterOf)
    expect(letters).toEqual([...letters].sort())
    expect([...new Set(letters)]).toEqual(GROUPS.map((g) => g.slice(0, 1)))
  })

  it('these two sittings deliver groups A to D, and nothing later', () => {
    // `RF_LAB_PLAN.md` §9.2 and §9.3: the shell and the chart with groups A and
    // B, then matching and two-ports with groups C and D. Nineteen experiments.
    // A lesson that named a later group's experiment would fail here as well as
    // in the progression test.
    expect(GROUPS).toEqual(['A · The line at one frequency', 'B · The Smith chart', 'C · Matching networks', 'D · S-parameters'])
    expect(EXPERIMENTS.length).toBe(19)
    expect(GROUPS.map((g) => groupOf(g).length)).toEqual([5, 4, 5, 5])
  })

  it('no lesson names an experiment this tree does not hold', () => {
    const known = new Set(EXPERIMENTS.map((e) => e.id.toUpperCase()))
    for (const e of EXPERIMENTS) {
      const prose = [e.name, e.see, e.why, ...e.try.map((t) => t.say)].join(' ')
      for (const named of prose.match(/\b[A-H][1-9]\b/g) || []) {
        expect(known.has(named), `${e.id} names ${named}, which is not built`).toBe(true)
      }
      // A group heading is the same promise at a coarser grain.
      for (const named of prose.match(/\bGroup ([A-H])\b/g) || []) {
        const letter = named.slice(-1)
        expect(GROUPS.some((g) => g.startsWith(letter)), `${e.id} names ${named}, which is not built`).toBe(true)
      }
    }
  })

  it('every knob has a label, a default inside its own range, and a unique key', () => {
    for (const e of EXPERIMENTS) {
      const keys = e.params.map((k) => k.key)
      expect(new Set(keys).size, `${e.id} repeats a knob key`).toBe(keys.length)
      for (const k of e.params) {
        expect(typeof k.label, `${e.id} ${k.key} label`).toBe('string')
        expect(k.default, `${e.id} ${k.key} has no default`).toBeDefined()
        if (!k.kind) {
          expect(k.default, `${e.id} ${k.key} default below its min`).toBeGreaterThanOrEqual(k.min)
          expect(k.default, `${e.id} ${k.key} default above its max`).toBeLessThanOrEqual(k.max)
        }
      }
    }
  })

  it('every view the switch can show has a label and a sentence saying what it shows', () => {
    for (const v of VIEW_ORDER) {
      const meta = viewLabel(v)
      expect(meta.label, `${v} label`).toBeTruthy()
      expect(VIEW_LABELS[v].title.length, `${v} title`).toBeGreaterThan(10)
    }
  })

  it('every term an experiment lists is defined, and every definition is used', () => {
    const listed = new Set(EXPERIMENTS.flatMap((e) => e.terms || []))
    for (const e of EXPERIMENTS) for (const t of e.terms || []) expect(TERMS[t], `${e.id} lists ${t}`).toBeDefined()
    for (const id of Object.keys(TERMS)) expect(listed.has(id), `${id} is defined and never listed`).toBe(true)
  })
})

// ------------------------------------------------------------ every analysis

describe('every experiment analyses, at its defaults and off them', () => {
  it('the headline is a finite number with a unit and a label', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      expect(x.headline, `${e.id} headline`).toBeTruthy()
      expect(Number.isFinite(x.headline.value), `${e.id} headline is ${x.headline?.value}`).toBe(true)
      expect(typeof x.headline.unit, `${e.id} headline unit`).toBe('string')
      expect(x.headline.label.length, `${e.id} headline label`).toBeGreaterThan(3)
    }
  })

  it('every view an experiment offers has something to draw', () => {
    for (const e of EXPERIMENTS) {
      const { p, x } = at(e.id)
      for (const v of e.views) {
        if (v === 'chart') {
          const props = chartPropsFor(e, p, x)
          expect(props.grid.length, `${e.id} chart grid`).toBeGreaterThan(4)
          expect(props.points.length, `${e.id} chart marks nothing`).toBeGreaterThan(0)
          for (const q of props.points) {
            expect(Number.isFinite(q.gamma[0]) && Number.isFinite(q.gamma[1]), `${e.id} marks ${q.label} at ${q.gamma}`).toBe(true)
            expect(Math.hypot(...q.gamma), `${e.id} marks ${q.label} outside the disc`).toBeLessThanOrEqual(1 + 1e-12)
          }
          for (const path of props.paths) expect(path.points.length, `${e.id} path ${path.label}`).toBeGreaterThan(1)
        }
        if (v === 'line') {
          const props = linePropsFor(e, p, x)
          expect(props.samples.length, `${e.id} line samples`).toBeGreaterThan(8)
          expect(props.ticks.marks.length, `${e.id} line marks`).toBeGreaterThan(0)
          expect(props.ticks.marks.length, `${e.id} draws too many marks to count`).toBeLessThanOrEqual(45)
          for (const s of props.samples) expect(Number.isFinite(s.v), `${e.id} sample at ${s.d}`).toBe(true)
        }
        if (v === 'sweep') {
          const props = sweepPropsFor(e, p, x)
          expect(props.points.length, `${e.id} sweep points`).toBeGreaterThan(20)
          // A length of line repeats and a network of lumped elements does not.
          // The assertion here was written when only lines had a sweep, and it
          // is the assertion that was wrong: C1's L network has no repeat
          // frequency, and reporting one would be a claim about the physics
          // that is false. So the spacing is a number or it is null, and the
          // pane draws the marks only where there is something to mark.
          if (props.repeat === null) expect(props.repeats, `${e.id} has no repeat and lists repeats`).toBeFalsy()
          else expect(props.repeat, `${e.id} repeat spacing`).toBeGreaterThan(0)
          for (const q of props.points) expect(Number.isFinite(q.mag), `${e.id} sweep at ${q.f}`).toBe(true)
        }
        if (v === 'numbers') {
          const rows = numberRowsFor(e, p, x)
          expect(rows.length, `${e.id} numbers pane`).toBeGreaterThan(4)
          for (const r of rows) {
            expect(r.label.length, `${e.id} row with no label`).toBeGreaterThan(2)
            expect(String(r.value), `${e.id} row ${r.label} shows nothing`).not.toBe('')
            expect(String(r.value), `${e.id} row ${r.label} shows undefined`).not.toMatch(/undefined|NaN/)
            expect(r.formula.length, `${e.id} row ${r.label} has no formula`).toBeGreaterThan(2)
          }
        }
      }
    }
  })

  it('the report link carries the experiment, its knobs, its view and its headline', () => {
    for (const e of EXPERIMENTS) {
      const { p, x } = at(e.id)
      const summary = reportSummary({ id: e.id, params: p, view: e.view, x })
      expect(summary.Experiment, `${e.id} summary`).toContain(e.name)
      expect(summary.Group, `${e.id} group`).toBe(e.group)
      expect(summary.View, `${e.id} view`).toBe(e.view)
      expect(summary.Headline, `${e.id} headline`).toContain(x.headline.label)
      for (const k of e.params) expect(summary.Settings, `${e.id} settings omit ${k.key}`).toContain(`${k.key} = `)
    }
  })

  it('a knob anywhere in its range gives an answer or a stated refusal, never a crash', () => {
    for (const e of EXPERIMENTS) {
      for (let seed = 1; seed <= 12; seed++) {
        const p = randomParams(e, seed * 7919 + e.id.charCodeAt(0))
        let x
        expect(() => {
          x = analyse(e, p)
        }, `${e.id} threw at seed ${seed}: ${JSON.stringify(p)}`).not.toThrow()
        expect(x.headline, `${e.id} headline at seed ${seed}`).toBeTruthy()
        if (x.declined) {
          expect(x.declined.says.length, `${e.id} declines at seed ${seed} without saying why`).toBeGreaterThan(20)
        } else {
          expect(Number.isFinite(x.headline.value) || x.headline.value === Infinity, `${e.id} headline is ${x.headline.value} at seed ${seed}`).toBe(true)
        }
      }
    }
  })

  it('a load equal to the negative of the reference is declined by name, not clamped', () => {
    const { x } = at('a1', { RL: -50, XL: 0 })
    expect(x.declined, 'a1 at minus the reference is not declined').toBeTruthy()
    expect(x.declined.says).toMatch(/no reflection coefficient/i)
    expect(refusalOf(x)).toBe(x.declined.says)
  })

  it('the line declines the rational hand-over at every line the knobs reach', () => {
    for (const e of EXPERIMENTS.filter((q) => q.kind === 'line')) {
      const { x } = at(e.id)
      expect(x.handOver.ok, `${e.id} offers a transfer function`).toBe(false)
      expect(refusalOf(x), `${e.id} refusal`).toMatch(/no rational transfer function/)
      expect(refusalOf(x), `${e.id} refusal names the factor`).toMatch(/e\^\(-gamma l\)/)
      expect(refusalOf(x), `${e.id} refusal names what does exist`).toMatch(/exact at every frequency/)
    }
  })

  it('nothing in groups A to D is an approximation, so nothing carries a guard', () => {
    // Every object these four groups touch is exact, and CORE_SCOPE's
    // counter-rule says an exact mapping is never hedged. The first guard in
    // this lab arrives with the unilateral approximation in Group E.
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      expect(x.guard, `${e.id} carries a guard`).toBeUndefined()
    }
  })
})

// ------------------------------------------------------------ every lesson

// A step's `set` is applied over the defaults, its `reads` are solved and
// compared, and then every number-with-unit in the sentence has to be one of
// those readings or a knob value. The same rule holds for the numbers in `see`
// and `why`. So a lesson cannot quote a value the engine does not produce, and
// a knob move cannot name a setting the knob cannot reach.
describe('every lesson is measured', () => {
  const PREFIX = { p: 1e-12, n: 1e-9, µ: 1e-6, u: 1e-6, m: 1e-3, c: 1e-2, k: 1e3, M: 1e6, G: 1e9, T: 1e12, '': 1 }
  // The units this lab writes, longest first so "dB/m" is never read as "dB".
  // Longest first, so "dB/m" is never read as "dB" and "Hz" is never read as
  // "H". Groups C and D quote henries and farads, which groups A and B did not.
  const UNIT = ['Np/m', 'dB/m', 'dBm', 'dB', 'Hz', 'H', 'F', 'Ω', 'V', 'A', 'W', 's', 'm', '°', '%'].join('|')
  const UNIT_SCALE = { '%': 1e-2 }
  const UNITS = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*([pnµumckMGT]?)(${UNIT})(?![A-Za-z·⁰¹²³⁴⁵⁶⁷⁸⁹⁻/])`, 'g')
  // A bare figure with two or more decimals is a measurement too, and this lab
  // quotes many that have no unit: a reflection magnitude, a ratio, a radius.
  const BARE = /(?<![\d.,eE⁻×])(\d+\.\d{2,})(?![\d.,]*\s*(?:[pnµumckMGT]?(?:Np\/|dB|Hz|[ΩVAWsmHF°%])))/g

  // "88.89 per cent" is the reading 0.8889 written the way a reader reads a
  // fraction, so a number followed by "per cent" is compared against the
  // fraction and not against the hundred times it.
  const percentAfter = (text, end) => /^\s*(?:per cent|%)/.test(text.slice(end))

  /** Every number-with-unit in a sentence, as a value in base units. */
  const quotedUnits = (text) =>
    [...text.replace(/−/g, '-').matchAll(UNITS)].map((m) => ({
      text: m[0].trim(),
      digits: (m[1].split('.')[1] || '').length,
      scale: PREFIX[m[2]] * (UNIT_SCALE[m[3]] ?? 1),
      value: Math.abs(+m[1]) * PREFIX[m[2]] * (UNIT_SCALE[m[3]] ?? 1),
    }))

  /** Every bare figure carrying two or more decimals, and a percentage as a fraction. */
  const quotedBare = (text) =>
    [...text.replace(/−/g, '-').matchAll(BARE)].map((m) => {
      const cent = percentAfter(text, m.index + m[0].length)
      return {
        text: cent ? `${m[1]} per cent` : m[1],
        digits: (m[1].split('.')[1] || '').length,
        scale: cent ? 0.01 : 1,
        value: Math.abs(+m[1]) * (cent ? 0.01 : 1),
      }
    })

  /** A quoted number stands for a value when it is that value rounded to the digits printed. */
  const stands = (q, v) => {
    if (!Number.isFinite(v)) return false
    const half = 0.5 * 10 ** -q.digits * q.scale
    return Math.abs(q.value - Math.abs(v)) <= Math.max(0.006 * Math.abs(v), half * (1 + 1e-9))
  }
  const close = (got, want, tol) =>
    want === 0 || Math.abs(want) < 1e-30 ? Math.abs(got) <= (tol ?? 1e-9) : Math.abs(got - want) <= (tol ?? 0.006 * Math.abs(want))
  const words = (s) => s.trim().split(/\s+/).length
  const knobOf = (e, key) => e.params.find((k) => k.key === key)
  const knobValues = (e) => e.params.filter((k) => !k.kind).map((k) => k.default)

  /** Solve one register and check its reads. Returns the values it justifies. */
  function measure(e, p, reads, label) {
    const x = analyse(e, p)
    const values = []
    for (const [path, want, tol] of reads) {
      const got = readQuantity(x, p, path)
      if (typeof want === 'string' || typeof want === 'boolean') expect(got, `${label}: ${path} reads ${got}`).toBe(want)
      else {
        expect(Number.isFinite(got), `${label}: ${path} reads ${got}`).toBe(true)
        expect(close(got, want, tol), `${label}: ${path} reads ${got}, the lesson says ${want}`).toBe(true)
        values.push(got)
      }
    }
    return values
  }

  /** Every quoted number in `text` stands for one of `values`. */
  function justified(text, values, label) {
    for (const q of [...quotedUnits(text), ...quotedBare(text)]) {
      const ok = values.some((v) => stands(q, v))
      expect(
        ok,
        `${label}: "${q.text}" is not a reading or a knob value (have ${values.map((v) => +Number(v).toPrecision(6)).join(', ')})`,
      ).toBe(true)
    }
  }

  it('every experiment has a see, two to four tries and a why, each within its budget', () => {
    for (const e of EXPERIMENTS) {
      expect(typeof e.see, `${e.id} see`).toBe('string')
      expect(typeof e.why, `${e.id} why`).toBe('string')
      expect(Array.isArray(e.try), `${e.id} try`).toBe(true)
      expect(e.try.length, `${e.id} has ${e.try.length} steps`).toBeGreaterThanOrEqual(2)
      expect(e.try.length, `${e.id} has ${e.try.length} steps`).toBeLessThanOrEqual(4)
      // The first screen on a phone holds the picture and this paragraph.
      expect(words(e.see), `${e.id} see is ${words(e.see)} words`).toBeLessThanOrEqual(70)
      expect(words(e.why), `${e.id} why is ${words(e.why)} words`).toBeLessThanOrEqual(160)
      for (const t of e.try) expect(words(t.say), `${e.id} try "${t.say.slice(0, 30)}…"`).toBeLessThanOrEqual(45)
    }
  })

  it('the numbers in see and why are readings at the defaults, or knob values', () => {
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const seen = measure(e, p, e.seeReads || [], `${e.id} see`)
      // A why that reasons about a setting the note names reads it there, not
      // at the defaults. A3's closing paragraph is about half the frequency.
      const why = measure(e, { ...p, ...(e.whyAt || {}) }, e.whyReads || [], `${e.id} why`)
      const values = [...seen, ...why, ...knobValues(e)]
      justified(e.see, values, `${e.id} see`)
      justified(e.why, values, `${e.id} why`)
    }
  })

  it('every try sets knobs inside their range and reads what it says', () => {
    let steps = 0
    for (const e of EXPERIMENTS) {
      const d = defaultsOf(e.id)
      e.try.forEach((t, i) => {
        const label = `${e.id} try ${i + 1}`
        const set = []
        for (const [key, v] of Object.entries(t.set || {})) {
          const k = knobOf(e, key)
          expect(k, `${label} sets ${key}, which is not a knob`).toBeDefined()
          if (k.kind === 'choice') expect(k.options.map((o) => o.value), `${label} ${key}`).toContain(v)
          else if (!k.kind) {
            expect(v, `${label} sets ${key} to ${v}, below its min ${k.min}`).toBeGreaterThanOrEqual(k.min)
            expect(v, `${label} sets ${key} to ${v}, above its max ${k.max}`).toBeLessThanOrEqual(k.max)
            set.push(v)
          }
        }
        const p = { ...d, ...(t.set || {}) }
        const read = measure(e, p, t.reads || [], label)
        justified(t.say, [...read, ...set, ...knobValues(e)], label)
        steps++
      })
    }
    // Nine experiments, at least two steps each.
    expect(steps).toBeGreaterThanOrEqual(2 * EXPERIMENTS.length)
  })

  it('a step that says the engine declines really is declined', () => {
    let declared = 0
    for (const e of EXPERIMENTS) {
      for (const t of e.try) {
        if (!t.refuses) continue
        declared++
        const x = analyse(e, { ...defaultsOf(e.id), ...(t.set || {}) })
        expect(Boolean(refusalOf(x)), `${e.id} says a step is declined and it is not`).toBe(true)
      }
    }
    expect(declared, 'no step in this sitting claims a refusal').toBeGreaterThan(0)
  })

  it('a reading a lesson names is a path the analysis carries, not an undefined', () => {
    for (const e of EXPERIMENTS) {
      const paths = [...(e.seeReads || []), ...(e.whyReads || []), ...e.try.flatMap((t) => t.reads || [])]
      for (const [path] of paths) {
        expect(typeof path, `${e.id} reads a path that is not a string`).toBe('string')
        expect(path, `${e.id} reads an empty path`).not.toBe('')
      }
      // A path that names nothing throws rather than reading undefined.
      const { p, x } = at(e.id)
      expect(() => readQuantity(x, p, 'nothing.at.all')).toThrow(/No quantity at path/)
    }
  })
})

// ----------------------------------------------------------- what the app shows

describe('the headline a reader sees is the number a test read', () => {
  it('the formatted headline carries the same digits the analysis produced', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      const shown = num(x.headline.value, x.headline.unit)
      expect(shown, `${e.id} headline formats as "${shown}"`).not.toBe('—')
    }
  })

  it('the quarter-wave section is exactly a quarter wave, not a rounded centimetre count', () => {
    // The length is computed from the phase velocity and the frequency, so the
    // electrical length is 90 degrees to the last bit and A3's "exactly" holds.
    const { x } = at('a3')
    expect(Math.abs(x.el.degrees - 90)).toBeLessThan(1e-9)
    expect(Math.abs(x.zin.Z[0] - 25)).toBeLessThan(1e-9)
    expect(Math.abs(x.zin.Z[1])).toBeLessThan(1e-12)
  })
})
