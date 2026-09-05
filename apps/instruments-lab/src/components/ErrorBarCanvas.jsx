import React from 'react'
import { COLORS, fmt, useCanvas } from '@ee-labs/ui'
import { frameArea, trackText, SANS } from './timePlot.js'
import { HUE } from '../palette.js'

/**
 * The error bar: one horizontal axis in the reading's own units, and the four
 * numbers that stand between a value and what a display says about it.
 *
 *   the true value      what the circuit has, with no meter on it
 *   the reading         what the meter's own resistance leaves of it
 *   the display         that reading rounded to the meter's count
 *   the specification   the maker's band, drawn around the display
 *
 * Every one of them is `meter` from math.js, which is exact arithmetic over a
 * solve. Nothing here is computed a second time, so the bar cannot disagree
 * with the readings above it. The axis spans whatever the four need, padded,
 * so the specification band is drawn to scale rather than to fit.
 */
export default function ErrorBarCanvas({ meter, unit = 'V' }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      trackText(ctx)
      const area = frameArea(w, h, { rightAxis: false })
      const k = area.k
      const { true: truth, read, shown, spec } = meter
      const lo0 = Math.min(truth, read, shown - spec)
      const hi0 = Math.max(truth, read, shown + spec)
      const pad = Math.max((hi0 - lo0) * 0.35, Math.abs(truth) * 1e-9, 1e-15)
      const lo = lo0 - pad
      const hi = hi0 + pad
      const sx = (v) => area.x + ((v - lo) / (hi - lo)) * area.w
      const yAxis = area.y + area.h * 0.62

      // The axis itself, with its two ends written under it.
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(area.x, Math.round(yAxis) + 0.5)
      ctx.lineTo(area.x + area.w, Math.round(yAxis) + 0.5)
      ctx.stroke()
      ctx.font = `${Math.round(10 * k)}px ${SANS}`
      ctx.fillStyle = COLORS.text
      ctx.textBaseline = 'top'
      ctx.textAlign = 'left'
      ctx.fillText(fmt(lo, unit, 4), area.x, yAxis + 8 * k)
      ctx.textAlign = 'right'
      ctx.fillText(fmt(hi, unit, 4), area.x + area.w, yAxis + 8 * k)

      // The specification band around the display, drawn first so the marks sit on it.
      if (spec > 0) {
        const x0 = sx(shown - spec)
        const x1 = sx(shown + spec)
        ctx.fillStyle = HUE.power
        ctx.globalAlpha = 0.18
        ctx.fillRect(x0, yAxis - 26 * k, Math.max(1, x1 - x0), 52 * k)
        ctx.globalAlpha = 1
        ctx.strokeStyle = HUE.power
        ctx.lineWidth = 1.2 * k
        ctx.setLineDash([4 * k, 3 * k])
        for (const x of [x0, x1]) {
          ctx.beginPath()
          ctx.moveTo(Math.round(x) + 0.5, yAxis - 26 * k)
          ctx.lineTo(Math.round(x) + 0.5, yAxis + 26 * k)
          ctx.stroke()
        }
        ctx.setLineDash([])
      }

      // One tick per number, each labelled above or below so two close marks
      // never write over each other.
      const marks = [
        { v: truth, label: 'true', text: fmt(truth, unit, 5), color: COLORS.textBright, up: true },
        { v: read, label: 'reading', text: fmt(read, unit, 5), color: HUE.voltage, up: false },
        { v: shown, label: 'display', text: fmt(shown, unit, 5), color: HUE.current, up: true },
      ]
      ctx.lineWidth = 2 * k
      marks.forEach((m, i) => {
        const x = sx(m.v)
        ctx.strokeStyle = m.color
        ctx.beginPath()
        ctx.moveTo(Math.round(x) + 0.5, yAxis - 18 * k)
        ctx.lineTo(Math.round(x) + 0.5, yAxis + 18 * k)
        ctx.stroke()
        ctx.fillStyle = m.color
        ctx.textAlign = x > area.x + area.w * 0.85 ? 'right' : x < area.x + area.w * 0.15 ? 'left' : 'center'
        // Alternate above and below, and give the second row of each side its own line.
        const dy = m.up ? -22 * k - (i === 2 ? 14 * k : 0) : 24 * k
        ctx.textBaseline = m.up ? 'bottom' : 'top'
        ctx.fillText(`${m.label} ${m.text}`, x, yAxis + dy)
      })

      if (spec > 0) {
        ctx.fillStyle = HUE.power
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(`±${fmt(spec, unit, 3)} specified`, sx(shown), yAxis + 40 * k)
      }
    },
    [meter, unit],
  )
  return <canvas ref={ref} className="plot errorbar" role="img" aria-label="Error bar: the true value, the reading, the display and the specified band around it" />
}
