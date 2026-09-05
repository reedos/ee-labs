import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'

// One quantity against the knob that sweeps it, with the present setting
// marked.
//
// Both axes carry their quantity and its units, and the range adapts to the
// content rather than being fixed (REVIEW_PLAYBOOK §4). A curve with a floor
// draws it as a line, because the floor is usually the point: the entropy under
// a code length, or the error count a full traceback reaches.

/** The picture as data: the two ranges, the points in order, and where the mark sits. */
export function sceneOf(curve, width = 640, height = 260) {
  const area = plotArea(width, height)
  const xs = curve.points.map((q) => q.x)
  const ys = curve.points.map((q) => q.y)
  if (curve.second) ys.push(...curve.second.map((q) => q.y))
  if (Number.isFinite(curve.floor)) ys.push(curve.floor)
  if (curve.mark) ys.push(curve.mark.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  // A flat curve still needs a band to sit in, and a curve of counts should
  // reach the axis so that zero reads as zero.
  const span = hi - lo || Math.max(1, Math.abs(hi))
  const yMin = curve.integer ? Math.min(0, lo) : lo - 0.08 * span
  const yMax = hi + 0.08 * span
  const sx = (v) => area.x + ((v - xMin) / (xMax - xMin || 1)) * area.w
  const sy = (v) => area.y + area.h - ((v - yMin) / (yMax - yMin || 1)) * area.h
  return { area, xMin, xMax, yMin, yMax, sx, sy }
}

export default function CurveCanvas({ curve, height = 260 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!curve || !curve.points || curve.points.length < 2) return
      const { area, xMin, xMax, yMin, yMax, sx, sy } = sceneOf(curve, w, h)
      const fmt = (v) => (Math.abs(v) >= 1000 || (v !== 0 && Math.abs(v) < 0.01) ? v.toExponential(1) : String(Number(v.toPrecision(4))))
      drawFrame(ctx, area, xMin, xMax, yMin, yMax, fmt, fmt, { xTitle: curve.xLabel, yTitle: curve.yLabel })

      const line = (points, colour, dash = []) => {
        ctx.save()
        ctx.setLineDash(dash)
        ctx.beginPath()
        points.forEach((q, i) => (i ? ctx.lineTo(sx(q.x), sy(q.y)) : ctx.moveTo(sx(q.x), sy(q.y))))
        ctx.strokeStyle = colour
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()
      }

      if (Number.isFinite(curve.floor)) {
        line(
          [
            { x: xMin, y: curve.floor },
            { x: xMax, y: curve.floor },
          ],
          COLORS.spectrum,
          [5, 4],
        )
        ctx.fillStyle = COLORS.spectrum
        ctx.font = `${Math.round(11 * area.k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textAlign = 'right'
        ctx.fillText(curve.floorLabel || 'floor', area.x + area.w - 4, sy(curve.floor) - 6)
      }
      if (curve.second) line(curve.second, COLORS.response)
      line(curve.points, COLORS.trace)

      // Sparse points are the measurement, so they are drawn as the dots they
      // are and the line between them is a guide (REVIEW_PLAYBOOK §6).
      if (curve.points.length <= 20) {
        ctx.fillStyle = COLORS.trace
        for (const q of curve.points) {
          ctx.beginPath()
          ctx.arc(sx(q.x), sy(q.y), 3, 0, 2 * Math.PI)
          ctx.fill()
        }
      }

      if (curve.mark) {
        const x = sx(curve.mark.x)
        const y = sy(curve.mark.y)
        ctx.strokeStyle = COLORS.marker
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(x, area.y)
        ctx.lineTo(x, area.y + area.h)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.arc(x, y, 4.5, 0, 2 * Math.PI)
        ctx.fillStyle = COLORS.marker
        ctx.fill()
      }
    },
    [JSON.stringify(curve), height],
  )

  return <canvas ref={ref} className="curve-canvas" style={{ height }} role="img" aria-label={curve ? `${curve.yLabel} against ${curve.xLabel}` : 'Curve'} />
}
