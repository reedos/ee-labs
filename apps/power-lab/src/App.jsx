import React, { useMemo, useState } from 'react'
import { LabNav, NumField, ReportIssue, fmt } from '@ee-labs/ui'
import { MathBody } from '@ee-labs/explain'
import { EXPERIMENTS, GROUPS, TRACES, VIEWS, SWEEP_X, byId, defaultsOf } from './experiments.js'
import { analyse, sweepD, sweepR, sweepLinear, sweepEta, sweepC, sweepAlpha } from './analysis.js'
import { experimentMath } from './math.js'
import { termsFor } from './terms.js'
import { reportSummary } from './report.js'
import ScopeCanvas, { TRACE_COLORS } from './components/ScopeCanvas.jsx'
import SweepCanvas from './components/SweepCanvas.jsx'
import { MeasuresPane, BalancePane, LossesPane, SpectrumPane, MODE_WORDS } from './components/panes.jsx'
import { fmtz } from './format.js'
import Schematic, { TOPOLOGY_NAMES, topologyOf, signalsOf } from './components/schematics.jsx'
import pkg from '../package.json'

const FIRST = EXPERIMENTS[0].id

/** The one-line result of an experiment, for the top bar and the report. */
export function outcomeOf(exp, x) {
  const m = x.m
  if (exp.kind === 'linreg') return `η = ${(m.eta * 100).toFixed(1)} %, ${fmt(m.Ploss, 'W', 3)} into the regulator`
  if (exp.kind === 'chopper') return `⟨v⟩ = ${fmt(m.sig.vout.avg, 'V', 3)}, RMS ${fmt(m.sig.vout.rms, 'V', 3)}`
  if (exp.kind === 'rectifier')
    return `V_dc = ${fmt(m.Vdc, 'V', 4)}, ripple ${fmt(m.ripple, 'V', 3)}, ${m.angle.toFixed(1)}° × ${m.pulses}, PF ${m.pf.toFixed(3)}`
  if (exp.kind === 'dimmer') return `P/P_full = ${m.share.toFixed(4)} at α = ${((x.p.alpha * 180) / Math.PI).toFixed(0)}°, PF ${m.pf.toFixed(3)}`
  return `${MODE_WORDS[m.mode]}, M = ${m.M.toFixed(4)}, η = ${(m.eta * 100).toFixed(2)} %`
}

/** Which sweep an experiment's lower pane draws, and where the knob sits on it. */
function sweepFor(exp, params, x) {
  const s = exp.sweep
  if (!s) return null
  if (exp.kind === 'linreg') return { points: sweepLinear(params), at: params.Vo / params.Vin, rcrit: null, label: 'η = V_out / V_in' }
  if (s.x === 'C') return { points: sweepC(params, exp), at: params.C, rcrit: null }
  if (s.x === 'alpha') return { points: sweepAlpha(params), at: params.alphaDeg, rcrit: null, label: 'P / P_full measured on the waveform' }
  if (s.y === 'eta' && s.x !== 'D') return { points: sweepEta(params, exp.kind), at: params.R, rcrit: x.formulas.Rcrit }
  if (s.x === 'D') return { points: sweepD(params, exp.kind), at: params.D, rcrit: null }
  return { points: sweepR(params, exp.kind), at: params.R, rcrit: x.formulas.Rcrit }
}

/**
 * `initialId` and `initialView` are the smoke test's way in: it mounts every
 * experiment in every one of its views, which is the only way a render-phase
 * fault in a pane that the first experiment does not use gets caught here
 * rather than in the browser. Nothing in the app passes them.
 */
export default function App({ initialId = FIRST, initialView = null }) {
  const start = byId[initialId] ? initialId : FIRST
  const [id, setId] = useState(start)
  const [params, setParams] = useState(() => defaultsOf(start))
  const [traces, setTraces] = useState(() => new Set(byId[start].traces))
  const [view, setView] = useState(initialView || byId[start].view)
  // Whether the note still describes what is on screen: any knob moved by hand
  // retires it, as in the other labs. The trace and view toggles are exempt.
  const [pristine, setPristine] = useState(true)
  const [openGroups, setOpenGroups] = useState(() => new Set())

  const exp = byId[id]

  const choose = (next) => {
    setId(next)
    setParams(defaultsOf(next))
    setTraces(new Set(byId[next].traces))
    setView(byId[next].view)
    setPristine(true)
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
  const sweep = useMemo(
    () => (currentView === 'sweep' ? sweepFor(exp, params, x) : null),
    [exp, params, x, currentView],
  )
  const outcome = outcomeOf(exp, x)
  const m = x.m

  const viewOptions = exp.views.map((v) => ({ id: v, ...VIEWS[v] }))
  const traceKeys = exp.allTraces || (exp.kind === 'buck' ? Object.keys(TRACES) : exp.traces)
  const shown = [...traces].filter((t) => traceKeys.includes(t))
  const isBuck = exp.kind === 'buck'
  const clocked = isBuck || exp.kind === 'boost' || exp.kind === 'buckboost'
  const flow = flowNodes(exp, params, x)

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <LabNav current="power-lab" currentLabel="Power" />
          <h1>Power Lab</h1>
          <p className="sub">
            Switching converters from volt-second balance up. Every waveform is the exact periodic
            steady state, every formula sits beside what it predicts, and every claim in a note is
            measured.
          </p>
          <ReportIssue
            lab="Power Lab"
            version={pkg.version}
            state={{ id, params, traces: shown, view: currentView }}
            summary={reportSummary({ id, params, traces: shown, view: currentView, outcome })}
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
                    data-id={e.id}
                    onClick={() => choose(e.id)}
                  >
                    {e.name}
                  </button>
                ))}
              </FoldGroup>
            )
          })}
          <h3 className="note-title">{exp.name}</h3>
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
          <h2>Schematic</h2>
          <Schematic exp={exp} x={x} />
          <p className="sch-name">{TOPOLOGY_NAMES[topologyOf(exp)]}</p>
        </section>

        <section>
          <h2>Knobs</h2>
          {exp.params.map((p) =>
            p.kind === 'toggle' ? (
              <ToggleField key={p.key} knob={p} value={params[p.key]} onChange={(v) => setParam(p.key, v)} />
            ) : (
              <NumField
                key={p.key}
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
              />
            ),
          )}
        </section>
      </aside>

      <div className="topbar">
        <nav className="flow" aria-label="Experiment summary">
          <span className="flow-node">
            {exp.name}
            <em>{exp.group}</em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span className="flow-node">
            {MODE_WORDS[m.mode] || m.mode}
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
            <span>{exp.kind === 'dimmer' ? 'V_rms' : 'V_out'}</span>
            <b>{exp.kind === 'dimmer' ? fmt(m.sig.vout.rms, 'V', 4) : fmt(m.sig.vout.avg, 'V', 4)}</b>
          </span>
          <span className="topbar-field">
            <span>P_out</span>
            <b>{fmt(m.Pout, 'W', 3)}</b>
          </span>
          <Headline exp={exp} m={m} />
        </div>
      </div>

      <main className={`views${exp.scope === false ? ' is-single' : ''}`}>
        {exp.scope === false ? null : (
        <section className="view">
          <div className="view-head">
            <h2>Scope</h2>
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
                    i_L <b>{fmt(m.sig.iL.avg, 'A', 3)}</b>
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
              <ScopeCanvas wf={x.wf} baseWf={base.wf} traces={shown} />
            ) : (
              <p className="hint">No traces selected — pick one above.</p>
            )}
          </div>
        </section>
        )}

        <section className="view">
          <div className="view-head">
            <h2>Analysis</h2>
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
            {currentView === 'math' ? <MathBody entry={math} /> : null}
            {currentView === 'balance' && x.balance ? <BalancePane x={x} /> : null}
            {currentView === 'losses' ? <LossesPane x={x} /> : null}
            {currentView === 'spectrum' ? <SpectrumPane x={x} /> : null}
            {currentView === 'sweep' && sweep ? (
              <SweepCanvas points={sweep.points} sweep={exp.sweep} at={sweep.at} rcrit={sweep.rcrit} label={sweep.label} />
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
function flowNodes(exp, params, x) {
  const m = x.m
  const saysK = (exp.symbols || []).includes('K')
  if (exp.kind === 'buck') {
    return {
      mid: saysK
        ? `K = ${x.formulas.K.toFixed(3)}, K_crit = ${x.formulas.Kcrit.toFixed(3)}`
        : `${fmt(params.Vin, 'V', 3)} in, D = ${(params.D * 100).toFixed(1)} %`,
      out: saysK ? `M = ${m.M.toFixed(4)}` : `${fmt(m.sig.vout.avg, 'V', 4)} out`,
      outSub: saysK ? `D = ${params.D.toFixed(4)}` : `M = ${m.M.toFixed(4)}`,
    }
  }
  if (exp.kind === 'linreg') return { mid: `${fmt(params.Vin, 'V', 3)} in`, out: `η = ${(m.eta * 100).toFixed(1)} %`, outSub: 'V_out / V_in' }
  if (exp.kind === 'boost' || exp.kind === 'buckboost') {
    return {
      mid: saysK
        ? `${fmt(params.Vin, 'V', 3)} in, K = ${x.formulas.K.toFixed(3)} of ${x.formulas.Kcrit.toFixed(3)}`
        : `${fmt(params.Vin, 'V', 3)} in, D = ${(params.D * 100).toFixed(1)} %`,
      out: `M = ${m.M.toFixed(4)}`,
      outSub: `${fmt(m.sig.vout.avg, 'V', 4)} at D = ${params.D.toFixed(3)}`,
    }
  }
  if (exp.kind === 'rectifier') {
    return {
      mid: `${fmt(x.p.Vs, 'V', 3)} RMS${x.conv.threePhase ? ' × 3' : ''}, ${m.pulses} pulse${m.pulses === 1 ? '' : 's'} per cycle`,
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
