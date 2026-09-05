import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'

/**
 * Two pictures of the machine on the grid.
 *
 * `pdelta` draws the three power curves against rotor angle, with the
 * accelerating area shaded from the starting angle to the clearing angle and
 * the decelerating area shaded from there to the angle the machine may not
 * pass. The two shaded areas are equal at the critical clearing angle, which
 * is what makes the picture the lesson.
 *
 * `rotor` draws the angle against time, with the clearing instant marked, the
 * peak marked, and the integrator's name and step in the corner. The step is
 * printed because it is a choice, and the guard that chose it is the energy
 * relation.
 */
export default function StabilityCanvas({ x, mode = 'pdelta', height = 300 }) {
  const ref = useCanvas((ctx, w, h) => (mode === 'rotor' ? drawRotor(ctx, w, h, x) : drawPdelta(ctx, w, h, x)), [x, mode])
  return <canvas ref={ref} className="plot" style={{ height }} />
}

const deg = (r) => (r * 180) / Math.PI

function drawPdelta(ctx, w, h, x) {
  ctx.clearRect(0, 0, w, h)
  const st = x.st
  const c = x.curves
  const area = plotArea(w, h)
  const yMax = Math.max(x.p.pre ?? 2, 2) * 1.1
  const { sx, sy } = drawFrame(ctx, area, 0, 180, 0, yMax, (v) => `${v.toFixed(0)}°`, (v) => v.toFixed(1), {
    xTitle: 'rotor angle',
    yTitle: 'power, pu',
  })
  const shade = (from, to, curve, colour) => {
    ctx.fillStyle = colour
    ctx.beginPath()
    ctx.moveTo(sx(deg(from)), sy(st.Pm))
    for (let d = from; d <= to; d += (to - from) / 60) ctx.lineTo(sx(deg(d)), sy(curve * Math.sin(d)))
    ctx.lineTo(sx(deg(to)), sy(st.Pm))
    ctx.closePath()
    ctx.fill()
  }
  if (!st.neverStable) {
    shade(st.delta0, st.deltaCr, x.p.during ?? 0.5, COLORS.spectrumDim)
    shade(st.deltaCr, st.deltaMax, x.p.post ?? 1.5, COLORS.traceGhost)
  }
  const curve = (values, colour, dash) => {
    ctx.strokeStyle = colour
    ctx.lineWidth = 2
    ctx.setLineDash(dash || [])
    ctx.beginPath()
    c.delta.forEach((d, k) => (k ? ctx.lineTo(sx(deg(d)), sy(values[k])) : ctx.moveTo(sx(deg(d)), sy(values[k]))))
    ctx.stroke()
    ctx.setLineDash([])
  }
  curve(c.pre, COLORS.trace)
  curve(c.post, COLORS.response, [6, 4])
  curve(c.during, COLORS.spectrum, [2, 4])
  ctx.strokeStyle = COLORS.textBright
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(area.x, sy(st.Pm))
  ctx.lineTo(area.x + area.w, sy(st.Pm))
  ctx.stroke()
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.textBright
  ctx.fillText('mechanical power', area.x + 8, sy(st.Pm) - 6)
  ctx.fillStyle = COLORS.trace
  ctx.fillText('before', area.x + 8, area.y + 14)
  ctx.fillStyle = COLORS.spectrum
  ctx.fillText('during', area.x + 58, area.y + 14)
  ctx.fillStyle = COLORS.response
  ctx.fillText('after', area.x + 112, area.y + 14)
  const mark = (angle, text, colour) => {
    ctx.strokeStyle = colour
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(sx(deg(angle)), area.y)
    ctx.lineTo(sx(deg(angle)), area.y + area.h)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = colour
    ctx.textAlign = 'center'
    ctx.fillText(text, sx(deg(angle)), area.y + area.h - 6)
  }
  mark(st.delta0, `${deg(st.delta0).toFixed(2)}°`, COLORS.text)
  if (!st.neverStable) mark(st.deltaCr, `critical ${deg(st.deltaCr).toFixed(3)}°`, COLORS.marker)
  mark(st.deltaMax, `${deg(st.deltaMax).toFixed(2)}°`, COLORS.text)
  ctx.textAlign = 'right'
  ctx.fillStyle = COLORS.text
  ctx.fillText(`each area ${st.areaAccel.toFixed(6)} pu·rad`, area.x + area.w - 8, area.y + 14)
}

function drawRotor(ctx, w, h, x) {
  ctx.clearRect(0, 0, w, h)
  const run = x.run
  const st = x.st
  const trace = run.trace
  if (!trace.length) return
  const area = plotArea(w, h)
  const tEnd = trace[trace.length - 1].t
  const angles = trace.map((r) => deg(r.delta))
  const yMax = Math.max(...angles, deg(st.deltaMax)) * 1.1
  const yMin = Math.min(...angles, 0)
  const { sx, sy } = drawFrame(ctx, area, 0, tEnd, yMin, yMax, (v) => `${v.toFixed(2)} s`, (v) => `${v.toFixed(0)}°`, {
    xTitle: 'time after the fault arrives',
    yTitle: 'rotor angle',
  })
  ctx.strokeStyle = COLORS.axis
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(area.x, sy(deg(st.deltaMax)))
  ctx.lineTo(area.x + area.w, sy(deg(st.deltaMax)))
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = COLORS.text
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`may not pass ${deg(st.deltaMax).toFixed(2)}°`, area.x + 8, sy(deg(st.deltaMax)) - 6)
  ctx.strokeStyle = COLORS.trace
  ctx.lineWidth = 2
  ctx.beginPath()
  trace.forEach((r, k) => (k ? ctx.lineTo(sx(r.t), sy(deg(r.delta))) : ctx.moveTo(sx(r.t), sy(deg(r.delta)))))
  ctx.stroke()
  // The clearing instant.
  ctx.strokeStyle = COLORS.marker
  ctx.beginPath()
  ctx.moveTo(sx(run.tc), area.y)
  ctx.lineTo(sx(run.tc), area.y + area.h)
  ctx.stroke()
  ctx.fillStyle = COLORS.marker
  ctx.fillText(`cleared at ${run.tc.toFixed(3)} s`, sx(run.tc) + 6, area.y + 14)
  if (run.stable) {
    ctx.fillStyle = COLORS.spectrum
    ctx.beginPath()
    ctx.arc(sx(run.peakAt), sy(deg(run.peak)), 4, 0, 2 * Math.PI)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.fillText(`${deg(run.peak).toFixed(4)}°`, sx(run.peakAt), sy(deg(run.peak)) - 10)
  }
  ctx.fillStyle = COLORS.text
  ctx.textAlign = 'right'
  ctx.fillText(run.says, area.x + area.w - 8, area.y + area.h - 8)
}
