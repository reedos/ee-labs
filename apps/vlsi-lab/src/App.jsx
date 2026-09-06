import React, { useMemo, useState } from 'react'
import { COLORS, LabNav, LessonNav, NumField, ReportIssue, Schematic, TimingCanvas, TryLine } from '@ee-labs/ui'
import { MathPanel } from '@ee-labs/explain'
import { CARD, DEFAULTS, LAYOUT, transfer } from './model.js'
import { EVENT_GUARD } from './extract.js'
import { EXPERIMENTS, analyse, ps, volts } from './experiments.js'
import { TERMS } from './terms.js'
import Plot from './Plot.jsx'

const VIEWS = { scope: 'Scope', timing: 'Timing', fanout: 'Fanout' }

export default function App() {
  const [index, setIndex] = useState(0)
  const exp = EXPERIMENTS[index]
  const [p, setParams] = useState({ ...DEFAULTS })
  const [view, setView] = useState(exp.view)
  const [cursor, setCursor] = useState(0)
  const [chip, setChip] = useState(null)
  const dc = useMemo(() => exp.id === 'a2' ? transfer() : null, [exp.id])
  const x = useMemo(() => analyse(p, dc), [p, dc])
  const r = x.response
  const t = cursor * r.tEnd
  const sol = dc ? x.point : r.walk.at(t).sol
  const regions = dc ? null : r.walk.regionsAt(t)
  const dirty = Object.keys(DEFAULTS).some((k) => p[k] !== DEFAULTS[k])
  const choose = (i) => {
    if (i < 0 || i >= EXPERIMENTS.length) return
    setIndex(i); setParams({ ...DEFAULTS }); setView(EXPERIMENTS[i].view); setCursor(0); setChip(null)
  }
  const set = (key, value) => { setParams((prev) => ({ ...prev, [key]: value })); setChip(null) }
  const net = dc ? { elements: r.net.elements.map((e) => e.type === 'M' ? { ...e, model: 'square' }
    : e.id === 'Vin' ? { ...e, value: p.vin, wave: undefined } : e) } : r.net
  const math = { blocks: dc ? [
    { kind: 'formula', tex: 'V_{IL}=\\frac{3V_{DD}+2V_t}{8},\\quad V_{IH}=\\frac{5V_{DD}-2V_t}{8}' },
    { kind: 'check', rows: [
      { label: 'Low input limit', predicted: (3 * CARD.vdd + 2 * CARD.vt) / 8, measured: dc.vil, unit: 'V', tol: 1e-6 },
      { label: 'High input limit', predicted: (5 * CARD.vdd - 2 * CARD.vt) / 8, measured: dc.vih, unit: 'V', tol: 1e-6 },
    ] },
    { kind: 'formula', tex: 'NM_L=V_{IL}-V_{OL},\\quad NM_H=V_{OH}-V_{IH}' },
  ] : [
    { kind: 'formula', tex: 't_{50}=R_{on}(C_{self}+C_{load})\\ln 2' },
    { kind: 'check', rows: [{ label: 'Half-supply delay', predicted: (p.edge === 'fall' ? x.gate.tpHL : x.gate.tpLH) * 1e12,
      measured: r.measured * 1e12, unit: 'ps', tol: 1e-10 }] },
  ] }
  const meters = { ...sol, i: { ...sol.i, Mp: sol.i['Mp.ds'], Mn: sol.i['Mn.ds'] },
    volt: { ...sol.volt, Mp: sol.v.out - CARD.vdd, Mn: sol.v.out, CL: sol.v.out } }
  return <div className="app vlsi-app">
    <aside className="controls">
      <header><LabNav current="vlsi-lab" currentLabel="VLSI" /><h1>VLSI Lab</h1></header>
      <section className="picker">
        <h2>A. The inverter</h2>
        <label className="experiment-select">Experiment
          <select aria-label="Experiment" value={index} onChange={(e) => choose(Number(e.target.value))}>
            {EXPERIMENTS.map((e, i) => <option key={e.id} value={i}>{e.id.toUpperCase()}. {e.name}</option>)}
          </select>
        </label>
        <LessonNav index={index} total={EXPERIMENTS.length} onPrev={() => choose(index - 1)}
          onNext={() => choose(index + 1)} onReset={() => choose(index)} dirty={dirty} noun="experiment" />
      </section>
      <section className="knobs">
        <h2>Settings</h2>
        {dc ? <NumField label="Input voltage" unit="V" value={p.vin} onChange={(v) => set('vin', v)}
          min={0} max={CARD.vdd} step={0.01} presets={[0, 0.45, 0.9, 1.35, 1.8]} /> : <>
          <NumField label="Fanout" value={p.fanout} onChange={(v) => set('fanout', v)} min={0} max={8} step={1} presets={[0, 1, 4, 8]} />
          {exp.id === 'a4' && <NumField label="Pull-up width" value={p.wp} onChange={(v) => set('wp', v)} min={1} max={4} step={1} presets={[1, 2, 4]} />}
          {(exp.id === 'a3' || view === 'timing') && <NumField label="Stages" value={p.stages} onChange={(v) => set('stages', v)} min={1} max={8} step={1} presets={[1, 3, 5, 8]} />}
          <div className="segmented" role="group" aria-label="Output edge">
            {['fall', 'rise'].map((edge) => <button key={edge} aria-pressed={p.edge === edge} onClick={() => set('edge', edge)}>{edge === 'fall' ? 'Falling' : 'Rising'}</button>)}
          </div>
        </>}
      </section>
      <section className="lesson" data-role="note">
        <h2>{exp.name}</h2><p className="see">{exp.see(x, p)}</p>
        <TryLine text={exp.try.find((s) => s.say === chip)?.say || exp.try[0].say}
          chips={exp.try.map((s, i) => ({ label: `Step ${i + 1}`, title: s.say, ...s }))}
          activeChip={exp.try.findIndex((s) => s.say === chip) >= 0 ? `Step ${exp.try.findIndex((s) => s.say === chip) + 1}` : null}
          onChip={(s) => { setParams((prev) => ({ ...prev, ...s.set })); setChip(s.say); setCursor(0) }} />
        <details><summary>Why this happens</summary><p>{exp.why}</p></details>
        <details><summary>Terms used here</summary><dl>{exp.terms.map((key) => <React.Fragment key={key}>
          <dt>{TERMS[key].name}</dt><dd>{TERMS[key].def}</dd>
        </React.Fragment>)}</dl></details>
        <MathPanel entry={math} />
      </section>
      <ReportIssue lab="VLSI Lab" state={{ experiment: exp.id, view }} summary={`Experiment ${exp.id}\n${JSON.stringify(p)}\nDelay ${ps(r.measured)}`} />
    </aside>
    <div className="topbar" aria-live="polite"><strong data-role="headline">{dc ? `Output ${volts(sol.v.out)}` : `Delay ${ps(r.measured)}`}</strong>
      <span>{dc ? 'Square law / static' : 'Switch model / rail step'}</span></div>
    <main className="views">
      <section className="schematic-view">
        <div className="view-head"><h2>CMOS inverter</h2><span>Supply {volts(CARD.vdd)}</span></div>
        <Schematic elements={net.elements.map((e) => ({ ...e, label: e.id }))} layout={LAYOUT} meters={meters} show="v"
          lit={{ elements: regions ? Object.keys(regions).filter((id) => regions[id] === 'on') : [], nodes: ['out'] }} />
        <div className="readings">{dc ? <>
          <span>Square law {volts(sol.v.out)}</span><span>Switch {x.switchPoint ? volts(x.switchPoint.v.out) : 'ambiguous at threshold'}</span>
          <span>Difference {x.switchPoint ? volts(Math.abs(sol.v.out - x.switchPoint.v.out)) : 'undefined'}</span>
        </> : <><span>Mp {regions.Mp}</span><span>Mn {regions.Mn}</span><span>Output {volts(sol.v.out)}</span>
          <span>R_on {(r.tau / x.gate.ctotal / 1000).toFixed(3)} kohm</span><span>Total C {(x.gate.ctotal * 1e15).toFixed(3)} fF</span></>}</div>
      </section>
      <section className="analysis-view">
        <div className="view-head"><h2>{dc ? 'Transfer characteristic' : VIEWS[view]}</h2>
          {!dc && <div className="segmented" role="group" aria-label="View">{Object.entries(VIEWS).map(([key, label]) =>
            <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}</div>}
        </div>
        {dc ? <>
          <div className="legend"><span className="green">Square law</span><span className="amber">Switch</span></div>
          <Plot label="Output voltage against input voltage" xMax={CARD.vdd} yMax={CARD.vdd} xTitle="Input voltage (V)" yTitle="Output voltage (V)"
            traces={[{ color: COLORS.trace, points: dc.samples.map((s) => [s.vin, s.square]) }, { color: COLORS.spectrum, points: dc.samples.map((s) => [s.vin, s.switch]) }]}
            marks={[{ x: dc.vil }, { x: dc.vih }, { x: p.vin, color: COLORS.response }]} onCursor={(vin) => set('vin', vin)} />
          <div className="readings"><span>V_IL {volts(dc.vil)}</span><span>V_IH {volts(dc.vih)}</span><span>V_OL {volts(dc.vol)}</span><span>V_OH {volts(dc.voh)}</span></div>
          <p className="boundary">The square-law view is static. The switch curve has gaps at ambiguous threshold points.</p>
        </> : view === 'timing' ? <>
          <TimingCanvas res={x.chain.res} signals={x.chain.res.signals} window={[0, x.chain.res.tEnd]}
            cursors={[x.chain.start, x.chain.res.waves[`q${p.stages}`].t.at(-1)]} fmtTime={(tick) => `${(tick / 1000).toFixed(2)} ps`} />
          <p className="boundary">{EVENT_GUARD}</p>
          <div className="readings"><span>Isolated sum {ps(x.chain.reference)}</span><span>Event chain {ps(x.chain.elapsed)}</span>
            <span>Error {(x.chain.error * 1e15).toFixed(3)} fs</span><span>Bound {(x.chain.bound * 1e15).toFixed(1)} fs</span></div>
          <p className="boundary">This transport chain does not represent a transistor chain driven by analog edges.</p>
        </> : view === 'fanout' ? <>
          <div className="legend"><span className="green">Falling</span><span className="amber">Rising</span></div>
          <Plot label="Propagation delay against fanout" xMax={8} yMax={Math.max(...x.fanouts.flatMap((f) => [f.tpHL, f.tpLH])) * 1e12 * 1.1}
            xTitle="Fanout (unit inputs)" yTitle="Delay (ps)" marks={[{ x: p.fanout }]} onCursor={(v) => set('fanout', Math.round(v))}
            traces={[{ color: COLORS.trace, points: x.fanouts.map((f) => [f.fanout, f.tpHL * 1e12]) },
              { color: COLORS.spectrum, dashed: true, points: x.fanouts.map((f) => [f.fanout, f.tpLH * 1e12]) }]} />
        </> : <>
          <Plot label="Output voltage against time after a rail step" xMax={r.tEnd * 1e12} yMax={CARD.vdd}
            xTitle="Time (ps)" yTitle="Output voltage (V)" traces={[{ color: COLORS.trace, points: r.walk.samples.map((s) => [s.t * 1e12, s.sol.v.out]) }]}
            marks={[{ x: r.measured * 1e12, y: CARD.vdd / 2 }, { x: t * 1e12, color: COLORS.response }]}
            onCursor={(v) => setCursor(v / (r.tEnd * 1e12))} />
          <NumField label="Time cursor" unit="ps" value={t * 1e12} onChange={(v) => setCursor(v / (r.tEnd * 1e12))}
            min={0} max={r.tEnd * 1e12} step={r.tEnd * 1e12 / 1000} />
          <div className="readings"><span>Half-supply {ps(r.measured)}</span><span>10-90% {ps(r.transition)}</span></div>
        </>}
      </section>
    </main>
  </div>
}
