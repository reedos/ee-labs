import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmtHz } from '@ee-labs/ui'
import { yTickBudget } from '../axis.js'

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
 *
 * `annotations` are captions pinned to a LEVEL ({ db, text } / { deg, text })
 * for a response with no feature to point at; `points` are marks pinned to a
 * POINT ({ f, db, text } / { f, deg, text }) — the corner's −3.01 dB and −45°,
 * the tank's peak — drawn as a dot on the trace with its value beside it.
 */
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

export default function BodeCanvas({
  freqs,
  mag,
  phase,
  showPhase,
  band = null,
  markers = [],
  yUnit = 'dB',
  annotations = [],
  points = [],
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
          // Whole 20 dB steps, but no more of them than the pane is tall
          // enough to label: on a phone the pane is ~70 px of plot, and eight
          // ticks put 11 px between two 11 px labels, which reads as a smear
          // rather than an axis.
          yStep: Math.max(20, Math.ceil((hi - lo) / yTickBudget(area, k) / 20) * 20),
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
          ctx.font = `${Math.round(11 * k)}px ${MONO}`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'top'
          ctx.fillText(m.label, x + 4 * k, area.y + 4 * k)
        }
      }

      // Level captions stack: each takes the first free band at or below
      // where it wants to be, so "H = 3/4 = −2.50 dB" and "phase = 0°" —
      // 6 px apart on a divider — read as two lines instead of one smear.
      // The y each landed on is written to the DOM for the harness.
      const lineH = 14 * k
      const placed = []
      const placeAt = (top) => {
        let y = top
        let moved = true
        while (moved) {
          moved = false
          for (const p of placed) {
            if (y < p + lineH && y + lineH > p) {
              y = p + lineH
              moved = true
            }
          }
        }
        placed.push(y)
        return y
      }
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      for (const a of annotations) {
        if (!Number.isFinite(a.db)) continue
        ctx.fillStyle = COLORS.marker
        // Just above the magnitude trace: the caption's box is one line tall
        // ending 4 px over the line.
        ctx.fillText(a.text, area.x + area.w - 8 * k, placeAt(sy(a.db) - 4 * k - lineH))
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

      // A point mark: a dot on the trace, its value beside it — on the side
      // the trace leaves empty. A curve falling to the right is high on the
      // left and low on the right, so above-right is empty and so is
      // below-left; a rising one the mirror. First choice above/below-right;
      // if a marker caption or another label is already there, the mirror
      // side; failing both, the next free line down. (The inverting
      // amplifier's 36.99 dB and 135° land on the same pixel row; on a phone
      // the corner's −3.01 dB ran into the f_c caption.)
      const indexAt = (f) => {
        let i = 0
        while (i < freqs.length - 1 && freqs[i] < f) i++
        return i
      }
      const free = (top) => placed.every((p) => top >= p + lineH || top + lineH <= p)
      const mark = (x, y, text, color, fallingRight) => {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, y, 3.2 * k, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = `${Math.round(11 * k)}px ${MONO}`
        ctx.textBaseline = 'top'
        const above = y - 5 * k - lineH
        const below = y + 5 * k
        const first = fallingRight ? above : below
        const mirror = fallingRight ? below : above
        let top
        let left = true
        if (free(first)) top = first
        else if (free(mirror)) {
          top = mirror
          left = false
        } else top = placeAt(first)
        placed.push(top)
        ctx.textAlign = left ? 'left' : 'right'
        ctx.fillText(text, left ? x + 7 * k : x - 7 * k, top)
      }
      // Marker captions own the plot's top line.
      if (markers.some((m) => m.f > 0 && m.label)) placed.push(area.y + 4 * k)
      for (const p of points) {
        if (!(p.f > 0) || !Number.isFinite(p.db)) continue
        const i = indexAt(p.f)
        const j = Math.min(mag.length - 1, i + 8)
        mark(sx(lx(p.f)), sy(p.db), p.text, COLORS.trace, db(mag[j]) < db(mag[i]))
      }

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
        ctx.font = `${Math.round(11 * k)}px ${MONO}`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'top'
        for (const a of annotations) {
          if (!Number.isFinite(a.deg)) continue
          // Just under the phase trace — and below any caption already there.
          ctx.fillText(a.text, area.x + area.w - 8 * k, placeAt(py(a.deg) + 4 * k))
        }
        for (const p of points) {
          if (!(p.f > 0) || !Number.isFinite(p.deg)) continue
          const i = indexAt(p.f)
          const j = Math.min(phase.length - 1, i + 8)
          mark(sx(lx(p.f)), py(p.deg), p.text, COLORS.phase, phase[j] < phase[i])
        }
        ctx.restore()

        ctx.save()
        ctx.fillStyle = COLORS.phase
        ctx.font = `${Math.round(11 * k)}px ${MONO}`
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
      } else {
        ctx.restore()
      }
      // Where the level captions landed, in canvas pixels: the harness
      // checks two captions never share a line.
      ctx.canvas.dataset.annotationYs = placed.map((y) => Math.round(y)).join(' ')
    },
    [freqs, mag, phase, showPhase, band, markers, yUnit, annotations, points],
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
      data-points={points
        .filter((p) => showPhase || Number.isFinite(p.db))
        .map((p) => p.text)
        .join(' | ')}
    />
  )
}
