import { describe, it, expect } from 'vitest'
import { CROSS_REFS, EXPERIMENTS, GROUPS, GROUP_INTROS, PANEL_VIEWS, PLOT_VIEWS, VIEW_LABELS, VIEW_ORDER, byId, byGroup, defaultsOf, isPlot } from './experiments.js'
import { analyse, readQuantity } from './analysis.js'
import { experimentMath } from './math.js'
import { TERMS } from './terms.js'

// Every note makes a claim, and every claim is measured here. A step's `set`
// is applied over the defaults, its `reads` are solved and compared, and then
// every number-with-unit in the sentence has to be one of those readings or a
// knob value. The same rule holds for the numbers in `see` and `why`. So a
// lesson cannot quote a value the engine does not produce, and a knob move
// cannot name a setting the knob cannot reach.

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
      for (const v of e.views) expect(VIEW_ORDER, `${e.id} view ${v}`).toContain(v)
      for (const k of e.params) {
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

  it('has 42 experiments, in ten groups, in plan order', () => {
    expect(EXPERIMENTS.length).toBe(42)
    expect(byGroup.map((g) => g.items.length)).toEqual([4, 5, 4, 6, 3, 4, 5, 4, 5, 2])
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
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
    expect([...PLOT_VIEWS, ...PANEL_VIEWS].sort()).toEqual([...VIEW_ORDER].sort())
    for (const v of PLOT_VIEWS) expect(isPlot(v), v).toBe(true)
    for (const v of PANEL_VIEWS) expect(isPlot(v), v).toBe(false)
    for (const e of EXPERIMENTS) {
      expect(e.views.filter(isPlot).length, `${e.id} has a picture`).toBeGreaterThan(0)
      expect(e.views.filter((v) => !isPlot(v)).length, `${e.id} has a panel`).toBeGreaterThan(0)
    }
  })

  it('solves at its defaults, and every solve carries the kind it says it does', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      expect(x, e.id).toBeTruthy()
      expect(x.kind, e.id).toBe(e.kind)
    }
  }, 120000)

  it('builds a math panel with at least one measured check row', () => {
    for (const e of EXPERIMENTS) {
      const { x, p } = at(e.id)
      const { blocks } = experimentMath(e, p, x)
      expect(blocks.length, e.id).toBeGreaterThan(0)
      const checks = blocks.filter((b) => b.kind === 'check').flatMap((b) => b.rows)
      expect(checks.length, `${e.id} has a check row`).toBeGreaterThan(0)
      for (const row of checks) {
        if (row.unchecked) continue
        expect(Number.isFinite(row.predicted), `${e.id} ${row.label} predicted`).toBe(true)
        expect(Number.isFinite(row.measured), `${e.id} ${row.label} measured`).toBe(true)
        const gap = Math.abs(row.predicted - row.measured)
        const allow = (row.tol || 0) * Math.abs(row.predicted) + (row.abs || 0)
        expect(gap <= allow + 1e-12, `${e.id} ${row.label}: ${row.predicted} against ${row.measured}`).toBe(true)
      }
    }
  }, 120000)
})

// ------------------------------------------------------------- every lesson

describe('every lesson is measured', () => {
  const PREFIX = { p: 1e-12, n: 1e-9, µ: 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9, '': 1 }
  // Two families of unit. One takes an engineering prefix, the other does not.
  // `pu` and `km` are the units this lab writes bare, and dollars come in
  // front of the number rather than after it.
  // The lookahead keeps a symbol out of the match. "√3 V_b" and "√3 V_LL I_L"
  // are formulas, not readings, and the underscore is what says so.
  const UNITS =
    /(-?\d+(?:\.\d+)?)\s*(?:([pnµumkMG]?)(VA|var|V|A|W|Ω|s|Hz|J|°|%|dB)|(pu|km|cycles))(?![A-Za-z_⁰¹²³⁴⁵⁶⁷⁸⁹⁻])/g
  const MONEY = /\$\s?(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*dollars/g

  /** Every number-with-unit in a sentence, with the value in base units. */
  const quoted = (text) => {
    const plain = text.replace(/−/g, '-')
    const out = [...plain.matchAll(UNITS)].map((m) => ({
      text: m[0].trim(),
      digits: (m[1].split('.')[1] || '').length,
      scale: m[3] ? PREFIX[m[2]] : 1,
      value: Math.abs(+m[1]) * (m[3] ? PREFIX[m[2]] : 1),
      // A reading may be held in the same prefixed unit the sentence writes,
      // so a megawatt figure is checked against both 400 and 4 × 10⁸.
      raw: Math.abs(+m[1]),
    }))
    for (const m of plain.matchAll(MONEY)) {
      const raw = m[1] ?? m[2]
      out.push({ text: m[0].trim(), digits: (raw.split('.')[1] || '').length, scale: 1, value: Math.abs(+raw), raw: Math.abs(+raw) })
    }
    return out
  }
  /** A quoted number stands for a value when it is that value rounded to the digits printed. */
  const stands = (q, v) => {
    const near = (quoted, scale) => Math.abs(quoted - Math.abs(v)) <= Math.max(0.006 * Math.abs(v), 0.5 * 10 ** -q.digits * scale * (1 + 1e-9))
    return near(q.value, q.scale) || near(q.raw, 1)
  }
  const close = (got, want, tol) =>
    want === 0 || Math.abs(want) < 1e-12
      ? Math.abs(got) <= (tol ?? 1e-9)
      : Math.abs(got - want) <= (tol ?? 0.006 * Math.abs(want))
  const words = (s) => s.trim().split(/\s+/).length
  const knobOf = (e, key) => e.params.find((k) => k.key === key)
  // A knob's own settings count as justified numbers. A knob quoted in
  // megawatts or kilovolts is written on screen in those units, so its value
  // counts both raw and scaled by its own prefix.
  const UNIT_SCALE = { MVA: 1e6, MW: 1e6, kV: 1e3, Mvar: 1e6, kA: 1e3, MΩ: 1e6 }
  const knobValues = (e) => {
    const out = []
    for (const k of e.params) {
      if (k.kind === 'choice') continue
      out.push(k.default)
      const scale = UNIT_SCALE[k.unit]
      if (scale) out.push(k.default * scale)
    }
    return out
  }

  // Both checks below collect every disagreement rather than stopping at the
  // first. A lesson file is edited as a whole, and a run that names one bad
  // number out of twenty costs twenty runs to fix.
  let problems = []

  /** Solve one step and check its reads. Returns the numbers it justifies. */
  function measure(e, p, reads, label) {
    const x = analyse(e, p)
    const again = (over) => analyse(e, { ...p, ...over })
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
      else if (!close(got, want, tol)) problems.push(`${label}: ${name} reads ${+got.toPrecision(7)}, the lesson says ${want}`)
      values.push(want)
    }
    return values
  }

  /** Every quoted number in `text` stands for one of `values`. */
  function justified(text, values, label) {
    for (const q of quoted(text)) {
      if (values.some((v) => stands(q, v))) continue
      problems.push(`${label}: "${q.text}" is not a reading or a knob value (have ${values.map((v) => +v.toPrecision(6)).join(', ')})`)
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
      for (const t of e.try) expect(words(t.say), `${e.id} try "${t.say.slice(0, 30)}…" is ${words(t.say)} words`).toBeLessThanOrEqual(45)
    }
  })

  it('the numbers in see and why are readings at the defaults, or knob values', () => {
    problems = []
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const seen = measure(e, p, e.seeReads || [], `${e.id} see`)
      justified(e.see, [...seen, ...knobValues(e)], `${e.id} see`)
      const why = measure(e, p, e.whyReads || [], `${e.id} why`)
      justified(e.why, [...why, ...seen, ...knobValues(e)], `${e.id} why`)
    }
    expect(problems).toEqual([])
  }, 180000)

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
          if (k.kind === 'choice') expect(k.options.map((o) => o.value), `${label} ${key}`).toContain(v)
          else {
            expect(v, `${label} ${key} below min`).toBeGreaterThanOrEqual(k.min)
            expect(v, `${label} ${key} above max`).toBeLessThanOrEqual(k.max)
            values.push(v)
            const scale = UNIT_SCALE[k.unit]
            if (scale) values.push(v * scale)
          }
        }
        const p = { ...d, ...(t.set || {}) }
        values.push(...measure(e, p, t.reads || [], label))
        justified(t.say, [...values, ...knobValues(e)], label)
        steps++
      })
    }
    expect(problems).toEqual([])
    expect(steps).toBeGreaterThanOrEqual(2 * EXPERIMENTS.length)
  }, 300000)

  it('readQuantity throws on a path it does not know', () => {
    const a1 = at('a1')
    expect(readQuantity(a1.x, a1.p, 'base.Zbase', a1.exp)).toBeCloseTo(529, 9)
    expect(() => readQuantity(a1.x, a1.p, 'nope.Zbase', a1.exp)).toThrow(/unknown quantity path/)
    expect(() => readQuantity(a1.x, a1.p, 'base.nope', a1.exp)).toThrow(/unknown quantity path/)
  })

  it('the knobs an experiment offers are the ones its analysis reads', () => {
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      for (const k of e.params) {
        if (k.kind === 'choice') continue
        // A knob may bite over part of its range only. A reactive limit above
        // what the bus needs changes nothing, and that is the physics rather
        // than a dead control, so the check probes several positions.
        const probes = [k.min, k.max, (k.min + k.max) / 2, k.step === 1 ? k.default + 1 : k.default * 1.2].filter(
          (v) => v >= k.min && v <= k.max && v !== k.default,
        )
        const a = JSON.stringify(summary(analyse(e, p)))
        const moved = probes.some((v) => JSON.stringify(summary(analyse(e, { ...p, [k.key]: v }))) !== a)
        expect(moved, `${e.id}: moving ${k.key} changed nothing at ${probes.join(', ')}`).toBe(true)
      }
    }
  }, 300000)
})

/** A short digest of an analysis, for the "every knob does something" check. */
function summary(x) {
  if (x.kind === 'base') return [x.b.Zbase, x.b.Ibase, x.gen, x.tx, x.pu.P, x.pu.Q, x.at.constantImpedance.P, x.low.Zbase, x.puFromLow]
  if (x.kind === 'phase') return [x.load.I, x.load.P, x.load.pf, x.inst.min, x.delta.Iline, x.wyeOfDelta, ...x.seq.mag, ...x.seq.ang]
  if (x.kind === 'line') return [x.pi.Z[1], x.rise.exact, x.rise.nominal, x.balance.net, x.Vr, x.drop, x.estimate, x.shunt.mvar, x.model.long ? 1 : 0]
  if (x.kind === 'flow') return [x.sol ? x.sol.Ploss : NaN, x.sol ? x.sol.byId.bus3.V : NaN, x.sol ? x.sol.byId.bus2.Q : NaN, x.sol ? x.sol.iterations : NaN, x.dc.theta[2], x.sol ? x.guard.maxAngle : NaN, x.refusal ? 1 : 0]
  if (x.kind === 'seq') return [...x.seq.mag, x.neutral.mag, x.unbalance, x.z.Z0[1], x.z.Z1[1], x.zWye.Z0[1], x.zNeutral.Z0[1]]
  if (x.kind === 'fault') return [...x.study.seqMag, ...x.study.phaseMag, x.study.groundMag, x.z.Z0[1], x.z.Z1[1], ...x.table.map((f) => Math.max(...f.phaseMag))]
  if (x.kind === 'relay') return [x.down, x.up.time, x.up.tds, x.z.Z, x.zNo.Z, x.zones.zone1, x.threshold, x.zone.zone ?? -1]
  if (x.kind === 'swing') return [x.st.M, x.st.delta0, x.st.deltaCr, x.st.tcr, x.st.fnPost, x.st.areaAccel, x.run.stable ? x.run.peak : -1, x.run.step]
  if (x.kind === 'dispatch') return [x.d.lambda, x.d.cost, x.d.saving, x.marginal, ...x.d.units.map((u) => u.P)]
  return []
}
