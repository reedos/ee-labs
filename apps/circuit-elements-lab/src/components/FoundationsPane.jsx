import React, { useMemo } from 'react'
import { FOUNDATIONS, foundationFor, foundationSteps } from '../foundations.js'
import { WorkedDerivation } from './WorkedDerivation.jsx'

export function FoundationSidebar({ exp }) {
  const lesson = FOUNDATIONS[exp.id]
  return <div data-role="foundation-intro">
    <p className="hint">{lesson.intro}</p>
    <ol className="try" aria-label="Foundation lesson steps">{lesson.tasks.map((task, i) => <li key={task} data-state="active">
      <span className="step-n" aria-hidden="true">{i + 1}</span><span className="step-body">{task}</span>
    </li>)}</ol>
  </div>
}

export function FoundationsPane({ exp, x, onChoose }) {
  const lesson = FOUNDATIONS[exp.id]
  const work = useMemo(() => foundationSteps(exp.id, x), [exp.id, x])
  const next = lesson.next === 'state' ? 'State equation' : 'Phasors'
  const advance = (event, view) => {
    const body = event.currentTarget.closest('.view-body')
    onChoose(view)
    if (body) {
      body.scrollTop = 0
      if (window.matchMedia('(max-width: 800px)').matches) body.closest('.view')?.scrollIntoView({ block: 'start' })
    }
  }
  return <div className="foundations-pane">
    <p className="hint">Start here. The schematic, controls and cursor above supply the values in this lesson.</p>
    <WorkedDerivation role="foundations" title={lesson.title} intro={lesson.intro} steps={work.steps.map(s => ({ ...s, latex: s.latex.map(line => `&${line}`) }))} />
    <div className="foundation-actions">
      <button className="preset" type="button" onClick={event => advance(event, lesson.next)}>Continue to {next}</button>
      <button className="preset" type="button" onClick={event => advance(event, 'scope')}>See the waveform in Scope</button>
    </div>
  </div>
}

export function FoundationLink({ exp, view }) {
  const id = foundationFor(exp, view)
  return id ? <p className="foundation-link">New to this method? <a href={`#${id}&view=foundations`}>{FOUNDATIONS[id].title}</a></p> : null
}
