import React, { useMemo } from 'react'
import { Formula } from '@ee-labs/explain'
import { mathNumber, workedSolve } from '../workedSolve.js'

const aligned = (lines) => `\\begin{aligned}${lines.join(' \\\\ ')}\\end{aligned}`
const vector = (items) => `\\begin{bmatrix}${items.join(' \\\\ ')}\\end{bmatrix}`

export function WorkedSolution({ eq, sol }) {
  const work = useMemo(() => workedSolve(eq, sol), [eq, sol])
  const columns = eq.symbolic.cols
  return (
    <section className="worked-solution" data-role="worked-solution">
      <h3>Work through this circuit, step by step</h3>
      {work.unavailable ? <p>{work.unavailable}</p> : <>
        <p>These are the equations at the current settings and cursor position. First use any constraint that fixes a voltage directly; then use those voltages in the current-balance rows. {sol.norm.elements.some((e) => e.type === 'C') ? "A capacitor's constraint holds its present voltage, not a constant voltage for all time." : ''}</p>
        {sol.sys.effs.some((e) => e.type === 'GI') ? <p>For a diode curve, these are the linear equations at the operating point found by the circuit solver. The diode's differential resistance is the inverse slope of its current–voltage curve there; its parallel current source is the offset that makes this straight line pass through that point. The algebra below solves that local circuit.</p> : null}
        <p><b>Unknowns, in column order.</b> Node voltages are relative to ground, in volts. Branch currents are in amperes, positive in their reference directions.</p>
        <Formula>{columns.map((c) => c.latex).join(',\\quad ')}</Formula>
        <p><b>The equations as written.</b> KCL rows balance currents at a node; constraint rows specify voltage relationships. Row numbers follow the matrix above.</p>
        <Formula>{aligned(work.original)}</Formula>
        <p>Arithmetic below uses volts, amperes and ohms. Numbers are displayed to six significant figures; calculations keep full precision, so the last displayed digit may differ if you work from rounded values.</p>
        <ol className="worked-steps">
          {work.steps.map((step, i) => <li key={i} data-step={step.kind}>
            <h4>Step {i + 1} · {step.title}</h4>
            <p>{step.text}</p>
            <Formula>{aligned(step.latex)}</Formula>
            <p>{step.note}</p>
          </li>)}
        </ol>
        <h4>The solution vector</h4>
        <Formula>{`${vector(columns.map((c) => c.latex))} = ${vector(work.values.map((v, j) => `${mathNumber(v)}\\,\\mathrm{${columns[j].kind === 'v' ? 'V' : 'A'}}`))}`}</Formula>
        <p><b>Check against the original matrix.</b> Substituting this vector into each original row should reproduce that row's right-hand side. The largest absolute differences, calculated before rounding, are:</p>
        <Formula>{aligned([
          `\\max |\\text{KCL residual}| &= ${mathNumber(work.kclResidual)}\\,\\mathrm{A}`,
          `\\max |\\text{voltage-constraint residual}| &= ${mathNumber(work.voltageResidual)}\\,\\mathrm{V}`,
        ])}</Formula>
        <p>Small residuals mean the computed voltages and currents satisfy the displayed equations. This checks this instant's circuit solution; the state equation describes how the stored voltages and currents change with time.</p>
      </>}
    </section>
  )
}
