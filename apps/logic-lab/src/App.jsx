import React, { useEffect, useMemo, useState } from 'react'
import { LabNav, LessonNav, NumField, ReportIssue, TryLine } from '@ee-labs/ui'
import { EXPERIMENTS, GROUPS, VIEW_LABELS, VIEW_ORDER, bussesOf, byId, defaultsOf, signalsOf } from './experiments.js'
import { analyse, valueOf } from './analysis.js'
import { TERMS } from './terms.js'
import { reportSummary } from './report.js'
import { ps } from './format.js'
import { EventTable, KarnaughMap, PathList, Refusal, TruthTable } from './components/panes.jsx'
import GateCanvas from './components/GateCanvas.jsx'
import TimingCanvas from './components/TimingCanvas.jsx'
import StateCanvas from './components/StateCanvas.jsx'
import pkg from '../package.json'

// The shell. One experiment at a time: its netlist runs once (analysis.js's
// `analyse`), and every pane below reads that one result, so the gate diagram,
// the timing trace and the topbar's numbers can never disagree.
//
// Layout follows the plan (§4.1): a sidebar with the lesson and its knobs, a
// topbar of headline numbers, the gate diagram always on screen, and one pane
// below it with a switch over the rest of the views a group needs.

const FIRST = EXPERIMENTS[0].id

/** Every arc of the state table, as the diagram draws them. */
const arcsOf = (x) => x.fsm.table.rows.map((r) => ({ from: r.state, to: r.next, label: `${x.fsm.table.inputs.map((s) => `${s} = ${r.in[s]}`).join(', ')}`, out: r.out }))

/**
 * The state the machine is in at the read line, by the code its flip-flops
 * hold there. The diagram lights that circle, so moving the cursor along the
 * timing diagram walks the machine.
 */
function stateNow(x, cursor) {
  const t = cursor ?? 0
  const bits = x.fsm.table.bits
  let code = 0
  for (let i = bits - 1; i >= 0; i--) code = code * 2 + valueOf(x, `q${i}`, t)
  return x.fsm.table.states.find((s) => x.fsm.table.code[s] === code) ?? null
}

/** The spans a view asks for, which (unlike signals and busses) are a function of the run, not the knobs. */
const spansOf = (e, x) => (typeof e.spans === 'function' ? e.spans(x) : e.spans || [])

export default function App() {
  const [id, setId] = useState(FIRST)
  const [params, setParams] = useState(() => defaultsOf(FIRST))
  const [view, setView] = useState(byId[FIRST].view)
  const [cursor, setCursor] = useState(null)
  const [openGroups, setOpenGroups] = useState(() => new Set())
  const [openTerm, setOpenTerm] = useState(null)

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
    setCursor(null)
    setOpenTerm(null)
  }

  useEffect(() => {
    const aside = document.querySelector('.controls')
    if (aside) aside.scrollTop = 0
  }, [id])

  const x = useMemo(() => analyse(exp, params), [exp, params])
  const currentView = exp.views.includes(view) ? view : exp.view
  const viewOptions = VIEW_ORDER.filter((v) => exp.views.includes(v)).map((v) => ({ id: v, ...VIEW_LABELS[v] }))

  const setParam = (key, value) => setParams((p) => ({ ...p, [key]: value }))
  const applyStep = (t) => {
    setParams((p) => ({ ...p, ...(t.set || {}) }))
    if (t.set) setCursor(null)
  }

  const gates = x.norm ? x.norm.gates.length : null
  const critical = x.paths ? x.paths.long.delay : null
  const events = x.res ? x.res.events.length : null

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <LabNav current="logic-lab" currentLabel="Logic" />
          <h1>Logic Lab</h1>
          <p className="sub">Digital logic on a discrete-event engine, exact to the picosecond.</p>
          <ReportIssue
            lab="Logic Lab"
            version={pkg.version}
            state={{ id, params, view: currentView, cursor }}
            summary={reportSummary(exp, params, x, currentView)}
          />
        </header>

        <section className="lesson">
          <h2>
            Experiment
            <span className="h2-aside">
              {idx + 1} of {EXPERIMENTS.length}
            </span>
          </h2>
          <LessonNav
            index={idx}
            total={EXPERIMENTS.length}
            onPrev={() => prev && choose(prev.id)}
            onNext={() => next && choose(next.id)}
            onReset={() => setParams(defaults)}
            dirty={dirty}
            noun="experiment"
          />
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
                      <button
                        key={e.id}
                        type="button"
                        className={`preset${e.id === id ? ' is-on' : ''}`}
                        title={`${e.id.toUpperCase()} · ${e.name}`}
                        onClick={() => choose(e.id)}
                      >
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
                <button
                  key={t}
                  type="button"
                  className={`chip${openTerm === t ? ' is-on' : ''}`}
                  aria-expanded={openTerm === t}
                  onClick={() => setOpenTerm(openTerm === t ? null : t)}
                >
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
          <span className="flow-arrow" aria-hidden="true">
            &rarr;
          </span>
          <span className="flow-node" data-role="gate-count">
            {gates == null ? '—' : `${gates} gate${gates === 1 ? '' : 's'}`}
            <em>{critical == null ? 'no timed path' : `critical path ${ps(critical)}`}</em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            &rarr;
          </span>
          <span className={`flow-node ${x.refusal ? 'is-off' : 'is-out'}`} data-role="outcome">
            {x.refusal ? 'declined' : 'settled'}
            <em>{x.refusal ? x.refusal.code : `${events} event${events === 1 ? '' : 's'}`}</em>
          </span>
        </nav>
        <div className="topbar-controls">
          <span className="topbar-field" data-role="delay-mode">
            <span>model</span>
            <b>{(x.norm && x.norm.delayMode) || 'transport'}</b>
          </span>
        </div>
      </div>

      <main className="views">
        <section className="view">
          <div className="view-head">
            <h2>Gate diagram</h2>
          </div>
          <div className="view-body">{x.norm ? <GateCanvas x={x} /> : <Refusal refusal={x.refusal} />}</div>
        </section>

        <section className="view">
          <div className="view-head">
            <h2>Analysis</h2>
            <ViewSwitch value={currentView} onChange={setView} options={viewOptions} />
          </div>
          <div className="view-body">
            {x.refusal && !x.norm ? (
              <Refusal refusal={x.refusal} />
            ) : (
              <>
                {currentView === 'timing' ? (
                  <>
                    <TimingCanvas
                      res={x.res}
                      signals={signalsOf(exp, params)}
                      busses={bussesOf(exp, params)}
                      spans={spansOf(exp, x)}
                      cursor={cursor}
                      onCursor={setCursor}
                    />
                    {x.res ? (
                      <div className="cursor-row" data-role="cursor">
                        <label htmlFor="cursor-slider">
                          reads at <b>{ps(cursor ?? 0)}</b>
                        </label>
                        <input
                          id="cursor-slider"
                          className="num-slider"
                          type="range"
                          min={0}
                          max={x.res.tEnd}
                          step={1}
                          value={cursor ?? 0}
                          onChange={(e) => setCursor(Number(e.target.value))}
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}
                {currentView === 'gates' ? <GateCanvas x={x} /> : null}
                {currentView === 'state' && x.fsm ? (
                  <StateCanvas
                    states={x.fsm.table.states}
                    edges={arcsOf(x)}
                    encoding={Object.fromEntries(x.fsm.table.states.map((st) => [st, x.fsm.table.code[st].toString(2).padStart(x.fsm.table.bits, '0')]))}
                    active={stateNow(x, cursor)}
                    outputs
                  />
                ) : null}
                {currentView === 'table' ? <TruthTable x={x} /> : null}
                {currentView === 'kmap' ? <KarnaughMap x={x} /> : null}
                {currentView === 'paths' ? <PathList x={x} /> : null}
                {currentView === 'events' ? <EventTable x={x} /> : null}
                {x.refusal ? <Refusal refusal={x.refusal} /> : null}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
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
  return (
    <NumField label={p.label} unit={p.unit} value={value} onChange={onChange} min={p.min} max={p.max} scale={p.scale} step={p.step} decimals={p.decimals} hint={p.hint} />
  )
}

/** Which view the lower pane shows — a row of small buttons, one per view this experiment offers. */
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
