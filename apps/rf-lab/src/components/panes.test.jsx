import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EXPERIMENTS, byId, defaultsOf } from '../experiments.js'
import { analyse } from '../math.js'
import { sparamPropsFor } from '../view.js'
import App from '../App.jsx'
import { ChartPane, EquationsPane, LinePane, NumbersPane, SweepPane } from './panes.jsx'
import { SparamPane } from './SparamPane.jsx'

// Every view an experiment offers is rendered here, at that experiment's own
// defaults, as markup.
//
// `experiments.test.js` checks that the ANALYSIS a view needs is there. This
// file checks that the component given that analysis produces something, which
// is the failure the other one cannot see: a pane standing in for a view that
// has since landed would pass every numeric test in the suite and show the
// reader a sentence apologising for itself.

const PANE_OF = { chart: ChartPane, line: LinePane, sweep: SweepPane, sparam: SparamPane, equations: EquationsPane, numbers: NumbersPane }

const html = (el) => renderToStaticMarkup(el)

describe('every view an experiment offers renders', () => {
  for (const exp of EXPERIMENTS) {
    it(`${exp.id} ${exp.views.join(', ')}`, () => {
      const p = defaultsOf(exp.id)
      const x = analyse(byId[exp.id], p)
      for (const view of exp.views) {
        const Pane = PANE_OF[view]
        expect(Pane, `${exp.id} offers ${view}, which nothing draws`).toBeDefined()
        const out = html(<Pane exp={exp} x={x} p={p} />)
        expect(out.length, `${exp.id} ${view} rendered ${out.length} characters`).toBeGreaterThan(200)
        expect(out, `${exp.id} ${view} is still a stub`).not.toMatch(/not built yet/)
        expect(out, `${exp.id} ${view} shows a NaN`).not.toMatch(/NaN/)
        expect(out, `${exp.id} ${view} shows an undefined`).not.toMatch(/undefined/)
      }
    })
  }
})

describe('the whole shell mounts, for every experiment in every one of its views', () => {
  // This is the check that catches a prop the shell forgot to pass. The app
  // itself never passes `initialId` or `initialView`; they exist for this.
  for (const exp of EXPERIMENTS) {
    it(`${exp.id}`, () => {
      for (const view of exp.views) {
        const out = html(<App initialId={exp.id} initialView={view} />)
        expect(out, `${exp.id} in ${view} shows a NaN`).not.toMatch(/NaN/)
        expect(out, `${exp.id} in ${view} shows an undefined`).not.toMatch(/undefined/)
        expect(out, `${exp.id} in ${view} lost its name`).toContain(exp.name)
        // The note, the headline and the pane are all on the first screen.
        expect(out, `${exp.id} in ${view} lost its note`).toContain('data-role="see"')
        expect(out, `${exp.id} in ${view} lost its headline`).toContain('data-role="headline"')
      }
    })
  }
})

describe('the line and the sweep say what they are drawing', () => {
  it('the line view names its length, its wavelength and its standing-wave ratio', () => {
    const p = defaultsOf('a3')
    const out = html(<LinePane exp={byId.a3} x={analyse(byId.a3, p)} p={p} />)
    expect(out).toContain('data-role="line-legend"')
    expect(out).toMatch(/Wavelength/)
    expect(out).toMatch(/Standing-wave ratio/)
    // The marks are quarter wavelengths, and a quarter-wave section carries one
    // at each end.
    expect(out).toContain('data-tick="0.00"')
    expect(out).toContain('data-tick="0.25"')
  })

  it('the sweep view carries the refusal under the plot, not in a tooltip', () => {
    const p = defaultsOf('a5')
    const out = html(<SweepPane exp={byId.a5} x={analyse(byId.a5, p)} p={p} />)
    const declined = out.indexOf('data-role="declined"')
    expect(declined).toBeGreaterThan(out.indexOf('data-role="sweep"'))
    expect(out).toMatch(/no rational transfer function/)
    expect(out).toMatch(/exact at every frequency/)
  })

  it('the chart view marks the load and draws the path a line takes', () => {
    const p = defaultsOf('b3')
    const out = html(<ChartPane exp={byId.b3} x={analyse(byId.b3, p)} p={p} />)
    expect(out).toContain('data-point="load"')
    expect(out).toContain('data-point="input"')
    expect(out).toContain('data-path="towards the generator"')
    expect(out).toMatch(/data-circle="VSWR 2/)
  })
})

describe('the S-parameter view, and the calibration plane the Instruments Lab needs', () => {
  const at = (id, over = {}) => {
    const p = { ...defaultsOf(id), ...over }
    return { exp: byId[id], p, x: analyse(byId[id], p) }
  }

  it('draws all four entries twice, once in decibels and once as an angle', () => {
    const { exp, p, x } = at('d2')
    const out = html(<SparamPane exp={exp} x={x} p={p} />)
    for (const key of ['11', '12', '21', '22']) {
      expect(out, `S${key} magnitude`).toContain(`data-trace="S${key}"`)
      expect(out, `S${key} angle`).toContain(`data-angle="S${key}"`)
    }
    expect(out).toContain('data-role="marker"')
  })

  it('reads all four entries at one frequency, beside the plot', () => {
    const { exp, p, x } = at('d2')
    const out = html(<SparamPane exp={exp} x={x} p={p} />)
    expect(out).toContain('data-role="marker-read"')
    for (const key of ['11', '12', '21', '22']) expect(out).toContain(`data-entry="S${key}"`)
  })

  it('a moved reference plane turns every angle and leaves every magnitude alone', () => {
    // This is the Instruments Lab's whole need from this view, and it is the
    // claim the props were shaped around. A reflection crosses the moved length
    // twice and a transmission crosses it once, so the two turn by different
    // amounts. The magnitudes do not move at all, because moving a calibration
    // plane moves the measurement and not the circuit.
    const { exp, p, x } = at('d5')
    const flat = sparamPropsFor(exp, p, x, 0)
    const moved = sparamPropsFor(exp, p, x, 30)
    const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180
    for (const key of ['11', '21', '12', '22']) {
      const a = flat.at.find((q) => q.key === key)
      const b = moved.at.find((q) => q.key === key)
      expect(b.mag, `S${key} magnitude moved`).toBeCloseTo(a.mag, 12)
      const turns = key === '11' || key === '22' ? 2 : 1
      expect(wrap(b.deg - (a.deg - turns * 30)), `S${key} angle`).toBeCloseTo(0, 9)
    }
    expect(html(<SparamPane exp={exp} x={x} p={p} plane={30} />)).toMatch(/reference plane has moved/)
  })

  it('a marker past the swept window is left off the plot and named in the legend', () => {
    const inside = at('d2')
    expect(html(<SparamPane {...inside} />)).toContain('data-role="marker"')
    const outside = at('d2', { f: 1.2e10 })
    const out = html(<SparamPane {...outside} />)
    expect(out).not.toContain('data-role="marker"')
    expect(out).toMatch(/outside the window drawn here/)
    // The four readings are still there, because the entries exist at that
    // frequency whether or not the plot reaches it.
    for (const key of ['11', '12', '21', '22']) expect(out).toContain(`data-entry="S${key}"`)
  })
})

describe('the equations pane prints the closed form with its own numbers in it', () => {
  const at = (id, over = {}) => {
    const p = { ...defaultsOf(id), ...over }
    return { exp: byId[id], p, x: analyse(byId[id], p) }
  }

  it('the matching network shows the Q it solved and the components that reactance asks for', () => {
    const { exp, p, x } = at('c1')
    const out = html(<EquationsPane exp={exp} x={x} p={p} />)
    expect(out).toContain('data-eq="Q"')
    expect(out).toContain('data-eq="X_series"')
    expect(out).toContain('data-eq="X_shunt"')
    // The arithmetic is on screen, not only its answer.
    expect(out).toMatch(/√\(100\/50 − 1\)/)
  })

  it('a two-port that has no Z-matrix says so where the row would be', () => {
    const { exp, p, x } = at('d3', { object: 'transformer' })
    const out = html(<EquationsPane exp={exp} x={x} p={p} />)
    expect(out).toContain('data-role="declined"')
    expect(out).toMatch(/has no inverse/)
    // And the round trip that passes through it is not reported as a number.
    expect(out).not.toContain('data-eq="S to Z to ABCD to Y to S"')
  })

  it('the pi attenuator has all four descriptions and closes its round trip', () => {
    const { exp, p, x } = at('d3')
    const out = html(<EquationsPane exp={exp} x={x} p={p} />)
    expect(out).toContain('data-eq="S to Z to ABCD to Y to S"')
    expect(out).not.toContain('data-role="declined"')
  })
})

describe('the sweep pane says whether the response repeats', () => {
  const at = (id, over = {}) => {
    const p = { ...defaultsOf(id), ...over }
    return { exp: byId[id], p, x: analyse(byId[id], p) }
  }

  it('a lumped network has no repeat, and the legend says so instead of drawing marks', () => {
    const { exp, p, x } = at('c3')
    const out = html(<SweepPane exp={exp} x={x} p={p} />)
    expect(out).toMatch(/no repeat/)
    expect(out).not.toContain('class="rf-repeat"')
    // The band it was measured to is marked at both edges.
    expect((out.match(/class="rf-edge"/g) || []).length).toBe(2)
  })

  it('a quarter-wave section repeats, and the marks are drawn where it does', () => {
    const { exp, p, x } = at('c4')
    const out = html(<SweepPane exp={exp} x={x} p={p} />)
    expect(out).toMatch(/repeats every/)
    expect(out).toContain('class="rf-repeat"')
  })

  it('the window of a synthesised network follows the frequency it is designed at', () => {
    // `REVIEW_PLAYBOOK.md` §4: a fixed range let the content escape it. C3's
    // network is synthesised again at whatever frequency is set, so the band
    // moves with the knob. At 2.000 GHz the upper edge is at 2.512 GHz, which
    // is outside the window written for 1.000 GHz, and both edges have to stay
    // on the plot.
    for (const f of [3e8, 1e9, 2e9]) {
      const { exp, p, x } = at('c3', { f })
      const out = html(<SweepPane exp={exp} x={x} p={p} />)
      expect((out.match(/class="rf-edge"/g) || []).length, `both band edges at ${f} Hz`).toBe(2)
      expect(out, `the marker at ${f} Hz`).toContain('data-role="marker"')
      expect(x.bw.lower, `the lower edge at ${f} Hz`).toBeGreaterThan(x.sweepRange.from)
      expect(x.bw.upper, `the upper edge at ${f} Hz`).toBeLessThan(x.sweepRange.to)
    }
  })

  it('a frequency outside a fixed window loses its marker and says where it went', () => {
    // A5's window is the line's own, and its content follows the length rather
    // than the frequency. A frequency past the edge therefore has no line to
    // stand on, and a line drawn at the edge would name a frequency the reader
    // did not set.
    const { exp, p, x } = at('a5', { f: 8e9 })
    const out = html(<SweepPane exp={exp} x={x} p={p} />)
    expect(out).not.toContain('data-role="marker"')
    expect(out).toMatch(/outside the window drawn here/)
    // And inside the window it is drawn, with nothing said about it.
    const back = at('a5')
    const shown = html(<SweepPane exp={back.exp} x={back.x} p={back.p} />)
    expect(shown).toContain('data-role="marker"')
    expect(shown).not.toMatch(/outside the window/)
  })
})
