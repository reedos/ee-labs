/**
 * Twenty-four hours of one bus: the array's power and the load's, as bars,
 * with the state of charge running over them as a line. Curtailed and
 * unserved hours are shaded, because what the bus could not do is as much
 * the lesson as what it did.
 */
import React, { useMemo } from 'react'
import { COLORS, drawFrame, plotArea, useCanvas, fmt } from '@ee-labs/ui'
import { shortfallOf } from '../analysis.js'

export default function DayCanvas({ x, height = 320 }) {
  const rows = x && x.g ? x.g.rows : []
  const plan = useMemo(() => {
    if (!rows.length) return null
    const pMax = Math.max(...rows.map((r) => Math.max(r.pv, r.load))) * 1.15
    return { pMax }
  }, [rows])

  const draw = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    if (!plan) return
    const topH = h * 0.7
    const gap = 10
    const areaP = plotArea(w, topH)
    const areaZ = { ...plotArea(w, h - topH - gap), y: topH + gap }
    const n = rows.length

    const { sx, sy } = drawFrame(ctx, areaP, -0.5, n - 0.5, 0, plan.pMax, (v) => (Number.isInteger(v) ? `${v}h` : ''), (v) => fmt(v, 'W', 2), {
      yTitle: 'power',
    })
    const barW = (areaP.w / n) * 0.38
    rows.forEach((r, i) => {
      const cx = sx(i)
      // Curtailed or unserved hours get a backdrop, so what the bus could not
      // do reads as clearly as what it did. The two are told apart by which
      // way the hour was short, and the test lives in analysis.js so this and
      // the hourly table cannot disagree about which hours they were.
      const short = shortfallOf(r)
      if (short) {
        ctx.fillStyle = short === 'curtailed' ? COLORS.spectrumDim : COLORS.traceGhost
        ctx.fillRect(cx - areaP.w / n / 2, areaP.y, areaP.w / n, areaP.h)
      }
      ctx.fillStyle = COLORS.trace
      ctx.fillRect(cx - barW - 1, sy(r.pv), barW, sy(0) - sy(r.pv))
      ctx.fillStyle = COLORS.spectrum
      ctx.fillRect(cx + 1, sy(r.load), barW, sy(0) - sy(r.load))
    })
    // Each word in the colour of the bars it names, so the pair needs no key.
    ctx.fillStyle = COLORS.trace
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('array', areaP.x + 8, areaP.y + 12)
    ctx.fillStyle = COLORS.spectrum
    ctx.fillText('load', areaP.x + 56, areaP.y + 12)

    const { sx: sxZ, sy: syZ } = drawFrame(ctx, areaZ, -0.5, n - 0.5, 0, 1, (v) => (Number.isInteger(v) ? `${v}h` : ''), (v) => v.toFixed(1), {
      xTitle: 'hour of the day',
      yTitle: 'state of charge',
    })
    ctx.strokeStyle = COLORS.response
    ctx.lineWidth = 2
    ctx.beginPath()
    rows.forEach((r, i) => {
      const px = sxZ(i)
      const py = syZ(r.z)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()
  }

  const ref = useCanvas(draw, [plan, rows.length, height])
  if (!plan) return null
  return (
    <div className="plot" data-role="day">
      <canvas ref={ref} style={{ width: '100%', height: `${height}px` }} />
    </div>
  )
}
