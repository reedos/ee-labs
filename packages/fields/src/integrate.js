// Quadrature, so that a closed form can be checked against something that does
// not know the closed form.
//
// The rule this package works to is that every closed form is checked against
// an independent numerical integral of the field law it came from. Coulomb's
// law integrated over a ring is not the ring's closed-form field rearranged.
// It is the sum over the ring, computed here, and the two agree or the test
// fails. That is why this module exists and why it shares no code with
// closed.js or magnetics.js.
//
// Gauss-Legendre is the workhorse. Its nodes and weights are computed by
// Newton's method on the Legendre polynomial rather than typed in, so any
// order is available and no table can be mistyped.

/**
 * Gauss-Legendre nodes and weights on [-1, 1] for `n` points.
 *
 * The k-th root of P_n is found by Newton from the Chebyshev-like starting
 * guess cos(pi (k - 1/4) / (n + 1/2)), which is within 1e-3 of every root, and
 * the iteration converges in four or five steps to machine precision.
 */
const cache = new Map()
export function gaussLegendre(n) {
  if (cache.has(n)) return cache.get(n)
  const x = new Float64Array(n)
  const w = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    let t = Math.cos((Math.PI * (k + 0.75)) / (n + 0.5))
    let dp = 0
    for (let it = 0; it < 100; it++) {
      // Legendre P_n and its derivative by the three-term recurrence.
      let p0 = 1
      let p1 = 0
      for (let j = 0; j < n; j++) {
        const p2 = p1
        p1 = p0
        p0 = ((2 * j + 1) * t * p1 - j * p2) / (j + 1)
      }
      dp = (n * (t * p0 - p1)) / (t * t - 1)
      const dt = -p0 / dp
      t += dt
      if (Math.abs(dt) < 1e-15) break
    }
    x[k] = t
    w[k] = 2 / ((1 - t * t) * dp * dp)
  }
  const out = { x, w }
  cache.set(n, out)
  return out
}

/** Integrate f over [a, b] with an n-point Gauss-Legendre rule on each of `panels` panels. */
export function quad(f, a, b, { n = 16, panels = 1 } = {}) {
  const { x, w } = gaussLegendre(n)
  const h = (b - a) / panels
  let sum = 0
  for (let p = 0; p < panels; p++) {
    const lo = a + p * h
    const mid = lo + h / 2
    const half = h / 2
    for (let k = 0; k < n; k++) sum += w[k] * f(mid + half * x[k]) * half
  }
  return sum
}

/**
 * Integrate f over [a, b] to a relative tolerance, by doubling the panel count
 * until two successive estimates agree. Returns the value and what it took, so
 * a caller can report the error it actually achieved rather than the one it
 * asked for.
 */
export function quadTo(f, a, b, { n = 16, tol = 1e-11, maxPanels = 1 << 16 } = {}) {
  let panels = 1
  let prev = quad(f, a, b, { n, panels })
  for (;;) {
    panels *= 2
    const now = quad(f, a, b, { n, panels })
    const err = Math.abs(now - prev) / Math.max(1e-300, Math.abs(now))
    if (err <= tol || panels >= maxPanels) return { value: now, panels, err }
    prev = now
  }
}

/** Integrate f(u, v) over the rectangle [a, b] x [c, d] with a tensor Gauss-Legendre rule. */
export function quad2(f, a, b, c, d, { n = 16, panels = 1 } = {}) {
  return quad((u) => quad((v) => f(u, v), c, d, { n, panels }), a, b, { n, panels })
}

/**
 * Integrate a vector-valued f over [a, b], component by component.
 * `dim` is the length of the array f returns.
 */
export function quadVec(f, a, b, dim, opts = {}) {
  const out = new Array(dim).fill(0)
  for (let i = 0; i < dim; i++) out[i] = quad((t) => f(t)[i], a, b, opts)
  return out
}
