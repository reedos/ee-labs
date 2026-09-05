import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { simulate, hazardNet, DETECTOR_101, fsmTable } from '@ee-labs/events'
import TimingCanvas, { busAt, geometryOf, heightOf, rowsOf } from './TimingCanvas.jsx'
import StateCanvas, { layoutOf, sceneOf } from './StateCanvas.jsx'

// The two canvases this lab builds new (LOGIC_LAB_PLAN.md Decision 5).
//
// Both carry props for labs that do not exist yet, and a prop nothing draws is
// a prop that is wrong the day someone needs it. So each one is measured here
// against the geometry it produces: the bus row's word, the span's width, the
// analog row's two threshold levels and its cursor pair, the cause line's two
// ends, and the state diagram's Moore output, encoding and lit arc.
//
// The geometry is computed by a pure function that the draw call then reads,
// so what a test measures is what the reader sees rather than a second copy of
// the arithmetic.

const glitch = () => {
  const base = hazardNet({ a: 1, b: 1, c: 1 })
  return simulate({ ...base, sources: base.sources.map((s) => (s.id === 'a' ? { id: 'a', kind: 'step', at: 200, from: 1, to: 0 } : s)) }, { tEnd: 700 })
}

describe('the timing diagram', () => {
  const res = glitch()
  const signals = ['a', 'na', 'p', 'q', 'y']

  it('draws one row per signal, in the order it was given, and grows with the count', () => {
    const rows = rowsOf({ res, signals })
    expect(rows.map((r) => r.label)).toEqual(signals)
    expect(rows.every((r) => r.kind === 'signal')).toBe(true)
    expect(heightOf(rows)).toBeGreaterThan(heightOf(rows.slice(1)))
    // A signal the run does not have is left out rather than drawn empty.
    expect(rowsOf({ res, signals: [...signals, 'nope'] }).map((r) => r.label)).toEqual(signals)
  })

  it('spaces the rows evenly and puts every one inside the height it asks for', () => {
    const rows = rowsOf({ res, signals })
    const geo = geometryOf({ rows, width: 640, window: [0, res.tEnd] })
    const gaps = geo.rows.slice(1).map((r, i) => r.top - geo.rows[i].top)
    expect(new Set(gaps).size).toBe(1)
    for (const r of geo.rows) {
      expect(r.top, r.label).toBeGreaterThan(0)
      expect(r.bot, r.label).toBeLessThan(geo.height)
      expect(r.labelX, r.label).toBeLessThan(geo.left)
    }
    expect(geo.sx(0)).toBe(geo.left)
    expect(geo.sx(res.tEnd)).toBeCloseTo(geo.left + geo.plotW, 6)
  })

  it('draws a set of signals as one numeric row, reading the word they spell', () => {
    // The Interfaces Lab's bus row. The members leave the signal list, and the
    // word the row prints is the value those signals held at that instant.
    const busses = [{ label: 'both', signals: ['p', 'q'] }]
    const rows = rowsOf({ res, signals, busses })
    expect(rows[0]).toMatchObject({ kind: 'bus', label: 'both' })
    expect(rows.map((r) => r.label)).toEqual(['both', 'a', 'na', 'y'])
    expect(busAt(res, ['p', 'q'], 0)).toBe(2 * res.at(0).p + res.at(0).q)
    expect(busAt(res, ['p', 'q'], res.tEnd)).toBe(2 * res.at(res.tEnd).p + res.at(res.tEnd).q)
  })

  it('measures a span at the width it was given, on the row it names', () => {
    const es = res.events.filter((e) => e.signal === 'y')
    const span = { from: es[0].t, to: es[1].t, signal: 'y', label: 'the glitch' }
    const geo = geometryOf({ rows: rowsOf({ res, signals }), width: 640, window: [0, res.tEnd], spans: [span] })
    expect(geo.spans[0].width).toBe(es[1].t - es[0].t)
    expect(geo.spans[0].x2 - geo.spans[0].x1).toBeCloseTo((geo.spans[0].width / res.tEnd) * geo.plotW, 6)
  })

  it('draws one row as an analog trace against two threshold levels', () => {
    // The Interfaces Lab's pin. This lab has no analog signal, so the prop is
    // driven with a synthetic trace, and the two levels have to land where the
    // volts say rather than where the row happens to be.
    const analog = [{ label: 'the pin', unit: 'V', min: 0, max: 3.3, vLow: 0.8, vHigh: 2.0, samples: [{ t: 0, v: 0 }, { t: 350, v: 3.3 }, { t: 700, v: 3.3 }] }]
    const geo = geometryOf({ rows: rowsOf({ res, signals, analog }), width: 640, window: [0, 700] })
    const pin = geo.rows.find((r) => r.kind === 'analog')
    expect(pin.label).toBe('the pin')
    // A higher voltage is a smaller y, and each level is where its own volts map.
    expect(pin.high).toBeLessThan(pin.low)
    expect(pin.high).toBeCloseTo(pin.sy(2.0), 9)
    expect(pin.low).toBeCloseTo(pin.sy(0.8), 9)
    // The trace spans the row, top to bottom, at the two ends of its range.
    expect(pin.sy(3.3)).toBeCloseTo(pin.top + 4, 9)
    expect(pin.sy(0)).toBeCloseTo(pin.bot - 4, 9)
    // The threshold sits between them, at the fraction of the range it is.
    expect((pin.bot - 4 - pin.high) / (pin.bot - pin.top - 8)).toBeCloseTo(2.0 / 3.3, 9)
  })

  it('reads a pair of cursors as two lines and the interval between them', () => {
    const es = res.events.filter((e) => e.signal === 'y')
    const geo = geometryOf({ rows: rowsOf({ res, signals }), width: 640, window: [0, res.tEnd], cursors: [es[0].t, es[1].t] })
    expect(geo.cursors.map((c) => c.t)).toEqual([es[0].t, es[1].t])
    expect(geo.interval).toBe(es[1].t - es[0].t)
    expect(geo.cursors[1].x - geo.cursors[0].x).toBeCloseTo((geo.interval / res.tEnd) * geo.plotW, 6)
    // One cursor is a read line and not a measurement, so it reports no interval.
    expect(geometryOf({ rows: [], width: 640, cursors: [100] }).interval).toBeNull()
  })

  it('every event on a drawn row has a cause on a drawn row, which is what the cause line joins', () => {
    // The VLSI Lab's prop. It draws nothing unless both ends are on the page,
    // and on this netlist every caused event has both.
    const rows = rowsOf({ res, signals })
    const drawn = new Set(rows.map((r) => r.signal))
    const caused = res.events.filter((e) => e.cause)
    expect(caused.length).toBeGreaterThan(0)
    for (const e of caused) {
      expect(drawn.has(e.signal), e.signal).toBe(true)
      expect(drawn.has(e.cause.signal), e.cause.signal).toBe(true)
      expect(e.cause.t).toBeLessThan(e.t)
    }
  })

  it('renders with every prop it offers, and with none of them', () => {
    const html = renderToStaticMarkup(
      <TimingCanvas
        res={res}
        signals={signals}
        busses={[{ label: 'both', signals: ['p', 'q'] }]}
        analog={[{ label: 'the pin', vLow: 0.8, vHigh: 2, samples: [{ t: 0, v: 0 }] }]}
        marks={[{ t: 240, label: 'y falls' }]}
        spans={[{ from: 240, to: 270, signal: 'y', label: 'the glitch' }]}
        cursors={[240, 270]}
        causes
        window={[0, 700]}
        cursor={500}
      />,
    )
    expect(html).toContain('aria-label="Timing diagram"')
    expect(renderToStaticMarkup(<TimingCanvas />)).toContain('<canvas')
  })
})

describe('the state machine diagram', () => {
  const table = fsmTable(DETECTOR_101)
  const states = table.states
  const edges = table.rows.map((r) => ({ from: r.state, to: r.next, label: `x = ${r.in.x}`, out: r.out }))

  it('puts the states on a ring inside the canvas, and one state in the middle', () => {
    const at = layoutOf(states, 480, 260)
    for (const s of states) {
      expect(at[s].x).toBeGreaterThan(0)
      expect(at[s].x).toBeLessThan(480)
      expect(at[s].y).toBeGreaterThan(0)
      expect(at[s].y).toBeLessThan(260)
    }
    const rs = states.map((s) => Math.hypot(at[s].x - 240, at[s].y - 130))
    for (const r of rs) expect(r).toBeCloseTo(rs[0], 6)
    expect(layoutOf(['only'], 480, 260)).toEqual({ only: { x: 240, y: 130 } })
  })

  it('lights the state it is in, and the arc that was last taken', () => {
    const scene = sceneOf({ states, edges, active: 's1', taken: { from: 's0', to: 's1' }, width: 480, height: 260 })
    expect(scene.states.filter((s) => s.lit).map((s) => s.name)).toEqual(['s1'])
    const lit = scene.edges.filter((e) => e.lit)
    expect(lit.length).toBeGreaterThan(0)
    for (const e of lit) expect([e.from, e.to]).toEqual(['s0', 's1'])
    // Nothing is lit when nothing has been taken yet.
    expect(sceneOf({ states, edges, width: 480, height: 260 }).edges.some((e) => e.lit)).toBe(false)
  })

  it('prints each state’s bits beside its name when it is given an encoding', () => {
    const encoding = Object.fromEntries(states.map((s) => [s, table.code[s].toString(2).padStart(table.bits, '0')]))
    const scene = sceneOf({ states, edges, encoding, width: 480, height: 260 })
    expect(scene.states.map((s) => s.code)).toEqual(['00', '01', '10'])
    expect(sceneOf({ states, edges, width: 480, height: 260 }).states.every((s) => s.code === null)).toBe(true)
  })

  it('draws an output inside a state only where every arc leaving it agrees', () => {
    // The Computer Lab's prop is a Moore output, which is one the state has
    // whatever the input does. The 101 detector is Mealy, and the state where
    // that shows is s2: it raises y on x = 1 and not on x = 0, so nothing goes
    // inside that circle. The two states whose arcs agree do carry theirs.
    const mealy = sceneOf({ states, edges, outputs: true, width: 480, height: 260 })
    expect(table.type).toBe('Mealy')
    const differs = table.rows.filter((r) => r.state === 's2').map((r) => r.out.y)
    expect(new Set(differs).size).toBe(2)
    expect(mealy.states.find((s) => s.name === 's2').text).toBeNull()
    expect(mealy.states.find((s) => s.name === 's0').text).toBe('y=0')
    const moore = [
      { from: 'a', to: 'b', label: 'x = 1', out: { y: 0 } },
      { from: 'b', to: 'a', label: 'x = 0', out: { y: 1 } },
      { from: 'b', to: 'b', label: 'x = 1', out: { y: 1 } },
    ]
    const scene = sceneOf({ states: ['a', 'b'], edges: moore, outputs: true, width: 480, height: 260 })
    expect(scene.states.find((s) => s.name === 'b').text).toBe('y=1')
    expect(scene.states.find((s) => s.name === 'a').text).toBe('y=0')
    expect(scene.edges.find((e) => e.self)).toMatchObject({ from: 'b', to: 'b' })
    // Without the prop, the same machine draws no output at all.
    expect(sceneOf({ states: ['a', 'b'], edges: moore, width: 480, height: 260 }).states.every((s) => s.text === null)).toBe(true)
  })

  it('renders with every prop it offers', () => {
    const html = renderToStaticMarkup(
      <StateCanvas states={states} edges={edges} encoding={{ s0: '00', s1: '01', s2: '10' }} active="s1" taken={{ from: 's0', to: 's1' }} outputs />,
    )
    expect(html).toContain('aria-label="State machine diagram"')
  })
})
