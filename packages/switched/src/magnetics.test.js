import { describe, it, expect } from 'vitest'
import { converter, KINDS } from './topologies.js'
import { steadyState, measures, periodMap, average, signalIntegral, stateAtPeriod } from './steady.js'
import { endState } from './segment.js'
import {
  CORE_DEFAULTS,
  coreArea,
  coreOf,
  fluxDensity,
  fluxSwing,
  saturatingConverter,
  saturationCurrent,
} from './magnetics.js'
import { saturatingSteadyState, saturatingWalk, saturationEvent } from './saturating.js'

// The magnetics model and the solver that carries it.
//
// Two claims hold this file up. The saturation current is B_sat·N·A_e/L, and
// the walk crosses at exactly that current — not near it, at it, because the
// crossing is a bisected root of the exact segment solution. And the walker
// is the same walker: with the knee out of reach it reproduces the
// two-interval solver's fixed point to the last bits, so the saturating path
// is not a second engine with its own answers.

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const logU = (r, lo, hi) => lo * (hi / lo) ** r()

describe('the core', () => {
  it('saturates at B_sat·N·A_e/L, which is where B reaches B_sat', () => {
    const spec = { L: 100e-6, ...CORE_DEFAULTS }
    const Isat = saturationCurrent(spec)
    expect(Isat).toBeCloseTo((0.3 * 40 * 40e-6) / 100e-6, 12)
    expect(Isat).toBeCloseTo(4.8, 12)
    expect(fluxDensity(spec, Isat)).toBeCloseTo(spec.Bsat, 12)
    expect(fluxDensity(spec, -Isat)).toBeCloseTo(-spec.Bsat, 12)
    // Below the knee, B is L·i/(N·A_e) and nothing else.
    expect(fluxDensity(spec, 1)).toBeCloseTo((100e-6 * 1) / coreArea(CORE_DEFAULTS), 12)
  })

  it('is continuous through the knee, and twenty times flatter past it', () => {
    const spec = { L: 100e-6, ...CORE_DEFAULTS }
    const Isat = saturationCurrent(spec)
    const h = 1e-6
    const below = (fluxDensity(spec, Isat) - fluxDensity(spec, Isat - h)) / h
    const above = (fluxDensity(spec, Isat + h) - fluxDensity(spec, Isat)) / h
    expect(fluxDensity(spec, Isat + h) - fluxDensity(spec, Isat - h)).toBeLessThan(2 * h * below)
    expect(below / above).toBeCloseTo(CORE_DEFAULTS.hard, 6)
  })

  it('reads a volt-second budget as a flux excursion, and refuses a core that is not one', () => {
    expect(fluxSwing(CORE_DEFAULTS, 29.1666e-6)).toBeCloseTo(29.1666e-6 / (40 * 40e-6), 12)
    // Ten times the volt-seconds is ten times the flux, which is D1's claim.
    expect(fluxSwing(CORE_DEFAULTS, 10 * 29.1666e-6) / fluxSwing(CORE_DEFAULTS, 29.1666e-6)).toBeCloseTo(10, 12)
    expect(() => coreOf({ N: 0 })).toThrow(/N/)
    expect(() => coreOf({ Bsat: -1 })).toThrow(/Bsat/)
    expect(() => coreOf({ hard: 0.5 })).toThrow(/hard/)
  })
})

describe('the saturating solver is the same solver', () => {
  it.each(KINDS)('%s: with the knee out of reach it lands on steadyState’s fixed point', (kind) => {
    const r = rng(kind.length * 77 + 5)
    for (let i = 0; i < 60; i++) {
      const p = {
        Vin: logU(r, 3, 48),
        D: 0.05 + 0.9 * r(),
        L: logU(r, 10e-6, 1e-3),
        C: logU(r, 10e-6, 1e-3),
        R: logU(r, 1, 500),
        fs: logU(r, 30e3, 500e3),
      }
      // A core far too large to saturate: the knee never enters the picture.
      const conv = saturatingConverter(kind, { ...p, N: 4000, Ae: 40e-6, Bsat: 1e6 })
      const plain = steadyState(converter(kind, p))
      const ss = saturatingSteadyState(conv)
      const scale = Math.max(1e-9, Math.abs(plain.x0[0]), 1)
      expect(ss.mode, `${kind} #${i} mode`).toBe(plain.mode)
      expect(Math.abs(ss.x0[0] - plain.x0[0]), `${kind} #${i} i_L`).toBeLessThan(1e-9 * scale)
      expect(Math.abs(ss.x0[1] - plain.x0[1]), `${kind} #${i} v_C`).toBeLessThan(1e-9 * Math.max(1, Math.abs(plain.x0[1])))
      expect(Math.abs(ss.td - plain.td), `${kind} #${i} t_d`).toBeLessThan(1e-9 * ss.T)
    }
  })

  it('leaves measures unchanged: the switch hands over the same current either way', () => {
    const p = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Ron: 0.05, tr: 20e-9, tf: 20e-9 }
    const plain = measures(steadyState(converter('buck', p)))
    const sat = measures(saturatingSteadyState(saturatingConverter('buck', { ...p, N: 4000, Bsat: 1e6 })))
    expect(sat.iTurnOff).toBeCloseTo(plain.iTurnOff, 9)
    expect(sat.loss.switching).toBeCloseTo(plain.loss.switching, 12)
  })
})

describe('the saturation event', () => {
  const p = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 1, fs: 100e3 }
  const conv = saturatingConverter('buck', p)
  const ss = saturatingSteadyState(conv)

  it('happens where B reaches B_sat, and the current there is B_sat·N·A_e/L', () => {
    expect(ss.mode).toBe('SAT')
    const ev = saturationEvent(ss)
    expect(ev, 'a crossing').toBeTruthy()
    expect(ev.i).toBeCloseTo(conv.Isat, 9)
    expect(ev.i).toBeCloseTo((conv.core.Bsat * conv.core.N * conv.core.Ae) / p.L, 9)
    expect(fluxDensity({ L: p.L, ...conv.core }, ev.i)).toBeCloseTo(conv.core.Bsat, 9)
    // And the state the walk hands to the saturated segment is that current.
    expect(stateAtPeriod(ss, ev.t)[0]).toBeCloseTo(conv.Isat, 9)
  })

  it('crosses on the way up and on the way down, so the period has four segments', () => {
    const names = ss.segments.filter((s) => s.T > 0).map((s) => s.name)
    expect(names).toEqual(['on', 'on·sat', 'off·sat', 'off'])
    const durations = ss.segments.filter((s) => s.T > 0).map((s) => s.T)
    expect(durations.reduce((a, b) => a + b, 0)).toBeCloseTo(ss.T, 15)
  })

  it('multiplies the ripple, because past the knee the inductance is what is left', () => {
    const linear = measures(steadyState(converter('buck', p)))
    const m = measures(ss)
    expect(m.sig.iL.pp / linear.sig.iL.pp).toBeGreaterThan(5)
    expect(m.sig.iL.max).toBeGreaterThan(conv.Isat)
    // The output is still the duty's, because volt-second balance has no L in it.
    expect(m.sig.vout.avg).toBeCloseTo(linear.sig.vout.avg, 6)
  })

  it('a lighter load stays under the knee and the period is the plain two', () => {
    const easy = saturatingSteadyState(saturatingConverter('buck', { ...p, R: 2 }))
    expect(easy.mode).toBe('CCM')
    expect(easy.segments.filter((s) => s.T > 0).map((s) => s.name)).toEqual(['on', 'off'])
    expect(measures(easy).sig.iL.max).toBeLessThan(saturatingConverter('buck', { ...p, R: 2 }).Isat)
  })
})

describe('the invariants hold through saturation', () => {
  const cases = []
  const r = rng(20260905)
  for (const kind of KINDS) {
    for (let i = 0; i < 40; i++) {
      cases.push([
        `${kind} #${i}`,
        kind,
        {
          Vin: logU(r, 6, 48),
          D: 0.1 + 0.8 * r(),
          L: logU(r, 10e-6, 470e-6),
          C: logU(r, 10e-6, 1e-3),
          R: logU(r, 0.5, 40),
          fs: logU(r, 50e3, 400e3),
          N: logU(r, 10, 200),
          Ae: logU(r, 10e-6, 200e-6),
          Bsat: 0.2 + 0.3 * r(),
          hard: 2 + 30 * r(),
        },
      ])
    }
  }
  it.each(cases)('%s', (_, kind, p) => {
    const conv = saturatingConverter(kind, p)
    const ss = saturatingSteadyState(conv)
    const live = ss.segments.filter((s) => s.T > 0)
    const Is = Math.max(1e-9, ...live.flatMap((s) => [Math.abs(s.x0[0]), Math.abs(endState(s)[0])]))
    const Vs = Math.max(p.Vin, ...live.flatMap((s) => [Math.abs(s.x0[1]), Math.abs(endState(s)[1])]))
    for (const v of [...ss.x0, ss.td]) expect(Number.isFinite(v)).toBe(true)
    // 1 and 2: volt-second balance on the inductor, charge balance on the cap.
    expect(Math.abs(average(ss, 'vL'))).toBeLessThan(1e-8 * Vs)
    expect(Math.abs(average(ss, 'iC'))).toBeLessThan(1e-8 * Is)
    // 4: the segments join.
    for (let k = 1; k < live.length; k++) {
      const xe = endState(live[k - 1])
      expect(Math.abs(live[k].x0[0] - xe[0])).toBeLessThan(1e-8 * Is)
      expect(Math.abs(live[k].x0[1] - xe[1])).toBeLessThan(1e-8 * Vs)
    }
    // 6: one more period returns the same state.
    const xT = periodMap(ss)
    expect(Math.abs(xT[0] - ss.x0[0])).toBeLessThan(1e-8 * Is)
    expect(Math.abs(xT[1] - ss.x0[1])).toBeLessThan(1e-8 * Vs)
    // 3: the books, with the losses that are integrals of this same waveform.
    const m = measures(ss)
    expect(Math.abs(m.balance)).toBeLessThan(1e-8 * Math.max(m.Pin, m.Pout))
    // The saturated states run at the collapsed inductance.
    expect(conv.Lsat * p.hard).toBeCloseTo(p.L, 15)
    expect(conv.states['on\u00b7sat'].f[0]).toBeCloseTo(conv.states.on.f[0] * p.hard, 6)
    // Every crossing between a linear segment and a saturated one happens at
    // the knee current, because that is the root the walk bisected for.
    for (let k = 1; k < live.length; k++) {
      const before = live[k - 1].name
      const after = live[k].name
      if (before === 'dead' || after === 'dead') continue
      if (before.endsWith('\u00b7sat') === after.endsWith('\u00b7sat')) continue
      expect(Math.abs(Math.abs(live[k].x0[0]) - conv.Isat), `crossing at segment ${k}`).toBeLessThan(1e-7 * conv.Isat)
    }
    // And the flux the current implies never runs away: past the knee the
    // model buys almost no flux for a lot of current.
    const spec = { L: p.L, ...conv.core }
    const Bpk = Math.abs(fluxDensity(spec, m.sig.iL.max))
    if (m.sig.iL.max > conv.Isat) expect(Bpk).toBeGreaterThanOrEqual(conv.core.Bsat - 1e-12)
    expect(Number.isFinite(Bpk)).toBe(true)
  })
})

describe('the walk from rest lands on the solver’s orbit', () => {
  // The Newton shooting could converge on a fixed point the circuit never
  // visits. Walking the same period map from an empty inductor and an empty
  // capacitor uses no seed and no Jacobian, so it is the check that can see
  // that, and it is the plan's §11.1.1 applied to a saturating converter.
  const cases = [
    ['at the knee', { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 1, fs: 100e3 }],
    ['well under it', { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 2, fs: 100e3 }],
    ['deep past it', { Vin: 24, D: 0.6, L: 100e-6, C: 47e-6, R: 0.5, fs: 100e3 }],
    ['light load', { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 200, fs: 100e3 }],
  ]
  it.each(cases)('%s', (_, p) => {
    const conv = saturatingConverter('buck', p)
    const ss = saturatingSteadyState(conv)
    let x = [0, 0]
    let scaleI = 1e-9
    let scaleV = p.Vin
    for (let k = 0; k < 20000; k++) {
      const next = saturatingWalk(conv, x).xEnd
      scaleI = Math.max(scaleI, Math.abs(next[0]))
      scaleV = Math.max(scaleV, Math.abs(next[1]))
      const quiet = Math.abs(next[0] - x[0]) <= 1e-13 * scaleI && Math.abs(next[1] - x[1]) <= 1e-13 * scaleV
      x = next
      if (quiet) break
    }
    expect(Math.abs(x[0] - ss.x0[0]) / scaleI).toBeLessThan(1e-8)
    expect(Math.abs(x[1] - ss.x0[1]) / scaleV).toBeLessThan(1e-8)
  })
})

describe('D1’s claim, as arithmetic', () => {
  const base = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 2 }
  const at = (fs) => {
    const conv = saturatingConverter('buck', { ...base, fs })
    const ss = saturatingSteadyState(conv)
    const vs = signalIntegral(ss.segments[0], 'vL')
    return { conv, ss, vs, dB: fluxSwing(conv.core, vs), m: measures(ss) }
  }

  it('the flux swing is the on interval’s volt-seconds over N·A_e', () => {
    const { conv, vs, dB, m } = at(100e3)
    expect(vs * 1e6).toBeCloseTo(29.17, 2)
    expect(dB).toBeCloseTo(vs / (conv.core.N * conv.core.Ae), 15)
    expect(dB * 1e3).toBeCloseTo(18.23, 2)
    // The textbook figure, (V_in − V_out)·D·T/(N·A_e), lands on it to 0.03 %.
    const closed = ((12 - m.sig.vout.avg) * base.D) / 100e3 / (conv.core.N * conv.core.Ae)
    expect(Math.abs(closed / dB - 1)).toBeLessThan(3e-4)
    expect(fluxDensity({ L: base.L, ...conv.core }, m.sig.iL.max) * 1e3).toBeCloseTo(165.4, 1)
  })

  it('a tenth the frequency is ten times the volt-seconds, and the exact figure is 2 % over it', () => {
    const fast = at(100e3)
    const slow = at(10e3)
    expect(slow.dB * 1e3).toBeCloseTo(186.1, 1)
    // The closed form scales as 1/f_s exactly: ten times, with no remainder.
    const closedRatio = (fs) => ((12 - 5) * base.D) / fs / (40 * 40e-6)
    expect(closedRatio(10e3) / closedRatio(100e3)).toBeCloseTo(10, 12)
    // The measured swing is a little more, because the output itself moves
    // across an interval that is now a tenth of a millisecond long.
    expect(slow.dB / fast.dB).toBeGreaterThan(10)
    expect(slow.dB / fast.dB).toBeCloseTo(10.2, 1)
    expect(slow.m.sig.vout.pp * 1e3).toBeCloseTo(373, 0)
    // Ten times the flux, and still under the ceiling: D2 is where it is not.
    expect(fluxDensity({ L: base.L, ...slow.conv.core }, slow.m.sig.iL.max) * 1e3).toBeCloseTo(249.3, 1)
    expect(fluxDensity({ L: base.L, ...slow.conv.core }, slow.m.sig.iL.max)).toBeLessThan(slow.conv.core.Bsat)
  })
})
