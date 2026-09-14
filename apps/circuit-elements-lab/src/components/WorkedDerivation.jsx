import React from 'react'
import { Formula } from '@ee-labs/explain'

export function WorkedDerivation({ title, intro, steps, role }) {
  return <section className="worked-solution" data-role={role}>
    <h3>{title}</h3>
    <p>{intro}</p>
    <p>Numbers below use seconds, volts, amperes, ohms, farads and henries. Displayed numbers are rounded to six significant figures; the calculations retain full precision.</p>
    <ol className="worked-steps">
      {steps.map((step, i) => <li key={i} data-step={step.kind || 'derive'}>
        <h4>Step {i + 1} · {step.title}</h4>
        <p>{step.text}</p>
        {step.latex?.length ? <Formula>{`\\begin{aligned}${step.latex.join(' \\\\ ')}\\end{aligned}`}</Formula> : null}
        {step.note ? <p>{step.note}</p> : null}
      </li>)}
    </ol>
  </section>
}
