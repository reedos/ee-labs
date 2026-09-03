import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmtHz } from '@ee-labs/ui'

/**
 * Magnitude against frequency, on a log axis, with optional phase.
 *
 * Frequency is logarithmic because a circuit's behaviour is scale-free: an
 * octave matters as much at 20 Hz as at 20 kHz, and a linear axis crushes six
 * decades of interesting behaviour into the last tenth of the plot. Magnitude is
 * in decibels for the same reason.
 *
 * Phase, when shown, gets its own axis on the right rather than a second pane.
 * It is the half of the response a magnitude plot cannot show, and reading it
 * against the same frequency axis is the point.
 *
 * `band`, when given, is the tolerance envelope across the sampled builds —
 * { magLo, magHi, phaseLo, phaseHi } on the same frequency grid — drawn as
 * shaded regions UNDER the nominal traces: the line is the circuit you asked
 * for, the shading is everywhere the drawer's parts could put it.
 */
export default function BodeCanvas({
  freqs,
  mag,
  phase,
  showPhase,
  band = null,
  markers = [],
  yUnit = 'dB',
  annotations = [],
}) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h, { rightAxis: !!showPhase })
      const k = area.k || 1
      const db = (a) => 20 * Math.log10(Math.max(a, 1e-12))

      const lx = (f) => Math.log10(f)
      const xMin = lx(freqs[0])
      const xMax = lx(freqs[freqs.length - 1])

      // Round the dB range outward to whole 20 dB steps so gridlines land on
      // decades of amplitude, where a reader expects them. The band counts
      // toward the range — a shaded region the axis clips is the fixed-ceiling
      // defect all over again.
      let lo = Infinity
      let hi = -Infinity
      const take = (v) => {
        if (Number.isFinite(v)) {
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
      }
      for (let i = 0; i < mag.length; i++) {
        take(db(mag[i]))
        if (band) {
          take(db(band.magLo[i]))
          take(db(band.magHi[i]))
        }
      }
      if (!Number.isFinite(lo)) {
        lo = -60
        hi = 0
      }
      hi = Math.ceil((hi + 3) / 20) * 20
      lo = Math.max(Math.floor((lo - 3) / 20) * 20, hi - 160)

      const { sx, sy } = drawFrame(
        ctx,
        area,
        xMin,
        xMax,
        lo,
        hi,
        (v) => fmtHz(Math.pow(10, v)),
        (v) => v.toFixed(0),
        {
          xStep: 1,
          yStep: Math.max(20, Math.ceil((hi - lo) / 8 / 20) * 20),
          xTitle: 'Frequency (Hz)',
          yTitle: `Magnitude (${yUnit})`,
        },
      )

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      // Minor gridlines at 2..9 within each decade: without them a log axis
      // gives no sense of where you are between the labelled ticks.
      ctx.strokeStyle = COLORS.grid
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 1
      for (let d = Math.floor(xMin); d <= Math.ceil(xMax); d++) {
        for (let m = 2; m <= 9; m++) {
          const x = sx(d + Math.log10(m))
          if (x < area.x || x > area.x + area.w) continue
          ctx.beginPath()
          ctx.moveTo(x + 0.5, area.y)
          ctx.lineTo(x + 0.5, area.y + area.h)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1

      // Frequencies worth naming — resonance, corners.
      for (const m of markers) {
        if (!(m.f > 0)) continue
        const x = sx(lx(m.f))
        ctx.strokeStyle = COLORS.marker
        ctx.globalAlpha = 0.45
        ctx.setLineDash([4 * k, 4 * k])
        ctx.beginPath()
        ctx.moveTo(x, area.y)
        ctx.lineTo(x, area.y + area.h)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
        if (m.label) {
          ctx.fillStyle = COLORS.marker
          ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'top'
          ctx.fillText(m.label, x + 4 * k, area.y + 4 * k)
        }
      }

      // Captions pinned to a LEVEL rather than a frequency — a flat response
      // has no corner to mark, and "no dynamics" deserves to be a labelled
      // fact on the plot, not empty chrome: { db, text } sits just above the
      // magnitude trace, { deg, text } just under the phase trace.
      ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textAlign = 'right'
      for (const a of annotations) {
        if (!Number.isFinite(a.db)) continue
        ctx.fillStyle = COLORS.marker
        ctx.textBaseline = 'bottom'
        ctx.fillText(a.text, area.x + area.w - 8 * k, sy(a.db) - 4 * k)
      }

      // The 0 dB reference, where the output equals the input.
      if (lo < 0 && hi > 0) {
        ctx.strokeStyle = COLORS.gridMajor
        ctx.setLineDash([2 * k, 4 * k])
        ctx.beginPath()
        ctx.moveTo(area.x, sy(0))
        ctx.lineTo(area.x + area.w, sy(0))
        ctx.stroke()
        ctx.setLineDash([])
      }

      // The tolerance envelope first, so the nominal line always reads on top.
      // Hairline strokes on the envelope's edges as well as the fill: on a
      // 160 dB axis a ±1 dB band is thinner than a pixel, and without edges
      // it would be present in the data and absent from the picture.
      if (band) {
        const edge = (arr) => {
          ctx.beginPath()
          for (let i = 0; i < mag.length; i++) {
            const x = sx(lx(freqs[i]))
            const y = sy(db(arr[i]))
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.stroke()
        }
        ctx.fillStyle = COLORS.trace
        ctx.globalAlpha = 0.22
        ctx.beginPath()
        for (let i = 0; i < mag.length; i++) {
          const x = sx(lx(freqs[i]))
          const y = sy(db(band.magHi[i]))
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        for (let i = mag.length - 1; i >= 0; i--) {
          ctx.lineTo(sx(lx(freqs[i])), sy(db(band.magLo[i])))
        }
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = COLORS.trace
        ctx.lineWidth = 1 * k
        ctx.globalAlpha = 0.6
        edge(band.magHi)
        edge(band.magLo)
        ctx.globalAlpha = 1
      }

      ctx.strokeStyle = COLORS.trace
      ctx.lineWidth = 1.8 * k
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i < mag.length; i++) {
        const x = sx(lx(freqs[i]))
        const y = sy(db(mag[i]))
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      if (showPhase && phase) {
        let plo = 0
        let phi = 0
        const takeDeg = (rad) => {
          const d = (rad * 180) / Math.PI
          if (d < plo) plo = d
          if (d > phi) phi = d
        }
        for (let i = 0; i < phase.length; i++) {
          takeDeg(phase[i])
          if (band) {
            takeDeg(band.phaseLo[i])
            takeDeg(band.phaseHi[i])
          }
        }
        plo = Math.min(-90, Math.floor(plo / 90) * 90)
        phi = Math.max(90, Math.ceil(phi / 90) * 90)
        const py = (d) => area.y + area.h - ((d - plo) / (phi - plo)) * area.h

        if (band) {
          const pedge = (arr) => {
            ctx.beginPath()
            for (let i = 0; i < phase.length; i++) {
              const x = sx(lx(freqs[i]))
              const y = py((arr[i] * 180) / Math.PI)
              if (i === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            ctx.stroke()
          }
          ctx.fillStyle = COLORS.phase
          ctx.globalAlpha = 0.16
          ctx.beginPath()
          for (let i = 0; i < phase.length; i++) {
            const x = sx(lx(freqs[i]))
            const y = py((band.phaseHi[i] * 180) / Math.PI)
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          for (let i = phase.length - 1; i >= 0; i--) {
            ctx.lineTo(sx(lx(freqs[i])), py((band.phaseLo[i] * 180) / Math.PI))
          }
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = COLORS.phase
          ctx.lineWidth = 1 * k
          ctx.globalAlpha = 0.5
          pedge(band.phaseHi)
          pedge(band.phaseLo)
          ctx.globalAlpha = 1
        }

        ctx.strokeStyle = COLORS.phase
        ctx.lineWidth = 1.5 * k
        ctx.setLineDash([6 * k, 3 * k])
        ctx.beginPath()
        for (let i = 0; i < phase.length; i++) {
          const x = sx(lx(freqs[i]))
          const y = py((phase[i] * 180) / Math.PI)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.setLineDash([])

        ctx.fillStyle = COLORS.phase
        ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'top'
        for (const a of annotations) {
          if (!Number.isFinite(a.deg)) continue
          ctx.fillText(a.text, area.x + area.w - 8 * k, py(a.deg) + 4 * k)
        }
        ctx.restore()

        ctx.save()
        ctx.fillStyle = COLORS.phase
        ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        for (let d = plo; d <= phi + 1e-9; d += 90) {
          ctx.fillText(`${d}°`, area.x + area.w + 8 * k, py(d))
        }
        ctx.translate(area.x + area.w + 52 * k, area.y + area.h / 2)
        ctx.rotate(Math.PI / 2)
        ctx.textAlign = 'center'
        ctx.font = `${Math.round(12 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.fillText('Phase', 0, 0)
        ctx.restore()
        return
      }
      ctx.restore()
    },
    [freqs, mag, phase, showPhase, band, markers, yUnit, annotations],
  )

  // What the plot says, readable from the DOM: the harness checks a corner
  // is labelled f_c and a divider is labelled H = 1/2, which pixels cannot
  // tell it.
  return (
    <canvas
      ref={ref}
      className="plot"
      role="img"
      aria-label="Bode plot: magnitude and phase of the circuit against frequency"
      data-markers={markers.map((m) => m.label).filter(Boolean).join(' | ')}
      data-annotations={annotations
        .filter((a) => showPhase || Number.isFinite(a.db))
        .map((a) => a.text)
        .join(' | ')}
    />
  )
}
