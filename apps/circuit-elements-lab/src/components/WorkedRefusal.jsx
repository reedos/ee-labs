import React from 'react'
import { n, mat, par } from '../derivationMath.js'
import { WorkedDerivation } from './WorkedDerivation.jsx'

/** Explain inconsistent or underdetermined displayed equations without inventing a solution. */
export function refusalSteps(eq) {
  const rows = eq.M.map((row, i) => [...row, eq.r[i]])
  const columns = eq.unknowns.length
  const steps = [{ title: 'Write the system that must hold simultaneously',
    text: 'The entries left of the final column multiply the unknowns; the final column is the right-hand side. The question is whether one set of voltages and currents can satisfy every row.',
    latex: [`[M\\mid r] &= ${mat(rows)}`] }]
  let rank = 0
  for (let col = 0; col < columns; col++) {
    let best = rank
    for (let k = rank + 1; k < rows.length; k++) if (Math.abs(rows[k][col]) > Math.abs(rows[best]?.[col] || 0)) best = k
    if (!rows[best] || rows[best][col] === 0) continue
    if (best !== rank) {
      ;[rows[rank], rows[best]] = [rows[best], rows[rank]]
      steps.push({ title: 'Bring a nonzero coefficient into the next pivot position', text: 'Swapping two equations changes their order, not the conditions they impose.', latex: [`R_{${rank + 1}} &\\leftrightarrow R_{${best + 1}}`] })
    }
    for (let k = rank + 1; k < rows.length; k++) {
      if (rows[k][col] === 0) continue
      const factor = rows[k][col] / rows[rank][col]
      rows[k] = rows[k].map((v, j) => v - factor * rows[rank][j])
      rows[k][col] = 0
      steps.push({ title: `Cancel this column from row ${k + 1}`,
        text: 'Subtract the indicated multiple of the pivot row. This preserves the equations while revealing whether any remaining row contradicts them. R with a row number here means an equation row.',
        latex: [`R_{${k + 1}} &\\leftarrow R_{${k + 1}}-${par(factor)}R_{${rank + 1}}`, `[M\\mid r] &= ${mat(rows)}`] })
    }
    rank++
  }
  const contradictions = rows.filter((r) => r.slice(0, columns).every((v) => v === 0) && r[columns] !== 0)
  steps.push({ title: contradictions.length ? 'Read the contradiction' : 'Identify the missing independent condition',
    text: contradictions.length ? 'Every unknown has disappeared from this row, leaving zero equal to a nonzero number. No solution vector can make that statement true. The ideal circuit assumptions conflict.' : 'A unique solution needs one independent condition per unknown. The reduction leaves fewer pivot rows, so at least one voltage or current remains free. The circuit needs another independent constraint.',
    latex: contradictions.length ? contradictions.map((r) => `0 &= ${n(r[columns])}\\qquad\\text{(impossible)}`) : [`\\text{independent rows} &= ${rank}<${columns}=\\text{unknowns}`],
    note: 'Changing an ideal assumption or the relevant circuit setting may restore a solvable circuit. A fabricated numerical solution would conceal this conflict.' })
  return steps
}

export function WorkedRefusal({ eq }) {
  return <WorkedDerivation role="worked-refusal" title="Work through why this circuit has no unique solution" intro="Row reduction shows what prevents these equations from producing one consistent solution." steps={refusalSteps(eq)} />
}
