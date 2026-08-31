// Shared plot chrome: axes, grid, ticks. Both views are ordinary XY plots, so
// the framing lives here and each view only draws its own trace.

export const COLORS = {
  bg: '#0b0f14',
  grid: '#182029',
  gridMajor: '#243040',
  axis: '#3a4757',
  text: '#7d8b9c',
  textBright: '#c9d6e4',
  trace: '#38e0b0',
  traceDim: 'rgba(56, 224, 176, 0.15)',
  spectrum: '#f0a23c',
  spectrumDim: 'rgba(240, 162, 60, 0.18)',
  marker: '#ff5c7a',
  response: '#5fa8ff',
  ghost: 'rgba(240, 162, 60, 0.30)',
  traceGhost: 'rgba(56, 224, 176, 0.32)',
  phase: '#b98cf0',
}

// Roomier gutters than a bare plot needs, because both axes carry a written
// title. A reader who does not already know what these plots are should not
// have to infer the units from context.
const PAD = { l: 76, r: 18, t: 14, b: 48 }

/**
 * How much to enlarge plot chrome for the canvas it is drawn on.
 *
 * Axis labels and gutters were fixed pixel sizes tuned at 1080p. On a 4K
 * display the same canvas is twice as wide, so fixed type shrinks to an
 * illegible fraction of the plot. Scaling off the canvas's own width keeps the
 * proportions right at any resolution, and clamping stops small panes from
 * losing their labels entirely.
 */
export function plotScale(w) {
  return Math.max(1, Math.min(2.2, w / 1150))
}

export function plotArea(w, h, opts = {}) {
  const k = plotScale(w)
  const l = PAD.l * k
  // A second y-axis on the right needs room for its labels.
  const r = (opts.rightAxis ? 64 : PAD.r) * k
  // Extra headroom above the frame, in device pixels, for a view that writes
  // something over its plot. A caption drawn INSIDE the plot is covering
  // signal however it is placed and whatever it is plated with — the scope's
  // sat across the trace it was describing. Giving it its own band costs a
  // little height and costs the trace nothing.
  const t = PAD.t * k + Math.max(0, opts.topInset || 0)
  const b = PAD.b * k
  return { x: l, y: t, w: Math.max(1, w - l - r), h: Math.max(1, h - t - b), k }
}

/** A round tick interval near `range / target`. */
export function niceStep(range, target) {
  if (range <= 0) return 1
  const raw = range / Math.max(1, target)
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return step * mag
}

/**
 * Draw grid, ticks and axis frame.
 * `fmtX`/`fmtY` turn a data value into a tick label.
 */
export function drawFrame(ctx, area, xMin, xMax, yMin, yMax, fmtX, fmtY, opts = {}) {
  // yStep is an override, not a hint: a log axis is plotted in decades, and
  // letting niceStep pick 0.2 of one gives five ticks that all format to the
  // same exponent.
  const {
    zeroLine = false,
    yStep: yStepOverride = null,
    xStep: xStepOverride = null,
    xTitle = null,
    yTitle = null,
  } = opts
  const sx = (v) => area.x + ((v - xMin) / (xMax - xMin)) * area.w
  const sy = (v) => area.y + area.h - ((v - yMin) / (yMax - yMin)) * area.h

  const k = area.k || 1
  ctx.save()
  ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
  ctx.textBaseline = 'middle'

  // Same override as yStep, for the same reason: a decade axis is plotted in
  // powers of ten, and letting niceStep pick a fifth of one gives five ticks
  // that all format to the same number.
  const xStep =
    xStepOverride || niceStep(xMax - xMin, Math.max(2, Math.floor(area.w / (90 * k))))
  ctx.textAlign = 'center'
  // The end-of-axis epsilon is relative to the step, not absolute — an
  // absolute 1e-9 is meaningless on an axis measured in hundreds of kilohertz.
  for (let v = Math.ceil(xMin / xStep) * xStep; v <= xMax + xStep * 1e-6; v += xStep) {
    const x = sx(v)
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 0.5, area.y)
    ctx.lineTo(x + 0.5, area.y + area.h)
    ctx.stroke()
    ctx.fillStyle = COLORS.text
    ctx.fillText(fmtX(v), x, area.y + area.h + 14 * k)
  }

  const yStep =
    yStepOverride || niceStep(yMax - yMin, Math.max(2, Math.floor(area.h / (46 * k))))
  ctx.textAlign = 'right'
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax + yStep * 1e-6; v += yStep) {
    const y = sy(v)
    const isZero = Math.abs(v) < yStep * 1e-6
    ctx.strokeStyle = isZero && zeroLine ? COLORS.gridMajor : COLORS.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(area.x, y + 0.5)
    ctx.lineTo(area.x + area.w, y + 0.5)
    ctx.stroke()
    ctx.fillStyle = COLORS.text
    ctx.fillText(fmtY(v), area.x - 8 * k, y)
  }

  ctx.strokeStyle = COLORS.axis
  ctx.lineWidth = 1
  ctx.strokeRect(area.x + 0.5, area.y + 0.5, area.w, area.h)

  // Axis titles. Spelled out with units, in the sans face, so they read as
  // labels rather than as more data.
  ctx.fillStyle = COLORS.text
  ctx.font = `${Math.round(12 * k)}px ui-sans-serif, system-ui, sans-serif`
  if (xTitle) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(xTitle, area.x + area.w / 2, area.y + area.h + 40 * k)
  }
  if (yTitle) {
    ctx.save()
    ctx.translate(18 * k, area.y + area.h / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(yTitle, 0, 0)
    ctx.restore()
  }
  ctx.restore()

  return { sx, sy }
}
