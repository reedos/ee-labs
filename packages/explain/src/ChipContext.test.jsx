import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { expectPlain } from '@ee-labs/prose/testing'
import { ChipContext, CHIP_CONTEXT, CHIP_MATERIALS } from './ChipContext.jsx'

it('defines fabrication without implying that all components are carved from silicon', () => {
  for (const text of Object.values(CHIP_CONTEXT)) expectPlain(text, 'why')
  expect(CHIP_CONTEXT.process).toContain('Deposition adds films')
  expect(CHIP_CONTEXT.process).toContain('doping introduces atoms')
  for (const component of ['Transistors', 'Resistors', 'Capacitors', 'Metal interconnects']) expect(CHIP_CONTEXT.components).toContain(component)
})

it('pairs each named material with its full name, use and tradeoff', () => {
  expect(CHIP_MATERIALS.map((m) => m.symbol)).toEqual(['Si', 'SiGe', 'InP', 'SiC / GaN'])
  for (const material of CHIP_MATERIALS) {
    expect(material.name.length).toBeGreaterThan(5)
    expectPlain(material.benefit, 'why')
    expectPlain(material.tradeoff, 'why')
  }
  const html = renderToStaticMarkup(<ChipContext />)
  expect(html.indexOf('integrated circuit (IC)')).toBeLessThan(html.indexOf('<details'))
  expect(html).not.toContain('<details open')
  for (const material of CHIP_MATERIALS) expect(html).toContain(material.name)
})
