import { describe, it, expect } from 'vitest'
import { stateAt, endState, integral, sample, quadrature, firstDownCrossing, bisect } from './segment.js'

const buckOn = {
  A: [
    [-0, -1e4],
    [1e4, -2000],
  ],
  f: [12e4, 0],
  x0: [0.85, 5],
  T: 4.2e-6,
}

// Composite Simpson on a dense sample of the exact solution: the independent
// yardstick for the Gauss–Legendre integrals.
function simpson(seg, g, n = 4000) {
  const pts = sample(seg, n)
  const h = seg.T / n
  let s = 0
  for (let k = 0; k <= n; k++) {
    const w = k === 0 || k === n ? 1 : k % 2 ? 4 : 2
    s += w * g(pts[k], k * h)
  }
  return (s * h) / 3
}

describe('segment solution', () => {
  it('stateAt(T) is the end state and sampling lands on it', () => {
    const xe = endState(buckOn)
    const pts = sample(buckOn, 50)
    expect(pts[0]).toEqual(buckOn.x0)
    expect(pts[50][0]).toBeCloseTo(xe[0], 12)
    expect(pts[50][1]).toBeCloseTo(xe[1], 12)
    expect(stateAt(buckOn, 0)).toEqual(buckOn.x0)
  })

  it('the exact integral of the state agrees with quadrature of it and with Simpson', () => {
    const ix = integral(buckOn)
    for (const c of [0, 1]) {
      const q = quadrature(buckOn, (x) => x[c])
      const s = simpson(buckOn, (x) => x[c])
      expect(Math.abs(q - ix[c]) / Math.abs(ix[c])).toBeLessThan(1e-13)
      expect(Math.abs(s - ix[c]) / Math.abs(ix[c])).toBeLessThan(1e-11)
    }
  })

  it('quadrature of a square (what RMS needs) matches Simpson to its own accuracy', () => {
    const q = quadrature(buckOn, (x) => x[0] * x[0])
    const s = simpson(buckOn, (x) => x[0] * x[0], 20000)
    expect(Math.abs(q - s) / s).toBeLessThan(1e-11)
  })

  it('quadrature splits a long, stiff segment rather than trusting one panel', () => {
    const seg = { A: [[-1e5, 0], [0, -1e5]], f: [1e5, 0], x0: [0, 1], T: 1e-3 }
    // x0(t) = 1 − e^{−1e5 t}: ∫₀ᵀ = T − (1 − e^{−100})/1e5
    const exact = 1e-3 - (1 - Math.exp(-100)) / 1e5
    expect(quadrature(seg, (x) => x[0])).toBeCloseTo(exact, 16)
    // x1(t) = e^{−1e5 t}: ∫ x1² = (1 − e^{−200}) / 2e5
    expect(quadrature(seg, (x) => x[1] ** 2)).toBeCloseTo(0.5e-5, 18)
    expect(quadrature({ ...seg, T: 0 }, (x) => x[0])).toBe(0)
  })
})

describe('events', () => {
  it('finds the instant a ramp crosses zero to 1e-13 of the segment', () => {
    // ẋ = f: x = x0 + f t, zero at −x0/f.
    const seg = { A: [[0, 0], [0, 0]], f: [-3e5, 0], x0: [0.6, 5], T: 5e-6 }
    const t = firstDownCrossing(seg, 0)
    expect(Math.abs(t - 2e-6)).toBeLessThan(1e-13 * seg.T)
  })

  it('reports null when the current never reaches zero, and ignores upward crossings', () => {
    const seg = { A: [[0, 0], [0, 0]], f: [-1e5, 0], x0: [0.6, 5], T: 5e-6 }
    expect(firstDownCrossing(seg, 0)).toBeNull()
    const up = { A: [[0, 0], [0, 0]], f: [3e5, 0], x0: [-0.6, 5], T: 5e-6 }
    expect(firstDownCrossing(up, 0)).toBeNull()
  })

  it('bisect closes a sign change to the requested width', () => {
    const root = bisect((t) => 2 - t * t, 0, 4, 1e-12)
    expect(root).toBeCloseTo(Math.SQRT2, 11)
  })
})
