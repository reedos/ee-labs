import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { complex as cx } from '@ee-labs/network'
import { EXPERIMENTS, defaultsOf } from './experiments.js'
import { analyse, atDrive, experimentMath, turnedLabel } from './math.js'
import { marksFor, timeMarks } from './marks.js'
import { captionFor, captionText, energyAt, sweepAt } from './captions.js'
import PlotCaption from './components/PlotCaption.jsx'
import { num } from './format.js'
import { DASH_OF, SHADES, styleTraces, traceWord } from './palette.js'

// The sentence under every plot says what the plot shows, and every number in
// it is the solver's (student review, Phase 7). For each experiment and each
// of its plot views, at the defaults and at knob settings drawn at random from
// the knobs' ranges, the caption is one sentence of at most fifty words, every
// printed figure appears in the text and re-formats from the value behind it,
// and the figure the view is about equals the analysis it came from.

const PLOTS = ['scope', 'energy', 'phasor', 'impedance', 'bode', 'sweep', 'damping']

/** A small seeded generator so a failing setting can be reproduced. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Knob settings: every slider knob somewhere in its range; toggles at their default. */
function randomParams(exp, rand) {
  const p = defaultsOf(exp.id)
  for (const k of exp.params) {
    if (k.kind === 'toggle' || !Number.isFinite(k.min) || !Number.isFinite(k.max)) continue
    const u = rand()
    p[k.key] = k.scale === 'log' ? 10 ** (Math.log10(k.min) + u * (Math.log10(k.max) - Math.log10(k.min))) : k.min + u * (k.max - k.min)
  }
  return p
}

/** Everything App hands captionFor, computed the way App computes it. */
function setting(exp, p, cursor) {
  const x = analyse(exp, p, cursor)
  const math = experimentMath(exp, p, x)
  const on = (plot) => (x.sol || x.tr ? marksFor(exp, p, x, plot) : [])
  const marks = { scope: [...on('scope'), ...timeMarks(math?.marks)], freq: on('freq'), sweep: on('sweep') }
  const drive = x.ac && exp.out ? atDrive(exp, x) : null
  return { x, marks, drive }
}

const reformat = (part, x) => {
  switch (part.kind) {
    case 'num':
      return num(part.value, part.unit, 3)
    case 'pct':
      return `${(100 * part.value).toFixed(1)} %`
    case 'deg':
      return `${part.value.toFixed(1)}°`
    case 'dB':
      return `${part.value.toFixed(2)} dB`
    case 'times':
      return `×${part.value.toPrecision(3)}`
    case 'plain':
      return part.value.toPrecision(3)
    case 'turned':
      return turnedLabel(x.omega, x.cursor)
    default:
      throw new Error(`unknown kind ${part.kind}`)
  }
}

const has = (parts, value, rel = 1e-9) => parts.some((p) => typeof p !== 'string' && Math.abs(p.value - value) <= rel * Math.max(1, Math.abs(value)))

function check(exp, view, p, where) {
  const { x, marks, drive } = setting(exp, p)
  const on = view === 'scope' ? marks.scope : view === 'sweep' ? marks.sweep : marks.freq
  const parts = captionFor(exp, view, x, p, on, drive)
  const tag = `${exp.id} ${view} ${where}`
  if (x.refusal || (view === 'scope' && !x.sol)) {
    expect(parts, `${tag}: no caption for a refused circuit`).toBeNull()
    return
  }
  expect(parts, `${tag}: has a caption`).not.toBeNull()
  const text = captionText(parts)
  const words = text.split(/\s+/).filter(Boolean)
  expect(words.length, `${tag}: ${words.length} words — "${text}"`).toBeLessThanOrEqual(50)
  expect(text, `${tag}: ends the sentence`).toMatch(/\.$/)
  expect(text, `${tag}: one sentence — "${text}"`).not.toMatch(/[A-Za-z%°)]\.\s/)
  const numbers = parts.filter((q) => typeof q !== 'string')
  expect(numbers.length, `${tag}: has numbers`).toBeGreaterThan(0)
  for (const q of numbers) {
    expect(Number.isFinite(q.value), `${tag}: finite behind "${q.print}"`).toBe(true)
    expect(text, `${tag}: shows ${q.print}`).toContain(q.print)
    expect(q.print, `${tag}: ${q.kind} of ${q.value}`).toBe(reformat(q, x))
  }
  switch (view) {
    case 'scope': {
      expect(has(parts, x.cursor), `${tag}: says t`).toBe(true)
      const q0 = [...exp.scope.left.traces, ...(exp.scope.right ? exp.scope.right.traces : [])].find((q) => !q.dim)
      expect(has(parts, x.sol[q0.q][q0.key]), `${tag}: reads ${q0.label}`).toBe(true)
      expect(text).toContain(q0.label)
      break
    }
    case 'energy': {
      const e = energyAt(x.energy, x.cursor)
      expect(has(parts, Math.abs(e.supplied)), `${tag}: supplied`).toBe(true)
      expect(has(parts, e.stored), `${tag}: stored`).toBe(true)
      expect(has(parts, e.dissipated), `${tag}: dissipated`).toBe(true)
      expect(text).toContain(e.supplied < 0 ? 'taken back' : 'supplied')
      break
    }
    case 'phasor': {
      const X = x.ac[exp.out.q][exp.out.key]
      expect(has(parts, cx.cabs(X)), `${tag}: |out|`).toBe(true)
      expect(has(parts, x.omega * x.cursor), `${tag}: θ`).toBe(true)
      expect(text).toContain(exp.out.label)
      break
    }
    case 'impedance':
      expect(has(parts, cx.cabs(drive.Z)), `${tag}: |Z|`).toBe(true)
      expect(has(parts, x.omega / (2 * Math.PI)), `${tag}: f`).toBe(true)
      expect(text).toMatch(/capacitive|inductive|resonant/)
      break
    case 'bode':
      expect(has(parts, 20 * Math.log10(cx.cabs(drive.H))), `${tag}: dB`).toBe(true)
      expect(has(parts, cx.cabs(drive.H)), `${tag}: ×`).toBe(true)
      break
    case 'sweep': {
      const R = p[exp.sweepId]
      const q = sweepAt(x.sweep.points, R)
      expect(has(parts, R), `${tag}: knob`).toBe(true)
      expect(has(parts, q[exp.sweepY || 'p']), `${tag}: the dot`).toBe(true)
      break
    }
    case 'damping': {
      const at = x.damping.at
      expect(has(parts, 2 * Math.sqrt(p.L1 / p.C1)), `${tag}: R_crit`).toBe(true)
      if (at) {
        expect(has(parts, at.settle), `${tag}: settle`).toBe(true)
        expect(has(parts, at.overshoot), `${tag}: overshoot`).toBe(true)
      }
      break
    }
    default:
      break
  }
}

describe('the sentence under the plot', () => {
  const plotted = EXPERIMENTS.filter((exp) => exp.views.some((v) => PLOTS.includes(v)))

  it('covers every plot view of every experiment', () => {
    let views = 0
    for (const exp of plotted) for (const v of exp.views) if (PLOTS.includes(v)) views++
    expect(views).toBeGreaterThan(40)
    // Views without a plot have no caption to give.
    const a1 = setting(EXPERIMENTS[0], defaultsOf('a1'))
    expect(captionFor(EXPERIMENTS[0], 'reading', a1.x, defaultsOf('a1'), [], null)).toBeNull()
  })

  for (const exp of plotted) {
    it(`${exp.id} — ${exp.name}: at the defaults and at random knob settings, one true sentence per plot`, () => {
      const rand = rng(exp.id.charCodeAt(0) * 131 + exp.id.charCodeAt(1))
      const settings = [
        ['defaults', defaultsOf(exp.id)],
        ['random 1', randomParams(exp, rand)],
        ['random 2', randomParams(exp, rand)],
      ]
      for (const v of exp.views) {
        if (!PLOTS.includes(v)) continue
        for (const [where, p] of settings) check(exp, v, p, where)
      }
    })
  }

  // A colour word is a name only if it names one trace. Six scopes draw two
  // voltages and one drew two powers, and the caption called both "(blue)" or
  // both "(green)": the reader was sent to the screen with a description that
  // fits two curves. Every trace the caption reads out must be described by a
  // phrase no other trace on that scope carries.
  it('every trace a scope caption reads out is described uniquely', () => {
    const scopes = EXPERIMENTS.filter((e) => e.views.includes('scope') && e.scope)
    expect(scopes.length).toBeGreaterThan(20)
    for (const exp of scopes) {
      const p = defaultsOf(exp.id)
      const { x, marks } = setting(exp, p)
      if (!x.sol || !x.tr) continue
      const text = captionText(captionFor(exp, 'scope', x, p, marks.scope, null))
      const words = [...text.matchAll(/\(([a-z ,]+)\)/g)].map((m) => m[1]).filter((w) => /blue|orange|green|gold|purple/.test(w))
      expect(words.length, `${exp.id}: the caption describes its traces — "${text}"`).toBeGreaterThan(0)
      expect(new Set(words).size, `${exp.id}: ${words.join(' / ')} — "${text}"`).toBe(words.length)
    }
  })

  // The words match the picture: the n-th bright trace of a family is drawn in
  // the n-th shade with the n-th dash, and the caption says that shade and that
  // dash.
  it(`the caption’s colour phrase follows styleTraces`, () => {
    const traces = [{ q: 'v', key: 'C1' }, { q: 'v', key: 'L1' }, { q: 'v', key: 'R1' }]
    const styles = styleTraces(traces)
    const words = traces.map((t, i) => traceWord(t, i))
    expect(words).toEqual(['blue', 'pale blue, dashed', 'deep blue, dotted'])
    expect(styles[0].dash).toBe(null)
    expect(styles[1].dash).toEqual(DASH_OF[1])
    expect(styles[2].dash).toEqual(DASH_OF[2])
    expect(styles.map((s) => s.color)).toEqual(SHADES.voltage)
    // A trace that asks for its own dash is dashed wherever it falls in the order.
    expect(traceWord({ q: 'i', key: 'S1', dash: true }, 0)).toBe('orange, dashed')
  })

  it('f3: the caption names the dashed line, the ring and τ with the marks’ own values', () => {
    const exp = EXPERIMENTS.find((e) => e.id === 'f3')
    const p = defaultsOf('f3')
    const { x, marks } = setting(exp, p)
    const text = captionText(captionFor(exp, 'scope', x, p, marks.scope, null))
    const level = marks.scope.find((m) => m.kind === 'level')
    const point = marks.scope.find((m) => m.kind === 'point')
    const seg = marks.scope.find((m) => m.kind === 'segment')
    expect(text).toContain(`E = ${num(level.value, 'V', 3)}`)
    expect(text).toContain('63.2 %')
    expect(text).toContain(num(point.value, 'V', 3))
    expect(text).toContain(`τ = ${num(seg.value, 's', 3)}`)
    expect(text).toContain('v_C (blue)')
  })

  it('moves with the cursor: the scope caption reads the instant the cursor is at', () => {
    const exp = EXPERIMENTS.find((e) => e.id === 'f3')
    const p = defaultsOf('f3')
    const a = setting(exp, p, 0)
    const b = setting(exp, p, 2 * p.R1 * p.C1)
    const ta = captionText(captionFor(exp, 'scope', a.x, p, a.marks.scope, null))
    const tb = captionText(captionFor(exp, 'scope', b.x, p, b.marks.scope, null))
    expect(ta).not.toBe(tb)
    expect(ta).toContain(`At t = ${num(0, 's', 3)}`)
    expect(tb).toContain(`At t = ${num(2 * p.R1 * p.C1, 's', 3)}`)
    expect(tb).toContain(num(b.x.sol.volt.C1, 'V', 3))
  })

  it('renders as a paragraph the tests and a screen reader can find, every number in bold', () => {
    const exp = EXPERIMENTS.find((e) => e.id === 'd6')
    const p = defaultsOf('d6')
    const { x, marks } = setting(exp, p)
    const parts = captionFor(exp, 'sweep', x, p, marks.sweep, null)
    const html = renderToStaticMarkup(<PlotCaption parts={parts} />)
    expect(html).toContain('data-role="caption"')
    expect(html).toContain(`aria-label="${captionText(parts).replace(/"/g, '&quot;')}"`)
    const bold = [...html.matchAll(/<b data-kind="(\w+)">([^<]*)<\/b>/g)]
    const numbers = parts.filter((q) => typeof q !== 'string')
    expect(bold.length).toBe(numbers.length)
    bold.forEach(([, kind, print], i) => {
      expect(kind).toBe(numbers[i].kind)
      expect(print.replace(/&#x27;|&quot;|&amp;/g, '')).toBe(numbers[i].print)
    })
    expect(renderToStaticMarkup(<PlotCaption parts={null} />)).toBe('')
  })
})
