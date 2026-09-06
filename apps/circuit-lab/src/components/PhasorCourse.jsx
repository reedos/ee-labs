import React, { useMemo, useState } from 'react'
import { Formula } from '@ee-labs/explain'
import { LabNav, NumField, Schematic, fmt } from '@ee-labs/ui'
import { complex as z } from '@ee-labs/network'
import { PHASOR_LESSONS, PHASOR_DEFAULTS, PHASOR_FIELDS, analysePhasors, phasorSteps } from '../phasorCourse.js'

export function phasorLayout(topology) {
  const branch = topology === 'branched'
  const items = [
    { el: 'V1', x: 60, y: 150, dir: 'v' }, { el: 'R1', x: 150, y: 50, dir: 'h' },
    { wire: [60, 130, 60, 50] }, { wire: [60, 50, 130, 50] }, { wire: [170, 50, 250, 50] },
    { wire: [60, 170, 60, 260] }, { wire: [60, 260, 250, 260] }, { gnd: [60, 260] },
    { node: 'in', x: 60, y: 50 }, { node: 'n', x: 250, y: 50 },
  ]
  if (topology === 'rc' || branch) items.push(
    { el: 'C1', x: 250, y: 150, dir: 'v' }, { wire: [250, 50, 250, 130] }, { wire: [250, 170, 250, 260] },
  )
  else items.push(
    { el: 'L1', x: 250, y: 110, dir: 'v' }, { el: 'C1', x: 250, y: 210, dir: 'v' },
    { wire: [250, 50, 250, 90] }, { wire: [250, 130, 250, 190] }, { wire: [250, 230, 250, 260] },
    { node: 'm', x: 250, y: 160 },
  )
  if (branch) items.push(
    { el: 'R2', x: 370, y: 110, dir: 'v' }, { el: 'L1', x: 370, y: 210, dir: 'v' },
    { wire: [250, 50, 370, 50] }, { wire: [370, 50, 370, 90] }, { wire: [370, 130, 370, 190] },
    { wire: [370, 230, 370, 260] }, { wire: [250, 260, 370, 260] }, { node: 'm', x: 370, y: 160 },
  )
  return { w: branch ? 450 : 340, h: 310, items }
}

const colors = ['#38e0b0', '#5fa8ff', '#f0a23c', '#dd9aff', '#ff7b97']
function VectorPlot({ title, vectors, unit }) {
  const max = Math.max(...vectors.map(v => z.cabs(v.value)), 1e-12)
  return <figure className="phasor-vectors">
    <figcaption>{title} · outer radius {fmt(max, unit, 3)}</figcaption>
    <svg viewBox="0 0 300 270" role="img" aria-label={title}>
      <circle cx="150" cy="135" r="105" fill="none" stroke="var(--line-bright)" />
      <path d="M20 135H280 M150 15V255" stroke="var(--line-bright)" />
      <text x="260" y="125">Re</text><text x="158" y="23">Im</text>
      {vectors.map((v, i) => {
        const x = 150 + v.value[0] / max * 105, y = 135 - v.value[1] / max * 105
        const angle = -z.carg(v.value)
        const ax = x - 9 * Math.cos(angle - 0.4), ay = y - 9 * Math.sin(angle - 0.4)
        const bx = x - 9 * Math.cos(angle + 0.4), by = y - 9 * Math.sin(angle + 0.4)
        return <g key={v.label} stroke={colors[i]} fill={colors[i]}><title>{`${v.label}: ${fmt(z.cabs(v.value), unit, 4)}, ${(z.carg(v.value) * 180 / Math.PI).toFixed(2)} degrees`}</title><path d={`M150 135L${x} ${y} M${ax} ${ay}L${x} ${y}L${bx} ${by}`} fill="none" strokeWidth="2" /></g>
      })}
    </svg>
    <ul>{vectors.map((v, i) => <li key={v.label} style={{ color: colors[i] }}>{v.label}: {fmt(z.cabs(v.value), unit, 4)} ∠ {(z.carg(v.value) * 180 / Math.PI).toFixed(2)}°</li>)}</ul>
  </figure>
}

export default function PhasorCourse({ lessonId }) {
  const index = Math.max(0, PHASOR_LESSONS.findIndex(l => l.id === lessonId))
  const lesson = PHASOR_LESSONS[index]
  const [p, setP] = useState(PHASOR_DEFAULTS)
  const [revealed, setRevealed] = useState(false)
  const a = useMemo(() => analysePhasors(lesson.topology, p), [lesson.topology, p])
  const steps = useMemo(() => phasorSteps(lesson.topology, p, a), [lesson.topology, p, a])
  const fields = PHASOR_FIELDS.filter(f => !(lesson.topology === 'rc' && f.key === 'l') && !(lesson.topology !== 'branched' && f.key === 'r2'))
  const specialFrequency = lesson.topology === 'rc' ? 1 / (2 * Math.PI * p.r * p.c) : 1 / (2 * Math.PI * Math.sqrt(p.l * p.c))
  return <div className="phasor-course" data-role="phasor-course">
    <header className="phasor-course-header"><div><h1>Circuit Lab</h1><p>Circuits II · Phasor circuit analysis</p></div><LabNav current="circuit-lab" /></header>
    <div className="phasor-course-layout">
      <aside className="phasor-course-controls" aria-label="Lessons and circuit controls">
        <h2>Start with phasors</h2>
        <nav aria-label="Phasor lessons">{PHASOR_LESSONS.map((l, i) => <a key={l.id} href={`#phasors=${l.id}`} aria-current={lesson.id === l.id ? 'step' : undefined}>{i + 1}. {l.title}</a>)}</nav>
        <p>Prerequisites: KCL, KVL, Ohm’s law, and capacitor and inductor laws.</p>
        <p>Next in the planned course: state equations, Laplace methods, then transfer functions and frequency response. State and Laplace groups are not released yet.</p>
        <a className="phasor-course-link" href="?course=frequency">Open existing frequency-response lessons</a>
        <h2>Current circuit</h2>
        {fields.map(f => <NumField key={f.key} label={f.label} min={f.min} max={f.max} step={f.step} value={p[f.key] * (f.scale || 1)} onChange={value => setP(old => ({ ...old, [f.key]: value / (f.scale || 1) }))} />)}
        <div className="phasor-actions"><button onClick={() => { setP(PHASOR_DEFAULTS); setRevealed(false) }}>Reset values</button>
          {lesson.topology !== 'branched' && specialFrequency >= 10 && specialFrequency <= 10000 ? <button onClick={() => setP(old => ({ ...old, f: specialFrequency }))}>{lesson.topology === 'rc' ? 'Set RC corner' : 'Set resonance'}</button> : null}
          {lesson.topology === 'branched' ? <button onClick={() => setP(old => ({ ...old, r2: Math.min(old.r2 * 2, 1000) }))}>Double R2</button> : null}
        </div>
      </aside>
      <main className="phasor-course-body">
        <h2>{lesson.title}</h2><p>{lesson.aim}</p>
        <section className="phasor-method"><h3>What this method solves</h3><p>Phasors turn linear circuit equations into complex algebra at one frequency. They give sinusoidal steady state. Startup requires a time-domain solution with initial conditions.</p><p><b>Best for:</b> amplitudes, relative phases and AC power. <b>Tradeoff:</b> complex arithmetic, with no startup information.</p></section>
        <section className="phasor-practice"><h3>Predict, change, then check</h3><p>{lesson.task}</p><button aria-expanded={revealed} onClick={() => setRevealed(!revealed)}>{revealed ? 'Hide explanation' : 'Reveal explanation'}</button>{revealed ? <p>{lesson.answer}</p> : null}</section>
        <section className="phasor-circuit"><h3>Circuit and reference directions</h3><Schematic elements={a.net.elements} layout={phasorLayout(lesson.topology)} />
          <p>The source voltage is measured from in to ground. R1 current points from in to n. Vertical passive-branch currents point downward. Node names match the equations below.</p></section>
        <section className="phasor-vector-grid" aria-label="Phasor diagrams">
          <VectorPlot title="Voltage phasors" unit="V peak" vectors={[{ label: 'Vs', value: a.vs }, ...a.rows.map(row => ({ label: `V(${row.id})`, value: row.voltage }))]} />
          <VectorPlot title="Current phasors" unit="A peak" vectors={lesson.topology === 'branched' ? [{ label: 'I(R1)', value: a.current }, { label: 'I(C1)', value: a.ic }, { label: 'I(R2,L1)', value: a.il }] : [{ label: 'I', value: a.current }]} />
        </section>
        <p>The diagrams use separate voltage and current scales. Angles use the same reference. Phasor magnitudes cannot be added as scalar lengths.</p>
        <section aria-label="Worked phasor solution" className="phasor-worked">{steps.map(step => <section key={step.title}><h3>{step.title}</h3><p>{step.text}</p>{step.math.map((math, i) => <div className="phasor-math" key={i}><Formula>{math}</Formula></div>)}</section>)}</section>
        <section><h3>Independent circuit check</h3><p>The reduction above is compared with a separate complex nodal solve of the full circuit. Residuals below use unrounded values.</p>
          <div className="phasor-table"><table><thead><tr><th>Element</th><th>Voltage difference (V)</th><th>Current difference (A)</th></tr></thead><tbody>{a.errors.map(row => <tr key={row.id}><th>{row.id}</th><td>{row.voltage.toExponential(2)}</td><td>{row.current.toExponential(2)}</td></tr>)}</tbody></table></div>
        </section>
        <nav className="phasor-actions" aria-label="Lesson progression">{index > 0 ? <a href={`#phasors=${PHASOR_LESSONS[index - 1].id}`}>Previous lesson</a> : null}{index < PHASOR_LESSONS.length - 1 ? <a href={`#phasors=${PHASOR_LESSONS[index + 1].id}`}>Next lesson</a> : <a href="?course=frequency">Explore frequency response</a>}</nav>
      </main>
    </div>
  </div>
}
