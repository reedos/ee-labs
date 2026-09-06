import React from 'react'
import { COLORS, useCanvas } from '@ee-labs/ui'
import { STAGE_LABEL } from '../engine/card.js'
import { textOf } from '../engine/datapath.js'

// The pipeline schedule: one row an instruction, one column a cycle, each cell
// naming the stage that instruction is in.
//
// A stall is a repeated cell and a flush is a struck-through row. Both are read
// off the run's own schedule (`pipeline.js`), and neither is drawn from a
// formula. The cycle the reader is on is a lit column, so moving the cursor
// walks the machine.

const ROW = 22
const LABEL = 118
const CELL = 30
const TOP = 22
const BOTTOM = 8

/** Every cell of the grid, before anything is drawn. */
export function geometryOf({ rows = [], width = 900, cycle = 0, first = 0 }) {
  const plotW = Math.max(60, width - LABEL - 8)
  const columns = Math.max(1, Math.floor(plotW / CELL))
  const last = first + columns
  const cellW = plotW / columns
  const placed = rows.map((row, i) => ({
    index: row.index,
    instr: row.instr,
    label: textOf(row.instr),
    top: TOP + i * ROW,
    cells: row.cells
      .filter((c) => c.cycle >= first && c.cycle < last)
      .map((c) => ({ ...c, x: LABEL + (c.cycle - first) * cellW, y: TOP + i * ROW, w: cellW, h: ROW - 3, label: STAGE_LABEL[c.stage] })),
  }))
  return {
    width,
    height: TOP + rows.length * ROW + BOTTOM,
    rows: placed,
    columns,
    first,
    last,
    cellW,
    cursorX: cycle >= first && cycle < last ? LABEL + (cycle - first) * cellW : null,
    label: LABEL,
  }
}

export default function ScheduleCanvas({ run = null, cycle = 0, first = 0, height }) {
  const rows = run && run.schedule ? run.schedule.filter((r) => r.cells.length) : []
  const geo = geometryOf({ rows, width: 900, cycle, first })
  const ref = useCanvas(
    (ctx, w) => {
      const g = geometryOf({ rows, width: w, cycle, first })
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, g.height)
      ctx.textBaseline = 'middle'

      // The cycle numbers along the top.
      ctx.font = '10px ui-monospace, monospace'
      ctx.textAlign = 'center'
      for (let k = 0; k < g.columns; k++) {
        const c = g.first + k
        ctx.fillStyle = c === cycle ? COLORS.textBright : COLORS.text
        ctx.fillText(String(c), g.label + (k + 0.5) * g.cellW, 10)
      }
      if (g.cursorX != null) {
        ctx.fillStyle = 'rgba(56, 224, 176, 0.10)'
        ctx.fillRect(g.cursorX, TOP - 4, g.cellW, g.height - TOP)
      }

      for (const row of g.rows) {
        ctx.textAlign = 'right'
        ctx.font = '11px ui-monospace, monospace'
        ctx.fillStyle = COLORS.text
        ctx.fillText(cut(ctx, row.label, LABEL - 12), LABEL - 8, row.top + ROW / 2)
        ctx.textAlign = 'center'
        for (const cell of row.cells) {
          ctx.fillStyle = cell.bubble ? 'rgba(240, 162, 60, 0.16)' : 'rgba(56, 224, 176, 0.16)'
          ctx.fillRect(cell.x + 1, cell.y, cell.w - 2, cell.h)
          ctx.strokeStyle = cell.bubble ? COLORS.spectrum : COLORS.trace
          ctx.lineWidth = 1
          ctx.strokeRect(cell.x + 1.5, cell.y + 0.5, cell.w - 3, cell.h - 1)
          ctx.fillStyle = cell.bubble ? COLORS.spectrum : COLORS.trace
          ctx.font = '10px ui-monospace, monospace'
          ctx.fillText(cell.label, cell.x + cell.w / 2, cell.y + cell.h / 2)
        }
      }
    },
    [run, cycle, first, height],
  )

  return <canvas ref={ref} className="schedule-canvas" style={{ height: height || geo.height }} role="img" aria-label="The pipeline schedule, one row an instruction" />
}

function cut(ctx, text, width) {
  let out = text
  while (out.length > 3 && ctx.measureText(out).width > width) out = out.slice(0, -1)
  return out
}
