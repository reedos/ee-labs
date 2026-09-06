import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'

export default function Plot({ traces, xMax, yMax, xTitle, yTitle, marks = [], onCursor, label }) {
  const ref = useCanvas((ctx, w, h) => {
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, w, h)
    const area = plotArea(w, h)
    const { sx, sy } = drawFrame(ctx, area, 0, xMax, 0, yMax,
      (v) => String(Number(v.toPrecision(3))), (v) => String(Number(v.toPrecision(3))), { xTitle, yTitle })
    ctx.save()
    ctx.beginPath()
    ctx.rect(area.x, area.y, area.w, area.h)
    ctx.clip()
    for (const { points, color, dashed = false } of traces) {
      ctx.strokeStyle = color
      ctx.lineWidth = dashed ? 1.5 : 3
      ctx.setLineDash(dashed ? [5, 5] : [])
      ctx.beginPath()
      let started = false
      for (const [x, y] of points) {
        if (y == null || !Number.isFinite(y)) { started = false; continue }
        if (started) ctx.lineTo(sx(x), sy(y))
        else ctx.moveTo(sx(x), sy(y))
        started = true
      }
      ctx.stroke()
    }
    for (const { x, y, color = COLORS.marker } of marks) {
      ctx.strokeStyle = color
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      if (x != null) { ctx.moveTo(sx(x), area.y); ctx.lineTo(sx(x), area.y + area.h) }
      if (y != null) { ctx.moveTo(area.x, sy(y)); ctx.lineTo(area.x + area.w, sy(y)) }
      ctx.stroke()
    }
    ctx.restore()
  }, [traces, xMax, yMax, xTitle, yTitle, marks])
  return <canvas className="xy-plot" ref={ref} role="img" aria-label={label} onPointerDown={(e) => {
    if (!onCursor) return
    const box = e.currentTarget.getBoundingClientRect()
    const a = plotArea(box.width, box.height)
    onCursor(Math.max(0, Math.min(xMax, (e.clientX - box.left - a.x) / a.w * xMax)))
  }} />
}
