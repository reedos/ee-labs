import React from 'react'
import { useCanvas } from './useCanvas.js'
import { COLORS, drawFrame, plotArea } from './plot.js'
import { fmtHz } from '../format.js'

/**
 * Time-domain view.
 *
 * The horizontal axis counts the signal's OWN cycles rather than absolute
 * milliseconds. That is what keeps the view stable while you explore: move a
 * source from 250 Hz to 2 kHz and a span measured in milliseconds turns the
 * trace into a solid block, so you have to go and fix a second control that has
 * nothing to do with what you were investigating. Measured in cycles, "show me
 * four periods" stays four periods at every frequency.
 *
 * Falls back to milliseconds when there is no periodic source to count — noise
 * on its own has no cycles to measure against.
 *
 * Draws a list of traces rather than one buffer, so the signal before the chain
 * can be laid underneath the signal after it. Seeing both at once is what makes
 * "what did this block actually do to the shape" a question you can answer by
 * looking.
 *
 * When samples outnumber pixels the trace becomes a min/max envelope rather
 * than a decimation: decimation makes an aliased or ringing signal look clean,
 * which is exactly the lie this tool exists to expose.
 */
export default function ScopeCanvas({
  traces,
  sampleRate,
  spanSeconds,
  divisionRate = null,
  yMax,
}) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const k = area.k || 1

      // One x unit is either one cycle of the fundamental or one millisecond.
      const perSecond = divisionRate || 1000
      const xMax = Math.max(1e-9, spanSeconds * perSecond)

      const { sx, sy } = drawFrame(
        ctx,
        area,
        0,
        xMax,
        -yMax,
        yMax,
        (v) => (xMax >= 10 ? v.toFixed(0) : v.toFixed(1)),
        (v) => v.toFixed(Math.abs(yMax) >= 10 ? 0 : 2),
        {
          zeroLine: true,
          xTitle: divisionRate
            ? `Time (cycles of ${fmtHz(divisionRate)}Hz)`
            : 'Time (milliseconds)',
          yTitle: 'Amplitude',
        },
      )

      const n = Math.min(traces[0]?.buf.length || 0, Math.ceil(spanSeconds * sampleRate))
      if (n < 2) return

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      const xOf = (i) => sx((i / sampleRate) * perSecond)
      const samplesPerPx = n / area.w

      // Back to front, so the processed signal is never hidden by its ghost.
      for (const tr of traces) {
        const buf = tr.buf
        if (!buf || buf.length < 2) continue

        ctx.strokeStyle = tr.color || COLORS.trace
        ctx.lineWidth = (tr.dim ? 1 : 1.6) * k
        ctx.lineJoin = 'round'
        ctx.beginPath()

        if (samplesPerPx > 2) {
          for (let px = 0; px < area.w; px++) {
            const i0 = Math.floor(px * samplesPerPx)
            const i1 = Math.min(n, Math.floor((px + 1) * samplesPerPx))
            let lo = Infinity
            let hi = -Infinity
            for (let i = i0; i < i1; i++) {
              if (buf[i] < lo) lo = buf[i]
              if (buf[i] > hi) hi = buf[i]
            }
            if (lo === Infinity) continue
            const x = area.x + px + 0.5
            ctx.moveTo(x, sy(hi))
            ctx.lineTo(x, sy(lo))
          }
          ctx.stroke()
          continue
        }

        for (let i = 0; i < n; i++) {
          const x = xOf(i)
          const y = sy(buf[i])
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()

        // Individual samples become meaningful once they are sparse enough —
        // and seeing them is the point when the question is about sampling.
        if (samplesPerPx < 0.06 && !tr.dim) {
          ctx.beginPath()
          ctx.fillStyle = tr.color || COLORS.trace
          const r = 2 * k
          for (let i = 0; i < n; i++) {
            const x = xOf(i)
            const y = sy(buf[i])
            // Start on the rim, or arc() draws a spoke in from the centre.
            ctx.moveTo(x + r, y)
            ctx.arc(x, y, r, 0, Math.PI * 2)
          }
          ctx.fill()
        }
      }

      ctx.restore()
    },
    [traces, sampleRate, spanSeconds, divisionRate, yMax],
  )

  return <canvas ref={ref} className="plot" />
}
