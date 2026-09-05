import React, { useMemo, useState } from 'react'
import { LabNav, LessonNav, NumField, ReportIssue, TryLine, fmtNum } from '@ee-labs/ui'
import { PoleZeroCanvas, ZPlaneCanvas } from '@ee-labs/ui'
import { MathPanel } from '@ee-labs/explain'
import { PLANTS, PLANT_GROUPS, CONTROLLERS, NONLINEARITIES } from './systems.js'
import { EXPERIMENTS, GROUPS, applyExperiment, applyStep, inGroup, isDirty } from './experiments.js'
import { analyse } from './analysis.js'
import { experimentMath } from './math.js'
import { reportSummary } from './report.js'
import { topbar } from './verdict.js'
import { termsFor, PICKER_TERMS, TOPBAR_TERMS } from './terms.js'
import StepCanvas from './components/StepCanvas.jsx'
import BodeCanvas from './components/BodeCanvas.jsx'
import PhaseCanvas from './components/PhaseCanvas.jsx'
import StatePane from './components/StatePane.jsx'
import FitCanvas from './components/FitCanvas.jsx'
import LoopDiagram from './components/LoopDiagram.jsx'
import pkg from '../package.json'

// Control Lab's shell, with two sections added and nothing removed.
//
// A sidebar of experiments, then the plant, then the controller. A top bar
// carrying the loop diagram and the four numbers. Two view panes below it. A
// reader who knows one lab in this suite knows this one.
//
// The two additions are the sampling section, which appears only in Group B,
// and the nonlinearity section, which appears in Groups C and D. Both are
// hidden everywhere else, because a knob that does nothing in the view you are
// looking at is a knob that teaches you to ignore knobs.

const VIEWS = {
  state: 'The state',
  step: 'Step',
  bode: 'Bode',
  poles: 'Poles',
  zplane: 'z-plane',
  sampled: 'Sampled step',
  phase: 'Phase plane',
  fit: 'Fit',
}

/** Which views make sense for a mode. The first is the pane on top. */
const VIEWS_FOR = {
  state: ['state', 'step', 'poles'],
  sampled: ['sampled', 'zplane', 'bode'],
  phase: ['phase', 'step', 'poles'],
  // Group D's loops carry three states or more, so the plane is declined
  // rather than projected and these two views are what is left.
  describing: ['bode', 'step'],
  fit: ['fit', 'poles'],
  filter: ['state', 'poles'],
}

export default function App() {
  const [index, setIndex] = useState(0)
  const [loads, setLoads] = useState(0)
  const experiment = EXPERIMENTS[index] ?? null
  const [state, setState] = useState(() => (experiment ? applyExperiment(experiment) : null))
  const [openGroups, setOpenGroups] = useState(() => new Set([experiment?.group]))
  const [termsOpen, setTermsOpen] = useState(false)

  const a = useMemo(() => (state ? analyse(state) : null), [state])
  const bar = useMemo(() => (a ? topbar(a) : null), [a])
  const dirty = experiment ? isDirty(state, experiment) : false

  if (!experiment || !a) {
    return (
      <div className="app">
        <p className="hint empty">No experiment is built yet.</p>
      </div>
    )
  }

  const load = (i) => {
    const next = EXPERIMENTS[i]
    setIndex(i)
    setState(applyExperiment(next))
    setLoads((n) => n + 1)
    setOpenGroups((s) => new Set([...s, next.group]))
  }
  const reset = () => {
    setState(applyExperiment(experiment))
    setLoads((n) => n + 1)
  }
  const setPlantParam = (key, value) => setState((s) => ({ ...s, plantP: { ...s.plantP, [key]: value } }))
  const setCtrlParam = (key, value) => setState((s) => ({ ...s, ctrlP: { ...s.ctrlP, [key]: value } }))

  const plant = PLANTS[state.plantId]
  const ctrl = CONTROLLERS[state.ctrlId]
  const views = VIEWS_FOR[state.mode] || ['step', 'poles']
  const upper = views.includes(state.view) ? state.view : views[0]
  const lower = views.find((v) => v !== upper) || views[0]
  const showSampling = state.mode === 'sampled'
  const showNonlinear = state.mode === 'phase' || state.mode === 'describing'

  const chips = experiment.try.map((step, i) => ({
    label: step.say.split('.')[0],
    title: step.say,
    step,
    key: i,
  }))

  return (
    <div className="app">
      <aside className="controls">
        <LabNav current="control-lab-ii" currentLabel="Control II" />
        <header>
          <h1>Control Lab II ⟳</h1>
          <p className="sub">
            The state, the computer in the loop, the actuator that runs out, and the plant nobody wrote down.
          </p>
        </header>

        <section>
          <h2>Experiments</h2>
          {GROUPS.map((group) => {
            const open = openGroups.has(group)
            return (
              <div key={group} className="group">
                <button
                  type="button"
                  className="group-head"
                  aria-expanded={open}
                  onClick={() =>
                    setOpenGroups((s) => {
                      const next = new Set(s)
                      if (next.has(group) && group !== experiment.group) next.delete(group)
                      else next.add(group)
                      return next
                    })
                  }
                >
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span> {group}
                  <span className="group-count">{inGroup(group).length}</span>
                </button>
                {open ? (
                  <ul className="lesson-list">
                    {inGroup(group).map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          className={`preset${e.id === experiment.id ? ' is-on' : ''}`}
                          onClick={() => load(EXPERIMENTS.indexOf(e))}
                        >
                          <b>{e.id}</b> {e.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })}
          <LessonNav
            index={index}
            total={EXPERIMENTS.length}
            onPrev={() => load(Math.max(0, index - 1))}
            onNext={() => load(Math.min(EXPERIMENTS.length - 1, index + 1))}
            onReset={reset}
            dirty={dirty}
            noun="experiment"
          />
        </section>

        <section className="note">
          <h2>
            {experiment.id} · {experiment.name}
          </h2>
          <p className="hint">{experiment.see}</p>
          <TryLine
            text={experiment.try[0].say}
            chips={chips}
            onChip={(c) => setState(applyStep(experiment, c.step))}
          />
          <details className="why">
            <summary>Why</summary>
            <p>{experiment.why}</p>
          </details>
          <details className="terms" open={termsOpen} onToggle={(e) => setTermsOpen(e.currentTarget.open)}>
            <summary>Words in this experiment</summary>
            <dl>
              {termsFor([...experiment.terms, ...TOPBAR_TERMS.filter((t) => !experiment.terms.includes(t))]).map((t) => (
                <React.Fragment key={t.id}>
                  <dt>{t.name}</dt>
                  <dd>{t.def}</dd>
                </React.Fragment>
              ))}
            </dl>
          </details>
        </section>

        <section>
          <h2>Plant</h2>
          {PLANT_GROUPS.map((g) => {
            const inThis = Object.entries(PLANTS).filter(([, p]) => p.group === g)
            if (!inThis.length) return null
            return (
              <div key={g} className="group">
                <div className="group-head is-static">{g}</div>
                <div className="segmented sm">
                  {inThis.map(([id, p]) => (
                    <button
                      key={id}
                      type="button"
                      className={id === state.plantId ? 'on' : ''}
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          plantId: id,
                          plantP: Object.fromEntries(p.params.map((q) => [q.key, q.value])),
                        }))
                      }
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <p className="hint">{plant.hint}</p>
          {plant.params.map((q) => (
            <NumField
              key={q.key}
              label={q.label}
              value={state.plantP[q.key]}
              onChange={(v) => setPlantParam(q.key, v)}
              min={q.min}
              max={q.max}
              scale={q.scale}
              unit={q.unit}
            />
          ))}
        </section>

        <section>
          <h2>Controller</h2>
          <div className="segmented sm">
            {Object.entries(CONTROLLERS).map(([id, c]) => (
              <button
                key={id}
                type="button"
                className={id === state.ctrlId ? 'on' : ''}
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    ctrlId: id,
                    ctrlP: Object.fromEntries(c.params.map((q) => [q.key, q.value])),
                  }))
                }
              >
                {c.name}
              </button>
            ))}
          </div>
          <p className="hint">{ctrl.hint}</p>
          {ctrl.params.map((q) => (
            <NumField
              key={q.key}
              label={q.label}
              value={state.ctrlP[q.key]}
              onChange={(v) => setCtrlParam(q.key, v)}
              min={q.min}
              max={q.max}
              scale={q.scale}
              unit={q.unit}
            />
          ))}
        </section>

        {showSampling ? (
          <section>
            <h2>Sampling</h2>
            <NumField
              label="Sample time"
              value={a.sampled.Ts}
              onChange={(v) => setState((s) => ({ ...s, Ts: v, perCycle: null }))}
              min={1e-4}
              max={10}
              scale="log"
              unit="s"
            />
            <div className="field">
              <span className="field-label">Emulation rule</span>
              <div className="segmented sm">
                {['tustin', 'backward', 'forward'].map((rule) => (
                  <button
                    key={rule}
                    type="button"
                    className={rule === a.sampled.method ? 'on' : ''}
                    onClick={() => setState((s) => ({ ...s, emulation: rule }))}
                  >
                    {rule}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {showNonlinear ? (
          <section>
            <h2>Nonlinearity</h2>
            <div className="segmented sm">
              {Object.entries(NONLINEARITIES).map(([id, n]) => (
                <button
                  key={id}
                  type="button"
                  className={id === state.nlId ? 'on' : ''}
                  onClick={() => setState((s) => ({ ...s, nlId: id }))}
                >
                  {n.name}
                </button>
              ))}
            </div>
            <p className="hint">{NONLINEARITIES[state.nlId]?.hint}</p>
            <details className="terms">
              <summary>Words in this picker</summary>
              <dl>
                {termsFor(PICKER_TERMS).map((t) => (
                  <React.Fragment key={t.id}>
                    <dt>{t.name}</dt>
                    <dd>{t.def}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </details>
            {state.nlId !== 'none' ? (
              <NumField
                label="Limit δ"
                value={state.delta}
                onChange={(v) => setState((s) => ({ ...s, delta: v }))}
                min={0.05}
                max={1e9}
                scale="log"
              />
            ) : null}
          </section>
        ) : null}

        <MathPanel getEntry={() => ({ blocks: experimentMath(a) })} label="The math" />
        <ReportIssue
          lab="control-lab-ii"
          version={pkg.version}
          state={state}
          summary={reportSummary(state, experiment)}
        />
      </aside>

      <div className="topbar">
        <LoopDiagram
          ctrlLabel={ctrl.name}
          plantLabel={plant.name}
          sampled={showSampling ? { Ts: `${fmtNum(a.sampled.Ts, 3)} s` } : null}
          nonlinear={
            showNonlinear && state.nlId !== 'none'
              ? { label: NONLINEARITIES[state.nlId].name, sub: `limit ${fmtNum(state.delta, 3)}` }
              : null
          }
          feedback={state.design?.method ? 'state' : 'unity'}
        />
        <div className="topbar-controls">
          <span className={`badge is-${bar.verdict.tone}`}>{bar.verdict.word}</span>
          <span className="topbar-field" title={`Every pole ${bar.where}.`}>
            {bar.where}
          </span>
          <span className="topbar-field" title={bar.margins.phase.note || 'Phase margin at crossover.'}>
            PM {bar.margins.phase.text}
          </span>
          <span className="topbar-field" title={bar.margins.gain.note || 'Gain margin.'}>
            GM {bar.margins.gain.text}
          </span>
          {bar.guard ? (
            <span
              className={`guard${bar.guard.holds ? '' : ' is-broken'}`}
              title={bar.guard.reason || bar.guard.beside || ''}
            >
              {bar.guard.approximate ? <b className="approx">approximate</b> : null} {bar.guard.label}{' '}
              <b>{bar.guard.value}</b>
              {bar.guard.threshold ? <span className="aside"> against {bar.guard.threshold}</span> : null}
            </span>
          ) : null}
        </div>
      </div>

      <div className="views">
        {[upper, lower].map((view, i) => (
          <section className="view" key={`${view}-${i}`}>
            <div className="view-head">
              <h2>{VIEWS[view] || view}</h2>
              <div className="readout">{readoutFor(view, a)}</div>
            </div>
            <Pane view={view} a={a} plant={plant} loads={loads} />
          </section>
        ))}
      </div>

      {bar.guard && !bar.guard.holds && bar.guard.reason ? (
        <p className="guard-banner" role="status">
          {bar.guard.reason}
        </p>
      ) : null}
    </div>
  )
}

/** The numbers beside a pane's own heading. */
function readoutFor(view, a) {
  if (view === 'state' && a.filter) {
    // The filter's own pane: the same matrices, with L in place of K and the
    // residual of the equation it solved beside it.
    return (
      <StatePane
        ss={a.filter.ss}
        states={plant.states}
        ctrl={{ rank: a.filter.ss.n, n: a.filter.ss.n, condition: 1 }}
        obs={{ rank: a.filter.ss.n, n: a.filter.ss.n, condition: 1 }}
        place={null}
        lqr={null}
        observer={{ L: a.filter.L }}
        declined={null}
      />
    )
  }
  if (view === 'state' && a.state_) {
    return (
      <>
        <span>
          rank <b>{a.state_.ctrl.rank}</b> of <b>{a.state_.ss.n}</b>
        </span>
        <span>
          condition <b>{Number.isFinite(a.state_.ctrl.condition) ? fmtNum(a.state_.ctrl.condition, 4) : '∞'}</b>
        </span>
      </>
    )
  }
  if (view === 'sampled' && a.sampled) {
    return (
      <>
        <span>
          Ts <b>{fmtNum(a.sampled.Ts, 4)} s</b>
        </span>
        <span>
          the plant is exact to <b>{a.sampled.plantDisagreement.toExponential(1)}</b>
        </span>
        <span>
          the emulated loop differs by <b>{fmtNum(100 * a.sampled.disagreement, 3)} %</b>
        </span>
      </>
    )
  }
  if ((view === 'phase' || view === 'bode') && a.nonlinear) {
    const n = a.nonlinear
    return (
      <>
        <span>
          peak <b>{fmtNum(n.peak, 4)}</b>
        </span>
        <span>
          wind <b>{fmtNum(n.wind, 4)}</b>
        </span>
        {n.predicted && n.measured ? (
          <span>
            predicted <b>{fmtNum(n.predicted.amplitude, 4)}</b>, measured <b>{fmtNum(n.measured.amplitude, 4)}</b>
          </span>
        ) : null}
      </>
    )
  }
  if (view === 'fit' && a.fit) {
    const d = a.fit.design
    return (
      <>
        <span>
          τ <b>{fmtNum(a.fit.first.tau, 5)} s</b>
        </span>
        <span>
          residual <b>{fmtNum(100 * a.fit.first.relResidual, 3)} %</b>
        </span>
        {a.fit.ensemble ? (
          <span>
            over <b>{a.fit.ensemble.n}</b> runs, mean <b>{fmtNum(a.fit.ensemble.mean, 5)} s</b>, spread{' '}
            <b>{fmtNum(a.fit.ensemble.spread, 3)} s</b>
          </span>
        ) : null}
        {d ? (
          <span>
            {/* Both halves, always. A design's predicted margin without the
                one it actually got is the defect E5 is about. */}
            first-order design predicts <b>{fmtNum(d.first.predicted.phaseMargin, 4)}°</b>, gets{' '}
            <b>{fmtNum(d.first.measured.phaseMargin, 4)}°</b>
          </span>
        ) : null}
        {d ? (
          <span>
            second-order design predicts <b>{fmtNum(d.second.predicted.phaseMargin, 4)}°</b>, gets{' '}
            <b>{fmtNum(d.second.measured.phaseMargin, 4)}°</b>
          </span>
        ) : null}
      </>
    )
  }
  if (view === 'state' && a.filter) {
    return (
      <>
        <span>
          L <b>[{a.filter.L.map((v) => fmtNum(v, 5)).join(', ')}]</b>
        </span>
        <span>
          model over measurement <b>{fmtNum(a.filter.ratio, 4)}</b>
        </span>
        <span>
          filter residual <b>{a.filter.filterResidual.relative.toExponential(1)}</b>
        </span>
      </>
    )
  }
  return null
}

/** One pane. */
function Pane({ view, a, plant }) {
  if (view === 'state' && a.state_) {
    return (
      <StatePane
        ss={a.state_.ss}
        states={plant.states}
        ctrl={a.state_.ctrl}
        obs={a.state_.obs}
        place={a.state_.place}
        lqr={a.state_.lqr}
        observer={a.state_.observer}
        declined={a.state_.declined}
      />
    )
  }
  if (view === 'step') {
    if (a.nonlinear) {
      const t = a.nonlinear.trajectory
      return <StepCanvas t={t.t} y={t.y} drive={t.u} reference={a.state.reference} yLabel="Output" />
    }
    if (a.state_?.step) {
      return <StepCanvas t={a.state_.step.t} y={a.state_.step.y} reference={1} yLabel="Output" />
    }
    return <p className="hint empty">This experiment has no step to draw.</p>
  }
  if (view === 'sampled' && a.sampled) {
    const s = a.sampled
    return (
      <StepCanvas
        t={s.continuous.t}
        y={s.digital.y}
        ghost={s.continuous.y}
        samples={{ t: s.digital.t, y: s.digital.y }}
        reference={1}
        yLabel="Output"
      />
    )
  }
  if (view === 'bode') {
    return (
      <BodeCanvas
        tf={a.open}
        freqs={FREQS}
        crossover={a.margins.gainCrossover}
        phaseCrossover={a.margins.phaseCrossover}
      />
    )
  }
  if (view === 'poles') {
    return <PoleZeroCanvas poles={a.pz.poles} zeros={a.pz.zeros} />
  }
  if (view === 'zplane' && a.sampled) {
    return <ZPlaneCanvas poles={a.sampled.zPoles} zeros={a.sampled.plantZ.zeros} />
  }
  if (view === 'phase' && a.nonlinear) {
    const n = a.nonlinear
    if (n.n !== 2) {
      return (
        <p className="hint empty">
          This loop carries {n.n} states, and a plane has two axes. The plane is declined rather than
          drawn as a projection that would look like a trajectory and would not be one.
        </p>
      )
    }
    return (
      <PhaseCanvas
        trajectories={[{ x: n.trajectory.x }]}
        field={n.field}
        lines={n.lines || []}
        equilibria={n.equilibria}
        levels={n.lyapunov ? [{ P: n.lyapunov.P, values: [0.25, 1, 4] }] : []}
        span={n.span}
        xLabel="Integral of error"
        yLabel="Output"
      />
    )
  }
  if (view === 'fit' && a.fit) {
    return (
      <FitCanvas
        t={a.fit.data.t}
        y={a.fit.data.y}
        model={a.fit.first.model}
        second={a.fit.second.model}
        label="first order"
        residual={a.fit.first.relResidual}
      />
    )
  }
  return <p className="hint empty">Nothing to draw in this view.</p>
}

/** The frequency grid the Bode pane draws on, in hertz. */
const FREQS = Float64Array.from({ length: 900 }, (_, i) => Math.pow(10, -3 + 6 * (i / 899)))
