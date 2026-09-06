import { describe, expect, it } from 'vitest'
import katex from 'katex'
import { complex as cx, equations, normalize } from '@ee-labs/network'
import { EXPERIMENTS, defaultsOf, byId } from './experiments.js'
import { analyse } from './math.js'
import { workedState } from './workedState.js'
import { workedPhasor } from './workedPhasor.js'
import { workedSolve } from './workedSolve.js'
import { refusalSteps } from './components/WorkedRefusal.jsx'

const at = (exp, over = {}, time) => analyse(exp, { ...defaultsOf(exp.id), ...over }, time)
const close = (a, b, message) => expect(Math.abs(a - b), message).toBeLessThan(1e-7 * Math.max(1, Math.abs(a), Math.abs(b)))
const render = (work, id) => work.steps.forEach((step) => {
  expect(() => katex.renderToString(`\\begin{aligned}${step.latex.join(' \\\\ ')}\\end{aligned}`, { throwOnError: true }), `${id}: ${step.title}`).not.toThrow()
})

describe('worked derivations across the full circuit elements course', () => {
  it('offers equations for every example and a solved derivation for every solvable default', () => {
    for (const exp of EXPERIMENTS) {
      expect(exp.views, exp.id).toContain('equations')
      const x = at(exp)
      if (x.sol) expect(workedSolve(equations(x.sol.norm, x.sol), x.sol).unavailable, exp.id).toBeUndefined()
      else {
        expect(x.refusal, exp.id).toBeTruthy()
        const eq = equations(normalize(x.net))
        const steps = refusalSteps(eq)
        render({ steps }, exp.id)
        expect(steps.at(-1).title).toMatch(/contradiction|missing independent/)
      }
    }
  })
  it('derives the states and slopes in every state-equation example', () => {
    for (const exp of EXPERIMENTS.filter((e) => e.views.includes('state'))) {
      const x = at(exp)
      const work = workedState(x)
      render(work, exp.id)
      work.slopes.forEach((s, i) => close(s, x.now.dxdt[i], `${exp.id} slope ${i}`))
      work.answer.forEach((s, i) => close(s, x.now.x[i], `${exp.id} state ${i}`))
    }
  })
  it('checks the branched state slopes against capacitor KCL and inductor KVL', () => {
    for (const t of [0, 0.0001, 0.001]) {
      const p = {...defaultsOf('h8'), v0:2, i0:-0.01, phi:30}
      const x = analyse(byId.h8, p, t)
      const ci = x.dyn.states.findIndex(s=>s.id==='C1')
      const li = x.dyn.states.findIndex(s=>s.id==='L1')
      const vc=x.now.x[ci], il=x.now.x[li], u=x.now.u[0]
      close(x.now.dxdt[ci], ((u-vc)/p.R1-il)/p.C1, 'capacitor KCL')
      close(x.now.dxdt[li], (vc-p.R2*il)/p.L1, 'inductor KVL')
      close(x.sol.i.R1, (u-vc)/p.R1, 'output reconstruction')
      if(t===0) { close(vc,2,'initial capacitor voltage'); close(il,-0.01,'initial inductor current') }
    }
  })
  it('covers integrators, source corners, damping regimes, initial energy and sine phase changes', () => {
    for (const [id, over, t] of [
      ['f1', {}, 0], ['f1', {}, 0.0007], ['f2', {}, 0.001],
      ['f3', { v0: 4 }, 0.001], ['f7', {}, 0.002],
      ['g3', { R1: 800 }, 0.001], ['g3', { R1: 200 }, 0.001], ['g3', { R1: 50 }, 0.001],
      ['g4', {}, 0.001], ['g5', {}, 0.001],
      ['h8', { v0: 2, i0: -0.01, phi: 30 }, 0.001],
      ['h1', { A: -5, phi: 45 }, 0.001], ['h3', { A: 0 }, 0],
    ]) {
      const x = at(byId[id], over, t), work = workedState(x)
      render(work, id)
      work.answer.forEach((s, i) => close(s, x.now.x[i], `${id} state ${i}`))
      work.slopes.forEach((s, i) => close(s, x.now.dxdt[i], `${id} slope ${i}`))
    }
  })
  it('derives every phasor example, including zero and negative source amplitudes', () => {
    for (const exp of EXPERIMENTS.filter((e) => e.views.includes('phasor'))) {
      for (const over of [{}, { A: 0 }, { A: -3, phi: 67 }]) {
        const x = at(exp, over), work = workedPhasor(exp, x)
        render(work, exp.id)
        close(cx.cabs(cx.csub(work.I, x.ac.i[exp.phasor.current])), 0, exp.id)
        work.volts.forEach((v, i) => close(cx.cabs(cx.csub(v, x.ac.volt[exp.phasor.volts[i]])), 0, exp.id))
      }
    }
  })
})
