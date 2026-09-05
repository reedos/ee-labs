import React from 'react'

/**
 * The Smith chart: the unit disc, the families drawn on it, and what is placed
 * on top.
 *
 * `PROGRAM.md` §4 assigns this canvas to the RF Lab first, with the Fields Lab
 * and the Instruments Lab second and third. All three labs' needs are in the
 * signature from the first commit rather than added later. The Fields Lab needs
 * the two circle families, one load marker and the rotation towards the
 * generator. The Instruments Lab needs a calibration plane it can move, which
 * is `rotate`.
 *
 * The renderer draws what it is given. No circle is computed here, because
 * `apps/fields-lab/NEEDS.md` §3.2 settled that once: the arithmetic lives in
 * the engine packages, which are tested, and two sets of circles in one suite
 * would be two sets that drift apart. The app passes centres and radii and this
 * file turns them into pixels.
 *
 *   mode      'impedance' | 'admittance' | 'both'. It selects nothing here.
 *             It is on the picture so a reader knows which chart is on screen,
 *             and it is in the aria label for a reader who cannot see it.
 *   z0        the reference impedance the chart is normalised to, printed in
 *             the corner, because every point on a chart depends on it.
 *   grid      [{ cx, cy, radius, family, value }] — the families to draw,
 *             clipped to the unit disc. family: 'r' | 'x' | 'g' | 'b'.
 *   points    [{ gamma: [re, im], label, kind }] — kind: 'load' | 'source' |
 *             'match' | 'plain'.
 *   paths     [{ points: [[re, im], ...], label, kind, dashed }] — motion along
 *             a line, or through a matching network.
 *   circles   [{ cx, cy, radius, label, kind, shade }] — the standing-wave, Q,
 *             stability, gain and noise families. `shade` is 'inside',
 *             'outside' or null, and it is how a stability circle says which
 *             side of itself is the unstable one.
 *   rotate    degrees towards the generator, applied to `points` and `paths`
 *             and to nothing else. Moving a calibration plane moves the
 *             measurement, not the chart.
 *   caption   one line under the chart, for the reference plane or a warning.
 *   size      the viewBox is square at this size, whatever the pane's shape.
 */
export default function SmithCanvas({
  mode = 'impedance',
  z0 = 50,
  grid = null,
  points = [],
  paths = [],
  circles = [],
  rotate = 0,
  caption = null,
  size = 320,
  className = '',
  ariaLabel = null,
}) {
  const geo = smithGeometry(size, size)
  const at = (g) => toScreen(geo, rotateGamma(g, rotate))
  const label = ariaLabel || describeChart({ mode, z0, points, circles, rotate })

  return (
    <div className={`smith ${className}`.trim()} data-mode={mode}>
      <svg className="smith-svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} data-rotate={rotate}>
        <defs>
          <clipPath id="smith-disc">
            <circle cx={geo.cx} cy={geo.cy} r={geo.r} />
          </clipPath>
        </defs>

        <circle className="smith-disc" cx={geo.cx} cy={geo.cy} r={geo.r} />

        <g clipPath="url(#smith-disc)">
          {(grid || []).map((c, i) => (
            <circle
              key={`grid-${i}`}
              className={`smith-grid is-${c.family || 'r'}`}
              data-family={c.family || 'r'}
              data-value={c.value}
              cx={geo.cx + geo.r * c.cx}
              cy={geo.cy - geo.r * c.cy}
              r={geo.r * c.radius}
            />
          ))}

          {/* The real axis, which is where every purely resistive load sits. */}
          <line className="smith-axis" x1={geo.cx - geo.r} y1={geo.cy} x2={geo.cx + geo.r} y2={geo.cy} />

          {circles.map((c, i) => (
            <Overlay key={c.label || `circle-${i}`} circle={c} geo={geo} index={i} />
          ))}

          {paths.map((p, i) => (
            <path
              key={p.label || `path-${i}`}
              className={`smith-path is-${p.kind || 'plain'}${p.dashed ? ' is-dashed' : ''}`}
              data-path={p.label || `path-${i}`}
              d={pathOf(p.points || [], at)}
            />
          ))}
        </g>

        {/* The two ends of the real axis are the whole of a reader's bearings. */}
        <text className="smith-edge" x={geo.cx + geo.r - 4} y={geo.cy - 6} textAnchor="end">
          open
        </text>
        <text className="smith-edge" x={geo.cx - geo.r + 4} y={geo.cy - 6} textAnchor="start">
          short
        </text>
        <text className="smith-ref" x={geo.cx} y={size - 4} textAnchor="middle">
          {`${mode} chart, ${round(z0)} Ω`}
        </text>

        {points.map((p, i) => {
          const [x, y] = at(p.gamma)
          return (
            <g key={p.label || `point-${i}`} className={`smith-point is-${p.kind || 'plain'}`} data-point={p.label || `point-${i}`}>
              <circle cx={x} cy={y} r={4.5} />
              {p.label ? (
                <text x={x + 7} y={y - 6}>
                  {p.label}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      {caption ? <p className="smith-caption">{caption}</p> : null}
    </div>
  )
}

function Overlay({ circle, geo, index }) {
  const cx = geo.cx + geo.r * circle.cx
  const cy = geo.cy - geo.r * circle.cy
  const r = geo.r * circle.radius
  const id = circle.label || `circle-${index}`
  const maskId = `smith-outside-${index}`
  return (
    <g className={`smith-circle is-${circle.kind || 'plain'}`} data-circle={id} data-shade={circle.shade || 'none'}>
      {circle.shade === 'outside' ? (
        <>
          <mask id={maskId}>
            <circle cx={geo.cx} cy={geo.cy} r={geo.r} fill="white" />
            <circle cx={cx} cy={cy} r={r} fill="black" />
          </mask>
          <circle className="smith-shade" cx={geo.cx} cy={geo.cy} r={geo.r} mask={`url(#${maskId})`} />
        </>
      ) : null}
      {circle.shade === 'inside' ? <circle className="smith-shade" cx={cx} cy={cy} r={r} /> : null}
      <circle className="smith-circle-line" cx={cx} cy={cy} r={r} />
      {circle.label ? (
        <text className="smith-circle-label" x={cx} y={cy - r - 4} textAnchor="middle">
          {circle.label}
        </text>
      ) : null}
    </g>
  )
}

// ------------------------------------------------------------- the geometry

/**
 * Where the disc sits in a pane, and how big it is.
 *
 * The chart is square whatever the pane is, because an angle on screen has to
 * be the angle in the algebra. A pane wider than it is tall centres the disc in
 * it and leaves the sides empty rather than drawing an ellipse.
 */
export function smithGeometry(width, height, pad = 14) {
  const side = Math.max(1, Math.min(width, height))
  return { cx: width / 2, cy: height / 2, r: Math.max(1, side / 2 - pad), k: side / 320 }
}

/** A reflection coefficient in screen pixels. The imaginary axis points up. */
export function toScreen(geo, gamma) {
  const [re, im] = gamma
  return [geo.cx + geo.r * re, geo.cy - geo.r * im]
}

/**
 * A reflection coefficient turned towards the generator by `degrees`.
 *
 * Clockwise, because that is the direction moving away from the load takes on
 * the chart, and the magnitude is untouched. A calibration plane moved by a
 * length of line is exactly this rotation, which is why the Instruments Lab's
 * network analyser needs no other prop.
 */
export function rotateGamma(gamma, degrees) {
  if (!degrees) return gamma
  const t = (-degrees * Math.PI) / 180
  const [re, im] = gamma
  return [re * Math.cos(t) - im * Math.sin(t), re * Math.sin(t) + im * Math.cos(t)]
}

/** The path data for a locus, in screen coordinates. */
function pathOf(pts, at) {
  if (!pts.length) return ''
  return pts
    .map((g, i) => {
      const [x, y] = at(g)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

const round = (v) => (Number.isFinite(v) ? Number(Number(v).toPrecision(4)).toString() : String(v))

/** What a reader who cannot see the picture is told it holds. */
function describeChart({ mode, z0, points, circles, rotate }) {
  const parts = [`The ${mode} Smith chart, normalised to ${round(z0)} ohms`]
  for (const p of points) if (p.label) parts.push(`${p.label} marked`)
  for (const c of circles) if (c.label) parts.push(`the ${c.label} circle drawn`)
  if (rotate) parts.push(`the reference plane moved ${round(rotate)} degrees towards the generator`)
  return `${parts.join(', ')}.`
}
