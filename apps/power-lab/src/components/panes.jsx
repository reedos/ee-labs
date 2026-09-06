import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt } from '@ee-labs/ui'
import { lossLedger, stateAtTime } from '@ee-labs/switched'
import { TRACES } from '../experiments.js'
import { TRACE_COLORS } from './ScopeCanvas.jsx'
import Schematic, { topologyOf } from './schematics.jsx'
import { JK_CONDUCTING } from './schematicsJk.jsx'
import { Formula } from '@ee-labs/explain'
import { fmtz, nz, statScale, axisFmt, niceBounds } from '../format.js'

/** An equation in a table cell, set like the math panel's formulas. */
const Eq = ({ children }) => <Formula display={false}>{children}</Formula>

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
export const ORDER = ['vin', 'vsw', 'vrect', 'vout', 'vL', 'vD', 'iL', 'iD', 'iC', 'iR', 'iQ', 'iin', 'vao', 'vab', 'van', 'ia', 'idc']

/** Average, RMS and extremes of every waveform, and the power books. */
export function MeasuresPane({ m, signals }) {
  const unit = (k) => TRACES[k].axis
  // Only what this circuit has a part for, so every row is a row the schematic
  // can point at.
  const rows = ORDER.filter((k) => m.sig[k] && (!signals || signals.includes(k)))
  const lineSide = m.mode === 'line' || m.mode === 'dimmer'
  return (
    <div className="pane-grid">
      <table className="table">
        <caption>
          {lineSide
            ? 'Over one line cycle, from the exact solution — averages in closed form, RMS by quadrature'
            : 'Over one switching period, from the exact solution — averages in closed form, RMS by quadrature'}
        </caption>
        <thead>
          <tr>
            <th>signal</th>
            <th className="num">average</th>
            <th className="num">RMS</th>
            <th className="num">min</th>
            <th className="num">max</th>
            <th className="num">peak-to-peak</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => {
            const s = m.sig[k]
            // Dust is measured against this signal's own size, so a
            // millivolt ripple keeps its digits and a 1e-16 average reads 0.
            const sc = statScale(s)
            return (
              <tr key={k}>
                <td>
                  <span className="trace-dot" style={{ background: TRACE_COLORS[k] }} aria-hidden="true" />
                  {TRACES[k].label}
                </td>
                <td className="num">{fmtz(s.avg, unit(k), 4, sc)}</td>
                <td className="num">{fmtz(s.rms, unit(k), 4, sc)}</td>
                <td className="num">{fmtz(s.min, unit(k), 4, sc)}</td>
                <td className="num">{fmtz(s.max, unit(k), 4, sc)}</td>
                <td className="num">{fmtz(s.pp, unit(k), 4, sc)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <table className="table">
        <caption>Power</caption>
        <tbody>
          <tr>
            <td><Eq>{m.pinLabel || 'P_{in} = V_{in} \\langle i_{in} \\rangle'}</Eq></td>
            <td className="num">{fmtz(m.Pin, 'W', 4, m.Pin)}</td>
          </tr>
          {m.mode === 'dimmer' ? null : (
            <tr>
              <td><Eq>{'P_{out} = \\langle v_{out}^2 \\rangle / R'}</Eq></td>
              <td className="num">{fmtz(m.Pout, 'W', 4, m.Pin)}</td>
            </tr>
          )}
          <tr>
            <td>losses</td>
            <td className="num">{fmtz(m.Ploss, 'W', 4, m.Pin)}</td>
          </tr>
          <tr>
            <td>η</td>
            <td className="num">{(m.eta * 100).toFixed(2)} %</td>
          </tr>
          {Number.isFinite(m.pf) ? (
            <>
              <tr>
                <td><Eq>{m.sLabel || 'S = V_{rms} I_{rms}'}</Eq></td>
                <td className="num">{fmt(m.S, 'VA', 4)}</td>
              </tr>
              <tr>
                <td><Eq>{'\\text{power factor } \\lambda = P/S'}</Eq></td>
                <td className="num">{m.pf.toFixed(4)}</td>
              </tr>
            </>
          ) : null}
          {Number.isFinite(m.angle) ? (
            <>
              <tr>
                <td>conduction angle</td>
                <td className="num">{m.angle.toFixed(1)}° per pulse, {m.pulses} pulse{m.pulses === 1 ? '' : 's'} per cycle</td>
              </tr>
              <tr>
                <td>PIV</td>
                <td className="num">{fmt(m.piv, 'V', 4)}</td>
              </tr>
            </>
          ) : null}
          <tr>
            <td>mode</td>
            <td className="num">{MODE_WORDS[m.mode] || m.mode}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export const MODE_WORDS = {
  CCM: 'continuous conduction',
  DCM: 'discontinuous conduction',
  SAT: 'saturating part of the period',
  linear: 'a resistive drop',
  chopped: 'chopped, no filter',
  line: 'line-frequency, diode-steered',
  dimmer: 'phase-cut, resistive load',
  inverter: 'DC in, AC out',
  threephase: 'DC in, three-phase out',
}

/**
 * The line current as its harmonics: bars at each order, the fundamental
 * full height, with the figures that follow from them — how much of the
 * current is fundamental, how far it lags, and the power factor that is the
 * product of the two. The harmonics are exact Fourier integrals of the
 * piecewise-exact waveform, not a DFT of samples.
 */
export function SpectrumPane({ x }) {
  const m = x.m
  const hs = m.harmonics || []
  // The line side draws a current spectrum and an inverter a voltage one, so
  // the unit and the caption come from the measure rather than from here.
  const sp = m.spectrum || { unit: 'A', of: 'i_in' }
  const volts = sp.unit === 'V'
  const first = volts ? m.harmonics[0].rms : m.I1
  return (
    <div className="pane-grid is-fit">
      <SpectrumCanvas harmonics={hs} I1={first} phases={x.conv?.threePhase ? 3 : 1} unit={sp.unit} />
      <div className="pane-scroll">
      <table className="table">
        <caption>
          {sp.caption ||
            (m.mode === 'dimmer' ? 'Load current, one line cycle' : x.conv?.threePhase ? 'Phase-a line current, one line cycle' : 'Line current, one line cycle')}
        </caption>
        <tbody>
          {volts ? (
            <>
              <tr>
                <td>V_rms of the bridge</td>
                <td className="num">{fmt(m.VswRms, 'V', 4)}</td>
              </tr>
              <tr>
                <td>V₁ of the bridge (RMS)</td>
                <td className="num">{fmt(m.Vsw1, 'V', 4)}</td>
              </tr>
              <tr>
                <td>THD of the bridge</td>
                <td className="num">{(m.thdSw * 100).toFixed(1)} %</td>
              </tr>
              <tr>
                <td>V₁ at the load (RMS)</td>
                <td className="num">{fmt(m.V1, 'V', 4)}</td>
              </tr>
              <tr>
                <td>THD at the load</td>
                <td className="num">{(m.thd * 100).toFixed(1)} %</td>
              </tr>
              {m.carrier ? (
                <tr>
                  <td>the filter at harmonic {m.carrier.k}</td>
                  <td className="num">×{m.attenuation.toFixed(4)}</td>
                </tr>
              ) : null}
              <tr>
                <td>P at the load</td>
                <td className="num">{fmt(m.Pout, 'W', 4)}</td>
              </tr>
            </>
          ) : (
            <>
              <tr>
                <td>I_rms</td>
                <td className="num">{fmt(m.Irms, 'A', 4)}</td>
              </tr>
              <tr>
                <td>I₁ (fundamental, RMS)</td>
                <td className="num">{fmt(m.I1, 'A', 4)}</td>
              </tr>
              <tr>
                <td>THD = √(I_rms² − I₁²) / I₁</td>
                <td className="num">{(m.thd * 100).toFixed(1)} %</td>
              </tr>
              <tr>
                <td><Eq>{'\\text{distortion } I_1/I_{rms}'}</Eq></td>
                <td className="num">{m.distortion.toFixed(4)}</td>
              </tr>
              <tr>
                <td>φ₁ (fundamental vs voltage)</td>
                <td className="num">{((m.phi1 * 180) / Math.PI).toFixed(2)}°</td>
              </tr>
              <tr>
                <td><Eq>{'\\text{displacement } \\cos\\varphi_1'}</Eq></td>
                <td className="num">{m.displacement.toFixed(4)}</td>
              </tr>
              <tr>
                <td><Eq>{'\\lambda = \\cos\\varphi_1 \\cdot I_1/I_{rms}'}</Eq></td>
                <td className="num">{m.pf.toFixed(4)}</td>
              </tr>
              <tr>
                <td>P</td>
                <td className="num">{fmt(m.Pin, 'W', 4)}</td>
              </tr>
              <tr>
                <td><Eq>{m.sLabel || 'S = V_{rms} I_{rms}'}</Eq></td>
                <td className="num">{fmt(m.S, 'VA', 4)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}

function SpectrumCanvas({ harmonics, I1, phases, unit = 'A' }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const k = area.k
      const kMax = harmonics.length ? harmonics[harmonics.length - 1].k : 25
      const top = Math.max(1e-12, ...harmonics.map((q) => q.rms))
      const { sx, sy } = drawFrame(ctx, area, 0, kMax + 1, 0, top * 1.1, (v) => `${v.toFixed(0)}`, axisFmt(0, top * 1.1, unit), {
        xTitle: 'Harmonic order',
        yTitle: unit === 'V' ? 'RMS voltage (V)' : 'RMS current (A)',
      })
      const bw = Math.max(2 * k, (sx(1) - sx(0)) * 0.6)
      ctx.save()
      ctx.font = `${Math.round(10 * k)}px ${MONO}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      for (const q of harmonics) {
        const x = sx(q.k)
        const y = sy(q.rms)
        ctx.fillStyle = q.k === 1 ? COLORS.trace : COLORS.spectrum
        ctx.fillRect(x - bw / 2, y, bw, sy(0) - y)
        if (q.k === 1 || (q.rms > 0.25 * I1 && q.k <= kMax)) {
          ctx.fillStyle = COLORS.textBright
          ctx.fillText(`${((100 * q.rms) / I1).toFixed(0)} %`, x, y - 2 * k)
        }
      }
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillStyle = COLORS.text
      ctx.fillText(phases === 3 ? 'phase a, as % of the fundamental' : 'as % of the fundamental', area.x + area.w - 4 * k, area.y + 4 * k)
      ctx.restore()
    },
    [harmonics, I1, phases, unit],
  )
  return <canvas ref={ref} className="plot" role="img" aria-label="Harmonic spectrum of the line current" />
}

/**
 * The two balances, drawn: v_L over one period with the area under each
 * segment shaded and its volt-seconds written in, and i_C the same in
 * coulombs. The sums are the two invariants of periodic steady state, and
 * the table under the plot shows them landing on zero.
 */
export function BalancePane({ x }) {
  const { balance, T } = x
  // The size of the areas themselves, against which a total of zero is judged.
  const vsScale = Math.max(...balance.segs.map((s) => Math.abs(s.vs)), 0)
  const qScale = Math.max(...balance.segs.map((s) => Math.abs(s.q)), 0)
  return (
    <div className="balance">
      <BalanceCanvas x={x} />
      <table className="table">
        <caption>
          Segment by segment, exactly: <Eq>{'\\int v_L\\,dt'}</Eq> is what the inductor current changes by, times L;{' '}
          <Eq>{'\\int i_C\\,dt'}</Eq> what the capacitor voltage changes by, times C
        </caption>
        <thead>
          <tr>
            <th>segment</th>
            <th className="num">lasts</th>
            <th className="num"><Eq>{'\\int v_L\\,dt'}</Eq></th>
            <th className="num"><Eq>{'\\int i_C\\,dt'}</Eq></th>
          </tr>
        </thead>
        <tbody>
          {balance.segs.map((s) => (
            <tr key={s.name}>
              <td>{s.name}</td>
              <td className="num">
                {fmt(s.T, 's', 3)} <em className="prov">({((100 * s.T) / T).toFixed(1)} %)</em>
              </td>
              <td className="num">{fmtVs(s.vs, vsScale)}</td>
              <td className="num">{fmtQ(s.q, qScale)}</td>
            </tr>
          ))}
          <tr className="total">
            <td>over the period</td>
            <td />
            <td className={`num ${nz(balance.vsTotal, vsScale) === 0 ? 'agree' : 'disagree'}`}>
              {fmtVs(balance.vsTotal, vsScale)}
            </td>
            <td className={`num ${nz(balance.qTotal, qScale) === 0 ? 'agree' : 'disagree'}`}>
              {fmtQ(balance.qTotal, qScale)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// Scaled to the units a switching period works in, with dust taken against
// the segments' own areas rather than a fixed floor.
const fmtVs = (v, scale = Math.abs(v)) => (nz(v, scale) === 0 ? '0 V·µs' : `${(v * 1e6).toPrecision(4)} V·µs`)
const fmtQ = (q, scale = Math.abs(q)) => (nz(q, scale) === 0 ? '0 nC' : `${(q * 1e9).toPrecision(4)} nC`)

function BalanceCanvas({ x }) {
  const { wf, balance, T } = x
  const ref = useCanvas(
    (ctx, w, h) => {
      const k0 = plotArea(w, h).k
      const area = plotArea(w, h, { rightAxis: true, topInset: 16 * k0 })
      const k = area.k
      // One period only.
      const n = wf.t.findIndex((t) => t > T * (1 + 1e-9))
      const end = n < 0 ? wf.t.length : n
      const us = wf.t.slice(0, end).map((t) => t * 1e6)
      const vL = wf.sig.vL.slice(0, end)
      const iC = wf.sig.iC.slice(0, end)
      const span = (ys) => {
        const lo = Math.min(0, ...ys)
        const hi = Math.max(0, ...ys)
        const pad = (hi - lo || 1) * 0.12
        // Round bounds, so turning a knob moves the areas and not the frame.
        return niceBounds(lo - pad, hi + pad)
      }
      const [vLo, vHi] = span(vL)
      const [aLo, aHi] = span(iC)
      const { sx, sy } = drawFrame(ctx, area, 0, T * 1e6, vLo, vHi, (v) => fmt(v * 1e-6, 's', 3), axisFmt(vLo, vHi, 'V'), {
        zeroLine: true,
        xTitle: 'Time, one period',
        yTitle: 'v_L (V)',
      })
      const syA = (v) => area.y + area.h - ((v - aLo) / (aHi - aLo)) * area.h

      ctx.save()
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = COLORS.text
      const ticks = Math.max(2, Math.floor(area.h / (46 * k)))
      const fmtA = axisFmt(aLo, aHi, 'A')
      for (let i = 0; i <= ticks; i++) {
        const v = aLo + ((aHi - aLo) * i) / ticks
        ctx.fillText(fmtA(v), area.x + area.w + 8 * k, syA(v))
      }
      ctx.font = `${Math.round(12 * k)}px ui-sans-serif, system-ui, sans-serif`
      ctx.translate(w - 14 * k, area.y + area.h / 2)
      ctx.rotate(Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.fillText('i_C (A)', 0, 0)
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()
      // Shade the volt-second area of each segment, sign-coloured.
      for (const s of balance.segs) {
        const a = s.t0 * 1e6
        const b = (s.t0 + s.T) * 1e6
        ctx.fillStyle = s.vs >= 0 ? COLORS.traceDim : COLORS.spectrumDim
        ctx.beginPath()
        ctx.moveTo(sx(a), sy(0))
        for (let i = 0; i < us.length; i++) {
          if (us[i] < a - 1e-9 || us[i] > b + 1e-9) continue
          ctx.lineTo(sx(us[i]), sy(vL[i]))
        }
        ctx.lineTo(sx(b), sy(0))
        ctx.closePath()
        ctx.fill()
      }
      const trace = (ys, map, color) => {
        ctx.strokeStyle = color
        ctx.lineWidth = 2 * k
        ctx.beginPath()
        for (let i = 0; i < us.length; i++) {
          if (i === 0) ctx.moveTo(sx(us[i]), map(ys[i]))
          else ctx.lineTo(sx(us[i]), map(ys[i]))
        }
        ctx.stroke()
      }
      trace(vL, sy, TRACE_COLORS.vL)
      trace(iC, syA, TRACE_COLORS.iC)

      // The numbers, inside each segment's area.
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.textAlign = 'center'
      for (const s of balance.segs) {
        const cx = sx((s.t0 + s.T / 2) * 1e6)
        const cy = (sy(0) + sy(s.vs >= 0 ? Math.max(...vL) : Math.min(...vL))) / 2
        ctx.fillStyle = COLORS.textBright
        ctx.textBaseline = 'bottom'
        ctx.fillText(`${s.name}`, cx, cy - 2 * k)
        ctx.textBaseline = 'top'
        ctx.fillText(`${s.vs >= 0 ? '+' : ''}${(s.vs * 1e6).toPrecision(4)} V·µs`, cx, cy + 2 * k)
      }
      ctx.restore()

      ctx.save()
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.textBaseline = 'bottom'
      ctx.textAlign = 'right'
      ctx.fillStyle = TRACE_COLORS.iC
      ctx.fillText('i_C', area.x + area.w, area.y - 3 * k)
      ctx.fillStyle = TRACE_COLORS.vL
      ctx.fillText('v_L', area.x + area.w - 34 * k, area.y - 3 * k)
      ctx.restore()
    },
    [wf, balance, T],
  )
  return <canvas ref={ref} className="plot" role="img" aria-label="Volt-second and charge balance over one period" />
}

/**
 * Flux density over one period, against the ceiling the core sets.
 *
 * The ceiling is the whole point of the plot, so it is drawn as a pair of
 * lines at ±B_sat and the y-range always contains them: a flux trace framed on
 * its own extent looks the same whether it is a tenth of the way to saturation
 * or through it.
 */
export function FluxPane({ x }) {
  const f = x.formulas
  const core = x.core
  return (
    <div className="balance">
      <FluxCanvas x={x} />
      <table className="table">
        <caption>
          The core is N turns on A_e of area, and B = L·i/(N·A_e). The swing over the period is{' '}
          <Eq>{'\\Delta B = \\frac{1}{N A_e}\\int v_L\\,dt'}</Eq>
        </caption>
        <thead>
          <tr>
            <th>quantity</th>
            <th className="num">measured</th>
            <th className="num">from the core</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>N·A_e</td>
            <td className="num">{fmt(f.coreArea, 'Wb/T', 4)}</td>
            <td className="num">
              {fmt(core.N, '', 3)} turns × {fmt(core.Ae * 1e6, 'mm²', 3)}
            </td>
          </tr>
          <tr>
            <td><Eq>{'\\int v_L\\,dt\\;\\text{while the switch is on}'}</Eq></td>
            <td className="num">{fmtVs(f.onVs)}</td>
            <td className="num">—</td>
          </tr>
          <tr>
            <td>ΔB over the period</td>
            <td className="num">{fmt(f.dB, 'T', 4)}</td>
            <td className="num">{fmt(f.dBideal, 'T', 4)}</td>
          </tr>
          <tr>
            <td>peak B</td>
            <td className="num">{fmt(f.Bpk, 'T', 4)}</td>
            <td className={`num ${f.Bpk >= f.Bsat ? 'disagree' : 'agree'}`}>{fmt(f.Bsat, 'T', 3)} ceiling</td>
          </tr>
          <tr>
            <td><Eq>{'I_{sat} = B_{sat} N A_e / L'}</Eq></td>
            <td className="num">{fmt(f.Isat, 'A', 4)}</td>
            <td className="num">peak i_L {fmt(x.m.sig.iL.max, 'A', 4)}</td>
          </tr>
          <tr className="total">
            <td>inductance</td>
            <td className="num">{fmt(x.p.L, 'H', 3)}</td>
            <td className="num">
              {f.satShare > 0
                ? `${fmt(f.Lsat, 'H', 3)} for ${(f.satShare * 100).toFixed(1)} % of the period`
                : 'under the knee all period'}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="hint">{SATURATION_NOTE}</p>
    </div>
  )
}

// CORE_SCOPE.md rule 3: an approximation ships with the sentence that says it
// is one, wherever it is shown.
const SATURATION_NOTE =
  'The knee is a model of iron rather than a law. Below I_sat the inductance is L and above it L divided ' +
  'by the collapse ratio, and each piece is solved exactly.'

function FluxCanvas({ x }) {
  const { flux, T } = x
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h, { topInset: 16 * plotArea(w, h).k })
      const k = area.k
      const n = flux.t.findIndex((t) => t > T * (1 + 1e-9))
      const end = n < 0 ? flux.t.length : n
      const ts = flux.t.slice(0, end).map((t) => t * 1e6)
      const B = flux.B.slice(0, end)
      // The ceiling is always in frame, and so is the trace.
      const top = Math.max(flux.Bsat * 1.15, ...B.map(Math.abs)) * 1.05
      const [lo, hi] = niceBounds(-top, top)
      const { sx, sy } = drawFrame(ctx, area, 0, T * 1e6, lo, hi, (v) => fmt(v * 1e-6, 's', 3), axisFmt(lo, hi, 'T'), {
        zeroLine: true,
        xTitle: 'Time, one period',
        yTitle: 'Flux density (T)',
      })
      ctx.save()
      // The ceiling, both ways.
      ctx.strokeStyle = COLORS.marker
      ctx.setLineDash([6 * k, 4 * k])
      ctx.lineWidth = 1.2 * k
      for (const level of [flux.Bsat, -flux.Bsat]) {
        ctx.beginPath()
        ctx.moveTo(area.x, sy(level) + 0.5)
        ctx.lineTo(area.x + area.w, sy(level) + 0.5)
        ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.fillStyle = COLORS.marker
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`B_sat ${fmt(flux.Bsat, 'T', 3)}`, area.x + area.w - 6 * k, sy(flux.Bsat) - 3 * k)
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()
      ctx.strokeStyle = TRACE_COLORS.iL
      ctx.lineWidth = 2 * k
      ctx.beginPath()
      for (let i = 0; i < ts.length; i++) {
        if (i === 0) ctx.moveTo(sx(ts[i]), sy(B[i]))
        else ctx.lineTo(sx(ts[i]), sy(B[i]))
      }
      ctx.stroke()
      ctx.restore()
    },
    [flux, T],
  )
  return <canvas ref={ref} className="plot" role="img" aria-label="Flux density over one period, against the core's ceiling" />
}

/**
 * The conduction scrub: the circuit at one instant, with the parts that carry
 * current lit, and every reading at that instant beside it.
 *
 * The question a student asks silently at every waveform is which parts are
 * conducting right now. The scope answers it in a shape; this answers it on
 * the circuit, and the cursor on the scope marks the same instant.
 */
export function ScrubPane({ x, exp, at, onScrub, signals }) {
  const here = stateAtTime(x.ss, Math.min(at, x.T * (1 - 1e-12)))
  const seg = here.seg
  const rows = ORDER.filter((k) => x.m.sig[k] && (!signals || signals.includes(k)) && seg.state.signals[k])
  const live = x.ss.segments.filter((s) => s.T > 0)
  return (
    <div className="scrub">
      <div className="scrub-picture">
        <Schematic exp={exp} x={x} live={{ state: seg.name, conducting: conductingIn(seg.name, topologyOf(exp)) }} />
      </div>
      <div className="scrub-readout">
        <label className="scrub-slider">
          <span>Instant</span>
          <input
            type="range"
            min="0"
            max="1000"
            value={Math.round((at / x.T) * 1000)}
            onChange={(e) => onScrub(Number(e.target.value) / 1000)}
            aria-label="Instant within the period"
          />
          <b>{fmt(at, 's', 3)}</b>
        </label>
        <p className="scrub-state" data-role="scrub-state">
          <b>{seg.name}</b> from {fmt(seg.t0, 's', 3)} for {fmt(seg.T, 's', 3)}
        </p>
        <table className="table">
          <caption>Every signal at that instant, from the exact solution</caption>
          <thead>
            <tr>
              <th>signal</th>
              <th className="num">now</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((key) => (
              <tr key={key}>
                <td>
                  <span className="trace-dot" style={{ background: TRACE_COLORS[key] }} aria-hidden="true" />
                  {TRACES[key].label}
                </td>
                <td className="num">{fmtz(evalAt(seg, key, here.x), TRACES[key].axis, 4, statScale(x.m.sig[key]))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ol className="scrub-events">
          {live.map((s, i) => (
            <li key={`${s.name}-${i}`} className={s === seg ? 'is-here' : ''}>
              <button type="button" onClick={() => onScrub((s.t0 + s.T / 2) / x.T)}>
                {s.name}
              </button>
              <em>{fmt(s.t0, 's', 3)}</em>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// A signal is a linear form in the whole state, and some converters carry
// three components or four. Reading two of them drew a third-order
// converter's every signal wrong by whatever the third one was worth.
const evalAt = (seg, name, state) => {
  const f = seg.state.signals[name]
  let y = f.d
  for (let i = 0; i < f.c.length; i++) y += f.c[i] * state[i]
  return y
}

/**
 * Which drawn parts carry current in a named switch state. The names come from
 * the engine's own states, so a topology that gains a state gains a row here
 * or lights nothing, and schematics.test.jsx holds the two together.
 */
export function conductingIn(name, topology = null) {
  const n = String(name)
  const own = JK_CONDUCTING[topology]
  if (own && own[n]) return own[n]
  if (n.startsWith('on')) return ['Q', 'L', 'C', 'R']
  if (n.startsWith('off')) return ['D', 'L', 'C', 'R']
  if (n.startsWith('Q1')) return ['Q1', 'T', 'D1', 'L', 'C', 'R']
  if (n.startsWith('Q2')) return ['Q2', 'T', 'D2', 'L', 'C', 'R']
  if (n === 'freewheel') return ['D1', 'D2', 'L', 'C', 'R']
  if (n === 'dead') return ['C', 'R']
  // The bridge closes one diagonal at a time; the filter carries current
  // either way.
  if (n.startsWith('+')) return ['QA', 'L', 'C', 'R']
  if (n.startsWith('\u2212')) return ['QB', 'L', 'C', 'R']
  return ['C', 'R']
}

/**
 * The loss ledger: every mechanism, its formula, its watts and its share, and
 * the residual the identity leaves.
 *
 * P_in − P_out − Σ conduction losses is zero because every term is an integral
 * of one waveform. The residual row is the only line in the table that is not
 * a measurement, and it reads zero.
 */
export function LedgerPane({ x }) {
  const led = lossLedger(x.m)
  const scale = Math.max(1e-12, led.Psource)
  return (
    <div className="ledger">
      <table className="table">
        <caption>Where the source’s power goes, over one period</caption>
        <thead>
          <tr>
            <th>mechanism</th>
            <th className="num">formula</th>
            <th className="num">watts</th>
            <th className="num">share</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>to the load</td>
            <td className="num"><Eq>{'\\langle v_{out}^2 \\rangle / R'}</Eq></td>
            <td className="num">{fmtz(led.Pout, 'W', 4, scale)}</td>
            <td className="num">{(led.outShare * 100).toFixed(2)} %</td>
          </tr>
          {led.rows.map((r) => (
            <tr key={r.key}>
              <td>
                {r.label}
                {r.model ? <em className="prov"> a model, not a waveform</em> : null}
              </td>
              <td className="num">{r.formula ? <Eq>{r.formula}</Eq> : '—'}</td>
              <td className="num">{fmtz(r.watts, 'W', 4, scale)}</td>
              <td className="num">{(r.share * 100).toFixed(2)} %</td>
            </tr>
          ))}
          <tr className="total">
            <td>from the source</td>
            <td className="num"><Eq>{'V_{in} \\langle i_{in} \\rangle + P_{sw}'}</Eq></td>
            <td className="num">{fmtz(led.Psource, 'W', 4, scale)}</td>
            <td className="num">{(led.eta * 100).toFixed(2)} % out</td>
          </tr>
          <tr className={`total ${nz(led.residual, scale) === 0 ? 'agree' : 'disagree'}`}>
            <td><Eq>{'P_{in} - P_{out} - \\sum \\text{conduction}'}</Eq></td>
            <td className="num">an identity</td>
            <td className="num" data-role="ledger-residual">{fmtz(led.residual, 'W', 2, scale)}</td>
            <td className="num" />
          </tr>
        </tbody>
      </table>
      <div className="power-list">
        {[{ key: 'out', label: 'to the load', value: led.Pout, cls: 'out' }, ...led.rows.map((r) => ({ key: r.key, label: r.label, value: r.watts, cls: 'loss' }))].map((r) => (
          <div className="power-row" key={r.key}>
            <span>{r.label}</span>
            <span className="bar">
              <i className={r.cls} style={{ left: 0, width: `${Math.min(100, (100 * Math.max(0, r.value)) / scale)}%` }} />
            </span>
            <span className="val">{fmt(r.value, 'W', 3)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Where the input power goes: the load, then each loss, as bars on a common scale. */
export function LossesPane({ x }) {
  const m = x.m
  const chopped = m.mode === 'chopped'
  const rows = [{ key: 'out', label: chopped ? 'to the load, ⟨v²⟩/R' : 'to the load', value: m.Pout, cls: 'out' }]
  const names = {
    pass: 'pass element (V_in − V_out)·I',
    switch: chopped ? 'ideal switch, no drop' : 'switch I²R_on',
    diode: x.p?.sync ? 'sync switch I²R_on' : 'diode V_f·I',
    inductor: 'winding I²R_L',
    esr: 'capacitor ESR I²',
    switching: 'switching edges',
    series: 'source R_s · I_D,rms²',
    diodes: x.conv?.nD > 1 ? `${x.conv.nD} diodes in series, V_f · ⟨i_D⟩ each` : 'diode V_f · ⟨i_D⟩',
  }
  for (const [k, v] of Object.entries(m.loss || {})) rows.push({ key: k, label: names[k] || k, value: v, cls: 'loss' })
  const scale = Math.max(1e-12, m.Pin + (m.loss?.switching || 0))
  return (
    <div className="losses">
      <div className="power-list">
        {rows.map((r) => (
          <div className="power-row" key={r.key}>
            <span>{r.label}</span>
            <span className="bar">
              <i className={r.cls} style={{ left: 0, width: `${Math.min(100, (100 * Math.max(0, r.value)) / scale)}%` }} />
            </span>
            <span className="val">{fmt(r.value, 'W', 3)}</span>
          </div>
        ))}
      </div>
      <p className="power-total">
        P_in <b>{fmtz(m.Pin, 'W', 4, m.Pin)}</b> · P_out <b>{fmtz(m.Pout, 'W', 4, m.Pin)}</b> · lost{' '}
        <b>{fmtz(m.Ploss, 'W', 3, m.Pin)}</b> · η{' '}
        <b>{(m.eta * 100).toFixed(2)} %</b>
        {Number.isFinite(m.balance) ? (
          <>
            {' '}
            · books: P_in − P_out − conduction losses = <b>{fmtz(m.balance, 'W', 2, m.Pin)}</b>
          </>
        ) : null}
      </p>
      {m.mode === 'chopped' ? (
        <p className="hint">
          An ideal switch loses nothing, so every watt drawn reaches the load — but as {fmt(m.Pin, 'W', 3)} of heating from a
          {' '}{fmt(m.sig.vout.rms, 'V', 3)} RMS square wave, not the{' '}
          {fmt((m.sig.vout.avg ** 2 * m.Pin) / m.sig.vout.rms ** 2, 'W', 3)} a steady{' '}
          {fmt(m.sig.vout.avg, 'V', 3)} would give.
        </p>
      ) : null}
    </div>
  )
}
