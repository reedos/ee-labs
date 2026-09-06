import React, { useMemo, useState } from 'react'
import { LabNav, NumField, ReportIssue, LessonNav, TryLine } from '@ee-labs/ui'
import { EXPERIMENTS, GROUPS, byId, defaultsOf, groupOf, viewLabel } from './experiments.js'
import { analyse, guardOf, refusalOf } from './math.js'
import { termsFor } from './terms.js'
import { num } from './format.js'
import { reportSummary } from './report.js'
import { CavityPane, CurvePane, LinkPane, NumbersPane, PulsePane, SchematicPane, SpectrumPane } from './components/panes.jsx'
import pkg from '../package.json'

const FIRST = EXPERIMENTS[0].id

/** Which pane component draws a given view. */
const PANE_OF = {
  schematic: SchematicPane,
  curve: CurvePane,
  pulse: PulsePane,
  link: LinkPane,
  cavity: CavityPane,
  spectrum: SpectrumPane,
  numbers: NumbersPane,
}

const KNOBS_SHOWN = 4

/**
 * `initialId` and `initialView` are the smoke test's way in. It mounts every
 * experiment in every one of its views, which catches a prop the shell forgot
 * to pass. Nothing in the app itself passes them.
 */
export default function App({ initialId = FIRST, initialView = null }) {
  const start = byId[initialId] ? initialId : FIRST
  const [id, setId] = useState(start)
  const [params, setParams] = useState(() => defaultsOf(start))
  const [view, setView] = useState(initialView || byId[start].view)
  // -1 is "the note describes the picture, exactly": the bare defaults, before
  // any try step has been applied. 0..n-1 is which step is showing.
  const [tryIndex, setTryIndex] = useState(-1)
  const [browsing, setBrowsing] = useState(null)

  const exp = byId[id]

  const choose = (next) => {
    setId(next)
    setParams(defaultsOf(next))
    setView(byId[next].view)
    setTryIndex(-1)
    setBrowsing(null)
  }
  const setParam = (key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }))
    setTryIndex(-1)
  }
  const applyTry = (i) => {
    setTryIndex(i)
    setParams({ ...defaultsOf(id), ...((exp.try[i] || {}).set || {}) })
  }
  const resetKnobs = () => {
    setParams(defaultsOf(id))
    setTryIndex(-1)
  }

  const x = useMemo(() => analyse(exp, params), [exp, params])
  const currentView = exp.views.includes(view) ? view : exp.view
  const guard = guardOf(x)
  const refusal = x.declined ? null : refusalOf(x)
  const shownGroup = browsing || exp.group
  const idx = EXPERIMENTS.findIndex((e) => e.id === id)
  const next = idx < EXPERIMENTS.length - 1 ? EXPERIMENTS[idx + 1] : null
  const prev = idx > 0 ? EXPERIMENTS[idx - 1] : null
  const terms = termsFor(exp.terms)
  const moreKnobs = exp.params.slice(KNOBS_SHOWN)

  const knobField = (k) => (
    <div className="knob" data-knob={k.key} key={k.key}>
      <NumField
        label={k.label}
        unit={k.unit}
        value={params[k.key]}
        onChange={(v) => setParam(k.key, v)}
        min={k.min}
        max={k.max}
        scale={k.scale}
        hint={k.hint}
        eng={k.eng !== false}
      />
    </div>
  )

  const PaneComponent = PANE_OF[currentView]

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <LabNav current="photonics-lab" currentLabel="Photonics" />
          <h1>Photonics Lab</h1>
          <p className="sub">Every experiment loads a piece of an optical link, names one knob, and states what the light does.</p>
        </header>

        <section>
          <h2 className="picker-cap" data-role="experiments-cap">
            <span className="sr-only">Experiments</span>
            <span className="group-tabs" role="tablist" aria-label="Experiment groups">
              {GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  className={`group-tab${g === shownGroup ? ' is-shown' : ''}${g === exp.group ? ' is-here' : ''}`}
                  aria-selected={g === shownGroup}
                  data-group={g}
                  onClick={() => setBrowsing(g === exp.group ? null : g)}
                >
                  {g}
                </button>
              ))}
            </span>
          </h2>
          {GROUPS.map((g) => (
            <div key={g} className="presets" role="tabpanel" aria-label={g} data-group={g} hidden={g !== shownGroup}>
              {groupOf(g).map((e) => (
                <button type="button" key={e.id} className={`preset${e.id === id ? ' is-on' : ''}`} data-id={e.id} onClick={() => choose(e.id)}>
                  {e.name}
                </button>
              ))}
            </div>
          ))}

          <h3 className="note-title">{exp.name}</h3>
          <p className="hint" data-role="see">
            {exp.see}
          </p>
          {exp.try && exp.try.length ? (
            <>
              <TryLine
                text={tryIndex >= 0 ? exp.try[tryIndex].say : exp.try[0].say}
                chips={[{ label: tryIndex >= 0 ? 'Applied' : 'Try it', title: 'Apply this step’s settings' }]}
                onChip={() => applyTry(tryIndex >= 0 ? tryIndex : 0)}
                activeChip={tryIndex >= 0 ? 'Applied' : null}
              />
              <LessonNav
                index={Math.max(0, tryIndex)}
                total={exp.try.length}
                onPrev={() => applyTry(Math.max(0, (tryIndex < 0 ? 0 : tryIndex) - 1))}
                onNext={() => applyTry(Math.min(exp.try.length - 1, (tryIndex < 0 ? -1 : tryIndex) + 1))}
                onReset={resetKnobs}
                dirty={tryIndex >= 0}
                noun="step"
              />
            </>
          ) : null}
          <details className="why-fold">
            <summary>Why</summary>
            <p className="hint">{exp.why}</p>
          </details>
          {terms.length ? (
            <details className="terms" key={id}>
              <summary>Terms: {terms.map((t) => t.name).join(' · ')}</summary>
              <dl>
                {terms.map((t) => (
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
          {exp.params.slice(0, KNOBS_SHOWN).map(knobField)}
          {moreKnobs.length ? (
            <details className="more-knobs">
              <summary>More knobs ({moreKnobs.map((k) => k.label).join(', ')})</summary>
              {moreKnobs.map(knobField)}
            </details>
          ) : null}
        </section>

        <ReportIssue
          lab="Photonics Lab"
          version={pkg.version}
          state={{ id, params, view: currentView }}
          summary={reportSummary({ id, params, view: currentView, x })}
        />
      </aside>

      <div className="topbar">
        <nav className="flow" aria-label="Experiment summary">
          <span className="flow-node is-name" title={exp.name}>
            {exp.name}
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span className="flow-node is-out" data-role="headline">
            {x.headline ? `${num(x.headline.value, x.headline.unit)}` : ''}
            <em>{x.headline?.label}</em>
          </span>
          {guard ? (
            <span className={`flow-node${guard.ok ? '' : ' is-off'}`} data-role="guard-flag" title={guard.says}>
              guard: {guard.ok ? 'holds' : 'loosened'}
            </span>
          ) : null}
          {refusal ? (
            <span className="flow-node is-off" data-role="refusal-flag" title={refusal}>
              declined
            </span>
          ) : null}
        </nav>
        <nav className="topbar-nav" aria-label="Path through the experiments">
          <button type="button" className="nav-btn" data-role="prev" disabled={!prev} onClick={() => prev && choose(prev.id)}>
            ‹
          </button>
          <span className="position" data-role="position">
            {`${idx + 1} of ${EXPERIMENTS.length}`}
            <em>{exp.group.slice(0, 1)}</em>
          </span>
          <button type="button" className="nav-btn" data-role="next" disabled={!next} onClick={() => next && choose(next.id)}>
            ›
          </button>
        </nav>
      </div>

      <main className="views is-single">
        <section className="view is-primary">
          <div className="view-head">
            <ViewSwitch value={currentView} onChange={setView} views={exp.views} />
          </div>
          <div className="view-body">
            {x.declined ? (
              <p className="hint declined" data-role="declined">
                {x.declined.says}
              </p>
            ) : PaneComponent ? (
              <PaneComponent exp={exp} x={x} p={params} />
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}

function ViewSwitch({ value, onChange, views }) {
  return (
    <div className="segmented sm view-switch" role="group" aria-label="View shown">
      {views.map((v) => {
        const meta = viewLabel(v)
        return (
          <button key={v} type="button" className={value === v ? 'on' : ''} aria-pressed={value === v} title={meta.title} onClick={() => onChange(v)}>
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}
