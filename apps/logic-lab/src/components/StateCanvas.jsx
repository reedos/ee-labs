import React from 'react'
import { COLORS, useCanvas } from '@ee-labs/ui'

// The state machine diagram: states as circles on a ring, transitions as arcs
// labelled with the input that takes them.
//
// Built for the Computer Lab as well as this one (PROGRAM.md §4). `outputs`
// draws a Moore output inside the circle, which is what an instruction decoder
// needs, and `encoding` prints each state's bits beside its name so that the
// picture and the equations name the same thing.
//
// The Logic Lab's own state machines are Group F, which is specified and not
// built (LOGIC_LAB_PLAN.md §9). This component ships now because the props
// were designed with the diagram, and its geometry is tested against a machine
// the engine builds.

const R = 26

/** Where each state sits, as a fraction of the canvas. A ring, largest first. */
export function layoutOf(states, w, h) {
  const cx = w / 2
  const cy = h / 2
  const rad = Math.min(w, h) / 2 - R - 26
  if (states.length === 1) return { [states[0]]: { x: cx, y: cy } }
  return Object.fromEntries(
    states.map((s, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / states.length
      return [s, { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) }]
    }),
  )
}

export default function StateCanvas({ states = [], edges = [], encoding = null, active = null, taken = null, outputs = false, height = 260 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const at = layoutOf(states, w, h)

      // The arcs first, so a circle always sits over its own edges.
      for (const e of edges) {
        const a = at[e.from]
        const b = at[e.to]
        if (!a || !b) continue
        const lit = taken && taken.from === e.from && taken.to === e.to
        ctx.strokeStyle = lit ? COLORS.marker : COLORS.axis
        ctx.fillStyle = lit ? COLORS.marker : COLORS.text
        ctx.lineWidth = lit ? 2 : 1
        if (e.from === e.to) drawSelf(ctx, a, e.label)
        else drawArc(ctx, a, b, e.label)
      }

      ctx.lineWidth = 1
      ctx.textAlign = 'center'
      for (const s of states) {
        const p = at[s]
        if (!p) continue
        const lit = s === active
        ctx.beginPath()
        ctx.arc(p.x, p.y, R, 0, 2 * Math.PI)
        ctx.fillStyle = lit ? 'rgba(56, 224, 176, 0.18)' : COLORS.bg
        ctx.fill()
        ctx.strokeStyle = lit ? COLORS.trace : COLORS.axis
        ctx.lineWidth = lit ? 2 : 1
        ctx.stroke()
        ctx.lineWidth = 1
        ctx.fillStyle = lit ? COLORS.trace : COLORS.textBright
        ctx.font = '13px ui-monospace, monospace'
        const out = outputs && edges.find((e) => e.from === s && e.out)
        ctx.fillText(s, p.x, p.y + (out ? -1 : 4))
        if (out) {
          ctx.font = '10px ui-monospace, monospace'
          ctx.fillStyle = COLORS.spectrum
          ctx.fillText(
            Object.entries(out.out)
              .map(([k, v]) => `${k}=${v}`)
              .join(' '),
            p.x,
            p.y + 12,
          )
        }
        if (encoding && encoding[s]) {
          ctx.font = '10px ui-monospace, monospace'
          ctx.fillStyle = COLORS.text
          ctx.fillText(encoding[s], p.x, p.y + R + 14)
        }
      }
    },
    [JSON.stringify(states), JSON.stringify(edges), JSON.stringify(encoding), active, JSON.stringify(taken), outputs, height],
  )

  return <canvas ref={ref} className="state-canvas" style={{ height }} role="img" aria-label="State machine diagram" />
}

function drawArc(ctx, a, b, label) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  // Bow the arc to one side, so the two directions between a pair do not overlap.
  const bow = 22
  const mx = (a.x + b.x) / 2 - uy * bow
  const my = (a.y + b.y) / 2 + ux * bow
  const from = { x: a.x + ux * R, y: a.y + uy * R }
  const to = { x: b.x - ux * R, y: b.y - uy * R }
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.quadraticCurveTo(mx, my, to.x, to.y)
  ctx.stroke()
  head(ctx, to, Math.atan2(to.y - my, to.x - mx))
  ctx.font = '11px ui-monospace, monospace'
  ctx.fillText(label, mx - uy * 8, my + ux * 8 + 4)
}

function drawSelf(ctx, p, label) {
  ctx.beginPath()
  ctx.arc(p.x, p.y - R - 10, 14, 0.4 * Math.PI, 2.6 * Math.PI)
  ctx.stroke()
  head(ctx, { x: p.x + 4, y: p.y - R - 1 }, 2.2)
  ctx.font = '11px ui-monospace, monospace'
  ctx.fillText(label, p.x, p.y - R - 30)
}

function head(ctx, at, angle) {
  const s = 6
  ctx.beginPath()
  ctx.moveTo(at.x, at.y)
  ctx.lineTo(at.x - s * Math.cos(angle - 0.4), at.y - s * Math.sin(angle - 0.4))
  ctx.lineTo(at.x - s * Math.cos(angle + 0.4), at.y - s * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()
}
