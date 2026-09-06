import React from 'react'
import { useCanvas, COLORS, plotArea, drawFrame } from '@ee-labs/ui'

// The bit error rate plot.
//
// This canvas stays in the app under PROGRAM.md §4, because only one other lab
// claims it and that lab is not built. It takes `limits` from the first commit,
// which is where the Information Lab draws the Shannon limit, so the hand-over
// is a prop rather than a fork.
//
// One rule governs the drawing, from COMMUNICATIONS_LAB_PLAN.md §2.8. The
// closed form is a LINE and the count is a MARKER. They are never one series.
// A point resting on fewer than the stated error count is drawn hollow, and the
// readout beside it gives the interval rather than the value, because at that
// count the interval spans a factor of two.

/** The floor of the vertical axis. Below this the plot says nothing useful. */
export const FLOOR = 1e-8

/**
 * The geometry the plot draws, as data.
 *
 * Returns the line the closed form traces, the markers the counts sit at with
 * their interval bars, and the vertical range that holds all of them. A test
 * measures this rather than a second copy of the arithmetic.
 */
export function sceneOf({ curve, limits = null, hollowBelow = 30 }) {
  if (!curve || !curve.points.length) return { line: [], markers: [], limits: [], lo: FLOOR, hi: 1, xLo: 0, xHi: 1 }
  const line = curve.points.map((p) => ({ x: p.ebN0Db, y: Math.max(FLOOR, p.closed) }))
  const markers = curve.points
    .filter((p) => p.counted)
    .map((p) => ({
      x: p.ebN0Db,
      y: Math.max(FLOOR, p.counted.value),
      lo: Math.max(FLOOR, p.counted.ci[0]),
      hi: Math.max(FLOOR, p.counted.ci[1]),
      errors: p.counted.errors,
      hollow: p.counted.errors < hollowBelow,
    }))
  let lo = 1
  let hi = FLOOR
  for (const q of [...line, ...markers]) {
    lo = Math.min(lo, q.y)
    hi = Math.max(hi, q.y)
  }
  for (const m of markers) {
    lo = Math.min(lo, m.lo)
    hi = Math.max(hi, m.hi)
  }
  lo = Math.max(FLOOR, 10 ** Math.floor(Math.log10(lo)))
  hi = Math.min(1, 10 ** Math.ceil(Math.log10(hi)))
  return {
    line,
    markers,
    limits: (limits || []).filter((l) => Number.isFinite(l.ebN0Db)),
    lo,
    hi,
    xLo: curve.points[0].ebN0Db,
    xHi: curve.points.at(-1).ebN0Db,
    counted: markers.length,
    countTo: curve.countTo,
  }
}

export default function BerCanvas({ curve = null, limits = null, hollowBelow = 30, label = '', height = 320 }) {
  const scene = sceneOf({ curve, limits, hollowBelow })

  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const area = plotArea(w, h, { topInset: 18 })
      if (!scene.line.length) {
        ctx.fillStyle = COLORS.text
        ctx.font = '13px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.fillText('Load an experiment with an error rate', w / 2, h / 2)
        return
      }
      const decades = Math.log10(scene.hi) - Math.log10(scene.lo)
      const sx = (v) => area.x + ((v - scene.xLo) / (scene.xHi - scene.xLo || 1)) * area.w
      const sy = (v) =>
        area.y + area.h - ((Math.log10(Math.max(FLOOR, v)) - Math.log10(scene.lo)) / decades) * area.h

      drawFrame(
        ctx,
        area,
        scene.xLo,
        scene.xHi,
        Math.log10(scene.lo),
        Math.log10(scene.hi),
        (v) => `${v.toFixed(0)}`,
        (v) => `1e${v.toFixed(0)}`,
        { xTitle: 'Eb/N0 (dB)', yTitle: 'Bit error rate', yStep: 1 },
      )

      // Where the Information Lab draws its limit. A vertical line with its own
      // label, so it cannot be read as one more measurement.
      for (const l of scene.limits) {
        ctx.strokeStyle = COLORS.phase
        ctx.lineWidth = 1.5
        ctx.setLineDash([5, 4])
        ctx.beginPath()
        ctx.moveTo(sx(l.ebN0Db) + 0.5, area.y)
        ctx.lineTo(sx(l.ebN0Db) + 0.5, area.y + area.h)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = COLORS.phase
        ctx.font = `${Math.round(10 * area.k)}px ui-monospace, monospace`
        ctx.textAlign = 'left'
        ctx.fillText(l.label || 'limit', sx(l.ebN0Db) + 4, area.y + 12 * area.k)
      }

      // The closed form, as a line.
      ctx.strokeStyle = COLORS.response
      ctx.lineWidth = 2
      ctx.beginPath()
      scene.line.forEach((q, i) => {
        const px = sx(q.x)
        const py = sy(q.y)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()

      // The counts, as markers with their intervals.
      for (const m of scene.markers) {
        const px = sx(m.x)
        ctx.strokeStyle = COLORS.trace
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(px, sy(m.lo))
        ctx.lineTo(px, sy(m.hi))
        ctx.moveTo(px - 4 * area.k, sy(m.lo))
        ctx.lineTo(px + 4 * area.k, sy(m.lo))
        ctx.moveTo(px - 4 * area.k, sy(m.hi))
        ctx.lineTo(px + 4 * area.k, sy(m.hi))
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(px, sy(m.y), 4 * area.k, 0, 2 * Math.PI)
        if (m.hollow) {
          ctx.strokeStyle = COLORS.marker
          ctx.stroke()
        } else {
          ctx.fillStyle = COLORS.trace
          ctx.fill()
        }
      }

      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, monospace`
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      ctx.fillText(
        `${label ? `${label} · ` : ''}line is the closed form · markers are counted to ${scene.countTo} dB`,
        area.x,
        area.y - 6 * area.k,
      )
      const hollow = scene.markers.filter((m) => m.hollow).length
      if (hollow) {
        ctx.textAlign = 'right'
        ctx.fillStyle = COLORS.marker
        ctx.fillText(`${hollow} point${hollow > 1 ? 's' : ''} under ${hollowBelow} errors, drawn hollow`, area.x + area.w, area.y - 6 * area.k)
      }
    },
    [curve, limits, hollowBelow, label, scene.markers.length, scene.lo, scene.hi],
  )

  return (
    <canvas
      ref={ref}
      className="canvas ber"
      style={{ width: '100%', height }}
      role="img"
      aria-label={`Bit error rate: a closed form and ${scene.markers.length} counted points`}
    />
  )
}
