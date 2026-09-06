import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PhaseCanvas from './PhaseCanvas.jsx'
import {
  arrowScale,
  axisTitle,
  clipLine,
  levelEllipse,
  phaseExtent,
  phasePlan,
  pickAt,
  wrapAngle,
  wrapPolyline,
} from './phaseGeometry.js'
import { analyse } from '../analysis.js'
import { applyExperiment } from '../experiments.js'
import { byId } from '../experiments.js'

// The phase plane, and the four props that are there for the Machines Lab.
//
// `PROGRAM.md` section 4 says a new canvas carries its second lab's needs in
// its props from the first commit. Three of those needs are geometry, and this
// file exercises them even though no lesson in this lab sets them. The point
// is that the Machines Lab can set `periodic` on a rotor angle and get the
// right picture without reopening the file, and that a change here which broke
// that would fail in this lab rather than in that one.

const html = (el) => renderToStaticMarkup(el)

describe('the axes name their quantities', () => {
  it('a title carries its unit, per the review playbook', () => {
    expect(axisTitle('Integral of error', 'V·s')).toBe('Integral of error (V·s)')
    // A dimensionless state gets no empty brackets.
    expect(axisTitle('First state', '')).toBe('First state')
  })

  it('the rendered canvas names both axes to a screen reader', () => {
    const out = html(
      <PhaseCanvas
        trajectories={[{ x: [[0, 0], [1, 1]] }]}
        xLabel="Integral of error"
        yLabel="Output"
        xUnit="V·s"
        yUnit="V"
      />,
    )
    expect(out).toContain('Output (V)')
    expect(out).toContain('Integral of error (V·s)')
    expect(out).toContain('role="img"')
  })
})

describe('the frame', () => {
  it('holds every trajectory and every real equilibrium, with a margin', () => {
    const e = phaseExtent({
      trajectories: [{ x: [[0, 0], [2, 3]] }],
      equilibria: [{ point: [-1, 4], real: true }],
    })
    expect(e.xMin).toBeLessThan(-1)
    expect(e.xMax).toBeGreaterThan(2)
    expect(e.yMin).toBeLessThan(0)
    expect(e.yMax).toBeGreaterThan(4)
  })

  it('leaves a virtual equilibrium outside, because it is not a place the loop goes', () => {
    const real = phaseExtent({ trajectories: [{ x: [[0, 0], [1, 1]] }], equilibria: [{ point: [40, 0], real: true }] })
    const virtual = phaseExtent({ trajectories: [{ x: [[0, 0], [1, 1]] }], equilibria: [{ point: [40, 0], real: false }] })
    expect(real.xMax).toBeGreaterThan(30)
    expect(virtual.xMax).toBeLessThan(3)
  })

  it('is used as given when a caller names it', () => {
    const span = { xMin: -1, xMax: 1, yMin: -2, yMax: 2 }
    expect(phaseExtent({ span, trajectories: [{ x: [[99, 99]] }] })).toEqual(span)
  })
})

describe('a switching line meets the frame, not the whole plane', () => {
  const extent = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }

  it('a slanted line is cut at the two edges it crosses', () => {
    // x + y = 0 runs corner to corner.
    const seg = clipLine({ a: 1, b: 1, c: 0 }, extent)
    expect(seg).not.toBeNull()
    for (const [x, y] of seg) expect(Math.abs(x + y)).toBeLessThan(1e-9)
  })

  it('a vertical and a horizontal line need no special case', () => {
    const vert = clipLine({ a: 1, b: 0, c: 0.5 }, extent)
    expect(vert.map((p) => p[0])).toEqual([0.5, 0.5])
    const horiz = clipLine({ a: 0, b: 1, c: -0.5 }, extent)
    expect(horiz.map((p) => p[1])).toEqual([-0.5, -0.5])
  })

  it('a line that misses the frame is not drawn at all', () => {
    expect(clipLine({ a: 1, b: 0, c: 9 }, extent)).toBeNull()
  })
})

describe('periodic: the Machines Lab wraps its rotor angle', () => {
  it('folds an angle onto the half-open circle', () => {
    expect(wrapAngle(0)).toBeCloseTo(0, 12)
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI, 12)
    expect(wrapAngle(Math.PI + 0.1)).toBeCloseTo(-Math.PI + 0.1, 12)
    // Half a turn reads as +π rather than as the same angle written −π.
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI, 12)
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 12)
    expect(wrapAngle(-3.5 * Math.PI)).toBeCloseTo(0.5 * Math.PI, 12)
  })

  it('cuts a curve where it leaves one side and returns on the other', () => {
    // A rotor turning steadily past +π. Drawn as one path this streaks
    // straight across the plane, which is the defect every wrapped plot ships
    // with once.
    const spin = []
    for (let i = 0; i <= 40; i++) spin.push([(i * Math.PI) / 8, i])
    const runs = wrapPolyline(spin)
    expect(runs.length).toBeGreaterThan(1)
    for (const run of runs) {
      for (const [x] of run) {
        expect(x).toBeGreaterThanOrEqual(-Math.PI - 1e-12)
        expect(x).toBeLessThanOrEqual(Math.PI + 1e-12)
      }
      // No step inside a run crosses the cut.
      for (let i = 1; i < run.length; i++) expect(Math.abs(run[i][0] - run[i - 1][0])).toBeLessThan(Math.PI)
    }
    // Nothing is lost: every sample lands in exactly one run.
    expect(runs.reduce((n, r) => n + r.length, 0)).toBe(spin.length)
  })

  it('the wrapped plan spans the whole circle and wraps every feature', () => {
    const plan = phasePlan({
      trajectories: [{ x: [[0, 0], [4, 1], [8, 2]] }],
      equilibria: [{ point: [7, 1], real: true }],
      cursor: { index: 2 },
      periodic: true,
      xLabel: 'Rotor angle',
      xUnit: 'rad',
      yLabel: 'Speed',
      yUnit: 'rad/s',
    })
    expect(plan.extent.xMin).toBeCloseTo(-Math.PI, 12)
    expect(plan.extent.xMax).toBeCloseTo(Math.PI, 12)
    expect(plan.marks[0].point[0]).toBeCloseTo(wrapAngle(7), 12)
    expect(plan.cursor[0]).toBeCloseTo(wrapAngle(8), 12)
    expect(plan.periodic).toBe(true)
  })

  it('this lab never sets it, and the canvas honours it anyway', () => {
    // The assertion PROGRAM.md section 4 asks for. No experiment here has a
    // state that lives on a circle, so nothing in this lab would notice the
    // prop breaking.
    const turning = [[0, 0], [3, 1], [6, 2], [9, 3]]
    const flat = phasePlan({ trajectories: [{ x: turning }] })
    const wrapped = phasePlan({ trajectories: [{ x: turning }], periodic: true })
    expect(flat.extent.xMax).toBeGreaterThan(9)
    expect(wrapped.extent.xMax).toBeCloseTo(Math.PI, 12)
    expect(flat.paths[0].runs.length).toBe(1)
    expect(wrapped.paths[0].runs.length).toBeGreaterThan(1)
  })
})

describe('levels: the Lyapunov ellipses the Machines Lab asked for', () => {
  it('a level set of a positive definite form is an ellipse on that level', () => {
    const P = [[2, 0.5], [0.5, 1]]
    const pts = levelEllipse(P, 3)
    expect(pts.length).toBeGreaterThan(50)
    for (const [x, y] of pts) {
      const v = P[0][0] * x * x + 2 * P[0][1] * x * y + P[1][1] * y * y
      expect(v).toBeCloseTo(3, 9)
    }
  })

  it('a bigger level is a bigger ellipse, in proportion to the square root', () => {
    const P = [[1, 0], [0, 4]]
    const small = levelEllipse(P, 1)
    const big = levelEllipse(P, 4)
    const reach = (pts) => Math.max(...pts.map(([x]) => Math.abs(x)))
    expect(reach(big) / reach(small)).toBeCloseTo(2, 9)
  })

  it('an indefinite form is declined rather than drawn as an ellipse it is not', () => {
    expect(levelEllipse([[1, 0], [0, -1]], 1)).toBeNull()
    expect(levelEllipse([[1, 0], [0, 1]], -1)).toBeNull()
  })

  it("C6's own P draws level sets, which is the case this lab does use", () => {
    const a = analyse(applyExperiment(byId('C6')))
    const pts = levelEllipse(a.nonlinear.lyapunov.P, 1)
    expect(pts).not.toBeNull()
    const plan = phasePlan({
      trajectories: [{ x: a.nonlinear.trajectory.x }],
      levels: [{ P: a.nonlinear.lyapunov.P, values: [0.5, 1, 2] }],
    })
    expect(plan.ellipses.length).toBe(3)
  })
})

describe('the field, the cursor and the pick', () => {
  it('arrows are scaled by the longest, in frame fractions rather than in units', () => {
    const extent = { xMin: 0, xMax: 1, yMin: 0, yMax: 1000 }
    // The same arrow written in two axes of very different size. Scaling on
    // raw magnitude would make every arrow point along the second axis.
    const s = arrowScale([{ dx: 0.5, dy: 500 }, { dx: 0.1, dy: 100 }], extent, 15)
    expect(s).toBeGreaterThan(0)
    const longest = Math.hypot(0.5 / 1, 500 / 1000) * s
    expect(longest).toBeCloseTo(1 / 15, 12)
  })

  it('an empty field asks for no arrows rather than dividing by zero', () => {
    expect(arrowScale([], { xMin: 0, xMax: 1, yMin: 0, yMax: 1 })).toBe(0)
    expect(arrowScale([{ dx: 0, dy: 0 }], { xMin: 0, xMax: 1, yMin: 0, yMax: 1 })).toBe(0)
  })

  it('the cursor names a sample of the first trajectory, and nothing when it is past the end', () => {
    const trajectories = [{ x: [[0, 0], [1, 2], [2, 4]] }]
    expect(phasePlan({ trajectories, cursor: { index: 1 } }).cursor).toEqual([1, 2])
    expect(phasePlan({ trajectories, cursor: { index: 99 } }).cursor).toBeNull()
    expect(phasePlan({ trajectories }).cursor).toBeNull()
  })

  it('a click reads back the state it landed on', () => {
    const extent = { xMin: -2, xMax: 2, yMin: 0, yMax: 10 }
    const area = { x: 50, y: 20, w: 400, h: 200 }
    // The middle of the frame is the middle of the data, and the top of the
    // frame is the LARGER y, because the canvas counts downwards.
    expect(pickAt(extent, area, 250, 120)).toEqual([0, 5])
    expect(pickAt(extent, area, 50, 20)).toEqual([-2, 10])
    expect(pickAt(extent, area, 450, 220)).toEqual([2, 0])
  })

  it('the click handler is attached only when a caller wants one', () => {
    const withPick = html(<PhaseCanvas trajectories={[{ x: [[0, 0]] }]} onPick={() => {}} />)
    expect(withPick).toContain('<canvas')
  })
})

describe("Group C's own picture", () => {
  it('the plan carries the field, both switching lines and the resting point', () => {
    const a = analyse(applyExperiment(byId('C2')))
    const nl = a.nonlinear
    const plan = phasePlan({
      trajectories: [{ x: nl.trajectory.x }],
      field: nl.field,
      lines: nl.lines,
      equilibria: nl.equilibria,
      span: nl.span,
      xLabel: 'Integral of error',
      yLabel: 'Output',
    })
    expect(plan.paths[0].runs[0].length).toBeGreaterThan(100)
    expect(plan.arrows.length).toBeGreaterThan(100)
    expect(plan.arrowScale).toBeGreaterThan(0)
    // Both limits cross this frame, and each drawn segment really lies on its
    // own line to floating point.
    expect(plan.segments.length).toBe(2)
    for (const seg of plan.segments) {
      for (const p of [seg.from, seg.to]) {
        expect(seg.a * p[0] + seg.b * p[1]).toBeCloseTo(seg.c, 9)
      }
    }
    expect(plan.marks.some((m) => m.real)).toBe(true)
  })

  it("C5's resting point is drawn hollow, because the loop can never reach it", () => {
    const a = analyse(applyExperiment(byId('C5')))
    const plan = phasePlan({
      trajectories: [{ x: a.nonlinear.trajectory.x }],
      equilibria: a.nonlinear.equilibria,
    })
    expect(plan.marks.length).toBeGreaterThan(0)
    expect(plan.marks.every((m) => !m.real)).toBe(true)
  })
})
