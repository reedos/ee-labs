import { describe, it, expect } from 'vitest'
import {
  stagesOf,
  thermalNetwork,
  junctionOf,
  steadyRise,
  stepRise,
  zth,
  fosterZth,
  pulsedRise,
  junctionTemp,
  derating,
  frequencyCeiling,
  edgeCost,
  THERMAL_MODELS,
} from './thermal.js'

// A thermal network is an RC network with °C on it, so it owes what every
// other network in this package owes: an exact step response, a periodic
// steady state that is a linear solve rather than a settling run, and an
// average that is an identity.
//
//   1. The Foster network's step response is Σ R_i(1 − e^{−t/τ_i}), and the
//      propagator reproduces it to floating point.
//   2. Both networks settle at P·ΣR, whatever the route.
//   3. Under a pulsed load the mean rise is ⟨P⟩·ΣR exactly, because averaging
//      the state equation over a closed period leaves nothing else.
//   4. The peak sits at the end of the pulse and never below the flat rise.
//   5. Z_th rises with time and never falls.

const rnd = (seed) => {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const logPick = (r, lo, hi) => lo * Math.pow(hi / lo, r())

function sample(seed) {
  const r = rnd(seed)
  return [
    { Rth: logPick(r, 0.05, 5), tau: logPick(r, 1e-4, 1e-2) },
    { Rth: logPick(r, 0.1, 5), tau: logPick(r, 1e-2, 1) },
    { Rth: logPick(r, 0.5, 40), tau: logPick(r, 1, 1000) },
  ]
}

describe('the network', () => {
  it('reads its stages the way a datasheet writes them', () => {
    const st = stagesOf({})
    expect(st).toHaveLength(3)
    expect(st[0]).toEqual({ Rth: 0.6, tau: 1e-3 })
    const net = thermalNetwork('foster', st)
    expect(net.Rtotal).toBeCloseTo(10, 12)
    // A stage's capacitance is its time constant over its resistance.
    for (let i = 0; i < 3; i++) expect(net.C[i]).toBeCloseTo(st[i].tau / st[i].Rth, 12)
  })

  it('refuses a stage that cannot exist, and a model it does not have', () => {
    expect(() => thermalNetwork('foster', [{ Rth: 0, tau: 1 }])).toThrow(/thermal resistance/)
    expect(() => thermalNetwork('foster', [{ Rth: 1, tau: 0 }])).toThrow(/time constant/)
    expect(() => thermalNetwork('nosuch', stagesOf({}))).toThrow(/unknown thermal network/)
  })

  it.each(THERMAL_MODELS)('%s: settles at P·ΣR over 200 seeded networks', (model) => {
    for (let seed = 1; seed <= 200; seed++) {
      const st = sample(seed * 7919 + model.length)
      const net = thermalNetwork(model, st)
      const P = 0.1 + 20 * ((seed % 13) / 13)
      // A ladder's own slowest mode is not one of the stages' time
      // constants, and it is never longer than ΣR·ΣC, so that is the horizon
      // both models are read at.
      const far = 60 * net.Rtotal * net.Ctotal
      const [rise] = stepRise(net, P, [far])
      const want = steadyRise(net, P)
      expect(Math.abs(rise / want - 1), `${model} #${seed}`).toBeLessThan(1e-9)
      expect(want).toBeCloseTo(P * net.Rtotal, 9)
    }
  })

  it('foster: the propagator and the closed form are one answer', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const st = sample(seed * 104729 + 3)
      const net = thermalNetwork('foster', st)
      const times = [1e-5, 1e-3, 0.05, 1, 20, 400]
      const got = zth(net, times)
      times.forEach((t, i) => {
        const want = fosterZth(st, t)
        // The exponential is scaled and squared, so a horizon four million
        // time constants long costs the last few bits and no more.
        expect(Math.abs(got[i] - want), `#${seed} at ${t} s`).toBeLessThan(1e-9 * net.Rtotal)
      })
    }
  })

  it('rises and never falls, in either model', () => {
    for (const model of THERMAL_MODELS) {
      for (let seed = 1; seed <= 60; seed++) {
        const net = thermalNetwork(model, sample(seed * 15485863 + 5))
        const times = Array.from({ length: 40 }, (_, i) => 1e-5 * Math.pow(10, (8 * i) / 39))
        const z = zth(net, times)
        for (let i = 1; i < z.length; i++) expect(z[i], `${model} #${seed} at ${times[i]}`).toBeGreaterThanOrEqual(z[i - 1] - 1e-9 * net.Rtotal)
        expect(z[0]).toBeGreaterThan(0)
        expect(z[z.length - 1]).toBeLessThanOrEqual(net.Rtotal * (1 + 1e-9))
      }
    }
  })
})

describe('the two networks are not the same network', () => {
  it('reach the same rise at rest and at the end, and differ between', () => {
    const st = stagesOf({})
    const fo = thermalNetwork('foster', st)
    const ca = thermalNetwork('cauer', st)
    expect(fo.Rtotal).toBeCloseTo(ca.Rtotal, 12)
    const times = [1e-4, 1e-3, 1e-2, 0.1, 1, 10]
    const a = zth(fo, times)
    const b = zth(ca, times)
    // At the far end both are the same total resistance.
    const [farA] = zth(fo, [1e5])
    const [farB] = zth(ca, [1e5])
    expect(farA).toBeCloseTo(farB, 6)
    // Between, the ladder lags the fitted stages: the heat has to cross each
    // node before it reaches the next.
    let worst = 0
    for (let i = 0; i < times.length; i++) {
      expect(b[i], `at ${times[i]} s`).toBeLessThanOrEqual(a[i] + 1e-12)
      worst = Math.max(worst, 1 - b[i] / a[i])
    }
    expect(worst).toBeGreaterThan(0.02)
    expect(worst).toBeLessThan(0.1)
  })

  it('puts the junction in the first node of a ladder and in the sum of the stages', () => {
    const st = stagesOf({})
    expect(thermalNetwork('foster', st).read).toEqual([1, 1, 1])
    expect(thermalNetwork('cauer', st).read).toEqual([1, 0, 0])
    // A Foster stage's own state is not a temperature of anything, which is
    // why the junction is their sum rather than one of them.
    const fo = thermalNetwork('foster', st)
    expect(junctionOf(fo, [1, 2, 3])).toBeCloseTo(6, 12)
    expect(junctionOf(thermalNetwork('cauer', st), [1, 2, 3])).toBeCloseTo(1, 12)
  })
})

describe('a pulsed load', () => {
  it.each(THERMAL_MODELS)('%s: averages to ⟨P⟩·ΣR exactly, over 120 seeded pulses', (model) => {
    for (let seed = 1; seed <= 120; seed++) {
      const r = rnd(seed * 6700417 + 1)
      const net = thermalNetwork(model, sample(seed * 999331 + 7))
      const P = logPick(r, 0.5, 100)
      const duty = 0.02 + 0.95 * r()
      const period = logPick(r, 1e-3, 100)
      const q = pulsedRise(net, { P, duty, period, points: 60 })
      const where = `${model} #${seed}`
      expect(Math.abs(q.mean / q.flat - 1), `${where} mean`).toBeLessThan(1e-8)
      expect(q.flat).toBeCloseTo(P * duty * net.Rtotal, 9)
      // The peak is at the end of the pulse and the valley at the end of the
      // gap, so the average sits between them.
      expect(q.peak, `${where} peak`).toBeGreaterThanOrEqual(q.mean - 1e-9)
      expect(q.valley, `${where} valley`).toBeLessThanOrEqual(q.mean + 1e-9)
      expect(q.swing, `${where} swing`).toBeGreaterThanOrEqual(0)
    }
  })

  it('reaches the same peak as a steady load when the pulse is long beside every stage', () => {
    const net = thermalNetwork('foster', stagesOf({}))
    const slow = pulsedRise(net, { P: 10, duty: 0.5, period: 1e5 })
    expect(slow.peak / steadyRise(net, 10)).toBeCloseTo(1, 3)
    // ...and flattens to the average when the pulse is short beside every one.
    const fast = pulsedRise(net, { P: 10, duty: 0.5, period: 1e-6 })
    expect(fast.peak / slow.peak).toBeLessThan(0.6)
    expect(Math.abs(fast.peak / fast.flat - 1)).toBeLessThan(1e-4)
    expect(fast.swing).toBeLessThan(1e-3 * fast.mean)
  })

  it('makes a die peak far above the average while the sink barely notices', () => {
    const net = thermalNetwork('foster', stagesOf({}))
    const q = pulsedRise(net, { P: 20, duty: 0.1, period: 1 })
    expect(q.flat).toBeCloseTo(20, 9)
    expect(q.peak).toBeGreaterThan(1.5 * q.flat)
    // The heatsink's stage has a three-hundred-second time constant, so a
    // one-second pulse leaves it flat: drop it and the swing is unchanged.
    const fast = thermalNetwork('foster', stagesOf({}).slice(0, 2))
    const two = pulsedRise(fast, { P: 20, duty: 0.1, period: 1 })
    expect(Math.abs(two.swing / q.swing - 1)).toBeLessThan(2e-3)
    // The die's own stage carries under half of it, because the case's
    // hundred-millisecond constant is the same order as the pulse.
    const die = thermalNetwork('foster', [stagesOf({})[0]])
    const only = pulsedRise(die, { P: 20, duty: 0.1, period: 1 })
    expect(only.swing / q.swing).toBeGreaterThan(0.3)
    expect(only.swing / q.swing).toBeLessThan(0.5)
  })
})

describe('the ceiling', () => {
  it('turns a junction limit into a power and back', () => {
    const net = thermalNetwork('foster', stagesOf({}))
    const d = derating(net, { Ta: 25, Tjmax: 150, P: 3 })
    expect(d.Pmax).toBeCloseTo(125 / 10, 12)
    expect(d.Tj).toBeCloseTo(55, 12)
    expect(d.rise).toBeCloseTo(30, 12)
    expect(d.headroom).toBeCloseTo(95, 12)
    expect(d.margin).toBeCloseTo(3 / 12.5, 12)
    expect(junctionTemp(25, d.rise)).toBeCloseTo(d.Tj, 12)
    // At the limit exactly, the margin is one.
    expect(derating(net, { Ta: 25, Tjmax: 150, P: d.Pmax }).Tj).toBeCloseTo(150, 9)
    expect(derating(net, { Ta: 25, Tjmax: 150, P: d.Pmax }).margin).toBeCloseTo(1, 12)
  })

  it('turns the same limit into a switching frequency, through the loss model', () => {
    const net = thermalNetwork('foster', stagesOf({}))
    const kSw = edgeCost({ Vblk: 48, iOn: 2, iOff: 2.4, tr: 20e-9, tf: 20e-9 })
    expect(kSw).toBeCloseTo(0.5 * 48 * (2 * 20e-9 + 2.4 * 20e-9), 15)
    const c = frequencyCeiling({ Rtotal: net.Rtotal, Ta: 25, Tjmax: 150, Pcond: 0.5, kSw })
    expect(c.budget).toBeCloseTo(12.5, 12)
    expect(c.fs).toBeCloseTo((12.5 - 0.5) / kSw, 6)
    expect(c.feasible).toBe(true)
    // At that frequency the junction is exactly at its limit.
    const P = 0.5 + kSw * c.fs
    expect(derating(net, { Ta: 25, Tjmax: 150, P }).Tj).toBeCloseTo(150, 6)
  })

  it('says so when conduction alone already exceeds the budget', () => {
    const net = thermalNetwork('foster', stagesOf({}))
    const c = frequencyCeiling({ Rtotal: net.Rtotal, Ta: 25, Tjmax: 150, Pcond: 20, kSw: 1e-6 })
    expect(c.feasible).toBe(false)
    expect(c.fs).toBeLessThan(0)
  })

  it('has no ceiling when the edges cost nothing', () => {
    const net = thermalNetwork('foster', stagesOf({}))
    const c = frequencyCeiling({ Rtotal: net.Rtotal, Ta: 25, Tjmax: 150, Pcond: 1, kSw: 0 })
    expect(c.fs).toBe(Infinity)
    expect(c.feasible).toBe(true)
  })

  it('falls one kelvin per kelvin of ambient, which is what derating means', () => {
    const net = thermalNetwork('foster', stagesOf({}))
    const a = derating(net, { Ta: 25, Tjmax: 150 })
    const b = derating(net, { Ta: 75, Tjmax: 150 })
    expect(a.Pmax - b.Pmax).toBeCloseTo(50 / net.Rtotal, 12)
    expect(a.slope).toBeCloseTo(-net.Rtotal, 12)
  })
})
