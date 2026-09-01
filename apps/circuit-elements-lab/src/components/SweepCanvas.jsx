import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt } from '@ee-labs/ui'

/**
 * A load sweep: one quantity at the port against the load resistance, on a
 * log axis across the knob's whole range. Every point came from a real solve
 * of the circuit with the knob at that value (math.js sweepKnob), so the curve
 * is what the circuit does, not what a formula says about it.
 *
 * `y` chooses the quantity: 'p' the load power, 'v' the load voltage. `at`
 * is the knob's current value, marked so the reader can see where on the
 * curve the schematic is sitting; `rth`, when given, marks the Thévenin
 * resistance — the peak of a power curve, the knee of a voltage curve.
 * `efficiency` overlays load-over-source power as a dashed line on its own
 * 0–100 % scale.
 */
export default function SweepCanvas({ points, y = 'p', at, rth = null, efficiency = false }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      if (!points.length) return
      const area = plotArea(w, h)
      const k = area.k || 1
      const xs = points.map((q) => Math.log10(q.R))
      const ys = points.map((q) => q[y])
      const xMin = xs[0]
      const xMax = xs[xs.length - 1]
      let lo = Math.min(0, ...ys)
      let hi = Math.max(...ys)
      if (hi === lo) hi = lo + 1
      const pad = (hi - lo) * 0.1
      hi += pad
      if (lo < 0) lo -= pad

      const unit = y === 'p' ? 'W' : 'V'
      const { sx, sy } = drawFrame(
        ctx,
        area,
        xMin,
        xMax,
        lo,
        hi,
        (v) => fmt(Math.pow(10, v), 'Ω', 2),
        (v) => fmt(v, '', 2),
        { zeroLine: lo < 0, xStep: 1, xTitle: 'Load resistance', yTitle: y === 'p' ? 'Load power (W)' : 'Load voltage (V)' },
      )

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      // R_th first, underneath everything.
      if (Number.isFinite(rth) && rth > 0) {
        const x = sx(Math.log10(rth))
        ctx.strokeStyle = COLORS.response
        ctx.globalAlpha = 0.6
        ctx.setLineDash([5 * k, 4 * k])
        ctx.lineWidth = 1 * k
        ctx.beginPath()
        ctx.moveTo(x, area.y)
        ctx.lineTo(x, area.y + area.h)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
        ctx.fillStyle = COLORS.response
        ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(`R_th = ${fmt(rth, 'Ω', 3)}`, x + 4 * k, area.y + 4 * k)
      }

      // Efficiency, dashed, on a 0–1 scale mapped to the plot height.
      if (efficiency) {
        ctx.strokeStyle = COLORS.spectrum
        ctx.setLineDash([3 * k, 3 * k])
        ctx.lineWidth = 1.2 * k
        ctx.beginPath()
        points.forEach((q, i) => {
          if (!Number.isFinite(q.efficiency)) return
          const px = sx(xs[i])
          const py = area.y + area.h - Math.min(1, Math.max(0, q.efficiency)) * area.h
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = COLORS.spectrum
        ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'top'
        ctx.fillText('efficiency, 0–100 % (dashed)', area.x + area.w - 6 * k, area.y + 4 * k)
      }

      ctx.strokeStyle = COLORS.trace
      ctx.lineWidth = 2 * k
      ctx.beginPath()
      xs.forEach((x, i) => {
        if (i === 0) ctx.moveTo(sx(x), sy(ys[i]))
        else ctx.lineTo(sx(x), sy(ys[i]))
      })
      ctx.stroke()

      // Where the knob is now.
      if (Number.isFinite(at) && at > 0) {
        const lx = Math.log10(at)
        // Nearest computed point, so the dot sits on the drawn curve.
        let best = 0
        for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - lx) < Math.abs(xs[best] - lx)) best = i
        ctx.fillStyle = COLORS.marker
        ctx.beginPath()
        ctx.arc(sx(xs[best]), sy(ys[best]), 4 * k, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`${fmt(at, 'Ω', 3)} → ${fmt(ys[best], unit, 3)}`, sx(xs[best]) + 7 * k, sy(ys[best]) - 4 * k)
      }
      ctx.restore()
    },
    [points, y, at, rth, efficiency],
  )
  return <canvas ref={ref} className="plot" role="img" aria-label="Load sweep: the port quantity against load resistance" />
}
