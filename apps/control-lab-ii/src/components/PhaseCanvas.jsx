import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmtNum } from '@ee-labs/ui'
import { phasePlan, pickAt } from './phaseGeometry.js'

/**
 * The phase plane: one state against the other, with time running along the
 * curve rather than across the page.
 *
 * This is the canvas `PROGRAM.md` section 4 assigns to this lab, with the
 * Machines Lab named as its second. Four of the props below exist for that lab
 * rather than for this one, and they work today so the Machines Lab does not
 * have to reopen the file:
 *
 *   levels     Lyapunov level sets, drawn as ellipses
 *   cursor     a scrubbed point, shared with the step view
 *   periodic   wrap the horizontal axis at ±π, for a rotor angle
 *   onPick     click to start a trajectory from that state
 *
 * The geometry is in `phaseGeometry.js` and is tested there. This file draws
 * what the plan hands it and decides nothing.
 */
export default function PhaseCanvas({
  trajectories = [],
  field = null,
  lines = [],
  equilibria = [],
  levels = [],
  cursor = null,
  periodic = false,
  span = null,
  xLabel = 'First state',
  yLabel = 'Second state',
  xUnit = '',
  yUnit = '',
  onPick = null,
}) {
  const plan = phasePlan({
    trajectories, field, lines, equilibria, levels, cursor, periodic, span,
    xLabel, yLabel, xUnit, yUnit,
  })
  const areaRef = React.useRef(null)

  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      areaRef.current = area
      const k = area.k || 1
      const { xMin, xMax, yMin, yMax } = plan.extent
      const { sx, sy } = drawFrame(
        ctx,
        area,
        xMin,
        xMax,
        yMin,
        yMax,
        (v) => fmtNum(v, 3),
        (v) => fmtNum(v, 3),
        { zeroLine: true, xTitle: plan.axis.x, yTitle: plan.axis.y },
      )

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      // The field first, so everything else sits on top of it.
      if (plan.arrowScale > 0) {
        ctx.strokeStyle = COLORS.axis
        ctx.lineWidth = 1 * k
        for (const a of plan.arrows) {
          const dx = a.dx * plan.arrowScale
          const dy = a.dy * plan.arrowScale
          const x0 = sx(a.x)
          const y0 = sy(a.y)
          const x1 = sx(a.x + dx * (xMax - xMin))
          const y1 = sy(a.y + dy * (yMax - yMin))
          ctx.globalAlpha = a.region === 0 ? 0.55 : 0.3
          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(x1, y1)
          ctx.stroke()
          // A head, so the arrow says which way rather than only which line.
          const ang = Math.atan2(y1 - y0, x1 - x0)
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x1 - 4 * k * Math.cos(ang - 0.4), y1 - 4 * k * Math.sin(ang - 0.4))
          ctx.moveTo(x1, y1)
          ctx.lineTo(x1 - 4 * k * Math.cos(ang + 0.4), y1 - 4 * k * Math.sin(ang + 0.4))
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      // The Lyapunov level sets, for the second lab and for C6's shading.
      for (const e of plan.ellipses) {
        const runs = e.wrapped ?? [e.points]
        ctx.strokeStyle = COLORS.phase
        ctx.globalAlpha = 0.4
        ctx.lineWidth = 1 * k
        for (const run of runs) {
          ctx.beginPath()
          run.forEach((p, i) => (i ? ctx.lineTo(sx(p[0]), sy(p[1])) : ctx.moveTo(sx(p[0]), sy(p[1]))))
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      // The switching lines, where the drive reaches its limit.
      for (const seg of plan.segments) {
        ctx.strokeStyle = COLORS.marker
        ctx.setLineDash([5 * k, 4 * k])
        ctx.lineWidth = 1.2 * k
        ctx.beginPath()
        ctx.moveTo(sx(seg.from[0]), sy(seg.from[1]))
        ctx.lineTo(sx(seg.to[0]), sy(seg.to[1]))
        ctx.stroke()
        ctx.setLineDash([])
        if (seg.label) {
          ctx.fillStyle = COLORS.marker
          ctx.font = `${Math.round(10.5 * k)}px ui-sans-serif, system-ui, sans-serif`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'bottom'
          ctx.fillText(seg.label, sx(seg.to[0]) + 4 * k, sy(seg.to[1]) - 3 * k)
        }
      }

      // The trajectories.
      plan.paths.forEach((path, i) => {
        ctx.strokeStyle = path.colour || (i === 0 ? COLORS.trace : COLORS.spectrum)
        ctx.lineWidth = 1.8 * k
        ctx.lineJoin = 'round'
        for (const run of path.runs) {
          ctx.beginPath()
          run.forEach((p, j) => (j ? ctx.lineTo(sx(p[0]), sy(p[1])) : ctx.moveTo(sx(p[0]), sy(p[1]))))
          ctx.stroke()
        }
        // Where it started, so the direction of travel is never a guess.
        const first = path.runs[0]?.[0]
        if (first) {
          ctx.fillStyle = ctx.strokeStyle
          ctx.beginPath()
          ctx.arc(sx(first[0]), sy(first[1]), 3 * k, 0, 2 * Math.PI)
          ctx.fill()
        }
      })

      // The equilibria. Filled where the loop can actually rest there, hollow
      // where the point solves the region's equation from outside the region.
      for (const m of plan.marks) {
        const x = sx(m.point[0])
        const y = sy(m.point[1])
        ctx.strokeStyle = COLORS.textBright
        ctx.fillStyle = COLORS.textBright
        ctx.lineWidth = 1.4 * k
        ctx.beginPath()
        ctx.arc(x, y, 4.5 * k, 0, 2 * Math.PI)
        if (m.real) ctx.fill()
        else ctx.stroke()
      }

      // The scrubbed point, for the second lab.
      if (plan.cursor) {
        ctx.strokeStyle = COLORS.response
        ctx.lineWidth = 2 * k
        ctx.beginPath()
        ctx.arc(sx(plan.cursor[0]), sy(plan.cursor[1]), 5 * k, 0, 2 * Math.PI)
        ctx.stroke()
      }
      ctx.restore()
    },
    [JSON.stringify(plan.extent), trajectories, field, lines, equilibria, levels, cursor, periodic, plan.axis.x, plan.axis.y],
  )

  const click = (event) => {
    if (!onPick || !areaRef.current) return
    const box = event.currentTarget.getBoundingClientRect()
    const [x, y] = pickAt(plan.extent, areaRef.current, event.clientX - box.left, event.clientY - box.top)
    onPick(x, y)
  }

  return (
    <canvas
      ref={ref}
      className="plot"
      onClick={onPick ? click : undefined}
      role="img"
      aria-label={`Phase plane, ${plan.axis.y} against ${plan.axis.x}`}
    />
  )
}
