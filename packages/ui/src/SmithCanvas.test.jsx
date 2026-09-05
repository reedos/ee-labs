import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SmithCanvas, { labelOfMode, segmentsOf } from './SmithCanvas.jsx'

// The Smith chart, drawn from what it is given.
//
// `PROGRAM.md` §4 names the RF Lab first and the Fields Lab and Instruments Lab
// second and third, so all three prop sets are drawn here. The rule the
// renderer is built on is `Schematic.jsx`'s and `OneLineCanvas.jsx`'s: the
// renderer draws what it is given, and what a marker reads is measured in the
// app. Nothing here needs a browser canvas to paint, so the checks are on the
// markup and on the two exported helpers.

const html = (el) => renderToStaticMarkup(el)

// The two impedance families, at the values RF_LAB_PLAN.md §5 B2 names. Written
// out as centres and radii, because that is the shape the canvas takes.
const R_FAMILY = [0, 0.5, 1, 2].map((r) => ({ family: 'r', value: r, cx: r / (1 + r), cy: 0, radius: 1 / (1 + r) }))
const X_FAMILY = [1, -1].map((x) => ({ family: 'x', value: x, cx: 1, cy: 1 / x, radius: Math.abs(1 / x) }))

describe('the RF Lab, which draws it first', () => {
  it('draws every circle it is given, one element each, labelled by family and value', () => {
    const out = html(<SmithCanvas circles={[...R_FAMILY, ...X_FAMILY]} normalise={50} />)
    expect(out).toMatch(/data-mode="z"/)
    expect((out.match(/smith-circle/g) || []).length).toBe(6)
    expect(out).toContain('data-circle="r:1"')
    expect(out).toContain('data-circle="x:-1"')
    expect(out).toContain('is-r')
    expect(out).toContain('is-x')
  })

  it('puts the r = 1 circle where the algebra puts it, at half the radius', () => {
    // The chart is a 320 by 320 square with an 18 px margin, so the disc has a
    // radius of 142. The r = 1 circle is centred at (0.5, 0) with radius 0.5,
    // which is 71 pixels across from the centre and 71 pixels wide.
    const out = html(<SmithCanvas circles={[R_FAMILY[2]]} />)
    expect(out).toMatch(/cx="231"[^>]*cy="160"[^>]*r="71"/)
  })

  it('names the reference impedance, because every number on the chart depends on it', () => {
    expect(html(<SmithCanvas normalise={50} />)).toContain('Impedance chart, normalised to 50 Ω')
    expect(html(<SmithCanvas mode="y" normalise={75} />)).toContain('Admittance chart, normalised to 75 Ω')
    expect(html(<SmithCanvas mode="both" />)).toContain('Impedance and admittance charts')
    expect(labelOfMode('z')).toBe('Impedance chart')
  })

  it('names the short, the open and the match, so the three anchors are not inferred', () => {
    const out = html(<SmithCanvas />)
    expect(out).toContain('>short<')
    expect(out).toContain('>open<')
    expect(out).toContain('>match<')
  })

  it('carries a caption under the chart when the pane has one', () => {
    expect(html(<SmithCanvas caption="A 100 Ω load, at a third of the way out." />)).toContain('data-role="caption"')
    expect(html(<SmithCanvas />)).not.toContain('data-role="caption"')
  })
})

describe('the Fields Lab, its second user', () => {
  it('draws the load and its rotation towards the generator', () => {
    // The transmission-line group's whole picture: one load, and the circle of
    // constant magnitude a length of line walks it round.
    const gammaL = [1 / 3, 0]
    const turn = []
    for (let k = 0; k <= 36; k++) {
      const a = (-2 * Math.PI * k) / 36
      turn.push([(1 / 3) * Math.cos(a), (1 / 3) * Math.sin(a)])
    }
    const out = html(
      <SmithCanvas
        circles={[{ family: 'vswr', value: 2, cx: 0, cy: 0, radius: 1 / 3 }]}
        points={[{ id: 'load', gamma: gammaL, label: 'Z_L', kind: 'load' }]}
        paths={[{ id: 'towards', points: turn, label: 'towards the generator', kind: 'move' }]}
      />,
    )
    expect(out).toContain('data-point="load"')
    expect(out).toContain('data-role="label-load"')
    expect(out).toContain('data-path="towards"')
    expect(out).toContain('is-load')
    expect(out).toContain('is-move')
    expect((out.match(/<polyline/g) || []).length).toBe(1)
  })

  it('breaks a path at a null rather than sewing it across the gap', () => {
    const broken = [[0, 0], [0.2, 0], null, [0.6, 0], [0.8, 0]]
    const out = html(<SmithCanvas paths={[{ id: 'p', points: broken }]} />)
    expect((out.match(/<polyline/g) || []).length).toBe(2)
    expect(segmentsOf(broken).length).toBe(2)
    // A run of one point is not a line, so it is dropped rather than drawn.
    expect(segmentsOf([[0, 0], null, [0.5, 0], null]).length).toBe(0)
    expect(segmentsOf(null).length).toBe(0)
  })

  it('takes a marker with no label and draws the marker alone', () => {
    const out = html(<SmithCanvas points={[{ id: 'probe', gamma: [0, 0] }]} />)
    expect(out).toContain('data-point="probe"')
    expect(out).toContain('is-probe')
    expect(out).not.toContain('data-role="label-probe"')
  })
})

describe('the Instruments Lab, its third user', () => {
  it('draws a family it has never heard of', () => {
    // The network analyser group puts stability, gain and noise circles on the
    // same chart. The renderer must not switch on the family's name, so a
    // family this file does not know is drawn exactly like one it does.
    const out = html(
      <SmithCanvas
        circles={[
          { family: 'stability', value: 1, cx: 0.9347, cy: 0.9914, radius: 0.4997 },
          { family: 'noise', value: 0.873, cx: 0.1, cy: -0.05, radius: 0.22 },
          { family: 'calibration', value: 42, cx: 0, cy: 0, radius: 0.5 },
        ]}
      />,
    )
    expect((out.match(/smith-circle/g) || []).length).toBe(3)
    expect(out).toContain('data-circle="stability:1"')
    expect(out).toContain('data-circle="noise:0.873"')
    expect(out).toContain('data-circle="calibration:42"')
    expect(out).toContain('is-calibration')
  })

  it('clips every family to the disc through one clip path, and takes its own id', () => {
    const out = html(<SmithCanvas circles={X_FAMILY} clipId="analyser-disc" />)
    expect(out).toContain('id="analyser-disc"')
    // The grid and the paths are clipped. The markers are not, because a label
    // on a point near the edge would lose its text to the clip.
    expect((out.match(/url\(#analyser-disc\)/g) || []).length).toBe(2)
  })

  it('draws an empty chart when it is given nothing, rather than nothing at all', () => {
    const out = html(<SmithCanvas />)
    expect(out).toContain('smith-edge')
    expect(out).toContain('smith-axis')
    expect(out).not.toContain('smith-circle')
  })
})
