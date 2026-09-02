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
