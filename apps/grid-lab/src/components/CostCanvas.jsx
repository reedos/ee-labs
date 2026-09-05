import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'

/**
 * Two plots that are one shape: a quantity against a knob, with the answer
 * marked on it.
 *
 * `cost` draws each unit's incremental cost against its output, with the
 * common multiplier as one horizontal line across all three. Where each curve
 * crosses that line is that unit's share, which is the whole of what equal
 * incremental cost means.
 *
 * `lineplot` draws the open-end voltage rise against line length, exact and
 * lumped, with the guard's threshold marked. The two curves separate where the
 * guard says they do, which is the claim C3 makes.
 */
export default function CostCanvas({ x, mode = 'cost', height = 300 }) {
  const ref = useCanvas((ctx, w, h) => (mode === 'lineplot' ? drawLine(ctx, w, h, x) : drawCost(ctx, w, h, x)), [x, mode])
  return <canvas ref={ref} className="plot" style={{ height }} />
}

const COLOURS = [COLORS.trace, COLORS.spectrum, COLORS.response]

function drawCost(ctx, w, h, x) {
  ctx.clearRect(0, 0, w, h)
  const curves = x.curves
  const area = plotArea(w, h)
  const pMax = Math.max(...curves.map((c) => c.P[c.P.length - 1]))
  const all = curves.flatMap((c) => c.incremental)
  const { sx, sy } = drawFrame(ctx, area, 0, pMax, Math.min(...all), Math.max(...all), (v) => `${v.toFixed(0)}`, (v) => `${v.toFixed(1)}`, {
    xTitle: 'unit output, MW',
    yTitle: 'incremental cost, $/MWh',
  })
  curves.forEach((c, k) => {
    ctx.strokeStyle = COLOURS[k % COLOURS.length]
    ctx.lineWidth = 2
    ctx.beginPath()
    c.P.forEach((p, i) => (i ? ctx.lineTo(sx(p), sy(c.incremental[i])) : ctx.moveTo(sx(p), sy(c.incremental[i]))))
    ctx.stroke()
    const u = x.d.units[k]
    ctx.fillStyle = COLOURS[k % COLOURS.length]
    ctx.beginPath()
    ctx.arc(sx(u.P), sy(u.incremental), 4.5, 0, 2 * Math.PI)
    ctx.fill()
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${u.name}, ${u.P.toFixed(1)} MW${u.limited ? ' at its limit' : ''}`, area.x + 8, area.y + 14 + 16 * k)
  })
  ctx.strokeStyle = COLORS.textBright
  ctx.lineWidth = 1
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.moveTo(area.x, sy(x.d.lambda))
  ctx.lineTo(area.x + area.w, sy(x.d.lambda))
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = COLORS.textBright
  ctx.textAlign = 'right'
  ctx.fillText(`λ = ${x.d.lambda.toFixed(5)} $/MWh`, area.x + area.w - 8, sy(x.d.lambda) - 6)
}

function drawLine(ctx, w, h, x) {
  ctx.clearRect(0, 0, w, h)
  const area = plotArea(w, h)
  const lengths = []
  for (let km = 40; km <= 900; km += 10) lengths.push(km)
  const exact = lengths.map((km) => 1 / Math.cos(x.rise.betaL * (km / x.km)))
  const nominal = lengths.map((km) => {
    const bl = x.rise.betaL * (km / x.km)
    return 1 / (1 - (bl * bl) / 2)
  })
  const yMax = Math.min(3, Math.max(...exact.filter((v) => v > 0 && v < 5)))
  const { sx, sy } = drawFrame(ctx, area, lengths[0], lengths[lengths.length - 1], 1, yMax, (v) => `${v.toFixed(0)} km`, (v) => v.toFixed(2), {
    xTitle: 'line length',
    yTitle: 'open-end rise',
  })
  const trace = (values, colour, dash) => {
    ctx.strokeStyle = colour
    ctx.lineWidth = 2
    ctx.setLineDash(dash || [])
    ctx.beginPath()
    let started = false
    values.forEach((v, k) => {
      if (!(v > 0) || v > yMax) {
        started = false
        return
      }
      const px = sx(lengths[k])
      const py = sy(v)
      if (!started) {
        ctx.moveTo(px, py)
        started = true
      } else ctx.lineTo(px, py)
    })
    ctx.stroke()
    ctx.setLineDash([])
  }
  trace(exact, COLORS.trace)
  trace(nominal, COLORS.spectrum, [6, 4])
  ctx.strokeStyle = COLORS.marker
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(sx(250), area.y)
  ctx.lineTo(sx(250), area.y + area.h)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = COLORS.marker
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('250 km, where the model changes', sx(250) + 6, area.y + 14)
  ctx.fillStyle = COLORS.trace
  ctx.fillText('exact', area.x + 8, area.y + 14)
  ctx.fillStyle = COLORS.spectrum
  ctx.fillText('lumped π', area.x + 52, area.y + 14)
  // Where the reader is standing.
  ctx.fillStyle = COLORS.textBright
  ctx.beginPath()
  ctx.arc(sx(x.km), sy(Math.min(yMax, x.rise.exact)), 4.5, 0, 2 * Math.PI)
  ctx.fill()
  ctx.textAlign = 'right'
  ctx.fillText(`${x.km} km, rise ${x.rise.exact.toFixed(5)}`, area.x + area.w - 8, area.y + area.h - 8)
}
