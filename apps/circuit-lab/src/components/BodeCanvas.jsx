import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmtHz } from '@ee-labs/ui'
import { phaseFrame, yTickBudget } from '../axis.js'

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

      // Every caption this plot writes over its own picture gets a plate: a
      // rectangle of the background painted behind the glyphs first. At
      // 1080p there is room to place a caption clear of the trace and the
      // gridlines; at 390 px the pane is 250 px wide and 40 px tall, and the
      // divider's "H = 1/2 = −6.02 dB at every frequency" lands across the
      // 0 dB rule, the frame's top edge and its own trace at once. Text over a
      // line is not readable, and the caption is the only place the number
      // appears on that plot.
      const plated = (text, x, y, align, baseline = 'top') => {
        // ...and it has to FIT. "H = 1/2 = −6.02 dB at every frequency" is 36
        // monospace characters, which is 250 px at 11 px and exactly the width
        // of the whole plot on a 390 px phone: right-aligned, its first
        // character was drawn out in the y-axis gutter. Shrink the caption
        // until it fits the frame, down to 8 px and no further.
        const saved = ctx.font
        const maxW = area.w - 10 * k
        const floor = Math.round(8 * k)
        let size = Math.round(11 * k)
        ctx.font = `${size}px ${MONO}`
        while (size > floor && ctx.measureText(text).width > maxW) {
          size -= 1
          ctx.font = `${size}px ${MONO}`
        }
        const w2 = ctx.measureText(text).width
        const hh = Math.max(13 * k, size + 2)
        const left = align === 'right' ? x - w2 : x
        const top = baseline === 'middle' ? y - hh / 2 : y - 1 * k
        ctx.save()
        ctx.fillStyle = COLORS.bg
        ctx.globalAlpha = 0.78
        ctx.fillRect(left - 3 * k, top, w2 + 6 * k, hh)
        ctx.restore()
        ctx.textAlign = align
        ctx.textBaseline = baseline
        ctx.fillText(text, x, y)
        ctx.font = saved
      }

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
          // Named with its value now, so the caption is wide enough to run off
          // the right edge when the marked frequency sits near it: flip to the
          // marker's other side rather than write half a number.
          const wLabel = ctx.measureText(m.label).width
          const room = area.x + area.w - (x + 4 * k) - 4 * k
          if (wLabel <= room) plated(m.label, x + 4 * k, area.y + 4 * k, 'left')
          else plated(m.label, x - 4 * k, area.y + 4 * k, 'right')
        }
      }

      // Level captions stack: each takes the first free band at or below
      // where it wants to be, so "H = 3/4 = −2.50 dB" and "phase = 0°" —
      // 6 px apart on a divider — read as two lines instead of one smear.
      // The y each landed on is written to the DOM for the harness.
      const lineH = 14 * k
      const placed = []
      // Inside the frame, always. On a phone the divider's caption wants a row
      // three pixels ABOVE the frame's top edge, where the plot's own border
      // draws through it — and the y recorded for the harness has to be the y
      // the glyphs actually landed on, so the clamp lives inside placeAt.
      const inFrame = (top) => Math.max(area.y + 2 * k, Math.min(top, area.y + area.h - lineH))
      const placeAt = (top) => {
        let y = inFrame(top)
        // Bounded: each pass either steps clear of one caption or finds the
        // clamp already holding it, and stops. (Stacking downward WHILE
        // clamping to the frame can otherwise bounce a caption between the
        // same two rows forever — a canvas that never returns, which is a
        // frozen tab rather than a wrong picture.)
        for (let guard = 0; guard <= placed.length; guard++) {
          const hit = placed.find((p) => y < p + lineH && y + lineH > p)
          if (hit === undefined) break
          const next = inFrame(hit + lineH)
          if (next === y) break
          y = next
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
        plated(a.text, area.x + area.w - 8 * k, placeAt(sy(a.db) - 4 * k - lineH), 'right')
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
        const above = inFrame(y - 5 * k - lineH)
        const below = inFrame(y + 5 * k)
        const first = fallingRight ? above : below
        const mirror = fallingRight ? below : above
        let top
        let left = true
        if (free(first)) {
          top = first
          placed.push(top)
        } else if (free(mirror)) {
          top = mirror
          left = false
          placed.push(top)
        } else top = placeAt(first)
        // ...and on the side there is ROOM for. The tank marks its peak at f₀,
        // two thirds along the axis, and "peak = R = 10 kΩ = 80.0 dBΩ" ran
        // off a 390 px plot's right edge and was clipped mid-number.
        const wText = ctx.measureText(text).width
        const fitsRight = x + 7 * k + wText <= area.x + area.w - 2 * k
        const fitsLeft = x - 7 * k - wText >= area.x + 2 * k
        if (left && !fitsRight && fitsLeft) left = false
        else if (!left && !fitsLeft && fitsRight) left = true
        let tx = left ? x + 7 * k : x - 7 * k
        let align = left ? 'left' : 'right'
        // Neither side has room for it: park it against the frame's right
        // edge rather than let the clip take the end of the number. The dot
        // still marks the point.
        if (!fitsRight && !fitsLeft) {
          align = 'right'
          tx = area.x + area.w - 4 * k
        }
        // The dot sits ON the trace, so its label is over the trace whichever
        // side it takes: plate it like every other caption here.
        plated(text, tx, top, align)
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
        // The labels stay on their whole 90° values; the FRAME runs a little
        // past them, so a curve that holds an extreme — the integrator's +90°
        // at every frequency, a two-pole low-pass's −180° — is drawn inside
        // the plot instead of along its border.
        const frame = phaseFrame(plo, phi)
        const py = (d) => area.y + area.h - ((d - frame.lo) / (frame.hi - frame.lo)) * area.h

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
          plated(a.text, area.x + area.w - 8 * k, placeAt(py(a.deg) + 4 * k), 'right')
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
