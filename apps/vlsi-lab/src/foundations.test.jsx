import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { Foundations, INVERTER_USE, playbackMeaning } from './Foundations.jsx'
import { EXPERIMENTS, analyse } from './experiments.js'
import { DEFAULTS, dcPoint } from './model.js'
import { expectPlain } from '@ee-labs/prose/testing'

for (const experiment of EXPERIMENTS) it(`${experiment.id} exposes the complete introduction without disclosure controls`, () => {
  const html = renderToStaticMarkup(<Foundations experiment={experiment} />)
  for (const label of ['Purpose', 'Input', 'Expected output', 'Predict the change', 'Design tradeoffs', 'Model limits']) {
    expect(html).toContain(`<dt>${label}</dt>`)
  }
  for (const value of Object.values(experiment.foundation)) {
    expect(value.length).toBeGreaterThan(40)
    expectPlain(value, 'why')
  }
  expect(html).toContain('An inverter is a logic gate')
  expect(html).toContain(INVERTER_USE)
  expectPlain(INVERTER_USE, 'why')
  expect(html).toContain('CMOS means complementary metal-oxide-semiconductor')
  expect(html.indexOf('data-role="chip-context"')).toBeLessThan(html.indexOf('An inverter is a logic gate'))
  expect(html.slice(html.indexOf('<p>An inverter is a logic gate'))).not.toContain('<details')
})

it('distinguishes time inspection from static input and load sweeps', () => {
  for (const view of ['scope', 'timing', 'fanout', 'transfer']) expectPlain(playbackMeaning(view === 'transfer', view), 'why')
  expect(playbackMeaning(false, 'scope')).toContain('not transistor resistance, capacitance or propagation delay')
  expect(playbackMeaning(false, 'timing')).toBe(playbackMeaning(false, 'scope'))
  expect(playbackMeaning(true, 'transfer')).toContain('not a physical input slew rate')
  expect(playbackMeaning(false, 'fanout')).toContain('does not change the selected fanout')
})

it('supports the introductory predictions with the computed circuit behavior', () => {
  const base = analyse(DEFAULTS)
  const four = analyse({ ...DEFAULTS, fanout: 4 })
  const eight = analyse({ ...DEFAULTS, fanout: 8 })
  expect(four.response.measured).toBeGreaterThan(base.response.measured)
  expect(eight.response.measured).toBeLessThan(2 * four.response.measured)
  expect(analyse({ ...DEFAULTS, stages: 5 }).chain.elapsed).toBeGreaterThan(base.chain.elapsed)
  const wide = analyse({ ...DEFAULTS, wp: 4 })
  expect(wide.gate.tpHL).toBeGreaterThan(base.gate.tpHL)
  expect(wide.gate.tpLH).toBeLessThan(base.gate.tpLH)
  expect(dcPoint(0).v.out).toBeCloseTo(1.8)
  expect(dcPoint(1.8).v.out).toBeCloseTo(0)
})
