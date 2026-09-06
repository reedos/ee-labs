// The phase plane's drawing plan, computed apart from the drawing.
//
// `PhaseCanvas.jsx` draws to a 2D context, which no test in this suite can
// read. So everything that could be wrong about the picture lives here as
// arithmetic: where the frame sits, where a switching line meets it, how a
// wrapped axis breaks a curve into pieces, where a Lyapunov level set passes.
// The canvas then draws what it is given and adds nothing of its own.
//
// The four features marked for the Machines Lab in `PROGRAM.md` section 4 are
// `levels`, `cursor`, `periodic` and `onPick`. Three of them are geometry and
// are computed here, tested, and never exercised by a lesson in this lab. That
// is deliberate: the second lab should be able to set the prop and get the
// right picture without reopening this file.

/**
 * An angle folded onto (−π, π], which is where a rotor angle lives.
 *
 * Half open at the top rather than the bottom, so half a turn reads as +π
 * rather than as −π. The two are the same angle and only one of them reads
 * as "half a turn forward" on an axis running left to right.
 */
export function wrapAngle(x) {
  const twoPi = 2 * Math.PI
  let v = (x + Math.PI) % twoPi
  if (v < 0) v += twoPi
  const out = v - Math.PI
  return out === -Math.PI ? Math.PI : out
}

/**
 * A polyline, cut where a wrapped axis makes it jump.
 *
 * On a cylinder a trajectory that leaves at +π returns at −π. Drawing it as
 * one path draws a horizontal streak across the whole plane, which is the
 * defect every wrapped plot ships with once. Cutting the path at the jump is
 * the whole fix, and the cut is where the step is more than half the period.
 */
export function wrapPolyline(points, period = 2 * Math.PI) {
  const out = []
  let run = []
  for (const p of points) {
    const x = wrapAngle(p[0])
    if (run.length) {
      const prev = run[run.length - 1][0]
      if (Math.abs(x - prev) > period / 2) {
        out.push(run)
        run = []
      }
    }
    run.push([x, p[1]])
  }
  if (run.length) out.push(run)
  return out
}

/**
 * The frame the picture is drawn in.
 *
 * Every trajectory, every equilibrium and every level set has to fit, with a
 * margin so nothing is drawn hard against the edge. A caller may name the
 * frame outright, and then it is used as given.
 */
export function phaseExtent({ trajectories = [], equilibria = [], span = null, margin = 0.12, periodic = false }) {
  if (span) return { ...span }
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  const see = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    xMin = Math.min(xMin, x)
    xMax = Math.max(xMax, x)
    yMin = Math.min(yMin, y)
    yMax = Math.max(yMax, y)
  }
  for (const tr of trajectories) for (const p of tr.x) see(periodic ? wrapAngle(p[0]) : p[0], p[1])
  // A region with no isolated resting point hands back a null point, and a
  // virtual one sits wherever the algebra put it, often far outside anything
  // the loop does. Neither belongs in the frame.
  for (const e of equilibria) if (e.real && e.point) see(e.point[0], e.point[1])
  if (!Number.isFinite(xMin)) return { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }
  // A wrapped axis is the whole circle, always, so the reader can see where
  // the curve leaves and where it comes back.
  if (periodic) return { xMin: -Math.PI, xMax: Math.PI, yMin: yMin - (yMax - yMin) * margin || -1, yMax: yMax + (yMax - yMin) * margin || 1 }
  const padX = (xMax - xMin) * margin || 0.5
  const padY = (yMax - yMin) * margin || 0.5
  return { xMin: xMin - padX, xMax: xMax + padX, yMin: yMin - padY, yMax: yMax + padY }
}

/**
 * Where a line a·x + b·y = c crosses the frame, as the two points to draw
 * between, or null when it misses the frame entirely.
 *
 * A switching line is infinite and the frame is not, so drawing it means
 * finding the segment inside. Done by intersecting with all four edges and
 * keeping what lands on them, which handles a vertical or horizontal line
 * with no special case.
 */
export function clipLine({ a, b, c }, extent) {
  const { xMin, xMax, yMin, yMax } = extent
  const eps = 1e-9 * Math.max(1, Math.abs(xMax - xMin), Math.abs(yMax - yMin))
  const hits = []
  const add = (x, y) => {
    if (x < xMin - eps || x > xMax + eps || y < yMin - eps || y > yMax + eps) return
    if (hits.some((h) => Math.abs(h[0] - x) < eps && Math.abs(h[1] - y) < eps)) return
    hits.push([x, y])
  }
  if (Math.abs(b) > 1e-15) {
    add(xMin, (c - a * xMin) / b)
    add(xMax, (c - a * xMax) / b)
  }
  if (Math.abs(a) > 1e-15) {
    add((c - b * yMin) / a, yMin)
    add((c - b * yMax) / a, yMax)
  }
  return hits.length >= 2 ? [hits[0], hits[1]] : null
}

/**
 * Points on the ellipse xᵀPx = value, for a symmetric positive definite P.
 *
 * The Machines Lab asks for Lyapunov level sets, and a level set of a
 * quadratic form is an ellipse whose axes are P's eigenvectors and whose
 * half-lengths are √(value/λ). Returns null where P is not positive definite,
 * because a level set of an indefinite form is a hyperbola and drawing it as
 * an ellipse would be a lie about the argument.
 */
export function levelEllipse(P, value, points = 96) {
  const [p, q, r] = [P[0][0], P[0][1], P[1][1]]
  const tr = p + r
  const det = p * r - q * q
  const disc = Math.sqrt(Math.max(0, (tr / 2) * (tr / 2) - det))
  const l1 = tr / 2 + disc
  const l2 = tr / 2 - disc
  if (!(value > 0) || !(l2 > 0)) return null
  // The eigenvector for l1. Where q is zero the form is already aligned.
  const v1 = Math.abs(q) > 1e-15 ? [l1 - r, q] : [1, 0]
  const n1 = Math.hypot(v1[0], v1[1])
  const e1 = [v1[0] / n1, v1[1] / n1]
  const e2 = [-e1[1], e1[0]]
  const a1 = Math.sqrt(value / l1)
  const a2 = Math.sqrt(value / l2)
  const out = []
  for (let i = 0; i <= points; i++) {
    const t = (2 * Math.PI * i) / points
    const cx = a1 * Math.cos(t)
    const cy = a2 * Math.sin(t)
    out.push([e1[0] * cx + e2[0] * cy, e1[1] * cx + e2[1] * cy])
  }
  return out
}

/**
 * An arrow's length, scaled so the longest in the field is one grid step.
 *
 * A vector field drawn to scale is unreadable: near an equilibrium every arrow
 * is a dot and far from it every arrow crosses the plane. Normalising by the
 * largest keeps the direction, which is what the field is for, and keeps the
 * relative speed legible where it matters.
 */
export function arrowScale(arrows, extent, nx = 15) {
  let longest = 0
  const sx = extent.xMax - extent.xMin
  const sy = extent.yMax - extent.yMin
  for (const a of arrows) {
    // Measured in frame fractions, so a plane whose axes are volts and
    // volt-seconds does not get arrows pointing along whichever axis has the
    // larger numbers.
    longest = Math.max(longest, Math.hypot(a.dx / sx, a.dy / sy))
  }
  if (!(longest > 0)) return 0
  return 1 / (nx * longest)
}

/** An axis title with its unit, per REVIEW_PLAYBOOK section 4. */
export const axisTitle = (label, unit) => (unit ? `${label} (${unit})` : label)

/**
 * Everything the canvas draws, for one set of props.
 *
 * One function, so a test reads the same plan the canvas draws. The pieces are
 * kept as data rather than as draw calls: a segment is two points, a curve is
 * a list of points, a mark is a point and a style.
 */
export function phasePlan({
  trajectories = [],
  field = null,
  lines = [],
  equilibria = [],
  levels = [],
  cursor = null,
  periodic = false,
  span = null,
  xLabel = 'First state',
  yLabel = 'Second state',
  xUnit = '',
  yUnit = '',
}) {
  const extent = phaseExtent({ trajectories, equilibria, span, periodic })
  const paths = trajectories.map((tr) => ({
    label: tr.label ?? null,
    colour: tr.colour ?? null,
    runs: periodic ? wrapPolyline(tr.x) : [tr.x.map((p) => [p[0], p[1]])],
  }))
  const arrows = field?.arrows ?? []
  const scale = arrowScale(arrows, extent)
  const segments = []
  for (const line of lines) {
    const seg = clipLine(line, extent)
    if (seg) segments.push({ ...line, from: seg[0], to: seg[1] })
  }
  const ellipses = []
  for (const level of levels) {
    for (const value of level.values ?? []) {
      const pts = levelEllipse(level.P, value)
      if (pts) ellipses.push({ value, points: periodic ? null : pts, wrapped: periodic ? wrapPolyline(pts) : null })
    }
  }
  // The cursor is an index into the first trajectory, shared with the step
  // view so scrubbing one moves the dot on the other.
  let at = null
  if (cursor && Number.isInteger(cursor.index) && trajectories[0]) {
    const p = trajectories[0].x[cursor.index]
    if (p) at = [periodic ? wrapAngle(p[0]) : p[0], p[1]]
  }
  return {
    extent,
    paths,
    arrows,
    arrowScale: scale,
    segments,
    ellipses,
    cursor: at,
    marks: equilibria
      .filter((e) => e.point && Number.isFinite(e.point[0]) && Number.isFinite(e.point[1]))
      .map((e) => ({
        point: periodic ? [wrapAngle(e.point[0]), e.point[1]] : [e.point[0], e.point[1]],
        real: !!e.real,
        label: e.label ?? null,
      })),
    axis: { x: axisTitle(xLabel, xUnit), y: axisTitle(yLabel, yUnit) },
    periodic,
  }
}

/** The frame coordinate a data point lands on, for a click read back. */
export function pickAt(extent, area, px, py) {
  const fx = (px - area.x) / area.w
  const fy = (py - area.y) / area.h
  return [
    extent.xMin + fx * (extent.xMax - extent.xMin),
    extent.yMax - fy * (extent.yMax - extent.yMin),
  ]
}
