import { describe, it, expect } from 'vitest'
import { converter, KINDS } from './topologies.js'
import { steadyState, measures } from './steady.js'
import { rectifier, rectifierSteadyState, rectifierMeasures } from './rectifier.js'
import { flyback, halfBridge } from './isolated.js'
import { saturatingConverter } from './magnetics.js'
import { saturatingSteadyState } from './saturating.js'
import { lossLedger, activeMechanisms, LOSS_ROWS } from './ledger.js'
import { switchingCrossover, peakEfficiencyLoad, capacitorRms, inductorRipple } from './formulas.js'

// The ledger's one claim: P_in − P_out − Σ conduction losses is zero, because
// every term is an integral of one waveform rather than an estimate of it.
// The test that matters is the residual, and it is held at zero across every
// engine in the package.

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const logU = (r, lo, hi) => lo * (hi / lo) ** r()

const lossy = (r) => ({
  Ron: r() < 0.7 ? logU(r, 1e-3, 0.5) : 0,
  Vf: r() < 0.7 ? 0.2 + 0.8 * r() : 0,
  rd: r() < 0.5 ? logU(r, 1e-3, 0.2) : 0,
  RL: r() < 0.7 ? logU(r, 1e-3, 0.5) : 0,
  ESR: r() < 0.7 ? logU(r, 1e-3, 1) : 0,
  tr: r() < 0.5 ? logU(r, 5e-9, 100e-9) : 0,
  tf: r() < 0.5 ? logU(r, 5e-9, 100e-9) : 0,
})

describe('the shape of the ledger', () => {
  const p = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Ron: 0.05, Vf: 0.5, RL: 0.03, ESR: 0.05, tr: 20e-9, tf: 20e-9 }
  const m = measures(steadyState(converter('buck', p)))
  const led = lossLedger(m)

  it('names every mechanism the knobs switched on, and marks the one that is a model', () => {
    expect(led.rows.map((q) => q.key)).toEqual(['switch', 'diode', 'inductor', 'esr', 'switching'])
    for (const q of led.rows) {
      expect(LOSS_ROWS[q.key], q.key).toBeTruthy()
      expect(q.label.length, q.key).toBeGreaterThan(3)
    }
    expect(led.rows.filter((q) => q.model).map((q) => q.key)).toEqual(['switching'])
  })

  it('adds up: the load plus the losses is the power the source has to supply', () => {
    expect(led.Psource).toBeCloseTo(m.Pin + m.loss.switching, 15)
    const total = led.Pout + led.conduction + led.switching
    expect(total).toBeCloseTo(led.Psource, 12)
    expect(led.rows.reduce((a, q) => a + q.share, 0) + led.outShare).toBeCloseTo(1, 12)
    expect(led.eta).toBeCloseTo(m.eta, 15)
  })

  it('leaves a residual of zero, because the identity is an identity', () => {
    expect(Math.abs(led.residual)).toBeLessThan(1e-12 * led.Pin)
  })

  it('drops a mechanism from the active list when its knob goes to zero', () => {
    expect(activeMechanisms(m)).toEqual(['switch', 'diode', 'inductor', 'esr', 'switching'])
    const ideal = measures(steadyState(converter('buck', { ...p, Ron: 0, Vf: 0, RL: 0, ESR: 0, tr: 0, tf: 0 })))
    expect(activeMechanisms(ideal)).toEqual([])
    expect(Math.abs(lossLedger(ideal).residual)).toBeLessThan(1e-12 * ideal.Pin)
    expect(lossLedger(ideal).eta).toBeCloseTo(1, 9)
  })

  it('re-balances when one mechanism is switched off, without touching the others’ formulas', () => {
    const noEsr = lossLedger(measures(steadyState(converter('buck', { ...p, ESR: 0 }))))
    expect(noEsr.rows.find((q) => q.key === 'esr').watts).toBe(0)
    expect(Math.abs(noEsr.residual)).toBeLessThan(1e-12 * noEsr.Pin)
    expect(noEsr.eta).toBeGreaterThan(led.eta)
  })
})

describe('the residual is zero across every engine in the package', () => {
  const r = rng(9091)
  const cases = []
  for (const kind of KINDS) {
    for (let i = 0; i < 40; i++) {
      cases.push([
        `${kind} #${i}`,
        () => {
          const p = { Vin: logU(r, 3, 48), D: 0.05 + 0.9 * r(), L: logU(r, 10e-6, 1e-3), C: logU(r, 10e-6, 2.2e-3), R: logU(r, 0.5, 500), fs: logU(r, 30e3, 800e3), sync: r() < 0.3, ...lossy(r) }
          return measures(steadyState(converter(kind, p)))
        },
      ])
    }
  }
  for (let i = 0; i < 20; i++) {
    cases.push([
      `flyback #${i}`,
      () => {
        const p = { Vin: logU(r, 6, 48), D: 0.1 + 0.7 * r(), n: logU(r, 0.2, 2), L: logU(r, 10e-6, 1e-3), C: logU(r, 10e-6, 1e-3), R: logU(r, 1, 200), fs: logU(r, 50e3, 400e3), ...lossy(r) }
        return measures(steadyState(flyback(p)))
      },
    ])
    cases.push([
      `halfbridge #${i}`,
      () => {
        const p = { Vin: logU(r, 24, 48), D: 0.05 + 0.4 * r(), n: logU(r, 0.4, 2), L: logU(r, 10e-6, 1e-3), C: logU(r, 10e-6, 1e-3), R: logU(r, 1, 200), fs: logU(r, 50e3, 400e3), ...lossy(r) }
        return measures(steadyState(halfBridge(p)))
      },
    ])
    cases.push([
      `saturating #${i}`,
      () => {
        const p = { Vin: logU(r, 6, 48), D: 0.15 + 0.6 * r(), L: logU(r, 10e-6, 470e-6), C: logU(r, 10e-6, 1e-3), R: logU(r, 0.5, 40), fs: logU(r, 50e3, 400e3), N: logU(r, 10, 200), Ae: logU(r, 10e-6, 200e-6), Bsat: 0.2 + 0.3 * r(), hard: 2 + 20 * r(), ...lossy(r) }
        return measures(saturatingSteadyState(saturatingConverter('buck', p)))
      },
    ])
    cases.push([
      `rectifier #${i}`,
      () => {
        const p = { Vs: logU(r, 6, 240), f: 50 + 10 * r(), Rs: logU(r, 0.05, 5), Vf: 0.4 + 0.6 * r(), C: logU(r, 47e-6, 4.7e-3), R: logU(r, 10, 1000) }
        const kind = ['half', 'bridge', 'six'][i % 3]
        return rectifierMeasures(rectifierSteadyState(rectifier(kind, p)), { harmonics: 3 })
      },
    ])
  }
  it.each(cases)('%s', (_, build) => {
    const m = build()
    const led = lossLedger(m)
    expect(Number.isFinite(led.residual)).toBe(true)
    expect(Math.abs(led.residual), `residual ${led.residual} of ${led.Pin} W`).toBeLessThan(1e-8 * Math.max(Math.abs(m.Pin), Math.abs(m.Pout), 1e-12))
    expect(led.conduction).toBeGreaterThanOrEqual(-1e-12 * Math.abs(m.Pin))
    expect(led.eta).toBeGreaterThan(0)
    expect(led.eta).toBeLessThanOrEqual(1 + 1e-8)
  })
})

describe('the forms Group G quotes beside the ledger', () => {
  it('puts the switching and conduction curves across each other where the closed form says', () => {
    const base = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Ron: 0.12, sync: true, tr: 20e-9, tf: 20e-9 }
    const at = (fs) => {
      const m = measures(steadyState(converter('buck', { ...base, fs })))
      return { m, led: lossLedger(m) }
    }
    const here = at(100e3)
    const fstar = switchingCrossover({ Ron: base.Ron, Iout: here.m.Iout, Vblk: here.m.Vblk, tsw: base.tr })
    expect(fstar / 1e3).toBeCloseTo(488, 0)
    const cross = at(fstar)
    // At the crossover the two are the same watt, to a part in a hundred.
    expect(Math.abs(cross.led.switching / cross.led.conduction - 1)).toBeLessThan(0.01)
    // Below it conduction leads; above it the edges do.
    expect(at(fstar / 4).led.conduction).toBeGreaterThan(at(fstar / 4).led.switching)
    expect(at(4 * fstar).led.switching).toBeGreaterThan(at(4 * fstar).led.conduction)
  })

  it('peaks the efficiency where the ripple loss equals the load loss, at √3 times the boundary load', () => {
    // No switching edges here: at light load the two edges commutate the
    // ripple rather than the load current, so their cost stops following the
    // load and joins the fixed term, which moves the peak. B8 and G1 own
    // t_sw; this claim is about conduction alone.
    const base = { Vin: 12, D: 5 / 12, L: 22e-6, C: 100e-6, R: 5, fs: 100e3, Ron: 0.1, RL: 0.05, sync: true }
    const Rstar = peakEfficiencyLoad(base)
    expect(Rstar).toBeCloseTo(13.06, 2)
    expect(Rstar / ((2 * base.L * base.fs) / (1 - base.D))).toBeCloseTo(Math.sqrt(3), 12)
    const eta = (R) => measures(steadyState(converter('buck', { ...base, R }))).eta
    const peak = eta(Rstar)
    for (const f of [0.5, 0.8, 1.25, 2, 20]) expect(eta(f * Rstar), `at ${f}×`).toBeLessThan(peak)
    // The ripple loss and the load loss are equal there.
    const m = measures(steadyState(converter('buck', { ...base, R: Rstar })))
    // The load's share of the resistive loss and the ripple's are equal
    // there, to the 2 % the drops themselves move the operating point by.
    const load = m.Iout ** 2
    const ripple = m.sig.iL.rms ** 2 - m.Iout ** 2
    expect(Math.abs(ripple / load - 1)).toBeLessThan(0.03)
  })

  it('gives the boost’s capacitor the load current where the buck’s gets the ripple', () => {
    const p = { Vin: 12, D: 0.5, L: 100e-6, C: 220e-6, R: 24, fs: 100e3, ESR: 0.05 }
    const m = measures(steadyState(converter('boost', p)))
    const dI = inductorRipple('boost', p)
    expect(m.sig.iC.rms).toBeCloseTo(capacitorRms('boost', { D: p.D, Iout: m.Iout, dI }), 2)
    // A buck's capacitor at the same inductor ripple carries the triangle alone.
    const buckLike = capacitorRms('buck', { D: p.D, Iout: m.Iout, dI })
    expect(buckLike).toBeCloseTo(dI / Math.sqrt(12), 12)
    expect(m.sig.iC.rms / buckLike).toBeGreaterThan(5)
    // And the heat is the square of that ratio.
    expect(lossLedger(m).rows.find((q) => q.key === 'esr').watts / (p.ESR * buckLike ** 2)).toBeGreaterThan(30)
  })
})
