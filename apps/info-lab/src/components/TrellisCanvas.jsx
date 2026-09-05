import React from 'react'
import { COLORS, useCanvas } from '@ee-labs/ui'

// The trellis walker: states down, time across, every branch drawn.
//
// This is the lab's own interaction model (INFORMATION_LAB_PLAN.md Decision 3).
// It is built against the Logic Lab's `StateCanvas` prop shape, so a promotion
// into `packages/ui` when the Computer Lab claims it is a move rather than a
// rewrite: `states` and `edges` mean what they mean there, and everything this
// lab adds is a further prop.
//
// The whole picture is computed as data by `sceneOf` before anything is drawn,
// and the draw call reads that and nothing else. A test of the props measures
// what the reader sees.

const R = 7

/**
 * The picture as data.
 *
 * @param {object} o
 *   `states`      the state names, top to bottom
 *   `steps`       one entry per step, each `{ states: [{ metric, from, bit, branches }] }`
 *   `path`        the state the survivor sits in at each column
 *   `step`        the column the scrubber sits at, or null for all of them
 *   `traceback`   draw the surviving path backwards from the end
 * @returns {{ columns, nodes, branches, width, height }}
 */
export function sceneOf({ states = [], steps = [], path = [], step = null, traceback = true, width = 640, height = 260 }) {
  const pad = { l: 42, r: 16, t: 16, b: 26 }
  const cols = steps.length + 1
  const dx = cols > 1 ? (width - pad.l - pad.r) / (cols - 1) : 0
  const dy = states.length > 1 ? (height - pad.t - pad.b) / (states.length - 1) : 0
  const at = (col, state) => ({ x: pad.l + col * dx, y: pad.t + state * dy })
  const upTo = step == null ? steps.length : Math.min(step, steps.length)

  const nodes = []
  for (let col = 0; col <= steps.length; col++)
    for (let s = 0; s < states.length; s++) {
      const cell = col > 0 ? steps[col - 1].states[s] : null
      const metric = col === 0 ? (s === 0 ? 0 : Infinity) : cell.metric
      nodes.push({
        col,
        state: s,
        ...at(col, s),
        metric,
        reached: Number.isFinite(metric),
        // The state the survivor is in at this column, which the traceback
        // walks. Drawn filled rather than outlined.
        onPath: path[col] === s,
        shown: col <= upTo,
      })
    }

  const branches = []
  steps.forEach((one, i) => {
    one.states.forEach((cell, s) => {
      for (const br of cell.branches) {
        branches.push({
          step: i,
          from: br.from,
          to: s,
          bit: br.bit,
          out: br.out,
          branch: br.branch,
          total: br.total,
          survivor: !!br.survivor,
          a: at(i, br.from),
          b: at(i + 1, s),
          shown: i < upTo,
          // The branch the traceback runs along, which is the survivor into a
          // state the path passes through.
          onPath: traceback && !!br.survivor && path[i] === br.from && path[i + 1] === s,
        })
      }
    })
  })
  return { columns: cols, nodes, branches, radius: R, width, height, upTo }
}

export default function TrellisCanvas({ states = [], steps = [], path = [], step = null, traceback = true, height = 260 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const scene = sceneOf({ states, steps, path, step, traceback, width: w, height: h })

      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'right'
      // The state labels down the left, which are the encoder's stored bits.
      states.forEach((name, s) => {
        const node = scene.nodes.find((n) => n.col === 0 && n.state === s)
        ctx.fillStyle = COLORS.text
        ctx.fillText(name, node.x - R - 6, node.y)
      })

      // The discarded branches first, then the survivors over them, then the
      // traceback over both. Three passes, so a survivor is never hidden by a
      // branch drawn after it.
      for (const pass of ['discarded', 'survivor', 'path']) {
        for (const br of scene.branches) {
          if (!br.shown) continue
          if (pass === 'discarded' && br.survivor) continue
          if (pass === 'survivor' && (!br.survivor || br.onPath)) continue
          if (pass === 'path' && !br.onPath) continue
          ctx.beginPath()
          ctx.moveTo(br.a.x, br.a.y)
          ctx.lineTo(br.b.x, br.b.y)
          ctx.strokeStyle = pass === 'path' ? COLORS.marker : pass === 'survivor' ? COLORS.trace : COLORS.grid
          ctx.lineWidth = pass === 'path' ? 2.5 : pass === 'survivor' ? 1.5 : 1
          ctx.stroke()
        }
      }
      ctx.lineWidth = 1

      // The states, with the metric of the survivor into each.
      ctx.textAlign = 'center'
      for (const node of scene.nodes) {
        if (!node.shown) continue
        ctx.beginPath()
        ctx.arc(node.x, node.y, R, 0, 2 * Math.PI)
        ctx.fillStyle = node.onPath ? COLORS.marker : node.reached ? COLORS.bg : COLORS.grid
        ctx.fill()
        ctx.strokeStyle = node.reached ? COLORS.axis : COLORS.grid
        ctx.stroke()
        if (node.reached && node.col === scene.upTo && scene.upTo > 0) {
          ctx.fillStyle = COLORS.textBright
          ctx.fillText(String(round(node.metric)), node.x, node.y - R - 8)
        }
      }

      // The step numbers along the bottom.
      ctx.fillStyle = COLORS.text
      for (let col = 0; col <= steps.length; col++) {
        if (steps.length > 16 && col % 2) continue
        const node = scene.nodes.find((n) => n.col === col && n.state === 0)
        ctx.fillText(String(col), node.x, h - 10)
      }
    },
    [JSON.stringify(states), stamp(steps), JSON.stringify(path), step, traceback, height],
  )

  return <canvas ref={ref} className="trellis-canvas" style={{ height }} role="img" aria-label="Trellis, with the survivor into each state" />
}

const round = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : '—')

/** A cheap identity for the steps, so a redraw follows a decode and not a render. */
const stamp = (steps) => steps.map((s) => s.states.map((c) => `${c.from}${c.bit}${round(c.metric)}`).join('')).join('|')
