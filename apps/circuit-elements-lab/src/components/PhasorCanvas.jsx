import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt } from '@ee-labs/ui'
import { complex as cx } from '@ee-labs/network'
import { MONO, SANS, drawCursor, drawLegend, fmtT } from './timePlot.js'
import { turnedLabel } from '../math.js'

/**
 * The phasor diagram beside the waveforms it draws.
 *
 * Left: every steady-state voltage in `exp.phasor.volts` as an arrow from the
 * origin, all turned together by θ = ωt (the cursor sets t), the source's
 * arrow faint behind them, and the same arrows laid tip to tail as a dashed
 * chain — which lands on the source's tip because KVL holds for phasors.
 * The current is a dashed arrow on its own scale. Right: the steady-state
 * waveform of each, Im{X·e^{jωt}}, over the window, with the cursor. On a
 * wide canvas the two share one vertical scale, so a dotted guide runs from
 * each arrow's tip straight across to its dot on the waveform: the height of
 * the tip IS the instantaneous value, which is the whole idea of a phasor.
 *
 * Every arrow is a phasor from the complex solve the meters use; nothing here
 * is fitted to the time trace.
 */
export default function PhasorCanvas({ exp, x, cursor, onCursor }) {
  const { ac, omega, tEnd } = x
  const cfg = exp.phasor
  const ref = useCanvas(
    (ctx, w, h) => {
      const L = layoutOf(w, h)
      const { k, dia, frame } = L
      const tc = Math.min(tEnd, Math.max(0, cursor))
      const theta = omega * tc

      const volts = cfg.volts.map((id, i) => ({ id, label: labelFor(x.net, id, 'v'), X: ac.volt[id], color: PHASOR_COLORS[i % PHASOR_COLORS.length] }))
      const total = { id: cfg.total, label: 'v_s', X: ac.volt[cfg.total], color: COLORS.textBright }
      const I = ac.i[cfg.current]
      // Partial sums of the chain, for the diagram's extent and the dashed chain.
      const sums = []
      let acc = cx.C(0, 0)
      for (const v of volts) {
        acc = cx.cadd(acc, v.X)
        sums.push(acc)
      }
      const vMax = 1.15 * Math.max(1e-30, cx.cabs(total.X), ...volts.map((v) => cx.cabs(v.X)), ...sums.map(cx.cabs))
      const iMag = cx.cabs(I)
      // The current arrow is 0.7 of the frame's half-height whatever it is in amperes.
      const iScale = iMag > 0 ? (0.7 * vMax) / iMag : 0

      // ---- the waveform frame
      const { sx, sy } = drawFrame(ctx, frame, 0, tEnd, -vMax, vMax, fmtT, (v) => fmt(v, 'V', 2), {
        zeroLine: true,
        xTitle: 'Time from t = 0 (steady state)',
        yTitle: 'volts',
      })
      const rot = (X) => cx.cmul(X, cx.cexpj(theta))

      ctx.save()
      ctx.beginPath()
      ctx.rect(frame.x, frame.y, frame.w, frame.h)
      ctx.clip()
      const wave = (X, scale, color, { width = 2, alpha = 1, dash = null } = {}) => {
        ctx.strokeStyle = color
        ctx.globalAlpha = alpha
        ctx.lineWidth = width * k
        ctx.setLineDash(dash ? dash.map((d) => d * k) : [])
        ctx.beginPath()
        const n = Math.max(200, Math.floor(frame.w))
        for (let i = 0; i <= n; i++) {
          const t = (tEnd * i) / n
          const y = sy(scale * cx.instant(X, omega, t))
          if (i === 0) ctx.moveTo(sx(t), y)
          else ctx.lineTo(sx(t), y)
        }
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }
      wave(total.X, 1, total.color, { width: 1.2, alpha: 0.45 })
      wave(I, iScale, CURRENT_COLOR, { width: 1.5, alpha: 0.8, dash: [5, 4] })
      volts.forEach((v) => wave(v.X, 1, v.color))
      const cxp = sx(tc)
      drawCursor(ctx, frame, cxp)
      const dot = (X, scale, color) => {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(cxp, sy(scale * cx.instant(X, omega, tc)), 3.5 * k, 0, Math.PI * 2)
        ctx.fill()
      }
      dot(total.X, 1, total.color)
      dot(I, iScale, CURRENT_COLOR)
      volts.forEach((v) => dot(v.X, 1, v.color))
      ctx.restore()

      // ---- the diagram
      const c = { x: dia.x + dia.s / 2, y: dia.y + dia.s / 2 }
      const r = dia.s / 2 / vMax // pixels per volt; equals the frame's when side by side
      const px = (Z) => [c.x + Z[0] * r, c.y - Z[1] * r]

      ctx.save()
      // Crosshair and the source's circle: the radius every tip's height is measured against.
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(dia.x, c.y + 0.5)
      ctx.lineTo(dia.x + dia.s, c.y + 0.5)
      ctx.moveTo(c.x + 0.5, dia.y)
      ctx.lineTo(c.x + 0.5, dia.y + dia.s)
      ctx.stroke()
      ctx.strokeStyle = COLORS.gridMajor
      ctx.beginPath()
      ctx.arc(c.x, c.y, cx.cabs(total.X) * r, 0, Math.PI * 2)
      ctx.stroke()
      // The angle turned, as an arc from the real axis.
      ctx.strokeStyle = COLORS.marker
      ctx.globalAlpha = 0.6
      ctx.beginPath()
      ctx.arc(c.x, c.y, 14 * k, 0, -wrap2pi(theta), true)
      ctx.stroke()
      ctx.globalAlpha = 1

      // Guides across to the waveform, first, so the arrows sit on them.
      if (!L.stacked) {
        ctx.setLineDash([2 * k, 4 * k])
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.35
        for (const v of volts) {
          const [tx, ty] = px(rot(v.X))
          ctx.strokeStyle = v.color
          ctx.beginPath()
          ctx.moveTo(tx, ty)
          ctx.lineTo(cxp, ty)
          ctx.stroke()
        }
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }

      // The dashed tip-to-tail chain, landing on the source's tip.
      let from = [c.x, c.y]
      volts.forEach((v, i) => {
        const to = px(rot(sums[i]))
        arrow(ctx, k, from, to, v.color, { dash: [4, 4], alpha: 0.5, width: 1.2, head: 5 })
        from = to
      })
      // The source, faint, from the origin; the chain's end marked hollow on its tip.
      const tipS = px(rot(total.X))
      arrow(ctx, k, [c.x, c.y], tipS, total.color, { alpha: 0.55, width: 1.4 })
      ctx.strokeStyle = COLORS.textBright
      ctx.lineWidth = 1.2 * k
      ctx.beginPath()
      ctx.arc(from[0], from[1], 4.5 * k, 0, Math.PI * 2)
      ctx.stroke()
      tipLabel(ctx, k, c, tipS, total.label, total.color)
      // Each voltage from the origin, and the current on its own scale.
      for (const v of volts) {
        const tip = px(rot(v.X))
        arrow(ctx, k, [c.x, c.y], tip, v.color, { width: 2.2 })
        tipLabel(ctx, k, c, tip, v.label, v.color)
      }
      if (iScale) {
        const tipI = px(rot(cx.cscale(I, iScale)))
        arrow(ctx, k, [c.x, c.y], tipI, CURRENT_COLOR, { dash: [5, 4], width: 1.6 })
        tipLabel(ctx, k, c, tipI, 'i', CURRENT_COLOR)
      }

      // θ, top-left of the diagram.
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(`θ = ωt = ${turnedLabel(omega, tc)}`, dia.x + 4 * k, dia.y + 2 * k)
      ctx.fillText(`t = ${fmt(tc, 's', 3)}`, dia.x + 4 * k, dia.y + 16 * k)
      ctx.restore()

      drawLegend(ctx, L.stacked ? { ...frame, y: dia.y, k } : frame, [
        ...volts.map((v) => ({ label: v.label, color: v.color })),
        { label: total.label, color: total.color, dim: true },
        { label: 'i (own scale)', color: CURRENT_COLOR, dim: true },
      ])
    },
    [exp, x, cursor],
  )
  return (
    <canvas
      ref={ref}
      className="plot phasor"
      role="img"
      aria-label="Phasor diagram: each steady-state voltage as an arrow, beside the waveform its tip's height traces; drag to turn"
      {...scrub(onCursor, tEnd)}
    />
  )
}

// Voltages take the scope's left-axis order after the source: the resistor
// blue, the capacitor purple, an inductor green. The current is the scope's
// right-axis orange, so it is the same colour in both views.
const PHASOR_COLORS = [COLORS.response, COLORS.phase, COLORS.trace]
const CURRENT_COLOR = COLORS.spectrum

/** `v_R` for R1 when the type is unique in the circuit, `v_R1` otherwise. */
function labelFor(net, id, q) {
  const e = net.elements.find((el) => el.id === id)
  if (!e) return `${q}_${id}`
  const sameType = net.elements.filter((el) => el.type === e.type && el.type !== 'V').length
  return `${q}_${sameType === 1 ? e.type : id}`
}

const wrap2pi = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)

/**
 * Where the diagram and the frame go. Side by side when there is room, the
 * diagram a square as tall as the frame so the two share a vertical scale;
 * stacked on a phone, the diagram above.
 */
export function layoutOf(w, h) {
  const k = plotArea(w, h).k
  const top = (14 + 16) * k
  const bottom = 48 * k
  const left = 76 * k
  const right = 18 * k
  if (w >= 560) {
    const side = Math.max(40, h - top - bottom)
    const dia = { x: 8 * k, y: top, s: side }
    const fx = dia.x + side + left
    return { k, stacked: false, dia, frame: { x: fx, y: top, w: Math.max(1, w - fx - right), h: side, k } }
  }
  const side = Math.max(40, Math.min(w - 16 * k, (h - top - bottom) * 0.5))
  const dia = { x: (w - side) / 2, y: top, s: side }
  const fy = top + side + 22 * k
  return { k, stacked: true, dia, frame: { x: left, y: fy, w: Math.max(1, w - left - right), h: Math.max(40, h - fy - bottom), k } }
}

function arrow(ctx, k, [x0, y0], [x1, y1], color, { width = 2, alpha = 1, dash = null, head = 7 } = {}) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.lineWidth = width * k
  ctx.setLineDash(dash ? dash.map((d) => d * k) : [])
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  ctx.setLineDash([])
  if (len > 1e-6) {
    const hs = head * k
    const ux = dx / len
    const uy = dy / len
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x1 - hs * ux + 0.5 * hs * uy, y1 - hs * uy - 0.5 * hs * ux)
    ctx.lineTo(x1 - hs * ux - 0.5 * hs * uy, y1 - hs * uy + 0.5 * hs * ux)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/** A label just past an arrow's tip, along its direction. */
function tipLabel(ctx, k, c, [x1, y1], text, color) {
  const dx = x1 - c.x
  const dy = y1 - c.y
  const len = Math.hypot(dx, dy) || 1
  ctx.save()
  ctx.font = `${Math.round(11 * k)}px ${SANS}`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x1 + (dx / len) * 12 * k, y1 + (dy / len) * 12 * k)
  ctx.restore()
}

/** Drag anywhere on the canvas: the pointer's x over the waveform frame sets the cursor time. */
function scrub(onCursor, tEnd) {
  if (!onCursor) return {}
  const timeAt = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const { frame } = layoutOf(rect.width, rect.height)
    const f = (e.clientX - rect.left - frame.x) / frame.w
    return Math.min(tEnd, Math.max(0, f * tEnd))
  }
  return {
    style: { touchAction: 'pan-y', cursor: 'col-resize' },
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      onCursor(timeAt(e))
    },
    onPointerMove: (e) => {
      if (e.buttons & 1) onCursor(timeAt(e))
    },
  }
}
