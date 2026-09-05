import React from 'react'
import { COLORS, useCanvas } from '@ee-labs/ui'
import { ps } from '../format.js'

// The timing diagram: signals down the left, time across, one row per signal
// drawn as the instants at which it changed.
//
// A waveform from this engine is a step function, so it is drawn as one. The
// edges are vertical and nothing is interpolated between two transitions,
// because there is nothing between them (REVIEW_PLAYBOOK §6, data against
// interpolation).
//
// The props past `signals` are here for labs that do not exist yet
// (LOGIC_LAB_PLAN.md Decision 5, AGENT_BRIEF.md §3.7). `busses` draws a set of
// rows as one numeric row and `spans` measures an interval, which the
// Interfaces Lab needs for a protocol. `analog` draws one real-valued row
// against two threshold levels, which is that lab's pin. `cursors` is its read
// pair. `causes` joins each event to the event that caused it, which is the
// VLSI Lab's. Promoting this file into packages/ui should then be a move
// rather than a rewrite.

const ROW = 34
const GAP = 10
const LEFT = 92
const RIGHT = 16
const TOP = 26
const BOTTOM = 34

/** Every row this diagram draws, in order, as `{ kind, label, ... }`. */
export function rowsOf({ res, signals = [], busses = [], analog = [] }) {
  const inBus = new Set(busses.flatMap((b) => b.signals))
  const rows = []
  for (const b of busses) rows.push({ kind: 'bus', label: b.label, signals: b.signals })
  for (const a of analog) rows.push({ kind: 'analog', label: a.label, analog: a })
  for (const s of signals) {
    if (inBus.has(s)) continue
    if (!res || res.waves[s]) rows.push({ kind: 'signal', label: s, signal: s })
  }
  return rows
}

/** The height the diagram needs for these rows. */
export const heightOf = (rows) => TOP + rows.length * (ROW + GAP) + BOTTOM

/** The value of `signal` at `t`, off the run's waveform. */
function valueAt(res, signal, t) {
  const w = res.waves[signal]
  let v = w.v[0]
  for (let k = 0; k < w.t.length; k++) if (w.t[k] <= t) v = w.v[k]
  return v
}

/** The word a bus row reads at time `t`, most significant signal first. */
export const busAt = (res, signals, t) => signals.reduce((acc, s) => acc * 2 + valueAt(res, s, t), 0)

export default function TimingCanvas({
  res,
  signals = [],
  busses = [],
  analog = [],
  marks = [],
  spans = [],
  cursors = [],
  causes = false,
  window: win,
  cursor = null,
  onCursor,
  height,
}) {
  const rows = rowsOf({ res, signals, busses, analog })
  const [t0, t1] = win || [0, res ? res.tEnd : 1000]
  const h = height || heightOf(rows)

  const ref = useCanvas(
    (ctx, w) => {
      const plotW = Math.max(40, w - LEFT - RIGHT)
      const sx = (t) => LEFT + ((t - t0) / Math.max(1, t1 - t0)) * plotW
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)

      // The time axis, along the top, in the unit a reader reads.
      ctx.strokeStyle = COLORS.axis
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(LEFT, TOP - 8)
      ctx.lineTo(LEFT + plotW, TOP - 8)
      ctx.stroke()
      ctx.font = '11px ui-monospace, monospace'
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'center'
      const step = niceTime(t1 - t0)
      for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) {
        const x = sx(t)
        ctx.fillText(ps(t), x, TOP - 13)
        ctx.strokeStyle = COLORS.grid
        ctx.beginPath()
        ctx.moveTo(x, TOP - 6)
        ctx.lineTo(x, h - BOTTOM + 6)
        ctx.stroke()
      }

      // The rows.
      const yOf = (i) => TOP + i * (ROW + GAP)
      rows.forEach((row, i) => {
        const top = yOf(i)
        const bot = top + ROW
        ctx.textAlign = 'right'
        ctx.fillStyle = COLORS.textBright
        ctx.font = '12px ui-monospace, monospace'
        ctx.fillText(row.label, LEFT - 10, top + ROW / 2 + 4)
        if (row.kind === 'signal') drawSignal(ctx, res, row.signal, sx, top, bot, t0, t1)
        if (row.kind === 'bus') drawBus(ctx, res, row.signals, sx, top, bot, t0, t1)
        if (row.kind === 'analog') drawAnalog(ctx, row.analog, sx, top, bot, t0, t1)
      })

      // A cause line joins an event to the event that produced it.
      if (causes && res) {
        const indexOf = new Map(rows.map((r, i) => [r.signal, i]))
        ctx.strokeStyle = 'rgba(240, 162, 60, 0.45)'
        ctx.setLineDash([3, 3])
        for (const e of res.events) {
          if (!e.cause || !indexOf.has(e.signal) || !indexOf.has(e.cause.signal)) continue
          const a = { x: sx(e.cause.t), y: yOf(indexOf.get(e.cause.signal)) + ROW / 2 }
          const b = { x: sx(e.t), y: yOf(indexOf.get(e.signal)) + ROW / 2 }
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
        ctx.setLineDash([])
      }

      // A span, with the width it measures written above it.
      ctx.textAlign = 'center'
      for (const sp of spans) {
        const i = rows.findIndex((r) => r.signal === sp.signal)
        const y = i >= 0 ? yOf(i) - 4 : TOP - 4
        ctx.strokeStyle = COLORS.marker
        ctx.beginPath()
        ctx.moveTo(sx(sp.from), y)
        ctx.lineTo(sx(sp.to), y)
        ctx.moveTo(sx(sp.from), y - 4)
        ctx.lineTo(sx(sp.from), y + 4)
        ctx.moveTo(sx(sp.to), y - 4)
        ctx.lineTo(sx(sp.to), y + 4)
        ctx.stroke()
        ctx.fillStyle = COLORS.marker
        ctx.font = '11px ui-monospace, monospace'
        ctx.fillText(`${sp.label ? `${sp.label}, ` : ''}${ps(sp.to - sp.from)}`, (sx(sp.from) + sx(sp.to)) / 2, y - 8)
      }

      // Named instants.
      for (const m of marks) {
        ctx.strokeStyle = COLORS.response
        ctx.setLineDash([2, 4])
        ctx.beginPath()
        ctx.moveTo(sx(m.t), TOP - 6)
        ctx.lineTo(sx(m.t), h - BOTTOM + 6)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = COLORS.response
        ctx.fillText(m.label, sx(m.t), h - BOTTOM + 20)
      }

      // The cursor pair, with the interval between them.
      if (cursors.length === 2) {
        for (const t of cursors) {
          ctx.strokeStyle = COLORS.spectrum
          ctx.beginPath()
          ctx.moveTo(sx(t), TOP - 6)
          ctx.lineTo(sx(t), h - BOTTOM + 6)
          ctx.stroke()
        }
        ctx.fillStyle = COLORS.spectrum
        ctx.fillText(ps(Math.abs(cursors[1] - cursors[0])), (sx(cursors[0]) + sx(cursors[1])) / 2, h - BOTTOM + 20)
      }

      if (cursor != null) {
        ctx.strokeStyle = COLORS.textBright
        ctx.beginPath()
        ctx.moveTo(sx(cursor), TOP - 6)
        ctx.lineTo(sx(cursor), h - BOTTOM + 6)
        ctx.stroke()
      }
    },
    [res, JSON.stringify(signals), JSON.stringify(busses), JSON.stringify(marks), JSON.stringify(spans), JSON.stringify(cursors), causes, t0, t1, cursor, h],
  )

  const move = (ev) => {
    if (!onCursor) return
    const rect = ev.currentTarget.getBoundingClientRect()
    const plotW = Math.max(40, rect.width - LEFT - RIGHT)
    const frac = (ev.clientX - rect.left - LEFT) / plotW
    onCursor(Math.round(t0 + Math.max(0, Math.min(1, frac)) * (t1 - t0)))
  }

  return <canvas ref={ref} className="timing-canvas" style={{ height: h }} onPointerDown={move} onPointerMove={(e) => e.buttons && move(e)} role="img" aria-label="Timing diagram" />
}

function drawSignal(ctx, res, signal, sx, top, bot, t0, t1) {
  if (!res) return
  const w = res.waves[signal]
  ctx.strokeStyle = COLORS.trace
  ctx.lineWidth = 1.6
  ctx.beginPath()
  let y = w.v[0] ? top + 4 : bot - 4
  ctx.moveTo(sx(t0), y)
  for (let k = 0; k < w.t.length; k++) {
    const t = w.t[k]
    if (t <= t0 || t > t1) continue
    ctx.lineTo(sx(t), y)
    y = w.v[k] ? top + 4 : bot - 4
    ctx.lineTo(sx(t), y)
  }
  ctx.lineTo(sx(t1), y)
  ctx.stroke()
  ctx.lineWidth = 1
}

function drawBus(ctx, res, signals, sx, top, bot, t0, t1) {
  if (!res) return
  // Every instant at which any member of the bus changed is a boundary.
  const cuts = [t0, ...new Set(res.events.filter((e) => signals.includes(e.signal) && e.t > t0 && e.t <= t1).map((e) => e.t)), t1].sort((a, b) => a - b)
  ctx.font = '11px ui-monospace, monospace'
  ctx.textAlign = 'center'
  for (let k = 0; k + 1 < cuts.length; k++) {
    const [a, b] = [sx(cuts[k]), sx(cuts[k + 1])]
    if (b - a < 1) continue
    ctx.strokeStyle = COLORS.spectrum
    ctx.beginPath()
    ctx.moveTo(a + 3, top + 4)
    ctx.lineTo(b - 3, top + 4)
    ctx.lineTo(b, (top + bot) / 2)
    ctx.lineTo(b - 3, bot - 4)
    ctx.lineTo(a + 3, bot - 4)
    ctx.lineTo(a, (top + bot) / 2)
    ctx.closePath()
    ctx.stroke()
    if (b - a > 26) {
      ctx.fillStyle = COLORS.textBright
      ctx.fillText(String(busAt(res, signals, cuts[k])), (a + b) / 2, (top + bot) / 2 + 4)
    }
  }
}

function drawAnalog(ctx, a, sx, top, bot, t0, t1) {
  const lo = a.min ?? 0
  const hi = a.max ?? Math.max(a.vHigh ?? 1, ...(a.samples || []).map((s) => s.v))
  const sy = (v) => bot - 4 - ((v - lo) / Math.max(1e-12, hi - lo)) * (bot - top - 8)
  for (const [level, colour] of [
    [a.vHigh, COLORS.response],
    [a.vLow, COLORS.marker],
  ]) {
    if (level == null) continue
    ctx.strokeStyle = colour
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(sx(t0), sy(level))
    ctx.lineTo(sx(t1), sy(level))
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.strokeStyle = COLORS.phase
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ;(a.samples || []).forEach((s, i) => (i ? ctx.lineTo(sx(s.t), sy(s.v)) : ctx.moveTo(sx(s.t), sy(s.v))))
  ctx.stroke()
  ctx.lineWidth = 1
}

/** A round tick interval near a tenth of the span. */
function niceTime(span) {
  const raw = Math.max(1, span / 8)
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
}
