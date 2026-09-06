import { describe, it, expect } from 'vitest'
import {
  converter,
  steadyState,
  measures,
  runPeriods,
  chainPlan,
  gvd,
  gvdClosedForm,
  rhpZero,
  averagingGuard,
  threePhase,
  threePhaseSteadyState,
  threePhaseMeasures,
  fourierAt,
  sixStepLineRms,
  sixStepPhaseRms,
  sixStepLineTotalRms,
  sixStepPhaseTotalRms,
  spwmLinePeak,
  injectionHeadroom,
  INJECTION,
} from '@ee-labs/switched'
import { byId, defaultsOf } from './experiments.js'
import { analyse, buckParams } from './analysis.js'
import { threePhaseParams } from './groups/hiAnalysis.js'
import { experimentMath } from './math.js'

// Every number Groups H and I put on the screen, pinned against the engine
// that produced it, and every one of them a function of a knob rather than a
// constant: each block moves the knob its note names and asserts the number
// moves with it.
//
// Where three routes claim the same fact they are all three taken, which is
// what POWER_LAB_PLAN.md §6 asks for. For the loop experiments that is the
// closed-form periodic state, a walk from rest that knows nothing of it, and
// the averaged model's own equilibrium. For the three-phase bridge it is the
// linear solve, a walk of the same plan period by period, and the closed
// forms of §4.

const at = (id, over = {}) => analyse(byId[id], { ...defaultsOf(id), ...over })
const pct = (x) => 100 * x
const mag = (ss, name, k) => {
  const c = fourierAt(ss, name, k)
  return Math.hypot(c.a, c.b)
}
const checkRows = (id, over = {}) => {
  const p = { ...defaultsOf(id), ...over }
  return experimentMath(byId[id], p, analyse(byId[id], p)).blocks.filter((b) => b.kind === 'check').flatMap((b) => b.rows)
}

// ------------------------------------------------------------ Group H

describe('H1 · the averaged model', () => {
  it('opens on 4.902 V with 3.647 mV of ripple, and sags 94.3 mV to 4.808 V on the step', () => {
    const x = at('h1')
    expect(x.m.sig.vout.avg).toBeCloseTo(4.902, 3)
    expect(x.m.sig.vout.pp * 1e3).toBeCloseTo(3.647, 3)
    expect(x.m.mode).toBe('CCM')
    expect(x.step.from).toBeCloseTo(4.902, 3)
    expect(x.step.to).toBeCloseTo(4.808, 3)
    expect((x.step.from - x.step.to) * 1e3).toBeCloseTo(94.3, 1)
    // The lossless ratio would be D·V_in = 5 V; the two resistances take the rest.
    expect(x.plant.dc).toBeCloseTo((12 * 5) / (5 + 0.05 + 0.05), 9)
  })

  it('the averaged curve stays within 5.14 µV of the exact cycle averages, on 3.65 mV of ripple', () => {
    const x = at('h1')
    const gap = x.step.worst * x.step.span
    expect(gap * 1e6).toBeCloseTo(5.14, 2)
    expect(pct(x.step.worst)).toBeCloseTo(0.00545, 5)
    // The note's 3.65 mV is the converter's own steady-state ripple; the
    // walk's last period is still settling and carries a little less.
    expect(x.m.sig.vout.pp * 1e3).toBeCloseTo(3.647, 3)
    expect(x.step.ripple).toBeGreaterThan(0.9 * x.m.sig.vout.pp)
    expect(x.m.sig.vout.pp / gap).toBeGreaterThan(600)
    expect(x.m.sig.vout.pp / gap).toBeLessThan(800)
    expect(x.step.blocked).toBe(false)
  })

  it('the try line: a step to 10 Ω raises the output 48.5 mV', () => {
    const x = at('h1', { Rstep: 10 })
    expect((x.step.to - x.step.from) * 1e3).toBeCloseTo(48.5, 1)
  })

  it('the walk arrives at the level the pane names, rather than stopping short of it', () => {
    // The Step pane's table says what v_out is "after it", and the plot draws
    // that level. The walk has to reach it, or the picture and the row
    // disagree: at 200 periods the boost's ended 14.6 % of the step above it.
    for (const id of ['h1', 'h3']) {
      const s = at(id).step
      const cycles = s.pairs.map((q) => q.exact)
      const last = cycles[cycles.length - 1]
      const residual = Math.abs(last - s.to) / Math.abs(s.to - s.from)
      expect(residual, `${id} is ${(residual * 100).toFixed(2)} % of the step short`).toBeLessThan(0.03)
    }
  })

  it('every number moves with its knob', () => {
    const base = at('h1')
    const softer = at('h1', { Rstep: 4 })
    expect(Math.abs(softer.step.to - softer.step.from)).toBeLessThan(Math.abs(base.step.to - base.step.from))
    // More capacitance, less ripple, and the gap the model leaves falls with it.
    const fat = at('h1', { C: 470e-6 })
    expect(fat.m.sig.vout.pp).toBeLessThan(base.m.sig.vout.pp / 4)
    expect(fat.step.worst).toBeLessThan(base.step.worst)
  })

  it('three routes agree on where the converter sits: the solver, a walk from rest, and the averaged model', () => {
    const p = buckParams(defaultsOf('h1'))
    const conv = converter('buck', p)
    const ss = steadyState(conv)
    const m = measures(ss)
    const walk = runPeriods(conv, [0, 0], { periods: 200000, settle: 1e-13 })
    expect(walk.periods).toBeLessThan(200000)
    expect(Math.abs(walk.x[1] - ss.x0[1]) / m.sig.vC.avg).toBeLessThan(1e-8)
    // The averaged model's equilibrium is the cycle average, and for a
    // synchronous buck the two switch states share one A, so it is exact.
    const X = gvd(conv).model.X
    expect(X[0]).toBeCloseTo(m.sig.iL.avg, 9)
    expect(X[1]).toBeCloseTo(m.sig.vC.avg, 9)
  })
})

describe('H2 · the buck as a plant', () => {
  it('is six coefficients with no zero, a 1.59 kHz corner and Q = 5.00', () => {
    const x = at('h2')
    expect(x.plant.b[0]).toBe(0)
    expect(x.plant.b[1]).toBe(0)
    expect(x.plant.b[2]).toBeCloseTo(1.2e9, 0)
    expect(x.plant.a).toEqual([1, 2000, 1e8])
    expect(x.formulas.f0plant).toBeCloseTo(1591.55, 2)
    expect(x.plant.Q).toBeCloseTo(5, 9)
    expect(x.plant.zeros).toEqual([])
  })

  it('gives 12.00 V by three routes: the model, the closed form, and dV_out/dD on the switched engine', () => {
    const x = at('h2')
    const cf = gvdClosedForm('buck', x.p)
    expect(x.plant.dc).toBeCloseTo(12, 9)
    expect(cf.dc).toBeCloseTo(12, 12)
    expect(x.formulas.dcMeasured).toBeCloseTo(12, 4)
    // The coefficients are the averaged matrices', not a formula's.
    expect(x.plant.a[2]).toBeCloseTo(1 / (x.p.L * x.p.C), 6)
    expect(x.plant.a[1]).toBeCloseTo(1 / (x.p.R * x.p.C), 9)
  })

  it('the ceiling is f_s/5, and dropping f_s to 10 kHz brings it to 2.00 kHz and a warning', () => {
    const x = at('h2')
    expect(x.guard.limit).toBeCloseTo(20e3, 6)
    expect(x.guard.state).toBe('ok')
    expect(x.guard.reason).toBeNull()
    const slow = at('h2', { fs: 10e3 })
    expect(slow.guard.limit).toBeCloseTo(2000, 6)
    expect(slow.guard.state).toBe('warn')
    expect(slow.guard.reason).toMatch(/f_s\/5/)
    // The corner does not move with f_s; only the ceiling does.
    expect(slow.formulas.f0plant).toBeCloseTo(x.formulas.f0plant, 6)
  })

  it('every number moves with its knob', () => {
    const base = at('h2')
    const fat = at('h2', { C: 400e-6 })
    expect(fat.formulas.f0plant).toBeCloseTo(base.formulas.f0plant / 2, 3)
    expect(fat.plant.Q).toBeCloseTo(base.plant.Q * 2, 6)
    expect(fat.plant.dc).toBeCloseTo(base.plant.dc, 9)
    const hot = at('h2', { Vin: 24 })
    expect(hot.plant.dc).toBeCloseTo(24, 9)
  })

  it('the panel checks the model where it holds and footnotes it where it does not', () => {
    const rows = checkRows('h2')
    const dc = rows.find((r) => r.label === 'G_vd(0) against dV_out/dD')
    expect(dc.unchecked).toBeUndefined()
    expect(dc.predicted).toBeCloseTo(dc.measured, 3)
    // A converter that runs dry has no two-state average, and the row says so.
    const dry = checkRows('h2', { sync: 0, R: 900, fs: 10e3 })
    expect(dry.find((r) => r.label === 'G_vd(0) against dV_out/dD').unchecked).toMatch(/continuous conduction/)
  })
})

describe('H3 · the zero in the wrong half', () => {
  it('sits at D′²R/(2πL) = 398 Hz, in the right half plane', () => {
    const x = at('h3')
    expect(x.formulas.fz).toBeCloseTo(397.887, 3)
    expect(x.plant.rhp).toBe(true)
    const Dp = 1 - x.p.D
    expect(x.plant.wz).toBeCloseTo((Dp * Dp * x.p.R) / x.p.L, 6)
    expect(x.plant.wz).toBeCloseTo(rhpZero('boost', x.p), 9)
    // And it is Q times the corner, which is the boost's own arithmetic.
    expect(x.plant.wz / x.plant.w0).toBeCloseTo(x.plant.Q, 9)
    expect(x.m.sig.vout.avg).toBeCloseTo(24, 3)
  })

  it('a 5 % duty step ends at 26.67 V and dips 391 mV first, on −2400 V/s', () => {
    const x = at('h3')
    expect(x.step.to).toBeCloseTo(26.667, 2)
    expect((x.step.from - x.step.dip) * 1e3).toBeCloseTo(391, 0)
    // The note's slope is the model's own, times the step the knob asks for.
    const dD = defaultsOf('h3').dD
    expect(dD).toBeCloseTo(0.05, 12)
    expect(x.plant.slope0 * dD).toBeCloseTo(-2400, 0)
    expect(x.step.dip).toBeLessThan(x.step.from)
  })

  it('the try line: at D = 60 % the zero falls to 255 Hz and the dip reaches 857 mV', () => {
    const x = at('h3', { D: 0.6 })
    expect(x.formulas.fz).toBeCloseTo(254.648, 3)
    expect((x.step.from - x.step.dip) * 1e3).toBeCloseTo(857, 0)
    expect(x.step.from).toBeCloseTo(30, 2)
  })

  it('every number moves with its knob, and the zero moves the way the formula says', () => {
    const base = at('h3')
    for (const R of [5, 20]) {
      const x = at('h3', { R })
      expect(x.formulas.fz / base.formulas.fz).toBeCloseTo(R / base.p.R, 6)
    }
    // A bigger step digs a deeper hole, in proportion.
    const twice = at('h3', { dD: 0.1 })
    expect(twice.step.from - twice.step.dip).toBeGreaterThan(1.9 * (base.step.from - base.step.dip))
    // The buck has no such zero to move.
    expect(at('h2').plant.zeros).toEqual([])
  })

  it('three routes agree, and the initial slope is the model’s own', () => {
    const p = buckParams(defaultsOf('h3'))
    const conv = converter('boost', p)
    const ss = steadyState(conv)
    const m = measures(ss)
    const walk = runPeriods(conv, [0, 0], { periods: 200000, settle: 1e-13 })
    expect(walk.periods).toBeLessThan(200000)
    expect(Math.abs(walk.x[1] - ss.x0[1]) / m.sig.vC.avg).toBeLessThan(1e-8)
    const x = at('h3')
    const av = x.step.averaged
    const slope = (av.sig.vout[1] - av.sig.vout[0]) / (av.t[1] - av.t[0])
    expect(slope / (x.plant.slope0 * 0.05)).toBeCloseTo(1, 2)
    // The averaged equilibrium against the exact cycle average: the boost's
    // two switch states have different A matrices, so the gap is the ripple
    // correlation rather than nothing.
    const X = gvd(conv).model.X
    const ri = m.sig.iL.pp / m.sig.iL.avg
    const rv = m.sig.vC.pp / m.sig.vC.avg
    expect(Math.abs(X[1] / m.sig.vC.avg - 1)).toBeLessThan(2 * ri * rv + 1e-12)
  })
})

// ------------------------------------------------------------ Group I

describe('I1 · six-step', () => {
  it('the fundamentals are (√6/π)·V_dc and (√2/π)·V_dc, measured on the waveform', () => {
    const x = at('i1')
    expect(x.m.Vll1).toBeCloseTo(37.4254, 4)
    expect(x.m.Vll1).toBeCloseTo(sixStepLineRms(48), 9)
    expect(x.m.V1).toBeCloseTo(21.6076, 4)
    expect(x.m.V1).toBeCloseTo(sixStepPhaseRms(48), 9)
    expect(x.m.V1 * Math.sqrt(3)).toBeCloseTo(x.m.Vll1, 9)
  })

  it('the floating neutral leaves a staircase of ±16.0 V and ±32.0 V', () => {
    const x = at('i1')
    expect(x.m.sig.van.max).toBeCloseTo(32, 9)
    expect(x.m.sig.van.min).toBeCloseTo(-32, 9)
    expect(x.formulas.step1).toBeCloseTo(16, 9)
    expect(x.formulas.step2).toBeCloseTo(32, 9)
    expect(x.m.sig.van.rms).toBeCloseTo(sixStepPhaseTotalRms(48), 9)
    expect(x.m.sig.vab.rms).toBeCloseTo(sixStepLineTotalRms(48), 9)
    expect(x.m.sig.vao.rms).toBeCloseTo(24, 9)
    // Every level the staircase visits is a third of the bus.
    for (const v of x.wf.sig.van) {
      const level = Math.round((v * 3) / 48)
      expect(Math.abs(v - (level * 48) / 3)).toBeLessThan(1e-9)
      expect(Math.abs(level)).toBeLessThanOrEqual(2)
    }
  })

  it('no third harmonic reaches the line, and the 5th is 20.0 % with the 7th at 14.3 %', () => {
    const x = at('i1')
    const ss = x.ss
    const first = mag(ss, 'vab', 1)
    expect(mag(ss, 'vab', 3) / first).toBeLessThan(1e-12)
    expect(mag(ss, 'vab', 9) / first).toBeLessThan(1e-12)
    expect(pct(mag(ss, 'vab', 5) / first)).toBeCloseTo(20.0, 6)
    expect(pct(mag(ss, 'vab', 7) / first)).toBeCloseTo(14.29, 2)
    expect(pct(x.m.thdLine)).toBeCloseTo(31.08, 2)
    expect(pct(x.m.thdCurrent)).toBeCloseTo(7.484, 3)
  })

  it('the try line: halving the bus halves every voltage and holds every share', () => {
    const base = at('i1')
    const half = at('i1', { Vdc: 24 })
    expect(half.m.Vll1).toBeCloseTo(base.m.Vll1 / 2, 9)
    expect(half.m.sig.van.max).toBeCloseTo(base.m.sig.van.max / 2, 9)
    expect(half.m.thdLine).toBeCloseTo(base.m.thdLine, 9)
    expect(half.m.thdCurrent).toBeCloseTo(base.m.thdCurrent, 9)
    // The power falls with the square, since the impedance did not move.
    expect(half.m.Pout).toBeCloseTo(base.m.Pout / 4, 6)
  })

  it('every number moves with its knob, and the load is what smooths the current', () => {
    const base = at('i1')
    const stiff = at('i1', { L: 60e-3 })
    expect(stiff.m.thdCurrent).toBeLessThan(base.m.thdCurrent)
    expect(stiff.m.thdLine).toBeCloseTo(base.m.thdLine, 9)
    expect(at('i1', { f1: 120 }).T).toBeCloseTo(1 / 120, 12)
  })

  it('three routes agree: the linear solve, a walk of the same plan, and the closed forms', () => {
    const conv = threePhase('sixstep', threePhaseParams(defaultsOf('i1')))
    const ss = threePhaseSteadyState(conv)
    // A walk from rest through the same plan, period by period, with no
    // knowledge of the solve.
    let x = [0, 0]
    for (let k = 0; k < 4000; k++) x = chainPlan(conv.plan, x).xEnd
    const scale = Math.max(1e-9, Math.abs(ss.x0[0]), Math.abs(ss.x0[1]))
    expect(Math.abs(x[0] - ss.x0[0]) / scale).toBeLessThan(1e-9)
    expect(Math.abs(x[1] - ss.x0[1]) / scale).toBeLessThan(1e-9)
    const m = threePhaseMeasures(ss)
    expect(m.Vll1).toBeCloseTo(sixStepLineRms(conv.p.Vdc), 9)
    expect(m.Pdc).toBeCloseTo(m.Pout, 6)
  })
})

describe('I2 · sine PWM in three phases', () => {
  it('the carrier is 21 times the output frequency, an odd multiple of three', () => {
    const x = at('i2')
    expect(x.conv.mf).toBe(21)
    expect(x.conv.mf % 3).toBe(0)
    expect(x.conv.mf % 2).toBe(1)
    expect(x.conv.fsw).toBeCloseTo(1260, 9)
  })

  it('the line-to-line fundamental is (√3/2)·m_a·V_dc, 33.26 V peak at 80 %', () => {
    const x = at('i2')
    expect(x.m.Vll1 * Math.SQRT2).toBeCloseTo(33.2554, 3)
    expect(x.m.Vll1 * Math.SQRT2).toBeCloseTo(spwmLinePeak(0.8, 48), 5)
    expect(x.m.V1 * Math.SQRT2).toBeCloseTo(19.2, 5)
  })

  it('at 115 % the plain sine gives 45.19 V of the 47.80 V the line promises, and the offset gives all of it', () => {
    const plain = at('i2', { ma: 1.15 })
    const offset = at('i2', { ma: 1.15, inject: 1 })
    expect(plain.m.Vll1 * Math.SQRT2).toBeCloseTo(45.1908, 3)
    expect(offset.m.Vll1 * Math.SQRT2).toBeCloseTo(47.8046, 3)
    expect(offset.m.Vll1 * Math.SQRT2).toBeCloseTo(spwmLinePeak(1.15, 48), 5)
    expect(plain.m.Vll1).toBeLessThan(offset.m.Vll1)
    // The ceiling itself, and the fifteen per cent it is worth.
    expect(offset.formulas.ceiling).toBeCloseTo(injectionHeadroom(), 12)
    expect(offset.formulas.ceiling).toBeCloseTo(2 / Math.sqrt(3), 12)
    expect(pct(offset.formulas.ceiling - 1)).toBeCloseTo(15.47, 2)
  })

  it('the offset puts 3.20 V of third harmonic on each leg and none on the line', () => {
    const x = at('i2', { inject: 1 })
    expect(mag(x.ss, 'vao', 3)).toBeCloseTo((INJECTION * 0.8 * 48) / 2, 6)
    expect(mag(x.ss, 'vao', 3)).toBeCloseTo(3.2, 6)
    expect(mag(x.ss, 'vab', 3) / 48).toBeLessThan(1e-12)
    expect(mag(x.ss, 'van', 3) / 48).toBeLessThan(1e-12)
    // Without it there is no third harmonic anywhere, below the ceiling.
    expect(mag(at('i2').ss, 'vao', 3) / 48).toBeLessThan(1e-12)
  })

  it('every number moves with its knob, and the fundamental follows m_a below the ceiling', () => {
    for (const ma of [0.4, 0.6, 1.0]) {
      const x = at('i2', { ma })
      expect(x.m.Vll1 * Math.SQRT2).toBeCloseTo(spwmLinePeak(ma, 48), 5)
    }
    expect(at('i2', { fsw: 900 }).conv.mf).toBe(15)
    expect(at('i2', { Vdc: 96 }).m.Vll1).toBeCloseTo(2 * at('i2').m.Vll1, 6)
  })
})

describe('I3 · a balanced load, and a quiet bus', () => {
  it('one phase averages 11.77 W and swings 14.72 W at twice the output frequency', () => {
    const x = at('i3')
    expect(x.m.Pa).toBeCloseTo(11.77, 2)
    expect(x.m.pa2).toBeCloseTo(14.72, 2)
    expect(x.m.Pa * 3).toBeCloseTo(x.m.Pdc, 6)
    // The swing is the mean over cos φ, at the load's own angle.
    expect(x.m.phaseSwing).toBeCloseTo(1 / Math.cos(x.formulas.phi), 2)
    expect(x.formulas.phiDeg).toBeCloseTo(37.02, 2)
    expect(pct(x.m.phaseSwing)).toBeCloseTo(125.1, 1)
  })

  it('the bus carries 35.31 W and nothing at 120 Hz', () => {
    const x = at('i3')
    expect(x.m.Pdc).toBeCloseTo(35.31, 2)
    expect(x.m.p2 / x.m.Pdc).toBeLessThan(1e-12)
    expect(x.m.busSwing).toBeLessThan(1e-12)
    // What is left on the bus is the carrier, not the output's own second
    // harmonic: the sixth is four parts in ten thousand of the mean.
    expect(x.m.p6 / x.m.Pdc).toBeLessThan(1e-3)
  })

  it('the try line: at m_a = 40 % the load takes 8.84 W and the bus stays quiet', () => {
    const x = at('i3', { ma: 0.4 })
    expect(x.m.Pdc).toBeCloseTo(8.838, 2)
    expect(x.m.p2 / x.m.Pdc).toBeLessThan(1e-12)
    expect(pct(x.m.phaseSwing)).toBeCloseTo(125.0, 1)
  })

  it('every number moves with its knob, and the power goes as m_a²', () => {
    const base = at('i3')
    expect(at('i3', { ma: 0.4 }).m.Pdc / base.m.Pdc).toBeCloseTo(0.25, 2)
    // A stiffer winding lags further, and one phase swings by more of its mean.
    const stiff = at('i3', { L: 60e-3 })
    expect(stiff.formulas.phiDeg).toBeGreaterThan(base.formulas.phiDeg)
    expect(stiff.m.phaseSwing).toBeGreaterThan(base.m.phaseSwing)
    expect(stiff.m.p2 / stiff.m.Pdc).toBeLessThan(1e-12)
  })

  it('the single-phase case is the one the bus cannot cancel, by the same arithmetic', () => {
    const x = at('i3')
    // One phase's own power, at twice the output frequency, is its apparent
    // power. Three of them a third of a cycle apart sum to zero there.
    expect(x.m.pa2 / x.m.Pa).toBeCloseTo(x.formulas.onePhaseSwing, 2)
    expect(x.m.pa2).toBeGreaterThan(x.m.Pa)
    expect(x.m.p2).toBeLessThan(1e-9 * x.m.pa2)
  })
})

// ------------------------------------------------------------ the two panels

describe('the panels these groups add', () => {
  it('every check row of every new experiment agrees at its defaults', () => {
    for (const id of ['h1', 'h2', 'h3', 'i1', 'i2', 'i3']) {
      for (const r of checkRows(id)) {
        if (r.unchecked) continue
        const tol = Math.max(r.tol * Math.abs(r.predicted), r.abs)
        expect(Math.abs(r.measured - r.predicted), `${id} / ${r.label}`).toBeLessThanOrEqual(tol)
      }
    }
  })

  it('the plant is handed over below the ceiling and declined above it', () => {
    expect(at('h2').guard.state).toBe('ok')
    expect(averagingGuard(at('h2').plant, 6e3).state).toBe('refuse')
    // The link carries the coefficients themselves, so the plant on the other
    // side is this one rather than the nearest named fit.
    const tf = at('h2').plant
    expect(tf.b).toHaveLength(3)
    expect(tf.a).toHaveLength(3)
    expect(tf.a[0]).toBe(1)
  })

  it('the three-phase measures name the units the spectrum pane draws', () => {
    for (const id of ['i1', 'i2', 'i3']) {
      const m = at(id).m
      expect(m.spectrum.unit).toBe('V')
      expect(m.mode).toBe('threephase')
      expect(m.harmonics[0].k).toBe(1)
      expect(m.thd).toBeGreaterThan(0)
    }
  })
})
