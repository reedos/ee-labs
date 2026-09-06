import React, { useEffect, useMemo, useState } from 'react'
import { LabNav, LessonNav, NumField, ReportIssue, Schematic, TimingCanvas, TryLine } from '@ee-labs/ui'
import { MathBody, MathPanel } from '@ee-labs/explain'
import { analyse } from './pin.js'
import { EXPERIMENTS, KNOBS, MODELS, byId, defaultsOf, pinLayout } from './experiments.js'
import { LESSONS, number } from './lessons.js'
import { TERMS } from './terms.js'
import { mathEntry } from './math.js'
import LoadCanvas from './components/LoadCanvas.jsx'
import pkg from '../package.json'

const ns = (t) => number(t, 'ns', 1e-9)
const volts = (v) => number(v, 'V')
const initialId = () => byId[window.location.hash.slice(1)] ? window.location.hash.slice(1) : 'a1'
const initialView = (id) => id === 'a4' ? 'sweep' : id === 'a5' ? 'margins' : 'waveform'

export default function App() {
  const [id, setId] = useState(initialId)
  const [params, setParams] = useState(() => defaultsOf(initialId()))
  const [view, setView] = useState(() => initialView(initialId()))
  const [direction, setDirection] = useState('rise')
  const [cursor, setCursor] = useState(0)
  const [analog, setAnalog] = useState(true)
  const exp = byId[id]
  const lesson = LESSONS[id]
  const index = EXPERIMENTS.indexOf(exp)
  const outcome = useMemo(() => {
    try { return { result: analyse(params) } }
    catch (error) { return { error: error.message } }
  }, [params])
  const x = outcome.result
  const dirty = Object.entries(defaultsOf(id)).some(([key, value]) => params[key] !== value)
  const reset = () => { setParams(defaultsOf(id)); setCursor(0) }
  const choose = (next) => {
    setId(next)
    setParams(defaultsOf(next))
    setView(initialView(next))
    setDirection('rise')
    setCursor(0)
    setAnalog(true)
    window.history.replaceState(null, '', `#${next}`)
  }
  useEffect(() => {
    const onHash = () => choose(initialId())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => { document.querySelector('.controls')?.scrollTo({ top: 0 }) }, [id])
  const setParam = (key, value) => { setParams((p) => ({ ...p, [key]: value })); setCursor(0) }
  const run = x?.[direction]
  const timeUnit = run?.tEnd >= 1e-6 ? { unit: 'us', scale: 1e-6 } : { unit: 'ns', scale: 1e-9 }
  const t = run ? Math.min(cursor, run.tEnd) : 0
  const now = run?.at(t)
  const entry = x ? mathEntry(id, params, x) : null
  const views = ['waveform', ...(id === 'a4' ? ['sweep'] : []), ...(id === 'a5' ? ['margins'] : []), 'equations']
  const slack = x ? id === 'a5' ? x.margins.slack : id === 'a4' ? x.budget.slack : null : null
  return <div className="app interfaces-app">
    <aside className="controls">
      <header>
        <LabNav current="interfaces-lab" currentLabel="Interfaces" />
        <h1>Interfaces Lab</h1>
        <ReportIssue lab="Interfaces Lab" version={pkg.version} state={{ id, params, view, direction, cursor }}
          summary={`${id.toUpperCase()}: ${exp.name}`} />
      </header>
      <section className="lesson">
        <h2>Experiment</h2>
        <LessonNav index={index} total={EXPERIMENTS.length} noun="experiment" dirty={dirty}
          onPrev={() => index > 0 && choose(EXPERIMENTS[index - 1].id)}
          onNext={() => index < EXPERIMENTS.length - 1 && choose(EXPERIMENTS[index + 1].id)} onReset={reset} />
        <details className="preset-group" open>
          <summary onClick={(event) => event.preventDefault()}>A. The pin</summary>
          <div className="presets">{EXPERIMENTS.map((e) => <button type="button" key={e.id}
            className={`preset${e.id === id ? ' is-on' : ''}`} aria-current={e.id === id ? 'step' : undefined}
            onClick={() => choose(e.id)}><b>{e.id.toUpperCase()}</b> {e.name}</button>)}</div>
        </details>
        <h3>{exp.name}</h3>
        {x ? <p className="hint see" data-role="see">{lesson.see(x, params)}</p> : null}
        <details className="terms"><summary>Terms used here</summary>
          {exp.terms.map((key) => <div key={key}><h4>{TERMS[key].name}</h4><p className="hint">{TERMS[key].def}</p></div>)}
        </details>
        <h4>Try</h4>
        {lesson.try.map((step, i) => <TryLine key={i} text={step.say} chips={[{ label: 'apply' }]}
          onChip={() => { setParams((previous) => ({ ...previous, ...step.set })); setCursor(0) }} />)}
      </section>
      <section className="knobs">
        <h2>Pin model</h2>
        <label className="model-label">Model<select aria-label="Pin model" value={exp.model}
          onChange={(event) => choose(EXPERIMENTS.find((e) => e.model === event.target.value).id)}>
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select></label>
        {exp.knobs.map((key) => <NumField key={key} {...KNOBS[key]} value={params[key]} eng
          onChange={(value) => setParam(key, value)} />)}
      </section>
      <section className="deeper">
        <details><summary>Why it works</summary><p className="hint why" data-role="why">{lesson.why}</p></details>
        <MathPanel entry={entry} label="Equations" />
      </section>
    </aside>
    <header className="topbar" aria-live="polite">
      <strong>{id.toUpperCase()}</strong>
      {x && <>
        {slack !== null && <span className={slack < 0 ? 'failed' : 'passed'}>Remaining {id === 'a5' ? volts(slack) : ns(slack)}</span>}
        <span>Rise <b data-reading="rise">{ns(x.rise.tr)}</b></span>
        <span>VIH <b>{volts(x.thresholds.vih)}</b></span>
      </>}
    </header>
    <main className="workspace">
      {outcome.error ? <div className="refusal" role="alert"><h2>Model boundary</h2><p>{outcome.error}</p><button onClick={reset}>Reset experiment</button></div> : <>
        <section className="pin-section" aria-label="Analog pin">
          <div className="section-heading"><h2>{MODELS.find((m) => m.id === exp.model).name}</h2>
            <div className="segments" role="group" aria-label="Transition">{['rise', 'fall'].map((d) =>
              <button type="button" key={d} aria-pressed={direction === d} onClick={() => { setDirection(d); setCursor(0) }}>{d === 'rise' ? 'Rising' : 'Falling'}</button>)}</div>
          </div>
          <div className="pin-content">
            <Schematic elements={now.segment.net.elements} layout={pinLayout(params.drive)} meters={now.sol} show="i" />
            <dl className="readings">
              <dt>Time</dt><dd>{ns(t)}</dd><dt>Pin voltage</dt><dd data-reading="voltage">{volts(now.x[0])}</dd>
              <dt>Input level</dt><dd>{now.x[0] <= x.thresholds.vil ? 'Low' : now.x[0] >= x.thresholds.vih ? 'High' : 'Undefined'}</dd>
              <dt>VIL</dt><dd>{volts(x.thresholds.vil)}</dd><dt>VIH</dt><dd>{volts(x.thresholds.vih)}</dd>
              <dt>{direction === 'rise' ? 'Delay to VIH' : 'Delay to VIL'}</dt><dd>{ns(direction === 'rise' ? run.tpLH : run.tpHL)}</dd>
              <dt>{direction === 'rise' ? '10-90% rise' : '90-10% fall'}</dt><dd>{ns(direction === 'rise' ? run.tr : run.tf)}</dd>
            </dl>
          </div>
          <label className="cursor-label">Time cursor<input type="range" aria-label="Time cursor" min="0" max="1000"
            value={t / run.tEnd * 1000} onChange={(event) => setCursor(Number(event.target.value) / 1000 * run.tEnd)} /></label>
        </section>
        <section className="view-section">
          <div className="view-tabs" role="tablist" aria-label="Pin views">{views.map((v) => <button key={v} role="tab" aria-selected={view === v}
            onClick={() => setView(v)}>{({ waveform: 'Waveform', sweep: 'Load sweep', margins: 'Noise budget', equations: 'Equations' })[v]}</button>)}</div>
          <div role="tabpanel" className="view-content">
            {view === 'waveform' && <>
              <label className="analog-toggle"><input type="checkbox" checked={analog} onChange={(event) => setAnalog(event.target.checked)} />Analog voltage</label>
              <TimingCanvas res={{ waves: { Drive: { t: [0], v: [direction === 'rise' ? 1 : 0] } }, events: [], tEnd: run.tEnd * 1e12 }}
                signals={['Drive']} analog={analog ? [{ label: 'Pin (V)', min: 0, max: params.vdd, vLow: x.thresholds.vil, vHigh: x.thresholds.vih,
                  unit: 'V', samples: run.samples.map((s) => ({ t: s.t * 1e12, v: s.v })) }] : []}
                window={[0, run.tEnd * 1e12]} cursor={t * 1e12} onCursor={(ps) => setCursor(ps * 1e-12)}
                fmtTime={(ps) => Number((ps * 1e-12 / timeUnit.scale).toPrecision(3)).toString()} />
              <p className="caption">Pin voltage (V). Time ({timeUnit.unit}).</p>
              <div className="threshold-key"><span>VIL {volts(x.thresholds.vil)}</span><span>VIH {volts(x.thresholds.vih)}</span></div>
              <p className="hint">{direction === 'rise' ? 'The capacitor starts at zero volts.' : 'The capacitor starts at the supply voltage.'}</p>
              {x.budget.reason && <p className="hint" role="status">{x.budget.reason}</p>}
            </>}
            {view === 'sweep' && <><LoadCanvas params={params} result={x} /><p className="caption">The dashed line marks the rise budget. The dot marks the current capacitance.</p></>}
            {view === 'margins' && <NoiseBudget x={x} p={params} />}
            {view === 'equations' && <MathBody entry={entry} />}
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
