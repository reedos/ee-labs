import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt } from '@ee-labs/ui'
import { Formula } from '@ee-labs/explain'
import { TRACE_COLORS } from './ScopeCanvas.jsx'
import { axisFmt, niceBounds } from '../format.js'

// The four panes Groups L, M and N add.
//
//   Drive    the machine's own line, with the operating point on it
//   Filter   the harmonics the converter draws and what reaches the line
//   Ring     the node's ring, zoomed to the edge that starts it
//   Thermal  the transient thermal impedance, and what it makes of the loss
//
// Each draws the number its note leads with. None of them is a second copy of
// the scope: the scope shows the waveform, and these show the thing the
// waveform is evidence for.

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const Eq = ({ children }) => <Formula display={false}>{children}</Formula>

/** Which pane a view name asks for. */
export default function LmnPane({ view, x, exp }) {
  if (view === 'drive') return <DrivePane x={x} />
  if (view === 'filter') return <FilterPane x={x} />
  if (view === 'ring') return <RingPane x={x} />
  if (view === 'thermal') return <ThermalPane x={x} exp={exp} />
  return null
}

// ------------------------------------------------------------ the drive

/**
 * The machine's torque against its speed: one straight line, and the
 * operating point where it meets the load.
 *
 * The line is the averaged machine's, T = k(V_a − kω)/R_a, and the point on
 * it is what the switched waveform actually settled at. The two agreeing is
 * the group's own claim, so they are drawn on one pair of axes rather than
 * quoted at each other in a table.
 */
export function DrivePane({ x }) {
  const m = x.m
  const f = x.formulas
  const a = f.avg
  return (
    <div className="balance">
      <DriveCanvas x={x} />
      <table className="table">
        <caption>
          The averaged machine, <Eq>{'T_e = k(V_a - k\\omega)/R_a'}</Eq>, against the switched waveform it was
          measured on
        </caption>
        <thead>
          <tr>
            <th>quantity</th>
            <th className="num">measured</th>
            <th className="num">averaged</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>terminal voltage</td>
            <td className="num">{fmt(m.Vterm, 'V', 4)}</td>
            <td className="num">{fmt(a.Va, 'V', 4)}</td>
          </tr>
          <tr>
            <td>speed</td>
            <td className="num">{m.rpm.toFixed(1)} rpm</td>
            <td className="num">{a.rpm.toFixed(1)} rpm</td>
          </tr>
          <tr>
            <td>armature current</td>
            <td className="num">{fmt(m.Iavg, 'A', 4)}</td>
            <td className="num">{fmt(a.ia, 'A', 4)}</td>
          </tr>
          <tr>
            <td>torque</td>
            <td className="num">{fmt(m.torque, 'N·m', 4)}</td>
            <td className="num">{fmt(a.torque, 'N·m', 4)}</td>
          </tr>
          <tr>
            <td>current ripple</td>
            <td className="num">{fmt(m.ripple, 'A', 4)}</td>
            <td className="num">{fmt(f.dI, 'A', 4)}</td>
          </tr>
          <tr>
            <td>speed ripple</td>
            <td className="num">{fmt(m.omegaRipple, 'rad/s', 3)}</td>
            <td className="num">none: the model has no period in it</td>
          </tr>
          <tr className="total">
            <td>from the rail</td>
            <td className="num">{fmt(m.Iin, 'A', 4)}</td>
            <td className={`num ${m.regenerating ? 'disagree' : 'agree'}`}>
              {m.regenerating ? 'braking, into the rail' : 'motoring, out of the rail'}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="hint">
        The shaft is thousands of switching periods slower than the bridge, {a.separated.toFixed(0)} electrical
        time constants to one mechanical. That is what the averaged model rests on, and the speed ripple
        beside it is what it discards.
      </p>
    </div>
  )
}

function DriveCanvas({ x }) {
  const m = x.m
  const f = x.formulas
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const k = area.k
      const rpm = (om) => (om * 60) / (2 * Math.PI)
      const wNo = rpm(f.noLoad)
      const wHere = m.rpm
      const lo = Math.min(0, wNo, wHere) * 1.15
      const hi = Math.max(0, wNo, wHere) * 1.15
      const [xLo, xHi] = niceBounds(Math.min(lo, hi), Math.max(lo, hi))
      const tTop = Math.max(Math.abs(f.stall), Math.abs(m.torque)) * 1.15 || 1
      const [yLo, yHi] = niceBounds(Math.min(0, -tTop * (f.stall < 0 ? 1 : 0)), tTop)
      const { sx, sy } = drawFrame(ctx, area, xLo, xHi, yLo, yHi, axisFmt(xLo, xHi, 'rpm'), axisFmt(yLo, yHi, 'N·m'), {
        zeroLine: true,
        xTitle: 'Speed (rev/min)',
        yTitle: 'Torque (N·m)',
      })
      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()
      // The machine's line: stall torque at rest, zero at the no-load speed.
      ctx.strokeStyle = COLORS.response
      ctx.lineWidth = 2 * k
      ctx.beginPath()
      ctx.moveTo(sx(0), sy(f.stall))
      ctx.lineTo(sx(wNo), sy(0))
      ctx.stroke()
      // The load's own line: B·ω + T_L.
      ctx.strokeStyle = COLORS.spectrum
      ctx.setLineDash([6 * k, 4 * k])
      ctx.beginPath()
      ctx.moveTo(sx(xLo), sy(f.g * ((xLo * 2 * Math.PI) / 60) + f.TL))
      ctx.lineTo(sx(xHi), sy(f.g * ((xHi * 2 * Math.PI) / 60) + f.TL))
      ctx.stroke()
      ctx.setLineDash([])
      // Where they cross is where the waveform settled.
      ctx.fillStyle = TRACE_COLORS.iL
      ctx.beginPath()
      ctx.arc(sx(wHere), sy(m.torque), 5 * k, 0, 2 * Math.PI)
      ctx.fill()
      ctx.restore()
      ctx.save()
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.fillStyle = COLORS.text
      ctx.textAlign = wHere > (xLo + xHi) / 2 ? 'right' : 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillText(
        `${m.rpm.toFixed(0)} rpm, ${fmt(m.torque, 'N·m', 3)}`,
        sx(wHere) + (wHere > (xLo + xHi) / 2 ? -8 * k : 8 * k),
        sy(m.torque) - 6 * k,
      )
      ctx.restore()
    },
    [x],
  )
  return <canvas ref={ref} className="plot" role="img" aria-label="Torque against speed, with the operating point" />
}

// ------------------------------------------------------------ the filter

/** The harmonics the converter draws, and the share of each that reaches the line. */
export function FilterPane({ x }) {
  const m = x.m
  const f = x.formulas
  return (
    <div className="balance">
      <FilterCanvas x={x} />
      <table className="table">
        <caption>
          The pulse train, <Eq>{'\\hat{I}_k = \\frac{2 I}{k\\pi}\\left|\\sin k\\pi D\\right|'}</Eq>, and what the
          filter leaves of it
        </caption>
        <thead>
          <tr>
            <th>harmonic</th>
            <th className="num">the converter</th>
            <th className="num">closed form</th>
            <th className="num">the line</th>
            <th className="num">|H|</th>
          </tr>
        </thead>
        <tbody>
          {f.pulse.slice(0, 7).map((q) => (
            <tr key={q.k}>
              <td>{fmt(q.k * x.p.fs, 'Hz', 3)}</td>
              <td className="num">{fmt(q.peak, 'A', 4)}</td>
              <td className="num">{fmt(q.ideal, 'A', 4)}</td>
              <td className="num">{fmt(q.line, 'A', 4)}</td>
              <td className="num">{q.H < 0.01 ? q.H.toExponential(2) : q.H.toFixed(4)}</td>
            </tr>
          ))}
          <tr className="total">
            <td>the input capacitor</td>
            <td className="num">{fmt(m.sig.icin.rms, 'A', 4)} rms</td>
            <td className="num">{fmt(f.Icap, 'A', 4)}</td>
            <td className="num">{fmt(m.cinRipple, 'V', 4)} ripple</td>
            <td className="num">—</td>
          </tr>
        </tbody>
      </table>
      <table className="table">
        <caption>The filter, and the rule it has to keep</caption>
        <tbody>
          <tr>
            <td>corner</td>
            <td className="num">{fmt(f.f0, 'Hz', 4)}</td>
          </tr>
          <tr>
            <td>rejection at the switching frequency</td>
            <td className="num">{f.rejection.toFixed(1)}×</td>
          </tr>
          <tr>
            <td><Eq>{'Z_{out}\\;\\text{of the filter, at its peak}'}</Eq></td>
            <td className="num">{fmt(f.middlebrook.Zout, 'Ω', 4)}</td>
          </tr>
          <tr>
            <td><Eq>{'Z_{in} = V_{in}^2 / P_{in}'}</Eq></td>
            <td className="num">{fmt(f.middlebrook.Zin, 'Ω', 4)}</td>
          </tr>
          <tr className={`total ${f.middlebrook.safe ? 'agree' : 'disagree'}`}>
            <td>their ratio</td>
            <td className="num">{f.middlebrook.ratio.toFixed(4)}</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">{MIDDLEBROOK_NOTE}</p>
    </div>
  )
}

// CORE_SCOPE.md rule 3: the criterion is a design rule about a loop this lab
// does not close, and the sentence that says so travels with the number.
const MIDDLEBROOK_NOTE =
  'The ratio is a design rule, not a reading. A converter holding its output takes constant power, so its ' +
  'input behaves as a negative resistance to the loop that holds it. This lab runs the converter at a ' +
  'fixed duty, so no instability can be shown here, and the ratio is computed from the operating point.'

function FilterCanvas({ x }) {
  const f = x.formulas
  const fs = x.p.fs
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h, { topInset: 16 * plotArea(w, h).k })
      const k = area.k
      const hs = f.pulse.slice(0, 9)
      const top = Math.max(1e-12, ...hs.map((q) => q.peak))
      const floor = Math.max(1e-9, top * 1e-5)
      const Y = (v) => Math.log10(Math.max(v, floor))
      const yLo = Math.log10(floor)
      const yHi = Math.log10(top * 2)
      const { sx, sy } = drawFrame(ctx, area, 0.5, hs.length + 0.5, yLo, yHi, (v) => `${Math.round(v)}`, (v) => fmt(Math.pow(10, v), 'A', 2), {
        yStep: 1,
        xStep: 1,
        xTitle: `Harmonic of ${fmt(fs, 'Hz', 3)}`,
        yTitle: 'Amplitude (A)',
      })
      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()
      const wBar = Math.max(3 * k, (area.w / hs.length) * 0.26)
      for (const q of hs) {
        // What the converter draws, and inside it what the line still carries.
        ctx.fillStyle = TRACE_COLORS.iin
        ctx.fillRect(sx(q.k) - wBar, sy(yLo), wBar, sy(Y(q.peak)) - sy(yLo))
        ctx.fillStyle = TRACE_COLORS.iline
        ctx.fillRect(sx(q.k), sy(yLo), wBar, sy(Y(q.line)) - sy(yLo))
        // The closed form, as a rule across the bar it predicts.
        if (q.ideal > floor) {
          ctx.strokeStyle = COLORS.marker
          ctx.lineWidth = 1.6 * k
          ctx.beginPath()
          ctx.moveTo(sx(q.k) - wBar - 2 * k, sy(Y(q.ideal)))
          ctx.lineTo(sx(q.k) + 2 * k, sy(Y(q.ideal)))
          ctx.stroke()
        }
      }
      ctx.restore()
    },
    [x],
  )
  return <canvas ref={ref} className="plot" role="img" aria-label="Harmonics of the input current, and what reaches the line" />
}

// ------------------------------------------------------------ the ring

/** The switch node at the edge that sets it going, with the envelope over it. */
export function RingPane({ x }) {
  const m = x.m
  const f = x.formulas
  return (
    <div className="balance">
      <RingCanvas x={x} />
      <table className="table">
        <caption>
          The loop and the node, <Eq>{'f_r = 1/(2\\pi\\sqrt{L_p C})'}</Eq> and{' '}
          <Eq>{'\\zeta = \\frac{1}{2R_p}\\sqrt{L_p/C}'}</Eq>
        </caption>
        <thead>
          <tr>
            <th>quantity</th>
            <th className="num">measured</th>
            <th className="num">from the parasitics</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>ring frequency</td>
            <td className="num">{m.measured ? fmt(m.measured.f, 'Hz', 5) : 'not resolved'}</td>
            <td className="num">{fmt(f.f0, 'Hz', 5)}</td>
          </tr>
          <tr>
            <td>overshoot</td>
            <td className="num">{(m.overshoot * 100).toFixed(2)} %</td>
            <td className="num">{(f.overshoot * 100).toFixed(2)} %</td>
          </tr>
          <tr>
            <td>peak on the node</td>
            <td className="num">{fmt(m.peak, 'V', 5)}</td>
            <td className="num">{fmt(f.peak, 'V', 5)}</td>
          </tr>
          <tr>
            <td>ζ</td>
            <td className="num">{m.measured ? `decay ${m.measured.decay.toFixed(3)} a cycle` : '—'}</td>
            <td className="num">{f.zeta.toFixed(4)}, Q = {Number.isFinite(f.Q) ? f.Q.toFixed(2) : '∞'}</td>
          </tr>
          <tr>
            <td>on the node</td>
            <td className="num">{fmt(f.Ctotal, 'F', 4)}</td>
            <td className="num">{f.snubbed ? 'C_p and the snubber' : 'C_p alone'}</td>
          </tr>
          <tr className="total">
            <td>what the ring costs</td>
            <td className="num">{fmt(m.loss.parasitic + m.loss.snubber, 'W', 4)}</td>
            <td className="num">{f.snubbed ? `${fmt(f.Psn, 'W', 4)} of it the snubber's` : `½C_p·V² is ${fmt(f.Ep, 'J', 3)} an edge`}</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">
        The node is stepped twice a period, and each step starts the same ring. What a snubber buys is
        damping, and what it costs is C_sn·V²·f_s, because its capacitor is charged and discharged once
        each period whatever its resistance is.
      </p>
    </div>
  )
}

function RingCanvas({ x }) {
  const f = x.formulas
  const p = x.p
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const k = area.k
      // Six ring cycles from the rising edge, or the whole on interval when
      // the ring is slow enough that six do not fit inside it.
      const span = Math.min(p.D / p.fs, f.fr > 0 ? 6 / f.fr : p.D / p.fs)
      const t = x.wf.t
      const v = x.wf.sig.vsw
      const pts = []
      for (let i = 0; i < t.length; i++) if (t[i] <= span) pts.push([t[i] * 1e9, v[i]])
      const top = Math.max(p.Vin * 1.2, ...pts.map((q) => q[1])) * 1.05
      const [lo, hi] = niceBounds(Math.min(0, ...pts.map((q) => q[1])), top)
      const { sx, sy } = drawFrame(ctx, area, 0, span * 1e9, lo, hi, (v2) => fmt(v2 * 1e-9, 's', 3), axisFmt(lo, hi, 'V'), {
        xTitle: 'Time from the edge',
        yTitle: 'Switch node (V)',
      })
      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()
      // The rail the node is stepped to, and the envelope the damping sets.
      ctx.strokeStyle = COLORS.marker
      ctx.setLineDash([6 * k, 4 * k])
      ctx.lineWidth = 1.2 * k
      ctx.beginPath()
      ctx.moveTo(area.x, sy(p.Vin))
      ctx.lineTo(area.x + area.w, sy(p.Vin))
      ctx.stroke()
      if (f.zeta > 0 && f.zeta < 1) {
        const decay = 2 * Math.PI * f.f0 * f.zeta
        for (const sign of [1, -1]) {
          ctx.beginPath()
          for (let i = 0; i <= 120; i++) {
            const tt = (span * i) / 120
            const y = p.Vin + sign * p.Vin * Math.exp(-decay * tt)
            if (i === 0) ctx.moveTo(sx(tt * 1e9), sy(y))
            else ctx.lineTo(sx(tt * 1e9), sy(y))
          }
          ctx.stroke()
        }
      }
      ctx.setLineDash([])
      ctx.strokeStyle = TRACE_COLORS.vsw
      ctx.lineWidth = 2 * k
      ctx.beginPath()
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(sx(pts[i][0]), sy(pts[i][1]))
        else ctx.lineTo(sx(pts[i][0]), sy(pts[i][1]))
      }
      ctx.stroke()
      ctx.restore()
      ctx.save()
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.fillStyle = COLORS.marker
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText(`rail ${fmt(p.Vin, 'V', 3)}`, area.x + area.w - 6 * k, sy(p.Vin) + 4 * k)
      ctx.restore()
    },
    [x],
  )
  return <canvas ref={ref} className="plot" role="img" aria-label="The switch node ringing after an edge" />
}

// ------------------------------------------------------------ the thermal

/** The junction: what heats it, what carries the heat away, and the limit. */
export function ThermalPane({ x, exp }) {
  const t = x.m.thermal
  return (
    <div className="balance">
      <ThermalCanvas x={x} />
      <table className="table">
        <caption>
          The loss the ledger accounts for, read as degrees:{' '}
          <Eq>{'T_j = T_a + P \\sum R_{th}'}</Eq>
        </caption>
        <thead>
          <tr>
            <th>quantity</th>
            <th className="num">value</th>
            <th className="num">where it comes from</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>conduction</td>
            <td className="num">{fmt(t.conduction, 'W', 4)}</td>
            <td className="num">flat in the switching frequency</td>
          </tr>
          <tr>
            <td>the edges</td>
            <td className="num">{fmt(t.switching, 'W', 4)}</td>
            <td className="num">{fmt(t.kSw, 'W/Hz', 3)} × {fmt(x.p.fs, 'Hz', 3)}</td>
          </tr>
          <tr>
            <td>thermal resistance</td>
            <td className="num">{fmt(t.net.Rtotal, 'K/W', 4)}</td>
            <td className="num">{t.stages.map((s) => fmt(s.Rth, 'K/W', 2)).join(' + ')}</td>
          </tr>
          <tr>
            <td>rise above ambient</td>
            <td className="num">{fmt(t.rise, 'K', 4)}</td>
            <td className="num">{fmt(t.P, 'W', 4)} × {fmt(t.net.Rtotal, 'K/W', 3)}</td>
          </tr>
          <tr className={`total ${t.headroom > 0 ? 'agree' : 'disagree'}`}>
            <td>junction temperature</td>
            <td className="num">{t.Tj.toFixed(1)} °C</td>
            <td className="num">
              {t.headroom > 0
                ? `${t.headroom.toFixed(1)} K under the ${t.Tjmax.toFixed(0)} °C limit`
                : `${(-t.headroom).toFixed(1)} K past the ${t.Tjmax.toFixed(0)} °C limit`}
            </td>
          </tr>
          <tr>
            <td>the package’s budget</td>
            <td className="num">{fmt(t.Pmax, 'W', 4)}</td>
            <td className="num">at a {t.Ta.toFixed(1)} °C ambient</td>
          </tr>
          <tr>
            <td>the frequency it affords</td>
            <td className="num">{t.ceiling.feasible ? fmt(t.ceiling.fs, 'Hz', 4) : 'none'}</td>
            <td className="num">
              {t.ceiling.feasible ? 'where the whole budget is spent' : 'conduction alone exceeds the budget'}
            </td>
          </tr>
          <tr>
            <td>under a {fmt(t.pulse.period, 's', 3)} pulse</td>
            <td className="num">{(t.Ta + t.pulse.peak).toFixed(1)} °C</td>
            <td className="num">
              swing {fmt(t.pulse.swing, 'K', 3)} about {fmt(t.pulse.mean, 'K', 3)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="hint">{NETWORK_NOTE}</p>
    </div>
  )
}

const NETWORK_NOTE =
  'A datasheet fits Foster stages to a measured curve, and their internal temperatures are not the ' +
  'temperature of anything. A Cauer ladder is built from the geometry, so its nodes are the die, the case ' +
  'and the sink. Both reach the same steady rise, and the plot shows where they part on the way there.'

function ThermalCanvas({ x }) {
  const t = x.m.thermal
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h, { topInset: 16 * plotArea(w, h).k })
      const k = area.k
      const xs = t.times.map((q) => Math.log10(q))
      const top = t.net.Rtotal * 1.12
      const [lo, hi] = niceBounds(0, top)
      const { sx, sy } = drawFrame(ctx, area, xs[0], xs[xs.length - 1], lo, hi, (v) => fmt(Math.pow(10, v), 's', 2), axisFmt(lo, hi, 'K/W'), {
        xStep: 1,
        xTitle: 'Time under a step of loss',
        yTitle: 'Z_th (K/W)',
      })
      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()
      const curve = (ys, colour, dash) => {
        ctx.strokeStyle = colour
        ctx.lineWidth = 2 * k
        ctx.setLineDash(dash || [])
        ctx.beginPath()
        for (let i = 0; i < xs.length; i++) {
          if (i === 0) ctx.moveTo(sx(xs[i]), sy(ys[i]))
          else ctx.lineTo(sx(xs[i]), sy(ys[i]))
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
      curve(t.zth, COLORS.trace)
      curve(t.zthOther, COLORS.response, [6 * k, 4 * k])
      // The total, which both reach.
      ctx.strokeStyle = COLORS.marker
      ctx.setLineDash([2 * k, 4 * k])
      ctx.lineWidth = 1.2 * k
      ctx.beginPath()
      ctx.moveTo(area.x, sy(t.net.Rtotal))
      ctx.lineTo(area.x + area.w, sy(t.net.Rtotal))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
      ctx.save()
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.fillStyle = COLORS.marker
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${fmt(t.net.Rtotal, 'K/W', 3)} in all`, area.x + area.w - 6 * k, sy(t.net.Rtotal) - 3 * k)
      ctx.restore()
    },
    [x],
  )
  return <canvas ref={ref} className="plot" role="img" aria-label="Transient thermal impedance against time, for both networks" />
}
