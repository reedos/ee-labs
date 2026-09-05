import React from 'react'
import { COLORS, useCanvas } from '@ee-labs/ui'
import { ps } from '../format.js'

// The netlist drawn as gates and wires, with each net's present value beside it
// and the critical path lit.
//
// The layout is computed rather than hand-drawn, because an experiment's
// netlist is a function of its knobs and a hand layout would go stale the
// moment a width knob moved. Cells are placed by depth from the inputs, which
// is the same ordering the path list uses, so the picture reads left to right
// in the order a signal travels.

const W = 74
const H = 30
const COL = 130
const ROW = 54

/** Each cell placed by its depth from the inputs, and each source in a column of its own. */
export function layoutOf(norm) {
  const depth = new Map()
  for (const s of norm.sources) depth.set(s.out, 0)
  for (const f of norm.flops) depth.set(f.out, 0)
  const cells = [...norm.gates, ...norm.wires]
  for (let pass = 0; pass < cells.length + 1; pass++) {
    let moved = false
    for (const c of cells) {
      const ins = c.kind === 'wire' ? [c.from] : c.in
      const d = 1 + Math.max(0, ...ins.map((s) => depth.get(s) ?? 0))
      if (d !== depth.get(c.out)) {
        depth.set(c.out, d)
        moved = true
      }
    }
    if (!moved) break
  }
  const byCol = new Map()
  const place = (name) => {
    const col = depth.get(name) ?? 0
    if (!byCol.has(col)) byCol.set(col, [])
    const row = byCol.get(col).length
    byCol.get(col).push(name)
    return { name, col, row }
  }
  const nodes = norm.nets.map(place)
  const rows = Math.max(...[...byCol.values()].map((v) => v.length), 1)
  const cols = Math.max(...nodes.map((n) => n.col), 0) + 1
  return {
    nodes: nodes.map((n) => ({ ...n, x: 24 + n.col * COL, y: 26 + n.row * ROW })),
    width: 24 + cols * COL + 40,
    height: 26 + rows * ROW + 24,
    depth,
  }
}

export default function GateCanvas({ x, height }) {
  const norm = x && x.norm
  const critical = new Set((x && x.paths && x.paths.long.path) || [])
  const layout = norm ? layoutOf(norm) : { nodes: [], width: 320, height: 200 }
  const h = height || layout.height

  const ref = useCanvas(
    (ctx, w) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!norm) return
      const scale = Math.min(1, (w - 8) / layout.width)
      ctx.save()
      ctx.scale(scale, scale)
      const at = Object.fromEntries(layout.nodes.map((n) => [n.name, n]))
      const driverOf = (name) => (norm.drivers.get(name) || [])[0]

      // The wires first.
      for (const n of layout.nodes) {
        const d = driverOf(n.name)
        if (!d || d.role === 'source') continue
        const ins = d.role === 'wire' ? [d.from] : d.in || []
        for (const s of ins) {
          const from = at[s]
          if (!from) continue
          const lit = critical.has(s) && critical.has(n.name)
          ctx.strokeStyle = lit ? COLORS.marker : COLORS.axis
          ctx.lineWidth = lit ? 2 : 1
          ctx.beginPath()
          ctx.moveTo(from.x + W / 2, from.y)
          ctx.lineTo(from.x + W / 2 + 12, from.y)
          ctx.lineTo(n.x - W / 2 - 12, n.y)
          ctx.lineTo(n.x - W / 2, n.y)
          ctx.stroke()
        }
      }

      // Then the cells.
      ctx.lineWidth = 1
      ctx.textAlign = 'center'
      for (const n of layout.nodes) {
        const d = driverOf(n.name)
        const lit = critical.has(n.name)
        const value = x.res ? x.res.final[n.name] : null
        ctx.fillStyle = 'rgba(24, 32, 41, 0.9)'
        ctx.strokeStyle = lit ? COLORS.marker : value === 1 ? COLORS.trace : COLORS.axis
        roundRect(ctx, n.x - W / 2, n.y - H / 2, W, H, d && d.role === 'source' ? 14 : 6)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = COLORS.textBright
        ctx.font = '12px ui-monospace, monospace'
        ctx.fillText(n.name, n.x, n.y - 1)
        ctx.font = '10px ui-monospace, monospace'
        ctx.fillStyle = COLORS.text
        const kind = !d ? '' : d.role === 'source' ? d.kind : d.role === 'wire' ? `wire ${ps(d.delay)}` : `${d.kind} ${ps(d.delay)}`
        ctx.fillText(kind, n.x, n.y + 11)
        if (value != null) {
          ctx.fillStyle = value === 1 ? COLORS.trace : COLORS.text
          ctx.font = '13px ui-monospace, monospace'
          ctx.fillText(String(value), n.x + W / 2 + 10, n.y + 4)
        }
      }
      ctx.restore()
    },
    [norm, h, JSON.stringify([...critical])],
  )

  return <canvas ref={ref} className="gate-canvas" style={{ height: h }} role="img" aria-label="The netlist as gates" />
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
