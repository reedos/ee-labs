import React from 'react'
import { COLORS, useCanvas } from '@ee-labs/ui'

/**
 * One radix-2 butterfly, drawn.
 *
 * X = a + W b and Y = a - W b, with W = e^{-j 2 pi k / N}. Two complex additions
 * and one complex multiply produce two outputs, and the whole transform is that
 * repeated (N/2) log2 N times. The picture exists because the arithmetic is four
 * numbers and two operations, and a reader who has seen it once can count the
 * cost of the transform for themselves.
 *
 * The inputs are fixed at 1 and 1 so the outputs are 1 + W and 1 - W, which is
 * the twiddle read straight off the drawing.
 */
const fmt = (z) => {
  const r = Math.abs(z[0]) < 1e-12 ? 0 : z[0]
  const i = Math.abs(z[1]) < 1e-12 ? 0 : z[1]
  const sign = i < 0 ? '-' : '+'
  return `${r.toFixed(3)} ${sign} ${Math.abs(i).toFixed(3)}j`
}

export default function ButterflyCanvas({ a, b, out, twiddle, k, n }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      ctx.font = '12px system-ui, sans-serif'
      ctx.textBaseline = 'middle'

      const left = 96
      const right = w - 110
      const midX = (left + right) / 2
      const yTop = h * 0.34
      const yBot = h * 0.68

      const line = (x1, y1, x2, y2, colour) => {
        ctx.strokeStyle = colour
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }
      const node = (x, y) => {
        ctx.fillStyle = COLORS.trace
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, 2 * Math.PI)
        ctx.fill()
      }

      // The straight path carries a, the crossing paths carry W b.
      line(left, yTop, right, yTop, COLORS.trace)
      line(left, yBot, midX, yBot, COLORS.spectrum)
      line(midX, yBot, right, yTop, COLORS.spectrum)
      line(midX, yBot, right, yBot, COLORS.spectrum)
      line(left, yTop, right, yBot, COLORS.trace)

      // The twiddle multiply sits on the lower path, before it splits.
      ctx.strokeStyle = COLORS.marker
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(midX, yBot, 11, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.fillStyle = COLORS.marker
      ctx.textAlign = 'center'
      ctx.fillText('W', midX, yBot)

      node(left, yTop)
      node(left, yBot)
      node(right, yTop)
      node(right, yBot)

      ctx.fillStyle = COLORS.textBright
      ctx.textAlign = 'right'
      ctx.fillText(`a = ${fmt(a)}`, left - 10, yTop)
      ctx.fillText(`b = ${fmt(b)}`, left - 10, yBot)
      ctx.textAlign = 'left'
      ctx.fillText(`X = ${fmt(out.x)}`, right + 10, yTop)
      ctx.fillText(`Y = ${fmt(out.y)}`, right + 10, yBot)

      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      const deg = (Math.atan2(twiddle[1], twiddle[0]) * 180) / Math.PI
      ctx.fillText(`k = ${k} of N = ${n}`, 12, 20)
      ctx.fillText(`W = ${fmt(twiddle)}, ${deg.toFixed(1)} degrees`, 12, 38)
      ctx.fillText('X = a + W b, Y = a - W b', 12, h - 16)
    },
    [a, b, out, twiddle, k, n],
  )
  return <canvas ref={ref} className="plot" />
}
