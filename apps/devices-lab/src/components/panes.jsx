import React from 'react'
import { COLORS } from '@ee-labs/ui'
import BandCanvas from './BandCanvas.jsx'
import CVCanvas from './CVCanvas.jsx'
import CrossSection from './CrossSection.jsx'
import CurvesCanvas from './CurvesCanvas.jsx'
import ProfileCanvas from './ProfileCanvas.jsx'
import { num } from '../format.js'
import { refusalReason, transportRefusal } from '../math.js'
import { READINGS } from '../readings.js'

/**
 * The lower pane, whichever view is selected.
 *
 * Nothing here computes physics. Every number is read out of what `analyse`
 * returned, and every drawing is handed its values rather than asked to work
 * them out.
 */
export default function Pane({ view, x, exp }) {
  if (!x.sol) return <Refusal x={x} />
  switch (view) {
    case 'reading':
      return <Reading x={x} exp={exp} />
    case 'profile':
      return <Profile x={x} />
    case 'band':
      return <BandCanvas ec={x.carrier.ec} ev={x.carrier.ev} ei={x.carrier.ei} ef={x.carrier.ef} />
    case 'cv':
      return <CVCanvas mos={x.mos} />
    case 'curves':
      return <CurvesCanvas fet={x.fet} pv={x.fet ? null : x.pv} />
    case 'sequence':
      return <Sequence x={x} />
    case 'equations':
      return <Equations x={x} exp={exp} />
    default:
      return null
  }
}

/** The pane with nothing to draw, and the sentence that says why. */
function Refusal({ x }) {
  return (
    <div className="pane-refusal" data-role="refusal">
      <p>{refusalReason(x.refusal)}</p>
    </div>
  )
}

/** Every quantity the structure produced, in the order a reader wants them. */
function Reading({ x, exp }) {
  const rows = READINGS[exp.structure](x)
  return (
    <div className="reading-pane" data-role="reading">
      <table>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} data-quantity={r.path || r.label}>
              <th scope="row">{r.label}</th>
              <td>{typeof r.value === 'string' ? r.value : num(r.value, r.unit)}</td>
              <td className="note">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Charge density, field and potential on one position axis. */
function Profile({ x }) {
  const j = x.j
  const margin = 0.35 * j.w
  return (
    <ProfileCanvas
      traces={[
        { label: 'ρ', unit: 'C/m³', at: j.rho, colour: COLORS.spectrum },
        { label: 'E', unit: 'V/m', at: j.field, colour: COLORS.trace },
        { label: 'ψ', unit: 'V', at: j.potential, colour: COLORS.response },
      ]}
      from={-j.xp - margin}
      to={j.xn + margin}
      edges={[-j.xp, 0, j.xn]}
      caption={`depletion approximation · bias ${num(j.v, 'V')} · W = ${num(j.w, 'm')}`}
    />
  )
}

/** The fabrication sequence, and the one number each step sets. */
function Sequence({ x }) {
  const stack = x.stack
  const fab = x.fab
  const steps = stack.steps || []
  const sets = [
    'the wafer this starts from',
    `t_ox = ${num(fab.cox ? 3.4531332e-11 / fab.cox : 0, 'm')}`,
    fab.mos ? `V_T = ${num(fab.vt, 'V')}` : `N_A = ${num(fab.doping / 1e6, 'cm⁻³')}`,
    fab.mos ? `C_ox = ${num(fab.cox, 'F/m²')}` : `junction depth ${num(fab.depth, 'm')}`,
    fab.mos ? `I_D = ${num(fab.id, 'A')}` : `V₀ = ${num(fab.v0, 'V')}`,
    'the contacts, which set no device number',
  ]
  return (
    <div className="sequence-pane" data-role="sequence">
      <ol>
        {steps.map((s, k) => (
          <li key={s} data-step={k} data-state={k === stack.step ? 'active' : k < stack.step ? 'done' : 'ahead'}>
            <b>{s}</b>
            <span className="note">{sets[k]}</span>
          </li>
        ))}
      </ol>
      <CrossSection stack={stack} className="in-pane" />
    </div>
  )
}

/** The closed forms behind the numbers, with the constants they were evaluated at. */
function Equations({ x, exp }) {
  const rows = READINGS[exp.structure](x).filter((r) => r.form)
  return (
    <div className="equations-pane" data-role="equations">
      <table>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td className="form">{r.form}</td>
              <td>{typeof r.value === 'string' ? r.value : num(r.value, r.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {exp.structure === 'junction' || exp.structure === 'mos' || exp.structure === 'mosfet' ? (
        <p className="declined" data-role="declined">
          {transportRefusal()}
        </p>
      ) : null}
    </div>
  )
}
