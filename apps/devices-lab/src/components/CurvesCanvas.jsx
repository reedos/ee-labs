import React from 'react'
import { COLORS, drawFrame, fmt, plotArea, useCanvas } from '@ee-labs/ui'

/**
 * The device curves, in two shapes.
 *
 * For a MOSFET it is I_D against V_DS at four gate voltages, with the pinch-off
 * locus and the operating point marked. For a solar cell it is the I–V curve
 * and the power against voltage on the same axis, with the maximum power point
 * marked, because the point of that view is where the two peak against each
 * other.
 */
export default function CurvesCanvas({ fet, pv, className = '' }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const area = plotArea(w, h, {})
      if (fet) drawFet(ctx, area, fet)
      else if (pv) drawCell(ctx, area, pv)
    },
    [fet, pv],
  )
  return <canvas ref={ref} className={`curves-canvas ${className}`} aria-label="The current against the voltage that controls it" />
}

function drawFet(ctx, area, fet) {
  const family = fet.family
  const xMax = family[0].vds[family[0].vds.length - 1]
  const yMax = Math.max(1e-12, ...family.map((f) => f.id[f.id.length - 1])) * 1.15
  const sx = (v) => area.x + (v / xMax) * area.w
  const sy = (v) => area.y + area.h - (v / yMax) * area.h
  drawFrame(ctx, area, 0, xMax, 0, yMax, (v) => v.toFixed(1), (v) => fmt(v * 1e6, '', 3), {
    xTitle: 'drain voltage V_DS (V)',
    yTitle: 'drain current I_D (µA)',
  })
  family.forEach((f, i) => {
    ctx.strokeStyle = i === family.length - 1 ? COLORS.trace : COLORS.traceDim
    ctx.lineWidth = i === family.length - 1 ? 2 : 1.4
    ctx.beginPath()
    for (let k = 0; k < f.vds.length; k++) {
      const px = sx(f.vds[k])
      const py = sy(f.id[k])
      if (k === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  })
  // The pinch-off locus: where each curve leaves triode.
  ctx.strokeStyle = COLORS.spectrum
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  family.forEach((f, i) => {
    const vov = f.vgs - fet.vt
    if (vov <= 0) return
    const px = sx(Math.min(vov, xMax))
    const py = sy(0.5 * fet.kn * vov * vov)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.stroke()
  ctx.setLineDash([])
  // The operating point.
  ctx.fillStyle = COLORS.marker
  ctx.beginPath()
  ctx.arc(sx(Math.min(fet.vds, xMax)), sy(fet.id), 4, 0, 2 * Math.PI)
  ctx.fill()
  ctx.font = `${Math.round(10 * area.k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
  ctx.textBaseline = 'top'
  ctx.fillStyle = COLORS.text
  ctx.fillText(`${fet.region} · gradual-channel model`, area.x + 8, area.y + 6)
}

function drawCell(ctx, area, pv) {
  const { curve, voc, vmp, imp, pmax, isc } = pv
  const yMax = Math.max(isc, pmax / Math.max(vmp, 1e-9)) * 1.15
  const sx = (v) => area.x + (v / voc) * area.w
  const sy = (v) => area.y + area.h - (v / yMax) * area.h
  const sp = (v) => area.y + area.h - (v / (pmax * 1.3)) * area.h
  drawFrame(ctx, area, 0, voc, 0, yMax, (v) => v.toFixed(2), (v) => fmt(v * 1e3, '', 3), {
    xTitle: 'cell voltage (V)',
    yTitle: 'current (mA), power drawn as a second trace',
  })
  ctx.strokeStyle = COLORS.trace
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let k = 0; k < curve.v.length; k++) {
    const px = sx(curve.v[k])
    const py = sy(curve.i[k])
    if (k === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.strokeStyle = COLORS.spectrum
  ctx.lineWidth = 1.6
  ctx.beginPath()
  for (let k = 0; k < curve.v.length; k++) {
    const px = sx(curve.v[k])
    const py = sp(curve.w[k])
    if (k === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  // The maximum power point, and the rectangle whose area is the fill factor.
  ctx.strokeStyle = COLORS.marker
  ctx.setLineDash([3, 3])
  ctx.strokeRect(sx(0), sy(imp), sx(vmp) - sx(0), sy(0) - sy(imp))
  ctx.setLineDash([])
  ctx.fillStyle = COLORS.marker
  ctx.beginPath()
  ctx.arc(sx(vmp), sy(imp), 4, 0, 2 * Math.PI)
  ctx.fill()
  ctx.font = `${Math.round(10 * area.k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
  ctx.textBaseline = 'top'
  ctx.fillStyle = COLORS.spectrum
  ctx.fillText('power, scaled to its own peak', area.x + 8, area.y + 6)
}
