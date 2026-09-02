import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt } from '@ee-labs/ui'
import { LEFT_COLORS, RIGHT_COLORS, drawCursor, drawDataMarks, drawLegend, drawRightAxis, fmtT, rightSpan, scrubHandlers, spanOf } from './timePlot.js'

/**
 * The scope: the experiment's chosen quantities against time over its window,
 * voltages on the left axis and currents (or powers) on the right. Every
 * sample is the exact state propagated to that instant and read out through
 * the same resistive solve the schematic uses, so the trace and the meters
 * cannot disagree; the cursor picks which instant the meters show.
 *
 * `scope` is the experiment's {left:{unit, traces}, right:{unit, traces}};
 * a trace {q, key, label, dim, dash} names a quantity the way tr.series does.
 * A `dim` trace is the drive, drawn thin and dashed so the response it sits
 * under stays visible; `dash` dashes a bright trace whose shape repeats
 * another's on the other axis (F6's switch voltage is the inductor current
 * times R_off). `ghost`, when given, is a second transient (the same circuit
 * from rest) drawn faintly under the first. `marks` are the data marks of
 * marks.js — levels, points, construction lines and the instants the math
 * entry names; `guides` are hand-written curves (an envelope) drawn dashed
 * on the left axis.
 */
export default function ScopeCanvas({ tr, ghost = null, ghostLabel = 'from rest (dashed)', scope, cursor, onCursor, marks = [], guides = [] }) {
  const tEnd = tr.tEnd
  const ref = useCanvas(
    (ctx, w, h) => {
      const k0 = plotArea(w, h).k
      const opts = { rightAxis: !!scope.right, topInset: 16 * k0 }
      const area = plotArea(w, h, opts)
      const k = area.k
      const t = tr.t
      const pick = (src, tr_) => src.map((q) => tr_.series(q.q, q.key))
      const left = pick(scope.left.traces, tr)
      const right = scope.right ? pick(scope.right.traces, tr) : []
      const gLeft = ghost ? pick(scope.left.traces, ghost) : []
      const gRight = ghost && scope.right ? pick(scope.right.traces, ghost) : []
      const guideYs = guides.map((g) => Float64Array.from(t, (tt) => g.f(tt)))
      const markYs = (side) =>
        Float64Array.from(
          marks.filter((m) => m.axis === side).flatMap((m) => (m.kind === 'level' ? [m.y] : m.kind === 'point' ? [m.y] : m.kind === 'segment' ? [m.y0, m.y1] : [])),
        )
      const [lLo, lHi] = spanOf([...left, ...gLeft, ...guideYs, markYs('left')])
      // One zero line for both scales when that keeps the right-hand traces
      // readable; otherwise the right scale takes its own span and zero.
      const { span: rSpan, aligned } = rightSpan([lLo, lHi], spanOf([...right, ...gRight, markYs('right')]))
      const [rLo, rHi] = rSpan

      const lu = scope.left.unit
      const { sx, sy } = drawFrame(ctx, area, 0, tEnd, lLo, lHi, fmtT, (v) => fmt(v, lu, 2), {
        zeroLine: true,
        xTitle: 'Time from t = 0',
        yTitle: `${scope.left.traces.map((q) => q.label).join(', ')} (${lu})`,
      })
      const syR = scope.right
        ? drawRightAxis(ctx, area, w, rLo, rHi, (v) => fmt(v, scope.right.unit, 2), `${scope.right.traces.map((q) => q.label).join(', ')} (${scope.right.unit})`)
        : null

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      if (syR && !aligned && rLo < 0 && rHi > 0) {
        // The right scale's own zero, in its own colour, since it is not the frame's.
        ctx.strokeStyle = RIGHT_COLORS[0]
        ctx.globalAlpha = 0.45
        ctx.setLineDash([2 * k, 4 * k])
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(area.x, Math.round(syR(0)) + 0.5)
        ctx.lineTo(area.x + area.w, Math.round(syR(0)) + 0.5)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }

      const line = (ys, map, color, { width = 2, alpha = 1, dash = null } = {}) => {
        ctx.strokeStyle = color
        ctx.globalAlpha = alpha
        ctx.lineWidth = width * k
        ctx.setLineDash(dash ? dash.map((d) => d * k) : [])
        ctx.beginPath()
        let pen = false
        for (let i = 0; i < t.length; i++) {
          const v = ys[i]
          if (!Number.isFinite(v)) {
            pen = false
            continue
          }
          if (!pen) ctx.moveTo(sx(t[i]), map(v))
          else ctx.lineTo(sx(t[i]), map(v))
          pen = true
        }
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }
      const styleOf = (q) => (q.dim ? { width: 1.2, alpha: 0.55, dash: [3, 3] } : q.dash ? { dash: [7, 4] } : {})

      // Marks and guides underneath.
      drawDataMarks(ctx, area, marks, { sx, sy, syR })
      guideYs.forEach((ys) => line(ys, sy, COLORS.textBright, { width: 1, alpha: 0.5, dash: [4, 4] }))

      // Ghost first, then the real traces over it.
      gLeft.forEach((ys, i) => line(ys, sy, LEFT_COLORS[i % LEFT_COLORS.length], { width: 1.5, alpha: 0.3, dash: [6, 4] }))
      gRight.forEach((ys, i) => line(ys, syR, RIGHT_COLORS[i % RIGHT_COLORS.length], { width: 1.5, alpha: 0.3, dash: [6, 4] }))
      left.forEach((ys, i) => line(ys, sy, LEFT_COLORS[i % LEFT_COLORS.length], styleOf(scope.left.traces[i])))
      right.forEach((ys, i) => line(ys, syR, RIGHT_COLORS[i % RIGHT_COLORS.length], styleOf(scope.right.traces[i])))

      if (Number.isFinite(cursor)) {
        const cx = sx(Math.min(tEnd, Math.max(0, cursor)))
        drawCursor(ctx, area, cx)
        // The values at the cursor, as dots on each trace.
        const now = tr.at(Math.min(tEnd, Math.max(0, cursor)))
        const dot = (q, map, color) => {
          const v = now.sol[q.q][q.key]
          if (!Number.isFinite(v)) return
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(cx, map(v), 3.5 * k, 0, Math.PI * 2)
          ctx.fill()
        }
        scope.left.traces.forEach((q, i) => dot(q, sy, LEFT_COLORS[i % LEFT_COLORS.length]))
        if (scope.right) scope.right.traces.forEach((q, i) => dot(q, syR, RIGHT_COLORS[i % RIGHT_COLORS.length]))
      }
      ctx.restore()

      drawLegend(ctx, area, [
        ...scope.left.traces.map((q, i) => ({ label: q.label, color: LEFT_COLORS[i % LEFT_COLORS.length], dim: q.dim })),
        ...(scope.right ? scope.right.traces.map((q, i) => ({ label: q.label, color: RIGHT_COLORS[i % RIGHT_COLORS.length], dim: q.dim })) : []),
        ...(ghost ? [{ label: ghostLabel, color: COLORS.text, dim: true }] : []),
        ...(guides.some((g) => g.label) ? [{ label: guides.find((g) => g.label).label, color: COLORS.textBright, dim: true }] : []),
      ])
    },
    [tr, ghost, ghostLabel, scope, cursor, marks, guides],
  )
  return (
    <canvas
      ref={ref}
      className="plot scope"
      role="img"
      aria-label="Scope: the chosen voltages and currents against time; drag to move the cursor"
      {...scrubHandlers(onCursor, tEnd, { rightAxis: !!scope.right, topInset: 16 })}
    />
  )
}
