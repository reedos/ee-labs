import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt, scopeRange } from '@ee-labs/ui'
import { TRACES } from '../experiments.js'
import { axisFmt, fitLeftAxis, tickStep } from '../format.js'
import { markLabels } from '../marks.js'

/** One colour per trace, kept apart from the axis chrome. */
export const TRACE_COLORS = {
  vin: COLORS.spectrum,
  vsw: COLORS.spectrum,
  vrect: COLORS.phase,
  vout: COLORS.trace,
  vL: COLORS.phase,
  vD: '#f4a261',
  iL: COLORS.response,
  iC: COLORS.marker,
  iR: '#b5e48c',
  iQ: '#ffd166',
  iD: '#8ecae6',
  iin: COLORS.textBright,
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

/**
 * The scope, as a pure drawing: the converter's waveforms over two periods in
 * two strips that share a time axis — voltages above, currents below — each
 * strip ranged on the experiment's defaults (`baseWf`) so a knob moves the
 * curve and not the frame. With only one kind of trace shown there is one
 * strip. Nothing is written over the traces: the legend is the row of trace
 * chips in the pane header, in the same colours; the only text inside the
 * frame is a mark the note asked for.
 *
 * The waveform carries both ends of every segment (steady.js), so the
 * switching edges plot vertical without any help here; the edge instants are
 * marked and named in the band above the top strip. The time axis is in
 * microseconds for a switching period and milliseconds for a line cycle: the
 * unit follows the period.
 *
 * Returns the geometry it drew with, for tests: `strips` (axis, area, sy),
 * `sx`, and the time range in axis units.
 */
export function drawScope(ctx, w, h, { wf, baseWf = null, traces, marks = [] }) {
  const shown = traces.filter((k) => wf.sig[k])
  const volts = shown.filter((k) => TRACES[k].axis === 'V')
  const amps = shown.filter((k) => TRACES[k].axis === 'A')
  const k0 = plotArea(w, h).k
  const whole = plotArea(w, h, { topInset: 16 * k0 })
  const k = whole.k
  const unit = wf.T >= 1e-3 ? 1e3 : 1e6
  const us = wf.t.map((t) => t * unit)
  const xMin = us[0]
  const xMax = us[us.length - 1]
  const fmtX = (v) => fmt(v / unit, 's', 3)

  const kinds = [
    volts.length ? { axis: 'V', keys: volts } : null,
    amps.length ? { axis: 'A', keys: amps } : null,
  ].filter(Boolean)
  if (!kinds.length) return { strips: [], sx: () => NaN, xMin, xMax, unit }

  // Each strip's range and tick format; the gutter fits the widest label of
  // either, so the two frames line up.
  for (const s of kinds) {
    ;[s.lo, s.hi] = scopeRange(wf, baseWf, s.keys)
    s.fmt = axisFmt(s.lo, s.hi, s.axis)
  }
  const labels = kinds.flatMap((s) => [s.fmt(s.lo), s.fmt(s.hi), s.fmt((s.lo + s.hi) / 2)])
  const framed = fitLeftAxis(ctx, whole, labels, k)

  // Two strips: split the height, a small gap between them; only the lower
  // one carries the time labels and title.
  const gap = kinds.length > 1 ? 26 * k : 0
  const stripH = (framed.h - gap) / kinds.length
  let sx = null
  const strips = kinds.map((s, i) => {
    const area = { ...framed, y: framed.y + i * (stripH + gap), h: stripH }
    const last = i === kinds.length - 1
    const r = drawFrame(ctx, area, xMin, xMax, s.lo, s.hi, last ? fmtX : () => '', s.fmt, {
      zeroLine: s.lo < 0 && s.hi > 0,
      // Two strips share the height, so each one is short enough that the
      // frame's own step leaves it with a single tick. Ask for a step that
      // carries a scale (format.js tickStep).
      yStep: tickStep(s.lo, s.hi, area.h, k),
      xTitle: last ? 'Time' : null,
      yTitle: s.axis === 'V' ? 'Voltage (V)' : 'Current (A)',
    })
    sx = r.sx
    return { ...s, area, sy: r.sy }
  })
  const top = strips[0].area
  const bottom = strips[strips.length - 1].area
  const yTop = top.y
  const yBottom = bottom.y + bottom.h

  ctx.save()
  // Edge markers, through every strip, named in the band above the top one.
  ctx.font = `${Math.round(10 * k)}px ${MONO}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  const right = top.x + top.w
  wf.edges.forEach((e, i) => {
    const x = sx(e.t * unit)
    // The name is written only where it fits before the next edge or the
    // frame: a segment of no length (the dead interval at the boundary) gets
    // its marker and no name.
    const next = i + 1 < wf.edges.length ? sx(wf.edges[i + 1].t * unit) : right
    const named = x + 3 * k + ctx.measureText(e.name).width <= Math.min(next, right)
    ctx.strokeStyle = COLORS.gridMajor
    ctx.setLineDash([3 * k, 3 * k])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 0.5, yTop)
    ctx.lineTo(x + 0.5, yBottom)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = COLORS.text
    if (named) ctx.fillText(e.name, x + 3 * k, yTop - 3 * k)
  })
  ctx.restore()

  // Spans first, under the traces.
  for (const mk of marks.filter((q) => q.type === 'span')) {
    const x0 = sx(mk.t0 * unit)
    const x1 = sx(mk.t1 * unit)
    ctx.save()
    ctx.fillStyle = COLORS.traceDim
    ctx.fillRect(x0, yTop, x1 - x0, yBottom - yTop)
    ctx.fillStyle = COLORS.trace
    ctx.font = `${Math.round(11 * k)}px ${MONO}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(mk.label, (x0 + x1) / 2, yTop + 4 * k)
    ctx.restore()
  }

  // The conduction scrub's instant, through every strip: the schematic beside
  // it lights the path that is conducting there, and the two have to be the
  // same instant or neither means anything.
  for (const mk of marks.filter((q) => q.type === 'cursor')) {
    const cx = sx(mk.t * unit)
    ctx.save()
    ctx.strokeStyle = COLORS.marker
    ctx.lineWidth = 1.6 * k
    ctx.beginPath()
    ctx.moveTo(cx + 0.5, yTop)
    ctx.lineTo(cx + 0.5, yBottom)
    ctx.stroke()
    ctx.font = `${Math.round(11 * k)}px ${MONO}`
    ctx.fillStyle = COLORS.marker
    ctx.textAlign = cx > (top.x + top.w) / 2 ? 'right' : 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(mk.label, cx + (cx > (top.x + top.w) / 2 ? -4 : 4) * k, yTop + 4 * k)
    ctx.restore()
  }

  for (const s of strips) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(s.area.x, s.area.y, s.area.w, s.area.h)
    ctx.clip()
    for (const key of s.keys) {
      const ys = wf.sig[key]
      ctx.strokeStyle = TRACE_COLORS[key]
      ctx.lineWidth = 2 * k
      ctx.beginPath()
      for (let i = 0; i < us.length; i++) {
        if (i === 0) ctx.moveTo(sx(us[i]), s.sy(ys[i]))
        else ctx.lineTo(sx(us[i]), s.sy(ys[i]))
      }
      ctx.stroke()
    }
    // Level lines the note named, on the strip whose axis they belong to.
    for (const mk of marks.filter((q) => q.type === 'hline' && q.axis === s.axis)) {
      const y = s.sy(mk.value)
      ctx.strokeStyle = mk.color || COLORS.marker
      ctx.setLineDash([6 * k, 4 * k])
      ctx.lineWidth = 1.2 * k
      ctx.beginPath()
      ctx.moveTo(s.area.x, y + 0.5)
      ctx.lineTo(s.area.x + s.area.w, y + 0.5)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = mk.color || COLORS.marker
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(mk.label, s.area.x + s.area.w - 6 * k, y - 3 * k)
    }
    ctx.restore()
  }

  return { strips, sx, xMin, xMax, unit }
}

export default function ScopeCanvas({ wf, baseWf, traces, marks = [] }) {
  const ref = useCanvas((ctx, w, h) => drawScope(ctx, w, h, { wf, baseWf, traces, marks }), [wf, baseWf, traces, marks])
  return (
    <canvas
      ref={ref}
      className="plot"
      role="img"
      aria-label="Scope: the circuit's waveforms over two periods, voltages above and currents below"
      data-marks={markLabels(marks)}
    />
  )
}
