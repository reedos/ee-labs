import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'

/**
 * Two pictures of the power flow itself.
 *
 * `newton` plots the mismatch against the iteration that produced it, on a
 * logarithmic axis. A straight line on that axis is linear convergence, and
 * the curve bending downwards is the quadratic convergence D3 claims. The
 * iteration where a bus changed type is marked, because the change costs one
 * pass of that curvature.
 *
 * `pvcurve` plots the low bus voltage against loading, to the last loading
 * that has a solution. It stops where the solver stops, and the pane says so
 * rather than extrapolating a curve past its own nose.
 */
export default function FlowCanvas({ x, mode = 'newton', height = 300 }) {
  const ref = useCanvas((ctx, w, h) => (mode === 'newton' ? drawNewton(ctx, w, h, x) : drawNose(ctx, w, h, x)), [x, mode])
  return <canvas ref={ref} className="plot" style={{ height }} />
}

function drawNewton(ctx, w, h, x) {
  ctx.clearRect(0, 0, w, h)
  if (!x.sol) return
  const m = x.sol.mismatches.map((v) => Math.max(v, 1e-16))
  const area = plotArea(w, h)
  const yMax = Math.ceil(Math.log10(Math.max(...m)))
  const yMin = Math.floor(Math.log10(Math.min(...m)))
  const { sx, sy } = drawFrame(ctx, area, 0, Math.max(1, m.length - 1), yMin, yMax, (v) => (Number.isInteger(v) ? `${v}` : ''), (v) => `10${sup(v)}`, {
    xTitle: 'iteration',
    yTitle: 'mismatch, pu',
    yStep: 1,
    xStep: 1,
  })
  ctx.strokeStyle = COLORS.trace
  ctx.lineWidth = 2
  ctx.beginPath()
  m.forEach((v, k) => {
    const px = sx(k)
    const py = sy(Math.log10(v))
    if (k === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.stroke()
  ctx.fillStyle = COLORS.trace
  m.forEach((v, k) => {
    ctx.beginPath()
    ctx.arc(sx(k), sy(Math.log10(v)), 3.5, 0, 2 * Math.PI)
    ctx.fill()
  })
  // The tolerance the walk stops on, drawn as the floor it is.
  ctx.strokeStyle = COLORS.axis
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(area.x, sy(-12))
  ctx.lineTo(area.x + area.w, sy(-12))
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = COLORS.text
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('tolerance, 10⁻¹² pu', area.x + 6, sy(-12) - 5)
  for (const c of x.sol.conversions) {
    const px = sx(c.iteration)
    ctx.strokeStyle = COLORS.marker
    ctx.beginPath()
    ctx.moveTo(px, area.y)
    ctx.lineTo(px, area.y + area.h)
    ctx.stroke()
    ctx.fillStyle = COLORS.marker
    ctx.fillText(`${c.bus} became a PQ bus`, px + 5, area.y + 14)
  }
}

const SUPS = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }
const sup = (v) => String(Math.round(v)).split('').map((c) => SUPS[c] || c).join('')

function drawNose(ctx, w, h, x) {
  ctx.clearRect(0, 0, w, h)
  const pts = x.nose ? x.nose.points : []
  if (!pts.length) return
  const area = plotArea(w, h)
  const xMax = Math.max(...pts.map((p) => p.alpha))
  const { sx, sy } = drawFrame(ctx, area, pts[0].alpha, xMax, 0.4, 1.02, (v) => v.toFixed(1), (v) => v.toFixed(2), {
    xTitle: 'loading, multiples of the base case',
    yTitle: 'bus 3 magnitude, pu',
  })
  ctx.strokeStyle = COLORS.trace
  ctx.lineWidth = 2
  ctx.beginPath()
  pts.forEach((p, k) => (k ? ctx.lineTo(sx(p.alpha), sy(p.V)) : ctx.moveTo(sx(p.alpha), sy(p.V))))
  ctx.stroke()
  const last = pts[pts.length - 1]
  ctx.fillStyle = COLORS.marker
  ctx.beginPath()
  ctx.arc(sx(last.alpha), sy(last.V), 4, 0, 2 * Math.PI)
  ctx.fill()
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`last loading with a solution, ${last.alpha.toFixed(2)}×`, sx(last.alpha) - 8, sy(last.V) - 8)
  // Where the reader is standing now.
  const here = x.sol ? x.sol.byId.bus3 : null
  if (here) {
    ctx.fillStyle = COLORS.spectrum
    ctx.beginPath()
    ctx.arc(sx(x.p.load), sy(here.V), 4, 0, 2 * Math.PI)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.fillText('this loading', sx(x.p.load) + 8, sy(here.V) - 8)
  }
}
