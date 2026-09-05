import React, { useEffect, useMemo, useState } from 'react'
import { LabNav, LessonNav, NumField, ReportIssue, TryLine } from '@ee-labs/ui'
import { EXPERIMENTS, GROUPS, VIEW_LABELS, VIEW_ORDER, byId, defaultsOf, signalsOf, bussesOf } from './experiments.js'
import { analyse, quantitiesOf } from './analysis.js'
import { TERMS } from './terms.js'
import { reportSummary } from './report.js'
import { time, num } from './format.js'
import { BudgetPane, ControlTable, CountsPane, PathList, ProgramPane, Refusal, TracePane, printed } from './components/panes.jsx'
import DatapathCanvas from './components/DatapathCanvas.jsx'
import ScheduleCanvas from './components/ScheduleCanvas.jsx'
import CacheCanvas from './components/CacheCanvas.jsx'
import TimingCanvas from './components/TimingCanvas.jsx'
import StateCanvas from './components/StateCanvas.jsx'
import pkg from '../package.json'

// The shell. One experiment at a time: its machine runs once (analysis.js's
// `analyse`), and every pane below reads that one result, so the datapath
// view, the schedule and the topbar can never disagree about a cycle.
//
// Layout follows the plan (§4.1): a sidebar with the lesson and its knobs, a
// topbar of headline numbers, the experiment's own first pane always on
// screen, and one pane below it with a switch over the rest of the views the
// group needs.

const FIRST = EXPERIMENTS[0].id

/** Where the cursor sits, for the experiments that have one. */
const cursorOf = (exp, p) => (p.cycle != null ? p.cycle : p.step != null ? p.step : 0)

export default function App() {
  const [id, setId] = useState(FIRST)
  const [params, setParams] = useState(() => defaultsOf(FIRST))
  const [view, setView] = useState(byId[FIRST].view)
  const [openGroups, setOpenGroups] = useState(() => new Set())
  const [openTerm, setOpenTerm] = useState(null)
  const [pinned, setPinned] = useState([])
  const [zoom, setZoom] = useState('full')

  const exp = byId[id]
  const idx = EXPERIMENTS.indexOf(exp)
  const prev = EXPERIMENTS[idx - 1]
  const next = EXPERIMENTS[idx + 1]
  const defaults = useMemo(() => defaultsOf(id), [id])
  const dirty = useMemo(() => Object.keys(defaults).some((k) => params[k] !== defaults[k]), [params, defaults])

  const choose = (nextId) => {
    setId(nextId)
    setParams(defaultsOf(nextId))
    setView(byId[nextId].view)
    setOpenTerm(null)
    setPinned([])
  }

  useEffect(() => {
    const aside = document.querySelector('.controls')
    if (aside) aside.scrollTop = 0
  }, [id])

  const x = useMemo(() => analyse(exp, params), [exp, params])
  const currentView = exp.views.includes(view) ? view : exp.view
  const viewOptions = VIEW_ORDER.filter((v) => exp.views.includes(v)).map((v) => ({ id: v, ...VIEW_LABELS[v] }))
  const readings = quantitiesOf(x)
  const cursor = cursorOf(exp, params)

  const setParam = (key, value) => setParams((p) => ({ ...p, [key]: value }))
  const applyStep = (t) => setParams((p) => ({ ...p, ...(t.set || {}) }))

  const pane = (which) => <Pane which={which} x={x} exp={exp} params={params} cursor={cursor} pinned={pinned} onPin={togglePin} zoom={zoom} />
  const togglePin = (name) => setPinned((list) => (list.includes(name) ? list.filter((n) => n !== name) : [...list, name]))

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <LabNav current="computer-lab" currentLabel="Computer" />
          <h1>Computer Lab</h1>
          <p className="sub">A processor built from the Logic Lab’s gates, exact to the cycle.</p>
          <ReportIssue lab="Computer Lab" version={pkg.version} state={{ id, params, view: currentView }} summary={reportSummary(exp, params, x, currentView)} />
        </header>

        <section className="lesson">
          <h2>
            Experiment
            <span className="h2-aside">
              {idx + 1} of {EXPERIMENTS.length}
            </span>
          </h2>
          <LessonNav index={idx} total={EXPERIMENTS.length} onPrev={() => prev && choose(prev.id)} onNext={() => next && choose(next.id)} onReset={() => setParams(defaults)} dirty={dirty} noun="experiment" />
          <div className="picker-groups">
            {GROUPS.map((g) => {
              const inGroup = EXPERIMENTS.filter((e) => e.group === g)
              const holdsActive = inGroup.some((e) => e.id === id)
              return (
                <details
                  key={g}
                  className="preset-group"
                  open={holdsActive || openGroups.has(g)}
                  onToggle={(e) => {
                    const set = new Set(openGroups)
                    if (e.target.open) set.add(g)
                    else set.delete(g)
                    setOpenGroups(set)
                  }}
                >
                  <summary onClick={(e) => holdsActive && e.preventDefault()}>
                    {g}
                    {holdsActive ? <span className="group-active-dot" aria-hidden="true" /> : null}
                  </summary>
                  <div className="presets">
                    {inGroup.map((e) => (
                      <button key={e.id} type="button" className={`preset${e.id === id ? ' is-on' : ''}`} title={`${e.id.toUpperCase()} · ${e.name}`} onClick={() => choose(e.id)}>
                        <b>{e.id.toUpperCase()}</b> {e.name}
                      </button>
                    ))}
                  </div>
                </details>
              )
            })}
          </div>

          <h3 className="note-title">{exp.name}</h3>
          <p className="hint see" data-role="see">
            {exp.see}
          </p>

          <div className="terms" data-role="terms">
            <h4>Terms</h4>
            <div className="term-chips">
              {exp.terms.map((t) => (
                <button key={t} type="button" className={`chip${openTerm === t ? ' is-on' : ''}`} aria-expanded={openTerm === t} onClick={() => setOpenTerm(openTerm === t ? null : t)}>
                  {TERMS[t] ? TERMS[t].name : t}
                </button>
              ))}
            </div>
            {openTerm && TERMS[openTerm] ? (
              <div className="def-card">
                <div className="def-head">
                  <b>{TERMS[openTerm].name}</b>
                  <button type="button" className="def-close" onClick={() => setOpenTerm(null)} aria-label="Close">
                    &times;
                  </button>
                </div>
                <p>{TERMS[openTerm].def}</p>
              </div>
            ) : null}
          </div>

          <div className="try-list" data-role="try">
            <h4>Try</h4>
            {exp.try.map((t, i) => (
              <TryLine key={i} text={t.say} chips={t.set ? [{ label: 'apply' }] : []} onChip={() => applyStep(t)} />
            ))}
          </div>
        </section>

        <section className="knobs">
          <h2>Knobs</h2>
          <div className="knob-list">
            {exp.params.map((p) => (
              <div className="knob-slot" key={p.key}>
                <KnobField p={p} value={params[p.key]} onChange={(v) => setParam(p.key, v)} />
              </div>
            ))}
          </div>
        </section>

        <section className="deeper">
          <h2>Deeper</h2>
          <details className="deeper-fold">
            <summary>Why it works</summary>
            <p className="hint why" data-role="why">
              {exp.why}
            </p>
          </details>
        </section>
      </aside>

      <div className="topbar">
        <nav className="flow" aria-label="Experiment summary">
          <span className="flow-node">
            {exp.id.toUpperCase()}
            <em>{exp.name}</em>
          </span>
          {readings.slice(0, 3).map((r) => (
            <React.Fragment key={r.path}>
              <span className="flow-arrow" aria-hidden="true">
                &rarr;
              </span>
              <span className="flow-node is-out" data-role={r.path}>
                {printed(r)}
                <em>{r.label}</em>
              </span>
            </React.Fragment>
          ))}
        </nav>
        <div className="topbar-controls">
          {pinned.length ? (
            <span className="topbar-field" data-role="pinned">
              <span>pinned</span>
              <b>{pinned.map((name) => `${name} = ${wireValue(x, cursor, name)}`).join(', ')}</b>
            </span>
          ) : null}
          <span className="topbar-field" data-role="period">
            <span>period</span>
            <b>{time(x.timing.pipePeriod)}</b>
          </span>
        </div>
      </div>

      <main className="views">
        <section className="view">
          <div className="view-head">
            <h2>{VIEW_LABELS[exp.main].label}</h2>
            {exp.main === 'datapath' ? (
              <div className="segmented sm" role="group" aria-label="How much of the datapath to draw">
                <button type="button" className={zoom === 'full' ? 'on' : ''} aria-pressed={zoom === 'full'} onClick={() => setZoom('full')}>
                  every block
                </button>
                <button type="button" className={zoom === 'block' ? 'on' : ''} aria-pressed={zoom === 'block'} onClick={() => setZoom('block')}>
                  folded
                </button>
              </div>
            ) : null}
          </div>
          <div className="view-body">{pane(exp.main)}</div>
        </section>

        <section className="view">
          <div className="view-head">
            <h2>Analysis</h2>
            <ViewSwitch value={currentView} onChange={setView} options={viewOptions} />
          </div>
          <div className="view-body">{pane(currentView)}</div>
        </section>
      </main>
    </div>
  )
}

/** The value on a pinned wire at the cycle on screen. */
function wireValue(x, cycle, name) {
  const run = x.run || x.pipe
  if (!run || !run.trace || !run.trace.length) return '—'
  const t = run.trace[Math.min(cycle, run.trace.length - 1)]
  const v = t.wires ? t.wires[name] : null
  return v == null ? '—' : String(v)
}

/** Which component draws which view. One place, so the smoke test can use it too. */
export function Pane({ which, x, exp, params, cursor = 0, pinned = [], onPin = null, zoom = 'full' }) {
  switch (which) {
    case 'datapath':
      return x.run ? <DatapathCanvas run={x.run} cycle={cursor} pinned={pinned} onPin={onPin} zoom={zoom} /> : <Refusal refusal={{ code: 'no run', message: 'This experiment runs no program, so there is no datapath to draw.' }} />
    case 'schedule':
      return x.pipe ? <ScheduleCanvas run={x.pipe} cycle={cursor} /> : <Refusal refusal={{ code: 'no pipeline', message: 'This experiment does not run the five-stage machine.' }} />
    case 'cachemap':
      return x.cache ? <CacheCanvas cache={x.cache} step={cursor} /> : <Refusal refusal={{ code: 'no cache', message: 'This experiment reads no trace.' }} />
    case 'trace':
      return <TracePane x={{ ...x, step: cursor }} />
    case 'program':
      return <ProgramPane x={{ ...x, cycle: cursor }} />
    case 'budget':
      return <BudgetPane x={x} />
    case 'timing':
      return <TimingCanvas res={x.res} signals={signalsOf(exp, params)} busses={bussesOf(exp, params)} cursor={null} />
    case 'state':
      return x.machine ? <StateCanvas states={x.machine.states} edges={x.machine.edges} encoding={x.machine.encoding} active={x.q['text.state'] ? x.q['text.state'].value : null} outputs /> : null
    case 'paths':
      return <PathList x={x} />
    case 'control':
      return <ControlTable x={x} />
    case 'counts':
      return <CountsPane x={x} />
    default:
      throw new Error(`no pane draws the view "${which}"`)
  }
}

/** One knob: a two-position switch for a bit, a segmented control for a choice, else a numeric field. */
function KnobField({ p, value, onChange }) {
  if (p.kind === 'bit') {
    return (
      <div className="toggle-knob" data-key={p.key}>
        <span className="toggle-label">{p.label}</span>
        <div className="segmented sm" role="group" aria-label={p.label}>
          <button type="button" className={value === 0 ? 'on' : ''} aria-pressed={value === 0} onClick={() => onChange(0)}>
            {p.off}
          </button>
          <button type="button" className={value === 1 ? 'on' : ''} aria-pressed={value === 1} onClick={() => onChange(1)}>
            {p.on}
          </button>
        </div>
        {p.hint ? <p className="hint">{p.hint}</p> : null}
      </div>
    )
  }
  if (p.kind === 'choice') {
    return (
      <div className="toggle-knob" data-key={p.key}>
        <span className="toggle-label">{p.label}</span>
        <div className="segmented sm" role="group" aria-label={p.label}>
          {p.options.map((o) => (
            <button key={String(o.value)} type="button" className={value === o.value ? 'on' : ''} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        {p.hint ? <p className="hint">{p.hint}</p> : null}
      </div>
    )
  }
  return <NumField label={p.label} unit={p.unit} value={value} onChange={onChange} min={p.min} max={p.max} scale={p.scale} step={p.step} decimals={p.decimals} hint={p.hint} />
}

/** Which view the lower pane shows: a row of small buttons, one per view this experiment offers. */
function ViewSwitch({ value, onChange, options }) {
  return (
    <div className="segmented sm view-switch" role="group" aria-label="View shown in this pane">
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? 'on' : ''} aria-pressed={value === o.id} title={o.title} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export { num }
