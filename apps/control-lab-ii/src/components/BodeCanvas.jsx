import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmtHz, fmtDb, ampToDb } from '@ee-labs/ui'
import { bode } from '@ee-labs/systems'

/**
 * Magnitude and phase of the open loop, with the crossover marked.
 *
 * Not a copy of Control Lab's. That one carries a cursor, a lead overlay and a
 * margin annotation this lab has no use for, so this pane reads the shared
 * `plot.js` and draws the two curves it needs. There is nothing here to
 * promote, which `NEEDS.md` says.
 */
export default function BodeCanvas({ tf, freqs, crossover = null, phaseCrossover = null }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const half = Math.floor(h / 2)
      const curves = bode(tf, freqs)
      const dB = Array.from(curves.magnitude, (m) => ampToDb(m))
      const deg = Array.from(curves.phase, (p) => (p * 180) / Math.PI)
      const fMin = freqs[0]
      const fMax = freqs[freqs.length - 1]
      const lx = (area) => (f) =>
        area.x + ((Math.log10(f) - Math.log10(fMin)) / (Math.log10(fMax) - Math.log10(fMin))) * area.w

      const draw = (area, values, lo, hi, title, fmtY, mark) => {
        const k = area.k || 1
        const { sy } = drawFrame(
          ctx,
          area,
          Math.log10(fMin),
          Math.log10(fMax),
          lo,
          hi,
          (v) => fmtHz(Math.pow(10, v)),
          fmtY,
          { zeroLine: true, xStep: 1, xTitle: 'Frequency (hertz)', yTitle: title },
        )
        const X = lx(area)
        ctx.save()
        ctx.beginPath()
        ctx.rect(area.x, area.y, area.w, area.h)
        ctx.clip()
        if (Number.isFinite(mark)) {
          ctx.strokeStyle = COLORS.marker
          ctx.globalAlpha = 0.5
          ctx.setLineDash([4 * k, 4 * k])
          ctx.beginPath()
          ctx.moveTo(X(mark), area.y)
          ctx.lineTo(X(mark), area.y + area.h)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.globalAlpha = 1
        }
        ctx.strokeStyle = COLORS.trace
        ctx.lineWidth = 1.6 * k
        ctx.beginPath()
        for (let i = 0; i < values.length; i++) {
          const x = X(freqs[i])
          const y = sy(values[i])
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()
      }

      const finite = (arr) => arr.filter((v) => Number.isFinite(v))
      const mLo = Math.min(-40, Math.floor(Math.min(...finite(dB)) / 20) * 20)
      const mHi = Math.max(20, Math.ceil(Math.max(...finite(dB)) / 20) * 20)
      const pLo = Math.min(-270, Math.floor(Math.min(...finite(deg)) / 45) * 45)
      const pHi = Math.max(0, Math.ceil(Math.max(...finite(deg)) / 45) * 45)

      const top = plotArea(w, half)
      draw(top, dB, mLo, mHi, 'Gain (decibels)', (v) => fmtDb(v), crossover)
      const bottomArea = plotArea(w, h - half)
      const bottom = { ...bottomArea, y: bottomArea.y + half }
      draw(bottom, deg, pLo, pHi, 'Phase (degrees)', (v) => `${v.toFixed(0)}°`, phaseCrossover)
    },
    [tf, freqs, crossover, phaseCrossover],
  )

  return <canvas ref={ref} className="plot" role="img" aria-label="Open-loop gain and phase against frequency" />
}
