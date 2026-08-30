import { hash01 } from '@ee-labs/dsp'
import { bode, polesZeros, secondOrderMetrics, stepResponse } from '@ee-labs/systems'
import { CIRCUITS, transferOf } from './circuits.js'

// What real parts do to the numbers on screen.
//
// Every value in this tool is exact, and no part in a drawer is. A resistor is
// sold as "10 kΩ, ±5%", and which 10 kΩ you actually got decides where the
// corner really lands. This samples the circuit with every component perturbed
// independently and uniformly within ITS OWN tolerance band — per part,
// because a board is never all one grade: the film capacitor is ±1% while the
// electrolytic beside it is ±10%, and which spec suffers depends on which
// part wobbles. f₀ = 1/(2π√LC) has no R in it at all, and giving R alone a
// tolerance is the cleanest way to see that.
//
// Deterministic on purpose: the same circuit at the same tolerances always
// produces the same builds, so the picture is stable under React re-renders
// and a test can assert against it. The variation is hash01 of the sample
// index, which is the same trick the noise source uses — and the cloud, the
// response band and the step band all draw the SAME builds, so the three
// views disagree about nothing.
//
// The lesson hiding in it: f₀ moves as −(δL+δC)/2 — the square root HALVES
// each part's error — while Q = (1/R)√(L/C) takes δR, δL and δC with no such
// mercy. Ratios wobble harder than geometric means, and that is why Q is the
// spec that costs money.

export const TOLERANCES = [
  { value: 0, label: 'exact' },
  { value: 0.01, label: '±1%' },
  { value: 0.05, label: '±5%' },
  { value: 0.1, label: '±10%' },
]

const SAMPLES = 120

/**
 * Per-part tolerances for a circuit, from a spec that may be lazy.
 *
 * A number applies to every part (the old single-knob behaviour, and what a
 * lesson's `tol: 0.05` still means); an object names parts individually and
 * unnamed parts are exact; anything else is all-exact.
 */
export function tolsOf(id, spec) {
  const out = {}
  for (const p of CIRCUITS[id].params) {
    out[p.key] = typeof spec === 'number' ? spec : (spec && spec[p.key]) || 0
  }
  return out
}

const anyTol = (tols) => Object.values(tols).some((v) => v > 0)

/** Build number i of the circuit, each part drawn from its own band. */
function buildParams(id, params, tols, i) {
  const defs = CIRCUITS[id].params
  const p = {}
  for (let j = 0; j < defs.length; j++) {
    const key = defs[j].key
    // Uniform in ±tol, from a hash of (sample, component) — independent per
    // component, reproducible per call.
    const u = hash01(i * 31 + j, 0xc1c) * 2 - 1
    p[key] = params[key] * (1 + (tols[key] || 0) * u)
  }
  return p
}

/**
 * The scatter from building this circuit SAMPLES times with real parts.
 *
 * `tols` is a per-part map (or a plain number for every part — see tolsOf).
 * Returns `{ cloud, f0, q, any }` — `cloud` is every sampled pole as [re, im];
 * `f0` and `q` are `{ lo, hi }` ranges (null when the circuit has no such
 * figure); `any` is false when every part is exact.
 */
export function toleranceCloud(id, params, output, tols) {
  const t = tolsOf(id, typeof tols === 'number' ? tols : tols || {})
  if (!anyTol(t)) return { cloud: [], f0: null, q: null, any: false }

  const cloud = []
  let f0lo = Infinity
  let f0hi = -Infinity
  let qlo = Infinity
  let qhi = -Infinity

  for (let i = 0; i < SAMPLES; i++) {
    const tf = transferOf(id, buildParams(id, params, t, i), output)
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

/**
 * The envelope of the frequency response across the same SAMPLES builds: at
 * each grid frequency, the lowest and highest magnitude (linear) and phase
 * (radians) any build produced. Null when every part is exact.
 *
 * A min/max envelope of phase assumes no build wraps past ±180° where another
 * does not — true for every circuit in this registry, whose stable responses
 * live inside one branch of atan2. The twin-T's snap AT the notch widens the
 * band to the full ±90° there, which is honest: builds with different notch
 * frequencies really do disagree by that much at a fixed frequency.
 */
export function responseBand(id, params, output, tols, freqs) {
  const t = tolsOf(id, typeof tols === 'number' ? tols : tols || {})
  if (!anyTol(t)) return null

  const n = freqs.length
  const magLo = new Float64Array(n).fill(Infinity)
  const magHi = new Float64Array(n).fill(-Infinity)
  const phaseLo = new Float64Array(n).fill(Infinity)
  const phaseHi = new Float64Array(n).fill(-Infinity)

  for (let i = 0; i < SAMPLES; i++) {
    const tf = transferOf(id, buildParams(id, params, t, i), output)
    const r = bode(tf, freqs)
    for (let k = 0; k < n; k++) {
      if (r.mag[k] < magLo[k]) magLo[k] = r.mag[k]
      if (r.mag[k] > magHi[k]) magHi[k] = r.mag[k]
      if (r.phase[k] < phaseLo[k]) phaseLo[k] = r.phase[k]
      if (r.phase[k] > phaseHi[k]) phaseHi[k] = r.phase[k]
    }
  }
  return { magLo, magHi, phaseLo, phaseHi }
}

/**
 * The envelope of the step response across the same builds, on its own time
 * grid (shared duration with the nominal trace, fewer points — an envelope
 * outline needs no 900-point resolution and RK4 is the expensive part here).
 */
export function stepBand(id, params, output, tols, duration, points = 300) {
  const t = tolsOf(id, typeof tols === 'number' ? tols : tols || {})
  if (!anyTol(t) || !(duration > 0)) return null

  let grid = null
  const lo = new Float64Array(points).fill(Infinity)
  const hi = new Float64Array(points).fill(-Infinity)

  for (let i = 0; i < SAMPLES; i++) {
    const tf = transferOf(id, buildParams(id, params, t, i), output)
    const r = stepResponse(tf, { duration, points })
    if (!grid) grid = r.t
    for (let k = 0; k < points; k++) {
      if (r.y[k] < lo[k]) lo[k] = r.y[k]
      if (r.y[k] > hi[k]) hi[k] = r.y[k]
    }
  }
  return { t: grid, lo, hi }
}

/** "±4.9%", from a range and its centre. */
export function spreadPct(range, centre) {
  if (!range || !(centre > 0)) return null
  const half = Math.max(range.hi - centre, centre - range.lo)
  return (100 * half) / centre
}
