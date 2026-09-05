import React from 'react'
import { useCanvas, COLORS, plotArea, drawFrame, fmtNum } from '@ee-labs/ui'

// The constellation view: points in the plane, their ideal positions, and the
// boundaries a decision is made against.
//
// A new canvas under PROGRAM.md §4, whose first lab is this one and whose
// second is the Mixed-Signal Lab. That lab draws a converter's output on the
// same picture with a different grid, so two props exist for it and are here
// from the first commit rather than added later.
//
//   grid     { x: number[], y: number[], label }
//            Arbitrary decision boundaries with no points behind them, which is
//            what a converter's code edges are. When `grid` is given the canvas
//            draws it instead of the constellation's own regions.
//   colorBy  { values: number[], labels: string[], title }
//            A key per point, so a cloud can be coloured by a clock phase or by
//            a code rather than by which symbol was sent.
//
// The two are named apart from `ideal` and `regions` deliberately. A decision
// grid is a designer's choice of where the boundaries sit, and a constellation's
// regions are a consequence of where the points are. A canvas that called both
// the same thing would imply the first is the second.

/** How many points read as points rather than as a smear. */
export const MAX_POINTS = 4000

/** The colours a `colorBy` key cycles through, in order. */
export const KEY_COLORS = [COLORS.trace, COLORS.spectrum, COLORS.response, COLORS.phase, COLORS.marker]

/**
 * Where the decision boundaries sit, as line segments in constellation units.
 *
 * For a square constellation they are the midlines between columns and between
 * rows, which is the same thing a converter's code edges are and is why the
 * `grid` prop can replace them. For a circular one they are the rays halfway
 * between neighbouring points.
 */
export function regionsOf({ points, kind = 'auto' }) {
  if (!points || points.length < 4) return { lines: [], rays: [] }
  const n = points.length / 2
  const xs = [...new Set(Array.from({ length: n }, (_, i) => round(points[2 * i])))].sort((a, b) => a - b)
  const ys = [...new Set(Array.from({ length: n }, (_, i) => round(points[2 * i + 1])))].sort((a, b) => a - b)
  const circular = kind === 'circular' || (kind === 'auto' && ys.length > 2 && xs.length === ys.length && xs.length === n)
  if (circular) {
    // Every point sits on one circle, so the boundaries are rays between them.
    const angles = Array.from({ length: n }, (_, i) => Math.atan2(points[2 * i + 1], points[2 * i])).sort(
      (a, b) => a - b,
    )
    const rays = angles.map((a, i) => {
      const next = i === angles.length - 1 ? angles[0] + 2 * Math.PI : angles[i + 1]
      return (a + next) / 2
    })
    return { lines: [], rays }
  }
  const mid = (v) => v.slice(0, -1).map((a, i) => (a + v[i + 1]) / 2)
  return { lines: [], x: mid(xs), y: ys.length > 1 ? mid(ys) : [], rays: [] }
}

const round = (v) => Math.round(v * 1e9) / 1e9

/**
 * The frame the plot uses, in constellation units.
 * It holds every drawn point and every ideal one, so a cloud that spreads under
 * noise is not clipped at the edge where the errors are.
 */
export function extentOf({ points, ideal, grid }) {
  let r = 0.2
  const take = (buf) => {
    if (!buf) return
    for (let i = 0; i < buf.length; i += 2) {
      r = Math.max(r, Math.abs(buf[i]), Math.abs(buf[i + 1]))
    }
  }
  take(points)
  take(ideal)
  if (grid) {
    for (const v of grid.x || []) r = Math.max(r, Math.abs(v))
    for (const v of grid.y || []) r = Math.max(r, Math.abs(v))
  }
  return r * 1.15
}

export default function ConstellationCanvas({
  points = null,
  ideal = null,
  regions = 'auto',
  grid = null,
  colorBy = null,
  evm = null,
  caption = null,
  height = 320,
}) {
  const drawn = points ? Math.min(points.length / 2, MAX_POINTS) : 0
  const extent = extentOf({ points, ideal, grid })
  const bounds = grid || (regions === 'none' ? { x: [], y: [], rays: [] } : regionsOf({ points: ideal, kind: regions }))

  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const area = plotArea(w, h, { topInset: 18 })
      // A square plot, so a rotation reads as a rotation and not as a squeeze.
      const side = Math.min(area.w, area.h)
      const box = { x: area.x + (area.w - side) / 2, y: area.y + (area.h - side) / 2, w: side, h: side, k: area.k }
      const sx = (v) => box.x + ((v + extent) / (2 * extent)) * box.w
      const sy = (v) => box.y + box.h - ((v + extent) / (2 * extent)) * box.h

      drawFrame(ctx, box, -extent, extent, -extent, extent, (v) => fmtNum(v, 2), (v) => fmtNum(v, 2), {
        zeroLine: true,
        xTitle: 'In phase',
        yTitle: 'Quadrature',
      })

      // The boundaries first, so the points sit over them.
      ctx.strokeStyle = COLORS.axis
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      for (const v of bounds.x || []) {
        ctx.beginPath()
        ctx.moveTo(sx(v) + 0.5, box.y)
        ctx.lineTo(sx(v) + 0.5, box.y + box.h)
        ctx.stroke()
      }
      for (const v of bounds.y || []) {
        ctx.beginPath()
        ctx.moveTo(box.x, sy(v) + 0.5)
        ctx.lineTo(box.x + box.w, sy(v) + 0.5)
        ctx.stroke()
      }
      for (const a of bounds.rays || []) {
        ctx.beginPath()
        ctx.moveTo(sx(0), sy(0))
        ctx.lineTo(sx(extent * Math.cos(a)), sy(extent * Math.sin(a)))
        ctx.stroke()
      }
      ctx.setLineDash([])

      // The cloud. Dots rather than a line, because these are samples and not a
      // waveform (REVIEW_PLAYBOOK §6).
      if (points) {
        for (let i = 0; i < drawn; i++) {
          ctx.fillStyle = colorBy
            ? KEY_COLORS[colorBy.values[i] % KEY_COLORS.length]
            : COLORS.trace
          ctx.globalAlpha = drawn > 600 ? 0.35 : 0.75
          ctx.beginPath()
          ctx.arc(sx(points[2 * i]), sy(points[2 * i + 1]), 1.6 * area.k, 0, 2 * Math.PI)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }

      // The ideal points, as crosses, so they are visible through the cloud.
      if (ideal) {
        ctx.strokeStyle = COLORS.textBright
        ctx.lineWidth = 1.5
        const r = 4 * area.k
        for (let i = 0; i < ideal.length / 2; i++) {
          const px = sx(ideal[2 * i])
          const py = sy(ideal[2 * i + 1])
          ctx.beginPath()
          ctx.moveTo(px - r, py)
          ctx.lineTo(px + r, py)
          ctx.moveTo(px, py - r)
          ctx.lineTo(px, py + r)
          ctx.stroke()
        }
      }

      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, monospace`
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      const legend = []
      if (points) legend.push(`${drawn} of ${points.length / 2} symbols`)
      if (grid) legend.push(grid.label || 'decision grid')
      if (colorBy) legend.push(colorBy.title || 'coloured by key')
      if (caption) legend.push(caption)
      ctx.fillText(legend.join(' · '), box.x, box.y - 6 * area.k)

      if (evm) {
        ctx.textAlign = 'right'
        ctx.fillStyle = COLORS.textBright
        ctx.fillText(
          `error vector ${evm.percent.toFixed(2)} % · ${evm.db.toFixed(1)} dB`,
          box.x + box.w,
          box.y - 6 * area.k,
        )
      }
    },
    [points, ideal, regions, grid, colorBy, evm, caption, drawn, extent],
  )

  return (
    <canvas
      ref={ref}
      className="canvas constellation"
      style={{ width: '100%', height }}
      role="img"
      aria-label={`Constellation: ${drawn} of ${points ? points.length / 2 : 0} symbols`}
    />
  )
}
