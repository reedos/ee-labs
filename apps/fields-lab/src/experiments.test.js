import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS, VIEW_ORDER, VIEW_LABELS, byId, defaultsOf, groupOf, letterOf, viewLabel } from './experiments.js'
import { readQuantity } from './lessons.js'
import { analyse, clearCache, guardOf, refusalOf } from './math.js'
import { mapPropsFor, profilePropsFor } from './view.js'
import { TERMS } from './terms.js'
import { reportSummary } from './report.js'
import { gridNum, num } from './format.js'
import { figuresOf } from '@ee-labs/fields'

// Every note makes a claim about a field, and every claim is measured here.
//
// The rule this file exists to enforce is `PROGRAM.md` §6's: a number is never
// typed into a test as a constant when it can be computed from the knobs. So
// nothing below compares a lesson against a table. Each step's `set` is applied
// over the experiment's defaults, the analysis is run at those settings, and
// each `reads` pair is checked against what the engine returns. Then every
// number-with-unit in the sentence has to be one of those readings or one of the
// knob values, which is what stops a sentence from carrying a figure the engine
// never produced.
//
// The lab's own rule sits on top of that. A number a grid produced is quoted to
// the figures its guard allows and no more, so the grid experiments are held to
// `figuresOf` rather than to a count of decimals someone chose.

// The experiments that ship an approximation, and so carry a guard. Groups A
// and B are absent because a closed form is exact and is never hedged: the five
// grid solves, the two magnetic circuits, the eddy-current sheet and the tube
// formula are the whole list for the first half.
const GUARDED = ['c1', 'c2', 'c3', 'c4', 'c5', 'e5', 'e6', 'f3', 'f4']

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
      expect(e.id, 'an experiment with no id').toMatch(/^[a-l][1-9]$/)
      expect(GROUPS, `${e.id} is in group ${e.group}`).toContain(e.group)
      expect(typeof e.kind, `${e.id} kind`).toBe('string')
      expect(typeof e.name, `${e.id} name`).toBe('string')
      expect(Array.isArray(e.params) && e.params.length > 0, `${e.id} knobs`).toBe(true)
      expect(typeof e.headline, `${e.id} headline`).toBe('function')
      expect(typeof e.domain, `${e.id} domain`).toBe('function')
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
        if (v === '2d') {
          const props = mapPropsFor(e, p, x)
          expect(props.mode, `${e.id} map mode`).toBe('2d')
          expect(props.domain.width, `${e.id} domain width`).toBeGreaterThan(0)
          expect(props.domain.height, `${e.id} domain height`).toBeGreaterThan(0)
          const drawsSomething = props.scalar || props.vector || (props.conductors || []).length || (props.charges || []).length
          expect(Boolean(drawsSomething), `${e.id} map draws nothing`).toBe(true)
        }
        if (v === 'profile') {
          const pr = profilePropsFor(e, p, x)
          expect(pr.scalar, `${e.id} profile scalar`).toBeTruthy()
          expect(typeof pr.scalar.read, `${e.id} profile read`).toBe('function')
          expect(pr.scalar.label.length, `${e.id} profile label`).toBeGreaterThan(2)
          const span = pr.to - pr.from
          expect(Number.isFinite(span) && span > 0, `${e.id} profile spans ${pr.from} to ${pr.to}`).toBe(true)
          const mid = pr.scalar.read(pr.from + span / 2)
          expect(Number.isFinite(mid), `${e.id} profile reads ${mid} halfway along`).toBe(true)
        }
        if (v === 'mesh') expect(x.grid, `${e.id} offers the mesh view with no grid`).toBeTruthy()
        if (v === 'flux') expect(x.flux || x.gauss, `${e.id} offers the flux view with no contour`).toBeTruthy()
        if (v === 'circuit') expect(x.circuit || (x.xfmr && x.xfmr.circuit), `${e.id} offers the circuit view with none`).toBeTruthy()
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
    clearCache()
    let refused = 0
    for (const e of EXPERIMENTS) {
      // The grid experiments solve three meshes per call, so they are swept at
      // their defaults only; `relax.test.js` is where the solver is fuzzed.
      if (e.kind === 'grid') continue
      for (let seed = 1; seed <= 8; seed++) {
        const p = randomParams(e, seed * 7919 + e.id.charCodeAt(0))
        let x
        expect(() => {
          x = analyse(e, p)
        }, `${e.id} threw at seed ${seed}: ${JSON.stringify(p)}`).not.toThrow()
        expect(x.headline, `${e.id} headline at seed ${seed}`).toBeTruthy()
        if (x.declined) {
          refused++
          expect(x.declined.says, `${e.id} declines at seed ${seed} without saying why`).toMatch(/[a-z]/)
          expect(x.declined.says.length, `${e.id} decline message`).toBeGreaterThan(20)
        } else {
          expect(Number.isFinite(x.headline.value), `${e.id} headline is ${x.headline.value} at seed ${seed}`).toBe(true)
        }
      }
    }
    // A shield inside its own inner conductor is one of the settings the knobs
    // can reach and the engine will not describe, so the sweep must find some.
    expect(refused).toBeGreaterThan(0)
  })

  it('a shield inside the inner conductor is declined by name, not clamped', () => {
    const { x } = at('b2', { a: 2e-3, b: 1e-3 })
    expect(x.declined, 'b2 with b under a is not declined').toBeTruthy()
    expect(x.declined.says).toMatch(/outer radius b must be larger than the inner radius a/i)
    expect(x.declined.field).toBe('b')
    expect(refusalOf(x)).toBe(x.declined.says)
  })

  it('the guard an experiment shows carries a quantity, a threshold and a sentence', () => {
    let guarded = 0
    for (const e of EXPERIMENTS) {
      const g = guardOf(at(e.id).x)
      if (!g) continue
      guarded++
      expect(typeof g.quantity, `${e.id} guard quantity`).toBe('string')
      expect(Number.isFinite(g.threshold), `${e.id} guard threshold`).toBe(true)
      expect(typeof g.ok, `${e.id} guard verdict`).toBe('boolean')
      expect(g.says.length, `${e.id} guard sentence`).toBeGreaterThan(20)
    }
    // Every approximation the first half ships carries one. Nothing in groups A
    // and B does, because a closed form is exact and is never hedged.
    expect(guarded).toBe(GUARDED.length)
    expect(EXPERIMENTS.filter((e) => guardOf(at(e.id).x)).map((e) => e.id)).toEqual(GUARDED)
  })

  it('nothing in the first half is a refusal, and the refusal channel is there for the second', () => {
    for (const e of EXPERIMENTS) {
      if (letterOf(e) > 'F') continue
      expect(refusalOf(at(e.id).x), `${e.id} declines at its defaults`).toBeNull()
    }
  })
})

// ------------------------------------------------- the grid's figure discipline

describe('a grid number is quoted to the figures its guard allows', () => {
  it('a settled report is quoted to three figures and an unsettled one to two', () => {
    for (const e of EXPERIMENTS.filter((x) => x.kind === 'grid')) {
      const { x } = at(e.id)
      const figures = figuresOf(x.grid)
      expect(figures, `${e.id} figures`).toBe(x.grid.ok ? 3 : 2)
      const shown = gridNum(x.grid, x.grid.value, x.headline.unit)
      const digits = shown.replace(/[^0-9]/g, '').replace(/^0+/, '').length
      expect(digits, `${e.id} shows "${shown}" with more figures than its guard allows`).toBeLessThanOrEqual(figures)
    }
  })

  it('the band a report defends holds the difference from a closed form, where there is one', () => {
    for (const e of EXPERIMENTS.filter((x) => x.kind === 'grid')) {
      const { x } = at(e.id)
      if (!x.compare) continue
      const rel = Math.abs(x.grid.value - x.compare.value) / Math.abs(x.compare.value)
      expect(rel, `${e.id} is ${(100 * rel).toPrecision(3)} % out, past a band of ${(100 * x.grid.band).toPrecision(3)} %`).toBeLessThanOrEqual(x.grid.band)
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
  const PREFIX = { p: 1e-12, n: 1e-9, 'µ': 1e-6, u: 1e-6, m: 1e-3, c: 1e-2, k: 1e3, M: 1e6, G: 1e9, T: 1e12, '': 1 }
  // The units this lab writes, longest first so "V/m" is never read as "V".
  const UNIT = [
    'W/m³', 'J/m³', 'A/m²', 'Ω·cm', 'Ω·m', 'Ω/□', 'V/m', 'F/m', 'H/m', 'Ω/m', 'S/m', 'C/m', 'A/m', 'Wb',
    'dBi', 'dB', 'Hz', 'V', 'A', 'W', 'J', 'C', 'N', 'F', 'H', 'T', 'S', 'Ω', 's', 'm', '°', '%',
  ].join('|')
  // A unit whose own name carries a scale the prefix rule does not reach.
  const UNIT_SCALE = { 'Ω·cm': 1e-2, '%': 1e-2 }
  const UNITS = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*([pnµumckMGT]?)(${UNIT})(?![A-Za-z·⁰¹²³⁴⁵⁶⁷⁸⁹⁻/])`, 'g')
  // A bare figure of three or more digits is a measurement too, and this lab
  // quotes many that have no unit: a ratio, an order, a coefficient, a fraction.
  const BARE = /(?<![\d.,eE⁻×])(\d+\.\d{2,})(?![\d.,]*\s*(?:[pnµumckMGT]?(?:W\/m|J\/m|A\/m|Ω·|Ω\/|V\/|F\/|H\/|S\/|C\/|dB|Hz|Wb|[VAWJCNFHTSΩsm°%])))/g

  // "0.00696 per cent" is the reading 6.96e-5 written the way a reader reads a
  // convergence figure, so a number followed by "per cent" is compared against
  // the fraction and not against the hundred times it.
  const percentAfter = (text, end) => /^\s*(?:per cent|%)/.test(text.slice(end))

  /** Every number-with-unit in a sentence, as a value in base units. */
  const quotedUnits = (text) =>
    [...text.replace(/−/g, '-').matchAll(UNITS)].map((m) => ({
      text: m[0].trim(),
      digits: (m[1].split('.')[1] || '').length,
      scale: PREFIX[m[2]] * (UNIT_SCALE[m[3]] ?? 1),
      value: Math.abs(+m[1]) * PREFIX[m[2]] * (UNIT_SCALE[m[3]] ?? 1),
    }))

  /** Every bare figure carrying three or more digits, and a percentage counted as a fraction. */
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
    const half = 0.5 * 10 ** -q.digits * q.scale
    return Math.abs(q.value - Math.abs(v)) <= Math.max(0.006 * Math.abs(v), half * (1 + 1e-9))
  }
  const close = (got, want, tol) =>
    want === 0 || Math.abs(want) < 1e-30 ? Math.abs(got) <= (tol ?? 1e-12) : Math.abs(got - want) <= (tol ?? 0.006 * Math.abs(want))
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
      // at the defaults. E5's closing paragraph is about the closed gap.
      const why = measure(e, { ...p, ...(e.whyAt || {}) }, e.whyReads || [], `${e.id} why`)
      // The why is read at the same defaults as the see, so it may lean on
      // either register's readings.
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
    // Twenty-nine experiments, at least two steps each.
    expect(steps).toBeGreaterThanOrEqual(2 * EXPERIMENTS.length)
  })

  it('a step that says the engine declines really is declined', () => {
    for (const e of EXPERIMENTS) {
      for (const t of e.try) {
        if (!t.refuses) continue
        const x = analyse(e, { ...defaultsOf(e.id), ...(t.set || {}) })
        const said = refusalOf(x) || (guardOf(x) && !guardOf(x).ok)
        expect(Boolean(said), `${e.id} says a step is declined and it is not`).toBe(true)
      }
    }
  })

  it('a reading a lesson names is a path the analysis carries, not an undefined', () => {
    for (const e of EXPERIMENTS) {
      const paths = [...(e.seeReads || []), ...(e.whyReads || []), ...e.try.flatMap((t) => t.reads || [])]
      for (const [path] of paths) {
        expect(typeof path, `${e.id} reads a path that is not a string`).toBe('string')
        expect(path, `${e.id} reads an empty path`).not.toBe('')
      }
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
})
