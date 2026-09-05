import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt, fmtNum } from '@ee-labs/ui'

/**
 * The response in time, with the sample instants marked where there are any.
 *
 * Copied from `apps/control-lab/src/components/StepCanvas.jsx` with the sticky
 * axis dropped and a second trace added. Two copies of this file now exist and
 * a third is the signal to promote it, which is recorded in `NEEDS.md`.
 *
 * The second trace is what Group B needs: the continuous design's response
 * drawn under the digital one, so the disagreement the guard measures is a gap
 * a reader can see rather than a number in a corner.
 */
export default function StepCanvas({
  t,
  y,
  ghost = null,
  samples = null,
  drive = null,
  final = null,
  reference = null,
  yLabel = 'Output',
  yUnit = '',
}) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const k = area.k || 1
      let lo = 0
      let hi = 0
      const see = (v) => {
        if (!Number.isFinite(v)) return
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
      for (let i = 0; i < y.length; i++) see(y[i])
      if (ghost) for (let i = 0; i < ghost.length; i++) see(ghost[i])
      if (drive) for (let i = 0; i < drive.length; i++) see(drive[i])
      see(reference)
      const pad = (hi - lo) * 0.12 || 0.2
      lo -= pad
      hi += pad
      const tMax = t[t.length - 1] || 1
      const { sx, sy } = drawFrame(
        ctx,
        area,
        0,
        tMax,
        lo,
        hi,
        (v) => fmt(v, 's', 3),
        (v) => fmtNum(v, 3),
        { zeroLine: true, xTitle: 'Time (seconds)', yTitle: yUnit ? `${yLabel} (${yUnit})` : yLabel },
      )

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      if (Number.isFinite(reference)) {
        ctx.strokeStyle = COLORS.textBright
        ctx.globalAlpha = 0.55
        ctx.setLineDash([2 * k, 3 * k])
        ctx.beginPath()
        ctx.moveTo(area.x, sy(reference))
        ctx.lineTo(area.x + area.w, sy(reference))
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }

      // The drive, as the staircase it actually is under a hold.
      if (drive) {
        ctx.strokeStyle = COLORS.spectrum
        ctx.globalAlpha = 0.6
        ctx.lineWidth = 1.2 * k
        ctx.beginPath()
        for (let i = 0; i < drive.length; i++) {
          const x0 = sx(t[i])
          const yy = sy(drive[i])
          if (i === 0) ctx.moveTo(x0, yy)
          else {
            ctx.lineTo(x0, sy(drive[i - 1]))
            ctx.lineTo(x0, yy)
          }
        }
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // The comparison trace, under the one being read.
      if (ghost) {
        ctx.strokeStyle = COLORS.response
        ctx.globalAlpha = 0.55
        ctx.lineWidth = 1.4 * k
        ctx.setLineDash([4 * k, 3 * k])
        ctx.beginPath()
        for (let i = 0; i < ghost.length; i++) {
          const x0 = sx(t[i])
          const yy = sy(ghost[i])
          if (i === 0) ctx.moveTo(x0, yy)
          else ctx.lineTo(x0, yy)
        }
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }

      ctx.strokeStyle = COLORS.trace
      ctx.lineWidth = 1.8 * k
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i < y.length; i++) {
        const x0 = sx(t[i])
        const yy = sy(y[i])
        if (i === 0) ctx.moveTo(x0, yy)
        else ctx.lineTo(x0, yy)
      }
      ctx.stroke()

      // The instants the controller can actually see.
      if (samples) {
        ctx.fillStyle = COLORS.marker
        for (let i = 0; i < samples.t.length; i++) {
          if (samples.t[i] > tMax) break
          ctx.beginPath()
          ctx.arc(sx(samples.t[i]), sy(samples.y[i]), 2.6 * k, 0, 2 * Math.PI)
          ctx.fill()
        }
      }
      ctx.restore()
    },
    [t, y, ghost, samples, drive, final, reference, yLabel, yUnit],
  )

  return <canvas ref={ref} className="plot" role="img" aria-label={`${yLabel} against time`} />
}
