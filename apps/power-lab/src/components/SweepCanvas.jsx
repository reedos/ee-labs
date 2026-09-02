import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt, anchoredRange } from '@ee-labs/ui'
import { SWEEP_X, SWEEP_Y } from '../experiments.js'
import { axisFmt, fitLeftAxis } from '../format.js'
import { markLabels } from '../marks.js'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

/** The y-range for one swept quantity, anchored on the sweep at the defaults. */
export function sweepRange(points, basePoints, key, ay, { withPred = false } = {}) {
  const pick = (qs) => (qs || []).map((q) => q[key])
  const preds = (qs) => (withPred ? (qs || []).map((q) => q.pred) : [])
  return anchoredRange([...pick(points), ...preds(points)], [...pick(basePoints), ...preds(basePoints)], {
    lo: ay.lo,
    hi: ay.hi,
    log: ay.scale === 'log',
    floor: key === 'M' ? 1 : null,
  })
}

/** What the legend beside the plot lists, in drawing order. */
export function sweepLegend(points, sweep, label = '') {
  const ay = SWEEP_Y[sweep.y]
  const ay2 = sweep.y2 ? SWEEP_Y[sweep.y2] : null
  const items = [{ color: COLORS.trace, text: label || `${ay.label} measured`, style: 'solid' }]
  if (sweep.y === 'M') items.push({ color: COLORS.response, text: 'M = D', style: 'dashed' }, { color: COLORS.spectrum, text: 'CCM/DCM formula', style: 'dotted' })
  else if (points.some((q) => Number.isFinite(q.pred))) items.push({ color: COLORS.spectrum, text: 'closed form', style: 'dashed' })
  if (ay2) items.push({ color: COLORS.response, text: `${ay2.label} (right axis)`, style: 'solid' })
  if (points.some((q) => q.mode === 'DCM')) items.push({ color: COLORS.spectrumDim, text: 'discontinuous conduction', style: 'fill' })
  return items
}

/**
 * One quantity against one knob, as a pure drawing: every point a full steady
 * state at that setting (analysis.js sweeps). The measured curve is solid; the
 * textbook lines are dashed beside it — for the buck's M, the ideal M = D in
 * blue and the CCM/DCM prediction in amber, so where the converter leaves the
 * first formula the reader sees the second one pick it up. Stretches the
 * engine found in discontinuous conduction are shaded. The axis is framed on
 * the sweep at the experiment's defaults (`basePoints`), so turning a knob
 * moves the curve inside a frame that holds still.
 *
 * `sweep` is `{ x, y, y2? }` with keys from SWEEP_X and SWEEP_Y; a `y2` is
 * drawn on a right-hand axis. `at` is the knob's current value, marked on the
 * curve. `marks` are the note's numbers (marks.js), drawn where they happen.
 * The legend is not drawn here: `sweepLegend` lists it for the DOM.
 *
 * Returns the geometry, for tests: `sx`, `sy` (in axis units — log10 of the
 * value on a log axis), `area`, and the x range.
 */
export function drawSweep(ctx, w, h, { points, basePoints = null, sweep, at, marks = [] }) {
  if (!points.length) return null
  const ax = SWEEP_X[sweep.x]
  const ay = SWEEP_Y[sweep.y]
  const ay2 = sweep.y2 ? SWEEP_Y[sweep.y2] : null
  const k0 = plotArea(w, h).k
  const area = plotArea(w, h, { rightAxis: !!ay2, topInset: ay2 ? 16 * k0 : 0 })
  const k = area.k || 1
  const logX = ax.scale === 'log'
  const X = (v) => (logX ? Math.log10(v) : v)
  const xs = points.map((q) => X(q.x))
  const ys = points.map((q) => q[sweep.y])
  const xMin = logX ? xs[0] : sweep.x === 'D' ? 0 : xs[0]
  const xMax = logX ? xs[xs.length - 1] : sweep.x === 'D' ? 1 : xs[xs.length - 1]
  const fmtX = (v) => (ax.fmt ? ax.fmt(v) : fmt(v, ax.unit, 2))
  // A quantity that runs over decades — the buck-boost's output power goes
  // from under two watts to three hundred — is unreadable on a linear axis:
  // the flat stretch that is the whole point sits on the frame. Those
  // descriptors ask for a log axis, and the values are carried through it.
  const logY = ay.scale === 'log'
  const Y = (v) => (logY ? Math.log10(Math.max(v, 1e-12)) : v)
  const [yLo, yHi] = sweepRange(points, basePoints, sweep.y, ay, { withPred: true })
  const fmtY = (a, lo, hi, log = false) => {
    if (log) {
      const f = axisFmt(Math.pow(10, lo), Math.pow(10, hi), a.unit, { ticks: 1 })
      return (v) => f(Math.pow(10, v))
    }
    if (a.percent) return (v) => `${Math.round(v * 100)} %`
    if (a.unit) return axisFmt(lo, hi, a.unit)
    // Unitless axes (M, power factor) still need enough decimals to
    // separate their ticks.
    const dp = Math.max(2, Math.ceil(-Math.log10(Math.max(1e-12, (hi - lo) / 5))) + 1)
    return (v) => v.toFixed(Math.min(6, dp))
  }
  const fmtYleft = fmtY(ay, yLo, yHi, logY)
  const framed = fitLeftAxis(ctx, area, [fmtYleft(yLo), fmtYleft(yHi), fmtYleft((yLo + yHi) / 2)], k)
  const { sx, sy } = drawFrame(ctx, framed, xMin, xMax, yLo, yHi, (v) => fmtX(logX ? Math.pow(10, v) : v), fmtYleft, {
    xStep: logX ? 1 : sweep.x === 'D' ? 0.1 : null,
    yStep: logY ? 1 : sweep.y === 'eta' ? 0.2 : null,
    xTitle: ax.unit ? `${ax.label} (${ax.unit})` : sweep.x === 'D' ? 'Duty D' : ax.label,
    yTitle: ay.unit ? `${ay.label} (${ay.unit})` : ay.label,
  })

  // Right axis for y2.
  const area2 = framed
  let sy2 = null
  if (ay2) {
    const [lo2, hi2] = sweepRange(points, basePoints, sweep.y2, ay2)
    sy2 = (v) => area2.y + area2.h - ((v - lo2) / (hi2 - lo2)) * area2.h
    ctx.save()
    ctx.font = `${Math.round(11 * k)}px ${MONO}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.text
    const n = Math.max(2, Math.floor(area2.h / (46 * k)))
    for (let i = 0; i <= n; i++) {
      const v = lo2 + ((hi2 - lo2) * i) / n
      ctx.fillText(fmtY(ay2, lo2, hi2)(v), area2.x + area2.w + 8 * k, sy2(v))
    }
    ctx.font = `${Math.round(12 * k)}px ui-sans-serif, system-ui, sans-serif`
    ctx.translate(w - 14 * k, area2.y + area2.h / 2)
    ctx.rotate(Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText(ay2.unit ? `${ay2.label} (${ay2.unit})` : ay2.label, 0, 0)
    ctx.restore()
  }

  ctx.save()
  ctx.beginPath()
  ctx.rect(area2.x, area2.y, area2.w, area2.h)
  ctx.clip()

  // Discontinuous conduction, shaded where the engine found it.
  ctx.fillStyle = COLORS.spectrumDim
  let run = null
  const flush = (end) => {
    if (run === null) return
    ctx.fillRect(sx(run), area2.y, sx(end) - sx(run), area2.h)
    run = null
  }
  points.forEach((q, i) => {
    if (q.mode === 'DCM') {
      if (run === null) run = xs[i]
    } else flush(xs[i])
  })
  flush(xs[xs.length - 1])

  const line = (key, color, dash, map = (v) => sy(Y(v)), width = 1.2) => {
    if (!points.some((q) => Number.isFinite(q[key]))) return
    ctx.strokeStyle = color
    ctx.setLineDash(dash)
    ctx.lineWidth = width * k
    ctx.beginPath()
    points.forEach((q, i) => {
      if (i === 0) ctx.moveTo(sx(xs[i]), map(q[key]))
      else ctx.lineTo(sx(xs[i]), map(q[key]))
    })
    ctx.stroke()
    ctx.setLineDash([])
  }
  if (sweep.y === 'M') {
    line('ideal', COLORS.response, [6 * k, 4 * k])
    line('pred', COLORS.spectrum, [2 * k, 3 * k])
  } else line('pred', COLORS.spectrum, [6 * k, 4 * k])
  if (sy2) line(sweep.y2, COLORS.response, [], sy2, 2)
  line(sweep.y, COLORS.trace, [], sy, 2)

  ctx.font = `${Math.round(11 * k)}px ${MONO}`
  const labelAt = (xv, yPx, text, color, above = true) => {
    const px = sx(xv)
    ctx.fillStyle = color
    ctx.textAlign = xv > (xMin + xMax) / 2 ? 'right' : 'left'
    ctx.textBaseline = above ? 'bottom' : 'top'
    const dx = ctx.textAlign === 'right' ? -7 * k : 7 * k
    ctx.fillText(text, px + dx, yPx + (above ? -5 * k : 5 * k))
  }

  // The note's numbers, where they happen.
  for (const mk of marks) {
    const xv = X(mk.x)
    if (mk.type === 'vline') {
      const x = sx(xv)
      ctx.strokeStyle = COLORS.marker
      ctx.globalAlpha = 0.7
      ctx.setLineDash([5 * k, 4 * k])
      ctx.lineWidth = 1 * k
      ctx.beginPath()
      ctx.moveTo(x, area2.y)
      ctx.lineTo(x, area2.y + area2.h)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      ctx.fillStyle = COLORS.marker
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(mk.label, x + 4 * k, area2.y + 4 * k)
    } else if (mk.type === 'point') {
      const y = sy(Y(mk.y))
      ctx.strokeStyle = COLORS.marker
      ctx.lineWidth = 1.5 * k
      ctx.beginPath()
      ctx.arc(sx(xv), y, 5 * k, 0, Math.PI * 2)
      ctx.stroke()
      // Above the point; a step higher when the knob's own readout sits there
      // too, so the two labels stack instead of overprinting.
      const crowded = Number.isFinite(at) && Math.abs(sx(X(at)) - sx(xv)) < 12 * k
      labelAt(xv, y - (crowded ? 14 * k : 0), mk.label, COLORS.marker, true)
    }
  }

  // Where the knob is now: the nearest computed point, so the dot sits on the curve.
  if (Number.isFinite(at)) {
    const lx = X(at)
    let best = 0
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - lx) < Math.abs(xs[best] - lx)) best = i
    ctx.fillStyle = COLORS.marker
    ctx.beginPath()
    ctx.arc(sx(xs[best]), sy(Y(ys[best])), 4 * k, 0, Math.PI * 2)
    ctx.fill()
    const yTxt = ay.percent ? `${(ys[best] * 100).toFixed(1)} %` : ay.unit ? fmt(ys[best], ay.unit, 4) : ys[best].toFixed(4)
    const xTxt = sweep.x === 'D' ? `D = ${at.toFixed(3)}` : fmtX(at)
    labelAt(xs[best], sy(Y(ys[best])), `${xTxt} → ${yTxt}`, COLORS.marker, true)
    if (sy2) {
      const v2 = points[best][sweep.y2]
      ctx.fillStyle = COLORS.response
      ctx.beginPath()
      ctx.arc(sx(xs[best]), sy2(v2), 4 * k, 0, Math.PI * 2)
      ctx.fill()
      labelAt(xs[best], sy2(v2), ay2.unit ? fmt(v2, ay2.unit, 4) : v2.toFixed(4), COLORS.response, false)
    }
  }
  ctx.restore()

  return { sx, sy, area: area2, xMin, xMax, X, Y }
}

export default function SweepCanvas({ points, basePoints = null, sweep, at, marks = [], label = '' }) {
  const ref = useCanvas((ctx, w, h) => drawSweep(ctx, w, h, { points, basePoints, sweep, at, marks }), [points, basePoints, sweep, at, marks])
  const legend = sweepLegend(points, sweep, label)
  return (
    <div className="plot-wrap">
      <canvas
        ref={ref}
        className="plot"
        role="img"
        aria-label="Sweep: one quantity against one knob, each point a solved steady state"
        data-marks={markLabels(marks)}
      />
      <ul className="plot-legend" aria-label="Legend">
        {legend.map((it) => (
          <li key={it.text}>
            <i className={`swatch ${it.style}`} style={{ color: it.color }} aria-hidden="true" />
            {it.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
