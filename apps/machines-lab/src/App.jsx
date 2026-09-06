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
import { LabNav, NumField, ReportIssue, Schematic, fmt } from '@ee-labs/ui'
import { radToRpm } from '@ee-labs/machines'
import { EXPERIMENTS, GROUPS, VIEW_LABELS, inGroup } from './experiments.js'
import { analyse, defaultsOf } from './analysis.js'
import { readQuantity } from './quantities.js'
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

const num = (v, unit, digits = 4) => (Number.isFinite(v) ? fmt(v, unit, digits) : '—')

/** The meters a reader wants for each model, in the units the quantity has. */
function readings(x) {
  const rows = []
  const add = (label, path, unit, digits = 4) => {
    try {
      rows.push({ label, value: num(readQuantity(x, path), unit, digits) })
    } catch {
      // A path a model does not carry is simply not shown.
    }
  }
  if (x.kind === 'dc') {
    add('Speed', 'mech.rpm', 'rev/min')
    add('Armature current', 'mech.ia', 'A')
    add('Torque', 'mech.torque', 'N·m')
    add('Back-EMF', 'mech.emf', 'V')
    add('Stall torque', 'line.stall', 'N·m')
    add('No-load speed', 'line.noLoadRpm', 'rev/min')
    add('Electrical constant', 'tau.e', 's')
    add('Mechanical constant', 'tau.m', 's')
    add('Efficiency', 'op.efficiency', '')
  } else if (x.kind === 'transformer') {
    add('Primary voltage', 'xf.vp', 'V')
    add('Load voltage', 'xf.vOut', 'V')
    add('Load current', 'xf.iLoad', 'A')
    add('Primary current', 'xf.iPrim', 'A')
    add('Output power', 'xf.pOut', 'W')
    add('Copper loss', 'xf.pCu', 'W')
    add('Core loss', 'xf.pCore', 'W')
    add('Efficiency', 'xf.efficiency', '')
    add('Regulation', 'xf.regulation', '')
  } else if (x.kind === 'im') {
    add('Synchronous speed', 'im.rpmSync', 'rev/min')
    add('Shaft speed', 'im.rpm', 'rev/min')
    add('Slip', 'im.slip', '')
    add('Rotor frequency', 'im.rotorHz', 'Hz')
    add('Torque', 'im.torque', 'N·m')
    add('Stator current', 'im.I1', 'A')
    add('Rotor current', 'im.I2', 'A')
    add('Power factor', 'im.pf', '')
    add('Breakdown torque', 'im.tMax', 'N·m')
    add('Breakdown slip', 'im.sMax', '')
  } else if (x.kind === 'field') {
    add('Wave amplitude', 'field.amplitude', 'A-turns')
    add('Synchronous speed', 'field.rpmSync', 'rev/min')
  } else if (x.kind === 'sync') {
    add('Power angle', 'sync.delta', '°')
    add('Power', 'sync.P', 'W')
    add('Torque', 'sync.torque', 'N·m')
    add('Current', 'sync.I', 'A')
    add('Reactive power', 'sync.Q', 'var')
    add('Power factor', 'sync.pf', '')
    add('Pull-out power', 'sync.pullOut', 'W')
    add('Stability margin', 'sync.margin', '')
  } else if (x.kind === 'pmsm') {
    add('Torque constant', 'pmsm.kT', 'N·m/A')
    add('Torque', 'pmsm.torque', 'N·m')
    add('Current loop constant', 'pmsm.tauElec', 's')
    add('Speed loop constant', 'pmsm.tauMech', 's')
    add('Loop separation', 'pmsm.separation', '')
  } else if (x.kind === 'dq') {
    add('d', 'dq.d', '')
    add('q', 'dq.q', '')
    add('Zero sequence', 'dq.zero', '')
    add('Radius', 'dq.radius', '')
    add('Power, three phase', 'dq.pAbc', 'W')
    add('Power, dq frame', 'dq.pDq', 'W')
  } else if (x.kind === 'losses') {
    add('Output', 'loss.pOut', 'W')
    add('Copper loss', 'loss.pCu', 'W')
    add('Core loss', 'loss.pCore', 'W')
    add('Friction and windage', 'loss.pFriction', 'W')
    add('Total loss', 'loss.total', 'W')
    add('Efficiency', 'loss.efficiency', '')
    add('Temperature rise', 'heat.rise', 'K')
    add('Final temperature', 'heat.final', '°C')
    add('Headroom', 'heat.headroom', 'K')
  } else if (x.kind === 'sat') {
    add('Flux linkage', 'sat.lambda', 'Wb')
    add('Incremental inductance', 'sat.L', 'H')
    add('Knee current', 'sat.iKnee', 'A')
    add('Linear model would give', 'sat.linear', 'Wb')
  }
  return rows
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

function StatePane({ x }) {
  if (x.kind === 'pmsm') {
    const s = x.state
    return (
      <div className="pane" data-view="state">
        <p className="pane-note">
          The dq current equations at {num(x.machine.omegaE / (2 * Math.PI), 'Hz')} electrical. Linear, so exact.
        </p>
        <table className="matrix">
          <tbody>
            {s.A.map((row, i) => (
              <tr key={i}>
                <th>{s.states[i]}</th>
                {row.map((v, j) => (
                  <td key={j}>{num(v, '', 5)}</td>
                ))}
                <td className="affine">{num(s.c[i], '', 5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <table className="matrix">
        <tbody>
          {dyn.A.map((row, i) => (
            <tr key={i}>
              <th>{names[i]}</th>
              {row.map((v, j) => (
                <td key={j}>{num(v, '', 5)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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

function Phasors({ x }) {
  if (x.kind === 'sync') {
    const p = x.phasor
    return (
      <PhasorCanvas
        arrows={[
          { label: 'V', re: p.V[0], im: p.V[1] },
          { label: 'E', re: p.E[0], im: p.E[1] },
          { label: 'I', re: p.I[0] * 10, im: p.I[1] * 10 },
        ]}
      />
    )
  }
  const ac = x.ac
  const pick = (id) => ac.v[id] || [0, 0]
  return (
    <PhasorCanvas
      arrows={[
        { label: 'V primary', re: pick('p')[0], im: pick('p')[1] },
        { label: 'V load', re: (ac.v[x.net.outNode] || [0, 0])[0], im: (ac.v[x.net.outNode] || [0, 0])[1] },
        { label: 'I load', re: ac.i.RL[0] * 6, im: ac.i.RL[1] * 6 },
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
  const meters = x.error ? null : x.sol || null

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
            {x.error ? x.error.message : readings(x)[0] ? `${readings(x)[0].label}: ${readings(x)[0].value}` : ''}
          </span>
        </header>

        {draw && (
          <Schematic elements={draw.elements} layout={draw.layout} meters={meters} show="i" className="machine" />
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
            {x.runUp && <span className="readout">{x.runUp.says}</span>}
          </div>
          {x.error ? <div className="pane error">{x.error.message}</div> : <View view={view} x={x} />}
        </div>
      </main>
    </div>
  )
}
