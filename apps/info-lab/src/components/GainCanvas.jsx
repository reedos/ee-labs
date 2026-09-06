import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'

// Two error rate curves, and the distance between them.
//
// This is not the Communications Lab's BER plot. That canvas draws one closed
// form as a line and its counted points as markers with their intervals, and
// its subject is the agreement between a count and a formula. This one draws
// two closed forms and measures the horizontal gap between them, which is what
// a coding gain is. It takes `limits` in the same shape that canvas takes it,
// `[{ ebN0Db, label }]`, so the two are one canvas the day a third lab wants
// both pictures (`NEEDS.md` §4).
//
// The vertical axis is logarithmic, because an error rate is read in decades.

/** The floor of the vertical axis. Below this the plot says nothing useful. */
export const FLOOR = 1e-8

/**
 * The picture as data: the two lines, the target row, the gain arrow between
 * the two curves at that row, and the crossing where they meet.
 */
export function sceneOf({ curve, limits = null, target = 1e-5, marks = null, width = 640, height = 320 }) {
  const area = plotArea(width, height, { topInset: 14 })
  const points = (curve && curve.points) || []
  if (!points.length) return { area, empty: true, uncoded: [], coded: [], limits: [], lo: FLOOR, hi: 1 }
  const clamp = (v) => Math.max(FLOOR, Math.min(1, v))
  const uncoded = points.map((q) => ({ x: q.ebN0Db, y: clamp(q.uncoded) }))
  const coded = points.map((q) => ({ x: q.ebN0Db, y: clamp(q.coded) }))
  const same = coded.every((q, i) => q.y === uncoded[i].y)
  const ys = [...uncoded, ...coded].map((q) => q.y)
  const lo = Math.max(FLOOR, 10 ** Math.floor(Math.log10(Math.min(...ys, target))))
  const hi = Math.min(1, 10 ** Math.ceil(Math.log10(Math.max(...ys))))
  const xLo = points[0].ebN0Db
  const xHi = points.at(-1).ebN0Db
  const decades = Math.log10(hi) - Math.log10(lo)
  const sx = (v) => area.x + ((v - xLo) / (xHi - xLo || 1)) * area.w
  const sy = (v) => area.y + area.h - ((Math.log10(clamp(v)) - Math.log10(lo)) / decades) * area.h
  return {
    area,
    empty: false,
    uncoded,
    coded: same ? [] : coded,
    limits: (limits || []).filter((l) => Number.isFinite(l.ebN0Db)),
    marks: (marks || []).filter((m) => Number.isFinite(m.ebN0Db)),
    target: target >= lo && target <= hi ? target : null,
    lo,
    hi,
    xLo,
    xHi,
    sx,
    sy,
  }
}

export default function GainCanvas({ curve = null, limits = null, target = 1e-5, marks = null, gain = null, height = 320 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const scene = sceneOf({ curve, limits, target, marks, width: w, height: h })
      if (scene.empty) return
      const { area, sx, sy } = scene
      drawFrame(ctx, area, scene.xLo, scene.xHi, Math.log10(scene.lo), Math.log10(scene.hi), (v) => v.toFixed(0), (v) => `1e${v.toFixed(0)}`, {
        xTitle: 'Eb/N0 (dB)',
        yTitle: 'Bit error rate',
        yStep: 1,
      })
      const k = area.k
      ctx.font = `${Math.round(10 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`

      // The limit, as a vertical line with its own label, so it cannot be read
      // as one more measurement.
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
        ctx.textAlign = 'left'
        ctx.fillText(l.label || 'limit', sx(l.ebN0Db) + 4, area.y + 12 * k)
      }

      // The row the gain is read along.
      if (scene.target) {
        ctx.strokeStyle = COLORS.grid
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(area.x, sy(scene.target))
        ctx.lineTo(area.x + area.w, sy(scene.target))
        ctx.stroke()
        ctx.setLineDash([])
      }

      const line = (points, colour) => {
        ctx.beginPath()
        points.forEach((q, i) => (i ? ctx.lineTo(sx(q.x), sy(q.y)) : ctx.moveTo(sx(q.x), sy(q.y))))
        ctx.strokeStyle = colour
        ctx.lineWidth = 2
        ctx.stroke()
      }
      line(scene.uncoded, COLORS.response)
      if (scene.coded.length) line(scene.coded, COLORS.trace)

      // The gain itself, as the arrow between the two curves along the target
      // row. The number is the thing the experiment is about, so it is drawn
      // where it is measured.
      if (gain && scene.target && Number.isFinite(gain.coded) && Number.isFinite(gain.uncoded)) {
        const y = sy(scene.target)
        const a = sx(gain.coded)
        const b = sx(gain.uncoded)
        ctx.strokeStyle = COLORS.marker
        ctx.fillStyle = COLORS.marker
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(a, y)
        ctx.lineTo(b, y)
        ctx.stroke()
        for (const [x, dir] of [
          [a, 1],
          [b, -1],
        ]) {
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x + dir * 6 * k, y - 4 * k)
          ctx.lineTo(x + dir * 6 * k, y + 4 * k)
          ctx.closePath()
          ctx.fill()
        }
        ctx.textAlign = 'center'
        ctx.fillText(`${gain.real >= 0 ? '' : '−'}${Math.abs(gain.real).toFixed(3)} dB`, (a + b) / 2, y - 8 * k)
      }

      // Where the two curves cross, which is where a code stops costing more
      // than it buys.
      for (const m of scene.marks) {
        const x = sx(m.ebN0Db)
        const y = sy(m.ber)
        ctx.strokeStyle = COLORS.spectrum
        ctx.fillStyle = COLORS.spectrum
        ctx.beginPath()
        ctx.arc(x, y, 4 * k, 0, 2 * Math.PI)
        ctx.stroke()
        ctx.textAlign = x > area.x + area.w * 0.7 ? 'right' : 'left'
        ctx.fillText(m.label || '', x + (x > area.x + area.w * 0.7 ? -6 : 6) * k, y - 8 * k)
      }

      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      ctx.fillText(scene.coded.length ? 'uncoded in blue, coded in green' : 'uncoded, with the limit at its own efficiency', area.x, area.y - 4 * k)
    },
    [JSON.stringify(curve && curve.points.length), JSON.stringify(limits), target, JSON.stringify(marks), JSON.stringify(gain), height, curve && curve.points[0] && curve.points[0].coded],
  )

  return <canvas ref={ref} className="gain-canvas" style={{ height }} role="img" aria-label="Bit error rate against energy per bit, with the coding gain marked" />
}
