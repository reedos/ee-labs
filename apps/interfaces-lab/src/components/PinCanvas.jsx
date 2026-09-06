import React from 'react'
import { COLORS, drawFrame, useCanvas } from '@ee-labs/ui'
import { pinPlotArea } from '../plotLabels.js'

export default function PinCanvas({ run, reference, thresholds, time, onTime, analog }) {
  const unit = run.tEnd >= 1e-6 ? { name: 'us', factor: 1e-6 } : { name: 'ns', factor: 1e-9 }
  const ref = useCanvas((ctx, w, h) => {
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, w, h)
    const area = pinPlotArea(w, h)
    const { sx, sy } = drawFrame(ctx, area, 0, run.tEnd / unit.factor, 0, 5.5,
      (n) => Number(n.toPrecision(3)).toString(), (n) => Number(n.toPrecision(2)).toString(),
      { xTitle: `Time (${unit.name})`, yTitle: 'Pin voltage (V)' })
    ctx.save()
    ctx.beginPath()
    ctx.rect(area.x, area.y, area.w, area.h)
    ctx.clip()
    ctx.fillStyle = 'rgba(240, 162, 60, 0.08)'
    ctx.fillRect(area.x, sy(thresholds.vih), area.w, sy(thresholds.vil) - sy(thresholds.vih))
    for (const [v, color] of [[thresholds.vil, COLORS.spectrum], [thresholds.vih, COLORS.response]]) {
      ctx.strokeStyle = color
      ctx.setLineDash([4, 5])
      ctx.beginPath()
      ctx.moveTo(area.x, sy(v))
      ctx.lineTo(area.x + area.w, sy(v))
      ctx.stroke()
    }
    const trace = (wave, color, dash) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.setLineDash(dash)
      ctx.beginPath()
      wave.samples.forEach((s, i) => {
        const x = sx(s.t / unit.factor)
        const y = sy(s.v)
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      })
      ctx.stroke()
    }
    if (analog) {
      trace(reference, COLORS.spectrum, [6, 5])
      trace(run, COLORS.trace, [])
    }
    ctx.setLineDash([])
    const cx = sx(time / unit.factor)
    ctx.strokeStyle = COLORS.textBright
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, area.y)
    ctx.lineTo(cx, area.y + area.h)
    ctx.stroke()
    if (analog) {
      ctx.fillStyle = COLORS.textBright
      ctx.beginPath()
      ctx.arc(cx, sy(run.at(time).x[0]), 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'left'
    const labelX = area.x + area.w + 5
    const lowY = sy(thresholds.vil)
    const highY = Math.min(sy(thresholds.vih), lowY - 15)
    ctx.fillStyle = COLORS.spectrum
    ctx.fillText('VIL', labelX, lowY + 4)
    ctx.fillStyle = COLORS.response
    ctx.fillText('VIH', labelX, highY + 4)
    ctx.strokeStyle = COLORS.response
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(area.x + area.w, sy(thresholds.vih))
    ctx.lineTo(labelX - 2, highY)
    ctx.stroke()
    ctx.fillStyle = COLORS.textBright
    const cursorLabel = 'Time cursor'
    const labelWidth = ctx.measureText(cursorLabel).width
    ctx.fillText(cursorLabel, Math.max(area.x, Math.min(cx - labelWidth / 2, area.x + area.w - labelWidth)), area.y - 9)
  }, [run, reference, thresholds, time, analog])
  const scrub = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    const area = pinPlotArea(box.width, box.height)
    onTime(Math.min(1, Math.max(0, (event.clientX - box.left - area.x) / area.w)) * run.tEnd)
  }
  return <canvas ref={ref} className="pin-canvas" role="img"
    aria-label="Pin voltage against time with labeled VIL and VIH input limits, shaded undefined logic band, and time cursor"
    data-time-end={run.tEnd} data-voltage-at-quarter={run.at(run.tEnd / 4).x[0]}
    onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); scrub(event) }}
    onPointerMove={(event) => { if (event.buttons) scrub(event) }} />
}
