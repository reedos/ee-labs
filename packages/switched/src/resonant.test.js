import { describe, it, expect } from 'vitest'
import {
  resonantConverter,
  resonantSteadyState,
  resonantMeasures,
  fhaGain,
  fhaRatio,
  seriesResonance,
  lowerResonance,
  tankImpedance,
  tankQ,
  acLoad,
  RESONANT_KINDS,
} from './resonant.js'
import { walkWindows } from './isolated.js'
import { endState } from './segment.js'
import { average } from './steady.js'
import { lossLedger } from './ledger.js'

// The two resonant converters, held to the same invariants as every other
// converter in the package, plus the two that are theirs alone.
//
// Theirs alone: the gain at the tank's own resonance is the turns ratio over
// two, whatever the load, because the series pair is a short there and the
// tank passes the square wave through untouched. And the first-harmonic
// approach, which is the way this circuit is taught, is an approximation with
// a region — near resonance it is worth a fraction of a per cent, and well
// below resonance it is wrong by tens of per cent. Both are measured here
// against a waveform that never saw either formula.

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const logU = (r, lo, hi) => lo * (hi / lo) ** r()

const BASE = { Vin: 48, Lr: 30e-6, Cr: 84.4e-9, Lm: 150e-6, n: 0.5, C: 100e-6, R: 12 }
const FR = seriesResonance(BASE)
const solve = (kind, p) => {
  const conv = resonantConverter(kind, { ...BASE, ...p })
  const ss = resonantSteadyState(conv)
  return { conv, ss, m: resonantMeasures(ss) }
}

describe('the tank, as a set of numbers before it is a circuit', () => {
  it('names its two resonances and the load the rectifier reflects back', () => {
    expect(FR).toBeCloseTo(1 / (2 * Math.PI * Math.sqrt(30e-6 * 84.4e-9)), 6)
    expect(FR / 1e3).toBeCloseTo(100.02, 1)
    // The magnetising inductance joins the tank while the rectifier blocks,
    // so the lower resonance is slower by √((L_r + L_m)/L_r).
    expect(lowerResonance(BASE) * Math.sqrt((30e-6 + 150e-6) / 30e-6)).toBeCloseTo(FR, 6)
    expect(tankImpedance(BASE)).toBeCloseTo(Math.sqrt(30e-6 / 84.4e-9), 9)
    // A square voltage of ±V_o driving a current in phase with it delivers
    // the same power as 8/π² of the load, referred through the turns.
    expect(acLoad(BASE)).toBeCloseTo((8 * 12) / (Math.PI ** 2 * 0.25), 9)
    expect(tankQ(BASE)).toBeCloseTo(tankImpedance(BASE) / acLoad(BASE), 12)
  })

  it('puts the first-harmonic gain at one on resonance and below one above it', () => {
    expect(fhaGain('src', { ...BASE, fs: FR })).toBeCloseTo(1, 12)
    expect(fhaRatio('src', { ...BASE, fs: FR })).toBeCloseTo(0.25, 12)
    expect(fhaGain('src', { ...BASE, fs: 2 * FR })).toBeLessThan(1)
    // The LLC's gain can exceed one below resonance, which is the whole
    // reason for the magnetising inductance being there.
    expect(fhaGain('llc', { ...BASE, fs: 0.6 * FR })).toBeGreaterThan(1)
    expect(fhaGain('llc', { ...BASE, fs: 2 * FR })).toBeLessThan(1)
  })
})

describe('the series resonant converter', () => {
  it('passes the square wave through at resonance, so M is the turns ratio over two', () => {
    const { m } = solve('src', { fs: FR })
    expect(m.M).toBeCloseTo(0.25, 4)
    expect(m.sig.vout.avg).toBeCloseTo(12, 2)
    // Independent of load, because the series pair is a short there.
    for (const R of [6, 24, 100]) {
      expect(solve('src', { fs: FR, R }).m.M, `R=${R}`).toBeCloseTo(0.25, 3)
    }
  })

  it('loses gain above resonance, where the series pair is an impedance again', () => {
    let last = Infinity
    for (const ratio of [1.0, 1.2, 1.5, 2.0, 2.5]) {
      const { m } = solve('src', { fs: ratio * FR })
      expect(m.M, `f/f_r = ${ratio}`).toBeLessThanOrEqual(last + 1e-9)
      last = m.M
    }
    expect(solve('src', { fs: 2.5 * FR }).m.M).toBeLessThan(0.2)
  })

  it('agrees with the first-harmonic gain near resonance and parts from it below', () => {
    // Near resonance the tank current really is nearly a sine.
    for (const ratio of [0.95, 1.0, 1.1]) {
      const { m } = solve('src', { fs: ratio * FR })
      expect(Math.abs(m.fhaError), `f/f_r = ${ratio}`).toBeLessThan(0.03)
    }
    // Well below it the current is a train of arcs with gaps in it, the tank
    // stops being a filter, and the output clamps where the approximation
    // says it should still be falling.
    const low = solve('src', { fs: 0.6 * FR })
    expect(low.m.M).toBeCloseTo(0.25, 3)
    expect(low.m.Mfha).toBeLessThan(0.24)
    expect(low.m.fhaError).toBeGreaterThan(0.05)
  })

  it('turns on into a current still flowing the wrong way above resonance, and not below', () => {
    expect(solve('src', { fs: 1.4 * FR }).m.zvs).toBe(true)
    // Below resonance the tank current has already returned to zero when the
    // switch turns on, which is the other soft case and not the same claim.
    const low = solve('src', { fs: 0.7 * FR })
    expect(low.m.zvs).toBe(false)
    expect(low.m.zcs).toBe(true)
  })
})

describe('the LLC', () => {
  it('carries the same gain at resonance as the series tank, magnetising or not', () => {
    const { m } = solve('llc', { fs: FR })
    expect(m.M).toBeCloseTo(0.25, 3)
    for (const R of [6, 24, 100]) expect(solve('llc', { fs: FR, R }).m.M, `R=${R}`).toBeCloseTo(0.25, 2)
  })

  it('gains above the turns ratio below resonance, and by more at light load', () => {
    const heavy = solve('llc', { fs: 0.7 * FR, R: 6 })
    const light = solve('llc', { fs: 0.7 * FR, R: 48 })
    expect(light.m.M).toBeGreaterThan(0.25)
    expect(light.m.M).toBeGreaterThan(heavy.m.M)
    // The series converter cannot do it at all: its gain never exceeds n/2.
    expect(solve('src', { fs: 0.7 * FR, R: 48 }).m.M).toBeLessThanOrEqual(0.2501)
  })

  it('moves its peak with the inductance ratio, toward the lower resonance', () => {
    // A larger L_m/L_r puts the lower resonance nearer the upper one, so the
    // gain peak moves up in frequency and gets smaller.
    const peakOf = (Lm) => {
      let best = { M: -1, x: 0 }
      for (let i = 0; i <= 40; i++) {
        const fs = (0.3 + (0.7 * i) / 40) * FR
        const M = solve('llc', { fs, Lm, R: 48 }).m.M
        if (M > best.M) best = { M, x: fs / FR }
      }
      return best
    }
    const wide = peakOf(60e-6) // L_m/L_r = 2
    const narrow = peakOf(300e-6) // L_m/L_r = 10
    expect(wide.M).toBeGreaterThan(narrow.M)
    expect(wide.x).toBeGreaterThan(narrow.x)
    // And each sits above its own lower resonance.
    expect(wide.x * FR).toBeGreaterThan(lowerResonance({ ...BASE, Lm: 60e-6 }))
    expect(narrow.x * FR).toBeGreaterThan(lowerResonance({ ...BASE, Lm: 300e-6 }))
  })

  it('has the magnetising current where the transformer carries none', () => {
    const { ss, m } = solve('llc', { fs: 0.8 * FR })
    const idle = ss.segments.filter((s) => s.name.endsWith('idle') && s.T > 0)
    expect(idle.length).toBeGreaterThan(0)
    // The transformer's own current is zero through the whole of it.
    for (const seg of idle) {
      expect(Math.abs(seg.x0[conv1(ss).IJ])).toBeLessThan(1e-9 * Math.max(1e-9, m.sig.iL.rms))
      expect(Math.abs(endState(seg)[conv1(ss).IJ])).toBeLessThan(1e-9 * Math.max(1e-9, m.sig.iL.rms))
    }
    // And the magnetising current is the tank current there.
    expect(m.sig.iM.rms).toBeGreaterThan(0)
  })
})

const conv1 = (ss) => ss.conv.index

describe('the invariants, across both resonant converters', () => {
  // The space a resonant converter is specified in, rather than the space its
  // component values live in: the tank's quality factor against the load the
  // rectifier reflects back, the inductance ratio, the frequency as a
  // multiple of resonance, and how many periods the output filter's own time
  // constant runs to. Drawing R and C directly puts most of the samples at
  // loads no such converter is built for, and none of them near the
  // boundaries this circuit has.
  const cases = []
  const r = rng(90211)
  for (const kind of RESONANT_KINDS) {
    for (let i = 0; i < 120; i++) {
      const Lr = logU(r, 5e-6, 200e-6)
      const Cr = logU(r, 10e-9, 1e-6)
      const fr = 1 / (2 * Math.PI * Math.sqrt(Lr * Cr))
      const Z0 = Math.sqrt(Lr / Cr)
      const Q = logU(r, 0.05, 5)
      const n = logU(r, 0.05, 1.5)
      const R = ((Z0 / Q) * Math.PI * Math.PI * n * n) / 8
      const fs = fr * (0.55 + 2 * r())
      cases.push([
        `${kind} #${i}`,
        kind,
        {
          Vin: logU(r, 24, 400),
          Lr,
          Cr,
          Lm: Lr * logU(r, 2, 12),
          n,
          C: logU(r, 20, 3000) / (R * fs),
          R,
          fs,
          Rs: r() < 0.5 ? logU(r, 1e-3, 0.5) : 0,
          Vf: r() < 0.5 ? 0.2 + 0.6 * r() : 0,
        },
      ])
    }
  }
  let idle = 0
  it.each(cases)('%s', (_, kind, p) => {
    const conv = resonantConverter(kind, p)
    const ss = resonantSteadyState(conv)
    expect(ss.converged, 'the shooting method converged').toBe(true)
    const m = resonantMeasures(ss)
    const live = ss.segments.filter((s) => s.T > 0)
    // The tank current is zero at every segment boundary in the intervals
    // where the rectifier blocks, so its scale is read off the waveform
    // rather than off the boundaries.
    const Is = Math.max(1e-9, m.sig.iL.max, -m.sig.iL.min)
    const Vs = Math.max(p.Vin, Math.abs(m.sig.vC.max), Math.abs(m.sig.vC.min))
    if (live.some((s) => s.name.endsWith('idle'))) idle++
    // 1: the resonant inductor's average voltage is zero, so its current
    // ends the period where it began.
    expect(Math.abs(average(ss, 'vL'))).toBeLessThan(1e-7 * Vs)
    // 2: charge balance, on the tank capacitor and on the output's. The tank
    // capacitor is in series with the tank, so its charge balance is the
    // statement that the tank current has no DC in it at all.
    expect(Math.abs(m.sig.iL.avg)).toBeLessThan(1e-7 * Is)
    expect(Math.abs(m.sig.iC.avg)).toBeLessThan(1e-7 * Is)
    // 4: every segment starts where the last one ended.
    for (let k = 1; k < live.length; k++) {
      const xe = endState(live[k - 1])
      for (let i = 0; i < conv.order; i++) {
        const scale = i === conv.index.VC || i === conv.index.VO ? Vs : Is
        expect(Math.abs(live[k].x0[i] - xe[i]), `segment ${k} component ${i}`).toBeLessThan(1e-7 * scale)
      }
    }
    // 6: one more period returns the same state.
    const xT = walkWindows(conv, ss.x0).xEnd
    for (let i = 0; i < conv.order; i++) {
      const scale = i === conv.index.VC || i === conv.index.VO ? Vs : Is
      expect(Math.abs(xT[i] - ss.x0[i]), `period map component ${i}`).toBeLessThan(1e-7 * scale)
    }
    // 3: the books close, and the ledger's residual is the identity.
    const led = lossLedger(m)
    expect(Math.abs(led.residual)).toBeLessThan(1e-7 * Math.max(m.Pin, m.Pout, 1e-12))
    expect(m.eta).toBeGreaterThan(0)
    expect(m.eta).toBeLessThanOrEqual(1 + 1e-7)
    // A series tank cannot boost: its output never exceeds n·V_in/2.
    if (kind === 'src') expect(m.sig.vout.avg).toBeLessThanOrEqual(((p.n * p.Vin) / 2) * 1.001)
    for (const s of Object.values(m.sig)) for (const v of Object.values(s)) expect(Number.isFinite(v)).toBe(true)
  })
  it('visited the interval where neither rectifier leg conducts', () => {
    expect(idle).toBeGreaterThan(20)
    expect(idle).toBeLessThan(cases.length - 5)
  })
})

describe('the walk from rest agrees with the solver', () => {
  const cases = [
    ['src at resonance', 'src', { fs: FR }],
    ['src above', 'src', { fs: 1.6 * FR }],
    ['src below', 'src', { fs: 0.7 * FR }],
    ['llc at resonance', 'llc', { fs: FR }],
    ['llc above', 'llc', { fs: 1.6 * FR }],
    ['llc below', 'llc', { fs: 0.7 * FR, R: 48 }],
  ]
  it.each(cases)('%s', (_, kind, p) => {
    // The walker knows nothing of the answer: it starts the converter from
    // rest and runs it, period after period, through the same propagator.
    const conv = resonantConverter(kind, { ...BASE, ...p })
    const ss = resonantSteadyState(conv)
    let x = new Array(conv.order).fill(0)
    for (let k = 0; k < 3000; k++) x = walkWindows(conv, x).xEnd
    const m = resonantMeasures(ss)
    const scale = [Math.max(1e-6, m.sig.iL.rms), Math.max(1e-6, m.sig.iL.rms), Math.max(1, m.sig.vC.rms), Math.max(1, m.sig.vout.avg)]
    for (let i = 0; i < conv.order; i++) {
      const sc = conv.order === 4 ? scale[i] : [scale[0], scale[2], scale[3]][i]
      expect(Math.abs(x[i] - ss.x0[i]) / sc, `component ${i}`).toBeLessThan(1e-4)
    }
  })
})

describe('the shapes the app leans on', () => {
  it('names both kinds and refuses anything else', () => {
    expect(RESONANT_KINDS).toEqual(['src', 'llc'])
    expect(() => resonantConverter('lcc', {})).toThrow(/unknown resonant converter/)
  })
  it('carries every signal the panes ask for, in every state', () => {
    for (const kind of RESONANT_KINDS) {
      const conv = resonantConverter(kind, {})
      for (const [name, state] of Object.entries(conv.states)) {
        for (const s of conv.signals) expect(state.signals[s], `${kind}.${name}.${s}`).toBeTruthy()
      }
    }
  })
  it('reports the switch node as the schematic probes it, between the two rails', () => {
    // A half bridge's switch node sits between V_in and ground, so it is
    // never negative. The ±V_in/2 the gain formulas are written in is that
    // node less the DC the tank capacitor holds, and the drive's own AC
    // amplitude is what the tank sees.
    for (const kind of RESONANT_KINDS) {
      const { m, conv } = solve(kind, { fs: 1.3 * FR })
      expect(m.sig.vsw.min, kind).toBeCloseTo(0, 12)
      expect(m.sig.vsw.max, kind).toBeCloseTo(conv.p.Vin, 12)
      expect(m.sig.vsw.avg, kind).toBeCloseTo(conv.p.Vin / 2, 9)
      expect(m.sig.vsw.rms, kind).toBeCloseTo(conv.p.Vin / Math.SQRT2, 9)
      expect(m.sig.vsw.pp, kind).toBeCloseTo(conv.p.Vin, 12)
      // And the source's power is that node times the tank current, exactly,
      // because the node is the one the rail drives.
      expect(m.meanProd('vsw', 'iL'), kind).toBeCloseTo(m.Pin, 9)
    }
  })

  it('runs the bridge at half the period each way, whatever the frequency knob says', () => {
    const conv = resonantConverter('llc', { fs: 137e3 })
    expect(conv.T).toBeCloseTo(1 / 137e3, 15)
    expect(conv.tOn).toBeCloseTo(1 / (2 * 137e3), 15)
    expect(conv.windows).toHaveLength(2)
    expect(conv.windows[0].T).toBeCloseTo(conv.windows[1].T, 15)
  })
})
