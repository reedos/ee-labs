import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'

/**
 * The weight view: an adaptive filter's coefficients against sample number.
 *
 * An adaptive filter is not one filter, so it has no response to draw and no
 * poles to place. What it does have is a sequence of ordinary filters, one a
 * sample, and this is that sequence. Each trace is one tap over the run, and the
 * dashed line behind it is the plant's tap of the same index, which is the value
 * the trace is heading for.
 *
 * The history arrives strided, because the run keeps one row every `stride`
 * samples for the view and every row for a measurement. The x axis is sample
 * number rather than time, since what a lesson counts here is samples.
 */
export default function WeightCanvas({ history, stride, plant, label = null }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const rows = history.length
      const taps = rows ? history[0].length : 0
      if (rows < 2 || taps === 0) return

      let peak = 0
      for (const row of history) for (const v of row) peak = Math.max(peak, Math.abs(v))
      for (const v of plant) peak = Math.max(peak, Math.abs(v))
      peak = peak > 0 ? peak * 1.15 : 1

      const nMax = (rows - 1) * stride
      drawFrame(ctx, area, 0, nMax, -peak, peak, (v) => v.toFixed(0), (v) => v.toFixed(2), {
        zeroLine: true,
        xTitle: 'Sample',
        yTitle: 'Weight',
      })

      const sx = (i) => area.x + (i / (rows - 1)) * area.w
      const sy = (v) => area.y + area.h / 2 - (v / peak) * (area.h / 2)

      // The plant's taps, as the target each trace is heading for.
      ctx.strokeStyle = COLORS.traceGhost
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      for (const v of plant) {
        ctx.beginPath()
        ctx.moveTo(area.x, sy(v))
        ctx.lineTo(area.x + area.w, sy(v))
        ctx.stroke()
      }
      ctx.setLineDash([])

      // One trace a tap. A diverging run leaves the plot, and clamping the
      // drawing to the frame would hide exactly the thing C3 is about, so the
      // trace is clipped to the plot area instead.
      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()
      for (let k = 0; k < taps; k++) {
        ctx.strokeStyle = k === 0 ? COLORS.trace : COLORS.response
        ctx.globalAlpha = k === 0 ? 1 : 0.55
        ctx.lineWidth = k === 0 ? 1.8 : 1.2
        ctx.beginPath()
        for (let i = 0; i < rows; i++) {
          const v = history[i][k]
          const y = Number.isFinite(v) ? sy(v) : sy(v > 0 ? peak : -peak)
          if (i === 0) ctx.moveTo(sx(i), y)
          else ctx.lineTo(sx(i), y)
        }
        ctx.stroke()
      }
      ctx.restore()
      ctx.globalAlpha = 1

      if (label) {
        ctx.fillStyle = COLORS.text
        ctx.font = '11px system-ui, sans-serif'
        ctx.fillText(label, area.x + 6, area.y + 14)
      }
    },
    [history, stride, plant, label],
  )
  return <canvas ref={ref} className="plot" />
}
