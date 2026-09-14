import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS, VIEW_ORDER, VIEW_LABELS, byId, defaultsOf, drawables, isDynamic, letterOf, viewLabel } from './experiments.js'
import { readQuantity } from './lessons.js'
import { analyse, bodePoints, clipOf, experimentMath, meanOf, netPower, peakOf, refusalReason, slopeOf, solvePoint } from './math.js'
import { CROP_PAD, layoutExtent, layoutProblems, standInLabel } from './layoutCheck.js'
import { num } from './format.js'
import { TERMS } from './terms.js'
import { agrees } from '@ee-labs/explain'
import { BJT_DEFAULTS, NetworkError, bjtOf, blackman, equations, normalize, polesOf, solveDC, thermalVoltage, zerosOf } from '@ee-labs/network'
import { inverterMargins } from './groups/d.js'
import { HD2_GUARD, driveGuard, hd2Of, vbeFor, vgsFor } from './groups/f.js'
import { VCC, VT, gainFrom, portR } from './groups/h.js'
import { cmrr, cmrrDb, gainD, linearityShortfall, offsetOf, shareQ1, solverFor } from './groups/j.js'
import { SPACING, ceSeenBy, dominant, magAt, millerOf, octcOf, poleSpacing, sctcOf, unityGain } from './groups/k.js'
import { harmonics, loopMargins, loopT, loopTF, portResistance, powerOver, ringOf, tangent, thdOf } from './groups/l.js'
import { texFailures } from '@ee-labs/explain/testing'

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

// The plan's §5 numbers for Groups D and E, each written from the knobs the
// experiment carries rather than typed in. A default that moves moves the
// expectation with it, which is what stops a pin from becoming a snapshot of
// one afternoon's solver.

/**
 * The device a group's netlist carries, with the element defaults filled in,
 * so that V_BE(on) and V_CE(sat) are read off the model rather than retyped
 * beside it. A netlist that names neither still gets the model's own numbers.
 */
const deviceOf = (e, p) => bjtOf(e.net(p).elements.find((el) => el.type === 'Q'))

describe('Group D: the transistor as a controlled source', () => {
  it('D1: α is β/(β + 1), and β is what the base keeps back', () => {
    const { x, p } = at('d1')
    const pt = x.point.Q1
    const alpha = p.beta / (p.beta + 1)
    expect(pt.ic / -pt.ie).toBeCloseTo(alpha, 6)
    expect(pt.ic / pt.ib).toBeCloseTo(p.beta, 6)
    // The drive sets the collector current and β sets only how much of it the
    // base has to supply, so halving β doubles i_B and leaves i_C alone.
    const half = at('d1', { beta: p.beta / 2 }).x.point.Q1
    expect(half.ic).toBeCloseTo(pt.ic, 12)
    expect(half.ib / pt.ib).toBeCloseTo(2, 7)
    // The exponential, read the other way: V_T ln 10 of extra drive is a decade.
    const vt = thermalVoltage(300)
    const decade = at('d1', { vbe: p.vbe + vt * Math.LN10 }).x.point.Q1
    expect(decade.ic / pt.ic).toBeCloseTo(10, 3)
  })

  it('D2: the Early slope is r_o = (V_A + V_CE)/I_C, and every curve runs back to −V_A', () => {
    const { x, p } = at('d2')
    const pt = x.point.Q1
    expect(pt.ro / ((p.va + pt.vce) / pt.ic)).toBeCloseTo(1, 6)
    // Two points on one curve, extrapolated back to no current at all.
    const lo = at('d2', { vcc: p.vcc / 2 }).x.point.Q1
    const hi = at('d2', { vcc: 2 * p.vcc }).x.point.Q1
    const slope = (hi.ic - lo.ic) / (hi.vce - lo.vce)
    expect(lo.vce - lo.ic / slope).toBeCloseTo(-p.va, 6)
    // i_C/i_B is larger than β_F by the Early factor, because the base current
    // carries no v_CE in it. The device sold as β = 100 measures more.
    expect(pt.ic / pt.ib).toBeCloseTo(p.beta * (1 + pt.vce / p.va), 3)
    expect(pt.ic / pt.ib).toBeGreaterThan(p.beta)
  })

  it('D3: the two models differ by exactly v_CE/V_A, and the flat one has no answer past its knee', () => {
    const { x, exp, p } = at('d3')
    const flat = at('d3', { model: 'regions' }).x
    expect(flat.point.Q1.ic).toBeCloseTo(p.beta * p.ib, 9)
    expect(x.point.Q1.ic / flat.point.Q1.ic - 1).toBeCloseTo(p.vce / p.va, 6)
    // The knee, read off the model rather than typed: below V_CE(sat) the
    // three-region model's saturated state pins v_CE and the source sets it
    // too, so the circuit has no operating point at all.
    const vcesat = deviceOf(exp, p).vcesat
    const below = analyse(exp, { ...defaultsOf('d3'), model: 'regions', vce: vcesat / 2 })
    expect(below.sol, 'the flat model refuses below its own knee').toBeNull()
    expect(refusalReason(below.refusal)).toMatch(/^[A-Z].*\.$/)
    // The curve has an answer there, and it is well under the flat model's.
    const curveBelow = analyse(exp, { ...defaultsOf('d3'), model: 'exp', vce: vcesat / 2 })
    expect(curveBelow.sol, 'the curve has an answer there').not.toBeNull()
    expect(curveBelow.point.Q1.ic).toBeLessThan(flat.point.Q1.ic)
  })

  it('D4: I_D is ½k_n V_OV²(1 + λv_DS), and the boundary is the parabola through the knees', () => {
    const { x, p } = at('d4')
    const pt = x.point.M1
    const vov = p.vgs - p.vt
    expect(pt.vov).toBeCloseTo(vov, 9)
    expect(pt.id_).toBeCloseTo(0.5 * p.kn * vov * vov * (1 + p.lam * p.vds), 9)
    // With λ off the curve is flat, and the current is the square law alone.
    const flat = at('d4', { lam: 0 }).x.point.M1
    expect(flat.id_).toBeCloseTo(0.5 * p.kn * vov * vov, 12)
    // The slope is λ: r_o = 1/(λ I_D) at the same overdrive.
    expect(pt.ro).toBeCloseTo(1 / (p.lam * 0.5 * p.kn * vov * vov), 5)
    // At v_DS exactly V_OV the two pieces meet, and the boundary drawn on the
    // pane passes through that knee.
    const knee = at('d4', { vds: vov }).x
    expect(knee.point.M1.id_).toBeCloseTo(0.5 * p.kn * vov * vov * (1 + p.lam * vov), 9)
    // The boundary is a curve on its own grid, so it is read where the knee
    // falls between two of its points rather than at the nearest one.
    const edge = knee.curves.load
    const k = edge.xs.findIndex((v) => v >= vov - 1e-12)
    const j = Math.max(1, k)
    const f = (vov - edge.xs[j - 1]) / (edge.xs[j] - edge.xs[j - 1])
    expect(edge.ys[j - 1] + f * (edge.ys[j] - edge.ys[j - 1])).toBeCloseTo(knee.point.M1.id_, 5)
    // The boundary stops where the family's own knees stop, so it cannot set
    // the frame's height at a current no curve on the plane reaches.
    expect(Math.max(...edge.ys)).toBeLessThanOrEqual(Math.max(...knee.curves.family.flatMap((c) => c.ys)) * 1.001)
  })

  it('D5: the forced β is the load current over the base current, and the drop is V_CE(sat)', () => {
    const { x, exp, p } = at('d5')
    const pt = x.point.Q1
    const q = deviceOf(exp, p)
    const ib = (p.vin - q.vbe) / p.RB
    const iSat = (p.vcc - q.vcesat) / p.RC
    expect(pt.ib).toBeCloseTo(ib, 12)
    expect(pt.ic).toBeCloseTo(iSat, 12)
    expect(pt.vce).toBeCloseTo(q.vcesat, 12)
    expect(pt.ic / pt.ib).toBeCloseTo(iSat / ib, 9)
    // The forced β is far below the device's own, which is what saturation means.
    expect(pt.ic / pt.ib).toBeLessThan(p.beta / 4)
    // The base needs more than I_C/β. Give it less and the device stays active,
    // and the collector then sits at V_CC − βI_B R_C instead of at the knee.
    const needed = iSat / p.beta
    const starved = at('d5', { RB: (p.vin - q.vbe) / (needed / 2) }).x.point.Q1
    expect(starved.region).toBe('active')
    expect(starved.vce).toBeCloseTo(p.vcc - p.beta * starved.ib * p.RC, 9)
    // Below V_BE(on) nothing conducts and the collector sits at the supply.
    const off = at('d5', { vin: q.vbe / 2 }).x.point.Q1
    expect(off.region).toBe('cutoff')
    expect(off.vce).toBeCloseTo(p.vcc, 9)
  })

  it('D6: V_M is V_DD/2, the margins are (3V_DD ± 2V_t)/8, and the ends draw nothing', () => {
    const { x, p } = at('d6')
    const vdd = x.sol.v.vdd
    const m = inverterMargins(p)
    expect(m.vm).toBeCloseTo(vdd / 2, 9)
    expect(m.vil).toBeCloseTo((3 * vdd + 2 * p.vt) / 8, 4)
    expect(m.vih).toBeCloseTo((5 * vdd - 2 * p.vt) / 8, 4)
    // Neither margin carries k_n, because the two matched devices divide it out.
    const stronger = inverterMargins({ ...p, kn: 4 * p.kn })
    expect(stronger.vil).toBeCloseTo(m.vil, 6)
    expect(stronger.vih).toBeCloseTo(m.vih, 6)
    // A higher threshold moves both margins inward, by the same 2/8 either side.
    const raised = inverterMargins({ ...p, vt: p.vt + 0.2 })
    expect(raised.vil - m.vil).toBeCloseTo(0.2 / 4, 4)
    expect(m.vih - raised.vih).toBeCloseTo(0.2 / 4, 4)
    // No current at either end, which is the door to digital.
    for (const vin of [0, vdd]) expect(Math.abs(at('d6', { vin }).x.sol.i.VDD)).toBeLessThan(1e-12)
    // The output is symmetric about the midpoint on a matched pair.
    const low = at('d6', { vin: 0 }).x.sol.v.out
    const high = at('d6', { vin: vdd }).x.sol.v.out
    expect(low).toBeCloseTo(vdd, 6)
    expect(high).toBeCloseTo(0, 6)
  })

  it('D7: the point sits on the load line, and the swing runs from V_CC to V_CE(sat)', () => {
    const { x, exp, p } = at('d7')
    const pt = x.point.Q1
    // Ohm's law for everything outside the transistor, to floating point.
    expect(pt.ic).toBeCloseTo((p.vcc - pt.vce) / p.RC, 12)
    expect(pt.ic).toBeCloseTo(p.beta * p.ib, 9)
    // The two ends of the line. Drive it hard and it stops at the knee, drive
    // it not at all and it stops at the supply.
    const q = deviceOf(exp, p)
    const hard = at('d7', { ib: (4 * p.vcc) / (p.RC * p.beta) }).x.point.Q1
    expect(hard.vce).toBeCloseTo(q.vcesat, 9)
    expect(hard.ic).toBeCloseTo((p.vcc - q.vcesat) / p.RC, 9)
    const soft = at('d7', { ib: 1e-9 }).x.point.Q1
    expect(soft.vce).toBeCloseTo(p.vcc - p.beta * 1e-9 * p.RC, 9)
    expect(p.vcc - soft.vce).toBeLessThan(1e-3 * p.vcc)
    // The line moves only with the supply and the resistor, and the curve the
    // drive picks moves only with the drive.
    const steeper = at('d7', { RC: p.RC / 2 })
    expect(steeper.x.point.Q1.ic).toBeCloseTo(pt.ic, 9)
    expect(steeper.x.point.Q1.vce).toBeCloseTo(p.vcc - pt.ic * (p.RC / 2), 9)
    expect(steeper.x.curves.load.ys[0]).toBeCloseTo(p.vcc / (p.RC / 2), 12)
    // Under the curve model the same base current lands higher, by the Early
    // factor the flat model leaves out.
    const curve = at('d7', { model: 'exp' }).x.point.Q1
    expect(curve.ic).toBeGreaterThan(pt.ic)
    expect(curve.ic).toBeCloseTo(p.beta * p.ib * (1 + curve.vce / p.va), 3)
  })

  it('D5 and D7 draw the device’s own curve, not the supply that was turned', () => {
    // The x of a curve is the device's measured v_CE. A point drawn at the
    // source's value on an axis named v_CE is a curve of the supply wearing
    // the device's label, and it was one until this was pinned.
    for (const id of ['d5', 'd7']) {
      const { x, exp, p } = at(id)
      const lit = x.curves.family.find((c) => c.lit)
      expect(lit, `${id} has a lit curve`).toBeTruthy()
      // A three-region curve is flat at β i_B across the whole active span, so
      // a curve whose x were the supply would slope instead.
      const level = lit.ys[lit.ys.length - 1]
      for (const y of lit.ys) expect(y / level, `${id}: the curve is flat in the active region`).toBeCloseTo(1, 6)
      expect(level, `${id}: the flat level is β i_B`).toBeCloseTo(p.beta * x.point.Q1.ib, 6)
      // Every x is a v_CE the device could have had, never the supply above it.
      expect(Math.max(...lit.xs), `${id}: v_CE stays under the supply`).toBeLessThanOrEqual(p.vcc)
      // The point sits on the load line, which is the picture's whole claim.
      expect(x.curves.point.y, `${id}: the point is on the load line`).toBeCloseTo((p.vcc - x.curves.point.x) / p.RC, 9)
      // Active, the point is on its own curve. Saturated, the load line has
      // stopped it below the curve, and that gap is what D5 exists to show.
      const q = deviceOf(exp, p)
      if (x.point.Q1.region === 'active') expect(x.curves.point.y, `${id}: the point is on its own curve`).toBeCloseTo(level, 6)
      else {
        expect(x.curves.point.y).toBeLessThan(level)
        expect(x.curves.point.x).toBeCloseTo(q.vcesat, 9)
      }
    }
  })
})

describe('Group E: signal and bias take different paths', () => {
  it('E1: no DC crosses the capacitor, and the corner is 1/(2πR_in C_C)', () => {
    const { x, p } = at('e1')
    expect(Math.abs(x.sol.i.CC)).toBeLessThan(1e-12)
    // The base sits where the divider alone puts it, whatever the source does.
    const louder = at('e1', { amp: 10 * p.amp }).x
    expect(louder.sol.v.b).toBeCloseTo(x.sol.v.b, 12)
    const rb = (p.R1 * p.R2) / (p.R1 + p.R2)
    expect(x.sol.v.b).toBeCloseTo(((p.vcc * p.R2) / (p.R1 + p.R2)) - x.point.Q1.ib * rb, 6)
    // One capacitor, one pole, and the pole moves as 1/C_C.
    const fL = x.poles[0].hz
    const smaller = at('e1', { CC: p.CC / 100 }).x
    expect(smaller.poles[0].hz / fL).toBeCloseTo(100, 6)
    // The one-pole magnitude, at the frequency the knob names.
    const mag = Math.hypot(...x.hAt)
    expect(mag).toBeCloseTo(1 / Math.sqrt(1 + (fL / p.f) ** 2), 9)
    // At the corner itself the loss is 3 dB, by construction.
    const atCorner = at('e1', { f: fL }).x
    expect(Math.hypot(...atCorner.hAt)).toBeCloseTo(Math.SQRT1_2, 6)
  })

  it('E2: I_C is β(V_CC − V_BE)/R_B, and the point slides into saturation as β rises', () => {
    const { x, exp, p } = at('e2')
    const q = deviceOf(exp, p)
    const ib = (p.vcc - q.vbe) / p.RB
    expect(x.point.Q1.ib).toBeCloseTo(ib, 12)
    expect(x.point.Q1.ic).toBeCloseTo(p.beta * ib, 12)
    // β straight into the answer: the base current does not move, the
    // collector current is proportional to β.
    for (const beta of [p.beta / 2, 2 * p.beta]) {
      const s = at('e2', { beta }).x.point.Q1
      expect(s.ib).toBeCloseTo(ib, 12)
      const asked = beta * ib
      const ceiling = (p.vcc - q.vcesat) / p.RC
      if (asked < ceiling) expect(s.ic).toBeCloseTo(asked, 12)
      else {
        expect(s.region).toBe('saturation')
        expect(s.ic).toBeCloseTo(ceiling, 12)
        expect(s.vce).toBeCloseTo(q.vcesat, 12)
      }
    }
    // The whole four-to-one range of β is a four-to-one range of current,
    // until the load line stops it.
    const lo = at('e2', { beta: 50, RC: p.RC / 10 }).x.point.Q1
    const hi = at('e2', { beta: 200, RC: p.RC / 10 }).x.point.Q1
    expect(hi.ic / lo.ic).toBeCloseTo(4, 9)
  })

  it('E3: I_C is β(V_BB − V_BE)/(R_B + (β + 1)R_E), and β moves it by a seventh', () => {
    const { x, exp, p } = at('e3')
    const q = deviceOf(exp, p)
    const vbb = (p.vcc * p.R2) / (p.R1 + p.R2)
    const rb = (p.R1 * p.R2) / (p.R1 + p.R2)
    const ic = (beta) => (beta * (vbb - q.vbe)) / (rb + (beta + 1) * p.RE)
    expect(x.point.Q1.ic).toBeCloseTo(ic(p.beta), 9)
    const lo = at('e3', { beta: 50 }).x.point.Q1.ic
    const hi = at('e3', { beta: 200 }).x.point.Q1.ic
    expect(lo).toBeCloseTo(ic(50), 9)
    expect(hi).toBeCloseTo(ic(200), 9)
    // Four to one in β is well under a fifth in the current, against the
    // factor of four fixed bias gives on the same range.
    expect(hi / lo).toBeLessThan(1.2)
    expect(hi / lo).toBeGreaterThan(1)
    // The rule the note states, and the circuit it is stated about.
    expect(rb).toBeLessThanOrEqual(0.1 * (p.beta + 1) * p.RE)
    // Break the rule and β comes back into the answer. R₁ and R₂ go up
    // together, so V_BB does not move and only R_B does.
    const weak = { R1: 20 * p.R1, R2: 20 * p.R2 }
    expect(20 * rb).toBeGreaterThan(0.1 * (p.beta + 1) * p.RE)
    const wlo = at('e3', { ...weak, beta: 50 }).x.point.Q1
    const whi = at('e3', { ...weak, beta: 200 }).x.point.Q1
    expect(wlo.region).toBe('active')
    expect(whi.region).toBe('active')
    expect(whi.ic / wlo.ic).toBeGreaterThan(hi / lo)
  })

  it('E4: the shift is ΔV_BE/(R_E + R_B/(β + 1)), so it divides by the emitter resistor', () => {
    const { x, p } = at('e4')
    const dT = 50
    const warm = at('e4', { T: p.T + dT }).x.point.Q1
    // The junction gives up voltage as it warms, at the slope Group C measured.
    const dvbe = warm.vbe - x.point.Q1.vbe
    expect(dvbe).toBeLessThan(0)
    expect(dvbe / dT).toBeGreaterThan(-2.5e-3)
    expect(dvbe / dT).toBeLessThan(-1.5e-3)
    // What the emitter resistor takes, to the accuracy the form claims.
    const rb = (p.R1 * p.R2) / (p.R1 + p.R2)
    const rLoop = p.RE + rb / (p.beta + 1)
    const shift = warm.ic - x.point.Q1.ic
    expect(shift / (-dvbe / rLoop)).toBeCloseTo(1, 1)
    // Four times the emitter resistor, a quarter of the shift in amps.
    const stiff = at('e4', { RE: 4 * p.RE })
    const stiffShift = at('e4', { RE: 4 * p.RE, T: p.T + dT }).x.point.Q1.ic - stiff.x.point.Q1.ic
    expect(stiffShift / shift).toBeGreaterThan(0.2)
    expect(stiffShift / shift).toBeLessThan(0.3)
    // Take the resistor away and the point runs off the load line.
    const bare = { RE: 10, R2: 4200 }
    const hot = at('e4', { ...bare, T: p.T + dT }).x.point.Q1
    expect(hot.ic / at('e4', bare).x.point.Q1.ic).toBeGreaterThan(1.5)
    expect(hot.region).toBe('saturation')
  })

  it('E5: R_S holds the current against a threshold shift, and without it the square law squares it', () => {
    const { x, p } = at('e5')
    const pt = x.point.M1
    // The square law with a source resistor, written as the quadratic it is.
    const solve = (q) => {
      const over = q.vg - q.vt
      const u = (2 * over) / (1 + Math.sqrt(1 + 2 * q.kn * q.RS * over))
      return 0.5 * q.kn * u * u
    }
    expect(pt.id_).toBeCloseTo(solve(p), 9)
    expect(pt.vov).toBeCloseTo(p.vg - p.vt - pt.id_ * p.RS, 9)
    expect(pt.vds).toBeCloseTo(p.vdd - pt.id_ * (p.RD + p.RS), 9)
    // The device is saturated at the defaults, which is where the experiment
    // needs it: v_DS is above the overdrive with room to spare.
    expect(pt.region).toBe('saturation')
    expect(pt.vds).toBeGreaterThan(pt.vov)
    // A tenth of a volt of threshold, with the source resistor and without.
    const dvt = 0.1
    const held = at('e5', { vt: p.vt + dvt }).x.point.M1.id_
    const bare = { RS: 1, vg: 0.9 }
    const loose = at('e5', bare).x.point.M1.id_
    const looseShifted = at('e5', { ...bare, vt: p.vt + dvt }).x.point.M1.id_
    expect(1 - held / pt.id_).toBeGreaterThan(0.05)
    expect(1 - held / pt.id_).toBeLessThan(0.12)
    expect(1 - looseShifted / loose).toBeGreaterThan(0.7)
    // Without R_S the overdrive halves and the square law squares that.
    expect(looseShifted / loose).toBeCloseTo(((bare.vg - p.vt - dvt) / (bare.vg - p.vt)) ** 2, 2)
  })

  it('E6: only α is left in the answer, so β and temperature move it by parts in a hundred', () => {
    const { x, p } = at('e6')
    const alpha = (beta) => beta / (beta + 1)
    expect(-x.point.Q1.ie).toBeCloseTo(p.ie, 9)
    // α to two figures, and above it by the Early factor the curve model
    // carries, which is the only other thing left in the answer.
    expect(x.point.Q1.ic / p.ie).toBeCloseTo(alpha(p.beta), 2)
    expect(x.point.Q1.ic / p.ie).toBeGreaterThan(alpha(p.beta))
    // Over the whole four-to-one range of β the answer moves by what α moves by.
    const lo = at('e6', { beta: 50 }).x.point.Q1.ic
    const hi = at('e6', { beta: 200 }).x.point.Q1.ic
    expect(hi / lo - 1).toBeCloseTo(alpha(200) / alpha(50) - 1, 2)
    // The plan says the answer moves under 1 % over this range. It moves 1.4 %
    // across the whole of it, because α itself moves that far, and under 1 %
    // either side of the β = 100 value. Both are pinned rather than rounded.
    expect(hi / lo - 1).toBeGreaterThan(0.01)
    expect(hi / lo - 1).toBeLessThan(0.015)
    // Either side of the β = 100 value it is under a percent, which is the
    // plan's claim read the way the circuit can meet it.
    expect(Math.abs(lo / x.point.Q1.ic - 1)).toBeLessThan(0.01)
    expect(Math.abs(hi / x.point.Q1.ic - 1)).toBeLessThan(0.01)
    // Fifty kelvin does not appear at all, because α carries no temperature.
    const warm = at('e6', { T: p.T + 50 }).x.point.Q1.ic
    expect(Math.abs(warm / x.point.Q1.ic - 1)).toBeLessThan(1e-4)
    // The current the source sets is the one thing that does move it.
    // The current the source sets is the one thing that does move it, and it
    // moves it proportionally, less what the Early factor changes as the
    // collector falls.
    const twice = at('e6', { ie: 2 * p.ie }).x
    expect(twice.point.Q1.ic).toBeGreaterThan(x.point.Q1.ic)
    // Proportional while the device is active. Past that the collector has run
    // out of supply to drop across R_C, and the load line rather than the
    // source is setting the current.
    if (twice.point.Q1.region === 'active') expect(twice.point.Q1.ic / x.point.Q1.ic).toBeCloseTo(2, 2)
    else expect(twice.point.Q1.ic * p.RC).toBeCloseTo(p.vcc - twice.sol.v.c, 9)
  })
})

// Groups F and G: the plan's §5 numbers, each written as a function of the
// knobs it depends on rather than as the value it takes at the defaults. A
// default that moves has to move these with it, which is the difference
// between a pin and a transcription.
describe('Group F: small signals, the tangent at the point', () => {
  const VT = thermalVoltage(300)

  it('F1: r_d and 1/g_m are both V_T over the current the device carries', () => {
    for (const i of [0.25e-3, 1e-3, 4e-3]) {
      const { x, p } = at('f1', { i, vbe: vbeFor(i) })
      expect(x.point.D1.rd / (VT / p.i), `r_d at ${i} A`).toBeCloseTo(1, 6)
      // The chip is a function of the device's own law, so it delivers the
      // current it names rather than the one a table remembered.
      expect(x.point.Q1.ic / i, `${i} A in the collector`).toBeCloseTo(1, 6)
      expect(x.point.D1.rd * x.point.Q1.gm, 'one exponential, read twice').toBeCloseTo(1, 6)
    }
    // Both knobs that move the collector current move the base voltage that
    // current asks for, because the law is inverted for each setting.
    for (const [vce, va] of [
      [10, 100],
      [5, 200],
    ]) {
      const { x } = at('f1', { vce, va, vbe: vbeFor(1e-3, { vce, va }) })
      expect(x.point.Q1.ic / 1e-3, `V_CE ${vce}, V_A ${va}`).toBeCloseTo(1, 6)
    }
  })

  it('F2: the AC part of the quasi-static waveform is g_m v_be (R_C ∥ r_o)', () => {
    const bias = at('f2').x.sol.v.c
    for (const amp of [1e-4, 1e-3, 5e-3]) {
      for (const RC of [1000, 5000]) {
        const { x, p } = at('f2', { amp, RC })
        const q = x.point.Q1
        const rl = (p.RC * q.ro) / (p.RC + q.ro)
        // The phasor solve against the tangent's own closed form.
        expect(x.ac.v.c / (q.gm * amp * rl), `${amp} V into ${RC} Ω`).toBeCloseTo(1, 4)
        // And the tangent against the curve: half the swing of two exact
        // solves either side of the bias, which is the plan's 1 %.
        const up = at('f2', { amp, RC, vbe: p.vbe + amp }).x.sol.v.c
        const down = at('f2', { amp, RC, vbe: p.vbe - amp }).x.sol.v.c
        const swing = Math.abs((down - up) / 2) / x.ac.v.c
        expect(Math.abs(swing - 1), `${amp} V, quasi-static`).toBeLessThan(0.01)
      }
      // The bias is what the DC solve found with the signal switched off, so
      // it does not move when the signal does.
      expect(at('f2', { amp }).x.sol.v.c).toBeCloseTo(bias, 12)
    }
  })

  it('F3: the exponential’s slope follows the current, the square law’s its square root', () => {
    const { x, p } = at('f3')
    const q = x.point.Q1
    const m = x.point.M1
    expect(q.gm).toBeCloseTo(q.ic / VT, 9)
    expect(m.gm).toBeCloseTo((2 * m.id_) / m.vov, 9)
    // The slope is a derivative, and it is measured as one on both devices.
    const slope = (key, read) => {
      const d = defaultsOf('f3')[key]
      return (read(at('f3', { [key]: d + 5e-5 }).x) - read(at('f3', { [key]: d - 5e-5 }).x)) / 1e-4
    }
    expect(Math.abs(slope('vbe', (y) => y.point.Q1.ic) / q.gm - 1), 'the bipolar slope').toBeLessThan(1e-6)
    expect(Math.abs(slope('vgs', (y) => y.point.M1.id_) / m.gm - 1), 'the square-law slope').toBeLessThan(1e-6)
    // Double the current in each device. The exponential's slope doubles and
    // the square law's grows by √2, which is the whole comparison.
    const twiceQ = at('f3', { vbe: vbeFor(2 * q.ic) }).x
    const twiceM = at('f3', { vgs: vgsFor(2 * m.id_) }).x
    expect(twiceQ.point.Q1.gm / q.gm).toBeCloseTo(2, 4)
    expect(twiceM.point.M1.gm / m.gm).toBeCloseTo(Math.SQRT2, 4)
    // At the same current the bipolar slope is larger by V_OV/(2V_T).
    expect(q.ic / m.id_).toBeCloseTo(1, 6)
    expect(q.gm / m.gm).toBeCloseTo(m.vov / (2 * VT), 6)
    expect(m.gm).toBeCloseTo(Math.sqrt(2 * p.kn * m.id_ * (1 + 0.02 * m.vds)), 9)
  })

  it('F4: the hybrid-π’s three numbers are derivatives, and its gain is the sweep’s slope', () => {
    for (const over of [{}, { RC: 1000 }, { beta: 200 }, { va: 200 }]) {
      const { x, p } = at('f4', over)
      const q = x.point.Q1
      const rl = (p.RC * q.ro) / (p.RC + q.ro)
      // r_π is β/g_m at the current gain the device really has, and r_o is
      // (V_A + V_CE)/I_C rather than the textbook's V_A/I_C.
      expect(q.rpi / (q.ic / q.ib / q.gm)).toBeCloseTo(1, 6)
      expect(q.ro / ((p.va + q.vce) / q.ic)).toBeCloseTo(1, 6)
      expect(q.ro).toBeGreaterThan(p.va / q.ic)
      expect(x.gain / (-q.gm * rl)).toBeCloseTo(1, 6)
      // The printed netlist's gain against the slope of the quasi-static curve.
      const up = at('f4', { ...over, vbe: p.vbe + 5e-5 }).x.sol.v.c
      const down = at('f4', { ...over, vbe: p.vbe - 5e-5 }).x.sol.v.c
      // The central difference carries its own step error, which is what the
      // note's part in a million is measured against.
      expect(Math.abs((up - down) / 1e-4 / x.gain - 1), 'the sweep’s slope').toBeLessThan(1e-6)
    }
    // β sets r_π and nothing else here, because the base is driven by a source
    // with no resistance in it.
    const one = at('f4').x
    const two = at('f4', { beta: 2 * defaultsOf('f4').beta }).x
    expect(two.point.Q1.rpi / one.point.Q1.rpi).toBeCloseTo(2, 3)
    expect(two.gain / one.gain).toBeCloseTo(1, 6)
  })

  it('F5: the guard is 4 % of the fundamental, and it changes what the panel checks', () => {
    const guard = driveGuard()
    expect(guard).toBeCloseTo(4 * VT * HD2_GUARD, 15)
    const lineAt = (drive) => {
      const { exp, p, x } = at('f5', { drive })
      const rows = experimentMath(exp, p, x)
        .blocks.filter((b) => b.kind === 'check')
        .flatMap((b) => b.rows)
      return rows.find((r) => r.label.includes('straight line'))
    }
    // Inside the guard the straight line is checked and it agrees. Past it the
    // row is footnoted, and the footnote names the drive it warns at.
    const inside = lineAt(guard * 0.9)
    expect(inside.unchecked).toBeNull()
    expect(agrees(inside), 'the line describes the curve inside the guard').toBe(true)
    const outside = lineAt(guard * 1.01)
    expect(outside.unchecked).toMatch(/4\.14 mV/)
    // The estimate the guard is written against, measured. At the default
    // drive the two are within the plan's 10 %, and the gap grows with it.
    const hd2At = (drive, over = {}) => 100 * hd2Of(byId.f5, { ...defaultsOf('f5'), ...over, drive }, 'drive', 0, drive)
    const estimate = (drive) => (100 * drive) / (4 * VT)
    const gapAt = (drive) => Math.abs(estimate(drive) - hd2At(drive)) / estimate(drive)
    const drive = defaultsOf('f5').drive
    expect(gapAt(drive)).toBeLessThan(0.1)
    expect(gapAt(20e-3)).toBeGreaterThan(gapAt(10e-3))
    expect(gapAt(10e-3)).toBeGreaterThan(gapAt(1e-3))
    // The gap is the Early effect rather than the series. A truncated series
    // would lose its error as the drive fell, and this gap is the same at a
    // fiftieth of the drive.
    expect(gapAt(1e-4) / gapAt(drive), 'the gap at a fiftieth of the drive').toBeCloseTo(1, 1)
    // It halves when V_A doubles, because 1 + V_CE/V_A is where it comes from.
    const gapWith = (va) => Math.abs(estimate(drive) - hd2At(drive, { va })) / estimate(drive)
    const va = defaultsOf('f5').va
    expect(hd2At(drive, { va: 2 * va })).toBeGreaterThan(hd2At(drive))
    expect(gapWith(2 * va) / gapWith(va), 'the gap against V_A').toBeCloseTo(0.5, 1)
  })

  it('F6: two elements and no third, with the gate current exactly zero', () => {
    for (const over of [{}, { RD: 10000 }, { lambda: 0.04 }, { vgs: 0.95 }]) {
      const { x, p } = at('f6', over)
      const m = x.point.M1
      const rl = (p.RD * m.ro) / (p.RD + m.ro)
      expect(m.gm).toBeCloseTo((2 * m.id_) / m.vov, 9)
      // r_o is 1/(λ I_D0), where I_D0 is what the square law gives with the
      // drain at zero rather than the current the device is carrying.
      expect(m.ro).toBeCloseTo(1 / (p.lambda * 0.5 * p.kn * m.vov * m.vov), 6)
      expect(x.gain / (-m.gm * rl)).toBeCloseTo(1, 6)
      expect(x.point.M1.region).toBe('saturation')
      // No current crosses the oxide, at any bias. Exactly zero, not small.
      expect(x.sol.i.VG).toBe(0)
    }
  })
})

describe('Group G: ports, and what loads them', () => {
  const rowsOf = (a) =>
    experimentMath(a.exp, a.p, a.x)
      .blocks.filter((b) => b.kind === 'check')
      .flatMap((b) => b.rows)

  it('G1: the port is R/(1 + gR), on both sides of zero', () => {
    for (const R1 of [100, 1000, 10000]) {
      for (const g of [-0.01, -0.001, 0, 0.001, 0.01]) {
        // The one pair this sweep cannot ask for is the cancellation itself,
        // where the port has no finite resistance. The test below covers it.
        if (Math.abs(1 + g * R1) < 0.01) continue
        const { x } = at('g1', { R1, g })
        const port = R1 / (1 + g * R1)
        expect(x.gain / port, `R1 ${R1}, g ${g}`).toBeCloseTo(1, 6)
        // The reading is v over i at the terminals, whichever way it points.
        expect(x.sol.v.x / x.sol.i.It).toBeCloseTo(port, 6)
        expect(Math.sign(x.sol.v.x / x.sol.i.It)).toBe(Math.sign(port))
      }
    }
    // Killing the independent source leaves the dependent one alive, so the
    // resistors-alone answer is right only where g is zero.
    const { x, p } = at('g1')
    expect(x.gain).toBeLessThan(p.R1)
    expect(at('g1', { g: 0 }).x.gain).toBeCloseTo(p.R1, 6)
  })

  it('G1: the panel declines the port where the dependent source cancels the resistor', () => {
    const R1 = 1000
    // Just off the cancellation the port is still finite, and still right.
    const g = -1 / R1 + 1e-5
    const near = at('g1', { R1, g })
    expect(rowsOf(near)[0].unchecked).toBeNull()
    expect(near.x.gain).toBeCloseTo(R1 / (1 + g * R1), 6)
    // At the cancellation itself there is no finite resistance to check, and
    // the panel gives the reason in a sentence rather than showing a cross.
    const open = at('g1', { R1, g: -1 / R1 })
    if (open.x.sol) for (const r of rowsOf(open)) expect(r.unchecked, 'the cancelled port').toMatch(/^[A-Z].*\.$/)
    else expect(refusalReason(open.x.refusal)).toMatch(/^[A-Z].*\.$/)
  })

  it('G2: the three numbers read at the terminals, and the loading rule at both ends', () => {
    for (const Rs of [100, 1000, 10000]) {
      for (const RL of [1000, 10000, 1e6]) {
        const { x, p } = at('g2', { Rs, RL })
        // R_in as v over i at the input port, A_vo across the source inside,
        // and R_out from the divider the load makes with it.
        expect(x.sol.v.p / x.sol.i.Rs).toBeCloseTo(p.Rin, 6)
        expect(x.sol.v.o / x.sol.v.p).toBeCloseTo(p.A, 9)
        const rout = (RL * (x.sol.v.o - x.sol.v.out)) / x.sol.v.out
        expect(rout / p.Rout, `R_out at R_s ${Rs}, R_L ${RL}`).toBeCloseTo(1, 6)
        // The gain from the source is the open-circuit gain times both
        // fractions, and neither fraction may be dropped.
        const inDiv = p.Rin / (p.Rin + Rs)
        const outDiv = RL / (RL + p.Rout)
        expect(x.gain).toBeCloseTo(p.A * inDiv * outDiv, 9)
        expect(Math.abs(x.gain)).toBeLessThan(p.A)
      }
    }
    // The load that halves the open-circuit output is R_out itself.
    const { x, p } = at('g2', { RL: defaultsOf('g2').Rout })
    expect(p.RL).toBe(p.Rout)
    expect(x.sol.v.out / x.sol.v.o).toBeCloseTo(0.5, 12)
  })
})

// Groups H and I: the relations the sentences assert, rather than the values
// they quote. The values are pinned by the lesson registers above and by the
// math panel's check rows at 25 random settings each. What is left is the
// physics a sentence states as a rule - the gain falls by the factor the
// input resistance rises by, a follower's gain never reaches one, the boost
// follows the current gain - and every one of these is written from the knobs.

/** Two resistances in parallel, with an infinite one costing nothing. */
const par = (a, b) => 1 / (1 / a + 1 / b)

describe('Group H: the single-stage amplifiers', () => {
  it('H1: the gain is -g_m(R_C || r_o), and the Early toggle is a control the sentence follows', () => {
    const { x, p } = at('h1')
    const q = x.point.Q1
    expect(x.gain / (-q.gm * par(p.RC, q.ro))).toBeCloseTo(1, 6)
    expect(portR(x, 'c') / par(p.RC, q.ro)).toBeCloseTo(1, 6)
    expect(q.gm / (p.ic / VT)).toBeCloseTo(1, 3)
    // With r_o gone the collector sees R_C alone and the base sees beta/g_m,
    // so both numbers the see quotes change when the toggle moves.
    const off = at('h1', { early: false })
    const qo = off.x.point.Q1
    expect(Number.isFinite(qo.ro), 'r_o with the Early effect off').toBe(false)
    expect(off.x.gain / (-qo.gm * p.RC)).toBeCloseTo(1, 6)
    expect(qo.rpi / (p.beta / qo.gm)).toBeCloseTo(1, 6)
    expect(portR(off.x, 'c') / p.RC).toBeCloseTo(1, 6)
  })

  it('H2: the gain falls by the factor the input resistance rises by, at every R_E', () => {
    const flat = at('h2', { RE: 1 })
    for (const RE of [100, 1000]) {
      const { x } = at('h2', { RE })
      const fell = flat.x.gain / x.gain
      const rose = portR(x, 'b', ['Vs']) / portR(flat.x, 'b', ['Vs'])
      // The two factors are the same one, within two per cent. What separates
      // them is r_o, which carries part of the collector's current back into
      // the emitter and so is not in either textbook form.
      expect(Math.abs(fell / rose - 1), `R_E = ${RE}`).toBeLessThan(0.03)
      // And the factor itself is 1 + g_m R_E: what the emitter takes back is
      // its own drop, and that drop is g_m R_E of the input.
      expect(fell / ((1 + x.point.Q1.gm * RE) / (1 + flat.x.point.Q1.gm * 1)), `R_E = ${RE}`).toBeCloseTo(1, 1)
    }
  })

  it('H3: a follower gain is under one at every load, and the base sees the load multiplied', () => {
    // Every load the supply can carry: at the top of the knob's range the
    // emitter would have to sit above V_CC, and the circuit says so instead.
    let last = 0
    for (const RL of [10, 200, 1000, 3000, 5000]) {
      const { x, p } = at('h3', { RL })
      const av = gainFrom(x, 'b', 'out', ['Vs', 'Rs'])
      expect(av, `R_L = ${RL}`).toBeLessThan(1)
      expect(av, `R_L = ${RL}`).toBeGreaterThan(last)
      last = av
      expect(portR(x, 'b', ['Rs']), `R_L = ${RL}`).toBeGreaterThan(x.point.Q1.rpi)
    }
    // Looking in at the base, the load appears multiplied by beta + 1. That
    // is a slope rather than a value, because r_pi sits under it, so it is
    // measured as one: two kilohms of extra load buys 101 times as much at
    // the base, within the couple of per cent r_o takes.
    const [a, b] = [at('h3', { RL: 1000 }), at('h3', { RL: 3000 })]
    const perOhm = (portR(b.x, 'b', ['Rs']) - portR(a.x, 'b', ['Rs'])) / (b.p.RL - a.p.RL)
    expect(perOhm / (a.p.beta + 1)).toBeCloseTo(1, 1)
    // At the top of the knob's range the emitter would have to sit above
    // V_CC to pass the current the bias asks for. There is no operating
    // point there, and the pane carries the reason rather than a number.
    const knob = byId.h3.params.find((k) => k.key === 'RL')
    const tooMuch = analyse(byId.h3, { ...defaultsOf('h3'), RL: knob.max })
    expect(tooMuch.sol, 'a follower into ten megohms').toBeNull()
    expect(refusalReason(tooMuch.refusal)).toMatch(/^[A-Z].*[a-z]/)
  })

  it('H4: the emitter port is 1/g_m, and what a source delivers is its own divider', () => {
    const { x, p } = at('h4')
    const rin = portR(x, 'e', ['Rs'])
    expect(rin / (1 / x.point.Q1.gm)).toBeCloseTo(1, 1)
    // The stage's gain from the source is the gain at the emitter times the
    // divider R_in/(R_s + R_in), so a 1 kOhm source keeps almost none of it.
    expect(x.gain / (gainFrom(x, 'e', 'c', ['Rs', 'Vs']) * (rin / (p.Rs + rin)))).toBeCloseTo(1, 2)
  })

  it('H5: the square law makes g_m rise as the square root of the drain current', () => {
    for (const vov of [0.1, 0.15, 0.2]) {
      const { x, p } = at('h5', { vov })
      const m = x.point.M1
      // g_m is k_n V_OV and I_D is half k_n V_OV squared, so g_m is exactly
      // the square root of twice k_n I_D once the channel-modulation factor
      // is put back. That factor is all that stands between the slope and the
      // plain square root, and it is under four per cent over these
      // overdrives, which is what "climbs with the square root" means here.
      expect(m.gm / (Math.sqrt(2 * p.kn * m.id_) * Math.sqrt(1 + p.lambda * m.vds)), `V_OV = ${vov}`).toBeCloseTo(1, 9)
      expect(Math.abs(m.gm / Math.sqrt(2 * p.kn * m.id_) - 1), `V_OV = ${vov}`).toBeLessThan(0.04)
      // And the gate passes no current at all, at any setting.
      expect(x.sol.i.Vs, `V_OV = ${vov}`).toBe(0)
    }
  })

  it('H7: the load line has the supply and the saturation voltage at its ends, whatever the drive', () => {
    for (const amp of [0.03, 0.1]) {
      const { x } = at('h7', { amp })
      const c = clipOf(x, 'c')
      expect(c.high, `amp = ${amp}`).toBeCloseTo(VCC, 9)
      expect(c.low, `amp = ${amp}`).toBeCloseTo(BJT_DEFAULTS.vcesat, 9)
    }
    // A small drive reaches neither end, and then the swing is the gain times
    // the drive about the quiescent point.
    const { x, p } = at('h7', { amp: 0.01 })
    const c = clipOf(x, 'c')
    expect(c.high).toBeLessThan(VCC)
    expect((c.high - c.low) / (2 * p.amp * ((p.beta * p.RC) / p.RB))).toBeCloseTo(1, 2)
  })
})

describe('Group I: mirrors, active loads, and stacking', () => {
  /** The current the reference resistor passes, read off the solve. */
  const iref = (x, p, e) => (VCC - x.sol.v.ref) / e.net(p).elements.find((el) => el.id === 'Rref').value

  it('I1: with the Early effect off the copy is I_ref/(1 + 2/beta) exactly, at every beta', () => {
    for (const beta of [50, 100, 1000]) {
      const { x, p, exp } = at('i1', { beta, early: false })
      expect(x.point.Q2.ic / iref(x, p, exp), `beta = ${beta}`).toBeCloseTo(1 / (1 + 2 / beta), 6)
    }
    // With it on, the two collectors sit at different voltages and the ratio
    // carries (V_A + V_CE2)/(V_A + V_CE1) as well.
    const { x, p, exp } = at('i1')
    const [q1, q2] = [x.point.Q1, x.point.Q2]
    const early = (p.va + q2.vce) / (p.va + q1.vce)
    expect(x.point.Q2.ic / iref(x, p, exp)).toBeCloseTo(early / (1 + 2 / p.beta), 3)
  })

  it('I2: the two base-emitter voltages differ by exactly the drop across R_E', () => {
    for (const RE of [2000, 11906, 40000]) {
      const { x } = at('i2', { RE })
      const [q1, q2] = [x.point.Q1, x.point.Q2]
      expect(q1.vbe - q2.vbe, `R_E = ${RE}`).toBeCloseTo(x.sol.v.e2, 12)
      // And the currents come out in the ratio that drop asks for through the
      // exponential, within the per cent the two Early terms cost.
      expect((VT * Math.log(q1.ic / q2.ic)) / x.sol.v.e2, `R_E = ${RE}`).toBeCloseTo(1, 1)
    }
  })

  it('I3: a per cent of mismatch moves the output by that current into the node resistance', () => {
    const { x, p } = at('i3')
    const [q1, q3] = [x.point.Q1, x.point.Q3]
    const rnode = par(q1.ro, q3.ro)
    expect(portR(x, 'c') / rnode).toBeCloseTo(1, 3)
    for (const trim of [0.99, 1.01]) {
      const moved = at('i3', { trim }).x.sol.v.c - x.sol.v.c
      expect(moved / (-(trim - 1) * q1.ic * rnode), `trim = ${trim}`).toBeCloseTo(1, 1)
    }
    // The ceiling one transistor has is (V_A + V_CE)/V_T, and the stage sits a
    // factor of two under it because the load's own r_o is across the node.
    expect((q1.gm * q1.ro) / ((p.va + q1.vce) / VT)).toBeCloseTo(1, 2)
    expect(Math.abs(x.gain) / (q1.gm * q1.ro)).toBeCloseTo(rnode / q1.ro, 2)
  })

  it('I4: the boost the upper transistor gives follows beta', () => {
    const hundred = at('i4', { beta: 100 })
    const fifty = at('i4', { beta: 50 })
    const rout = (a) => portR(a.x, 'c', ['RC'])
    expect(rout(fifty) / rout(hundred)).toBeCloseTo(0.5, 1)
    // And the pair's output resistance is r_o multiplied by that boost, so a
    // cascode is worth about beta common emitters at the same current.
    expect(rout(hundred) / hundred.x.point.Q1.ro / hundred.p.beta).toBeCloseTo(1, 0)
  })

  it('I5: the response is the loaded first stage times the second, not the product of the two alone', () => {
    for (const RC of [1000, 3000, 5000]) {
      const { x } = at('i5', { RC })
      const total = Math.hypot(x.hAt[0], x.hAt[1])
      const rout1 = portR(x, 'c1', ['CC'])
      const rin2 = portR(x, 'b2', ['CC'])
      const second = Math.abs(gainFrom(x, 'b2', 'c2', ['CC', 'Vs']))
      const first = x.point.Q1.gm * par(rout1, rin2)
      expect(total / (first * second), `R_C = ${RC}`).toBeCloseTo(1, 2)
      // The unloaded product would be larger by the divider, which is the
      // whole point of the lesson.
      expect(x.point.Q1.gm * rout1 * second, `R_C = ${RC}`).toBeGreaterThan(total)
    }
  })
})

describe('Group J: the differential pair', () => {
  it('J1: the tail divides by the steering law, and the share does not depend on the tail', () => {
    const vt = thermalVoltage(300)
    for (const n of [-2, -1, 0, 1, 2, 4]) {
      const ideal = 100 / (1 + Math.exp(-n))
      const { x } = at('j1', { vid: n * vt })
      expect(shareQ1(x), `${n} V_T`).toBeCloseTo(ideal, 0)
      // The law is a ratio and has no tail current in it. The circuit's share
      // moves a little with the tail all the same, because the tail sets the
      // two collector voltages and those set the Early factors. It moves
      // towards the ideal ratio as the tail falls, and stays inside 5 %.
      const quarter = shareQ1(at('j1', { vid: n * vt, itail: 0.25e-3 }).x)
      expect(quarter / shareQ1(x), `${n} V_T at a quarter of the tail`).toBeCloseTo(1, 1)
      if (n !== 0) expect(Math.abs(quarter - ideal), `${n} V_T nearer the law`).toBeLessThan(Math.abs(shareQ1(x) - ideal))
    }
    // Four thermal voltages put almost all of it in one side, and one thermal
    // voltage of drive already falls short of the tangent at the origin.
    const four = at('j1', { vid: 4 * vt })
    expect(shareQ1(four.x)).toBeGreaterThan(98)
    const { x, p } = at('j1')
    expect(linearityShortfall(x, p, solverFor(x, p))).toBeGreaterThan(5)
  })

  it('J2: the differential gain is −g_m(R_C ∥ r_o), and one collector gives half of it', () => {
    for (const rc of [1000, 2500, 5000]) {
      const { x, p } = at('j2', { rc })
      const q = x.point.Q1
      expect(x.gain / -(q.gm * ((rc * q.ro) / (rc + q.ro))), `R_C = ${rc}`).toBeCloseTo(1, 2)
      const again = solverFor(x, p)
      const single = (again({ vid: 1e-4 }).sol.v.c1 - again({ vid: -1e-4 }).sol.v.c1) / 2e-4
      expect(single / gainD(x, p, again), `one collector at R_C = ${rc}`).toBeCloseTo(0.5, 3)
    }
  })

  it('J2: the half-circuit row is footnoted once the pair is steered rather than balanced', () => {
    const vt = thermalVoltage(300)
    const rowOf = (vid) => {
      const { x, p } = at('j2', { vid })
      const rows = experimentMath(byId.j2, p, x)
        .blocks.filter((b) => b.kind === 'check')
        .flatMap((b) => b.rows)
      return rows.find((r) => r.label === 'the differential gain')
    }
    expect(rowOf(vt).unchecked, 'balanced').toBeNull()
    expect(rowOf(3 * vt).unchecked, 'steered').toMatch(/steered/)
  })

  it('J3: the rejection is 2 g_m R_EE while the tail resistance is what limits it', () => {
    for (const ree of [1e4, 1e5]) {
      const { x, p } = at('j3', { ree })
      const again = solverFor(x, p)
      expect(cmrr(x, p, again) / (2 * x.point.Q1.gm * ree), `R_EE = ${ree}`).toBeCloseTo(1, 1)
      expect(cmrrDb(x, p, again)).toBeCloseTo(20 * Math.log10(cmrr(x, p, again)), 9)
    }
    // Past a few hundred kilohms r_o limits the rejection instead, so the two
    // closed forms are footnoted rather than marked wrong.
    const rowsAt = (ree) => {
      const { x, p } = at('j3', { ree })
      return experimentMath(byId.j3, p, x)
        .blocks.filter((b) => b.kind === 'check')
        .flatMap((b) => b.rows)
    }
    expect(
      rowsAt(1e5).every((r) => !r.unchecked),
      'at 100 kΩ',
    ).toBe(true)
    for (const r of rowsAt(1e6)) expect(r.unchecked, `${r.label} at 1 MΩ`).toMatch(/runs ahead/)
    // And the footnote has the direction right: past the threshold the circuit
    // rejects more than 2 g_m R_EE, not less, and by more as R_EE climbs.
    const ratio = (ree) => {
      const { x, p } = at('j3', { ree })
      return cmrr(x, p, solverFor(x, p)) / (2 * x.point.Q1.gm * ree)
    }
    expect(ratio(1e6), 'at 1 MΩ').toBeGreaterThan(1)
    expect(ratio(1e7), 'at 10 MΩ').toBeGreaterThan(ratio(1e6))
  })

  it('J4: the offset is V_T ln(1 + Δ), and two mismatches add', () => {
    const vt = thermalVoltage(300)
    const off = (a) => offsetOf(a.x, a.p, solverFor(a.x, a.p))
    for (const drc of [1, 5, 10]) {
      const a = at('j4', { drc })
      expect(off(a) / -(vt * Math.log(1 + drc / 100)), `ΔR_C = ${drc} %`).toBeCloseTo(1, 3)
    }
    const one = at('j4', { drc: 1, dis: 0 })
    const other = at('j4', { drc: 0, dis: 1 })
    const both = at('j4', { drc: 1, dis: 1 })
    expect(off(both) / (off(one) + off(other))).toBeCloseTo(1, 3)
    // The textbook's first term is high by about half the mismatch, which is
    // why the lesson quotes the logarithm rather than V_T ΔR_C/R_C.
    expect((vt * 0.01) / Math.abs(off(one))).toBeGreaterThan(1.004)
  })

  it('J5: the mirror load gives g_m(r_o2 ∥ r_o4), and the bias moves while the gain does not', () => {
    const { x } = at('j5')
    const q2 = x.point.Q2
    const q4 = x.point.Q4
    expect(x.gain / (q2.gm * ((q2.ro * q4.ro) / (q2.ro + q4.ro)))).toBeCloseTo(1, 3)
    // No single stage beats one device's own intrinsic gain.
    expect(x.gain).toBeLessThan(q2.gm * q2.ro)
    const lean = at('j5', { betap: 25 }).x
    const rich = at('j5', { betap: 400 }).x
    expect(Math.abs(rich.sol.v.c2 - lean.sol.v.c2), 'the resting output moves by volts').toBeGreaterThan(1)
    expect(rich.gain / lean.gain, 'the small-signal answer does not').toBeCloseTo(1, 2)
  })
})

describe('Group K: frequency response', () => {
  it('K1: f_T is g_m over the two capacitances, and the fall is one pole', () => {
    for (const ic of [0.25e-3, 1e-3, 1.5e-3]) {
      const { x, p } = at('k1', { ic })
      const fT = unityGain(x.tf)
      expect(fT / (x.point.Q1.gm / (2 * Math.PI * (p.cpi + p.cmu))), `I_C = ${ic}`).toBeCloseTo(1, 2)
      // One pole: 20 dB a decade, 6 dB an octave, both measured below f_T.
      expect(20 * Math.log10(magAt(x.tf, fT / 10) / magAt(x.tf, fT))).toBeCloseTo(20, 0)
      expect(20 * Math.log10(magAt(x.tf, fT / 2) / magAt(x.tf, fT))).toBeCloseTo(6, 1)
    }
  })

  it('K2: the bypass capacitor sees the least and sets the corner it is raised for', () => {
    const { x } = at('k2')
    const s = sctcOf(x)
    const byCap = Object.fromEntries(s.taus.map((t) => [t.id, t]))
    expect(byCap.CE.r, 'the bypass sees the smaller resistance').toBeLessThan(byCap.CC.r)
    expect(s.worst.id, 'and therefore sets the highest corner').toBe('CE')
    // Raising the one that dominates moves the corner. Raising the other by a
    // larger factor barely does, which is the lesson's whole claim.
    const bypass = at('k2', { ce: 470e-6 }).x.corner.low
    const coupling = at('k2', { cc: 100e-6 }).x.corner.low
    expect(bypass / x.corner.low).toBeLessThan(0.2)
    expect(coupling / x.corner.low).toBeGreaterThan(0.9)
  })

  it('K3, K4: both estimates are labelled, and withdrawn where the two poles crowd', () => {
    const { x, p } = at('k3')
    // Neither estimate is presented as the answer: one lands above the exact
    // pole and one below, and both errors are printed (CORE_SCOPE Rule 3).
    expect(millerOf(x, p).fh).toBeGreaterThan(dominant(x))
    expect(octcOf(x).fh).toBeLessThan(dominant(x))
    expect(poleSpacing(x)).toBeGreaterThan(SPACING)
    const noteOf = (id, over) => {
      const a = at(id, over)
      return experimentMath(byId[id], a.p, a.x)
        .blocks.filter((b) => b.kind === 'values')
        .flatMap((b) => b.rows)
        .find((r) => r.label.startsWith('how far') && r.label.includes('exact pole')).note
    }
    expect(noteOf('k3'), 'the Miller estimate at the defaults').not.toMatch(/read the exact pole/)
    expect(noteOf('k4'), 'the sum at the defaults').not.toMatch(/read the exact pole/)
    // A setting the knobs reach where the second pole is close enough to spoil
    // both estimates. The note changes, and the error is what it warns about.
    const crowd = { ic: 1e-4, rs: 100, cpi: 70e-12, cmu: 1e-12 }
    const near = at('k3', crowd)
    expect(poleSpacing(near.x), 'the poles crowd').toBeLessThan(SPACING)
    expect(Math.abs(millerOf(near.x, near.p).fh / dominant(near.x) - 1), 'and the estimate costs').toBeGreaterThan(0.15)
    expect(noteOf('k3', crowd)).toMatch(/read the exact pole/)
    expect(noteOf('k4', crowd)).toMatch(/read the exact pole/)
  })

  it('K5, K6: neither the follower nor the cascode carries the gain across C_µ that K3 does', () => {
    const ce = at('k3')
    const seen = ceSeenBy(ce.p, 'Q1.cmu')
    const seenIn = (x) => octcOf(x).taus.find((t) => t.id === 'Q1.cmu').r
    const follower = at('k5')
    const cascode = at('k6')
    expect(seenIn(follower.x), 'the follower').toBeLessThan(seen / 100)
    expect(seenIn(cascode.x), 'the cascode').toBeLessThan(seen / 50)
    // The follower gives up the voltage gain to get there. The cascode keeps it.
    expect(follower.x.gain).toBeLessThan(1)
    expect(Math.abs(cascode.x.gain) / Math.abs(ce.x.gain)).toBeGreaterThan(0.95)
    expect(dominant(follower.x) / dominant(ce.x)).toBeGreaterThan(10)
    expect(cascode.x.corner.high / dominant(ce.x)).toBeGreaterThan(10)
  })
})

// Groups L and M, pinned the way `AGENT_BRIEF.md` §6 asks: every number the
// plan's §5 quotes for these groups is written here from the knobs, never
// typed in, so that moving a default moves both sides of the comparison. The
// lesson registers above already check what a sentence says against the
// solver. What these blocks add is the law behind each number.
const rel = (got, want) => Math.abs(got / want - 1)

describe('Group L: feedback', () => {
  const rInOf = (x) => 1 / -solveDC(x.norm, { sources: { V1: 1, It: 0 } }).i.V1
  const rOutOf = (x) => solveDC(x.norm, { sources: { V1: 0, It: 1 } }).v.out

  it('L1: T is A₀β, and Blackman’s three numbers reproduce the direct solve', () => {
    for (const Rf of [1000, 9000, 90000]) {
      const { x, p } = at('l1', { Rf })
      const beta = p.Rg / (Rf + p.Rg)
      expect(rel(loopT(x, 'V2'), p.A0 * beta)).toBeLessThan(1e-9)
      expect(x.sol.v.out).toBeCloseTo((p.A0 * p.E) / (1 + p.A0 * beta), 9)
      // A∞ is the divider read backwards, d is nothing at all, and those two
      // with T give the answer the solver gives.
      const bl = blackman(tangent(x), 'V2', { input: 'V1', output: 'out' })
      expect(rel(bl.Ainf[0], 1 + Rf / p.Rg)).toBeLessThan(1e-9)
      expect(Math.abs(bl.d[0])).toBeLessThan(1e-12)
      expect(bl.closed[0] * p.E).toBeCloseTo(x.sol.v.out, 9)
    }
  })

  it('L2: a fractional change in A₀ arrives at the output divided by 1 + T', () => {
    for (const A0 of [1e3, 1e4, 1e5]) {
      const { x, p } = at('l2', { A0 })
      const T = A0 * (p.Rg / (p.Rf + p.Rg))
      const moved = at('l2', { A0: 1.01 * A0 }).x.sol.v.out / x.sol.v.out - 1
      // Exactly, a hundredth divided by one plus the raised loop gain. The
      // rule of thumb divides by 1 + T instead, which is the same answer to
      // one part in a hundred.
      expect(rel(moved * (1 + 1.01 * T), 0.01)).toBeLessThan(1e-9)
      expect(rel(moved, 0.01 / (1 + T))).toBeLessThan(0.011)
    }
  })

  it('L3: the closed-loop pole is f_p(1 + T), and gain × bandwidth is f_t + G·f_p', () => {
    for (const Rf of [1000, 10000, 100000]) {
      const { x, p } = at('l3', { Rf })
      const fp = p.ft / p.A0
      const beta = p.Rg / (Rf + p.Rg)
      const G = 1 + Rf / p.Rg
      expect(rel(x.corner.high, fp * (1 + p.A0 * beta))).toBeLessThan(1e-6)
      // Measured gain times measured corner is the amplifier's own f_t. Read
      // with the gain the resistors ask for it is f_t + G·f_p instead.
      expect(rel(x.gain * x.corner.high, p.ft)).toBeLessThan(1e-6)
      expect(rel(G * x.corner.high, p.ft + G * fp)).toBeLessThan(1e-6)
    }
    // Ten times the transition frequency is ten times every corner.
    expect(rel(at('l3', { ft: 1e7 }).x.corner.high, 10 * at('l3').x.corner.high)).toBeLessThan(1e-9)
  })

  it('L4: the loop multiplies one port by 1 + T and divides the other by it', () => {
    const dead = at('l4', { A0: 0 }).x
    const { p } = at('l4')
    // Dead is a gain of zero. Both ports are then the resistors alone: R_i in
    // series with the divider, and R_o against the feedback network.
    expect(rel(rInOf(dead), p.Ri + 1 / (1 / p.Rg + 1 / (p.Rf + p.Ro)))).toBeLessThan(1e-9)
    expect(rel(rOutOf(dead), 1 / (1 / p.Ro + 1 / (p.Rf + 1 / (1 / p.Rg + 1 / p.Ri))))).toBeLessThan(1e-9)
    for (const A0 of [1, 1e3, 1e5]) {
      const { x } = at('l4', { A0 })
      const T = loopT(x, 'V2')
      expect(rel(rInOf(x), rInOf(dead) * (1 + T))).toBeLessThan(1e-6)
      expect(rel(rOutOf(x), rOutOf(dead) / (1 + T))).toBeLessThan(1e-6)
    }
    // Ten times the amplifier's own output resistance is ten times the
    // closed-loop one, because the loop divides both by the same factor.
    expect(rel(rOutOf(at('l4', { Ro: 10 * p.Ro }).x), 10 * rOutOf(at('l4').x))).toBeLessThan(0.01)
  })

  it('L5: three equal sections put the poles on the axis at √6/RC and a gain of 29', () => {
    const { x, p } = at('l5', { A0: 29 })
    const f0 = Math.sqrt(6) / (p.R * p.C) / (2 * Math.PI)
    const pair = x.poles.filter((q) => Math.abs(q.im) > 1e-9)
    expect(pair.length).toBe(2)
    expect(rel(pair[0].hz, f0)).toBeLessThan(1e-6)
    expect(Math.abs(pair[0].re) / (2 * Math.PI * f0)).toBeLessThan(1e-6)
    expect(Math.abs(loopMargins(loopTF(x, 'Vfb')).pm)).toBeLessThan(0.02)
    // Only the constant term of D(s) + A₀ carries the gain, so the three
    // poles keep the ladder's own sum however hard the loop is driven.
    const sum = (y) => y.poles.reduce((s, q) => s + q.re, 0)
    for (const A0 of [4, 8, 40]) expect(rel(sum(at('l5', { A0 }).x), sum(x))).toBeLessThan(1e-6)
    expect(rel(sum(x), -5 / (p.R * p.C))).toBeLessThan(1e-6)
    // Below 29 the pair stays left of the axis, above it the pair is right of it.
    expect(Math.max(...at('l5', { A0: 8 }).x.poles.map((q) => q.re))).toBeLessThan(0)
    expect(Math.max(...at('l5', { A0: 40 }).x.poles.map((q) => q.re))).toBeGreaterThan(0)
  })

  it('L6: a follower divides its own output resistance by 1 + A₀', () => {
    for (const A0 of [1e3, 1e4, 1e5]) {
      for (const rout of [10, 75, 1000]) {
        const { x } = at('l6', { A0, rout })
        expect(rel(rOutOf(x), rout / (1 + A0))).toBeLessThan(1e-6)
      }
    }
    // The plan's §5 writes this as 75 Ω over 1 + T and quotes 7.5 mΩ, which
    // is a return ratio of 10⁴. A follower feeds all of its output back, so T
    // is the whole open-loop gain and the number is 750 µΩ.
    const { x, p } = at('l6')
    expect(rel(rOutOf(x), p.rout / (1 + p.A0))).toBeLessThan(1e-6)
    expect(rOutOf(x)).toBeLessThan(1e-3)
  })
})

describe('Group M: inside the op-amp', () => {
  const par = (...rs) => 1 / rs.reduce((s, r) => s + 1 / r, 0)
  const rInOf = (x) => portResistance(tangent(x).elements, 'inp', ['Vin'])
  const peakOut = (x) => Math.max(...x.tr.samples.map((s) => s.sol.v.out))

  it('M1: the gain is the two stages multiplied, and each port is its own node', () => {
    const { x, p } = at('m1')
    const q = x.point
    const stage1 = q.Q1.gm * par(q.Q2.ro, q.Q4.ro, q.Q5.rpi)
    const stage2 = q.Q5.gm * par(p.rc, q.Q5.ro)
    expect(rel(Math.abs(x.gain), stage1 * stage2)).toBeLessThan(0.02)
    expect(rel(portResistance(tangent(x).elements, 'out'), par(p.rc, q.Q5.ro))).toBeLessThan(1e-3)
    // The input port is the two r_π in series, less the share the pair's own
    // output resistances and the mirror carry, so the estimate sits above it.
    expect(rInOf(x)).toBeLessThan(2 * q.Q1.rpi)
    expect(rel(rInOf(x), 2 * q.Q1.rpi)).toBeLessThan(0.15)
    // Four times the tail is four times the transconductance, so the input
    // port falls to a quarter and the gain rises with it.
    const four = at('m1', { itail: 4 * p.itail }).x
    expect(rel(four.point.Q1.gm, 4 * q.Q1.gm)).toBeLessThan(0.02)
    expect(rel(rInOf(four), rInOf(x) / 4)).toBeLessThan(0.02)
    expect(Math.abs(four.gain)).toBeGreaterThan(Math.abs(x.gain))
    // Twice the second stage's load is twice its output resistance, because
    // R_C sits well below r_o5 at these settings.
    const wide = at('m1', { rc: 2 * p.rc }).x
    expect(rel(portResistance(tangent(wide).elements, 'out'), 2 * portResistance(tangent(x).elements, 'out'))).toBeLessThan(0.02)
  })

  it('M2: the transition frequency is g_m1 over 2πC_c, and one capacitor sets it', () => {
    const base = at('m1').x
    for (const cc of [5e-12, 10e-12, 30e-12]) {
      const { x } = at('m2', { cc })
      const ft = x.point.Q1.gm / (2 * Math.PI * cc)
      const gbw = Math.abs(x.gain) * x.poles[0].hz
      expect(rel(gbw, ft)).toBeLessThan(0.06)
      // The gain is the same amplifier's, so the capacitor buys bandwidth by
      // moving the pole and nothing else.
      expect(rel(Math.abs(x.gain), Math.abs(base.gain))).toBeLessThan(1e-6)
      expect(rel(x.poles[0].hz, gbw / Math.abs(x.gain))).toBeLessThan(1e-9)
    }
    // A third of the capacitance is three times the pole.
    const { x, p } = at('m2')
    expect(rel(at('m2', { cc: p.cc / 3 }).x.poles[0].hz, 3 * x.poles[0].hz)).toBeLessThan(0.02)
    // The capacitor is multiplied by the second stage's gain, which is what
    // puts that pole decades below every other one.
    expect(x.point.Q5.gm * par(p.rc, x.point.Q5.ro)).toBeGreaterThan(50)
  })

  it('M3: the margin is what the second pole and the zero leave at the crossover', () => {
    const deg = (r) => (Math.atan(r) * 180) / Math.PI
    const partsOf = (x) => {
      const tf = loopTF(x, 'Vfb')
      const m = loopMargins(tf)
      const p2 = polesOf(tf).sort((a, b) => a.hz - b.hz)[1]
      const z1 = zerosOf(tf).sort((a, b) => a.hz - b.hz)[0]
      return { m, z1, parts: 90 - deg(m.crossover / p2.hz) - deg(m.crossover / z1.hz) }
    }
    for (const cc of [5e-12, 10e-12, 30e-12]) {
      const { m, z1, parts } = partsOf(at('m3', { cc }).x)
      expect(Math.abs(parts - m.pm)).toBeLessThan(0.1)
      // The zero the compensation capacitor makes is in the right half plane,
      // so it subtracts phase where a left-plane zero would add it.
      expect(z1.re).toBeGreaterThan(0)
    }
    // Less capacitance is more bandwidth and less margin, and the step
    // overshoots once the closed-loop poles stop being real.
    const wide = at('m3', { cc: defaultsOf('m3').cc / 2 }).x
    const narrow = at('m3', { cc: 3 * defaultsOf('m3').cc }).x
    expect(partsOf(wide).m.crossover).toBeGreaterThan(partsOf(narrow).m.crossover)
    expect(partsOf(wide).m.pm).toBeLessThan(partsOf(narrow).m.pm)
    expect(ringOf(wide.poles).overshoot).toBeGreaterThan(10)
    // At six times the compensation the pair is still a pair, damped far
    // harder, and its overshoot is a rounding error rather than a ring. Only
    // past ten times it are the poles real.
    expect(ringOf(narrow.poles).zeta).toBeGreaterThan(ringOf(wide.poles).zeta)
    expect(ringOf(narrow.poles).overshoot).toBeLessThan(1)
    expect(ringOf(at('m3', { cc: 10 * defaultsOf('m3').cc }).x.poles).zeta).toBeNull()
    // A heavier load brings the second pole down onto the crossover, and the
    // margin goes with it.
    expect(loopMargins(loopTF(at('m3', { cl: 3.3 * defaultsOf('m3').cl }).x, 'Vfb')).pm).toBeLessThan(partsOf(at('m3').x).m.pm)
  })

  it('M4: the ramp is the steered current into the capacitor, and nothing else', () => {
    const { x, p } = at('m4')
    const rate = ((p.beta / (p.beta + 1)) * p.itail) / p.cc
    // The bias resistor drains a share on the way up, so the measured slope
    // sits just under the bare rate rather than on it.
    expect(Math.abs(slopeOf(x, 'c2'))).toBeLessThan(rate)
    expect(rel(Math.abs(slopeOf(x, 'c2')), rate)).toBeLessThan(0.02)
    for (const [over, factor] of [
      [{ cc: p.cc / 3 }, 3],
      [{ itail: 4 * p.itail }, 4],
    ]) {
      expect(rel(Math.abs(slopeOf(at('m4', over).x, 'c2')) / Math.abs(slopeOf(x, 'c2')), factor)).toBeLessThan(0.02)
    }
    // The climb ends at an event, inside the window, at about the swing over
    // the rate.
    expect(x.tr.events.length).toBeGreaterThan(0)
    expect(x.tr.events[0].t).toBeLessThan(x.tEnd)
    expect(rel(x.tr.events[0].t, 10.5 / rate)).toBeLessThan(0.1)
  })

  it('M5: the offset is V_T ln r and the base current is the tail over 2(1 + β_eff)', () => {
    const vt = thermalVoltage(300)
    const matched = at('m5', { ratio: 1 }).x
    for (const ratio of [1.01, 1.05]) {
      const { x } = at('m5', { ratio })
      const vos = -(x.sol.v.out - matched.sol.v.out) / x.gain
      expect(rel(vos, vt * Math.log(ratio))).toBeLessThan(0.06)
    }
    const { x, p } = at('m5')
    const early = 1 + Math.abs(x.point.Q1.vce) / p.va
    expect(rel(Math.abs(x.point.Q1.ib), p.itail / (2 * (1 + p.beta * early)))).toBeLessThan(0.03)
    // The textbook's I_tail/2β leaves the Early effect out of the current
    // gain, so it sits above the measured base current.
    expect(Math.abs(x.point.Q1.ib)).toBeLessThan(p.itail / (2 * p.beta))
    // Four times the tail is four times the base current, and half the β is
    // twice as much of it.
    expect(rel(Math.abs(at('m5', { itail: 4 * p.itail }).x.point.Q1.ib), 4 * Math.abs(x.point.Q1.ib))).toBeLessThan(0.02)
    expect(rel(Math.abs(at('m5', { beta: p.beta / 2 }).x.point.Q1.ib), 2 * Math.abs(x.point.Q1.ib))).toBeLessThan(0.02)
  })

  it('M6: the dead band sets the peak, the fundamental, the distortion and the efficiency', () => {
    const { x, p } = at('m6')
    const dead = 0.7 - p.vbias
    const k = p.RL / (p.RL + p.re)
    expect(rel(peakOut(x), k * (p.amp - dead))).toBeLessThan(0.01)
    const theta = Math.asin(dead / p.amp)
    expect(rel(harmonics(x, 'out', p.f)[0], k * p.amp * (1 - (2 * theta + Math.sin(2 * theta)) / Math.PI))).toBeLessThan(0.02)
    // The dead band is a fixed width, so it takes a smaller share of a larger
    // drive. Nine times the drive is less than a tenth of the distortion.
    const big = at('m6', { amp: byId.m6.params.find((k) => k.key === 'amp').max }).x
    expect(thdOf(big, 'out', p.f)).toBeLessThan(thdOf(x, 'out', p.f) / 10)
    // Bias past a diode drop closes the dead band, and the load is then
    // driven through the two ballast resistors in parallel.
    const ab = at('m6', { vbias: byId.m6.params.find((k) => k.key === 'vbias').max, amp: 5 })
    expect(rel(peakOut(ab.x), (ab.p.RL / (ab.p.RL + ab.p.re / 2)) * ab.p.amp)).toBeLessThan(0.01)
    // Efficiency counts every source, the base drive included, and stays
    // under the π/4 ceiling an ideal stage driven to its rail would reach.
    const w = powerOver(big, { load: 'RL', supplies: ['VCC', 'VEE', 'Vin', 'Vbn', 'Vbp'], freq: p.f })
    expect(w.efficiency).toBeLessThan(25 * Math.PI)
    expect(w.efficiency).toBeGreaterThan(60)
    // Past the supply the three-region model has no answer, and the pane
    // gives the reason rather than drawing one.
    const past = at('m6', { amp: 5, vsup: 3 }).x
    expect(past.sol).toBeNull()
    expect(refusalReason(past.refusal)).toMatch(/^[A-Z].*\.$/)
  })

  it('footnotes a row its settings cannot show, at a setting the knobs reach', () => {
    /** The reasons the math panel gives for the rows it does not compare. */
    const notes = (id, over = {}) => {
      const { exp, p, x } = at(id, over)
      return experimentMath(exp, p, x)
        .blocks.filter((b) => b.kind === 'check')
        .flatMap((b) => b.rows)
        .filter((r) => r.unchecked)
        .map((r) => r.unchecked)
        .join(' ')
    }
    /** A guard counts only when a reader can reach the setting that fires it. */
    const reach = (id, over) => {
      for (const [key, v] of Object.entries(over)) {
        const k = byId[id].params.find((q) => q.key === key)
        expect(k, `${id} has no knob ${key}`).toBeDefined()
        expect(v, `${id}.${key} below its knob`).toBeGreaterThanOrEqual(k.min)
        expect(v, `${id}.${key} above its knob`).toBeLessThanOrEqual(k.max)
      }
      return over
    }
    // Every panel opens with all of its rows compared, except M3's second
    // pole. Its default load capacitor puts that pole inside three times the
    // transition frequency, and the panel says so rather than comparing two
    // numbers the pole split no longer separates.
    for (const id of ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'm1', 'm2', 'm4', 'm5', 'm6']) expect(notes(id), id).toBe('')
    expect(notes('m3')).toMatch(/within three times the transition frequency/)

    expect(notes('l2', reach('l2', { E: 0 }))).toMatch(/no input applied/)
    expect(notes('l3', reach('l3', { Rf: 1000, ft: 100 }))).toMatch(/one hertz/)
    expect(notes('l5', reach('l5', { C3: 1e-12 }))).toMatch(/three decades apart/)
    expect(notes('m2', reach('m2', { rc: 2000 }))).toMatch(/gain of only/)
    expect(notes('m2', reach('m2', { cl: 1e-9 }))).toMatch(/within three times/)
    expect(notes('m3', reach('m3', { cc: 100e-12 }))).toMatch(/no ringing to put a damping ratio on/)
    expect(notes('m4', reach('m4', { rc: 1e5 }))).toMatch(/exponential rather than a ramp/)
    expect(notes('m5', reach('m5', { ratio: 1.1 }))).toMatch(/five per cent/)
    expect(notes('m6', reach('m6', { amp: 0.5 }))).toMatch(/never clears the dead band/)
  })
})
