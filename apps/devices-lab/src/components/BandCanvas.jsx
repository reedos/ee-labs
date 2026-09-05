import React from 'react'
import { COLORS, plotArea, useCanvas } from '@ee-labs/ui'

/**
 * The band diagram: four energies against position, in electron volts, with the
 * intrinsic level at zero.
 *
 * In one uniform piece of silicon all four lines are flat, and the only one the
 * doping moves is the Fermi level. That is the whole content of Group A's last
 * two experiments, so the drawing says it by having nothing else to show.
 */
export default function BandCanvas({ ec, ev, ei, ef, className = '' }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const area = plotArea(w, h, {})
      const span = Math.max(Math.abs(ec), Math.abs(ev)) * 1.35
      const sy = (v) => area.y + area.h / 2 - (v / span) * (area.h / 2)
      ctx.save()
      ctx.strokeStyle = COLORS.axis
      ctx.strokeRect(area.x + 0.5, area.y + 0.5, area.w - 1, area.h - 1)
      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textBaseline = 'middle'
      const lines = [
        { v: ec, label: 'E_c', colour: COLORS.response, dash: [] },
        { v: ef, label: 'E_F', colour: COLORS.marker, dash: [] },
        { v: ei, label: 'E_i', colour: COLORS.text, dash: [4, 4] },
        { v: ev, label: 'E_v', colour: COLORS.spectrum, dash: [] },
      ]
      for (const l of lines) {
        ctx.strokeStyle = l.colour
        ctx.setLineDash(l.dash)
        ctx.lineWidth = 1.8
        ctx.beginPath()
        ctx.moveTo(area.x + 6, sy(l.v))
        ctx.lineTo(area.x + area.w - 46, sy(l.v))
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = l.colour
        ctx.fillText(l.label, area.x + area.w - 40, sy(l.v))
      }
      // The two readings the diagram exists to show, written where they are.
      ctx.strokeStyle = COLORS.textBright
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(area.x + area.w * 0.28, sy(ei))
      ctx.lineTo(area.x + area.w * 0.28, sy(ef))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = COLORS.textBright
      ctx.fillText(`E_F − E_i = ${(ef * 1000).toFixed(1)} meV`, area.x + area.w * 0.3, (sy(ei) + sy(ef)) / 2)
      ctx.fillText(`E_c − E_F = ${((ec - ef) * 1000).toFixed(1)} meV`, area.x + area.w * 0.3, (sy(ec) + sy(ef)) / 2)
      ctx.fillStyle = COLORS.text
      ctx.font = `${Math.round(10 * area.k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textBaseline = 'bottom'
      ctx.fillText('energy (eV), intrinsic level at zero · position', area.x, h - 4)
      ctx.restore()
    },
    [ec, ev, ei, ef],
  )
  return <canvas ref={ref} className={`band-canvas ${className}`} aria-label="Band diagram: the four energies against position" />
}
