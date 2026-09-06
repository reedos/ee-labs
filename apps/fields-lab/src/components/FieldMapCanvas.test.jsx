import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import FieldMapCanvas, { axisDomainOf, colourFor, domainTicks, sampleGrid } from './FieldMapCanvas.jsx'

// The contract this component ships to a second lab, per AGENT_BRIEF.md §3.9:
// `mode: '2d' | 'profile'` from the first commit, and a profile whose `stack`
// shares one position axis and its ticks. Nothing here needs a browser canvas
// to paint — the checks are on the markup and on the exported helpers, both of
// which run the same in Node as in a browser.

const html = (el) => renderToStaticMarkup(el)

describe('mode 2d', () => {
  it('renders the map with a scalar, a vector, an equipotential, a conductor and a probe', () => {
    const out = html(
      <FieldMapCanvas
        mode="2d"
        domain={{ width: 0.02, height: 0.02, centre: true }}
        scalar={(x, y) => x + y}
        vector={(x, y) => [1, 0]}
        equipotentials={[{ level: 5, points: [[-0.005, 0], [0.005, 0]] }]}
        conductors={[{ path: [[-0.001, -0.001], [0.001, -0.001], [0.001, 0.001], [-0.001, 0.001]], potential: 10 }]}
        probe={{ x: 0, y: 0 }}
        units={{ length: 'mm', scalar: 'V', vector: 'V/m' }}
      />,
    )
    expect(out).toMatch(/data-mode="2d"/)
    expect(out).toMatch(/fieldmap-canvas/)
    expect(out).toMatch(/10(\.0)? V/)
  })
})

describe('mode profile', () => {
  const profile = {
    axis: 'x',
    cut: 0,
    scalar: { read: (t) => Math.sin(t * 10), label: 'Charge density', unit: 'C/m³' },
    secondary: { read: (t) => Math.cos(t * 10), label: 'Field', unit: 'V/m' },
    regions: [
      { from: 0, to: 0.3, label: 'p-side', edge: true },
      { from: 0.3, to: 0.6, label: 'depletion', edge: true },
    ],
    from: 0,
    to: 1,
  }

  it('draws one scalar against one axis, with a second scalar on a right axis and two regions marked', () => {
    const out = html(<FieldMapCanvas mode="profile" profile={profile} units={{ length: 'mm' }} />)
    expect(out).toMatch(/data-mode="profile"/)
    expect(out).toMatch(/Charge density/)
    expect(out).toMatch(/Field/)
    expect((out.match(/fieldmap-region/g) || []).length).toBeGreaterThanOrEqual(2)
  })

  it('a stack of three panels shares the position axis and its ticks', () => {
    const stack = [
      { scalar: { read: (t) => t, label: 'Charge density', unit: 'C/m³' }, regions: profile.regions },
      { scalar: { read: (t) => t * t, label: 'Field', unit: 'V/m' }, regions: profile.regions },
      { scalar: { read: (t) => -t, label: 'Potential', unit: 'V' }, regions: profile.regions },
    ]
    const out = html(<FieldMapCanvas mode="profile" profile={{ axis: 'x', cut: 0, stack }} units={{}} />)
    expect(out).toMatch(/data-panels="3"/)

    // Every panel's tick marks carry the same data-value list, in the same order.
    const perPanel = out.split('fieldmap-panel"').slice(1)
    expect(perPanel.length).toBe(3)
    // Each panel's own (unlabelled) gridline ticks — the bottom panel also
    // carries a second, labelled set after them, which is checked separately.
    const ticksOf = (chunk) => {
      const gridline = /data-labelled="false"[^]*?<\/div>/.exec(chunk)
      return [...(gridline ? gridline[0] : '').matchAll(/data-value="([^"]+)"/g)].map((m) => m[1])
    }
    const [t0, t1, t2] = perPanel.map(ticksOf)
    expect(t0.length).toBeGreaterThan(0)
    expect(t1).toEqual(t0)
    expect(t2).toEqual(t0)

    // Only the bottom panel's ticks are labelled — the stack does not repeat
    // the axis three times.
    const labelledCounts = perPanel.map((chunk) => (chunk.match(/data-labelled="true"/g) || []).length)
    expect(labelledCounts).toEqual([0, 0, 1])
  })
})

describe('the exported helpers', () => {
  it('domainTicks gives round numbers spanning the domain', () => {
    const ticks = domainTicks(0, 1e-6)
    expect(ticks.length).toBeGreaterThan(1)
    for (const t of ticks) expect(t).toBeGreaterThanOrEqual(0)
    for (const t of ticks) expect(t).toBeLessThanOrEqual(1e-6)
  })

  it('axisDomainOf reads the regions when there is no explicit span', () => {
    const { lo, hi } = axisDomainOf({ regions: [{ from: 1, to: 2 }, { from: 2, to: 5 }] })
    expect(lo).toBe(1)
    expect(hi).toBe(5)
  })

  it('sampleGrid centres the domain when asked, and reports the largest finite magnitude', () => {
    const g = sampleGrid((x, y) => x, { width: 2, height: 2, centre: true }, 8)
    expect(g.x0).toBeCloseTo(-1, 10)
    expect(g.scale).toBeGreaterThan(0)
    expect(g.scale).toBeLessThanOrEqual(1)
  })

  it('colourFor picks the diverging ramp only when the field has a sign', () => {
    expect(colourFor(-1, 1, true)).not.toBe(colourFor(1, 1, true))
    expect(colourFor(0, 1, true)).not.toBe(colourFor(1, 1, false))
  })

  it('a value the field could not be sampled at (NaN, or off the scale) does not throw', () => {
    expect(colourFor(NaN, 1, true)).toBeTypeOf('string')
    expect(colourFor(5, 0, false)).toBeTypeOf('string')
  })
})
