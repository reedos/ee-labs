import { describe, expect, it } from 'vitest'
import { newtonDC } from '@ee-labs/network'
import { GROUP_D } from '../../electronics-lab/src/groups/d.js'
import { CARD, CU, RU, DEFAULTS, dcPoint, inverter, transfer } from './model.js'
import { analyse, byId, EXPERIMENTS } from './experiments.js'
import { edgeResponse } from './extract.js'
import { TERMS } from './terms.js'

const dc = transfer()
const near = (got, want, relative = 1e-10) => expect(Math.abs(got - want)).toBeLessThan(Math.abs(want) * relative + 1e-26)

describe('Group A independent lesson pins', () => {
  it('A1 pins capacitance, both exponential edges and fanout try steps', () => {
    for (const fanout of [1, 4]) for (const edge of ['fall', 'rise']) {
      const x = analyse({ ...DEFAULTS, fanout, edge })
      const c = (1 + 2 + 3 * fanout) * CARD.width * (CARD.length + 2 * CARD.overlap) * CARD.cox
      near(x.gate.ctotal, c)
      near(x.response.measured, 0.75 * CARD.vdd / CARD.idsat * c * Math.log(2))
      near(x.response.walk.at(x.response.tau).sol.v.out,
        CARD.vdd * (edge === 'fall' ? Math.exp(-1) : 1 - Math.exp(-1)))
    }
  })

  it('A2 pins unity slopes, output limits, actual margins, symmetry and supply currents', () => {
    const { vdd, vt } = CARD
    expect(dc.vil).toBeCloseTo((3 * vdd + 2 * vt) / 8, 7)
    expect(dc.vih).toBeCloseTo((5 * vdd - 2 * vt) / 8, 7)
    const slope = (v) => (dcPoint(v + 2e-6).v.out - dcPoint(v - 2e-6).v.out) / 4e-6
    expect(slope(dc.vil)).toBeCloseTo(-1, 6)
    expect(slope(dc.vih)).toBeCloseTo(-1, 6)
    const expectedVol = (vdd - 2 * vt) / 8
    expect(dc.vol).toBeCloseTo(expectedVol, 7)
    expect(dc.voh).toBeCloseTo(vdd - expectedVol, 7)
    expect(dc.nml).toBeCloseTo((vdd + 2 * vt) / 4, 7)
    expect(dc.nmh).toBeCloseTo(dc.nml, 7)
    expect(dcPoint(dc.vm).v.out).toBeCloseTo(vdd / 2, 5)
    for (const vin of [0, vdd]) {
      const square = dcPoint(vin)
      const sw = dcPoint(vin, 'switch')
      expect(square.v.out).toBeCloseTo(vdd - vin, 9)
      expect(square.v.out).toBeCloseTo(sw.v.out, 9)
      expect(Math.abs(square.i.VDD)).toBeLessThan(1e-12)
      expect(Math.abs(sw.i.VDD)).toBeLessThan(1e-12)
    }
    for (const vin of [0.6, 0.9, 1.2]) {
      expect(Math.abs(dcPoint(vin).i.VDD)).toBeGreaterThan(1e-6)
      expect(dcPoint(vin).v.out + dcPoint(vdd - vin).v.out).toBeCloseTo(vdd, 5)
      near(dcPoint(vin, 'switch').v.out, vdd / 2)
    }
    expect(dcPoint(vt, 'switch')).toBeNull()
    expect(dcPoint(vdd - vt, 'switch')).toBeNull()
    expect(dc.samples.filter((p) => p.switch === null)).toHaveLength(2)
  })

  it('A3 pins extraction to measured crossings and the increasing event sum', () => {
    const x = analyse(DEFAULTS)
    near(x.gate.tpHL, edgeResponse(x.cell, x.load, 'fall').measured)
    near(x.gate.tpLH, edgeResponse(x.cell, x.load, 'rise').measured)
    const next = analyse({ ...DEFAULTS, stages: 5 })
    near(x.chain.reference, DEFAULTS.stages * RU * 6 * CU * Math.LN2)
    expect(next.chain.elapsed).toBeGreaterThan(x.chain.elapsed)
    expect(Math.abs(next.chain.error)).toBeLessThanOrEqual(next.chain.bound)
  })

  it('A4 pins width-dependent self-load, edge ratio and the matching width', () => {
    for (const wp of [1, 2, 4]) {
      const x = analyse({ ...DEFAULTS, wp })
      near(x.gate.cself, (1 + wp) * CU)
      near(x.gate.tpLH / x.gate.tpHL, CARD.mobilityRatio / wp)
      near(edgeResponse(x.cell, x.load, 'rise').measured, 2 * RU / wp * (wp + 4) * CU * Math.LN2)
      near(x.response.measured, RU * (wp + 4) * CU * Math.LN2)
    }
  })

  it('A5 pins measured line slope and intercept including ln(2)', () => {
    const measured = [0, 1, 4, 8].map((f) => ({ f, t: edgeResponse(inverter(), f * 3 * CU).measured }))
    const slope = (measured[3].t - measured[1].t) / (measured[3].f - measured[1].f)
    near(slope, RU * 3 * CU * Math.LN2)
    near(measured[0].t, RU * 3 * CU * Math.LN2)
    for (const { f, t } of measured) near(t, slope * f + measured[0].t)
    expect(measured[0].t).toBeGreaterThan(0)
  })
})

describe('curriculum and prerequisites', () => {
  it('ships exactly five lessons with working steps and complete term definitions', () => {
    expect(EXPERIMENTS.map((e) => e.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5'])
    for (const e of EXPERIMENTS) {
      expect(byId[e.id]).toBe(e)
      expect(e.try.length).toBeGreaterThan(0)
      for (const term of e.terms) expect(TERMS[term]?.def.length).toBeGreaterThan(0)
      let p = { ...e.defaults }
      for (const step of [{ set: {} }, ...e.try]) {
        p = { ...p, ...step.set }
        const x = analyse(p, e.id === 'a2' ? dc : null)
        expect(e.see(x, p)).not.toMatch(/NaN|undefined|Infinity/)
        expect(x.response.measured).toBeGreaterThan(0)
      }
    }
    expect(new Set(EXPERIMENTS.flatMap((e) => e.terms))).toEqual(new Set(Object.keys(TERMS)))
  })

  it('pins sequential try walks while keeping settings from preceding steps', () => {
    for (const e of EXPERIMENTS) {
      let p = { ...e.defaults }
      const walk = [analyse(p, e.id === 'a2' ? dc : null)]
      for (const step of e.try) {
        p = { ...p, ...step.set }
        const x = analyse(p, e.id === 'a2' ? dc : null)
        near(x.response.measured, RU * (p.edge === 'rise' ? 2 / p.wp : 1) *
          (1 + p.wp + 3 * p.fanout) * CU * Math.LN2)
        walk.push(x)
      }
      if (e.id === 'a1') {
        expect(p.fanout).toBe(4)
        expect(p.edge).toBe('rise')
        expect(walk[1].response.measured).toBeGreaterThan(walk[0].response.measured)
        near(walk[2].response.measured, walk[1].response.measured)
      }
      if (e.id === 'a2') {
        expect(walk[1].point.v.out).toBeCloseTo(CARD.vdd, 9)
        expect(walk[2].point.v.out).toBeCloseTo(0, 9)
      }
      if (e.id === 'a3') expect(walk[1].chain.elapsed).toBeGreaterThan(walk[0].chain.elapsed)
      if (e.id === 'a4') {
        expect(walk[1].gate.tpLH).toBeGreaterThan(walk[1].gate.tpHL)
        expect(walk[2].gate.tpLH).toBeLessThan(walk[2].gate.tpHL)
      }
      if (e.id === 'a5') {
        expect(walk[1].response.measured).toBeGreaterThan(walk[0].response.measured)
        expect(walk[2].response.measured).toBeGreaterThan(walk[1].response.measured)
      }
    }
  })

  it('verifies built Electronics D IDs and the same square-law law at its supply', () => {
    for (const id of ['d4', 'd5', 'd6', 'd7']) expect(GROUP_D.some((e) => e.id === id)).toBe(true)
    const d6 = GROUP_D.find((e) => e.id === 'd6')
    const p = Object.fromEntries(d6.params.map((k) => [k.key, k.default]))
    for (const vin of [0, 2.05, 2.95, 5]) {
      const existing = newtonDC(d6.net({ ...p, vin })).sol.v.out
      const local = newtonDC(inverter({ model: 'square', vin, vdd: 5, vt: p.vt }).net).sol.v.out
      expect(local).toBeCloseTo(existing, 6)
    }
  })
})
