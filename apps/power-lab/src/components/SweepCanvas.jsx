import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt } from '@ee-labs/ui'
import { SWEEP_X, SWEEP_Y } from '../experiments.js'
import { axisFmt, fitLeftAxis, niceBounds } from '../format.js'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

/**
 * One quantity against one knob, every point a full steady state at that
 * setting (analysis.js sweeps). The measured curve is solid; the textbook
 * lines are dashed beside it — for the buck's M, the ideal M = D in blue and
 * the CCM/DCM prediction in amber, so where the converter leaves the first
 * formula the reader sees the second one pick it up; for the dimmer, the
 * closed-form power share. Stretches the engine found in discontinuous
 * conduction are shaded, and R_crit is marked when the knob is the load.
 *
 * `sweep` is `{ x, y, y2? }` with keys from SWEEP_X and SWEEP_Y; a `y2` is
 * drawn on a right-hand axis. `at` is the knob's current value, marked on
 * the curve.
 */
export default function SweepCanvas({ points, sweep, at, rcrit = null, label = '' }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      if (!points.length) return
      const ax = SWEEP_X[sweep.x]
      const ay = SWEEP_Y[sweep.y]
      const ay2 = sweep.y2 ? SWEEP_Y[sweep.y2] : null
      const k0 = plotArea(w, h).k
      const area = plotArea(w, h, { rightAxis: !!ay2, topInset: ay2 ? 16 * k0 : 0 })
      const k = area.k || 1
      const logX = ax.scale === 'log'
      const X = (v) => (logX ? Math.log10(v) : v)
      const xs = points.map((q) => X(q.x))
      const ys = points.map((q) => q[sweep.y])
      const xMin = logX ? xs[0] : sweep.x === 'D' ? 0 : xs[0]
      const xMax = logX ? xs[xs.length - 1] : sweep.x === 'D' ? 1 : xs[xs.length - 1]
      const fmtX = (v) => (ax.fmt ? ax.fmt(v) : fmt(v, ax.unit, 2))
      // A quantity that runs over decades — the buck-boost's output power goes
      // from under two watts to three hundred — is unreadable on a linear axis:
      // the flat stretch that is the whole point sits on the frame. Those
      // descriptors ask for a log axis, and the values are carried through it.
      const logY = ay.scale === 'log'
      const Y = (v) => (logY ? Math.log10(Math.max(v, 1e-12)) : v)
      const yRange = (a, key, log = false) => {
        const vals = points.map((q) => q[key]).filter(Number.isFinite).filter((v) => !log || v > 0)
        const preds = key === sweep.y ? points.map((q) => q.pred).filter(Number.isFinite).filter((v) => !log || v > 0) : []
        const all = [...vals, ...preds]
        const dataLo = Math.min(...all)
        const dataHi = Math.max(...all)
        if (log) return [Math.log10(dataLo) - 0.15, Math.log10(dataHi) + 0.15]
        // A declared lo/hi frames the usual case; data outside it still has to
        // fit, so the bound gives way rather than the curve — which is how an
        // inverting converter's M and V_out get their negative half. Padding is
        // added outward, in units of the span, so a negative axis grows the way
        // a positive one does.
        const span = Math.max(dataHi - dataLo, Math.abs(dataHi) * 0.1, 1e-12)
        let lo = Number.isFinite(a.lo) && dataLo >= a.lo ? a.lo : dataLo - span * 0.06
        let hi = Number.isFinite(a.hi) && dataHi <= a.hi ? a.hi : dataHi + span * 0.06
        // M keeps its unity line on the chart to be measured against.
        if (key === 'M' && dataHi > 0) hi = Math.max(hi, 1)
        return niceBounds(lo, hi)
      }
      const [yLo, yHi] = yRange(ay, sweep.y, logY)
      const fmtY = (a, lo, hi, log = false) => {
        if (log) {
          const f = axisFmt(Math.pow(10, lo), Math.pow(10, hi), a.unit, { ticks: 1 })
          return (v) => f(Math.pow(10, v))
        }
        if (a.percent) return (v) => `${Math.round(v * 100)} %`
        if (a.unit) return axisFmt(lo, hi, a.unit)
        // Unitless axes (M, power factor) still need enough decimals to
        // separate their ticks.
        const dp = Math.max(2, Math.ceil(-Math.log10(Math.max(1e-12, (hi - lo) / 5))) + 1)
        return (v) => v.toFixed(Math.min(6, dp))
      }
      const fmtYleft = fmtY(ay, yLo, yHi, logY)
      const framed = fitLeftAxis(ctx, area, [fmtYleft(yLo), fmtYleft(yHi), fmtYleft((yLo + yHi) / 2)], k)
      const { sx, sy } = drawFrame(ctx, framed, xMin, xMax, yLo, yHi, (v) => fmtX(logX ? Math.pow(10, v) : v), fmtYleft, {
        xStep: logX ? 1 : sweep.x === 'D' ? 0.1 : null,
        yStep: logY ? 1 : sweep.y === 'eta' ? 0.2 : null,
        xTitle: ax.unit ? `${ax.label} (${ax.unit})` : sweep.x === 'D' ? 'Duty D' : ax.label,
        yTitle: ay.unit ? `${ay.label} (${ay.unit})` : ay.label,
      })

      // Right axis for y2.
      const area2 = framed
      let sy2 = null
      if (ay2) {
        const [lo2, hi2] = yRange(ay2, sweep.y2)
        sy2 = (v) => area2.y + area2.h - ((v - lo2) / (hi2 - lo2)) * area2.h
        ctx.save()
        ctx.font = `${Math.round(11 * k)}px ${MONO}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = COLORS.text
        const n = Math.max(2, Math.floor(area2.h / (46 * k)))
        for (let i = 0; i <= n; i++) {
          const v = lo2 + ((hi2 - lo2) * i) / n
          ctx.fillText(fmtY(ay2, lo2, hi2)(v), area2.x + area2.w + 8 * k, sy2(v))
        }
        ctx.font = `${Math.round(12 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.translate(w - 14 * k, area2.y + area2.h / 2)
        ctx.rotate(Math.PI / 2)
        ctx.textAlign = 'center'
        ctx.fillText(ay2.unit ? `${ay2.label} (${ay2.unit})` : ay2.label, 0, 0)
        ctx.restore()
      }

      ctx.save()
      ctx.beginPath()
      ctx.rect(area2.x, area2.y, area2.w, area2.h)
      ctx.clip()

      // Discontinuous conduction, shaded where the engine found it.
      ctx.fillStyle = COLORS.spectrumDim
      let run = null
      const flush = (end) => {
        if (run === null) return
        ctx.fillRect(sx(run), area2.y, sx(end) - sx(run), area2.h)
        run = null
      }
      points.forEach((q, i) => {
        if (q.mode === 'DCM') {
          if (run === null) run = xs[i]
        } else flush(xs[i])
      })
      flush(xs[xs.length - 1])

      if (sweep.x === 'R' && Number.isFinite(rcrit) && rcrit > 0) {
        const x = sx(Math.log10(rcrit))
        ctx.strokeStyle = COLORS.marker
        ctx.globalAlpha = 0.7
        ctx.setLineDash([5 * k, 4 * k])
        ctx.lineWidth = 1 * k
        ctx.beginPath()
        ctx.moveTo(x, area2.y)
        ctx.lineTo(x, area2.y + area2.h)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
        ctx.fillStyle = COLORS.marker
        ctx.font = `${Math.round(11 * k)}px ${MONO}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(`R_crit = ${fmt(rcrit, 'Ω', 3)}`, x + 4 * k, area2.y + 4 * k)
      }

      const line = (key, color, dash, map = (v) => sy(Y(v)), width = 1.2) => {
        if (!points.some((q) => Number.isFinite(q[key]))) return
        ctx.strokeStyle = color
        ctx.setLineDash(dash)
        ctx.lineWidth = width * k
        ctx.beginPath()
        points.forEach((q, i) => {
          if (i === 0) ctx.moveTo(sx(xs[i]), map(q[key]))
          else ctx.lineTo(sx(xs[i]), map(q[key]))
        })
        ctx.stroke()
        ctx.setLineDash([])
      }
      if (sweep.y === 'M') {
        line('ideal', COLORS.response, [6 * k, 4 * k])
        line('pred', COLORS.spectrum, [2 * k, 3 * k])
      } else line('pred', COLORS.spectrum, [6 * k, 4 * k])
      if (sy2) line(sweep.y2, COLORS.response, [], sy2, 2)
      line(sweep.y, COLORS.trace, [], sy, 2)

      // Where the knob is now: the nearest computed point, so the dot sits on the curve.
      if (Number.isFinite(at)) {
        const lx = X(at)
        let best = 0
        for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - lx) < Math.abs(xs[best] - lx)) best = i
        ctx.fillStyle = COLORS.marker
        ctx.beginPath()
        ctx.arc(sx(xs[best]), sy(Y(ys[best])), 4 * k, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = `${Math.round(11 * k)}px ${MONO}`
        ctx.textAlign = lx > (xMin + xMax) / 2 ? 'right' : 'left'
        ctx.textBaseline = 'bottom'
        const yTxt = ay.percent ? `${(ys[best] * 100).toFixed(1)} %` : ay.unit ? fmt(ys[best], ay.unit, 4) : ys[best].toFixed(4)
        const xTxt = sweep.x === 'D' ? `D = ${at.toFixed(3)}` : fmtX(at)
        const dx = ctx.textAlign === 'right' ? -7 * k : 7 * k
        ctx.fillText(`${xTxt} → ${yTxt}`, sx(xs[best]) + dx, sy(Y(ys[best])) - 5 * k)
        if (sy2) {
          const v2 = points[best][sweep.y2]
          ctx.fillStyle = COLORS.response
          ctx.beginPath()
          ctx.arc(sx(xs[best]), sy2(v2), 4 * k, 0, Math.PI * 2)
          ctx.fill()
          ctx.textBaseline = 'top'
          ctx.fillText(ay2.unit ? fmt(v2, ay2.unit, 4) : v2.toFixed(4), sx(xs[best]) + dx, sy2(v2) + 5 * k)
        }
      }

      // Legend: top left where the curves rise to the right, bottom right
      // where they sit high across the sweep.
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.textBaseline = 'top'
      const items = [[COLORS.trace, label || `${ay.label} measured`]]
      if (sweep.y === 'M') items.push([COLORS.response, 'M = D (dashed)'], [COLORS.spectrum, 'CCM/DCM formula (dotted)'])
      else if (points.some((q) => Number.isFinite(q.pred))) items.push([COLORS.spectrum, 'closed form (dashed)'])
      if (ay2) items.push([COLORS.response, `${ay2.label} (right axis)`])
      if (points.some((q) => q.mode === 'DCM')) items.push([COLORS.spectrum, 'shaded: discontinuous conduction'])
      // (The conduction angle falls to the right while the peak current rises: the middle of the top is free.)
      // Wherever the curves are not: M climbs to the right, the conduction
      // angle falls to it, and a power that flattens off leaves its bottom left
      // corner empty.
      const pos = sweep.y === 'M' ? 'tl' : sweep.y === 'angle' ? 'tc' : sweep.y === 'Pout' ? 'bl' : 'br'
      ctx.textAlign = pos === 'tl' || pos === 'bl' ? 'left' : pos === 'tc' ? 'center' : 'right'
      const lx =
        pos === 'tl' || pos === 'bl'
          ? area2.x + 8 * k
          : pos === 'tc'
            ? area2.x + area2.w / 2
            : area2.x + area2.w - 8 * k
      items.forEach(([c, t], i) => {
        ctx.fillStyle = c
        const y =
          pos === 'br' || pos === 'bl'
            ? area2.y + area2.h - (items.length - i) * 15 * k - 4 * k
            : area2.y + 6 * k + i * 15 * k
        ctx.fillText(t, lx, y)
      })
      ctx.restore()
    },
    [points, sweep, at, rcrit, label],
  )
  return <canvas ref={ref} className="plot" role="img" aria-label="Sweep: one quantity against one knob, each point a solved steady state" />
}
