import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS, VIEW_LABELS, VIEW_ORDER } from './experiments.js'
import { analyse, defaultsOf } from './analysis.js'
import { readQuantity } from './quantities.js'
import { drawOf } from './layouts.js'
import { TERMS } from './terms.js'

// Every claim a lesson makes, measured against the model that makes it.
//
// Each experiment is solved at its defaults and again at every `try` step's
// setting. Each `reads` pair is checked against the solve. Then every
// number-with-a-unit in the prose is checked against the pool of values the
// experiment pinned, so a sentence cannot carry a figure nothing computed.
//
// A tolerance is relative and defaults to half a per cent, which is the
// rounding a written number carries. A pair may name an absolute tolerance as
// its third entry, for a quantity whose true value is zero.

const REL = 5e-3

const read = (x, path) => (typeof path === 'function' ? path(x, x.params) : readQuantity(x, path))

function check(x, pairs, label) {
  for (const [path, want, tol] of pairs || []) {
    const got = read(x, path)
    const name = typeof path === 'function' ? `${label} fn` : `${label} ${path}`
    expect(Number.isFinite(got), `${name} is not a number`).toBe(true)
    if (tol !== undefined) expect(Math.abs(got - want), `${name}: ${got} against ${want}`).toBeLessThanOrEqual(tol)
    else expect(Math.abs(got - want) / Math.max(Math.abs(want), 1e-300), `${name}: ${got} against ${want}`).toBeLessThanOrEqual(REL)
  }
}

// ------------------------------------------------------------ the prose's numbers

// A unit as it appears in the lessons, longest first so that "V·s/rad" is not
// read as "V". `min` and `s` are last, because "rev/min" already ate its own.
const UNITS = ['rev/min', 'V·s/rad', 'kg·m²', 'rad/s', 'N·m', '°C', 'var', 'VA', 'Wb', 'Hz', 'min', 'Ω', 'V', 'A', 'W', 'H', 'K', 's', '%']
const PREFIX = { '': 1, m: 1e-3, k: 1e3, M: 1e6, µ: 1e-6, n: 1e-9, G: 1e9 }
// A prefix only applies to a unit that takes one. "ms" is milliseconds and
// "min" is minutes, so the list above is checked before the prefix is peeled.
const PREFIXED = new Set(['V', 'A', 'W', 'H', 'Wb', 'Hz', 'Ω', 's'])

const NUMBER = new RegExp(
  `(-?\\d+(?:\\.\\d+)?)\\s*(${UNITS.map((u) => u.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|')})(?![a-zA-Z])`,
  'g',
)

/** Every number with a unit in a sentence, in SI. */
export function numbersIn(text) {
  const s = String(text || '').replace(/[−–]/g, '-')
  const out = []
  // Try the prefixed forms first: "30 mH", "2.5 ms", "1.5 kW".
  const withPrefix = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*([mkMµnG])(${[...PREFIXED].join('|')})(?![a-zA-Z])`, 'g')
  const taken = []
  for (const m of s.matchAll(withPrefix)) {
    if (m[2] + m[3] === 'min') continue
    taken.push([m.index, m.index + m[0].length])
    out.push({ value: Number(m[1]) * PREFIX[m[2]], text: m[0] })
  }
  for (const m of s.matchAll(NUMBER)) {
    if (taken.some(([a, b]) => m.index >= a && m.index < b)) continue
    // The character before a bare unit may be the prefix already taken above.
    out.push({ value: Number(m[1]), text: m[0] })
  }
  return out
}

/** Every value the experiment pinned, at any step, plus its knob settings. */
function pool(exp) {
  const defaults = defaultsOf(exp)
  const values = Object.values(defaults).filter((v) => typeof v === 'number')
  const add = (pairs) => {
    for (const [, want] of pairs || []) if (typeof want === 'number') values.push(want)
  }
  add(exp.seeReads)
  add(exp.whyReads)
  for (const step of exp.try || []) {
    add(step.reads)
    for (const v of Object.values(step.set || {})) if (typeof v === 'number') values.push(v)
  }
  return values
}

/** Is `value` one of the pinned numbers, to the rounding a written figure has? */
function pinned(value, values) {
  return values.some((v) => (v === 0 ? value === 0 : Math.abs(v - value) / Math.abs(v) <= 6e-3))
}

// ------------------------------------------------------------------ the checks

describe('the experiment list', () => {
  it('has 35 experiments in five groups, with unique ids', () => {
    expect(EXPERIMENTS).toHaveLength(35)
    expect(GROUPS).toHaveLength(5)
    expect(new Set(EXPERIMENTS.map((e) => e.id)).size).toBe(35)
    for (const g of GROUPS) expect(EXPERIMENTS.filter((e) => e.group === g).length).toBeGreaterThan(0)
  })

  it('counts each group as the plan does', () => {
    const counts = GROUPS.map((g) => EXPERIMENTS.filter((e) => e.group === g).length)
    expect(counts).toEqual([8, 6, 9, 7, 5])
  })

  it('opens on a view it also lists, and every view is one the switch knows', () => {
    for (const e of EXPERIMENTS) {
      expect(e.views, `${e.id} views`).toContain(e.view)
      for (const v of e.views) {
        expect(VIEW_ORDER, `${e.id} view ${v}`).toContain(v)
        expect(VIEW_LABELS[v], `${e.id} view ${v}`).toBeDefined()
      }
    }
  })

  it('names only terms the registry defines', () => {
    for (const e of EXPERIMENTS) for (const t of e.terms || []) expect(TERMS[t], `${e.id} term ${t}`).toBeDefined()
  })

  it('keeps every knob default inside its own range', () => {
    for (const e of EXPERIMENTS)
      for (const p of e.params) {
        if (p.kind === 'toggle' || p.kind === 'choice') continue
        expect(p.default, `${e.id} ${p.key}`).toBeGreaterThanOrEqual(p.min)
        expect(p.default, `${e.id} ${p.key}`).toBeLessThanOrEqual(p.max)
        expect(p.unit, `${e.id} ${p.key} has no unit`).toBeDefined()
      }
  })

  it('gives every choice knob a default it offers', () => {
    for (const e of EXPERIMENTS)
      for (const p of e.params)
        if (p.kind === 'choice') expect(p.options.map((o) => o.value), `${e.id} ${p.key}`).toContain(p.default)
  })
})

describe('every experiment solves at its defaults', () => {
  for (const exp of EXPERIMENTS) {
    it(`${exp.id} ${exp.name}`, () => {
      const x = analyse(exp, defaultsOf(exp))
      expect(x.spec).toBeDefined()
      if (x.sol) expect(Math.abs(x.sol.maxResidual)).toBeLessThan(1e-6 * Math.max(1, Math.abs(x.sol.pTotal) + 1))
      if (x.ac) expect(x.ac.maxResidual).toBeLessThan(1e-6)
      const draw = drawOf(x)
      if (draw) {
        for (const item of draw.layout.items)
          if (item.el) expect(draw.elements.find((e) => e.id === item.el), `${exp.id} draws ${item.el}`).toBeDefined()
      }
    })
  }
})

describe('every lesson is written', () => {
  for (const exp of EXPERIMENTS) {
    it(`${exp.id} has all three registers`, () => {
      expect(typeof exp.see, `${exp.id} see`).toBe('string')
      expect(typeof exp.why, `${exp.id} why`).toBe('string')
      expect(Array.isArray(exp.try) && exp.try.length > 0, `${exp.id} try`).toBe(true)
      expect(Array.isArray(exp.seeReads) && exp.seeReads.length > 0, `${exp.id} seeReads`).toBe(true)
      for (const step of exp.try) expect(typeof step.say, `${exp.id} try say`).toBe('string')
    })
  }
})

describe('every number a lesson quotes is one the model produces', () => {
  for (const exp of EXPERIMENTS) {
    it(`${exp.id} ${exp.name}`, () => {
      const defaults = defaultsOf(exp)
      const x = analyse(exp, defaults)
      check(x, exp.seeReads, `${exp.id} see`)
      check(x, exp.whyReads, `${exp.id} why`)
      exp.try.forEach((step, k) => {
        const y = analyse(exp, { ...defaults, ...(step.set || {}) })
        check(y, step.reads, `${exp.id} try[${k}]`)
      })
    })
  }
})

describe('no sentence carries a number nothing pinned', () => {
  for (const exp of EXPERIMENTS) {
    it(`${exp.id} ${exp.name}`, () => {
      const values = pool(exp)
      const texts = [
        [`${exp.id} see`, exp.see],
        [`${exp.id} why`, exp.why],
        ...exp.try.map((s, k) => [`${exp.id} try[${k}]`, s.say]),
      ]
      for (const [label, text] of texts)
        for (const { value, text: token } of numbersIn(text))
          expect(pinned(value, values), `${label}: "${token}" is not pinned by any reads pair`).toBe(true)
    })
  }
})
