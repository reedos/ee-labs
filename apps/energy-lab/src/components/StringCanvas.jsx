/**
 * Every cell of a string, each showing its own junction voltage read off the
 * solved circuit (`analysis.js`'s `cellRows`). A series string carries one
 * current and its junctions land where they must, so this is the one view
 * that makes shading legible: a cell driven backwards draws its bar the
 * other way, in the warn colour, with its dissipation printed beside it.
 */
import React, { useMemo } from 'react'
import { COLORS, useCanvas, fmt } from '@ee-labs/ui'

export default function StringCanvas({ x, height = 260 }) {
  const rows = x && x.cells ? x.cells : []

  const plan = useMemo(() => {
    if (!rows.length) return null
    const vMax = Math.max(0.1, ...rows.map((r) => Math.abs(r.v))) * 1.15
    return { vMax }
  }, [rows])

  const draw = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    if (!plan) return
    const n = rows.length
    const rowH = h / n
    const midX = w * 0.42
    const barMax = w * 0.5
    const zero = plan.vMax > 0 ? (v) => (v / plan.vMax) * barMax : () => 0
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
    rows.forEach((r, i) => {
      const y = i * rowH
      const barW = zero(r.v)
      const color = r.reverse ? COLORS.marker : r.shaded ? COLORS.spectrum : COLORS.trace
      ctx.fillStyle = color
      ctx.globalAlpha = 0.85
      const x0 = midX
      const x1 = midX + barW
      ctx.fillRect(Math.min(x0, x1), y + rowH * 0.2, Math.abs(barW), rowH * 0.6)
      ctx.globalAlpha = 1
      // The cell index, on the left.
      ctx.textAlign = 'right'
      ctx.fillStyle = COLORS.text
      ctx.fillText(`cell ${r.k}`, midX - 8, y + rowH * 0.55)
      // Its own voltage, past the bar's end.
      ctx.textAlign = barW >= 0 ? 'left' : 'right'
      ctx.fillStyle = r.reverse ? COLORS.marker : COLORS.textBright
      ctx.fillText(fmt(r.v, 'V', 3), x1 + (barW >= 0 ? 6 : -6), y + rowH * 0.55)
      if (r.bypass) {
        ctx.textAlign = 'left'
        ctx.fillStyle = COLORS.text
        ctx.fillText(`bypass ${fmt(r.bypass.i, 'A', 3)}`, midX + barMax + 70, y + rowH * 0.55)
      }
    })
    // The centre line, where every cell's own bar starts.
    ctx.strokeStyle = COLORS.axis
    ctx.beginPath()
    ctx.moveTo(midX + 0.5, 0)
    ctx.lineTo(midX + 0.5, h)
    ctx.stroke()
  }

  const ref = useCanvas(draw, [plan, rows.length, height])
  if (!plan) return null
  return (
    <div className="plot" data-role="string">
      <canvas ref={ref} style={{ width: '100%', height: `${Math.max(height, rows.length * 22)}px` }} />
    </div>
  )
}
