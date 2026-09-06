import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS, VIEW_LABELS, VIEW_ORDER, byId, defaultsOf, groupOf, letterOf, viewLabel } from './experiments.js'
import { readQuantity } from './lessons.js'
import { analyse, guardOf, refusalOf } from './math.js'
import { numbersFor, schematicFor } from './view.js'
import { TERMS } from './terms.js'
import { reportSummary } from './report.js'
import { num } from './format.js'

// Every note makes a claim about light, and every claim is measured here.
//
// The rule this file exists to enforce is `PROGRAM.md` §6's: a number is never
// typed into a test as a constant when it can be computed from the knobs. So
// nothing below compares a lesson against a table. Each step's `set` is applied
// over the experiment's defaults, the analysis is run at those settings, and
// each `reads` pair is checked against what the engine returns. Then every
// number-with-unit in the sentence has to be one of those readings or one of
// the knob values, which is what stops a sentence from carrying a figure the
// engine never produced.
//
// The lab's own rule sits on top of that. A rate limit is quoted with the
// criterion it was read under, and a mode count above V = 2.405 is quoted as
// the estimate it is. Both are checked below.

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
    if (k.scale === 'log') p[k.key] = k.min * Math.pow(k.max / k.min, rnd())
    else p[k.key] = k.min + (k.max - k.min) * rnd()
    if (k.integer) p[k.key] = Math.max(k.min, Math.round(p[k.key]))
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

  it('this sitting ships Groups A, C, D, E and F, and nothing references B', () => {
    expect(GROUPS.map((g) => g.slice(0, 1))).toEqual(['A', 'C', 'D', 'E', 'F'])
    expect(EXPERIMENTS.length).toBe(21)
    expect(GROUPS.map((g) => groupOf(g).length)).toEqual([5, 5, 4, 5, 2])
    // A lesson that pointed at an experiment this lab has not built would send
    // a reader to a button that is not there. Group B is named in the plan and
    // in the backlog, and nowhere a reader can read.
    const prose = EXPERIMENTS.flatMap((e) => [e.name, e.see, e.why, ...e.try.map((t) => t.say)]).join(' ')
    expect(prose).not.toMatch(/\bb[1-9]\b/i)
    // A cross-lab reference names the lab it points into. A bare "Group B"
    // would read as this lab's, and this lab has no Group B yet.
    expect(prose).not.toMatch(/(?<!Lab’s )Group B\b/)
    // Every c or d id a lesson names is one that exists, because those two
    // groups are built now and a signpost into them has somewhere to land.
    const ids = new Set(EXPERIMENTS.map((e) => e.id))
    for (const m of prose.matchAll(/\b([A-F][1-9])\b/g)) {
      const id = m[1].toLowerCase()
      if (id[0] === 'c' || id[0] === 'd') expect(ids.has(id), `a lesson names ${m[1]}`).toBe(true)
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
        expect(k.default, `${e.id} ${k.key} default below its min`).toBeGreaterThanOrEqual(k.min)
        expect(k.default, `${e.id} ${k.key} default above its max`).toBeLessThanOrEqual(k.max)
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
      expect(num(x.headline.value, x.headline.unit), `${e.id} headline formats`).not.toBe('—')
    }
  })

  it('no reading on screen ends in a prefix letter with no unit behind it', () => {
    // An engineering prefix puts a letter where a unit goes. A numerical
    // aperture of 0.12461 printed as "124.61 m" is a length to every reader,
    // and a photon density of 4.9793e20 per cubic metre printed as
    // "497930000 Tm⁻³" is nothing at all. Both shipped. The rule is measured
    // over every headline and every row of every numbers pane.
    const stray = /\d\s?[TGMkµmunpf]$/
    for (const e of EXPERIMENTS) {
      const { p, x } = at(e.id)
      const head = num(x.headline.value, x.headline.unit)
      expect(stray.test(head), `${e.id} headline reads "${head}"`).toBe(false)
      for (const r of numbersFor(e, x, p)) {
        expect(stray.test(String(r.value)), `${e.id} row "${r.label}" reads "${r.value}"`).toBe(false)
        // Nothing a reader sees carries JavaScript's own exponent.
        expect(String(r.value), `${e.id} row "${r.label}"`).not.toMatch(/e[+-]\d/)
      }
    }
  })

  it('a density past the prefix table is written as a mantissa and a power of ten', () => {
    // Group D's prose writes 1.6713 × 10²⁴ m⁻³, and the panes write it the same
    // way. One name and one notation for one quantity, per STYLE.md S11.
    const { x } = at('d1')
    expect(num(x.n, 'm⁻³')).toBe('1.6713 × 10²⁴ m⁻³')
    expect(num(x.s, 'm⁻³')).toBe('4.9793 × 10²⁰ m⁻³')
    // A value the table does reach keeps its prefix, because that is what a
    // reader of a datasheet expects.
    expect(num(x.ith, 'A')).toBe('13.389 mA')
  })

  it('every view an experiment offers has something to draw', () => {
    for (const e of EXPERIMENTS) {
      const { p, x } = at(e.id)
      for (const v of e.views) {
        if (v === 'numbers') expect(numbersFor(e, x, p).length, `${e.id} numbers pane is empty`).toBeGreaterThan(2)
        if (v === 'schematic') {
          const s = schematicFor(x)
          expect(s, `${e.id} offers the circuit view with no circuit`).toBeTruthy()
          // The photodiode is four elements and three nodes, and the forward
          // junction Group C loads is three and two. Both are what the netlist
          // handed the solver, and the meter is read at the device's own node.
          const node = x.pd ? 'c' : 'a'
          expect(s.elements.length, `${e.id} circuit elements`).toBe(x.pd ? 4 : 3)
          expect(Number.isFinite(s.meters.v[node]), `${e.id} node ${node} has no meter`).toBe(true)
        }
        if (v === 'curve') {
          const c = e.curve(x, p)
          expect(c.series.length, `${e.id} curve has no series`).toBeGreaterThan(0)
          expect(c.x.to, `${e.id} curve x range`).toBeGreaterThan(c.x.from)
          expect(c.yLabel.length, `${e.id} curve y label`).toBeGreaterThan(2)
          // Every sample the canvas will take has to be a number, or a gap the
          // canvas already knows to skip.
          for (const s of c.series) {
            const mid = s.read(c.x.log ? Math.sqrt(c.x.from * c.x.to) : (c.x.from + c.x.to) / 2)
            expect(Number.isFinite(mid), `${e.id} curve reads ${mid} halfway along`).toBe(true)
          }
        }
        if (v === 'pulse') expect(Number.isFinite(x.disp.spread), `${e.id} offers the pulse view with no spread`).toBe(true)
        if (v === 'link') expect(x.budget.items.length, `${e.id} offers the link view with no budget`).toBeGreaterThan(3)
        if (v === 'cavity') expect(x.sweep.peaks.length, `${e.id} offers the cavity view with no peaks`).toBeGreaterThan(1)
        if (v === 'spectrum') expect(x.centres.length, `${e.id} offers the spectrum view with no channels`).toBeGreaterThan(1)
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
    let refused = 0
    for (const e of EXPERIMENTS) {
      for (let seed = 1; seed <= 12; seed++) {
        const p = randomParams(e, seed * 7919 + e.id.charCodeAt(0) * 31 + e.id.charCodeAt(1))
        let x
        expect(() => {
          x = analyse(e, p)
        }, `${e.id} threw at seed ${seed}: ${JSON.stringify(p)}`).not.toThrow()
        expect(x.headline, `${e.id} headline at seed ${seed}`).toBeTruthy()
        if (x.declined) {
          refused++
          expect(x.declined.says.length, `${e.id} decline message at seed ${seed}`).toBeGreaterThan(20)
        } else {
          expect(Number.isFinite(x.headline.value), `${e.id} headline is ${x.headline.value} at seed ${seed}`).toBe(true)
        }
      }
    }
    // A cladding index above the core's is one of the settings the knobs can
    // reach and the engine will not describe, so the sweep must find some.
    expect(refused).toBeGreaterThan(0)
  })

  it('a cladding index above the core’s is declined by name, not clamped', () => {
    const { x } = at('e4', { n1: 1.44, n2: 1.47 })
    expect(x.declined, 'e4 with n2 above n1 is not declined').toBeTruthy()
    expect(x.declined.says).toMatch(/core index n1 must be larger than the cladding index n2/i)
    expect(x.declined.field).toBe('n1')
  })

  it('one experiment ships a guard, and it is the one that ships an approximation', () => {
    // Every other experiment in the lab states something exactly, so a guard on
    // one of them would be a hedge on an exact mapping. D4 is the exception,
    // and its guard carries the error it measured at the depth on screen.
    const guarded = EXPERIMENTS.filter((e) => guardOf(at(e.id).x))
    expect(guarded.map((e) => e.id)).toEqual(['d4'])
    const g = guardOf(at('d4').x)
    expect(g.error).toBeGreaterThan(0)
    expect(g.says).toContain(`${(100 * g.error).toPrecision(4)} %`)
    expect(g.warn).toBeLessThan(g.decline)
  })
})

// -------------------------------------------------- the criterion and the estimate

describe('a number that depends on a stated choice carries the choice', () => {
  it('a rate limit is returned with the criterion it was read under', () => {
    const { x } = at('e3')
    expect(x.limit.criterion).toBe(defaultsOf('e3').criterion)
    expect(x.limit.text).toMatch(/0\.25/)
    // Twice the criterion is twice the rate on one fibre, and neither is more
    // correct than the other. A number with no criterion beside it would be.
    const loose = at('e3', { criterion: 0.5 }).x
    expect(loose.limit.rate / x.limit.rate).toBeCloseTo(2, 12)
  })

  it('the criterion is printed on the numbers pane, not only carried in the analysis', () => {
    const { exp, p, x } = at('e3')
    const rows = numbersFor(exp, x, p)
    const row = rows.find((r) => r.label === 'Criterion')
    expect(row, 'the criterion has no row').toBeTruthy()
    expect(row.formula).toBe(x.limit.text)
  })

  it('a mode count above the single-mode limit is labelled an estimate, and one below it is not', () => {
    const wide = at('e4', { a: 25e-6, lambda: 850e-9 }).x
    expect(wide.geo.estimate).toBe(true)
    expect(wide.geo.v).toBeGreaterThan(wide.geo.vLimit)
    const narrow = at('e4').x
    expect(narrow.geo.estimate).toBe(false)
    expect(narrow.geo.modes).toBe(1)
    const { exp, p } = at('e4', { a: 25e-6, lambda: 850e-9 })
    const row = numbersFor(exp, wide, p).find((r) => r.label === 'Modes carried')
    expect(row.value).toMatch(/estimate/)
  })

  it('a number exact only for a stated model carries that model on its pane', () => {
    // CORE_SCOPE.md. The LED's linear output and the laser's two fixed
    // efficiencies are each exact for a model and not for a device, so the
    // sentence naming the model is a row beside the number, in both groups.
    for (const id of ['c2', 'c3']) {
      const { exp, p, x } = at(id)
      const rows = numbersFor(exp, x, p).filter((r) => r.label === 'The model')
      expect(rows.length, `${id} names no model`).toBeGreaterThan(0)
      for (const r of rows) expect(r.formula.length, `${id} model sentence`).toBeGreaterThan(30)
    }
    for (const id of ['c4', 'c5']) {
      const { exp, p, x } = at(id)
      const row = numbersFor(exp, x, p).find((r) => r.label === 'The model')
      expect(row, `${id} names no model`).toBeTruthy()
      expect(row.formula).toBe(x.laser.model)
    }
  })

  it('a response is described by its phase as well as its magnitude', () => {
    // REVIEW_PLAYBOOK.md §3. One pole lags exactly 45 degrees at its corner and
    // a second order lags exactly 90 at its natural frequency, whatever the
    // damping. Both are read off the same H the magnitude came from.
    const led = at('c3')
    expect(led.x.band.phaseAtCorner).toBeCloseTo(-45, 12)
    const ledRow = numbersFor(led.exp, led.x, led.p).find((r) => r.label === 'Phase at the corner')
    expect(ledRow.value).toBe('-45.00°')
    const laser = at('d3')
    expect(laser.x.phaseAtFr).toBeCloseTo(-90, 11)
    const row = numbersFor(laser.exp, laser.x, laser.p).find((r) => r.label === 'Phase at the relaxation frequency')
    expect(row.value).toBe('-90.00°')
    // The peak sits below the natural frequency, so it lags a little less.
    expect(laser.x.phaseAtPeak).toBeGreaterThan(-90)
    expect(laser.x.phaseAt3db).toBeLessThan(-90)
  })

  it('a budget the fixed items have already spent declines a reach, and says why', () => {
    // CORE_SCOPE.md Rule 2. The zero is not the answer, the reason is, so the
    // sentence is on the pane rather than only in the analysis.
    const { exp, p, x } = at('e5', { connectors: 20, splices: 20 })
    expect(x.reach.length).toBe(0)
    expect(x.refusal).toMatch(/no length of fibre reaches/)
    const row = numbersFor(exp, x, p).find((r) => r.label === 'Loss-limited reach, declined')
    expect(row.value).toBe('declined')
    expect(row.formula).toBe(x.refusal)
  })

  it('the cavity declines the hand-over to systems, and the message names the factor', () => {
    const { exp, p, x } = at('f1')
    expect(x.refusal).toMatch(/transcendental/)
    expect(x.refusal).toMatch(/no ratio of polynomials equals it/)
    expect(x.refusal).toMatch(/no finite set of poles describes it/)
    // The refusal is content, so it is on the pane rather than in a comment.
    const row = numbersFor(exp, x, p).find((r) => r.label === 'Transfer function in s')
    expect(row.value).toBe('declined')
    expect(row.formula).toBe(x.refusal)
    expect(refusalOf(x)).toBe(x.refusal)
  })

  it('the same reflectance moves the finesse and the mirror loss together', () => {
    // C5 turns this knob and reads a threshold current. The threshold is not
    // built in this sitting, so what is pinned here is that the two numbers a
    // later group will share come from one reflectance.
    const loose = at('f1', { r: 0.3 }).x
    const tight = at('f1', { r: 0.9 }).x
    expect(tight.finesse).toBeGreaterThan(loose.finesse)
    expect(tight.mirrorLoss).toBeLessThan(loose.mirrorLoss)
    expect(loose.fsr).toBeCloseTo(tight.fsr, 6)
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
  // The units this lab writes, longest first so "dB/km" is never read as "dB"
  // and "Gbit/s" is never read as "bit/s".
  // The units this lab writes, longest first so "dB/km" is never read as "dB".
  // The prefix is stripped before the unit is matched, so "Gbit/s" is the "G"
  // prefix on the unit "bit/s" and does not appear here.
  const UNIT = ['bit/s km', 'bit/s', 'ps/(nm·km)', 'mW/mA', 'dB/km', 'W/m²', 'A/W', 'dBm', 'dB', 'eV', 'Hz', 'Ω', 'V', 'A', 'W', 'F', 's', 'm', '%'].join('|')
  // A unit whose own name carries a scale the prefix rule does not reach. A
  // bandwidth-distance product is quoted in bits a second times KILOMETRES,
  // against an engine that returns bit per second metres.
  // A slope in milliwatts a milliamp is the same number as one in watts an
  // amp, because both prefixes are milli and they cancel. So the scale is one,
  // and the engine's W/A is what a lesson's mW/mA is compared against.
  const UNIT_SCALE = { 'bit/s km': 1e3, '%': 1e-2, 'mW/mA': 1 }
  const UNITS = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*([pnµumckMGT]?)(${UNIT})(?![A-Za-z·⁰¹²³⁴⁵⁶⁷⁸⁹⁻/])`, 'g')
  // A bare figure with two or more decimals is a measurement too, and this lab
  // quotes several that have no unit: a numerical aperture, a finesse, a
  // criterion, a ratio of widths.
  const BARE = /(?<![\d.,eE⁻×])(\d+\.\d{2,})(?![\d.,]*\s*(?:[pnµumckMGT]?(?:bit\/|ps\/|dB|W\/|A\/|[VAWFΩsm%]|eV|Hz)))/g
  // A whole number of two or more digits is a measurement as well: a mode
  // count, a channel count, a dispersion parameter written bare. A figure
  // followed by a superscript is a power of ten and is not one of these.
  const COUNT = /(?<![\d.,eE⁻×])(\d{2,})(?![\d.,]*\s*(?:[pnµumckMGT]?(?:bit\/|ps\/|dB|W\/|A\/|[VAWFΩsm%]|eV|Hz))|[\d.,⁰¹²³⁴⁵⁶⁷⁸⁹])/g

  // "0.36 per cent" is the reading 0.0036 written the way a reader reads it, so
  // a number followed by "per cent" is compared against the fraction.
  const percentAfter = (text, end) => /^\s*(?:per cent|%)/.test(text.slice(end))

  // A carrier density of 1.6713 × 10²⁴ per cubic metre has no engineering
  // prefix a reader would recognise, so Group D writes it in scientific
  // notation. The mantissa and the exponent are read together, and the token is
  // taken out of the sentence before the bare-figure rules run over it, so that
  // "1.6713" is never compared against a value 24 orders of magnitude away.
  const SCI = /(\d+(?:\.\d+)?)\s*×\s*10(⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g
  const SUPER = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 }
  const exponentOf = (s) => {
    const sign = s.startsWith('⁻') ? -1 : 1
    const digits = [...s.replace('⁻', '')].map((c) => SUPER[c])
    return sign * Number(digits.join(''))
  }

  /** Every number written as a mantissa times a power of ten, as a value. */
  const quotedSci = (text) =>
    [...text.matchAll(SCI)].map((m) => {
      const scale = Math.pow(10, exponentOf(m[2]))
      return {
        text: m[0],
        digits: (m[1].split('.')[1] || '').length,
        scale,
        value: Math.abs(+m[1]) * scale,
      }
    })

  /** The same sentence with its scientific-notation tokens removed. */
  const withoutSci = (text) => text.replace(SCI, ' ')

  /** Every number-with-unit in a sentence, as a value in base units. */
  const quotedUnits = (text) =>
    [...withoutSci(text.replace(/−/g, '-')).matchAll(UNITS)].map((m) => ({
      text: m[0].trim(),
      digits: (m[1].split('.')[1] || '').length,
      scale: PREFIX[m[2]] * (UNIT_SCALE[m[3]] ?? 1),
      value: Math.abs(+m[1]) * PREFIX[m[2]] * (UNIT_SCALE[m[3]] ?? 1),
    }))

  /** Every bare figure that carries a measurement, and a percentage as a fraction. */
  const quotedBare = (text) => {
    const clean = withoutSci(text.replace(/−/g, '-'))
    const out = []
    for (const re of [BARE, COUNT]) {
      for (const m of clean.matchAll(re)) {
        const cent = percentAfter(clean, m.index + m[0].length)
        out.push({
          text: cent ? `${m[1]} per cent` : m[1],
          digits: (m[1].split('.')[1] || '').length,
          scale: cent ? 0.01 : 1,
          value: Math.abs(+m[1]) * (cent ? 0.01 : 1),
        })
      }
    }
    return out
  }

  /**
   * A quoted number stands for a value when it is that value rounded to the
   * digits printed.
   *
   * The band is half of the last digit printed, and nothing wider. A band of
   * some fixed fraction instead would let a sentence quote five figures while
   * the engine returned a different fifth one, which is the defect this lab
   * shipped twice: a wall-plug efficiency written 7.6011 per cent against a
   * measured 7.60116, and a guard error written 5.2639 against a measured
   * 5.26384. `STYLE.md` S12 asks a number to keep its significant figures, and
   * this is where that is measured. The 1e-9 floor is floating point's own.
   */
  const stands = (q, v) => {
    const half = 0.5 * 10 ** -q.digits * q.scale
    return Math.abs(q.value - Math.abs(v)) <= Math.max(1e-9 * Math.abs(v), half * (1 + 1e-9))
  }
  const close = (got, want, tol) =>
    want === 0 || Math.abs(want) < 1e-30 ? Math.abs(got) <= (tol ?? 1e-12) : Math.abs(got - want) <= (tol ?? 0.006 * Math.abs(want))
  const words = (s) => s.trim().split(/\s+/).length
  const knobOf = (e, key) => e.params.find((k) => k.key === key)
  const knobValues = (e) => e.params.map((k) => k.default)

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
    for (const q of [...quotedUnits(text), ...quotedBare(text), ...quotedSci(text)]) {
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
      // at the defaults. A3's closing sentences are about silicon.
      const whyP = { ...p, ...(e.whyAt || {}) }
      const why = measure(e, whyP, e.whyReads || [], `${e.id} why`)
      const values = [...seen, ...why, ...knobValues(e), ...Object.values(e.whyAt || {})]
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
          expect(v, `${label} sets ${key} to ${v}, below its min ${k.min}`).toBeGreaterThanOrEqual(k.min)
          expect(v, `${label} sets ${key} to ${v}, above its max ${k.max}`).toBeLessThanOrEqual(k.max)
          set.push(v)
        }
        const p = { ...d, ...(t.set || {}) }
        const read = measure(e, p, t.reads || [], label)
        justified(t.say, [...read, ...set, ...knobValues(e)], label)
        steps++
      })
    }
    // Twenty-one experiments, three steps each.
    expect(steps).toBe(3 * EXPERIMENTS.length)
  })

  it('a reading a lesson names is a path the analysis carries, not an undefined', () => {
    for (const e of EXPERIMENTS) {
      const paths = [...(e.seeReads || []), ...(e.whyReads || []), ...e.try.flatMap((t) => t.reads || [])]
      expect(paths.length, `${e.id} quotes nothing`).toBeGreaterThan(2)
      for (const [path] of paths) {
        expect(typeof path, `${e.id} reads a path that is not a string`).toBe('string')
        expect(path, `${e.id} reads an empty path`).not.toBe('')
      }
    }
  })

  it('a path the analysis does not carry throws rather than reading undefined', () => {
    const { p, x } = at('a1')
    expect(() => readQuantity(x, p, 'photon.nonesuch')).toThrow(/No quantity at path/)
  })
})
