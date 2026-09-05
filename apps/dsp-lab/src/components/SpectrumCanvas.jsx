import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'

/**
 * The spectrum, in decibels, with the chain's own response drawn over it when
 * the chain has one.
 *
 * The dB floor is a prop rather than a constant. A 60 dB stopband sits below
 * Signal Lab's usual −100 dB floor once the specification asks for 100, and a
 * feature below the axis is a feature the lesson cannot show
 * (`REVIEW_PLAYBOOK.md` §4). Every experiment that states a deep specification
 * lowers the floor with it.
 *
 * `refusals` is the list of blocks that have no transfer function. When it is
 * not empty the response curve is dashed and the reasons are printed, rather
 * than the curve being drawn as though it described the whole chain.
 */
export default function SpectrumCanvas({
  freqs,
  amps,
  response = null,
  responseFreqs = null,
  floorDb = -120,
  fMax = null,
  refusals = [],
  mask = null,
  markers = [],
}) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h, { topInset: refusals.length ? 16 : 0 })
      const top = freqs.length ? freqs[freqs.length - 1] : 1
      const xMax = fMax || top
      const dbOf = (a) => (a > 0 ? Math.max(floorDb, 20 * Math.log10(a)) : floorDb)

      drawFrame(ctx, area, 0, xMax, floorDb, 6, (v) => `${Math.round(v / 1000)}k`, (v) => `${v}`, {
        xTitle: 'Frequency (Hz)',
        yTitle: 'Amplitude (dB)',
      })

      const sx = (f) => area.x + (f / xMax) * area.w
      const sy = (db) => area.y + area.h - ((db - floorDb) / (6 - floorDb)) * area.h

      // The mask first, behind everything, because it is the target rather than
      // a measurement.
      if (mask) {
        for (const band of mask.bands) {
          const x0 = sx(Math.max(0, band.from))
          const x1 = sx(Math.min(xMax, band.to))
          if (!(x1 > x0)) continue
          ctx.fillStyle = band.met ? 'rgba(56, 224, 176, 0.08)' : 'rgba(255, 92, 122, 0.10)'
          const yTop = sy(band.max == null ? 6 : band.max)
          const yBot = sy(band.min == null ? floorDb : band.min)
          ctx.fillRect(x0, Math.min(yTop, yBot), x1 - x0, Math.abs(yBot - yTop))
          ctx.strokeStyle = band.met ? COLORS.trace : COLORS.marker
          ctx.setLineDash([4, 3])
          ctx.lineWidth = 1.2
          ctx.beginPath()
          if (band.max != null) {
            ctx.moveTo(x0, sy(band.max))
            ctx.lineTo(x1, sy(band.max))
          }
          if (band.min != null) {
            ctx.moveTo(x0, sy(band.min))
            ctx.lineTo(x1, sy(band.min))
          }
          ctx.stroke()
          ctx.setLineDash([])
        }
      }

      ctx.strokeStyle = COLORS.spectrum
      ctx.lineWidth = 1.4
      ctx.beginPath()
      let started = false
      for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] > xMax) break
        const x = sx(freqs[i])
        const y = sy(dbOf(amps[i]))
        if (!started) {
          ctx.moveTo(x, y)
          started = true
        } else ctx.lineTo(x, y)
      }
      ctx.stroke()

      if (response && responseFreqs) {
        ctx.strokeStyle = COLORS.response
        ctx.lineWidth = 1.6
        if (refusals.length) ctx.setLineDash([6, 4])
        ctx.beginPath()
        let on = false
        for (let i = 0; i < responseFreqs.length; i++) {
          if (responseFreqs[i] > xMax) break
          const x = sx(responseFreqs[i])
          const y = sy(dbOf(response[i]))
          if (!on) {
            ctx.moveTo(x, y)
            on = true
          } else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }

      for (const m of markers) {
        if (m.hz > xMax) continue
        ctx.strokeStyle = COLORS.marker
        ctx.lineWidth = 1
        ctx.setLineDash([2, 3])
        ctx.beginPath()
        ctx.moveTo(sx(m.hz), area.y)
        ctx.lineTo(sx(m.hz), area.y + area.h)
        ctx.stroke()
        ctx.setLineDash([])
        if (m.label) {
          ctx.fillStyle = COLORS.marker
          ctx.font = `${Math.round(10 * area.k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
          ctx.fillText(m.label, sx(m.hz) + 3, area.y + 10 * area.k)
        }
      }

      if (refusals.length) {
        ctx.fillStyle = COLORS.text
        ctx.font = `${Math.round(10.5 * area.k)}px system-ui, sans-serif`
        ctx.fillText(
          `Response dashed: ${refusals.map((r) => r.label).join(', ')} has no transfer function.`,
          area.x,
          area.y - 5,
        )
      }
    },
    [freqs, amps, response, responseFreqs, floorDb, fMax, refusals, mask, markers],
  )
  return <canvas ref={ref} className="plot" />
}
