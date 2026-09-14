import { describe, expect, it } from 'vitest'
import { expectPlain } from '@ee-labs/prose/testing'
import { FOUNDATIONS, PARAMETER_ROLES, signalStory } from './foundations.js'
import { EXPERIMENTS, defaultsOf } from './experiments.js'
import { analyse } from './pin.js'

describe('student foundations', () => {
  for (const exp of EXPERIMENTS) it(`${exp.id} defines purpose, signal, prediction, tradeoffs and boundaries`, () => {
    for (const key of ['purpose', 'context', 'prediction', 'tradeoff', 'limits']) {
      expect(FOUNDATIONS[exp.id][key].length).toBeGreaterThan(30)
      expectPlain(FOUNDATIONS[exp.id][key], 'why')
    }
    for (const key of exp.knobs) {
      expect(PARAMETER_ROLES[key]).toBeTruthy()
      expectPlain(PARAMETER_ROLES[key], 'why')
    }
    for (const direction of ['rise', 'fall']) {
      const story = signalStory(exp.id, direction)
      expectPlain(story.input, 'why')
      expectPlain(story.output, 'why')
    }
  })

  it('distinguishes release from pull-down and driver from receiver', () => {
    expect(signalStory('a3', 'rise').input).toContain('releases')
    expect(signalStory('a3', 'fall').input).toContain('closes')
    expect(signalStory('a3', 'fall').output).toContain('divider')
    expect(signalStory('a1', 'rise').input).toContain('high-side')
    expect(signalStory('a2', 'fall').input).toContain('low-side')
    expect(FOUNDATIONS.a2.context).toContain('not a third kind of output driver')
  })

  it('pins the RC, threshold and requirement predictions to the live model', () => {
    const p = defaultsOf('a1'), x = analyse(p)
    for (const patch of [{ cload: p.cload * 2 }, { ron: p.ron * 2 }]) {
      const changed = analyse({ ...p, ...patch })
      expect(changed.rise.tr / x.rise.tr).toBeCloseTo(2, 8)
      expect(changed.fall.tf / x.fall.tf).toBeCloseTo(2, 8)
      expect(changed.thresholds).toEqual(x.thresholds)
    }
    const threshold = analyse({ ...p, vt: 0.5 })
    expect(threshold.thresholds.vih).not.toBe(x.thresholds.vih)
    expect(threshold.rise.wave(1e-9)).toBe(x.rise.wave(1e-9))
    const budget = analyse({ ...p, riseBudget: p.riseBudget * 2 })
    expect(budget.budget.maxCap / x.budget.maxCap).toBeCloseTo(2, 8)
    expect(budget.rise.wave(1e-9)).toBe(x.rise.wave(1e-9))
  })

  it('pins pull-up speed/current and separate bounce tradeoffs', () => {
    const p = defaultsOf('a3'), x = analyse(p)
    const stronger = analyse({ ...p, rpu: p.rpu / 2 })
    expect(stronger.rise.tr).toBeLessThan(x.rise.tr)
    expect(stronger.fall.segments[0].target).toBeGreaterThan(x.fall.segments[0].target)
    expect(p.vdd / (p.rpu / 2 + p.ron)).toBeGreaterThan(p.vdd / (p.rpu + p.ron))
    const base = defaultsOf('a5'), result = analyse(base)
    const slow = analyse({ ...base, edgeTime: base.edgeTime * 2 })
    expect(slow.margins.bounce / result.margins.bounce).toBeCloseTo(0.5, 8)
    for (const patch of [{ edgeTime: base.edgeTime * 2 }, { pins: base.pins * 2 }, { loadCurrent: 0 }]) {
      expect(analyse({ ...base, ...patch }).rise.wave(1e-9)).toBe(result.rise.wave(1e-9))
    }
  })
})
