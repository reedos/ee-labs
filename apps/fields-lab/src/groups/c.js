// Group C: Laplace's equation on a grid.
//
// The group that earns the guard. Every experiment here reports the change
// between two mesh refinements against a threshold, and C3 is the one where the
// guard has to widen its band because the boundary cuts across the mesh.
//
// The mesh sizes are chosen so the whole group solves in a few seconds. A
// convergence report solves at n, 2n and 4n, so a starting n of 20 means a
// finest mesh of 80, and one of 48 means 192.

import { capacitancePerMetre, valueAt } from '@ee-labs/fields'
import { Cells, Eps, Len, Ratio, Volt } from '../knobs.js'

export const GROUP = 'C · Laplace on a grid'

/** A square trough of side `w` with its top side held at V0 and the rest at zero. */
const troughSpec = (p, n) => ({
  width: p.w,
  height: p.w,
  n,
  potential: (x, y) => (y >= p.w - 1e-12 ? p.V : null),
  outer: 0,
  tol: 1e-13,
  maxIter: 400000,
})

/** A quarter of a round coaxial line, meshed on a square grid. */
const coaxSpec = (p, n) => ({
  width: p.b,
  height: p.b,
  n,
  potential: (x, y) => {
    const r = Math.hypot(x, y)
    return r <= p.a ? 1 : r >= p.b ? 0 : null
  },
  neumann: { left: true, bottom: true, right: true, top: true },
  tol: 1e-12,
  maxIter: 400000,
})

/** A quarter of a square inner conductor inside a square shield. */
const squareSpec = (p, n) => ({
  width: p.b / 2,
  height: p.b / 2,
  n,
  potential: (x, y) => (x <= p.a / 2 + 1e-15 && y <= p.a / 2 + 1e-15 ? 1 : null),
  neumann: { left: true, bottom: true },
  outer: 0,
  tol: 1e-13,
  maxIter: 400000,
})

export const C = [
  {
    id: 'c1',
    group: GROUP,
    kind: 'grid',
    name: 'Relaxation finds a potential no formula gives',
    terms: ['laplace', 'relaxation', 'boundarycondition', 'meanvalue', 'meshguard'],
    params: [
      Len('w', 'Trough side', 0.1),
      Volt('V', 'Top side', 100),
      Len('px', 'Probe across', 0.025),
      Len('py', 'Probe up', 0.075),
      Cells('n', 'Cells across', 20, 'The coarsest of the three meshes'),
    ],
    // The cache key is every knob the SOLVE and the READ both depend on. The
    // probe is in it because `read` evaluates the solution there: leaving it
    // out returns the report solved for the previous probe, which is a moved
    // knob that changes nothing on screen.
    gridKey: (p) => [p.w, p.V, p.n, p.px, p.py],
    spec: troughSpec,
    cells: (p) => p.n,
    threshold: 1e-3,
    read: (s, p) => valueAt(s, p.px, p.py),
    view: '2d',
    views: ['2d', 'profile', 'mesh'],
    headline: (x) => ({ value: x.grid.value, unit: 'V', label: 'Potential at the probe', grid: true }),
    domain: (p) => ({ width: p.w, height: p.w }),
  },
  {
    id: 'c2',
    group: GROUP,
    kind: 'grid',
    name: 'The guard is the change between two meshes',
    terms: ['convergence', 'meshguard', 'richardson', 'order', 'safetyfactor'],
    params: [
      Len('w', 'Trough side', 0.1),
      Volt('V', 'Top side', 100),
      Len('px', 'Probe across', 0.025),
      Len('py', 'Probe up', 0.075),
      Cells('n', 'Cells across', 20),
    ],
    // The cache key is every knob the SOLVE and the READ both depend on. The
    // probe is in it because `read` evaluates the solution there: leaving it
    // out returns the report solved for the previous probe, which is a moved
    // knob that changes nothing on screen.
    gridKey: (p) => [p.w, p.V, p.n, p.px, p.py],
    spec: troughSpec,
    cells: (p) => p.n,
    threshold: 1e-3,
    read: (s, p) => valueAt(s, p.px, p.py),
    // The exact series the grid is measured against, so C2 can show the true
    // error beside the guard's band.
    compare: (p) => {
      let s = 0
      for (let k = 1; k < 400; k += 2) {
        const a = (k * Math.PI) / p.w
        s += (1 / k) * Math.sin(a * p.px) * Math.exp(a * (p.py - p.w)) * ((1 - Math.exp(-2 * a * p.py)) / (1 - Math.exp(-2 * a * p.w)))
      }
      return { value: ((4 * p.V) / Math.PI) * s, name: 'the Fourier series' }
    },
    view: 'mesh',
    views: ['mesh', '2d', 'profile'],
    headline: (x) => ({ value: x.grid.change, unit: '', label: 'Change on the last halving', ratio: true }),
    domain: (p) => ({ width: p.w, height: p.w }),
  },
  {
    id: 'c3',
    group: GROUP,
    kind: 'grid',
    name: 'A curved boundary converges more slowly',
    terms: ['staircase', 'convergence', 'meshguard', 'safetyfactor'],
    params: [
      Len('a', 'Inner radius', 1e-3),
      Len('b', 'Shield radius', 3.5e-3),
      Cells('n', 'Cells across', 48),
    ],
    gridKey: (p) => [p.a, p.b, p.n],
    spec: coaxSpec,
    cells: (p) => p.n,
    threshold: 1e-2,
    read: (s) => capacitancePerMetre(s, 1, { symmetry: 4 }),
    compare: (p) => ({
      value: (2 * Math.PI * 8.8541878128e-12) / Math.log(p.b / p.a),
      name: 'the closed form',
    }),
    view: 'mesh',
    views: ['mesh', '2d', 'profile'],
    headline: (x) => ({ value: x.grid.value, unit: 'F/m', label: 'Capacitance per metre', grid: true }),
    domain: (p) => ({ width: p.b, height: p.b }),
  },
  {
    id: 'c4',
    group: GROUP,
    kind: 'grid',
    name: 'Gauss checks the field the grid solved',
    terms: ['gauss', 'flux', 'divergence', 'meshguard'],
    params: [
      Len('a', 'Inner radius', 1e-3),
      Len('b', 'Shield radius', 3.5e-3),
      Cells('n', 'Cells across', 48),
      Ratio('box', 'Contour fraction', 0.45, 'How much of the shield the Gauss contour encloses', 0.1, 0.9),
    ],
    gridKey: (p) => [p.a, p.b, p.n],
    spec: coaxSpec,
    cells: (p) => p.n,
    threshold: 1e-2,
    read: (s) => capacitancePerMetre(s, 1, { symmetry: 4 }),
    contour: (sol, p) => {
      const k = Math.max(2, Math.round(sol.nx * p.box))
      return { i0: 0, j0: 0, i1: k, j1: k, symmetry: 4 }
    },
    compare: (p) => ({
      value: (2 * Math.PI * 8.8541878128e-12) / Math.log(p.b / p.a),
      name: 'the closed form',
    }),
    view: 'flux',
    views: ['flux', 'mesh', '2d'],
    headline: (x) => ({ value: x.flux.value, unit: 'C/m', label: 'Charge the flux implies', grid: true }),
    domain: (p) => ({ width: p.b, height: p.b }),
  },
  {
    id: 'c5',
    group: GROUP,
    kind: 'grid',
    name: 'A geometry with no closed form at all',
    terms: ['laplace', 'meshguard', 'corner'],
    params: [
      Len('a', 'Inner conductor side', 2e-3),
      Len('b', 'Shield side', 7e-3),
      Cells('n', 'Cells across', 28),
    ],
    gridKey: (p) => [p.a, p.b, p.n],
    spec: squareSpec,
    cells: (p) => p.n,
    threshold: 1e-3,
    read: (s) => capacitancePerMetre(s, 1, { symmetry: 4 }),
    view: 'mesh',
    views: ['mesh', '2d', 'profile'],
    headline: (x) => ({ value: x.grid.value, unit: 'F/m', label: 'Capacitance per metre', grid: true }),
    domain: (p) => ({ width: p.b / 2, height: p.b / 2 }),
  },
]
