import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, VIEWS, GROUPS } from './experiments.js'
import { LESSONS } from './lessons.js'
import { TERMS } from './terms.js'
import { expectPlain, expectAllPlain } from '@ee-labs/prose/testing'

// The house style, measured (STYLE.md).
//
// Every word a reader can see on this lab's screens goes through a budget: the
// three lesson registers, the experiment names, the group headers, the view
// labels and every term definition. The register cannot drift back one
// experiment at a time when each string is measured.

describe('every lesson reads plainly', () => {
  for (const e of EXPERIMENTS) {
    const lesson = LESSONS[e.id]
    it(`${e.id} ${e.name}`, () => {
      expectPlain(e.name, 'title', `${e.id} name`)
      expectPlain(lesson.see, 'see', `${e.id} see`)
      expectPlain(lesson.why, 'why', `${e.id} why`)
      expectAllPlain(
        lesson.try.map((t) => t.say),
        'try',
        (_, i) => `${e.id} try[${i}]`,
      )
    })
  }
})

describe('every term reads plainly', () => {
  for (const [id, t] of Object.entries(TERMS)) {
    it(id, () => {
      expectPlain(t.def, 'term', `${id} def`)
      expectPlain(t.name, 'label', `${id} name`)
    })
  }
})

describe('the chrome reads plainly', () => {
  it('the view labels are short noun phrases', () => {
    for (const [id, label] of Object.entries(VIEWS)) expectPlain(label, 'label', `view ${id}`)
  })

  it('the group headers name what is under them', () => {
    for (const g of GROUPS) {
      // A group header is a title rather than a control label, so it takes the
      // sidebar-row budget. S9 still applies through `violations`.
      expectPlain(g, 'title', `group "${g}"`)
    }
  })
})

describe('the lesson structure', () => {
  it('gives every experiment a see, a try and a why', () => {
    for (const e of EXPERIMENTS) {
      const l = LESSONS[e.id]
      expect(l.see, `${e.id} see`).toBeTruthy()
      expect(l.why, `${e.id} why`).toBeTruthy()
      expect(l.try.length, `${e.id} try`).toBeGreaterThanOrEqual(1)
    }
  })

  it('gives every try step a setting to apply, or none at all', () => {
    for (const e of EXPERIMENTS) {
      for (const step of LESSONS[e.id].try) {
        expect(typeof step.set, `${e.id}`).toBe('object')
      }
    }
  })

  it('sets only parameters the experiment or the defaults name', () => {
    // A try step that sets a knob the analysis does not read would move nothing,
    // and the reader would follow an instruction with no effect.
    for (const e of EXPERIMENTS) {
      for (const step of LESSONS[e.id].try) {
        for (const k of Object.keys(step.set)) {
          expect(Object.keys({ ...e.params }).concat(KNOWN), `${e.id} sets ${k}`).toContain(k)
        }
      }
    }
  })
})

// Knobs any experiment may set from a try step even when its own params do not
// list them, because the analysis reads them from DEFAULTS.
const KNOWN = [
  'seed', 'n', 'bins', 'lo', 'hi', 'level', 'dist', 'mu', 'sigma', 'lambda',
  'cltTerms', 'runs', 'length', 'ensembleKind', 'averages', 'segment', 'window',
  'fc', 'filtered', 'noiseRms', 'R', 'C', 'T', 'pulse', 'pulseLength',
  'noiseVariance', 'ebN0Db', 'symbols', 'taps', 'wienerNoiseVariance',
  'signalVariance', 'q', 'r', 'kalmanA', 'x0', 'p0', 'maxLag', 'wkN', 'spec',
]
