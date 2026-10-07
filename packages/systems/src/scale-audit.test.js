import { describe, it, expect } from 'vitest'
import { bode, roots, stepResponse } from './tf.js'
import { polyFromRoots } from './ss.js'

describe('pole geometry survives a change of time units', () => {
  it('keeps the plotted Bode phase when every coefficient is multiplied by a small scale', () => {
    const freqs = [1e-6, 1e-3, 1, 1e3]
    const a = bode({ b: [1], a: [1, 3, 3, 1] }, freqs)
    const b = bode({ b: [1e-30], a: [1e-30, 3e-30, 3e-30, 1e-30] }, freqs)
    for (let i = 0; i < freqs.length; i++) expect(b.phase[i]).toBeCloseTo(a.phase[i], 10)
  })
  it.each([1e-12, 1e-8, 1, 1e8])('retains the oscillation at natural frequency %s', (w) => {
    const poles = roots([1, w, w * w])
    for (const [re, im] of poles) {
      expect(re / w).toBeCloseTo(-0.5, 6)
      expect(Math.abs(im) / w).toBeCloseTo(Math.sqrt(0.75), 6)
    }
    // Read the simulated step at its first peak, independently of the roots.
    // Normalize time to keep the integration workload independent of units.
    const { y } = stepResponse({ b: [1], a: [1, 1, 1] }, { duration: 12, points: 1201 })
    const peak = Math.max(...y)
    const [re, im] = poles[0]
    expect(1 + Math.exp(Math.PI * re / Math.abs(im))).toBeCloseTo(peak, 4)
  })
  it.each([1e-14, 1, 1e8])('retains a supplied conjugate pair at scale %s', (w) => {
    const poly = polyFromRoots([[-w, w], [-w, -w]])
    expect(poly[1] / w).toBeCloseTo(2, 8)
    expect(poly[2] / (w * w)).toBeCloseTo(2, 8)
    expect(() => polyFromRoots([[-w, w], [-w, -2 * w]])).toThrow(/conjugate/)
  })
})
