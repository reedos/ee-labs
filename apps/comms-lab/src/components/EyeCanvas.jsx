import React from 'react'
import { useCanvas, COLORS, plotArea, drawFrame, fmtNum } from '@ee-labs/ui'
import { KEY_COLORS } from './ConstellationCanvas.jsx'

// The eye diagram: two symbol periods of a long stream, overlaid.
//
// A new canvas under PROGRAM.md §4, whose second lab is the Mixed-Signal Lab.
// Two props exist for that lab and are here from the first commit.
//
//   traceKey   number[] | null   a value per trace, so each trace takes its
//                                colour from a clock phase rather than from
//                                nothing. The converter's eye is read that way.
//   unitLabel  string            what the vertical axis is measured in. This
//                                lab leaves it empty, because a normalised
//                                symbol has no unit. A converter's eye reads in
//                                volts, and the axis says so.

/** Past this many traces the picture is a smear rather than an eye. */
export const MAX_TRACES = 200

/**
 * Cut one buffer into traces of two symbol periods.
 *
 * The first `skip` symbols are dropped, because the shaping filter's own
 * transient is not an eye. What comes back is a list of equal-length rows the
 * canvas draws one over another.
 */
export function tracesOf({ buffer, sps, skip = 8, max = MAX_TRACES }) {
  if (!buffer || buffer.length < 2 * sps) return []
  const width = 2 * sps
  const start = skip * sps
  const rows = []
  for (let i = start; i + width <= buffer.length && rows.length < max; i += sps) {
    rows.push(buffer.subarray(i, i + width))
  }
  return rows
}

/**
 * What the eye measures: the opening at the decision instant, and the width of
 * the region where the traces cross zero.
 *
 * The opening is the gap between the lowest positive trace and the highest
 * negative one at the instant. The width is how much of the symbol the crossings
 * are spread over, which is the timing error the eye can absorb.
 */
export function openingOf({ rows, sps, at = 0 }) {
  if (!rows.length) return { height: 0, width: 0, upper: 0, lower: 0 }
  const centre = Math.round(sps + at * sps)
  let upperLow = Infinity
  let lowerHigh = -Infinity
  for (const row of rows) {
    const v = row[Math.max(0, Math.min(row.length - 1, centre))]
    if (v > 0) upperLow = Math.min(upperLow, v)
    else lowerHigh = Math.max(lowerHigh, v)
  }
  if (!Number.isFinite(upperLow)) upperLow = 0
  if (!Number.isFinite(lowerHigh)) lowerHigh = 0
  // Where each trace crosses zero, over the middle of the window.
  let first = Infinity
  let last = -Infinity
  for (const row of rows) {
    for (let i = 1; i < row.length; i++) {
      if (row[i - 1] === 0 || row[i - 1] * row[i] < 0) {
        const t = i - 1 + Math.abs(row[i - 1]) / Math.max(1e-12, Math.abs(row[i - 1]) + Math.abs(row[i]))
        if (t > sps / 2 && t < (3 * sps) / 2) {
          first = Math.min(first, t)
          last = Math.max(last, t)
        }
      }
    }
  }
  const width = Number.isFinite(first) && Number.isFinite(last) ? (last - first) / sps : 0
  return { height: upperLow - lowerHigh, width, upper: upperLow, lower: lowerHigh }
}

export default function EyeCanvas({
  buffer = null,
  sps = 8,
  traceKey = null,
  unitLabel = '',
  decisionAt = 0,
  opening = null,
  height = 320,
}) {
  const rows = tracesOf({ buffer, sps })
  const measured = opening || openingOf({ rows, sps, at: decisionAt })

  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const area = plotArea(w, h, { topInset: 18 })
      if (!rows.length) {
        ctx.fillStyle = COLORS.text
        ctx.font = '13px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.fillText('Load an experiment with a shaped stream', w / 2, h / 2)
        return
      }

      let lo = Infinity
      let hi = -Infinity
      for (const row of rows) {
        for (let i = 0; i < row.length; i++) {
          if (row[i] < lo) lo = row[i]
          if (row[i] > hi) hi = row[i]
        }
      }
      const pad = (hi - lo) * 0.1
      lo -= pad
      hi += pad
      const sx = (i) => area.x + (i / (2 * sps - 1)) * area.w
      const sy = (v) => area.y + area.h - ((v - lo) / (hi - lo)) * area.h

      drawFrame(ctx, area, -1, 1, lo, hi, (v) => fmtNum(v, 2), (v) => fmtNum(v, 2), {
        zeroLine: true,
        xTitle: 'Symbol periods from the decision instant',
        yTitle: unitLabel ? `Amplitude (${unitLabel})` : 'Amplitude',
      })

      for (let k = 0; k < rows.length; k++) {
        ctx.strokeStyle = traceKey
          ? KEY_COLORS[traceKey[k % traceKey.length] % KEY_COLORS.length]
          : COLORS.trace
        ctx.globalAlpha = 0.35
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let i = 0; i < rows[k].length; i++) {
          const px = sx(i)
          const py = sy(rows[k][i])
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // The decision instant, and the opening it leaves.
      const centre = sps + decisionAt * sps
      ctx.strokeStyle = COLORS.marker
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(sx(centre) + 0.5, area.y)
      ctx.lineTo(sx(centre) + 0.5, area.y + area.h)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.strokeStyle = COLORS.textBright
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(sx(centre), sy(measured.lower))
      ctx.lineTo(sx(centre), sy(measured.upper))
      ctx.stroke()

      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, monospace`
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      const legend = [`${rows.length} traces`, `${sps} samples a symbol`]
      if (traceKey) legend.push('coloured by key')
      ctx.fillText(legend.join(' · '), area.x, area.y - 6 * area.k)
      ctx.textAlign = 'right'
      ctx.fillStyle = COLORS.textBright
      ctx.fillText(
        `opening ${measured.height.toFixed(3)}${unitLabel ? ` ${unitLabel}` : ''} · crossings over ${(measured.width * 100).toFixed(1)} % of a symbol`,
        area.x + area.w,
        area.y - 6 * area.k,
      )
    },
    [buffer, sps, traceKey, unitLabel, decisionAt, opening, rows.length],
  )

  return (
    <canvas
      ref={ref}
      className="canvas eye"
      style={{ width: '100%', height }}
      role="img"
      aria-label={`Eye diagram: ${rows.length} traces of two symbol periods`}
    />
  )
}
