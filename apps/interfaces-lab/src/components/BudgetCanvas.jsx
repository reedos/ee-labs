import React, { useState } from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'
import PlotLegend from './PlotLegend.jsx'
import { BUDGET_KEY } from '../plotLabels.js'

export default function BudgetCanvas({ margins, pins, position, onFit }) {
  const [limit, setLimit] = useState(12)
  const probe = 1 + Math.round(position * 31)
  const ref = useCanvas((ctx, w, h) => {
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, w, h)
    const area = plotArea(w, h)
    const { sx, sy } = drawFrame(ctx, area, 0, 32, Math.min(-1, margins.margin), limit,
      (v) => v.toFixed(0), (v) => Number(v.toPrecision(3)).toString(),
      { xTitle: 'Simultaneously switching pins', yTitle: 'Bounce / available margin (V)' })
    ctx.save()
    ctx.beginPath()
    ctx.rect(area.x, area.y, area.w, area.h)
    ctx.clip()
    ctx.strokeStyle = COLORS.response
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(sx(0), sy(margins.margin))
    ctx.lineTo(sx(32), sy(margins.margin))
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = COLORS.trace
    ctx.beginPath()
    ctx.moveTo(sx(0), sy(0))
    ctx.lineTo(sx(32), sy(32 * margins.perPin))
    ctx.stroke()
    for (const [count, color] of [[pins, COLORS.spectrum], [probe, COLORS.textBright]]) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(sx(count), sy(count * margins.perPin), 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }, [margins, pins, position, limit, probe])
  return <>
    <PlotLegend items={BUDGET_KEY} />
    <p className="caption" data-reading="sweep">Probe: {probe} pins; bounce {(probe * margins.perPin).toFixed(3)} V; remaining margin {(margins.margin - probe * margins.perPin).toFixed(3)} V</p>
    <canvas ref={ref} className="load-canvas" role="img" aria-label="Ground bounce against switching pin count" data-y-max={limit} />
    <div className="section-heading"><span className="caption">{margins.perPin * 32 > limit ? 'The bounce curve extends above this range.' : 'Dashed: available margin. Amber: current pin count.'}</span>
      <button className="ghost fit-range" aria-label="Fit voltage range" title="Fit voltage range" onClick={() => {
        setLimit(1.1 * Math.max(1, margins.perPin * 32, margins.margin)); onFit?.()
      }}>{'\u2922'}</button></div>
  </>
}
