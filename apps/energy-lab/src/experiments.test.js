import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS, GROUP_INTROS, PANEL_VIEWS, PLOT_VIEWS, VIEW_LABELS, VIEW_ORDER, byId, byGroup, defaultsOf, isPlot } from './experiments.js'
import { analyse, cellOf, curveOf, figuresOf, humps, powerAt, readQuantity, shadeOf } from './analysis.js'
import { BACKOFF, CELL_DEFAULTS, atI, atV, openCircuit, shortCircuit, vocFormula } from './physics.js'
import { TERMS } from './terms.js'

// Every note makes a claim, and every claim is measured here. A step's `set`
// is applied over the defaults, its `at` moves the cursor, its `reads` are
// solved and compared, and then every number-with-unit in the sentence has to
// be one of those readings, a knob value, or the cursor time. The same rule
// holds for the numbers in `see` and `why`. So a lesson cannot quote a value
// the solver does not produce, and a knob move cannot name a setting the knob
// cannot reach.

const at = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p) }
}

describe('every experiment', () => {
  it('has a unique id, a group from the list, a note, knobs and views', () => {
    const ids = new Set()
    for (const e of EXPERIMENTS) {
      expect(ids.has(e.id), e.id).toBe(false)
      ids.add(e.id)
      expect(GROUPS, e.id).toContain(e.group)
      expect(e.name.length, e.id).toBeGreaterThan(4)
      expect(e.note.length, e.id).toBeGreaterThan(80)
      expect(e.params.length, e.id).toBeGreaterThan(0)
      expect(e.views, e.id).toContain(e.view)
      expect(['i', 'v', 'p'], e.id).toContain(e.show)
      for (const v of e.views) expect(VIEW_ORDER, `${e.id} view ${v}`).toContain(v)
      for (const k of e.params) {
        if (k.kind === 'toggle') {
          expect(typeof k.default, `${e.id}.${k.key}`).toBe('boolean')
          expect(k.on && k.off, `${e.id}.${k.key} labels`).toBeTruthy()
          continue
        }
        if (k.kind === 'choice') {
          expect(k.options.length, `${e.id}.${k.key} options`).toBeGreaterThan(1)
          expect(k.options.map((o) => o.value), `${e.id}.${k.key} default`).toContain(k.default)
          for (const o of k.options) expect(o.label, `${e.id}.${k.key} label`).toBeTruthy()
          continue
        }
        expect(k.default, `${e.id}.${k.key}`).toBeGreaterThanOrEqual(k.min)
        expect(k.default, `${e.id}.${k.key}`).toBeLessThanOrEqual(k.max)
        expect(k.hint || k.label, `${e.id}.${k.key} has a label`).toBeTruthy()
      }
    }
  })

  it('has 26 experiments, in five groups, in plan order', () => {
    expect(EXPERIMENTS.length).toBe(26)
    expect(byGroup.map((g) => g.items.length)).toEqual([8, 5, 5, 5, 3])
    // The ids run a1..a8, b1..b5 and so on, in the order the sidebar shows.
    const letters = ['a', 'b', 'c', 'd', 'e']
    byGroup.forEach((g, gi) => {
      g.items.forEach((e, i) => expect(e.id).toBe(`${letters[gi]}${i + 1}`))
    })
    for (const g of GROUPS) expect(GROUP_INTROS[g], g).toBeTruthy()
  })

  it('every term a lesson names is defined, and every definition is used', () => {
    const used = new Set()
    for (const e of EXPERIMENTS)
      for (const t of e.terms || []) {
        expect(TERMS[t], `${e.id} names the term ${t}`).toBeTruthy()
        used.add(t)
      }
    for (const t of Object.keys(TERMS)) expect(used.has(t), `${t} is defined and never used`).toBe(true)
  })

  it('every view it offers has a label and a hover title', () => {
    for (const v of VIEW_ORDER) {
      expect(VIEW_LABELS[v], v).toBeTruthy()
      expect(VIEW_LABELS[v].label.split(/\s+/).length, `${v} label`).toBeLessThanOrEqual(4)
      expect(VIEW_LABELS[v].title.length, `${v} title`).toBeGreaterThan(20)
    }
  })

  it('offers a picture and a panel, because the screen shows one of each at once', () => {
    // Every view is one or the other, and the two lists between them are the
    // whole of VIEW_ORDER, so a view added later cannot fall between them.
    expect([...PLOT_VIEWS, ...PANEL_VIEWS].sort()).toEqual([...VIEW_ORDER].sort())
    for (const v of PLOT_VIEWS) expect(isPlot(v), v).toBe(true)
    for (const v of PANEL_VIEWS) expect(isPlot(v), v).toBe(false)
    for (const e of EXPERIMENTS) {
      expect(e.views.filter(isPlot).length, `${e.id} has a picture`).toBeGreaterThan(0)
      expect(e.views.filter((v) => !isPlot(v)).length, `${e.id} has a panel`).toBeGreaterThan(0)
    }
  })

  it('solves at its defaults, and every solve converges in twelve iterations or fewer', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      expect(x, e.id).toBeTruthy()
      if (x.at && x.at.iters !== undefined) expect(x.at.iters, `${e.id} iterations`).toBeLessThanOrEqual(12)
      if (x.curve) for (const pt of x.curve) expect(pt.iters, `${e.id} curve point`).toBeLessThanOrEqual(12)
    }
  })
})

// ---------------------------------------------------------------- invariants

describe('the invariants the plan names', () => {
  it('1 · the two intercepts agree with the closed form and with each other', () => {
    for (const Ns of [1, 6, 12]) {
      const c = { ...CELL_DEFAULTS, Ns }
      // V_oc from the current-driven solve at zero current.
      const voc = openCircuit(c)
      expect(voc).toBeCloseTo(atI(c, 0).v, 12)
      // The closed form ignores the shunt, so it sits a little above.
      expect(vocFormula(c) - voc).toBeGreaterThan(0)
      expect(vocFormula(c) - voc).toBeLessThan(1e-6 * Ns)
      // I_sc from the voltage-driven solve is the limit the current sweep runs to.
      const isc = shortCircuit(c)
      expect(isc).toBeCloseTo(5, 9)
      expect(atI(c, isc * (1 - BACKOFF)).v).toBeGreaterThan(0)
    }
  })

  it('2 · every point of every curve converges, over the parameter space', () => {
    let worst = 0
    for (const Ns of [1, 12]) {
      for (const G of [1000, 500, 200, 80]) {
        for (const Rsh of [1e4, 5]) {
          for (const Rs of [0, 0.02]) {
            const c = { ...CELL_DEFAULTS, Ns, G, Rsh, Rs }
            for (const pt of curveOf(c, { shade: null, bypass: null }, 25)) worst = Math.max(worst, pt.iters)
          }
        }
      }
    }
    expect(worst).toBeGreaterThan(0)
    expect(worst).toBeLessThanOrEqual(12)
  })

  it('3 · the maximum really is the maximum, and both ends are zero', () => {
    for (const id of ['a3', 'b1', 'b5']) {
      const { x } = at(id)
      for (const pt of x.curve) expect(pt.p, `${id} at ${pt.v}`).toBeLessThanOrEqual(x.fig.pmpp * (1 + 1e-9))
      expect(x.curve.length).toBeGreaterThan(100)
      const ends = [x.curve[0], x.curve[x.curve.length - 1]]
      for (const e of ends) expect(Math.abs(e.p), `${id} end`).toBeLessThan(1e-3 * x.fig.pmpp)
    }
  })

  it('4 · the fill factor identity holds to floating point', () => {
    for (const id of ['a4', 'a5', 'a6', 'b1', 'b5']) {
      const { x } = at(id)
      expect(Math.abs(x.fig.pmpp - x.fig.ff * x.fig.voc * x.fig.isc), id).toBeLessThan(1e-12 * x.fig.pmpp)
    }
  })

  it('5 · series scales the voltage, parallel scales the current, exactly', () => {
    const s = { shade: null, bypass: null }
    const one = figuresOf({ ...CELL_DEFAULTS }, s)
    for (const Ns of [2, 6, 12, 24]) {
      const many = figuresOf({ ...CELL_DEFAULTS, Ns }, s)
      expect(many.voc / one.voc).toBeCloseTo(Ns, 9)
      expect(many.isc).toBeCloseTo(one.isc, 9)
      expect(many.pmpp / one.pmpp).toBeCloseTo(Ns, 6)
      expect(many.ff).toBeCloseTo(one.ff, 6)
    }
    for (const Np of [2, 3, 4]) {
      const wide = figuresOf({ ...CELL_DEFAULTS, Ns: 12, Np }, s)
      const tall = figuresOf({ ...CELL_DEFAULTS, Ns: 12 }, s)
      expect(wide.isc / tall.isc).toBeCloseTo(Np, 9)
      expect(wide.voc).toBeCloseTo(tall.voc, 9)
      expect(wide.pmpp / tall.pmpp).toBeCloseTo(Np, 6)
    }
  })

  it('6 · the converter agrees with itself: R/D² against the switched steady state', () => {
    for (const D of [0.3, 0.4, 0.5, 0.6, 0.7]) {
      const { x } = at('c5', { D })
      expect(Math.abs(x.buck.iinSwitched - x.buck.iinModel), `D = ${D}`).toBeLessThan(1e-5)
      // The operating point is on the array's own curve.
      expect(x.at.v * x.at.i).toBeCloseTo(x.at.p, 9)
      // And the ideal converter delivers what the array gave it.
      expect(Math.abs(x.buck.m.Pout - x.at.p), `D = ${D} power`).toBeLessThan(1e-5 * x.at.p)
    }
  })

  it('7 · the tracker obeys its own rule at every step', () => {
    for (const id of ['c2', 'c3', 'c4']) {
      const { x } = at(id)
      for (let k = 2; k < x.path.length; k++) {
        const prev = x.path[k - 1]
        const cur = x.path[k]
        // A step that lost power reverses; one that gained keeps its direction.
        const expected = cur.p < prev.p ? -prev.dir : prev.dir
        expect(cur.dir, `${id} step ${k}`).toBe(expected)
      }
      expect(x.settled.mean, `${id} settled`).toBeLessThanOrEqual(x.fig.pmpp)
      expect(x.settled.mean, `${id} settled`).toBeGreaterThan(x.path[0].p)
    }
  })

  it('8 · charge is the integral of the current, at every sample', () => {
    for (const id of ['d1', 'd2', 'd3']) {
      const { x, p } = at(id)
      for (const s of x.trace) {
        const want = p.z0 - (p.i * s.t) / x.b.Q
        expect(s.z, `${id} at ${s.t} s`).toBeCloseTo(want, 9)
      }
    }
  })

  it('9 · energy out plus heat plus what the pairs still hold equals what the store gave up', () => {
    const { x, p } = at('d3')
    const zEnd = x.trace[x.trace.length - 1].z
    // The store's own energy is ∫ v dq over the charge that left it, and the
    // open-circuit voltage is a straight line in z, so that integral is the
    // mean voltage times the charge.
    const q = (p.z0 - zEnd) * x.b.Q
    const gave = q * (x.fit.v0 + (x.fit.k * (p.z0 + zEnd)) / 2)
    // The two RC pairs are still charged at the end of the window, and that
    // energy has left the store without reaching the terminal or the heat.
    const end = x.tr.at(p.tEnd).x
    const held = 0.5 * x.b.C2 * end[1] ** 2 + 0.5 * x.b.C1 * end[2] ** 2
    expect(x.out + x.heat + held).toBeCloseTo(gave, 3)
    expect(held).toBeGreaterThan(0)
  })

  it('10 · the day’s ledger closes, at every bank size', () => {
    for (const bankParallel of [25, 50, 100, 200]) {
      const { x } = at('e3', { bankParallel })
      expect(Math.abs(x.g.residual), `bank ${bankParallel}`).toBeLessThan(1e-6)
      // And nothing is both curtailed and unserved in the same hour.
      for (const r of x.g.rows) expect(r.z, `hour ${r.h}`).toBeGreaterThanOrEqual(0.15 - 1e-12)
    }
  })

  it('a bypass diode splits the curve into two maxima, and one is much taller', () => {
    const off = at('b5', { bypass: false })
    const on = at('b5', { bypass: true })
    expect(humps(off.x.curve).length).toBe(1)
    expect(on.x.humps.length).toBe(2)
    const [tall] = [...on.x.humps].sort((a, b) => b.p - a.p)
    expect(tall.p).toBeGreaterThan(2 * Math.min(...on.x.humps.map((h) => h.p)))
  })

  it('the two drives agree wherever both converge', () => {
    const c = { ...CELL_DEFAULTS }
    const s = { shade: null, bypass: null }
    for (const V of [0.1, 0.3, 0.5, 0.55, 0.6, 0.62]) {
      const a = powerAt(c, s, V)
      const b = atV(c, V)
      expect(a.i, `${V} V`).toBeCloseTo(b.i, 9)
    }
  })
})

// ------------------------------------------------------------- every lesson

describe('every lesson is measured', () => {
  const PREFIX = { p: 1e-12, n: 1e-9, µ: 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9, '': 1 }
  const UNITS = /(-?\d+(?:\.\d+)?)\s*([pnµumkMG]?)(VA|var|V|A|W|Ω|s|Hz|J|°|%|dB)(?![A-Za-z⁰¹²³⁴⁵⁶⁷⁸⁹⁻])/g
  /** Every number-with-unit in a sentence, with the value in base units. */
  const quoted = (text) =>
    [...text.replace(/−/g, '-').matchAll(UNITS)].map((m) => ({
      text: m[0].trim(),
      digits: (m[1].split('.')[1] || '').length,
      scale: PREFIX[m[2]],
      value: Math.abs(+m[1]) * PREFIX[m[2]],
    }))
  /** A quoted number stands for a value when it is that value rounded to the digits printed. */
  const stands = (q, v) => {
    const half = 0.5 * 10 ** -q.digits * q.scale
    return Math.abs(q.value - Math.abs(v)) <= Math.max(0.006 * Math.abs(v), half * (1 + 1e-9))
  }
  const close = (got, want, tol) =>
    want === 0 || Math.abs(want) < 1e-12
      ? Math.abs(got) <= (tol ?? 1e-9)
      : Math.abs(got - want) <= (tol ?? 0.006 * Math.abs(want))
  const words = (s) => s.trim().split(/\s+/).length
  const knobOf = (e, key) => e.params.find((k) => k.key === key)
  // A knob's own settings count as justified numbers: the plain knobs' defaults,
  // and every position a choice offers, because a step may name any of them.
  const knobValues = (e) => [
    ...e.params.filter((k) => !k.kind).map((k) => k.default),
    ...e.params.filter((k) => k.kind === 'choice').flatMap((k) => k.options.map((o) => o.value)),
  ]

  // Both checks below collect every disagreement rather than stopping at the
  // first. A lesson file is edited as a whole, and a run that names one bad
  // number out of twenty costs twenty runs to fix.
  let problems = []

  /** Solve one step and check its reads. Returns the numbers it justifies. */
  function measure(e, p, reads, cursor, label) {
    const x = analyse(e, cursor === undefined ? p : { ...p, cursor })
    const again = (over, t) => analyse(e, { ...p, ...over, cursor: t ?? cursor })
    const values = []
    for (const [q, want, tol] of reads) {
      const name = typeof q === 'function' ? 'fn' : q
      let got
      try {
        got = typeof q === 'function' ? q(x, p, again, e) : readQuantity(x, p, q, e)
      } catch (err) {
        problems.push(`${label}: ${name} threw ${err.message}`)
        continue
      }
      if (!Number.isFinite(got)) problems.push(`${label}: ${name} is ${got}`)
      else if (!close(got, want, tol)) problems.push(`${label}: ${name} reads ${+got.toPrecision(6)}, the lesson says ${want}`)
      values.push(want)
    }
    return values
  }

  /** Every quoted number in `text` stands for one of `values`. */
  function justified(text, values, label) {
    for (const q of quoted(text)) {
      if (values.some((v) => stands(q, v))) continue
      problems.push(
        `${label}: "${q.text}" is not a reading or a knob value (have ${values.map((v) => +v.toPrecision(6)).join(', ')})`,
      )
    }
  }

  it('every experiment has a see, two to four tries and a why, and note is see plus why', () => {
    for (const e of EXPERIMENTS) {
      expect(typeof e.see, e.id).toBe('string')
      expect(typeof e.why, e.id).toBe('string')
      expect(e.try.length, `${e.id} tries`).toBeGreaterThanOrEqual(2)
      expect(e.try.length, `${e.id} tries`).toBeLessThanOrEqual(4)
      expect(e.note).toBe(`${e.see} ${e.why}`)
      expect(words(e.see), `${e.id} see is ${words(e.see)} words`).toBeLessThanOrEqual(70)
      expect(words(e.why), `${e.id} why is ${words(e.why)} words`).toBeLessThanOrEqual(160)
      for (const t of e.try)
        expect(words(t.say), `${e.id} try "${t.say.slice(0, 30)}…" is ${words(t.say)} words`).toBeLessThanOrEqual(45)
    }
  })

  it('the numbers in see and why are readings at the defaults, or knob values', () => {

    problems = []
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const seen = measure(e, p, e.seeReads || [], undefined, `${e.id} see`)
      justified(e.see, [...seen, ...knobValues(e)], `${e.id} see`)
      const why = measure(e, p, e.whyReads || [], undefined, `${e.id} why`)
      justified(e.why, [...why, ...seen, ...knobValues(e)], `${e.id} why`)
    }
    expect(problems).toEqual([])
  })

  it('every try sets knobs inside their range and reads what it says', () => {
    problems = []
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
          else if (k.kind === 'choice') expect(k.options.map((o) => o.value), `${label} ${key}`).toContain(v)
          else {
            expect(v, `${label} ${key} below min`).toBeGreaterThanOrEqual(k.min)
            expect(v, `${label} ${key} above max`).toBeLessThanOrEqual(k.max)
            values.push(v)
          }
        }
        const p = { ...d, ...(t.set || {}) }
        if (t.at != null) {
          expect(e.kind, `${label} moves a cursor in an experiment with no time axis`).toBe('battery')
          expect(t.at).toBeGreaterThanOrEqual(0)
          expect(t.at, `${label} cursor past the window`).toBeLessThanOrEqual(p.tEnd * (e.mode === 'round' ? 2 : 1))
          values.push(t.at)
        }
        values.push(...measure(e, p, t.reads || [], t.at, label))
        justified(t.say, [...values, ...knobValues(e)], label)
        steps++
      })
    }
    expect(problems).toEqual([])
    expect(steps).toBeGreaterThanOrEqual(2 * EXPERIMENTS.length)
  })

  it('readQuantity throws on a path it does not know', () => {
    const a1 = at('a1')
    expect(readQuantity(a1.x, a1.p, 'pv.isc', a1.exp)).toBeCloseTo(5, 9)
    expect(() => readQuantity(a1.x, a1.p, 'nope.isc', a1.exp)).toThrow(/unknown quantity path/)
    expect(() => readQuantity(a1.x, a1.p, 'pv.nope', a1.exp)).toThrow(/unknown quantity path/)
  })

  it('the knobs an experiment offers are the ones its analysis reads', () => {
    for (const e of EXPERIMENTS) {
      // A tracker's walk is the expensive thing in this lab, and this check
      // only asks whether a knob changes the answer. Twenty steps show that
      // as well as a hundred and twenty, at a sixth of the cost.
      const p = { ...defaultsOf(e.id), ...(e.kind === 'track' ? { steps: 20 } : {}) }
      // Every knob changes something. Move each one and check the analysis moves.
      for (const k of e.params) {
        if (k.kind === 'choice' || k.kind === 'toggle') continue
        if (k.key === 'hour') continue // it moves the readout, not the solve
        // A knob whose step is one counts things, so move it by one.
        const next =
          k.step === 1
            ? k.default + 1 <= k.max
              ? k.default + 1
              : k.default - 1
            : k.default * 1.2 <= k.max
              ? k.default * 1.2
              : k.default * 0.8
        const moved = { ...p, [k.key]: next }
        const a = JSON.stringify(summary(analyse(e, p)))
        const b = JSON.stringify(summary(analyse(e, moved)))
        expect(a === b, `${e.id}: moving ${k.key} changed nothing`).toBe(false)
      }
    }
  })
})

/** A short digest of an analysis, for the "every knob does something" check. */
function summary(x) {
  if (x.kind === 'battery') return [x.at.v, x.at.i, x.at.z, x.heat ?? 0, x.tSwitch ?? 0]
  if (x.kind === 'day') return [x.g.eIn, x.g.curtailed, x.g.unserved, x.g.zEnd]
  const walk = x.path ? [x.reversal, x.settled.mean, x.settled.swing] : []
  // The converter's own knobs move its waveform rather than the array's
  // operating point, so the ripple has to be in the digest too.
  const conv = x.buck ? [x.buck.m.sig.iL.pp, x.buck.m.sig.vout.pp, x.buck.m.mode] : []
  return [x.at.v, x.at.i, x.at.p, x.fig.pmpp, x.fig.voc, ...walk, ...conv]
}

describe('the analysis wiring', () => {
  it('shading and bypass are data, so two experiments asking the same question share a cache', () => {
    const b3 = byId.b3
    const s = shadeOf(b3, defaultsOf('b3'))
    expect(s.shade).toEqual({ k: 0, G: 300 })
    expect(s.bypass).toBe(null)
    const b5 = byId.b5
    expect(shadeOf(b5, defaultsOf('b5')).bypass).toEqual([0])
  })

  it('the temperature knob is in degrees Celsius and the model is in kelvin', () => {
    const c = cellOf(byId.a8, { ...defaultsOf('a8'), Tc: 25 })
    expect(c.T).toBeCloseTo(298.15, 9)
    expect(cellOf(byId.a8, { ...defaultsOf('a8'), Tc: 65 }).T).toBeCloseTo(338.15, 9)
  })

  it('the string view has one row per cell, and names the shaded one', () => {
    const { x } = at('b3')
    expect(x.cells.length).toBe(12)
    expect(x.cells[0].shaded).toBe(true)
    expect(x.cells[0].reverse).toBe(true)
    for (let k = 1; k < 12; k++) {
      expect(x.cells[k].shaded, `cell ${k}`).toBe(false)
      expect(x.cells[k].reverse, `cell ${k}`).toBe(false)
    }
    // Every cell's voltage adds up to the terminal.
    const sum = x.cells.reduce((s, r) => s + r.v, 0)
    expect(sum).toBeCloseTo(x.at.v, 6)
  })
})
