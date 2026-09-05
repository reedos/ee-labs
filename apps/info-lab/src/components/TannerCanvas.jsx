import React from 'react'
import { COLORS, useCanvas } from '@ee-labs/ui'

// The Tanner graph: variable nodes in a row, check nodes above them, and one
// edge for each one in the parity-check matrix.
//
// Each edge is coloured by the message on it at the iteration the scrubber sits
// at. A positive belief argues for a zero and is drawn in the trace colour, a
// negative one argues for a one and is drawn in the marker colour, and the
// width of the line is the size of the belief. A check that the word fails is
// drawn filled.

const RV = 9
const RC = 9

/**
 * The picture as data.
 *
 * @param {object} o
 *   `graph`      from `tannerGraph(H)`
 *   `beliefs`    one number per edge, or null before any iteration
 *   `bits`       the hard decision at this iteration
 *   `failing`    which checks the word fails, as 0 or 1 per check
 */
export function sceneOf({ graph, beliefs = null, bits = null, failing = null, width = 640, height = 260 }) {
  const pad = { l: 24, r: 24, t: 34, b: 40 }
  const vStep = graph.n > 1 ? (width - pad.l - pad.r) / (graph.n - 1) : 0
  const cStep = graph.m > 1 ? (width - pad.l - pad.r) / (graph.m - 1) : 0
  const yV = height - pad.b
  const yC = pad.t
  const vars = Array.from({ length: graph.n }, (_, v) => ({
    index: v,
    x: pad.l + v * vStep,
    y: yV,
    bit: bits ? bits[v] : null,
  }))
  const checks = Array.from({ length: graph.m }, (_, c) => ({
    index: c,
    x: pad.l + c * cStep,
    y: yC,
    failing: failing ? !!failing[c] : false,
  }))
  const strongest = beliefs ? Math.max(1e-9, ...beliefs.map((b) => Math.abs(b))) : 1
  const edges = graph.edges.map((e, i) => {
    const belief = beliefs ? beliefs[i] : 0
    return {
      index: i,
      variable: e.variable,
      check: e.check,
      belief,
      // Zero to one, so a pane can draw the strength without knowing the scale.
      strength: beliefs ? Math.min(1, Math.abs(belief) / strongest) : 0,
      sign: belief > 0 ? 1 : belief < 0 ? -1 : 0,
      a: vars[e.variable],
      b: checks[e.check],
    }
  })
  return { vars, checks, edges, radius: { variable: RV, check: RC }, width, height, strongest }
}

export default function TannerCanvas({ graph, beliefs = null, bits = null, failing = null, height = 260 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const scene = sceneOf({ graph, beliefs, bits, failing, width: w, height: h })

      for (const e of scene.edges) {
        ctx.beginPath()
        ctx.moveTo(e.a.x, e.a.y)
        ctx.lineTo(e.b.x, e.b.y)
        ctx.strokeStyle = e.sign === 0 ? COLORS.axis : e.sign > 0 ? COLORS.trace : COLORS.marker
        ctx.globalAlpha = beliefs ? 0.25 + 0.75 * e.strength : 0.5
        ctx.lineWidth = beliefs ? 0.6 + 2 * e.strength : 1
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.lineWidth = 1

      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const c of scene.checks) {
        ctx.beginPath()
        ctx.rect(c.x - RC, c.y - RC, 2 * RC, 2 * RC)
        ctx.fillStyle = c.failing ? COLORS.marker : COLORS.bg
        ctx.fill()
        ctx.strokeStyle = c.failing ? COLORS.marker : COLORS.axis
        ctx.stroke()
        ctx.fillStyle = c.failing ? COLORS.bg : COLORS.text
        ctx.fillText('+', c.x, c.y + 1)
      }
      for (const v of scene.vars) {
        ctx.beginPath()
        ctx.arc(v.x, v.y, RV, 0, 2 * Math.PI)
        ctx.fillStyle = COLORS.bg
        ctx.fill()
        ctx.strokeStyle = COLORS.axis
        ctx.stroke()
        ctx.fillStyle = v.bit === null ? COLORS.text : v.bit ? COLORS.spectrum : COLORS.textBright
        ctx.fillText(v.bit === null ? String(v.index + 1) : String(v.bit), v.x, v.y + 1)
      }

      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      ctx.fillText('checks', 6, 12)
      ctx.fillText('bits', 6, h - 12)
    },
    [stamp(graph), beliefs ? beliefs.map((b) => Math.round(b * 100)).join(',') : '', bits ? bits.join('') : '', failing ? failing.join('') : '', height],
  )

  return <canvas ref={ref} className="tanner-canvas" style={{ height }} role="img" aria-label="Tanner graph, with the belief on each edge" />
}

const stamp = (graph) => `${graph.n}:${graph.m}:${graph.edges.length}`
