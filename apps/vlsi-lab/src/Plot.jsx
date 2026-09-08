import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'

export function PlotLegend({ items }) {
  return <div className="legend" aria-label="Plot legend">{items.map((item, i) => <span className="legend-item" key={i}>
    <i aria-hidden="true" className={`plot-key ${item.kind || 'line'}${item.dashed ? ' dashed' : ''}`} style={{ '--key-color': item.color }} />
    <span>{item.label}</span>
  </span>)}</div>
}

export default function Plot({ traces, xMax, yMax, xTitle, yTitle, marks = [], regions = [], spans = [], cursor, cursorLabel, point, pointLabel, onCursor, label }) {
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
    for (const { from, to, color } of regions) {
      ctx.fillStyle = color
      ctx.globalAlpha = 0.12
      ctx.fillRect(sx(from), area.y, sx(to) - sx(from), area.h)
      ctx.globalAlpha = 1
    }
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
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      if (x != null) { ctx.moveTo(sx(x), area.y); ctx.lineTo(sx(x), area.y + area.h) }
      if (y != null) { ctx.moveTo(area.x, sy(y)); ctx.lineTo(area.x + area.w, sy(y)) }
      ctx.stroke()
    }
    ctx.setLineDash([])
    for (const { from, to, y, color } of spans) {
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(sx(from), sy(y)); ctx.lineTo(sx(to), sy(y))
      for (const x of [from, to]) { ctx.moveTo(sx(x), sy(y) - 4); ctx.lineTo(sx(x), sy(y) + 4) }
      ctx.stroke()
    }
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
    // Paint labels last so a moving cursor cannot strike through their text.
    const directLabel = (text, x, y, color, align) => {
      ctx.font = '10px ui-monospace, monospace'
      ctx.textAlign = align
      const width = ctx.measureText(text).width
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(x - (align === 'center' ? width / 2 : width) - 2, y - 10, width + 4, 13)
      ctx.fillStyle = color
      ctx.fillText(text, x, y)
    }
    for (const { x, y, color = COLORS.marker, direct } of marks) if (direct) {
      directLabel(direct, x != null ? sx(x) : area.x + area.w - 4,
        x != null ? area.y + 14 : sy(y) - 4, color, x != null ? 'center' : 'right')
    }
    for (const { from, to, y, color, direct } of spans) if (direct) {
      directLabel(direct, sx((from + to) / 2), sy(y) - 7, color, 'center')
    }
    ctx.restore()
  }, [traces, xMax, yMax, xTitle, yTitle, marks, regions, spans, cursor, point])
  const move = (e) => {
    if (!onCursor) return
    const box = e.currentTarget.getBoundingClientRect()
    const a = plotArea(box.width, box.height)
    onCursor(Math.max(0, Math.min(xMax, (e.clientX - box.left - a.x) / a.w * xMax)))
  }
  return <>
    <PlotLegend items={[
      ...traces, ...marks.map((m) => ({ color: COLORS.marker, ...m, dashed: true })),
      ...regions.map((r) => ({ ...r, kind: 'region' })), ...spans.map((s) => ({ ...s, kind: 'span' })),
      ...(cursor != null ? [{ color: COLORS.textBright, label: cursorLabel }] : []),
      ...(point ? [{ color: COLORS.textBright, kind: 'dot', label: pointLabel }] : []),
    ]} />
    <canvas className="xy-plot" ref={ref} role="img" aria-label={label} data-x-max={xMax} data-y-max={yMax} data-cursor={cursor}
      onPointerDown={move} onPointerMove={(e) => e.buttons && move(e)} />
  </>
}
