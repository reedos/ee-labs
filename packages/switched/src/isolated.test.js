import { describe, it, expect } from 'vitest'
import {
  flyback,
  halfBridge,
  isolated,
  isolatedM,
  ISOLATED_KINDS,
  forward,
  pushPull,
  fullBridge,
  pushPullFamily,
  forwardFamily,
  forwardM,
  forwardMeasures,
  windowedSteadyState,
  walkWindows,
  fluxWalk,
  FORWARD_KINDS,
} from './isolated.js'
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

// ------------------------------------------------- the forward family
//
// The half-bridge's three siblings, held to the same invariants and to the
// three claims that separate them: the ratio, the voltage a switch stands
// off, and what the magnetising current does. Every number here comes off a
// solved waveform, and the formulas it is compared against are written down
// in the module rather than measured out of it.

describe('the forward converter', () => {
  const p = { Vin: 48, D: 0.4, n: 0.25, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Lm: 1e-3 }
  const conv = forward(p)
  const ss = windowedSteadyState(conv)
  const m = forwardMeasures(ss)

  it('is a buck through a transformer: M = n·D', () => {
    expect(forwardM('forward', 0.4, 0.25)).toBeCloseTo(0.1, 15)
    expect(ss.mode).toBe('CCM')
    expect(m.M).toBeCloseTo(0.1, 6)
    expect(m.sig.vout.avg).toBeCloseTo(4.8, 5)
    for (const D of [0.15, 0.3, 0.45]) {
      const q = forwardMeasures(windowedSteadyState(forward({ ...p, D })))
      expect(q.M, `D=${D}`).toBeCloseTo(0.25 * D, 6)
    }
  })

  it('resets the core in n_r·D·T, which is why the duty stops at one half', () => {
    const reset = ss.segments.find((s) => s.name === 'reset')
    expect(reset.T).toBeCloseTo(p.D / p.fs, 12)
    expect(conv.resetTime).toBeCloseTo(p.D / p.fs, 15)
    expect(conv.maxDuty).toBeCloseTo(0.5, 15)
    expect(conv.resets).toBe(true)
    expect(forward({ ...p, D: 0.55 }).resets).toBe(false)
    // A reset winding with fewer turns resets faster and lifts the ceiling,
    // at the price of a higher voltage on the switch.
    const fast = forward({ ...p, nr: 0.5 })
    expect(fast.maxDuty).toBeCloseTo(2 / 3, 12)
    const rf = windowedSteadyState(fast).segments.find((s) => s.name === 'reset')
    expect(rf.T).toBeCloseTo((0.5 * p.D) / p.fs, 12)
    expect(fast.blocking()).toBeCloseTo(3 * p.Vin, 9)
  })

  it('carries a magnetising current that starts and ends each period at zero', () => {
    expect(ss.x0[2]).toBeCloseTo(0, 12)
    expect(m.sig.iM.min).toBeCloseTo(0, 9)
    // It ramps at V_in/L_m for the on interval and back down at V_in/n_r·L_m.
    expect(m.sig.iM.max).toBeCloseTo((p.Vin * p.D) / (p.Lm * p.fs), 6)
    // Its mean is the triangle's, over the share of the period it lasts.
    expect(m.sig.iM.avg).toBeCloseTo((m.sig.iM.max / 2) * 2 * p.D, 6)
  })

  it('makes the switch stand off the rail twice over, with a reset winding of equal turns', () => {
    expect(conv.blocking()).toBeCloseTo(2 * p.Vin, 12)
    expect(conv.stress).toBeCloseTo(96, 12)
  })

  it('returns the magnetising energy to the source rather than losing it', () => {
    // The rail takes current back during the reset, so i_in goes negative.
    expect(m.sig.iin.min).toBeLessThan(0)
    expect(m.sig.iin.min).toBeCloseTo(-m.sig.iM.max / conv.p.nr, 6)
    // And the books still close: P_in is P_out with no loss anywhere.
    expect(m.Pin).toBeCloseTo(m.Pout, 9)
  })
})

describe('the push-pull and the full bridge', () => {
  const p = { Vin: 48, D: 0.4, n: 0.125, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Lm: 1e-3 }

  it('swings the primary both ways, so M = 2·n·D', () => {
    for (const kind of ['pushpull', 'fullbridge']) {
      const conv = pushPullFamily(kind, p)
      const m = forwardMeasures(windowedSteadyState(conv))
      expect(m.M, kind).toBeCloseTo(2 * p.n * p.D, 6)
      expect(m.sig.vout.avg, kind).toBeCloseTo(4.8, 5)
      for (const D of [0.15, 0.3, 0.45]) {
        const q = forwardMeasures(windowedSteadyState(pushPullFamily(kind, { ...p, D })))
        expect(q.M, `${kind} D=${D}`).toBeCloseTo(2 * p.n * D, 6)
      }
    }
  })

  it('feeds the filter twice a period, so the ripple runs at 2·f_s', () => {
    const conv = pushPull(p)
    const ss = windowedSteadyState(conv)
    const m = forwardMeasures(ss)
    const wf = waveforms(ss, { periods: 1, n: 400 })
    let turns = 0
    for (let i = 2; i < wf.sig.vout.length; i++) {
      const a = wf.sig.vout[i - 1] - wf.sig.vout[i - 2]
      const b = wf.sig.vout[i] - wf.sig.vout[i - 1]
      if (a > 0 !== b > 0 && Math.abs(b) > 1e-12) turns++
    }
    expect(turns).toBeGreaterThanOrEqual(3)
    // The buck's own ripple form, at the doubled rate the filter sees.
    expect(m.sig.vout.pp).toBeCloseTo(m.sig.iL.pp / (8 * 2 * p.fs * p.C), 5)
  })

  it('costs the push-pull switch twice the rail and the bridge switch once', () => {
    expect(pushPull(p).blocking()).toBeCloseTo(2 * p.Vin, 12)
    expect(fullBridge(p).blocking()).toBeCloseTo(p.Vin, 12)
    // The bridge pays for it in conduction: two switches in series each half.
    const lossy = { ...p, Ron: 0.1 }
    const pp = forwardMeasures(windowedSteadyState(pushPull(lossy)))
    const fb = forwardMeasures(windowedSteadyState(fullBridge(lossy)))
    expect(fb.loss.switch / pp.loss.switch).toBeCloseTo(2, 1)
  })

  it('keeps the magnetising current centred on zero while the two halves match', () => {
    const m = forwardMeasures(windowedSteadyState(pushPull({ ...p, Ron: 0.05 })))
    expect(Math.abs(m.sig.iM.avg)).toBeLessThan(1e-9 * m.sig.iM.pp)
    expect(m.sig.iM.max).toBeCloseTo(-m.sig.iM.min, 6)
    expect(m.sig.iM.pp).toBeCloseTo((p.Vin * p.D) / (p.Lm * p.fs), 2)
  })

  it('walks the flux to the offset the two resistances leave it at', () => {
    for (const mismatch of [0.1, 0.2, 0.5, 2]) {
      const conv = pushPull({ ...p, Ron: 0.05, mismatch })
      const m = forwardMeasures(windowedSteadyState(conv))
      const pred = fluxWalk({ n: p.n, Iout: m.Iout, Ron1: conv.Ron1, Ron2: conv.Ron2 })
      expect(m.sig.iM.avg, `mismatch ${mismatch}`).toBeCloseTo(pred, 4)
      expect(m.sig.iM.avg).toBeGreaterThan(0)
      // However bad the mismatch, the offset stays under n·I_out.
      expect(Math.abs(m.sig.iM.avg)).toBeLessThan(p.n * m.Iout)
    }
    // The offset grows with the mismatch and vanishes without it.
    const at = (mm) => forwardMeasures(windowedSteadyState(pushPull({ ...p, Ron: 0.05, mismatch: mm }))).sig.iM.avg
    expect(at(0.4)).toBeGreaterThan(at(0.2))
    expect(Math.abs(at(0))).toBeLessThan(1e-9)
  })

  it('has no fixed point for the flux at all with no resistance in the primary', () => {
    // Ideal switches put equal volt-seconds on the core whatever offset it
    // carries, so every offset is periodic and the circuit prefers none. The
    // solver says so rather than dividing by nothing.
    const conv = pushPull(p)
    expect(conv.driftFree).toBe(true)
    expect(conv.pinned).toEqual([2])
    expect(fluxWalk({ n: p.n, Iout: 1, Ron1: 0, Ron2: 0 })).toBe(0)
    // What it holds instead is the core with no DC flux in it.
    const m = forwardMeasures(windowedSteadyState(conv))
    expect(Math.abs(m.sig.iM.avg)).toBeLessThan(1e-9 * m.sig.iM.pp)
    expect(pushPull({ ...p, Ron: 0.05 }).driftFree).toBe(false)
  })
})

describe('the three compared on one table', () => {
  // J3's table, measured rather than quoted: the same rail, the same load,
  // the same turns, and the three differ in exactly the places the theory
  // says they do.
  const base = { Vin: 48, D: 0.4, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Lm: 1e-3, Ron: 0.05 }
  const rows = ['forward', 'pushpull', 'fullbridge'].map((kind) => {
    const n = kind === 'forward' ? 0.25 : 0.125
    const conv = forwardFamily(kind, { ...base, n })
    const m = forwardMeasures(windowedSteadyState(conv))
    return { kind, conv, m, n }
  })
  it('delivers the same output from the same rail', () => {
    for (const r of rows) expect(r.m.sig.vout.avg, r.kind).toBeCloseTo(4.8, 2)
  })
  it('separates them on stress, and only on stress among the pair', () => {
    const [fwd, pp, fb] = rows
    expect(fwd.conv.blocking()).toBeCloseTo(96, 9)
    expect(pp.conv.blocking()).toBeCloseTo(96, 9)
    expect(fb.conv.blocking()).toBeCloseTo(48, 9)
    // The forward's transformer is used one way round, so its output pulse
    // arrives once a period where the other two arrive twice.
    expect(fwd.m.sig.iL.pp / pp.m.sig.iL.pp).toBeGreaterThan(1.5)
  })
})

describe('the forward family’s invariants, fuzzed', () => {
  const cases = []
  const r = rng(51037)
  for (const kind of ['forward', 'pushpull', 'fullbridge']) {
    for (let i = 0; i < 80; i++) {
      const Ron = r() < 0.5 ? logU(r, 1e-3, 0.2) : 0
      cases.push([
        `${kind} #${i}`,
        kind,
        {
          Vin: logU(r, 12, 400),
          // Both families stop at one half: the forward needs the room to
          // reset and the other two would put both switches on at once.
          D: 0.03 + 0.44 * r(),
          n: logU(r, 0.05, 1.5),
          L: logU(r, 10e-6, 1e-3),
          C: logU(r, 10e-6, 2.2e-3),
          R: logU(r, 1, 500),
          fs: logU(r, 30e3, 500e3),
          Lm: logU(r, 100e-6, 10e-3),
          Ron,
          mismatch: Ron > 0 && r() < 0.5 ? 2 * r() : 0,
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
    const conv = forwardFamily(kind, p)
    const ss = windowedSteadyState(conv)
    expect(ss.converged, 'the shooting method converged').toBe(true)
    const m = forwardMeasures(ss)
    const live = ss.segments.filter((s) => s.T > 0)
    const Is = Math.max(1e-9, Math.abs(m.sig.iL.max), Math.abs(m.sig.iL.min), Math.abs(m.sig.iM.max))
    const Vs = Math.max(p.Vin, Math.abs(m.sig.vC.max))
    if (ss.mode === 'DCM') dcm++
    // 1 and 2: volt-second balance on the output inductor, charge balance on
    // the capacitor.
    expect(Math.abs(average(ss, 'vL'))).toBeLessThan(1e-8 * Vs)
    expect(Math.abs(m.sig.iC.avg)).toBeLessThan(1e-8 * Is)
    // And on the magnetising inductance, which is this family's own: the
    // core ends the period with the flux it started with.
    expect(Math.abs(m.sig.iM.max - m.sig.iM.min)).toBeLessThan(4 * ((p.Vin * p.D) / (p.Lm * p.fs)) + 1e-9)
    // 4: the segments join.
    for (let k = 1; k < live.length; k++) {
      const xe = endState(live[k - 1])
      for (let i = 0; i < 3; i++) {
        const scale = i === 1 ? Vs : Is
        expect(Math.abs(live[k].x0[i] - xe[i]), `segment ${k} component ${i}`).toBeLessThan(1e-8 * scale)
      }
    }
    // 6: one more period returns the same state.
    const xT = walkWindows(conv, ss.x0).xEnd
    for (let i = 0; i < 3; i++) {
      const scale = i === 1 ? Vs : Is
      expect(Math.abs(xT[i] - ss.x0[i]), `period map component ${i}`).toBeLessThan(1e-8 * scale)
    }
    // 3: the ledger closes.
    const led = lossLedger(m)
    expect(Math.abs(led.residual)).toBeLessThan(1e-8 * Math.max(m.Pin, m.Pout, 1e-12))
    expect(m.eta).toBeGreaterThan(0)
    expect(m.eta).toBeLessThanOrEqual(1 + 1e-8)
    for (const s of Object.values(m.sig)) for (const v of Object.values(s)) expect(Number.isFinite(v)).toBe(true)
    // The ratio, where conduction stays continuous and the parts are ideal.
    if (ss.mode === 'CCM' && !p.Ron && !p.Vf && !p.rd && !p.RL && !p.ESR) {
      expect(m.M).toBeCloseTo(forwardM(kind, p.D, p.n), 6)
    }
    // And the mode agrees with the current: a dead interval means the
    // inductor emptied.
    if (ss.mode === 'DCM') expect(m.sig.iL.min).toBeLessThan(1e-9 * Is)
    else expect(m.sig.iL.min).toBeGreaterThan(-1e-6 * Is - 1e-9)
  })
  it('visited both conduction modes', () => {
    expect(dcm).toBeGreaterThan(20)
    expect(dcm).toBeLessThan(cases.length - 20)
  })
})

describe('the forward family’s walk from rest agrees with the solver', () => {
  const cases = [
    ['forward', 'forward', { R: 5 }],
    ['forward light', 'forward', { R: 400 }],
    ['pushpull', 'pushpull', { R: 5, n: 0.125 }],
    ['pushpull mismatched', 'pushpull', { R: 5, n: 0.125, Ron: 0.05, mismatch: 0.4 }],
    ['fullbridge', 'fullbridge', { R: 5, n: 0.125 }],
    ['fullbridge light', 'fullbridge', { R: 400, n: 0.125 }],
  ]
  it.each(cases)('%s', (_, kind, over) => {
    const p = { Vin: 48, D: 0.4, n: 0.25, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Lm: 1e-3, ...over }
    const conv = forwardFamily(kind, p)
    const ss = windowedSteadyState(conv)
    const m = forwardMeasures(ss)
    // The walker knows nothing of the solver's answer.
    let x = new Array(conv.order).fill(0)
    for (let k = 0; k < 20000; k++) x = walkWindows(conv, x).xEnd
    const scale = [Math.max(1e-6, m.sig.iL.max), Math.max(1, m.sig.vC.avg), Math.max(1e-6, m.sig.iM.pp)]
    // The output side is the circuit's own, and the walk lands on it.
    for (let i = 0; i < 2; i++) {
      expect(Math.abs(x[i] - ss.x0[i]) / scale[i], `component ${i}`).toBeLessThan(1e-5)
    }
    if (!conv.driftFree) {
      expect(Math.abs(x[2] - ss.x0[2]) / scale[2], 'the magnetising current').toBeLessThan(1e-4)
      return
    }
    // With no resistance in the primary the magnetising offset is history,
    // and the two answers are allowed to differ by exactly that: the walk
    // started the core empty, the solver holds its period mean at zero, and
    // the gap between them is half the ripple.
    expect(x[2]).toBeCloseTo(0, 9)
    expect(ss.x0[2]).toBeCloseTo(-m.sig.iM.pp / 2, 6)
  })
})

describe('the shapes the app leans on', () => {
  it('names both kinds and refuses anything else', () => {
    expect(ISOLATED_KINDS).toEqual(['flyback', 'halfbridge'])
    expect(() => isolated('forward', {})).toThrow(/unknown isolated converter/)
    expect(FORWARD_KINDS).toEqual(['forward', 'pushpull', 'fullbridge'])
    expect(() => forwardFamily('halfbridge', {})).toThrow(/unknown forward converter/)
  })
  it('carries every signal the forward family’s panes ask for, in every state', () => {
    for (const kind of FORWARD_KINDS) {
      const conv = forwardFamily(kind, {})
      for (const [name, state] of Object.entries(conv.states)) {
        for (const s of conv.signals) expect(state.signals[s], `${kind}.${name}.${s}`).toBeTruthy()
      }
    }
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
