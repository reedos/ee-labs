import { hash01 } from '@ee-labs/dsp'
import { polesZeros, secondOrderMetrics } from '@ee-labs/systems'
import { CIRCUITS, transferOf } from './circuits.js'

// What ±5% parts do to the numbers on screen.
//
// Every value in this tool is exact, and no part in a drawer is. A resistor is
// sold as "10 kΩ, ±5%", and which 10 kΩ you actually got decides where the
// corner really lands. This samples the circuit with every component perturbed
// independently and uniformly within its tolerance band — the pessimistic and
// honest model for parts of unknown provenance — and reports where the poles
// scatter and how far f₀ and Q wander.
//
// Deterministic on purpose: the same circuit at the same tolerance always
// produces the same cloud, so the picture is stable under React re-renders and
// a test can assert against it. The variation is hash01 of the sample index,
// which is the same trick the noise source uses.
//
// The lesson hiding in it: f₀ = 1/(2π√LC) moves as −(δL+δC)/2 — the square
// root HALVES each part's error — while Q = (1/R)√(L/C) takes δR, δL and δC
// with no such mercy. Ratios wobble harder than geometric means, and that is
// why Q is the spec that costs money.

export const TOLERANCES = [
  { value: 0, label: 'exact' },
  { value: 0.01, label: '±1%' },
  { value: 0.05, label: '±5%' },
  { value: 0.1, label: '±10%' },
]

const SAMPLES = 120

/**
 * The scatter from building this circuit SAMPLES times with real parts.
 *
 * Returns `{ cloud, f0, q, any }` — `cloud` is every sampled pole as [re, im];
 * `f0` and `q` are `{ lo, hi }` ranges (null when the circuit has no such
 * figure); `any` is false at zero tolerance.
 */
export function toleranceCloud(id, params, output, tol) {
  if (!(tol > 0)) return { cloud: [], f0: null, q: null, any: false }
  const defs = CIRCUITS[id].params

  const cloud = []
  let f0lo = Infinity
  let f0hi = -Infinity
  let qlo = Infinity
  let qhi = -Infinity

  for (let i = 0; i < SAMPLES; i++) {
    const p = {}
    for (let j = 0; j < defs.length; j++) {
      const key = defs[j].key
      // Uniform in ±tol, from a hash of (sample, component) — independent per
      // component, reproducible per call.
      const u = hash01(i * 31 + j, 0xc1c) * 2 - 1
      p[key] = params[key] * (1 + tol * u)
    }
    const tf = transferOf(id, p, output)
    for (const pole of polesZeros(tf).poles) cloud.push(pole)
    const m = secondOrderMetrics(tf)
    if (m && Number.isFinite(m.f0)) {
      f0lo = Math.min(f0lo, m.f0)
      f0hi = Math.max(f0hi, m.f0)
      if (Number.isFinite(m.q)) {
        qlo = Math.min(qlo, m.q)
        qhi = Math.max(qhi, m.q)
      }
    }
  }

  return {
    cloud,
    f0: Number.isFinite(f0lo) ? { lo: f0lo, hi: f0hi } : null,
    q: Number.isFinite(qlo) ? { lo: qlo, hi: qhi } : null,
    any: true,
  }
}

/** "±4.9%", from a range and its centre. */
export function spreadPct(range, centre) {
  if (!range || !(centre > 0)) return null
  const half = Math.max(range.hi - centre, centre - range.lo)
  return (100 * half) / centre
}
