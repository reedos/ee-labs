/**
 * The day, hour by hour, with the data and the solves in separate columns.
 *
 * The plan's §2.8 and §4 both ask for this table by name: the three rows of
 * twenty-four numbers on screen, said to be data. So the first three columns
 * are marked as data in the header and nowhere else does the pane imply they
 * were measured anywhere. Everything to the right of them is an exact solve
 * at that hour's conditions, or arithmetic on one.
 *
 * The hour the readout is on is marked, because the topbar and the reading
 * pane are showing that row's numbers and a reader should be able to find it.
 * Curtailed and unserved hours are marked too, for the same reason the day
 * view shades them: what the bus could not do is the lesson of E3.
 */
import React from 'react'
import { fmt } from '@ee-labs/ui'
import { shortfallOf } from '../analysis.js'
import { CELSIUS } from '../physics.js'

// Watt-hours rather than kilowatt-hours: an hour of this bus moves a few
// hundred of them, and the shared formatter turns 0.35 kWh into "350 mkWh",
// which is a prefix on a prefixed unit.
const WH = 3600

export default function ProfilePane({ x }) {
  const rows = x.g.rows
  return (
    <div className="view-body-inner is-wide">
      <table className="table profile-table">
        <thead>
          <tr>
            <th scope="col">Hour</th>
            <th scope="col">
              Irradiance<em className="prov"> data</em>
            </th>
            <th scope="col">
              Cell T<em className="prov"> data</em>
            </th>
            <th scope="col">
              Load<em className="prov"> data</em>
            </th>
            <th scope="col">
              Array<em className="prov"> solved</em>
            </th>
            <th scope="col">
              To bank<em className="prov"> solved</em>
            </th>
            <th scope="col">
              Charge<em className="prov"> solved</em>
            </th>
            <th scope="col">What it could not do</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const short = shortfallOf(r)
            return (
              <tr key={r.h} className={r.h === x.hour ? 'is-here' : ''} data-hour={r.h}>
                <th scope="row">{r.h}</th>
                <td className="num">{fmt(r.G, 'W/m²', 3)}</td>
                <td className="num">{fmt(r.T - CELSIUS, '°C', 4)}</td>
                <td className="num">{fmt(r.load, 'W', 3)}</td>
                <td className="num">{fmt(r.pv, 'W', 5)}</td>
                <td className="num">{fmt(r.toBank / WH, 'Wh', 3)}</td>
                <td className="num">{r.z.toFixed(4)}</td>
                <td className={short ? 'flag warn' : ''}>{short}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
