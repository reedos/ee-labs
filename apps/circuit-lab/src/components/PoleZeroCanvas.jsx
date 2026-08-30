import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt } from '@ee-labs/ui'

/**
 * Poles and zeros on the s-plane.
 *
 * The most compact statement of what a circuit does. Distance from the origin
 * sets the frequency scale, angle sets the damping, and which half of the plane
 * a pole sits in decides whether the thing is stable at all — so the right half
 * is shaded, because a pole crossing that line is the whole subject of stability.
 */
export default function PoleZeroCanvas({ poles = [], zeros = [] }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const k = area.k || 1

      let span = 1
      for (const [re, im] of [...poles, ...zeros]) {
        span = Math.max(span, Math.abs(re) * 1.4, Math.abs(im) * 1.4)
      }
      // Keep the origin visible and the axes square, so an angle on screen is
      // the angle in the algebra.
      const aspect = area.w / area.h
      const yMax = span
      const xMax = span * aspect

      const { sx, sy } = drawFrame(
        ctx,
        area,
        -xMax,
        xMax,
        -yMax,
        yMax,
        (v) => fmt(v, '', 2),
        (v) => fmt(v, '', 2),
        { zeroLine: true, xTitle: 'Real  σ  (1/s)', yTitle: 'Imaginary  jω  (rad/s)' },
      )

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      // The unstable half.
      ctx.fillStyle = COLORS.marker
      ctx.globalAlpha = 0.07
      const x0 = sx(0)
      ctx.fillRect(x0, area.y, area.x + area.w - x0, area.h)
      ctx.globalAlpha = 1
      ctx.strokeStyle = COLORS.marker
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 1 * k
      ctx.beginPath()
      ctx.moveTo(x0, area.y)
      ctx.lineTo(x0, area.y + area.h)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillStyle = COLORS.marker
      ctx.globalAlpha = 0.75
      ctx.font = `${Math.round(11 * k)}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('unstable', x0 + 6 * k, area.y + 6 * k)
      ctx.globalAlpha = 1

      const r = 7 * k
      ctx.lineWidth = 2 * k

      // Poles: crosses. Zeros: circles. The convention is universal, so it is
      // worth matching exactly.
      ctx.strokeStyle = COLORS.trace
      for (const [re, im] of poles) {
        const x = sx(re)
        const y = sy(im)
        ctx.beginPath()
        ctx.moveTo(x - r, y - r)
        ctx.lineTo(x + r, y + r)
        ctx.moveTo(x + r, y - r)
        ctx.lineTo(x - r, y + r)
        ctx.stroke()
      }
      ctx.strokeStyle = COLORS.response
      for (const [re, im] of zeros) {
        ctx.beginPath()
        ctx.arc(sx(re), sy(im), r, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    },
    [poles, zeros],
  )

  return <canvas ref={ref} className="plot" />
}
