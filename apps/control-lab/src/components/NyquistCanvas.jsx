import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmtNum } from '@ee-labs/ui'
import { nyquistLabelX } from '../nyquistLabels.js'

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
      // At the boundary gain (Kp on the imaginary-axis crossing) the curve
      // passes through −1 exactly: gain margin -> 1.00x, phase margin -> 0.0°,
      // and the GM/PM labels' own geometry collapses onto the −1 marker they
      // are meant to sit beside. Below 500px there is no room to separate
      // them from it AND from each other, so they are dropped — the same
      // numbers are already in the topbar.
      const narrow = w < 500

      // Frame the CONTENT, at true 1:1 scale. Two rules fight here: a loop
      // with an integrator runs off to infinity (so only the near-origin part
      // of the curve counts, or the −1 point shrinks to nothing), and the old
      // frame was symmetric about zero — which, in a panel three times wider
      // than tall, parked the curve, the unit circle and both margin
      // annotations in a thin sliver at the centre. Frame the curve's bounds
      // plus the two things that must never leave the picture (−1 and the
      // unit circle), pick the one scale that fits both axes so the unit
      // circle stays a circle, and centre the spare room.
      let xLo = -1.6
      let xHi = 1.1
      let yAmp = 1.3
      for (let i = 0; i < re.length; i++) {
        const m = Math.hypot(re[i], im[i])
        if (m < 6) {
          if (re[i] < xLo) xLo = re[i]
          if (re[i] > xHi) xHi = re[i]
          const a = Math.abs(im[i])
          if (a > yAmp) yAmp = a
        }
      }
      xLo -= 0.4
      xHi += 0.4
      yAmp += 0.35
      const scale = Math.min(area.w / (xHi - xLo), area.h / (2 * yAmp))
      const xMid = (xLo + xHi) / 2
      const xHalf = area.w / scale / 2
      const yHalf = area.h / scale / 2
      const { sx, sy } = drawFrame(
        ctx,
        area,
        xMid - xHalf,
        xMid + xHalf,
        -yHalf,
        yHalf,
        // Plain numbers: these axes are dimensionless, and the engineering
        // formatter printed 0.5 as "500 m" — a prefix for a unit it lacks.
        (v) => fmtNum(v),
        (v) => fmtNum(v),
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
          if (!Number.isFinite(re[i]) || !Number.isFinite(im[i])) {
            // BREAK the path across a singularity rather than skipping the
            // point: connecting the neighbours would draw a chord the locus
            // never traverses.
            started = false
            continue
          }
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

      // Which way the curve is traversed as ω rises — the encirclement COUNT
      // has a sign, and a contour without a direction cannot be counted. One
      // arrowhead on the solid (positive-ω) branch, placed a third of the way
      // along so it stays clear of both the tail at the origin and the
      // margin annotations near −1.
      {
        const finite = []
        for (let i = 0; i < re.length; i++) {
          if (Number.isFinite(re[i]) && Number.isFinite(im[i])) finite.push(i)
        }
        if (finite.length > 8) {
          const at = finite[Math.floor(finite.length / 3)]
          const nx = finite[Math.floor(finite.length / 3) + 1]
          const x0 = sx(re[at])
          const y0 = sy(im[at])
          const ang = Math.atan2(sy(im[nx]) - y0, sx(re[nx]) - x0)
          const L = 7 * k
          ctx.strokeStyle = COLORS.trace
          ctx.lineWidth = 1.8 * k
          ctx.beginPath()
          ctx.moveTo(x0 - L * Math.cos(ang - 0.45), y0 - L * Math.sin(ang - 0.45))
          ctx.lineTo(x0, y0)
          ctx.lineTo(x0 - L * Math.cos(ang + 0.45), y0 - L * Math.sin(ang + 0.45))
          ctx.stroke()
        }
      }

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

      // Both margin readouts stack under the −1 marker and END just left of
      // it, rather than centring on it.
      //
      // Centred, "PM 39.1°" ran its right half into the dashed phase-margin
      // ray and the degree sign was drawn through: the three-lag loop at
      // Kp = 4 (lessons 9 and 10) is the reproduction. Ending left of −1 is
      // not a nudge that happens to clear it, it is the one region neither
      // annotation can occupy. The phase ray runs from the origin out to
      // radius 1, so every point on it has x ≥ −1. The gain-margin bracket
      // is drawn along the real axis itself, at the labels' own y minus
      // 8px and more, so its x never matters. See nyquistLabelX in
      // nyquistLabels.js, which is where both claims are asserted.
      const labelRight = (text) => nyquistLabelX(px, ctx.measureText(text).width, area.x, k)

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
        if (!narrow) {
          ctx.fillStyle = COLORS.response
          ctx.font = `${Math.round(12 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
          ctx.textAlign = 'right'
          ctx.textBaseline = 'top'
          // Fixed beside the −1 marker rather than at the connecting line's
          // own midpoint: at the boundary gain that midpoint IS −1, and the
          // label used to land right on top of the marker it is beside.
          const gmText = `GM ${gainMargin.toFixed(2)}×`
          ctx.fillText(gmText, labelRight(gmText), py + 8 * k)
        }
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
        if (!narrow) {
          ctx.fillStyle = COLORS.phase
          ctx.font = `${Math.round(12 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
          ctx.textAlign = 'right'
          ctx.textBaseline = 'top'
          // Stacked BELOW the GM label rather than along the ray to the
          // crossing point: at PM near 0° that ray's own tip lands on the
          // −1 marker (and so on GM's label too) — the exact case ("−1",
          // "PM 0.0°", "GM 1.00×" all overprinting) this stack avoids.
          const pmText = `PM ${phaseMargin.toFixed(1)}°`
          ctx.fillText(pmText, labelRight(pmText), py + 8 * k + 16 * k)
        }
      }

      ctx.restore()
    },
    [re, im, gainMargin, phaseMargin],
  )

  return <canvas ref={ref} className="plot" role="img" aria-label="Nyquist plot: the open loop on the complex plane, against the point minus one" />
}
