import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt } from '@ee-labs/ui'
import { LEFT_COLORS, drawCursor, drawLegend, fmtT, scrubHandlers, spanOf } from './timePlot.js'

/**
 * Where the energy went. The stored energy of each state (½Cv², ½Li²) is
 * stacked from zero; the energy the resistors have dissipated so far sits on
 * top of the stack; the line over everything is what the sources have
 * supplied. The bookkeeping identity — supplied = stored − stored₀ +
 * dissipated — is what the test measures; here you can see it as the line
 * riding on the top of the stack. When the stack rises above the line, the
 * circuit is giving energy back to its sources.
 */
export default function EnergyCanvas({ energy, tEnd, cursor, onCursor }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const k0 = plotArea(w, h).k
      const area = plotArea(w, h, { topInset: 16 * k0 })
      const k = area.k
      const pts = energy.points
      const n = pts.length
      const nStates = energy.states.length
      const t = Float64Array.from(pts, (q) => q.t)
      const stack = []
      let acc = new Float64Array(n)
      for (let s = 0; s < nStates; s++) {
        const top = Float64Array.from(pts, (q, i) => acc[i] + q.storedEach[s])
        stack.push({ lo: acc, hi: top, label: `stored in ${energy.states[s].id}`, color: LEFT_COLORS[s % LEFT_COLORS.length] })
        acc = top
      }
      const dissTop = Float64Array.from(pts, (q, i) => acc[i] + q.dissipated)
      stack.push({ lo: acc, hi: dissTop, label: 'dissipated', color: COLORS.marker })
      const supplied = Float64Array.from(pts, (q) => q.supplied + energy.stored0)
      const [lo, hi] = spanOf([dissTop, supplied])

      const { sx, sy } = drawFrame(ctx, area, 0, tEnd, lo, hi, fmtT, (v) => fmt(v, 'J', 2), {
        zeroLine: true,
        xTitle: 'Time from the step',
        yTitle: 'Energy (J)',
      })

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      for (const band of stack) {
        ctx.fillStyle = band.color
        ctx.globalAlpha = 0.35
        ctx.beginPath()
        ctx.moveTo(sx(t[0]), sy(band.lo[0]))
        for (let i = 1; i < n; i++) ctx.lineTo(sx(t[i]), sy(band.lo[i]))
        for (let i = n - 1; i >= 0; i--) ctx.lineTo(sx(t[i]), sy(band.hi[i]))
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.strokeStyle = band.color
        ctx.lineWidth = 1.2 * k
        ctx.beginPath()
        for (let i = 0; i < n; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, sx(t[i]), sy(band.hi[i]))
        ctx.stroke()
      }

      // Supplied (plus the energy already stored before t=0) rides on the top of the stack.
      ctx.strokeStyle = COLORS.textBright
      ctx.lineWidth = 2 * k
      ctx.setLineDash([6 * k, 4 * k])
      ctx.beginPath()
      for (let i = 0; i < n; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, sx(t[i]), sy(supplied[i]))
      ctx.stroke()
      ctx.setLineDash([])

      if (Number.isFinite(cursor)) drawCursor(ctx, area, sx(Math.min(tEnd, Math.max(0, cursor))))
      ctx.restore()

      drawLegend(ctx, area, [
        ...stack.map((b) => ({ label: b.label, color: b.color })),
        { label: energy.stored0 ? 'supplied + stored₀' : 'supplied', color: COLORS.textBright },
      ])
    },
    [energy, tEnd, cursor],
  )
  return (
    <canvas
      ref={ref}
      className="plot energy"
      role="img"
      aria-label="Energy against time: stored in each element, dissipated, and supplied by the sources; drag to move the cursor"
      {...scrubHandlers(onCursor, tEnd, { topInset: 16 })}
    />
  )
}
