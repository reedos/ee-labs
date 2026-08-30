import React from 'react'
import { useCanvas } from '@ee-labs/ui'
import { COLORS, drawFrame, plotArea } from '@ee-labs/ui'
import { toDb } from '@ee-labs/dsp'

const FLOOR_DB = -100

/**
 * Frequency-domain view. X runs 0..Nyquist; Y is either dBV or linear amplitude.
 *
 * Up to three traces share one axis:
 *   - `ghostAmps`  the spectrum BEFORE the chain, so "what the filter removed" is literal
 *   - `response`   the chain's theoretical |H(f)|, on the same scale as the signal
 *   - `amps`       what actually came out
 *
 * Putting the response on the signal's own axis is the point: a 1.0-amplitude sine
 * reads 0 dB, so its filtered peak lands exactly on the response curve.
 */
export default function SpectrumCanvas({
  freqs,
  amps,
  ghostAmps,
  response,
  responseExact = true,
  phase = null,
  scale,
  markers,
}) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h, { rightAxis: !!phase })
      const fMax = freqs.length ? freqs[freqs.length - 1] : 1
      const db = scale === 'db'

      let yMin
      let yMax
      if (db) {
        yMin = FLOOR_DB
        yMax = 10
      } else {
        let pk = 0
        for (let i = 0; i < amps.length; i++) if (amps[i] > pk) pk = amps[i]
        if (response) for (let i = 0; i < response.length; i++) if (response[i] > pk) pk = response[i]
        yMin = 0
        yMax = Math.max(pk * 1.15, 1e-3)
      }

      const { sx, sy } = drawFrame(
        ctx,
        area,
        0,
        fMax,
        yMin,
        yMax,
        (v) => (fMax >= 2000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)),
        (v) => (db ? v.toFixed(0) : v.toFixed(2)),
        {
          xTitle: 'Frequency (Hz)',
          yTitle: db ? 'Amplitude (dB, 1.0 = 0 dB)' : 'Amplitude',
        },
      )

      const yOf = (a) => sy(db ? toDb(a, FLOOR_DB) : a)
      const k = area.k || 1

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      // Expected-harmonic markers, behind everything.
      if (markers && markers.length) {
        ctx.strokeStyle = COLORS.marker
        ctx.globalAlpha = 0.35
        ctx.lineWidth = 1 * k
        ctx.setLineDash([3 * k, 3 * k])
        for (const f of markers) {
          if (f <= 0 || f > fMax) continue
          const x = sx(f)
          ctx.beginPath()
          ctx.moveTo(x, area.y)
          ctx.lineTo(x, area.y + area.h)
          ctx.stroke()
        }
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }

      // Pre-chain spectrum.
      if (ghostAmps) {
        ctx.strokeStyle = COLORS.ghost
        ctx.lineWidth = 1.2 * k
        ctx.beginPath()
        for (let i = 0; i < ghostAmps.length; i++) {
          const x = sx(freqs[i])
          const y = yOf(ghostAmps[i])
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // Unity reference — where an unfiltered 1.0-amplitude tone sits.
      if (response) {
        ctx.strokeStyle = COLORS.response
        ctx.globalAlpha = 0.25
        ctx.setLineDash([2 * k, 4 * k])
        ctx.lineWidth = 1 * k
        const y0 = yOf(1)
        ctx.beginPath()
        ctx.moveTo(area.x, y0)
        ctx.lineTo(area.x + area.w, y0)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1

        // Dashed when a nonlinear block means this describes only part of the
        // chain. Never draw a curve that is quietly a lie.
        ctx.strokeStyle = COLORS.response
        ctx.lineWidth = 1.6 * k
        if (!responseExact) ctx.setLineDash([5 * k, 4 * k])
        ctx.beginPath()
        for (let i = 0; i < response.length; i++) {
          const x = sx(freqs[i])
          const y = yOf(response[i])
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Measured output.
      ctx.fillStyle = COLORS.spectrumDim
      ctx.beginPath()
      ctx.moveTo(sx(freqs[0]), sy(yMin))
      for (let i = 0; i < amps.length; i++) ctx.lineTo(sx(freqs[i]), yOf(amps[i]))
      ctx.lineTo(sx(freqs[amps.length - 1]), sy(yMin))
      ctx.closePath()
      ctx.fill()

      ctx.strokeStyle = COLORS.spectrum
      ctx.lineWidth = 1.4 * k
      ctx.beginPath()
      for (let i = 0; i < amps.length; i++) {
        const x = sx(freqs[i])
        const y = yOf(amps[i])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Phase of the CHAIN, on its own axis — never the phase of the measured
      // signal, which depends on where the frame starts and is random wherever
      // there is no signal.
      if (phase) {
        let lo = 0
        let hi = 0
        for (let i = 0; i < phase.length; i++) {
          const d = (phase[i] * 180) / Math.PI
          if (d < lo) lo = d
          if (d > hi) hi = d
        }
        // Snap to whole quarter turns so the gridlines mean something.
        lo = Math.min(-90, Math.floor(lo / 90) * 90)
        hi = Math.max(90, Math.ceil(hi / 90) * 90)
        const py = (d) => area.y + area.h - ((d - lo) / (hi - lo)) * area.h

        ctx.strokeStyle = COLORS.phase
        ctx.lineWidth = 1.4 * k
        ctx.setLineDash([6 * k, 3 * k])
        ctx.beginPath()
        for (let i = 0; i < phase.length; i++) {
          const x = sx(freqs[i])
          const y = py((phase[i] * 180) / Math.PI)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.restore()

      // Right-hand axis, outside the clip.
      if (phase) {
        let lo = 0
        let hi = 0
        for (let i = 0; i < phase.length; i++) {
          const d = (phase[i] * 180) / Math.PI
          if (d < lo) lo = d
          if (d > hi) hi = d
        }
        lo = Math.min(-90, Math.floor(lo / 90) * 90)
        hi = Math.max(90, Math.ceil(hi / 90) * 90)
        const py = (d) => area.y + area.h - ((d - lo) / (hi - lo)) * area.h

        ctx.save()
        ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.fillStyle = COLORS.phase
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        for (let d = lo; d <= hi + 1e-9; d += 90) {
          ctx.fillText(`${d}°`, area.x + area.w + 8 * k, py(d))
        }
        ctx.translate(area.x + area.w + 52 * k, area.y + area.h / 2)
        ctx.rotate(Math.PI / 2)
        ctx.textAlign = 'center'
        ctx.font = `${Math.round(12 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.fillText('Phase of the chain', 0, 0)
        ctx.restore()
      }
    },
    [freqs, amps, ghostAmps, response, responseExact, phase, scale, markers],
  )

  return <canvas ref={ref} className="plot" />
}
