import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'

export default function Plot({ traces, xMax, yMax, xTitle, yTitle, marks = [], cursor, point, onCursor, label }) {
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
    for (const { points, color, dashed = false, width = 3 } of traces) {
      ctx.strokeStyle = color
      ctx.lineWidth = width
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
    ctx.setLineDash([])
    if (cursor != null) {
      ctx.strokeStyle = COLORS.textBright
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(sx(cursor), area.y)
      ctx.lineTo(sx(cursor), area.y + area.h)
      ctx.stroke()
    }
    if (point) {
      ctx.fillStyle = COLORS.textBright
      ctx.beginPath()
      ctx.arc(sx(point[0]), sy(point[1]), 5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }, [traces, xMax, yMax, xTitle, yTitle, marks, cursor, point])
  const move = (e) => {
    if (!onCursor) return
    const box = e.currentTarget.getBoundingClientRect()
    const a = plotArea(box.width, box.height)
    onCursor(Math.max(0, Math.min(xMax, (e.clientX - box.left - a.x) / a.w * xMax)))
  }
  return <canvas className="xy-plot" ref={ref} role="img" aria-label={label} data-x-max={xMax} data-y-max={yMax} data-cursor={cursor}
    onPointerDown={move} onPointerMove={(e) => e.buttons && move(e)} />
}
