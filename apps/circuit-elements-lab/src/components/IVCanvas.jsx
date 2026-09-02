/**
 * The i–v plane: the diode's own curve, the straight line the rest of the
 * circuit imposes, and the point where they meet.
 *
 * This is the one plot in the lab whose abscissa is not time or frequency but
 * a voltage, and it is drawn because two of the diode lessons are about a
 * picture rather than a number — I1 overlays the four models on the curve they
 * approximate, and I2 walks Newton's iterations down the curve to the crossing
 * with the load line.
 *
 * Every curve here is evaluated from the element's own law and every point
 * from the solver's answer, so nothing on this plot is drawn from a formula
 * that the meters do not also obey.
 */
import React, { useMemo } from 'react'
import { useCanvas } from '@ee-labs/ui'
import { drawEndLabels, trackText } from './timePlot.js'
import { diodeOf, shockley } from '@ee-labs/network'
import { num } from '../format.js'

const MODELS = [
  { id: 'exp', label: 'the curve', colour: 'var(--accent)', dash: [] },
  { id: 'pwl', label: 'V_f + r_d', colour: 'var(--blue)', dash: [6, 4] },
  { id: 'drop', label: 'constant drop', colour: 'var(--amber)', dash: [3, 3] },
  { id: 'ideal', label: 'ideal switch', colour: 'var(--dim)', dash: [2, 3] },
]

/** The current each model passes at v, in the same units, for drawing. */
function curveOf(id, d, vs, iMax) {
  return vs.map((v) => {
    switch (id) {
      case 'exp':
        return shockley(d, v).i
      case 'pwl':
        return v > d.vf ? (v - d.vf) / d.rd : 0
      default: {
        // The two switch models are vertical lines at their drop: drawn as the
        // step they are, up to the top of the frame.
        const vf = id === 'ideal' ? 0 : d.vf
        return v < vf ? 0 : iMax
      }
    }
  })
}

export default function IVCanvas({ exp, x, p, height = 260 }) {
  const plan = useMemo(() => {
    const el = x.net.elements.find((e) => e.id === exp.iv.element)
    if (!el || !x.sol) return null
    const d = diodeOf({ ...el, model: 'exp' })
    const E = p[exp.iv.source]
    const R = p[exp.iv.series]
    // The frame: enough current for the load line to reach the axis, and
    // enough voltage to show the knee and the operating point.
    const iMax = Math.max(Math.abs(E) / R, Math.abs(x.sol.i[el.id])) * 1.15
    const vMax = Math.max(0.9, x.sol.volt[el.id] * 1.35, d.n * d.vt * Math.log(iMax / d.is + 1) * 1.1)
    const vs = Array.from({ length: 241 }, (_, k) => (k / 240) * vMax)
    return {
      d,
      E,
      R,
      iMax,
      vMax,
      vs,
      curves: MODELS.map((m) => ({ ...m, ys: curveOf(m.id, d, vs, iMax), on: m.id === (el.model || 'drop') })),
      point: { v: x.sol.volt[el.id], i: x.sol.i[el.id] },
      iters: exp.iv.iterations && x.newton ? x.newton : null,
    }
  }, [exp, x, p])

  const draw = (ctx, w, h) => {
    const k = 1
    ctx.clearRect(0, 0, w, h)
    if (!plan) return
    // Every label this plot writes is remembered, so the next one can step
    // clear of it rather than land on top (the lab's rule since step 7).
    trackText(ctx)
    const pad = { l: 54 * k, r: 14 * k, t: 12 * k, b: 30 * k }
    const area = { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b }
    const X = (v) => area.x + (v / plan.vMax) * area.w
    const Y = (i) => area.y + area.h - (i / plan.iMax) * area.h
    const css = getComputedStyle(ctx.canvas)
    const colour = (name) => css.getPropertyValue(name.replace(/^var\(|\)$/g, '')).trim() || '#888'

    // Axes.
    ctx.strokeStyle = colour('var(--line)')
    ctx.lineWidth = 1 * k
    ctx.beginPath()
    ctx.moveTo(area.x, area.y)
    ctx.lineTo(area.x, area.y + area.h)
    ctx.lineTo(area.x + area.w, area.y + area.h)
    ctx.stroke()
    ctx.fillStyle = colour('var(--dim)')
    ctx.font = `${11 * k}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`v across ${plan.d.id ?? 'the diode'} (V)`, area.x + area.w / 2, h - 8 * k)
    ctx.save()
    ctx.translate(12 * k, area.y + area.h / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('current (A)', 0, 0)
    ctx.restore()
    ctx.textAlign = 'right'
    ctx.fillText(num(plan.iMax, 'A', 2), area.x - 6 * k, area.y + 10 * k)
    ctx.fillText('0', area.x - 6 * k, area.y + area.h + 4 * k)
    ctx.textAlign = 'center'
    ctx.fillText(num(plan.vMax, 'V', 2), area.x + area.w, area.y + area.h + 16 * k)

    // The models, the one in use drawn bright.
    for (const c of plan.curves) {
      ctx.strokeStyle = colour(c.colour)
      ctx.globalAlpha = c.on ? 1 : 0.45
      ctx.lineWidth = (c.on ? 2 : 1.2) * k
      ctx.setLineDash(c.dash.map((q) => q * k))
      ctx.beginPath()
      plan.vs.forEach((v, i) => {
        const y = Math.max(area.y, Y(Math.min(c.ys[i], plan.iMax)))
        if (i === 0) ctx.moveTo(X(v), y)
        else ctx.lineTo(X(v), y)
      })
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.globalAlpha = 1
    // Named where each leaves the frame, in the lab's way — no legend.
    drawEndLabels(
      ctx,
      { ...area, k },
      plan.curves.map((c) => ({ label: c.label, color: colour(c.colour), y: Math.max(area.y + 6, Y(Math.min(c.ys[c.ys.length - 1], plan.iMax))) })),
    )

    // The load line: i = (E − v)/R, from the current axis to the voltage axis.
    ctx.strokeStyle = colour('var(--warn)')
    ctx.lineWidth = 1.6 * k
    ctx.beginPath()
    ctx.moveTo(X(0), Y(plan.E / plan.R))
    ctx.lineTo(X(Math.min(plan.E, plan.vMax)), Y(Math.max(0, (plan.E - Math.min(plan.E, plan.vMax)) / plan.R)))
    ctx.stroke()
    ctx.fillStyle = colour('var(--warn)')
    ctx.textAlign = 'left'
    ctx.fillText('load line', X(0) + 6 * k, Y(plan.E / plan.R) - 6 * k)

    // Newton's iterations, walking down to the answer.
    if (plan.iters) {
      ctx.fillStyle = colour('var(--dim)')
      plan.iters.forEach((it, n) => {
        const v = it.v[Object.keys(it.v)[0]]
        if (!v) return
        ctx.globalAlpha = 0.35 + (0.65 * n) / Math.max(1, plan.iters.length - 1)
        ctx.beginPath()
        ctx.arc(X(v.v), Y(Math.min(v.i, plan.iMax)), 3 * k, 0, 2 * Math.PI)
        ctx.fill()
      })
      ctx.globalAlpha = 1
    }

    // The operating point.
    ctx.fillStyle = colour('var(--accent)')
    ctx.beginPath()
    ctx.arc(X(plan.point.v), Y(plan.point.i), 4.5 * k, 0, 2 * Math.PI)
    ctx.fill()
    ctx.textAlign = 'right'
    ctx.fillText(`${num(plan.point.v, 'V', 3)}, ${num(plan.point.i, 'A', 3)}`, X(plan.point.v) - 8 * k, Y(plan.point.i) - 8 * k)
  }

  const ref = useCanvas(draw, [plan, height])
  if (!plan) return null
  return (
    <div className="plot iv" data-role="iv">
      <canvas ref={ref} style={{ width: '100%', height: `${height}px` }} />
    </div>
  )
}
