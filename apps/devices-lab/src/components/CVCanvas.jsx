import React from 'react'
import { COLORS, drawFrame, fmt, plotArea, useCanvas } from '@ee-labs/ui'

/**
 * Capacitance against gate voltage, both curves at once.
 *
 * The two curves share the accumulation and depletion branches exactly and part
 * company in inversion, so they are drawn in one colour where they agree and in
 * two where they do not. The three regimes are shaded behind them, and C_ox and
 * C_min are ruled across so the floor can be read off the plot rather than only
 * out of the topbar.
 */
export default function CVCanvas({ mos, className = '' }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!mos) return
      const area = plotArea(w, h, {})
      const { curveHigh, curveLow, cox, cmin, vfb, vt, vg } = mos
      const lo = curveHigh.vg[0]
      const hi = curveHigh.vg[curveHigh.vg.length - 1]
      const top = cox * 1.12
      const sx = (v) => area.x + ((v - lo) / (hi - lo)) * area.w
      const sy = (v) => area.y + area.h - (v / top) * area.h
      // The three regimes, behind everything.
      const bands = [
        [lo, vfb, 'rgba(240, 162, 60, 0.10)'],
        [vfb, vt, 'rgba(95, 168, 255, 0.10)'],
        [vt, hi, 'rgba(56, 224, 176, 0.10)'],
      ]
      for (const [a, b, fill] of bands) {
        ctx.fillStyle = fill
        ctx.fillRect(sx(a), area.y, Math.max(0, sx(b) - sx(a)), area.h)
      }
      drawFrame(ctx, area, lo, hi, 0, top, (v) => v.toFixed(1), (v) => fmt(v * 1e5, '', 3), {
        xTitle: 'gate voltage V_G (V)',
        yTitle: 'capacitance (nF/cm²)',
      })
      // C_ox and C_min, ruled.
      ctx.save()
      ctx.strokeStyle = COLORS.gridMajor
      ctx.setLineDash([4, 4])
      for (const c of [cox, cmin]) {
        ctx.beginPath()
        ctx.moveTo(area.x, sy(c))
        ctx.lineTo(area.x + area.w, sy(c))
        ctx.stroke()
      }
      ctx.setLineDash([])
      const line = (curve, colour, width) => {
        ctx.strokeStyle = colour
        ctx.lineWidth = width
        ctx.beginPath()
        for (let k = 0; k < curve.vg.length; k++) {
          const px = sx(curve.vg[k])
          const py = sy(curve.c[k])
          if (k === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      line(curveLow, COLORS.spectrum, 2.4)
      line(curveHigh, COLORS.trace, 1.8)
      // Where the gate knob currently sits.
      ctx.strokeStyle = COLORS.marker
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(sx(vg), area.y)
      ctx.lineTo(sx(vg), area.y + area.h)
      ctx.stroke()
      ctx.fillStyle = COLORS.text
      ctx.font = `${Math.round(10 * area.k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textBaseline = 'top'
      ctx.fillText('low frequency', area.x + 8, area.y + 6)
      ctx.fillStyle = COLORS.trace
      ctx.fillText('high frequency', area.x + 8, area.y + 20)
      ctx.restore()
    },
    [mos],
  )
  return <canvas ref={ref} className={`cv-canvas ${className}`} aria-label="Capacitance against gate voltage, at two frequencies" />
}
