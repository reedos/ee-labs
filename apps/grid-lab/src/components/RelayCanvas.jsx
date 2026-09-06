import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'

/**
 * Two pictures of protection.
 *
 * `relayplot` is time against current on logarithmic axes, which is how a
 * relay curve is always drawn and the only axes on which the characteristic
 * is a straight line far above pickup. Both relays are drawn, and the margin
 * between them at the fault current is marked.
 *
 * `rx` is the resistance–reactance plane with the two zone circles and the
 * impedance the relay measures at this fault. A line's impedance runs out at
 * an angle set by its own resistance and reactance, and the fault sits on that
 * line.
 */
export default function RelayCanvas({ x, mode = 'relayplot', height = 300 }) {
  const ref = useCanvas((ctx, w, h) => (mode === 'rx' ? drawRX(ctx, w, h, x) : drawCurve(ctx, w, h, x)), [x, mode])
  return <canvas ref={ref} className="plot" style={{ height }} />
}

function drawCurve(ctx, w, h, x) {
  ctx.clearRect(0, 0, w, h)
  const area = plotArea(w, h)
  const pts = x.curve.filter((p) => Number.isFinite(p.t) && p.t > 0)
  const up = x.curveUp.filter((p) => Number.isFinite(p.t) && p.t > 0)
  if (!pts.length) return
  const xMin = Math.log10(pts[0].I)
  const xMax = Math.log10(pts[pts.length - 1].I)
  const all = [...pts, ...up].map((p) => Math.log10(p.t))
  const yMin = Math.floor(Math.min(...all))
  const yMax = Math.ceil(Math.max(...all))
  const { sx, sy } = drawFrame(ctx, area, xMin, xMax, yMin, yMax, (v) => `${Math.round(10 ** v)} A`, (v) => `${(10 ** v).toPrecision(2)} s`, {
    xTitle: 'current through the relay',
    yTitle: 'operating time',
    yStep: 1,
  })
  const trace = (list, colour) => {
    ctx.strokeStyle = colour
    ctx.lineWidth = 2
    ctx.beginPath()
    list.forEach((p, k) => (k ? ctx.lineTo(sx(Math.log10(p.I)), sy(Math.log10(p.t))) : ctx.moveTo(sx(Math.log10(p.I)), sy(Math.log10(p.t)))))
    ctx.stroke()
  }
  trace(pts, COLORS.trace)
  trace(up, COLORS.spectrum)
  // The margin at the fault current, drawn as the gap it is.
  const fx = sx(Math.log10(x.I))
  ctx.strokeStyle = COLORS.marker
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(fx, sy(Math.log10(x.down)))
  ctx.lineTo(fx, sy(Math.log10(x.up.time)))
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = COLORS.marker
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`${(x.up.time - x.down).toFixed(3)} s of margin`, fx + 6, (sy(Math.log10(x.down)) + sy(Math.log10(x.up.time))) / 2)
  ctx.fillStyle = COLORS.trace
  ctx.fillText(`downstream, ${x.down.toFixed(3)} s here`, area.x + 8, area.y + 14)
  ctx.fillStyle = COLORS.spectrum
  ctx.fillText(`upstream, ${x.up.time.toFixed(3)} s here`, area.x + 8, area.y + 30)
}

function drawRX(ctx, w, h, x) {
  ctx.clearRect(0, 0, w, h)
  const area = plotArea(w, h)
  const reach = x.zones.zone2 * 1.4
  const { sx, sy } = drawFrame(ctx, area, -reach / 3, reach, -reach / 6, reach, (v) => `${v.toFixed(0)} Ω`, (v) => `${v.toFixed(0)} Ω`, {
    xTitle: 'resistance',
    yTitle: 'reactance',
    zeroLine: true,
  })
  // The two zone circles, centred on the origin as a plain impedance relay's
  // characteristic is.
  const circle = (r, colour, dash) => {
    ctx.strokeStyle = colour
    ctx.setLineDash(dash || [])
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.ellipse(sx(0), sy(0), Math.abs(sx(r) - sx(0)), Math.abs(sy(r) - sy(0)), 0, 0, 2 * Math.PI)
    ctx.stroke()
    ctx.setLineDash([])
  }
  circle(x.zones.zone1, COLORS.trace)
  circle(x.zones.zone2, COLORS.spectrum, [6, 4])
  // The line itself, drawn at a typical transmission angle so the fault points
  // sit on it rather than floating in the plane.
  const angle = Math.atan2(0.4, 0.05)
  const tip = { R: x.zones.Zline * Math.cos(angle), X: x.zones.Zline * Math.sin(angle) }
  ctx.strokeStyle = COLORS.axis
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(sx(0), sy(0))
  ctx.lineTo(sx(tip.R), sy(tip.X))
  ctx.stroke()
  const dot = (Z, colour, text) => {
    const px = sx(Z * Math.cos(angle))
    const py = sy(Z * Math.sin(angle))
    ctx.fillStyle = colour
    ctx.beginPath()
    ctx.arc(px, py, 4.5, 0, 2 * Math.PI)
    ctx.fill()
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(text, px + 8, py)
  }
  dot(x.zNo.Z, COLORS.textBright, `${x.zNo.Z.toFixed(1)} Ω without infeed`)
  if (Math.abs(x.z.Z - x.zNo.Z) > 1e-9) dot(x.z.Z, COLORS.marker, `${x.z.Z.toFixed(1)} Ω with infeed`)
  ctx.fillStyle = COLORS.trace
  ctx.textAlign = 'left'
  ctx.fillText(`zone 1, ${x.zones.zone1.toFixed(0)} Ω`, area.x + 8, area.y + 14)
  ctx.fillStyle = COLORS.spectrum
  ctx.fillText(`zone 2, ${x.zones.zone2.toFixed(0)} Ω`, area.x + 8, area.y + 30)
  ctx.fillStyle = COLORS.text
  ctx.fillText(x.zone.says, area.x + 8, area.y + area.h - 8)
}
