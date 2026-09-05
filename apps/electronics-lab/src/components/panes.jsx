import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas, fmt } from '@ee-labs/ui'
import { equations } from '@ee-labs/network'
import { bodePoints } from '../math.js'
import NoiseCanvas from './NoiseCanvas.jsx'
import { num } from '../format.js'

/**
 * The lower pane, in every view this lab has.
 *
 * Each canvas draws one thing and names both axes with their units, which is
 * the fourth item of the review playbook. Nothing here computes physics: the
 * analysis object arrives already solved, and a pane that has nothing to draw
 * says why in a sentence rather than drawing an empty frame.
 */

const engHz = (v) => fmt(v, 'Hz', 3)

/** A pane with nothing to draw, and the reason. */
function Empty({ children }) {
  return (
    <p className="pane-empty" data-role="empty">
      {children}
    </p>
  )
}

/** Voltages against time, exact inside every region, with the cursor on top. */
export function ScopeCanvas({ x }) {
  const traces = (x.exp.scope && x.exp.scope.traces) || []
  const ref = useCanvas(
    (ctx, w, h) => {
      if (!x.tr) return
      const area = plotArea(w, h)
      const ts = x.tr.samples.map((s) => s.t)
      let lo = Infinity
      let hi = -Infinity
      for (const t of traces) {
        for (const s of x.tr.samples) {
          const v = s.sol[t.q][t.key]
          if (Number.isFinite(v)) {
            lo = Math.min(lo, v)
            hi = Math.max(hi, v)
          }
        }
      }
      if (!Number.isFinite(lo)) return
      const pad = Math.max((hi - lo) * 0.12, 1e-12)
      lo -= pad
      hi += pad
      const t0 = ts[0]
      const t1 = ts[ts.length - 1]
      drawFrame(ctx, area, t0, t1, lo, hi, (v) => fmt(v, 's', 2), (v) => fmt(v, 'V', 2), {
        zeroLine: true,
        xTitle: 'time (s)',
        yTitle: 'volts (V)',
      })
      const sx = (t) => area.x + ((t - t0) / (t1 - t0)) * area.w
      const sy = (v) => area.y + area.h - ((v - lo) / (hi - lo)) * area.h
      traces.forEach((t, k) => {
        ctx.strokeStyle = k === 0 ? COLORS.trace : COLORS.response
        ctx.lineWidth = 1.6
        ctx.beginPath()
        x.tr.samples.forEach((s, i) => {
          const px = sx(s.t)
          const py = sy(s.sol[t.q][t.key])
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.stroke()
      })
      // Every region change is an event, and an event is an exact instant.
      ctx.strokeStyle = COLORS.gridMajor
      ctx.setLineDash([3, 3])
      for (const ev of x.tr.events || []) {
        const px = sx(ev.t)
        ctx.beginPath()
        ctx.moveTo(px, area.y)
        ctx.lineTo(px, area.y + area.h)
        ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.strokeStyle = COLORS.marker
      ctx.lineWidth = 1
      const cx = sx(x.cursor)
      ctx.beginPath()
      ctx.moveTo(cx, area.y)
      ctx.lineTo(cx, area.y + area.h)
      ctx.stroke()
      ctx.fillStyle = COLORS.textBright
      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textAlign = 'left'
      traces.forEach((t, k) => {
        ctx.fillStyle = k === 0 ? COLORS.trace : COLORS.response
        ctx.fillText(`${t.label} ${num(x.now.sol[t.q][t.key], t.q === 'i' ? 'A' : 'V')}`, area.x + 8, area.y + 14 + k * 14)
      })
    },
    [x],
  )
  if (!x.tr) return <Empty>This experiment has no time axis. Its circuit settles at one point and stays there.</Empty>
  return <canvas className="pane-canvas" ref={ref} aria-label="Voltages against time" />
}

/** |H| in dB and the phase, from the exact polynomials. */
export function BodeCanvas({ x }) {
  const pts = bodePoints(x)
  const ref = useCanvas(
    (ctx, w, h) => {
      if (!pts) return
      const area = plotArea(w, h, { rightAxis: true })
      const lo = Math.log10(pts.f[0])
      const hi = Math.log10(pts.f[pts.f.length - 1])
      let dbLo = Infinity
      let dbHi = -Infinity
      for (const v of pts.db) {
        dbLo = Math.min(dbLo, v)
        dbHi = Math.max(dbHi, v)
      }
      dbLo = Math.max(dbLo, dbHi - 120)
      const pad = Math.max((dbHi - dbLo) * 0.1, 1)
      drawFrame(ctx, area, lo, hi, dbLo - pad, dbHi + pad, (v) => engHz(10 ** v), (v) => `${v.toFixed(0)}`, {
        xTitle: 'frequency (Hz, log)',
        yTitle: 'magnitude (dB)',
        xStep: 1,
      })
      const sx = (f) => area.x + ((Math.log10(f) - lo) / (hi - lo)) * area.w
      const sy = (v) => area.y + area.h - ((v - (dbLo - pad)) / (dbHi + pad - (dbLo - pad))) * area.h
      ctx.strokeStyle = COLORS.trace
      ctx.lineWidth = 1.6
      ctx.beginPath()
      for (let k = 0; k < pts.f.length; k++) {
        const px = sx(pts.f[k])
        const py = sy(pts.db[k])
        if (k === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      // Phase on its own axis, so the two curves cannot be read as one.
      const py = (deg) => area.y + area.h - ((deg + 200) / 400) * area.h
      ctx.strokeStyle = COLORS.phase
      ctx.lineWidth = 1.2
      ctx.beginPath()
      for (let k = 0; k < pts.f.length; k++) {
        const px = sx(pts.f[k])
        const p = py(pts.deg[k])
        if (k === 0) ctx.moveTo(px, p)
        else ctx.lineTo(px, p)
      }
      ctx.stroke()
      ctx.fillStyle = COLORS.phase
      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textAlign = 'right'
      for (const deg of [-180, -90, 0, 90]) ctx.fillText(`${deg}°`, area.x + area.w + 40 * area.k, py(deg))
      // The poles the polynomials carry, marked on the frequency axis.
      ctx.strokeStyle = COLORS.marker
      ctx.setLineDash([4, 3])
      for (const p of x.poles || []) {
        if (!(p.hz > 0)) continue
        const px = sx(p.hz)
        ctx.beginPath()
        ctx.moveTo(px, area.y)
        ctx.lineTo(px, area.y + area.h)
        ctx.stroke()
      }
      ctx.setLineDash([])
    },
    [x],
  )
  if (!pts) return <Empty>{x.signalRefusal ? x.signalRefusal.message : 'This experiment has no small-signal transfer function.'}</Empty>
  return <canvas className="pane-canvas" ref={ref} aria-label="Magnitude and phase against frequency" />
}

/** The poles and zeros of the small-signal transfer function, as numbers on the plane. */
export function PZCanvas({ x }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      if (!x.tf) return
      const area = plotArea(w, h)
      const all = [...(x.poles || []), ...(x.zeros || [])]
      const span = Math.max(1, ...all.map((p) => Math.max(Math.abs(p.re), Math.abs(p.im)))) * 1.3
      drawFrame(ctx, area, -span, span, -span, span, (v) => fmt(v, '', 2), (v) => fmt(v, '', 2), {
        zeroLine: true,
        xTitle: 'real part (rad/s)',
        yTitle: 'imaginary part (rad/s)',
      })
      const sx = (v) => area.x + ((v + span) / (2 * span)) * area.w
      const sy = (v) => area.y + area.h - ((v + span) / (2 * span)) * area.h
      ctx.lineWidth = 1.6
      for (const p of x.poles || []) {
        ctx.strokeStyle = COLORS.marker
        const px = sx(p.re)
        const py = sy(p.im)
        ctx.beginPath()
        ctx.moveTo(px - 5, py - 5)
        ctx.lineTo(px + 5, py + 5)
        ctx.moveTo(px + 5, py - 5)
        ctx.lineTo(px - 5, py + 5)
        ctx.stroke()
      }
      for (const z of x.zeros || []) {
        ctx.strokeStyle = COLORS.response
        ctx.beginPath()
        ctx.arc(sx(z.re), sy(z.im), 5, 0, 2 * Math.PI)
        ctx.stroke()
      }
    },
    [x],
  )
  if (!x.tf) return <Empty>{x.signalRefusal ? x.signalRefusal.message : 'This experiment has no small-signal transfer function.'}</Empty>
  return (
    <div className="pane-split">
      <canvas className="pane-canvas" ref={ref} aria-label="Poles and zeros on the complex plane" />
      <ul className="pane-list">
        {(x.poles || []).map((p, k) => (
          <li key={`p${k}`}>
            pole {k + 1}: {num(p.hz, 'Hz')}
          </li>
        ))}
        {(x.zeros || []).map((z, k) => (
          <li key={`z${k}`}>
            zero {k + 1}: {num(z.hz, 'Hz')}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Output against input from the quasi-static sweep, with the tangent at the point. */
export function TransferCanvas({ x }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      if (!x.sweep) return
      const area = plotArea(w, h)
      const { xs, ys } = x.sweep
      const xLo = Math.min(...xs)
      const xHi = Math.max(...xs)
      const yLo = Math.min(...ys)
      const yHi = Math.max(...ys)
      const pad = Math.max((yHi - yLo) * 0.1, 1e-9)
      drawFrame(ctx, area, xLo, xHi, yLo - pad, yHi + pad, (v) => fmt(v, 'V', 2), (v) => fmt(v, 'V', 2), {
        zeroLine: true,
        xTitle: `${x.exp.sweepOver.label || 'input'} (V)`,
        yTitle: 'output (V)',
      })
      const sx = (v) => area.x + ((v - xLo) / (xHi - xLo)) * area.w
      const sy = (v) => area.y + area.h - ((v - (yLo - pad)) / (yHi + pad - (yLo - pad))) * area.h
      ctx.strokeStyle = COLORS.trace
      ctx.lineWidth = 1.6
      ctx.beginPath()
      xs.forEach((v, k) => {
        const px = sx(v)
        const py = sy(ys[k])
        if (k === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()
    },
    [x],
  )
  if (!x.sweep) return <Empty>This experiment has no transfer characteristic. Nothing here is swept.</Empty>
  return <canvas className="pane-canvas" ref={ref} aria-label="Output against input" />
}

/** The device's curves, with the load line and the point where they meet. */
export function CurvesCanvas({ x }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      if (!x.curves) return
      const area = plotArea(w, h)
      const { family, load, point, xLabel, yLabel } = x.curves
      const xHi = Math.max(...family.flatMap((c) => c.xs))
      const yHi = Math.max(...family.flatMap((c) => c.ys), ...(load ? load.ys : [0])) * 1.1
      drawFrame(ctx, area, 0, xHi, 0, yHi, (v) => fmt(v, 'V', 2), (v) => fmt(v, 'A', 2), {
        xTitle: xLabel,
        yTitle: yLabel,
      })
      const sx = (v) => area.x + (v / xHi) * area.w
      const sy = (v) => area.y + area.h - (v / yHi) * area.h
      for (const c of family) {
        ctx.strokeStyle = c.lit ? COLORS.trace : COLORS.traceGhost
        ctx.lineWidth = c.lit ? 1.8 : 1.1
        ctx.beginPath()
        c.xs.forEach((v, k) => {
          const px = sx(v)
          const py = sy(c.ys[k])
          if (k === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.stroke()
      }
      if (load) {
        ctx.strokeStyle = COLORS.spectrum
        ctx.lineWidth = 1.4
        ctx.beginPath()
        load.xs.forEach((v, k) => {
          const px = sx(v)
          const py = sy(load.ys[k])
          if (k === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.stroke()
      }
      if (point) {
        ctx.fillStyle = COLORS.marker
        ctx.beginPath()
        ctx.arc(sx(point.x), sy(point.y), 4, 0, 2 * Math.PI)
        ctx.fill()
      }
    },
    [x],
  )
  if (!x.curves) return <Empty>This experiment carries no device whose curves can be drawn.</Empty>
  return <canvas className="pane-canvas" ref={ref} aria-label="Device curves with the load line" />
}

/** The output's harmonics, with the distortion beside them. */
export function SpectrumCanvas({ x }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      if (!x.spectrum) return
      const area = plotArea(w, h)
      const { f, mag } = x.spectrum
      const hi = Math.max(...mag)
      drawFrame(ctx, area, 0, f[f.length - 1], 0, hi * 1.1, engHz, (v) => fmt(v, 'V', 2), {
        xTitle: 'frequency (Hz)',
        yTitle: 'amplitude (V)',
      })
      const sx = (v) => area.x + (v / f[f.length - 1]) * area.w
      const sy = (v) => area.y + area.h - (v / (hi * 1.1)) * area.h
      ctx.strokeStyle = COLORS.spectrum
      ctx.lineWidth = 2
      f.forEach((v, k) => {
        ctx.beginPath()
        ctx.moveTo(sx(v), sy(0))
        ctx.lineTo(sx(v), sy(mag[k]))
        ctx.stroke()
      })
    },
    [x],
  )
  if (!x.spectrum) return <Empty>This experiment has no spectrum. Nothing here is driven with a sine.</Empty>
  return <canvas className="pane-canvas" ref={ref} aria-label="The output's harmonics" />
}

/** The depletion region drawn to scale against the bias, with C_j beside it. */
export function JunctionCanvas({ x }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const j = x.junction
      if (!j || !Number.isFinite(j.w)) return
      const area = plotArea(w, h)
      // The crystal is drawn a micron wide whatever the bias, so the depletion
      // region's width is read against a fixed scale rather than a moving one.
      const span = 1.4e-6
      drawFrame(ctx, area, -span / 2, span / 2, -1, 1, (v) => fmt(v, 'm', 2), () => '', {
        xTitle: 'position through the junction (m)',
        yTitle: 'p side, then n side',
      })
      const sx = (v) => area.x + ((v + span / 2) / span) * area.w
      ctx.fillStyle = 'rgba(56, 224, 176, 0.10)'
      ctx.fillRect(area.x, area.y, sx(-j.xp) - area.x, area.h)
      ctx.fillStyle = 'rgba(95, 168, 255, 0.10)'
      ctx.fillRect(sx(j.xn), area.y, area.x + area.w - sx(j.xn), area.h)
      ctx.fillStyle = 'rgba(240, 162, 60, 0.18)'
      ctx.fillRect(sx(-j.xp), area.y, sx(j.xn) - sx(-j.xp), area.h)
      ctx.strokeStyle = COLORS.spectrum
      ctx.lineWidth = 1.4
      ctx.strokeRect(sx(-j.xp) + 0.5, area.y + 0.5, sx(j.xn) - sx(-j.xp), area.h)
      ctx.fillStyle = COLORS.textBright
      ctx.font = `${Math.round(12 * area.k)}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(`W = ${num(j.w, 'm')}`, (sx(-j.xp) + sx(j.xn)) / 2, area.y + 18)
      ctx.textAlign = 'left'
      ctx.fillText(`p side, N_A`, area.x + 8, area.y + area.h - 10)
      ctx.textAlign = 'right'
      ctx.fillText(`n side, N_D`, area.x + area.w - 8, area.y + area.h - 10)
    },
    [x],
  )
  const j = x.junction
  if (!j) return <Empty>This experiment carries no junction to draw.</Empty>
  return (
    <div className="pane-split">
      {Number.isFinite(j.w) ? (
        <canvas className="pane-canvas" ref={ref} aria-label="The depletion region, drawn to scale" />
      ) : (
        <Empty>{j.widthRefusal ? j.widthRefusal.message : 'The depletion region has no width at this bias.'}</Empty>
      )}
      <ul className="pane-list">
        <li>V₀ {num(j.v0, 'V')}</li>
        <li>bias {num(j.v, 'V')}</li>
        <li>C_j {j.capRefusal ? j.capRefusal.message : num(j.cj, 'F')}</li>
        <li>C_d {num(j.cd, 'F')}</li>
        <li>I_S at this temperature {num(j.is, 'A')}</li>
      </ul>
    </div>
  )
}

/** Every meter on the circuit at once, and the headline number. */
export function ReadingPane({ x }) {
  if (!x.sol) return <Empty>{x.refusal ? x.refusal.message : 'This circuit has no solution.'}</Empty>
  const nodes = Object.keys(x.sol.v).filter((n) => n !== 'gnd')
  const els = Object.keys(x.sol.i)
  return (
    <div className="pane-reading">
      <table className="pane-table">
        <caption>Node voltages, in volts</caption>
        <tbody>
          {nodes.map((n) => (
            <tr key={n}>
              <th scope="row">{n}</th>
              <td>{num(x.sol.v[n], 'V')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="pane-table">
        <caption>Element currents, in amps</caption>
        <tbody>
          {els.map((id) => (
            <tr key={id}>
              <th scope="row">{id}</th>
              <td>{num(x.sol.i[id], 'A')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {Object.keys(x.point || {}).length ? (
        <table className="pane-table">
          <caption>The operating point, and the tangent at it</caption>
          <tbody>
            {Object.entries(x.point).map(([id, p]) => (
              <tr key={id}>
                <th scope="row">{id}</th>
                <td>
                  {p.region ? `${p.region}, ` : ''}
                  {p.ic !== undefined ? `I_C ${num(p.ic, 'A')}, V_CE ${num(p.vce, 'V')}` : ''}
                  {p.id_ !== undefined ? `I_D ${num(p.id_, 'A')}, V_DS ${num(p.vds, 'V')}` : ''}
                  {Number.isFinite(p.gm) ? `, g_m ${num(p.gm, 'S')}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}

/** The small-signal netlist printed as elements, then the rows the solver built. */
export function EquationsPane({ x }) {
  if (!x.sol) return <Empty>{x.refusal ? x.refusal.message : 'This circuit has no solution.'}</Empty>
  const eq = equations(x.sol.norm, x.sol)
  return (
    <div className="pane-equations">
      {x.ss ? (
        <>
          <h3>The tangent, as a netlist {x.label}</h3>
          <ul className="pane-list">
            {x.ss.elements.map((e) => (
              <li key={e.id}>
                {e.id}: {e.type} {e.nodes.join(', ')} {Number.isFinite(e.value) ? num(e.value, e.type === 'R' ? 'Ω' : e.type === 'C' ? 'F' : 'V') : ''}
                {Number.isFinite(e.gain) ? num(e.gain, 'S') : ''}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>{eq.unknowns.length} unknowns, {eq.rows.length} rows</h3>
      <ul className="pane-list">
        {eq.unknowns.map((u) => (
          <li key={u.kind === 'v' ? `v${u.node}` : `i${u.id}`}>{u.kind === 'v' ? `v(${u.node})` : `i(${u.id})`}</li>
        ))}
      </ul>
    </div>
  )
}

const PANES = {
  reading: ReadingPane,
  scope: ScopeCanvas,
  curves: CurvesCanvas,
  transfer: TransferCanvas,
  bode: BodeCanvas,
  pz: PZCanvas,
  spectrum: SpectrumCanvas,
  noise: NoiseCanvas,
  junction: JunctionCanvas,
  equations: EquationsPane,
}

/** The pane a view names. */
export default function Pane({ view, x }) {
  const C = PANES[view] || ReadingPane
  return <C x={x} />
}
