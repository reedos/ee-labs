import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { equations, normalize, solveDC } from '@ee-labs/network'
import { EXPERIMENTS, defaultsOf } from './experiments.js'
import { analyse } from './math.js'
import { workedSolve } from './workedSolve.js'
import { WorkedSolution } from './components/WorkedSolution.jsx'

describe('the worked matrix solution', () => {
  it('derives the user’s two fixed voltages and equal-and-opposite currents by substitution', () => {
    const sol = solveDC(normalize({ elements: [
      { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: -1.086 },
      { type: 'V', id: 'C1', nodes: ['n1', 'gnd'], value: -2.983 },
      { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: 1000 },
    ] }))
    const eq = equations(sol.norm, sol)
    const work = workedSolve(eq, sol)
    expect(work.unavailable).toBeUndefined()
    expect(work.steps.map((s) => s.kind)).toEqual(['solve', 'solve', 'resistor', 'solve', 'solve'])
    expect(work.values[0]).toBeCloseTo(-1.086, 12)
    expect(work.values[1]).toBeCloseTo(-2.983, 12)
    expect(work.values[2]).toBeCloseTo(-0.001897, 12)
    expect(work.values[3]).toBeCloseTo(0.001897, 12)
    expect(work.steps[3].latex.join(' ')).toContain('-1.086')
    expect(work.steps[3].note).toContain('opposite direction')
    expect(work.kclResidual).toBeLessThan(1e-15)
    const html = renderToStaticMarkup(<WorkedSolution eq={eq} sol={sol} />)
    expect(html).not.toContain('katex-error')
    expect(html).toContain('The solution vector')
  })

  it('uses elimination for coupled node voltages and agrees with the circuit solver', () => {
    const sol = solveDC(normalize({ elements: [
      { type: 'I', id: 'I1', nodes: ['gnd', 'a'], value: 0.002 },
      { type: 'R', id: 'R1', nodes: ['a', 'gnd'], value: 1000 },
      { type: 'R', id: 'R2', nodes: ['a', 'b'], value: 2000 },
      { type: 'R', id: 'R3', nodes: ['b', 'gnd'], value: 3000 },
    ] }))
    const eq = equations(sol.norm, sol)
    const work = workedSolve(eq, sol)
    expect(work.unavailable).toBeUndefined()
    expect(work.steps.some((s) => s.kind === 'eliminate')).toBe(true)
    work.values.forEach((v, j) => expect(v).toBeCloseTo(sol.v[eq.unknowns[j].node], 10))
    expect(renderToStaticMarkup(<WorkedSolution eq={eq} sol={sol} />)).not.toContain('katex-error')
  })

  it('derives every solvable experiment at its default cursor without borrowing the solver’s unknowns', () => {
    for (const exp of EXPERIMENTS) {
      const x = analyse(exp, defaultsOf(exp.id))
      if (!x.sol) continue
      const eq = equations(x.sol.norm, x.sol)
      const work = workedSolve(eq, x.sol)
      expect(work.unavailable, exp.id).toBeUndefined()
      work.values.forEach((v, j) => {
        const u = eq.unknowns[j]
        const expected = u.kind === 'v' ? x.sol.v[u.node] : x.sol.i[u.id]
        expect(Math.abs(v - expected), `${exp.id}: ${u.node || u.id}`).toBeLessThan(1e-7 * Math.max(1, Math.abs(expected)))
      })
      expect(renderToStaticMarkup(<WorkedSolution eq={eq} sol={x.sol} />), exp.id).not.toContain('katex-error')
    }
  })

  it('rebuilds the substitutions for changed resistance, initial voltage and cursor time', () => {
    const exp = EXPERIMENTS[41]
    expect(exp.id).toBe('h1')
    const results = []
    for (const [resistance, time] of [[1000, 0.002], [2000, 0.003], [100, 0]]) {
      const x = analyse(exp, { ...defaultsOf(exp.id), R1: resistance, v0: -2 }, time)
      const eq = equations(x.sol.norm, x.sol)
      const work = workedSolve(eq, x.sol)
      expect(work.unavailable).toBeUndefined()
      work.values.forEach((v, j) => {
        const u = eq.unknowns[j]
        expect(v).toBeCloseTo(u.kind === 'v' ? x.sol.v[u.node] : x.sol.i[u.id], 10)
      })
      results.push(work.steps.find((s) => s.kind === 'resistor').latex.join(' '))
    }
    expect(new Set(results).size).toBe(3)
  })
})
