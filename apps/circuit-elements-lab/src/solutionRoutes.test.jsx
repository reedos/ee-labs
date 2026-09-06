import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { EXPERIMENTS, byId, defaultsOf } from './experiments.js'
import { solutionRoutes } from './solutionRoutes.js'
import { SolutionRoutes } from './components/SolutionRoutes.jsx'

const guide = (id) => {
  const exp = byId[id]
  return solutionRoutes(exp, { net: exp.net(defaultsOf(id)), sol: {} })
}

it('explains all three methods in every experiment and links only to offered views', () => {
  for (const exp of EXPERIMENTS) {
    const x = { net: exp.net(defaultsOf(exp.id)), sol: {} }
    const model = solutionRoutes(exp, x)
    expect(model.routes.map((r) => r.id)).toEqual(['equations', 'state', 'phasor'])
    for (const route of model.routes) {
      if (route.view) expect(exp.views, exp.id).toContain(route.view)
      expect(route.description.length, exp.id).toBeGreaterThan(60)
    }
    const html = renderToStaticMarkup(<SolutionRoutes exp={exp} x={x} view={exp.view} onChoose={() => {}} />)
    expect(html, exp.id).toContain('Choose a solution route')
    expect(html, exp.id).toContain('How they meet:')
  }
})

it('distinguishes a DC solve, an evolving stored state, and the phasor steady sinusoid', () => {
  expect(guide('a1').routes[1].view).toBeNull()
  expect(guide('a1').routes[1].description).toContain('No time-evolution')
  expect(guide('h1').routes[0].description).toContain('C1 voltage')
  expect(guide('h1').routes[1].description).toContain('initial conditions')
  expect(guide('h1').routes[2].description).toContain('does not include the startup')
  expect(guide('h1').connection).toContain('If the natural response decays')
  expect(guide('f3').routes[2].view).toBeNull()
})

it('does not invent storage states for a memoryless rectifier or promise a phasor for a diode waveform', () => {
  const memoryless = guide('i4')
  expect(memoryless.routes[1].description).toContain('No stored initial state')
  expect(memoryless.routes[1].view).toBe('scope')
  expect(memoryless.routes[2].description).toContain('generate harmonics')
  expect(guide('i6').routes[1].description).toContain('initial conditions')
})

it('directs an unsolved ideal circuit to its constraints rather than suggesting another method fixes it', () => {
  const exp = byId.e3
  const model = solutionRoutes(exp, { net: exp.net(defaultsOf(exp.id)), sol: null })
  expect(model.guidance).toContain('contradictory ideal assumptions')
  expect(model.routes[0].view).toBe('equations')
})
