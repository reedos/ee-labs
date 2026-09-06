import React from 'react'
import { fmt } from '@ee-labs/ui'

// The one pane Groups J and K need that the lab does not already have.
//
// J3's claim is a comparison, and a comparison of three converters is a
// table: the same rail, the same load, the same turns, and three answers in
// the columns that differ. Every cell is a solved steady state rather than a
// quotation, so a knob that moves the converter moves all three rows and the
// reader can watch which column follows it.

const pct = (v) => `${(v * 100).toFixed(2)} %`

export function FamilyPane({ x }) {
  const rows = x.formulas?.family
  if (!rows) return null
  return (
    <div className="family">
      <table className="table">
        <caption>The three isolated buck-derived converters, each solved at these settings</caption>
        <thead>
          <tr>
            <th>converter</th>
            <th className="num">switches</th>
            <th className="num">N_p:N_s</th>
            <th className="num">M</th>
            <th className="num">V_out</th>
            <th className="num">each blocks</th>
            <th className="num">switch loss</th>
            <th className="num">ΔI_L</th>
            <th className="num">η</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.kind} className={r.here ? 'is-here' : undefined}>
              <td>
                {r.label}
                {r.here ? <em> · on screen</em> : null}
              </td>
              <td className="num">{r.switches}</td>
              <td className="num">{fmt(r.turns, '', 3)}</td>
              <td className="num">{r.M.toFixed(5)}</td>
              <td className="num">{fmt(r.Vout, 'V', 4)}</td>
              <td className="num">{`${fmt(r.stress, 'V', 3)} (${r.stressRatio.toFixed(2)}×)`}</td>
              <td className="num">{fmt(r.switchLoss, 'W', 3)}</td>
              <td className="num">{fmt(r.dI, 'A', 3)}</td>
              <td className="num">{pct(r.eta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pane-note">
        The forward carries twice the turns ratio of the other two, because its transformer is driven
        one way round and its ratio has one D in it rather than two. That is what puts the same output
        in every row, so the columns that differ are the ones the topology decides.
      </p>
    </div>
  )
}
