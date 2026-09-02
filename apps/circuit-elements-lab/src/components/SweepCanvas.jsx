import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt } from '@ee-labs/ui'
import { MONO, drawDataMarks, drawRightAxis } from './timePlot.js'

/**
 * A load sweep: one quantity at the port against the load resistance, on a
 * log axis across the knob's whole range. Every point came from a real solve
 * of the circuit with the knob at that value (math.js sweepKnob), so the curve
 * is what the circuit does, not what a formula says about it.
 *
 * `y` chooses the quantity: 'p' the load power, 'v' the load voltage. `at`
 * is the knob's current value, marked so the reader can see where on the
 * curve the schematic is sitting; `rth`, when given, marks the Thévenin
 * resistance — the peak of a power curve, the knee of a voltage curve.
 * `efficiency` draws load-over-source power dashed against a right-hand
 * 0–100 % axis. `marks` are the data marks of marks.js, their x a load
 * resistance, their y in the left unit or (axis 'right') a 0..1 efficiency.
 */
/** The left axis's tick labels: the value in the sweep's unit, two figures — 1.8 mW, not 0.0018. */
export const yTick = (unit) => (v) => fmt(v, unit, 2)

export default function SweepCanvas({ points, y = 'p', at, rth = null, efficiency = false, marks = [] }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      if (!points.length) return
      const area = plotArea(w, h, { rightAxis: efficiency })
      const k = area.k || 1
      const xs = points.map((q) => Math.log10(q.R))
      const ys = points.map((q) => q[y])
      const xMin = xs[0]
      const xMax = xs[xs.length - 1]
      const markYs = marks.filter((m) => m.axis !== 'right').flatMap((m) => (m.kind === 'level' || m.kind === 'point' ? [m.y] : m.kind === 'segment' ? [m.y0, m.y1] : []))
      let lo = Math.min(0, ...ys, ...markYs)
      let hi = Math.max(...ys, ...markYs)
      if (hi === lo) hi = lo + 1
      const pad = (hi - lo) * 0.1
      hi += pad
      if (lo < 0) lo -= pad

      const unit = y === 'p' ? 'W' : 'V'
      const { sx, sy } = drawFrame(
        ctx,
        area,
        xMin,
        xMax,
        lo,
        hi,
        (v) => fmt(Math.pow(10, v), 'Ω', 2),
        yTick(unit),
        { zeroLine: lo < 0, xStep: 1, xTitle: 'Load resistance', yTitle: y === 'p' ? 'Load power (W)' : 'Load voltage (V)' },
      )
      // Efficiency reads on its own axis, in percent.
      const syPct = efficiency ? drawRightAxis(ctx, area, w, 0, 100, (v) => `${v}%`, 'Efficiency (%)', 25) : null
      const syR = syPct ? (frac) => syPct(100 * frac) : null

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      // R_th first, underneath everything.
      if (Number.isFinite(rth) && rth > 0) {
        const x = sx(Math.log10(rth))
        ctx.strokeStyle = COLORS.response
        ctx.globalAlpha = 0.6
        ctx.setLineDash([5 * k, 4 * k])
        ctx.lineWidth = 1 * k
        ctx.beginPath()
        ctx.moveTo(x, area.y)
        ctx.lineTo(x, area.y + area.h)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
        ctx.fillStyle = COLORS.response
        ctx.font = `${Math.round(11 * k)}px ${MONO}`
        // Named at the foot of the line: the curves are at their peak or their knee up top.
        ctx.textAlign = 'left'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`R_th = ${fmt(rth, 'Ω', 3)}`, x + 4 * k, area.y + area.h - 4 * k)
      }

      drawDataMarks(ctx, area, marks, { sx: (R) => sx(Math.log10(R)), sy, syR })

      // Efficiency, dashed, against the right-hand axis.
      if (syR) {
        ctx.strokeStyle = COLORS.spectrum
        ctx.setLineDash([3 * k, 3 * k])
        ctx.lineWidth = 1.2 * k
        ctx.beginPath()
        let pen = false
        points.forEach((q, i) => {
          if (!Number.isFinite(q.efficiency)) return
          const px = sx(xs[i])
          const py = syR(Math.min(1, Math.max(0, q.efficiency)))
          if (!pen) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
          pen = true
        })
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = COLORS.spectrum
        ctx.font = `${Math.round(11 * k)}px ${MONO}`
        // Bottom right, where the load power has died away and the efficiency has climbed off.
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillText('efficiency (dashed, right axis)', area.x + area.w - 6 * k, area.y + area.h - 4 * k)
      }

      ctx.strokeStyle = COLORS.trace
      ctx.lineWidth = 2 * k
      ctx.beginPath()
      xs.forEach((x, i) => {
        if (i === 0) ctx.moveTo(sx(x), sy(ys[i]))
        else ctx.lineTo(sx(x), sy(ys[i]))
      })
      ctx.stroke()

      // Where the knob is now.
      if (Number.isFinite(at) && at > 0) {
        const lx = Math.log10(at)
        // Nearest computed point, so the dot sits on the drawn curve.
        let best = 0
        for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - lx) < Math.abs(xs[best] - lx)) best = i
        const px = sx(xs[best])
        const py = sy(ys[best])
        ctx.fillStyle = COLORS.marker
        ctx.beginPath()
        ctx.arc(px, py, 4 * k, 0, Math.PI * 2)
        ctx.fill()
        // The label goes where nothing else is: below a rising curve or a
        // point sitting just under a level line, above otherwise, and to the
        // left of the dot near the right edge.
        const label = `${fmt(at, 'Ω', 3)} → ${fmt(ys[best], unit, 3)}`
        ctx.font = `${Math.round(11 * k)}px ${MONO}`
        const before = ys[Math.max(0, best - 1)]
        const after = ys[Math.min(ys.length - 1, best + 1)]
        const rising = after > before && sy(before) - sy(after) > 2 * k
        const lineAbove = marks.some((m) => m.kind === 'level' && m.axis !== 'right' && sy(m.y) < py + 2 * k && sy(m.y) > py - 20 * k)
        // A point mark on the dot has its own label beside it; this one goes under.
        const markHere = marks.some((m) => m.kind === 'point' && m.axis !== 'right' && Math.hypot(sx(Math.log10(m.x)) - px, sy(m.y) - py) < 6 * k)
        const under = rising || lineAbove || markHere
        const wide = ctx.measureText(label).width
        const left = px + 7 * k + wide > area.x + area.w
        ctx.textAlign = left ? 'right' : 'left'
        ctx.textBaseline = under ? 'top' : 'bottom'
        ctx.fillText(label, px + (left ? -7 : 7) * k, py + (under ? 6 : -6) * k)
      }
      ctx.restore()
    },
    [points, y, at, rth, efficiency, marks],
  )
  return <canvas ref={ref} className="plot" role="img" aria-label="Load sweep: the port quantity against load resistance" />
}
