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
 * An optional GHOST pair (`ghostMag`, `ghostPhase`, `ghostLabel`) draws a
 * second, dimmed loop under the live one — the lead lesson's uncompensated
 * L = K·P(s), so "phase added between the zero and the pole" is the gap
 * between two curves rather than a sentence.
 */
export default function BodeCanvas({
  freqs,
  mag,
  phase,
  showPhase,
  markers = [],
  crossover = null,
  phaseCrossover = null,
  yUnit = 'dB',
  ghostMag = null,
  ghostPhase = null,
  ghostLabel = '',
  // A one-time reading lesson: 'phasemargin' or 'gainmargin', matching
  // App.jsx's `active?.callout` — the SAME field that already rings the
  // topbar's own field for these two lessons, the first to name each
  // margin. A student review of this exact plot: "mostly noise", "never
  // told how to read it", and the margin trusted from the topbar number
  // rather than seen — the missing sentence was "the margin is the
  // distance from the phase curve to −180°". A picture answers that once;
  // every other lesson's Bode plot is unchanged.
  teach = null,
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
      // decades of amplitude, where a reader expects them.
      let lo = Infinity
      let hi = -Infinity
      // The ghost shares the frame, so the range holds both curves.
      for (const arr of ghostMag ? [mag, ghostMag] : [mag]) {
        for (let i = 0; i < arr.length; i++) {
          const v = db(arr[i])
          if (Number.isFinite(v)) {
            if (v < lo) lo = v
            if (v > hi) hi = v
          }
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

      // The phase axis's own scale, hoisted here rather than computed only
      // inside "draw the phase trace" below — the crossover markers are
      // drawn BEFORE either trace, and need to ask where the phase trace
      // sits at their frequency to place their own label clear of it.
      let phaseScale = null
      if (showPhase && phase) {
        let plo = 0
        let phi = 0
        for (const arr of ghostPhase ? [phase, ghostPhase] : [phase]) {
          for (let i = 0; i < arr.length; i++) {
            const d = (arr[i] * 180) / Math.PI
            if (d < plo) plo = d
            if (d > phi) phi = d
          }
        }
        plo = Math.min(-90, Math.floor(plo / 90) * 90)
        phi = Math.max(90, Math.ceil(phi / 90) * 90)
        const padPx = 3 * k
        const py = (d) => area.y + padPx + ((phi - d) / (phi - plo)) * (area.h - 2 * padPx)
        phaseScale = { plo, phi, py }
      }

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

      // The two frequencies a loop is read at: where the gain passes 1, and
      // where the phase passes -180. The margins are measured at those, so
      // marking them turns two numbers in the topbar into places on the plot.
      const named = [...markers]
      if (crossover) named.push({ f: crossover, label: 'gain = 1' })
      if (phaseCrossover) named.push({ f: phaseCrossover, label: 'phase = −180°' })
      // Each label sits clear of BOTH traces at its own frequency: it used to
      // sit fixed at the top, and on a loop whose phase trace runs near the
      // top there too (L11, "The plant that needs feedback") "gain = 1"
      // printed right over the phase curve. Nearest-sample lookup on the
      // shared freqs grid is exact enough at 900 points to say where each
      // trace actually is, and the label goes on whichever side — above or
      // below both traces — has the bigger gap; two labels stack within
      // their own side rather than sharing one shared row counter.
      let topRow = 0
      let botRow = 0
      for (const m of named) {
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
          let i = 0
          let bd = Infinity
          for (let j = 0; j < freqs.length; j++) {
            const d = Math.abs(lx(freqs[j]) - lx(m.f))
            if (d < bd) {
              bd = d
              i = j
            }
          }
          const traceYs = [sy(db(mag[i]))]
          if (phaseScale) traceYs.push(phaseScale.py((phase[i] * 180) / Math.PI))
          const topGap = Math.min(...traceYs) - area.y
          const botGap = area.y + area.h - Math.max(...traceYs)
          ctx.fillStyle = COLORS.marker
          ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
          ctx.textAlign = 'left'
          if (topGap >= botGap) {
            ctx.textBaseline = 'top'
            ctx.fillText(m.label, x + 4 * k, area.y + (4 + 14 * topRow) * k)
            topRow++
          } else {
            ctx.textBaseline = 'bottom'
            ctx.fillText(m.label, x + 4 * k, area.y + area.h - (4 + 14 * botRow) * k)
            botRow++
          }
        }
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

      // The ghost first, so the live trace paints over it where they meet.
      if (ghostMag) {
        ctx.strokeStyle = COLORS.traceGhost
        ctx.lineWidth = 1.6 * k
        ctx.lineJoin = 'round'
        ctx.beginPath()
        for (let i = 0; i < ghostMag.length; i++) {
          const x = sx(lx(freqs[i]))
          const y = sy(db(ghostMag[i]))
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        if (ghostLabel) {
          ctx.fillStyle = COLORS.text
          ctx.font = `italic ${Math.round(10.5 * k)}px ui-sans-serif, system-ui, sans-serif`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'bottom'
          ctx.fillText(ghostLabel, area.x + 6 * k, area.y + area.h - 6 * k)
        }
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

      // The reading lesson's other half: gain margin, at the frequency
      // where the phase has already reached −180°, is the vertical gap
      // between the magnitude trace and 0 dB — how much louder the loop
      // could sing before it does. Independent of the phase overlay
      // toggle, since it never touches the phase trace at all.
      if (teach === 'gainmargin' && phaseCrossover) {
        let gi = 0
        let gd = Infinity
        for (let j = 0; j < freqs.length; j++) {
          const d = Math.abs(lx(freqs[j]) - lx(phaseCrossover))
          if (d < gd) {
            gd = d
            gi = j
          }
        }
        const gx = sx(lx(phaseCrossover))
        const magY = sy(db(mag[gi]))
        const zeroY = sy(0)
        const yLo = Math.min(magY, zeroY)
        const yHi = Math.max(magY, zeroY)
        if (yHi - yLo > 2) {
          ctx.strokeStyle = COLORS.response
          ctx.lineWidth = 2 * k
          ctx.beginPath()
          ctx.moveTo(gx, yLo)
          ctx.lineTo(gx, yHi)
          const cap = 5 * k
          ctx.moveTo(gx - cap, yLo)
          ctx.lineTo(gx + cap, yLo)
          ctx.moveTo(gx - cap, yHi)
          ctx.lineTo(gx + cap, yHi)
          ctx.stroke()
          ctx.fillStyle = COLORS.response
          ctx.font = `${Math.round(11 * k)}px ui-sans-serif, system-ui, sans-serif`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText('gain margin', gx + cap + 4 * k, (yLo + yHi) / 2)
        }
      }

      if (showPhase && phase) {
        // plo/phi/py were computed above (phaseScale), before the crossover
        // markers, so their labels could already ask where this trace sits.
        const { plo, phi, py } = phaseScale

        if (ghostPhase) {
          ctx.strokeStyle = COLORS.phase
          ctx.globalAlpha = 0.32
          ctx.lineWidth = 1.3 * k
          ctx.setLineDash([6 * k, 3 * k])
          ctx.beginPath()
          for (let i = 0; i < ghostPhase.length; i++) {
            const x = sx(lx(freqs[i]))
            const y = py((ghostPhase[i] * 180) / Math.PI)
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.stroke()
          ctx.setLineDash([])
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

        // The reading lesson: a solid line at the −180° boundary, and a
        // dimension bracket at the gain crossover connecting the phase
        // trace to it. The gap the bracket spans IS the phase margin —
        // the number already in the topbar, now a distance you can see
        // rather than a value you have to trust.
        if (teach === 'phasemargin' && crossover) {
          const boundaryY = py(-180)
          ctx.strokeStyle = COLORS.marker
          ctx.globalAlpha = 0.8
          ctx.lineWidth = 1.6 * k
          ctx.beginPath()
          ctx.moveTo(area.x, boundaryY)
          ctx.lineTo(area.x + area.w, boundaryY)
          ctx.stroke()
          ctx.globalAlpha = 1
          ctx.fillStyle = COLORS.marker
          ctx.font = `${Math.round(11 * k)}px ui-sans-serif, system-ui, sans-serif`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'bottom'
          ctx.fillText('−180°', area.x + 4 * k, boundaryY - 3 * k)

          // Nearest sample to the crossover — the same lookup the marker
          // labels above already use to place themselves.
          let ci = 0
          let cd = Infinity
          for (let j = 0; j < freqs.length; j++) {
            const d = Math.abs(lx(freqs[j]) - lx(crossover))
            if (d < cd) {
              cd = d
              ci = j
            }
          }
          const cx = sx(lx(crossover))
          const phaseY = py((phase[ci] * 180) / Math.PI)
          const yLo = Math.min(phaseY, boundaryY)
          const yHi = Math.max(phaseY, boundaryY)
          if (yHi - yLo > 2) {
            ctx.strokeStyle = COLORS.response
            ctx.lineWidth = 2 * k
            ctx.beginPath()
            ctx.moveTo(cx, yLo)
            ctx.lineTo(cx, yHi)
            const cap = 5 * k
            ctx.moveTo(cx - cap, yLo)
            ctx.lineTo(cx + cap, yLo)
            ctx.moveTo(cx - cap, yHi)
            ctx.lineTo(cx + cap, yHi)
            ctx.stroke()
            ctx.fillStyle = COLORS.response
            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillText('phase margin', cx + cap + 4 * k, (yLo + yHi) / 2)
          }
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
        ctx.fillText('Phase (°)', 0, 0)
        ctx.restore()
        return
      }
      ctx.restore()
    },
    [freqs, mag, phase, showPhase, markers, crossover, phaseCrossover, yUnit, ghostMag, ghostPhase, ghostLabel, teach],
  )

  return <canvas ref={ref} className="plot" role="img" aria-label="Open-loop Bode plot: magnitude and phase, with the stability margins marked" />
}
