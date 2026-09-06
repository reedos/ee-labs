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
  chainPlan,
  drive,
  driveSteadyState,
  driveRunUp,
  DRIVE_KINDS,
  emiConverter,
  ringConverter,
  emiSteadyState,
} from '@ee-labs/switched'
import { EXPERIMENTS, defaultsOf } from './experiments.js'
import { buckParams, coreParams } from './analysis.js'
import { driveParams, emiParams, ringParams, thermalBuckParams } from './groups/lmn.js'

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

// Groups L, M and N walk from rest as well, and each has its own slow state.
//
// A drive's is the shaft, so its walker is `driveRunUp`, stepping the period
// map from an empty armature and a still rotor. The thermal three are
// ordinary synchronous bucks and take the walker Group B takes. The input
// side and the switch node are fixed patterns of four and five states, so
// their walk is the period map applied from rest until it stops moving.
// None of the three is told the solver's answer, which is the point.
const drives = EXPERIMENTS.filter((e) => DRIVE_KINDS.includes(e.kind))
const thermals = EXPERIMENTS.filter((e) => e.kind === 'thermal')
const linear = EXPERIMENTS.filter((e) => ['emi', 'ringing'].includes(e.kind))

/** The period map from rest, for a converter whose pattern never changes. */
function walkLinear(conv, { periods = 200000, settle = 1e-13 } = {}) {
  let x = new Array(conv.n).fill(0)
  const scale = new Array(conv.n).fill(1e-12)
  let n = 0
  for (; n < periods; n++) {
    const next = chainPlan(conv.plan, x).xEnd
    let quiet = true
    for (let i = 0; i < conv.n; i++) {
      scale[i] = Math.max(scale[i], Math.abs(next[i]))
      if (Math.abs(next[i] - x[i]) > settle * scale[i]) quiet = false
    }
    x = next
    if (quiet) {
      n++
      break
    }
  }
  return { x, periods: n, scale }
}

describe('the later groups walk from rest as well', () => {
  it('covers all nine, and names what is left to another solver', () => {
    expect(drives.map((e) => e.id)).toEqual(['l1', 'l2', 'l3'])
    expect(thermals.map((e) => e.id)).toEqual(['n1', 'n2', 'n3'])
    expect(linear.map((e) => e.id)).toEqual(['m1', 'm2', 'm3'])
    // The line-frequency and phase-cut experiments are solved by shooting on
    // conduction angles rather than by a clocked period map, and `events.js`
    // owns their walk. The two in Group A have no state to walk. Everything
    // else in the lab is walked in this file.
    const walked = new Set([...clocked, ...cored, ...isolatedExps, ...drives, ...thermals, ...linear].map((e) => e.id))
    const left = EXPERIMENTS.filter((e) => !walked.has(e.id)).map((e) => e.id)
    expect(left).toEqual(['a1', 'a2', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'f1', 'f2', 'f3', 'f4'])
  })

  it.each(drives.map((e) => [e.id, e]))('%s: the shaft finds the orbit the solver names', (_, e) => {
    const conv = drive(e.kind, driveParams(defaultsOf(e.id)))
    const ss = driveSteadyState(conv)
    // The mechanical time constant is thousands of switching periods, so the
    // walk is that many long. That separation is the reason the quasi-static
    // picture exists, and the reason this check is worth its seconds.
    const r = driveRunUp(conv, [0, 0], { periods: 200000, settle: 1e-13 })
    expect(r.periods, 'settled before the period cap').toBeLessThan(200000)
    expect(Math.abs(r.x[0] - ss.x0[0]) / Math.max(1e-9, r.scale[0])).toBeLessThan(1e-7)
    expect(Math.abs(r.x[1] - ss.x0[1]) / Math.max(1e-9, r.scale[1])).toBeLessThan(1e-7)
  })

  it.each(thermals.map((e) => [e.id, e]))('%s: the buck under the heatsink', (_, e) => {
    const conv = converter('buck', thermalBuckParams(defaultsOf(e.id)))
    const ss = steadyState(conv)
    const r = runPeriods(conv, [0, 0], { periods: 200000, settle: 1e-13 })
    expect(r.periods, 'settled before the period cap').toBeLessThan(200000)
    expect(Math.abs(r.x[0] - ss.x0[0]) / Math.max(1e-9, r.scale[0])).toBeLessThan(1e-8)
    expect(Math.abs(r.x[1] - ss.x0[1]) / Math.max(1e-9, r.scale[1])).toBeLessThan(1e-8)
    expect(r.mode).toBe(ss.mode)
  })

  it.each(linear.map((e) => [e.id, e]))('%s: four states, and five with the snubber', (_, e) => {
    const p = defaultsOf(e.id)
    const conv = e.kind === 'emi' ? emiConverter(emiParams(p)) : ringConverter(ringParams(p))
    const ss = emiSteadyState(conv)
    const r = walkLinear(conv)
    expect(r.periods, 'settled before the period cap').toBeLessThan(200000)
    for (let i = 0; i < conv.n; i++) {
      expect(Math.abs(r.x[i] - ss.x0[i]) / Math.max(1e-9, r.scale[i]), `${e.id} state ${i}`).toBeLessThan(1e-7)
    }
  })
})
