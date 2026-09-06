import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ConstellationCanvas, { regionsOf, extentOf, MAX_POINTS } from './ConstellationCanvas.jsx'
import EyeCanvas, { tracesOf, openingOf, MAX_TRACES } from './EyeCanvas.jsx'
import BerCanvas, { sceneOf, FLOOR } from './BerCanvas.jsx'
import { analyse } from '../analysis.js'

// The three canvases this lab builds new.
//
// Two of them move to `packages/ui` when the Mixed-Signal Lab starts, and both
// carry that lab's props already. A prop nothing draws is a prop that is wrong
// the day someone needs it, so each one is measured here against the geometry it
// produces. The geometry is computed by a pure function that the draw call then
// reads, so what a test measures is what the reader sees rather than a second
// copy of the arithmetic.

const qam16 = analyse({ scheme: 'qam16', ebN0Db: 12, symbols: 512, seed: 1 })
const qpsk = analyse({ scheme: 'qpsk', ebN0Db: 12, symbols: 512, seed: 1 })

describe('the constellation', () => {
  it('renders and names how many symbols it drew, out of how many', () => {
    const html = renderToStaticMarkup(
      <ConstellationCanvas points={qam16.cloud().noisy} ideal={qam16.map().points} />,
    )
    expect(html).toMatch(/aria-label="Constellation: 512 of 512 symbols"/)
  })

  it('never draws more points than read as points', () => {
    const many = analyse({ scheme: 'qpsk', ebN0Db: 12, symbols: 8192, seed: 1 })
    const html = renderToStaticMarkup(<ConstellationCanvas points={many.cloud().noisy} />)
    expect(html).toMatch(new RegExp(`Constellation: ${MAX_POINTS} of 8192 symbols`))
  })

  it('does not fail when there is nothing to draw', () => {
    expect(() => renderToStaticMarkup(<ConstellationCanvas />)).not.toThrow()
  })

  it('puts a grid boundary between every pair of columns of a square constellation', () => {
    const r = regionsOf({ points: qam16.map().points })
    // Four columns and four rows, so three boundaries each way.
    expect(r.x.length).toBe(3)
    expect(r.y.length).toBe(3)
    // The middle one sits on the axis, because the grid is symmetric.
    expect(Math.abs(r.x[1])).toBeLessThan(1e-9)
  })

  it('puts a ray between every pair of points of a circular one', () => {
    const r = regionsOf({ points: qpsk.map().points, kind: 'circular' })
    expect(r.rays.length).toBe(4)
    expect(r.x || []).toEqual([])
  })

  it('frames every drawn point and every ideal one', () => {
    const e = extentOf({ points: qam16.cloud().noisy, ideal: qam16.map().points })
    const c = qam16.cloud().noisy
    let worst = 0
    for (let i = 0; i < c.length; i++) worst = Math.max(worst, Math.abs(c[i]))
    expect(e).toBeGreaterThanOrEqual(worst)
  })
})

describe('the props the Mixed-Signal Lab needs on the constellation', () => {
  // PROGRAM.md §4 requires a new canvas to carry its second lab's needs from the
  // first commit. These are here so a later change cannot drop them silently.

  it('takes a decision grid that is not a constellation', () => {
    const grid = { x: [-0.5, 0, 0.5], y: [], label: 'code edges' }
    const html = renderToStaticMarkup(<ConstellationCanvas points={qam16.cloud().noisy} grid={grid} />)
    expect(html).toMatch(/Constellation: 512 of 512 symbols/)
  })

  it('frames a grid that reaches outside the points', () => {
    const grid = { x: [-4, 4], y: [] }
    expect(extentOf({ points: Float64Array.from([0, 0]), grid })).toBeGreaterThan(4)
  })

  it('takes a colour key per point', () => {
    const n = qpsk.cloud().noisy.length / 2
    const values = Array.from({ length: n }, (_, i) => i % 4)
    expect(() =>
      renderToStaticMarkup(
        <ConstellationCanvas
          points={qpsk.cloud().noisy}
          colorBy={{ values, labels: ['0', '1', '2', '3'], title: 'clock phase' }}
        />,
      ),
    ).not.toThrow()
  })
})

describe('the eye', () => {
  const a = analyse({ shape: 'rrc', beta: 0.35, span: 12, symbols: 256, seed: 1 })
  const rows = tracesOf({ buffer: a.eye().traces, sps: 8 })

  it('cuts the stream into traces of two symbol periods', () => {
    expect(rows.length).toBeGreaterThan(20)
    for (const r of rows) expect(r.length).toBe(16)
  })

  it('never draws more traces than read as an eye', () => {
    const long = analyse({ shape: 'rrc', beta: 0.35, span: 12, symbols: 256, seed: 2 })
    const many = tracesOf({ buffer: long.eye().traces, sps: 8, max: 10000 })
    expect(tracesOf({ buffer: long.eye().traces, sps: 8 }).length).toBeLessThanOrEqual(MAX_TRACES)
    expect(many.length).toBeGreaterThanOrEqual(tracesOf({ buffer: long.eye().traces, sps: 8 }).length)
  })

  it('measures an opening with a height and a crossing width', () => {
    const o = openingOf({ rows, sps: 8 })
    expect(o.height).toBeGreaterThan(0)
    expect(o.upper).toBeGreaterThan(0)
    expect(o.lower).toBeLessThan(0)
    expect(o.width).toBeGreaterThanOrEqual(0)
  })

  it('reads a smaller opening once the instant moves', () => {
    const open = openingOf({ rows, sps: 8, at: 0 })
    const late = openingOf({ rows, sps: 8, at: 0.25 })
    expect(late.height).toBeLessThan(open.height)
  })

  it('renders and names how many traces it drew', () => {
    const html = renderToStaticMarkup(<EyeCanvas buffer={a.eye().traces} sps={8} />)
    expect(html).toMatch(/aria-label="Eye diagram: \d+ traces of two symbol periods"/)
  })

  it('does not fail when there is nothing to draw', () => {
    expect(() => renderToStaticMarkup(<EyeCanvas />)).not.toThrow()
    expect(tracesOf({ buffer: null, sps: 8 })).toEqual([])
    expect(openingOf({ rows: [], sps: 8 }).height).toBe(0)
  })
})

describe('the props the Mixed-Signal Lab needs on the eye', () => {
  const a = analyse({ shape: 'rrc', beta: 0.35, span: 12, symbols: 256, seed: 1 })

  it('takes a colour key per trace, for a clock phase', () => {
    expect(() =>
      renderToStaticMarkup(<EyeCanvas buffer={a.eye().traces} sps={8} traceKey={[0, 1, 2, 3]} />),
    ).not.toThrow()
  })

  it('takes a unit for its axis, so a converter eye reads in volts', () => {
    const html = renderToStaticMarkup(<EyeCanvas buffer={a.eye().traces} sps={8} unitLabel="V" />)
    expect(html).toMatch(/Eye diagram/)
  })
})

describe('the error rate plot', () => {
  const a = analyse({ scheme: 'bpsk', berFrom: 0, berTo: 10, berStep: 2, countTo: 4, countSymbols: 20000 })
  const scene = sceneOf({ curve: a.ber().curve })

  it('draws the closed form as a line at every point', () => {
    expect(scene.line.length).toBe(6)
    for (const q of scene.line) expect(q.y).toBeGreaterThan(0)
  })

  it('draws a marker only where a count was taken', () => {
    expect(scene.markers.length).toBe(3)
    expect(scene.markers.every((m) => m.x <= 4)).toBe(true)
  })

  it('gives every marker an interval that brackets it', () => {
    for (const m of scene.markers) {
      expect(m.lo).toBeLessThanOrEqual(m.y)
      expect(m.hi).toBeGreaterThanOrEqual(m.y)
    }
  })

  it('marks a point resting on too few errors as hollow', () => {
    const thin = analyse({
      scheme: 'bpsk',
      berFrom: 8,
      berTo: 10,
      berStep: 2,
      countTo: 10,
      countSymbols: 2000,
    })
    const s = sceneOf({ curve: thin.ber().curve })
    expect(s.markers.some((m) => m.hollow)).toBe(true)
  })

  it('frames the whole curve in whole decades, above its own floor', () => {
    expect(scene.lo).toBeGreaterThanOrEqual(FLOOR)
    expect(Math.log10(scene.hi) % 1).toBeCloseTo(0, 9)
    for (const q of scene.line) expect(q.y).toBeGreaterThanOrEqual(scene.lo)
  })

  it('takes the limits prop the Information Lab draws its bound on', () => {
    const s = sceneOf({ curve: a.ber().curve, limits: [{ ebN0Db: -1.59, label: 'Shannon' }] })
    expect(s.limits.length).toBe(1)
    expect(s.limits[0].label).toBe('Shannon')
    const html = renderToStaticMarkup(
      <BerCanvas curve={a.ber().curve} limits={[{ ebN0Db: -1.59, label: 'Shannon' }]} />,
    )
    expect(html).toMatch(/Bit error rate: a closed form and 3 counted points/)
  })

  it('does not fail when there is no curve to draw', () => {
    expect(() => renderToStaticMarkup(<BerCanvas />)).not.toThrow()
    expect(sceneOf({ curve: null }).line).toEqual([])
  })
})
