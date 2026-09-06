import React from 'react'
import { COLORS, niceStep, useCanvas } from '@ee-labs/ui'
import { frameArea, trackText, SANS } from './timePlot.js'
import { HUE } from '../palette.js'

/**
 * The contributions: one bar per input to a propagated uncertainty, each the
 * knob's tolerance times the sensitivity of the reading to it, in per cent.
 * Two lines cross them — the quadrature sum, which assumes the inputs are
 * independent, and the worst case, which assumes nothing.
 *
 * `sens` is math.js's `sensitivities`: every bar is a central difference on
 * the solver, not an algebraic guess, and F3's lesson states the closed form
 * the bars are measured against. A bar past ten per cent is drawn in the
 * warning hue, because a linear propagation of a ten-per-cent move is a
 * first-order answer to a question that is no longer first order.
 */
export default function ContribCanvas({ sens }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      trackText(ctx)
      const area = frameArea(w, h, { rightAxis: false })
      const k = area.k
      const rows = sens.rows
      const hi = Math.max(sens.worst, ...rows.map((r) => Math.abs(r.part))) * 1.25 || 1
      const sx = (v) => area.x + (Math.abs(v) / hi) * area.w
      // The foot of the frame is the axis and the two sums' names, and the bars
      // have what is left. Both sums used to be written a quarter of a band
      // apart, which at 390 px is ten pixels, so "in quadrature 0.707 %" and
      // "worst case 1.00 %" were printed over each other.
      const foot = 68 * k
      const bars = Math.max(40 * k, area.h - foot)
      const axisY = area.y + bars
      const band = bars / (rows.length + 0.4)
      const barH = Math.min(26 * k, band * 0.55)

      ctx.font = `${Math.round(10 * k)}px ${SANS}`
      rows.forEach((r, i) => {
        const y = area.y + band * (i + 0.5)
        const x1 = sx(r.part)
        ctx.fillStyle = Math.abs(r.tol) > 10 ? HUE.power : HUE.voltage
        ctx.globalAlpha = 0.85
        ctx.fillRect(area.x, y, Math.max(1, x1 - area.x), barH)
        ctx.globalAlpha = 1
        ctx.fillStyle = COLORS.textBright
        ctx.textAlign = 'left'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`${r.key}  S = ${r.s.toPrecision(3)} × ${r.tol.toPrecision(3)} %`, area.x + 4 * k, y - 2 * k)
        ctx.textBaseline = 'middle'
        ctx.fillText(`${Math.abs(r.part).toPrecision(3)} %`, x1 + 6 * k, y + barH / 2)
      })

      // The two sums, as vertical lines across every bar.
      const lines = [
        { v: sens.quad, label: `in quadrature ${sens.quad.toPrecision(3)} %`, color: HUE.current, dash: [5, 3] },
        { v: sens.worst, label: `worst case ${sens.worst.toPrecision(3)} %`, color: COLORS.textBright, dash: [2, 3] },
      ]
      lines.forEach((l, i) => {
        const x = Math.round(sx(l.v)) + 0.5
        ctx.strokeStyle = l.color
        ctx.lineWidth = 1.5 * k
        ctx.setLineDash(l.dash.map((d) => d * k))
        ctx.beginPath()
        ctx.moveTo(x, area.y)
        ctx.lineTo(x, axisY)
        ctx.stroke()
        ctx.setLineDash([])
        // Each sum named under the axis, on its own row, at its own line. They
        // used to sit inside the bars a quarter of a band apart, which at
        // 390 px is ten pixels: "in quadrature 0.707 %" and "worst case
        // 1.00 %" were printed over each other and over a bar's own value.
        ctx.fillStyle = l.color
        ctx.textBaseline = 'top'
        const back = x > area.x + area.w * 0.8
        ctx.textAlign = back ? 'right' : 'left'
        ctx.fillText(l.label, x + (back ? -4 : 4) * k, axisY + (22 + 14 * i) * k)
      })

      // The axis the bars are measured on: zero at the left, ticks across, and
      // the quantity named. It carried no scale and no unit at all.
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(area.x + 0.5, area.y)
      ctx.lineTo(area.x + 0.5, axisY)
      ctx.moveTo(area.x, Math.round(axisY) + 0.5)
      ctx.lineTo(area.x + area.w, Math.round(axisY) + 0.5)
      ctx.stroke()
      const step = niceStep(hi, 5)
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      for (let v = 0; v <= hi + step * 1e-6; v += step) {
        const x = Math.round(sx(v)) + 0.5
        ctx.strokeStyle = COLORS.grid
        ctx.beginPath()
        ctx.moveTo(x, axisY)
        ctx.lineTo(x, axisY + 4 * k)
        ctx.stroke()
        ctx.fillText(`${Number(v.toPrecision(4))}`, x, axisY + 7 * k)
      }
      ctx.fillText('contribution to the reading (%)', area.x + area.w / 2, axisY + 52 * k)
    },
    [sens],
  )
  return <canvas ref={ref} className="plot contrib" role="img" aria-label="Contributions: one bar per input, its sensitivity times its tolerance, against the quadrature sum and the worst case" />
}
