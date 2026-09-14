import React, { useMemo, useRef, useState } from 'react'
import { LabNav, NumField, ReportIssue, Schematic, fmt } from '@ee-labs/ui'
import { MathBody } from '@ee-labs/explain'
import { EXPERIMENTS, GROUPS, byId, defaultsOf, drawables, isDynamic, viewLabel } from './experiments.js'
import { readQuantity } from './lessons.js'
import { analyse, experimentMath, refusalReason } from './math.js'
import { num } from './format.js'
import { firstUses } from './glossary.js'
import { DefCard, Marked, TermChips } from './components/Prose.jsx'
import Pane from './components/panes.jsx'
import { reportSummary } from './report.js'
import Practice from './components/Practice.jsx'

/**
 * The lab, assembled.
 *
 * The shape is Circuit Elements Lab's, because a reader who has learnt one lab
 * has learnt them all: the sidebar holds the nav, the experiment picker, the
 * knobs, the note in its three registers and the math panel, and the main
 * column holds the topbar meters, the schematic, and one pane under a view
 * switch. Nothing here computes physics. `analyse` solves the experiment and
 * every number on screen is read out of what it returns, by the same
 * `readQuantity` paths the tests check the prose against.
 */

/**
 * A group's subject, without its letter, for the sidebar's one line.
 *
 * The line reads off `GROUPS`, so it follows the lab rather than describing a
 * version of it. A sentence beside a list that the list has outgrown is the
 * first item of the review playbook.
 */
const subjectOf = (group) => {
  const name = group.replace(/^[A-Z]\s*·\s*/, '')
  return name.charAt(0).toLowerCase() + name.slice(1)
}

export default function App() {
  const [id, setId] = useState(EXPERIMENTS[0].id)
  const exp = byId[id]
  const [params, setParams] = useState(() => defaultsOf(EXPERIMENTS[0].id))
  const [view, setView] = useState('start')
  const [cursor, setCursor] = useState(null)
  const [step, setStep] = useState(0)
  const [open, setOpen] = useState(null)
  const [overlayMode, setOverlayMode] = useState(exp.show)
  const [pickerOpen, setPickerOpen] = useState(false)
  const drawing = useRef(null)
  const [drawingOpen, setDrawingOpen] = useState(false)
  const index = EXPERIMENTS.indexOf(exp)

  const x = useMemo(() => analyse(exp, params, cursor ?? undefined), [exp, params, cursor])
  const math = useMemo(() => experimentMath(exp, params, x), [exp, params, x])
  const marks = useMemo(() => firstUses(exp), [exp])

  /** Load an experiment: its own defaults, its own opening view, its own overlay. */
  const choose = (nextId) => {
    const next = byId[nextId]
    setId(nextId)
    setParams(defaultsOf(nextId))
    setView('start')
    setOverlayMode(next.show)
    setCursor(null)
    setStep(0)
    setOpen(null)
    setPickerOpen(false)
  }
  const set = (key, value) => setParams((p) => ({ ...p, [key]: value }))
  /** A try step: its settings, and the cursor it asks for. */
  const doStep = (k) => {
    const t = exp.try[k]
    setParams({ ...defaultsOf(id), ...(t.set || {}) })
    setCursor(t.at ?? null)
    setStep(k + 1)
  }

  const headline = x.sol ? readQuantity(x, params, exp.headline.path, exp) : null
  const overlay = useMemo(() => {
    // What an AC meter reads is measured here, not in the renderer: the
    // small-signal netlist's own solve at the experiment's frequency.
    if (!x.ac) return { mode: overlayMode, v: {} }
    return { mode: overlayMode, v: x.ac.v }
  }, [x, overlayMode])

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <LabNav current="electronics-lab" currentLabel="Electronics" />
          <h1>Electronics Lab</h1>
          <p className="sub">
            {EXPERIMENTS.length} experiments in {GROUPS.length} groups, from {subjectOf(GROUPS[0])} to{' '}
            {subjectOf(GROUPS[GROUPS.length - 1])}.
          </p>
        </header>

        <section className="picker">
          <div className="picker-row">
            <button className="picker-step" aria-label="Previous experiment" disabled={index === 0} onClick={() => choose(EXPERIMENTS[index - 1].id)}>◂</button>
            <button className="picker-current" aria-expanded={pickerOpen} aria-controls="experiment-catalog" onClick={() => setPickerOpen(!pickerOpen)}>
              <b>{id.toUpperCase()}</b><span>{exp.name}</span><i>▾</i>
            </button>
            <button className="picker-step" aria-label="Next experiment" disabled={index === EXPERIMENTS.length - 1} onClick={() => choose(EXPERIMENTS[index + 1].id)}>▸</button>
          </div>
          <p className="picker-arc">Experiment {index + 1} of {EXPERIMENTS.length}</p>
          <div id="experiment-catalog" className="picker-list" hidden={!pickerOpen}>
          {GROUPS.map((g) => (
            <div className="preset-group" key={g}>
              <h2>{g}</h2>
              <div className="presets">
                {EXPERIMENTS.filter((e) => e.group === g).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className={`preset${e.id === id ? ' is-on' : ''}`}
                    data-exp={e.id}
                    aria-pressed={e.id === id}
                    onClick={() => choose(e.id)}
                  >
                    {e.id.toUpperCase()} · {e.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          </div>
        </section>

        <section className="lesson" data-role="note">
          <h2>{exp.name}</h2>
          <p className="hint">At the starting settings:</p>
          <p className="hint see">
            <Marked text={exp.see} marks={marks.see || []} field="see" open={open} onOpen={setOpen} />
          </p>
          <TermChips ids={marks.unplaced || []} field="see" open={open} onOpen={setOpen} />
          <DefCard open={open} field="see" exp={exp} onClose={() => setOpen(null)} choose={choose} />
          <ol className="try">
            {exp.try.map((t, k) => (
              <li key={k} data-state={k < step ? 'done' : k === step ? 'active' : 'ahead'}>
                <span className="step-n">{k + 1}</span>
                <span className="step-body">
                  <button type="button" className="step-seen" onClick={() => doStep(k)}>
                    <Marked text={t.say} marks={marks[`try.${k}`] || []} field={`try.${k}`} open={open} onOpen={setOpen} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <details className="deeper-fold">
            <summary>Why this happens</summary>
            <div className="why">
              <p className="hint">
                <Marked text={exp.why} marks={marks.why || []} field="why" open={open} onOpen={setOpen} />
              </p>
              <DefCard open={open} field="why" exp={exp} onClose={() => setOpen(null)} choose={choose} />
            </div>
          </details>
        </section>

        <section className="knobs" id="knobs">
          <h2>Settings</h2>
          <div className="knob-list">
            {exp.params.map((k) => (
              <div className="knob-slot" key={k.key} data-open={String(!!k.presets)}>
                <Knob knob={k} value={params[k.key]} onChange={(v) => set(k.key, v)} />
              </div>
            ))}
          </div>
        </section>

        <ReportIssue lab="Electronics Lab" state={{ experiment: exp.id, view }} summary={reportSummary(exp, params, x, headline)} />
      </aside>

      <div className="topbar">
        <div className="flow">
          <span data-role="outcome">
            <b>{exp.headline.label}</b>{' '}
            {headline == null ? refusalReason(x.refusal) : typeof headline === 'string' ? headline : num(headline, exp.headline.unit)}
            {x.label ? <em>{x.label}</em> : null}
          </span>
        </div>
      </div>

      <main className="views">
        <section className="view">
          <div className="view-head">
            <h2>Schematic, with meters</h2>
            <button className="drawing-enlarge" onClick={() => { setDrawingOpen(true); drawing.current.showModal() }}>Enlarge drawing</button>
            <div className="segmented sm" role="group" aria-label="Which circuit the meters read">
              {[
                ['dc', 'DC', 'The operating point: what a meter reads with no signal applied'],
                ['ac', 'signal', 'The signal amplitude at each node, from the small-signal netlist'],
                ['both', 'both', 'The bias and the signal it carries, written as the sum they are'],
              ].map(([k, label, title]) => (
                <button
                  key={k}
                  type="button"
                  className={overlayMode === k ? 'on' : ''}
                  aria-pressed={overlayMode === k}
                  // An experiment with no small-signal netlist has no signal to
                  // draw, and a button that promises one would be lying.
                  disabled={k !== 'dc' && !x.ac}
                  title={k !== 'dc' && !x.ac ? 'This experiment has no small-signal netlist: there is no signal to read.' : title}
                  onClick={() => setOverlayMode(k)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="view-body" data-show="v">
            <Schematic className="big" elements={drawables(exp, params)} layout={exp.layout} meters={x.sol} show="v" overlay={overlay} />
          </div>
          <dialog ref={drawing} className="drawing-dialog" aria-labelledby="drawing-title" onClose={() => setDrawingOpen(false)}>
            <div className="drawing-dialog-head"><h2 id="drawing-title">{id.toUpperCase()} · {exp.name}</h2><button autoFocus onClick={() => drawing.current.close()}>Close drawing</button></div>
            <p>Scroll horizontally to inspect the circuit labels and meters.</p>
            {drawingOpen && <div className="drawing-scroll"><Schematic elements={drawables(exp, params)} layout={exp.layout} meters={x.sol} show="v" overlay={overlay} /></div>}
          </dialog>
        </section>

        <section className="view analysis-view">
          <div className="view-head analysis-head">
            <div className="segmented sm" role="group" aria-label="Which view the pane shows">
              {['start', 'worked', ...exp.views].map((v) => (
                <button key={v} type="button" className={view === v ? 'on' : ''} aria-pressed={view === v} title={viewLabel(v).title} onClick={() => setView(v)}>
                  {viewLabel(v).label}
                </button>
              ))}
            </div>
            {isDynamic(exp) && x.tr ? (
              <label className="readout cursor-knob">
                cursor
                <input
                  type="range"
                  min={0}
                  max={x.tEnd}
                  step={x.tEnd / 600}
                  value={x.cursor}
                  onChange={(e) => setCursor(+e.target.value)}
                  aria-label="Move the time cursor"
                />
                <b>{fmt(x.cursor, 's', 3)}</b>
              </label>
            ) : null}
          </div>
          <div className={`view-body${['start', 'worked'].includes(view) ? ' lesson-body' : ''}`}>
            {view === 'start' ? <section className="opening-lesson">
              <h2>{exp.name}</h2>
              <p className="hint">At the starting settings:</p>
              <p>{exp.see}</p>
              <Practice key={`${id}:${JSON.stringify(params)}:${cursor}`} entry={math} />
              <h3>Investigate</h3>
              <p>Predict the change before applying each setting. Compare the meters and the selected analysis view, then explain the result using the worked math.</p>
              <ol>{exp.try.map((t, k) => <li key={k}><p>{t.say}</p><button className="step-seen" onClick={() => doStep(k)}>Apply step {k + 1}</button></li>)}</ol>
              <h3>Why it happens</h3><p>{exp.why}</p>
              <p>Preparation: Circuit Elements teaches circuit laws, storage and phasors. Its diode extension includes <a href="../circuit-elements-lab/#i9">clamping</a> and <a href="../circuit-elements-lab/#i10">voltage doubling</a>.</p>
            </section> : view === 'worked' ? <>
              <h2>Worked math · {exp.name}</h2>
              <details className="route-guide"><summary>Choose an analysis route and read its limits</summary>
                <p><b>Bias first.</b> Reading and Equations find the operating point: node voltages and branch currents with the selected DC sources. KCL and source constraints support the algebraic route. For nonlinear devices, a numerical operating-point search is needed before solving the local linear equations.</p>
                {exp.signal && <p><b>Small-signal route.</b> Linearize around the bias to obtain gain, poles and frequency response. This makes loading and bandwidth easier to calculate, but only for perturbations that stay near that operating point. It does not predict clipping or large-signal transitions.</p>}
                {exp.window && <p><b>Time route.</b> Scope follows the implemented transient model and its initial conditions. It reveals changing voltages and modelled limits that a steady-state gain cannot show. Check the model label before treating the waveform as a transistor-level transient prediction.</p>}
                <p><b>Compare like quantities.</b> A DC voltage, a signal amplitude and a total waveform answer different questions. Use the same source, reference direction, units and model when checking one route against another.</p>
              </details>
              {math ? <MathBody entry={math} /> : <p>The current model has no worked result at these settings. Check the model limits and readings before interpreting the equations.</p>}
            </> : <Pane view={view} x={x} />}
          </div>
        </section>
      </main>
    </div>
  )
}

/** One knob: a number with its units and chips, a toggle, or a choice. */
function Knob({ knob, value, onChange }) {
  if (knob.kind === 'toggle') {
    return (
      <div className="toggle-knob">
        <span className="num-label">{knob.label}</span>
        <div className="segmented" role="group" aria-label={knob.label}>
          <button type="button" aria-pressed={!!value} onClick={() => onChange(true)}>
            {knob.on}
          </button>
          <button type="button" aria-pressed={!value} onClick={() => onChange(false)}>
            {knob.off}
          </button>
        </div>
      </div>
    )
  }
  if (knob.kind === 'choice') {
    return (
      <div className="toggle-knob">
        <span className="num-label">{knob.label}</span>
        <div className="segmented" role="group" aria-label={knob.label}>
          {knob.options.map((o) => (
            <button key={String(o.value)} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    )
  }
  return (
    <NumField
      label={knob.label}
      value={value}
      onChange={onChange}
      min={knob.min}
      max={knob.max}
      scale={knob.scale}
      unit={knob.unit}
      hint={knob.hint}
      presets={knob.presets}
      eng
    />
  )
}
