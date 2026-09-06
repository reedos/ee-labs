import React, { useEffect, useMemo, useState } from 'react'
import { COLORS, LabNav, LessonNav, NumField, PlaybackControls, ReportIssue, Schematic, TimingCanvas, TryLine, usePlayback } from '@ee-labs/ui'
import { MathBody } from '@ee-labs/explain'
import { CARD, CU, DEFAULTS, LAYOUT, dcPoint, transfer } from './model.js'
import { EVENT_GUARD, extractGate } from './extract.js'
import { EXPERIMENTS, analyse, ps, volts } from './experiments.js'
import { TERMS } from './terms.js'
import { DEFAULT_AXES, fitAxis, logicReadings, scopePoints, timingComparison } from './presentation.js'
import { workedMath } from './math.js'
import Plot from './Plot.jsx'
import { Foundations, playbackMeaning } from './Foundations.jsx'

const VIEWS = { scope: 'Scope', timing: 'Timing', fanout: 'Fanout' }

export default function App() {
  const [index, setIndex] = useState(0)
  const exp = EXPERIMENTS[index]
  const [params, setParams] = useState({ ...DEFAULTS })
  const [view, setView] = useState(exp.view)
  const [resetKey, setResetKey] = useState(0)
  const [axes, setAxes] = useState({ ...DEFAULT_AXES })
  const [compare, setCompare] = useState(true)
  const [chip, setChip] = useState(null)
  const playback = usePlayback({ duration: 12000, resetKey: `${index}:${view}:${resetKey}` })
  const dc = useMemo(() => exp.id === 'a2' ? transfer() : null, [exp.id])
  useEffect(() => { if (dc) playback.setPosition(DEFAULTS.vin / CARD.vdd) }, [dc, resetKey])
  const p = { ...params, vin: dc ? playback.position * CARD.vdd : params.vin }
  const current = useMemo(() => analyse(params), [params])
  const reference = useMemo(() => analyse({ ...DEFAULTS, edge: params.edge }), [params.edge])
  const point = useMemo(() => dc ? dcPoint(p.vin) : null, [dc, p.vin])
  const switchPoint = useMemo(() => dc ? dcPoint(p.vin, 'switch') : null, [dc, p.vin])
  const x = { ...current, dc, point, switchPoint }
  const r = x.response
  const timePs = view === 'fanout' ? 0 : playback.position * (view === 'timing' ? axes.timing / 1000 : axes.scope)
  const t = timePs * 1e-12
  const sol = dc ? point : r.walk.at(t).sol
  const regions = dc ? null : r.walk.regionsAt(t)
  const dirty = Object.keys(DEFAULTS).some((k) => typeof p[k] === 'number' ? Math.abs(p[k] - DEFAULTS[k]) > 1e-9 : p[k] !== DEFAULTS[k])
  const choose = (i) => {
    if (i < 0 || i >= EXPERIMENTS.length) return
    setIndex(i); setParams({ ...DEFAULTS }); setView(EXPERIMENTS[i].view)
    setAxes({ ...DEFAULT_AXES }); setCompare(true); setChip(null); setResetKey((k) => k + 1)
  }
  const set = (key, value) => {
    if (key === 'vin') playback.setPosition(value / CARD.vdd)
    else setParams((prev) => ({ ...prev, [key]: value }))
    setChip(null)
  }
  const changeView = (next) => { setView(next); playback.reset() }
  const jump = (target) => {
    const section = document.getElementById(target)
    section?.scrollIntoView({ block: 'start' })
    section?.focus({ preventScroll: true })
  }
  const net = dc ? { elements: r.net.elements.map((e) => e.type === 'M' ? { ...e, model: 'square' }
    : e.id === 'Vin' ? { ...e, value: p.vin, wave: undefined } : e) } : r.net
  const math = workedMath(x, p, view)
  const meters = { ...sol, i: { ...sol.i, Mp: sol.i['Mp.ds'], Mn: sol.i['Mn.ds'] },
    volt: { ...sol.volt, Mp: sol.v.out - CARD.vdd, Mn: sol.v.out, CL: sol.v.out } }
  const scopeTraces = useMemo(() => [
    ...(compare ? [{ color: COLORS.spectrum, dashed: true, width: 6, points: scopePoints(reference.response, axes.scope) }] : []),
    { color: COLORS.trace, points: scopePoints(r, axes.scope) },
  ], [r, reference, axes.scope, compare])
  const timing = useMemo(() => timingComparison(x.chain, reference.chain, compare), [x.chain, reference, compare])
  const probeFanout = playback.position * 8
  const probeGate = extractGate(x.cell, probeFanout * 3 * CU)
  const clipped = !dc && view !== 'fanout' && (view === 'scope' ? r.tEnd * 1e12 > axes.scope : x.chain.res.tEnd > axes.timing)
  return <div className="app vlsi-app">
    <aside className="controls">
      <header><LabNav current="vlsi-lab" currentLabel="VLSI" /><h1>VLSI Lab</h1>
        <ReportIssue lab="VLSI Lab" state={{ experiment: exp.id, view }} summary={`Experiment ${exp.id}\n${JSON.stringify(p)}\nDelay ${ps(r.measured)}`} />
      </header>
      <section className="picker">
        <h2>Try this</h2>
        <LessonNav index={index} total={EXPERIMENTS.length} onPrev={() => choose(index - 1)}
          onNext={() => choose(index + 1)} onReset={() => choose(index)} dirty={dirty} noun="experiment" />
        <label className="experiment-select"><span>A. The inverter</span>
          <select aria-label="Experiment" value={index} onChange={(e) => choose(Number(e.target.value))}>
            {EXPERIMENTS.map((e, i) => <option key={e.id} value={i}>{e.id.toUpperCase()}. {e.shortName}</option>)}
          </select>
        </label>
        <p className="see" data-role="note">{exp.see(x, p)}</p>
        <TryLine text={exp.try.find((s) => s.say === chip)?.say || exp.try[0].say}
          chips={exp.try.map((s, i) => ({ label: `Step ${i + 1}`, title: s.say, ...s }))}
          activeChip={exp.try.findIndex((s) => s.say === chip) >= 0 ? `Step ${exp.try.findIndex((s) => s.say === chip) + 1}` : null}
          onChip={(s) => {
            if (dc) playback.setPosition(s.set.vin / CARD.vdd)
            else { setParams((prev) => ({ ...prev, ...s.set })); playback.reset() }
            setChip(s.say)
          }} />
      </section>
      <section className="knobs" id="lesson-controls" tabIndex={-1}>
        <h2>Physical parameters</h2>
        <p className="boundary" data-role="parameter-roles">{exp.foundation.parameters}</p>
        {dc ? <NumField label="Input voltage" unit="V" value={p.vin} onChange={(v) => set('vin', v)}
          min={0} max={CARD.vdd} step={0.01} presets={[0, 0.45, 0.9, 1.35, 1.8]} /> : <>
          <NumField label="Fanout" value={p.fanout} onChange={(v) => set('fanout', v)} min={0} max={8} step={1} presets={[0, 1, 4, 8]} />
          {exp.id === 'a4' && <NumField label="Pull-up width" value={p.wp} onChange={(v) => set('wp', v)} min={1} max={4} step={1} presets={[1, 2, 4]} />}
          {(exp.id === 'a3' || view === 'timing') && <NumField label="Stages" value={p.stages} onChange={(v) => set('stages', v)} min={1} max={8} step={1} presets={[1, 3, 5, 8]} />}
          <div className="segmented" role="group" aria-label="Output edge">
            {['fall', 'rise'].map((edge) => <button key={edge} className={p.edge === edge ? 'on' : ''} aria-pressed={p.edge === edge} onClick={() => set('edge', edge)}>{edge === 'fall' ? 'Falling' : 'Rising'}</button>)}
          </div>
          <p className="boundary" data-role="signal-edge">{p.edge === 'fall'
            ? 'Input rises from 0 to 1.8 V. The output falls toward 0 V. Mn pulls down. Mp is off.'
            : 'Input falls from 1.8 to 0 V. The output rises toward 1.8 V. Mp pulls up. Mn is off.'}
            {view === 'timing' && ' Output edge refers to the first stage. Later stages alternate.'}</p>
        </>}
      </section>
      <section className="terms" id="lesson-terms" tabIndex={-1}><h2>Terms used here</h2>
        {exp.terms.map((key) => <details key={key}><summary>{TERMS[key].name}</summary><p>{TERMS[key].def}</p></details>)}
      </section>
    </aside>
    <nav className="lesson-anchors" aria-label="Lesson sections">
      {[['lesson-overview', 'Lesson'], ['lesson-controls', 'Settings'], ['lesson-circuit', 'Circuit'], ['lesson-plot', 'Plots'], ['lesson-math', 'Math']].map(([target, label]) =>
        <button type="button" key={target} data-target={target} onClick={() => jump(target)}>{label}</button>)}
    </nav>
    <div className="topbar"><strong data-role="headline">{dc ? `Output ${volts(sol.v.out)}` : `Delay ${ps(r.measured)}`}</strong>
      <span>{dc ? 'Square law / static' : 'Switch model / rail step'}</span></div>
    <main className="views">
      <section className="analysis-view" id="lesson-plot" tabIndex={-1}>
        <div className="view-head"><h2>{dc ? 'Transfer characteristic' : VIEWS[view]}</h2>
          {!dc && <div className="segmented" role="group" aria-label="View">{Object.entries(VIEWS).map(([key, label]) =>
            <button key={key} className={view === key ? 'on' : ''} aria-pressed={view === key} onClick={() => changeView(key)}>{label}</button>)}</div>}
        </div>
        <p className="boundary" data-role="playback-meaning">{playbackMeaning(dc, view)}</p>
        <div className="plot-tools">
          <label className="check"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />Default comparison</label>
          {!dc && <div className="axis-actions">
            <button className="ghost transport-icon" aria-label="Fit axes" title="Fit axes to current and default traces" onClick={() => setAxes((a) => ({ ...a, [view]: fitAxis(view, x, reference) }))}>&#10530;</button>
            <button className="ghost transport-icon" title="Reset axes" aria-label="Reset axes" onClick={() => setAxes({ ...DEFAULT_AXES })}>&#8634;</button>
          </div>}
        </div>
        {dc ? <>
          <div className="legend"><span className="green">Square law</span><span className="amber">Switch</span>{compare && <span className="blue">Default input 0.900 V</span>}</div>
          <Plot label="Output voltage against input voltage" xMax={CARD.vdd} yMax={CARD.vdd} xTitle="Input voltage (V)" yTitle="Output voltage (V)"
            cursor={p.vin} traces={[{ color: COLORS.trace, points: dc.samples.map((s) => [s.vin, s.square]) }, { color: COLORS.spectrum, dashed: true, points: dc.samples.map((s) => [s.vin, s.switch]) }]}
            marks={[{ x: dc.vil }, { x: dc.vih }, ...(compare ? [{ x: DEFAULTS.vin, y: CARD.vdd / 2, color: COLORS.response }] : [])]}
            point={[p.vin, sol.v.out]} onCursor={(vin) => set('vin', vin)} />
          <PlaybackControls playback={playback} label="Input sweep" />
          <div className="readings" data-role="live-readings"><span>Input {volts(p.vin)}</span><span>Output {volts(sol.v.out)}</span>
            {compare && <span>Output change {volts(sol.v.out - CARD.vdd / 2)}</span>}</div>
          <p className="boundary">The square-law view is static. The switch curve has gaps at ambiguous threshold points.</p>
        </> : view === 'timing' ? <>
          <div className="legend"><span className="green">Current stages</span>{compare && <span>Default q3: fanout 1, width 2, {p.edge === 'fall' ? 'falling' : 'rising'} first edge</span>}</div>
          <div className="timing-plot" data-x-max={axes.timing} data-cursor={playback.position * axes.timing}>
            <TimingCanvas res={timing} signals={timing.signals} window={[0, axes.timing]}
              cursor={playback.position * axes.timing} onCursor={(tick) => playback.setPosition(tick / axes.timing)}
              fmtTime={(tick) => `${(tick / 1000).toFixed(1)} ps`} />
          </div>
          <PlaybackControls playback={playback} label="Time cursor" />
          <div className="readings" data-role="live-readings"><span>Time {timePs.toFixed(2)} ps</span>
            {logicReadings(x.chain, playback.position * axes.timing).map(({ signal, value }) => <span key={signal}>{signal} = {value}</span>)}</div>
          <div className="readings"><span>Event chain {ps(x.chain.elapsed)}</span><span>Isolated sum {ps(x.chain.reference)}</span>
            {compare && <span>Default chain {ps(reference.chain.elapsed)}</span>}</div>
          <p className="boundary">{EVENT_GUARD}</p>
          <p className="boundary">This transport chain does not represent a transistor chain driven by analog edges.</p>
        </> : view === 'fanout' ? <>
          <div className="legend"><span className="green">Falling</span><span className="amber">Rising (dashed)</span>{compare && <span className="blue">Default width 2</span>}</div>
          <Plot label="Propagation delay against fanout" xMax={8} yMax={axes.fanout} xTitle="Fanout (unit inputs)" yTitle="Delay (ps)"
            cursor={probeFanout} point={[probeFanout, (p.edge === 'fall' ? probeGate.tpHL : probeGate.tpLH) * 1e12]}
            marks={[{ x: p.fanout }, ...(compare ? [{ x: DEFAULTS.fanout, y: reference.gate.tpHL * 1e12, color: COLORS.response }] : [])]} onCursor={(v) => playback.setPosition(v / 8)}
            traces={[...(compare ? [{ color: COLORS.response, dashed: true, width: 7, points: reference.fanouts.map((f) => [f.fanout, f.tpHL * 1e12]) }] : []),
              { color: COLORS.trace, points: x.fanouts.map((f) => [f.fanout, f.tpHL * 1e12]) },
              { color: COLORS.spectrum, dashed: true, points: x.fanouts.map((f) => [f.fanout, f.tpLH * 1e12]) }]} />
          <PlaybackControls playback={playback} label="Fanout sweep" />
          <div className="readings" data-role="live-readings"><span>Probe fanout {probeFanout.toFixed(2)}</span>
            <span>Probe delay {ps(p.edge === 'fall' ? probeGate.tpHL : probeGate.tpLH)}</span></div>
          <div className="readings"><span>Selected fanout {p.fanout}</span><span>Falling {ps(x.gate.tpHL)}</span><span>Rising {ps(x.gate.tpLH)}</span>
            {compare && <span>Default delay {ps(reference.gate.tpHL)}</span>}</div>
          <p className="boundary">The probe coordinate is load in unit inverter inputs. The selected load remains at the marked fanout.</p>
          <p className="boundary">Each load is one unit inverter input. These delays assume ideal rail steps.</p>
        </> : <>
          <div className="legend"><span className="green">Current {p.edge === 'fall' ? 'falling' : 'rising'} edge</span>{compare && <span className="amber">Default: fanout 1, width 2, {p.edge === 'fall' ? 'falling' : 'rising'}</span>}</div>
          <Plot label="Output voltage against time after a rail step" xMax={axes.scope} yMax={CARD.vdd}
            xTitle="Time (ps)" yTitle="Output voltage (V)" traces={scopeTraces} cursor={timePs} point={[timePs, sol.v.out]}
            marks={[{ x: r.measured * 1e12, y: CARD.vdd / 2 }]}
            onCursor={(v) => playback.setPosition(v / axes.scope)} />
          <PlaybackControls playback={playback} label="Time cursor" />
          <div className="readings" data-role="live-readings"><span>Time {timePs.toFixed(2)} ps</span><span>Output {volts(sol.v.out)}</span>
            {compare && <span>Default {volts(reference.response.walk.at(t).sol.v.out)}</span>}</div>
          <div className="readings"><span>Half-supply {ps(r.measured)}</span><span>10-90% {ps(r.transition)}</span>
            {compare && <span>Delay change {ps(r.measured - reference.response.measured)}</span>}</div>
          <p className="boundary">The voltage response is exact for this isolated switch model under an ideal rail step.</p>
        </>}
        {clipped && <p className="boundary range-notice" role="status">{view === 'scope' ? 'The 6-tau settling interval extends beyond the held time range.' : 'The event run extends beyond the held time range.'}</p>}
      </section>
      <div className="explanation-column">
        <Foundations experiment={exp} />
        <section className="schematic-view" id="lesson-circuit" tabIndex={-1}>
          <div className="view-head"><h2>{dc ? 'CMOS inverter' : 'Isolated inverter'}</h2><span>Supply {volts(CARD.vdd)}</span></div>
          <Schematic elements={net.elements.map((e) => ({ ...e, label: e.id }))} layout={LAYOUT} meters={meters} show="v"
            lit={{ elements: regions ? Object.keys(regions).filter((id) => regions[id] === 'on') : [], nodes: ['out'] }} />
          <div className="readings">{dc ? <><span>Square law {volts(sol.v.out)}</span><span>Switch {switchPoint ? volts(switchPoint.v.out) : 'ambiguous at threshold'}</span>
            <span>Difference {switchPoint ? volts(Math.abs(sol.v.out - switchPoint.v.out)) : 'undefined'}</span></>
            : <><span>Mp {regions.Mp}</span><span>Mn {regions.Mn}</span><span>Output {volts(sol.v.out)}</span></>}</div>
          {view === 'timing' && <p className="boundary">The schematic shows an isolated rail step at t = 0. The chain input changes at 1 ps.</p>}
        </section>
        <section className="worked-math" id="lesson-math" tabIndex={-1}><h2>{exp.name}</h2><p>{exp.why}</p><h3>The math</h3><MathBody entry={math} /></section>
      </div>
    </main>
  </div>
}
