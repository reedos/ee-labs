import React from 'react'
import { useCanvas } from '@ee-labs/ui'
import { COLORS } from '@ee-labs/ui'
import { fmt } from '@ee-labs/ui'

/**
 * The cross-section, drawn to scale, in the place a schematic holds in every
 * other lab.
 *
 * Layers stack downward with their thicknesses in proportion, each labelled
 * with what it is and how heavily it is doped. A layer thinner than two pixels
 * would disappear, so the drawing gives every layer a floor of two pixels and
 * says so in the caption when it has had to.
 */
const FILL = {
  p: '#f0a23c',
  n: '#5fa8ff',
  depleted: '#2a3444',
  oxide: '#b98cf0',
  metal: '#7d8b9c',
  intrinsic: '#38e0b0',
}
const MIN_PX = 2

export default function CrossSection({ stack, className = '' }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!stack || !stack.layers.length) return
      const pad = 10
      const labelW = Math.min(190, Math.max(120, w * 0.36))
      const barX = pad
      const barW = Math.max(40, w - labelW - 3 * pad)
      const total = stack.layers.reduce((s, l) => s + l.thickness, 0)
      const usable = h - 2 * pad
      // Every layer gets at least MIN_PX so that a 10 nm oxide beside a 1 µm
      // substrate is still visible. The caption says when that happened.
      const raw = stack.layers.map((l) => (l.thickness / total) * usable)
      const floored = raw.map((v) => Math.max(v, MIN_PX))
      const excess = floored.reduce((s, v) => s + v, 0) - usable
      const shrinkable = floored.reduce((s, v, i) => s + (raw[i] > MIN_PX ? v : 0), 0)
      const heights = floored.map((v, i) => (raw[i] > MIN_PX && shrinkable > 0 ? v - (excess * v) / shrinkable : v))
      const exaggerated = raw.some((v, i) => v < MIN_PX - 1e-9 && floored[i] > v)

      let y = pad
      ctx.textBaseline = 'middle'
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
      stack.layers.forEach((l, i) => {
        const hh = heights[i]
        ctx.fillStyle = FILL[l.fill] || COLORS.grid
        ctx.globalAlpha = l.fill === 'depleted' ? 1 : 0.55
        ctx.fillRect(barX, y, barW, hh)
        ctx.globalAlpha = 1
        ctx.strokeStyle = COLORS.axis
        ctx.lineWidth = 1
        ctx.strokeRect(barX + 0.5, y + 0.5, barW - 1, Math.max(1, hh - 1))
        ctx.fillStyle = COLORS.textBright
        const label = l.doping > 0 ? `${l.name}, ${fmt(l.doping / 1e6, 'cm⁻³', 3)}` : l.name
        ctx.fillText(label, barX + barW + pad, y + hh / 2)
        y += hh
      })
      ctx.fillStyle = COLORS.text
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.fillText(exaggerated ? `${stack.title} · thinnest layers drawn at 2 px` : stack.title, barX, h - 4)
    },
    [stack],
  )
  return <canvas ref={ref} className={`cross-section ${className}`} aria-label={stack ? stack.title : 'cross-section'} />
}
