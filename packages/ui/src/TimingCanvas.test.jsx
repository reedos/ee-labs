import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { simulate, hazardNet } from '@ee-labs/events'
import TimingCanvas, { busAt, geometryOf, heightOf, rowsOf } from './TimingCanvas.jsx'

// The timing diagram. Built by the Logic Lab (LOGIC_LAB_PLAN.md Decision 5),
// promoted here once the Computer Lab claimed it too (PROGRAM.md §4).
//
// The props past `signals` carry props for labs that were not built yet when
// this component was written, and a prop nothing draws is a prop that is
// wrong the day someone needs it. So each one is measured here against the
// geometry it produces: the bus row's word, the span's width, the analog
// row's two threshold levels and its cursor pair, and the cause line's two
// ends.
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

  it('takes a time formatter as a prop, for a lab whose engine does not count picoseconds', () => {
    // The Computer Lab's engine ticks on a finer grid and converts before
    // printing, so the formatter this diagram quotes time through is a prop
    // rather than an import, defaulting to the Logic Lab's own picoseconds.
    expect(() =>
      renderToStaticMarkup(<TimingCanvas res={res} signals={signals} cursors={[240, 270]} fmtTime={(t) => `${t} grid`} />),
    ).not.toThrow()
  })
})
