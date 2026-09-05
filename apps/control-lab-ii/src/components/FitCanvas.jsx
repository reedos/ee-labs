import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt, fmtNum } from '@ee-labs/ui'

/**
 * The measured step, the fitted model over it, and the residual below.
 *
 * Group E's pane, and the second canvas new to the suite. The residual band is
 * not a decoration. A fit is an approximation and this lab's rule is that an
 * approximation is never on screen without its guard, so the difference
 * between the model and the data is drawn at the same time as the model, on
 * its own axis, at whatever scale it needs.
 */
export default function FitCanvas({ t, y, model, second = null, label = 'first order', residual = null }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const top = Math.round(h * 0.66)
      const k = plotArea(w, h).k || 1

      let lo = 0
      let hi = 0
      for (let i = 0; i < y.length; i++) {
        lo = Math.min(lo, y[i])
        hi = Math.max(hi, y[i])
      }
      const pad = (hi - lo) * 0.12 || 0.2
      const tMax = t[t.length - 1] || 1

      const area = plotArea(w, top)
      const { sx, sy } = drawFrame(
        ctx,
        area,
        0,
        tMax,
        lo - pad,
        hi + pad,
        (v) => fmt(v, 's', 3),
        (v) => fmtNum(v, 3),
        { zeroLine: true, xTitle: 'Time (seconds)', yTitle: 'Output' },
      )
      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()
      // The data first, as points, because it is a measurement.
      ctx.fillStyle = COLORS.spectrum
      for (let i = 0; i < y.length; i += Math.max(1, Math.round(y.length / 160))) {
        ctx.beginPath()
        ctx.arc(sx(t[i]), sy(y[i]), 1.8 * k, 0, 2 * Math.PI)
        ctx.fill()
      }
      const line = (values, colour, dash) => {
        if (!values) return
        ctx.strokeStyle = colour
        ctx.lineWidth = 1.8 * k
        if (dash) ctx.setLineDash(dash)
        ctx.beginPath()
        for (let i = 0; i < values.length; i++) {
          const x = sx(t[i])
          const yy = sy(values[i])
          if (i === 0) ctx.moveTo(x, yy)
          else ctx.lineTo(x, yy)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
      line(second, COLORS.response, [5 * k, 4 * k])
      line(model, COLORS.trace, null)
      ctx.restore()

      // The residual, on its own axis, at its own scale.
      const resid = model ? Array.from(model, (v, i) => y[i] - v) : null
      if (resid) {
        const rMax = Math.max(1e-12, ...resid.map((v) => Math.abs(v)))
        const rArea = plotArea(w, h - top)
        const band = { ...rArea, y: rArea.y + top }
        const r = drawFrame(
          ctx,
          band,
          0,
          tMax,
          -rMax * 1.2,
          rMax * 1.2,
          (v) => fmt(v, 's', 3),
          (v) => fmtNum(v, 2),
          { zeroLine: true, xTitle: 'Time (seconds)', yTitle: 'Data minus model' },
        )
        ctx.save()
        ctx.beginPath()
        ctx.rect(band.x, band.y, band.w, band.h)
        ctx.clip()
        ctx.strokeStyle = COLORS.marker
        ctx.lineWidth = 1.2 * k
        ctx.beginPath()
        for (let i = 0; i < resid.length; i++) {
          const x = r.sx(t[i])
          const yy = r.sy(resid[i])
          if (i === 0) ctx.moveTo(x, yy)
          else ctx.lineTo(x, yy)
        }
        ctx.stroke()
        if (residual != null) {
          ctx.fillStyle = COLORS.textBright
          ctx.font = `${Math.round(10.5 * k)}px ui-sans-serif, system-ui, sans-serif`
          ctx.textAlign = 'right'
          ctx.textBaseline = 'top'
          ctx.fillText(
            `${label}: ${fmtNum(100 * residual, 3)} % of the gain`,
            band.x + band.w - 6 * k,
            band.y + 5 * k,
          )
        }
        ctx.restore()
      }
    },
    [t, y, model, second, label, residual],
  )

  return <canvas ref={ref} className="plot" role="img" aria-label="The measured step, the fitted model, and the residual below" />
}
