import { describe, it, expect } from 'vitest'
import { transient } from '@ee-labs/network'
import { bestEfficiency, efficiencyCurve, lossSplit, lossesOf, thermal, thermalNetlist } from './losses.js'
import { SATURATION_MODELS, saturate, saturationLabel, saturationOf } from './saturation.js'

describe('the loss split', () => {
  it('scales copper with the square of the load and leaves the rest alone', () => {
    const one = lossSplit({}, 1)
    for (const x of [0.25, 0.5, 2]) {
      const s = lossSplit({}, x)
      expect(s.pCu / (one.pCu * x * x)).toBeCloseTo(1, 12)
      expect(s.pCore).toBeCloseTo(one.pCore, 12)
      expect(s.pFriction).toBeCloseTo(one.pFriction, 12)
    }
  })

  it('adds up: input equals output plus every loss', () => {
    for (const x of [0.1, 0.5, 1, 1.3]) {
      const s = lossSplit({}, x)
      expect(s.pIn / (s.pOut + s.pCu + s.pStray + s.pCore + s.pFriction)).toBeCloseTo(1, 12)
    }
  })
})

describe('efficiency', () => {
  it('peaks where the variable loss equals the fixed loss', () => {
    const best = bestEfficiency({})
    expect(best.variable / best.fixed).toBeCloseTo(1, 10)
  })

  it('is the highest point of the swept curve', () => {
    const best = bestEfficiency({})
    const curve = efficiencyCurve({}, { from: 0.05, to: 1.5, points: 2001 })
    expect(best.efficiency / Math.max(...curve.efficiency)).toBeCloseTo(1, 5)
    for (const d of [0.6, 0.8, 1.25, 1.6]) expect(lossSplit({}, best.x * d).efficiency).toBeLessThan(best.efficiency)
  })

  it('puts the peak below full load for this machine, and says where', () => {
    const m = lossesOf({})
    const best = bestEfficiency({})
    expect(best.x).toBeCloseTo(Math.sqrt((m.pCore + m.pFriction) / (m.pCuFull + m.strayFraction * m.pOut)), 12)
    expect(best.x).toBeLessThan(1)
  })
})

describe('the thermal limit', () => {
  it('rises by P·R_th and settles with the time constant R_th·C_th', () => {
    const m = lossesOf({})
    const loss = lossSplit({}, 1).loss
    const th = thermal({}, loss)
    expect(th.rise).toBeCloseTo(loss * m.Rth, 12)
    expect(th.tau).toBeCloseTo(m.Rth * m.Cth, 12)
    expect(th.riseAt(th.tau) / (th.rise * (1 - Math.exp(-1)))).toBeCloseTo(1, 12)
  })

  it('matches the same model solved as a circuit', () => {
    const loss = lossSplit({}, 1).loss
    const th = thermal({}, loss)
    const tr = transient(thermalNetlist({}, loss), { tEnd: 6 * th.tau, points: 601 })
    expect(tr.at(th.tau).sol.v.hot / th.riseAt(th.tau)).toBeCloseTo(1, 9)
    expect(tr.at(6 * th.tau).sol.v.hot / th.rise).toBeCloseTo(1, 2)
  })

  it('names the loss the insulation class allows, and the load that reaches it', () => {
    const m = lossesOf({})
    const th = thermal({}, lossSplit({}, 1).loss)
    expect(th.limitLoss).toBeCloseTo((m.classLimit - m.ambient) / m.Rth, 12)
    expect(th.over).toBe(false)
    expect(thermal({}, th.limitLoss * 1.1).over).toBe(true)
    // The overload that just reaches the class limit, from the same closed form.
    const varFull = m.pCuFull + m.strayFraction * m.pOut
    const x = Math.sqrt((th.limitLoss - m.pCore - m.pFriction) / varFull)
    expect(lossSplit({}, x).loss / th.limitLoss).toBeCloseTo(1, 10)
    expect(x).toBeGreaterThan(1)
  })

  it('says a temperature above the final rise is never reached', () => {
    const th = thermal({}, 100)
    expect(th.timeTo(th.final + 1)).toBe(Infinity)
    expect(th.timeTo(th.machine.ambient + th.rise / 2) / (th.tau * Math.log(2))).toBeCloseTo(1, 10)
  })
})

describe('saturation is a labelled model, never a law', () => {
  it('is off by default, and the label says every number is exact', () => {
    expect(saturationOf({}).model).toBe('linear')
    expect(SATURATION_MODELS.linear.exact).toBe(true)
    expect(saturationLabel({})).toMatch(/exact/)
  })

  it('is linear below the knee and much stiffer above it', () => {
    const spec = { model: 'knee', L0: 8, lambdaSat: 1.2, hard: 20 }
    const s = saturationOf(spec)
    const iKnee = s.lambdaSat / s.L0
    expect(saturate(spec, iKnee * 0.5).L).toBeCloseTo(s.L0, 12)
    expect(saturate(spec, iKnee * 0.5).saturated).toBe(false)
    expect(saturate(spec, iKnee * 3).L).toBeCloseTo(s.L0 / s.hard, 12)
    expect(saturate(spec, iKnee * 3).saturated).toBe(true)
    // Continuous at the knee: the flux does not jump.
    const eps = 1e-12
    expect(saturate(spec, iKnee + eps).lambda).toBeCloseTo(saturate(spec, iKnee - eps).lambda, 10)
  })

  it('is odd in the current, both ways', () => {
    for (const model of ['knee', 'atan']) {
      for (const i of [0.05, 0.3, 2]) {
        expect(saturate({ model }, -i).lambda).toBeCloseTo(-saturate({ model }, i).lambda, 10)
      }
    }
  })

  it('never claims to be exact once it is on, and names the model in the label', () => {
    for (const model of ['knee', 'atan']) {
      expect(saturate({ model }, 1).exact).toBe(false)
      expect(saturationLabel({ model })).toMatch(/model of iron/)
      expect(saturationLabel({ model })).toContain(SATURATION_MODELS[model].name)
    }
    expect(SATURATION_MODELS.atan.transient).toBe(false)
  })

  it('holds the arctangent curve below the saturation flux at every current', () => {
    const spec = { model: 'atan', L0: 8, lambdaSat: 1.2 }
    for (const i of [0.01, 0.1, 1, 10, 1000]) expect(saturate(spec, i).lambda).toBeLessThan(spec.lambdaSat)
    // …and its slope at the origin is L₀.
    const h = 1e-7
    expect((saturate(spec, h).lambda - saturate(spec, -h).lambda) / (2 * h)).toBeCloseTo(spec.L0, 5)
  })

  it('refuses a model it does not have and values it cannot use', () => {
    expect(() => saturationOf({ model: 'nonesuch' })).toThrow(/unknown saturation model/)
    expect(() => saturationOf({ L0: 0 })).toThrow(/inductance/)
    expect(() => saturationOf({ hard: 0.5 })).toThrow(/saturated inductance/)
  })
})
