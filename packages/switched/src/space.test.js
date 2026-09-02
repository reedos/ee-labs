import { describe, it, expect } from 'vitest'
import { converter, KINDS, DEFAULTS } from './topologies.js'
import { steadyState, periodMap, average, measures, waveforms } from './steady.js'
import { endState, firstDownCrossing } from './segment.js'
import { Kcrit } from './formulas.js'

// The whole knob space, two thousand converters a kind, held to what any
// periodic steady state must satisfy — the cheap invariants on every sample,
// the full measures on every tenth. steady.test.js reads sixty samples
// closely; this is the wide net, with the corners the sixty are unlikely to
// reach named beside it.

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const logU = (r, lo, hi) => lo * (hi / lo) ** r()

function randomParams(r) {
  const on = () => r() < 0.6
  return {
    Vin: logU(r, 3, 48),
    D: 0.02 + 0.96 * r(),
    L: logU(r, 4.7e-6, 2.2e-3),
    C: logU(r, 1e-6, 2.2e-3),
    R: logU(r, 0.5, 1000),
    fs: logU(r, 20e3, 1e6),
    Ron: on() ? logU(r, 1e-3, 0.5) : 0,
    Vf: on() ? 0.2 + 0.8 * r() : 0,
    rd: on() ? logU(r, 1e-3, 0.2) : 0,
    RL: on() ? logU(r, 1e-3, 0.5) : 0,
    ESR: on() ? logU(r, 1e-3, 1) : 0,
    sync: r() < 0.3,
    tr: r() < 0.5 ? logU(r, 5e-9, 100e-9) : 0,
    tf: r() < 0.5 ? logU(r, 5e-9, 100e-9) : 0,
  }
}

const scales = (ss) => {
  let Is = 1e-9
  let Vs = ss.conv.p.Vin
  for (const seg of ss.segments) {
    if (seg.T <= 0) continue
    const xe = endState(seg)
    Is = Math.max(Is, Math.abs(seg.x0[0]), Math.abs(xe[0]))
    Vs = Math.max(Vs, Math.abs(seg.x0[1]), Math.abs(xe[1]))
  }
  return { Is, Vs }
}

/** The invariants that need only the steady state. Throws on the first failure. */
function checkSteady(conv, ss) {
  const { Is, Vs } = scales(ss)
  const live = ss.segments.filter((s) => s.T > 0)
  // Finite, with positive durations.
  for (const v of [...ss.x0, ss.td, ss.tOn, ss.tOff]) expect(Number.isFinite(v)).toBe(true)
  expect(ss.tOn).toBeGreaterThan(0)
  expect(ss.tOff).toBeGreaterThan(0)
  expect(ss.td).toBeGreaterThan(0)
  for (const s of live) expect(s.T).toBeGreaterThan(0)
  // 1, 2. Volt-second and charge balance.
  expect(Math.abs(average(ss, 'vL'))).toBeLessThan(1e-9 * Vs)
  expect(Math.abs(average(ss, 'iC'))).toBeLessThan(1e-9 * Is)
  // 4. Continuity between segments.
  for (let k = 1; k < live.length; k++) {
    const xe = endState(live[k - 1])
    expect(Math.abs(live[k].x0[1] - xe[1])).toBeLessThan(1e-9 * Vs)
    expect(Math.abs(live[k].x0[0] - xe[0])).toBeLessThan(1e-9 * Is)
  }
  // 6. One more period lands on the same state.
  const xT = periodMap(ss)
  expect(Math.abs(xT[0] - ss.x0[0])).toBeLessThan(1e-9 * Is)
  expect(Math.abs(xT[1] - ss.x0[1])).toBeLessThan(1e-9 * Vs)
  // The mode agrees with the diode: in CCM its current never reaches zero
  // in the off interval; in DCM it reaches zero exactly at t_d and not
  // before, and the period begins at zero current.
  if (conv.hasDead) {
    const off = ss.segments[1]
    const c = firstDownCrossing(off, 0)
    if (ss.mode === 'CCM') {
      expect(c).toBeNull()
      expect(ss.x0[0]).toBeGreaterThanOrEqual(0)
      expect(endState(off)[0]).toBeGreaterThanOrEqual(-1e-9 * Is)
    } else {
      expect(ss.td).toBeLessThan(ss.tOff)
      expect(Math.abs(endState(off)[0])).toBeLessThan(1e-9 * Is)
      expect(ss.x0[0]).toBe(0)
      if (c !== null) expect(c).toBeGreaterThanOrEqual(ss.td * (1 - 1e-6))
    }
  } else {
    expect(ss.mode).toBe('CCM')
  }
}

// Trapezoid over a dense trace, both ends of every edge on it.
function dense(ss, name, n = 4000) {
  const wf = waveforms(ss, { periods: 1, n })
  const y = wf.sig[name]
  let avg = 0
  let sq = 0
  for (let i = 1; i < wf.t.length; i++) {
    const h = wf.t[i] - wf.t[i - 1]
    avg += (h * (y[i] + y[i - 1])) / 2
    sq += (h * (y[i] ** 2 + y[i - 1] ** 2)) / 2
  }
  return { avg: avg / ss.T, rms: Math.sqrt(sq / ss.T) }
}

/** The measures too: energy balance, and closed-form averages and RMS against dense integration. */
function checkMeasures(ss) {
  const m = measures(ss)
  const { Is, Vs } = scales(ss)
  // 3. Energy: in = out + losses.
  expect(Math.abs(m.balance)).toBeLessThan(1e-9 * Math.max(m.Pin, m.Pout))
  expect(m.eta).toBeGreaterThan(0)
  expect(m.eta).toBeLessThanOrEqual(1 + 1e-12)
  for (const s of Object.values(m.sig)) for (const v of Object.values(s)) expect(Number.isFinite(v)).toBe(true)
  // 5. The closed forms agree with brute-force integration of the trace.
  for (const [name, scale] of [
    ['iL', Is],
    ['vout', Vs],
  ]) {
    const d = dense(ss, name)
    expect(Math.abs(m.sig[name].avg - d.avg)).toBeLessThan(1e-5 * scale)
    expect(Math.abs(m.sig[name].rms - d.rms)).toBeLessThan(1e-5 * scale)
  }
}

describe.each(KINDS)('%s across the whole knob space', (kind) => {
  it('2000 seeded converters satisfy the steady-state invariants; every tenth the measures too', () => {
    const r = rng(kind.length * 1000 + 2026)
    let dcm = 0
    for (let i = 0; i < 2000; i++) {
      const p = randomParams(r)
      const conv = converter(kind, p)
      let ss
      try {
        ss = steadyState(conv)
        checkSteady(conv, ss)
        if (i % 10 === 0) checkMeasures(ss)
      } catch (e) {
        e.message = `${kind} #${i} ${JSON.stringify(p)}\n${e.message}`
        throw e
      }
      if (ss.mode === 'DCM') dcm++
    }
    // Both modes are well represented.
    expect(dcm).toBeGreaterThan(150)
    expect(dcm).toBeLessThan(1850)
  })
})

describe('the corners', () => {
  const base = { ...DEFAULTS }
  const corners = []
  for (const kind of KINDS) {
    corners.push([`${kind} D → 0.02`, kind, { ...base, D: 0.02 }])
    corners.push([`${kind} D → 0.98`, kind, { ...base, D: 0.98 }])
    corners.push([`${kind} ESR → 1 Ω`, kind, { ...base, ESR: 1 }])
    corners.push([`${kind} r → 0 (RL = 1 µΩ)`, kind, { ...base, RL: 1e-6 }])
    corners.push([`${kind} every loss at its worst`, kind, { ...base, Ron: 0.5, Vf: 1, rd: 0.2, RL: 0.5, ESR: 1, tr: 100e-9, tf: 100e-9 }])
    // K within 1 % of K_crit on either side: R = 2 L f_s / K.
    for (const D of [0.3, 0.5, 0.7]) {
      const Kc = Kcrit(kind, D)
      const R = (K) => (2 * base.L * base.fs) / K
      corners.push([`${kind} D = ${D}, K = 1.01 K_crit`, kind, { ...base, D, R: R(1.01 * Kc) }, 'CCM'])
      corners.push([`${kind} D = ${D}, K = 0.99 K_crit`, kind, { ...base, D, R: R(0.99 * Kc) }, 'DCM'])
    }
  }
  it.each(corners)('%s', (_, kind, p, mode) => {
    const conv = converter(kind, p)
    const ss = steadyState(conv)
    checkSteady(conv, ss)
    checkMeasures(ss)
    if (mode) expect(ss.mode).toBe(mode)
  })
})
