import { describe, it, expect } from 'vitest'
import { KINDS, ISOLATED_KINDS } from '@ee-labs/switched'
import { EXPERIMENTS, byId, defaultsOf } from './experiments.js'
import { sweepD, sweepR, sweepC, sweepMa, sweepFsw, sweepOpts } from './analysis.js'

// A sweep is one steady state per point, and the curve it draws must be the
// converter's own: continuous everywhere, with the CCM/DCM boundary a kink
// and never a jump, and monotone where the physics is.
//
// Continuity is tested by refinement. On a continuous curve the largest
// step between neighbouring points shrinks with the grid — four times the
// points, at most half the step, even at a kink; a jump stays the same size
// however fine the grid.

// Every experiment whose sweep re-solves a clocked converter, including the
// two with a core in them (whose sweeps run the saturating solver, as the
// app's own do) and the two isolated ones.
const clocked = EXPERIMENTS.filter((e) => KINDS.includes(e.kind) || ISOLATED_KINDS.includes(e.kind))
const maxStep = (pts, y) => Math.max(...pts.slice(1).map((q, i) => Math.abs(q[y] - pts[i][y])))
// Refinement says nothing about a curve that does not move: a synchronous
// converter with ideal parts has M(R) flat to the last bits, and both grids
// then report the same rounding dust. The floor is the dust's own size, taken
// from the curve's scale, so a real step still has to shrink.
const flat = (pts, y) => 1e-12 * Math.max(...pts.map((q) => Math.abs(q[y])))
const signChanges = (pts, y, eps) => {
  let last = 0
  let n = 0
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i][y] - pts[i - 1][y]
    if (Math.abs(d) <= eps) continue
    const s = Math.sign(d)
    if (last && s !== last) n++
    last = s
  }
  return n
}

/** Where the mode changes, the step is no larger than the steps beside it: a kink. */
function kinksNotJumps(pts, y) {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].mode === pts[i - 1].mode) continue
    const here = Math.abs(pts[i][y] - pts[i - 1][y])
    const before = i > 1 ? Math.abs(pts[i - 1][y] - pts[i - 2][y]) : 0
    const after = i + 1 < pts.length ? Math.abs(pts[i + 1][y] - pts[i][y]) : 0
    expect(here, `${y} jumps at x = ${pts[i].x} (${pts[i - 1].mode} → ${pts[i].mode})`).toBeLessThanOrEqual(2 * Math.max(before, after))
  }
}

describe('M(D) at each clocked experiment’s load', () => {
  it.each(clocked.map((e) => [e.id, e]))('%s: continuous, with one turning point at most', (_, e) => {
    const p = defaultsOf(e.id)
    const o = sweepOpts(e, p)
    const coarse = sweepD(p, e.kind, 61, o)
    const fine = sweepD(p, e.kind, 241, o)
    for (const q of fine) {
      expect(Number.isFinite(q.M)).toBe(true)
      expect(Number.isFinite(q.eta)).toBe(true)
    }
    expect(maxStep(fine, 'M')).toBeLessThanOrEqual(Math.max(0.5 * maxStep(coarse, 'M'), flat(fine, 'M')))
    kinksNotJumps(fine, 'M')
    // |M| rises with D — except a boost with a winding, which turns at
    // D′ = √r and comes back down (C2's lesson).
    const turns = signChanges(fine, 'M', 1e-12)
    const rl = e.kind === 'boost' && p.RL > 0
    expect(turns).toBeLessThanOrEqual(rl ? 1 : 0)
  })
})

describe('M(R) at each clocked experiment’s duty', () => {
  it.each(clocked.map((e) => [e.id, e]))('%s: continuous across the boundary, never falling with R', (_, e) => {
    const p = defaultsOf(e.id)
    const o = sweepOpts(e, p)
    const coarse = sweepR(p, e.kind, 61, o)
    const fine = sweepR(p, e.kind, 241, o)
    for (const q of fine) expect(Number.isFinite(q.M)).toBe(true)
    expect(maxStep(fine, 'M')).toBeLessThanOrEqual(Math.max(0.5 * maxStep(coarse, 'M'), flat(fine, 'M')))
    kinksNotJumps(fine, 'M')
    // A lighter load never lowers |M|: flat in CCM (rising a little with a
    // winding or a diode drop), rising in DCM.
    const scale = Math.max(...fine.map((q) => Math.abs(q.M)))
    for (let i = 1; i < fine.length; i++) {
      expect(Math.abs(fine[i].M) - Math.abs(fine[i - 1].M), `|M| falls at R = ${fine[i].x}`).toBeGreaterThanOrEqual(-1e-9 * scale)
    }
    // Lightening the load walks the converter one way through its modes and
    // never back: out of saturation, then continuous, then discontinuous.
    // A converter with no core in it only ever makes the second step.
    const ORDER = ['SAT', 'CCM', 'DCM']
    const modes = fine.map((q) => q.mode)
    const changes = modes.filter((m, i) => i > 0 && m !== modes[i - 1])
    expect(changes.length).toBeLessThanOrEqual(e.core ? 2 : 1)
    let last = ORDER.indexOf(modes[0])
    for (const m of changes) {
      const here = ORDER.indexOf(m)
      expect(here, `mode ${m} out of order`).toBeGreaterThan(last)
      last = here
    }
  })
})

describe('the inverter sweeps', () => {
  it('F2: the fundamental follows m_a·V_dc up to 1 and falls behind it after', () => {
    const pts = sweepMa(defaultsOf('f2'))
    for (const q of pts) {
      expect(Number.isFinite(q.v1)).toBe(true)
      expect(q.v1).toBeGreaterThan(0)
    }
    // Below 1 the measured curve is the line, to a part in a hundred
    // thousand; above it the line keeps climbing and the curve does not.
    for (const q of pts.filter((r) => r.x <= 1)) {
      expect(Math.abs(q.v1 / q.pred - 1), `m_a = ${q.x.toFixed(2)}`).toBeLessThan(1e-4)
    }
    const over = pts.filter((r) => r.x > 1.05)
    expect(over.length).toBeGreaterThan(2)
    for (const q of over) expect(q.v1, `m_a = ${q.x.toFixed(2)}`).toBeGreaterThan(q.pred)
    // And it is monotone: more modulation never buys less fundamental.
    for (let i = 1; i < pts.length; i++) expect(pts[i].v1).toBeGreaterThan(pts[i - 1].v1 * 0.999)
  })

  it('F4: the distortion falls with the carrier, once the carrier is past the corner', () => {
    const pts = sweepFsw(defaultsOf('f4'))
    for (const q of pts) {
      expect(Number.isFinite(q.thd)).toBe(true)
      expect(q.mf % 2, `m_f = ${q.mf}`).toBe(1)
      expect(q.thd).toBeGreaterThan(0)
    }
    const f0 = 1 / (2 * Math.PI * Math.sqrt(1e-3 * 1e-5))
    const above = pts.filter((q) => q.mf * 60 > 1.5 * f0)
    expect(above.length).toBeGreaterThan(5)
    for (let i = 1; i < above.length; i++) {
      expect(above[i].thd, `at ${above[i].mf * 60} Hz`).toBeLessThanOrEqual(above[i - 1].thd)
    }
    // The fundamental does not move with the carrier: that is F2's number,
    // and this sweep is about everything else.
    const v1 = pts.map((q) => q.v1)
    for (const v of v1) expect(Math.abs(v / v1[0] - 1)).toBeLessThan(2e-3)
  })
})

describe('E3: the rectifier against its capacitor', () => {
  it('conduction angle, peak current, ripple and V_dc are smooth and monotone in C', () => {
    const e = byId.e3
    const p = defaultsOf('e3')
    const coarse = sweepC(p, e, 25)
    const fine = sweepC(p, e, 97)
    for (const y of ['angle', 'iPeak', 'ripple', 'Vdc']) {
      for (const q of fine) expect(Number.isFinite(q[y]), `${y} finite`).toBe(true)
      expect(maxStep(fine, y), `${y} continuous`).toBeLessThanOrEqual(0.5 * maxStep(coarse, y))
    }
    // More capacitance: a narrower conduction angle, a taller current pulse,
    // less ripple, a higher output.
    const scaleOf = (y) => Math.max(...fine.map((q) => Math.abs(q[y])))
    for (let i = 1; i < fine.length; i++) {
      const d = (y) => fine[i][y] - fine[i - 1][y]
      expect(d('angle'), `angle at C = ${fine[i].x}`).toBeLessThanOrEqual(1e-9 * scaleOf('angle'))
      expect(d('iPeak'), `iPeak at C = ${fine[i].x}`).toBeGreaterThanOrEqual(-1e-9 * scaleOf('iPeak'))
      expect(d('ripple'), `ripple at C = ${fine[i].x}`).toBeLessThanOrEqual(1e-9 * scaleOf('ripple'))
      expect(d('Vdc'), `Vdc at C = ${fine[i].x}`).toBeGreaterThanOrEqual(-1e-9 * scaleOf('Vdc'))
    }
  })
})
