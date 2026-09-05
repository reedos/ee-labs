import React from 'react'
import { fmt } from '@ee-labs/ui'
import { degText, money, pct, pu } from '../format.js'
import OneLinePane from './OneLinePane.jsx'
import FlowCanvas from './FlowCanvas.jsx'
import PhasorCanvas from './PhasorCanvas.jsx'
import SequenceCanvas from './SequenceCanvas.jsx'
import StabilityCanvas from './StabilityCanvas.jsx'
import RelayCanvas from './RelayCanvas.jsx'
import CostCanvas from './CostCanvas.jsx'

/**
 * The two panels every experiment offers, and the switch that maps a view id
 * to the pane that draws it.
 *
 * `TablePane` is the rows an experiment is about, chosen by its kind. Every
 * number in it comes from the same analysis the pictures draw.
 * `ReadingPane` is every meter the experiment has at once, for a reader who
 * wants the whole state rather than the part the lesson is about.
 */

const Rows = ({ rows, caption }) => (
  <div className="rows" data-role="rows">
    {caption ? <p className="rows-caption">{caption}</p> : null}
    <dl>
      {rows.map((r) => (
        <React.Fragment key={r.label}>
          <dt>{r.label}</dt>
          <dd className={r.note ? 'has-note' : ''}>
            {r.value}
            {r.note ? <span className="row-note">{r.note}</span> : null}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  </div>
)

const row = (label, value, note = '') => ({ label, value, note })

function tableRows(x) {
  if (x.kind === 'base')
    return [
      row('Base power', fmt(x.b.Sbase, 'VA', 4)),
      row('Base voltage, line to line', fmt(x.b.Vbase, 'V', 4)),
      row('Base voltage, line to neutral', fmt(x.b.VbaseLN, 'V', 6)),
      row('Base impedance', fmt(x.b.Zbase, 'Ω', 6)),
      row('Base current', fmt(x.b.Ibase, 'A', 6)),
      row('Low-side base impedance', fmt(x.low.Zbase, 'Ω', 6)),
      row('Low-side base current', fmt(x.low.Ibase, 'A', 6)),
      row('Generator on the system base', pu(x.gen, 6)),
      row('Transformer on the system base', pu(x.tx, 6)),
      row('Load', `${pu(x.pu.P, 6)} + j${x.pu.Q.toFixed(6)}`),
      row('As a constant impedance', pu(x.zip.Zmag, 6)),
    ]
  if (x.kind === 'phase')
    return [
      row('Line to line', fmt(x.load.Vll, 'V', 5)),
      row('Line to neutral', fmt(x.load.Vln, 'V', 6)),
      row('Line current', fmt(x.load.I, 'A', 6)),
      row('Three-phase real power', fmt(x.load.P, 'W', 6)),
      row('Three-phase reactive power', fmt(x.load.Q, 'var', 6)),
      row('Power factor', x.load.pf.toFixed(6)),
      row('One phase, from', fmt(x.inst.min, 'W', 6), `to ${fmt(x.inst.max, 'W', 6)}`),
      row('Three-phase ripple', x.inst.rippleThree.toExponential(2)),
      row('Delta leg current', fmt(x.delta.Iphase, 'A', 6)),
      row('Delta line current', fmt(x.delta.Iline, 'A', 6)),
      row('Zero sequence', `${x.seq.mag[0].toFixed(5)} A`),
      row('Positive sequence', `${x.seq.mag[1].toFixed(5)} A`),
      row('Negative sequence', `${x.seq.mag[2].toFixed(5)} A`),
    ]
  if (x.kind === 'line')
    return [
      row('Series impedance', `${fmt(x.pi.Z[0], 'Ω', 4)} + j${fmt(x.pi.Z[1], 'Ω', 4)}`),
      row('In per unit', `${x.pi.Z[0] / x.b.Zbase < 1 ? (x.pi.Z[0] / x.b.Zbase).toFixed(7) : ''} + j${(x.pi.Z[1] / x.b.Zbase).toFixed(7)}`),
      row('Charging', pu(x.pi.Y[1] * x.b.Zbase, 5)),
      row('Surge impedance', fmt(x.surge.Zc, 'Ω', 6)),
      row('Surge impedance loading', fmt(x.surge.sil, 'W', 6)),
      row('Open-end rise, exact', x.rise.exact.toFixed(6)),
      row('Open-end rise, lumped π', x.rise.nominal.toFixed(6)),
      row('Difference', pct(x.rise.error, 5)),
      row('Model in force', x.model.model, x.model.guard),
      row('Receiving bus', pu(x.Vr, 6)),
      row('Drop', pu(x.drop, 6), `the QX/V estimate says ${x.estimate.toFixed(4)} pu`),
      row('Tap that restores 1.00 pu', x.tapNeeded.toFixed(6)),
      row('Shunt that restores 1.00 pu', `${x.shunt.mvar.toFixed(4)} Mvar`),
    ]
  if (x.kind === 'flow') {
    if (!x.sol) return [row('No solution', x.refusal)]
    return [
      ...x.sol.buses.map((b) => row(`${b.bus.name || b.id}`, `${pu(b.V, 6)} at ${degText(b.thetaDeg, 5)}`, `${b.region} bus, ${pu(b.P, 5)} and ${b.Q.toFixed(5)} pu`)),
      ...x.sol.flows.map((f) => row(`${f.from} to ${f.to}`, `${pu(f.Pf, 5)} and ${f.Qf.toFixed(5)} pu`, `loss ${f.Ploss.toFixed(6)} pu`)),
      row('Total loss', `${x.sol.Ploss.toFixed(7)} pu`, `${(x.sol.Ploss * 100).toFixed(5)} MW`),
      row('Newton updates', String(x.sol.iterations)),
      row('Linear solve, bus angles', x.dc.theta.map((t) => degText((t * 180) / Math.PI, 4)).join(', ')),
      row('Largest angle error', degText((x.compare.maxAngleError * 180) / Math.PI, 5)),
      row('Largest branch-flow error', pct(x.compare.maxError, 4)),
      row('Guard', x.guard.warn ? 'fired' : 'quiet', x.guard.text),
    ]
  }
  if (x.kind === 'seq')
    return [
      row('Zero sequence', `${x.seq.mag[0].toFixed(6)} A at ${degText((x.seq.ang[0] * 180) / Math.PI, 4)}`),
      row('Positive sequence', `${x.seq.mag[1].toFixed(6)} A at ${degText((x.seq.ang[1] * 180) / Math.PI, 4)}`),
      row('Negative sequence', `${x.seq.mag[2].toFixed(6)} A at ${degText((x.seq.ang[2] * 180) / Math.PI, 4)}`),
      row('Neutral', `${x.neutral.mag.toFixed(6)} A`, 'three times the zero sequence'),
      row('Unbalance factor', pct(x.unbalance, 4)),
      row('Rebuild error', `${x.abc.reduce((m, z, k) => Math.max(m, Math.hypot(z[0] - x.rebuilt.abc[k][0], z[1] - x.rebuilt.abc[k][1])), 0).toExponential(2)} A`),
      row('Positive-sequence impedance', `j${x.z.Z1[1].toFixed(4)} pu`),
      row('Negative-sequence impedance', `j${x.z.Z2[1].toFixed(4)} pu`),
      row('Zero-sequence impedance', `j${x.z.Z0[1].toFixed(4)} pu`, x.z.throughTransformer ? 'the winding passes it' : 'the delta winding blocks it'),
    ]
  if (x.kind === 'fault')
    return [
      ...x.table.map((f) =>
        row(f.label, `${Math.max(...f.phaseMag).toFixed(5)} pu`, `${(Math.max(...f.phaseMag) * x.b.Ibase).toFixed(2)} A, ground ${f.groundMag.toFixed(5)} pu`),
      ),
      row('Positive-sequence impedance', `j${x.z.Z1[1].toFixed(4)} pu`),
      row('Zero-sequence impedance', `j${x.z.Z0[1].toFixed(4)} pu`),
      row('Where the ground fault overtakes', `Z_0/Z_1 = ${x.cross.ratio.toFixed(4)}`),
      row('This fault', x.study.label, x.study.connection),
    ]
  if (x.kind === 'relay')
    return [
      ...x.times.map((t) => row(`At ${t.I} A`, `${t.t.toFixed(5)} s`)),
      row('Upstream time dial', x.up.tds.toFixed(6)),
      row('Upstream operating time', `${x.up.time.toFixed(5)} s`, `${(x.up.time - x.down).toFixed(3)} s of margin`),
      row('Zone 1 reach', `${x.zones.zone1.toFixed(2)} Ω`),
      row('Zone 2 reach', `${x.zones.zone2.toFixed(2)} Ω`),
      row('Apparent impedance', `${x.z.Z.toFixed(4)} Ω`, x.zone.says),
      row('Without infeed', `${x.zNo.Z.toFixed(4)} Ω`, x.zoneNo.says),
      row('Infeed that ends zone 1’s reach', x.threshold.toFixed(6)),
    ]
  if (x.kind === 'swing')
    return [
      row('Inertia constant M', `${x.st.M.toFixed(7)} pu·s²/rad`),
      row('Starting angle', degText(x.st.delta0 * (180 / Math.PI), 5)),
      row('Angle it may not pass', degText(x.st.deltaMax * (180 / Math.PI), 5)),
      row('Critical clearing angle', degText(x.st.deltaCr * (180 / Math.PI), 5)),
      row('Accelerating area', `${x.st.areaAccel.toFixed(8)} pu·rad`),
      row('Decelerating area', `${x.st.areaDecel.toFixed(8)} pu·rad`, `they differ by ${x.st.areaError.toExponential(2)}`),
      row('Critical clearing time', `${x.st.tcr.toFixed(6)} s`, `${x.st.cycles.toFixed(4)} cycles at 60 Hz`),
      row('Closed form at zero transfer', `${x.closed.tcr.toFixed(6)} s`),
      row('Swing frequency after the trip', `${x.st.fnPost.toFixed(6)} Hz`),
      row('First-swing peak', x.run.stable ? degText(x.run.peak * (180 / Math.PI), 5) : 'no turn back', x.run.says),
    ]
  if (x.kind === 'dispatch')
    return [
      ...x.d.units.map((u) => row(u.name, `${u.P.toFixed(4)} MW`, `${u.incremental.toFixed(5)} $/MWh${u.limited ? `, at its ${u.at}` : ''}`)),
      row('λ', `${x.d.lambda.toFixed(6)} $/MWh`),
      row('Cost at the cheapest split', money(x.d.cost)),
      row('Cost at equal shares', money(x.d.equalCost)),
      row('Saving', money(x.d.saving)),
      row('Marginal cost of the next megawatt', `${x.marginal.toFixed(6)} $/MWh`),
    ]
  return []
}

export function TablePane({ x }) {
  return <Rows rows={tableRows(x)} />
}

export function ReadingPane({ x, exp }) {
  return <Rows rows={tableRows(x)} caption={`Every meter ${exp.name.toLowerCase()} has, at these settings.`} />
}

/** The pane a view id renders, given the experiment and its analysis. */
export function ViewBody({ view, exp, x }) {
  if (view === 'oneline') return <OneLinePane x={x} exp={exp} />
  if (view === 'newton') return <FlowCanvas x={x} mode="newton" />
  if (view === 'pvcurve') return <FlowCanvas x={x} mode="pvcurve" />
  if (view === 'phasors') return <PhasorCanvas x={x} mode="phasors" />
  if (view === 'wave') return <PhasorCanvas x={x} mode="wave" />
  if (view === 'sequence') return <SequenceCanvas x={x} />
  if (view === 'pdelta') return <StabilityCanvas x={x} mode="pdelta" />
  if (view === 'rotor') return <StabilityCanvas x={x} mode="rotor" />
  if (view === 'relayplot') return <RelayCanvas x={x} mode="relayplot" />
  if (view === 'rx') return <RelayCanvas x={x} mode="rx" />
  if (view === 'cost') return <CostCanvas x={x} mode="cost" />
  if (view === 'lineplot') return <CostCanvas x={x} mode="lineplot" />
  if (view === 'table') return <TablePane x={x} />
  if (view === 'reading') return <ReadingPane x={x} exp={exp} />
  return null
}

export { tableRows }
