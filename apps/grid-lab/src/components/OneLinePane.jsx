import React from 'react'
import { OneLineCanvas } from '@ee-labs/ui'

/**
 * The shared one-line canvas, fed from this lab's analysis.
 *
 * The canvas is `packages/ui`'s, built here and used by the Energy Lab
 * (PROGRAM.md §4). Everything below turns one analysis into its props, so the
 * renderer never has to know what a bus type is.
 *
 * The DC power flow's guard reaches this pane through `arrows` and `refusal`.
 * Past 30° the two solves can disagree on which way a branch carries power, so
 * the arrows are declined and the reason is printed where they would have been.
 */
export default function OneLinePane({ x, exp }) {
  if (x.kind === 'base') return <ZoneDiagram x={x} />
  if (!x.sol) return <p className="empty">{x.refusal}</p>
  const refuse = x.guard && x.guard.refuse
  const buses = x.sol.buses.map((b) => ({
    id: b.id,
    name: b.bus.name || b.id,
    x: b.bus.x,
    y: b.bus.y,
    V: b.V,
    theta: b.theta,
    kind: b.type === 'slack' ? 'slack' : b.scheduled.P < 0 ? 'load' : 'bus',
  }))
  const branches = x.sol.flows.map((f) => ({
    id: f.id,
    from: f.from,
    to: f.to,
    Pf: f.Pf,
    Qf: f.Qf,
    Pt: f.Pt,
    Qt: f.Qt,
    loss: f.Ploss,
  }))
  // Real power in equals real power out plus the loss, which is the same
  // audit the ledger runs and the residual is printed beside it.
  const generated = x.sol.buses.reduce((s, b) => s + Math.max(0, b.P), 0)
  const served = x.sol.buses.reduce((s, b) => s + Math.max(0, -b.P), 0)
  return (
    <OneLineCanvas
      buses={buses}
      branches={branches}
      balance={{ in: generated, out: served, loss: x.sol.Ploss, unit: 'pu' }}
      arrows={refuse ? 'none' : 'flow'}
      refusal={refuse ? x.guard.refusal : null}
      units="pu"
      base={{ S: x.b.Sbase, V: x.b.Vbase }}
    />
  )
}

/**
 * Group A's picture: the two zones of a transformer, each with its own bases.
 * It is the same canvas, given two buses and the branch between them.
 */
function ZoneDiagram({ x }) {
  return (
    <OneLineCanvas
      buses={[
        { id: 'high', name: `${(x.b.Vbase / 1e3).toFixed(1)} kV zone`, x: 90, y: 90, V: 1, theta: 0, kind: 'slack' },
        { id: 'low', name: `${(x.low.Vbase / 1e3).toFixed(1)} kV zone`, x: 320, y: 90, V: 1, theta: 0, kind: 'load' },
      ]}
      branches={[{ id: 'tx', from: 'high', to: 'low', Pf: x.pu.P, Qf: x.pu.Q, Pt: -x.pu.P, Qt: -x.pu.Q }]}
      balance={{ in: x.pu.P, out: x.pu.P, unit: 'pu' }}
      units="pu"
      base={{ S: x.b.Sbase, V: x.b.Vbase }}
    />
  )
}
