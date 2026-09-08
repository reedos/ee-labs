import React, { useEffect, useMemo, useState } from 'react'
import { LabNav, LessonNav, NumField, PlaybackControls, ReportIssue, Schematic, TryLine, usePlayback } from '@ee-labs/ui'
import { ChipContext, MathBody } from '@ee-labs/explain'
import { analyse } from './pin.js'
import { EXPERIMENTS, KNOBS, MODELS, byId, defaultsOf, pinLayout } from './experiments.js'
import { LESSONS, number } from './lessons.js'
import { TERMS } from './terms.js'
import { FOUNDATIONS, PARAMETER_ROLES, signalStory } from './foundations.js'
import { mathEntry } from './math.js'
import LoadCanvas from './components/LoadCanvas.jsx'
import PinCanvas from './components/PinCanvas.jsx'
import BudgetCanvas from './components/BudgetCanvas.jsx'
import PlotLegend from './components/PlotLegend.jsx'
import { INPUT_LIMITS, waveformKey } from './plotLabels.js'
import { scopeReading, scopeRun, scopeWindow } from './scope.js'
import pkg from '../package.json'

const ns = (t) => number(t, 'ns', 1e-9)
const volts = (v) => number(v, 'V')
const initialId = () => byId[window.location.hash.slice(1)] ? window.location.hash.slice(1) : 'a1'
const initialView = (id) => id === 'a4' ? 'sweep' : id === 'a5' ? 'margins' : 'waveform'
const shortNames = { a1: 'Output switches', a2: 'Input thresholds', a3: 'Pull-up and rise', a4: 'Load and rise time', a5: 'Ground bounce' }

export default function App() {
  const [id, setId] = useState(initialId)
  const [params, setParams] = useState(() => defaultsOf(initialId()))
  const [view, setView] = useState(() => initialView(initialId()))
  const sweepPlayback = usePlayback({ resetKey: `${id}:${view}` })
  const [direction, setDirection] = useState('rise')
  const [timeEnd, setTimeEnd] = useState(() => scopeWindow(defaultsOf(initialId()), 'rise'))
  const [rangeDirty, setRangeDirty] = useState(false)
  const [rangeReset, setRangeReset] = useState(0)
  const playback = usePlayback({ resetKey: `${id}:${direction}:${view}` })
  const [analog, setAnalog] = useState(true)
  const exp = byId[id]
  const lesson = LESSONS[id]
  const foundation = FOUNDATIONS[id]
  const signal = signalStory(id, direction)
  const jump = (target) => document.getElementById(target)?.scrollIntoView({ block: 'start' })
  const index = EXPERIMENTS.indexOf(exp)
  const outcome = useMemo(() => {
    try { return { result: analyse(params) } }
    catch (error) { return { error: error.message } }
  }, [params])
  const x = outcome.result
  const dirty = rangeDirty || timeEnd !== scopeWindow(defaultsOf(id), direction)
    || Object.entries(defaultsOf(id)).some(([key, value]) => params[key] !== value)
  const reset = () => {
    setParams(defaultsOf(id))
    setTimeEnd(scopeWindow(defaultsOf(id), direction))
    playback.reset()
    sweepPlayback.reset()
    setRangeDirty(false)
    setRangeReset((value) => value + 1)
  }
  const choose = (next) => {
    setId(next)
    setParams(defaultsOf(next))
    setView(initialView(next))
    setDirection('rise')
    playback.reset()
    setTimeEnd(scopeWindow(defaultsOf(next), 'rise'))
    setAnalog(true)
    setRangeDirty(false)
    setRangeReset((value) => value + 1)
    window.history.replaceState(null, '', `#${next}`)
  }
  useEffect(() => {
    const onHash = () => choose(initialId())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => { document.querySelector('.controls')?.scrollTo({ top: 0 }) }, [id])
  const setParam = (key, value) => setParams((p) => ({ ...p, [key]: value }))
  const run = useMemo(() => x ? scopeRun(params, direction, timeEnd) : null, [x, params, direction, timeEnd])
  const reference = useMemo(() => scopeRun(defaultsOf(id), direction, timeEnd), [id, direction, timeEnd])
  const measured = x?.[direction]
  const t = playback.position * timeEnd
  const now = run ? scopeReading(run, t, params.cload) : null
  const entry = useMemo(() => x ? mathEntry(id, params, x, { direction }) : null, [id, params, x, direction])
  const cursorEntry = now ? { blocks: [
    { kind: 'text', text: `At t = ${ns(t)}, capacitor current is ${number(now.current, 'mA', 1e-3)} and stored energy is ${number(now.energy, 'pJ', 1e-12)}.` },
    { kind: 'formula', tex: 'i_C=(V_\\infty-v)/R_{eq}' },
    { kind: 'formula', tex: 'E_C=\\frac12 Cv^2' },
  ] } : null
  const views = ['waveform', ...(id === 'a4' ? ['sweep'] : []), ...(id === 'a5' ? ['margins'] : []), 'equations']
  const slack = x ? id === 'a5' ? x.margins.slack : id === 'a4' ? x.budget.slack : null : null
  return <div className="app interfaces-app">
    <aside className="controls">
      <header>
        <LabNav current="interfaces-lab" currentLabel="Interfaces" />
        <h1>Interfaces Lab</h1>
        <ReportIssue lab="Interfaces Lab" version={pkg.version} state={{ id, params, view, direction, cursor: t }}
          summary={`${id.toUpperCase()}: ${exp.name}`} />
      </header>
      <section className="picker">
        <h2>A. The pin</h2>
        <LessonNav index={index} total={EXPERIMENTS.length} noun="experiment" dirty={dirty}
          onPrev={() => index > 0 && choose(EXPERIMENTS[index - 1].id)}
          onNext={() => index < EXPERIMENTS.length - 1 && choose(EXPERIMENTS[index + 1].id)} onReset={reset} />
        <select aria-label="Experiment" value={id} onChange={(event) => choose(event.target.value)}>
          {EXPERIMENTS.map((e) => <option key={e.id} value={e.id}>{e.id.toUpperCase()}. {shortNames[e.id]}</option>)}
        </select>
      </section>
      <section className="knobs" id="pin-settings">
        <h2>Pin settings</h2>
        {exp.knobs.map((key) => <div key={key}><NumField {...KNOBS[key]} value={params[key]} eng
          onChange={(value) => setParam(key, value)} /><p className="parameter-role">{PARAMETER_ROLES[key]}</p></div>)}
        <label className="model-label">Circuit study<select aria-label="Circuit study" value={exp.model}
          onChange={(event) => choose(EXPERIMENTS.find((e) => e.model === event.target.value).id)}>
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select></label>
      </section>
      <section className="lesson">
        <h2>{exp.name}</h2>
        <p className="hint">{foundation.purpose}</p>
        {x ? <p className="hint see" data-role="see">{lesson.see(x, params)}</p> : null}
        <details className="terms"><summary>Terms used here</summary>
          {exp.terms.map((key) => <div key={key}><h4>{TERMS[key].name}</h4><p className="hint">{TERMS[key].def}</p></div>)}
        </details>
        <h4>Try</h4>
        {lesson.try.map((step, i) => <TryLine key={i} text={step.say} chips={[{ label: 'apply' }]}
          onChip={() => setParams((previous) => ({ ...previous, ...step.set }))} />)}
      </section>
    </aside>
    <nav className="phone-sections" aria-label="Experiment sections">
      {[['pin-lesson', 'Lesson'], ['pin-settings', 'Settings'], ['pin-circuit', 'Circuit'], ['pin-plots', 'Plots'], ['pin-math', 'Math']].map(([target, label]) =>
        <button key={target} type="button" onClick={() => jump(target)}>{label}</button>)}
    </nav>
    <header className="topbar" aria-live="polite">
      <strong>{id.toUpperCase()}</strong>
      {x && <>
        {slack !== null && <span className={slack < 0 ? 'failed' : 'passed'}>Remaining {id === 'a5' ? volts(slack) : ns(slack)}</span>}
        <span>Rise <b data-reading="rise">{ns(x.rise.tr)}</b></span>
        <span>High input minimum (VIH) <b>{volts(x.thresholds.vih)}</b></span>
      </>}
    </header>
    <main className="workspace">
      {outcome.error ? <div className="refusal" role="alert"><h2>Model boundary</h2><p>{outcome.error}</p><button onClick={reset}>Reset experiment</button></div> : <>
        <div className="instrument">
        <section className="pin-section" id="pin-circuit" aria-label="Analog pin">
          <div className="section-heading"><h2>{id === 'a2' ? 'Push-pull source / CMOS receiver limits' : MODELS.find((m) => m.id === exp.model).name}</h2>
            <div className="segments" role="group" aria-label="Transition">{['rise', 'fall'].map((d) =>
              <button type="button" key={d} aria-pressed={direction === d} onClick={() => {
                setDirection(d); playback.reset(); setTimeEnd(scopeWindow(defaultsOf(id), d))
              }}>{d === 'rise' ? 'Rising' : 'Falling'}</button>)}</div>
          </div>
          <div className="pin-content">
            <Schematic elements={now.segment.net.elements} layout={pinLayout(params.drive)} meters={now.sol} show="i" />
            <dl className="readings">
              <dt>Time</dt><dd data-reading="time">{ns(t)}</dd><dt>Pin voltage</dt><dd data-reading="voltage">{volts(now.x[0])}</dd>
              <dt>Capacitor current</dt><dd data-reading="current">{number(now.current, 'mA', 1e-3)}</dd>
              <dt>Stored energy</dt><dd>{number(now.energy, 'pJ', 1e-12)}</dd>
              <dt>Input level</dt><dd>{now.x[0] <= x.thresholds.vil ? 'Low' : now.x[0] >= x.thresholds.vih ? 'High' : 'Undefined'}</dd>
              <dt>Low input maximum (VIL)</dt><dd>{volts(x.thresholds.vil)}</dd><dt>High input minimum (VIH)</dt><dd>{volts(x.thresholds.vih)}</dd>
              <dt>{direction === 'rise' ? 'Delay to VIH' : 'Delay to VIL'}</dt><dd>{ns(direction === 'rise' ? measured.tpLH : measured.tpHL)}</dd>
              <dt>{direction === 'rise' ? '10-90% rise' : '90-10% fall'}</dt><dd>{ns(direction === 'rise' ? measured.tr : measured.tf)}</dd>
            </dl>
          </div>
        </section>
        <section className="view-section" id="pin-plots">
          <div className="view-tabs" role="tablist" aria-label="Pin views">{views.map((v) => <button key={v} role="tab" aria-selected={view === v}
            onClick={() => setView(v)}>{({ waveform: 'Waveform', sweep: 'Load sweep', margins: 'Noise budget', equations: 'Equations' })[v]}</button>)}</div>
          <div className="transport-row"><PlaybackControls playback={view === 'sweep' || view === 'margins' ? sweepPlayback : playback}
            label={view === 'sweep' ? 'Load sweep cursor' : view === 'margins' ? 'Pin count cursor' : 'Time cursor'} />
            {(view === 'waveform' || view === 'equations') && <><span className="time-window">0 - {ns(timeEnd)}</span>
            <button className="ghost fit-range" aria-label="Fit time" title="Fit the current and default waveforms" onClick={() => {
              setTimeEnd(Math.max(scopeWindow(params, direction), scopeWindow(defaultsOf(id), direction))); playback.reset()
            }}>{'\u2922'}</button></>}
          </div>
          <p className="caption">Playback speed changes the observation rate, not the circuit timing. {view === 'sweep' || view === 'margins' ? 'The moving probe does not change the selected circuit.' : 'Time and axis range are observation settings.'}</p>
          <div role="tabpanel" className="view-content">
            {view === 'waveform' && <>
              <PlotLegend items={waveformKey(analog)} />
              <label className="analog-toggle"><input type="checkbox" checked={analog} onChange={(event) => setAnalog(event.target.checked)} />Analog voltage</label>
              <PinCanvas run={run} reference={reference} thresholds={x.thresholds} time={t}
                onTime={(time) => playback.setPosition(time / timeEnd)} analog={analog} />
              <p className="caption">{direction === 'rise' ? 'The capacitor starts at zero volts.' : 'The capacitor starts at the supply voltage.'}
                {' '}The shaded interval is the undefined logic region.</p>
              {(direction === 'rise' ? run.tr : run.tf) === null && <p className="hint" role="status">The 10-90% transition extends beyond this time window.</p>}
              {x.budget.reason && <p className="hint" role="status">{x.budget.reason}</p>}
            </>}
            {view === 'sweep' && <LoadCanvas key={rangeReset} params={params} result={x} position={sweepPlayback.position} onFit={() => setRangeDirty(true)} />}
            {view === 'margins' && <><BudgetCanvas key={rangeReset} margins={x.margins} pins={params.pins} position={sweepPlayback.position} onFit={() => setRangeDirty(true)} /><NoiseBudget x={x} p={params} /></>}
            {view === 'equations' && <MathBody entry={entry} />}
          </div>
        </section>
        </div>
        <section className="analysis-notes" aria-label="Worked analysis">
          <div className="foundation" id="pin-lesson" data-role="foundation">
            <ChipContext />
            <h2>Purpose</h2><p>{foundation.purpose}</p><p>{foundation.context}</p>
            <h3>Input voltage limits</h3><p>{INPUT_LIMITS}</p>
            <h3>Input</h3><p data-role="signal-input">{signal.input}</p>
            <h3>Expected output</h3><p data-role="signal-output">{signal.output}</p>
            {id === 'a5' && <p>The noise budget compares static output levels and a separate current ramp. These budget parameters do not alter the RC trace above.</p>}
            <h3>Predict the change</h3><p>{foundation.prediction}</p>
            <h3>Design tradeoffs</h3><p>{foundation.tradeoff}</p>
            <h3>Model limits</h3><p>{foundation.limits}</p>
          </div>
          <div className="analysis-body" id="pin-math">
          <h2>{exp.name}</h2>
          <p className="hint why" data-role="why">{lesson.why}</p>
          {view !== 'equations' && <><h3>From the circuit to the numbers</h3><MathBody entry={entry} /></>}
          <h3>At the time cursor</h3>
          <MathBody entry={cursorEntry} />
          </div>
        </section>
      </>}
    </main>
  </div>
}

function NoiseBudget({ x, p }) {
  const m = x.margins
  return <>
    <h3>Lumped current-ramp budget</h3>
    <table className="budget-table"><thead><tr><th>Quantity</th><th>Value</th></tr></thead><tbody>
      {[['Low output VOL', volts(m.vol)], ['High output VOH', volts(m.voh)], ['Low noise margin', volts(m.nml)],
        ['High noise margin', volts(m.nmh)], ['Current step per pin', number(m.currentStep, 'mA', 1e-3)],
        ['Current ramp time', ns(p.edgeTime)], ['Ground bounce', volts(m.bounce)], ['Remaining margin', volts(m.slack)],
        ['Maximum pins', Number.isFinite(m.maxPins) ? String(m.maxPins) : 'Unbounded at zero inductance']].map(([label, value]) =>
        <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}
    </tbody></table>
    <p className="hint">The ramp budget is separate from the RC waveform. Package ringing and board behavior are outside this model.</p>
  </>
}
