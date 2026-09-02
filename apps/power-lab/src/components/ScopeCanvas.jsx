import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt } from '@ee-labs/ui'
import { TRACES } from '../experiments.js'
import { axisFmt, fitLeftAxis, scopeRange } from '../format.js'

/** One colour per trace, kept apart from the axis chrome. */
export const TRACE_COLORS = {
  vin: COLORS.spectrum,
  vsw: COLORS.spectrum,
  vrect: COLORS.phase,
  vout: COLORS.trace,
  vL: COLORS.phase,
  vD: '#f4a261',
  iL: COLORS.response,
  iC: COLORS.marker,
  iR: '#b5e48c',
  iQ: '#ffd166',
  iD: '#8ecae6',
  iin: COLORS.textBright,
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

/**
 * The scope: the converter's waveforms over two periods, voltages on the left
 * axis and currents on the right, each axis ranged to the traces it is
 * showing. The ranging matters: with v_sw hidden the output's few millivolts
 * of ripple fill the axis instead of drawing as a flat line under 12 V.
 *
 * The waveform carries both ends of every segment (steady.js), so the
 * switching edges plot vertical without any help here; the edge instants are
 * marked and named in the band above the frame.
 *
 * The time axis is in microseconds for a switching period and milliseconds
 * for a line cycle: the unit follows the period.
 */
export default function ScopeCanvas({ wf, baseWf, traces }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const shown = traces.filter((k) => wf.sig[k])
      const volts = shown.filter((k) => TRACES[k].axis === 'V')
      const amps = shown.filter((k) => TRACES[k].axis === 'A')
      const k0 = plotArea(w, h).k
      const area = plotArea(w, h, { rightAxis: amps.length > 0, topInset: 16 * k0 })
      const k = area.k
      const unit = wf.T >= 1e-3 ? 1e3 : 1e6
      const us = wf.t.map((t) => t * unit)
      const xMin = us[0]
      const xMax = us[us.length - 1]

      const rangeOf = (keys) => scopeRange(wf, baseWf, keys)

      const [vLo, vHi] = rangeOf(volts)
      const [aLo, aHi] = rangeOf(amps)

      // Frame and left axis on the voltage range (or the current range when
      // no voltage is shown).
      const leftIsV = volts.length > 0
      const [lLo, lHi] = leftIsV ? [vLo, vHi] : [aLo, aHi]
      const fmtLeft = axisFmt(lLo, lHi, leftIsV ? 'V' : 'A')
      // An axis zoomed onto millivolts of ripple needs a wider gutter than one
      // showing whole volts, so the frame is fitted to its own labels.
      const framed = fitLeftAxis(ctx, area, [fmtLeft(lLo), fmtLeft(lHi), fmtLeft((lLo + lHi) / 2)], k)
      const { sx, sy } = drawFrame(
        ctx,
        framed,
        xMin,
        xMax,
        lLo,
        lHi,
        (v) => fmt(v / unit, 's', 3),
        fmtLeft,
        { zeroLine: lLo < 0 && lHi > 0, xTitle: 'Time', yTitle: leftIsV ? 'Voltage (V)' : 'Current (A)' },
      )
      const area2 = framed
      const syA = (v) => area2.y + area2.h - ((v - aLo) / (aHi - aLo)) * area2.h

      // Right axis for the currents, when the left is taken by voltages.
      if (leftIsV && amps.length) {
        ctx.save()
        ctx.font = `${Math.round(11 * k)}px ${MONO}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = COLORS.text
        const n = Math.max(2, Math.floor(area2.h / (46 * k)))
        const fmtA = axisFmt(aLo, aHi, 'A')
        for (let i = 0; i <= n; i++) {
          const v = aLo + ((aHi - aLo) * i) / n
          ctx.fillText(fmtA(v), area2.x + area2.w + 8 * k, syA(v))
        }
        ctx.font = `${Math.round(12 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.translate(w - 14 * k, area2.y + area2.h / 2)
        ctx.rotate(Math.PI / 2)
        ctx.textAlign = 'center'
        ctx.fillText('Current (A)', 0, 0)
        ctx.restore()
      }

      ctx.save()
      // Edge markers and their names, in the band above the frame.
      ctx.font = `${Math.round(10 * k)}px ${MONO}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      for (const e of wf.edges) {
        const x = sx(e.t * unit)
        ctx.strokeStyle = COLORS.gridMajor
        ctx.setLineDash([3 * k, 3 * k])
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x + 0.5, area2.y)
        ctx.lineTo(x + 0.5, area2.y + area2.h)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = COLORS.text
        ctx.fillText(e.name, x + 3 * k, area2.y - 3 * k)
      }

      ctx.beginPath()
      ctx.rect(area2.x, area2.y, area2.w, area2.h)
      ctx.clip()
      for (const key of shown) {
        const ys = wf.sig[key]
        const map = TRACES[key].axis === 'V' ? sy : leftIsV ? syA : sy
        ctx.strokeStyle = TRACE_COLORS[key]
        ctx.lineWidth = 2 * k
        ctx.beginPath()
        for (let i = 0; i < us.length; i++) {
          if (i === 0) ctx.moveTo(sx(us[i]), map(ys[i]))
          else ctx.lineTo(sx(us[i]), map(ys[i]))
        }
        ctx.stroke()
      }
      ctx.restore()

      // Legend, top right of the band.
      ctx.save()
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      let x = area2.x + area2.w
      for (const key of [...shown].reverse()) {
        ctx.fillStyle = TRACE_COLORS[key]
        const label = TRACES[key].label
        ctx.fillText(label, x, area2.y - 3 * k)
        x -= ctx.measureText(label).width + 14 * k
      }
      ctx.restore()
    },
    [wf, baseWf, traces],
  )
  return <canvas ref={ref} className="plot" role="img" aria-label="Scope: the circuit's waveforms over two periods" />
}
