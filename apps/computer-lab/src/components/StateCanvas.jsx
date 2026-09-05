import React from 'react'
import { COLORS, useCanvas } from '@ee-labs/ui'

// The state machine diagram: states as circles on a ring, transitions as arcs
// labelled with the input that takes them.
//
// COPIED from apps/logic-lab/src/components/StateCanvas.jsx, prop for prop.
// That lab built it with this lab's `outputs` prop already in its signature,
// and `NEEDS.md` §3 asks the director to promote it into `packages/ui` now
// that a second lab claims it. Do not edit it here.
//
// Built for the Computer Lab as well as this one (PROGRAM.md §4). `outputs`
// draws a Moore output inside the circle, which is what an instruction decoder
// needs, and `encoding` prints each state's bits beside its name so that the
// picture and the equations name the same thing.
//
// This lab draws the multicycle control unit on it (D2), which is the largest
// worked example either lab has: five states, and each class of instruction
// walking the ones it needs.

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

/**
 * The whole picture as data, before anything is drawn: where each state sits,
 * what is written inside its circle, which circle is lit, and which arc was
 * last taken.
 *
 * The draw call reads this and nothing else, so a test of the three props the
 * Computer Lab asked for measures what the reader sees. `outputs` puts a Moore
 * output inside the circle, `encoding` prints the state's bits under it, and
 * `taken` lights one arc.
 */
export function sceneOf({ states = [], edges = [], encoding = null, active = null, taken = null, outputs = false, width = 480, height = 260 }) {
  const at = layoutOf(states, width, height)
  return {
    radius: R,
    states: states.map((name) => {
      const p = at[name] || { x: 0, y: 0 }
      // A Moore output belongs to the state, so it is the same on every arc
      // leaving it. A Mealy machine's output is on the arc, and this draws
      // nothing inside the circle for it.
      const leaving = edges.filter((e) => e.from === name && e.out)
      const same = leaving.length > 0 && leaving.every((e) => JSON.stringify(e.out) === JSON.stringify(leaving[0].out))
      const out = outputs && same ? leaving[0].out : null
      return {
        name,
        x: p.x,
        y: p.y,
        lit: name === active,
        out,
        text: out
          ? Object.entries(out)
              .map(([k, v]) => `${k}=${v}`)
              .join(' ')
          : null,
        code: encoding && encoding[name] != null ? String(encoding[name]) : null,
      }
    }),
    edges: edges.map((e) => ({
      ...e,
      self: e.from === e.to,
      lit: !!(taken && taken.from === e.from && taken.to === e.to),
      a: at[e.from] || null,
      b: at[e.to] || null,
    })),
  }
}

export default function StateCanvas({ states = [], edges = [], encoding = null, active = null, taken = null, outputs = false, height = 260 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const scene = sceneOf({ states, edges, encoding, active, taken, outputs, width: w, height: h })

      // The arcs first, so a circle always sits over its own edges.
      for (const e of scene.edges) {
        if (!e.a || !e.b) continue
        ctx.strokeStyle = e.lit ? COLORS.marker : COLORS.axis
        ctx.fillStyle = e.lit ? COLORS.marker : COLORS.text
        ctx.lineWidth = e.lit ? 2 : 1
        if (e.self) drawSelf(ctx, e.a, e.label)
        else drawArc(ctx, e.a, e.b, e.label)
      }

      ctx.lineWidth = 1
      ctx.textAlign = 'center'
      for (const st of scene.states) {
        ctx.beginPath()
        ctx.arc(st.x, st.y, R, 0, 2 * Math.PI)
        ctx.fillStyle = st.lit ? 'rgba(56, 224, 176, 0.18)' : COLORS.bg
        ctx.fill()
        ctx.strokeStyle = st.lit ? COLORS.trace : COLORS.axis
        ctx.lineWidth = st.lit ? 2 : 1
        ctx.stroke()
        ctx.lineWidth = 1
        ctx.fillStyle = st.lit ? COLORS.trace : COLORS.textBright
        ctx.font = '13px ui-monospace, monospace'
        ctx.fillText(st.name, st.x, st.y + (st.text ? -1 : 4))
        if (st.text) {
          ctx.font = '10px ui-monospace, monospace'
          ctx.fillStyle = COLORS.spectrum
          ctx.fillText(st.text, st.x, st.y + 12)
        }
        if (st.code) {
          ctx.font = '10px ui-monospace, monospace'
          ctx.fillStyle = COLORS.text
          ctx.fillText(st.code, st.x, st.y + R + 14)
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
