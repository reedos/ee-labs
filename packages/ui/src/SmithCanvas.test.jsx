import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SmithCanvas, { rotateGamma, smithGeometry, toScreen } from './SmithCanvas.jsx'

// The Smith chart canvas. `PROGRAM.md` §4 gives it to the RF Lab first, with
// the Fields Lab and the Instruments Lab second and third, so all three labs'
// props are driven here.
//
// The chart's arithmetic is not in the canvas and is not tested here.
// `packages/rf/src/smith.test.js` checks that a constant-resistance circle
// really holds every point of constant resistance. This file checks that a
// circle handed to the renderer arrives on screen where its centre and radius
// say it should.

const draw = (props) => renderToStaticMarkup(<SmithCanvas {...props} />)

// The families the RF Lab's B2 draws, computed by hand from the closed forms so
// that this file does not lean on the engine it is testing for.
const GRID = [
  { cx: 0, cy: 0, radius: 1, family: 'r', value: 0 },
  { cx: 0.5, cy: 0, radius: 0.5, family: 'r', value: 1 },
  { cx: 2 / 3, cy: 0, radius: 1 / 3, family: 'r', value: 2 },
  { cx: 1, cy: 1, radius: 1, family: 'x', value: 1 },
  { cx: 1, cy: -1, radius: 1, family: 'x', value: -1 },
]

describe('the disc, and what sits on it', () => {
  it('is square whatever the pane is, so an angle on screen is the angle in the algebra', () => {
    for (const [w, h] of [[320, 320], [640, 240], [200, 500]]) {
      const geo = smithGeometry(w, h)
      expect(geo.cx).toBe(w / 2)
      expect(geo.cy).toBe(h / 2)
      expect(geo.r).toBe(Math.min(w, h) / 2 - 14)
    }
  })

  it('puts the open at the right edge, the short at the left and the match at the centre', () => {
    const geo = smithGeometry(320, 320)
    expect(toScreen(geo, [1, 0])).toEqual([geo.cx + geo.r, geo.cy])
    expect(toScreen(geo, [-1, 0])).toEqual([geo.cx - geo.r, geo.cy])
    expect(toScreen(geo, [0, 0])).toEqual([geo.cx, geo.cy])
  })

  it('puts a positive reactance above the axis, because the imaginary axis points up', () => {
    const geo = smithGeometry(320, 320)
    expect(toScreen(geo, [0, 0.5])[1]).toBeLessThan(geo.cy)
    expect(toScreen(geo, [0, -0.5])[1]).toBeGreaterThan(geo.cy)
  })

  it('draws every family it is given, with its name and its value on the element', () => {
    const svg = draw({ grid: GRID })
    for (const c of GRID) {
      expect(svg, `family ${c.family} = ${c.value}`).toContain(`data-family="${c.family}" data-value="${c.value}"`)
    }
    // And nothing else: the canvas computes no circle of its own.
    expect(svg.match(/class="smith-grid/g).length).toBe(GRID.length)
    expect(draw({}).match(/class="smith-grid/g)).toBeNull()
  })

  it('clips the families to the disc, so a reactance arc does not run off the chart', () => {
    const svg = draw({ grid: GRID })
    expect(svg).toContain('clipPath id="smith-disc"')
    expect(svg).toContain('clip-path="url(#smith-disc)"')
  })

  it('names the reference impedance on the picture, because every point depends on it', () => {
    expect(draw({ z0: 75 })).toContain('75 Ω')
    expect(draw({ z0: 50 })).toContain('50 Ω')
  })

  it('says which chart is on screen, in the label and in the aria text', () => {
    for (const mode of ['impedance', 'admittance', 'both']) {
      const svg = draw({ mode })
      expect(svg).toContain(`data-mode="${mode}"`)
      expect(svg).toContain(`The ${mode} Smith chart`)
    }
  })
})

describe('the marks a lab puts on it', () => {
  it('places a point where its reflection coefficient says, and names it', () => {
    const geo = smithGeometry(320, 320)
    const svg = draw({ points: [{ gamma: [1 / 3, 0], label: '100 Ω', kind: 'load' }] })
    expect(svg).toContain('data-point="100 Ω"')
    expect(svg).toContain('smith-point is-load')
    const [x, y] = toScreen(geo, [1 / 3, 0])
    expect(svg).toContain(`cx="${x}" cy="${y}"`)
  })

  it('draws a locus as a path through every point it was handed', () => {
    const locus = [
      [1 / 3, 0],
      [0, 1 / 3],
      [-1 / 3, 0],
    ]
    const svg = draw({ paths: [{ points: locus, label: 'towards the generator', kind: 'line' }] })
    expect(svg).toContain('data-path="towards the generator"')
    const d = svg.match(/<path[^>]*\sd="([^"]+)"/)[1]
    expect(d.split(/[ML]/).filter(Boolean).length).toBe(locus.length)
  })

  it('draws an overlay circle with a label, and shades the side it was told to', () => {
    const stability = { cx: 0.9347, cy: 0.9914, radius: 0.4997, label: 'load stability', kind: 'stability', shade: 'inside' }
    const svg = draw({ circles: [stability] })
    expect(svg).toContain('data-circle="load stability"')
    expect(svg).toContain('data-shade="inside"')
    expect(svg).toContain('smith-shade')
    // The other side is a mask over the disc, not a second circle.
    const outside = draw({ circles: [{ ...stability, shade: 'outside' }] })
    expect(outside).toContain('data-shade="outside"')
    expect(outside).toContain('<mask id="smith-outside-0"')
    // No shading asked for, none drawn.
    expect(draw({ circles: [{ ...stability, shade: null }] })).not.toContain('smith-shade')
  })

  it('carries a caption under the chart when one is given, and nothing when it is not', () => {
    expect(draw({ caption: 'Leeson' })).toContain('smith-caption')
    expect(draw({})).not.toContain('smith-caption')
  })
})

describe('the calibration plane, which is the Instruments Lab prop', () => {
  it('turns a point clockwise by the degrees asked for, and leaves its magnitude alone', () => {
    for (const deg of [0, 45, 90, 180, 360]) {
      const g = [0.6, 0.2]
      const moved = rotateGamma(g, deg)
      expect(Math.hypot(...moved)).toBeCloseTo(Math.hypot(...g), 12)
      const turned = Math.atan2(g[1], g[0]) - Math.atan2(moved[1], moved[0])
      const wrapped = ((turned % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
      expect(wrapped).toBeCloseTo(((deg * Math.PI) / 180) % (2 * Math.PI), 9)
    }
  })

  it('moves the marks and leaves the chart under them where it was', () => {
    const point = { gamma: [1 / 3, 0], label: 'load' }
    const still = draw({ grid: GRID, points: [point], rotate: 0 })
    const moved = draw({ grid: GRID, points: [point], rotate: 90 })
    const gridOf = (svg) => svg.match(/<circle class="smith-grid[^>]*>/g).join('')
    expect(gridOf(moved)).toBe(gridOf(still))
    expect(moved).not.toBe(still)
    expect(moved).toContain('data-rotate="90"')
  })

  it('moves a path the same way it moves a point', () => {
    const geo = smithGeometry(320, 320)
    const svg = draw({ paths: [{ points: [[0.5, 0]] }], rotate: 90 })
    const [x, y] = toScreen(geo, rotateGamma([0.5, 0], 90))
    expect(svg).toContain(`M${x.toFixed(2)} ${y.toFixed(2)}`)
  })

  it('says in the aria text that the plane has moved, so the reader is not misled', () => {
    expect(draw({ rotate: 30 })).toContain('30 degrees towards the generator')
    expect(draw({ rotate: 0 })).not.toContain('towards the generator')
  })
})

describe('the three labs that share it', () => {
  it('draws what the Fields Lab asks for: two families, one load, one rotation', () => {
    const svg = draw({
      grid: GRID,
      points: [{ gamma: [1 / 3, 0], label: 'Z_L', kind: 'load' }],
      paths: [{ points: [[1 / 3, 0], [0, -1 / 3], [-1 / 3, 0]], label: 'towards the generator', kind: 'line' }],
    })
    expect(svg).toContain('data-point="Z_L"')
    expect(svg).toContain('data-path="towards the generator"')
    expect(svg.match(/class="smith-grid/g).length).toBe(GRID.length)
  })

  it('draws what the Instruments Lab asks for: a measured point behind a moved plane', () => {
    const svg = draw({ points: [{ gamma: [0.4, 0.3], label: 'measured', kind: 'load' }], rotate: 22.5, caption: 'reference plane moved 22.5 degrees' })
    expect(svg).toContain('data-rotate="22.5"')
    expect(svg).toContain('smith-caption')
  })

  it('draws what the RF Lab asks for: the overlaid pair with a stability circle on it', () => {
    const both = [...GRID, { cx: -0.5, cy: 0, radius: 0.5, family: 'g', value: 1 }, { cx: -1, cy: -1, radius: 1, family: 'b', value: 1 }]
    const svg = draw({ mode: 'both', grid: both, circles: [{ cx: 0, cy: 0, radius: 1 / 3, label: 'VSWR 2', kind: 'vswr' }] })
    expect(svg).toContain('data-family="g"')
    expect(svg).toContain('data-family="b"')
    expect(svg).toContain('data-circle="VSWR 2"')
  })
})
