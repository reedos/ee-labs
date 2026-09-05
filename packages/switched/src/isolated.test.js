import { describe, it, expect } from 'vitest'
import {
  flyback,
  halfBridge,
  forward,
  pushPull,
  fullBridge,
  forwardReset,
  fluxWalk,
  isolatedStress,
  ISOLATED_FAMILY,
  isolated,
  isolatedM,
  ISOLATED_KINDS,
} from './isolated.js'
import { steadyState, measures, average, periodMap, waveforms } from './steady.js'
import { endState, firstDownCrossing } from './segment.js'
import { propagator } from './propagator.js'
import { matVec, vecAdd } from './linalg.js'
import { clockedSteadyState } from './clocked.js'
import { runPeriods } from './transient.js'
import { lossLedger } from './ledger.js'

// The five isolated converters, held to the same invariants as the three bare
// ones: volt-second balance on the magnetising or output inductance, charge
// balance on the capacitor, the segments joining, one more period returning
// the same state, and the books closing to floating point.
//
// The claim each is about is its ratio. M = n·D/(1−D) for the flyback,
// M = n·D for the forward and the half-bridge, M = 2·n·D for the push-pull
// and the full bridge, every one of them from volt-second balance and every
// one quoted against a solved waveform that never saw the formula.

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
          // Every converter but the flyback puts a pulse on an output
          // inductor, and each of those has its own ceiling on the duty: half
          // the period for the three that share the core between two
          // switches, and the reset winding's share for the forward.
          D: kind === 'flyback' ? 0.05 + 0.85 * r() : 0.02 + 0.44 * r(),
          n: logU(r, kind === 'flyback' ? 0.1 : 0.3, 2),
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
  it('names every kind and refuses anything else', () => {
    expect(ISOLATED_KINDS).toEqual(['flyback', 'halfbridge', 'forward', 'pushpull', 'fullbridge'])
    expect(() => isolated('cuk', {})).toThrow(/unknown isolated converter/)
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

// ------------------------------------------------- the half-bridge's siblings

describe('the forward converter', () => {
  const p = { Vin: 48, D: 0.4, n: 0.25, nr: 1, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Lm: 2e-3 }
  const conv = forward(p)
  const ss = steadyState(conv)
  const m = measures(ss)
  const reset = forwardReset(conv, { IL: m.Iout })

  it('is a buck fed from n·V_in, so M = n·D and the pulse runs once a period', () => {
    expect(isolatedM('forward', p.D, p.n)).toBeCloseTo(0.1, 15)
    expect(conv.T).toBeCloseTo(1 / p.fs, 15)
    expect(conv.p.D).toBeCloseTo(p.D, 15)
    expect(m.M).toBeCloseTo(0.1, 6)
    expect(m.sig.vout.avg).toBeCloseTo(4.8, 6)
    for (const D of [0.1, 0.25, 0.45]) {
      expect(measures(steadyState(forward({ ...p, D }))).M, `D=${D}`).toBeCloseTo(p.n * D, 6)
    }
  })

  it('gives the reset winding N_p/N_r as long again to take the volt-seconds back', () => {
    // The branch's own balance: what the rail put in comes back out.
    expect(reset.vsOn + reset.vsReset).toBeCloseTo(0, 12)
    expect(reset.tReset).toBeCloseTo((p.D * p.nr) / p.fs, 12)
    expect(reset.tOn + reset.tReset + reset.tIdle).toBeCloseTo(conv.T, 12)
    expect(reset.ipk).toBeCloseTo((p.Vin * p.D) / (p.Lm * p.fs), 12)
    // Halve the reset winding and it stands at twice the voltage, so the
    // reset takes half as long and the duty may run further.
    const fast = forward({ ...p, nr: 0.5 })
    expect(forwardReset(fast, { IL: m.Iout }).tReset).toBeCloseTo(reset.tReset / 2, 12)
    expect(fast.Dmax).toBeCloseTo(2 / 3, 12)
  })

  it('charges the switch the rail plus the reset winding’s reflection', () => {
    expect(conv.blocking()).toBeCloseTo(2 * p.Vin, 12)
    expect(forward({ ...p, nr: 0.5 }).blocking()).toBeCloseTo(3 * p.Vin, 12)
    expect(reset.blocking).toBeCloseTo(conv.blocking(), 12)
  })

  it('says when the duty is too long for the core to reset', () => {
    expect(conv.resets).toBe(true)
    expect(conv.Dmax).toBeCloseTo(0.5, 12)
    const over = forward({ ...p, D: 0.6 })
    expect(over.resets).toBe(false)
    expect(forwardReset(over, { IL: 1 }).resets).toBe(false)
  })
})

describe('push-pull and full bridge', () => {
  const p = { Vin: 24, D: 0.4, n: 0.5, L: 100e-6, C: 100e-6, R: 5, fs: 100e3 }

  it('both swing the primary twice a period, so M = 2·n·D', () => {
    for (const kind of ['pushpull', 'fullbridge']) {
      const conv = isolated(kind, p)
      const m = measures(steadyState(conv))
      expect(isolatedM(kind, p.D, p.n), kind).toBeCloseTo(0.4, 15)
      expect(m.M, kind).toBeCloseTo(0.4, 6)
      expect(m.sig.vout.avg, kind).toBeCloseTo(9.6, 5)
      expect(conv.T, kind).toBeCloseTo(1 / (2 * p.fs), 15)
    }
  })

  it('differ only in what the switches pay: 2·V_in on two of them, or V_in on four', () => {
    expect(pushPull(p).blocking()).toBeCloseTo(2 * p.Vin, 12)
    expect(fullBridge(p).blocking()).toBeCloseTo(p.Vin, 12)
    expect(pushPull(p).switches).toBe(1)
    expect(fullBridge(p).switches).toBe(2)
  })

  it('charges the full bridge twice the conduction loss, because two switches carry the primary', () => {
    const Ron = 0.05
    const pp = measures(steadyState(pushPull({ ...p, Ron })))
    const fb = measures(steadyState(fullBridge({ ...p, Ron })))
    // Two switches in the path, each carrying the whole primary current.
    expect(fb.loss.switch).toBeCloseTo(2 * Ron * fb.sig.iQ.rms ** 2, 12)
    expect(pp.loss.switch).toBeCloseTo(Ron * pp.sig.iQ.rms ** 2, 12)
    // The ratio is a little under two, because the second drop takes a little
    // of the output with it and the current falls with it.
    expect(fb.loss.switch / pp.loss.switch).toBeGreaterThan(1.98)
    expect(fb.loss.switch / pp.loss.switch).toBeLessThan(2)
    // And the ledger still closes on both.
    for (const m of [pp, fb]) expect(Math.abs(lossLedger(m).residual)).toBeLessThan(1e-9 * m.Pin)
  })

  it('puts the same total volt-amps on the switches whichever way they are arranged', () => {
    const a = isolatedStress('pushpull', { Vin: 24, n: 0.5, D: 0.4 })
    const b = isolatedStress('fullbridge', { Vin: 24, n: 0.5, D: 0.4 })
    expect(a.switchVA).toBe(4)
    expect(b.switchVA).toBe(4)
    expect(a.blocking).toBeCloseTo(48, 12)
    expect(b.blocking).toBeCloseTo(24, 12)
    expect(a.M).toBeCloseTo(b.M, 15)
    const f = isolatedStress('forward', { Vin: 24, n: 0.5, D: 0.4 })
    expect(f.switchVA).toBe(2)
    expect(f.M).toBeCloseTo(0.2, 15)
    expect(Object.keys(ISOLATED_FAMILY)).toEqual(['forward', 'halfbridge', 'pushpull', 'fullbridge'])
  })
})

describe('the push-pull’s flux walk', () => {
  const p = { Vin: 24, D: 0.4, n: 0.5, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Lm: 2e-3, Ron: 0.05 }

  it('walks by the volt-second remainder the mismatch leaves, every cycle', () => {
    const w = fluxWalk({ ...p, Ron2: 0.06 })
    expect(w.perCycle / w.driftForm).toBeCloseTo(1, 3)
    expect(w.perCycle).toBeGreaterThan(0)
    // The first hundred periods are nearly a straight line: the drift barely
    // changes while the offset is far from where it settles.
    const step = w.trace[100].iM - w.trace[99].iM
    expect(step / w.perCycle).toBeGreaterThan(0.9)
  })

  it('settles where the same asymmetry balances it, and the algebra agrees', () => {
    const w = fluxWalk({ ...p, Ron2: 0.06 }, { periods: 8000 })
    expect(w.settles).toBe(true)
    expect(w.offsetSolved / w.offsetForm).toBeCloseTo(1, 4)
    // The walk arrives there rather than being told. The approach is the
    // L_m/R the two switches make between them, over the share of the period
    // they conduct for, which is about 4 500 periods here.
    expect(w.trace[8000].iM / w.offsetSolved).toBeGreaterThan(0.8)
    expect(w.trace[1000].iM / w.offsetSolved).toBeLessThan(0.3)
    // The offset is (R_B − R_A)·n·I_out/(R_A + R_B): twice the mismatch on a
    // slightly larger sum moves it by the ratio of the two.
    const wider = fluxWalk({ ...p, Ron2: 0.07 })
    // The load current moves a little with the extra resistance, so the two
    // ratios agree to a part in a few thousand rather than exactly.
    expect(wider.offsetForm / w.offsetForm).toBeCloseTo(0.02 / 0.12 / (0.01 / 0.11), 3)
  })

  it('does not walk at all when the two halves match', () => {
    const w = fluxWalk({ ...p, Ron2: p.Ron })
    expect(Math.abs(w.perCycle)).toBeLessThan(1e-15 * w.Iout)
    expect(Math.abs(w.offsetSolved)).toBeLessThan(1e-15 * w.Iout)
    expect(w.settles).toBe(true)
  })

  it('declines to name a resting place when there is no resistance to make one', () => {
    const w = fluxWalk({ ...p, Ron: 0, Ron2: 0 })
    expect(w.balanced).toBe(true)
    expect(w.settles).toBe(false)
    expect(w.offsetSolved).toBe(Infinity)
  })

  it('moves the flux and not the output: the ratio stays the balanced one', () => {
    const w = fluxWalk({ ...p, Ron2: 0.06 })
    const mid = measures(steadyState(pushPull({ ...p, Ron: 0.055 })))
    expect(w.Mbalanced).toBeCloseTo(mid.M, 12)
    // The asymmetric solve's own output average, against the balanced one.
    const fixed = clockedSteadyState(w.plan, 3)
    let vs = 0
    for (const seg of fixed.segments) {
      const { phi1, phi2 } = propagator(seg.A, seg.T)
      const ix = vecAdd(matVec(phi1, seg.x0), matVec(phi2, seg.f))
      vs += ix[1]
    }
    expect(vs / w.T / p.Vin / w.Mbalanced).toBeCloseTo(1, 4)
  })
})

describe('the walk from rest, across the siblings', () => {
  const cases = [
    ['forward', { Vin: 48, D: 0.4, n: 0.25, L: 100e-6, C: 100e-6, R: 5, fs: 100e3 }],
    ['forward light', { Vin: 48, D: 0.4, n: 0.25, L: 100e-6, C: 100e-6, R: 400, fs: 100e3 }],
    ['pushpull', { Vin: 24, D: 0.4, n: 0.5, L: 100e-6, C: 100e-6, R: 5, fs: 100e3 }],
    ['fullbridge', { Vin: 24, D: 0.4, n: 0.5, L: 100e-6, C: 100e-6, R: 5, fs: 100e3 }],
    ['fullbridge light', { Vin: 24, D: 0.4, n: 0.5, L: 100e-6, C: 100e-6, R: 600, fs: 100e3 }],
  ]
  it.each(cases)('%s', (name, p) => {
    const conv = isolated(name.split(' ')[0], p)
    const ss = steadyState(conv)
    const r = runPeriods(conv, [0, 0], { periods: 200000, settle: 1e-13 })
    expect(r.periods).toBeLessThan(200000)
    expect(Math.abs(r.x[0] - ss.x0[0]) / Math.max(1e-9, r.scale[0])).toBeLessThan(1e-8)
    expect(Math.abs(r.x[1] - ss.x0[1]) / Math.max(1e-9, r.scale[1])).toBeLessThan(1e-8)
    expect(r.mode).toBe(ss.mode)
  })
})
