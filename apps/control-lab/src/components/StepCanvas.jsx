import React from 'react'
import { stickyRange, STEP_X_TITLE } from '../stepAxis.js'
import { useCanvas, COLORS, drawFrame, plotArea, fmt, fmtNum } from '@ee-labs/ui'

/**
 * Step response: what the circuit does to a sudden change.
 *
 * The same information as the Bode plot, read from the other side. A resonance
 * that shows as a bump on the magnitude curve shows here as overshoot and
 * ringing, and which of the two is easier to recognise depends entirely on what
 * you are trying to decide.
 */
export default function StepCanvas({
  t,
  y,
  final,
  reference = null,
  markers = [],
  diverges = false,
  resetKey = '',
  caption = null,
}) {
  const heldY = React.useRef({ key: '', range: null })
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const k = area.k || 1

      let lo = 0
      let hi = 0
      for (let i = 0; i < y.length; i++) {
        if (y[i] < lo) lo = y[i]
        if (y[i] > hi) hi = y[i]
      }
      // What was ASKED for must fit the frame even where the loop falls
      // short of it — the whole point of a lesson like "proportional cannot
      // get there", where the trace never reaches this line.
      if (Number.isFinite(reference)) {
        if (reference < lo) lo = reference
        if (reference > hi) hi = reference
      }
      // A diverging response runs to 1e9 and squashes everything worth seeing
      // into a flat line at zero. Clamp the axis and let the trace leave the
      // frame, which is a truer picture of what "unstable" means anyway.
      if (diverges) {
        const cap = Math.max(4 * Math.abs(final || 1), 4)
        lo = Math.max(lo, -cap)
        hi = Math.min(hi, cap)
      }
      const pad = (hi - lo) * 0.12 || 0.2
      lo -= pad
      hi += pad
      // Sticky: hold the frame while gains are tuned so the CURVE visibly
      // grows and shrinks; snap on a system change (resetKey), on a would-be
      // clip, or when the trace has shrunk to a sliver. A diverging trace
      // keeps its clamped frame — stickiness is for comparing stable shapes.
      if (!diverges) {
        const held = stickyRange(
          heldY.current.key === resetKey ? heldY.current.range : null,
          { lo, hi },
        )
        heldY.current = { key: resetKey, range: held }
        lo = held.lo
        hi = held.hi
      } else {
        heldY.current = { key: '', range: null }
      }

      const tMax = t[t.length - 1] || 1
      const { sx, sy } = drawFrame(
        ctx,
        area,
        0,
        tMax,
        lo,
        hi,
        // "200 ms", not a bare "200 m" under a title that promises seconds.
        (v) => fmt(v, 's', 3),
        (v) => (Math.abs(hi - lo) > 20 ? v.toFixed(0) : v.toFixed(2)),
        { zeroLine: true, xTitle: STEP_X_TITLE, yTitle: 'Output' },
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

      // What was ASKED for, distinct from where the loop actually settles —
      // "Proportional cannot get there" is the lesson that exists to show a
      // gap between these two lines.
      if (Number.isFinite(reference)) {
        ctx.strokeStyle = COLORS.textBright
        ctx.globalAlpha = 0.55
        ctx.setLineDash([2 * k, 3 * k])
        ctx.lineWidth = 1 * k
        ctx.beginPath()
        ctx.moveTo(area.x, sy(reference))
        ctx.lineTo(area.x + area.w, sy(reference))
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
        ctx.fillStyle = COLORS.textBright
        ctx.font = `${Math.round(10.5 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = reference >= (final ?? reference) ? 'bottom' : 'top'
        ctx.fillText(`asked for r = ${fmtNum(reference, 3)}`, area.x + 4 * k, sy(reference) + (ctx.textBaseline === 'bottom' ? -3 : 3) * k)
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

      // A small dashed tick and caption at t = 0, for a jump the trace makes
      // that is not a bug — the unfiltered derivative term's kick, named
      // the way the watch view marks it, instead of left as an unexplained
      // discontinuity at the plot's left edge.
      if (caption) {
        const x0 = sx(0)
        ctx.strokeStyle = COLORS.phase
        ctx.globalAlpha = 0.6
        ctx.setLineDash([2 * k, 3 * k])
        ctx.lineWidth = 1.4 * k
        ctx.beginPath()
        ctx.moveTo(x0 + 1 * k, area.y)
        ctx.lineTo(x0 + 1 * k, area.y + area.h)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
        ctx.fillStyle = COLORS.phase
        ctx.font = `italic ${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(caption, area.x + 4 * k, area.y + 4 * k)
      }
      ctx.restore()
    },
    [t, y, final, reference, markers, diverges, resetKey, caption],
  )

  return <canvas ref={ref} className="plot" role="img" aria-label="Closed-loop step response in time" />
}
