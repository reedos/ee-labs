import { describe, it, expect } from 'vitest'
import { flyback, halfBridge, isolated, isolatedM, ISOLATED_KINDS } from './isolated.js'
import { steadyState, measures, average, periodMap, waveforms } from './steady.js'
import { endState, firstDownCrossing } from './segment.js'
import { runPeriods } from './transient.js'
import { lossLedger } from './ledger.js'

// The two isolated converters, held to the same invariants as the three bare
// ones: volt-second balance on the magnetising or output inductance, charge
// balance on the capacitor, the segments joining, one more period returning
// the same state, and the books closing to floating point.
//
// The claim each is about is its ratio. M = n·D/(1−D) for the flyback and
// M = n·D for the half-bridge, both from volt-second balance and both quoted
// against a solved waveform that never saw the formula.

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const logU = (r, lo, hi) => lo * (hi / lo) ** r()

describe('the flyback', () => {
  const p = { Vin: 24, D: 0.5, n: 0.5, L: 100e-6, C: 100e-6, R: 12, fs: 100e3 }
  const conv = flyback(p)
  const ss = steadyState(conv)
  const m = measures(ss)

  it('turns the buck-boost’s two intervals into a ratio with the turns in it', () => {
    expect(isolatedM('flyback', 0.5, 0.5)).toBeCloseTo(0.5, 15)
    expect(ss.mode).toBe('CCM')
    expect(m.M).toBeCloseTo(0.5, 3)
    expect(m.sig.vout.avg).toBeCloseTo(12, 1)
    // The ratio is n·D/(1−D) and nothing else, while conduction stays
    // continuous: L, C and R are absent from it.
    for (const L of [220e-6, 470e-6]) {
      const q = measures(steadyState(flyback({ ...p, L })))
      expect(q.M).toBeCloseTo(0.5, 2)
    }
  })

  it('scales with the turns ratio and runs away with the duty, as the formula does', () => {
    for (const n of [0.25, 0.5, 1]) {
      for (const D of [0.3, 0.5, 0.6]) {
        // Half the load that would empty the core, so every point is in
        // continuous conduction and the CCM ratio is the one to compare.
        const R = (p.L * p.fs * n * n) / (1 - D) ** 2
        const q = measures(steadyState(flyback({ ...p, n, D, R })))
        expect(q.M, `n=${n} D=${D}`).toBeCloseTo(isolatedM('flyback', D, n), 1)
      }
    }
  })

  it('carries the magnetising current on the primary and the secondary’s on the diode', () => {
    // Ampere-turns: the secondary carries i_M/n while the diode conducts.
    expect(m.sig.iD.max).toBeCloseTo(m.sig.iL.max / p.n, 9)
    // Charge balance puts the diode's average at the load's.
    expect(m.sig.iD.avg).toBeCloseTo(m.sig.vout.avg / p.R, 6)
    expect(m.sig.iL.pp).toBeCloseTo((p.Vin * p.D) / (p.L * p.fs), 3)
  })

  it('makes the switch stand off the rail plus the output reflected back', () => {
    expect(conv.blocking(m.sig.vout.avg)).toBeCloseTo(p.Vin + m.sig.vout.avg / p.n, 9)
    expect(conv.blocking(m.sig.vout.avg)).toBeCloseTo(48, 1)
    expect(m.sig.vsw.max).toBeCloseTo(p.Vin + m.sig.vout.max / p.n, 3)
  })

  it('empties the core at light load, and the ratio leaves the duty behind', () => {
    const light = steadyState(flyback({ ...p, R: 400 }))
    expect(light.mode).toBe('DCM')
    const q = measures(light)
    expect(q.M).toBeGreaterThan(isolatedM('flyback', p.D, p.n))
    expect(q.sig.iL.min).toBeCloseTo(0, 6)
  })
})

describe('the half-bridge', () => {
  const p = { Vin: 48, D: 5 / 12, n: 0.25, L: 100e-6, C: 100e-6, R: 5, fs: 100e3 }
  const conv = halfBridge(p)
  const ss = steadyState(conv)
  const m = measures(ss)

  it('gears the rail down by the turns and the duty: M = n·D', () => {
    expect(m.M).toBeCloseTo(isolatedM('halfbridge', p.D, p.n), 9)
    expect(m.M).toBeCloseTo(0.104167, 6)
    expect(m.sig.vout.avg).toBeCloseTo(5, 6)
    for (const D of [0.1, 0.25, 0.45]) {
      const q = measures(steadyState(halfBridge({ ...p, D })))
      expect(q.M, `D=${D}`).toBeCloseTo(p.n * D, 6)
    }
  })

  it('solves over a half switching period, so the output ripples at 2 f_s', () => {
    expect(conv.T).toBeCloseTo(1 / (2 * p.fs), 15)
    expect(conv.switching.fs).toBe(p.fs)
    expect(conv.p.D).toBeCloseTo(2 * p.D, 12)
    // Two ripple cycles in one switching period.
    const wf = waveforms(ss, { periods: 2, n: 240 })
    expect(wf.t[wf.t.length - 1]).toBeCloseTo(1 / p.fs, 12)
    const ripple = wf.sig.vout
    let turns = 0
    for (let i = 2; i < ripple.length; i++) {
      const a = ripple[i - 1] - ripple[i - 2]
      const b = ripple[i] - ripple[i - 1]
      if (a > 0 !== b > 0 && Math.abs(b) > 1e-12) turns++
    }
    expect(turns).toBeGreaterThanOrEqual(3)
  })

  it('halves the ripple a given filter has to carry, because the pulse rate is doubled', () => {
    const dI = m.sig.iL.pp
    // The buck's own form, at the doubled rate the filter actually sees.
    expect(m.sig.vout.pp).toBeCloseTo(dI / (8 * (2 * p.fs) * p.C), 5)
    expect(m.sig.vout.pp * 1e6).toBeCloseTo(260, 0)
    // A filter fed at f_s instead would carry twice the output ripple.
    expect(dI / (8 * p.fs * p.C) / m.sig.vout.pp).toBeCloseTo(2, 3)
  })

  it('costs each switch the rail and no more, against the flyback’s rail plus reflection', () => {
    expect(conv.blocking()).toBeCloseTo(48, 12)
    const fly = flyback({ Vin: 24, D: 0.5, n: 0.5, L: 100e-6, C: 100e-6, R: 12, fs: 100e3 })
    const fm = measures(steadyState(fly))
    expect(fly.blocking(fm.sig.vout.avg) / 24).toBeCloseTo(2, 1)
  })

  it('draws the rail current the output power needs, with nothing stored in the core', () => {
    expect(m.Pin).toBeCloseTo(m.Pout, 9)
    expect(m.Pin).toBeCloseTo(5, 6)
    // The primary carries n·i_L while a switch is on.
    expect(m.sig.iQ.max).toBeCloseTo(p.n * m.sig.iL.max, 9)
  })
})

describe('the invariants, across both isolated converters', () => {
  const cases = []
  const r = rng(4212)
  for (const kind of ISOLATED_KINDS) {
    for (let i = 0; i < 120; i++) {
      cases.push([
        `${kind} #${i}`,
        kind,
        {
          Vin: logU(r, 6, 48),
          D: kind === 'halfbridge' ? 0.02 + 0.46 * r() : 0.05 + 0.85 * r(),
          n: logU(r, kind === 'halfbridge' ? 0.3 : 0.1, 2),
          L: logU(r, 10e-6, 1e-3),
          C: logU(r, 10e-6, 2.2e-3),
          R: logU(r, 1, 500),
          fs: logU(r, 30e3, 500e3),
          Ron: r() < 0.5 ? logU(r, 1e-3, 0.2) : 0,
          Vf: r() < 0.5 ? 0.2 + 0.6 * r() : 0,
          rd: r() < 0.5 ? logU(r, 1e-3, 0.1) : 0,
          RL: r() < 0.5 ? logU(r, 1e-3, 0.2) : 0,
          ESR: r() < 0.5 ? logU(r, 1e-3, 0.5) : 0,
        },
      ])
    }
  }
  let dcm = 0
  it.each(cases)('%s', (_, kind, p) => {
    const conv = isolated(kind, p)
    // A half-bridge whose secondary pulse is smaller than its rectifier's
    // drop has no operating point at all, and says so rather than solving.
    if (conv.deliverable === false) {
      expect(conv.headroom).toBeLessThanOrEqual(0)
      return
    }
    const ss = steadyState(conv)
    const m = measures(ss)
    const live = ss.segments.filter((s) => s.T > 0)
    const Is = Math.max(1e-9, ...live.flatMap((s) => [Math.abs(s.x0[0]), Math.abs(endState(s)[0])]))
    const Vs = Math.max(p.Vin, ...live.flatMap((s) => [Math.abs(s.x0[1]), Math.abs(endState(s)[1])]))
    if (ss.mode === 'DCM') dcm++
    // 1 and 2.
    expect(Math.abs(average(ss, 'vL'))).toBeLessThan(1e-9 * Vs)
    expect(Math.abs(average(ss, 'iC'))).toBeLessThan(1e-9 * Is)
    // 4.
    for (let k = 1; k < live.length; k++) {
      const xe = endState(live[k - 1])
      expect(Math.abs(live[k].x0[0] - xe[0])).toBeLessThan(1e-9 * Is)
      expect(Math.abs(live[k].x0[1] - xe[1])).toBeLessThan(1e-9 * Vs)
    }
    // 6.
    const xT = periodMap(ss)
    expect(Math.abs(xT[0] - ss.x0[0])).toBeLessThan(1e-9 * Is)
    expect(Math.abs(xT[1] - ss.x0[1])).toBeLessThan(1e-9 * Vs)
    // 3: the ledger closes.
    const led = lossLedger(m)
    expect(Math.abs(led.residual)).toBeLessThan(1e-9 * Math.max(m.Pin, m.Pout, 1e-12))
    expect(m.eta).toBeGreaterThan(0)
    expect(m.eta).toBeLessThanOrEqual(1 + 1e-9)
    for (const s of Object.values(m.sig)) for (const v of Object.values(s)) expect(Number.isFinite(v)).toBe(true)
    // The mode agrees with the diode.
    const off = ss.segments[1]
    if (ss.mode === 'CCM') expect(firstDownCrossing(off, 0)).toBeNull()
    else expect(ss.x0[0]).toBe(0)
  })
  it('visited both conduction modes', () => {
    expect(dcm).toBeGreaterThan(20)
    expect(dcm).toBeLessThan(cases.length - 20)
  })
})

describe('the walk from rest agrees with the solver', () => {
  const cases = [
    ['flyback', { Vin: 24, D: 0.5, n: 0.5, L: 100e-6, C: 100e-6, R: 12, fs: 100e3 }],
    ['flyback light', { Vin: 24, D: 0.5, n: 0.5, L: 100e-6, C: 100e-6, R: 400, fs: 100e3 }],
    ['halfbridge', { Vin: 48, D: 5 / 12, n: 0.25, L: 100e-6, C: 100e-6, R: 5, fs: 100e3 }],
    ['halfbridge light', { Vin: 48, D: 5 / 12, n: 0.25, L: 100e-6, C: 100e-6, R: 400, fs: 100e3 }],
  ]
  it.each(cases)('%s', (name, p) => {
    const conv = isolated(name.startsWith('flyback') ? 'flyback' : 'halfbridge', p)
    const ss = steadyState(conv)
    const r = runPeriods(conv, [0, 0], { periods: 200000, settle: 1e-13 })
    expect(r.periods).toBeLessThan(200000)
    expect(Math.abs(r.x[0] - ss.x0[0]) / Math.max(1e-9, r.scale[0])).toBeLessThan(1e-8)
    expect(Math.abs(r.x[1] - ss.x0[1]) / Math.max(1e-9, r.scale[1])).toBeLessThan(1e-8)
    expect(r.mode).toBe(ss.mode)
  })
})

describe('the half-bridge’s own boundary', () => {
  it('declines a secondary pulse the rectifier would swallow, rather than solving past it', () => {
    const ok = halfBridge({ Vin: 48, n: 0.25, Vf: 0.7 })
    expect(ok.deliverable).toBe(true)
    expect(ok.headroom).toBeCloseTo((0.25 * 48) / 2 - 0.7, 12)
    const starved = halfBridge({ Vin: 9.4, n: 0.14, Vf: 0.78 })
    expect(starved.deliverable).toBe(false)
    expect(starved.headroom).toBeLessThan(0)
  })
})

describe('the shapes the app leans on', () => {
  it('names both kinds and refuses anything else', () => {
    expect(ISOLATED_KINDS).toEqual(['flyback', 'halfbridge'])
    expect(() => isolated('forward', {})).toThrow(/unknown isolated converter/)
  })
  it('carries every signal the panes ask for, in every state', () => {
    for (const kind of ISOLATED_KINDS) {
      const conv = isolated(kind, {})
      for (const [name, state] of Object.entries(conv.states)) {
        for (const s of ['iL', 'vC', 'vout', 'vsw', 'vL', 'iC', 'iQ', 'iD', 'iin']) {
          expect(state.signals[s], `${kind}.${name}.${s}`).toBeTruthy()
        }
      }
    }
  })
})
