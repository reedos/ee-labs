import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EXPERIMENTS, byId, defaultsOf } from '../experiments.js'
import { stepResolution } from '../view.js'
import { analyse } from '../math.js'
import { CavityPane, CurvePane, EquationsPane, LinkPane, ModulationPane, NumbersPane, PulsePane, SchematicPane, SpectrumPane, StepPane } from './panes.jsx'

// Every view an experiment offers is rendered here, at that experiment's own
// defaults, as markup.
//
// `experiments.test.js` checks that the ANALYSIS a view needs is there. This
// file checks that the component given that analysis produces something, which
// is the failure the other one cannot see: a pane still standing in for a group
// that has since landed would pass every numeric test in the suite and show the
// reader a sentence apologising for itself.
//
// The canvas panes draw in an effect, which does not run under
// `renderToStaticMarkup`, so what is measured for those is the frame and the
// readouts around the canvas. The drawing itself is measured by the harness,
// `scripts/verify.mjs`.

const PANE_OF = {
  schematic: SchematicPane,
  curve: CurvePane,
  equations: EquationsPane,
  modulation: ModulationPane,
  step: StepPane,
  pulse: PulsePane,
  link: LinkPane,
  cavity: CavityPane,
  spectrum: SpectrumPane,
  numbers: NumbersPane,
}

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
        expect(out.length, `${exp.id} ${view} rendered ${out.length} characters`).toBeGreaterThan(120)
        expect(out, `${exp.id} ${view} is still a stub`).not.toMatch(/no circuit|no curve/)
        expect(out, `${exp.id} ${view} shows a NaN`).not.toMatch(/NaN/)
        expect(out, `${exp.id} ${view} shows an undefined`).not.toMatch(/undefined/)
      }
    })
  }
})

describe('what a pane puts on screen', () => {
  const at = (id, over = {}) => {
    const p = { ...defaultsOf(id), ...over }
    return { exp: byId[id], p, x: analyse(byId[id], p) }
  }

  it('the circuit carries a meter on every node and every element', () => {
    const { exp, p, x } = at('a2')
    const out = html(<SchematicPane exp={exp} x={x} p={p} />)
    for (const id of ['Vb', 'RL', 'D1', 'Iph']) expect(out, `the circuit omits ${id}`).toMatch(new RegExp(`data-el="${id}"`))
    for (const node of ['vb', 'c']) expect(out, `the circuit omits node ${node}`).toMatch(new RegExp(`data-node="${node}"`))
  })

  it('the waterfall draws a named bar for every loss, including the three at zero', () => {
    const { exp, p, x } = at('e5')
    const out = html(<LinkPane exp={exp} x={x} p={p} />)
    for (const it of x.budget.items) expect(out, `the waterfall omits ${it.name}`).toContain(it.name)
    // Three rows are losses this model does not include, drawn as zeros.
    expect((out.match(/class="is-zero"/g) || []).length).toBe(3)
  })

  it('the margin reads as off when the link does not close', () => {
    const closes = at('e5')
    const fails = at('e5', { length: 200e3 })
    expect(fails.x.budget.margin).toBeLessThan(0)
    expect(html(<LinkPane exp={closes.exp} x={closes.x} p={closes.p} />)).not.toMatch(/class="is-off"/)
    expect(html(<LinkPane exp={fails.exp} x={fails.x} p={fails.p} />)).toMatch(/class="is-off"/)
  })

  it('the link pane carries the refusal when no length of fibre reaches', () => {
    const spent = at('e5', { connectors: 20, splices: 20 })
    const out = html(<LinkPane exp={spent.exp} x={spent.x} p={spent.p} />)
    expect(out).toMatch(/link-refusal/)
    expect(out).toMatch(/no length of fibre reaches/)
    // And it is absent when the budget closes, because a flag that is always
    // there is not a flag.
    const closes = at('e5')
    expect(html(<LinkPane exp={closes.exp} x={closes.x} p={closes.p} />)).not.toMatch(/link-refusal/)
  })

  it('the cavity pane carries the refusal, because the refusal is content', () => {
    const { exp, p, x } = at('f1')
    const out = html(<CavityPane exp={exp} x={x} p={p} />)
    expect(out).toMatch(/cavity-refusal/)
    expect(out).toMatch(/transcendental/)
  })

  it('the spectrum pane marks the source as too wide when it is', () => {
    const narrow = at('f2')
    const wide = at('f2', { dLambda: 2e-9 })
    expect(wide.x.fits).toBe(false)
    expect(html(<SpectrumPane exp={narrow.exp} x={narrow.x} p={narrow.p} />)).not.toMatch(/class="is-off"/)
    expect(html(<SpectrumPane exp={wide.exp} x={wide.x} p={wide.p} />)).toMatch(/class="is-off"/)
  })

  it('the pulse pane prints both widths and the span they were measured over', () => {
    const { exp, p, x } = at('e2')
    const out = html(<PulsePane exp={exp} x={x} p={p} />)
    expect(out).toMatch(/Into the fibre/)
    expect(out).toMatch(/Out of the fibre/)
    expect(out).toMatch(/80\.000 km/)
  })

  it('the circuit pane names both devices, because the circuit does not tell them apart', () => {
    const { exp, p, x } = at('c1')
    const out = html(<SchematicPane exp={exp} x={x} p={p} />)
    for (const id of ['Vd', 'Rs', 'D1']) expect(out, `the circuit omits ${id}`).toMatch(new RegExp(`data-el="${id}"`))
    for (const node of ['vd', 'a']) expect(out, `the circuit omits node ${node}`).toMatch(new RegExp(`data-node="${node}"`))
    // C1's whole claim is one current and two lights, so the caption carries
    // both. A caption that named one of them would be the defect.
    expect(out).toMatch(/As an LED/)
    expect(out).toMatch(/as a laser/)
  })

  it('the equations pane prints every term of both equations with its own value', () => {
    const { exp, p, x } = at('d1')
    const out = html(<EquationsPane exp={exp} x={x} p={p} />)
    expect(out).toMatch(/dN\/dt/)
    expect(out).toMatch(/dS\/dt/)
    for (const t of [...x.carriers, ...x.photons]) expect(out, `the pane omits ${t.name}`).toContain(t.name)
    // Both sums are zero to their own floor, and the pane prints a bare zero
    // rather than the last bits of the largest term.
    expect((out.match(/>0</g) || []).length).toBeGreaterThanOrEqual(2)
  })

  it('the equations pane marks a drive current below threshold', () => {
    const above = at('d1')
    const below = at('d1', { current: 5e-3 })
    expect(below.x.s).toBe(0)
    expect(html(<EquationsPane exp={above.exp} x={above.x} p={above.p} />)).not.toMatch(/class="is-off"/)
    expect(html(<EquationsPane exp={below.exp} x={below.x} p={below.p} />)).toMatch(/class="is-off"/)
  })

  it('the modulation pane prints both forms of the relaxation frequency', () => {
    const { exp, p, x } = at('d3')
    const out = html(<ModulationPane exp={exp} x={x} p={p} />)
    expect(out).toMatch(/Relaxation frequency/)
    expect(out).toMatch(/The textbook form/)
    expect(out).toMatch(/modulation-readouts/)
    // The peak and the 3 dB point are both marked, so the picture carries the
    // two numbers the readouts carry.
    expect(out).toMatch(/mod-peak/)
    expect(out).toMatch(/mod-corner/)
    // And the phase beside the magnitude, per REVIEW_PLAYBOOK.md §3.
    expect(out).toMatch(/Phase there/)
    expect(out).toMatch(/-90\.00°/)
  })

  it('the step pane draws the prediction, flags it, then stops drawing it', () => {
    const plain = at('d4', { depth: 0.02 })
    const estimate = at('d4', { depth: 0.2 })
    const declined = at('d4', { depth: 0.5 })
    const drawn = (s) => html(<StepPane exp={s.exp} x={s.x} p={s.p} />)

    const a = drawn(plain)
    expect(a).toMatch(/step-predicted/)
    expect(a).not.toMatch(/is-estimate/)
    expect(a).not.toMatch(/class="is-off"/)

    const b = drawn(estimate)
    expect(b).toMatch(/step-predicted is-estimate/)
    expect(b).toMatch(/class="is-off"/)

    // Past the decline threshold the dashed curve is gone, which is the guard
    // on screen rather than in a sentence about the guard.
    const c = drawn(declined)
    expect(c).not.toMatch(/step-predicted/)
    expect(c).toMatch(/stops drawing it/)
  })

  it('the two curves on the step pane stand far enough apart to be read', () => {
    // REVIEW_PLAYBOOK.md §5. The pane exists to show one gap, so the gap is
    // measured against the range it is drawn over rather than assumed visible.
    // The pane is 190 px tall and the plot area is 54 of its 70 viewBox units.
    const tall = (54 / 70) * 190
    const shallow = stepResolution(at('d4', { depth: 0.05 }).x)
    const deep = stepResolution(at('d4', { depth: 0.3 }).x)
    expect(100 * shallow.fraction).toBeCloseTo(2.701, 2)
    expect(100 * deep.fraction).toBeCloseTo(12.37, 1)
    expect(tall * shallow.fraction).toBeCloseTo(3.96, 1)
    expect(tall * deep.fraction).toBeCloseTo(18.1, 0)
    // Four pixels is thin, so the difference is a printed number too.
    const { exp, p, x } = at('d4')
    expect(html(<StepPane exp={exp} x={x} p={p} />)).toMatch(/step-error/)
  })

  it('the step pane carries the large-signal refusal, because the refusal is content', () => {
    const { exp, p, x } = at('d4')
    const out = html(<StepPane exp={exp} x={x} p={p} />)
    expect(out).toMatch(/large-signal-refusal/)
    expect(out).toMatch(/cannot be told apart from physics/)
    expect(out).toMatch(/step-error/)
  })

  it('a pane asked for something the experiment has not got says so rather than throwing', () => {
    // These branches are unreachable through the app, because a pane is only
    // offered by an experiment that lists its view. They exist so that a group
    // file listing a view its analysis cannot feed fails visibly.
    const bare = { kind: 'detector', exp: byId.a1, p: {}, headline: { value: 1, unit: '', label: 'nothing' } }
    expect(html(<SchematicPane exp={byId.a1} x={bare} p={{}} />)).toMatch(/no circuit/)
    expect(html(<CurvePane exp={{ ...byId.a1, curve: null }} x={bare} p={{}} />)).toMatch(/no curve/)
  })
})
