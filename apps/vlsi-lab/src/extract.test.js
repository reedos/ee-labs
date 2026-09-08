import { describe, expect, it } from 'vitest'
import { pwlTransient } from '@ee-labs/network'
import { normalize } from '@ee-labs/events'
import { CARD, CU, RU, inverter } from './model.js'
import { edgeResponse, eventChain, extractGate, EXTRACTION_SCOPE } from './extract.js'

const relative = (got, want, tolerance = 2e-12) => expect(Math.abs(got - want)).toBeLessThanOrEqual(Math.abs(want) * tolerance + 1e-27)

describe('isolated inverter extraction', () => {
  it('measures both edges independently of sample spacing across widths and loads', () => {
    let seed = 2718
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
    for (let k = 0; k < 24; k++) {
      const wp = 1 + 15 * random()
      const load = k === 0 ? 0 : 10 ** (-15 + 3 * random())
      const cell = inverter({ wp })
      for (const edge of ['fall', 'rise']) {
        const r = edgeResponse(cell, load, edge, k % 2 ? 17 : 53)
        const resistance = edge === 'fall' ? RU : 2 * RU / wp
        const tau = resistance * ((1 + wp) * CU + load)
        relative(r.measured, tau * Math.LN2)
        relative(r.transition, tau * Math.log(9))
        for (const s of r.walk.samples) {
          const decay = Math.exp(-s.t / tau)
          const voltage = CARD.vdd * (edge === 'fall' ? decay : 1 - decay)
          expect(s.sol.v.out).toBeCloseTo(voltage, 11)
          expect(s.sol.maxResidual).toBeLessThan(1e-12)
        }
        expect(r.walk.regionsAt(r.tEnd)).toEqual(edge === 'fall' ? { Mp: 'off', Mn: 'on' } : { Mp: 'on', Mn: 'off' })
        expect(r.walk.events).toHaveLength(0)
        expect(r.gate.exact).toBe(true)
        expect(r.gate.path).toHaveLength(2)
      }
    }
  })

  it('closes supply charge and resistor energy against the capacitor state', () => {
    for (const wp of [1, 2, 4]) {
      const r = edgeResponse(inverter({ wp }), 3 * CU, 'rise')
      const steps = 400
      const dt = r.tEnd / steps
      let charge = 0
      let heat = 0
      for (let i = 0; i <= steps; i++) {
        const s = r.walk.at(i * dt).sol
        const weight = i === 0 || i === steps ? 1 : i % 2 ? 4 : 2
        charge += weight * -s.i.VDD * dt / 3
        heat += weight * s.p['Mp.ds'] * dt / 3
      }
      const v = r.walk.at(r.tEnd).sol.v.out
      relative(charge, r.gate.ctotal * v, 1e-8)
      relative(heat, CARD.vdd * r.gate.ctotal * v - r.gate.ctotal * v * v / 2, 1e-8)
    }
  })

  it('pins actual ramp threshold events without calling the ramp an RC rail step', () => {
    const cell = inverter()
    const duration = 100e-12
    const net = { elements: cell.net.elements.map((e) => e.id === 'Vin'
      ? { ...e, wave: { kind: 'ramp', from: 0, slope: CARD.vdd / duration } } : e) }
    net.elements.push({ type: 'C', id: 'CL', nodes: ['out', 'gnd'], value: 6 * CU })
    const walk = pwlTransient(net, { tEnd: duration, points: 81, x0: [CARD.vdd] })
    expect(walk.events).toHaveLength(2)
    expect(walk.events.map((e) => [e.id, e.to])).toEqual([['Mn', 'on'], ['Mp', 'off']])
    relative(walk.events[0].t, duration * CARD.vt / CARD.vdd)
    relative(walk.events[1].t, duration * (CARD.vdd - CARD.vt) / CARD.vdd)
    expect(() => extractGate({ ...cell, net }, 0)).toThrow(EXTRACTION_SCOPE)
  })

  it('rejects every unsupported topology or model before claiming exactness', () => {
    const changes = [
      (c) => { c.model = 'square' },
      (c) => { c.net.elements[2].nodes[2] = 'in' },
      (c) => { c.net.elements[2].roff = 1e9 },
      (c) => { c.net.elements[2].cgd = CU },
      (c) => { c.net.elements[2].ron = Infinity },
      (c) => { c.net.elements[2].cgate = NaN },
      (c) => { c.net.elements[2].vt = CARD.vdd },
      (c) => { c.net.elements.push({ type: 'R', id: 'extra', nodes: ['out', 'gnd'], value: 1e6 }) },
      (c) => { c.inputs.push('other') },
      (c) => { c.net.elements[0].value = 5 },
    ]
    for (const change of changes) {
      const c = structuredClone(inverter())
      change(c)
      expect(() => extractGate(c, CU)).toThrow(EXTRACTION_SCOPE)
    }
    for (const load of [-1, NaN, Infinity]) expect(() => extractGate(inverter(), load)).toThrow(/finite and nonnegative/)
  })
})

describe('events contract', () => {
  it('uses real events, with bounded rounding for every permitted chain length and edge', () => {
    for (const wp of [1, 2, 4]) for (const stages of [1, 3, 5, 8]) for (const edge of ['rise', 'fall']) {
      const gate = extractGate(inverter({ wp }), 3 * CU)
      const chain = eventChain(gate, stages, edge)
      expect(chain.exact).toBe(false)
      expect(Math.abs(chain.error)).toBeLessThanOrEqual(chain.bound + 1e-25)
      expect(chain.res.events).toHaveLength(stages + 1)
      for (let i = 1; i <= stages; i++) {
        const wave = chain.res.waves[`q${i}`]
        expect(wave.t).toHaveLength(2)
        const prev = chain.res.waves[i === 1 ? 'in' : `q${i - 1}`]
        const delay = wave.v[1] ? gate.tpLH : gate.tpHL
        expect(wave.t[1] - prev.t[1]).toBe(Math.round(delay / chain.tick))
      }
      const exactNet = { sources: [{ id: 'in', kind: 'input', value: 0 }],
        gates: [{ id: 'q', kind: 'not', in: ['in'], delay: gate.tpHL / chain.tick }], outputs: ['q'] }
      expect(() => normalize(exactNet)).toThrow(/whole number of units/)
    }
  })
})
