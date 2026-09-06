import { describe, it, expect } from 'vitest'
import { complex as cx, solveAC } from '@ee-labs/network'
import {
  breakdown,
  imOf,
  imOperating,
  imThevenin,
  perPhase,
  rotorResistanceFor,
  runUp,
  slipFor,
  torqueCurve,
  torqueOfSlip,
} from './induction.js'

const rand = (lo, hi) => lo + Math.random() * (hi - lo)
const rms = (X) => cx.cabs(X) / Math.SQRT2

/** The torque the phasor circuit makes at a slip, from the air-gap power. */
function torqueFromSolve(spec, s) {
  const m = imOf(spec)
  const ac = solveAC(perPhase(spec, s), m.omega)
  const I2 = rms(ac.i.R2s)
  return (3 * I2 * I2 * (m.R2 / s)) / m.omegaSync
}

describe('the closed-form torque is the circuit', () => {
  it('agrees with a phasor solve at every slip, over a fuzzed machine', () => {
    for (let t = 0; t < 30; t++) {
      const spec = {
        R1: rand(0.3, 4),
        X1: rand(0.5, 6),
        R2: rand(0.3, 4),
        X2: rand(0.5, 6),
        Xm: rand(20, 120),
        Rc: Math.random() < 0.3 ? Infinity : rand(300, 3000),
      }
      for (const s of [1, 0.6, 0.3, 0.1, 0.04, 0.01, 0.002]) {
        const closed = torqueOfSlip(spec, s)
        expect(torqueFromSolve(spec, s) / closed).toBeCloseTo(1, 10)
      }
    }
  })

  it('is exactly zero at zero slip, because no current crosses the gap', () => {
    expect(torqueOfSlip({}, 0)).toBe(0)
    expect(torqueOfSlip({}, 1e-9)).toBeLessThan(torqueOfSlip({}, 1e-6))
    expect(torqueOfSlip({}, 1e-12)).toBeLessThan(1e-6 * breakdown({}).tMax)
  })

  it('refuses a per-phase circuit at zero slip, and says why', () => {
    expect(() => perPhase({}, 0)).toThrow(/positive slip/)
  })
})

describe('breakdown', () => {
  it('is the largest torque on the curve, and sits at the closed-form slip', () => {
    for (let t = 0; t < 20; t++) {
      const spec = { R1: rand(0.3, 4), X1: rand(0.5, 6), R2: rand(0.3, 4), X2: rand(0.5, 6), Xm: rand(20, 120) }
      const bd = breakdown(spec)
      const curve = torqueCurve(spec, { from: Math.max(1, 2 * bd.sMax), to: 1e-4, points: 4001 })
      const peak = Math.max(...curve.torque)
      expect(bd.tMax / peak).toBeCloseTo(1, 4)
      expect(torqueOfSlip(spec, bd.sMax) / bd.tMax).toBeCloseTo(1, 10)
      for (const d of [0.8, 0.9, 1.1, 1.25]) expect(torqueOfSlip(spec, bd.sMax * d)).toBeLessThan(bd.tMax)
    }
  })

  it('moves along the slip axis with the rotor resistance and does not change height', () => {
    const base = {}
    const bd0 = breakdown(base)
    for (const f of [0.5, 2, 4]) {
      const bd = breakdown({ ...base, R2: imOf(base).R2 * f })
      expect(bd.sMax / (bd0.sMax * f)).toBeCloseTo(1, 10)
      expect(bd.tMax / bd0.tMax).toBeCloseTo(1, 10)
    }
  })

  it('gives the rotor resistance that puts breakdown at standstill', () => {
    const R2 = rotorResistanceFor({}, 1)
    const bd = breakdown({ R2 })
    expect(bd.sMax).toBeCloseTo(1, 10)
    expect(torqueOfSlip({ R2 }, 1) / bd.tMax).toBeCloseTo(1, 9)
  })

  it('refuses a wanted breakdown slip outside the unit interval', () => {
    expect(() => rotorResistanceFor({}, 0)).toThrow(/between 0 and 1/)
    expect(() => rotorResistanceFor({}, 1.5)).toThrow(/between 0 and 1/)
  })
})

describe('the Thévenin reduction is the same circuit', () => {
  it('predicts the rotor current the full solve produces', () => {
    for (let t = 0; t < 20; t++) {
      const spec = { R1: rand(0.3, 4), X1: rand(0.5, 6), R2: rand(0.3, 4), X2: rand(0.5, 6), Xm: rand(20, 120) }
      const th = imThevenin(spec)
      const m = th.machine
      const s = rand(0.005, 1)
      const Z = [th.Rth + m.R2 / s, th.Xth + m.X2]
      const I2 = th.Vmag / Math.hypot(Z[0], Z[1])
      const ac = solveAC(perPhase(spec, s), m.omega)
      expect(rms(ac.i.R2s) / I2).toBeCloseTo(1, 10)
    }
  })
})

describe('the operating point', () => {
  it('is where the torque curve crosses the load', () => {
    const op = imOperating({}, solveAC)
    const m = imOf({})
    expect(op.torque / (m.TL + m.B * op.omega)).toBeCloseTo(1, 8)
    expect(op.slip).toBeGreaterThan(0)
    expect(op.slip).toBeLessThan(breakdown({}).sMax)
  })

  it('splits the air-gap power into rotor copper and mechanical, in the ratio s to 1−s', () => {
    const op = imOperating({}, solveAC)
    expect(op.pRotorCu / op.pGap).toBeCloseTo(op.slip, 10)
    expect(op.pMechGross / op.pGap).toBeCloseTo(1 - op.slip, 10)
    expect((op.pRotorCu + op.pMechGross) / op.pGap).toBeCloseTo(1, 12)
  })

  it('closes the power balance from the terminals to the shaft', () => {
    const op = imOperating({}, solveAC)
    const total = op.pShaft + op.pFriction + op.pRotorCu + op.pStatorCu + op.pCore
    expect(total / op.pIn).toBeCloseTo(1, 8)
  })

  it('says the machine would stall when the load is past breakdown', () => {
    const bd = breakdown({})
    expect(() => imOperating({ TL: bd.tMax * 1.2, B: 0 })).toThrow(/stall/)
    expect(() => slipFor({}, bd.tMax * 1.2)).toThrow(/breakdown torque/)
  })

  it('finds the same slip from the torque as from the load balance', () => {
    const op = imOperating({}, solveAC)
    expect(slipFor({}, op.torque) / op.slip).toBeCloseTo(1, 8)
  })
})

describe('the run-up carries its error', () => {
  it('settles on the operating point, and reports how far it can be trusted', () => {
    const ru = runUp({})
    const op = imOperating({})
    expect(ru.omega[ru.omega.length - 1] / op.omega).toBeCloseTo(1, 6)
    expect(ru.relative).toBeLessThan(1e-6)
    expect(ru.says).toMatch(/Richardson/)
    expect(ru.order).toBe(4)
  })

  it('states the quasi-static guard as a ratio, not as a promise', () => {
    const ru = runUp({})
    expect(ru.separated).toBeGreaterThan(1)
    expect(ru.guardMet).toBe(ru.separated >= 10)
    expect(ru.says).toMatch(/quasi-static/)
  })

  it('refuses a step so coarse that it cannot state the answer', () => {
    expect(() => runUp({}, { steps: 8, tol: 1e-9 })).toThrow(/guard/)
  })
})
