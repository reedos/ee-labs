import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas, fmt } from '@ee-labs/ui'

/**
 * Two pictures of three phases.
 *
 * `phasors` draws the three currents as arrows, and beside them the three
 * balanced sets they add up to. That is Group F's main picture, and it is one
 * canvas rather than four because the four triples share one scale.
 *
 * `wave` draws the instantaneous power over one cycle, one phase and all three
 * together. The three-phase trace is flat, and the mean line shows that the
 * flat value is three times the one-phase mean rather than something else.
 */
export default function PhasorCanvas({ x, mode = 'phasors', height = 300 }) {
  const ref = useCanvas((ctx, w, h) => (mode === 'wave' ? drawWave(ctx, w, h, x) : drawPhasors(ctx, w, h, x)), [x, mode])
  return <canvas ref={ref} className="plot" style={{ height }} />
}

const LABELS = ['a', 'b', 'c']

function drawPhasors(ctx, w, h, x) {
  ctx.clearRect(0, 0, w, h)
  const s = x.sets
  if (!s) return
  const groups = [
    { name: 'the set', set: s.total, colour: COLORS.textBright },
    { name: 'positive', set: s.positive, colour: COLORS.trace },
    { name: 'negative', set: s.negative, colour: COLORS.spectrum },
    { name: 'zero', set: s.zero, colour: COLORS.response },
  ]
  const biggest = groups.reduce((m, g) => Math.max(m, ...g.set.map((z) => Math.hypot(z[0], z[1]))), 0) || 1
  // Four panels side by side above 560 px, two by two below it, so the widest
  // picture in the lab still fits a phone.
  const cols = w < 560 ? 2 : 4
  const rows = Math.ceil(groups.length / cols)
  const cw = w / cols
  const ch = h / rows
  const r = Math.min(cw, ch) * 0.34
  groups.forEach((g, k) => {
    const cx = cw * (k % cols) + cw / 2
    const cy = ch * Math.floor(k / cols) + ch / 2 + 6
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, 2 * Math.PI)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - r, cy)
    ctx.lineTo(cx + r, cy)
    ctx.moveTo(cx, cy - r)
    ctx.lineTo(cx, cy + r)
    ctx.stroke()
    g.set.forEach((z, i) => {
      const px = cx + (z[0] / biggest) * r
      const py = cy - (z[1] / biggest) * r
      ctx.strokeStyle = g.colour
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(px, py)
      ctx.stroke()
      ctx.fillStyle = g.colour
      ctx.beginPath()
      ctx.arc(px, py, 3, 0, 2 * Math.PI)
      ctx.fill()
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(LABELS[i], px + (px - cx) * 0.12, py + (py - cy) * 0.12 - 4)
    })
    ctx.fillStyle = g.colour
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(g.name, cx, cy - r - 10)
    const mag = Math.hypot(g.set[0][0], g.set[0][1])
    ctx.fillStyle = COLORS.text
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText(`${mag.toFixed(5)} A`, cx, cy + r + 16)
  })
}

function drawWave(ctx, w, h, x) {
  ctx.clearRect(0, 0, w, h)
  const p = x.inst
  if (!p) return
  const area = plotArea(w, h)
  const lo = Math.min(0, p.min) * 1.1
  const hi = Math.max(p.max, p.threeMax) * 1.1
  const { sx, sy } = drawFrame(ctx, area, 0, 360, lo, hi, (v) => `${v.toFixed(0)}°`, (v) => fmt(v, 'W', 2), {
    xTitle: 'angle through one cycle',
    yTitle: 'instantaneous power',
    zeroLine: true,
  })
  const trace = (values, colour, width) => {
    ctx.strokeStyle = colour
    ctx.lineWidth = width
    ctx.beginPath()
    values.forEach((v, k) => {
      const px = sx((360 * k) / (values.length - 1))
      const py = sy(v)
      if (k === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()
  }
  trace(p.one, COLORS.spectrum, 2)
  trace(p.three, COLORS.trace, 2.5)
  ctx.strokeStyle = COLORS.axis
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(area.x, sy(p.mean))
  ctx.lineTo(area.x + area.w, sy(p.mean))
  ctx.stroke()
  ctx.setLineDash([])
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.spectrum
  ctx.fillText('one phase', area.x + 8, area.y + 14)
  ctx.fillStyle = COLORS.trace
  ctx.fillText('all three', area.x + 78, area.y + 14)
  ctx.fillStyle = COLORS.text
  ctx.fillText(`one-phase mean ${fmt(p.mean, 'W', 4)}`, area.x + 8, sy(p.mean) - 6)
}
