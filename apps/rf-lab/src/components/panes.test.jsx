import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EXPERIMENTS, byId, defaultsOf } from '../experiments.js'
import { analyse } from '../math.js'
import { linePropsFor, sparamPropsFor } from '../view.js'
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

  it('the topbar carries the frequency and the reference the headline was read at', () => {
    // `RF_LAB_PLAN.md` §4.1. Every experiment measures against a reference
    // impedance, so every one of them shows which. An experiment with no
    // frequency knob shows no frequency, because it has none to show.
    for (const exp of EXPERIMENTS) {
      const out = html(<App initialId={exp.id} />)
      const hasF = exp.params.some((k) => k.key === 'f')
      expect(out.includes('data-role="frequency"'), `${exp.id} frequency`).toBe(hasF)
      expect(out, `${exp.id} shows no reference`).toContain('data-role="reference"')
      const ref = exp.params.find((k) => k.key === 'z0' || k.key === 'z0line' || k.key === 'RS')
      expect(ref, `${exp.id} has no reference knob`).toBeDefined()
      expect(out, `${exp.id} names its reference`).toContain(ref.label)
    }
  })
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

describe('the S-parameter view says when a trace leaves the plot', () => {
  const at = (id, over = {}) => {
    const p = { ...defaultsOf(id), ...over }
    return { exp: byId[id], p, x: analyse(byId[id], p) }
  }

  it('an entry below the decibel floor is named, because a flat line at the bottom reads as a measurement', () => {
    // `REVIEW_PLAYBOOK.md` §10: where the cap truncates, the readout says so.
    // Five pads of 30 dB put the transmission at −150 dB, and the axis stops at
    // −60 dB, so the trace is drawn along the floor.
    const deep = at('d4', { chain: 'pads', stages: 5, db: 30 })
    const props = sparamPropsFor(deep.exp, deep.p, deep.x)
    expect(props.clipped).toContain('S21')
    expect(props.floor).toBe(-60)
    const out = html(<SparamPane {...deep} />)
    expect(out).toMatch(/below the -60 dB floor/)
    // The chip still carries the true reading, which is the number the trace
    // cannot show.
    expect(out).toMatch(/-150/)
  })

  it('an entry that is exactly zero is named too, and its chip says which of the two it is', () => {
    // A matched pad reflects nothing, so S11 has no decibels at all and its
    // trace lies along the floor for its whole length. That is the same defect
    // as a clipped trace: a line at the bottom of a plot reads as a reading.
    const matched = at('d4')
    const props = sparamPropsFor(matched.exp, matched.p, matched.x)
    expect(props.clipped).toEqual(['S11', 'S22'])
    const out = html(<SparamPane {...matched} />)
    expect(out).toMatch(/S11 and S22 reach below/)
    // Nothing comes back at a reflection, and nothing gets through at a
    // transmission. The two are not the same sentence.
    expect(out).toMatch(/nothing comes back/)
    expect(out).not.toMatch(/nothing gets through/)
  })

  it('a two-port whose entries all sit inside the axis says nothing about a floor', () => {
    const inside = at('d5')
    expect(sparamPropsFor(inside.exp, inside.p, inside.x).clipped).toEqual([])
    expect(html(<SparamPane {...inside} />)).not.toMatch(/floor/)
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

  it('a complex load says on the numbers pane that its reactance does not move', () => {
    // C5's note claims the pane says which of the two is on the bench, so the
    // pane has to say it. A real load is a component and its reactance moves
    // with frequency, and this analysis holds an impedance instead.
    const { exp, p, x } = at('c5')
    const out = html(<NumbersPane exp={exp} x={x} p={p} />)
    expect(out).toContain('data-row="The load holds this reactance"')
    expect(out).toMatch(/at every frequency/)
    // A real load takes no such row, because there is nothing to distinguish.
    const plain = at('c5', { XL: 0 })
    expect(html(<NumbersPane exp={plain.exp} x={plain.x} p={plain.p} />)).not.toContain('data-row="The load holds this reactance"')
  })

  it('an entry the solve returns as noise prints as zero, because the note beside it says zero', () => {
    // The pad's S11 comes back as 3.3e-16 from an exact solve, which is
    // −309.5 dB. Printed as it stands, a reader takes it for a reflection 310
    // decibels down while D2's note says S11 is zero. The scale is the largest
    // entry of the same matrix, so this is not a fixed threshold in ohms.
    const { exp, p, x } = at('d2')
    expect(x.s[11].mag).toBeGreaterThan(0)
    expect(x.s[11].mag).toBeLessThan(1e-12)
    const out = html(<NumbersPane exp={exp} x={x} p={p} />)
    const s11 = out.slice(out.indexOf('data-row="S11"'), out.indexOf('data-row="S12"'))
    expect(s11).toMatch(/>0 ∠ 0.00°</)
    expect(s11).not.toMatch(/e-/)
    expect(s11).toMatch(/nothing comes back/)
    // S21 is a real reading and keeps its decibels.
    const s21 = out.slice(out.indexOf('data-row="S21"'), out.indexOf('data-row="S22"'))
    expect(s21).toMatch(/-3 dB/)
    // The rows that measure a difference are still exponential, because they
    // are labelled as differences relative to the scale and read as one.
    expect(out).toMatch(/data-row="Reciprocity"/)
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

  it('a pair of equal resistances is joined by a wire, and the chart says so', () => {
    // C2's third step sets the load to the source resistance. The network is
    // one entry and it is a wire, so there is no element and no arc, and the
    // caption said "0 elements, one arc each".
    const wire = at('c2', { RL: 50 })
    expect(wire.x.chosen.elements.length).toBe(0)
    const out = html(<ChartPane {...wire} />)
    expect(out).toMatch(/no element is needed and no arc is drawn/)
    expect(out).not.toMatch(/0 elements/)
  })

  it('a band with no edge on one side names the side, and the two topologies differ', () => {
    // `REVIEW_PLAYBOOK.md` §1: a sentence has to follow every control that can
    // change its fact. At a standing-wave ratio of two the low-pass network has
    // no lower edge and the high-pass one has no upper edge, and a label that
    // named the same side for both would be wrong for one of them.
    const low = at('c3', { target: 2, pick: 'lowpass' })
    const high = at('c3', { target: 2, pick: 'highpass' })
    expect(html(<SweepPane {...low} />)).toMatch(/No lower edge/)
    expect(html(<SweepPane {...high} />)).toMatch(/No upper edge/)
    expect(html(<NumbersPane {...low} />)).toMatch(/no lower edge/)
    expect(html(<NumbersPane {...high} />)).toMatch(/no upper edge/)
    // And the frequencies the crossing was looked for between are named, because
    // a search that found nothing measured less than "it never crosses".
    expect(html(<SweepPane {...low} />)).toMatch(/searched from/)
  })

  it('a ratio the section never reaches says so instead of showing a dash', () => {
    // The quarter-wave section's worst reading is the load handed through, so a
    // ratio above that one is never crossed. The row used to print a dash,
    // which reads as a reading that failed rather than as the answer.
    const none = at('c4', { target: 2.5 })
    expect(none.x.bw.bounded).toBe(false)
    const rows = html(<NumbersPane {...none} />)
    expect(rows).toMatch(/never crosses that ratio/)
    expect(rows).not.toMatch(/>—</)
    expect(html(<EquationsPane {...none} />)).toMatch(/never crosses that ratio/)
    // The comparison against the L network goes with it, because there is no
    // width on one side to divide by.
    expect(rows).toMatch(/one of the two has no band/)
  })

  it('the section holds a band whose lower edge a symmetric search would have missed', () => {
    // The search below the design frequency is not the same width as the one
    // above it. At a ratio of 1.8 the lower edge is under half the design
    // frequency, and the pane reports a band rather than none.
    const wide = at('c4', { target: 1.8 })
    expect(wide.x.bw.bounded).toBe(true)
    expect(wide.x.bw.lower).toBeLessThan(wide.p.f / 2)
    const rows = html(<NumbersPane {...wide} />)
    expect(rows).toContain('data-row="Fractional bandwidth to 1.8"')
    expect(rows).not.toMatch(/no lower edge|never crosses/)
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

describe('the line view draws an axis for the wave above it', () => {
  it('names the quantity, its division and both ends of its range', () => {
    // `REVIEW_PLAYBOOK.md` §4: a view with no axis at all, and §6: a curve on a
    // magnified scale states the scale. The standing wave is drawn against its
    // own largest voltage, because the drive is arbitrary, and the picture said
    // so nowhere. A reader could not tell a ripple of a few per cent from one
    // that reaches zero.
    const p = defaultsOf('a3')
    const out = html(<LinePane exp={byId.a3} x={analyse(byId.a3, p)} p={p} />)
    expect(out).toMatch(/Voltage over its largest/)
    expect(out).toMatch(/class="rf-axis"/)
    expect(out).toMatch(/The wave is drawn over its own largest voltage/)
  })

  it('the curve stays inside the axis it is drawn against, at every load the knob reaches', () => {
    // The samples are divided by the largest of themselves, so the trace runs
    // from zero to one whatever the reflection is. A short reflects everything
    // and doubles the largest voltage, which is where a fixed scale would have
    // put the peak off the top of the picture.
    for (const RL of [0.1, 1, 25, 50, 100, 5000]) {
      const p = { ...defaultsOf('a3'), RL }
      const v = linePropsFor(byId.a3, p, analyse(byId.a3, p))
      for (const s of v.samples) {
        expect(s.v, `a3 at ${RL} ohms draws ${s.v}`).toBeGreaterThanOrEqual(0)
        expect(s.v, `a3 at ${RL} ohms draws ${s.v}`).toBeLessThanOrEqual(1 + 1e-12)
      }
    }
  })
})
