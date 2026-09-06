import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import Plot from './Plot.jsx'
import { TERMS } from './terms.js'
import { workedMath } from './math.js'
import { transfer } from './model.js'
import { expectPlain } from '@ee-labs/prose/testing'
import { PLOT_NOTES } from './plot-notes.js'

for (const [name, note] of Object.entries(PLOT_NOTES)) it(`${name} visible plot caption follows the prose budget`, () => {
  expectPlain(note, 'why')
})

it('pairs each analog drawing primitive with its visible label and swatch', () => {
  const html = renderToStaticMarkup(<Plot label="Test voltage plot" xMax={2} yMax={2}
    traces={[{ points: [[0, 1], [1, null], [2, 0]], color: '#abcdef', dashed: true, label: 'Reference with gap' }]}
    marks={[{ x: 1, label: 'Input threshold' }]}
    regions={[{ from: 0.8, to: 1.2, color: '#123456', label: 'Undefined input' }]}
    spans={[{ from: 0.2, to: 0.8, y: 0.4, color: '#123456', label: 'Low noise margin' }]}
    cursor={0} cursorLabel="Input cursor" point={[0, 1]} pointLabel="Output sample" />)
  for (const label of ['Reference with gap', 'Input threshold', 'Undefined input', 'Low noise margin', 'Input cursor', 'Output sample']) {
    expect(html).toContain(`<span>${label}</span>`)
  }
  expect(html.match(/class="legend-item"/g)).toHaveLength(6)
  for (const kind of ['line dashed', 'region', 'span', 'dot']) expect(html).toContain(`plot-key ${kind}`)
  expect(html).toContain('--key-color:#abcdef')
})

it('omits labels for absent cursor and dot', () => {
  const html = renderToStaticMarkup(<Plot label="Empty plot" traces={[]} xMax={1} yMax={1}
    cursorLabel="Hidden cursor" pointLabel="Hidden dot" />)
  expect(html).not.toContain('Hidden cursor')
  expect(html).not.toContain('Hidden dot')
})

it('defines input limits and output aliases before the noise-margin formulas', () => {
  expect(TERMS.vih.def).toBe('The lowest guaranteed high input voltage is VIH.')
  expect(TERMS.vil.def).toBe('The highest guaranteed low input voltage is VIL.')
  const blocks = workedMath({ dc: transfer() }, {}, 'transfer').blocks
  expect(blocks[0].text).toContain(TERMS.vih.def.replace('VIH.', 'VIH (V_IH).'))
  expect(blocks[0].text).toContain(TERMS.vil.def.replace('VIL.', 'VIL (V_IL).'))
  const margin = blocks.findIndex((block) => block.tex?.startsWith('NM_L='))
  expect(blocks[margin - 1].text).toContain('highest guaranteed low output voltage is VOL (V_OL)')
  expect(blocks[margin - 1].text).toContain('lowest guaranteed high output voltage is VOH (V_OH)')
})
