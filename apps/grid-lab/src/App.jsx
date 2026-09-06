import React, { useMemo, useRef, useState } from 'react'
import { LabNav, LessonNav, NumField, ReportIssue, fmt } from '@ee-labs/ui'
import { MathBody } from '@ee-labs/explain'
import { EXPERIMENTS, GROUPS, GROUP_INTROS, VIEW_LABELS, byId, byGroup, defaultsOf, isPlot } from './experiments.js'
import { analyse } from './analysis.js'
import { experimentMath } from './math.js'
import { termsFor } from './terms.js'
import { ViewBody } from './components/panes.jsx'
import { reportSummary } from './report.js'
import { degText, pu } from './format.js'
import pkg from '../package.json'

const FIRST = EXPERIMENTS[0].id
const KNOBS_SHOWN = 4

// What the upper pane is a picture of. The lower pane is always the analysis,
// as it is in every other lab in the suite.
const PANE_TITLE = {
  base: 'Two zones, one base',
  phase: 'Three phases',
  line: 'The line',
  flow: 'The network',
  seq: 'Three sets',
  fault: 'Three networks',
  relay: 'The relay',
  swing: 'The machine',
  dispatch: 'Three units',
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
 * The sentences a model is not allowed to be read without: the DC power
 * flow's warning and its refusal, the long-line switch, and the integrator's
 * step. Each comes from the engine rather than from this file.
 */
function Guards({ x }) {
  const guards = []
  if (x.kind === 'flow' && x.guard) {
    if (x.guard.warn) guards.push({ level: 'warn', text: x.guard.text })
    if (x.guard.refuse) guards.push({ level: 'refuse', text: x.guard.refusal })
    if (x.refusal) guards.push({ level: 'refuse', text: x.refusal })
  }
  if (x.kind === 'line') guards.push({ level: x.model.long ? 'warn' : 'note', text: x.model.guard })
  if (x.kind === 'swing' && x.run.says) guards.push({ level: 'note', text: x.run.says })
  if (!guards.length) return null
  return (
    <div className="guards">
      {guards.map((g) => (
        <p key={g.text.slice(0, 30)} className={`guard is-${g.level}`} data-role="guard">
          {g.text}
        </p>
      ))}
    </div>
  )
}

/** The topbar's meters: the base first, then this experiment's headline numbers. */
function Meters({ exp, x }) {
  const rows = []
  if (x.kind === 'base') {
    rows.push(['Z base', fmt(x.b.Zbase, 'Ω', 5)], ['I base', fmt(x.b.Ibase, 'A', 6)], ['V to neutral', fmt(x.b.VbaseLN, 'V', 6)])
  } else if (x.kind === 'phase') {
    rows.push(['Line current', fmt(x.load.I, 'A', 6)], ['Three-phase power', fmt(x.load.P, 'W', 5)], ['Power factor', x.load.pf.toFixed(6)])
  } else if (x.kind === 'line') {
    rows.push(['Surge impedance', fmt(x.surge.Zc, 'Ω', 6)], ['Open-end rise', x.rise.exact.toFixed(5)], ['Receiving bus', pu(x.Vr, 5)])
  } else if (x.kind === 'flow') {
    if (x.sol)
      rows.push(
        ['Lowest bus', pu(Math.min(...x.sol.buses.map((b) => b.V)), 5)],
        ['Total loss', `${(x.sol.Ploss * 100).toFixed(4)} MW`],
        ['Newton updates', String(x.sol.iterations)],
        ['Largest branch angle', degText((x.guard.maxAngle * 180) / Math.PI, 3)],
      )
    else rows.push(['No solution', 'at this loading'])
  } else if (x.kind === 'seq') {
    rows.push(['Positive', `${x.seq.mag[1].toFixed(5)} A`], ['Negative', `${x.seq.mag[2].toFixed(5)} A`], ['Zero', `${x.seq.mag[0].toFixed(5)} A`], ['Unbalance', `${(100 * x.unbalance).toFixed(3)} %`])
  } else if (x.kind === 'fault') {
    rows.push(
      ['Largest phase current', `${Math.max(...x.study.phaseMag).toFixed(5)} pu`],
      ['In amperes', `${(Math.max(...x.study.phaseMag) * x.b.Ibase).toFixed(2)} A`],
      ['Ground current', `${x.study.groundMag.toFixed(5)} pu`],
    )
  } else if (x.kind === 'relay') {
    rows.push(['Operating time', `${x.down.toFixed(4)} s`], ['Upstream', `${x.up.time.toFixed(4)} s`], ['Apparent impedance', `${x.z.Z.toFixed(3)} Ω`])
  } else if (x.kind === 'swing') {
    rows.push(
      ['Critical angle', degText((x.st.deltaCr * 180) / Math.PI, 4)],
      ['Critical time', `${x.st.tcr.toFixed(6)} s`],
      ['First-swing peak', x.run.stable ? degText((x.run.peak * 180) / Math.PI, 4) : 'no turn back'],
    )
  } else if (x.kind === 'dispatch') {
    rows.push(['λ', `${x.d.lambda.toFixed(5)} $/MWh`], ['Cost', `$${x.d.cost.toFixed(2)}`], ['Saving', `$${x.d.saving.toFixed(2)}`])
  }
  return (
    <>
      <span className="topbar-field is-base">
        <span>Base</span>
        <b>
          {(x.b ? x.b.Sbase / 1e6 : 100).toFixed(0)} MVA, {(x.b ? x.b.Vbase / 1e3 : 230).toFixed(1)} kV
        </b>
      </span>
      {rows.map(([label, value]) => (
        <span className="topbar-field" key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </span>
      ))}
    </>
  )
}

const plotsOf = (e) => e.views.filter(isPlot)
const panelsOf = (e) => e.views.filter((v) => !isPlot(v))
const openPlot = (e) => (isPlot(e.view) ? e.view : plotsOf(e)[0])
const openPanel = (e) => (isPlot(e.view) ? panelsOf(e)[0] : e.view)

export default function App({ initialId = FIRST, initialView = null, initialParams = null }) {
  const start = byId[initialId] ? initialId : FIRST
  const first = byId[start]
  const [id, setId] = useState(start)
  const [params, setParams] = useState(() => ({ ...defaultsOf(start), ...(initialParams || {}) }))
  const [plotView, setPlotView] = useState(initialView && isPlot(initialView) ? initialView : openPlot(first))
  const [panelView, setPanelView] = useState(initialView && !isPlot(initialView) ? initialView : openPanel(first))
  const [pristine, setPristine] = useState(() => !initialParams)
  const [browsing, setBrowsing] = useState(null)

  const exp = byId[id]
  const idx = EXPERIMENTS.findIndex((e) => e.id === id)

  const choose = (next) => {
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
  const applyStep = (t) => {
    setParams((p) => ({ ...p, ...(t.set || {}) }))
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
      {kb.kind === 'choice' ? (
        <ChoiceField knob={kb} value={params[kb.key]} onChange={(v) => setParam(kb.key, v)} />
      ) : (
        <NumField
          label={kb.label}
          unit={kb.unit}
          value={params[kb.key]}
          onChange={(v) => setParam(kb.key, v)}
          min={kb.min}
          max={kb.max}
          step={kb.step}
          scale={kb.scale}
          hint={kb.hint}
          eng={kb.eng !== false}
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
          <LabNav current="grid-lab" currentLabel="Grid" />
          <h1>Grid Lab</h1>
          <p className="sub">Each experiment loads a network, a machine or a relay, names one knob, and states the number to read.</p>
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
                <em className="prov"> Some knobs have moved from the note’s own settings.</em>{' '}
                <button type="button" className="chip reset" onClick={reset} title="Put every knob back to this experiment’s defaults">
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
          <LessonNav
            index={idx}
            total={EXPERIMENTS.length}
            onPrev={() => idx > 0 && choose(EXPERIMENTS[idx - 1].id)}
            onNext={() => idx < EXPERIMENTS.length - 1 && choose(EXPERIMENTS[idx + 1].id)}
            onReset={reset}
            dirty={!pristine}
            noun="experiment"
          />
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
          lab="Grid Lab"
          version={pkg.version}
          state={{ id, params, view: currentPlot, panel: currentPanel }}
          summary={reportSummary(exp, params, { plot: VIEW_LABELS[currentPlot]?.label, panel: VIEW_LABELS[currentPanel]?.label })}
        />
      </aside>

      <div className="topbar">
        <nav className="flow" aria-label="Experiment summary">
          <span className="flow-node is-name" title={exp.name}>
            {exp.name}
          </span>
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
            <Guards x={x} />
          </div>
        </section>

        <section className="view">
          <div className="view-head">
            <h2>Analysis</h2>
            <ViewSwitch value={currentPanel} onChange={setPanelView} options={options(panels)} label="Analysis shown" />
          </div>
          <div className="view-body">{currentPanel === 'math' ? <MathBody entry={math} /> : <ViewBody view={currentPanel} exp={exp} x={x} />}</div>
        </section>
      </main>
    </div>
  )
}
