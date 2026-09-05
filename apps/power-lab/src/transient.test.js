import { describe, it, expect } from 'vitest'
import {
  converter,
  steadyState,
  runPeriods,
  KINDS,
  ISOLATED_KINDS,
  isolated,
  saturatingConverter,
  saturatingSteadyState,
  saturatingWalk,
} from '@ee-labs/switched'
import { EXPERIMENTS, defaultsOf } from './experiments.js'
import { buckParams, coreParams } from './analysis.js'

// Every clocked experiment, at the state the reader first sees it: the
// converter switched on from rest and walked period by period, with no
// knowledge of the solver's answer, must settle where the solver said. Each
// note's numbers are measured from that fixed point; this is the check that
// the fixed point is the one the circuit actually visits.

const clocked = EXPERIMENTS.filter((e) => KINDS.includes(e.kind) && !e.core)
const cored = EXPERIMENTS.filter((e) => e.core)
const isolatedExps = EXPERIMENTS.filter((e) => ISOLATED_KINDS.includes(e.kind))

describe('the walk from rest lands on the fixed point each note is measured from', () => {
  it('covers every clocked experiment', () => {
    expect(clocked.map((e) => e.id)).toEqual([
      'a3', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8',
      'c1', 'c2', 'c3', 'c4', 'c5',
      'g1', 'g2', 'g3', 'g4',
    ])
    expect(cored.map((e) => e.id)).toEqual(['d1', 'd2'])
    expect(isolatedExps.map((e) => e.id)).toEqual(['d3', 'd4'])
  })

  it.each(clocked.map((e) => [e.id, e]))('%s', (_, e) => {
    const conv = converter(e.kind, buckParams(defaultsOf(e.id)))
    const ss = steadyState(conv)
    const r = runPeriods(conv, [0, 0], { periods: 200000, settle: 1e-13 })
    expect(r.periods, 'settled before the period cap').toBeLessThan(200000)
    expect(Math.abs(r.x[0] - ss.x0[0]) / Math.max(1e-9, r.scale[0])).toBeLessThan(1e-8)
    expect(Math.abs(r.x[1] - ss.x0[1]) / Math.max(1e-9, r.scale[1])).toBeLessThan(1e-8)
    expect(r.mode).toBe(ss.mode)
    expect(Math.abs(r.td - ss.td)).toBeLessThan(1e-9 * ss.T)
  })

  // The isolated pair are converter-shaped, so the same walker steps them:
  // the flyback's magnetising current from empty, the half-bridge's output
  // inductor from rest over its half period.
  it.each(isolatedExps.map((e) => [e.id, e]))('%s', (_, e) => {
    const p = defaultsOf(e.id)
    const conv = isolated(e.kind, { ...buckParams(p), n: 1 / p.Np })
    const ss = steadyState(conv)
    const r = runPeriods(conv, [0, 0], { periods: 200000, settle: 1e-13 })
    expect(r.periods, 'settled before the period cap').toBeLessThan(200000)
    expect(Math.abs(r.x[0] - ss.x0[0]) / Math.max(1e-9, r.scale[0])).toBeLessThan(1e-8)
    expect(Math.abs(r.x[1] - ss.x0[1]) / Math.max(1e-9, r.scale[1])).toBeLessThan(1e-8)
    expect(r.mode).toBe(ss.mode)
  })

  // A saturating converter's fixed point is found by shooting, so the walk
  // that checks it must not use the shooting: this one starts from an empty
  // inductor and an empty capacitor and only ever steps the period map.
  it.each(cored.map((e) => [e.id, e]))('%s', (_, e) => {
    const p = defaultsOf(e.id)
    const conv = saturatingConverter('buck', { ...buckParams(p), ...coreParams(p) })
    const ss = saturatingSteadyState(conv)
    let x = [0, 0]
    let scaleI = 1e-9
    let scaleV = conv.p.Vin
    let n = 0
    for (; n < 50000; n++) {
      const next = saturatingWalk(conv, x).xEnd
      scaleI = Math.max(scaleI, Math.abs(next[0]))
      scaleV = Math.max(scaleV, Math.abs(next[1]))
      const quiet = Math.abs(next[0] - x[0]) <= 1e-13 * scaleI && Math.abs(next[1] - x[1]) <= 1e-13 * scaleV
      x = next
      if (quiet) break
    }
    expect(n, 'settled before the period cap').toBeLessThan(50000)
    expect(Math.abs(x[0] - ss.x0[0]) / scaleI).toBeLessThan(1e-8)
    expect(Math.abs(x[1] - ss.x0[1]) / scaleV).toBeLessThan(1e-8)
  })
})
