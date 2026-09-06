import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import FieldMapCanvas, { axisDomainOf, colourFor, decadeTicks, domainTicks, fitBox, fractionAt, positionAt, rangeOf, sampleGrid, valueTicks } from './FieldMapCanvas.jsx'

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

describe('the axes a reader reads the picture off', () => {
  const profile = {
    axis: 'x',
    cut: 0,
    from: 0,
    to: 1,
    scalar: { read: (t) => 2 + t, label: 'Potential', unit: 'V' },
    regions: [{ from: 0.2, to: 0.4, label: 'dielectric' }],
  }

  it('a profile carries numbers up its value axis, and names its position axis', () => {
    const out = html(<FieldMapCanvas mode="profile" profile={profile} units={{ length: 'mm' }} />)
    expect(out, 'no value axis').toMatch(/data-role="value-axis-left"/)
    expect((out.match(/fieldmap-vtick/g) || []).length, 'no numbers on the value axis').toBeGreaterThan(1)
    expect(out, 'the position axis is not named').toMatch(/data-role="axis-name"/)
    expect(out).toMatch(/Position, across/)
  })

  it('a second quantity gets its own axis, and the panel says the two scales differ', () => {
    const out = html(
      <FieldMapCanvas
        mode="profile"
        profile={{ ...profile, secondary: { read: (t) => 1e5 * (1 + t), label: 'Field', unit: 'V/m' } }}
        units={{}}
      />,
    )
    expect(out).toMatch(/data-role="value-axis-right"/)
    expect(out, 'two scales on one panel with nothing saying so').toMatch(/data-role="panel-scales"/)
    expect(out).toMatch(/own scale/)
  })

  it('two curves in one unit share one scale, and two in different units do not', () => {
    // A4 draws a line of charge and a sheet of charge, both in volts a metre.
    // Drawn to separate ranges the two looked alike, and the lesson is that one
    // falls off and the other does not.
    const same = html(
      <FieldMapCanvas
        mode="profile"
        profile={{
          ...profile,
          scalar: { read: (t) => 1 / (t + 0.1), label: 'Line, field', unit: 'V/m' },
          secondary: { read: () => 2, label: 'Sheet, field', unit: 'V/m' },
        }}
        units={{}}
      />,
    )
    expect(same, 'one unit, and still two axes').not.toMatch(/data-role="value-axis-right"/)
    expect(same, 'one scale described as two').not.toMatch(/data-role="panel-scales"/)

    const different = html(
      <FieldMapCanvas
        mode="profile"
        profile={{ ...profile, secondary: { read: (t) => 1e5 * (1 + t), label: 'Field', unit: 'V/m' } }}
        units={{}}
      />,
    )
    expect(different).toMatch(/data-role="value-axis-right"/)
  })

  it('an axis with no unit shows a fraction and not a prefix', () => {
    // A reflected fraction of a half is 0.5. It read "500m".
    const out = html(
      <FieldMapCanvas
        mode="profile"
        profile={{ axis: 'x', cut: 0, from: 0, to: 1, scalar: { read: (t) => t, label: 'Reflected fraction', unit: '' } }}
        units={{}}
      />,
    )
    expect(out, 'a bare fraction given an SI prefix').not.toMatch(/>500m</)
    expect(out).toMatch(/>0\.5</)
  })

  it('a sweep over frequency is named in hertz and not in metres', () => {
    const out = html(
      <FieldMapCanvas
        mode="profile"
        profile={{ axis: 'x', cut: 0, from: 1, to: 1e6, log: true, xLabel: 'Frequency', xUnit: 'Hz', scalar: { read: (f) => Math.sqrt(f), label: 'Resistance ratio', unit: '' } }}
        units={{}}
      />,
    )
    expect(out).toMatch(/Frequency \(Hz\)/)
    expect(out).toMatch(/by decade/)
    expect(out, 'a frequency axis labelled in metres').not.toMatch(/Hz[^]*?\d\s?mm/)
    // Decade ticks, not six equal steps of 166 kHz.
    const values = [...out.matchAll(/data-value="([^"]+)"/g)].map((m) => Number(m[1]))
    expect(values).toContain(1000)
    expect(values).toContain(100000)
  })

  it('the stated span wins over a region inside it', () => {
    // E3 names two winding lengths so the field outside the coil is on screen,
    // and marks the winding as a region. Reading the region first drew only
    // the inside of the coil, which is the half the lesson is not about.
    const span = axisDomainOf({ from: -0.2, to: 0.2, regions: [{ from: -0.05, to: 0.05 }] })
    expect(span).toEqual({ lo: -0.2, hi: 0.2 })
    // A profile with no span of its own still falls back to its regions.
    expect(axisDomainOf({ regions: [{ from: 1, to: 2 }] })).toEqual({ lo: 1, hi: 2 })
  })

  it('a log axis maps by decade, and its ticks are the decades', () => {
    expect(positionAt(0.5, 1, 1e4, true)).toBeCloseTo(100, 6)
    expect(fractionAt(100, 1, 1e4, true)).toBeCloseTo(0.5, 12)
    expect(fractionAt(100, 1, 1e4, false)).toBeCloseTo((100 - 1) / (1e4 - 1), 12)
    expect(decadeTicks(1, 1e3)).toEqual([1, 10, 100, 1000])
  })

  it('a range that sits above zero is drawn from zero, and a flat one still has a span', () => {
    // A curve that falls most of the way to nothing is drawn against nothing.
    const falls = rangeOf((t) => 100 - 95 * t, 0, 1)
    expect(falls.min).toBe(0)
    // A curve that only ever varies a little is not: 10 to 11 against a floor
    // of zero is a flat line, and the variation is the lesson.
    const narrow = rangeOf((t) => 10 + t, 0, 1)
    expect(narrow.min).toBeCloseTo(10, 6)
    const flat = rangeOf(() => 5, 0, 1)
    expect(flat.max).toBeGreaterThan(flat.min)
    const ticks = valueTicks(0, 11)
    expect(ticks.length).toBeGreaterThan(2)
    expect(Math.max(...ticks)).toBeLessThanOrEqual(11)
  })

  it('two numbers equal to the last digit are drawn as one flat line, and the ticks end', () => {
    // G1's conduction current and its displacement current are equal, and
    // "equal" in floating point means they differ by one unit in the last
    // place. Magnifying that span filled the panel with a step, and the tick
    // loop then ran until the array would not hold another element.
    const v = 8.8541878128e-7
    const r = rangeOf((t) => (t > 0.5 ? v : v * (1 + Number.EPSILON)), 0, 1)
    expect(r.max - r.min).toBeGreaterThan(v / 4)
    const ticks = valueTicks(r.min, r.max)
    expect(ticks.length).toBeGreaterThan(1)
    expect(ticks.length).toBeLessThan(64)
    // And directly: a span of one ulp asks for ticks and gets two, not four
    // billion.
    expect(valueTicks(v, v + Number.EPSILON * v).length).toBeLessThan(64)
    expect(domainTicks(1e6, 1e6 + 1e-9).length).toBeLessThan(64)
  })

  it('a square domain draws square, whatever shape the canvas is', () => {
    // A coaxial cable stretched to the pane's width is drawn as an ellipse,
    // and the lesson is that the field is radial.
    const wide = fitBox(900, 300, { width: 0.01, height: 0.01 })
    expect(wide.w / wide.h).toBeCloseTo(1, 6)
    const tall = fitBox(300, 900, { width: 0.01, height: 0.01 })
    expect(tall.w / tall.h).toBeCloseTo(1, 6)
    // A domain twice as wide as it is high keeps that ratio too.
    const oblong = fitBox(900, 900, { width: 0.02, height: 0.01 })
    expect(oblong.w / oblong.h).toBeCloseTo(2, 6)
    // And it stays inside the canvas, with room for the axes.
    expect(wide.x).toBeGreaterThanOrEqual(0)
    expect(wide.x + wide.w).toBeLessThanOrEqual(900)
    expect(tall.y + tall.h).toBeLessThanOrEqual(900)
  })

  it('the map says what its colour means and what its arrows do not mean', () => {
    const out = html(
      <FieldMapCanvas
        mode="2d"
        domain={{ width: 0.02, height: 0.02, centre: true }}
        scalar={(x, y) => x + y}
        vector={() => [1, 0]}
        units={{ length: 'mm', scalar: 'V', vector: 'V/m' }}
      />,
    )
    expect(out, 'the colour ramp carries no scale').toMatch(/data-role="colour-scale"/)
    expect(out, 'the map does not name its axes').toMatch(/data-role="map-axes"/)
    expect(out, 'unit-length arrows read as a magnitude').toMatch(/direction only/)
  })
})
