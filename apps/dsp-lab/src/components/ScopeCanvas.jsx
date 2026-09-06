import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'

/**
 * The scope: the chain's output against time, with the unfiltered signal behind
 * it when a lesson asks for the comparison.
 *
 * Drawn against `packages/ui`'s plot chrome rather than against a copy of it,
 * so the axes, the ticks and the type sizes are the suite's. What is app-local
 * here is only the decision of what to draw.
 *
 * Sparse samples draw as dots rather than as a line. At four samples a cycle a
 * connected line reads as a triangle wave, which is the rendering being wrong
 * about a signal that is right (`REVIEW_PLAYBOOK.md` §6). Below the threshold
 * the dots are the signal and the faint line is a guide.
 */
const DOTS_BELOW = 220

export default function ScopeCanvas({ buf, ghost, sampleRate, spanMs, yMax = null, label = null }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const n = Math.max(2, Math.min(buf.length, Math.round((spanMs / 1000) * sampleRate)))
      let peak = yMax
      if (peak == null) {
        peak = 0
        for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(buf[i]))
        if (ghost) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(ghost[i]))
        peak = peak > 0 ? peak * 1.15 : 1
      }

      const tMax = (n / sampleRate) * 1000
      drawFrame(ctx, area, 0, tMax, -peak, peak, (v) => `${v.toFixed(2)}`, (v) => v.toFixed(2), {
        zeroLine: true,
        xTitle: 'Time (ms)',
        yTitle: 'Amplitude',
      })

      const sx = (i) => area.x + (i / (n - 1)) * area.w
      const sy = (v) => area.y + area.h / 2 - (v / peak) * (area.h / 2)

      if (ghost) {
        ctx.strokeStyle = COLORS.traceGhost
        ctx.lineWidth = 1.2
        ctx.beginPath()
        for (let i = 0; i < n; i++) {
          const x = sx(i)
          const y = sy(ghost[i])
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      const sparse = n < DOTS_BELOW
      ctx.strokeStyle = sparse ? COLORS.traceDim : COLORS.trace
      ctx.lineWidth = sparse ? 1 : 1.6
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const x = sx(i)
        const y = sy(buf[i])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      if (sparse) {
        ctx.fillStyle = COLORS.trace
        const r = Math.max(1.5, 2.4 * area.k)
        for (let i = 0; i < n; i++) {
          ctx.beginPath()
          ctx.arc(sx(i), sy(buf[i]), r, 0, 2 * Math.PI)
          ctx.fill()
        }
      }

      if (label) {
        ctx.fillStyle = COLORS.text
        ctx.font = `${Math.round(11 * area.k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textAlign = 'right'
        ctx.fillText(label, area.x + area.w, area.y - 2)
        ctx.textAlign = 'left'
      }
    },
    [buf, ghost, sampleRate, spanMs, yMax, label],
  )
  return <canvas ref={ref} className="plot" />
}
