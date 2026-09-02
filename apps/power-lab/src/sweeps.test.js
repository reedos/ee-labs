import { describe, it, expect } from 'vitest'
import { KINDS } from '@ee-labs/switched'
import { EXPERIMENTS, byId, defaultsOf } from './experiments.js'
import { sweepD, sweepR, sweepC } from './analysis.js'

// A sweep is one steady state per point, and the curve it draws must be the
// converter's own: continuous everywhere, with the CCM/DCM boundary a kink
// and never a jump, and monotone where the physics is.
//
// Continuity is tested by refinement. On a continuous curve the largest
// step between neighbouring points shrinks with the grid — four times the
// points, at most half the step, even at a kink; a jump stays the same size
// however fine the grid.

const clocked = EXPERIMENTS.filter((e) => KINDS.includes(e.kind))
const maxStep = (pts, y) => Math.max(...pts.slice(1).map((q, i) => Math.abs(q[y] - pts[i][y])))
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
    const coarse = sweepD(p, e.kind, 61)
    const fine = sweepD(p, e.kind, 241)
    for (const q of fine) {
      expect(Number.isFinite(q.M)).toBe(true)
      expect(Number.isFinite(q.eta)).toBe(true)
    }
    expect(maxStep(fine, 'M')).toBeLessThanOrEqual(0.5 * maxStep(coarse, 'M'))
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
    const coarse = sweepR(p, e.kind, 61)
    const fine = sweepR(p, e.kind, 241)
    for (const q of fine) expect(Number.isFinite(q.M)).toBe(true)
    expect(maxStep(fine, 'M')).toBeLessThanOrEqual(0.5 * maxStep(coarse, 'M'))
    kinksNotJumps(fine, 'M')
    // A lighter load never lowers |M|: flat in CCM (rising a little with a
    // winding or a diode drop), rising in DCM.
    const scale = Math.max(...fine.map((q) => Math.abs(q.M)))
    for (let i = 1; i < fine.length; i++) {
      expect(Math.abs(fine[i].M) - Math.abs(fine[i - 1].M), `|M| falls at R = ${fine[i].x}`).toBeGreaterThanOrEqual(-1e-9 * scale)
    }
    // The boundary is crossed once, from continuous to discontinuous.
    const modes = fine.map((q) => q.mode)
    const changes = modes.filter((m, i) => i > 0 && m !== modes[i - 1])
    expect(changes.length).toBeLessThanOrEqual(1)
    if (changes.length === 1) expect(changes[0]).toBe('DCM')
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
