// Shared chrome for the time-domain canvases: the second y-axis, the legend
// band above the frame, the cursor, and the pointer-to-time mapping that lets
// a reader scrub the cursor by dragging on the plot.

import { COLORS, fmt, niceStep, plotArea } from '@ee-labs/ui'

export const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
export const SANS = 'ui-sans-serif, system-ui, sans-serif'

/** Trace colours, left axis then right axis, in the order the experiment lists them. */
export const LEFT_COLORS = [COLORS.trace, COLORS.response, COLORS.phase]
export const RIGHT_COLORS = [COLORS.spectrum, COLORS.marker, COLORS.phase]

/** [lo, hi] spanning every series (and zero), with a little air. */
export function spanOf(seriesList) {
  let lo = 0
  let hi = 0
  for (const ys of seriesList) for (let i = 0; i < ys.length; i++) {
    const v = ys[i]
    if (!Number.isFinite(v)) continue
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  if (hi === lo) hi = lo + 1
  const pad = (hi - lo) * 0.12
  return [lo - pad, hi + pad]
}

/**
 * Stretch the right-hand span so its zero lands on the same pixel row as the
 * left-hand span's zero: one zero line serves both scales, and a current that
 * changes sign does so where the voltage axis says 0. Both spans already
 * contain zero (spanOf). Returns the new [rLo, rHi].
 */
export function alignZero([lLo, lHi], [rLo, rHi]) {
  const f0 = -lLo / (lHi - lLo) // zero's height as a fraction of the frame
  const up = f0 < 1 ? rHi / (1 - f0) : 0 // scale needed to hold rHi above zero
  const down = f0 > 0 ? -rLo / f0 : 0 // ...and rLo below it
  const s = Math.max(up, down, 1e-300)
  return [-s * f0, s * (1 - f0)]
}

/** How much of a frame [lo, hi] the data [dLo, dHi] fills, 0..1. */
export const fillOf = ([lo, hi], [dLo, dHi]) => (dHi - dLo) / (hi - lo)

/**
 * The right-hand scale: zero aligned with the left scale's when that leaves
 * the right-hand traces at least `minFill` of the frame tall, otherwise the
 * traces' own span — a ringing current a tenth of the frame high, squeezed
 * under a voltage that never goes negative, is a hidden trace, and the plot
 * would rather show two zero lines than lose it. `aligned` says which happened.
 */
export function rightSpan(leftSpan, [rLo, rHi], minFill = 0.4) {
  const aligned = alignZero(leftSpan, [rLo, rHi])
  if (fillOf(aligned, [rLo, rHi]) >= minFill) return { span: aligned, aligned: true }
  return { span: [rLo, rHi], aligned: false }
}

/**
 * The data marks (marks.js) on a frame: `sx` maps the plot's abscissa to a
 * pixel, `sy`/`syR` the left and right scales, `yMap` any transform the left
 * scale applies to its data first (log10 on the impedance plot). Levels and
 * segments are dashed hairlines, points are rings, curves are dotted, each
 * with its label beside it; time marks are the vertical hairlines the scope
 * has always drawn. On a frame too narrow to hold the labels (a phone) the
 * marks are drawn unlabelled and the caption under the plot names them. The
 * caller has clipped to the frame.
 */
export function drawDataMarks(ctx, area, marks, { sx, sy, syR = null, yMap = (y) => y }) {
  const k = area.k || 1
  const color = COLORS.textBright
  const yOf = (m, y) => (m.axis === 'right' && syR ? syR(y) : sy(yMap(y)))
  const top = area.y
  const right = area.x + area.w
  ctx.save()
  ctx.font = `${Math.round(10 * k)}px ${SANS}`
  ctx.lineWidth = 1
  const labelled = area.w >= 380 * k
  const text = (label, x, y, { align = 'left', base = 'bottom' } = {}) => {
    if (!label || !labelled) return
    const wide = ctx.measureText(label).width
    // Stay inside the frame: flip to the left of x when the label would run off it,
    // and below y when it would run over the top.
    let ax = align
    if (ax === 'left' && x + wide > right - 2 * k) ax = 'right'
    if (ax === 'right' && x - wide < area.x + 2 * k) ax = 'left'
    let by = base
    if (by === 'bottom' && y - 12 * k < top) by = 'top'
    ctx.textAlign = ax
    ctx.textBaseline = by
    ctx.globalAlpha = 0.95
    ctx.fillStyle = color
    ctx.fillText(label, x, y)
  }
  for (const m of marks) {
    if (m.kind === 'time') {
      if (m.x > 0) drawMark(ctx, area, sx(m.x), m.label)
      continue
    }
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.6
    if (m.kind === 'level') {
      const y = Math.round(yOf(m, m.y)) + 0.5
      ctx.setLineDash([5 * k, 4 * k])
      ctx.beginPath()
      ctx.moveTo(area.x, y)
      ctx.lineTo(right, y)
      ctx.stroke()
      ctx.setLineDash([])
      text(m.label, right - 4 * k, y - 3 * k, { align: 'right' })
    } else if (m.kind === 'segment') {
      const x0 = sx(m.x0)
      const x1 = sx(m.x1)
      const y0 = yOf(m, m.y0)
      const y1 = yOf(m, m.y1)
      ctx.setLineDash([5 * k, 4 * k])
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
      ctx.setLineDash([])
      // The label sits past the segment's midpoint, on the side away from the frame's centre.
      const mx = (x0 + x1) / 2
      const my = (y0 + y1) / 2
      text(m.label, mx + 6 * k, my - 4 * k)
    } else if (m.kind === 'point') {
      // A ring on the frame's edge (the instant t = 0) is nudged inside so the whole ring shows.
      const x = Math.max(area.x + 5 * k, Math.min(right - 5 * k, sx(m.x)))
      const y = Math.max(top + 5 * k, Math.min(area.y + area.h - 5 * k, yOf(m, m.y)))
      ctx.globalAlpha = 1
      ctx.lineWidth = 1.5 * k
      ctx.beginPath()
      ctx.arc(x, y, 4 * k, 0, Math.PI * 2)
      ctx.stroke()
      ctx.lineWidth = 1
      // Above and to the right; beside the ring when the frame's top is too close.
      if (y - 18 * k < top) text(m.label, x + 8 * k, y, { base: 'middle' })
      else text(m.label, x + 8 * k, y - 6 * k)
    } else if (m.kind === 'curve') {
      ctx.setLineDash([2 * k, 3 * k])
      ctx.beginPath()
      let best = 0
      for (let i = 0; i < m.xs.length; i++) {
        const y = area.y + area.h - m.ys[i] * area.h
        if (i === 0) ctx.moveTo(sx(m.xs[i]), y)
        else ctx.lineTo(sx(m.xs[i]), y)
        if (m.ys[i] > m.ys[best]) best = i
      }
      ctx.stroke()
      ctx.setLineDash([])
      text(m.label, sx(m.xs[best]) + 6 * k, area.y + area.h - m.ys[best] * area.h - 4 * k)
    }
  }
  ctx.restore()
}

/**
 * Nice ticks and a title down the right-hand side of the frame, for a second
 * scale. `step` overrides the tick interval — a phase axis is read in 45°.
 */
export function drawRightAxis(ctx, area, w, lo, hi, fmtY, title, step = null) {
  const k = area.k || 1
  const sy = (v) => area.y + area.h - ((v - lo) / (hi - lo)) * area.h
  ctx.save()
  ctx.font = `${Math.round(11 * k)}px ${MONO}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = COLORS.text
  step = step || niceStep(hi - lo, Math.max(2, Math.floor(area.h / (46 * k))))
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) {
    const y = sy(v)
    ctx.fillText(fmtY(Math.abs(v) < step * 1e-6 ? 0 : v), area.x + area.w + 8 * k, y)
    // A short tick, since the grid lines belong to the left scale.
    ctx.strokeStyle = COLORS.axis
    ctx.beginPath()
    ctx.moveTo(area.x + area.w, y + 0.5)
    ctx.lineTo(area.x + area.w + 5 * k, y + 0.5)
    ctx.stroke()
  }
  if (title) {
    ctx.font = `${Math.round(12 * k)}px ${SANS}`
    ctx.translate(w - 6 * k, area.y + area.h / 2)
    ctx.rotate(Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText(title, 0, 0)
  }
  ctx.restore()
  return sy
}

/** The legend, written in the band above the frame, right-aligned, most recent first. */
export function drawLegend(ctx, area, items) {
  const k = area.k || 1
  ctx.save()
  ctx.font = `${Math.round(11 * k)}px ${MONO}`
  ctx.textBaseline = 'bottom'
  ctx.textAlign = 'right'
  let x = area.x + area.w
  for (const it of [...items].reverse()) {
    ctx.fillStyle = it.color
    ctx.globalAlpha = it.dim ? 0.7 : 1
    ctx.fillText(it.label, x, area.y - 3 * k)
    x -= ctx.measureText(it.label).width + 14 * k
  }
  ctx.restore()
}

/** A vertical dotted line with a small label at the top of the frame. */
export function drawMark(ctx, area, x, label, color = COLORS.text) {
  const k = area.k || 1
  ctx.save()
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.55
  ctx.setLineDash([2 * k, 3 * k])
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(Math.round(x) + 0.5, area.y)
  ctx.lineTo(Math.round(x) + 0.5, area.y + area.h)
  ctx.stroke()
  ctx.setLineDash([])
  if (label) {
    ctx.globalAlpha = 0.9
    ctx.fillStyle = color
    ctx.font = `${Math.round(10 * k)}px ${SANS}`
    ctx.textBaseline = 'top'
    // Flip to the left of the line when the label would run off the frame.
    const wide = ctx.measureText(label).width
    const right = x + 4 * k + wide <= area.x + area.w
    ctx.textAlign = right ? 'left' : 'right'
    ctx.fillText(label, x + (right ? 4 : -4) * k, area.y + 3 * k)
  }
  ctx.restore()
}

/** The time cursor: a solid line in the marker colour with a handle at the top. */
export function drawCursor(ctx, area, x) {
  const k = area.k || 1
  ctx.save()
  ctx.strokeStyle = COLORS.marker
  ctx.lineWidth = 1.2 * k
  ctx.beginPath()
  ctx.moveTo(x, area.y)
  ctx.lineTo(x, area.y + area.h)
  ctx.stroke()
  ctx.fillStyle = COLORS.marker
  ctx.beginPath()
  ctx.moveTo(x - 5 * k, area.y)
  ctx.lineTo(x + 5 * k, area.y)
  ctx.lineTo(x, area.y + 6 * k)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** Time-axis tick labels: seconds with a prefix, two significant figures. */
export const fmtT = (t) => fmt(t, 's', 2)

/**
 * Pointer handlers that turn a drag across the frame into cursor times. The
 * canvas's own CSS size is what the draw callback saw, so the same plotArea
 * gives the same mapping. `pan-y` touch action leaves vertical scrolling to
 * the page and takes horizontal drags for the cursor.
 */
export function scrubHandlers(onCursor, tEnd, opts) {
  if (!onCursor) return {}
  const timeAt = (e) => {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const area = plotArea(rect.width, rect.height, opts)
    const f = (e.clientX - rect.left - area.x) / area.w
    return Math.min(tEnd, Math.max(0, f * tEnd))
  }
  return {
    style: { touchAction: 'pan-y', cursor: 'col-resize' },
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      onCursor(timeAt(e))
    },
    onPointerMove: (e) => {
      if (e.buttons & 1) onCursor(timeAt(e))
    },
  }
}
