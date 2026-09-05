import React from 'react'
import { COLORS, useCanvas } from '@ee-labs/ui'

/**
 * The pole grid: every position a quantised second-order section can reach.
 *
 * `ZPlaneCanvas` draws the poles a filter has. This draws the poles it could
 * have had, which is a different claim and needs a different picture. The points
 * are the exact set, computed by `poleGrid` from the two feedback coefficients
 * on their grid, so nothing here is sampled or estimated.
 *
 * Only the upper half is drawn. A real section's poles are a conjugate pair, so
 * the lower half is the mirror of the upper one and drawing it doubles the ink
 * for no information.
 *
 * Two boxes of the same size are outlined, on the diagonal and against the real
 * axis, and their counts are printed. That is the whole lesson: the same area
 * holds an order of magnitude more positions in one place than in the other.
 */
export default function PoleGridCanvas({ points, boxes, counts, exact, poles, note = null }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const pad = 34
      const size = Math.min(w - 2 * pad, (h - 2 * pad) * 2)
      const x0 = pad + (w - 2 * pad - size) / 2
      const yBase = h - pad
      const sx = (re) => x0 + ((re + 1) / 2) * size
      const sy = (im) => yBase - im * (size / 2)

      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)

      // The unit circle's upper half, and the real axis under it.
      ctx.strokeStyle = COLORS.axis
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(sx(-1), sy(0))
      ctx.lineTo(sx(1), sy(0))
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(sx(0), sy(0), size / 2, Math.PI, 2 * Math.PI)
      ctx.stroke()

      // Every reachable position, one pixel each. Half opacity, because at ten
      // bits there are 44000 of them and the picture is the density.
      ctx.globalAlpha = 0.55
      ctx.fillStyle = COLORS.response
      for (const p of points) {
        if (p[1] < 0) continue
        ctx.fillRect(sx(p[0]), sy(p[1]), 1, 1)
      }
      ctx.globalAlpha = 1

      // The two boxes, with their counts beside them.
      ctx.font = '11px system-ui, sans-serif'
      for (const [i, b] of boxes.entries()) {
        ctx.strokeStyle = COLORS.marker
        ctx.lineWidth = 1.2
        const bx = sx(b.re)
        const by = sy(b.im + b.side)
        ctx.strokeRect(bx, by, (b.side / 2) * size, (b.side / 2) * size)
        ctx.fillStyle = COLORS.textBright
        ctx.fillText(String(counts[i]), bx + 3, by - 4)
      }

      // The section's own poles, exact and quantised, on top of the grid.
      const dot = (p, colour, r) => {
        if (!p || p[1] < 0) return
        ctx.strokeStyle = colour
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(sx(p[0]), sy(p[1]), r, 0, 2 * Math.PI)
        ctx.stroke()
      }
      for (const p of exact ?? []) dot(p, COLORS.traceGhost, 5)
      for (const p of poles ?? []) dot(p, COLORS.trace, 3.5)

      ctx.fillStyle = COLORS.text
      ctx.fillText('Re', sx(1) - 16, sy(0) + 14)
      ctx.fillText('Im', sx(0) + 6, sy(1) + 12)
      if (note) ctx.fillText(note, x0, pad - 12)
    },
    [points, boxes, counts, exact, poles, note],
  )
  return <canvas ref={ref} className="plot" />
}
