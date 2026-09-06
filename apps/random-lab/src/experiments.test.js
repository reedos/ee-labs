import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS, VIEWS, byId } from './experiments.js'
import { LESSONS } from './lessons.js'
import { TERMS } from './terms.js'
import { analyse, resolve, DEFAULTS } from './analysis.js'

// Every claim in the curriculum, measured against the live analysis.
//
// A claim is one of five kinds, and the kind is the strength of the check.
//
//   formula(p)      a closed form of the experiment's own knobs. The strongest.
//                   Change a knob and the expected value changes with it, so
//                   nothing here is a constant typed in to make a test pass.
//   against         another live quantity, so two routes to one number are
//                   compared rather than one being restated.
//   againstScaled   the same, times a factor, for a claim about a ratio.
//   atMost/atLeast  an inequality between two live quantities, for a claim that
//                   is about an ordering rather than a value.
//   withinOf        inside k standard errors of another quantity, where the
//                   standard error is itself resolved from the analysis.
//
// `tol` is relative unless the claim sets `absolute`.

/** The analysis for one experiment, memoised across the tests in this file. */
const cache = new Map()
const forExperiment = (e) => {
  if (!cache.has(e.id)) cache.set(e.id, analyse(e.params))
  return cache.get(e.id)
}

const paramsOf = (e) => ({ ...DEFAULTS, ...e.params })

describe('the curriculum', () => {
  it('holds thirty experiments in nine groups', () => {
    expect(EXPERIMENTS.length).toBe(30)
    expect(GROUPS.length).toBe(9)
  })

  it('numbers them by their group letter, in order, with no gaps', () => {
    const byLetter = new Map()
    for (const e of EXPERIMENTS) {
      const letter = e.id[0]
      if (!byLetter.has(letter)) byLetter.set(letter, [])
      byLetter.get(letter).push(Number(e.id.slice(1)))
    }
    expect([...byLetter.keys()]).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])
    for (const [letter, ns] of byLetter) {
      expect(ns, letter).toEqual(ns.map((_, i) => i + 1))
    }
  })

  it('gives every experiment a group the sidebar lists', () => {
    for (const e of EXPERIMENTS) expect(GROUPS, e.id).toContain(e.group)
  })

  it('gives every experiment a view it can open, and lists it among its views', () => {
    for (const e of EXPERIMENTS) {
      expect(Object.keys(VIEWS), e.id).toContain(e.view)
      expect(e.views, e.id).toContain(e.view)
      for (const v of e.views) expect(Object.keys(VIEWS), `${e.id} ${v}`).toContain(v)
    }
  })

  it('names a featured knob that the experiment actually has', () => {
    for (const e of EXPERIMENTS) {
      expect(e.featured, e.id).toBeTruthy()
      const p = paramsOf(e)
      expect(Object.keys(p), `${e.id} featured ${e.featured.field}`).toContain(e.featured.field)
    }
  })

  it('has no duplicate ids and no duplicate names', () => {
    const ids = EXPERIMENTS.map((e) => e.id)
    const names = EXPERIMENTS.map((e) => e.name)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
  })

  it('defines every term an experiment names', () => {
    for (const e of EXPERIMENTS) {
      for (const t of e.terms) expect(TERMS[t], `${e.id} names term "${t}"`).toBeTruthy()
    }
  })

  it('carries a lesson for every experiment, and no lesson without one', () => {
    for (const e of EXPERIMENTS) expect(LESSONS[e.id], `${e.id} has no lesson`).toBeTruthy()
    for (const id of Object.keys(LESSONS)) {
      expect(byId(id), `lesson ${id} has no experiment`).toBeTruthy()
    }
  })

  it('makes at least one claim per experiment', () => {
    for (const e of EXPERIMENTS) {
      expect(e.claims, e.id).toBeTruthy()
      expect(e.claims.length, e.id).toBeGreaterThan(0)
    }
  })
})

describe('every quantity path resolves against the live analysis', () => {
  for (const e of EXPERIMENTS) {
    it(`${e.id} ${e.name}`, () => {
      const a = forExperiment(e)
      for (const c of e.claims) {
        expect(() => resolve(a, c.path), `${e.id}: ${c.path}`).not.toThrow()
        for (const key of ['against', 'atMost', 'atLeast']) {
          if (c[key]) expect(() => resolve(a, c[key]), `${e.id}: ${c[key]}`).not.toThrow()
        }
        if (c.againstScaled) {
          expect(() => resolve(a, c.againstScaled.path), `${e.id}: ${c.againstScaled.path}`).not.toThrow()
        }
        if (c.atLeastScaled) {
          expect(() => resolve(a, c.atLeastScaled.path)).not.toThrow()
        }
        if (c.withinOf) {
          expect(() => resolve(a, c.withinOf.path)).not.toThrow()
          expect(() => resolve(a, c.withinOf.se)).not.toThrow()
        }
      }
    })
  }

  it('and a path with no section behind it fails rather than reading undefined', () => {
    const a = analyse({})
    expect(() => resolve(a, 'nosuch.thing')).toThrow(/no section named/)
    expect(() => resolve(a, 'psd.nosuch')).toThrow(/did not resolve/)
  })
})

describe('every claim holds', () => {
  for (const e of EXPERIMENTS) {
    describe(`${e.id} ${e.name}`, () => {
      for (const c of e.claims) {
        it(c.label, () => {
          const a = forExperiment(e)
          const p = paramsOf(e)
          const got = resolve(a, c.path)

          if (c.formula) {
            const want = c.formula(p)
            const gap = c.absolute
              ? Math.abs(got - want)
              : Math.abs(want) < 1e-300
                ? Math.abs(got)
                : Math.abs(got / want - 1)
            expect(gap, `${c.path} = ${got}, wanted ${want}`).toBeLessThanOrEqual(c.tol)
            return
          }
          if (c.against) {
            const want = resolve(a, c.against)
            const gap = Math.abs(want) < 1e-300 ? Math.abs(got) : Math.abs(got / want - 1)
            expect(gap, `${c.path} = ${got}, ${c.against} = ${want}`).toBeLessThanOrEqual(c.tol)
            return
          }
          if (c.againstScaled) {
            const by =
              typeof c.againstScaled.by === 'function' ? c.againstScaled.by(p) : c.againstScaled.by
            const want = resolve(a, c.againstScaled.path) * by
            const gap = Math.abs(got / want - 1)
            expect(gap, `${c.path} = ${got}, wanted ${want}`).toBeLessThanOrEqual(c.tol)
            return
          }
          if (c.withinOf) {
            const want = resolve(a, c.withinOf.path)
            const se = resolve(a, c.withinOf.se)
            expect(Math.abs(got - want), `${c.path} = ${got}, ${c.withinOf.path} = ${want}`)
              .toBeLessThanOrEqual(c.withinOf.k * se)
            return
          }
          if (c.atMost) {
            expect(got, `${c.path} against ${c.atMost}`).toBeLessThanOrEqual(resolve(a, c.atMost) * (1 + 1e-12))
            return
          }
          if (c.atLeast) {
            expect(got, `${c.path} against ${c.atLeast}`).toBeGreaterThanOrEqual(resolve(a, c.atLeast) * (1 - 1e-12))
            return
          }
          if (c.atLeastScaled) {
            const want = resolve(a, c.atLeastScaled.path) * c.atLeastScaled.by
            expect(got).toBeGreaterThanOrEqual(want)
            return
          }
          if (c.atMostValue !== undefined) {
            expect(got).toBeLessThanOrEqual(c.atMostValue)
            return
          }
          if (c.atLeastValue !== undefined) {
            expect(got).toBeGreaterThanOrEqual(c.atLeastValue)
            return
          }
          throw new Error(`${e.id}: claim "${c.label}" states no comparison`)
        })
      }
    })
  }
})

describe('the two seams this lab owns', () => {
  it('A1 is the experiment the Electronics Lab will cross-reference', () => {
    const a1 = byId('A1')
    expect(a1.name).toMatch(/density/)
    // Its numbers come from the shared generator, so the two labs cannot
    // disagree. RANDOM_LAB_PLAN.md section 6 records the hand-over.
    const a = analyse(a1.params)
    const p = paramsOf(a1)
    expect(resolve(a, 'psd.inputDensity')).toBeCloseTo(
      p.noiseRms / Math.sqrt(p.sampleRate / 2),
      15,
    )
  })

  it('F3 is the kT over C experiment Electronics O2 will cross-reference', () => {
    const a = analyse(byId('F3').params)
    // 2.035 microvolts at 1 nF and 300 K, which the Electronics plan quotes as
    // 2.04. The same function produces both.
    expect(resolve(a, 'ktc.rms') * 1e6).toBeCloseTo(2.035, 3)
  })
})
