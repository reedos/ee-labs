import { describe, it, expect } from 'vitest'
import { verdictOf, oscillationOf, presentMargins, steadyErrorOf, MARGINAL_REL } from './verdict.js'
import { PLANTS, CONTROLLERS, buildLoop } from './systems.js'
import { margins, isStable, dcGain } from '@ee-labs/systems'

// The one-word judgement, pinned against the loops that shipped wrong: the
// crossing chip that lands poles exactly on the imaginary axis, the plant
// that never settles at all, and the lead whose DC gain is 1 forever.

const GRID = Float64Array.from({ length: 6000 }, (_, i) => Math.pow(10, -4 + 8 * (i / 5999)))

describe('verdictOf', () => {
  it('is stable for an ordinary settling loop', () => {
    const { closed, open } = buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 4 })
    expect(verdictOf(closed, margins(open, GRID))).toBe('stable')
  })

  it('is marginal — not unstable — for poles exactly on the axis', () => {
    // Kp = 11.25 puts the three-lag loop exactly on the boundary (the
    // lessons.chips.test.js crossing-gain measurement).
    const { closed, open } = buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 11.25 })
    const marg = margins(open, GRID)
    expect(marg.gainMargin).toBeCloseTo(1, 2)
    expect(verdictOf(closed, marg)).toBe('marginal')
    // isStable() alone calls this the wrong thing — that mismatch is the bug.
    expect(isStable(closed)).toBe(false)
  })

  it('is unstable once a branch is strictly across the axis', () => {
    const { closed, open } = buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 20 })
    expect(verdictOf(closed, margins(open, GRID))).toBe('unstable')
  })

  it('reads marginal off the gain margin alone when no pole is exactly resolved', () => {
    const { closed } = buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 11.25 })
    // Even without passing margins, a pole within MARGINAL_REL of the axis
    // (relative to its own scale) reads marginal.
    expect(verdictOf(closed)).toBe('marginal')
    expect(MARGINAL_REL).toBeLessThan(1e-3)
  })
})

describe('oscillationOf', () => {
  it('is zero for a stable loop with no complex pair near the axis', () => {
    const { closed } = buildLoop('firstOrder', { k: 1, tau: 1 }, 'p', { kp: 9 })
    expect(oscillationOf(closed)).toBe(0)
  })

  it('reads the rad/s of the pair nearest the axis for a marginal loop', () => {
    const { closed } = buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 11.25 })
    const w = oscillationOf(closed)
    expect(w).toBeGreaterThan(0)
    expect(w).toBeLessThan(20)
  })
})

describe('presentMargins', () => {
  it('passes an ordinary crossover through unchanged', () => {
    const { open } = buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 4 })
    const marg = margins(open, GRID)
    const out = presentMargins(marg, open, GRID[0])
    expect(out.gainCrossover).toBe(marg.gainCrossover)
    expect(out.crossoverNote).toBeNull()
  })

  it('erases the DC-noise crossover of a loop with |L(0)| = 1', () => {
    // The bug this guards: a lead whose zero cancels the plant's only pole
    // has |L(0)| = 1 exactly, and margins()'s bisection can hand back a
    // float-noise crossing at nanohertz ("crossover 8.215 nHz, PM 180.0°")
    // instead of recognising there is no real crossover to report.
    const { open } = buildLoop('firstOrder', { k: 1, tau: 1 }, 'lead', { k: 1, z: 1, p: 20 })
    expect(dcGain(open)).toBeCloseTo(1, 9)
    const noisyMarg = { gainCrossover: 8.215e-9, phaseMargin: 180.0, gainMargin: null, gainMarginDb: null, phaseCrossover: null }
    const out = presentMargins(noisyMarg, open, GRID[0])
    expect(out.gainCrossover).toBeNull()
    expect(out.phaseMargin).toBeNull()
    expect(out.crossoverNote).toMatch(/gain is 1 at DC/)
  })

  it('leaves a genuine below-band crossover alone when |L(0)| is not 1', () => {
    const { open } = buildLoop('firstOrder', { k: 5, tau: 1 }, 'p', { kp: 1 })
    const belowBand = { gainCrossover: GRID[0] / 10, phaseMargin: 90, gainMargin: null }
    const out = presentMargins(belowBand, open, GRID[0])
    expect(out.gainCrossover).not.toBeNull()
    expect(out.crossoverNote).toBeNull()
  })
})

describe('steadyErrorOf', () => {
  it('says none for an exact integrator loop', () => {
    const { closed } = buildLoop('firstOrder', { k: 1, tau: 1 }, 'pi', { kp: 1, ki: 1 })
    const info = steadyErrorOf(closed, 'stable')
    expect(info.text).toBe('none')
    expect(info.value).toBe(0)
  })

  it('signs a negative steady error and says what it means', () => {
    const { closed } = buildLoop('unstable', { k: 1, p: 1 }, 'p', { kp: 5 })
    const info = steadyErrorOf(closed, 'stable')
    expect(info.value).toBeLessThan(0)
    expect(info.text).toMatch(/^-25\.0%$/)
    expect(info.title).toMatch(/negative steady error/)
  })

  it('refuses a number for a loop with no steady state, and says why', () => {
    const unstable = steadyErrorOf({ b: [1], a: [1, -1] }, 'unstable')
    expect(unstable.text).toBe('—')
    expect(unstable.value).toBeNull()
    expect(unstable.title).toMatch(/runs away/)
    const marginal = steadyErrorOf({ b: [1], a: [1, 0, 1] }, 'marginal')
    expect(marginal.text).toBe('—')
    expect(marginal.title).toMatch(/oscillates forever/)
  })
})
