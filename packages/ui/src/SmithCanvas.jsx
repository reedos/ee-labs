import React from 'react'

/**
 * The Smith chart.
 *
 * `PROGRAM.md` §4 assigns this canvas to the RF Lab first, with the Fields Lab
 * and the Instruments Lab second and third, so all three labs' needs are in the
 * signature from the first commit rather than added later.
 *
 * The chart is a picture of one complex number. A reflection coefficient of
 * magnitude at most one lives in the unit disc, and the impedance it stands for
 * is read off the two families of circles the map draws there. The renderer
 * draws what it is given. Every centre and every radius arrives as a number,
 * computed by `packages/rf/src/smith.js` from the map Gamma = (z - 1)/(z + 1),
 * and nothing here derives a curve or holds a table of one.
 *
 * The RF Lab passes a load, the circles of both families, and the path a length
 * of line traces towards the generator. The Fields Lab's transmission-line
 * group passes the same load with a rotation and needs no more. The Instruments
 * Lab's network analyser group passes circles of families this file has never
 * heard of, which is why `family` is only a class name and a label here, and is
 * never switched on.
 *
 *   mode       'z' | 'y' | 'both'. Which grid the chart is labelled for. The
 *              admittance chart is the impedance chart turned round, so 'both'
 *              draws the pair overlaid, which is what a matching network needs.
 *   normalise  the reference impedance, in ohms, printed on the chart. Every
 *              number on a Smith chart depends on it, so it is never implicit.
 *   points     [{ id, gamma: [re, im], label, kind }] — labelled markers.
 *              kind: 'load' | 'source' | 'probe' | 'move' | 'ghost'.
 *   paths      [{ id, points: [[re, im], ...], label, kind }] — motion along a
 *              line, or through a matching network. A null inside `points`
 *              breaks the polyline, so a curve that leaves the disc is drawn in
 *              pieces rather than sewn across it.
 *   circles    [{ family, value, cx, cy, radius, label }] — every family the
 *              caller wants shown: r, x, g, b, vswr, q, mag, stability, gain,
 *              noise. Clipped to the disc by the SVG, not by the caller.
 *   caption    the sentence under the chart.
 *
 * What a marker reads is measured in the app and arrives here as a number.
 */
export default function SmithCanvas({
  mode = 'z',
  normalise = 50,
  points = [],
  paths = [],
  circles = [],
  caption = null,
  className = '',
  width = 320,
  height = 320,
  ariaLabel = 'The Smith chart, with the reflection coefficient in the unit disc',
  clipId = 'smith-disc',
}) {
  // The disc fills the square with a margin for the labels at its ends.
  const pad = 18
  const side = Math.min(width, height)
  const R = (side - 2 * pad) / 2
  const ox = width / 2
  const oy = height / 2
  const sx = (re) => ox + re * R
  const sy = (im) => oy - im * R

  return (
    <div className={`smith ${className}`.trim()} data-mode={mode} data-role="smith">
      <svg className="smith-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
        <defs>
          <clipPath id={clipId}>
            <circle cx={ox} cy={oy} r={R} />
          </clipPath>
        </defs>

        <g className="smith-grid" clipPath={`url(#${clipId})`}>
          {circles.map((c, i) => (
            <circle
              key={c.id || `${c.family}-${c.value}-${i}`}
              className={`smith-circle is-${c.family || 'other'}`}
              data-circle={`${c.family || 'other'}:${fmtValue(c.value)}`}
              cx={sx(c.cx)}
              cy={sy(c.cy)}
              r={Math.abs(c.radius) * R}
            />
          ))}
        </g>

        {/* The real axis, and the disc's own edge. The edge is the locus of a
            pure reactance, which reflects everything, so it is drawn heaviest. */}
        <line className="smith-axis" x1={ox - R} y1={oy} x2={ox + R} y2={oy} />
        <circle className="smith-edge" cx={ox} cy={oy} r={R} />

        <g className="smith-paths" clipPath={`url(#${clipId})`}>
          {paths.map((p) => (
            <g key={p.id} className={`smith-path is-${p.kind || 'move'}`} data-path={p.id}>
              {segmentsOf(p.points).map((seg, k) => (
                <polyline key={k} points={seg.map(([re, im]) => `${round(sx(re))},${round(sy(im))}`).join(' ')} />
              ))}
            </g>
          ))}
        </g>

        <g className="smith-points">
          {points.map((p) => (
            <g key={p.id} className={`smith-point is-${p.kind || 'probe'}`} data-point={p.id}>
              <circle cx={round(sx(p.gamma[0]))} cy={round(sy(p.gamma[1]))} r={4} />
              {p.label ? (
                <text x={round(sx(p.gamma[0])) + 7} y={round(sy(p.gamma[1])) - 6} data-role={`label-${p.id}`}>
                  {p.label}
                </text>
              ) : null}
            </g>
          ))}
        </g>

        {/* The three points every reader needs to find first, named rather than
            left to be inferred from the grid. */}
        <text className="smith-anchor" x={ox - R} y={oy + 13} textAnchor="start">
          short
        </text>
        <text className="smith-anchor" x={ox + R} y={oy + 13} textAnchor="end">
          open
        </text>
        <text className="smith-anchor" x={ox} y={oy - 8} textAnchor="middle">
          match
        </text>
        <text className="smith-reference" data-role="reference" x={width / 2} y={height - 4} textAnchor="middle">
          {`${labelOfMode(mode)}, normalised to ${fmtOhms(normalise)}`}
        </text>
      </svg>
      {caption ? (
        <p className="smith-caption" data-role="caption">
          {caption}
        </p>
      ) : null}
    </div>
  )
}

/** What the chart is labelled for, in the words the view switch uses. */
export function labelOfMode(mode) {
  if (mode === 'y') return 'Admittance chart'
  if (mode === 'both') return 'Impedance and admittance charts'
  return 'Impedance chart'
}

/**
 * A polyline broken at every null, so a path that leaves the disc is drawn in
 * pieces. A curve sewn across a gap would read as motion the line never made.
 */
export function segmentsOf(pts) {
  const out = []
  let run = []
  for (const p of pts || []) {
    if (!p) {
      if (run.length > 1) out.push(run)
      run = []
      continue
    }
    run.push(p)
  }
  if (run.length > 1) out.push(run)
  return out
}

const round = (v) => Math.round(v * 100) / 100
const fmtValue = (v) => (Number.isFinite(v) ? String(Number(v.toPrecision(4))) : String(v ?? ''))
const fmtOhms = (v) => `${Number(v.toPrecision(4))} Ω`
