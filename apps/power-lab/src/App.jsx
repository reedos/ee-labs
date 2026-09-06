import React, { useMemo, useRef, useState } from 'react'
import { LabNav, NumField, ReportIssue, fmt } from '@ee-labs/ui'
import { MathBody } from '@ee-labs/explain'
import { EXPERIMENTS, GROUPS, GROUP_INTROS, TRACES, VIEWS, SWEEP_X, byId, defaultsOf, nextOf, prevOf, positionOf, offeredTraces } from './experiments.js'
import { analyse, sweepD, sweepR, sweepLinear, sweepEta, sweepFs, sweepC, sweepAlpha, sweepChopper, sweepMa, sweepFsw, sweepOpts } from './analysis.js'
import { experimentMath } from './math.js'
import { termsFor } from './terms.js'
import { reportSummary } from './report.js'
import ScopeCanvas, { TRACE_COLORS } from './components/ScopeCanvas.jsx'
import SweepCanvas from './components/SweepCanvas.jsx'
import { MeasuresPane, BalancePane, LossesPane, SpectrumPane, FluxPane, ScrubPane, LedgerPane, MODE_WORDS } from './components/panes.jsx'
import { fmtz, statScale } from './format.js'
import { scopeMarks, sweepMarks } from './marks.js'
import Schematic, { TOPOLOGY_NAMES, topologyOf, signalsOf } from './components/schematics.jsx'
import { FamilyPane } from './components/jkPanes.jsx'
import { jkFlow, jkOutcome, sweepJk } from './groups/jk.js'
import pkg from '../package.json'

const FIRST = EXPERIMENTS[0].id

/** How many knobs the sidebar shows before folding the rest under "More". */
const KNOBS_SHOWN = 4
/** The larger pane's share of the main column, until the reader drags the split. */
const PRIMARY_SHARE = 0.62

/**
 * Which pane an experiment's lesson is in. An experiment that opens on its
 * measures is about a waveform, so the scope leads; one that opens on a sweep,
 * a balance table or a loss bar is about that, and the analysis pane leads.
 * `exp.primary` overrides the rule.
 */
export function primaryOf(exp) {
  if (exp.primary) return exp.primary
  return exp.view === 'measures' ? 'scope' : 'analysis'
}

/**
 * Whether an experiment is being visited for the first time this session.
 * Its terms line is marked fresh then — the names it defines are shown in the
 * accent, so the rescue is seen once — and plain on a return. The list never
 * opens by itself: open, it is a screen of definitions above the schematic
 * and the knobs, and the fold (§11.3.2) is the harder promise.
 */
export function termsFresh(seen, id) {
  return !seen.has(id)
}

/** A chip's text on the knob it sits on: in the knob's own units. */
function chipLabel(v, knob) {
  if (knob.percent) return `${+(v * 100).toFixed(1)} %`
  if (knob.unit === '°') return `${+v.toFixed(1)}°`
  return fmt(v, knob.unit, 3)
}

/**
 * Put the keyboard on a knob: open the fold it may be in, then focus its
 * input. The try line's chip calls this.
 */
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

/** The one-line result of an experiment, for the top bar and the report. */
export function outcomeOf(exp, x) {
  const m = x.m
  if (x.jk) return jkOutcome(exp, x)
  if (exp.kind === 'linreg') return `η = ${(m.eta * 100).toFixed(1)} %, ${fmt(m.Ploss, 'W', 3)} into the regulator`
  if (exp.kind === 'chopper') return `⟨v⟩ = ${fmt(m.sig.vout.avg, 'V', 3)}, RMS ${fmt(m.sig.vout.rms, 'V', 3)}`
  if (exp.kind === 'rectifier')
    return `V_dc = ${fmt(m.Vdc, 'V', 4)}, ripple ${fmt(m.ripple, 'V', 3)}, ${m.angle.toFixed(1)}° × ${m.pulses}, PF ${m.pf.toFixed(3)}`
  if (exp.kind === 'dimmer') return `P/P_full = ${m.share.toFixed(4)} at α = ${((x.p.alpha * 180) / Math.PI).toFixed(0)}°, PF ${m.pf.toFixed(3)}`
  if (m.mode === 'inverter')
    return `fundamental ${fmt(m.V1, 'V', 4)} rms, THD ${(m.thd * 100).toFixed(1)} %, ${x.conv.mf === 1 ? 'two edges' : `m_f = ${x.conv.mf}`}`
  return `${MODE_WORDS[m.mode]}, M = ${m.M.toFixed(4)}, η = ${(m.eta * 100).toFixed(2)} %`
}

/** Which sweep an experiment's lower pane draws, and where the knob sits on it. */
export function sweepFor(exp, params) {
  const s = exp.sweep
  if (!s) return null
  if (exp.jk) return sweepJk(exp, params)
  const opts = sweepOpts(exp, params)
  if (exp.kind === 'linreg') return { points: sweepLinear(params), at: params.Vo / params.Vin, label: 'η = V_out / V_in' }
  if (exp.kind === 'chopper') return { points: sweepChopper(params), at: params.D, label: '⟨v⟩ = D·V_in', label2: 'V_rms = √D·V_in' }
  if (s.x === 'ma') return { points: sweepMa(params), at: params.ma, label: 'peak of the bridge’s fundamental' }
  if (s.x === 'fsw') return { points: sweepFsw(params), at: params.fsw, label: 'THD of the load voltage' }
  if (s.x === 'C') return { points: sweepC(params, exp), at: params.C }
  if (s.x === 'alpha') return { points: sweepAlpha(params), at: params.alphaDeg, label: 'P / P_full measured on the waveform' }
  if (s.x === 'fs') return { points: sweepFs(params, exp.kind, 41, opts), at: params.fs }
  if (s.y === 'eta' && s.x !== 'D') return { points: sweepEta(params, exp.kind, 41, opts), at: params.R }
  // η against D is a ratio sweep read for its η; the closed form it carries
  // is for M, and would be drawn against the wrong axis.
  if (s.x === 'D' && s.y === 'eta') return { points: sweepD(params, exp.kind, 61, opts).map(({ pred, ...q }) => q), at: params.D }
  if (s.x === 'D') return { points: sweepD(params, exp.kind, 61, opts), at: params.D }
  return { points: sweepR(params, exp.kind, 61, opts), at: params.R }
}

/**
 * `initialId` and `initialView` are the smoke test's way in: it mounts every
 * experiment in every one of its views, which is the only way a render-phase
 * fault in a pane that the first experiment does not use gets caught here
 * rather than in the browser. Nothing in the app passes them.
 */
export default function App({ initialId = FIRST, initialView = null, initialParams = null }) {
  const start = byId[initialId] ? initialId : FIRST
  const [id, setId] = useState(start)
  const [params, setParams] = useState(() => ({ ...defaultsOf(start), ...(initialParams || {}) }))
  const [traces, setTraces] = useState(() => new Set(byId[start].traces))
  const [view, setView] = useState(initialView || byId[start].view)
  // Whether the note still describes what is on screen: any knob moved by hand
  // retires it, as in the other labs. The trace and view toggles are exempt.
  const [pristine, setPristine] = useState(() => !initialParams)
  // Experiments already visited this session: their terms open on the first
  // visit only (§11.3.4).
  const seen = useRef(new Set())
  // Which group's experiments the picker lists: the active experiment's,
  // unless the reader has clicked another group's tab to browse it.
  const [browsing, setBrowsing] = useState(null)
  // The larger pane and its share of the column. The share survives a change
  // of experiment (the reader set it); which pane gets it is the experiment's.
  const [primary, setPrimary] = useState(() => primaryOf(byId[start]))
  const [share, setShare] = useState(PRIMARY_SHARE)
  // Where the conduction scrub's cursor sits, as a fraction of one period.
  const [scrub, setScrub] = useState(0.25)
  const mainRef = useRef(null)

  const exp = byId[id]

  const choose = (next) => {
    seen.current.add(id)
    setId(next)
    setParams(defaultsOf(next))
    setTraces(new Set(byId[next].traces))
    setView(byId[next].view)
    setPristine(true)
    setPrimary(primaryOf(byId[next]))
    setBrowsing(null)
    setScrub(0.25)
  }
  // The way back from a retired note: every knob to the experiment's defaults.
  const reset = () => {
    setParams(defaultsOf(id))
    setPristine(true)
  }
  const swapPrimary = () => setPrimary((p) => (p === 'scope' ? 'analysis' : 'scope'))
  // Drag the split: the pointer's height in the column is the top pane's share.
  const dragSplit = (e) => {
    const el = mainRef.current
    if (!el) return
    e.preventDefault()
    const move = (ev) => {
      const r = el.getBoundingClientRect()
      const top = Math.min(0.75, Math.max(0.25, (ev.clientY - r.top) / r.height))
      setShare(primary === 'scope' ? top : 1 - top)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const setParam = (key, value) => {
    setParams((p) => ({ ...p, [key]: value }))
    setPristine(false)
  }
  const toggleTrace = (key) => {
    setTraces((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const x = useMemo(() => analyse(exp, params), [exp, params])
  // The same experiment at its own defaults. The scope frames its axes on this
  // rather than on whatever the knobs currently say, so turning a knob moves
  // the curve inside a frame that holds still — which is the whole point of
  // turning it. Solved once per experiment, not per knob.
  const base = useMemo(() => analyse(exp, defaultsOf(exp.id)), [exp])
  const math = useMemo(() => experimentMath(exp, params, x), [exp, params, x])
  const currentView = exp.views.includes(view) ? view : exp.view
  // Sweeps re-solve the converter across a knob's range; only when shown.
  // Computed for the sweep view, and for the single-pane losses view that
  // carries the sweep under it (the regulator).
  const wantsSweep = currentView === 'sweep' || (exp.scope === false && currentView === 'losses')
  const sweep = useMemo(
    () => (wantsSweep ? sweepFor(exp, params) : null),
    [exp, params, x, wantsSweep],
  )
  // The same sweep at the defaults, which the sweep's axis is framed on.
  const baseSweep = useMemo(() => (wantsSweep ? sweepFor(exp, defaultsOf(exp.id)) : null), [exp, wantsSweep])
  // The note's numbers, drawn where they happen (marks.js).
  // The conduction scrub's cursor, as a fraction of one period, and the same
  // instant marked on the scope so the two panes read together.
  const scrubbing = currentView === 'scrub'
  const scrubAt = scrub * x.T
  const marks = useMemo(
    () => [...scopeMarks(exp, x), ...(scrubbing ? [{ type: 'cursor', t: scrubAt, label: fmt(scrubAt, 's', 3) }] : [])],
    [exp, x, scrubbing, scrubAt],
  )
  const sweepMarkList = useMemo(() => sweepMarks(exp, x, sweep), [exp, x, sweep])
  const outcome = outcomeOf(exp, x)
  const m = x.m

  const viewOptions = exp.views.map((v) => ({ id: v, ...VIEWS[v] }))
  const traceKeys = offeredTraces(exp)
  const shown = [...traces].filter((t) => traceKeys.includes(t))
  const isBuck = exp.kind === 'buck'
  const clocked = isBuck || exp.kind === 'boost' || exp.kind === 'buckboost'
  const flow = flowNodes(exp, params, x)
  const twoPanes = exp.scope !== false
  const topShare = Math.round((primary === 'scope' ? share : 1 - share) * 100)
  const rows = twoPanes ? { gridTemplateRows: `minmax(0,${topShare}fr) 6px minmax(0,${100 - topShare}fr)` } : undefined
  // Every knob is wrapped in an addressable element so the try line's chip
  // can focus it; the knob the experiment is about carries its chips.
  const knobField = (p) => (
    <div className="knob" data-knob={p.key} key={p.key}>
    {p.kind === 'toggle' ? (
      <ToggleField knob={p} value={params[p.key]} onChange={(v) => setParam(p.key, v)} />
    ) : (
      <NumField
        label={p.label}
        unit={p.unit}
        // A duty is read as a percentage and stored as a fraction. The
        // conversion belongs to the caller (NumField holds the value in
        // state units), so it happens here and nowhere else.
        value={p.percent ? params[p.key] * 100 : params[p.key]}
        onChange={(v) => setParam(p.key, p.percent ? v / 100 : v)}
        min={p.percent ? p.min * 100 : p.min}
        max={p.percent ? p.max * 100 : p.max}
        step={p.percent ? p.step * 100 : p.step}
        decimals={p.percent ? 1 : undefined}
        scale={p.scale}
        hint={p.hint}
        eng={!p.percent}
        presets={p.key === exp.about ? exp.chips.map((v) => ({ value: p.percent ? v * 100 : v, label: chipLabel(v, p) })) : undefined}
      />
    )}
    </div>
  )
  const moreKnobs = exp.params.slice(KNOBS_SHOWN)
  const shownGroup = browsing || exp.group
  // The group's intro is read at the boundary: on the group's first
  // experiment, and while another group's tab is being browsed. Deeper in,
  // its lines are the note's.
  const showIntro = Boolean(browsing) || EXPERIMENTS.find((e) => e.group === exp.group).id === id
  const tryKnob = exp.params.find((k) => k.key === exp.try.knob)
  const next = nextOf(id)
  const prev = prevOf(id)
  const pos = positionOf(id)

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <LabNav current="power-lab" currentLabel="Power" />
          <h1>Power Lab</h1>
          <p className="sub">Each experiment loads a converter, names one knob, and states the number to read.</p>
        </header>

        <section>
          {/* The group tabs are the section's cap: the row names the section
              better than a heading over it would, and the heading's height
              is what the note, the schematic and the first knob need to sit
              on the first screen at 1366×768. The chosen group's experiments
              go under it, three lines at most. The group you are in is
              marked; browsing another tab does not move you. */}
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
                  aria-controls={`group-${GROUPS.indexOf(g)}`}
                  data-group={g}
                  onClick={() => setBrowsing(g === exp.group ? null : g)}
                >
                  {g}
                  {g === exp.group ? <span className="group-active-dot" aria-hidden="true" /> : null}
                </button>
              ))}
            </span>
          </h2>
          {showIntro ? (
            <p className="hint group-intro" data-role="group-intro">
              {GROUP_INTROS[shownGroup]}
            </p>
          ) : null}
          {GROUPS.map((g) => (
            <div
              key={g}
              id={`group-${GROUPS.indexOf(g)}`}
              className="presets"
              role="tabpanel"
              aria-label={g}
              data-group={g}
              hidden={g !== shownGroup}
            >
              {EXPERIMENTS.filter((e) => e.group === g).map((e) => (
                <button
                  type="button"
                  key={e.id}
                  className={`preset${e.id === id ? ' is-on' : ''}`}
                  data-id={e.id}
                  onClick={() => choose(e.id)}
                >
                  {e.name}
                  {e.id === FIRST ? <span className="start-here">Start here</span> : null}
                </button>
              ))}
            </div>
          ))}
          <h3 className="note-title">{exp.name}</h3>
          <p className="hint" data-role="note" data-pristine={pristine}>
            {exp.note}
            {pristine ? null : (
              <>
                <em className="prov"> The note describes the default settings. Some knobs have moved.</em>{' '}
                <button type="button" className="chip reset" data-role="reset" onClick={reset} title="Reset every knob to this experiment's defaults">
                  Reset
                </button>
              </>
            )}
          </p>
          {/* One thing to try, with the knob it names as a chip that focuses
              it, and where the note leads after that. */}
          <p className="try" data-role="try">
            <span className="try-label">Try</span> {exp.try.text}{' '}
            <button type="button" className="knob-chip" data-knob={tryKnob.key} onClick={() => focusKnob(tryKnob.key)} title={`Go to the ${tryKnob.label} knob`}>
              {tryKnob.label}
            </button>
            {next ? (
              <span className="next-line">
                <button type="button" className="link" data-role="next-link" data-target={next} onClick={() => choose(next)}>
                  Next: {byId[next].name}
                  {byId[next].group !== exp.group ? <em> · {byId[next].group}</em> : null}
                </button>
              </span>
            ) : null}
          </p>
          {termsFor(exp.terms).length ? (
            <details className={`terms${termsFresh(seen.current, id) ? ' is-fresh' : ''}`} key={id}>
              <summary>
                Terms: {termsFor(exp.terms).map((t) => t.name).join(' · ')}
              </summary>
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
          <h2>
            Schematic
            <span className="sch-name">{TOPOLOGY_NAMES[topologyOf(exp)]}</span>
          </h2>
          <Schematic exp={exp} x={x} />
        </section>

        <section>
          <h2>Knobs</h2>
          {exp.params.slice(0, KNOBS_SHOWN).map(knobField)}
          {moreKnobs.length ? (
            <details className="more-knobs">
              <summary>More knobs ({moreKnobs.map((p) => p.label).join(', ')})</summary>
              {moreKnobs.map(knobField)}
            </details>
          ) : null}
        </section>

        <ReportIssue
          lab="Power Lab"
          version={pkg.version}
          state={{ id, params, traces: shown, view: currentView }}
          summary={reportSummary({ id, params, traces: shown, view: currentView, outcome })}
        />
      </aside>

      <div className="topbar">
        <nav className="flow" aria-label="Experiment summary">
          {/* The name may give way (it is the sidebar's title and the nav's
              group already); the mode and the outcome never do. */}
          <span className="flow-node is-name" title={exp.name}>
            {exp.name}
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span className="flow-node">
            {flow.mode || MODE_WORDS[m.mode] || m.mode}
            <em>{flow.mid}</em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span className="flow-node is-out" data-role="outcome">
            {flow.out}
            <em>{flow.outSub}</em>
          </span>
        </nav>
        <div className="topbar-controls">
          <span className="topbar-field">
            {/* An inverter's output averages zero by design, so what its
                meter shows is the RMS the load actually sees. */}
            <span>{exp.kind === 'dimmer' || m.mode === 'inverter' ? 'V_rms' : 'V_out'}</span>
            <b>{exp.kind === 'dimmer' || m.mode === 'inverter' ? fmt(m.sig.vout.rms, 'V', 4) : fmt(m.sig.vout.avg, 'V', 4)}</b>
          </span>
          <span className="topbar-field">
            <span>P_out</span>
            <b>{fmt(m.Pout, 'W', 3)}</b>
          </span>
          <Headline exp={exp} m={m} />
        </div>
        {/* Where you are on the path, and the way forward and back. */}
        <nav className="topbar-nav" aria-label="Path through the experiments">
          <button
            type="button"
            className="nav-btn"
            data-role="prev"
            disabled={!prev}
            title={prev ? `Previous: ${byId[prev].name}` : 'This is the first experiment'}
            aria-label={prev ? `Previous: ${byId[prev].name}` : 'No previous experiment'}
            onClick={() => prev && choose(prev)}
          >
            ‹
          </button>
          <span className="position" data-role="position">
            {`${pos.n} of ${pos.of}`}
            <em>{exp.group}</em>
          </span>
          <button
            type="button"
            className="nav-btn"
            data-role="next"
            disabled={!next}
            title={next ? `Next: ${byId[next].name}` : 'This is the last experiment'}
            aria-label={next ? `Next: ${byId[next].name}` : 'No next experiment'}
            onClick={() => next && choose(next)}
          >
            ›
          </button>
        </nav>
      </div>

      <main className={`views${twoPanes ? '' : ' is-single'}`} style={rows} ref={mainRef}>
        {/* The phone's copy of the schematic: the sidebar's is out of reach
            there, and the picture belongs above the waveforms it explains. */}
        <div className="sch-phone">
          <Schematic exp={exp} x={x} />
          <p className="sch-name">{TOPOLOGY_NAMES[topologyOf(exp)]}</p>
        </div>
        {twoPanes ? (
        <section className={`view${primary === 'scope' ? ' is-primary' : ''}`}>
          <div className="view-head">
            <PaneTitle primary={primary === 'scope'} onSwap={swapPrimary}>Scope</PaneTitle>
            <div className="segmented sm traces" role="group" aria-label="Traces shown on the scope">
              {traceKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={traces.has(key) ? 'on' : ''}
                  aria-pressed={traces.has(key)}
                  title={TRACES[key].title}
                  onClick={() => toggleTrace(key)}
                >
                  <span className="trace-dot" style={{ background: TRACE_COLORS[key] }} aria-hidden="true" />
                  {TRACES[key].label}
                </button>
              ))}
            </div>
            <div className="readout">
              {exp.kind === 'dimmer' ? (
                <>
                  <span>
                    V_rms <b>{fmt(m.sig.vout.rms, 'V', 3)}</b>
                  </span>
                  <span>
                    I_rms <b>{fmt(m.Irms, 'A', 3)}</b>
                  </span>
                  <span>
                    THD <b>{(m.thd * 100).toFixed(1)} %</b>
                  </span>
                </>
              ) : exp.kind === 'rectifier' ? (
                <>
                  <span>
                    ripple <b>{fmt(m.sig.vout.pp, 'V', 3)}</b>
                  </span>
                  <span>
                    i_D peak <b>{fmt(m.iPeak, 'A', 3)}</b>
                    <em className="prov"> for ⟨i_D⟩ {fmt(m.sig.iD.avg, 'A', 3)}</em>
                  </span>
                  <span className="flag">
                    conducts {m.angle.toFixed(1)}° × {m.pulses}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    ripple <b>{fmt(m.sig.vout.pp, 'V', 3)}</b>
                  </span>
                  <span>
                    {/* A resonant tank's mean current is zero by charge balance,
                        and the solver leaves femtoamps where the zero is. The
                        chip reads them against the waveform's own scale, so a
                        current that is not there prints as 0 A. */}
                    i_L <b>{fmtz(m.sig.iL.avg, 'A', 3, statScale(m.sig.iL))}</b>
                    <em className="prov"> ± {fmt(m.sig.iL.pp / 2, 'A', 3)}</em>
                  </span>
                  {clocked && m.mode === 'DCM' ? (
                    <span className="flag warn">diode blocks for {(((x.ss.tOff - x.ss.td) / x.T) * 100).toFixed(1)} % of the period</span>
                  ) : null}
                </>
              )}
            </div>
          </div>
          <div className="view-body">
            {shown.length ? (
              <ScopeCanvas wf={x.wf} baseWf={base.wf} traces={shown} marks={marks} />
            ) : (
              <p className="hint">No traces selected — pick one above.</p>
            )}
          </div>
        </section>
        ) : null}
        {twoPanes ? (
          <div
            className="pane-split"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Drag to resize the panes"
            title="Drag to resize the panes"
            onPointerDown={dragSplit}
          />
        ) : null}

        <section className={`view${twoPanes && primary === 'analysis' ? ' is-primary' : ''}`}>
          <div className="view-head">
            {twoPanes ? <PaneTitle primary={primary === 'analysis'} onSwap={swapPrimary}>Analysis</PaneTitle> : <h2>Analysis</h2>}
            <ViewSwitch value={currentView} onChange={setView} options={viewOptions} />
            <div className="readout">
              {currentView === 'sweep' && sweep ? (
                <span>
                  {SWEEP_X[exp.sweep.x].label} now{' '}
                  <b>{SWEEP_X[exp.sweep.x].fmt ? SWEEP_X[exp.sweep.x].fmt(sweep.at) : fmt(sweep.at, SWEEP_X[exp.sweep.x].unit, 3)}</b>
                </span>
              ) : null}
              {currentView === 'spectrum' ? (
                <span>
                  THD <b>{(m.thd * 100).toFixed(1)} %</b>
                </span>
              ) : null}
              {currentView === 'balance' && x.balance ? (
                <span>
                  Σ v_L·dt <b>{fmtz(x.balance.vsTotal, 'V·s', 2, Math.max(...x.balance.segs.map((s) => Math.abs(s.vs)), 0))}</b>
                </span>
              ) : null}
              {currentView === 'losses' ? (
                <span>
                  lost <b>{fmt(m.Ploss, 'W', 3)}</b>
                </span>
              ) : null}
            </div>
          </div>
          <div className="view-body">
            {currentView === 'measures' ? <MeasuresPane m={m} signals={signalsOf(exp)} /> : null}
            {currentView === 'flux' && x.flux ? <FluxPane x={x} /> : null}
            {currentView === 'scrub' ? (
              <ScrubPane x={x} exp={exp} at={scrubAt} onScrub={setScrub} signals={signalsOf(exp)} />
            ) : null}
            {currentView === 'ledger' ? <LedgerPane x={x} /> : null}
            {currentView === 'family' ? <FamilyPane x={x} /> : null}
            {currentView === 'math' ? <MathBody entry={math} /> : null}
            {currentView === 'balance' && x.balance ? <BalancePane x={x} /> : null}
            {currentView === 'losses' ? <LossesPane x={x} /> : null}
            {currentView === 'spectrum' ? <SpectrumPane x={x} /> : null}
            {currentView === 'sweep' && sweep ? (
              <SweepCanvas
                points={sweep.points}
                basePoints={baseSweep ? baseSweep.points : null}
                sweep={exp.sweep}
                at={sweep.at}
                marks={sweepMarkList}
                label={sweep.label}
                label2={sweep.label2}
              />
            ) : null}
            {/* An experiment with no scope has one pane for everything, and
                its losses are two rows: read at the size of information they
                leave most of a column empty, and blown up to fill it they read
                as a poster. So the sweep — the claim that no setting improves
                the loss above it — comes with them. */}
            {!twoPanes && currentView === 'losses' && sweep ? (
              <div className="single-companion">
                <h3>{sweep.label}</h3>
                <SweepCanvas
                  points={sweep.points}
                  basePoints={baseSweep ? baseSweep.points : null}
                  sweep={exp.sweep}
                  at={sweep.at}
                  marks={sweepMarkList}
                  label={sweep.label}
                  label2={sweep.label2}
                />
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}

/**
 * The top bar's middle and output nodes, per experiment. A symbol appears
 * here only once the curriculum has met it: K and K_crit are the light-load
 * experiment's, so a buck before it says what it is doing in volts and duty
 * instead (`exp.symbols` lists what an experiment may use).
 */
/**
 * The top bar's strip: mode → outcome, in a budget that fits beside the
 * meters at 1366 px (FLOW_BUDGET, held by review.test.jsx). What the meters
 * and knobs already show — V_in, V_out — is not repeated here.
 */
export const FLOW_BUDGET = { mid: 26, out: 34 }
export function flowNodes(exp, params, x) {
  const m = x.m
  const saysK = (exp.symbols || []).includes('K')
  if (x.jk) return jkFlow(exp, params, x)
  if (x.saturating) {
    return {
      mode: x.ss.mode === 'SAT' ? 'saturating' : MODE_WORDS[m.mode],
      mid: `B up to ${fmt(x.formulas.Bpk, 'T', 3)}`,
      out: `ΔB = ${fmt(x.formulas.dB, 'T', 3)}`,
      outSub: `I_sat ${fmt(x.formulas.Isat, 'A', 3)}`,
    }
  }
  if (x.isolated) {
    return {
      mid: `${fmt(params.Vin, 'V', 3)} in, ${x.formulas.Np}:1`,
      out: `M = ${m.M.toFixed(4)}`,
      outSub: `D = ${x.formulas.switching.D.toFixed(3)}`,
    }
  }
  if (m.mode === 'inverter') {
    return {
      mode: x.conv.mf === 1 ? 'square wave' : `carrier × ${x.conv.mf}`,
      mid: `${fmt(x.p.Vdc, 'V', 3)} rail`,
      out: `V₁ = ${fmt(m.V1, 'V', 4)}`,
      outSub: `THD ${(m.thd * 100).toFixed(1)} %`,
    }
  }
  if (exp.kind === 'buck') {
    return {
      // B5 is where K_crit is named, so the buck's chip names it.
      mid: saysK ? `K = ${x.formulas.K.toFixed(3)}, K_crit = ${x.formulas.Kcrit.toFixed(3)}` : `${fmt(params.Vin, 'V', 3)} in, D = ${(params.D * 100).toFixed(1)} %`,
      out: saysK ? `M = ${m.M.toFixed(4)}` : `${fmt(m.sig.vout.avg, 'V', 4)} out`,
      outSub: saysK ? `D = ${params.D.toFixed(4)}` : `M = ${m.M.toFixed(4)}`,
    }
  }
  if (exp.kind === 'linreg') return { mid: `${fmt(params.Vin, 'V', 3)} in`, out: `η = ${(m.eta * 100).toFixed(1)} %`, outSub: 'V_out / V_in' }
  if (exp.kind === 'boost' || exp.kind === 'buckboost') {
    return {
      mid: saysK ? `K = ${x.formulas.K.toFixed(3)} of ${x.formulas.Kcrit.toFixed(3)}` : `${fmt(params.Vin, 'V', 3)} in, D = ${(params.D * 100).toFixed(1)} %`,
      out: `M = ${m.M.toFixed(4)}`,
      outSub: `D = ${params.D.toFixed(3)}`,
    }
  }
  if (exp.kind === 'rectifier') {
    // The pulse count is the mode here (half-wave, bridge, six-pulse); the
    // line's own words go under it.
    return {
      mode: `${m.pulses} pulse${m.pulses === 1 ? '' : 's'} per cycle`,
      mid: x.conv.threePhase ? 'three-phase line' : 'line frequency',
      out: `V_dc = ${fmt(m.Vdc, 'V', 4)}`,
      outSub: `of a ${fmt(x.formulas.ceiling, 'V', 3)} ceiling`,
    }
  }
  if (exp.kind === 'dimmer') {
    return {
      mid: `${fmt(x.p.Vs, 'V', 3)} RMS, α = ${((x.p.alpha * 180) / Math.PI).toFixed(0)}°`,
      out: `P / P_full = ${m.share.toFixed(4)}`,
      outSub: `${fmt(m.Pin, 'W', 3)} of ${fmt(m.Pfull, 'W', 3)}`,
    }
  }
  return { mid: `${fmt(params.Vin, 'V', 3)} in`, out: `⟨v⟩ = ${fmt(m.sig.vout.avg, 'V', 3)}`, outSub: `RMS ${fmt(m.sig.vout.rms, 'V', 3)}` }
}

/**
 * The top bar's third meter: the number the experiment is about. η for a
 * converter, PF on the line side — and for the chopper, whose η is 1 by
 * definition and whose lesson is that 1 is not the point, the RMS against
 * the mean.
 */
function Headline({ exp, m }) {
  if (exp.headline === 'rms')
    return (
      <span className="topbar-field">
        <span>V_rms / ⟨v⟩</span>
        <b>
          {m.sig.vout.rms.toFixed(2)} V / {m.sig.vout.avg.toFixed(2)} V
        </b>
      </span>
    )
  if (exp.headline === 'pf')
    return (
      <span className="topbar-field">
        <span>PF</span>
        <b>{m.pf.toFixed(3)}</b>
      </span>
    )
  // An inverter's efficiency is close to one and says nothing; what it is
  // judged by is how much of its output is the fundamental it was asked for.
  if (exp.headline === 'thd')
    return (
      <span className="topbar-field">
        <span>THD</span>
        <b>{(m.thd * 100).toFixed(1)} %</b>
      </span>
    )
  return (
    <span className="topbar-field">
      <span>η</span>
      <b>{(m.eta * 100).toFixed(1)} %</b>
    </span>
  )
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
          [0, knob.off],
          [1, knob.on],
        ].map(([v, text]) => (
          <button key={v} type="button" className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * A pane's title, which is also the way to make that pane the larger one: the
 * reader who wants the sweep big clicks "Analysis". The title says so on hover.
 */
function PaneTitle({ primary, onSwap, children }) {
  return (
    <h2
      role="button"
      tabIndex={0}
      className={primary ? 'is-primary' : ''}
      title={primary ? 'This is the larger pane; click to give the other pane the room' : 'Click to make this the larger pane'}
      onClick={onSwap}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSwap()
        }
      }}
    >
      {children}
    </h2>
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
