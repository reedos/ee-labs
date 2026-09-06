import { describe, expect, it } from 'vitest'
import { EXPERIMENTS } from './experiments.js'
import { analyse, defaultsOf } from './analysis.js'
import { drawOf } from './layouts.js'
import { layoutProblems } from './layoutCheck.js'

// The schematics, checked as geometry.
//
// Four circuits in this lab are hand-placed: the DC armature loop, the
// transformer at each of its three stages, the induction machine's per-phase
// equivalent, and the thermal analogue. A browser probe cannot see a label
// written across its neighbour, because the DOM is correct either way and only
// the picture is wrong. `layoutCheck.js` measures the picture: every text box,
// symbol, wire and ground the Schematic would draw, placed by the same rules
// the component uses, and nothing may overlap anything else or leave the frame.
//
// The lab shipped without this file, and the first screenshots carried five
// collisions and two labels off the right edge.

/** The experiments that draw a circuit, one entry per drawing. */
const drawn = EXPERIMENTS.map((e) => {
  const params = defaultsOf(e)
  const x = analyse(e, params)
  return { e, x, draw: drawOf(x) }
}).filter((d) => d.draw)

describe('the schematics draw cleanly', () => {
  it('draws a circuit for every experiment whose model has one', () => {
    // Playbook §11: a count of zero passes every check below it. Groups A, B,
    // C and E each carry a circuit, so the sweep must find a good many.
    expect(drawn.length).toBeGreaterThan(20)
    const kinds = new Set(drawn.map((d) => d.x.kind))
    expect([...kinds].sort()).toEqual(['dc', 'im', 'losses', 'transformer'])
  })

  for (const { e, x, draw } of drawn) {
    it(`${e.id}: nothing overlaps and nothing leaves the frame`, () => {
      const meters = draw.meters === false ? null : x.sol || null
      const show = draw.meters === false ? 'none' : 'i'
      expect(layoutProblems(draw.layout, draw.elements, meters, show)).toEqual([])
    })
  }

  // The same drawings with the knobs moved, because a label's width follows
  // its value and a three-figure number can grow a prefix.
  for (const { e } of drawn) {
    it(`${e.id}: stays clean when the knobs move`, () => {
      const base = defaultsOf(e)
      for (const p of e.params) {
        if (p.kind === 'toggle' || p.kind === 'choice') continue
        for (const at of [p.min, p.max]) {
          if (!Number.isFinite(at)) continue
          let x
          try {
            x = analyse(e, { ...base, [p.key]: at })
          } catch {
            continue // A setting the model refuses is not a layout question.
          }
          const draw = drawOf(x)
          if (!draw) continue
          const meters = draw.meters === false ? null : x.sol || null
          const show = draw.meters === false ? 'none' : 'i'
          expect(layoutProblems(draw.layout, draw.elements, meters, show), `${e.id} with ${p.key} at ${at}`).toEqual([])
        }
      }
    })
  }

  it('the checker still reports a collision it is given one', () => {
    // The probe must be able to fail. A layout with two elements on one spot
    // is the case every clean result above is measured against.
    const { draw } = drawn[0]
    const first = draw.layout.items.find((i) => i.el)
    const doubled = {
      ...draw.layout,
      items: [...draw.layout.items, { ...first, el: draw.layout.items.filter((i) => i.el)[1].el }],
    }
    expect(layoutProblems(doubled, draw.elements, null, 'none').length).toBeGreaterThan(0)
  })
})
