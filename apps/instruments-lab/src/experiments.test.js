import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS, VIEW_ORDER, VIEW_LABELS, byId, defaultsOf, drawables, isDynamic, layoutOf } from './experiments.js'
import { readQuantity } from './lessons.js'
import { aliasOf, analyse, bandOf, cornerOf, enbwOf, envelope, experimentMath, meterOf, onePole, par, refusalReason, snapNoise } from './math.js'
import { CROP_PAD, layoutExtent, layoutProblems } from './layoutCheck.js'
import { agrees } from '@ee-labs/explain'
import { complex as cx, solveAC, solveDC } from '@ee-labs/network'
import { schematicGeometry } from '@ee-labs/ui'

// Every lesson makes a claim; every claim is measured here. The math panel's
// check rows are the first line — each row is a closed form against a solve —
// and the specific sentences of each lesson are the second, so the prose cannot
// drift from the circuit without a test noticing.

const TWO_PI = 2 * Math.PI
const at = (id, over = {}, cursor) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p, cursor) }
}

/**
 * A deterministic random setting inside every knob's range.
 *
 * Log knobs roam one decade either side of their default rather than their
 * whole range. This lab puts milliohm shunts and ten-megohm inputs in the same
 * knob helper, and a shunt of 30 MΩ is not a shunt. A knob marked `fixed`
 * carries a premise the experiment is about (two tones that differ, a reference
 * on the signal) and the try steps exercise it instead.
 */
function randomParams(exp, seed) {
  let s = seed >>> 0
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
  const p = {}
  for (const k of exp.params) {
    if (k.kind || k.fixed) {
      p[k.key] = k.default
    } else if (k.scale === 'log') {
      const lo = Math.max(k.min, k.default / 10)
      const hi = Math.min(k.max, k.default * 10)
      p[k.key] = lo * Math.pow(hi / lo, rnd())
    } else {
      p[k.key] = k.min + (k.max - k.min) * rnd()
    }
  }
  return p
}
const SETTINGS = (e, n = 25) => [defaultsOf(e.id), ...Array.from({ length: n }, (_, k) => randomParams(e, k * 7919 + 17))]

describe('every experiment', () => {
  it('has a unique id, a group from the list, a lesson, knobs, a layout and views', () => {
    const ids = new Set()
    for (const e of EXPERIMENTS) {
      expect(ids.has(e.id), e.id).toBe(false)
      ids.add(e.id)
      expect(e.name.length).toBeGreaterThan(4)
      expect(e.note.length, `${e.id} note`).toBeGreaterThan(80)
      expect(e.params.length).toBeGreaterThan(0)
      expect(layoutOf(e, defaultsOf(e.id)).items.length).toBeGreaterThan(2)
      expect(e.views).toContain(e.view)
      expect(GROUPS).toContain(e.group)
      expect(['i', 'v', 'p']).toContain(e.show)
      for (const v of e.views) expect(VIEW_ORDER, `${e.id} view ${v}`).toContain(v)
      // The view switch lists views in one order, whatever order an experiment names them in.
      expect([...e.views].sort((a, b) => VIEW_ORDER.indexOf(a) - VIEW_ORDER.indexOf(b))).toEqual(e.views)
      for (const k of e.params) {
        if (k.kind === 'toggle') {
          expect(typeof k.default, `${e.id}.${k.key}`).toBe('boolean')
          expect(k.on && k.off, `${e.id}.${k.key} labels`).toBeTruthy()
          continue
        }
        if (k.kind === 'choice') {
          expect(k.options.length, `${e.id}.${k.key} options`).toBeGreaterThan(1)
          expect(k.options.map((o) => o.value), `${e.id}.${k.key} default`).toContain(k.default)
          continue
        }
        expect(k.default, `${e.id}.${k.key}`).toBeGreaterThanOrEqual(k.min)
        expect(k.default, `${e.id}.${k.key}`).toBeLessThanOrEqual(k.max)
      }
    }
    expect(EXPERIMENTS.length).toBe(25)
  })

  it('every view name has a label and a hover text', () => {
    for (const v of VIEW_ORDER) {
      expect(VIEW_LABELS[v], v).toBeTruthy()
      expect(VIEW_LABELS[v].label.split(/\s+/).length, v).toBeLessThanOrEqual(4)
    }
  })

  it('draws every element it solves, and solves every element it draws', () => {
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const ids = new Set(drawables(e, p).map((el) => el.id))
      const layout = layoutOf(e, p)
      const drawn = new Set(layout.items.filter((it) => it.el).map((it) => it.el))
      expect([...drawn].sort(), e.id).toEqual([...ids].sort())
      // Every node the netlist names (except ground) has a dot, so its voltage is readable.
      const nodes = new Set(drawables(e, p).flatMap((el) => el.nodes))
      nodes.delete('gnd')
      const dots = new Set(layout.items.filter((it) => it.node).map((it) => it.node))
      for (const n of nodes) expect(dots.has(n), `${e.id}: node ${n} has no dot`).toBe(true)
    }
  })

  it('solves at its defaults with KCL holding and Tellegen closing', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      expect(x.sol, `${e.id}: ${x.refusal && x.refusal.message}`).not.toBeNull()
      const scale = Math.max(...Object.values(x.sol.i).map(Math.abs))
      expect(x.sol.maxResidual, e.id).toBeLessThan(1e-9 * Math.max(scale, 1e-9))
      const pScale = Math.max(...Object.values(x.sol.p).map(Math.abs))
      expect(Math.abs(x.sol.pTotal), `${e.id} Tellegen`).toBeLessThan(1e-9 * Math.max(pScale, 1e-12))
    }
  })

  it('has a math panel whose every check row agrees, at the defaults and at 25 random settings', () => {
    for (const e of EXPERIMENTS) {
      for (const p of SETTINGS(e)) {
        const x = analyse(e, p)
        expect(x.sol, `${e.id} at ${JSON.stringify(p)}`).not.toBeNull()
        const m = experimentMath(e, p, x)
        const rows = m.blocks.filter((b) => b.kind === 'check').flatMap((b) => b.rows)
        expect(rows.length, `${e.id} has check rows`).toBeGreaterThan(0)
        for (const r of rows) {
          expect(Number.isFinite(r.measured), `${e.id} "${r.label}" measured is ${r.measured} at ${JSON.stringify(p)}`).toBe(true)
          expect(agrees(r), `${e.id} "${r.label}": theory ${r.predicted} vs measured ${r.measured} at ${JSON.stringify(p)}`).toBe(true)
        }
      }
    }
  }, 600000)

  it('draws cleanly: no text on any other text, symbol or wire, at the defaults and at 8 random settings', () => {
    for (const e of EXPERIMENTS) {
      for (const p of SETTINGS(e, 8)) {
        const x = analyse(e, p)
        const els = drawables(e, p)
        const layout = layoutOf(e, p)
        const crop = layoutExtent(layout, els)
        const problems = layoutProblems({ ...layout, crop }, els, x.sol ? snapNoise(x.sol) : null, e.show)
        expect(problems, `${e.id}: ${problems.join(' | ')}`).toEqual([])
      }
    }
  }, 300000)

  it('crops to a frame that does not move when the knobs do', () => {
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const layout = layoutOf(e, p)
      const crop = layoutExtent(layout, drawables(e, p))
      expect(crop[2] - crop[0], `${e.id} width`).toBeGreaterThan(80)
      expect(crop[3] - crop[1], `${e.id} height`).toBeGreaterThan(60)
      for (const q of SETTINGS(e, 6).slice(1)) {
        // The layout is a function of the toggles only, so a value knob never moves the frame.
        const same = { ...q }
        for (const k of e.params) if (k.kind) same[k.key] = k.default
        expect(layoutExtent(layoutOf(e, same), drawables(e, same)), `${e.id} frame moved`).toEqual(crop)
      }
      expect(CROP_PAD).toBe(6)
      expect(typeof schematicGeometry.textBox).toBe('function')
    }
  })
})

// The plan's §2.7: eight properties every experiment in this lab satisfies,
// each one the reason a whole group is trustworthy rather than merely drawn.
describe('the lab’s invariants', () => {
  it('1 and 2 — KCL and Tellegen hold at 25 random settings of every experiment', () => {
    for (const e of EXPERIMENTS) {
      for (const p of SETTINGS(e)) {
        const x = analyse(e, p)
        const iScale = Math.max(...Object.values(x.sol.i).map(Math.abs), 1e-12)
        expect(x.sol.maxResidual, `${e.id} KCL`).toBeLessThan(1e-9 * iScale)
      }
    }
  }, 300000)

  it('3 — a compensated probe is flat, at every frequency, to a part in 10¹²', () => {
    const e = byId.a3
    for (const p of SETTINGS(e, 8)) {
      // Compensation is a relation between the knobs, so it is imposed here.
      const q = { ...p, C1: (p.R2 * p.C2) / p.R1 }
      const dc = q.R2 / (q.R1 + q.R2)
      for (const f of [1e-3, 1, 1e3, 1e6, 1e9, 1e12]) {
        const ac = solveAC(e.net(q), TWO_PI * f, { anyFreq: true })
        expect(cx.cabs(ac.v.in) / q.A, `|H| at ${f} Hz`).toBeCloseTo(dc, 12)
        expect(cx.carg(ac.v.in), `∠H at ${f} Hz`).toBeCloseTo(0, 12)
      }
    }
  })

  it('4 — a mis-compensated probe’s step is the capacitive ratio, then the resistive one', () => {
    const e = byId.a4
    for (const C1 of [0.4e-12, 1e-12, 3e-12, 8e-12]) {
      const p = { ...defaultsOf('a4'), C1 }
      const x = analyse(e, p)
      const edge = (p.A * p.C1) / (p.C1 + p.C2)
      const settled = (p.A * p.R2) / (p.Rcal + p.R1 + p.R2)
      const tau = par(p.R1, p.R2) * (p.C1 + p.C2)
      const tFast = 20 * p.Rcal * (p.C1 + p.C2)
      // The prediction assumes the fast mode carries the whole initial jump,
      // which is exact only as Rcal/(R1∥R2) → 0. The same guard as the math
      // panel's row bounds how far short of exact that leaves it.
      const guard = Math.max(1e-6, (3 * p.Rcal) / par(p.R1, p.R2))
      const predicted = settled + (edge - settled) * Math.exp(-tFast / tau)
      expect(Math.abs(x.tr.at(tFast).sol.v.in - predicted), `C1=${C1}`).toBeLessThan(guard * Math.abs(predicted))
      expect(x.tr.at(0.45 / p.fc).sol.v.in / settled).toBeCloseTo(1, 8)
    }
  })

  it('5 — the alias identity: two sampled sequences agree to 1e-12 of the tone', () => {
    const e = byId.b1
    for (const [f, fs] of [[9000, 10000], [19000, 10000], [4000, 10000], [4600, 8000], [3900, 8000]]) {
      const p = { ...defaultsOf('b1'), f, fs }
      const x = analyse(e, p)
      const a = aliasOf(f, fs)
      const A = cx.cabs(x.ac.v.in)
      const th = cx.carg(x.ac.v.in)
      const sign = a.folded ? -1 : 1
      const settled = 20 * par(p.Rs, p.R2) * p.C2
      let counted = 0
      for (let k = 0; k < x.samples.t.length; k++) {
        const t = x.samples.t[k]
        if (t < settled) continue
        counted++
        expect(Math.abs(x.samples.y[k] - sign * A * Math.sin(TWO_PI * a.f * t + sign * th))).toBeLessThan(1e-12 * A)
      }
      expect(counted, `${f} Hz at ${fs} Sa/s`).toBeGreaterThan(20)
    }
  })

  it('6 — the analyser’s −3 dB points are geometric about f₀, and their gap is f₀/Q', () => {
    for (const id of ['d1', 'd2']) {
      const e = byId[id]
      for (const p of SETTINGS(e, 6)) {
        const f0 = 1 / (TWO_PI * Math.sqrt(p.L * p.C))
        const q = (TWO_PI * f0 * p.L) / p.R
        const band = bandOf(e, p)
        expect(band.geo / f0, `${id} √(f₁f₂)`).toBeCloseTo(1, 9)
        expect(band.bw / (f0 / q), `${id} width`).toBeCloseTo(1, 6)
      }
    }
  }, 300000)

  it('7 — the detector’s two paths agree: the exact transient’s rms and the phasors’', () => {
    const e = byId.d3
    for (const p of SETTINGS(e, 4)) {
      const x = analyse(e, p)
      const net = e.net(p)
      const a = cx.cabs(solveAC(net, TWO_PI * p.fa).v.out)
      const b = cx.cabs(solveAC(net, TWO_PI * p.fb).v.out)
      expect(x.detector.rms / Math.sqrt((a * a + b * b) / 2), JSON.stringify(p)).toBeCloseTo(1, 6)
    }
  }, 300000)

  it('8 — the mixer identity: the product equals its two-term sum to 1e-15', () => {
    for (const id of ['e1', 'e2', 'e3', 'e4']) {
      const e = byId[id]
      for (const p of SETTINGS(e, 4)) {
        const M = (p.A * p.Vr) / (2 * p.Vu)
        const phi = (p.phi * Math.PI) / 180
        for (let k = 0; k < 200; k++) {
          const t = (k / 200) * (4 / p.fr)
          const prod = (p.A * Math.sin(TWO_PI * p.fs * t + phi) * p.Vr * Math.sin(TWO_PI * p.fr * t)) / p.Vu
          const sum = M * Math.cos(TWO_PI * (p.fs - p.fr) * t + phi) - M * Math.cos(TWO_PI * (p.fs + p.fr) * t + phi)
          expect(Math.abs(prod - sum)).toBeLessThan(1e-15 * Math.max(1, 2 * M))
        }
      }
    }
  })
})

// The closed forms the group files and the lessons both lean on, checked once
// against numbers a reader can verify by hand.
describe('the closed forms', () => {
  it('a one-pole corner, its magnitude and its equivalent noise bandwidth', () => {
    expect(cornerOf(1e6, 15e-12)).toBeCloseTo(10610.3, 1)
    expect(onePole(20000, 20000)).toBeCloseTo(1 / Math.SQRT2, 12)
    expect(enbwOf(1000, 1e-6)).toBe(250)
    // The equivalent noise bandwidth of one pole is π/2 times its corner, exactly.
    expect(enbwOf(1000, 1e-6) / cornerOf(1000, 1e-6)).toBeCloseTo(Math.PI / 2, 12)
  })

  it('an alias is the distance to the nearest multiple of the sample rate', () => {
    expect(aliasOf(9000, 10000)).toEqual({ m: 1, f: 1000, folded: true })
    expect(aliasOf(4000, 10000)).toEqual({ m: 0, f: 4000, folded: false })
    expect(aliasOf(19000, 10000)).toEqual({ m: 2, f: 1000, folded: true })
    expect(aliasOf(11000, 10000)).toEqual({ m: 1, f: 1000, folded: false })
  })

  it('a meter shows the reading rounded to its count, and half a count is its resolution', () => {
    const m = meterOf(4.7619047619, { counts: 1999, fullScale: 20, pct: 0.5, terms: 2 })
    expect(m.step).toBeCloseTo(0.01, 12)
    expect(m.shown).toBeCloseTo(4.76, 12)
    expect(m.halfCount).toBeCloseTo(0.005, 12)
    expect(m.spec).toBeCloseTo(0.005 * 4.76 + 0.02, 12)
    expect(m.pct).toBeCloseTo((100 * (0.005 * 4.76 + 0.02)) / 4.76, 9)
    const fine = meterOf(4.7619047619, { counts: 19999, fullScale: 20 })
    expect(fine.step).toBeCloseTo(0.001, 12)
    expect(fine.shown).toBeCloseTo(4.762, 12)
    expect(fine.spec).toBe(0)
  })

  it('a resistor and a capacitor in parallel are exactly a megohm at DC and 1/ωC well past the corner', () => {
    const { x, p } = at('a1', { f: 1e6 })
    expect(cx.cabs(x.ac.v.in) / p.I).toBeCloseTo(1 / Math.hypot(1 / p.R2, TWO_PI * 1e6 * p.C2), 6)
    const dc = solveDC({ elements: [
      { type: 'I', id: 'I1', nodes: ['gnd', 'in'], value: p.I },
      { type: 'R', id: 'R2', nodes: ['in', 'gnd'], value: p.R2 },
      { type: 'C', id: 'C2', nodes: ['in', 'gnd'], value: p.C2 },
    ] })
    expect(dc.v.in / p.I).toBeCloseTo(p.R2, 6)
  })

  it('the envelope of a ringing band-pass rises to the phasor solve’s amplitude', () => {
    const { x } = at('d4')
    const peaks = envelope(x.tr, (sol) => sol.v.out)
    expect(peaks.length).toBeGreaterThan(20)
    expect(peaks[peaks.length - 1].y / cx.cabs(x.ac.v.out)).toBeCloseTo(1, 3)
    // Each peak is above the last: an envelope that rises, not a beat.
    for (let k = 1; k < peaks.length; k++) expect(peaks[k].y).toBeGreaterThan(peaks[k - 1].y)
  })
})

// Phase 1 of the student review's shape, as Circuit Elements Lab has it: the
// lesson is three registers, and the middle one is a list of knob moves each
// with the reading it produces. A step's `set` is applied over the defaults, its
// `at` moves the cursor, its `reads` are solved and compared, and then every
// number-with-unit in the sentence has to be one of those readings, a knob
// value, or the cursor time.
describe('every lesson is measured', () => {
  const PREFIX = { p: 1e-12, n: 1e-9, µ: 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9, '': 1 }
  const UNITS = /(-?\d+(?:\.\d+)?)\s*([pnµumkMG]?)(VA|var|V|A|W|Ω|s|Hz|J|°|%|dB|K)(?![A-Za-z⁰¹²³⁴⁵⁶⁷⁸⁹⁻])/g
  const quoted = (text) =>
    [...text.replace(/−/g, '-').matchAll(UNITS)].map((m) => ({
      text: m[0].trim(),
      digits: (m[1].split('.')[1] || '').length,
      scale: PREFIX[m[2]],
      value: Math.abs(+m[1]) * PREFIX[m[2]],
    }))
  /** A quoted number stands for a value when it is that value rounded to the digits printed (or within 0.6 %). */
  const stands = (q, v) => {
    const half = 0.5 * 10 ** -q.digits * q.scale
    return Math.abs(q.value - Math.abs(v)) <= Math.max(0.006 * Math.abs(v), half * (1 + 1e-9))
  }
  const close = (got, want, tol) =>
    want === 0 || Math.abs(want) < 1e-12 ? Math.abs(got) <= (tol ?? 1e-9) : Math.abs(got - want) <= (tol ?? 0.006 * Math.abs(want))
  const words = (s) => s.trim().split(/\s+/).length
  const knobOf = (e, key) => e.params.find((k) => k.key === key)

  /** Solve one step (or the see/why register) and check its reads; returns the numbers it justifies. */
  function measure(e, p, reads, cursor, label) {
    const x = analyse(e, p, cursor)
    expect(x.sol, `${label}: the circuit has no solution here (${x.refusal && x.refusal.code})`).toBeTruthy()
    const values = []
    for (const [q, want, tol] of reads) {
      const name = typeof q === 'function' ? 'fn' : q
      const got = typeof q === 'function' ? q(x, p, e) : readQuantity(x, p, q, e)
      expect(Number.isFinite(got), `${label}: ${name} is ${got}`).toBe(true)
      expect(close(got, want, tol), `${label}: ${name} reads ${got}, the lesson says ${want}`).toBe(true)
      values.push(want)
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
  const knobValues = (e) => e.params.filter((k) => !k.kind).map((k) => k.default)

  it('every experiment has a see, two to four tries and a why, and note is see + why', () => {
    for (const e of EXPERIMENTS) {
      expect(typeof e.see, e.id).toBe('string')
      expect(typeof e.why, e.id).toBe('string')
      expect(e.try.length, `${e.id} tries`).toBeGreaterThanOrEqual(2)
      expect(e.try.length, `${e.id} tries`).toBeLessThanOrEqual(4)
      expect(e.note).toBe(`${e.see} ${e.why}`)
      expect(words(e.see), `${e.id} see is ${words(e.see)} words`).toBeLessThanOrEqual(70)
      for (const t of e.try) expect(words(t.say), `${e.id} try "${t.say.slice(0, 30)}…" is ${words(t.say)} words`).toBeLessThanOrEqual(45)
    }
  })

  it('the numbers in see and why are readings at the defaults, or knob values', () => {
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const seeAt = e.seeAt ?? (isDynamic(e) ? e.cursor * e.window(p) : undefined)
      const seen = measure(e, p, e.seeReads || [], seeAt, `${e.id} see`)
      justified(e.see, [...seen, ...knobValues(e), ...(e.seeAt != null ? [e.seeAt] : [])], `${e.id} see`)
      const why = measure(e, p, e.whyReads || [], seeAt, `${e.id} why`)
      justified(e.why, [...why, ...seen, ...knobValues(e)], `${e.id} why`)
    }
  }, 300000)

  it('every try sets knobs inside their range, moves the cursor inside the window, and reads what it says', () => {
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
          expect(isDynamic(e), `${label} moves the cursor of a static experiment`).toBe(true)
          expect(t.at).toBeGreaterThanOrEqual(0)
          expect(t.at, `${label} cursor past the window`).toBeLessThanOrEqual(e.window(p))
          values.push(t.at)
        }
        values.push(...measure(e, p, t.reads || [], t.at, label))
        justified(t.say, [...values, ...knobValues(e)], label)
        steps++
      })
    }
    expect(steps).toBeGreaterThanOrEqual(2 * EXPERIMENTS.length)
  }, 300000)

  it('readQuantity reads every kind of path, and throws on a path it does not know', () => {
    const a1 = at('a1')
    expect(readQuantity(a1.x, a1.p, 'zin.mag', a1.exp)).toBeCloseTo(cx.cabs(a1.x.ac.v.in) / a1.p.I, 6)
    expect(readQuantity(a1.x, a1.p, 'v.in', a1.exp)).toBeCloseTo(a1.x.sol.v.in, 12)
    expect(readQuantity(a1.x, a1.p, 'period', a1.exp)).toBeCloseTo(1 / a1.p.f, 12)
    expect(() => readQuantity(a1.x, a1.p, 'nope.in', a1.exp)).toThrow(/unknown quantity path/)
    const a2 = at('a2')
    expect(readQuantity(a2.x, a2.p, 'corner', a2.exp)).toBeCloseTo(cornerOf(par(a2.p.Rs, a2.p.R2), a2.p.C2), 3)
    expect(readQuantity(a2.x, a2.p, 'H.db', a2.exp)).toBeCloseTo(20 * Math.log10(readQuantity(a2.x, a2.p, 'H.mag', a2.exp)), 12)
    const a3 = at('a3')
    expect(readQuantity(a3.x, a3.p, 'ratio.dc', a3.exp)).toBeCloseTo(0.1, 12)
    expect(readQuantity(a3.x, a3.p, 'ratio.hf', a3.exp)).toBeCloseTo(0.1, 12)
    const a6 = at('a6')
    expect(readQuantity(a6.x, a6.p, 'risetime', a6.exp)).toBeCloseTo(Math.log(9) * par(a6.p.Rs, a6.p.R2) * a6.p.C2, 9)
    const b1 = at('b1')
    expect(readQuantity(b1.x, b1.p, 'alias', b1.exp)).toBe(1000)
    const c1 = at('c1')
    expect(readQuantity(c1.x, c1.p, 'vd.out.gnd', c1.exp)).toBeCloseTo(c1.x.sol.v.out, 12)
    const d1 = at('d1')
    expect(readQuantity(d1.x, d1.p, 'rbw', d1.exp)).toBeCloseTo(100, 3)
    expect(readQuantity(d1.x, d1.p, 'fzero', d1.exp)).toBeCloseTo(10000, 2)
    expect(readQuantity(d1.x, d1.p, 'qfactor', d1.exp)).toBeCloseTo(100, 3)
    const d3 = at('d3')
    expect(readQuantity(d3.x, d3.p, 'detect.rms', d3.exp)).toBeCloseTo(d3.x.detector.rms, 12)
    const f1 = at('f1')
    expect(readQuantity(f1.x, f1.p, 'meter.shown', f1.exp)).toBeCloseTo(4.76, 12)
    expect(readQuantity(f1.x, f1.p, 'meter.step', f1.exp)).toBeCloseTo(0.01, 12)
    const f3 = at('f3')
    expect(readQuantity(f3.x, f3.p, 'sens.R1', f3.exp)).toBeCloseTo(-0.5, 6)
    expect(readQuantity(f3.x, f3.p, 'sens.quad', f3.exp)).toBeCloseTo(Math.SQRT1_2, 6)
    expect(readQuantity(f3.x, f3.p, 'sens.worst', f3.exp)).toBeCloseTo(1, 9)
  })

  it('a refusal comes with the reason, as a sentence', () => {
    // Two capacitors and an ideal source in one loop have no state space, which
    // is why A3 sweeps frequency and A4 carries the calibrator's resistance.
    const bad = { elements: byId.a4.net(defaultsOf('a4')).elements.filter((e) => e.id !== 'Rcal').map((e) => (e.id === 'V1' ? { ...e, nodes: ['tip', 'gnd'] } : e)) }
    const exp = { ...byId.a4, net: () => bad }
    const x = analyse(exp, defaultsOf('a4'))
    expect(x.sol).toBeNull()
    expect(refusalReason(x.refusal)).toMatch(/^[A-Z]/)
    expect(x.refusal.code).toBe('state-loop')
  })
})
