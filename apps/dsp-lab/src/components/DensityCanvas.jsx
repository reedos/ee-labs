import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'

/**
 * The density view: power per hertz against frequency, with the estimator named.
 *
 * The spectrum view draws the amplitude of a line, which is what a signal made
 * of sinusoids has. A signal that is not made of sinusoids has no lines to read,
 * and what it has instead is a density, whose units are power per hertz and
 * whose value at a point means nothing until a bandwidth is attached to it. So
 * this is a different view rather than the same one relabelled.
 *
 * `model` is the all-pole fit, drawn over the average when a lesson asks for
 * the comparison. It is a curve of the same units on the same axes, which is
 * the only way the two can be compared at all.
 */
export default function DensityCanvas({ est, model = null, floorDb = -160, label = null }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const nyquist = est.freqs[est.freqs.length - 1]
      const db = (v) => 10 * Math.log10(Math.max(1e-300, v))

      let top = -Infinity
      for (const v of est.psd) top = Math.max(top, db(v))
      if (model) for (const v of model.mag) top = Math.max(top, db(v))
      top = Math.ceil((top + 6) / 10) * 10
      const bottom = top + floorDb

      drawFrame(ctx, area, 0, nyquist, bottom, top, (v) => (v / 1000).toFixed(0), (v) => v.toFixed(0), {
        xTitle: 'Frequency (kHz)',
        yTitle: 'Density (dB per Hz)',
      })

      const sx = (f) => area.x + (f / nyquist) * area.w
      const sy = (d) => area.y + area.h - ((d - bottom) / (top - bottom)) * area.h

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      ctx.strokeStyle = COLORS.spectrum
      ctx.lineWidth = 1.4
      ctx.beginPath()
      for (let k = 0; k < est.freqs.length; k++) {
        const x = sx(est.freqs[k])
        const y = sy(db(est.psd[k]))
        if (k === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      if (model) {
        ctx.strokeStyle = COLORS.response
        ctx.lineWidth = 1.8
        ctx.beginPath()
        for (let k = 0; k < model.freqs.length; k++) {
          const x = sx(model.freqs[k])
          const y = sy(db(model.mag[k]))
          if (k === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.restore()

      if (label) {
        ctx.fillStyle = COLORS.text
        ctx.font = '11px system-ui, sans-serif'
        ctx.fillText(label, area.x + 6, area.y + 14)
      }
    },
    [est, model, floorDb, label],
  )
  return <canvas ref={ref} className="plot" />
}
