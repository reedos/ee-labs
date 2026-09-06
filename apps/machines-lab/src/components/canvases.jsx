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

/**
 * Axis chrome shared by every plot here, and the band a plot's key sits in.
 *
 * `key` is the lines of text that name what is drawn. They go ABOVE the frame,
 * in a band `plotArea` reserves for them, because a caption drawn inside the
 * plot covers the trace it is describing however it is placed. Each entry is
 * `[text, colour]`, and the colour is the curve it names.
 */
function frame(ctx, w, h, opts) {
  const key = opts.key || []
  const scale = plotArea(w, h).k
  const lead = 13 * scale
  const area = plotArea(w, h, { rightAxis: opts.rightAxis, topInset: key.length * lead })
  const { sx, sy } = drawFrame(ctx, area, opts.x.min, opts.x.max, opts.y.min, opts.y.max, tick, tick, {
    xTitle: opts.xLabel,
    yTitle: opts.yLabel,
    zeroLine: true,
  })
  if (key.length) {
    ctx.save()
    ctx.font = `${10 * scale}px ui-monospace, monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    key.forEach(([text, colour], k) => {
      ctx.fillStyle = colour || '#8b9bad'
      ctx.fillText(text, area.x, area.y - key.length * lead + (k + 1) * lead - 4 * scale)
    })
    ctx.restore()
  }
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
      // The crossing is where the machine runs, and it is the number every
      // Group A note quotes. On a frame whose torque axis is set by the stall
      // torque, a 0.05 N·m load sits within a pixel of the speed axis, so the
      // dot alone cannot be read. The reading is written out above the frame.
      const here = lines.length === 1 ? lines[0].point : null
      const { area, sx, sy } = frame(ctx, w, h, {
        x: { min: 0, max: radToRpm(topSpeed) },
        y: { min: 0, max: topTorque },
        xLabel: 'speed (rev/min)',
        yLabel: 'torque (N·m)',
        key: here
          ? [
              [`running at ${Math.round(radToRpm(here.omega))} rev/min, ${here.torque.toPrecision(3)} N·m`, '#a0e8a0'],
              [
                `machine: stall ${x.line.stall.toPrecision(3)} N·m, no load ${Math.round(radToRpm(x.line.noLoad))} rev/min`,
                CURVE[0],
              ],
              ['load, dashed', '#ff9a9a'],
            ]
          : [['one line per setting, each with its own crossing', '#8b9bad']],
      })
      const k = area.k
      lines.forEach((l, j) => {
        const colour = CURVE[j % CURVE.length]
        const speeds = [0, l.noLoad]
        line(ctx, speeds.map(radToRpm), speeds.map(l.torqueAt), sx, sy, colour, rows.length ? 1.4 : 2)
        if (l.point) dot(ctx, sx(radToRpm(l.point.omega)), sy(l.point.torque), colour)
      })
      // The load, which for this machine is a constant plus a friction term.
      const m = x.spec
      const load = (wm) => m.TL + (m.B + (m.loadB || 0)) * wm
      const ws = [0, topSpeed]
      // Dashed, because a light load's line lies along the zero line and the
      // two were drawn as one solid stroke.
      ctx.save()
      ctx.setLineDash([6 * k, 4 * k])
      line(ctx, ws.map(radToRpm), ws.map(load), sx, sy, '#ff9a9a', 1.6)
      ctx.restore()
      tag(ctx, sx(radToRpm(topSpeed)) - 34 * k, sy(load(topSpeed)) - 6 * k, 'load', '#ff9a9a')
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
      const { area, sx, sy } = frame(ctx, w, h, {
        x: { min: 0, max: 360 },
        y: { min: -amp * 1.15, max: amp * 1.15 },
        xLabel: 'angle around the gap (°)',
        yLabel: 'magnetomotive force (A-turns)',
        // C2's lesson is the pole count and the speed it sets, and the field
        // plot is its only view, so both belong on it.
        key: [
          [
            `${x.field.poles} poles at ${x.field.omega / (2 * Math.PI)} Hz, synchronous speed ${Math.round(x.field.rpmSync)} rev/min`,
            '#e6edf3',
          ],
          [
            `${x.pairs} cycle${x.pairs === 1 ? '' : 's'} of the wave around the gap, one per pole pair`,
            '#8b9bad',
          ],
        ],
      })
      const k = area.k
      ctx.save()
      ctx.font = `${10 * k}px ui-monospace, monospace`
      // Four curves on one frame with no key. Each winding's own contribution
      // is named at the angle where it peaks, and the sum is named where it
      // does, so a reader can tell the three apart from the one.
      const NAMES = ['phase a', 'phase b', 'phase c']
      x.phase.forEach((p, j) => {
        line(ctx, deg, p, sx, sy, CURVE[j + 1], 1.1)
        let best = 0
        for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i
        ctx.fillStyle = CURVE[j + 1]
        // A winding that peaks at angle zero puts its name over the y-axis
        // ticks, so a label near either edge is anchored inward instead.
        const px = sx(deg[best])
        const near = 36 * k
        ctx.textAlign = px < area.x + near ? 'left' : px > area.x + area.w - near ? 'right' : 'center'
        ctx.fillText(NAMES[j], Math.min(Math.max(px, area.x + 3 * k), area.x + area.w - 3 * k), sy(p[best]) - 5 * k)
      })
      line(ctx, deg, x.total, sx, sy, CURVE[0], 2.4)
      // Where the peak sits now, which is what travels. The wave repeats once
      // per pole pair around the gap, so the electrical angle of the peak is
      // divided down to the mechanical angle the axis carries.
      const peakElec = (((x.field.omega * x.t) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
      const peakMech = ((peakElec / x.pairs) * 180) / Math.PI
      dot(ctx, sx(peakMech), sy(amp), '#ffffff', 4)
      ctx.fillStyle = CURVE[0]
      ctx.textAlign = peakMech > 300 ? 'right' : 'left'
      ctx.fillText('the sum of the three', sx(peakMech) + (peakMech > 300 ? -8 : 8) * k, sy(amp) - 6 * k)
      ctx.restore()
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
        rightAxis: true,
      })
      const top = Math.max(...rpm) * 1.1 || 1
      const sy2 = (v) => area.y + area.h - (v / top) * area.h
      line(ctx, t, rpm, sx, sy2, CURVE[2], 1.4)
      line(ctx, t, ia, sx, sy, CURVE[0], 2)
      // The speed trace had no axis of its own: no ticks, no unit, and a
      // corner tag naming only its ceiling. A second quantity on a shared
      // frame needs a second axis (playbook §4), so it gets one on the right,
      // in its own colour so a reader knows which trace it belongs to.
      ctx.save()
      const k = area.k
      ctx.strokeStyle = CURVE[2]
      ctx.fillStyle = CURVE[2]
      ctx.font = `${10 * k}px ui-monospace, monospace`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      const right = area.x + area.w
      ctx.beginPath()
      ctx.moveTo(right, area.y)
      ctx.lineTo(right, area.y + area.h)
      ctx.stroke()
      for (let j = 0; j <= 4; j++) {
        const v = (top * j) / 4
        const py = sy2(v)
        ctx.beginPath()
        ctx.moveTo(right, py)
        ctx.lineTo(right + 4 * k, py)
        ctx.stroke()
        ctx.fillText(tick(v), right + 7 * k, py)
      }
      // Reading bottom-to-top, the same way the left axis title does.
      ctx.translate(right + 52 * k, area.y + area.h / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.fillText('speed (rev/min)', 0, 0)
      ctx.restore()
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
      // The straight line is the linear model, and past the knee it leaves the
      // frame. E5's whole claim is the size of that difference, 1.32 Wb where
      // the linear model said 3.60, so a silently clipped line hides the one
      // number the lesson exists to show (playbook §10). It is drawn dashed,
      // it is named, and the key says both values and where the line went.
      const clipped = c.linear.map((v) => Math.max(-top, Math.min(top, v)))
      const escapes = c.linear.some((v) => Math.abs(v) > top)
      const linearHere = x.spec.L0 * x.i
      const key = [
        [x.model === 'linear' ? 'model: linear, exact' : `model: ${x.model}`, x.model === 'linear' ? '#a0e8a0' : '#ffcc66'],
        [`dashed: the linear model, ${linearHere.toPrecision(3)} Wb at this current`, '#8b9bad'],
        [`solid: this model, ${x.sat.lambda.toPrecision(3)} Wb at ${x.i.toPrecision(3)} A`, CURVE[0]],
      ]
      if (escapes) key.push([`the dashed line leaves the frame above ${top.toPrecision(3)} Wb`, '#ff9a9a'])
      const { area, sx, sy } = frame(ctx, w, h, {
        x: { min: c.i[0], max: c.i[c.i.length - 1] },
        y: { min: -top, max: top },
        xLabel: 'magnetising current (A)',
        yLabel: 'flux linkage (Wb)',
        key,
      })
      const k = area.k
      ctx.save()
      ctx.setLineDash([5 * k, 4 * k])
      line(ctx, c.i, clipped, sx, sy, '#8b9bad', 1.4)
      ctx.restore()
      line(ctx, c.i, c.lambda, sx, sy, CURVE[0], 2.2)
      dot(ctx, sx(x.i), sy(x.sat.lambda), '#ffffff', 4)
    },
    [x],
  )
  return <canvas ref={ref} className="plot" data-view="bh" />
}

// -------------------------------------------------------------------- phasors

/**
 * A round magnification, so the caption that states it reads as a number a
 * person would choose: 1, 2, 5, 10, 20, 50 and so on.
 */
export function roundFactor(want) {
  if (!(want > 0) || !Number.isFinite(want)) return 1
  const decade = 10 ** Math.floor(Math.log10(want))
  for (const step of [1, 2, 5]) if (want < step * decade * Math.SQRT2) return step * decade
  return 10 * decade
}

/**
 * Voltage and current phasors on one named plane.
 *
 * Three defects lived in the old version of this view, and all three are the
 * playbook's own examples.
 *
 * It had no axes at all: two grey lines through an unlabelled origin, no
 * quantity, no unit and no scale (§4). It magnified the current by six in the
 * transformer and by ten in the synchronous machine and said so nowhere, so a
 * 19 A arrow and a 114 V arrow were drawn the same length (§6, mixed scales
 * are stated). And its arrows shared coordinates: B5's whole lesson is the
 * angle the load current puts between the no-load and loaded secondary, and
 * the two voltages were drawn one on top of the other with their labels
 * overlapping (§6, occlusion).
 *
 * So: the plane is the complex plane in volts, with both axes named. A
 * current is drawn at a round magnification which the caption states, and
 * every arrow's own magnitude and angle are printed beside it in its own
 * unit. Labels are placed radially outward from each tip and pushed apart
 * when two tips land close together.
 */
export function PhasorCanvas({ arrows, unit = 'V' }) {
  const ref = useDraw(
    (ctx, w, h) => {
      // Voltages set the plane. A current is magnified onto it by a round
      // factor, chosen so the longest current reads about as long as the
      // longest voltage.
      const mag = (a) => Math.hypot(a.re, a.im)
      const volts = arrows.filter((a) => !a.current)
      const amps = arrows.filter((a) => a.current)
      const topV = Math.max(...volts.map(mag), 1e-9)
      const topI = Math.max(...amps.map(mag), 0)
      const factor = topI > 0 ? roundFactor(topV / topI) : 1
      const drawn = arrows.map((a) => ({ ...a, k: a.current ? factor : 1 }))

      // Equal units per pixel on both axes, or the plane does not preserve
      // angles. The old symmetric square was mapped onto a pane twice as wide
      // as it is tall, which stretched the real axis and drew every phasor
      // angle smaller than it is. On B5 the 5.4° the lesson is about was drawn
      // as about 2°. The frame is fitted to the arrows and to the origin, then
      // whichever axis is short is grown until the scales match.
      const key = [['angles are true: both axes are the same number of volts per pixel', '#8b9bad']]
      if (factor !== 1) key.push([`the current is drawn ${factor} times longer than its ${unit} would put it`, '#ffcc66'])
      const inset = key.length * 13 * plotArea(w, h).k
      const probe = plotArea(w, h, { topInset: inset })
      const res = [0, ...drawn.map((a) => a.re * a.k)]
      const ims = [0, ...drawn.map((a) => a.im * a.k)]
      const pad = Math.max(...drawn.map((a) => mag(a) * a.k), 1e-9) * 0.18
      let [x0, x1] = [Math.min(...res) - pad, Math.max(...res) + pad]
      let [y0, y1] = [Math.min(...ims) - pad, Math.max(...ims) + pad]
      const per = Math.max((x1 - x0) / probe.w, (y1 - y0) / probe.h)
      const growX = (per * probe.w - (x1 - x0)) / 2
      const growY = (per * probe.h - (y1 - y0)) / 2
      x0 -= growX
      x1 += growX
      y0 -= growY
      y1 += growY

      const { area, sx, sy } = frame(ctx, w, h, {
        x: { min: x0, max: x1 },
        y: { min: y0, max: y1 },
        xLabel: `real part (${unit})`,
        yLabel: `imaginary part (${unit})`,
        key,
      })
      const ox = sx(0)
      const oy = sy(0)
      ctx.save()
      ctx.font = '10px ui-monospace, monospace'
      const tips = []
      drawn.forEach((a, k) => {
        const px = sx(a.re * a.k)
        const py = sy(a.im * a.k)
        ctx.strokeStyle = a.colour || CURVE[k % CURVE.length]
        ctx.fillStyle = ctx.strokeStyle
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(ox, oy)
        ctx.lineTo(px, py)
        ctx.stroke()
        // The head, so the direction is not read off the label alone.
        const th = Math.atan2(py - oy, px - ox)
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(px - 8 * Math.cos(th - 0.4), py - 8 * Math.sin(th - 0.4))
        ctx.lineTo(px - 8 * Math.cos(th + 0.4), py - 8 * Math.sin(th + 0.4))
        ctx.closePath()
        ctx.fill()

        const angle = (Math.atan2(a.im, a.re) * 180) / Math.PI
        const text = `${a.label} ${mag(a).toPrecision(4)} ${a.unit || unit} ∠${angle.toFixed(1)}°`
        // Hang the label off the tip, along the arrow, and step it away from
        // any label already placed near the same point.
        let lx = px + 10 * Math.cos(th)
        let ly = py + 10 * Math.sin(th) + 4
        while (tips.some((t) => Math.abs(t.x - lx) < 130 && Math.abs(t.y - ly) < 13)) ly += 13
        tips.push({ x: lx, y: ly })
        if (lx + text.length * 6 > area.x + area.w) lx = area.x + area.w - text.length * 6
        ctx.fillText(text, Math.max(area.x + 2, lx), Math.min(area.y + area.h - 2, ly))
      })
      ctx.restore()
    },
    [arrows, unit],
  )
  return <canvas ref={ref} className="plot" data-view="phasors" />
}
