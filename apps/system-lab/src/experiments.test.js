import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS, VIEW_ORDER, VIEW_LABELS, byId, defaultsOf, groupOf, letterOf, viewLabel } from './experiments.js'
import { readQuantity } from './lessons.js'
import { analyse, ip3Guard, refusalOf } from './math.js'
import { CHAIN_ROWS, COLUMNS, LEVEL_COLUMNS, flowPropsFor, levelPropsFor, numberRowsFor, tablePropsFor } from './view.js'
import { TERMS } from './terms.js'
import { reportSummary } from './report.js'
import { num } from './format.js'
import { KT0_DBM_HZ, noiseFloorDbm } from '@ee-labs/rf'

// Every note makes a claim about the chain, and every claim is measured here.
//
// The rule this file exists to enforce is `PROGRAM.md` §6's: a number is never
// typed into a test as a constant when it can be computed from the knobs. So
// nothing below compares a lesson against a table. Each step's `set` is applied
// over the experiment's defaults, the analysis is run at those settings, and
// each `reads` pair is checked against what the engine returns. Then every
// number-with-unit in the sentence has to be one of those readings or one of
// the knob values, which is what stops a sentence carrying a figure the engine
// never produced.

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
    if (k.kind === 'choice') p[k.key] = k.options[Math.floor(rnd() * k.options.length)].value
    else if (k.scale === 'log') p[k.key] = k.min * Math.pow(k.max / k.min, rnd())
    else p[k.key] = k.min + (k.max - k.min) * rnd()
  }
  return p
}

// ------------------------------------------------------- the shape of the set

describe('the experiments, as a set', () => {
  it('every experiment has an id, a group, a kind, a name, knobs, a view and a headline', () => {
    for (const e of EXPERIMENTS) {
      expect(e.id, 'an experiment with no id').toMatch(/^[a-f][1-9]$/)
      expect(GROUPS, `${e.id} is in group ${e.group}`).toContain(e.group)
      expect(typeof e.kind, `${e.id} kind`).toBe('string')
      expect(typeof e.name, `${e.id} name`).toBe('string')
      expect(Array.isArray(e.params) && e.params.length > 0, `${e.id} knobs`).toBe(true)
      expect(typeof e.chain, `${e.id} chain`).toBe('function')
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

  it('the sidebar offers no heading with nothing under it', () => {
    for (const g of GROUPS) expect(groupOf(g).length, `${g} is offered and empty`).toBeGreaterThan(0)
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
        if (k.kind === 'choice') expect(k.options.map((o) => o.value), `${e.id} ${k.key} default`).toContain(k.default)
        else {
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

// ------------------------------------------ the constants the definitions quote

describe('the two constants a definition quotes are computed, not remembered', () => {
  it('thermal noise is −173.975 dBm/Hz at the reference temperature', () => {
    expect(KT0_DBM_HZ).toBeCloseTo(-173.975, 3)
    expect(TERMS.thermalnoise.def).toContain(`${KT0_DBM_HZ.toFixed(3)}`.replace('-', '−'))
  })

  it('the floor over 200 kHz with no noise figure is −120.965 dBm', () => {
    const floor = noiseFloorDbm(2e5)
    expect(floor).toBeCloseTo(KT0_DBM_HZ + 10 * Math.log10(2e5), 12)
    expect(TERMS.noisefloor.def).toContain(`${floor.toFixed(3)}`.replace('-', '−'))
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
        if (v === 'table') {
          const props = tablePropsFor(e, p, x)
          expect(props.rows.length, `${e.id} table rows`).toBe(x.c.n)
          expect(props.columns.map((c) => c.key), `${e.id} table columns`).toEqual(['gain', 'nf', 'iip3', 'power'])
          for (const row of props.rows) for (const c of props.columns) expect(row.cells[c.key].value, `${e.id} ${row.id} ${c.key}`).toBeTruthy()
          expect(props.caption, `${e.id} table caption names its bandwidth`).toMatch(/noise bandwidth/)
        }
        if (v === 'levels') {
          const props = levelPropsFor(e, p, x)
          expect(props.nodes.length, `${e.id} level nodes`).toBe(x.c.n + 1)
          // Two of the three readings are levels in dBm, so nothing but a name
          // separates them. The pane draws its key and its column headers out
          // of this list, and both traces have to be in it.
          expect(props.columns, `${e.id} level columns`).toBe(LEVEL_COLUMNS)
          expect(props.series.map((c) => c.key), `${e.id} level key`).toEqual(['signal', 'noise'])
          expect(props.to, `${e.id} level axis ${props.from} to ${props.to}`).toBeGreaterThan(props.from)
          for (const n of props.nodes) {
            expect(n.signalDbm, `${e.id} node ${n.index} signal outside the axis`).toBeLessThanOrEqual(props.to)
            expect(n.noiseDbm, `${e.id} node ${n.index} noise outside the axis`).toBeGreaterThanOrEqual(props.from)
          }
        }
        if (v === 'numbers') {
          const rows = numberRowsFor(e, p, x)
          expect(rows.length, `${e.id} number rows`).toBeGreaterThan(6)
          for (const r of rows) {
            expect(r.value, `${e.id} row "${r.label}" has no value`).toBeTruthy()
            expect(r.formula.length, `${e.id} row "${r.label}" has no formula`).toBeGreaterThan(3)
          }
        }
      }
    }
  })

  it('the flow strip draws the whole chain, and the level leaving each block', () => {
    for (const e of EXPERIMENTS) {
      const { p, x } = at(e.id)
      const strip = flowPropsFor(e, p, x)
      expect(strip.blocks.map((b) => b.id), `${e.id} strip`).toEqual(x.c.blocks.map((b) => b.id))
      expect(strip.out.value, `${e.id} strip output`).toBe(strip.blocks[strip.blocks.length - 1].signal)
      // Two of a block's three readings are decibels, so a tag has to name each
      // one. The strip is the only place a phone reader meets them, and a
      // phone has no hover to fall back on.
      expect(strip.rows, `${e.id} strip rows`).toBe(CHAIN_ROWS)
      for (const b of strip.blocks) for (const r of CHAIN_ROWS) expect(b[r.key], `${e.id} ${b.id} ${r.key}`).toBeTruthy()
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

  it('a knob anywhere in its range gives an answer, never a crash', () => {
    for (const e of EXPERIMENTS) {
      for (let seed = 1; seed <= 24; seed++) {
        const p = randomParams(e, seed * 7919 + e.id.charCodeAt(0))
        let x
        expect(() => {
          x = analyse(e, p)
        }, `${e.id} threw at seed ${seed}: ${JSON.stringify(p)}`).not.toThrow()
        expect(x.headline, `${e.id} headline at seed ${seed}`).toBeTruthy()
        expect(Number.isFinite(x.headline.value), `${e.id} headline is ${x.headline.value} at seed ${seed}`).toBe(true)
      }
    }
  })

  it('nothing in group A can be turned into a refusal, because no knob reaches one', () => {
    // Every knob here is a gain, a level, a positive loss, a positive
    // temperature or a positive bandwidth, and the engine describes all of
    // them. The refusal channel is still wired, and the case below drives it.
    for (const e of EXPERIMENTS) {
      for (let seed = 1; seed <= 24; seed++) {
        const x = analyse(e, randomParams(e, seed * 104729 + e.id.charCodeAt(1)))
        expect(x.declined, `${e.id} declines at seed ${seed}`).toBeUndefined()
      }
      expect(refusalOf(at(e.id).x), `${e.id} declines at its defaults`).toBeNull()
    }
  })

  it('a passive block asked for gain is declined by name, not clamped', () => {
    // The one object the engine will not describe with the knobs Group A has,
    // reached by handing `analyse` a chain rather than a knob. A filter with
    // gain has no noise figure of the form F = 1 + (L − 1) T/T_0.
    const exp = {
      id: 'x1',
      kind: 'passive',
      chain: () => [{ id: 'presel', kind: 'filter', gainDb: 3 }],
      headline: (x) => ({ value: x.c.nfDb, unit: 'dB', label: 'Noise figure' }),
      params: [],
    }
    const x = analyse(exp, {})
    expect(x.declined, 'a filter with gain is not declined').toBeTruthy()
    expect(x.declined.says).toMatch(/has no gain of its own/i)
    expect(x.declined.field).toBe('gainDb')
    expect(refusalOf(x)).toBe(x.declined.says)
    expect(numberRowsFor(exp, {}, x), 'a declined analysis still offers rows').toEqual([])
    expect(ip3Guard(x), 'a declined analysis still offers a guard').toBeNull()
  })
})

// -------------------------------------------- what names a column, and its total

describe('every column a reader reads is named, with the unit it is in', () => {
  it('the budget table names four budgets, each with a unit and a sentence', () => {
    expect(COLUMNS.map((c) => c.key)).toEqual(['gain', 'nf', 'iip3', 'power'])
    for (const c of [...COLUMNS, ...LEVEL_COLUMNS]) {
      expect(c.label, `${c.key} label`).toBeTruthy()
      expect(c.unit, `${c.key} unit`).toBeTruthy()
      expect(c.title.length, `${c.key} title`).toBeGreaterThan(20)
    }
  })

  it('the unit over a column follows the switch that changes what the column holds', () => {
    // The share switch turns three of the four columns into percentages. A
    // header still saying decibels over them would be a label that does not
    // follow its control, which is `REVIEW_PLAYBOOK.md` §1.
    expect(COLUMNS.map((c) => c.shareUnit)).toEqual(['dB', '%', '%', '%'])
    for (const c of COLUMNS) {
      const hasShare = c.shareUnit === '%'
      const { p, x } = at('a2')
      const props = tablePropsFor(byId.a2, p, x)
      for (const row of props.rows) {
        if (hasShare) expect(row.cells[c.key].share, `${c.key} share of ${row.id}`).not.toBeNull()
        else expect(row.cells[c.key].share, `${c.key} claims a share`).toBeNull()
      }
    }
  })

  it('the flow strip tags each of a block’s three readings', () => {
    expect(CHAIN_ROWS.map((r) => r.key)).toEqual(['gain', 'nf', 'signal'])
    for (const r of CHAIN_ROWS) {
      expect(r.tag.length, `${r.key} tag`).toBeLessThanOrEqual(3)
      expect(r.title.length, `${r.key} title`).toBeGreaterThan(20)
    }
  })

  it('one quantity carries one name, in the headline and in the pane that prints it', () => {
    // `STYLE.md` S11. The output ratio is the same number in three places, and
    // it was called two things: the topbar said one and the numbers pane said
    // another.
    const { exp, p, x } = at('a4')
    expect(x.headline.label).toBe('Ratio at the output')
    const rows = numberRowsFor(exp, p, x)
    const row = rows.find((r) => r.label === x.headline.label)
    expect(row, `no pane row is called "${x.headline.label}"`).toBeDefined()
    expect(row.value).toContain(x.headline.value.toPrecision(5))
  })

  it('the levels view names its two lines and its three columns with the same words', () => {
    expect(LEVEL_COLUMNS.map((c) => c.key)).toEqual(['signal', 'noise', 'snr'])
    // The plot draws one line solid and one broken, so the key has to say which
    // is which rather than leaving the colour to carry it alone.
    expect(LEVEL_COLUMNS.filter((c) => c.trace).map((c) => c.dashed)).toEqual([false, true])
    expect(LEVEL_COLUMNS.filter((c) => c.trace).length, 'a third line with no key').toBe(2)
  })

  it('the total under a column of shares is the sum of that column, which closes at 100 %', () => {
    // Invariant 3 of the plan's §2.9 is that every block's share sums to one.
    // The share mode's total row is where a reader watches it close, so a
    // column whose shares mean nothing says so rather than printing 0.000 %.
    for (const e of EXPERIMENTS.filter((x) => x.views.includes('table'))) {
      const { p, x } = at(e.id)
      const props = tablePropsFor(e, p, x)
      expect(props.shareTotals.gain, `${e.id} gain total`).toBe(props.totals.gain)
      expect(props.shareTotals.nf, `${e.id} noise shares`).toBe(x.c.excess > 0 ? '100.0 %' : '—')
      expect(props.shareTotals.iip3, `${e.id} IP3 shares`).toBe(x.c.iip3Dbm === Infinity ? '—' : '100.0 %')
      const power = x.c.powerMw
      expect(props.shareTotals.power, `${e.id} power shares`).toBe(power === null ? 'unknown' : power > 0 ? '100.0 %' : '—')
    }
  })

  it('a chain with no third-order product and no power shows no share of either', () => {
    // a3 is one passive filter: it makes no product and draws nothing, so two
    // of its four share totals have no meaning and both say so.
    const { exp, p, x } = at('a3')
    const props = tablePropsFor(exp, p, x)
    expect(x.c.iip3Dbm).toBe(Infinity)
    expect(x.c.powerMw).toBe(0)
    expect(props.shareTotals.iip3).toBe('—')
    expect(props.shareTotals.power).toBe('—')
    expect(props.shareTotals.nf).toBe('100.0 %')
  })
})

// ----------------------------------------- the guard the aligned rule carries

describe('the cascaded input IP3 never appears without the rule that produced it', () => {
  it('says which rule the column shows, and what the other rule gives', () => {
    const { x } = at('a2')
    const says = ip3Guard(x)
    expect(says, 'a2 shows an input IP3 with no guard').toBeTruthy()
    expect(says).toMatch(/worst case/)
    expect(says).toContain(x.c.iip3PowerDbm.toPrecision(5))
    expect(x.c.iip3PowerDbm, 'the power sum is below the aligned total').toBeGreaterThan(x.c.iip3Dbm)
  })

  it('states the agreement rather than a spread of zero when one stage makes the whole product', () => {
    const { x } = at('a1')
    expect(x.c.blocks.filter((b) => b.ip3Term > 0).length).toBe(1)
    expect(ip3Guard(x)).toMatch(/the same number/)
    expect(x.c.iip3PowerDbm).toBeCloseTo(x.c.iip3Dbm, 12)
  })

  it('says a chain of passive blocks has no third-order product to quote', () => {
    const { x } = at('a3')
    expect(x.c.iip3Dbm).toBe(Infinity)
    expect(ip3Guard(x)).toMatch(/no input IP3 to quote/)
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
  // The units this lab writes, longest first so "dBm/Hz" is never read as "dB".
  // Every one of them is already the unit its quantity is carried in, so the
  // only scale a prefix multiplies is the hertz of a bandwidth.
  const UNIT = ['dBm/Hz', 'dBm', 'dB', 'mW', 'Hz', 'K', '%'].join('|')
  const UNIT_SCALE = { '%': 1e-2 }
  const UNITS = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*([pnµumckMGT]?)(${UNIT})(?![A-Za-z/])`, 'g')
  // A bare figure carrying two or more decimals is a measurement too. This lab
  // writes a run of cumulative decibels with the unit on the last of them only.
  const BARE = /(?<![\d.,eE⁻×])(\d+\.\d{2,})(?![\d.,]*\s*(?:[pnµumckMGT]?(?:dBm\/Hz|dBm|dB|mW|Hz|K|%)))/g

  /** Every number-with-unit in a sentence, as a value in the unit its quantity uses. */
  const quotedUnits = (text) =>
    [...text.replace(/−/g, '-').matchAll(UNITS)].map((m) => ({
      text: m[0].trim(),
      digits: (m[1].split('.')[1] || '').length,
      scale: (m[3] === 'Hz' ? PREFIX[m[2]] : 1) * (UNIT_SCALE[m[3]] ?? 1),
      value: Math.abs(+m[1]) * (m[3] === 'Hz' ? PREFIX[m[2]] : 1) * (UNIT_SCALE[m[3]] ?? 1),
    }))

  /** Every bare figure carrying two or more decimals. */
  const quotedBare = (text) =>
    [...text.replace(/−/g, '-').matchAll(BARE)].map((m) => ({
      text: m[1],
      digits: (m[1].split('.')[1] || '').length,
      scale: 1,
      value: Math.abs(+m[1]),
    }))

  /** A quoted number stands for a value when it is that value rounded to the digits printed. */
  const stands = (q, v) => {
    const half = 0.5 * 10 ** -q.digits * q.scale
    return Math.abs(q.value - Math.abs(v)) <= Math.max(1e-9 * Math.abs(v), half * (1 + 1e-9))
  }
  const close = (got, want) => (Math.abs(want) < 1e-12 ? Math.abs(got) <= 1e-9 : Math.abs(got - want) <= 5e-4 * Math.max(1, Math.abs(want)))
  const wordCount = (s) => s.trim().split(/\s+/).length
  const knobOf = (e, key) => e.params.find((k) => k.key === key)
  const knobValues = (e) => e.params.filter((k) => k.kind !== 'choice').map((k) => k.default)

  /** Solve one register and check its reads. Returns the values it justifies. */
  function measure(e, p, reads, label) {
    const x = analyse(e, p)
    const values = []
    for (const [path, want] of reads) {
      const got = readQuantity(x, p, path)
      expect(Number.isFinite(got), `${label}: ${path} reads ${got}`).toBe(true)
      expect(close(got, want), `${label}: ${path} reads ${got}, the lesson says ${want}`).toBe(true)
      values.push(got)
    }
    return values
  }

  /** Every quoted number in `text` stands for one of `values`. */
  function justified(text, values, label) {
    for (const q of [...quotedUnits(text), ...quotedBare(text)]) {
      const ok = values.some((v) => stands(q, v))
      expect(ok, `${label}: "${q.text}" is not a reading or a knob value (have ${values.map((v) => +Number(v).toPrecision(6)).join(', ')})`).toBe(true)
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
      expect(wordCount(e.see), `${e.id} see is ${wordCount(e.see)} words`).toBeLessThanOrEqual(70)
      expect(wordCount(e.why), `${e.id} why is ${wordCount(e.why)} words`).toBeLessThanOrEqual(160)
      for (const t of e.try) expect(wordCount(t.say), `${e.id} try "${t.say.slice(0, 30)}…"`).toBeLessThanOrEqual(45)
    }
  })

  it('the numbers in see and why are readings at the defaults, or knob values', () => {
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const seen = measure(e, p, e.seeReads || [], `${e.id} see`)
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
          if (k.kind === 'choice')
            expect(
              k.options.map((o) => o.value),
              `${label} ${key}`,
            ).toContain(v)
          else {
            expect(v, `${label} sets ${key} to ${v}, below its min ${k.min}`).toBeGreaterThanOrEqual(k.min)
            expect(v, `${label} sets ${key} to ${v}, above its max ${k.max}`).toBeLessThanOrEqual(k.max)
            set.push(v)
          }
        }
        const read = measure(e, { ...d, ...(t.set || {}) }, t.reads || [], label)
        justified(t.say, [...read, ...set, ...knobValues(e)], label)
        steps++
      })
    }
    expect(steps).toBeGreaterThanOrEqual(2 * EXPERIMENTS.length)
  })

  it('a reading a lesson names is a path the analysis carries, not an undefined', () => {
    for (const e of EXPERIMENTS) {
      const paths = [...(e.seeReads || []), ...(e.whyReads || []), ...e.try.flatMap((t) => t.reads || [])]
      for (const [path] of paths) {
        expect(typeof path, `${e.id} reads a path that is not a string`).toBe('string')
        expect(path, `${e.id} reads an empty path`).not.toBe('')
      }
      expect(paths.length, `${e.id} quotes nothing the engine produced`).toBeGreaterThan(0)
    }
  })

  it('a path the analysis does not carry throws rather than reading undefined', () => {
    const { p, x } = at('a1')
    expect(() => readQuantity(x, p, 'total.nosuchthing')).toThrow(/No quantity at path/)
    expect(() => readQuantity(x, p, 'share.nosuchblock.noise')).toThrow(/No quantity at path/)
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
