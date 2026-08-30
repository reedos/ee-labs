import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'
import { fmt } from '@ee-labs/ui'

/**
 * The chain's impulse response, drawn as stems.
 *
 * A stem plot rather than a joined line, because these are samples and not a
 * continuous curve — and for an FIR the stems ARE the coefficients, so the
 * picture is the filter's definition rather than a rendering of its behavior.
 *
 * Reading it alongside the scope: every output sample is this kernel, flipped,
 * slid to the current position, multiplied by the input underneath it and
 * summed. That is convolution, and it is the only description of filtering that
 * covers FIR and IIR at once.
 */
export default function ImpulseCanvas({ h, sampleRate, centre = null, exact = true }) {
  const ref = useCanvas(
    (ctx, w, hpx) => {
      const area = plotArea(w, hpx)
      const k = area.k || 1

      // Show the part that is actually doing something. An IIR tail decays
      // forever in principle, and drawing 4096 stems of nothing hides the 30
      // that matter.
      let last = 0
      let peak = 0
      for (let i = 0; i < h.length; i++) {
        const a = Math.abs(h[i])
        if (a > peak) peak = a
      }
      const floor = Math.max(peak * 1e-4, 1e-12)
      for (let i = h.length - 1; i >= 0; i--) {
        if (Math.abs(h[i]) > floor) {
          last = i
          break
        }
      }
      const n = Math.max(8, Math.min(h.length - 1, last + 2))
      const yMax = Math.max(peak * 1.15, 1e-6)

      const { sx, sy } = drawFrame(
        ctx,
        area,
        0,
        n,
        -yMax,
        yMax,
        (v) => String(Math.round(v)),
        (v) => fmt(v, '', 2),
        { zeroLine: true, xTitle: 'Sample  n', yTitle: 'h[n]' },
      )

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      // The centre of symmetry, where a linear-phase FIR's delay is. Drawn
      // before the stems so it sits behind them.
      if (centre != null && centre <= n) {
        ctx.strokeStyle = COLORS.marker
        ctx.globalAlpha = 0.45
        ctx.lineWidth = 1 * k
        ctx.setLineDash([4 * k, 4 * k])
        ctx.beginPath()
        ctx.moveTo(sx(centre), area.y)
        ctx.lineTo(sx(centre), area.y + area.h)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 0.8
        ctx.fillStyle = COLORS.marker
        ctx.font = `${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(`delay ${centre}`, sx(centre), area.y + 4 * k)
        ctx.globalAlpha = 1
      }

      const y0 = sy(0)
      const wide = area.w / (n + 1) > 4 * k
      ctx.strokeStyle = exact ? COLORS.trace : COLORS.traceGhost
      ctx.fillStyle = exact ? COLORS.trace : COLORS.traceGhost
      ctx.lineWidth = Math.max(1, Math.min(2.5, area.w / (n + 1) / 3)) * k

      for (let i = 0; i <= n && i < h.length; i++) {
        const x = sx(i)
        const y = sy(h[i])
        ctx.beginPath()
        ctx.moveTo(x, y0)
        ctx.lineTo(x, y)
        ctx.stroke()
        // Heads only when they will not merge into a solid band.
        if (wide) {
          ctx.beginPath()
          ctx.arc(x, y, 2 * k, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      ctx.restore()

      if (sampleRate > 0) {
        ctx.fillStyle = COLORS.text
        ctx.font = `${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'top'
        ctx.fillText(
          `${((n / sampleRate) * 1000).toPrecision(3)} ms shown`,
          area.x + area.w,
          area.y + 4 * k,
        )
      }
    },
    [h, sampleRate, centre, exact],
  )

  return <canvas ref={ref} className="plot" role="img" aria-label="Impulse response of the chain, drawn as stems, one per sample" />
}
