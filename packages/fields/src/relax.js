// Laplace's equation on a grid, by relaxation, with the guard that makes it
// admissible.
//
// CORE_SCOPE Rule 3 governs this whole module. A grid solve is an
// approximation, so it ships with an applicability check carrying a concrete
// threshold, and crossing the threshold changes what the app shows. The guard
// here is not a residual and not an iteration count. Both of those measure how
// well the solver solved the discrete problem, which is a different question
// from how well the discrete problem stands for the continuous one. The guard
// is **the change in the answer between two mesh refinements**, and the
// threshold is a relative change the caller names.
//
// The discretisation is finite volume, not finite difference, so that a
// geometry with two dielectrics is handled without a special case. Around each
// node sits a cell of side h. Each of the four faces carries a permittivity
// sampled at its midpoint, and the equation at the node is that the four face
// fluxes sum to zero:
//
//     sum over faces of  eps_face (V_neighbour - V_node)  =  0
//
// With one uniform permittivity that is the five-point Laplacian. With two it
// is the correct interface condition, because the normal component of D is what
// the sum conserves. The same operator solves a conduction problem with sigma
// in place of eps, which is why resistance and capacitance share this file.
//
// Relaxation is successive over-relaxation in lexicographic order. The
// over-relaxation factor is the one that is optimal for a Dirichlet square,
// omega = 2 / (1 + sin(pi/n)). An internal conductor makes it no longer
// optimal, and it stays a good deal faster than Gauss-Seidel, which is all it
// is claimed to be.

import { EPS0, FieldsError, nonNegative, positive, require_ } from './const.js'

/**
 * Fill a solve specification's defaults and check it.
 *
 * ```js
 * {
 *   width, height,                 // the domain in metres
 *   n,                             // cells across the width; the height gets round(n * height / width)
 *   potential: (x, y) => number | null,   // volts where a conductor sits, null elsewhere
 *   epsr: (x, y) => number,        // relative permittivity, default 1 everywhere
 *   neumann: { left, right, top, bottom },  // true where the edge is a symmetry plane
 *   outer: 0,                      // volts on every edge that is not a symmetry plane
 *   tol: 1e-10,                    // relaxation stops when the largest update falls below tol times the potential span
 *   maxIter: 200000,
 * }
 * ```
 */
export function normalizeSpec(spec) {
  require_(spec && typeof spec === 'object', 'A grid solve needs a specification object.', { field: 'spec' })
  const width = positive(spec.width, 'width')
  const height = positive(spec.height, 'height')
  const n = Math.round(positive(spec.n, 'n'))
  require_(n >= 4, `The grid needs at least 4 cells across, and n is ${n}.`, { field: 'n' })
  const h = width / n
  const ny = Math.max(2, Math.round(height / h))
  const potential = spec.potential || (() => null)
  require_(typeof potential === 'function', 'potential must be a function of x and y.', { field: 'potential' })
  const epsr = spec.epsr || (() => 1)
  require_(typeof epsr === 'function', 'epsr must be a function of x and y.', { field: 'epsr' })
  return {
    width,
    height: ny * h,
    n,
    nx: n,
    ny,
    h,
    potential,
    epsr,
    neumann: { left: false, right: false, top: false, bottom: false, ...(spec.neumann || {}) },
    outer: Number.isFinite(spec.outer) ? spec.outer : 0,
    tol: positive(spec.tol ?? 1e-10, 'tol'),
    maxIter: Math.round(positive(spec.maxIter ?? 200000, 'maxIter')),
  }
}

/**
 * Solve Laplace's equation on the specification's grid.
 *
 * Returns `{ nx, ny, h, V, fixed, iterations, maxUpdate, converged, spec }`.
 * `V` is a Float64Array of (nx+1)(ny+1) node potentials in row-major order,
 * `fixed` a Uint8Array marking the nodes a conductor holds. `V` is indexed by
 * `at(i, j)`, and `valueAt(sol, x, y)` interpolates between nodes.
 *
 * `converged` is false when the iteration ran out before the update fell below
 * the tolerance. A caller that ignores it is reading a half-solved field, so
 * the convergence report below refuses to build on one.
 */
export function solveLaplace(spec) {
  const s = normalizeSpec(spec)
  const { nx, ny, h } = s
  const W = nx + 1
  const N = W * (ny + 1)
  const V = new Float64Array(N)
  const fixed = new Uint8Array(N)
  const at = (i, j) => j * W + i

  // The conductors, and the span of potential they set, which sets the scale
  // the tolerance is measured against.
  let lo = Infinity
  let hi = -Infinity
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const p = s.potential(i * h, j * h)
      if (p !== null && p !== undefined) {
        require_(Number.isFinite(p), `potential returned ${p} at x = ${i * h}, y = ${j * h}. It must return a number or null.`, { field: 'potential' })
        V[at(i, j)] = p
        fixed[at(i, j)] = 1
        lo = Math.min(lo, p)
        hi = Math.max(hi, p)
      }
    }
  }
  // The outer edges that are not symmetry planes are conductors at `outer`.
  const edge = (i, j) => {
    if (i === 0 && !s.neumann.left) return true
    if (i === nx && !s.neumann.right) return true
    if (j === 0 && !s.neumann.bottom) return true
    if (j === ny && !s.neumann.top) return true
    return false
  }
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      if (!fixed[at(i, j)] && edge(i, j)) {
        V[at(i, j)] = s.outer
        fixed[at(i, j)] = 1
        lo = Math.min(lo, s.outer)
        hi = Math.max(hi, s.outer)
      }
    }
  }
  require_(
    Number.isFinite(lo),
    'The grid has no conductor on it and no outer boundary, so Laplace has no boundary condition and no solution.',
    { field: 'potential' },
  )
  const span = Math.max(hi - lo, 1e-12)

  // A first guess halfway between the extremes settles faster than zero when
  // the conductors sit at 0 and V, and costs nothing when they do not.
  const guess = (lo + hi) / 2
  for (let k = 0; k < N; k++) if (!fixed[k]) V[k] = guess

  // Face permittivities, one per face, sampled at the face midpoint.
  const epsE = new Float64Array(N)
  const epsN = new Float64Array(N)
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      epsE[at(i, j)] = i < nx ? relPerm(s, (i + 0.5) * h, j * h) : 0
      epsN[at(i, j)] = j < ny ? relPerm(s, i * h, (j + 0.5) * h) : 0
    }
  }
  const faceW = (i, j) => (i > 0 ? epsE[at(i - 1, j)] : epsE[at(i, j)])
  const faceE = (i, j) => (i < nx ? epsE[at(i, j)] : epsE[at(i - 1, j)])
  const faceS = (i, j) => (j > 0 ? epsN[at(i, j - 1)] : epsN[at(i, j)])
  const faceN = (i, j) => (j < ny ? epsN[at(i, j)] : epsN[at(i, j - 1)])

  const omega = 2 / (1 + Math.sin(Math.PI / Math.max(nx, ny)))
  let iterations = 0
  let maxUpdate = Infinity
  for (; iterations < s.maxIter; iterations++) {
    maxUpdate = 0
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const k = at(i, j)
        if (fixed[k]) continue
        // A neighbour outside the domain is the mirror of the one inside,
        // which is the symmetry plane's condition.
        const w = faceW(i, j)
        const e = faceE(i, j)
        const so = faceS(i, j)
        const no = faceN(i, j)
        const vW = V[at(i > 0 ? i - 1 : 1, j)]
        const vE = V[at(i < nx ? i + 1 : nx - 1, j)]
        const vS = V[at(i, j > 0 ? j - 1 : 1)]
        const vN = V[at(i, j < ny ? j + 1 : ny - 1)]
        const sum = w + e + so + no
        const next = (w * vW + e * vE + so * vS + no * vN) / sum
        const d = omega * (next - V[k])
        V[k] += d
        const ad = Math.abs(d)
        if (ad > maxUpdate) maxUpdate = ad
      }
    }
    if (maxUpdate < s.tol * span) {
      iterations++
      break
    }
  }
  return {
    nx,
    ny,
    h,
    W,
    V,
    fixed,
    span,
    omega,
    iterations,
    maxUpdate,
    converged: maxUpdate < s.tol * span,
    spec: s,
  }
}

function relPerm(s, x, y) {
  const v = s.epsr(x, y)
  require_(Number.isFinite(v) && v > 0, `epsr returned ${v} at x = ${x}, y = ${y}. It must be a positive number.`, { field: 'epsr' })
  return v
}

/**
 * How much of the conductor boundary cuts across the mesh rather than following
 * it, as a fraction between 0 and 1.
 *
 * This is what decides whether the mesh guard may trust Richardson's
 * extrapolation, and it is measured rather than assumed. Walk every conductor
 * node that touches a free node. A node exposed on one side only sits on a flat
 * run of boundary. A node exposed on two perpendicular sides is a step. A
 * rectangle aligned with the mesh has four such steps however fine the mesh, so
 * its fraction falls as 1/n. A circle has steps all the way round, so its
 * fraction stays where it is when the mesh is halved. That difference is the
 * whole reason the two get different error bands.
 */
export function staircaseFraction(sol) {
  const { nx, ny, fixed } = sol
  let exposed = 0
  let steps = 0
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      if (!fixed[nodeAt(sol, i, j)]) continue
      // The outer frame is the domain's edge, not a shape cut into the mesh.
      if (i === 0 || i === nx || j === 0 || j === ny) continue
      const free = (a, b) => !fixed[nodeAt(sol, a, b)]
      const hOpen = free(i - 1, j) || free(i + 1, j)
      const vOpen = free(i, j - 1) || free(i, j + 1)
      if (!hOpen && !vOpen) continue
      exposed++
      if (hOpen && vOpen) steps++
    }
  }
  return exposed ? steps / exposed : 0
}

/** The node index of (i, j) in a solve. */
export const nodeAt = (sol, i, j) => j * sol.W + i

/** The potential at a node. */
export const nodeV = (sol, i, j) => sol.V[nodeAt(sol, i, j)]

/**
 * The potential at any point in the domain, by bilinear interpolation between
 * the four nodes around it. Outside the domain it clamps to the edge, because
 * a plot's cursor leaving the picture should not produce NaN.
 */
export function valueAt(sol, x, y) {
  const { h, nx, ny } = sol
  const u = Math.min(Math.max(x / h, 0), nx)
  const v = Math.min(Math.max(y / h, 0), ny)
  const i = Math.min(Math.floor(u), nx - 1)
  const j = Math.min(Math.floor(v), ny - 1)
  const fx = u - i
  const fy = v - j
  const v00 = nodeV(sol, i, j)
  const v10 = nodeV(sol, i + 1, j)
  const v01 = nodeV(sol, i, j + 1)
  const v11 = nodeV(sol, i + 1, j + 1)
  return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy
}

/**
 * The electric field at a node, volts per metre, by a central difference where
 * there are neighbours on both sides and a one-sided difference at an edge.
 * E = -grad V, so the sign is the physics and not a convention.
 */
export function fieldAt(sol, i, j) {
  const { nx, ny, h } = sol
  require_(
    Number.isInteger(i) && Number.isInteger(j) && i >= 0 && j >= 0 && i <= nx && j <= ny,
    `The node (${i}, ${j}) is not on this grid, which runs from (0, 0) to (${nx}, ${ny}). The height in cells follows from the width, so a domain wider than it is tall has fewer rows than columns.`,
    { field: 'node' },
  )
  const ex =
    i === 0
      ? -(nodeV(sol, 1, j) - nodeV(sol, 0, j)) / h
      : i === nx
        ? -(nodeV(sol, nx, j) - nodeV(sol, nx - 1, j)) / h
        : -(nodeV(sol, i + 1, j) - nodeV(sol, i - 1, j)) / (2 * h)
  const ey =
    j === 0
      ? -(nodeV(sol, i, 1) - nodeV(sol, i, 0)) / h
      : j === ny
        ? -(nodeV(sol, i, ny) - nodeV(sol, i, ny - 1)) / h
        : -(nodeV(sol, i, j + 1) - nodeV(sol, i, j - 1)) / (2 * h)
  return { ex, ey, mag: Math.hypot(ex, ey) }
}

/**
 * The energy per unit length stored in the solved field, joules per metre.
 *
 * W' = integral of eps |E|^2 / 2 over the cross-section. The integral is taken
 * face by face rather than node by node, because |E| on a face is the one
 * difference the solver actually used, and summing those makes the energy the
 * exact quadratic form the discrete operator minimises. `symmetry` multiplies
 * the result, so a quarter of a symmetric geometry reports the whole one.
 */
export function energyPerMetre(sol, { symmetry = 1 } = {}) {
  const { nx, ny, h, spec } = sol
  let sum = 0
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i < nx; i++) {
      const e = spec.epsr((i + 0.5) * h, j * h)
      const dv = (nodeV(sol, i + 1, j) - nodeV(sol, i, j)) / h
      // A node on a top or bottom edge owns half a cell in y.
      const wy = j === 0 || j === ny ? 0.5 : 1
      sum += 0.5 * EPS0 * e * dv * dv * h * h * wy
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const e = spec.epsr(i * h, (j + 0.5) * h)
      const dv = (nodeV(sol, i, j + 1) - nodeV(sol, i, j)) / h
      const wx = i === 0 || i === nx ? 0.5 : 1
      sum += 0.5 * EPS0 * e * dv * dv * h * h * wx
    }
  }
  return sum * symmetry
}

/**
 * Capacitance per unit length from the solved field's energy, farads per metre.
 *
 * C' = 2 W' / V^2, with V the potential difference the conductors were held at.
 * This is the energy route rather than the surface-charge route, and it is the
 * one that converges from below monotonically, which is what makes the mesh
 * guard readable.
 */
export function capacitancePerMetre(sol, voltage, opts = {}) {
  const V = Math.abs(positive(Math.abs(voltage), 'voltage'))
  return (2 * energyPerMetre(sol, opts)) / (V * V)
}

/**
 * Conductance per unit length of the same solve read as a conduction problem,
 * siemens per metre, for a conductivity sigma.
 *
 * Laplace's equation does not know which of the two problems it is solving, so
 * the same field serves both and G' = sigma C' / eps0 / epsr where the
 * permittivity is uniform. The function takes the uniform relative
 * permittivity the solve used so that the substitution is explicit rather than
 * assumed.
 */
export function conductancePerMetre(sol, voltage, sigma, { epsr = 1, symmetry = 1 } = {}) {
  const s = positive(sigma, 'sigma')
  return (capacitancePerMetre(sol, voltage, { symmetry }) * s) / (EPS0 * positive(epsr, 'epsr'))
}

/**
 * The outward normal integral of E over a rectangular contour on the grid,
 * in volts. Multiply by eps for the electric flux, or by sigma for the current
 * per unit length.
 *
 * The contour runs along cell faces half a cell outside the nodes named by
 * `i0, j0, i1, j1`, so each segment's normal derivative is one of the
 * differences the solver used. That makes the result the discrete divergence
 * theorem's own left-hand side, and `chargeInside` its right-hand side. The two
 * agree to floating point on a converged solve, which is a check on the
 * bookkeeping. The check on the physics is this flux against the closed form's
 * charge, and that one is limited by the mesh.
 */
export function normalIntegral(sol, { i0, j0, i1, j1 }) {
  const { nx, ny, h, spec } = sol
  require_(
    i0 >= 0 && j0 >= 0 && i1 <= nx && j1 <= ny && i1 > i0 && j1 > j0,
    `The contour must lie inside the grid, and it runs from (${i0}, ${j0}) to (${i1}, ${j1}) on a ${nx} by ${ny} grid.`,
    { field: 'contour' },
  )
  // Every face that joins a node inside the block to a node outside it. On each
  // of them the outward normal component of E is (V_inside - V_outside) / h,
  // and the face is h long, so the h cancels and the face contributes the
  // potential difference itself.
  //
  // The weights are the finite-volume ones. A node on the domain's own edge
  // owns half a cell across that edge, so a face perpendicular to the OTHER
  // axis carries half the area. Getting this wrong puts a spurious charge along
  // every symmetry plane, because the solver's mirrored equation at such a node
  // is the half-cell balance doubled and not the full-cell balance.
  let sum = 0
  for (let j = j0; j <= j1; j++) {
    const wy = j === 0 || j === ny ? 0.5 : 1
    if (i0 > 0) sum += wy * spec.epsr((i0 - 0.5) * h, j * h) * (nodeV(sol, i0, j) - nodeV(sol, i0 - 1, j))
    if (i1 < nx) sum += wy * spec.epsr((i1 + 0.5) * h, j * h) * (nodeV(sol, i1, j) - nodeV(sol, i1 + 1, j))
  }
  for (let i = i0; i <= i1; i++) {
    const wx = i === 0 || i === nx ? 0.5 : 1
    if (j0 > 0) sum += wx * spec.epsr(i * h, (j0 - 0.5) * h) * (nodeV(sol, i, j0) - nodeV(sol, i, j0 - 1))
    if (j1 < ny) sum += wx * spec.epsr(i * h, (j1 + 0.5) * h) * (nodeV(sol, i, j1) - nodeV(sol, i, j1 + 1))
  }
  return sum
}

/** The electric flux out of a rectangular contour, in volt-metres: eps0 times the normal integral. */
export const fluxThrough = (sol, rect) => EPS0 * normalIntegral(sol, rect)

/**
 * The charge per unit length the nodes inside a rectangular contour carry,
 * coulombs per metre, read off the discrete operator.
 *
 * At a node the operator's residual is the net face flux, which Poisson's
 * equation says is the charge in that node's cell. On a free node the residual
 * is zero by construction, so only the conductor nodes contribute, which is
 * where the charge is.
 */
export function chargeInside(sol, { i0, j0, i1, j1 }) {
  const { nx, ny, h, spec } = sol
  let sum = 0
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const v = nodeV(sol, i, j)
      // The flux entering this node's cell through its four faces, with the
      // same finite-volume weights normalIntegral uses. A node on a symmetry
      // plane owns half a cell, and its transverse faces carry half the area.
      const wy = j === 0 || j === ny ? 0.5 : 1
      const wx = i === 0 || i === nx ? 0.5 : 1
      let entering = 0
      if (i > 0) entering += wy * spec.epsr((i - 0.5) * h, j * h) * (nodeV(sol, i - 1, j) - v)
      if (i < nx) entering += wy * spec.epsr((i + 0.5) * h, j * h) * (nodeV(sol, i + 1, j) - v)
      if (j > 0) entering += wx * spec.epsr(i * h, (j - 0.5) * h) * (nodeV(sol, i, j - 1) - v)
      if (j < ny) entering += wx * spec.epsr(i * h, (j + 0.5) * h) * (nodeV(sol, i, j + 1) - v)
      // The charge in the cell is the flux LEAVING it, which is the negative.
      sum -= EPS0 * entering
    }
  }
  return sum
}

/**
 * The mesh guard, and the only way this package hands a grid answer to a caller.
 *
 * `build(n)` returns a solve specification at n cells across. `read(sol)` reads
 * the one number the guard is about. The function solves at n, 2n and 4n and
 * reports:
 *
 *   levels      the three (n, h, value) rows
 *   change      |value(4n) - value(2n)| / |value(4n)|, the guard's quantity
 *   threshold   what the caller said was close enough
 *   ok          whether change is at or below threshold
 *   order       the observed convergence order from the three levels
 *   richardson  the extrapolated value the three levels point at
 *   estimate    |value(4n) - richardson| / |richardson|, the error estimate
 *   says        one sentence for the app, naming both numbers
 *
 * `change` is the guard PROGRAM's plan names: the change between two mesh
 * refinements, against a threshold. `estimate` is the sharper figure the third
 * level buys, and the app shows both, because a reader who halves the mesh
 * twice should see that the second halving moved the answer four times less.
 */
export function converge(build, { n = 40, threshold = 1e-3, read, levels = 3, symmetry = 1 } = {}) {
  require_(typeof build === 'function', 'converge needs a build function that returns a specification for n cells.', { field: 'build' })
  const readValue = read || ((sol) => energyPerMetre(sol, { symmetry }))
  require_(levels >= 2 && levels <= 5, `converge takes two to five levels, and it was given ${levels}.`, { field: 'levels' })
  const rows = []
  for (let k = 0; k < levels; k++) {
    const nk = n * 2 ** k
    const sol = solveLaplace(build(nk))
    if (!sol.converged) {
      throw new FieldsError(
        `The relaxation at ${nk} cells across stopped after ${sol.iterations} sweeps with its largest update still at ${sol.maxUpdate.toExponential(2)} V. Raise maxIter or loosen tol before reading the answer.`,
        { field: 'maxIter', n: nk },
      )
    }
    rows.push({ n: nk, h: sol.h, value: readValue(sol), sol })
  }
  const last = rows[rows.length - 1]
  const prev = rows[rows.length - 2]
  const change = Math.abs(last.value - prev.value) / Math.max(1e-300, Math.abs(last.value))
  const report = {
    levels: rows.map(({ n: cells, h, value }) => ({ n: cells, h, value })),
    value: last.value,
    change,
    threshold: nonNegative(threshold, 'threshold'),
    ok: change <= threshold,
  }
  if (rows.length >= 3) {
    const a = rows[rows.length - 3].value
    const b = prev.value
    const c = last.value
    const ratio = (a - b) / (b - c)
    // A ratio of 4 is second-order convergence, of 2 first-order. A ratio at or
    // below 1 means the refinements are not converging, and no extrapolation is
    // reported for one.
    if (Number.isFinite(ratio) && ratio > 1.05) {
      report.order = Math.log2(ratio)
      report.richardson = c + (c - b) / (ratio - 1)
      report.estimate = Math.abs(c - report.richardson) / Math.max(1e-300, Math.abs(report.richardson))
    }
  }
  // The band the guard is willing to defend, and the number every claim about a
  // grid answer is measured against.
  //
  // Richardson's extrapolation gives the error the three levels point at. It is
  // an estimate, and on a staircase boundary the three levels are not yet in
  // the regime where it is reliable, so it is multiplied by a safety factor
  // before anything is claimed. The factor is Roache's grid convergence index:
  // 1.25 when the observed order sits near the scheme's formal second order, 3
  // when it does not. A geometry whose boundary follows the mesh earns the
  // first. A circle cut out of a square mesh earns the second, and the app says
  // which one it is looking at.
  report.staircase = staircaseFraction(last.sol)
  const aligned = report.staircase <= 0.02
  const clean = aligned && report.order !== undefined && report.order >= 1.5
  report.safety = clean ? 1.25 : 3
  report.band = report.safety * (clean ? report.estimate : Math.max(report.change, report.estimate ?? 0))
  report.boundary = aligned ? 'follows the mesh' : 'cuts across the mesh'
  report.says = sentence(report)
  report.solution = last.sol
  return report
}

/**
 * Whether a value the grid is being checked against lies inside the guard's
 * band. This is the only sanctioned way to compare a grid answer with a closed
 * form, and it is what relax.test.js uses on every canonical geometry.
 */
export function agreesWithin(report, value) {
  const rel = Math.abs(value - report.value) / Math.max(1e-300, Math.abs(value))
  return { rel, band: report.band, ok: rel <= report.band }
}

function sentence(r) {
  const pct = (x) => `${(100 * x).toPrecision(3)} per cent`
  const fine = r.levels[r.levels.length - 1]
  const coarse = r.levels[r.levels.length - 2]
  const head = `Halving the mesh from ${coarse.n} to ${fine.n} cells changed the answer by ${pct(r.change)}.`
  const verdict = r.ok
    ? `That is inside the ${pct(r.threshold)} threshold, so the grid answer is quoted to three figures.`
    : `That is past the ${pct(r.threshold)} threshold, so the grid answer is quoted to two figures and marked as unsettled.`
  const extra =
    r.estimate === undefined
      ? ''
      : ` The three levels converge at order ${r.order.toFixed(2)}, and the boundary ${r.boundary}. The error band is ${pct(r.band)}.`
  return `${head} ${verdict}${extra}`
}

/** How many significant figures a grid answer may be quoted to, given its guard. */
export const figuresOf = (report) => (report.ok ? 3 : 2)

/** A grid answer rounded to the figures its guard allows, so a caption cannot over-claim. */
export function quoted(report, value = report.value) {
  return Number(value.toPrecision(figuresOf(report)))
}
