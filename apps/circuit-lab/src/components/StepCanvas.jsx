import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt } from '@ee-labs/ui'

/**
 * Step response: what the circuit does to a sudden change.
 *
 * The same information as the Bode plot, read from the other side. A resonance
 * that shows as a bump on the magnitude curve shows here as overshoot and
 * ringing, and which of the two is easier to recognise depends entirely on what
 * you are trying to decide.
 *
 * `band`, when given, is the tolerance envelope { t, lo, hi } across the
 * sampled builds — its own (coarser) time grid, same duration — shaded under
 * the nominal trace.
 *
 * `range`, when given, is the y-range to draw in — the app holds it sticky
 * across component tuning, so ringing grows and shrinks against one scale
 * instead of the axis rescaling to pin the curve in place. Without it the
 * canvas fits the data itself, band included.
 */
export default function StepCanvas({ t, y, final, band = null, range = null, markers = [] }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const k = area.k || 1

      let lo
      let hi
      if (range) {
        lo = range.lo
        hi = range.hi
      } else {
        lo = 0
        hi = 0
        for (let i = 0; i < y.length; i++) {
          if (y[i] < lo) lo = y[i]
          if (y[i] > hi) hi = y[i]
        }
        // The band counts toward the range: a build that rings past the
        // nominal trace must not be clipped by an axis fitted to the nominal
        // alone.
        if (band) {
          for (let i = 0; i < band.lo.length; i++) {
            if (band.lo[i] < lo) lo = band.lo[i]
            if (band.hi[i] > hi) hi = band.hi[i]
          }
        }
        const pad = (hi - lo) * 0.12 || 0.2
        lo -= pad
        hi += pad
      }

      const tMax = t[t.length - 1] || 1
      const { sx, sy } = drawFrame(
        ctx,
        area,
        0,
        tMax,
        lo,
        hi,
        (v) => fmt(v, '', 3),
        (v) => (Math.abs(hi - lo) > 20 ? v.toFixed(0) : v.toFixed(2)),
        { zeroLine: true, xTitle: 'Time (seconds)', yTitle: 'Output' },
      )

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      // Where it is heading, and the 2% band it has to stay inside to count as
      // settled — the definition behind every settling-time number.
      if (Number.isFinite(final) && final !== 0) {
        ctx.strokeStyle = COLORS.response
        ctx.globalAlpha = 0.5
        ctx.setLineDash([5 * k, 4 * k])
        ctx.lineWidth = 1 * k
        ctx.beginPath()
        ctx.moveTo(area.x, sy(final))
        ctx.lineTo(area.x + area.w, sy(final))
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 0.16
        ctx.fillStyle = COLORS.response
        const a = sy(final * 1.02)
        const b = sy(final * 0.98)
        ctx.fillRect(area.x, Math.min(a, b), area.w, Math.abs(b - a))
        ctx.globalAlpha = 1
      }

      for (const m of markers) {
        if (!(m.t > 0) || m.t > tMax) continue
        const x = sx(m.t)
        ctx.strokeStyle = COLORS.marker
        ctx.globalAlpha = 0.45
        ctx.setLineDash([4 * k, 4 * k])
        ctx.beginPath()
        ctx.moveTo(x, area.y)
        ctx.lineTo(x, area.y + area.h)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
        if (m.label) {
          ctx.fillStyle = COLORS.marker
          ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'top'
          ctx.fillText(m.label, x + 4 * k, area.y + 4 * k)
        }
      }

      // The tolerance envelope first, so the nominal line always reads on top.
      // Fill plus hairline edges: a nearly-agreeing set of builds is a thin
      // band, and edges keep thin honest bands from vanishing entirely.
      if (band) {
        const edge = (arr) => {
          ctx.beginPath()
          for (let i = 0; i < arr.length; i++) {
            const x = sx(band.t[i])
            const yy = sy(arr[i])
            if (i === 0) ctx.moveTo(x, yy)
            else ctx.lineTo(x, yy)
          }
          ctx.stroke()
        }
        ctx.fillStyle = COLORS.trace
        ctx.globalAlpha = 0.14
        ctx.beginPath()
        for (let i = 0; i < band.hi.length; i++) {
          const x = sx(band.t[i])
          const yy = sy(band.hi[i])
          if (i === 0) ctx.moveTo(x, yy)
          else ctx.lineTo(x, yy)
        }
        for (let i = band.lo.length - 1; i >= 0; i--) {
          ctx.lineTo(sx(band.t[i]), sy(band.lo[i]))
        }
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = COLORS.trace
        ctx.lineWidth = 1 * k
        ctx.globalAlpha = 0.35
        edge(band.hi)
        edge(band.lo)
        ctx.globalAlpha = 1
      }

      ctx.strokeStyle = COLORS.trace
      ctx.lineWidth = 1.8 * k
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i < y.length; i++) {
        const x = sx(t[i])
        const yy = sy(y[i])
        if (i === 0) ctx.moveTo(x, yy)
        else ctx.lineTo(x, yy)
      }
      ctx.stroke()
      ctx.restore()
    },
    [t, y, final, band, range, markers],
  )

  // The frame, readable from the DOM: the harness asserts the axes hold
  // still under a nudge and re-frame under a big change — pixels can show a
  // curve moved, but not that the frame did not.
  return (
    <canvas
      ref={ref}
      className="plot"
      role="img"
      aria-label="Step response of the circuit in time"
      data-t-max={t.length ? t[t.length - 1] : 0}
      data-y-hi={range ? range.hi : ''}
    />
  )
}
