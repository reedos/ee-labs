import { describe, it, expect } from 'vitest'
import { analyse } from './analysis.js'
import { applyExperiment, applyStep, byId, EXPERIMENTS } from './experiments.js'
import { guardOf, presentMargins, topbar, verdictBadge } from './verdict.js'

// The rule this lab adds to the house style, held to.
//
// An approximation is never on screen without its guard beside it. The top bar
// is where the guard lives, so this file walks every experiment and asks the
// top bar what it would print. A mode that carries an approximation and hands
// back no guard fails here.

describe('the verdict', () => {
  it('names the three states and colours them', () => {
    expect(verdictBadge('stable')).toEqual({ word: 'stable', tone: 'good' })
    expect(verdictBadge('marginal').tone).toBe('warn')
    expect(verdictBadge('unstable').tone).toBe('bad')
  })

  it('reads the unit circle in a sampled view and the half plane otherwise', () => {
    expect(topbar(analyse(applyExperiment(byId('B4')))).where).toBe('inside the unit circle')
    expect(topbar(analyse(applyExperiment(byId('A5')))).where).toBe('in the left half plane')
  })

  it('flips when the sampled loop is driven past its bound', () => {
    // B4's own claim: stable at Kp = 20, gone at 21, while the continuous
    // loop beside it does not move.
    const holds = topbar(analyse(applyStep(byId('B4'), { set: { kp: 20 } })))
    const gone = topbar(analyse(applyStep(byId('B4'), { set: { kp: 21 } })))
    expect(holds.verdict.word).toBe('stable')
    expect(gone.verdict.word).toBe('unstable')
  })
})

describe('the margins', () => {
  it('a loop with no crossover says so rather than printing nothing', () => {
    const out = presentMargins({ phaseMargin: null, gainMargin: null })
    expect(out.phase.text).toBe('no crossover')
    expect(out.phase.note).toMatch(/never passes 1/)
    expect(out.gain.text).toBe('none')
    expect(out.gain.note).toMatch(/−180/)
  })

  it('a loop that has them prints them with their units', () => {
    const out = presentMargins({ phaseMargin: 51.97, gainMargin: 11.25 })
    expect(out.phase.text).toMatch(/°$/)
    expect(out.gain.text).toMatch(/×$/)
    expect(out.phase.note).toBeNull()
  })
})

describe('an approximation is never on screen without its guard', () => {
  it('every emulated controller brings its samples-per-cycle guard', () => {
    for (const e of EXPERIMENTS.filter((x) => x.patch.mode === 'sampled')) {
      const a = analyse(applyExperiment(e))
      const g = guardOf(a)
      expect(g, `${e.id} shows an emulated controller with no guard`).toBeTruthy()
      expect(g.kind, e.id).toBe('samples')
      expect(g.threshold, e.id).toBe('20')
      expect(a.sampled.controllerZ.approximate, e.id).toBe(true)
      // The phase the hold costs is the quantity the threshold is about, and
      // it is printed whether the guard holds or not.
      expect(g.beside, e.id).toMatch(/costs|no gain crossover/)
    }
  })

  it('the guard fails below the threshold and says why, in the engine\'s own words', () => {
    const slow = analyse(applyStep(byId('B6'), { set: { perCycle: 4 } }))
    const g = guardOf(slow)
    expect(g.holds).toBe(false)
    expect(g.reason).toMatch(/samples per cycle/)
    expect(g.reason).toMatch(/Design in z instead/)
    const fast = guardOf(analyse(applyStep(byId('B6'), { set: { perCycle: 400 } })))
    expect(fast.holds).toBe(true)
    expect(fast.reason).toBeNull()
  })

  it('a predicted limit-cycle amplitude never appears without the measured one', () => {
    for (const e of EXPERIMENTS.filter((x) => x.patch.mode === 'describing')) {
      const a = analyse(applyExperiment(e))
      const g = guardOf(a)
      expect(g, `${e.id} predicts an amplitude with no guard`).toBeTruthy()
      expect(g.kind, e.id).toBe('harmonic')
      if (a.nonlinear.predicted.predicted && a.nonlinear.measured) {
        expect(g.beside, e.id).toMatch(/Predicted .*measured .*off by/)
      }
    }
  })

  it('a fit never appears without its residual', () => {
    for (const e of EXPERIMENTS.filter((x) => x.patch.mode === 'fit')) {
      const g = guardOf(analyse(applyExperiment(e)))
      expect(g, `${e.id} fits with no residual on screen`).toBeTruthy()
      expect(g.kind, e.id).toBe('residual')
      expect(g.value, e.id).toMatch(/%$/)
      expect(g.beside, e.id).toMatch(/second order/)
    }
  })

  it('a regulator prints the residual that says its gain is the optimal one', () => {
    const g = guardOf(analyse(applyExperiment(byId('A7'))))
    expect(g.kind).toBe('riccati')
    expect(g.holds).toBe(true)
    // Not an approximation. An iteration that converged, labelled as what it
    // is rather than hedged.
    expect(g.approximate).toBe(false)
  })

  it('a view with no approximation in it shows no guard', () => {
    // A1 draws two trajectories of an exact linear system. A guard banner
    // there would be a hedge on something exact, which STYLE and CORE_SCOPE
    // treat as seriously as a missing one.
    expect(guardOf(analyse(applyExperiment(byId('A1'))))).toBeNull()
    expect(guardOf(analyse(applyExperiment(byId('C1'))))).toBeNull()
  })
})
