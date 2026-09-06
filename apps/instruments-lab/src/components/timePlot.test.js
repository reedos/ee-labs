import { describe, expect, it } from 'vitest'
import { freqSpan } from './timePlot.js'
import { EXPERIMENTS, byId, defaultsOf } from '../experiments.js'
import { bandpass } from '../groups/d.js'
import { analyse } from '../math.js'

// What a plot's frame does with the curve it is given. Every number here comes
// from an experiment's own sweep, so a default that moves moves the test with
// it rather than under it.

const dbOf = (id) => {
  const exp = byId[id]
  const x = analyse(exp, defaultsOf(id))
  return x.freq.H.map((z) => 20 * Math.log10(Math.hypot(z[0], z[1])))
}

describe('freqSpan: the frame a Bode curve is drawn in', () => {
  it('keeps a flat response off its own frame — A3 is flat at −20 dB and was drawn along the bottom', () => {
    const mag = dbOf('a3')
    const flat = Math.max(...mag)
    expect(Math.min(...mag)).toBeCloseTo(flat, 6)
    expect(flat).toBeCloseTo(-20, 4)
    const { lo, hi } = freqSpan(mag, 'bode')
    expect(lo).toBeLessThan(flat)
    expect(hi).toBeGreaterThan(flat)
    // Clear of both edges by at least a twentieth of the frame's height.
    const fill = (flat - lo) / (hi - lo)
    expect(fill).toBeGreaterThan(0.05)
    expect(fill).toBeLessThan(0.95)
  })

  it('leaves every sweep in the lab clear of the frame it is drawn in', () => {
    const bode = EXPERIMENTS.filter((e) => e.views.includes('bode'))
    expect(bode.length).toBeGreaterThan(4)
    for (const { id } of bode) {
      const mag = dbOf(id)
      const { lo, hi } = freqSpan(mag, 'bode')
      expect(Math.min(...mag), `${id} bottom`).toBeGreaterThan(lo)
      expect(Math.max(...mag), `${id} top`).toBeLessThan(hi)
    }
  })

  it('still gives a passive curve that reaches 0 dB its headroom above', () => {
    const { lo, hi } = freqSpan([0, -3, -20, -40], 'bode')
    expect(hi).toBeGreaterThan(0)
    expect(lo).toBeLessThanOrEqual(-40)
  })
})

describe('the analyser sweeps a band a resolution bandwidth can be seen in', () => {
  const D = ['d1', 'd2', 'd3', 'd4'].filter((id) => byId[id] && byId[id].sweep)

  it('draws frequency itself, since a decade axis holds no tick across such a span', () => {
    for (const id of D) expect(byId[id].sweep(defaultsOf(id)).axis, id).toBe('linear')
  })

  it('makes the −3 dB width a readable part of the frame, not the 0.4 % it was', () => {
    for (const id of D) {
      const p = defaultsOf(id)
      const { from, to } = byId[id].sweep(p)
      const { rbw } = bandpass(p)
      const share = rbw / (to - from)
      // f₀/4 to f₀·4 put a 100 Hz bandwidth across 0.4 % of a log frame, under
      // three pixels. A tenth of the frame is a shape a reader can measure.
      expect(share, `${id} share of the frame`).toBeGreaterThan(0.05)
      expect(share, `${id} share of the frame`).toBeLessThan(0.5)
    }
  })

  it('still reaches every tone the experiment carries', () => {
    for (const id of D) {
      const p = defaultsOf(id)
      const { from, to } = byId[id].sweep(p)
      for (const key of ['f', 'fa', 'fb']) {
        if (!Number.isFinite(p[key])) continue
        expect(p[key], `${id} ${key} above the sweep`).toBeLessThanOrEqual(to)
        expect(p[key], `${id} ${key} below the sweep`).toBeGreaterThanOrEqual(from)
      }
    }
  })

  it('a wide sweep is still drawn on a decade axis', () => {
    for (const id of ['a2', 'a3', 'a5', 'b2']) {
      const { from, to, axis } = byId[id].sweep(defaultsOf(id))
      expect(axis, id).toBeUndefined()
      expect(Math.log10(to) - Math.log10(from), id).toBeGreaterThan(2.5)
    }
  })
})
