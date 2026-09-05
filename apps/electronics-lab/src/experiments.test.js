import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS, VIEW_ORDER, VIEW_LABELS, byId, defaultsOf, drawables, isDynamic, letterOf, viewLabel } from './experiments.js'
import { readQuantity } from './lessons.js'
import { analyse, bodePoints, clipOf, experimentMath, meanOf, netPower, peakOf, refusalReason, slopeOf, solvePoint } from './math.js'
import { CROP_PAD, layoutExtent, layoutProblems, standInLabel } from './layoutCheck.js'
import { num } from './format.js'
import { TERMS } from './terms.js'
import { agrees } from '@ee-labs/explain'
import { texFailures } from '@ee-labs/explain/testing'
import { NetworkError, normalize, equations } from '@ee-labs/network'

// Every note makes a claim, and every claim is measured here.
//
// Three layers, in the order a defect gets through them. The math panel's
// check rows are closed forms against solves, at the defaults and at random
// settings, so a formula that is right for one setting and wrong for the next
// fails. The lesson registers are next: each `reads` pair is solved and
// compared, and then every number-with-unit in the sentence has to be one of
// those readings, a knob value or the cursor time, so the prose cannot quote
// a number the solver does not produce. And the drawing is last: every
// element solved is drawn, every node has a dot, and nothing overlaps.

const at = (id, over = {}, cursor) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p, cursor) }
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
      // A toggle or a choice changes the circuit's structure rather than a
      // value. The random settings exercise the default structure, and the
      // try steps exercise the others.
      p[k.key] = k.default
    } else if (k.scale === 'log') {
      // Resistances and plain ratios stay within four decades of each other so
      // that the checks sit well above float noise. Capacitances, currents and
      // frequencies roam their whole range.
      const narrow = k.unit === 'Ω' || k.unit === ''
      const lo = narrow ? Math.max(k.min, 10) : k.min
      const hi = narrow ? Math.min(k.max, 1e5) : k.max
      p[k.key] = lo * Math.pow(hi / lo, rnd())
    } else {
      p[k.key] = k.min + (k.max - k.min) * rnd()
    }
  }
  return p
}

describe('every experiment', () => {
  it('has a unique id, a group from the list, a note, knobs, a layout and views', () => {
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
      expect(e.layout.items.length).toBeGreaterThan(2)
      expect(e.views, `${e.id} opens on a view it lists`).toContain(e.view)
      expect(['dc', 'ac', 'both']).toContain(e.show)
      for (const v of e.views) expect(VIEW_ORDER, `${e.id} view ${v}`).toContain(v)
      for (const k of e.params) {
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

  it('draws every element it solves, and solves every element it draws', () => {
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const ids = new Set(e.net(p).elements.map((el) => el.id))
      const drawn = new Set(e.layout.items.filter((it) => it.el).map((it) => it.el))
      expect([...drawn].sort(), e.id).toEqual([...ids].sort())
      // Every node the netlist names, ground aside, has a dot, so its voltage
      // is readable off the picture.
      const nodes = new Set(e.net(p).elements.flatMap((el) => el.nodes))
      nodes.delete('gnd')
      const dots = new Set(e.layout.items.filter((it) => it.node).map((it) => it.node))
      for (const n of nodes) expect(dots.has(n), `${e.id}: node ${n} has no dot`).toBe(true)
      // The drawables carry the labels the layout gives them, so the schematic
      // and the netlist cannot name the same part two ways.
      expect(drawables(e, p).length).toBe(e.net(p).elements.length)
    }
  })

  it('solves at its defaults, with KCL closing and Σp a clean zero', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      if (e.seeRefuses) {
        expect(x.sol, `${e.id} says it refuses`).toBeNull()
        continue
      }
      expect(x.sol, `${e.id}: ${x.refusal && x.refusal.message}`).not.toBeNull()
      const scale = Math.max(1e-6, ...Object.values(x.sol.i).map(Math.abs))
      expect(x.sol.maxResidual, `${e.id} KCL`).toBeLessThan(1e-9 * scale)
      expect(netPower(x.sol), `${e.id} Tellegen`).toBe(0)
    }
  })

  it('has a math panel whose every check row agrees, at the defaults and at 25 random settings', () => {
    for (const e of EXPERIMENTS) {
      const settings = [defaultsOf(e.id), ...Array.from({ length: 25 }, (_, k) => randomParams(e, k * 7919 + 17))]
      for (const p of settings) {
        const x = analyse(e, p)
        const m = experimentMath(e, p, x)
        // A setting with no solution has no measured column to check. The
        // pane says why instead, and refusalReason is tested above.
        if (!x.sol) continue
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
  }, 180000)

  // A formula that KaTeX cannot parse renders as red literal text, and a
  // formula that lost a backslash on its way through an editor renders as the
  // macro's own letters. Both have shipped in this suite before, so both are
  // checked here rather than read off a screenshot.
  it('typesets every formula in its math panel', () => {
    const fails = []
    for (const e of EXPERIMENTS) {
      const m = experimentMath(e, defaultsOf(e.id), analyse(e, defaultsOf(e.id)))
      if (m) fails.push(...texFailures(m, e.id))
    }
    expect(fails).toEqual([])
  })

  it('prints its equations, and the rows count the unknowns the circuit has', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      if (!x.sol) continue
      const eq = equations(x.sol.norm, x.sol)
      expect(eq.rows.length, `${e.id} rows`).toBe(eq.unknowns.length)
      expect(eq.unknowns.length, `${e.id} unknowns`).toBeGreaterThan(0)
    }
  })

  it('fits its drawing in the frame, with nothing written over anything else', () => {
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const els = drawables(e, p)
      const { x } = at(e.id)
      for (const show of ['i', 'v', 'p']) {
        const problems = layoutProblems(e.layout, els, x.sol, show)
        expect(problems, `${e.id} (${show}): ${problems.join('; ')}`).toEqual([])
      }
      expect(layoutProblems(e.layout, els, null, 'none'), `${e.id} bare`).toEqual([])
      // The frame the schematic crops to: it holds the drawing at its widest
      // readings, and it is inside the canvas the placement rules assume.
      const [bx0, by0, bx1, by1] = layoutExtent(e.layout, els)
      expect(bx0, `${e.id} left edge`).toBeGreaterThanOrEqual(0)
      expect(by0, `${e.id} top edge`).toBeGreaterThanOrEqual(0)
      expect(bx1, `${e.id} right edge`).toBeLessThanOrEqual(e.layout.w)
      expect(by1, `${e.id} bottom edge`).toBeLessThanOrEqual(e.layout.h)
      expect(bx1 - bx0, `${e.id} is wide enough to read`).toBeGreaterThan(CROP_PAD * 10)
      for (const el of els) expect(standInLabel(el), `${e.id} ${el.id} stand-in`).toBeTruthy()
    }
  })
})

describe('the view switch', () => {
  it('reads the same left to right in every experiment', () => {
    for (const e of EXPERIMENTS) {
      const order = e.views.map((v) => VIEW_ORDER.indexOf(v))
      expect(order, `${e.id} views out of order`).toEqual([...order].sort((a, b) => a - b))
      expect(order.every((k) => k >= 0), `${e.id} has a view the switch does not list`).toBe(true)
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
      if (e.view === 'scope') expect(isDynamic(e), `${e.id} opens on the scope`).toBe(true)
      if (e.view === 'bode' || e.view === 'pz') expect(x.tf, `${e.id} opens on ${e.view} without polynomials`).toBeTruthy()
      if (e.view === 'junction') expect(x.junction, `${e.id} opens on the junction view`).toBeTruthy()
      if (e.view === 'transfer') expect(x.sweep, `${e.id} opens on the transfer view`).toBeTruthy()
    }
  })
})

describe('what the student reads is what the solver did', () => {
  it('gives every headline a path that resolves to a finite number', () => {
    for (const e of EXPERIMENTS) {
      const { x, p } = at(e.id)
      if (!x.sol) continue
      const v = readQuantity(x, p, e.headline.path, e)
      expect(Number.isFinite(v) || typeof v === 'string', `${e.id} headline ${e.headline.path} is ${v}`).toBe(true)
      expect(num(v, e.headline.unit), `${e.id} headline prints`).toBeTruthy()
    }
  })

  it('resolves every quantity path the brief lists, on the experiment that uses it', () => {
    const a3 = at('a3')
    expect(readQuantity(a3.x, a3.p, 'corner.high', a3.exp) / 1e3).toBeCloseTo(90.919, 2)
    expect(readQuantity(a3.x, a3.p, 'pole.1.hz', a3.exp) / readQuantity(a3.x, a3.p, 'corner.high', a3.exp)).toBeCloseTo(1, 6)
    expect(readQuantity(a3.x, a3.p, 'gain', a3.exp)).toBeCloseTo(10.99879, 4)
    expect(readQuantity(a3.x, a3.p, 'H.db', a3.exp)).toBeCloseTo(20 * Math.log10(readQuantity(a3.x, a3.p, 'H.mag', a3.exp)), 9)
    expect(Math.abs(readQuantity(a3.x, a3.p, 'H.deg', a3.exp))).toBeLessThan(90)

    const a4 = at('a4')
    expect(readQuantity(a4.x, a4.p, 'slope', a4.exp) / 1e6).toBeCloseTo(0.5, 2)
    expect(readQuantity(a4.x, a4.p, 'v.out', a4.exp)).toBeGreaterThan(0)

    const a6 = at('a6')
    expect(readQuantity(a6.x, a6.p, 'peak.out', a6.exp)).toBeCloseTo(0.01, 3)
    expect(readQuantity(a6.x, a6.p, 'mean.out', a6.exp)).toBeGreaterThan(0)
    expect(readQuantity(a6.x, a6.p, 'clip.low.out', a6.exp)).toBeLessThanOrEqual(0)

    const c1 = at('c1')
    expect(readQuantity(c1.x, c1.p, 'junction.v0', c1.exp)).toBeCloseTo(0.75288, 4)
    expect(readQuantity(c1.x, c1.p, 'v.a', c1.exp)).toBeCloseTo(c1.x.sol.v.a, 12)
    expect(readQuantity(c1.x, c1.p, 'vd.in.a', c1.exp)).toBeCloseTo(c1.x.sol.v.in - c1.x.sol.v.a, 12)

    expect(() => readQuantity(c1.x, c1.p, 'nope.a', c1.exp)).toThrow(/unknown quantity path/)
  })

  it('reads the operating point of every device the circuit carries', () => {
    for (const e of EXPERIMENTS) {
      const { x, p } = at(e.id)
      for (const [id, pt] of Object.entries(x.point || {})) {
        if (pt.ic === undefined && pt.id_ === undefined) continue
        const gm = readQuantity(x, p, `op.${id}.gm`, e)
        expect(Number.isFinite(gm), `${e.id} op.${id}.gm`).toBe(true)
        expect(typeof readQuantity(x, p, `op.${id}.region`, e), `${e.id} op.${id}.region`).toBe('string')
      }
    }
  })

  it('draws a Bode curve from the polynomials wherever one is on offer', () => {
    for (const e of EXPERIMENTS) {
      if (!e.views.includes('bode')) continue
      const { x } = at(e.id)
      const b = bodePoints(x)
      expect(b, `${e.id} bode`).not.toBeNull()
      expect(b.db.length).toBe(b.f.length)
      expect(b.db.every(Number.isFinite), `${e.id} bode is finite`).toBe(true)
      // The curve and the pole markers come off the same polynomials, so the
      // curve has to fall by 3 dB at the corner the topbar prints.
      const corner = x.corner.high
      if (corner) {
        const k = b.f.findIndex((f) => f >= corner)
        expect(b.db[k] - b.db[0], `${e.id} corner`).toBeCloseTo(-3, 0)
      }
    }
  })

  it('walks a scope trace that starts where the operating point is', () => {
    for (const e of EXPERIMENTS) {
      if (!isDynamic(e)) continue
      const { x } = at(e.id)
      expect(x.tr, `${e.id} transient`).toBeTruthy()
      expect(x.tr.samples.length, `${e.id} samples`).toBeGreaterThan(50)
      expect(x.cursor, `${e.id} cursor`).toBeGreaterThanOrEqual(0)
      expect(x.cursor, `${e.id} cursor past the window`).toBeLessThanOrEqual(x.tEnd)
      for (const t of e.scope.traces) expect(Number.isFinite(x.now.sol[t.q][t.key]), `${e.id} trace ${t.key}`).toBe(true)
      const c = clipOf(x, e.scope.traces[0].key)
      expect(c.high, `${e.id} clip`).toBeGreaterThanOrEqual(c.low)
      expect(Number.isFinite(peakOf(x, e.scope.traces[0].key))).toBe(true)
      expect(Number.isFinite(meanOf(x, e.scope.traces[0].key))).toBe(true)
      expect(Number.isFinite(slopeOf(x, e.scope.traces[0].key))).toBe(true)
    }
  })

  it('says why in a sentence when a circuit has no answer', () => {
    // The refusal is content: it is a sentence that starts with a capital and
    // names what is wrong, not a code and not an empty pane.
    const err = new NetworkError('value', 'The circuit has no operating point.')
    expect(refusalReason(err)).toMatch(/^[A-Z].*\.$/)
    expect(refusalReason(null)).toMatch(/^[A-Z]/)
  })
})

// The three registers, measured. A step's `set` is applied on top of the
// defaults, its `at` moves the cursor, its `reads` are solved and compared,
// and then every number-with-unit in the sentence has to be one of those
// readings, a knob value or the cursor time. The same rule holds for see and
// why. So a lesson cannot quote a value the solver does not produce, and a
// knob move cannot name a setting the knob cannot reach.
describe('every lesson is measured', () => {
  const PREFIX = { p: 1e-12, n: 1e-9, µ: 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9, '': 1 }
  const UNITS = /(-?\d+(?:\.\d+)?)\s*([pnµumkMG]?)(V\/µs|V\/K|V\/s|mA\/V|A\/V|V|A|W|Ω|s|Hz|F|J|K|°|%|dB|rad\/s)(?![A-Za-z_⁰¹²³⁴⁵⁶⁷⁸⁹⁻/])/g
  /** Every number-with-unit in a sentence, as { text, value, digits } in base units. */
  const quoted = (text) =>
    [...text.replace(/−/g, '-').matchAll(UNITS)].map((m) => ({
      text: m[0].trim(),
      digits: (m[1].split('.')[1] || '').length,
      scale: PREFIX[m[2]] * (m[3] === 'V/µs' ? 1e6 : 1),
      value: Math.abs(+m[1]) * PREFIX[m[2]] * (m[3] === 'V/µs' ? 1e6 : 1),
    }))
  /** A quoted number stands for a value when it is that value rounded to the digits printed, or within 0.6 %. */
  const stands = (q, v) => {
    const half = 0.5 * 10 ** -q.digits * q.scale
    return Math.abs(q.value - Math.abs(v)) <= Math.max(0.006 * Math.abs(v), half * (1 + 1e-9))
  }
  const close = (got, want, tol) =>
    want === 0 || Math.abs(want) < 1e-12 ? Math.abs(got) <= (tol ?? 1e-9) : Math.abs(got - want) <= (tol ?? 0.006 * Math.abs(want))
  const words = (s) => s.trim().split(/\s+/).length
  const knobOf = (e, key) => e.params.find((k) => k.key === key)
  const knobValues = (e) => e.params.filter((k) => !k.kind).flatMap((k) => [k.default, ...(k.presets || []).map((c) => c.value)])

  /** Solve one step (or the see/why register) and check its reads; returns the numbers it justifies. */
  function measure(e, p, reads, cursor, label) {
    const x = analyse(e, p, cursor)
    const again = (over, t) => analyse(e, { ...p, ...over }, t ?? cursor)
    expect(x.sol, `${label}: the circuit has no solution here (${x.refusal && x.refusal.message})`).toBeTruthy()
    const values = []
    for (const [q, want, tol] of reads) {
      const name = typeof q === 'function' ? 'fn' : q
      const got = typeof q === 'function' ? q(x, p, again, e) : readQuantity(x, p, q, e)
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
      expect(ok, `${label}: "${q.text}" is not a reading, a knob value or the cursor time (have ${values.map((v) => +v.toPrecision(5)).join(', ')})`).toBe(true)
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
      const seeAt = e.seeAt ?? (isDynamic(e) ? e.cursor * e.window(p) : undefined)
      const seen = measure(e, p, e.seeReads || [], seeAt, `${e.id} see`)
      justified(e.see, [...seen, ...knobValues(e), ...(seeAt != null ? [seeAt] : [])], `${e.id} see`)
      const why = measure(e, p, e.whyReads || [], seeAt, `${e.id} why`)
      justified(e.why, [...why, ...why, ...knobValues(e)], `${e.id} why`)
    }
  }, 60000)

  it('sets knobs inside their range, moves the cursor inside the window, and reads what it says', () => {
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
        if (t.at != null) {
          expect(isDynamic(e), `${label} moves the cursor of a DC experiment`).toBe(true)
          expect(t.at).toBeGreaterThanOrEqual(0)
          expect(t.at, `${label} cursor past the window`).toBeLessThanOrEqual(e.window(p))
          values.push(t.at)
        }
        if (t.refuses) {
          const x = analyse(e, p, t.at)
          expect(x.sol, `${label} says the circuit has no answer; it has one`).toBeNull()
          expect(refusalReason(x.refusal)).toMatch(/^[A-Z]/)
        } else values.push(...measure(e, p, t.reads || [], t.at, label))
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
    const ID = /\b([A-O])(\d{1,2})\b/g
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

describe('Group A: the op-amp as a user meets it', () => {
  it('A1: the offset arrives at the output multiplied by the closed-loop gain', () => {
    const { x, p } = at('a1')
    const A0 = 1e5
    const beta = p.Rg / (p.Rf + p.Rg)
    expect(x.sol.v.out).toBeCloseTo((A0 * p.vos) / (1 + A0 * beta), 9)
    // At a gain of 11 that is eleven millivolts, to a part in ten thousand.
    expect(x.sol.v.out / (p.vos * (1 + p.Rf / p.Rg))).toBeCloseTo(1, 3)
    // Ten times the feedback resistor is ten times the gain, and so ten times
    // the offset at the output, less what the finite loop gain keeps back.
    const hundred = at('a1', { Rf: 100000 })
    const b101 = hundred.p.Rg / (hundred.p.Rf + hundred.p.Rg)
    expect(hundred.x.sol.v.out / x.sol.v.out).toBeCloseTo((1 + A0 * beta) / (1 + A0 * b101), 6)
    expect(hundred.x.sol.v.out / x.sol.v.out).toBeCloseTo(101 / 11, 1)
  })

  it('A2: the bias current makes I_B·R_f, and R_f ∥ R_g cancels it', () => {
    const { x, p } = at('a2')
    expect(x.sol.v.out).toBeCloseTo(p.ib * p.Rf, 3)
    const balanced = at('a2', { Rp: (p.Rf * p.Rg) / (p.Rf + p.Rg) }).x
    expect(Math.abs(balanced.sol.v.out)).toBeLessThan(1e-9)
    // The cancellation is exact only while the two currents match: a tenth of
    // the bias current in difference leaves a tenth of the error behind.
    const mismatched = at('a2', { Rp: (0.9 * p.Rf * p.Rg) / (p.Rf + p.Rg) }).x
    expect(Math.abs(mismatched.sol.v.out) / (p.ib * p.Rf)).toBeCloseTo(0.1, 2)
  })

  it('A3: the closed-loop pole is f_p(1 + A₀β), and the product is f_t plus G·f_p', () => {
    for (const [Rf, G] of [
      [10000, 11],
      [100000, 101],
      [1000, 2],
    ]) {
      const { x, p } = at('a3', { Rf })
      const fp = p.gbw / p.A0
      const beta = p.Rg / (Rf + p.Rg)
      expect(1 + Rf / p.Rg).toBe(G)
      expect(x.corner.high).toBeCloseTo(fp * (1 + p.A0 * beta), 2)
      // Measured gain times measured corner is f_t exactly, because the loop
      // takes the same factor off one and puts it on the other. Written with
      // the gain the resistors ask for it is f_t + G·f_p, a hundred hertz more.
      expect((x.gain * x.corner.high) / p.gbw).toBeCloseTo(1, 7)
      expect((G * x.corner.high) / (p.gbw + G * fp)).toBeCloseTo(1, 7)
    }
  })

  it('A4: the output ramps at the slew rate, and the ramp is exact', () => {
    const { x, p } = at('a4')
    expect(Math.abs(slopeOf(x, 'out')) / (p.slewv * 1e6)).toBeCloseTo(1, 2)
    // The ramp is the current limit into the compensation capacitor, so its
    // length is the step divided by the rate.
    const faster = at('a4', { slewv: 2 })
    expect(Math.abs(slopeOf(faster.x, 'out')) / Math.abs(slopeOf(x, 'out'))).toBeCloseTo(4, 1)
  })

  it('A5: the common-mode error is v_cm/CMRR, and the current limit clips before the rail', () => {
    const { x, p } = at('a5')
    const G = 1 + p.Rf / p.Rg
    // Into 100 Ω the output cannot pass I_max·R_L, well short of the ±12 V rail.
    // What the output sees is the load in parallel with the feedback network.
    const seen = (p.RL * (p.Rf + p.Rg)) / (p.RL + p.Rf + p.Rg)
    expect(x.sol.v.out).toBeCloseTo(p.imax * seen, 6)
    expect(x.sol.v.out).toBeLessThan(12)
    expect(p.E * G).toBeGreaterThan(x.sol.v.out)
    const light = at('a5', { RL: 10000 }).x
    expect(light.sol.v.out / (p.E * G)).toBeCloseTo(1, 3)
  })

  it('A6: the loop hides the diode’s drop, and without the loop nothing gets through', () => {
    const inside = at('a6').x
    const outside = at('a6', { loop: false }).x
    expect(peakOf(inside, 'out')).toBeCloseTo(0.01, 3)
    expect(peakOf(outside, 'out')).toBeLessThan(peakOf(inside, 'out') / 100)
  })
})

describe('Group C: inside the junction', () => {
  it('C1: V₀ is V_T ln(N_A N_D/n_i²), and the width follows the square root of the barrier', () => {
    const { x, p } = at('c1')
    const vt = (1.380649e-23 * p.T) / 1.602176634e-19
    const ni = 1.5e16 // m⁻³ at 300 K, the plan's pin
    expect(x.junction.v0).toBeCloseTo(vt * Math.log((p.na * p.nd) / (ni * ni)), 6)
    const back = at('c1', { vsrc: -5 }).x
    expect(back.junction.w / x.junction.w).toBeCloseTo(Math.sqrt((x.junction.v0 + 5) / x.junction.v0), 3)
  })

  it('C2: C_j falls as the square root of the barrier, in both directions from zero', () => {
    const { x, p } = at('c2')
    expect(x.junction.cj).toBeCloseTo(p.cj0 / Math.sqrt(1 - x.junction.v / x.junction.v0), 15)
    const forward = at('c2', { vsrc: 0.5, R1: 1e7 }).x
    expect(forward.junction.cj).toBeGreaterThan(p.cj0)
    // The width and the capacitance are the same fact: C_j is εA/W.
    expect(x.junction.cj * x.junction.w).toBeCloseTo(forward.junction.cj * forward.junction.w, 12)
  })

  it('C3: C_d is τ_F g_m, and f_T climbs toward 1/(2π τ_F)', () => {
    const { x, p } = at('c3')
    expect(x.junction.cd).toBeCloseTo(p.tauF * x.junction.gm, 15)
    expect(x.junction.gm).toBeCloseTo(p.i / x.junction.vt, 9)
    expect(x.junction.fTlimit / 1e6).toBeCloseTo(318.31, 1)
    const hotter = at('c3', { i: 4e-3 }).x
    expect(hotter.junction.fT).toBeGreaterThan(x.junction.fT)
    expect(hotter.junction.fT).toBeLessThan(x.junction.fTlimit)
  })

  it('C4: I_S doubles about every 4.5 K, and V_BE falls with temperature', () => {
    const { x } = at('c4')
    expect(x.junction.doubling).toBeCloseTo(4.55, 1)
    expect(x.junction.slope).toBeLessThan(0)
    // The slope is steeper at the lower forward voltage, which is why the
    // textbook's 2 mV/K and this lab's 1.66 mV/K are both right.
    const lower = at('c4', { i: 0.12e-3 }).x
    expect(lower.junction.v).toBeLessThan(x.junction.v)
    expect(lower.junction.slope).toBeLessThan(x.junction.slope)
  })
})
