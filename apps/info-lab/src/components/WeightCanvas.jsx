import React from 'react'
import { COLORS, useCanvas } from '@ee-labs/ui'

// How many words have each weight, as bars, with the two radii marked.
//
// The correction radius and the detection radius are drawn as vertical lines
// over the bars, because the whole claim of C3 is that those two numbers follow
// from where the first nonzero bar sits. D4 draws the same picture for a
// convolutional code's error events, where the first bar is the free distance.

/** The picture as data: one bar per weight, and where the two radii fall. */
export function sceneOf({ weights = [], d = null, t = null, detect = null, width = 640, height = 260 }) {
  const pad = { l: 46, r: 14, t: 16, b: 34 }
  const n = weights.length
  const most = Math.max(1, ...weights)
  const w = (width - pad.l - pad.r) / Math.max(1, n)
  const bars = weights.map((count, weight) => ({
    weight,
    count,
    x: pad.l + weight * w,
    w: Math.max(1, w - 2),
    h: count ? ((height - pad.t - pad.b) * Math.log10(1 + count)) / Math.log10(1 + most) : 0,
    // The lowest nonzero weight above zero is the distance, and it is lit.
    lit: d !== null && weight === d,
  }))
  for (const bar of bars) bar.y = height - pad.b - bar.h
  const at = (weight) => pad.l + weight * w + w / 2
  return {
    bars,
    most,
    baseline: height - pad.b,
    marks: [
      t !== null ? { at: at(t), label: `t = ${t}`, colour: COLORS.trace } : null,
      detect !== null ? { at: at(detect), label: `detect ${detect}`, colour: COLORS.spectrum } : null,
      d !== null ? { at: at(d), label: `d = ${d}`, colour: COLORS.marker } : null,
    ].filter(Boolean),
    width,
    height,
  }
}

export default function WeightCanvas({ weights = [], d = null, t = null, detect = null, label = 'codewords', height = 260 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const scene = sceneOf({ weights, d, t, detect, width: w, height: h })
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textBaseline = 'middle'

      // The bars, and the count over each one that has any.
      for (const bar of scene.bars) {
        if (bar.count) {
          ctx.fillStyle = bar.lit ? COLORS.marker : COLORS.trace
          ctx.fillRect(bar.x, bar.y, bar.w, bar.h)
        }
        ctx.fillStyle = COLORS.text
        ctx.textAlign = 'center'
        if (scene.bars.length <= 26 || bar.weight % 4 === 0) ctx.fillText(String(bar.weight), bar.x + bar.w / 2, h - 20)
        if (bar.count && (scene.bars.length <= 16 || bar.count === scene.most)) {
          ctx.fillStyle = COLORS.textBright
          ctx.fillText(String(bar.count), bar.x + bar.w / 2, bar.y - 8)
        }
      }

      // The two radii, over the bars.
      for (const mark of scene.marks) {
        ctx.strokeStyle = mark.colour
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(mark.at, 14)
        ctx.lineTo(mark.at, scene.baseline)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = mark.colour
        ctx.textAlign = 'left'
        ctx.fillText(mark.label, mark.at + 4, 10)
      }

      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      ctx.fillText(`weight, and how many ${label} have it`, 6, h - 6)
    },
    [weights.join(','), d, t, detect, label, height],
  )

  return <canvas ref={ref} className="weight-canvas" style={{ height }} role="img" aria-label={`How many ${label} have each weight`} />
}
