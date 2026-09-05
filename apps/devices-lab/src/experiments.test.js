import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS, VIEW_ORDER, VIEW_LABELS, byId, defaultsOf, letterOf, viewLabel } from './experiments.js'
import { readQuantity } from './lessons.js'
import { analyse, experimentMath, niCurve, refusalReason, transportRefusal } from './math.js'
import { num } from './format.js'
import { TERMS } from './terms.js'
import { agrees } from '@ee-labs/explain'
import { NetworkError } from '@ee-labs/network'

// Every note makes a claim, and every claim is measured here.
//
// Three layers, in the order a defect gets through them. The math panel's check
// rows are closed forms against the analysis, at the defaults and at random
// settings, so a formula that is right for one setting and wrong for the next
// fails. The lesson registers are next: each `reads` pair is evaluated and
// compared, and then every number-with-unit in the sentence has to be one of
// those readings or a knob value, so the prose cannot quote a number the engine
// does not produce. And the structure is last: every experiment names a
// structure that draws, and every cross-section has layers with thicknesses.

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
    if (k.kind) {
      // A toggle or a choice changes the structure rather than a value. The
      // random settings exercise the default structure, and the try steps
      // exercise the others.
      p[k.key] = k.default
    } else if (k.scale === 'log') {
      p[k.key] = k.min * Math.pow(k.max / k.min, rnd())
    } else {
      p[k.key] = k.min + (k.max - k.min) * rnd()
    }
  }
  return p
}

describe('every experiment', () => {
  it('has a unique id, a group from the list, a note, knobs, a structure and views', () => {
    const ids = new Set()
    for (const e of EXPERIMENTS) {
      expect(ids.has(e.id), e.id).toBe(false)
      ids.add(e.id)
      expect(GROUPS, `${e.id} group`).toContain(e.group)
      expect(letterOf(e.group).toLowerCase(), `${e.id} sits in its own group`).toBe(e.id[0])
      expect(e.name.length).toBeGreaterThan(4)
      expect(e.name.split(/\s+/).length, `${e.id} name length`).toBeLessThanOrEqual(10)
      expect(e.note.length).toBeGreaterThan(80)
      expect(e.params.length).toBeGreaterThan(0)
      expect(e.views, `${e.id} opens on a view it lists`).toContain(e.view)
      expect(['bulk', 'junction', 'mos', 'mosfet', 'bjt', 'cell', 'led', 'fab'], `${e.id} structure`).toContain(e.structure)
      for (const v of e.views) expect(VIEW_ORDER, `${e.id} view ${v}`).toContain(v)
      const keys = new Set()
      for (const k of e.params) {
        expect(keys.has(k.key), `${e.id} lists ${k.key} twice`).toBe(false)
        keys.add(k.key)
        if (k.kind === 'toggle') {
          expect(typeof k.default, `${e.id}.${k.key}`).toBe('boolean')
          expect(k.on && k.off, `${e.id}.${k.key} labels`).toBeTruthy()
          continue
        }
        if (k.kind === 'choice') {
          expect(k.options.length, `${e.id}.${k.key} options`).toBeGreaterThanOrEqual(2)
          expect(
            k.options.map((o) => o.value),
            `${e.id}.${k.key} default`,
          ).toContain(k.default)
          for (const o of k.options) expect(o.label, `${e.id}.${k.key} label`).toBeTruthy()
          continue
        }
        expect(k.default, `${e.id}.${k.key} below min`).toBeGreaterThanOrEqual(k.min)
        expect(k.default, `${e.id}.${k.key} above max`).toBeLessThanOrEqual(k.max)
        for (const c of k.presets || []) {
          expect(c.value, `${e.id}.${k.key} chip ${c.label} below min`).toBeGreaterThanOrEqual(k.min)
          expect(c.value, `${e.id}.${k.key} chip ${c.label} above max`).toBeLessThanOrEqual(k.max)
        }
      }
    }
  })

  it('lists every group that has an experiment, in the plan’s order', () => {
    const used = [...new Set(EXPERIMENTS.map((e) => e.group))]
    expect(used).toEqual(GROUPS.filter((g) => used.includes(g)))
    const letters = used.map(letterOf)
    expect(letters).toEqual([...letters].sort())
  })

  it('evaluates at its defaults, and draws a cross-section with layers to scale', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      expect(x.sol, `${e.id}: ${x.refusal && x.refusal.message}`).toBe(true)
      expect(x.stack, `${e.id} stack`).toBeTruthy()
      expect(x.stack.layers.length, `${e.id} layers`).toBeGreaterThan(0)
      expect(x.stack.title.length, `${e.id} stack title`).toBeGreaterThan(3)
      for (const l of x.stack.layers) {
        expect(l.thickness, `${e.id} layer ${l.name}`).toBeGreaterThan(0)
        expect(l.name.length, `${e.id} layer name`).toBeGreaterThan(1)
      }
    }
  })

  it('holds together at 25 random settings of every knob', () => {
    for (const e of EXPERIMENTS) {
      for (let k = 0; k < 25; k++) {
        const p = randomParams(e, k * 7919 + 17)
        const x = analyse(e, p)
        // A refusal is an answer. What is not allowed is a number that is not
        // a number, so every finite reading has to stay finite.
        if (!x.sol) {
          expect(x.refusal, `${e.id} refusal`).toBeInstanceOf(NetworkError)
          expect(refusalReason(x.refusal)).toMatch(/^[A-Z]/)
          continue
        }
        const v = readQuantity(x, p, e.headline.path)
        expect(Number.isFinite(v) || typeof v === 'string' || v === Infinity, `${e.id} headline at ${JSON.stringify(p)} is ${v}`).toBe(true)
      }
    }
  })

  it('has a math panel whose every check row agrees, at the defaults and at 20 random settings', () => {
    for (const e of EXPERIMENTS) {
      const settings = [defaultsOf(e.id), ...Array.from({ length: 20 }, (_, k) => randomParams(e, k * 7919 + 17))]
      for (const p of settings) {
        const x = analyse(e, p)
        if (!x.sol) continue
        const m = experimentMath(e, p, x)
        expect(m, `${e.id} has math`).not.toBeNull()
        const rows = m.blocks.filter((b) => b.kind === 'check').flatMap((b) => b.rows)
        expect(rows.length, `${e.id} has check rows`).toBeGreaterThan(0)
        for (const r of rows) {
          if (r.unchecked) continue
          expect(Number.isFinite(r.measured), `${e.id} "${r.label}" measured is ${r.measured} at ${JSON.stringify(p)}`).toBe(true)
          expect(agrees(r), `${e.id} "${r.label}": theory ${r.predicted} vs measured ${r.measured} at ${JSON.stringify(p)}`).toBe(true)
        }
      }
    }
  }, 120000)
})

describe('the view switch', () => {
  it('reads the same left to right in every experiment', () => {
    for (const e of EXPERIMENTS) {
      const order = e.views.map((v) => VIEW_ORDER.indexOf(v))
      expect(order, `${e.id} views out of order`).toEqual([...order].sort((a, b) => a - b))
      expect(
        order.every((k) => k >= 0),
        `${e.id} has a view the switch does not list`,
      ).toBe(true)
    }
  })

  it('gives every view a label of four words or fewer and a title that says what it draws', () => {
    for (const v of VIEW_ORDER) {
      const l = viewLabel(v)
      expect(l, v).toBeDefined()
      expect(l.label.split(/\s+/).length, `${v} label`).toBeLessThanOrEqual(4)
      expect(l.title.length, `${v} title`).toBeGreaterThan(20)
    }
    expect(Object.keys(VIEW_LABELS).sort()).toEqual([...VIEW_ORDER].sort())
  })

  it('opens each experiment on a view that has something to draw', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      if (e.view === 'profile') expect(x.j, `${e.id} opens on the profile`).toBeTruthy()
      if (e.view === 'band') expect(x.carrier, `${e.id} opens on the band diagram`).toBeTruthy()
      if (e.view === 'cv') expect(x.mos, `${e.id} opens on the C–V curve`).toBeTruthy()
      if (e.view === 'curves') expect(x.fet || x.pv, `${e.id} opens on the device curves`).toBeTruthy()
      if (e.view === 'sequence') expect(x.stack.steps, `${e.id} opens on the sequence`).toBeTruthy()
    }
  })
})

describe('what the student reads is what the engine produced', () => {
  it('gives every headline a path that resolves and prints', () => {
    for (const e of EXPERIMENTS) {
      const { x, p } = at(e.id)
      const v = readQuantity(x, p, e.headline.path)
      expect(Number.isFinite(v) || typeof v === 'string', `${e.id} headline ${e.headline.path} is ${v}`).toBe(true)
      expect(num(v, e.headline.unit), `${e.id} headline prints`).toBeTruthy()
    }
  })

  it('resolves a path from every branch the brief lists, and refuses one it does not', () => {
    const a1 = at('a1')
    expect(readQuantity(a1.x, a1.p, 'carrier.n') / a1.p.nd).toBeCloseTo(1, 5)
    expect(readQuantity(a1.x, a1.p, 'carrier.n') * readQuantity(a1.x, a1.p, 'carrier.p')).toBeCloseTo(1.5e16 ** 2, -20)
    expect(readQuantity(a1.x, a1.p, 'carrier.type')).toBe('n')

    const b1 = at('b1')
    expect(readQuantity(b1.x, b1.p, 'j.v0')).toBeCloseTo(0.752879, 5)
    expect(readQuantity(b1.x, b1.p, 'j.xn') / readQuantity(b1.x, b1.p, 'j.xp')).toBeCloseTo(10, 6)

    const c1 = at('c1')
    expect(readQuantity(c1.x, c1.p, 'mos.cox') * c1.p.tox).toBeCloseTo(3.4531332e-11, 18)
    expect(readQuantity(c1.x, c1.p, 'mos.regime')).toBe('depletion')

    const d1 = at('d1')
    expect(readQuantity(d1.x, d1.p, 'fet.gm')).toBeCloseTo(readQuantity(d1.x, d1.p, 'fet.gmMeasured'), 9)
    expect(readQuantity(d1.x, d1.p, 'fet.region')).toBe('saturation')

    const e1 = at('e1')
    expect(readQuantity(e1.x, e1.p, 'bjt.alpha')).toBeCloseTo(readQuantity(e1.x, e1.p, 'bjt.beta') / (readQuantity(e1.x, e1.p, 'bjt.beta') + 1), 12)

    const f1 = at('f1')
    expect(readQuantity(f1.x, f1.p, 'pv.pmax')).toBeCloseTo(readQuantity(f1.x, f1.p, 'pv.vmp') * readQuantity(f1.x, f1.p, 'pv.imp'), 12)

    const f3 = at('f3')
    expect(readQuantity(f3.x, f3.p, 'led.wavelength')).toBeGreaterThan(0)

    const g1 = at('g1')
    expect(readQuantity(g1.x, g1.p, 'fab.doping')).toBeCloseTo(g1.p.dose / g1.p.depth, -14)

    expect(() => readQuantity(a1.x, a1.p, 'nope.n')).toThrow(/unknown quantity path/)
    expect(() => readQuantity(a1.x, a1.p, 'carrier.nope')).toThrow(/unknown quantity path/)
    expect(() => readQuantity(a1.x, a1.p, 'j.v0')).toThrow(/unknown quantity path/)
  })

  it('says why in a sentence when the closed forms decline a setting', () => {
    // The refusal is content: a sentence that starts with a capital and names
    // what is wrong, not a code and not an empty pane.
    const forward = at('b1', { v: 1.5 })
    expect(forward.x.sol).toBe(false)
    expect(refusalReason(forward.x.refusal)).toMatch(/^[A-Z].*\./)
    expect(refusalReason(forward.x.refusal)).toMatch(/depletion approximation/)
    // Just below the barrier there is still a region, so the boundary is where
    // the message says it is rather than a little before.
    expect(at('b1', { v: 0.74 }).x.sol).toBe(true)
    expect(refusalReason(null)).toMatch(/^[A-Z]/)
    // The transport refusal is a sentence too, and it names the three things
    // the depletion approximation replaces.
    expect(transportRefusal()).toMatch(/drift-diffusion/)
    expect(transportRefusal()).toMatch(/Debye lengths/)
  })

  it('warns above the doping where Boltzmann statistics fail, and not below it', () => {
    expect(at('b6').x.guard.degenerate).toBe(true)
    expect(at('b6').x.guard.reason).toMatch(/Fermi–Dirac/)
    expect(at('b1').x.guard.degenerate).toBe(false)
    expect(at('b1').x.guard.reason).toBe('')
  })

  it('walks n_i across the temperature range the band pane draws', () => {
    const c = niCurve()
    expect(c.T.length).toBe(c.ni.length)
    expect(c.ni.every(Number.isFinite)).toBe(true)
    for (let k = 1; k < c.ni.length; k++) expect(c.ni[k]).toBeGreaterThan(c.ni[k - 1])
  })
})

// The three registers, measured. A step's `set` is applied on top of the
// defaults, its `reads` are evaluated and compared, and then every
// number-with-unit in the sentence has to be one of those readings or a knob
// value. The same rule holds for see and why. So a lesson cannot quote a value
// the engine does not produce, and a knob move cannot name a setting the knob
// cannot reach.
describe('every lesson is measured', () => {
  const PREFIX = { p: 1e-12, n: 1e-9, µ: 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9, '': 1 }
  // The units this lab writes in, with what each one is worth in SI. The
  // composites come first in the alternation so that "nF/cm²" is not read as
  // "nF", and "m⁻³" is not read as a bare metre.
  const BASE = {
    'F/cm²': 1e4,
    'C/cm²': 1e4,
    'F/µm²': 1e12,
    'F/m²': 1,
    'C/m²': 1,
    'A/V²': 1,
    'A/V': 1,
    'V/K': 1,
    'V/cm': 100,
    'V/m': 1,
    'm/V': 1,
    'cm⁻³': 1e6,
    'cm⁻²': 1e4,
    'm⁻³': 1,
    'm⁻²': 1,
    'cm²/V·s': 1e-4,
    'cm²/s': 1e-4,
    'm²/s': 1,
    'W/cm²': 1e4,
    'W/m²': 1,
    eV: 1,
    Hz: 1,
    V: 1,
    A: 1,
    W: 1,
    F: 1,
    s: 1,
    m: 1,
    K: 1,
    Ω: 1,
    C: 1,
    J: 1,
    '%': 0.01,
  }
  const bases = Object.keys(BASE)
    .sort((a, b) => b.length - a.length)
    .map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  const SUP = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 }
  const supNumber = (s) => {
    const neg = s.startsWith('⁻')
    const digits = [...s.replace('⁻', '')].map((c) => SUP[c]).join('')
    return (neg ? -1 : 1) * Number(digits)
  }
  const UNITS = new RegExp(
    `(-?\\d+(?:\\.\\d+)?)\\s*(?:[×x]\\s*10(⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)\\s*)?([pnµumkMG]?)(${bases})(?![A-Za-z_⁰¹²³⁴⁵⁶⁷⁸⁹⁻/²³])`,
    'gu',
  )

  /** Every number-with-unit in a sentence, as { text, value, digits, scale } in SI. */
  const quoted = (text) =>
    [...text.replace(/−/g, '-').matchAll(UNITS)].map((m) => {
      const decade = m[2] ? 10 ** supNumber(m[2]) : 1
      const scale = PREFIX[m[3]] * BASE[m[4]] * decade
      return { text: m[0].trim(), digits: (m[1].split('.')[1] || '').length, scale, value: Math.abs(+m[1]) * scale }
    })

  /** A quoted number stands for a value when it is that value rounded to the digits printed, or within 0.6 %. */
  const stands = (q, v) => {
    const half = 0.5 * 10 ** -q.digits * q.scale
    return Math.abs(q.value - Math.abs(v)) <= Math.max(0.006 * Math.abs(v), half * (1 + 1e-9))
  }
  const close = (got, want, tol) =>
    want === 0 || Math.abs(want) < 1e-30 ? Math.abs(got) <= (tol ?? 1e-30) : Math.abs(got - want) <= (tol ?? 0.006 * Math.abs(want))
  const words = (s) => s.trim().split(/\s+/).length
  const knobOf = (e, key) => e.params.find((k) => k.key === key)
  const knobValues = (e) => e.params.filter((k) => !k.kind).flatMap((k) => [k.default, ...(k.presets || []).map((c) => c.value)])

  /** Evaluate one step (or the see/why register) and check its reads; returns the numbers it justifies. */
  function measure(e, p, reads, label) {
    const x = analyse(e, p)
    const again = (over) => analyse(e, { ...p, ...over })
    expect(x.sol, `${label}: the engine declines this setting (${x.refusal && x.refusal.message})`).toBe(true)
    const values = []
    for (const [q, want, tol] of reads) {
      const name = typeof q === 'function' ? 'fn' : q
      const got = typeof q === 'function' ? q(x, p, again, e) : readQuantity(x, p, q)
      if (typeof want === 'string') expect(got, `${label}: ${name}`).toBe(want)
      else {
        expect(Number.isFinite(got), `${label}: ${name} is ${got}`).toBe(true)
        expect(close(got, want, tol), `${label}: ${name} reads ${got}, the lesson says ${want}`).toBe(true)
        values.push(want)
      }
    }
    return values
  }

  /** Every quoted number in `text` stands for one of `values`. */
  function justified(text, values, label) {
    for (const q of quoted(text)) {
      const ok = values.some((v) => stands(q, v))
      expect(ok, `${label}: "${q.text}" is not a reading or a knob value (have ${values.map((v) => +Number(v).toPrecision(5)).join(', ')})`).toBe(true)
    }
  }

  it('has a see, two to four tries and a why, inside the style budgets', () => {
    for (const e of EXPERIMENTS) {
      expect(typeof e.see, e.id).toBe('string')
      expect(typeof e.why, e.id).toBe('string')
      expect(e.try.length, `${e.id} tries`).toBeGreaterThanOrEqual(2)
      expect(e.try.length, `${e.id} tries`).toBeLessThanOrEqual(4)
      expect(e.note).toBe(`${e.see} ${e.why}`)
      expect(words(e.see), `${e.id} see is ${words(e.see)} words`).toBeLessThanOrEqual(70)
      expect(words(e.why), `${e.id} why is ${words(e.why)} words`).toBeLessThanOrEqual(160)
      for (const t of e.try) expect(words(t.say), `${e.id} try "${t.say.slice(0, 30)}…" is ${words(t.say)} words`).toBeLessThanOrEqual(45)
    }
  })

  it('quotes in see and why only readings at the defaults, or knob values', () => {
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const seen = measure(e, p, e.seeReads || [], `${e.id} see`)
      justified(e.see, [...seen, ...knobValues(e)], `${e.id} see`)
      const why = measure(e, p, e.whyReads || [], `${e.id} why`)
      justified(e.why, [...why, ...seen, ...knobValues(e)], `${e.id} why`)
    }
  }, 60000)

  it('sets knobs inside their range, and reads what it says', () => {
    let steps = 0
    for (const e of EXPERIMENTS) {
      const d = defaultsOf(e.id)
      e.try.forEach((t, i) => {
        const label = `${e.id} try ${i + 1}`
        const values = []
        for (const [key, v] of Object.entries(t.set || {})) {
          const k = knobOf(e, key)
          expect(k, `${label} sets ${key}, which is not a knob`).toBeDefined()
          if (k.kind === 'toggle') expect(typeof v, `${label} ${key}`).toBe('boolean')
          else if (k.kind === 'choice')
            expect(
              k.options.map((o) => o.value),
              `${label} ${key}`,
            ).toContain(v)
          else {
            expect(v, `${label} ${key} below min`).toBeGreaterThanOrEqual(k.min)
            expect(v, `${label} ${key} above max`).toBeLessThanOrEqual(k.max)
            values.push(v)
          }
        }
        const p = { ...d, ...(t.set || {}) }
        if (t.refuses) {
          const x = analyse(e, p)
          expect(x.sol, `${label} says the engine declines this; it does not`).toBe(false)
          expect(refusalReason(x.refusal)).toMatch(/^[A-Z]/)
        } else values.push(...measure(e, p, t.reads || [], label))
        justified(t.say, [...values, ...knobValues(e)], label)
        steps++
      })
    }
    expect(steps).toBeGreaterThanOrEqual(2 * EXPERIMENTS.length)
  }, 120000)

  it('names no experiment that is not built', () => {
    // A lesson may name another lab in words. It may not cite an experiment by
    // id unless that experiment exists here, because a reader who follows the
    // reference has to arrive somewhere. Cross-lab references wait for the
    // release commit, and BACKLOG.md carries the ones this lab owes.
    const ID = /\b([A-G])(\d{1,2})\b/g
    const built = new Set(EXPERIMENTS.map((e) => e.id.toUpperCase()))
    for (const e of EXPERIMENTS) {
      const text = [e.see, e.why, ...e.try.map((t) => t.say)].join(' ')
      for (const m of text.matchAll(ID)) {
        expect(built.has(`${m[1]}${m[2]}`), `${e.id} cites ${m[0]}, which is not built`).toBe(true)
      }
    }
    for (const [id, t] of Object.entries(TERMS)) {
      for (const m of t.def.matchAll(ID)) expect(built.has(`${m[1]}${m[2]}`), `term ${id} cites ${m[0]}, which is not built`).toBe(true)
    }
  })
})
