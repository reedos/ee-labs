import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt, anchoredRange } from '@ee-labs/ui'
import { SWEEP_X, SWEEP_Y } from '../experiments.js'
import { axisFmt, fitLeftAxis, tickStep, logTickStep } from '../format.js'
import { markLabels } from '../marks.js'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

/**
 * The "at" marker's label — one function, called from the canvas draw and
 * from the canvas's `data-at` attribute alike, so a screen-agreement probe
 * (verify.mjs) reads the very string that was drawn rather than a second
 * copy of the same formatting that could drift from it.
 */
export function atLabel(sweep, at, atY) {
  if (!Number.isFinite(at) || !Number.isFinite(atY)) return ''
  const ax = SWEEP_X[sweep.x]
  const ay = SWEEP_Y[sweep.y]
  const fmtX = (v) => (ax.fmt ? ax.fmt(v) : fmt(v, ax.unit, 2))
  const xTxt = sweep.x === 'D' ? `D = ${at.toFixed(3)}` : fmtX(at)
  const yTxt = ay.percent ? `${(atY * 100).toFixed(1)} %` : ay.unit ? fmt(atY, ay.unit, 4) : atY.toFixed(4)
  return `${xTxt} → ${yTxt}`
}

/** The share of the declared frame a curve has to fill to keep it. */
export const FRAME_SHARE = 0.25

/**
 * The y-range for one swept quantity, anchored on the sweep at the defaults.
 *
 * The declared frame in SWEEP_Y — an efficiency runs 0 to 100 %, a ratio 0 to
 * 1 — is the right one while the curve uses a fair share of it. B7, B8, G1,
 * G3 and G4 all sweep an efficiency that never leaves the top tenth, and D4's
 * half-bridge steps 48 V down by four, so its M never passes a quarter. Each
 * of those drew a line pinned along one edge of a frame whose other nine
 * tenths were empty, and the fall the lesson is about — 99.5 % to 95.4 % as
 * B8's switching frequency rises — moved four pixels. The lesson's own
 * feature has to be visible (REVIEW_PLAYBOOK.md classes 4 and 5).
 *
 * So the declared frame is kept while the curve fills at least FRAME_SHARE of
 * it, and the data frames the plot otherwise. The decision is taken on the
 * sweep at the defaults, like the range itself, so turning a knob moves the
 * curve and never the frame.
 */
export function sweepRange(points, basePoints, key, ay, { withPred = false } = {}) {
  const pick = (qs) => (qs || []).map((q) => q[key])
  const preds = (qs) => (withPred ? (qs || []).map((q) => q.pred) : [])
  const values = [...pick(points), ...preds(points)]
  const base = [...pick(basePoints), ...preds(basePoints)]
  const anchor = (base.length ? base : values).filter((v) => Number.isFinite(v) && (ay.scale !== 'log' || v > 0))
  const declared = Number.isFinite(ay.lo) && Number.isFinite(ay.hi) ? ay.hi - ay.lo : 0
  const fills = declared > 0 && anchor.length ? (Math.max(...anchor) - Math.min(...anchor)) / declared : 1
  const keep = fills >= FRAME_SHARE
  return anchoredRange(values, base, {
    lo: keep ? ay.lo : null,
    hi: keep ? ay.hi : null,
    log: ay.scale === 'log',
    // M's unity line is a reference the curve is read against, and it stays on
    // the chart — but only while the declared frame does. A 4:1 transformer's
    // M does not reach a quarter, and unity says nothing about it.
    floor: key === 'M' && keep ? 1 : null,
  })
}

/** What the legend beside the plot lists, in drawing order. */
export function sweepLegend(points, sweep, label = '', label2 = '') {
  const ay = SWEEP_Y[sweep.y]
  const ay2 = sweep.y2 ? SWEEP_Y[sweep.y2] : null
  const items = [{ color: COLORS.trace, text: label || `${ay.label} measured`, style: 'solid' }]
  if (sweep.y === 'M') items.push({ color: COLORS.response, text: 'M = D', style: 'dashed' }, { color: COLORS.spectrum, text: 'CCM/DCM formula', style: 'dotted' })
  else if (points.some((q) => Number.isFinite(q.pred))) items.push({ color: COLORS.spectrum, text: 'closed form', style: 'dashed' })
  if (ay2) items.push({ color: COLORS.response, text: label2 || (sweep.shared ? ay2.label : `${ay2.label} (right axis)`), style: 'solid' })
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
 * `sweep` is `{ x, y, y2?, shared? }` with keys from SWEEP_X and SWEEP_Y; a
 * `y2` is drawn on a right-hand axis, or on the left one with `shared` when
 * the two are the same quantity and the gap between them is the point (the
 * chopper's ⟨v⟩ and V_rms). `at` is the knob's current value, marked on the
 * curve. `marks` are the note's numbers (marks.js), drawn where they happen.
 * The legend is not drawn here: `sweepLegend` lists it for the DOM.
 *
 * Returns the geometry, for tests: `sx`, `sy` (in axis units — log10 of the
 * value on a log axis), `area`, and the x range.
 */
export function drawSweep(ctx, w, h, { points, basePoints = null, sweep, at, atY, atY2, marks = [] }) {
  if (!points.length) return null
  const ax = SWEEP_X[sweep.x]
  const ay = SWEEP_Y[sweep.y]
  const ay2 = sweep.y2 ? SWEEP_Y[sweep.y2] : null
  const shared = !!ay2 && !!sweep.shared
  const k0 = plotArea(w, h).k
  const area = plotArea(w, h, { rightAxis: !!ay2 && !shared, topInset: ay2 ? 16 * k0 : 0 })
  const k = area.k || 1
  const logX = ax.scale === 'log'
  const X = (v) => (logX ? Math.log10(v) : v)
  const xs = points.map((q) => X(q.x))
  const ys = points.map((q) => q[sweep.y])
  const unitAxis = sweep.x === 'D'
  const xMin = logX ? xs[0] : unitAxis ? 0 : xs[0]
  const xMax = logX ? xs[xs.length - 1] : unitAxis ? 1 : xs[xs.length - 1]
  const fmtX = (v) => (ax.fmt ? ax.fmt(v) : fmt(v, ax.unit, 2))
  // A quantity that runs over decades — the buck-boost's output power goes
  // from under two watts to three hundred — is unreadable on a linear axis:
  // the flat stretch that is the whole point sits on the frame. Those
  // descriptors ask for a log axis, and the values are carried through it.
  const logY = ay.scale === 'log'
  const Y = (v) => (logY ? Math.log10(Math.max(v, 1e-12)) : v)
  // A shared axis frames both curves: the range is the union of the two.
  const [yLo, yHi] = shared
    ? (() => {
        const [lo1, hi1] = sweepRange(points, basePoints, sweep.y, ay, { withPred: true })
        const [lo2, hi2] = sweepRange(points, basePoints, sweep.y2, ay2)
        return [Math.min(lo1, lo2), Math.max(hi1, hi2)]
      })()
    : sweepRange(points, basePoints, sweep.y, ay, { withPred: true })
  // Both steps carry at least three ticks, whatever the frame's size: a
  // decade step on a range holding one whole decade, or a round step larger
  // than half the range, leaves an axis with a quantity, a unit and no scale
  // (format.js tickStep). The fitted frame changes x and w and never h, so
  // the y step is settled here, before the fit, and the percentage formatter
  // is told how fine it is.
  const yStep = logY ? logTickStep(yLo, yHi) : tickStep(yLo, yHi, area.h, k)
  const fmtY = (a, lo, hi, log = false, step = null) => {
    if (log) {
      const f = axisFmt(Math.pow(10, lo), Math.pow(10, hi), a.unit, { ticks: 1 })
      return (v) => f(Math.pow(10, v))
    }
    // A percentage axis stepped finer than a whole point needs the decimal,
    // or two neighbouring ticks round to the same label.
    if (a.percent) {
      const dp = step && step < 0.01 ? Math.min(3, Math.ceil(-Math.log10(step * 100))) : 0
      return (v) => `${(v * 100).toFixed(dp)} %`
    }
    if (a.unit) return axisFmt(lo, hi, a.unit)
    // Unitless axes (M, power factor) still need enough decimals to
    // separate their ticks.
    const dp = Math.max(2, Math.ceil(-Math.log10(Math.max(1e-12, (hi - lo) / 5))) + 1)
    return (v) => v.toFixed(Math.min(6, dp))
  }
  const fmtYleft = fmtY(ay, yLo, yHi, logY, yStep)
  const framed = fitLeftAxis(ctx, area, [fmtYleft(yLo), fmtYleft(yHi), fmtYleft((yLo + yHi) / 2)], k)
  const yTitleText = shared ? `${ay.label}, ${ay2.label} (${ay.unit})` : ay.unit ? `${ay.label} (${ay.unit})` : ay.label
  // drawFrame always rotates its y-axis title — right for a worded label,
  // wrong for a lone glyph (η, the efficiency axis with no unit): rotated,
  // its descender reads as a stray hook rather than as η. The right-hand
  // axis already carries this same rule (below); the left one is
  // packages/ui's drawFrame, so the title is withheld there and drawn
  // upright here instead, in the same spot drawFrame would have put it.
  const yTitleRotates = yTitleText.length > 2
  const { sx, sy } = drawFrame(ctx, framed, xMin, xMax, yLo, yHi, (v) => fmtX(logX ? Math.pow(10, v) : v), fmtYleft, {
    xStep: logX ? logTickStep(xMin, xMax) : tickStep(xMin, xMax, framed.w, k, { spacing: 62 }),
    yStep,
    xTitle: ax.unit ? `${ax.label} (${ax.unit})` : sweep.x === 'D' ? 'Duty D' : ax.label,
    yTitle: yTitleRotates ? yTitleText : null,
  })
  if (!yTitleRotates) {
    ctx.save()
    ctx.fillStyle = COLORS.text
    ctx.font = `${Math.round(12 * k)}px ui-sans-serif, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(yTitleText, 18 * k, framed.y + framed.h / 2)
    ctx.restore()
  }

  // Right axis for y2 — or the left one, shared.
  const area2 = framed
  let sy2 = null
  if (shared) sy2 = (v) => sy(Y(v))
  else if (ay2) {
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
    // A worded title runs down the axis; a lone glyph (η) stays upright,
    // since rotated it reads as a stray mark.
    const title = ay2.unit ? `${ay2.label} (${ay2.unit})` : ay2.label
    if (title.length > 2) ctx.rotate(Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText(title, 0, 0)
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

  // Where a label goes when the obvious place is taken or off the plot.
  //
  // B7 and B8 sweep an efficiency that rides the top of the frame, so the
  // marker's own "5 Ω → 99.0 %" was drawn above a point two pixels under the
  // ceiling and clipped away with the rest of the overflow: the reader got a
  // dot and no number at all. G2 put three labels in one place — the
  // boundary's own, the R_crit point's and the knob marker's — and they read
  // as one smear. Each label keeps its side and its offset from the point,
  // and takes the next line along until it clears the frame's edges and every
  // label already drawn (REVIEW_PLAYBOOK.md class 6).
  const placed = []
  const LINE = 13 * k
  /**
   * The first line, at `want` or a step away from it, whose box is inside the
   * frame and clear of everything already placed. `down` says which way to
   * look first; the other way is tried after.
   */
  const lineFor = (box, want, down) => {
    const free = (y0) => {
      const b = box(y0)
      if (b.y0 < area2.y || b.y1 > area2.y + area2.h) return false
      return !placed.some((o) => b.x0 < o.x1 + 3 * k && b.x1 > o.x0 - 3 * k && b.y0 < o.y1 && b.y1 > o.y0)
    }
    const tries = []
    for (let i = 0; i < 8; i++) tries.push(want + (down ? 1 : -1) * i * LINE)
    for (let i = 1; i < 8; i++) tries.push(want + (down ? -1 : 1) * i * LINE)
    return tries.find(free)
  }
  const labelAt = (xv, yPx, text, color, above = true) => {
    const px = sx(xv)
    const right = xv > (xMin + xMax) / 2
    ctx.textAlign = right ? 'right' : 'left'
    ctx.textBaseline = 'top'
    const dx = right ? -7 * k : 7 * k
    const wide = ctx.measureText(text).width
    const x0 = right ? px + dx - wide : px + dx
    const box = (y0) => ({ x0, x1: x0 + wide, y0, y1: y0 + LINE })
    const first = above ? yPx - 5 * k - LINE : yPx + 5 * k
    const y0 = lineFor(box, first, !above) ?? Math.min(Math.max(first, area2.y), area2.y + area2.h - LINE)
    placed.push(box(y0))
    ctx.fillStyle = color
    ctx.fillText(text, px + dx, y0)
  }
  /** A left-anchored label that starts at a given x, stepping down until clear. */
  const labelFrom = (x0, yWant, text, color) => {
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const wide = ctx.measureText(text).width
    const box = (y0) => ({ x0, x1: x0 + wide, y0, y1: y0 + LINE })
    const y0 = lineFor(box, yWant, true) ?? yWant
    placed.push(box(y0))
    ctx.fillStyle = color
    ctx.fillText(text, x0, y0)
  }

  // The dots first, then the words. Every ring and every marker books the
  // space it covers before a single label is placed, so a label never lands
  // on a dot it is trying to name: G2's boundary ring sat on the "R" of
  // "R_crit" and its knob marker sat on the "7.54".
  const rings = []
  const requests = []
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
      requests.push({ kind: 'top', x: x + 4 * k, text: mk.label, color: COLORS.marker })
    } else if (mk.type === 'point') {
      const y = sy(Y(mk.y))
      ctx.strokeStyle = COLORS.marker
      ctx.lineWidth = 1.5 * k
      ctx.beginPath()
      ctx.arc(sx(xv), y, 5 * k, 0, Math.PI * 2)
      ctx.stroke()
      rings.push({ cx: sx(xv), cy: y, r: 5 * k })
      requests.push({ kind: 'beside', xv, y, text: mk.label, color: COLORS.marker, above: true })
    }
  }

  // Where the knob is now: at the knob's own x, plotted at the value
  // `analyse()` computed for these exact settings — not the sweep's nearest
  // sampled point, which sits up to half a grid step away on a log axis and
  // reads a different number from the top bar and the note beside it
  // (Reed, 2026-09-03: A1's marker read 4.935 V against a 5.000 V default
  // everywhere else on screen). `atY`/`atY2` are that exact value; the
  // nearest point is still the fallback for a caller that has none (the
  // draw function is exercised directly in a few tests without it).
  if (Number.isFinite(at)) {
    const lx = X(at)
    let best = 0
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - lx) < Math.abs(xs[best] - lx)) best = i
    const yVal = Number.isFinite(atY) ? atY : ys[best]
    ctx.fillStyle = COLORS.marker
    ctx.beginPath()
    ctx.arc(sx(lx), sy(Y(yVal)), 4 * k, 0, Math.PI * 2)
    ctx.fill()
    rings.push({ cx: sx(lx), cy: sy(Y(yVal)), r: 4 * k })
    requests.push({ kind: 'beside', xv: lx, y: sy(Y(yVal)), text: atLabel(sweep, at, yVal), color: COLORS.marker, above: true })
    if (sy2) {
      const v2 = Number.isFinite(atY2) ? atY2 : points[best][sweep.y2]
      ctx.fillStyle = COLORS.response
      ctx.beginPath()
      ctx.arc(sx(lx), sy2(v2), 4 * k, 0, Math.PI * 2)
      ctx.fill()
      rings.push({ cx: sx(lx), cy: sy2(v2), r: 4 * k })
      requests.push({
        kind: 'beside',
        xv: lx,
        y: sy2(v2),
        text: ay2.unit ? fmt(v2, ay2.unit, 4) : v2.toFixed(4),
        color: COLORS.response,
        above: false,
      })
    }
  }

  for (const r of rings) placed.push({ x0: r.cx - r.r, x1: r.cx + r.r, y0: r.cy - r.r, y1: r.cy + r.r })
  for (const q of requests) {
    if (q.kind === 'top') labelFrom(q.x, area2.y + 4 * k, q.text, q.color)
    else labelAt(q.xv, q.y, q.text, q.color, q.above)
  }
  ctx.restore()

  return { sx, sy, area: area2, xMin, xMax, X, Y }
}

export default function SweepCanvas({ points, basePoints = null, sweep, at, atY, atY2, marks = [], label = '', label2 = '' }) {
  const ref = useCanvas(
    (ctx, w, h) => drawSweep(ctx, w, h, { points, basePoints, sweep, at, atY, atY2, marks }),
    [points, basePoints, sweep, at, atY, atY2, marks],
  )
  const legend = sweepLegend(points, sweep, label, label2)
  return (
    <div className="plot-wrap">
      <canvas
        ref={ref}
        className="plot"
        role="img"
        aria-label="Sweep: one quantity against one knob, each point a solved steady state"
        data-marks={markLabels(marks)}
        data-at={atLabel(sweep, at, atY)}
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
