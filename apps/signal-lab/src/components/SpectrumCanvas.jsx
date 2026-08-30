import React from 'react'
import { useCanvas } from '@ee-labs/ui'
import { COLORS, drawFrame, niceStep, plotArea } from '@ee-labs/ui'
import { toDb } from '@ee-labs/dsp'

const FLOOR_DB = -100

/**
 * Range and tick spacing for the right-hand axis.
 *
 * Phase snaps to quarter turns, because 90 degrees is a quantity with meaning and
 * a gridline at 73.4 is not. Group delay gets an ordinary round step, and is
 * pinned to include zero so a flat line at (N-1)/2 samples can be seen to BE
 * flat rather than merely straight.
 */
function overlayAxis(overlay, area) {
  let lo = 0
  let hi = 0
  for (let i = 0; i < overlay.values.length; i++) {
    const v = overlay.values[i]
    if (!Number.isFinite(v)) continue
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  let step
  if (overlay.kind === 'phase') {
    lo = Math.min(-90, Math.floor(lo / 90) * 90)
    hi = Math.max(90, Math.ceil(hi / 90) * 90)
    step = 90
    while ((hi - lo) / step > 8) step += 90
  } else {
    hi = Math.max(hi, 1)
    step = niceStep(hi - lo, 5)
    lo = Math.floor(lo / step) * step
    hi = Math.ceil(hi / step) * step
  }
  const py = (v) => area.y + area.h - ((v - lo) / (hi - lo || 1)) * area.h
  return { lo, hi, step, py }
}

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
  overlay = null,
  scale,
  markers,
  xMax = null,
}) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h, { rightAxis: !!overlay })
      // A zoomed x-axis, for tones too close to separate on a full-Nyquist
      // span: two lines 5 Hz apart are one pixel at 4 kHz wide and plainly
      // two at 500. Everything beyond xMax still exists — the clip rectangle
      // just does not show it.
      const fFull = freqs.length ? freqs[freqs.length - 1] : 1
      const fMax = xMax != null ? Math.min(xMax, fFull) : fFull
      const db = scale === 'db'

      let yMin
      let yMax
      if (db) {
        yMin = FLOOR_DB
        // The top of the axis follows the chain. It sat fixed at +10 dB, and a
        // Q = 20 low-pass puts its resonant peak at +26 — the one feature the
        // "Resonance is Q" lesson exists to show left the plot entirely. Scan
        // everything drawn (signal, response curve, pre-chain ghost) within
        // the visible span and round the ceiling up to the next 10 dB, with
        // +10 as the floor so ordinary views keep their familiar frame.
        let pk = 0
        for (let i = 0; i < amps.length; i++) {
          if (freqs[i] > fMax) break
          if (amps[i] > pk) pk = amps[i]
          if (response && response[i] > pk) pk = response[i]
          if (ghostAmps && ghostAmps[i] > pk) pk = ghostAmps[i]
        }
        const peakDb = pk > 0 ? 20 * Math.log10(pk) : 0
        yMax = Math.max(10, Math.ceil((peakDb + 4) / 10) * 10)
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
          yTitle: db ? 'Amplitude (dB, 1.0 = 0 dB)' : 'Amplitude (signal units)',
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

      // A property of the CHAIN, on its own axis — never a property of the
      // measured signal, which depends on where the frame starts and is random
      // wherever there is no signal. Phase and group delay share this axis and
      // are offered one at a time: they are two readings of the same thing, and
      // two dashed curves against one magnitude plot is a worse view than
      // either alone.
      if (overlay) {
        const { py } = overlayAxis(overlay, area)
        ctx.strokeStyle = COLORS.phase
        ctx.lineWidth = 1.4 * k
        ctx.setLineDash([6 * k, 3 * k])
        ctx.beginPath()
        let down = true
        for (let i = 0; i < overlay.values.length; i++) {
          const v = overlay.values[i]
          if (!Number.isFinite(v)) {
            down = true
            continue
          }
          const x = sx(freqs[i])
          const y = py(v)
          if (down) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
          down = false
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.restore()

      // Right-hand axis, outside the clip.
      if (overlay) {
        const { lo, hi, step, py } = overlayAxis(overlay, area)
        ctx.save()
        ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.fillStyle = COLORS.phase
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        for (let v = lo; v <= hi + step * 1e-9; v += step) {
          ctx.fillText(overlay.tick(v), area.x + area.w + 8 * k, py(v))
        }
        ctx.translate(area.x + area.w + 52 * k, area.y + area.h / 2)
        ctx.rotate(Math.PI / 2)
        ctx.textAlign = 'center'
        ctx.font = `${Math.round(12 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.fillText(overlay.label, 0, 0)
        ctx.restore()
      }
    },
    [freqs, amps, ghostAmps, response, responseExact, overlay, scale, markers, xMax],
  )

  return <canvas ref={ref} className="plot" role="img" aria-label="Spectrum: amplitude against frequency, with the chain response overlaid" />
}
