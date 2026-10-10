import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { View, Readouts } from './App.jsx'
import { analyse, DEFAULTS } from './analysis.js'

it('AM spectrum follows the modulation knob despite the default FM deviation', () => {
  const spectra = [0.2, 0.8].map(m => {
    const p = { ...DEFAULTS, m }
    const a = analyse(p)
    const rendered = View({ view: 'spectrum', a, p, fm: false })
    expect(rendered.props.amps).toEqual(a.am().spectrum.amps)
    const html = renderToStaticMarkup(<Readouts view="spectrum" a={a} p={p} isFm={false} />)
    expect(html).not.toContain('Carson bandwidth')
    return rendered.props.amps
  })
  expect(spectra[0]).not.toEqual(spectra[1])
})

it('FM spectrum uses the FM calculation and exposes Carson bandwidth', () => {
  const p = { ...DEFAULTS, deviation: 750 }
  const a = analyse(p)
  expect(View({ view: 'spectrum', a, p, fm: true }).props.amps).toEqual(a.fm().spectrum.amps)
  expect(View({ view: 'scope', a, p, fm: true }).props.data).toEqual(a.fm().buf.subarray(2048, 2560))
  expect(renderToStaticMarkup(<Readouts view="spectrum" a={a} p={p} isFm />)).toContain('Carson bandwidth')
})
