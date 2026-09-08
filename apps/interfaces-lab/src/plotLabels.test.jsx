import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { expectPlain } from '@ee-labs/prose/testing'
import PlotLegend from './components/PlotLegend.jsx'
import { INPUT_LIMITS, LOAD_KEY, BUDGET_KEY, waveformKey, pinPlotArea } from './plotLabels.js'

it('defines voltage limits before abbreviating them in the signal story', () => {
  expectPlain(INPUT_LIMITS, 'why')
  expect(INPUT_LIMITS).toContain('VIL is the maximum input voltage guaranteed to count as low')
  expect(INPUT_LIMITS).toContain('VIH is the minimum input voltage guaranteed to count as high')
})

it('keys every semantic curve, guide, region and probe', () => {
  expect(waveformKey(true)).toHaveLength(6)
  expect(waveformKey(false)).toHaveLength(4)
  expect(waveformKey(false).map((item) => item.label)).not.toContain('Pin voltage')
  expect(waveformKey(true).some((item) => item.kind === 'region' && item.label.includes('undefined'))).toBe(true)
  expect(LOAD_KEY).toHaveLength(4)
  expect(BUDGET_KEY).toHaveLength(4)
  for (const items of [waveformKey(true), waveformKey(false), LOAD_KEY, BUDGET_KEY]) {
    const markup = renderToStaticMarkup(<PlotLegend items={items} />)
    expect(markup).toContain('aria-label="Plot key"')
    expect(new Set(items.map((item) => item.label)).size).toBe(items.length)
    for (const item of items) {
      expect(markup).toContain(item.label)
      expect(item.color).toBeTruthy()
    }
  }
})

it('reserves annotation gutters while keeping pointer coordinates tied to the plotted area', () => {
  for (const width of [296, 366, 800, 1400]) {
    const area = pinPlotArea(width, 320)
    expect(area.w).toBeGreaterThan(150)
    expect(width - area.x - area.w).toBeGreaterThanOrEqual(52)
    expect(area.y).toBeGreaterThanOrEqual(34)
    for (const position of [0, 0.25, 1]) {
      const x = area.x + position * area.w
      expect((x - area.x) / area.w).toBeCloseTo(position)
    }
  }
})
