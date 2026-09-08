import React, { useMemo, useState } from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'
import { pinDrive } from '../pin.js'
import PlotLegend from './PlotLegend.jsx'
import { LOAD_KEY } from '../plotLabels.js'

export function loadSweep(p) {
  return Array.from({ length: 26 }, (_, i) => {
    const cload = (10 + i * 39.6) * 1e-12
    // Each capacitance is solved by the same network adapter as the pin view.
    const swept = pinDrive({ ...p, cload }, [{ t: 0, value: 1 }], { tEnd: 8 * p.ron * cload })
    return { c: cload, rise: swept.tr }
  })
}

export default function LoadCanvas({ params, result, position = 0, onFit }) {
  const samples = useMemo(() => loadSweep(params), [params])
  const [yMax, setYMax] = useState(65)
  const probeCap = (10 + position * 990) * 1e-12
  const probeRise = Math.log(9) * params.ron * probeCap
  const extent = 1.1 * Math.max(params.riseBudget, ...samples.map((s) => s.rise)) / 1e-9
  const ref = useCanvas((ctx, w, h) => {
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, w, h)
    const area = plotArea(w, h)
    const capMax = 1000
    const { sx, sy } = drawFrame(ctx, area, 0, capMax, 0, yMax,
      (v) => v.toFixed(0), (v) => Number(v.toPrecision(3)).toString(),
      { xTitle: 'Load capacitance (pF)', yTitle: 'Rise time (ns)' })
    ctx.save()
    ctx.beginPath()
    ctx.rect(area.x, area.y, area.w, area.h)
    ctx.clip()
    ctx.strokeStyle = COLORS.response
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(sx(0), sy(params.riseBudget / 1e-9))
    ctx.lineTo(sx(capMax), sy(params.riseBudget / 1e-9))
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = COLORS.trace
    ctx.beginPath()
    samples.forEach((s, i) => i ? ctx.lineTo(sx(s.c / 1e-12), sy(s.rise / 1e-9)) : ctx.moveTo(sx(s.c / 1e-12), sy(s.rise / 1e-9)))
    ctx.stroke()
    ctx.fillStyle = COLORS.spectrum
    ctx.beginPath()
    ctx.arc(sx(params.cload / 1e-12), sy(result.rise.tr / 1e-9), 4, 0, 2 * Math.PI)
    ctx.fill()
    ctx.strokeStyle = COLORS.textBright
    ctx.beginPath()
    ctx.moveTo(sx(probeCap / 1e-12), area.y)
    ctx.lineTo(sx(probeCap / 1e-12), area.y + area.h)
    ctx.stroke()
    ctx.fillStyle = COLORS.textBright
    ctx.beginPath()
    ctx.arc(sx(probeCap / 1e-12), sy(probeRise / 1e-9), 4, 0, 2 * Math.PI)
    ctx.fill()
    ctx.restore()
  }, [samples, params, result, yMax, probeCap, probeRise])
  return <>
    <PlotLegend items={LOAD_KEY} />
    <p className="caption" data-reading="sweep">Probe: {(probeCap / 1e-12).toFixed(1)} pF; rise {(probeRise / 1e-9).toFixed(3)} ns</p>
    <canvas ref={ref} className="load-canvas" role="img" aria-label="Rise time against load capacitance" data-y-max={yMax} />
    <div className="section-heading"><span className="caption">{extent > yMax ? 'Part of the load curve or budget is beyond this range.' : 'Load range: 10 pF to 1 nF.'}</span>
      <button className="ghost fit-range" aria-label="Fit rise range" title="Fit rise range" onClick={() => { setYMax(extent); onFit?.() }}>{'\u2922'}</button></div>
  </>
}
