import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, byId, defaultsOf } from './experiments.js'
import { analyse } from './math.js'
import { predictFor } from './predict.js'
import {
  STORE_KEY,
  activeStep,
  advance,
  complete,
  groupArc,
  knobsOf,
  load,
  measurable,
  meterOf,
  readsOf,
  save,
  stepMet,
  tick,
  withPredicted,
  withSteps,
} from './progress.js'

// Where the student is (student review, Phase 8). The Try list is a path; the
// app marks a step done when the screen shows what it asked for. These tests
// pin what "shows" means, then walk every lesson to check that each step's own
// setting meets its step and that no step is done before the student moves.

const base = { params: { R: 1000, E: 12, open: false }, cursor: 0, tEnd: 0, show: 'i' }

describe('what a step asks for', () => {
  it('reads the meter mode from the sentence, in either phrasing', () => {
    expect(meterOf({ say: 'Switch the meters to voltages: the top wire reads 12 V.' })).toBe('v')
    expect(meterOf({ say: 'Switch to powers: P_R1 reads 144 mW.' })).toBe('p')
    expect(meterOf({ say: 'Switch the meters to currents.' })).toBe('i')
    expect(meterOf({ say: 'Set R to 100 Ω: the current climbs.' })).toBeNull()
    expect(meterOf({})).toBeNull()
  })
  it('names the knobs a step turns and whether it can be measured at all', () => {
    expect(knobsOf({ set: { R: 100, E: 5 } })).toEqual(['R', 'E'])
    expect(knobsOf({})).toEqual([])
    expect(measurable({ set: { R: 100 } })).toBe(true)
    expect(measurable({ at: 0.005 })).toBe(true)
    expect(measurable({ say: 'Switch to voltages.' })).toBe(true)
    expect(measurable({ say: 'Drag the cursor and watch the current fall.' })).toBe(false)
  })
})

describe('stepMet', () => {
  it('is null for a watch step — nothing to measure', () => {
    expect(stepMet({ say: 'Watch.' }, base)).toBeNull()
  })
  it('accepts a number within 0.5 % and refuses one outside it', () => {
    const step = { set: { R: 100 } }
    expect(stepMet(step, { ...base, params: { ...base.params, R: 100 } })).toBe(true)
    expect(stepMet(step, { ...base, params: { ...base.params, R: 100.4 } })).toBe(true)
    expect(stepMet(step, { ...base, params: { ...base.params, R: 99.6 } })).toBe(true)
    expect(stepMet(step, { ...base, params: { ...base.params, R: 101 } })).toBe(false)
    expect(stepMet(step, { ...base, params: { ...base.params, R: 1000 } })).toBe(false)
    // C4 opens 1 % off balance; balancing it is the first step, so 1 % cannot be "close enough".
    expect(stepMet({ set: { R4: 1000 } }, { ...base, params: { R4: 1010 } })).toBe(false)
  })
  it('takes a zero setting exactly', () => {
    const step = { set: { E: 0 } }
    expect(stepMet(step, { ...base, params: { ...base.params, E: 0 } })).toBe(true)
    expect(stepMet(step, { ...base, params: { ...base.params, E: 0.01 } })).toBe(false)
  })
  it('takes a toggle exactly', () => {
    const step = { set: { open: true } }
    expect(stepMet(step, { ...base, params: { ...base.params, open: true } })).toBe(true)
    expect(stepMet(step, base)).toBe(false)
  })
  it('wants every knob the step names', () => {
    const step = { set: { R: 100, E: 5 } }
    expect(stepMet(step, { ...base, params: { R: 100, E: 12 } })).toBe(false)
    expect(stepMet(step, { ...base, params: { R: 100, E: 5 } })).toBe(true)
  })
  it('puts the cursor within 2 % of the window of the instant named', () => {
    const step = { at: 0.005 }
    expect(stepMet(step, { ...base, cursor: 0.005, tEnd: 0.005 })).toBe(true)
    expect(stepMet(step, { ...base, cursor: 0.00491, tEnd: 0.005 })).toBe(true)
    expect(stepMet(step, { ...base, cursor: 0.0048, tEnd: 0.005 })).toBe(false)
    expect(stepMet(step, { ...base, cursor: 0.005, tEnd: 0 })).toBe(false)
    expect(stepMet(step, { ...base, cursor: NaN, tEnd: 0.005 })).toBe(false)
  })
  it('wants the meters in the mode the sentence names', () => {
    const step = { say: 'Switch the meters to voltages.' }
    expect(stepMet(step, { ...base, show: 'v' })).toBe(true)
    expect(stepMet(step, { ...base, show: 'i' })).toBe(false)
  })
})

describe('the path', () => {
  const steps = [{ set: { R: 100 } }, { say: 'Watch the current.' }, { set: { E: 5 } }, { say: 'Switch to voltages.' }]
  it('finds the first step not done', () => {
    expect(activeStep(steps, new Set())).toBe(0)
    expect(activeStep(steps, new Set([0, 1]))).toBe(2)
    expect(activeStep(steps, new Set([0, 1, 2, 3]))).toBe(-1)
  })
  it('advance adds the steps the screen meets and keeps the same Set when nothing changed', () => {
    const none = new Set()
    expect(advance(none, steps, base)).toBe(none)
    const one = advance(none, steps, { ...base, params: { R: 100, E: 12 } })
    expect([...one]).toEqual([0])
    expect(advance(one, steps, { ...base, params: { R: 100, E: 12 } })).toBe(one)
  })
  it('done is sticky: a knob turned past the setting does not undo the step', () => {
    const one = new Set([0])
    expect(advance(one, steps, { ...base, params: { R: 5000, E: 12 } })).toBe(one)
  })
  it('a watch step is done once any later step is', () => {
    const got = advance(new Set([0]), steps, { ...base, params: { R: 5000, E: 5 } })
    expect([...got].sort()).toEqual([0, 1, 2])
  })
  it('tick marks a watch step by hand, with the watch steps before it', () => {
    const two = [{ say: 'Watch.' }, { say: 'Watch more.' }, { set: { R: 1 } }]
    expect([...tick(new Set(), two, 1)].sort()).toEqual([0, 1])
    expect([...tick(new Set(), two, 0)]).toEqual([0])
  })
})

describe('readsOf', () => {
  it('maps node and element paths to places on the schematic and ignores the rest', () => {
    const r = readsOf({
      reads: [
        ['v.in', 12],
        ['vd.A.ref', 8],
        ['volt.R1', 4],
        ['i.R2', 0.004],
        ['p.V1', -0.048],
        ['thevenin.rth', 500],
        ['state.tau', 0.001],
      ],
    })
    expect([...r.nodes].sort()).toEqual(['A', 'in', 'ref'])
    expect([...r.elements].sort()).toEqual(['R1', 'R2', 'V1'])
  })
  it('is empty for a step that reads nothing', () => {
    const r = readsOf({})
    expect(r.nodes.size + r.elements.size).toBe(0)
  })
})

describe('complete and the arcs', () => {
  it('needs every step done and the prediction made where one is posed', () => {
    const a1 = byId.a1
    const n = a1.try.length
    const all = [...Array(n).keys()]
    expect(predictFor(a1), 'A1 poses a prediction').toBeTruthy()
    expect(complete(a1, undefined)).toBe(false)
    expect(complete(a1, { steps: all })).toBe(false)
    expect(complete(a1, { steps: all, predicted: true })).toBe(true)
    expect(complete(a1, { steps: all.slice(1), predicted: true })).toBe(false)
  })
  it('counts a group', () => {
    const groupA = EXPERIMENTS.filter((e) => e.group === byId.a1.group)
    const progress = { a1: { steps: [...Array(byId.a1.try.length).keys()], predicted: true } }
    expect(groupArc(groupA, progress)).toEqual({ done: 1, total: groupA.length })
    expect(groupArc(groupA, {})).toEqual({ done: 0, total: groupA.length })
  })
})

describe('the store', () => {
  const fake = () => {
    const m = new Map()
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), map: m }
  }
  it('round-trips under its key', () => {
    const s = fake()
    expect(load(s)).toEqual({})
    expect(save(s, { a1: { steps: [0, 1], predicted: true } })).toBe(true)
    expect(s.map.has(STORE_KEY)).toBe(true)
    expect(load(s)).toEqual({ a1: { steps: [0, 1], predicted: true } })
  })
  it('shrugs at a store that throws, or is missing, or holds junk', () => {
    const angry = {
      getItem: () => {
        throw new Error('private mode')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(load(angry)).toEqual({})
    expect(save(angry, {})).toBe(false)
    expect(load(null)).toEqual({})
    const junk = fake()
    junk.setItem(STORE_KEY, '[1,2]')
    expect(load(junk)).toEqual({})
    junk.setItem(STORE_KEY, 'not json')
    expect(load(junk)).toEqual({})
  })
  it('withSteps returns the same record when nothing changed, and withPredicted marks once', () => {
    const p = { a1: { steps: [0, 2] } }
    expect(withSteps(p, 'a1', new Set([2, 0]))).toBe(p)
    expect(withSteps(p, 'a1', new Set([0, 1, 2])).a1.steps).toEqual([0, 1, 2])
    expect(withSteps(p, 'a2', new Set([0])).a2).toEqual({ steps: [0] })
    const q = withPredicted(p, 'a1')
    expect(q.a1).toEqual({ steps: [0, 2], predicted: true })
    expect(withPredicted(q, 'a1')).toBe(q)
    expect(withPredicted({}, 'b1').b1).toEqual({ steps: [], predicted: true })
  })
})

describe('every lesson walks', () => {
  for (const e of EXPERIMENTS) {
    const steps = e.try || []
    if (!steps.length) continue
    it(`${e.id}: each step is met by its own setting, and not before`, () => {
      const defaults = defaultsOf(e.id)
      const x0 = analyse(e, defaults)
      const rest = { cursor: x0.cursor ?? 0, tEnd: x0.tEnd ?? 0, show: e.show }
      // What the screen shows just before a step, with every earlier step's own
      // setting already applied in order and nothing reset — the same
      // accumulation App.jsx's `pick` does. A step whose own setting happens to
      // match the experiment's global defaults (putting a knob an earlier step
      // moved back where it started) must still wait for that undo to happen,
      // not be met from a blank slate.
      let priorParams = defaults
      let priorCursor
      steps.forEach((t, i) => {
        const xPrior = analyse(e, priorParams, priorCursor)
        const priorState = { params: priorParams, cursor: priorCursor != null ? xPrior.cursor : rest.cursor, tEnd: xPrior.tEnd ?? 0, show: e.show }
        if (measurable(t)) {
          // Applying the step's own setting over the defaults meets it.
          const params = { ...defaults, ...(t.set || {}) }
          const x = analyse(e, params, t.at)
          const state = { params, cursor: t.at != null ? x.cursor : rest.cursor, tEnd: x.tEnd ?? 0, show: meterOf(t) ?? e.show }
          expect(stepMet(t, state), `${e.id} step ${i + 1} met by its own setting`).toBe(true)
          // A step that names a knob purely to stay self-contained, at the exact
          // value an earlier step already left it (F6's τ reading, still R_off =
          // 1 MΩ from the step before), asks nothing new of the reader and may
          // already be met. One that actually moves something must still wait.
          const alreadyThere = knobsOf(t).every((k) => priorParams[k] === t.set[k]) && (t.at == null || t.at === priorCursor)
          if (!alreadyThere) expect(stepMet(t, priorState), `${e.id} step ${i + 1} not already done before its own setting`).toBe(false)
        }
        priorParams = { ...priorParams, ...(t.set || {}) }
        if (t.at != null) priorCursor = t.at
      })
      // The first step is the active one on arrival.
      expect(activeStep(steps, advance(new Set(), steps, { params: defaults, ...rest }))).toBe(0)
    })
  }
})
