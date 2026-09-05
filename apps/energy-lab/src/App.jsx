import React, { useMemo, useRef, useState } from 'react'
import { LabNav, LessonNav, NumField, ReportIssue, fmt } from '@ee-labs/ui'
import { MathBody } from '@ee-labs/explain'
import { EXPERIMENTS, GROUPS, GROUP_INTROS, VIEW_LABELS, byId, byGroup, defaultsOf, isPlot } from './experiments.js'
import { analyse } from './analysis.js'
import { experimentMath } from './math.js'
import { termsFor } from './terms.js'
import { guardsFor } from './guards.js'
import IVCanvas from './components/IVCanvas.jsx'
import StringCanvas from './components/StringCanvas.jsx'
import ScopeCanvas from './components/ScopeCanvas.jsx'
import DayCanvas from './components/DayCanvas.jsx'
import { ReadingPane, LedgerPane } from './components/panes.jsx'
import pkg from '../package.json'

const FIRST = EXPERIMENTS[0].id
const KNOBS_SHOWN = 4

// What the upper pane is a picture of. The lower pane is always the analysis,
// as it is in every other lab in the suite.
const PANE_TITLE = {
  cell: 'One cell',
  string: 'The string',
  track: 'The string, and the walk on it',
  buck: 'The string, into the converter',
  battery: 'The cell, against time',
  day: 'One bus, over a day',
}

/** A chip's text on the knob it names, in the knob's own units. */
function chipLabel(v, knob) {
  if (knob.percent) return `${+(v * 100).toFixed(1)} %`
  return fmt(v, knob.unit, 3)
}

/** Put the keyboard on a knob: open its fold, then focus its input. */
function focusKnob(key) {
  if (typeof document === 'undefined') return
  const el = document.querySelector(`[data-knob="${key}"]`)
  if (!el) return
  const fold = el.closest('details')
  if (fold && !fold.open) fold.open = true
  const input = el.querySelector('input, button')
  if (input) {
    input.focus()
    if (input.select) input.select()
    el.scrollIntoView({ block: 'nearest' })
  }
}

/** A two-position knob, in the segmented idiom the pane headers use. */
function ToggleField({ knob, value, onChange }) {
  return (
    <div className="num toggle-field">
      <div className="num-head">
        <span className="num-label">{knob.label}</span>
        <span className="num-hint">{knob.hint}</span>
      </div>
      <div className="segmented sm" role="group" aria-label={knob.label}>
        {[
          [false, knob.off],
          [true, knob.on],
        ].map(([v, text]) => (
          <button key={String(v)} type="button" className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

/** A knob with more than two named positions. */
function ChoiceField({ knob, value, onChange }) {
  return (
    <div className="num choice-field">
      <div className="num-head">
        <span className="num-label">{knob.label}</span>
        <span className="num-hint">{knob.hint}</span>
      </div>
      <div className="segmented sm" role="group" aria-label={knob.label}>
        {knob.options.map((o) => (
          <button key={String(o.value)} type="button" className={value === o.value ? 'on' : ''} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The sentences the models are not allowed to be read without: the reverse
 * branch's bound, the open-circuit fit's band, and the day's profiles named
 * as data. `guards.js` decides which apply; the pane only places them.
 */
function Guards({ x }) {
  const guards = guardsFor(x)
  if (!guards.length) return null
  return (
    <div className="guards">
      {guards.map((g) => (
        <p key={g.text.slice(0, 24)} className={`guard is-${g.level}`} data-role="guard">
          {g.text}
        </p>
      ))}
    </div>
  )
}

/** Which view a pane is showing — Signal Lab's switch, as the other labs carry it. */
function ViewSwitch({ value, onChange, options, label }) {
  return (
    <div className="segmented sm view-switch" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? 'on' : ''} aria-pressed={value === o.id} title={o.title} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Which instant of a battery run the meters read. The trace is already solved,
 * so scrubbing costs a lookup rather than a transient, and the ends are named
 * because a slider with no numbers on it says nothing about the window.
 */
function CursorRow({ x, onScrub }) {
  return (
    <div className="cursor-row" data-role="cursor">
      <div className="cursor-head">
        <label htmlFor="cursor-slider">
          <span className="cursor-lead">the meters read </span>the cell at <b>t = {fmt(x.cursor, 's', 4)}</b>
        </label>
        {Number.isFinite(x.tSwitch) ? <span className="cursor-note">constant current until {fmt(x.tSwitch, 's', 4)}, constant voltage after it</span> : null}
      </div>
      <input
        id="cursor-slider"
        className="num-slider"
        type="range"
        min={0}
        max={x.tEnd}
        step={x.tEnd / 600}
        value={Math.min(x.cursor, x.tEnd)}
        onChange={(e) => onScrub(Number(e.target.value))}
        aria-label="Cursor time"
      />
      <span className="cursor-ends" aria-hidden="true">
        <span>0</span>
        <span>{fmt(x.tEnd, 's', 3)}</span>
      </span>
    </div>
  )
}

/** The pane a view id renders, given the experiment and its analysis. */
function ViewBody({ view, exp, x }) {
  if (view === 'iv') return <IVCanvas exp={exp} x={x} mode="iv" />
  if (view === 'pv') return <IVCanvas exp={exp} x={x} mode="pv" />
  if (view === 'track') return <IVCanvas exp={exp} x={x} mode="pv" path={x.path} />
  if (view === 'string') return <StringCanvas x={x} />
  if (view === 'scope') return <ScopeCanvas x={x} />
  if (view === 'day') return <DayCanvas x={x} />
  if (view === 'ledger') return <LedgerPane exp={exp} x={x} />
  if (view === 'reading') return <ReadingPane exp={exp} x={x} />
  return null
}

/** The topbar's meters: what an exact solve gives, whatever the experiment is about. */
function Meters({ exp, x }) {
  if (x.kind === 'battery') {
    return (
      <>
        <span className="topbar-field"><span>OCV here</span><b>{fmt(x.ocv0, 'V', 4)}</b></span>
        <span className="topbar-field"><span>Terminal V</span><b>{fmt(x.at.v, 'V', 4)}</b></span>
        <span className="topbar-field"><span>Terminal I</span><b>{fmt(x.at.i, 'A', 4)}</b></span>
        <span className="topbar-field"><span>State of charge</span><b>{x.at.z.toFixed(4)}</b></span>
      </>
    )
  }
  if (x.kind === 'day') {
    return (
      <>
        <span className="topbar-field"><span>Peak array</span><b>{fmt(x.peakPv.pv, 'W', 4)}</b></span>
        <span className="topbar-field"><span>Peak load</span><b>{fmt(x.peakLoad.load, 'W', 4)}</b></span>
        <span className="topbar-field"><span>Bank, full</span><b>{fmt(x.g.bankE / 3.6e6, 'kWh', 3)}</b></span>
        <span className="topbar-field"><span>Served</span><b>{(x.served * 100).toFixed(2)} %</b></span>
      </>
    )
  }
  return (
    <>
      <span className="topbar-field"><span>V_oc</span><b>{fmt(x.fig.voc, 'V', 5)}</b></span>
      <span className="topbar-field"><span>I_sc</span><b>{fmt(x.fig.isc, 'A', 5)}</b></span>
      <span className="topbar-field"><span>Operating point</span><b>{fmt(x.at.v, 'V', 3)}, {fmt(x.at.i, 'A', 3)}</b></span>
      <span className="topbar-field"><span>P / P_mpp</span><b>{fmt(x.at.p, 'W', 4)} / {fmt(x.fig.pmpp, 'W', 4)}</b></span>
      <span className="topbar-field">
        <span>{exp.headline === 'ff' ? 'Fill factor' : 'Share of P_mpp'}</span>
        <b>{exp.headline === 'ff' ? x.fig.ff.toFixed(5) : `${(x.share * 100).toFixed(2)} %`}</b>
      </span>
    </>
  )
}

/** The picture views an experiment offers, and the panel views, in its own order. */
const plotsOf = (e) => e.views.filter(isPlot)
const panelsOf = (e) => e.views.filter((v) => !isPlot(v))
/** Which of each an experiment opens on: its own `view`, then the first of the kind. */
const openPlot = (e) => (isPlot(e.view) ? e.view : plotsOf(e)[0])
const openPanel = (e) => (isPlot(e.view) ? panelsOf(e)[0] : e.view)

export default function App({ initialId = FIRST, initialView = null, initialParams = null }) {
  const start = byId[initialId] ? initialId : FIRST
  const first = byId[start]
  const [id, setId] = useState(start)
  const [params, setParams] = useState(() => ({ ...defaultsOf(start), ...(initialParams || {}) }))
  // Two panes, so two view states. `initialView` sets whichever pane it belongs to.
  const [plotView, setPlotView] = useState(initialView && isPlot(initialView) ? initialView : openPlot(first))
  const [panelView, setPanelView] = useState(initialView && !isPlot(initialView) ? initialView : openPanel(first))
  const [pristine, setPristine] = useState(() => !initialParams)
  const seen = useRef(new Set())
  const [browsing, setBrowsing] = useState(null)

  const exp = byId[id]
  const idx = EXPERIMENTS.findIndex((e) => e.id === id)

  const choose = (next) => {
    seen.current.add(id)
    setId(next)
    setParams(defaultsOf(next))
    setPlotView(openPlot(byId[next]))
    setPanelView(openPanel(byId[next]))
    setPristine(true)
    setBrowsing(null)
  }
  const reset = () => {
    setParams(defaultsOf(id))
    setPristine(true)
  }
  const setParam = (key, value) => {
    setParams((p) => ({ ...p, [key]: value }))
    setPristine(false)
  }
  // The cursor picks which instant of a run the meters read. It changes no
  // circuit, so it does not make the note's own numbers stale, and it is not
  // one of the experiment's knobs.
  const setCursor = (t) => setParams((p) => ({ ...p, cursor: t }))
  const applyStep = (t) => {
    setParams((p) => ({ ...p, ...(t.set || {}), ...(t.at != null ? { cursor: t.at } : {}) }))
    if (Object.keys(t.set || {}).length) setPristine(false)
  }

  const x = useMemo(() => analyse(exp, params), [exp, params])
  const math = useMemo(() => experimentMath(exp, params, x), [exp, params, x])
  const plots = plotsOf(exp)
  const panels = panelsOf(exp)
  const currentPlot = plots.includes(plotView) ? plotView : plots[0]
  const currentPanel = panels.includes(panelView) ? panelView : panels[0]

  const knobField = (kb) => (
    <div className="knob" data-knob={kb.key} key={kb.key}>
      {kb.kind === 'toggle' ? (
        <ToggleField knob={kb} value={params[kb.key]} onChange={(v) => setParam(kb.key, v)} />
      ) : kb.kind === 'choice' ? (
        <ChoiceField knob={kb} value={params[kb.key]} onChange={(v) => setParam(kb.key, v)} />
      ) : (
        <NumField
          label={kb.label}
          unit={kb.unit}
          value={kb.percent ? params[kb.key] * 100 : params[kb.key]}
          onChange={(v) => setParam(kb.key, kb.percent ? v / 100 : v)}
          min={kb.percent ? kb.min * 100 : kb.min}
          max={kb.percent ? kb.max * 100 : kb.max}
          step={kb.percent ? kb.step * 100 : kb.step}
          decimals={kb.percent ? 1 : undefined}
          scale={kb.scale}
          hint={kb.hint}
          eng={!kb.percent}
        />
      )}
    </div>
  )
  const moreKnobs = exp.params.slice(KNOBS_SHOWN)
  const shownGroup = browsing || exp.group
  const showIntro = Boolean(browsing) || EXPERIMENTS.find((e) => e.group === exp.group).id === id
  const terms = termsFor(exp)

  const options = (list) => list.map((v) => ({ id: v, ...VIEW_LABELS[v] }))

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <LabNav current="energy-lab" currentLabel="Energy" />
          <h1>Energy Lab</h1>
          <p className="sub">Each experiment loads an array, a battery or a bus, names one knob, and states the number to read.</p>
        </header>

        <section>
          <h2 className="picker-cap">
            <span className="sr-only">Experiments</span>
            <span className="group-tabs" role="tablist" aria-label="Experiment groups">
              {GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  className={`group-tab${g === shownGroup ? ' is-shown' : ''}${g === exp.group ? ' is-here' : ''}`}
                  aria-selected={g === shownGroup}
                  onClick={() => setBrowsing(g === exp.group ? null : g)}
                >
                  {g}
                  {g === exp.group ? <span className="group-active-dot" aria-hidden="true" /> : null}
                </button>
              ))}
            </span>
          </h2>
          {showIntro ? <p className="hint group-intro">{GROUP_INTROS[shownGroup]}</p> : null}
          {byGroup.map(({ group, items }) => (
            <div key={group} className="presets" role="tabpanel" aria-label={group} hidden={group !== shownGroup}>
              {items.map((e) => (
                <button type="button" key={e.id} className={`preset${e.id === id ? ' is-on' : ''}`} onClick={() => choose(e.id)}>
                  {e.name}
                  {e.id === FIRST ? <span className="start-here">Start here</span> : null}
                </button>
              ))}
            </div>
          ))}
          <h3 className="note-title">{exp.name}</h3>
          <p className="hint" data-role="note" data-pristine={pristine}>
            {exp.see} {exp.why}
            {pristine ? null : (
              <>
                <em className="prov"> Some knobs have moved from the note's own settings.</em>{' '}
                <button type="button" className="chip reset" onClick={reset} title="Put every knob back to this experiment's defaults">
                  Reset
                </button>
              </>
            )}
          </p>
          <div className="try-steps">
            {exp.try.map((t, i) => (
              <p className="try" key={i}>
                <span className="try-label">Try</span> {t.say}{' '}
                <button type="button" className="chip" onClick={() => applyStep(t)} title="Set the knobs this step describes">
                  Apply
                </button>
              </p>
            ))}
          </div>
          <LessonNav index={idx} total={EXPERIMENTS.length} onPrev={() => idx > 0 && choose(EXPERIMENTS[idx - 1].id)} onNext={() => idx < EXPERIMENTS.length - 1 && choose(EXPERIMENTS[idx + 1].id)} onReset={reset} dirty={!pristine} noun="experiment" />
          {terms.length ? (
            <details className="terms" key={id}>
              <summary>Terms: {terms.map((t) => t.term).join(' · ')}</summary>
              <dl>
                {terms.map((t) => (
                  <React.Fragment key={t.key}>
                    <dt>{t.term}</dt>
                    <dd>{t.def}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </details>
          ) : null}
        </section>

        <section>
          <h2>Knobs</h2>
          {exp.params.slice(0, KNOBS_SHOWN).map(knobField)}
          {moreKnobs.length ? (
            <details className="more-knobs">
              <summary>More knobs ({moreKnobs.map((k) => k.label).join(', ')})</summary>
              {moreKnobs.map(knobField)}
            </details>
          ) : null}
        </section>

        <ReportIssue
          lab="Energy Lab"
          version={pkg.version}
          state={{ id, params, view: currentPlot, panel: currentPanel }}
          summary={{ Experiment: exp.name, Group: exp.group, View: VIEW_LABELS[currentPlot]?.label, Panel: VIEW_LABELS[currentPanel]?.label }}
        />
      </aside>

      <div className="topbar">
        <nav className="flow" aria-label="Experiment summary">
          <span className="flow-node is-name" title={exp.name}>{exp.name}</span>
        </nav>
        <div className="topbar-controls">
          <Meters exp={exp} x={x} />
        </div>
      </div>

      <main className="views">
        <section className="view">
          <div className="view-head">
            <h2>{PANE_TITLE[exp.kind] || exp.group}</h2>
            <ViewSwitch value={currentPlot} onChange={setPlotView} options={options(plots)} label="Picture shown" />
          </div>
          <div className="view-body">
            <ViewBody view={currentPlot} exp={exp} x={x} />
            {x.kind === 'battery' ? <CursorRow x={x} onScrub={setCursor} /> : null}
            <Guards x={x} />
          </div>
        </section>

        <section className="view">
          <div className="view-head">
            <h2>Analysis</h2>
            <ViewSwitch value={currentPanel} onChange={setPanelView} options={options(panels)} label="Analysis shown" />
          </div>
          <div className="view-body">
            {currentPanel === 'math' ? <MathBody entry={math} /> : <ViewBody view={currentPanel} exp={exp} x={x} />}
          </div>
        </section>
      </main>
    </div>
  )
}
