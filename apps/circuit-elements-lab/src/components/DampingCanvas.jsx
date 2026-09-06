import React, { useMemo } from 'react'
import { useCanvas, COLORS, drawFrame, fmt } from '@ee-labs/ui'
import { MONO, clearRow, clipToFrame, drawEndLabels, drawRightAxis, frameArea, labelInFrame, trackText, unclip } from './timePlot.js'
import { HUE } from '../palette.js'
import { dampingSweep } from '../math.js'

/**
 * The damping sweep: the series resistance walked from R_crit/20 to 50·R_crit
 * on a log axis, and for each value how far v_C overshoots its final value
 * (right axis, %) and how long it takes to settle inside ±2 % of it (left
 * axis), both found on the closed-form response (math.js settleAnalytic). The
 * dashed line is R_crit = 2√(L/C); the dot is where the knob is now, measured
 * on the engine's own transient. The two curves make the trade visible:
 * less resistance means faster first arrival but a longer ring; more means no
 * overshoot but a slow crawl. The quickest settling sits a little below
 * critical, not at it. Settling time takes the power hue (green), overshoot
 * the angle hue (purple, as a shape quantity); each is named where it leaves
 * the frame.
 */
export default function DampingCanvas({ exp, params, at }) {
  const sweep = useMemo(() => dampingSweep(exp, params), [exp, params.E, params.L1, params.C1])
  const ref = useCanvas(
    (ctx, w, h) => {
      trackText(ctx)
      const area = frameArea(w, h, { rightAxis: true })
      const k = area.k
      const pts = sweep.points
      const xs = pts.map((q) => Math.log10(q.R))
      // Settling time on a log scale: it spans two decades across the sweep,
      // and the minimum near R_crit — the point of the experiment — is a
      // flat line at the bottom of a linear one.
      const settle = pts.map((q) => Math.log10(q.settle))
      const over = pts.map((q) => 100 * q.overshoot)
      const sLo = Math.floor(Math.min(...settle) - 0.15)
      const sHi = Math.ceil(Math.max(...settle) + 0.15)
      const oHi = Math.max(5, Math.max(...over)) * 1.12

      const { sx, sy } = drawFrame(ctx, area, xs[0], xs[xs.length - 1], sLo, sHi, (v) => fmt(Math.pow(10, v), 'Ω', 2), (v) => fmt(Math.pow(10, v), 's', 2), {
        xStep: 1,
        yStep: 1,
        xTitle: 'Series resistance',
        yTitle: 'Settling time to ±2 % (s, log)',
      })
      const syR = drawRightAxis(ctx, area, w, 0, oHi, (v) => `${v.toFixed(0)} %`, 'Overshoot of v_C (%)')

      clipToFrame(ctx, area)

      // R_crit underneath.
      const xc = sx(Math.log10(sweep.Rcrit))
      ctx.strokeStyle = COLORS.textBright
      ctx.globalAlpha = 0.6
      ctx.setLineDash([5 * k, 4 * k])
      ctx.lineWidth = 1 * k
      ctx.beginPath()
      ctx.moveTo(xc, area.y)
      ctx.lineTo(xc, area.y + area.h)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      ctx.fillStyle = COLORS.textBright
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(`R_crit = ${fmt(sweep.Rcrit, 'Ω', 3)}`, xc + 4 * k, area.y + 4 * k)

      const curve = (ys, map, color) => {
        ctx.strokeStyle = color
        ctx.lineWidth = 2 * k
        ctx.beginPath()
        xs.forEach((x, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, sx(x), map(ys[i])))
        ctx.stroke()
      }
      curve(over, syR, HUE.angle)
      curve(settle, sy, HUE.power)

      // The fastest-settling point, named.
      {
        const f = sweep.fastest
        const fx = sx(Math.log10(f.R))
        const fy = sy(Math.log10(f.settle))
        ctx.fillStyle = HUE.power
        ctx.beginPath()
        ctx.arc(fx, fy, 3 * k, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = `${Math.round(11 * k)}px ${MONO}`
        // Below the minimum, where neither curve runs; the knob's own dot sits
        // on the curve just above it when R is near critical.
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        const label = `fastest ${fmt(f.R, 'Ω', 2)}`
        ctx.fillText(label, fx + 6 * k, clearRow(ctx, label, fx + 6 * k, fy + 8 * k, area.y, area.y + area.h, k))
      }

      // Where the knob is now, on both curves.
      if (at) {
        const lx = Math.log10(at.R)
        const dot = (v, map, color) => {
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(sx(lx), map(v), 4.5 * k, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = COLORS.marker
          ctx.lineWidth = 1.5 * k
          ctx.stroke()
        }
        dot(Math.log10(at.settle), sy, HUE.power)
        dot(100 * at.overshoot, syR, HUE.angle)
        ctx.fillStyle = COLORS.marker
        ctx.font = `${Math.round(11 * k)}px ${MONO}`
        ctx.textBaseline = 'bottom'
        // At the foot of the frame, stepping up over the fastest point's name when the frame is short.
        // Written to whichever side of the dot has room for the whole of it. A phone frame has room on
        // neither side, and asking only about the right edge pushed the label off the left one, where
        // the clip took the first two characters: the marker read "= 400 Ω, ζ = 2.00".
        const label = `R = ${fmt(at.R, 'Ω', 3)}, ζ = ${at.zeta.toPrecision(3)}`
        const put = labelInFrame(ctx, label, sx(lx), area, 7 * k)
        ctx.textAlign = put.align
        const x = put.x
        ctx.fillText(label, x, clearRow(ctx, label, x, area.y + area.h - 6 * k, area.y, area.y + area.h, k))
      }

      const last = xs.length - 1
      drawEndLabels(ctx, area, [
        { label: 'settling time', color: HUE.power, y: sy(settle[last]) },
        { label: 'overshoot', color: HUE.angle, y: syR(over[last]) },
      ])
      unclip(ctx)
    },
    [sweep, at],
  )
  return <canvas ref={ref} className="plot damping" role="img" aria-label="Damping sweep: settling time and overshoot against series resistance" />
}
