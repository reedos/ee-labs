/**
 * What the tracker did, and what the converter did with it.
 *
 * The P–V view draws the walk. This is the same walk as numbers: where it
 * started, which step turned round, what it settled to, and how much of the
 * available power that leaves. The tracking group's whole argument is the gap
 * between the last two rows, and a picture of an oscillation does not measure
 * it.
 *
 * For the converter experiment it prints the duty, the resistance the duty
 * makes, and both input currents with the difference between them. The two
 * come from different places. One is R/D² and the algebra around it, and one
 * is the average of the switched steady state `@ee-labs/switched` solves. A
 * pane that showed only one of them, or showed them as one number, would be
 * hiding the check rather than making it.
 */
import React from 'react'
import { fmt } from '@ee-labs/ui'
import { nz } from '../format.js'

const Row = ({ label, value, unit, digits = 5, note = null }) =>
  Number.isFinite(value) ? (
    <tr>
      <th scope="row">
        {label}
        {note ? <em className="prov"> {note}</em> : null}
      </th>
      <td className="num">{fmt(value, unit, digits)}</td>
    </tr>
  ) : null

export default function TrackPane({ exp, x }) {
  if (x.kind === 'buck') {
    const d = x.buck.iinSwitched - x.buck.iinModel
    return (
      <div className="view-body-inner">
        <table className="table">
          <tbody>
            <Row label="Duty" value={x.buck.D * 100} unit="%" digits={4} />
            <Row label="R_in = R/D²" value={x.rin} unit="Ω" />
            <Row label="The array sits at" value={x.at.v} unit="V" />
            <Row label="and delivers" value={x.at.p} unit="W" />
            <Row label="Share of P_mpp" value={x.share * 100} unit="%" digits={4} />
            <Row label="The converter's output" value={x.buck.m.sig.vout.avg} unit="V" />
            <Row label="into its load" value={x.buck.m.Pout} unit="W" />
            <Row label="Input current, from R/D²" value={x.buck.iinModel} unit="A" digits={7} />
            <Row
              label="Input current, from the switched steady state"
              value={x.buck.iinSwitched}
              unit="A"
              digits={7}
            />
            <tr className="total">
              <th scope="row">
                The difference between them
                <em className="prov"> the steady state's own residual, not a modelling gap</em>
              </th>
              <td className="num">{fmt(nz(d, x.buck.iinModel), 'A', 2)}</td>
            </tr>
            <Row
              label="The duty that would track"
              value={x.duty.D * 100}
              unit="%"
              digits={6}
              note="√(R·I_mpp/V_mpp)"
            />
          </tbody>
        </table>
      </div>
    )
  }
  if (!x.path || !x.settled) return null
  const last = x.path[x.path.length - 1]
  return (
    <div className="view-body-inner">
      <table className="table">
        <tbody>
          <Row label="Started at" value={x.path[0].v} unit="V" digits={4} />
          <Row label="Step size" value={x.path[1] ? Math.abs(x.path[1].v - x.path[0].v) : NaN} unit="V" digits={4} />
          <Row label="Steps taken" value={x.path.length - 1} unit="" digits={3} />
          <Row label="First step that turned round" value={x.reversal} unit="" digits={3} />
          <Row label="Settles between" value={x.settled.vmin} unit="V" digits={4} />
          <Row label="and" value={x.settled.vmax} unit="V" digits={4} />
          <Row label="Swing" value={x.settled.swing} unit="V" digits={4} note="two steps wide, across the peak" />
          <Row label="Mean power once settled" value={x.settled.mean} unit="W" />
          <Row label="Available, P_mpp" value={x.fig.pmpp} unit="W" />
          <tr className="total">
            <th scope="row">Share of what is there</th>
            <td className="num">{(x.share * 100).toFixed(3)} %</td>
          </tr>
          <Row label="Given up to the dither" value={(1 - x.share) * 100} unit="%" digits={4} />
          <Row label="Where it is now" value={last.v} unit="V" digits={4} />
        </tbody>
      </table>
    </div>
  )
}
