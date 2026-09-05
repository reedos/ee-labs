import { describe, it, expect } from 'vitest'
import {
  agreesWithin,
  capacitancePerMetre,
  chargeInside,
  conductancePerMetre,
  converge,
  energyPerMetre,
  fieldAt,
  figuresOf,
  fluxThrough,
  normalIntegral,
  normalizeSpec,
  nodeV,
  quoted,
  solveLaplace,
  staircaseFraction,
  valueAt,
} from './relax.js'
import { capacitance } from './closed.js'
import { EPS0, FieldsError } from './const.js'
import { logUniform, relative, rng } from './fuzz.js'

// Invariants 2, 3 and 4, and the whole of CORE_SCOPE Rule 3 for this package.
//
// The grid solver is an approximation. Nothing here checks it against another
// grid solve, because two grids that share a bug agree. Every check is against
// something outside the solver: an exact series, a closed form, or a
// conservation law.
//
// The three references, in the order they get harder:
//
//   the parallel plate       exact on the grid, because the field is uniform
//   the rectangular trough   an exact Fourier series, and the mesh follows it
//   the round coaxial line   a closed form, and the mesh cuts across it
//
// The third is the one that earns the guard. A circle on a square mesh
// converges at first order and not at second, and the guard is what says so.

// ---------------------------------------------------------------- references

/**
 * The exact potential inside a square trough of side w whose top side is held
 * at V0 and whose other three sides are at zero.
 *
 *   V = (4 V0 / pi) sum over odd n of (1/n) sin(n pi x / w) sinh(n pi y / w)
 *                                          / sinh(n pi w / w)
 *
 * The ratio of hyperbolic sines is written as exponentials so that a large n
 * does not overflow before the division cancels it.
 */
function troughSeries(x, y, { w, V0, terms = 400 }) {
  let s = 0
  for (let n = 1; n < terms; n += 2) {
    const a = (n * Math.PI) / w
    const ratio = Math.exp(a * (y - w)) * ((1 - Math.exp(-2 * a * y)) / (1 - Math.exp(-2 * a * w)))
    s += (1 / n) * Math.sin(a * x) * ratio
  }
  return ((4 * V0) / Math.PI) * s
}

const W = 0.1
const V0 = 100
const trough = (n) => ({
  width: W,
  height: W,
  n,
  potential: (x, y) => (y >= W - 1e-12 ? V0 : null),
  outer: 0,
  tol: 1e-13,
  maxIter: 400000,
})

/** A quarter of a round coaxial line, meshed on a square grid. */
const roundCoax = (a, b) => (n) => ({
  width: b,
  height: b,
  n,
  potential: (x, y) => {
    const r = Math.hypot(x, y)
    return r <= a ? 1 : r >= b ? 0 : null
  },
  neumann: { left: true, bottom: true, right: true, top: true },
  tol: 1e-12,
  maxIter: 400000,
})

// ---------------------------------------------------------------- the solver

describe('the specification, and what it refuses', () => {
  it('fills its defaults and squares the cell', () => {
    const s = normalizeSpec({ width: 0.2, height: 0.1, n: 40 })
    expect(s.h).toBeCloseTo(0.005, 12)
    expect(s.ny).toBe(20)
    expect(s.outer).toBe(0)
    expect(s.neumann).toEqual({ left: false, right: false, top: false, bottom: false })
  })

  it('needs at least four cells across', () => {
    expect(() => normalizeSpec({ width: 1, height: 1, n: 2 })).toThrow(/at least 4 cells/)
  })

  it('declines a grid with no boundary condition anywhere', () => {
    expect(() =>
      solveLaplace({ width: 1, height: 1, n: 8, neumann: { left: true, right: true, top: true, bottom: true } }),
    ).toThrow(/no boundary condition and no solution/)
  })

  it('declines a potential function that returns something other than a number', () => {
    expect(() => solveLaplace({ width: 1, height: 1, n: 8, potential: () => 'high' })).toThrow(/must return a number or null/)
  })
})

describe('the parallel plate, where the grid is exact', () => {
  const d = 0.01
  const wide = 0.05
  const plate = (n) => ({
    width: wide,
    height: d,
    n,
    potential: (x, y) => (y <= 1e-12 ? 0 : y >= d - 1e-12 ? 1 : null),
    neumann: { left: true, right: true },
    tol: 1e-14,
    maxIter: 400000,
  })

  it('reproduces eps A over d to floating point, because the field is uniform', () => {
    for (const n of [10, 20, 40]) {
      const sol = solveLaplace(plate(n))
      expect(sol.converged).toBe(true)
      expect(relative(capacitancePerMetre(sol, 1), (EPS0 * wide) / d)).toBeLessThan(1e-12)
    }
  })

  it('the potential rises linearly across the gap', () => {
    const sol = solveLaplace(plate(20))
    for (const f of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(valueAt(sol, wide / 2, f * d)).toBeCloseTo(f, 10)
    }
  })

  it('the field is V over d everywhere between the plates', () => {
    // A domain wider than it is tall has fewer rows than columns: 20 cells
    // across 50 mm is 4 rows over 10 mm, so row 2 is the middle.
    const sol = solveLaplace(plate(20))
    expect(sol.ny).toBe(4)
    const mid = fieldAt(sol, 10, 2)
    expect(Math.abs(mid.ex)).toBeLessThan(1e-10)
    expect(relative(Math.abs(mid.ey), 1 / d)).toBeLessThan(1e-10)
  })

  it('a node off the grid is declined, and the message says why the rows are few', () => {
    const sol = solveLaplace(plate(20))
    expect(() => fieldAt(sol, 10, 9)).toThrow(/is not on this grid/)
    expect(() => fieldAt(sol, 10, 9)).toThrow(/fewer rows than columns/)
  })

  it('the same solve read as a conduction problem gives sigma A over d', () => {
    const sol = solveLaplace(plate(20))
    const sigma = 3.7
    const G = conductancePerMetre(sol, 1, sigma)
    expect(relative(1 / G, d / (sigma * wide))).toBeLessThan(1e-12)
  })
})

describe('invariant 2: the trough against its exact series', () => {
  it('agrees at four points, and the error falls as the mesh halves', () => {
    const probes = [
      [0.025, 0.075],
      [0.05, 0.05],
      [0.075, 0.025],
      [0.02, 0.09],
    ]
    for (const [x, y] of probes) {
      const exact = troughSeries(x, y, { w: W, V0 })
      const errs = [20, 40, 80].map((n) => {
        const sol = solveLaplace(trough(n))
        expect(sol.converged).toBe(true)
        return Math.abs(valueAt(sol, x, y) - exact)
      })
      // The centre is exact at every mesh by symmetry, so it has no ratio to
      // check. Every other point converges at second order.
      if (x === 0.05 && y === 0.05) {
        expect(errs[2]).toBeLessThan(1e-8)
      } else {
        expect(errs[0] / errs[2]).toBeGreaterThan(8)
        expect(errs[2] / exact).toBeLessThan(1e-3)
      }
    }
  })

  it('the centre of a square trough reads a quarter of the top, at every mesh', () => {
    for (const n of [8, 20, 41]) {
      const sol = solveLaplace(trough(n))
      expect(valueAt(sol, W / 2, W / 2)).toBeCloseTo(V0 / 4, 6)
    }
  })
})

describe('the mesh guard, which is Rule 3 for this package', () => {
  it('reports the change between refinements, and calls it inside the threshold', () => {
    const rep = converge(trough, { n: 20, threshold: 1e-3, read: (s) => valueAt(s, 0.025, 0.075) })
    expect(rep.levels.map((l) => l.n)).toEqual([20, 40, 80])
    expect(rep.change).toBeLessThan(1e-3)
    expect(rep.ok).toBe(true)
    expect(rep.order).toBeGreaterThan(1.9)
    expect(rep.order).toBeLessThan(2.1)
    expect(rep.boundary).toBe('follows the mesh')
    expect(rep.safety).toBe(1.25)
    expect(rep.says).toMatch(/Halving the mesh from 40 to 80 cells/)
    expect(rep.says).toMatch(/inside the .* threshold/)
  })

  it('the band it defends holds the true error against the series', () => {
    const rep = converge(trough, { n: 20, threshold: 1e-3, read: (s) => valueAt(s, 0.025, 0.075) })
    const exact = troughSeries(0.025, 0.075, { w: W, V0 })
    const ag = agreesWithin(rep, exact)
    expect(ag.ok).toBe(true)
    expect(ag.rel).toBeLessThan(ag.band)
  })

  it('a threshold the change cannot meet is reported as unsettled, and costs a figure', () => {
    const rep = converge(trough, { n: 20, threshold: 1e-9, read: (s) => valueAt(s, 0.025, 0.075) })
    expect(rep.ok).toBe(false)
    expect(rep.says).toMatch(/past the .* threshold/)
    expect(figuresOf(rep)).toBe(2)
    expect(quoted(rep, 43.2018)).toBe(43)
  })

  it('a settled report is quoted to three figures', () => {
    const rep = converge(trough, { n: 20, threshold: 1e-3, read: (s) => valueAt(s, 0.025, 0.075) })
    expect(figuresOf(rep)).toBe(3)
    expect(quoted(rep, 43.2018)).toBe(43.2)
  })

  it('a relaxation that runs out of sweeps is not read at all', () => {
    const cramped = (n) => ({ ...trough(n), maxIter: 3 })
    expect(() => converge(cramped, { n: 20, read: (s) => valueAt(s, 0.025, 0.075) })).toThrow(FieldsError)
    expect(() => converge(cramped, { n: 20, read: (s) => valueAt(s, 0.025, 0.075) })).toThrow(/before you read the answer|Raise maxIter/)
  })
})

describe('the staircase fraction, which decides the safety factor', () => {
  it('is near zero for a rectangle and falls as the mesh is refined', () => {
    const box = (n) => ({
      width: 0.1,
      height: 0.1,
      n,
      potential: (x, y) => (x >= 0.03 && x <= 0.07 && y >= 0.03 && y <= 0.07 ? 1 : null),
      outer: 0,
      tol: 1e-11,
      maxIter: 200000,
    })
    const coarse = staircaseFraction(solveLaplace(box(40)))
    const fine = staircaseFraction(solveLaplace(box(80)))
    expect(coarse).toBeLessThan(0.15)
    expect(fine).toBeLessThan(coarse)
  })

  it('stays where it is for a circle, however fine the mesh', () => {
    const build = roundCoax(1e-3, 3.5e-3)
    const coarse = staircaseFraction(solveLaplace(build(60)))
    const fine = staircaseFraction(solveLaplace(build(120)))
    expect(coarse).toBeGreaterThan(0.2)
    expect(fine).toBeGreaterThan(0.2)
    expect(relative(coarse, fine)).toBeLessThan(0.5)
  })
})

describe('invariant 2 again: the grid against a closed form, inside its own band', () => {
  it('the round coaxial line, at eight radius ratios', () => {
    let worstMargin = 0
    for (let k = 0; k < 8; k++) {
      const a = 1e-3
      const b = a * (1.8 + k * 0.6)
      const closed = capacitance({ kind: 'coax', a, b }).perMetre
      const rep = converge(roundCoax(a, b), {
        n: 48,
        threshold: 1e-2,
        read: (s) => capacitancePerMetre(s, 1, { symmetry: 4 }),
      })
      const ag = agreesWithin(rep, closed)
      expect(ag.ok, `b/a = ${(b / a).toFixed(2)}: ${(100 * ag.rel).toFixed(3)}% against a band of ${(100 * ag.band).toFixed(3)}%`).toBe(true)
      worstMargin = Math.max(worstMargin, ag.rel / ag.band)
      expect(rep.boundary).toBe('cuts across the mesh')
      expect(rep.safety).toBe(3)
    }
    // The band is not so wide that it would hold anything. The worst case uses
    // a real fraction of it.
    expect(worstMargin).toBeGreaterThan(0.05)
    expect(worstMargin).toBeLessThan(1)
  }, 120000)
})

describe('invariants 3 and 4: Gauss on a solved field', () => {
  const a = 1e-3
  const b = 3.5e-3

  it('the contour flux and the charge inside are the two sides of one theorem', () => {
    const sol = solveLaplace(roundCoax(a, b)(96))
    const n = sol.nx
    for (const frac of [0.3, 0.45, 0.6]) {
      const rect = { i0: 0, j0: 0, i1: Math.round(n * frac), j1: Math.round(n * frac) }
      const flux = fluxThrough(sol, rect)
      const q = chargeInside(sol, rect)
      expect(relative(flux, q)).toBeLessThan(1e-6)
    }
  })

  it('the flux equals the charge the closed form puts on the inner conductor', () => {
    const rep = converge(roundCoax(a, b), {
      n: 48,
      threshold: 1e-2,
      read: (s) => capacitancePerMetre(s, 1, { symmetry: 4 }),
    })
    const sol = rep.solution
    const n = sol.nx
    const rect = { i0: 0, j0: 0, i1: Math.round(n * 0.45), j1: Math.round(n * 0.45) }
    // One quarter is solved, so the whole conductor carries four times the flux.
    const gridCharge = 4 * fluxThrough(sol, rect)
    // At one volt across the line, the charge per metre and the capacitance per
    // metre are the same number, so the closed form supplies both.
    const closedCharge = capacitance({ kind: 'coax', a, b }).perMetre
    expect(relative(gridCharge, closedCharge)).toBeLessThan(rep.band)
  }, 120000)

  it('the flux is the same whatever contour surrounds the same conductor', () => {
    const sol = solveLaplace(roundCoax(a, b)(96))
    const n = sol.nx
    const fluxes = [0.35, 0.45, 0.55].map((f) =>
      fluxThrough(sol, { i0: 0, j0: 0, i1: Math.round(n * f), j1: Math.round(n * f) }),
    )
    expect(relative(fluxes[0], fluxes[1])).toBeLessThan(1e-6)
    expect(relative(fluxes[1], fluxes[2])).toBeLessThan(1e-6)
  })

  it('a contour that surrounds no conductor encloses no charge', () => {
    const sol = solveLaplace(roundCoax(a, b)(96))
    const n = sol.nx
    // A block wholly in the dielectric. Its nearest corner sits at 0.354 of the
    // domain, outside the inner conductor at 0.286, and its farthest at 0.539,
    // inside the shield at 1.0.
    const away = { i0: Math.round(n * 0.35), j0: Math.round(n * 0.05), i1: Math.round(n * 0.5), j1: Math.round(n * 0.2) }
    const scale = Math.abs(fluxThrough(sol, { i0: 0, j0: 0, i1: Math.round(n * 0.45), j1: Math.round(n * 0.45) }))
    expect(Math.abs(fluxThrough(sol, away)) / scale).toBeLessThan(1e-8)
  })

  it('a contour outside the grid is declined, with the reason', () => {
    const sol = solveLaplace(roundCoax(a, b)(32))
    expect(() => normalIntegral(sol, { i0: 0, j0: 0, i1: 999, j1: 4 })).toThrow(/must lie inside the grid/)
    expect(() => normalIntegral(sol, { i0: 5, j0: 0, i1: 3, j1: 4 })).toThrow(/must lie inside the grid/)
  })
})

describe('two dielectrics, and the interface between them', () => {
  // A parallel plate half filled with a second dielectric is two capacitors in
  // series, which is a closed form the grid has to reproduce.
  const d = 0.01
  const wide = 0.05
  const epsA = 1
  const epsB = 4
  // A hundred cells across 50 mm gives 20 rows over 10 mm, so the interface at
  // 5 mm falls on row 10 and there are rows to read on both sides of it.
  const half = (n) => ({
    width: wide,
    height: d,
    n,
    potential: (x, y) => (y <= 1e-12 ? 0 : y >= d - 1e-12 ? 1 : null),
    epsr: (x, y) => (y < d / 2 ? epsB : epsA),
    neumann: { left: true, right: true },
    tol: 1e-14,
    maxIter: 400000,
  })

  it('reproduces two capacitors in series', () => {
    const sol = solveLaplace(half(100))
    const c1 = (EPS0 * epsB * wide) / (d / 2)
    const c2 = (EPS0 * epsA * wide) / (d / 2)
    const series = (c1 * c2) / (c1 + c2)
    expect(relative(capacitancePerMetre(sol, 1), series)).toBeLessThan(1e-12)
  })

  it('the field is larger in the thinner permittivity, in the ratio of the two', () => {
    const sol = solveLaplace(half(100))
    expect(sol.ny).toBe(20)
    const inB = Math.abs(fieldAt(sol, 50, 5).ey)
    const inA = Math.abs(fieldAt(sol, 50, 15).ey)
    // The normal component of D is continuous, so eps E is the same on both
    // sides and E is in the inverse ratio of the permittivities.
    expect(relative(inA / inB, epsB / epsA)).toBeLessThan(1e-10)
  })
})

describe('symmetry planes', () => {
  it('a quarter of a symmetric geometry reports the whole one', () => {
    const a = 1.2e-3
    const b = 4e-3
    const quarterC = capacitancePerMetre(solveLaplace(roundCoax(a, b)(80)), 1, { symmetry: 4 })
    // The same geometry solved whole, with the conductor at the centre of a
    // square domain and no symmetry planes.
    const whole = solveLaplace({
      width: 2 * b,
      height: 2 * b,
      n: 160,
      potential: (x, y) => {
        const r = Math.hypot(x - b, y - b)
        return r <= a ? 1 : r >= b ? 0 : null
      },
      outer: 0,
      tol: 1e-12,
      maxIter: 400000,
    })
    expect(relative(quarterC, capacitancePerMetre(whole, 1))).toBeLessThan(0.02)
  }, 120000)
})

describe('reading a solved field', () => {
  it('valueAt interpolates between nodes and clamps outside the domain', () => {
    const sol = solveLaplace(trough(20))
    const h = sol.h
    // Halfway between two nodes is the mean of them, on a bilinear read.
    const a = nodeV(sol, 5, 7)
    const b = nodeV(sol, 6, 7)
    expect(valueAt(sol, 5.5 * h, 7 * h)).toBeCloseTo((a + b) / 2, 10)
    expect(valueAt(sol, -1, -1)).toBe(nodeV(sol, 0, 0))
    expect(valueAt(sol, 10, 10)).toBe(nodeV(sol, sol.nx, sol.ny))
  })

  it('the energy in the field is half C V squared, on the grid too', () => {
    const r = rng(0x4e)
    for (let k = 0; k < 5; k++) {
      const V = logUniform(r, 1, 500)
      const sol = solveLaplace({ ...trough(20), potential: (x, y) => (y >= W - 1e-12 ? V : null) })
      const C = capacitancePerMetre(sol, V)
      expect(relative(energyPerMetre(sol), 0.5 * C * V * V)).toBeLessThan(1e-12)
    }
  })
})
