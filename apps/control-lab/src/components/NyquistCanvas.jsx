import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt } from '@ee-labs/ui'

/**
 * The open loop plotted on the complex plane, against the point −1.
 *
 * Everything about stability is a statement about that one point. The loop
 * equation is 1 + L = 0, so the loop is on the edge of oscillating exactly when
 * L passes through −1: the signal comes back around inverted and the same size
 * it went out, and negative feedback has become positive.
 *
 * Bode says the same thing split into two plots. This says it in one, and the
 * margins become distances you can see — how far the curve misses −1 along the
 * real axis, and how far around the unit circle it is when it crosses.
 */
export default function NyquistCanvas({ re, im, gainMargin, phaseMargin }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const k = area.k || 1

      // Frame the interesting region rather than the whole excursion: a loop
      // with an integrator runs off to infinity, and zooming to fit that would
      // shrink the −1 point to nothing.
      let span = 2
      for (let i = 0; i < re.length; i++) {
        const m = Math.hypot(re[i], im[i])
        if (m < 6) span = Math.max(span, Math.abs(re[i]) * 1.25, Math.abs(im[i]) * 1.25)
      }
      span = Math.min(span, 6)
      const aspect = area.w / area.h
      const { sx, sy } = drawFrame(
        ctx,
        area,
        -span * aspect,
        span * aspect,
        -span,
        span,
        (v) => fmt(v, '', 2),
        (v) => fmt(v, '', 2),
        { zeroLine: true, xTitle: 'Real', yTitle: 'Imaginary' },
      )

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      // The unit circle: where |L| = 1, and so where phase margin is measured.
      ctx.strokeStyle = COLORS.grid
      ctx.setLineDash([3 * k, 3 * k])
      ctx.lineWidth = 1 * k
      ctx.beginPath()
      ctx.ellipse(sx(0), sy(0), Math.abs(sx(1) - sx(0)), Math.abs(sy(1) - sy(0)), 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])

      // The locus itself, and its mirror image. The conjugate half is what the
      // negative frequencies trace, and the encirclement count that decides
      // stability is a property of the closed contour, not of half of it.
      const draw = (sign, alpha) => {
        ctx.globalAlpha = alpha
        ctx.strokeStyle = COLORS.trace
        ctx.lineWidth = 1.8 * k
        ctx.lineJoin = 'round'
        ctx.beginPath()
        let started = false
        for (let i = 0; i < re.length; i++) {
          if (!Number.isFinite(re[i]) || !Number.isFinite(im[i])) continue
          const x = sx(re[i])
          const y = sy(sign * im[i])
          if (!started) {
            ctx.moveTo(x, y)
            started = true
          } else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      draw(1, 1)
      draw(-1, 0.35)

      // The point everything is about.
      const px = sx(-1)
      const py = sy(0)
      ctx.strokeStyle = COLORS.marker
      ctx.lineWidth = 2.2 * k
      const r = 6 * k
      ctx.beginPath()
      ctx.moveTo(px - r, py - r)
      ctx.lineTo(px + r, py + r)
      ctx.moveTo(px + r, py - r)
      ctx.lineTo(px - r, py + r)
      ctx.stroke()
      ctx.fillStyle = COLORS.marker
      ctx.font = `${Math.round(12 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText('−1', px, py - 10 * k)

      // Gain margin, drawn as what it is: the gap between where the curve
      // crosses the negative real axis and the point it has to avoid.
      if (gainMargin && Number.isFinite(gainMargin) && gainMargin > 0) {
        const cross = -1 / gainMargin
        ctx.strokeStyle = COLORS.response
        ctx.lineWidth = 2 * k
        ctx.beginPath()
        ctx.moveTo(sx(cross), py)
        ctx.lineTo(px, py)
        ctx.stroke()
        ctx.fillStyle = COLORS.response
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(`GM ${gainMargin.toFixed(2)}×`, (sx(cross) + px) / 2, py + 8 * k)
      }

      // Phase margin: the angle from −1 round to where the curve leaves the
      // unit circle.
      if (phaseMargin != null && Number.isFinite(phaseMargin)) {
        const a = Math.PI - (phaseMargin * Math.PI) / 180
        ctx.strokeStyle = COLORS.phase
        ctx.setLineDash([4 * k, 3 * k])
        ctx.lineWidth = 1.6 * k
        ctx.beginPath()
        ctx.moveTo(sx(0), sy(0))
        ctx.lineTo(sx(-Math.cos(Math.PI - a)), sy(-Math.sin(Math.PI - a)))
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = COLORS.phase
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          `PM ${phaseMargin.toFixed(1)}°`,
          sx(-Math.cos(Math.PI - a)) + 8 * k,
          sy(-Math.sin(Math.PI - a)),
        )
      }

      ctx.restore()
    },
    [re, im, gainMargin, phaseMargin],
  )

  return <canvas ref={ref} className="plot" />
}
