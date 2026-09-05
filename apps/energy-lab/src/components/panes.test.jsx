import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import TrackPane from './TrackPane.jsx'
import ProfilePane from './ProfilePane.jsx'
import { analyse, shortfallOf } from '../analysis.js'
import { byId, defaultsOf } from '../experiments.js'
import { CELSIUS } from '../physics.js'

// The two panes the tracking and day groups needed, and the one number in
// each that only they show: the difference between the converter's two input
// currents, and which hours the bus could not serve or could not store.

const at = (id, over = {}) => analyse(byId[id], { ...defaultsOf(id), ...over })
const html = (el) => renderToString(el).replace(/<!--\s*-->/g, '')
const text = (h) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
const nums = (h) => [...text(h).matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => +m[0])

describe('the walk pane', () => {
  it('shows the tracker’s own numbers, and they are the analysis’s', () => {
    const x = at('c3')
    const t = text(html(<TrackPane exp={byId.c3} x={x} />))
    expect(t).toContain('First step that turned round')
    expect(t).toContain('Given up to the dither')
    // The settled mean and the share, as the analysis has them.
    expect(t).toContain((x.share * 100).toFixed(3))
    expect(nums(t)).toContain(x.reversal)
    expect(t).not.toMatch(/undefined|NaN/)
  })

  it('prints the converter’s two input currents and the difference between them', () => {
    const x = at('c5')
    const t = text(html(<TrackPane exp={byId.c5} x={x} />))
    expect(t).toContain('Input current, from R/D²')
    expect(t).toContain('the switched steady state')
    expect(t).toContain('The difference between them')
    // Both are printed to seven figures, so a reader can see they agree
    // rather than being told that they do.
    expect(x.buck.iinSwitched).toBeCloseTo(x.buck.iinModel, 5)
    expect(Math.abs(x.buck.iinSwitched - x.buck.iinModel)).toBeLessThan(1e-5)
    expect(t).not.toMatch(/undefined|NaN/)
  })
})

describe('the hourly pane', () => {
  it('has one row per hour, and marks the hour the readout is on', () => {
    const x = at('e1')
    const h = html(<ProfilePane x={x} />)
    expect([...h.matchAll(/data-hour=/g)].length).toBe(24)
    expect(h).toMatch(new RegExp(`class="is-here" data-hour="${x.hour}"`))
    expect(h).not.toMatch(/undefined|NaN/)
  })

  it('says which columns are data and which are solved', () => {
    const t = text(html(<ProfilePane x={at('e1')} />))
    expect(t).toMatch(/Irradiance data/)
    expect(t).toMatch(/Cell T data/)
    expect(t).toMatch(/Load data/)
    expect(t).toMatch(/Array solved/)
  })

  it('prints the cell temperature in degrees, because the profile holds kelvin', () => {
    const x = at('e1')
    const t = text(html(<ProfilePane x={x} />))
    const noon = x.g.rows[12]
    expect(noon.T).toBeGreaterThan(200) // kelvin, in the data
    expect(t).toContain((noon.T - CELSIUS).toFixed(2))
    expect(t).not.toContain(`${noon.T} °C`)
  })

  it('names the hours the bus could not store, and none where it could', () => {
    // At the default bank the day curtails and serves everything it is asked
    // for, so the flag appears on the full hours and nowhere else.
    const x = at('e1')
    const flagged = x.g.rows.filter((r) => shortfallOf(r))
    expect(flagged.length).toBeGreaterThan(0)
    for (const r of flagged) expect(shortfallOf(r), `hour ${r.h}`).toBe('curtailed')
    const t = text(html(<ProfilePane x={x} />))
    expect((t.match(/curtailed/g) || []).length).toBe(flagged.length)
    expect(t).not.toContain('unserved')
    // Halve the bank and the evening cannot be met, so the other word appears.
    const half = at('e3', { bankParallel: 50 })
    expect(half.g.rows.some((r) => shortfallOf(r) === 'unserved')).toBe(true)
    expect(text(html(<ProfilePane x={half} />))).toContain('unserved')
  })
})

describe('an hour’s shortfall', () => {
  it('is empty when the bank took every joule the hour had spare', () => {
    const rows = at('e1').g.rows
    for (const r of rows) {
      const moved = Math.abs(r.toBank - r.net * 3600) < 1e-6
      expect(shortfallOf(r) === '', `hour ${r.h}`).toBe(moved)
    }
  })

  it('adds up to the day’s own curtailed and unserved totals', () => {
    const x = at('e3', { bankParallel: 50 })
    const curtailed = x.g.rows.filter((r) => shortfallOf(r) === 'curtailed')
    const unserved = x.g.rows.filter((r) => shortfallOf(r) === 'unserved')
    const sum = (rs) => rs.reduce((s, r) => s + Math.abs(r.net * 3600 - r.toBank), 0)
    expect(sum(curtailed)).toBeCloseTo(x.g.curtailed, 6)
    expect(sum(unserved)).toBeCloseTo(x.g.unserved, 6)
  })
})
