import { describe, it, expect } from 'vitest'
import { converter, KINDS } from './topologies.js'
import { steadyState } from './steady.js'
import { runPeriods } from './transient.js'

// The solver's fixed point is the state every other test starts from. Here
// the circuit is switched on from rest and walked, period by period, with no
// knowledge of that answer; where it settles must be where the solver said.
// A fixed point the circuit never visits is invisible to every other test.

const REL = 1e-8 // of the walk's own scale, well inside the walker's settle
const MAX = 200000

function walkTo(conv) {
  const ss = steadyState(conv)
  const r = runPeriods(conv, [0, 0], { periods: MAX, settle: 1e-13 })
  const di = Math.abs(r.x[0] - ss.x0[0]) / Math.max(1e-9, r.scale[0])
  const dv = Math.abs(r.x[1] - ss.x0[1]) / Math.max(1e-9, r.scale[1])
  return { ss, r, di, dv }
}

function expectArrival({ ss, r, di, dv }) {
  expect(r.periods, 'the walk settled before the period cap').toBeLessThan(MAX)
  expect(di).toBeLessThan(REL)
  expect(dv).toBeLessThan(REL)
  expect(r.mode).toBe(ss.mode)
  expect(Math.abs(r.td - ss.td)).toBeLessThan(1e-9 * ss.T)
}

describe('walking from rest arrives at the solver’s fixed point', () => {
  const named = [
    ['buck at the defaults (CCM)', 'buck', {}],
    ['buck lightly loaded (DCM)', 'buck', { R: 200 }],
    ['buck with a diode drop, lightly loaded (DCM)', 'buck', { R: 400, Vf: 0.5 }],
    ['synchronous buck, lightly loaded (CCM, current reverses)', 'buck', { R: 200, sync: true }],
    ['boost loaded (CCM)', 'boost', { D: 0.5, R: 20 }],
    ['boost lightly loaded (DCM)', 'boost', { D: 0.5, R: 400 }],
    ['buck-boost lightly loaded (DCM)', 'buckboost', { D: 0.5, R: 200 }],
    ['lossy buck (CCM)', 'buck', { Ron: 0.05, RL: 0.03, ESR: 0.05, Vf: 0.5 }],
    ['lossy boost (DCM)', 'boost', { D: 0.6, R: 300, Ron: 0.1, rd: 0.05, RL: 0.05, ESR: 0.2 }],
  ]
  it.each(named)('%s', (_, kind, p) => {
    expectArrival(walkTo(converter(kind, p)))
  })

  // The probe has teeth: the same walk, judged against a fixed point moved
  // by one part in a thousand, fails — so a solver that was wrong by that
  // much could not pass above.
  it('would reject a fixed point wrong by 0.1 %', () => {
    const { ss, r } = walkTo(converter('boost', { D: 0.5, R: 400 }))
    const wrong = [ss.x0[0], ss.x0[1] * 1.001]
    const dv = Math.abs(r.x[1] - wrong[1]) / r.scale[1]
    expect(dv).toBeGreaterThan(REL * 1e3)
  })
})

// Seeded fuzz across the knob ranges, kept to converters whose slowest mode
// settles within the period cap: the output pole is no slower than 1/(2RC),
// and the inductor's no slower than the load reflected through the
// conversion, (1−D)²R + the winding and switch, over L.
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const logU = (r, lo, hi) => lo * (hi / lo) ** r()

function fastParams(r) {
  for (;;) {
    const on = () => r() < 0.6
    const p = {
      Vin: logU(r, 3, 48),
      D: 0.08 + 0.84 * r(),
      L: logU(r, 4.7e-6, 2.2e-3),
      C: logU(r, 1e-6, 470e-6),
      R: logU(r, 0.5, 400),
      fs: logU(r, 20e3, 1e6),
      Ron: on() ? logU(r, 1e-3, 0.5) : 0,
      Vf: on() ? 0.2 + 0.8 * r() : 0,
      rd: on() ? logU(r, 1e-3, 0.2) : 0,
      RL: on() ? logU(r, 1e-3, 0.5) : 0,
      ESR: on() ? logU(r, 1e-3, 1) : 0,
      sync: r() < 0.3,
    }
    const slowest = Math.max(2 * p.R * p.C, p.L / ((1 - p.D) ** 2 * p.R + p.Ron + p.RL)) * p.fs
    if (slowest <= 1500) return p
  }
}

const r = rng(7)
const fuzz = []
for (let i = 0; i < 150; i++) fuzz.push([KINDS[i % 3], i, fastParams(r)])

describe('walking from rest arrives at the solver’s fixed point — fuzz', () => {
  it.each(fuzz)('%s #%i', (kind, _, p) => {
    expectArrival(walkTo(converter(kind, p)))
  })
})
