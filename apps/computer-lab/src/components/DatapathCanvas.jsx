import React from 'react'
import { COLORS, useCanvas } from '@ee-labs/ui'
import { BLOCKS, WIRES } from '../engine/datapath.js'
import { hex } from '../format.js'

// The datapath, with every wire lit.
//
// This is the lab's centre. Every wire of `engine/datapath.js` is drawn at the
// cycle the reader is on, carrying its value. A wire that has no meaningful
// value in that cycle is drawn grey rather than left out, so a reader can see
// what the instruction is not using (plan §4.2).
//
// The control signals are their own layer, drawn thinner and in their own
// colour, because a reader who is following the data should be able to ignore
// them and a reader who is following the control should be able to find them.
//
// The whole picture is computed as data by `geometryOf` before anything is
// drawn, and the draw call reads that and nothing else. `zoom: 'block'`
// collapses the register file and the two memories into one box each, which is
// how the picture holds at 390 px.

const W = 96
const H = 34
const GAP_X = 34
const GAP_Y = 26
const PAD = { l: 14, t: 18, r: 14, b: 22 }

/** The columns and rows the blocks sit on, as pixels. */
export function geometryOf({ width = 900, zoom = 'full', cycle = 0, run = null, pinned = [] } = {}) {
  const cols = Math.max(...BLOCKS.map((b) => b.col)) + 1
  const rows = Math.max(...BLOCKS.map((b) => b.row)) + 1
  const scale = Math.min(1, (width - PAD.l - PAD.r) / (cols * W + (cols - 1) * GAP_X))
  const w = W * scale
  const h = H * scale
  const gapX = GAP_X * scale
  const gapY = GAP_Y * scale
  const shown = zoom === 'block' ? BLOCKS.filter((b) => !['regMux', 'aluMux', 'wbMux', 'pcMux', 'branchAdd'].includes(b.id)) : BLOCKS
  const boxes = {}
  for (const b of BLOCKS) {
    const x = PAD.l + b.col * (w + gapX)
    const y = PAD.t + b.row * (h + gapY)
    boxes[b.id] = { ...b, x, y, w, h, cx: x + w / 2, cy: y + h / 2, hidden: !shown.includes(b) }
  }
  const trace = run && run.trace ? run.trace[Math.min(cycle, run.trace.length - 1)] : null
  const values = trace ? trace.wires : null
  const active = trace ? trace.active : null
  const wires = WIRES.map((wire) => {
    const from = boxes[wire.from]
    const to = boxes[wire.to]
    const lit = !!(active && active.has(wire.name))
    return {
      ...wire,
      lit,
      pinned: pinned.includes(wire.name),
      value: values ? values[wire.name] : null,
      x1: from.x + from.w,
      y1: from.cy,
      x2: to.x,
      y2: to.cy,
      mid: { x: (from.x + from.w + to.x) / 2, y: (from.cy + to.cy) / 2 },
    }
  })
  return {
    width,
    height: PAD.t + rows * (h + gapY) + PAD.b,
    scale,
    boxes: Object.values(boxes),
    byId: boxes,
    wires,
    cycle,
    instr: trace ? trace.instr : null,
    lit: wires.filter((wire) => wire.lit).length,
  }
}

/** What one wire's value reads as, in the width the picture has for it. */
export function textOf(wire) {
  const v = wire.value
  if (v == null) return ''
  if (wire.kind === 'control') return typeof v === 'string' ? v : String(v)
  if (wire.name === 'instr') return hex(v)
  if (typeof v === 'string') return v
  return String(v)
}

export default function DatapathCanvas({ run = null, cycle = 0, pinned = [], onPin = null, zoom = 'full', height }) {
  const ref = useCanvas(
    (ctx, w) => {
      const geo = geometryOf({ width: w, zoom, cycle, run, pinned })
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, geo.height)
      ctx.lineWidth = 1
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // The wires first, so a block always sits over the wires that reach it.
      for (const wire of geo.wires) {
        const control = wire.kind === 'control'
        ctx.strokeStyle = wire.pinned ? COLORS.marker : wire.lit ? (control ? COLORS.spectrum : COLORS.trace) : COLORS.grid
        ctx.lineWidth = wire.pinned ? 2 : wire.lit ? (control ? 1 : 1.6) : 1
        if (control) ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(wire.x1, wire.y1)
        ctx.lineTo(wire.mid.x, wire.y1)
        ctx.lineTo(wire.mid.x, wire.y2)
        ctx.lineTo(wire.x2, wire.y2)
        ctx.stroke()
        ctx.setLineDash([])
        const label = textOf(wire)
        if (label && (wire.lit || wire.pinned) && geo.scale > 0.55) {
          ctx.font = `${Math.round(9 * Math.max(0.8, geo.scale))}px ui-monospace, monospace`
          ctx.fillStyle = wire.pinned ? COLORS.marker : control ? COLORS.spectrum : COLORS.textBright
          ctx.fillText(label, wire.mid.x, wire.y2 - 7)
        }
      }

      for (const box of geo.boxes) {
        if (box.hidden) continue
        ctx.fillStyle = COLORS.bg
        ctx.strokeStyle = COLORS.axis
        ctx.lineWidth = 1
        roundRect(ctx, box.x, box.y, box.w, box.h, 5)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = COLORS.textBright
        ctx.font = `${Math.round(10 * Math.max(0.8, geo.scale))}px system-ui, sans-serif`
        ctx.fillText(fit(ctx, box.label, box.w - 8), box.cx, box.cy)
      }

      ctx.textAlign = 'left'
      ctx.fillStyle = COLORS.text
      ctx.font = '11px ui-monospace, monospace'
      ctx.fillText(`cycle ${geo.cycle}${geo.instr ? `, ${geo.instr.op}` : ''}, ${geo.lit} wires carrying a value`, PAD.l, geo.height - 10)
    },
    [run, cycle, JSON.stringify(pinned), zoom, height],
  )

  const h = height || geometryOf({ width: 900, zoom, cycle, run, pinned }).height
  const click = (ev) => {
    if (!onPin) return
    const rect = ev.currentTarget.getBoundingClientRect()
    const geo = geometryOf({ width: rect.width, zoom, cycle, run, pinned })
    const x = ev.clientX - rect.left
    const y = ev.clientY - rect.top
    let best = null
    for (const wire of geo.wires) {
      const d = Math.hypot(wire.mid.x - x, wire.y2 - y)
      if (!best || d < best.d) best = { d, wire }
    }
    if (best && best.d < 40) onPin(best.wire.name)
  }

  return <canvas ref={ref} className="datapath-canvas" style={{ height: h }} onPointerDown={click} role="img" aria-label="The datapath, with the value on every wire" />
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

/** A label cut to the box it has to sit in. */
function fit(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text
  let cut = text
  while (cut.length > 2 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1)
  return `${cut}…`
}
