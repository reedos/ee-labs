/**
 * The array's own curve: current or power against terminal voltage, one
 * exact solve per point (`analysis.js`'s `curveOf`, itself `physics.js`'s
 * `sweepI`). The same component draws both views the plan names — I–V and
 * P–V — because they are the same solved curve read against a different
 * axis; `mode` picks which.
 *
 * What else it draws depends on what the experiment is about. A cell or a
 * string driven by a load resistance gets the load line and the V_oc·I_sc
 * rectangle behind the knee (I–V only), so the fill factor is a picture
 * before it is a number. A converter experiment gets its own operating point
 * marked apart from the curve's. A tracker experiment gets its walk drawn on
 * top, one line per step, so the dither is a picture too.
 */
import React, { useMemo } from 'react'
import { COLORS, drawFrame, plotArea, useCanvas, fmt } from '@ee-labs/ui'

export default function IVCanvas({ exp, x, mode = 'iv', path = null, height = 260 }) {
  const plan = useMemo(() => {
    if (!x || !x.curve || !x.curve.length) return null
    const voc = x.fig.voc
    const isc = x.fig.isc
    const yOf = (pt) => (mode === 'pv' ? pt.p : pt.i)
    const yMax = mode === 'pv' ? x.fig.pmpp * 1.18 : isc * 1.08
    const xMax = voc * 1.06
    const mppY = mode === 'pv' ? x.fig.pmpp : x.fig.impp
    const atY = mode === 'pv' ? x.at.p : x.at.i
    return { voc, isc, xMax, yMax, mppY, atY, curve: x.curve, yOf }
  }, [x, mode])

  const draw = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    if (!plan) return
    const area = plotArea(w, h)
    const k = area.k
    const fmtX = (v) => fmt(v, 'V', 2)
    const fmtY = (v) => fmt(v, mode === 'pv' ? 'W' : 'A', 2)
    const { sx, sy } = drawFrame(ctx, area, 0, plan.xMax, 0, plan.yMax, fmtX, fmtY, {
      xTitle: 'terminal voltage',
      yTitle: mode === 'pv' ? 'power' : 'current',
    })

    // The V_oc·I_sc rectangle, behind everything else: the fill factor is how
    // much of it the knee leaves. I–V only — in P–V the rectangle has no area
    // to compare against.
    if (mode === 'iv') {
      ctx.save()
      ctx.globalAlpha = 0.12
      ctx.fillStyle = COLORS.textBright
      ctx.fillRect(sx(0), sy(plan.isc), sx(plan.voc) - sx(0), sy(0) - sy(plan.isc))
      ctx.restore()
    }

    // The curve itself.
    ctx.strokeStyle = COLORS.trace
    ctx.lineWidth = 2 * k
    ctx.beginPath()
    plan.curve.forEach((pt, i) => {
      const px = sx(pt.v)
      const py = sy(Math.min(plan.yOf(pt), plan.yMax))
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()

    // The load line, for a cell or string held at a resistance: i = v/R.
    if (typeof x.R === 'number' && mode === 'iv') {
      ctx.strokeStyle = COLORS.marker
      ctx.lineWidth = 1.4 * k
      ctx.setLineDash([5 * k, 4 * k])
      ctx.beginPath()
      ctx.moveTo(sx(0), sy(0))
      const vEdge = Math.min(plan.xMax, plan.yMax * x.R)
      ctx.lineTo(sx(vEdge), sy(vEdge / x.R))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = COLORS.marker
      ctx.textAlign = 'left'
      ctx.font = `${11 * k}px ui-sans-serif, system-ui, sans-serif`
      ctx.fillText('load line', sx(vEdge) - 60 * k, sy(vEdge / x.R) - 6 * k)
    }

    // The maximum power point: dashed guides to both axes, meeting at the dot.
    ctx.strokeStyle = COLORS.spectrum
    ctx.lineWidth = 1 * k
    ctx.setLineDash([3 * k, 3 * k])
    ctx.globalAlpha = 0.7
    ctx.beginPath()
    ctx.moveTo(sx(x.fig.vmpp), sy(0))
    ctx.lineTo(sx(x.fig.vmpp), sy(plan.mppY))
    ctx.lineTo(sx(0), sy(plan.mppY))
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
    ctx.fillStyle = COLORS.spectrum
    ctx.beginPath()
    ctx.arc(sx(x.fig.vmpp), sy(plan.mppY), 3.5 * k, 0, 2 * Math.PI)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.fillText('MPP', sx(x.fig.vmpp) + 6 * k, sy(plan.mppY) - 8 * k)

    // The tracker's walk, one segment per step, oldest steps dimmer.
    if (path && path.length > 1) {
      ctx.strokeStyle = COLORS.response
      ctx.lineWidth = 1.4 * k
      for (let i = 1; i < path.length; i++) {
        ctx.globalAlpha = 0.25 + (0.75 * i) / (path.length - 1)
        ctx.beginPath()
        ctx.moveTo(sx(path[i - 1].v), sy(Math.min(path[i - 1].p, plan.yMax)))
        ctx.lineTo(sx(path[i].v), sy(Math.min(path[i].p, plan.yMax)))
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      const last = path[path.length - 1]
      ctx.fillStyle = COLORS.response
      ctx.beginPath()
      ctx.arc(sx(last.v), sy(Math.min(last.p, plan.yMax)), 3.5 * k, 0, 2 * Math.PI)
      ctx.fill()
    }

    // This experiment's own operating point, apart from the MPP.
    ctx.fillStyle = COLORS.textBright
    ctx.beginPath()
    ctx.arc(sx(x.at.v), sy(Math.min(plan.atY, plan.yMax)), 4 * k, 0, 2 * Math.PI)
    ctx.fill()
  }

  const ref = useCanvas(draw, [plan, path, height])
  if (!plan) return null
  return (
    <div className="plot" data-role={mode}>
      <canvas ref={ref} style={{ width: '100%', height: `${height}px` }} />
    </div>
  )
}
