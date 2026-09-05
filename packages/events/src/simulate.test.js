import { describe, it, expect } from 'vitest'
import { EventQueue } from './queue.js'
import { EventsError, normalize } from './netlist.js'
import { KINDS, libDelay } from './library.js'
import { initialValue, transitions } from './sources.js'
import { edgesOf, relax, simulate, valueAt } from './simulate.js'
import { hazardNet, masterSlave, mux2, oneGate, ring, srLatch } from './build.js'

// The engine's own arithmetic, before any lesson leans on it. Every number
// here is the library's delay added up, so a change to the library moves the
// expectation with it rather than breaking the test.

describe('the event queue', () => {
  it('hands back every event at the earliest instant as one batch', () => {
    const q = new EventQueue()
    const a = { signal: 'a', value: 1 }
    const b = { signal: 'b', value: 0 }
    const c = { signal: 'c', value: 1 }
    q.push(140, a)
    q.push(70, b)
    q.push(140, c)
    expect(q.size).toBe(3)
    expect(q.nextTime()).toBe(70)
    expect(q.popBatch()).toEqual({ t: 70, events: [b] })
    const batch = q.popBatch()
    expect(batch.t).toBe(140)
    expect(batch.events).toEqual([a, c])
    expect(q.popBatch()).toBeNull()
  })

  it('takes one scheduled event back out and leaves the rest', () => {
    const q = new EventQueue()
    const a = { signal: 'a' }
    const b = { signal: 'b' }
    q.push(100, a)
    q.push(100, b)
    expect(q.remove(100, a)).toBe(true)
    expect(q.remove(100, a)).toBe(false)
    expect(q.popBatch()).toEqual({ t: 100, events: [b] })
  })
})

describe('the netlist', () => {
  it('refuses a signal with two drivers, an input nothing drives, and a fan-in the library has no delay for', () => {
    const twice = { sources: [{ id: 'a', kind: 'input', value: 0 }], gates: [{ id: 'a', kind: 'not', in: ['a'] }], outputs: ['a'] }
    expect(() => normalize(twice)).toThrow(/one driver/)
    const loose = { sources: [], gates: [{ id: 'y', kind: 'and', in: ['a', 'b'] }], outputs: ['y'] }
    expect(() => normalize(loose)).toThrow(/nothing drives it/)
    const wide = { sources: 'abcde'.split('').map((id) => ({ id, kind: 'input', value: 0 })), gates: [{ id: 'y', kind: 'and', in: 'abcde'.split('') }], outputs: ['y'] }
    expect(() => normalize(wide)).toThrow(/2 to 4/)
  })

  it('refuses a zero delay, and says why: a ring with no delay has no waveform', () => {
    const net = { sources: [{ id: 'a', kind: 'input', value: 0 }], gates: [{ id: 'y', kind: 'not', in: ['a'], delay: 0 }], outputs: ['y'] }
    expect(() => normalize(net)).toThrow(/no zero-delay gate/)
    try {
      normalize(net)
    } catch (e) {
      expect(e.code).toBe('zero-delay')
      expect(e).toBeInstanceOf(EventsError)
    }
  })

  it('refuses a time that is not a whole unit, because the exactness rests on it', () => {
    const net = { sources: [{ id: 'a', kind: 'step', at: 12.5, to: 1 }], gates: [{ id: 'y', kind: 'not', in: ['a'] }], outputs: ['y'] }
    expect(() => normalize(net)).toThrow(/whole number of units/)
  })

  it('names the ring a latch is made of, and does not call it an error', () => {
    const norm = normalize(srLatch())
    expect(norm.loop).toEqual(['q', 'qn'])
    expect(norm.combinational).toBe(true)
  })
})

describe('the sources', () => {
  it('a clock rises at its phase and keeps its duty cycle in whole picoseconds', () => {
    const s = normalize({ sources: [{ id: 'clk', kind: 'clock', period: 1000, high: 400, phase: 100 }], gates: [{ id: 'y', kind: 'not', in: ['clk'] }], outputs: ['y'] }).sources[0]
    expect(initialValue(s)).toBe(0)
    expect(transitions(s, 2200).slice(0, 5)).toEqual([
      { t: 100, value: 1 },
      { t: 500, value: 0 },
      { t: 1100, value: 1 },
      { t: 1500, value: 0 },
      { t: 2100, value: 1 },
    ])
  })

  it('a pattern changes only where its bits change, and stops when it is not set to repeat', () => {
    const net = { sources: [{ id: 'd', kind: 'pattern', period: 200, bits: [0, 1, 1, 0] }], gates: [{ id: 'y', kind: 'not', in: ['d'] }], outputs: ['y'] }
    const s = normalize(net).sources[0]
    expect(transitions(s, 2000)).toEqual([
      { t: 200, value: 1 },
      { t: 600, value: 0 },
    ])
    const rep = normalize({ ...net, sources: [{ ...net.sources[0], repeat: true }] }).sources[0]
    expect(transitions(rep, 1000).map((x) => x.t)).toEqual([200, 600, 1000])
  })
})

describe('one gate', () => {
  it('an inverter changes one gate delay after its input, and the event says what caused it', () => {
    const d = libDelay('not', 1)
    const net = { sources: [{ id: 'a', kind: 'step', at: 100, from: 0, to: 1 }], gates: [{ id: 'y', kind: 'not', in: ['a'] }], outputs: ['y'] }
    const res = simulate(net, { tEnd: 500 })
    expect(res.settled).toBe(true)
    expect(edgesOf(res, 'y')).toEqual([{ t: 100 + d, from: 1, to: 0 }])
    const ev = res.events.find((e) => e.signal === 'y')
    expect(ev.cause).toEqual({ signal: 'a', t: 100 })
    expect(ev.t).toBe(ev.cause.t + ev.delay)
    expect(valueAt(res, 'y', 100 + d - 1)).toBe(1)
    expect(valueAt(res, 'y', 100 + d)).toBe(0)
  })

  it('every kind computes its own truth table at its own delay', () => {
    for (const kind of Object.keys(KINDS)) {
      const n = KINDS[kind].fanIn[0]
      const ins = ['a', 'b', 'c'].slice(0, n)
      for (let i = 0; i < 2 ** n; i++) {
        const values = ins.map((_, k) => (i >> k) & 1)
        const res = simulate(oneGate(kind, { ins, values }), { tEnd: 500 })
        expect(res.final.y, `${kind} at ${values}`).toBe(KINDS[kind].fn(values))
        expect(res.events.length, `${kind} at ${values} settles without moving`).toBe(0)
      }
    }
  })

  it('a rise and a fall take their own delays when the two differ', () => {
    const net = {
      sources: [{ id: 'a', kind: 'pattern', period: 500, bits: [0, 1, 0] }],
      gates: [{ id: 'y', kind: 'buf', in: ['a'], tr: 200, tf: 60 }],
      outputs: ['y'],
    }
    const res = simulate(net, { tEnd: 2000 })
    expect(edgesOf(res, 'y')).toEqual([
      { t: 700, from: 0, to: 1 },
      { t: 1060, from: 1, to: 0 },
    ])
  })
})

describe('the two delay models, each exact and each labelled', () => {
  // A 20 ps pulse into a gate whose delay is 60 ps. Transport delay passes it
  // and inertial delay swallows it. Neither is an approximation of the other.
  const pulse = (delayMode) => ({
    name: 'a narrow pulse',
    delayMode,
    sources: [{ id: 'a', kind: 'pattern', period: 20, bits: [0, 1, 0], at: 100 }],
    gates: [{ id: 'y', kind: 'buf', in: ['a'], delay: 60 }],
    outputs: ['y'],
  })

  it('transport delay passes a pulse narrower than the gate', () => {
    const res = simulate(pulse('transport'), { tEnd: 1000 })
    expect(edgesOf(res, 'y')).toEqual([
      { t: 180, from: 0, to: 1 },
      { t: 200, from: 1, to: 0 },
    ])
    expect(res.swallowed).toEqual([])
  })

  it('inertial delay rejects it, and reports the width it rejected', () => {
    const res = simulate(pulse('inertial'), { tEnd: 1000 })
    expect(edgesOf(res, 'y')).toEqual([])
    expect(res.swallowed.length).toBe(1)
    expect(res.swallowed[0]).toMatchObject({ signal: 'y', width: 20, mode: 'inertial' })
  })

  it('an unequal rise and fall overtakes, and the overtaken event is reported rather than lost', () => {
    const net = {
      sources: [{ id: 'a', kind: 'pattern', period: 100, bits: [0, 1, 0], at: 0 }],
      gates: [{ id: 'y', kind: 'buf', in: ['a'], tr: 300, tf: 100 }],
      outputs: ['y'],
    }
    const res = simulate(net, { tEnd: 2000 })
    // The rise would have landed at 400 and the fall lands at 300, so the
    // pulse never reaches the output at all.
    expect(edgesOf(res, 'y')).toEqual([])
    expect(res.swallowed[0]).toMatchObject({ signal: 'y', at: 300, mode: 'transport' })
    expect(res.swallowed[0].dropped).toEqual([{ t: 400, value: 1 }])
  })
})

describe('the static-1 hazard', () => {
  const d = { not: libDelay('not', 1), and: libDelay('and', 2), or: libDelay('or', 2) }

  it('the pulse is exactly the inverter delay wide, and it sits where the two paths reconverge', () => {
    const net = { ...hazardNet({ a: 1, b: 1, c: 1 }), sources: [{ id: 'a', kind: 'step', at: 100, from: 1, to: 0 }, { id: 'b', kind: 'input', value: 1 }, { id: 'c', kind: 'input', value: 1 }] }
    const res = simulate(net, { tEnd: 1000 })
    expect(edgesOf(res, 'y')).toEqual([
      { t: 100 + d.and + d.or, from: 1, to: 0 },
      { t: 100 + d.not + d.and + d.or, from: 0, to: 1 },
    ])
    const [fall, rise] = edgesOf(res, 'y')
    expect(rise.t - fall.t).toBe(d.not)
    expect(res.final.y).toBe(1)
  })

  it('the consensus term covers it, and the output does not move at all', () => {
    const net = { ...hazardNet({ consensus: true }), sources: [{ id: 'a', kind: 'step', at: 100, from: 1, to: 0 }, { id: 'b', kind: 'input', value: 1 }, { id: 'c', kind: 'input', value: 1 }] }
    const res = simulate(net, { tEnd: 1000 })
    expect(edgesOf(res, 'y')).toEqual([])
    expect(res.final.y).toBe(1)
  })
})

describe('the netlists that remember', () => {
  it('the set-reset latch keeps its state after the set pulse ends', () => {
    const net = { ...srLatch({ q: 0 }), sources: [{ id: 's', kind: 'pattern', period: 200, bits: [0, 1, 0], at: 100 }, { id: 'r', kind: 'input', value: 0 }] }
    const res = simulate(net, { tEnd: 2000 })
    expect(res.settled).toBe(true)
    expect(res.final.q).toBe(1)
    expect(res.final.qn).toBe(0)
    // Set at 300, qn falls one NOR later, q rises one NOR after that.
    const nor = libDelay('nor', 2)
    expect(edgesOf(res, 'qn')).toEqual([{ t: 300 + nor, from: 1, to: 0 }])
    expect(edgesOf(res, 'q')).toEqual([{ t: 300 + 2 * nor, from: 0, to: 1 }])
  })

  it('a ring of three inverters has no settled state, and its period is two laps', () => {
    const d = libDelay('not', 1)
    const res = simulate(ring(3), { tEnd: 1000 })
    expect(res.settled).toBe(false)
    const ts = edgesOf(res, 'i0').map((e) => e.t)
    expect(ts.slice(0, 3)).toEqual([d, 4 * d, 7 * d])
    expect(ts[2] - ts[0]).toBe(2 * 3 * d)
  })

  it('the flip-flop built from two latches passes D through on the clock edge, once', () => {
    const res = simulate(masterSlave({ d: 1, period: 2000 }), { tEnd: 6000 })
    expect(res.settled).toBe(true)
    expect(edgesOf(res, 'q')).toEqual([{ t: 100, from: 0, to: 1 }])
    expect(res.final.q).toBe(1)
    expect(res.final.qn).toBe(0)
  })
})

describe('the flip-flop primitive, and what it reports', () => {
  const net = (over = {}) => ({
    sources: [{ id: 'clk', kind: 'clock', period: 1000, high: 500, phase: 500 }, { id: 'd', kind: 'step', at: over.at ?? 100, from: 0, to: 1 }],
    flops: [{ id: 'q', d: 'd', clk: 'clk', tcq: 80, tsu: 40, th: 20, init: 0 }],
    outputs: ['q'],
  })

  it('samples the D that stood before the edge, and moves Q one clock-to-Q later', () => {
    const res = simulate(net(), { tEnd: 3000 })
    expect(edgesOf(res, 'q')).toEqual([{ t: 580, from: 0, to: 1 }])
    expect(res.violations).toEqual([])
  })

  it('reports a setup violation with the slack, and does not pretend to know what the flip-flop did', () => {
    const res = simulate(net({ at: 480 }), { tEnd: 3000 })
    expect(res.violations).toEqual([{ kind: 'setup', flop: 'q', t: 500, actual: 20, required: 40, slack: -20, d: 'd' }])
    // The model took the value that stood in the instant before the edge, and
    // that is a modelling choice rather than a measurement. What the cell
    // really does here is metastability.js's business, and the violation is
    // how the run says so.
    expect(res.final.q).toBe(1)
  })

  it('reports a hold violation when D moves too soon after the edge', () => {
    const res = simulate(net({ at: 510 }), { tEnd: 3000 })
    expect(res.violations).toEqual([{ kind: 'hold', flop: 'q', t: 500, actual: 10, required: 20, slack: -10, d: 'd' }])
  })

  it('reports both when D moves on the edge itself', () => {
    const res = simulate(net({ at: 500 }), { tEnd: 3000 })
    expect(res.violations.map((v) => v.kind).sort()).toEqual(['hold', 'setup'])
    expect(res.violations.every((v) => v.slack < 0)).toBe(true)
  })
})

describe('relaxation at t = 0', () => {
  it('holds a gate given an init and settles the rest around it', () => {
    const { value, settled } = relax(normalize(srLatch({ q: 1 })))
    expect(value.get('q')).toBe(1)
    expect(value.get('qn')).toBe(0)
    expect(settled).toBe(true)
  })

  it('settles a chain however deep it is, in one call', () => {
    const gates = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, kind: 'not', in: [i === 0 ? 'a' : `n${i - 1}`] }))
    const net = { sources: [{ id: 'a', kind: 'input', value: 1 }], gates, outputs: ['n11'] }
    const { value, settled } = relax(normalize(net))
    expect(settled).toBe(true)
    // Twelve inverters, so the far end holds what the input holds.
    expect(value.get('n11')).toBe(1)
    expect(simulate(net, { tEnd: 2000 }).events).toEqual([])
  })
})

describe('a run that never ends is stopped and named', () => {
  it('a ring that outruns the run reports the runaway rather than hanging', () => {
    expect(() => simulate(ring(3), { tEnd: 100000000, maxEvents: 500 })).toThrow(/oscillates faster/)
  })
})

describe('the multiplexer picks, at the delay of the path through it', () => {
  it('follows a when s is 0 and b when s is 1', () => {
    for (const [a, b, s] of [[0, 1, 0], [0, 1, 1], [1, 0, 0], [1, 0, 1]]) {
      const res = simulate(mux2({ a, b, s }), { tEnd: 1000 })
      expect(res.final.y, `a=${a} b=${b} s=${s}`).toBe(s ? b : a)
    }
  })
})
