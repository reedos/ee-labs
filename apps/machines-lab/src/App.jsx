// Machines Lab.
//
// The suite's shape, unchanged. A sidebar with the experiment picker folded by
// group, a topbar naming the experiment, the machine's circuit with live
// meters, the knobs, the note in its three registers with terms folded under
// it, and a lower pane with a view switch.
//
// Nothing here solves anything. Every number on screen comes from
// analysis.js through quantities.js, which is what experiments.test.js reads,
// so a number in a test and a number on screen cannot differ.

import React, { useMemo, useState } from 'react'
import { LabNav, NumField, ReportIssue, Schematic } from '@ee-labs/ui'
import { radToRpm } from '@ee-labs/machines'
import { EXPERIMENTS, GROUPS, VIEW_LABELS, inGroup } from './experiments.js'
import { analyse, defaultsOf } from './analysis.js'
import { readQuantity } from './quantities.js'
import { METERS, reading, runUpSays } from './readout.js'
import { drawOf } from './layouts.js'
import { TERMS } from './terms.js'
import { summary } from './report.js'
import {
  DQCanvas,
  EfficiencyCanvas,
  FieldCanvas,
  FluxCanvas,
  HeatCanvas,
  PhasePlaneCanvas,
  PhasorCanvas,
  PowerAngleCanvas,
  ScopeCanvas,
  TorqueCurveCanvas,
  TorqueSpeedCanvas,
} from './components/canvases.jsx'

const num = (v, unit, digits = 4) => reading(v, unit, digits)

/** The meters a reader wants for each model, in the units the quantity has. */
export function readings(x) {
  const rows = []
  for (const [label, path, unit, digits] of METERS[x.kind] || []) {
    try {
      rows.push({ label, value: reading(readQuantity(x, path), unit, digits) })
    } catch {
      // A path a model does not carry is simply not shown.
    }
  }
  return rows
}

/**
 * The one reading the topbar carries.
 *
 * It is the model's first meter unless the experiment names another in
 * `lead`. C2's lesson is the synchronous speed and its only view is the
 * rotating field, so without a lead the one number it teaches appeared
 * nowhere on its screen and none of its try lines changed anything.
 */
export function headline(exp, x) {
  const rows = readings(x)
  const led = exp.lead && rows.find((r) => r.label === exp.lead)
  const row = led || rows[0]
  return row ? `${row.label}: ${row.value}` : ''
}

/** Where the power goes, per model, as a table that adds up. */
function powerRows(x) {
  if (x.kind === 'dc' && x.audit) {
    const a = x.audit
    return {
      rows: [
        ['Supplied', a.supplied],
        ['Armature copper', a.copper],
        ['Friction', a.friction],
        ['Load', a.load],
        ['Stored, rate of change', a.dStored],
        ['Coupling residual', a.coupled],
      ],
      gap: a.gap,
      unit: 'W',
    }
  }
  if (x.kind === 'transformer') {
    return {
      rows: [
        ['Input', x.pIn],
        ['Output', x.pOut],
        ['Copper loss', x.pCu],
        ['Core loss', x.pCore],
      ],
      gap: x.pIn - (x.pOut + x.pCu + x.pCore),
      unit: 'W',
    }
  }
  if (x.kind === 'im') {
    return {
      rows: [
        ['Input', x.pIn],
        ['Stator copper', x.pStatorCu],
        ['Core loss', x.pCore],
        ['Air gap', x.pGap],
        ['Rotor copper', x.pRotorCu],
        ['Mechanical, gross', x.pMech],
        ['Friction and windage', x.pFriction],
        ['Shaft', x.pShaft],
      ],
      gap: x.pIn - (x.pStatorCu + x.pCore + x.pGap),
      unit: 'W',
    }
  }
  if (x.kind === 'losses') {
    const s = x.split
    return {
      rows: [
        ['Input', s.pIn],
        ['Output', s.pOut],
        ['Copper', s.pCu],
        ['Core', s.pCore],
        ['Friction and windage', s.pFriction],
        ['Stray', s.pStray],
      ],
      gap: s.pIn - (s.pOut + s.pCu + s.pCore + s.pFriction + s.pStray),
      unit: 'W',
    }
  }
  return null
}

/**
 * The state equation, with its axes named.
 *
 * A matrix of bare numbers is a plot with no axes. The row header says which
 * derivative the row is, the column header says which state the entry
 * multiplies, and both carry their units: every entry of A is per second,
 * because it turns a state into that state's rate. The affine column is the
 * input term and is a rate, not a coefficient, so it is headed apart.
 */
function Matrix({ rows, states, affine, affineUnit }) {
  return (
    <table className="matrix">
      <thead>
        <tr>
          <th>d/dt</th>
          {states.map((s) => (
            <th key={s}>{s}</th>
          ))}
          {affine && <th className="affine">input</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <th>{states[i]}</th>
            {row.map((v, j) => (
              <td key={j}>{num(v, '', 5)}</td>
            ))}
            {affine && <td className="affine">{num(affine[i], '', 5)}</td>}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th>units</th>
          {states.map((s) => (
            <td key={s}>per second</td>
          ))}
          {affine && <td className="affine">{affineUnit}</td>}
        </tr>
      </tfoot>
    </table>
  )
}

function StatePane({ x }) {
  if (x.kind === 'pmsm') {
    const s = x.state
    return (
      <div className="pane" data-view="state">
        <p className="pane-note">
          The dq current equations at {num(x.machine.omegaE / (2 * Math.PI), 'Hz')} electrical. Linear, so exact.
        </p>
        <Matrix rows={s.A} states={s.states} affine={s.c} affineUnit="A per second" />
      </div>
    )
  }
  if (!x.dyn) return <div className="pane">This model has no state equation.</div>
  const { dyn } = x
  const names = dyn.states.map((s) => (s.id === 'shaft.J' ? 'ω (rad/s)' : s.id === 'La' ? 'i_a (A)' : s.id))
  return (
    <div className="pane" data-view="state">
      <p className="pane-note">
        Two states, read off one resistive solve. The second row is the rotor, in mechanical units.
      </p>
      <Matrix rows={dyn.A} states={names} />
      <p className="pane-note">
        Roots at {num(x.tc.roots[0].re, '', 5)} and {num(x.tc.roots[1].re, '', 5)} per second.
      </p>
    </div>
  )
}

function PowerPane({ x }) {
  const p = powerRows(x)
  if (!p) return <div className="pane">This model has no power table.</div>
  return (
    <div className="pane" data-view="power">
      <table className="power">
        <tbody>
          {p.rows.map(([label, v]) => (
            <tr key={label}>
              <th>{label}</th>
              <td>{num(v, p.unit)}</td>
            </tr>
          ))}
          <tr className="gap">
            <th>What does not balance</th>
            <td>{num(p.gap, p.unit, 3)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/**
 * The phasor view.
 *
 * The transformer's used to draw the PRIMARY voltage beside the loaded
 * secondary, on one plane, at one scale. Those are the two sides of a 2:1
 * ratio, so the picture said the secondary had lost half its voltage. B5's
 * note compares the secondary with no load against the secondary with one,
 * 119.8 V against 113.6 V, and neither of those arrows was drawn. Both are
 * drawn now, and the load current with them, because the current through the
 * series branch is what turns and shortens the output.
 */
function Phasors({ x }) {
  if (x.kind === 'sync') {
    const p = x.phasor
    return (
      <PhasorCanvas
        arrows={[
          { label: 'V', re: p.V[0], im: p.V[1] },
          { label: 'E', re: p.E[0], im: p.E[1] },
          { label: 'I', re: p.I[0], im: p.I[1], current: true, unit: 'A' },
        ]}
      />
    )
  }
  // The solver's phasors are amplitudes. Every number the transformer's
  // lessons quote is rms, so the arrows are drawn rms and the angles are
  // unchanged by the scaling.
  const at = (v) => (v || [0, 0]).map((c) => c / Math.SQRT2)
  return (
    <PhasorCanvas
      arrows={[
        { label: 'V no load', re: at(x.open.v[x.openNode])[0], im: at(x.open.v[x.openNode])[1] },
        { label: 'V loaded', re: at(x.ac.v[x.net.outNode])[0], im: at(x.ac.v[x.net.outNode])[1] },
        { label: 'I load', re: at(x.ac.i.RL)[0], im: at(x.ac.i.RL)[1], current: true, unit: 'A' },
      ]}
    />
  )
}

function View({ view, x }) {
  switch (view) {
    case 'torquespeed':
      return <TorqueSpeedCanvas x={x} />
    case 'curve':
      return <TorqueCurveCanvas x={x} />
    case 'angle':
      return <PowerAngleCanvas x={x} />
    case 'field':
      return <FieldCanvas x={x} />
    case 'dq':
      return <DQCanvas x={x} />
    case 'scope':
      return <ScopeCanvas x={x} />
    case 'phaseplane':
      return <PhasePlaneCanvas x={x} />
    case 'efficiency':
      return <EfficiencyCanvas x={x} />
    case 'heat':
      return <HeatCanvas x={x} />
    case 'bh':
      return <FluxCanvas x={x} />
    case 'phasors':
      return <Phasors x={x} />
    case 'state':
      return <StatePane x={x} />
    case 'power':
      return <PowerPane x={x} />
    default:
      return (
        <div className="pane" data-view="reading">
          <table className="readout">
            <tbody>
              {readings(x).map((r) => (
                <tr key={r.label}>
                  <th>{r.label}</th>
                  <td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

function Knob({ p, value, onChange }) {
  if (p.kind === 'toggle')
    return (
      <button className={`toggle ${value ? 'on' : ''}`} onClick={() => onChange(!value)}>
        {p.label}: {value ? p.on : p.off}
      </button>
    )
  if (p.kind === 'choice')
    return (
      <div className="choice">
        <span className="choice-label">{p.label}</span>
        <div className="segmented">
          {p.options.map((o) => (
            <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    )
  return (
    <NumField
      label={p.label}
      value={value}
      onChange={onChange}
      min={p.min}
      max={p.max}
      scale={p.scale}
      unit={p.unit}
      eng={p.eng !== false}
      presets={p.presets}
      compact
    />
  )
}

export default function App() {
  const [id, setId] = useState(EXPERIMENTS[0].id)
  const exp = EXPERIMENTS.find((e) => e.id === id)
  const [params, setParams] = useState(() => defaultsOf(EXPERIMENTS[0]))
  const [view, setView] = useState(EXPERIMENTS[0].view)
  const [open, setOpen] = useState(false)
  const [terms, setTerms] = useState(false)

  const pick = (next) => {
    const e = EXPERIMENTS.find((q) => q.id === next)
    setId(next)
    setParams(defaultsOf(e))
    setView(e.view)
    setOpen(false)
  }

  const x = useMemo(() => {
    try {
      return analyse(exp, params)
    } catch (err) {
      return { error: err }
    }
  }, [exp, params])

  const draw = x.error ? null : drawOf(x)
  // The thermal analogy declines meters: a branch current there is a loss in
  // watts and a node voltage is a rise in kelvins, and the Schematic prints
  // both in electrical units. Its elements carry their own values instead.
  const meters = x.error || !draw || draw.meters === false ? null : x.sol || null

  return (
    <div className="shell">
      <aside className="sidebar">
        <LabNav current="machines-lab" currentLabel="Machines" />
        <button className="picker-current" aria-expanded={open} onClick={() => setOpen(!open)}>
          {exp.id.toUpperCase()} · {exp.name}
        </button>
        {open && (
          <div className="presets">
            {GROUPS.map((g) => (
              <details key={g} className="preset-group" open={g === exp.group}>
                <summary>{g}</summary>
                {inGroup(g).map((e) => (
                  <button key={e.id} className="preset" onClick={() => pick(e.id)}>
                    {e.name}
                  </button>
                ))}
              </details>
            ))}
          </div>
        )}
        <div className="note">
          <p className="see">{exp.see}</p>
          <ol className="try">
            {exp.try.map((s, k) => (
              <li key={k}>
                <button className="try-line" onClick={() => setParams({ ...defaultsOf(exp), ...(s.set || {}) })}>
                  {s.say}
                </button>
              </li>
            ))}
          </ol>
          <details data-role="deeper">
            <summary>Why</summary>
            <p className="why">{exp.why}</p>
          </details>
          <details open={terms} onToggle={(e) => setTerms(e.currentTarget.open)}>
            <summary>Terms used here</summary>
            <dl className="terms">
              {(exp.terms || []).map((t) => (
                <React.Fragment key={t}>
                  <dt>{TERMS[t].name}</dt>
                  <dd>{TERMS[t].def}</dd>
                </React.Fragment>
              ))}
            </dl>
          </details>
        </div>
        <ReportIssue lab="machines-lab" state={params} summary={summary(exp, params, view)} />
      </aside>

      <main className="main">
        <header className="topbar">
          <span className="group">{exp.group}</span>
          <span data-role="outcome" className="outcome">
            {x.error ? x.error.message : headline(exp, x)}
          </span>
        </header>

        {/*
          The transformer's full equivalent circuit is nine elements in a row,
          and the induction machine's is seven. Scaled to fit a 390 px pane
          those drawings render their labels at four pixels, which is a
          picture of a circuit rather than a circuit. The drawing keeps a
          floor on its scale and the box around it scrolls sideways, so the
          page never does.
        */}
        {draw && (
          <div className="machine-scroll">
            <Schematic
              elements={draw.elements}
              layout={draw.layout}
              meters={meters}
              show={meters ? 'i' : 'none'}
              className="machine"
            />
          </div>
        )}
        {!draw && !x.error && <div className="no-circuit">This model is a closed form, not a circuit.</div>}

        <div className="knobs">
          {exp.params.map((p) => (
            <Knob key={p.key} p={p} value={params[p.key]} onChange={(v) => setParams({ ...params, [p.key]: v })} />
          ))}
        </div>

        <div className="view">
          <div className="view-head">
            <div className="view-switch segmented">
              {exp.views.map((v) => (
                <button key={v} className={v === view ? 'on' : ''} title={VIEW_LABELS[v].title} onClick={() => setView(v)}>
                  {VIEW_LABELS[v].label}
                </button>
              ))}
            </div>
            {x.kind === 'sat' && <span className="readout">{x.label}</span>}
            {x.runUp && <span className="readout">{runUpSays(x.runUp)}</span>}
          </div>
          {x.error ? <div className="pane error">{x.error.message}</div> : <View view={view} x={x} />}
        </div>
      </main>
    </div>
  )
}
