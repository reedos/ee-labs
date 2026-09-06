import React from 'react'
import { useCanvas, COLORS, plotArea, drawFrame } from '@ee-labs/ui'
import { num } from '../format.js'

/**
 * One quantity against the knob it depends on, drawn from the engine.
 *
 * A curve descriptor is `{ x, series, marks, yLabel, yUnit, yLog, yFromZero,
 * rightLabel, rightUnit }`. Each series carries `read(v)`, which is called once
 * per sample and runs the same `analyse` the headline came from. Nothing here
 * evaluates a formula of its own, so a curve and a readout cannot disagree.
 *
 * Two rules from REVIEW_PLAYBOOK.md are built in. Every axis carries its
 * quantity and its unit, spelled out. And the y range is taken from the data
 * that is actually on screen, so the feature a lesson exists to show cannot sit
 * outside the frame.
 */
export default function CurveCanvas({ curve }) {
  const ref = useCanvas(
    (ctx, w, h) => draw(ctx, w, h, curve),
    [curve],
  )
  return <canvas ref={ref} className="plot" />
}

const SAMPLES = 160

/** The sample positions along the x axis, spread evenly or in the logarithm. */
function samplesOf(x) {
  const out = []
  for (let k = 0; k < SAMPLES; k++) {
    const t = k / (SAMPLES - 1)
    out.push(x.log ? x.from * Math.pow(x.to / x.from, t) : x.from + (x.to - x.from) * t)
  }
  return out
}

const finite = (v) => Number.isFinite(v)

export function draw(ctx, w, h, curve) {
  if (!curve) return
  const right = curve.series.some((s) => s.axis === 'right')
  const area = plotArea(w, h, { rightAxis: right })
  const xs = samplesOf(curve.x)
  const traces = curve.series.map((s) => xs.map((v) => s.read(v)))

  const leftIdx = curve.series.map((s, i) => (s.axis === 'right' ? -1 : i)).filter((i) => i >= 0)
  const rightIdx = curve.series.map((s, i) => (s.axis === 'right' ? i : -1)).filter((i) => i >= 0)

  const range = (idx, log, fromZero) => {
    const vals = idx.flatMap((i) => traces[i]).filter(finite).filter((v) => !log || v > 0)
    if (!vals.length) return [0, 1]
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)
    if (log) {
      lo = Math.log10(lo)
      hi = Math.log10(hi)
      const pad = Math.max(0.2, 0.06 * (hi - lo))
      return [lo - pad, hi + pad]
    }
    if (fromZero) lo = Math.min(0, lo)
    if (hi === lo) {
      const pad = Math.max(1e-12, Math.abs(hi) * 0.05)
      return [lo - pad, hi + pad]
    }
    const pad = 0.08 * (hi - lo)
    // An axis must not offer a value the quantity cannot take. A photon
    // lifetime axis padded below its smallest sample printed a tick at
    // −17.9 ps, which is a number a reader has to know to discount.
    if (lo >= 0 && lo - pad < 0) return [0, hi + pad]
    return [lo - pad, hi + pad]
  }

  const [yMin, yMax] = range(leftIdx, curve.yLog, curve.yFromZero)
  const [rMin, rMax] = right ? range(rightIdx, curve.rightLog, false) : [0, 1]

  const xMin = curve.x.log ? Math.log10(curve.x.from) : curve.x.from
  const xMax = curve.x.log ? Math.log10(curve.x.to) : curve.x.to
  const px = (v) => (curve.x.log ? Math.log10(v) : v)
  const py = (v) => (curve.yLog ? Math.log10(v) : v)

  // The tick labels go through this lab's own formatter and not the shared
  // engineering one. A facet reflectance axis running 0.02 to 0.99 came out
  // labelled "200 m" to "800 m", because a prefix letter with no unit behind it
  // is read as a unit. `num` prints a unitless tick in plain digits.
  const fmtX = (v) => num(curve.x.log ? Math.pow(10, v) : v, curve.x.unit, 3)
  const fmtY = (v) => (curve.yLog ? num(Math.pow(10, v), curve.yUnit, 3) : curve.yPlain ? `${Number(v).toPrecision(3)}` : num(v, curve.yUnit, 3))

  const { sx, sy } = drawFrame(ctx, area, xMin, xMax, yMin, yMax, fmtX, fmtY, {
    xTitle: `${curve.x.label}${curve.x.unit ? ` (${curve.x.unit})` : ''}`,
    yTitle: `${curve.yLabel}${curve.yUnit ? ` (${curve.yUnit})` : ''}`,
    zeroLine: true,
  })
  const ry = (v) => area.y + area.h - ((v - rMin) / (rMax - rMin)) * area.h

  // The right axis, when a second series needs its own scale. It is drawn in
  // its own colour and labelled with its own unit, so the two curves cannot be
  // read against the wrong numbers.
  if (right) {
    const k = area.k
    ctx.save()
    ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
    ctx.fillStyle = COLORS.spectrum
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (let j = 0; j <= 4; j++) {
      const v = rMin + ((rMax - rMin) * j) / 4
      ctx.fillText(num(v, curve.rightUnit, 3), area.x + area.w + 8 * k, ry(v))
    }
    ctx.save()
    ctx.translate(area.x + area.w + 56 * k, area.y + area.h / 2)
    ctx.rotate(Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.font = `${Math.round(12 * k)}px ui-sans-serif, system-ui, sans-serif`
    ctx.fillText(`${curve.rightLabel}${curve.rightUnit ? ` (${curve.rightUnit})` : ''}`, 0, 0)
    ctx.restore()
    ctx.restore()
  }

  // The markers first, so a trace is never hidden behind one.
  for (const m of curve.marks || []) {
    if (!finite(m.at)) continue
    const x = sx(px(m.at))
    if (x < area.x - 1 || x > area.x + area.w + 1) continue
    ctx.save()
    ctx.strokeStyle = COLORS.marker
    ctx.setLineDash([3, 3])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 0.5, area.y)
    ctx.lineTo(x + 0.5, area.y + area.h)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = COLORS.marker
    ctx.font = `${Math.round(10 * area.k)}px ui-sans-serif, system-ui, sans-serif`
    ctx.textAlign = x > area.x + area.w * 0.7 ? 'right' : 'left'
    ctx.fillText(m.label, x + (x > area.x + area.w * 0.7 ? -4 : 4), area.y + 10 * area.k)
    ctx.restore()
  }

  curve.series.forEach((s, i) => {
    const isRight = s.axis === 'right'
    ctx.save()
    ctx.strokeStyle = isRight ? COLORS.spectrum : i === 0 ? COLORS.trace : COLORS.response
    ctx.lineWidth = 1.8
    ctx.beginPath()
    let started = false
    xs.forEach((v, k) => {
      const y = traces[i][k]
      if (!finite(y) || (curve.yLog && !isRight && y <= 0)) {
        started = false
        return
      }
      const X = sx(px(v))
      const Y = isRight ? ry(y) : sy(py(y))
      if (!started) {
        ctx.moveTo(X, Y)
        started = true
      } else ctx.lineTo(X, Y)
    })
    ctx.stroke()
    ctx.restore()
  })
}
