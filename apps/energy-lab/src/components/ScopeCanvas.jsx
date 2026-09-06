/**
 * The battery's terminal voltage and current against time, from the exact
 * transient `analysis.js` traces (`x.trace`, a run of `{ t, v, i, z }`).
 * Two stacked plots rather than one dual axis: a fixed change of terminal
 * volts and an amp or two of current do not share a scale honestly, and a
 * second y-axis with no ticks of its own would only look like one does.
 *
 * The cursor (`x.cursor`) is drawn on both, and the CC/CV changeover
 * (`x.tSwitch`), where the experiment has one, is named at its instant.
 */
import React, { useMemo } from 'react'
import { COLORS, drawFrame, plotArea, useCanvas, fmt } from '@ee-labs/ui'

export default function ScopeCanvas({ x, height = 320 }) {
  const plan = useMemo(() => {
    if (!x || !x.trace || !x.trace.length) return null
    const tEnd = x.tEnd
    const vs = x.trace.map((s) => s.v)
    const is = x.trace.map((s) => s.i)
    const vLo = Math.min(...vs)
    const vHi = Math.max(...vs)
    const vPad = Math.max(0.02, (vHi - vLo) * 0.15)
    const iLo = Math.min(0, ...is)
    const iHi = Math.max(0, ...is)
    const iPad = Math.max(0.05, (iHi - iLo) * 0.15)
    return { tEnd, vLo: vLo - vPad, vHi: vHi + vPad, iLo: iLo - iPad, iHi: iHi + iPad }
  }, [x])

  const draw = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    if (!plan) return
    const topH = h * 0.58
    const gap = 8
    const areaV = plotArea(w, topH)
    const areaI = { ...plotArea(w, h - topH - gap), y: topH + gap }

    const fmtT = (v) => fmt(v, 's', 2)
    const { sx: sxV, sy: syV } = drawFrame(ctx, areaV, 0, plan.tEnd, plan.vLo, plan.vHi, fmtT, (v) => fmt(v, 'V', 3), {
      yTitle: 'terminal V',
    })
    const line = (sy, key, color) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 1.8
      ctx.beginPath()
      x.trace.forEach((s, i) => {
        const px = sxV(s.t)
        const py = sy(s[key])
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()
    }
    line(syV, 'v', COLORS.trace)

    const { sx: sxI, sy: syI } = drawFrame(ctx, areaI, 0, plan.tEnd, plan.iLo, plan.iHi, fmtT, (v) => fmt(v, 'A', 3), {
      xTitle: 'time',
      yTitle: 'terminal I',
      zeroLine: true,
    })
    ctx.strokeStyle = COLORS.response
    ctx.lineWidth = 1.8
    ctx.beginPath()
    x.trace.forEach((s, i) => {
      const px = sxI(s.t)
      const py = syI(s.i)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()

    // The cursor, on both plots.
    const cursor = Math.min(plan.tEnd, x.cursor ?? plan.tEnd)
    for (const { sx, area } of [{ sx: sxV, area: areaV }, { sx: sxI, area: areaI }]) {
      ctx.strokeStyle = COLORS.marker
      ctx.lineWidth = 1.2
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(sx(cursor), area.y)
      ctx.lineTo(sx(cursor), area.y + area.h)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // The CC/CV changeover, named at its instant.
    if (Number.isFinite(x.tSwitch)) {
      ctx.strokeStyle = COLORS.spectrum
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(sxV(x.tSwitch), areaV.y)
      ctx.lineTo(sxV(x.tSwitch), areaV.y + areaV.h)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = COLORS.spectrum
      ctx.textAlign = 'left'
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
      ctx.fillText(`CC → CV at ${fmt(x.tSwitch, 's', 3)}`, sxV(x.tSwitch) + 6, areaV.y + 14)
    }
  }

  const ref = useCanvas(draw, [plan, x && x.cursor, x && x.tSwitch, height])
  if (!plan) return null
  return (
    <div className="plot" data-role="scope">
      <canvas ref={ref} style={{ width: '100%', height: `${height}px` }} />
    </div>
  )
}
