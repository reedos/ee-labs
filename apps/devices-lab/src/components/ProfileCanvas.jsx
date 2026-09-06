import React from 'react'
import { COLORS, drawFrame, fmt, plotArea, useCanvas } from '@ee-labs/ui'

/**
 * The one-dimensional profile view: one or more scalars against one position
 * axis, with the region boundaries marked, and a bias knob that redraws all
 * three.
 *
 * This is the shape the Fields Lab's field map is being given a `mode:
 * 'profile'` for, and the props here are the ones that overseer was sent. It
 * lives in this app until that canvas lands, and `NEEDS.md` carries the merge.
 *
 * Props:
 *   traces  [{ label, unit, at(x) -> value, colour }]  each a scalar of x
 *   from,to the position range, in metres
 *   edges   positions to mark with a vertical rule, in metres
 *   caption a line under the stack, naming the model and the bias
 */
export default function ProfileCanvas({ traces, from, to, edges = [], caption = '', className = '' }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!traces || !traces.length || !(to > from)) return
      const capH = caption ? 18 : 0
      const each = (h - capH) / traces.length
      const nm = 1e9
      traces.forEach((t, i) => {
        const top = i * each
        const area = plotArea(w, each, {})
        area.y += top
        // Sample the scalar across the axis, and frame it on what it reaches.
        const N = 401
        const xs = new Float64Array(N)
        const ys = new Float64Array(N)
        for (let k = 0; k < N; k++) {
          xs[k] = from + ((to - from) * k) / (N - 1)
          ys[k] = t.at(xs[k])
        }
        let lo = Math.min(0, ...ys)
        let hi = Math.max(0, ...ys)
        if (hi - lo < 1e-30) hi = lo + 1
        const span = hi - lo
        lo -= 0.08 * span
        hi += 0.08 * span
        const sx = (v) => area.x + ((v * nm - from * nm) / ((to - from) * nm)) * area.w
        const sy = (v) => area.y + area.h - ((v - lo) / (hi - lo)) * area.h
        drawFrame(ctx, area, from * nm, to * nm, lo, hi, (v) => v.toFixed(0), (v) => fmt(v, '', 2), {
          zeroLine: true,
          xTitle: i === traces.length - 1 ? 'position x (nm)' : null,
          yTitle: `${t.label} (${t.unit})`,
        })
        // The region edges, so the reader can see which part of the picture the
        // model is describing.
        ctx.save()
        ctx.strokeStyle = COLORS.marker
        ctx.setLineDash([3, 3])
        ctx.lineWidth = 1
        for (const e of edges) {
          if (e < from || e > to) continue
          ctx.beginPath()
          ctx.moveTo(sx(e), area.y)
          ctx.lineTo(sx(e), area.y + area.h)
          ctx.stroke()
        }
        ctx.restore()
        ctx.save()
        ctx.strokeStyle = t.colour || COLORS.trace
        ctx.lineWidth = 1.8
        ctx.beginPath()
        for (let k = 0; k < N; k++) {
          const px = sx(xs[k])
          const py = sy(ys[k])
          if (k === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
        ctx.restore()
      })
      if (caption) {
        ctx.fillStyle = COLORS.text
        ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
        ctx.textBaseline = 'bottom'
        ctx.fillText(caption, 8, h - 4)
      }
    },
    [traces, from, to, edges, caption],
  )
  return <canvas ref={ref} className={`profile-canvas ${className}`} aria-label="Charge density, field and potential against position" />
}
