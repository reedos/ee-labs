import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmt, buildLink } from '@ee-labs/ui'
import { Formula } from '@ee-labs/explain'
import { axisFmt, niceBounds, fmtz } from '../format.js'
import { TRACE_COLORS } from './ScopeCanvas.jsx'

// The three panes Groups H and I need, and nothing else needs.
//
// Step: the exact switched waveform through a change of load or duty, with
// the averaged model's smooth curve laid over it and the cycle averages the
// two are compared at. The picture is the claim: one line through the middle
// of a band, and the band is what averaging discards.
//
// Plant: the six coefficients of the control-to-output transfer function,
// what they say about the converter, and the hand-over to Control Lab. The
// guard sits above them, because CORE_SCOPE.md rule 3 makes the threshold
// part of the feature, and a refused hand-over is a finished one.
//
// Power: the instantaneous power one phase takes and the power the DC bus
// supplies, on one time axis. The single phase pulses at twice the output
// frequency and the sum of three does not.

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const Eq = ({ children }) => <Formula display={false}>{children}</Formula>

/** A polynomial written out for the panel, highest power first. */
function poly([c2, c1, c0], v = 's') {
  const terms = []
  const put = (c, p) => {
    if (c === 0) return
    const mag = Math.abs(c).toPrecision(6)
    const sign = terms.length === 0 ? (c < 0 ? '-' : '') : c < 0 ? ' - ' : ' + '
    terms.push(`${sign}${mag}${p === 0 ? '' : p === 1 ? ` ${v}` : ` ${v}^${p}`}`)
  }
  put(c2, 2)
  put(c1, 1)
  put(c0, 0)
  return terms.length ? terms.join('') : '0'
}

/**
 * The averaged model against the switched waveform, through one step.
 *
 * The exact trace is drawn thin, the averaged curve thick over it, and the
 * cycle averages as dots on the instants the two are compared at. The gap
 * between them is stated as a number underneath, against the ripple that
 * averaging left out.
 */
export function StepPane({ x, exp }) {
  const step = x.step
  const out = exp.step?.out || 'vout'
  const unit = out === 'iL' ? 'A' : 'V'
  const label = out === 'iL' ? 'i_L' : 'v_out'
  return (
    <div className="balance">
      <StepCanvas step={step} unit={unit} label={label} />
      <table className="table">
        <caption>
          The averaged model is exact for the state's cycle average, not for the state. What it leaves out is the
          ripple inside each period.
        </caption>
        <thead>
          <tr>
            <th>quantity</th>
            <th className="num">value</th>
            <th className="num">against</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{label} before the step</td>
            <td className="num">{fmt(step.from, unit, 5)}</td>
            <td className="num">the old periodic state</td>
          </tr>
          <tr>
            <td>{label} after it</td>
            <td className="num">{fmt(step.to, unit, 5)}</td>
            <td className="num">{fmt(step.to - step.from, unit, 3)} of change</td>
          </tr>
          <tr>
            <td>lowest cycle average</td>
            <td className={`num ${step.dip < step.from - 1e-12 ? 'disagree' : ''}`}>{fmt(step.dip, unit, 5)}</td>
            <td className="num">
              {step.dip < step.from - 1e-12
                ? `${fmt(step.from - step.dip, unit, 3)} below the start`
                : 'never below the start'}
            </td>
          </tr>
          <tr>
            <td>ripple in the last period</td>
            <td className="num">{fmt(step.ripple, unit, 4)}</td>
            <td className="num">what averaging leaves out</td>
          </tr>
          <tr className="total">
            <td>largest gap, averaged against exact</td>
            <td className="num" data-role="step-gap">
              {fmt(step.worst * step.span, unit, 3)}
            </td>
            <td className="num">{(step.worst * 100).toFixed(3)} % of the step</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">
        {step.blocked
          ? 'The inductor current reversed during the walk, so the freewheel diode blocked and the fixed on/off pattern is not this circuit. Switch the freewheel to a synchronous switch to read this pane.'
          : `Every period of the exact walk is solved by the propagator from the state the last one ended at, starting from the converter's own periodic state before the step. The averaged curve is one matrix exponential of A = D·A_on + D′·A_off.`}
      </p>
    </div>
  )
}

function StepCanvas({ step, unit, label }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h, { topInset: 16 * plotArea(w, h).k })
      const k = area.k
      const sw = step.switched
      const av = step.averaged
      const ms = 1e3
      const t0 = 0
      const t1 = sw.t[sw.t.length - 1] * ms
      const ys = sw.sig[step.out]
      const [lo, hi] = niceBounds(Math.min(...ys), Math.max(...ys))
      const { sx, sy } = drawFrame(ctx, area, t0, t1, lo, hi, (v) => fmt(v / ms, 's', 3), axisFmt(lo, hi, unit), {
        xTitle: 'Time from the step',
        yTitle: `${label} (${unit})`,
      })
      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()
      // The exact waveform, thin: over hundreds of periods it reads as a band.
      ctx.strokeStyle = TRACE_COLORS.vout
      ctx.lineWidth = 1 * k
      ctx.beginPath()
      for (let i = 0; i < sw.t.length; i++) {
        const px = sx(sw.t[i] * ms)
        const py = sy(ys[i])
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      // The averaged model, thick.
      ctx.strokeStyle = COLORS.response
      ctx.lineWidth = 2.2 * k
      ctx.beginPath()
      const ay = av.sig[step.out]
      for (let i = 0; i < av.t.length; i++) {
        const px = sx(av.t[i] * ms)
        const py = sy(ay[i])
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      // Where the two are compared: one dot per period, thinned to fit.
      const every = Math.max(1, Math.round(step.pairs.length / 40))
      ctx.fillStyle = COLORS.marker
      for (let i = 0; i < step.pairs.length; i += every) {
        const q = step.pairs[i]
        ctx.beginPath()
        ctx.arc(sx(q.t * ms), sy(q.exact), 1.8 * k, 0, 2 * Math.PI)
        ctx.fill()
      }
      ctx.restore()
      // The two levels the table names, drawn where they are: the one the
      // walk started from, so a dip below it reads as a dip, and the one it
      // relaxes onto, so "after the step" has a line on the plot rather than
      // only a row in the table.
      ctx.save()
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      const level = (v, name) => {
        ctx.strokeStyle = COLORS.textDim || COLORS.text
        ctx.setLineDash([5 * k, 4 * k])
        ctx.lineWidth = 1 * k
        ctx.beginPath()
        ctx.moveTo(area.x, sy(v) + 0.5)
        ctx.lineTo(area.x + area.w, sy(v) + 0.5)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = COLORS.text
        ctx.fillText(`${name} ${fmt(v, unit, 4)}`, area.x + area.w - 6 * k, sy(v) - 3 * k)
      }
      level(step.from, 'before')
      level(step.to, 'after')
      ctx.restore()
    },
    [step, unit, label],
  )
  return (
    <canvas
      ref={ref}
      className="plot"
      role="img"
      aria-label="The switched waveform through a step, with the averaged model over it"
    />
  )
}

/**
 * The plant: six coefficients, what they mean, the guard, and the link that
 * carries them to Control Lab.
 */
export function PlantPane({ x, exp }) {
  const tf = x.plant
  const g = x.guard
  const f = x.formulas
  const boost = x.kind !== 'buck'
  const link = buildLink({
    plant: { type: 'custom', params: [...tf.b, ...tf.a] },
    ctrl: { type: 'p', params: [1] },
    from: { app: 'power-lab', id: exp.id, label: `${exp.name}, averaged` },
  })
  return (
    <div className="balance">
      <table className="table">
        <caption>
          <Eq>{'G_{vd}(s) = \\hat{v}_{out}/\\hat{d}'}</Eq>, from A = D·A_on + D′·A_off about the operating point
        </caption>
        <thead>
          <tr>
            <th>quantity</th>
            <th className="num">the model</th>
            <th className="num">the closed form</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>numerator</td>
            <td className="num" colSpan={2} data-role="plant-num">
              {poly(tf.b)}
            </td>
          </tr>
          <tr>
            <td>denominator</td>
            <td className="num" colSpan={2} data-role="plant-den">
              {poly(tf.a)}
            </td>
          </tr>
          <tr>
            <td>
              <Eq>{'G_{vd}(0)'}</Eq>
            </td>
            <td className="num">{fmt(tf.dc, 'V', 5)}</td>
            <td className="num">{fmt(f.dcIdeal, 'V', 5)}</td>
          </tr>
          <tr>
            <td>
              <Eq>{'f_0 = \\omega_0/2\\pi'}</Eq>
            </td>
            <td className="num">{fmt(f.f0plant, 'Hz', 5)}</td>
            <td className="num">{fmt(f.f0ideal, 'Hz', 5)}</td>
          </tr>
          <tr>
            <td>Q</td>
            <td className="num">{tf.Q.toFixed(4)}</td>
            <td className="num">{f.Qideal.toFixed(4)}</td>
          </tr>
          <tr>
            <td>zero</td>
            <td className="num">{Number.isFinite(f.fz) ? `${fmt(f.fz, 'Hz', 5)}, ${tf.rhp ? 'right' : 'left'} half plane` : 'none'}</td>
            <td className="num">{Number.isFinite(f.fzIdeal) ? fmt(f.fzIdeal, 'Hz', 5) : boost ? '—' : 'none'}</td>
          </tr>
          <tr className="total">
            <td>
              <Eq>{'dV_{out}/dD'}</Eq> on the switched engine
            </td>
            <td className="num">{fmt(f.dcMeasured, 'V', 5)}</td>
            <td className="num">two full steady states, no averaging</td>
          </tr>
        </tbody>
      </table>
      <p className={`hint ${g.state === 'ok' ? '' : 'disagree'}`} data-role="plant-guard">
        {g.state === 'ok'
          ? `Averaging discards everything inside one switching period, so this model describes the converter below f_s/5 = ${fmt(g.limit, 'Hz', 4)}. Its highest feature is at ${fmt(g.highest, 'Hz', 4)}.`
          : g.reason}
      </p>
      {g.state === 'refuse' ? (
        <p className="hint" data-role="plant-link">
          The hand-over is declined at this setting. A plant whose own corner sits above f_s/5 is not this
          converter, and a loop closed around it would have margins the circuit does not have.
        </p>
      ) : (
        <p className="hint" data-role="plant-link">
          <a href={`../control-lab/#${link}`}>Open this plant in Control Lab</a> and close a loop around it. The
          link carries the six coefficients exactly, so the plant on the other side is this one.
        </p>
      )}
    </div>
  )
}

/**
 * One phase's power and the bus's, over one output cycle.
 *
 * A single phase takes P(1 − cos 2ωt) plus a quadrature term, so it swings by
 * its own apparent power at twice the output frequency. Three of them, a
 * third of a cycle apart, add to a bus that carries none of that.
 */
export function PowerPane({ x }) {
  const m = x.m
  const f = x.formulas
  return (
    <div className="balance">
      <PowerCanvas x={x} />
      <table className="table">
        <caption>
          The rail supplies <Eq>{'p_{dc} = V_{dc} i_{dc}'}</Eq>, which is the sum of the three windings' own
          instantaneous powers at every instant
        </caption>
        <thead>
          <tr>
            <th>quantity</th>
            <th className="num">phase a alone</th>
            <th className="num">all three</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>average power</td>
            <td className="num">{fmt(m.Pa, 'W', 4)}</td>
            <td className="num">{fmt(m.Pdc, 'W', 4)}</td>
          </tr>
          <tr>
            <td>swing at twice the output frequency</td>
            <td className="num">{fmt(m.pa2, 'W', 4)}</td>
            <td className="num" data-role="bus-2f">
              {fmtz(m.p2, 'W', 3, m.Pdc)}
            </td>
          </tr>
          <tr>
            <td>that swing, as a share of the mean</td>
            <td className="num">{(m.phaseSwing * 100).toFixed(1)} %</td>
            <td className="num">{(m.busSwing * 100).toFixed(4)} %</td>
          </tr>
          <tr>
            <td>
              <Eq>{'1/\\cos\\varphi'}</Eq> of the load
            </td>
            <td className="num">{f.onePhaseSwing.toFixed(4)}</td>
            <td className="num">φ = {f.phiDeg.toFixed(2)}°</td>
          </tr>
          <tr className="total">
            <td>swing at six times the output frequency</td>
            <td className="num">—</td>
            <td className="num">{fmt(m.p6, 'W', 3)}</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">
        The rail still carries the switching itself, at the carrier and above. What it does not carry is the
        second harmonic of the output, which is the one a single-phase bridge cannot avoid.
      </p>
    </div>
  )
}

function PowerCanvas({ x }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h, { topInset: 16 * plotArea(w, h).k })
      const k = area.k
      const wf = x.wf
      const ms = 1e3
      const t1 = x.T * ms
      const pa = wf.sig.pa
      const pdc = wf.sig.pdc
      const [lo, hi] = niceBounds(Math.min(0, ...pa, ...pdc), Math.max(...pa, ...pdc))
      const { sx, sy } = drawFrame(ctx, area, 0, t1, lo, hi, (v) => fmt(v / ms, 's', 3), axisFmt(lo, hi, 'W'), {
        zeroLine: true,
        xTitle: 'Time, one output cycle',
        yTitle: 'Instantaneous power (W)',
      })
      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()
      const draw = (ys, colour, width) => {
        ctx.strokeStyle = colour
        ctx.lineWidth = width * k
        ctx.beginPath()
        for (let i = 0; i < wf.t.length; i++) {
          const px = sx(wf.t[i] * ms)
          const py = sy(ys[i])
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      draw(pdc, COLORS.response, 1.6)
      draw(pa, TRACE_COLORS.ia, 1.2)
      ctx.restore()
      // The two means, so the swing is read against something.
      ctx.save()
      ctx.font = `${Math.round(11 * k)}px ${MONO}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillStyle = COLORS.response
      ctx.fillText(`p_dc, mean ${fmt(x.m.Pdc, 'W', 4)}`, area.x + 6 * k, area.y + 4 * k)
      ctx.fillStyle = TRACE_COLORS.ia
      ctx.fillText(`p_a, mean ${fmt(x.m.Pa, 'W', 4)}`, area.x + 6 * k, area.y + 18 * k)
      ctx.restore()
    },
    [x],
  )
  return (
    <canvas ref={ref} className="plot" role="img" aria-label="Instantaneous power of one phase and of the DC bus" />
  )
}
