import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt } from '@ee-labs/ui'
import { complex as cx } from '@ee-labs/network'
import { drawLegend, drawMark, drawRightAxis } from './timePlot.js'

/**
 * The frequency response, two decades either side of the circuit's own
 * frequency: `mode: 'impedance'` draws |Z| (log Ω) and ∠Z; `mode: 'bode'`
 * draws |H| in dB and ∠H. Frequency is logarithmic. Both are read from
 * `freq` (math.js freqSweep — one complex solve per point, source at 1∠0);
 * the marker at the drive frequency is `at`, the same quantity from the
 * solve the meters are showing, so it sits on the curve by construction.
 */
export default function FreqCanvas({ freq, mode, fDrive, at, corner }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const k0 = plotArea(w, h).k
      const area = plotArea(w, h, { rightAxis: true, topInset: 16 * k0 })
      const k = area.k
      const series = mode === 'bode' ? freq.H : freq.Z
      const mag = series.map((z) => (mode === 'bode' ? 20 * Math.log10(cx.cabs(z)) : Math.log10(cx.cabs(z))))
      const ang = series.map((z) => (cx.carg(z) * 180) / Math.PI)
      const lx = Float64Array.from(freq.f, (f) => Math.log10(f))
      const x0 = lx[0]
      const x1 = lx[lx.length - 1]

      // Magnitude span: whole decades for |Z|; a round number of dB for |H|,
      // with the 0 dB line kept in view for a passive circuit.
      let lo
      let hi
      let yStep
      if (mode === 'bode') {
        const mn = Math.min(...mag)
        const mx = Math.max(...mag, 0)
        yStep = mx - mn > 60 ? 20 : 10
        lo = Math.floor(mn / yStep) * yStep
        hi = Math.ceil(mx / yStep) * yStep
        if (hi === mx) hi += yStep / 2 // headroom above a curve that touches 0 dB
      } else {
        lo = Math.floor(Math.min(...mag))
        hi = Math.ceil(Math.max(...mag))
        if (hi - lo < 1) {
          lo -= 0.5
          hi += 0.5
        }
        yStep = 1
      }
      const fmtY = mode === 'bode' ? (v) => `${v.toFixed(0)} dB` : (v) => fmt(10 ** v, 'Ω', 1)
      const magLabel = mode === 'bode' ? '|H| = |V_out / V_s| (dB)' : '|Z| seen by the source (Ω)'
      const { sx, sy } = drawFrame(ctx, area, x0, x1, lo, hi, (v) => fmt(10 ** v, 'Hz', 1), fmtY, {
        xStep: 1,
        yStep,
        zeroLine: mode === 'bode',
        xTitle: 'Frequency (log)',
        yTitle: magLabel,
      })
      // Phase on the right, in 45° steps, spanning the quadrants the data visits.
      const pLo = Math.min(0, Math.floor(Math.min(...ang) / 45) * 45)
      const pHi = Math.max(0, Math.ceil(Math.max(...ang) / 45) * 45)
      const syR = drawRightAxis(ctx, area, w, pLo === pHi ? pLo - 45 : pLo, pLo === pHi ? pHi + 45 : pHi, (v) => `${v.toFixed(0)}°`, mode === 'bode' ? '∠H (degrees)' : '∠Z (degrees)', 45)

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()
      // Minor decade lines (2, 3, 5), faint — a log axis without them reads as linear.
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      for (let d = Math.floor(x0); d <= Math.ceil(x1); d++) {
        for (const m of [2, 3, 5]) {
          const v = d + Math.log10(m)
          if (v <= x0 || v >= x1) continue
          ctx.beginPath()
          ctx.moveTo(Math.round(sx(v)) + 0.5, area.y)
          ctx.lineTo(Math.round(sx(v)) + 0.5, area.y + area.h)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
      if (corner && corner.f > 10 ** x0 && corner.f < 10 ** x1) drawMark(ctx, area, sx(Math.log10(corner.f)), corner.label)

      const line = (ys, map, color, dash = null) => {
        ctx.strokeStyle = color
        ctx.lineWidth = 2 * k
        ctx.setLineDash(dash ? dash.map((d) => d * k) : [])
        ctx.beginPath()
        for (let i = 0; i < lx.length; i++) {
          if (!Number.isFinite(ys[i])) continue
          if (i === 0) ctx.moveTo(sx(lx[i]), map(ys[i]))
          else ctx.lineTo(sx(lx[i]), map(ys[i]))
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
      line(ang, syR, COLORS.phase, [6, 4])
      line(mag, sy, COLORS.response)

      // The drive: a marker line, and a dot on each curve from the meters' solve.
      if (fDrive >= 10 ** x0 && fDrive <= 10 ** x1 && at) {
        const z = mode === 'bode' ? at.H : at.Z
        const mx = sx(Math.log10(fDrive))
        ctx.strokeStyle = COLORS.marker
        ctx.lineWidth = 1.2 * k
        ctx.beginPath()
        ctx.moveTo(mx, area.y)
        ctx.lineTo(mx, area.y + area.h)
        ctx.stroke()
        const dot = (y, color) => {
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(mx, y, 4 * k, 0, Math.PI * 2)
          ctx.fill()
        }
        dot(sy(mode === 'bode' ? 20 * Math.log10(cx.cabs(z)) : Math.log10(cx.cabs(z))), COLORS.response)
        dot(syR((cx.carg(z) * 180) / Math.PI), COLORS.phase)
      }
      ctx.restore()

      drawLegend(ctx, area, [
        { label: mode === 'bode' ? '|H| dB' : '|Z|', color: COLORS.response },
        { label: 'phase', color: COLORS.phase },
        { label: `drive ${fmt(fDrive, 'Hz', 3)}`, color: COLORS.marker, dim: true },
      ])
    },
    [freq, mode, fDrive, at, corner],
  )
  return (
    <canvas
      ref={ref}
      className="plot freq"
      role="img"
      aria-label={mode === 'bode' ? 'Bode plot: gain in decibels and phase against log frequency' : 'Impedance against log frequency: magnitude and phase'}
    />
  )
}
