// Shared chrome for the lab's canvases: the frame with room for its labels,
// the second y-axis, the cursor, the labels written at the right-hand end of
// each series (there is no legend — a series is named where it ends), the
// resolver that keeps every piece of text clear of every other, and the
// pointer-to-time mapping that lets a reader scrub the cursor by dragging.

import { COLORS, fmt, niceStep, plotArea } from '@ee-labs/ui'

export const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
export const SANS = 'ui-sans-serif, system-ui, sans-serif'

/**
 * The frame, with the shared gutters widened: the left by 8k so a seven-
 * character tick label ("−100 mV") clears the rotated axis title, the right
 * (when there is a second axis) by 6k for the same reason. Measured, not
 * guessed — verify.mjs holds every chart to zero overlapping texts.
 */
export function frameArea(w, h, opts = {}) {
  const a = plotArea(w, h, opts)
  const k = a.k
  const extraL = 8 * k
  const extraR = opts.rightAxis ? 6 * k : 0
  return { ...a, x: a.x + extraL, w: Math.max(1, a.w - extraL - extraR) }
}

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

/** The [min, max] of the finite values across several series. */
export function extentOf(seriesList) {
  let lo = Infinity
  let hi = -Infinity
  for (const ys of seriesList) for (let i = 0; i < ys.length; i++) {
    const v = ys[i]
    if (!Number.isFinite(v)) continue
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return [lo, hi]
}

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
 * The magnitude scale of a frequency plot. `mag` is log10|Z| (impedance) or
 * dB (bode). Impedance: the frame is rounded out to a tick step chosen so the
 * curve keeps at least 40 % of it — whole decades for a curve that spans
 * several, half or quarter decades for a shallower one, never the flat line
 * a two-decade frame makes of a 0.3-decade curve. Bode: a round number of dB,
 * the 0 dB line kept in view for a passive circuit.
 */
export function freqSpan(mag, mode) {
  const finite = [...mag].filter(Number.isFinite)
  const mn = Math.min(...finite)
  const mx = Math.max(...finite)
  if (mode === 'bode') {
    const top = Math.max(mx, 0)
    const yStep = top - mn > 60 ? 20 : 10
    let lo = Math.floor(mn / yStep) * yStep
    let hi = Math.ceil(top / yStep) * yStep
    if (hi === top) hi += yStep / 2 // headroom above a curve that touches 0 dB
    // The same room below. A3's compensated probe is flat at exactly −20.00 dB,
    // and a frame rounded out to −20 drew the one line the lesson exists to
    // show along the bottom of its own frame, where it reads as the axis.
    if (lo === mn) lo -= yStep / 2
    return { lo, hi, yStep }
  }
  const range = mx - mn
  const pad = Math.max(0.15 * range, 0.02)
  const total = range + 2 * pad
  const yStep = total >= 2 ? 1 : total >= 1 ? 0.5 : total >= 0.5 ? 0.25 : total >= 0.2 ? 0.1 : 0.05
  return { lo: Math.floor((mn - pad) / yStep) * yStep, hi: Math.ceil((mx + pad) / yStep) * yStep, yStep }
}

/**
 * The left scale of a load sweep: from zero (a load curve is read from
 * nothing) to the top of the curve and its marks, with 10 % of air above and,
 * when the curve goes negative, below.
 */
export function sweepSpan(ys, markYs = []) {
  let lo = Math.min(0, ...ys, ...markYs)
  let hi = Math.max(...ys, ...markYs)
  if (hi === lo) hi = lo + 1
  const pad = (hi - lo) * 0.1
  hi += pad
  if (lo < 0) lo -= pad
  return [lo, hi]
}

// ---------------------------------------------------------------- text boxes

/**
 * Record every piece of text a draw writes, as a box in CSS pixels, in
 * `ctx.canvas.__texts`. verify.mjs reads the boxes in a real browser and fails
 * a chart on any two that overlap; the label resolver below reads them as
 * obstacles. Called once at the top of each draw; the wrap of fillText is
 * installed once per context. The transform at that moment is the device
 * scale useCanvas set, so boxes come out in CSS pixels whatever the display.
 */
export function trackText(ctx) {
  const canvas = ctx.canvas
  if (!canvas) return
  canvas.__texts = []
  try {
    const m = ctx.getTransform()
    canvas.__dpr = Math.hypot(m.a, m.b) || 1
  } catch {
    canvas.__dpr = 1
  }
  if (ctx.__tracked) return
  ctx.__tracked = true
  const raw = ctx.fillText
  ctx.fillText = function (text, x, y, maxWidth) {
    if (maxWidth === undefined) raw.call(this, text, x, y)
    else raw.call(this, text, x, y, maxWidth)
    const box = textBox(this, text, x, y)
    if (box && this.canvas.__texts) this.canvas.__texts.push(box)
  }
}

/** The box a fillText covers, in CSS pixels: measured width, font-size height, the current transform applied. */
export function textBox(ctx, text, x, y) {
  const s = String(text)
  if (!s.trim()) return null
  const size = parseFloat((ctx.font.match(/(\d+(\.\d+)?)px/) || [])[1]) || 11
  const wide = ctx.measureText(s).width
  let x0 = x
  if (ctx.textAlign === 'right' || ctx.textAlign === 'end') x0 = x - wide
  else if (ctx.textAlign === 'center') x0 = x - wide / 2
  let y0
  switch (ctx.textBaseline) {
    case 'top':
    case 'hanging':
      y0 = y
      break
    case 'bottom':
    case 'ideographic':
      y0 = y - size
      break
    case 'middle':
      y0 = y - size / 2
      break
    default: // alphabetic
      y0 = y - 0.8 * size
  }
  const corners = [
    [x0, y0],
    [x0 + wide, y0],
    [x0, y0 + size],
    [x0 + wide, y0 + size],
  ]
  let m = null
  try {
    m = ctx.getTransform ? ctx.getTransform() : null
  } catch {
    m = null
  }
  const dpr = ctx.canvas.__dpr || (m ? Math.hypot(m.a, m.b) : 1) || 1
  const pts = corners.map(([px, py]) => (m ? [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f] : [px, py]))
  const xs = pts.map((p) => p[0] / dpr)
  const ys = pts.map((p) => p[1] / dpr)
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), text: s }
}

/**
 * The row to write `text` on so that it covers no text already on the canvas:
 * from `y` (in the alignment and baseline in force), step over the box it
 * would cover — downward when that stays above `bottom`, else upward when that
 * stays below `top` — and look again, a few times. A time mark's name at the
 * top of the frame, a mark's label near the knob's: whichever was written
 * first keeps its place and the later one steps aside.
 */
export function clearRow(ctx, text, x, y, top, bottom, k = 1) {
  const taken = (ctx.canvas && ctx.canvas.__texts) || []
  let yy = y
  for (let pass = 0; pass < 4; pass++) {
    const box = textBox(ctx, text, x, yy)
    if (!box) break
    const hit = overlapping([box, ...taken]).find(([a, b]) => a === box || b === box)
    if (!hit) break
    const o = hit[0] === box ? hit[1] : hit[0]
    const down = o.y1 + 2 * k - box.y0
    const up = box.y1 + 2 * k - o.y0
    if (box.y1 + down <= bottom) yy += down
    else if (box.y0 - up >= top) yy -= up
    else break
  }
  return yy
}

/** Every pair of boxes that overlap once each is shrunk by `shrink` px on every side. */
export function overlapping(boxes, shrink = 1) {
  const out = []
  for (let a = 0; a < boxes.length; a++)
    for (let b = a + 1; b < boxes.length; b++) {
      const p = boxes[a]
      const q = boxes[b]
      if (p.x0 + shrink < q.x1 - shrink && q.x0 + shrink < p.x1 - shrink && p.y0 + shrink < q.y1 - shrink && q.y0 + shrink < p.y1 - shrink) out.push([p, q])
    }
  return out
}

/**
 * Where labels go so that none covers another or an obstacle. Each item is
 * { x0, x1, y, h }: its horizontal extent, the row it would like (its centre)
 * and its height. Items whose extents overlap are pushed apart to `gap`;
 * an item over an obstacle box is moved the shorter way out of it; every item
 * stays inside [top, bottom]. Returns the centre row of each item, in order.
 * Pure, so the test can hold it to its promise.
 */
export function placeLabels(items, obstacles, top, bottom, gap = 2) {
  const n = items.length
  const ys = items.map((it) => it.y)
  const xOverlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1
  const clamp = (i) => {
    const half = items[i].h / 2
    ys[i] = Math.min(bottom - half, Math.max(top + half, ys[i]))
  }
  for (let pass = 0; pass < 40; pass++) {
    let moved = false
    for (let i = 0; i < n; i++) clamp(i)
    // Neighbours: walk in row order and push each overlapping pair apart.
    const order = items.map((_, i) => i).sort((a, b) => ys[a] - ys[b])
    for (let j = 0; j < n; j++)
      for (let l = j + 1; l < n; l++) {
        const a = order[j]
        const b = order[l]
        if (!xOverlap(items[a], items[b])) continue
        const min = (items[a].h + items[b].h) / 2 + gap
        const d = ys[b] - ys[a]
        if (d < min - 1e-9) {
          const push = (min - d) / 2
          ys[a] -= push
          ys[b] += push
          moved = true
        }
      }
    // Obstacles: to the nearest row that is clear of every obstacle in the
    // label's column (a label between two marks' names is not bounced between
    // them); failing that, out of the one it covers the shorter way.
    for (let i = 0; i < n; i++) {
      const it = items[i]
      const half = it.h / 2
      const column = obstacles.filter((o) => o.x0 < it.x1 && it.x0 < o.x1)
      const hit = column.find((o) => o.y0 < ys[i] + half && ys[i] - half < o.y1)
      if (!hit) continue
      const clear = (y) => y - half >= top - 1e-9 && y + half <= bottom + 1e-9 && !column.some((o) => o.y0 < y + half && y - half < o.y1)
      const rows = column.flatMap((o) => [o.y0 - gap - half, o.y1 + gap + half]).filter(clear)
      if (rows.length) {
        ys[i] = rows.reduce((best, y) => (Math.abs(y - ys[i]) < Math.abs(best - ys[i]) ? y : best))
      } else {
        const up = ys[i] + half + gap - hit.y0
        const down = hit.y1 + half + gap - ys[i]
        const canUp = ys[i] - up - half >= top
        const canDown = ys[i] + down + half <= bottom
        if ((up <= down && canUp) || !canDown) ys[i] -= up
        else ys[i] += down
      }
      moved = true
    }
    if (!moved) break
  }
  for (let i = 0; i < n; i++) clamp(i)
  return ys
}

/**
 * Name each series at its right-hand end. `items` are { label, color, y, dim }
 * with y the pixel row where the series leaves the frame; labels are right-
 * aligned inside the frame on a plate of the background colour, placed by
 * placeLabels clear of one another and of every text already on the canvas
 * (the marks' labels, drawn first, are read back from the tracked boxes).
 * `extra` items (a value pinned beside a cursor dot) are placed in the same
 * pass so they cannot collide with the end labels either.
 */
export function drawEndLabels(ctx, area, items, extra = []) {
  const k = area.k || 1
  const size = Math.round(11 * k)
  const font = `${size}px ${MONO}`
  const smallFont = `${Math.round(10 * k)}px ${SANS}`
  const boxes = (ctx.canvas && ctx.canvas.__texts) || []
  const obstacles = boxes.slice()
  const right = area.x + area.w - 4 * k
  ctx.save()
  const laid = []
  ctx.font = font
  for (const it of items) {
    if (!it.label || !Number.isFinite(it.y)) continue
    const wide = ctx.measureText(it.label).width
    laid.push({ ...it, font, x1: right, x0: right - wide, h: size + 2 * k, y: it.y, align: 'right', wide })
  }
  ctx.font = smallFont
  for (const it of extra) {
    if (!it.label || !Number.isFinite(it.y) || !Number.isFinite(it.x)) continue
    const wide = ctx.measureText(it.label).width
    const size2 = Math.round(10 * k)
    const h = size2 + 2 * k
    // Beside the dot: to its right, or to its left near the frame's right edge —
    // or when a mark's label already sits to the right (the ring at τ under the cursor).
    const covers = (x0) => obstacles.some((o) => o.x0 < x0 + wide && x0 < o.x1 && o.y0 < it.y + h / 2 && it.y - h / 2 < o.y1)
    const xR = it.x + 8 * k
    const xL = it.x - 8 * k - wide
    const toLeft = xR + wide > area.x + area.w - 2 * k || (covers(xR) && xL >= area.x + 2 * k && !covers(xL))
    const x0 = toLeft ? xL : xR
    laid.push({ ...it, font: smallFont, x0, x1: x0 + wide, h, y: it.y, align: 'left', wide })
  }
  const rows = placeLabels(laid, obstacles, area.y + 1, area.y + area.h - 1)
  laid.forEach((it, i) => {
    const y = rows[i]
    ctx.font = it.font
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    // The plate, so the label reads over the trace it names.
    ctx.globalAlpha = 0.72
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(it.x0 - 3 * k, y - it.h / 2, it.wide + 6 * k, it.h)
    ctx.globalAlpha = it.dim ? 0.8 : 1
    ctx.fillStyle = it.color
    ctx.fillText(it.label, it.x0, y)
  })
  ctx.restore()
  return rows
}

// ---------------------------------------------------------------- marks, axes, cursor

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
  const labelled = labelsFit(area)
  const bottom = area.y + area.h
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
    ctx.fillText(label, x, clearRow(ctx, label, x, y, top, bottom, k))
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
      // Left of centre: the right-hand end of the frame belongs to the series' names.
      text(m.label, area.x + 6 * k, y - 3 * k)
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

/** Whether a frame is wide enough for the marks' labels and the cursor's pinned values (a phone's is not). */
export const labelsFit = (area) => area.w >= 380 * (area.k || 1)

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
    // Flip to the left of the line when the label would run off the frame, and
    // step down a row when a mark's label already has the top one (F6's spark).
    const wide = ctx.measureText(label).width
    const right = x + 4 * k + wide <= area.x + area.w
    ctx.textAlign = right ? 'left' : 'right'
    const lx = x + (right ? 4 : -4) * k
    ctx.fillText(label, lx, clearRow(ctx, label, lx, area.y + 3 * k, area.y, area.y + area.h, k))
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
 * canvas's own CSS size is what the draw callback saw, so the same frameArea
 * gives the same mapping. `pan-y` touch action leaves vertical scrolling to
 * the page and takes horizontal drags for the cursor.
 */
export function scrubHandlers(onCursor, tEnd, opts) {
  if (!onCursor) return {}
  const timeAt = (e) => {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const area = frameArea(rect.width, rect.height, opts)
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
