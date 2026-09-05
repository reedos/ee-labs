/**
 * The two panes that are tables rather than plots: every meter an experiment
 * has at once (`ReadingPane`), and where the energy went, summing to what
 * came in (`LedgerPane`). Both read the same `analyse()` output every canvas
 * does, so nothing here is a second measurement of anything.
 */
import React from 'react'
import { fmt } from '@ee-labs/ui'

const Row = ({ label, value, unit, digits = 4 }) =>
  Number.isFinite(value) ? (
    <tr>
      <th scope="row">{label}</th>
      <td className="num">{fmt(value, unit, digits)}</td>
    </tr>
  ) : null

export function ReadingPane({ exp, x }) {
  if (x.kind === 'battery') {
    return (
      <div className="view-body-inner">
        <table className="table">
          <tbody>
            <Row label="Terminal voltage" value={x.at.v} unit="V" />
            <Row label="Terminal current" value={x.at.i} unit="A" />
            <Row label="State of charge" value={x.at.z} unit="" digits={5} />
            <Row label="Open-circuit voltage here" value={x.at.v !== undefined ? x.ocv0 : NaN} unit="V" />
            <Row label="τ₁ = R₁C₁" value={x.tau1} unit="s" />
            <Row label="τ₂ = R₂C₂" value={x.tau2} unit="s" />
            <Row label="R₀ + R₁ + R₂" value={x.rdc} unit="Ω" />
            {x.tSwitch != null ? <Row label="CC → CV instant" value={x.tSwitch} unit="s" /> : null}
          </tbody>
        </table>
      </div>
    )
  }
  if (x.kind === 'day') {
    return (
      <div className="view-body-inner">
        <table className="table">
          <tbody>
            <Row label="This hour, array" value={x.at.pv} unit="W" />
            <Row label="This hour, load" value={x.at.load} unit="W" />
            <Row label="State of charge" value={x.at.z} unit="" digits={5} />
            <Row label="Bank voltage" value={x.g.bankV} unit="V" />
            <Row label="Bank energy, full" value={x.g.bankE / 3.6e6} unit="kWh" />
            <Row label="Served" value={x.served * 100} unit="%" />
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <div className="view-body-inner">
      <table className="table">
        <tbody>
          <Row label="V_oc" value={x.fig.voc} unit="V" />
          <Row label="I_sc" value={x.fig.isc} unit="A" />
          <Row label="V_mpp" value={x.fig.vmpp} unit="V" />
          <Row label="I_mpp" value={x.fig.impp} unit="A" />
          <Row label="P_mpp" value={x.fig.pmpp} unit="W" />
          <Row label="Fill factor" value={x.fig.ff} unit="" digits={5} />
          <Row label="R_mpp" value={x.fig.rmpp} unit="Ω" />
          <Row label="Operating V" value={x.at.v} unit="V" />
          <Row label="Operating I" value={x.at.i} unit="A" />
          <Row label="Operating P" value={x.at.p} unit="W" />
          <Row label="Share of P_mpp" value={x.share * 100} unit="%" />
          {x.buck ? <Row label="Converter's R_in" value={x.rin} unit="Ω" /> : null}
          {x.buck ? <Row label="Converter's output" value={x.buck.m.Pout} unit="W" /> : null}
        </tbody>
      </table>
    </div>
  )
}

export function LedgerPane({ exp, x }) {
  if (x.kind === 'day') {
    const g = x.g
    const KWH = 3.6e6
    return (
      <div className="view-body-inner">
        <table className="table">
          <tbody>
            <Row label="Array made" value={g.eIn / KWH} unit="kWh" />
            <Row label="Load asked for" value={g.eLoad / KWH} unit="kWh" />
            <Row label="Served" value={(g.eLoad - g.unserved) / KWH} unit="kWh" />
            <Row label="Unserved" value={g.unserved / KWH} unit="kWh" />
            <Row label="Curtailed" value={g.curtailed / KWH} unit="kWh" />
            <Row label="Turned to heat in the bank" value={g.lost / KWH} unit="kWh" />
            <Row label="Net stored" value={g.stored / KWH} unit="kWh" />
            <Row label="Ended at, state of charge" value={g.zEnd} unit="" digits={5} />
            <tr className="total">
              <th scope="row">Residual: in − (served + stored + curtailed)</th>
              <td className="num">{fmt(g.residual, 'J', 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }
  // The battery. Which columns apply depends on which run this experiment is.
  return (
    <div className="view-body-inner">
      <table className="table">
        <tbody>
          {x.round ? (
            <>
              <Row label="Energy out (discharge half)" value={x.round.eOut} unit="J" />
              <Row label="Energy in (charge half)" value={x.round.eIn} unit="J" />
              <Row label="Heat, discharging" value={x.round.heatOut} unit="J" />
              <Row label="Heat, charging" value={x.round.heatIn} unit="J" />
              <Row label="Round-trip efficiency" value={x.round.eta * 100} unit="%" />
              <Row label="State of charge, start" value={x.round.zStart} unit="" digits={5} />
              <Row label="State of charge, low point" value={x.round.zLow} unit="" digits={5} />
              <Row label="State of charge, end" value={x.round.zEnd} unit="" digits={5} />
            </>
          ) : (
            <>
              <Row label="Energy across the terminal" value={x.out} unit="J" />
              <Row label="Turned to heat" value={x.heat} unit="J" />
              <Row label="Heat as a share of what left the cell" value={(x.heat / (x.heat + x.out)) * 100} unit="%" />
              <Row label="Step at t = 0, i·R₀" value={x.stepDrop} unit="V" />
              <Row label="Settled drop, i·(R₀+R₁+R₂)" value={x.settledDrop} unit="V" />
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}
