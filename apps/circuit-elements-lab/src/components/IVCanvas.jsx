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

/**
 * The path each model draws in the i–v plane, as points.
 *
 * The two switch models are not functions of v at all: at their drop they will
 * pass whatever current the circuit asks for, which is a VERTICAL line. Drawn
 * as a function — zero, then the top of the frame — they would read as "passes
 * the maximum current at every voltage above V_f", which is the opposite of
 * what a switch does. So they are drawn as the two segments they are, and stop.
 */
function curveOf(id, d, vs, iMax) {
  if (id === 'ideal' || id === 'drop') {
    const vf = id === 'ideal' ? 0 : d.vf
    return [
      [vs[0], 0],
      [vf, 0],
      [vf, iMax],
    ]
  }
  return vs.map((v) => [v, id === 'exp' ? shockley(d, v).i : v > d.vf ? (v - d.vf) / d.rd : 0])
}


/** Four or five round ticks from zero up to `max`, in 1-2-5 steps. */
function ticksTo(max) {
  if (!(max > 0)) return [0]
  const raw = max / 4
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 5, 10].map((q) => q * pow).find((q) => q >= raw) || 10 * pow
  const out = []
  for (let v = 0; v <= max * 1.0001; v += step) out.push(v)
  return out
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
    // Turn the supply round and the operating point moves to a NEGATIVE
    // voltage: the diode is blocking and standing off the whole source. A
    // frame that started at zero would draw that point outside itself, which
    // is the quietest kind of lie a plot can tell — so the frame opens to hold
    // it, and the reverse side of the curve comes with it.
    const vMin = Math.min(0, x.sol.volt[el.id] * 1.35)
    const vs = Array.from({ length: 241 }, (_, k) => vMin + (k / 240) * (vMax - vMin))
    return {
      d,
      E,
      R,
      iMax,
      vMin,
      vMax,
      vs,
      curves: MODELS.map((m) => ({ ...m, points: curveOf(m.id, d, vs, iMax), on: m.id === (el.model || 'drop') })),
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
    // Room under the frame for a row of tick labels AND the axis title.
    const pad = { l: 58 * k, r: 14 * k, t: 12 * k, b: 46 * k }
    const area = { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b }
    const X = (v) => area.x + ((v - plan.vMin) / (plan.vMax - plan.vMin)) * area.w
    const Y = (i) => area.y + area.h - (i / plan.iMax) * area.h
    const css = getComputedStyle(ctx.canvas)
    const colour = (name) => css.getPropertyValue(name.replace(/^var\(|\)$/g, '')).trim() || '#888'

    // Axes: a quantity, a unit and ticks on both, drawn before anything else
    // so the curves sit over the grid rather than under it.
    ctx.font = `${11 * k}px system-ui, sans-serif`
    ctx.strokeStyle = colour('var(--line)')
    ctx.lineWidth = 1 * k
    const vTicks = ticksTo(plan.vMax).concat(plan.vMin < 0 ? ticksTo(-plan.vMin).slice(1).map((q) => -q) : [])
    const iTicks = ticksTo(plan.iMax)
    ctx.globalAlpha = 0.45
    ctx.beginPath()
    for (const v of vTicks.filter((q) => q !== plan.vMin)) {
      ctx.moveTo(X(v), area.y)
      ctx.lineTo(X(v), area.y + area.h)
    }
    for (const i of iTicks.slice(1)) {
      ctx.moveTo(area.x, Y(i))
      ctx.lineTo(area.x + area.w, Y(i))
    }
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.moveTo(area.x, area.y)
    ctx.lineTo(area.x, area.y + area.h)
    ctx.lineTo(area.x + area.w, area.y + area.h)
    ctx.stroke()
    ctx.fillStyle = colour('var(--dim)')
    ctx.textAlign = 'center'
    ctx.fillText(`v across ${plan.d.id ?? 'the diode'} (V)`, area.x + area.w / 2, h - 6 * k)
    ctx.save()
    ctx.translate(12 * k, area.y + area.h / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('current through it (A)', 0, 0)
    ctx.restore()
    ctx.textAlign = 'right'
    for (const i of iTicks) ctx.fillText(i === 0 ? '0' : num(i, 'A', 2), area.x - 6 * k, Y(i) + 4 * k)
    ctx.textAlign = 'center'
    for (const v of vTicks) if (v !== 0 || plan.vMin < 0) ctx.fillText(v === 0 ? '0' : num(v, 'V', 2), X(v), area.y + area.h + 16 * k)

    // The models, the one in use drawn bright.
    for (const c of plan.curves) {
      ctx.strokeStyle = colour(c.colour)
      ctx.globalAlpha = c.on ? 1 : 0.45
      ctx.lineWidth = (c.on ? 2 : 1.2) * k
      ctx.setLineDash(c.dash.map((q) => q * k))
      ctx.beginPath()
      c.points.forEach(([v, i], n) => {
        const y = Math.max(area.y, Y(Math.min(i, plan.iMax)))
        if (n === 0) ctx.moveTo(X(v), y)
        else ctx.lineTo(X(v), y)
      })
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.globalAlpha = 1
    // Named where each leaves the frame, in the lab's way — no legend.
    // Named where each one actually ends. The two curves run off the right of
    // the frame and are labelled there like every other chart in the lab; the
    // two switch models are vertical lines that stop, so their names go beside
    // the line rather than at an edge they never reach.
    const running = plan.curves.filter((c) => c.id === 'exp' || c.id === 'pwl')
    const upright = plan.curves.filter((c) => c.id === 'ideal' || c.id === 'drop')
    drawEndLabels(
      ctx,
      { ...area, k },
      running.map((c) => ({ label: c.label, color: colour(c.colour), y: Math.max(area.y + 6, Y(Math.min(c.points[c.points.length - 1][1], plan.iMax))) })),
      upright.map((c, n) => ({
        label: c.label,
        color: colour(c.colour),
        x: X(c.points[c.points.length - 1][0]),
        y: Y(plan.iMax * (n ? 0.8 : 0.58)),
      })),
    )

    // The load line: i = (E − v)/R, from the current axis to the voltage axis.
    ctx.strokeStyle = colour('var(--warn)')
    ctx.lineWidth = 1.6 * k
    // i = (E − v)/R across the whole frame: it is the circuit's own constraint,
    // and it does not stop where the diode's curve does.
    const line = (v) => (plan.E - v) / plan.R
    ctx.beginPath()
    ctx.moveTo(X(plan.vMin), Y(line(plan.vMin)))
    ctx.lineTo(X(plan.vMax), Y(line(plan.vMax)))
    ctx.stroke()
    ctx.fillStyle = colour('var(--warn)')
    ctx.textAlign = 'left'
    ctx.fillText('load line', X(plan.vMin) + 6 * k, Y(line(plan.vMin)) - 6 * k)

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
