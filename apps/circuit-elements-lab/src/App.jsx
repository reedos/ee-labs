import React, { useMemo, useState } from 'react'
import { LabNav, NumField, ReportIssue, Schematic, fmt } from '@ee-labs/ui'
import { MathPanel } from '@ee-labs/explain'
import { equations, normalize } from '@ee-labs/network'
import { EXPERIMENTS, GROUPS, byId, defaultsOf, drawables } from './experiments.js'
import { analyse, experimentMath } from './math.js'
import { termsFor } from './terms.js'
import { reportSummary } from './report.js'
import { EquationsPane, PowerPane, TheveninPane, SuperpositionPane, Refusal } from './components/panes.jsx'
import SweepCanvas from './components/SweepCanvas.jsx'
import pkg from '../package.json'

const FIRST = EXPERIMENTS[0].id

const VIEW_LABELS = {
  equations: { label: 'Equations', title: 'The KCL rows and constraints the solver built, with live values' },
  power: { label: 'Power', title: 'Power in every element under the passive sign convention' },
  thevenin: { label: 'Thévenin', title: 'The equivalent seen at the port, found three ways' },
  superposition: { label: 'Superposition', title: 'Each source alone, and the sum' },
  sweep: { label: 'Load sweep', title: 'The port quantity as the load resistance sweeps' },
}

export default function App() {
  const [id, setId] = useState(FIRST)
  const [params, setParams] = useState(() => defaultsOf(FIRST))
  const [show, setShow] = useState(byId[FIRST].show)
  const [view, setView] = useState(byId[FIRST].view)
  // Whether the note still describes what is on screen: any knob moved by hand
  // retires it, as in the other labs. The schematic/view toggles are exempt.
  const [pristine, setPristine] = useState(true)
  const [openGroups, setOpenGroups] = useState(() => new Set())

  const exp = byId[id]

  const choose = (next) => {
    setId(next)
    setParams(defaultsOf(next))
    setShow(byId[next].show)
    setView(byId[next].view)
    setPristine(true)
  }
  const setParam = (key, value) => {
    setParams((p) => ({ ...p, [key]: value }))
    setPristine(false)
  }

  const x = useMemo(() => analyse(exp, params), [exp, params])
  const eq = useMemo(() => {
    try {
      return x.sol ? equations(x.sol.norm, x.sol) : equations(normalize(x.net))
    } catch {
      return null
    }
  }, [x])
  const math = useMemo(() => experimentMath(exp, params, x), [exp, params, x])
  const elements = useMemo(() => drawables(x.net), [x])
  const meters = x.sol ? { v: x.sol.v, i: x.sol.i, volt: x.sol.volt, p: x.sol.p } : null

  const nodeCount = x.sol ? x.sol.norm.n : normalize(x.net).n
  const outcome = x.sol
    ? `KCL holds at every node, largest residual ${fmt(x.sol.maxResidual, 'A', 2)}`
    : `refused: ${x.refusal.code}`

  const viewOptions = exp.views.map((v) => ({ id: v, ...VIEW_LABELS[v] }))
  const currentView = exp.views.includes(view) ? view : exp.view

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <LabNav current="circuit-elements-lab" currentLabel="Elements" />
          <h1>Circuit Elements Lab</h1>
          <p className="sub">
            Circuits from the two laws up. Every number on the schematic is solved, every equation is
            the one the solver used, and every claim in a note is measured.
          </p>
          <ReportIssue
            lab="Circuit Elements Lab"
            version={pkg.version}
            state={{ id, params, show, view: currentView }}
            summary={reportSummary({ id, params, show, view: currentView, outcome })}
          />
        </header>

        <section>
          <h2>Experiments</h2>
          {GROUPS.map((g) => {
            const inGroup = EXPERIMENTS.filter((e) => e.group === g)
            return (
              <FoldGroup
                key={g}
                sectionKey={g}
                label={g}
                holdsActive={inGroup.some((e) => e.id === id)}
                openGroups={openGroups}
                setOpenGroups={setOpenGroups}
              >
                {inGroup.map((e) => (
                  <button
                    type="button"
                    key={e.id}
                    className={`preset${e.id === id ? ' is-on' : ''}`}
                    onClick={() => choose(e.id)}
                  >
                    {e.name}
                  </button>
                ))}
              </FoldGroup>
            )
          })}
          <h3 className="note-title">
            {exp.id.toUpperCase()} · {exp.name}
          </h3>
          <p className="hint" data-role="note" data-pristine={pristine}>
            {exp.note}
            {pristine ? null : (
              <em className="prov"> — the note describes the defaults; you have moved away from them.</em>
            )}
          </p>
          {termsFor(exp.terms).length ? (
            <details className="terms">
              <summary>Terms used here</summary>
              <dl>
                {termsFor(exp.terms).map((t) => (
                  <React.Fragment key={t.id}>
                    <dt>{t.name}</dt>
                    <dd>{t.def}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </details>
          ) : null}
        </section>

        <section>
          <h2>Knobs</h2>
          {exp.params.map((p) => (
            <NumField
              key={p.key}
              label={p.label}
              unit={p.unit}
              value={params[p.key]}
              onChange={(v) => setParam(p.key, v)}
              min={p.min}
              max={p.max}
              scale={p.scale}
              hint={p.hint}
              eng
            />
          ))}
          <MathPanel entry={math} />
        </section>
      </aside>

      <div className="topbar">
        <nav className="flow" aria-label="Experiment summary">
          <span className="flow-node">
            {exp.id.toUpperCase()}
            <em>{exp.name}</em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span className="flow-node">
            {nodeCount} node{nodeCount === 1 ? '' : 's'}
            <em>
              {eq ? `${eq.unknowns.length} unknown${eq.unknowns.length === 1 ? '' : 's'}` : 'no system'}
            </em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span className={`flow-node ${x.sol ? 'is-out' : 'is-off'}`} data-role="outcome">
            {x.sol ? 'solved' : 'no solution'}
            <em>{x.sol ? `KCL residual ${fmt(x.sol.maxResidual, 'A', 2)}` : x.refusal.code}</em>
          </span>
        </nav>
        <div className="topbar-controls">
          {x.sol ? (
            <span className="topbar-field">
              <span>Σ power</span>
              <b>{fmt(x.sol.pTotal, 'W', 2)}</b>
            </span>
          ) : null}
        </div>
      </div>

      <main className="views">
        <section className="view">
          <div className="view-head">
            <h2>Schematic, with meters</h2>
            <div className="segmented sm" role="group" aria-label="What the meters read">
              {[
                ['i', 'currents', 'Current through each element, arrow in the direction it flows'],
                ['v', 'voltages', 'Voltage across each element, + marks the reference end'],
                ['p', 'powers', 'Power in each element: positive absorbs, negative delivers'],
                ['none', 'none', 'Just the circuit'],
              ].map(([k, label, title]) => (
                <button
                  key={k}
                  type="button"
                  className={show === k ? 'on' : ''}
                  aria-pressed={show === k}
                  title={title}
                  onClick={() => setShow(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="readout">
              {x.sol ? (
                Object.entries(x.sol.v)
                  .filter(([n]) => n !== 'gnd')
                  .map(([n, v]) => (
                    <span key={n}>
                      v_{n} <b>{fmt(v, 'V', 4)}</b>
                    </span>
                  ))
              ) : (
                <span className="flag warn">the solver refused — see below</span>
              )}
            </div>
          </div>
          <div className="view-body">
            {/* "none" promises just the circuit, so it drops the node voltages too. */}
            <Schematic className="big" elements={elements} layout={exp.layout} meters={show === 'none' ? null : meters} show={show} />
            {x.refusal ? <Refusal err={x.refusal} /> : null}
          </div>
        </section>

        <section className="view">
          <div className="view-head">
            <h2>Underneath</h2>
            <ViewSwitch value={currentView} onChange={setView} options={viewOptions} />
            <div className="readout">
              {currentView === 'thevenin' && x.thevenin ? (
                <>
                  <span>
                    V_oc <b>{fmt(x.thevenin.voc, 'V', 4)}</b>
                  </span>
                  <span>
                    R_th <b>{fmt(x.thevenin.rth.test, 'Ω', 4)}</b>
                  </span>
                </>
              ) : null}
              {currentView === 'sweep' && x.sweep ? (
                <>
                  <span>
                    {exp.sweepId} now <b>{fmt(params[exp.sweepId], 'Ω', 3)}</b>
                  </span>
                  {exp.sweepY === 'p' ? (
                    <span>
                      peak <b>{fmt(x.sweep.pMax, 'W', 3)}</b>
                      <em className="prov"> near {fmt(x.sweep.rOpt, 'Ω', 3)}</em>
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          <div className="view-body">
            {currentView === 'equations' && eq ? <EquationsPane eq={eq} solved={!!x.sol} /> : null}
            {currentView === 'power' && x.sol ? <PowerPane sol={x.sol} /> : null}
            {currentView === 'thevenin' && x.thevenin ? <TheveninPane th={x.thevenin} port={exp.port} /> : null}
            {currentView === 'superposition' && x.superposition ? <SuperpositionPane sp={x.superposition} /> : null}
            {currentView === 'sweep' && x.sweep ? (
              <SweepCanvas
                points={x.sweep.points}
                y={exp.sweepY || 'p'}
                at={params[exp.sweepId]}
                rth={x.thevenin ? x.thevenin.rth.test : null}
                efficiency={!!exp.sweepEfficiency}
              />
            ) : null}
            {!x.sol && currentView !== 'equations' ? (
              <p className="hint">Nothing to show until the circuit has a solution.</p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}

/** Which view a pane is showing — Signal Lab's ViewSwitch, copied. */
function ViewSwitch({ value, onChange, options }) {
  return (
    <div className="segmented sm view-switch" role="group" aria-label="View shown in this pane">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={value === o.id ? 'on' : ''}
          aria-pressed={value === o.id}
          title={o.title}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * One foldable sidebar group — Circuit Lab's FoldGroup, copied. The group
 * holding the active experiment cannot be folded, so where-you-are survives
 * any amount of tidying; the refusal happens on the summary click because the
 * browser folds a <details> before React hears about it.
 */
function FoldGroup({ sectionKey, label, holdsActive, openGroups, setOpenGroups, children }) {
  return (
    <details
      className="preset-group"
      open={holdsActive || openGroups.has(sectionKey)}
      onToggle={(e) => {
        const next = new Set(openGroups)
        if (e.target.open) next.add(sectionKey)
        else next.delete(sectionKey)
        setOpenGroups(next)
      }}
    >
      <summary onClick={(e) => holdsActive && e.preventDefault()}>
        {label}
        {holdsActive ? <span className="group-active-dot" aria-hidden="true" /> : null}
      </summary>
      <div className="presets">{children}</div>
    </details>
  )
}
