import React from 'react'
import { COLORS, useCanvas } from '@ee-labs/ui'

/**
 * The three sequence networks side by side, with the connection the fault
 * makes between them.
 *
 * Each network is drawn as a source, its impedance and a terminal. The
 * connection between the three terminals is what a fault is, and it is drawn
 * as the wires it is: nothing for a three-phase fault, a series chain for a
 * single line to ground, a parallel pair for a line to line, and a parallel
 * pair across the positive one for a double line to ground.
 *
 * Three networks and their connection is the widest picture in the suite, so
 * below 500 px they stack vertically instead.
 */
export default function SequenceCanvas({ x, height = 320 }) {
  const ref = useCanvas((ctx, w, h) => draw(ctx, w, h, x), [x])
  return <canvas ref={ref} className="plot" style={{ height }} />
}

const NAMES = ['positive', 'negative', 'zero']

function draw(ctx, w, h, x) {
  ctx.clearRect(0, 0, w, h)
  const study = x.study || null
  const z = x.z
  if (!z) return
  const values = [z.Z1[1], z.Z2[1], z.Z0[1]]
  const currents = study ? [study.seqMag[1], study.seqMag[2], study.seqMag[0]] : [0, 0, 0]
  const carries = study ? currents.map((c) => c > 1e-9) : [true, true, true]
  const stacked = w < 500
  const cols = stacked ? 1 : 3
  const rows = stacked ? 3 : 1
  const cw = w / cols
  const ch = h / rows

  NAMES.forEach((name, k) => {
    const x0 = stacked ? 0 : cw * k
    const y0 = stacked ? ch * k : 0
    const cx = x0 + cw / 2
    const top = y0 + 26
    const bottom = y0 + ch - 34
    const live = carries[k]
    ctx.strokeStyle = live ? COLORS.trace : COLORS.grid
    ctx.lineWidth = live ? 2 : 1
    // The source.
    ctx.beginPath()
    ctx.arc(cx, bottom - 14, 11, 0, 2 * Math.PI)
    ctx.stroke()
    // The impedance, drawn as a box on the way up to the terminal.
    ctx.beginPath()
    ctx.moveTo(cx, bottom - 25)
    ctx.lineTo(cx, bottom - 60)
    ctx.stroke()
    ctx.strokeRect(cx - 12, bottom - 92, 24, 32)
    ctx.beginPath()
    ctx.moveTo(cx, bottom - 92)
    ctx.lineTo(cx, top)
    ctx.stroke()
    // The terminal the fault connects to.
    ctx.fillStyle = live ? COLORS.trace : COLORS.grid
    ctx.beginPath()
    ctx.arc(cx, top, 4, 0, 2 * Math.PI)
    ctx.fill()
    // The reference rail.
    ctx.strokeStyle = COLORS.axis
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx - 24, bottom)
    ctx.lineTo(cx + 24, bottom)
    ctx.moveTo(cx, bottom - 3)
    ctx.lineTo(cx, bottom)
    ctx.stroke()

    ctx.fillStyle = COLORS.textBright
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(name, cx, y0 + 16)
    ctx.fillStyle = COLORS.text
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText(`j${values[k].toFixed(3)} pu`, cx + 46, bottom - 74)
    if (study) ctx.fillText(`${currents[k].toFixed(5)} pu`, cx + 46, bottom - 54)
  })

  if (!study || stacked) {
    if (study) {
      ctx.fillStyle = COLORS.text
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(study.connection.slice(0, 60), 8, h - 8)
    }
    return
  }

  // The connection, drawn across the three terminals.
  const at = (k) => (w / 3) * k + w / 6
  const y = 26
  ctx.strokeStyle = COLORS.marker
  ctx.lineWidth = 2
  const link = (a, b, lift) => {
    ctx.beginPath()
    ctx.moveTo(at(a), y)
    ctx.lineTo(at(a), y - lift)
    ctx.lineTo(at(b), y - lift)
    ctx.lineTo(at(b), y)
    ctx.stroke()
  }
  if (study.kind === 'slg') {
    link(0, 1, 14)
    link(1, 2, 22)
  } else if (study.kind === 'll') {
    link(0, 1, 14)
  } else if (study.kind === 'dlg') {
    link(0, 1, 14)
    link(0, 2, 22)
  }
  ctx.fillStyle = COLORS.marker
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(study.label, 8, h - 8)
}
