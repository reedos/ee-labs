import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, byId, defaultsOf } from './experiments.js'
import { analyse } from './analysis.js'
import { experimentMath, trapz } from './math.js'
import { checkFailures, texFailures, valueRowsPretendingToCheck, inertRows } from '@ee-labs/explain/testing'

// The panel held to the suite's standard: every check row agrees at the
// defaults and at random knobs, every formula typesets, no value row poses as
// a comparison, and no check row is a tautology.

const build = (exp, p) => experimentMath(exp, p, analyse(exp, p))

/**
 * A deterministic random setting inside every knob's range. The knobs are
 * drawn in key order, not display order, so reordering the sidebar does not
 * change which settings the test visits.
 */
function randomParams(exp, seed) {
  let s = seed >>> 0
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
  const p = {}
  for (const k of [...exp.params].sort((a, b) => (a.key < b.key ? -1 : 1))) {
    if (k.kind === 'toggle') p[k.key] = rnd() < 0.5 ? 0 : 1
    else if (k.scale === 'log') p[k.key] = k.min * Math.pow(k.max / k.min, rnd())
    else p[k.key] = k.min + (k.max - k.min) * rnd()
  }
  return p
}

describe('the math panel', () => {
  it('agrees with the engine at the defaults of every experiment', () => {
    const fails = []
    for (const e of EXPERIMENTS) fails.push(...checkFailures(build(e, defaultsOf(e.id)), e.id))
    expect(fails).toEqual([])
  })

  it('agrees at random knob settings', () => {
    const fails = []
    for (const e of EXPERIMENTS) {
      for (let seed = 1; seed <= 24; seed++) {
        const p = randomParams(e, seed * 7919 + e.id.charCodeAt(1))
        fails.push(...checkFailures(build(e, p), `${e.id} seed ${seed}`))
      }
    }
    expect(fails).toEqual([])
  }, 120000) // twenty experiments at 24 settings each: ~9 s here, and a CI runner is several times slower

  it('typesets every formula', () => {
    const fails = []
    for (const e of EXPERIMENTS) fails.push(...texFailures(build(e, defaultsOf(e.id)), e.id))
    // The lossy and DCM forms too.
    fails.push(...texFailures(build(byId.b7, defaultsOf('b7')), 'b7'))
    fails.push(...texFailures(build(byId.b4, defaultsOf('b4')), 'b4'))
    expect(fails).toEqual([])
  })

  it('has no value row pretending to be a check', () => {
    const fails = []
    for (const e of EXPERIMENTS) fails.push(...valueRowsPretendingToCheck(build(e, defaultsOf(e.id)), e.id))
    expect(fails).toEqual([])
  })

  it('has no inert check row: every measured column moves when the knobs do', () => {
    const fails = []
    for (const e of EXPERIMENTS) {
      if (e.kind === 'linreg') continue // no check rows: the loss is the definition
      const a = defaultsOf(e.id)
      const b = { ...a }
      for (const k of e.params) {
        if (k.kind === 'toggle') continue
        b[k.key] = k.scale === 'log' ? a[k.key] * 1.7 : Math.min(k.max, a[k.key] * 1.13 + 1e-3)
      }
      if (b.D > 0.9) b.D = 0.6
      fails.push(...inertRows((p) => build(e, p), a, b, e.id))
    }
    expect(fails).toEqual([])
  })

  it('footnotes the ripple formula where its assumptions fail, rather than crossing it out', () => {
    const rows = (p) => build(byId.b7, p).blocks.find((b) => b.kind === 'check').rows
    const withEsr = rows(defaultsOf('b7')).find((r) => r.label === 'ΔV_out')
    expect(withEsr.unchecked).toMatch(/ESR/)
    const noEsr = rows({ ...defaultsOf('b7'), ESR: 0 }).find((r) => r.label === 'ΔV_out')
    expect(noEsr.unchecked).toBeUndefined()
    const dcm = build(byId.b4, defaultsOf('b4')).blocks.find((b) => b.kind === 'check').rows.find((r) => r.label === 'ΔV_out')
    expect(dcm.unchecked).toMatch(/dead interval/)
  })

  it('switches the headline formula with the mode and the parts', () => {
    const tex = (id, over = {}) => build(byId[id], { ...defaultsOf(id), ...over }).blocks.find((b) => b.kind === 'formula').tex
    expect(tex('b2')).toMatch(/M = \\frac\{V_\{out\}\}\{V_\{in\}\} = D/)
    expect(tex('b4')).toMatch(/4K\/D\^2/)
    expect(tex('b7')).toMatch(/R_\{on\}/)
    expect(tex('b6')).toMatch(/V_f/)
  })

  it('shows the DCM bookkeeping only in DCM, and the loss breakdown only with real parts', () => {
    const values = (id, over = {}) => build(byId[id], { ...defaultsOf(id), ...over }).blocks.find((b) => b.kind === 'values').rows.map((r) => r.label)
    expect(values('b4')).toContain('diode conducts for')
    expect(values('b4', { sync: 1 })).not.toContain('diode conducts for')
    expect(values('b3')).not.toContain('diode V_f·I')
    expect(values('b6')).toContain('diode V_f·I')
    expect(values('b6', { sync: 1 })).toContain('sync switch I²R_on')
  })
})

describe('trapz', () => {
  it('is exact for a piecewise-linear trace carrying both sides of its edges', () => {
    expect(trapz([0, 1, 1, 2], [3, 3, 0, 0])).toBeCloseTo(3, 15)
    expect(trapz([0, 2], [0, 4])).toBeCloseTo(4, 15)
  })
})
