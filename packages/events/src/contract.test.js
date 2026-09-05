import { describe, it, expect } from 'vitest'
import { EventsError, normalize, resolveValues, secondsOf, unitOf } from './netlist.js'
import { edgesOf, simulate } from './simulate.js'
import { evaluate, criticalPath, truthTable } from './analyse.js'

// What the labs downstream of this package asked for, and what this package
// promises them. Every case here is a requirement from the VLSI, Computer or
// Interfaces plan's §2.3, tested here so that a change to the engine that
// breaks one of them fails before that lab notices.

describe('a net with more than one driver', () => {
  // The open-drain bus. Two devices share one line, each either pulls it low or
  // releases it, and a pull-up holds it high when nobody pulls. That is the
  // wired conjunction, and it is the Interfaces Lab's requirement.
  const bus = (rule, { a = 1, b = 1 } = {}) => ({
    name: 'an open-drain bus',
    resolve: { sda: rule },
    sources: [{ id: 'da', kind: 'input', value: a }, { id: 'db', kind: 'input', value: b }],
    gates: [
      { id: 'ua', kind: 'buf', in: ['da'], out: 'sda' },
      { id: 'ub', kind: 'buf', in: ['db'], out: 'sda' },
    ],
    outputs: ['sda'],
  })

  it('resolves as a wired conjunction, so either device can pull the line low', () => {
    for (const [a, b] of [[1, 1], [1, 0], [0, 1], [0, 0]]) {
      const res = simulate(bus('wired-and', { a, b }), { tEnd: 500 })
      expect(res.final.sda, `a=${a} b=${b}`).toBe(a & b)
      expect(res.conflicts).toEqual([])
    }
  })

  it('resolves as a wired disjunction when the net says so', () => {
    for (const [a, b] of [[1, 1], [1, 0], [0, 1], [0, 0]]) {
      expect(simulate(bus('wired-or', { a, b }), { tEnd: 500 }).final.sda, `a=${a} b=${b}`).toBe(a | b)
    }
  })

  it('reports a conflict as an event under the default rule, rather than picking a winner', () => {
    const agree = simulate(bus('single', { a: 1, b: 1 }), { tEnd: 500 })
    expect(agree.conflicts).toEqual([])
    const clash = simulate(bus('single', { a: 1, b: 0 }), { tEnd: 500 })
    expect(clash.conflicts.length).toBeGreaterThan(0)
    expect(clash.conflicts[0]).toMatchObject({ net: 'sda', drivers: ['ua', 'ub'] })
    expect(clash.conflicts[0].values.sort()).toEqual([0, 1])
  })

  it('declines to put a conflicting net in a truth table, and names the net', () => {
    expect(() => truthTable(bus('single'))).toThrow(/disagree/)
    try {
      evaluate(bus('single', { a: 1, b: 0 }), { da: 1, db: 0 })
    } catch (e) {
      expect(e.code).toBe('driver-conflict')
      expect(e.detail.net).toBe('sda')
    }
  })

  it('tables and times a wired net like any other', () => {
    const t = truthTable(bus('wired-and'))
    expect(t.rows.map((r) => r.out[0])).toEqual([0, 0, 0, 1])
    // Both drivers are buffers, so the bus arrives one buffer after either input.
    expect(criticalPath(bus('wired-and')).delay).toBe(40)
  })

  it("resolves one driver's value unchanged, whatever the rule", () => {
    for (const rule of ['single', 'wired-and', 'wired-or']) {
      expect(resolveValues(rule, [1])).toEqual({ value: 1, conflict: false })
      expect(resolveValues(rule, [0])).toEqual({ value: 0, conflict: false })
    }
  })

  it('refuses a resolution rule it does not have, and refuses two drivers with one id', () => {
    expect(() => normalize({ ...bus('wired-xor') })).toThrow(/single, wired-and, wired-or/)
    const twice = {
      sources: [{ id: 'a', kind: 'input', value: 0 }],
      gates: [{ id: 'y', kind: 'buf', in: ['a'] }, { id: 'y', kind: 'not', in: ['a'], out: 'z' }],
      outputs: ['y'],
    }
    expect(() => normalize(twice)).toThrow(/names one driver/)
  })
})

describe('the time unit, as an exact rational number of seconds', () => {
  it('defaults to one picosecond', () => {
    expect(unitOf({})).toEqual({ num: 1, den: 1e12 })
    expect(secondsOf(unitOf({}), 30)).toBeCloseTo(30e-12, 24)
  })

  it('holds a baud rate and a gate delay in one netlist, both as whole numbers', () => {
    // 9600 baud is a bit time of 1/9600 s, which is not a whole number of
    // picoseconds. On a grid of 1/(3 × 10¹¹) s it is 31 250 000 units, and a
    // 30 ps gate beside it is 9 units. Both exact, in one run.
    const unit = { num: 1, den: 3e11 }
    const bit = 3e11 / 9600
    expect(Number.isInteger(bit)).toBe(true)
    expect(bit).toBe(31250000)
    const gate = Math.round(30e-12 * 3e11)
    expect(gate).toBe(9)
    expect(secondsOf(unit, bit)).toBeCloseTo(1 / 9600, 12)
    const net = {
      unit,
      sources: [{ id: 'tx', kind: 'pattern', period: bit, bits: [1, 0, 1, 1, 0, 1], repeat: false }],
      gates: [{ id: 'rx', kind: 'buf', in: ['tx'], delay: gate }],
      outputs: ['rx'],
    }
    const res = simulate(net, { tEnd: 10 * bit })
    expect(res.unit).toEqual(unit)
    // Ten bit times later the edge is still on the grid, with nothing drifting.
    const last = edgesOf(res, 'rx').slice(-1)[0]
    expect(Number.isInteger(last.t)).toBe(true)
    expect((last.t - gate) % bit).toBe(0)
  })

  it('refuses a unit that is not a positive rational', () => {
    expect(() => normalize({ unit: { num: 0, den: 1 }, sources: [{ id: 'a', kind: 'input' }], outputs: ['a'] })).toThrow(/positive rational/)
  })
})

describe('a cell a consumer registers', () => {
  // packages/events stays general. A lab that needs a cell this library does
  // not have registers it on its own netlist, so an extracted VLSI cell or an
  // Interfaces pin model never becomes this package's business.
  const majority = {
    maj3: { name: 'MAJ3', fanIn: [3, 3], fn: (v) => (v[0] + v[1] + v[2] >= 2 ? 1 : 0), delay: { 3: 110 } },
  }
  const net = (values) => ({
    cells: majority,
    sources: ['a', 'b', 'c'].map((id, i) => ({ id, kind: 'input', value: values[i] })),
    gates: [{ id: 'y', kind: 'maj3', in: ['a', 'b', 'c'] }],
    outputs: ['y'],
  })

  it('computes its own function, at its own delay, without the library knowing about it', () => {
    const t = truthTable(net([0, 0, 0]))
    expect(t.rows.map((r) => r.out[0])).toEqual([0, 0, 0, 1, 0, 1, 1, 1])
    expect(criticalPath(net([0, 0, 0])).delay).toBe(110)
  })

  it('is refused where it is not registered, with the kinds that are', () => {
    const bare = { ...net([0, 0, 0]), cells: undefined }
    expect(() => normalize(bare)).toThrow(/this netlist has not, buf/)
  })
})

describe('the call shapes the downstream plans assume', () => {
  const design = {
    sources: [{ id: 'a', kind: 'input', value: 0 }, { id: 'b', kind: 'input', value: 0 }],
    gates: [{ id: 'y', kind: 'and', in: ['a', 'b'], tpLH: 70, tpHL: 70 }],
    outputs: ['y'],
  }

  it('takes a stimulus list beside the netlist, and an until instead of a tEnd', () => {
    const res = simulate(design, [{ t: 100, net: 'a', value: 1 }, { t: 200, net: 'b', value: 1 }], { until: 600 })
    expect(edgesOf(res, 'y')).toEqual([{ t: 270, from: 0, to: 1 }])
    expect(res.tEnd).toBe(600)
  })

  it('reads back as a set of values at a time, and as one net’s changes', () => {
    const res = simulate(design, [{ t: 100, net: 'a', value: 1 }, { t: 200, net: 'b', value: 1 }], { until: 600 })
    expect(res.at(0)).toEqual({ a: 0, b: 0, y: 0 })
    expect(res.at(250)).toEqual({ a: 1, b: 1, y: 0 })
    expect(res.at(300)).toEqual({ a: 1, b: 1, y: 1 })
    expect(res.waveform('y')).toEqual([{ t: 0, value: 0 }, { t: 270, value: 1 }])
  })

  it('reads a gate’s rise and fall delays under either pair of names', () => {
    const norm = normalize({ ...design, gates: [{ id: 'y', kind: 'and', in: ['a', 'b'], tpLH: 90, tpHL: 40 }] })
    expect(norm.gates[0].tr).toBe(90)
    expect(norm.gates[0].tf).toBe(40)
    const flops = normalize({
      sources: [{ id: 'clk', kind: 'clock', period: 1000 }, { id: 'd', kind: 'input', value: 0 }],
      flops: [{ id: 'q', d: 'd', clk: 'clk', tPcq: 60, tSetup: 30, tHold: 15 }],
      outputs: ['q'],
    }).flops[0]
    expect([flops.tcq, flops.tsu, flops.th]).toEqual([60, 30, 15])
  })

  it('carries a net name and a value on every event, beside the signal and the direction', () => {
    const res = simulate(design, [{ t: 100, net: 'a', value: 1 }, { t: 200, net: 'b', value: 1 }], { until: 600 })
    const ev = res.events.find((e) => e.net === 'y')
    expect(ev.signal).toBe(ev.net)
    expect(ev.value).toBe(ev.to)
    expect(ev.from).toBe(0)
    expect(ev.cause).toEqual({ signal: 'b', t: 200 })
  })

  it('refuses a stimulus on a net the design does not have', () => {
    expect(() => simulate(design, [{ t: 10, net: 'nope', value: 1 }], { until: 100 })).toThrow(/no such net/)
    try {
      simulate(design, [{ t: 10, net: 'nope', value: 1 }], { until: 100 })
    } catch (e) {
      expect(e).toBeInstanceOf(EventsError)
      expect(e.code).toBe('undriven')
    }
  })
})
