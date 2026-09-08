import React, {useId, useState} from 'react'
import {WorkedDerivation} from './WorkedDerivation.jsx'
import {num} from '../format.js'

function ResponseComparison({plot}) {
  const colors = ['var(--blue)', 'var(--amber)', 'var(--accent)']
  const W = 480, H = 230, left = 62, right = 16, top = 16, bottom = 42
  const min = -25, max = 25
  const xx = t => left + (W - left - right) * t / plot.tEnd
  const yy = v => top + (H - top - bottom) * (max - v) / (max - min)
  return <section className="worked-solution response-comparison">
    <h3>{plot.title || 'See the two responses add'}</h3>
    <p>The voltage axis stays fixed as you change the source and initial voltage. Time spans the same window as Scope.</p>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${plot.traces.map(t => t.label).join(', ')} against time`}>
      {[-20, 0, 20].map(v => <g key={v}><line x1={left} y1={yy(v)} x2={W-right} y2={yy(v)} stroke="var(--line)" /><text x={left-10} y={yy(v)+4} textAnchor="end" fill="var(--dim)" fontSize="12">{v} V</text></g>)}
      {[0, .5, 1].map(f => <text key={f} x={xx(f*plot.tEnd)} y={H-16} textAnchor={f===0?'start':f===1?'end':'middle'} fill="var(--dim)" fontSize="12">{num(f*plot.tEnd, 's', 3)}</text>)}
      {plot.traces.map((trace, i) => <path key={trace.label} d={Array.from({length:201},(_,j)=>{const t=j*plot.tEnd/200;return `${j?'L':'M'}${xx(t)},${yy(trace.at(t))}`}).join(' ')} stroke={colors[i]} fill="none" strokeWidth="2" strokeDasharray={i===2?undefined:i===0?'7 3':'2 3'} />)}
    </svg>
    <p className="comparison-legend">{plot.traces.map((trace,i)=><span key={trace.label} style={{color:colors[i]}}>{i===0?'Dashed':i===1?'Dotted':'Solid'}: {trace.label}</span>)}</p>
  </section>
}

function Practice({practice}) {
  const helpId = useId()
  const [answer, setAnswer] = useState('')
  const [checked, setChecked] = useState(false)
  const [hint, setHint] = useState(false)
  const value = Number(answer)
  const valid = answer.trim() !== '' && Number.isFinite(value)
  const correct = valid && Math.abs(value - practice.target) <= Math.max(1e-9, Math.abs(practice.target) * .005)
  return <section className="worked-solution method-practice" aria-label="Independent practice">
    <h3>Try it yourself</h3>
    <p>{practice.prompt}</p>
    <form onSubmit={event => {event.preventDefault(); setChecked(true)}}>
      <label>Your answer ({practice.unit}) <input type="text" inputMode="decimal" value={answer} onChange={event => {setAnswer(event.target.value); setChecked(false)}} aria-describedby={helpId} /></label>
      <button type="submit" className="preset">Check answer</button>
      <button type="button" className="preset" onClick={() => setHint(!hint)} aria-expanded={hint}>Hint</button>
    </form>
    <p id={helpId}>Use the stated unit. Scientific notation, such as 2e-3, is accepted. Answers within 0.5% are accepted.</p>
    {hint ? <p>{practice.hint}</p> : null}
    <p role="status">{checked ? !valid ? 'Enter a number in the stated unit.' : correct ? 'Correct. Your calculation agrees with the circuit method.' : 'Not yet. Check the replacement conditions, signs and units, then try again.' : ''}</p>
    {checked && valid && !correct ? <details><summary>Show the result</summary><p>{num(practice.target, practice.unit, 6)}. {practice.hint}</p></details> : null}
  </section>
}

export function WorkedMethod({exp, params, x, onApply}) {
  if (!x.sol) return null
  const study = exp.study(exp.id, params, x)
  const canApply = study.action && Object.entries(study.action.settings).every(([key, value]) => {const k = exp.params.find(k => k.key === key); return k && Number.isFinite(value) && value >= k.min && value <= k.max})
  return <div className="worked-method" data-role="worked-method">
    <WorkedDerivation title={study.title} intro={study.intro} steps={study.steps} role="method-derivation" />
    {study.action ? <section className="worked-solution method-practice"><h3>Test the calculated design</h3><button className="preset" type="button" disabled={!canApply || !onApply} onClick={() => onApply(study.action.settings)}>{study.action.label}</button><p>{canApply ? 'Applies the calculated component values to this schematic. The meters and all analysis views will update.' : 'The calculated design is outside this lesson’s component ranges. Change the source-network settings or frequency to explore a realizable case within these ranges.'}</p></section> : null}
    {study.plot ? <ResponseComparison plot={study.plot} /> : null}
    <section className="worked-solution">
      <h3>When to use this method</h3>
      <p>{study.advantage}</p><p>{study.limitation}</p>
      <div className="method-check-scroll"><table className="method-checks"><caption>Independent circuit checks</caption>
        <thead><tr><th scope="col">Quantity</th><th scope="col">Derived</th><th scope="col">Circuit solve</th></tr></thead>
        <tbody>{study.checks.map((c, i) => <tr key={i}><th scope="row">{c.label}</th><td>{num(c.predicted, c.unit, 6)}</td><td>{num(c.measured, c.unit, 6)}</td></tr>)}</tbody>
      </table></div>
    </section>
    {(Array.isArray(study.practice) ? study.practice : [study.practice]).map((practice, i) => <Practice key={`${JSON.stringify(params)}-${i}`} practice={practice} />)}
  </div>
}
