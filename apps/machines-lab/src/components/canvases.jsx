// The four canvases this lab adds, plus the two it shares in shape with the
// rest of the suite.
//
// Each takes an analysis (analysis.js) and draws it. Nothing here solves
// anything. Every axis carries its quantity and its unit, and every range
// adapts to the content rather than to a guess (REVIEW_PLAYBOOK §4).

import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas } from '@ee-labs/ui'
import { radToRpm } from '@ee-labs/machines'

const CURVE = ['#7fd4ff', '#ffcc66', '#a0e8a0', '#ff9a9a', '#d0b0ff']

function useDraw(paint, deps) {
  return useCanvas(paint, deps)
}

/** How a tick label is written: engineering-ish, without a spurious exponent. */
const tick = (v) => {
  const a = Math.abs(v)
  if (a === 0) return '0'
  if (a >= 1e4 || a < 1e-3) return v.toExponential(1)
  if (a >= 100) return v.toFixed(0)
  if (a >= 1) return v.toFixed(a >= 10 ? 1 : 2)
  return v.toPrecision(2)
}

/** Axis chrome shared by every plot here. */
function frame(ctx, w, h, opts) {
  const area = plotArea(w, h)
  const { sx, sy } = drawFrame(ctx, area, opts.x.min, opts.x.max, opts.y.min, opts.y.max, tick, tick, {
    xTitle: opts.xLabel,
    yTitle: opts.yLabel,
    zeroLine: true,
  })
  return { area, sx, sy }
}

const line = (ctx, xs, ys, sx, sy, colour, width = 1.6) => {
  ctx.save()
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  ctx.beginPath()
  for (let k = 0; k < xs.length; k++) {
    const px = sx(xs[k])
    const py = sy(ys[k])
    if (k === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.restore()
}

const dot = (ctx, x, y, colour, r = 4) => {
  ctx.save()
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 2 * Math.PI)
  ctx.fill()
  ctx.restore()
}

const tag = (ctx, x, y, text, colour) => {
  ctx.save()
  ctx.fillStyle = colour
  ctx.font = '10px ui-monospace, monospace'
  ctx.fillText(text, x, y)
  ctx.restore()
}

// ------------------------------------------------------------ torque and speed

/**
 * Torque against speed, with the machine's line, the load's line, and the
 * crossing marked. Group A's picture, and the one a drives course draws on a
 * whiteboard.
 */
export function TorqueSpeedCanvas({ x }) {
  const ref = useDraw(
    (ctx, w, h) => {
      const rows = x.control ? [...(x.control.armature || []), ...(x.control.field || [])] : []
      const lines = rows.length ? rows : [{ ...x.line, point: x.op }]
      const topSpeed = Math.max(...lines.map((l) => l.noLoad)) * 1.05
      const topTorque = Math.max(...lines.map((l) => l.stall)) * 1.1
      const { sx, sy } = frame(ctx, w, h, {
        x: { min: 0, max: radToRpm(topSpeed) },
        y: { min: 0, max: topTorque },
        xLabel: 'speed (rev/min)',
        yLabel: 'torque (N·m)',
      })
      lines.forEach((l, k) => {
        const colour = CURVE[k % CURVE.length]
        const speeds = [0, l.noLoad]
        line(ctx, speeds.map(radToRpm), speeds.map(l.torqueAt), sx, sy, colour, rows.length ? 1.4 : 2)
        if (l.point) dot(ctx, sx(radToRpm(l.point.omega)), sy(l.point.torque), colour)
      })
      // The load, which for this machine is a constant plus a friction term.
      const m = x.spec
      const load = (wm) => m.TL + (m.B + (m.loadB || 0)) * wm
      const ws = [0, topSpeed]
      line(ctx, ws.map(radToRpm), ws.map(load), sx, sy, '#ff9a9a', 1.4)
      tag(ctx, sx(radToRpm(topSpeed)) - 34, sy(load(topSpeed)) - 6, 'load', '#ff9a9a')
    },
    [x],
  )
  return <canvas ref={ref} className="plot" data-view="torquespeed" />
}

// --------------------------------------------------------------- torque curve

/** Torque against slip and speed, with breakdown and the operating point. */
export function TorqueCurveCanvas({ x }) {
  const ref = useDraw(
    (ctx, w, h) => {
      const c = x.curve
      const top = Math.max(x.bd.tMax, x.op.torque) * 1.12
      const { sx, sy } = frame(ctx, w, h, {
        x: { min: 0, max: c.machine.rpmSync },
        y: { min: 0, max: top },
        xLabel: 'speed (rev/min)',
        yLabel: 'torque (N·m)',
      })
      line(ctx, c.speed.map(radToRpm), c.torque, sx, sy, CURVE[0], 2)
      const m = c.machine
      const load = (wm) => m.TL + (m.B + (m.loadB || 0)) * wm
      line(ctx, c.speed.map(radToRpm), c.speed.map(load), sx, sy, '#ff9a9a', 1.4)
      dot(ctx, sx(radToRpm(x.bd.speedAt)), sy(x.bd.tMax), CURVE[1], 5)
      tag(ctx, sx(radToRpm(x.bd.speedAt)) + 6, sy(x.bd.tMax) - 6, 'breakdown', CURVE[1])
      dot(ctx, sx(x.op.rpm), sy(x.op.torque), '#a0e8a0', 5)
      tag(ctx, sx(x.op.rpm) - 76, sy(x.op.torque) - 8, 'running', '#a0e8a0')
      if (x.slip !== undefined) {
        const rpm = radToRpm((1 - x.slip) * m.omegaSync)
        dot(ctx, sx(rpm), sy(x.torque), '#ffffff', 3)
      }
      if (x.rotorSweep)
        x.rotorSweep.forEach((r, k) => dot(ctx, sx(radToRpm(r.speedAt)), sy(r.tMax), CURVE[(k + 2) % CURVE.length], 4))
    },
    [x],
  )
  return <canvas ref={ref} className="plot" data-view="curve" />
}

// -------------------------------------------------------------- power angle

/** Power against the angle, with the field and reluctance terms drawn apart. */
export function PowerAngleCanvas({ x }) {
  const ref = useDraw(
    (ctx, w, h) => {
      const c = x.curve
      const deg = c.delta.map((d) => (d * 180) / Math.PI)
      const top = Math.max(...c.P, x.pullOut.P) * 1.1
      const { sx, sy } = frame(ctx, w, h, {
        x: { min: 0, max: 180 },
        y: { min: 0, max: top },
        xLabel: 'power angle (°)',
        yLabel: 'power (W)',
      })
      if (x.spec.salient) {
        line(ctx, deg, c.field, sx, sy, CURVE[2], 1.2)
        line(ctx, deg, c.reluctance, sx, sy, CURVE[3], 1.2)
      }
      line(ctx, deg, c.P, sx, sy, CURVE[0], 2)
      dot(ctx, sx((x.delta * 180) / Math.PI), sy(x.power.P), '#ffffff', 4)
      dot(ctx, sx((x.pullOut.delta * 180) / Math.PI), sy(x.pullOut.P), CURVE[1], 5)
      tag(ctx, sx((x.pullOut.delta * 180) / Math.PI) - 30, sy(x.pullOut.P) - 8, 'pull-out', CURVE[1])
    },
    [x],
  )
  return <canvas ref={ref} className="plot" data-view="angle" />
}

// ------------------------------------------------------------ rotating field

/**
 * The three phase contributions around the gap and the one wave they add to.
 * The travelling wave is the point, so it is drawn heaviest.
 */
export function FieldCanvas({ x }) {
  const ref = useDraw(
    (ctx, w, h) => {
      const deg = x.theta.map((a) => (a * 180) / Math.PI)
      const amp = x.field.amplitude
      const { sx, sy } = frame(ctx, w, h, {
        x: { min: 0, max: 360 },
        y: { min: -amp * 1.1, max: amp * 1.1 },
        xLabel: 'angle around the gap (°)',
        yLabel: 'magnetomotive force (A-turns)',
      })
      x.phase.forEach((p, k) => line(ctx, deg, p, sx, sy, CURVE[k + 1], 1.1))
      line(ctx, deg, x.total, sx, sy, CURVE[0], 2.4)
      // Where the peak sits now, which is what travels.
      const peakAngle = ((x.field.omega * x.t) % (2 * Math.PI)) * (180 / Math.PI)
      dot(ctx, sx((peakAngle + 360) % 360), sy(amp), '#ffffff', 4)
    },
    [x],
  )
  return <canvas ref={ref} className="plot" data-view="field" />
}

// ------------------------------------------------------------- the dq frame

/** The three-phase set as bars and the dq pair as one arrow, at one instant. */
export function DQCanvas({ x }) {
  const ref = useDraw(
    (ctx, w, h) => {
      const R = Math.min(w, h) * 0.36
      const cx = w * 0.5
      const cy = h * 0.5
      ctx.save()
      ctx.strokeStyle = '#3a4653'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, 2 * Math.PI)
      ctx.stroke()
      // The three winding axes.
      ctx.font = '10px ui-monospace, monospace'
      ;['a', 'b', 'c'].forEach((name, k) => {
        const a = (-k * 2 * Math.PI) / 3
        ctx.strokeStyle = CURVE[k + 1]
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + R * Math.cos(a), cy - R * Math.sin(a))
        ctx.stroke()
        ctx.fillStyle = CURVE[k + 1]
        ctx.fillText(name, cx + (R + 8) * Math.cos(a) - 3, cy - (R + 8) * Math.sin(a) + 4)
      })
      // The dq pair, drawn at the rotor angle.
      const scale = R / Math.max(x.radius, 1e-9)
      ctx.strokeStyle = CURVE[0]
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      const vx = x.dq[0] * Math.cos(x.theta) - x.dq[1] * Math.sin(x.theta)
      const vy = x.dq[0] * Math.sin(x.theta) + x.dq[1] * Math.cos(x.theta)
      ctx.lineTo(cx + scale * vx, cy - scale * vy)
      ctx.stroke()
      ctx.fillStyle = '#e6edf3'
      ctx.fillText(`|dq| = ${x.radius.toPrecision(5)}`, 10, 16)
      ctx.fillText(x.law, 10, 30)
      ctx.restore()
    },
    [x],
  )
  return <canvas ref={ref} className="plot" data-view="dq" />
}

// -------------------------------------------------------------- phase plane

/** Armature current against speed, with the path from standstill marked. */
export function PhasePlaneCanvas({ x, direction = false }) {
  const ref = useDraw(
    (ctx, w, h) => {
      if (!x.tr) return
      const speeds = []
      const currents = []
      for (const s of x.tr.samples) {
        speeds.push(radToRpm(s.sol.v.wm))
        currents.push(s.sol.i.Ra)
      }
      const { sx, sy } = frame(ctx, w, h, {
        x: { min: 0, max: Math.max(...speeds) * 1.1 },
        y: { min: 0, max: Math.max(...currents) * 1.1 },
        xLabel: 'speed (rev/min)',
        yLabel: 'armature current (A)',
      })
      if (direction) {
        ctx.save()
        ctx.strokeStyle = '#2b3542'
        for (let i = 1; i < 9; i++)
          for (let j = 1; j < 7; j++) {
            const wm = (i / 9) * Math.max(...speeds)
            const ia = (j / 7) * Math.max(...currents)
            const px = sx(wm)
            const py = sy(ia)
            ctx.beginPath()
            ctx.moveTo(px, py)
            ctx.lineTo(px + 6, py - 3)
            ctx.stroke()
          }
        ctx.restore()
      }
      line(ctx, speeds, currents, sx, sy, CURVE[0], 2)
      dot(ctx, sx(speeds[0]), sy(currents[0]), '#ffffff', 3)
      dot(ctx, sx(radToRpm(x.op.omega)), sy(x.op.ia), '#a0e8a0', 5)
      tag(ctx, sx(radToRpm(x.op.omega)) - 92, sy(x.op.ia) - 8, 'operating point', '#a0e8a0')
    },
    [x, direction],
  )
  return <canvas ref={ref} className="plot" data-view="phaseplane" />
}

// ------------------------------------------------------------------- scope

/** Current, speed and torque against time, on two axes. */
export function ScopeCanvas({ x }) {
  const ref = useDraw(
    (ctx, w, h) => {
      if (!x.tr) return
      const t = []
      const ia = []
      const rpm = []
      for (const s of x.tr.samples) {
        t.push(s.t * 1e3)
        ia.push(s.sol.i.Ra)
        rpm.push(radToRpm(s.sol.v.wm))
      }
      const { area, sx, sy } = frame(ctx, w, h, {
        x: { min: 0, max: x.tEnd * 1e3 },
        y: { min: 0, max: Math.max(...ia) * 1.1 },
        xLabel: 'time (ms)',
        yLabel: 'armature current (A)',
      })
      const top = Math.max(...rpm) * 1.1 || 1
      const sy2 = (v) => area.y + area.h - (v / top) * area.h
      line(ctx, t, rpm, sx, sy2, CURVE[2], 1.4)
      line(ctx, t, ia, sx, sy, CURVE[0], 2)
      tag(ctx, area.x + area.w - 116, area.y + 12, `speed to ${top.toPrecision(4)} rev/min`, CURVE[2])
      if (x.cursor !== undefined) {
        ctx.save()
        ctx.strokeStyle = '#ffffff66'
        ctx.beginPath()
        ctx.moveTo(sx(x.cursor * 1e3), area.y)
        ctx.lineTo(sx(x.cursor * 1e3), area.y + area.h)
        ctx.stroke()
        ctx.restore()
      }
    },
    [x],
  )
  return <canvas ref={ref} className="plot" data-view="scope" />
}

// ---------------------------------------------------------------- efficiency

/** Efficiency against load fraction, with the peak marked. */
export function EfficiencyCanvas({ x }) {
  const ref = useDraw(
    (ctx, w, h) => {
      const c = x.curve
      const pct = c.efficiency.map((e) => e * 100)
      const { sx, sy } = frame(ctx, w, h, {
        x: { min: 0, max: Math.max(...c.x) },
        y: { min: Math.min(...pct) - 2, max: Math.max(...pct) + 1 },
        xLabel: 'load, as a fraction of rated',
        yLabel: 'efficiency (%)',
      })
      line(ctx, c.x, pct, sx, sy, CURVE[0], 2)
      dot(ctx, sx(x.best.x), sy(x.best.efficiency * 100), CURVE[1], 5)
      tag(ctx, sx(x.best.x) - 20, sy(x.best.efficiency * 100) - 10, 'peak', CURVE[1])
      dot(ctx, sx(x.x), sy(x.split.efficiency * 100), '#ffffff', 4)
    },
    [x],
  )
  return <canvas ref={ref} className="plot" data-view="efficiency" />
}

// ---------------------------------------------------------------- temperature

/** The rise against time, with the insulation class drawn as a ceiling. */
export function HeatCanvas({ x }) {
  const ref = useDraw(
    (ctx, w, h) => {
      const m = x.machine
      const tau = x.heat.tau
      const tEnd = x.tEnd || 5 * tau
      const t = []
      const temp = []
      for (let k = 0; k <= 300; k++) {
        const tt = (tEnd * k) / 300
        t.push(tt / 60)
        temp.push(m.ambient + x.heat.riseAt(tt))
      }
      const top = Math.max(m.classLimit, x.heat.final) * 1.08
      const { area, sx, sy } = frame(ctx, w, h, {
        x: { min: 0, max: tEnd / 60 },
        y: { min: m.ambient - 5, max: top },
        xLabel: 'time (minutes)',
        yLabel: 'winding temperature (°C)',
      })
      ctx.save()
      ctx.strokeStyle = '#ff9a9a'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(area.x, sy(m.classLimit))
      ctx.lineTo(area.x + area.w, sy(m.classLimit))
      ctx.stroke()
      ctx.restore()
      tag(ctx, area.x + 6, sy(m.classLimit) - 6, `class limit ${m.classLimit} °C`, '#ff9a9a')
      line(ctx, t, temp, sx, sy, CURVE[0], 2)
      if (x.cursor !== undefined) dot(ctx, sx(x.cursor / 60), sy(m.ambient + x.heat.riseAt(x.cursor)), '#ffffff', 4)
    },
    [x],
  )
  return <canvas ref={ref} className="plot" data-view="heat" />
}

// -------------------------------------------------------------- the flux curve

/** Flux linkage against current, with the linear model drawn beside it. */
export function FluxCanvas({ x }) {
  const ref = useDraw(
    (ctx, w, h) => {
      const c = x.curve
      const top = Math.max(...c.lambda.map(Math.abs)) * 1.3
      const { sx, sy } = frame(ctx, w, h, {
        x: { min: c.i[0], max: c.i[c.i.length - 1] },
        y: { min: -top, max: top },
        xLabel: 'magnetising current (A)',
        yLabel: 'flux linkage (Wb)',
      })
      const clipped = c.linear.map((v) => Math.max(-top, Math.min(top, v)))
      line(ctx, c.i, clipped, sx, sy, '#5b6b7d', 1.2)
      line(ctx, c.i, c.lambda, sx, sy, CURVE[0], 2.2)
      dot(ctx, sx(x.i), sy(x.sat.lambda), '#ffffff', 4)
      tag(ctx, 10, 16, x.model === 'linear' ? 'linear, exact' : `model: ${x.model}`, x.model === 'linear' ? '#a0e8a0' : '#ffcc66')
    },
    [x],
  )
  return <canvas ref={ref} className="plot" data-view="bh" />
}

// -------------------------------------------------------------------- phasors

/** Voltage and current phasors, drawn to scale on one plane. */
export function PhasorCanvas({ arrows }) {
  const ref = useDraw(
    (ctx, w, h) => {
      const cx = w * 0.5
      const cy = h * 0.55
      const R = Math.min(w, h) * 0.4
      const biggest = Math.max(...arrows.map((a) => Math.hypot(a.re, a.im)), 1e-9)
      ctx.save()
      ctx.strokeStyle = '#3a4653'
      ctx.beginPath()
      ctx.moveTo(cx - R * 1.15, cy)
      ctx.lineTo(cx + R * 1.15, cy)
      ctx.moveTo(cx, cy - R * 1.05)
      ctx.lineTo(cx, cy + R * 1.05)
      ctx.stroke()
      ctx.font = '10px ui-monospace, monospace'
      arrows.forEach((a, k) => {
        const s = (R / biggest) * (a.scale || 1)
        const px = cx + s * a.re
        const py = cy - s * a.im
        ctx.strokeStyle = a.colour || CURVE[k % CURVE.length]
        ctx.fillStyle = ctx.strokeStyle
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(px, py)
        ctx.stroke()
        ctx.fillText(a.label, px + 4, py - 4)
      })
      ctx.restore()
    },
    [arrows],
  )
  return <canvas ref={ref} className="plot" data-view="phasors" />
}
