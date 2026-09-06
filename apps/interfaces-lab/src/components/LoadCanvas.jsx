import React, { useMemo } from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'
import { pinDrive } from '../pin.js'

export function loadSweep(p) {
  return Array.from({ length: 26 }, (_, i) => {
    const cload = (10 + i * 19.6) * 1e-12
    // Each capacitance is solved by the same network adapter as the pin view.
    const swept = pinDrive({ ...p, cload }, [{ t: 0, value: 1 }], { tEnd: 8 * p.ron * cload })
    return { c: cload, rise: swept.tr }
  })
}

export default function LoadCanvas({ params, result }) {
  const samples = useMemo(() => loadSweep(params), [params])
  const ref = useCanvas((ctx, w, h) => {
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, w, h)
    const area = plotArea(w, h)
    const capMax = Math.max(500, params.cload / 1e-12)
    const yMax = 1.1 * Math.max(params.riseBudget, result.rise.tr, ...samples.map((s) => s.rise)) / 1e-9
    const { sx, sy } = drawFrame(ctx, area, 0, capMax, 0, yMax,
      (v) => v.toFixed(0), (v) => Number(v.toPrecision(3)).toString(),
      { xTitle: 'Load capacitance (pF)', yTitle: 'Rise time (ns)' })
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
  }, [samples, params, result])
  return <canvas ref={ref} className="load-canvas" role="img" aria-label="Rise time against load capacitance" />
}
