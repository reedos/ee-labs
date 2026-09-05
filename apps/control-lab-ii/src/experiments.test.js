import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS, applyExperiment, applyStep, byId, isDirty } from './experiments.js'
import { analyse, readPath } from './analysis.js'

// Every number an experiment claims, measured.
//
// The rule this file exists to keep: a claim is a row, and a row's `value`
// comes out of `analyse` while its `want` is computed from the knobs in the
// same state. Neither side is a constant typed in. Change a knob and both sides
// move, which is the only way a pinned number can stay true when the physics
// underneath it is edited.
//
// A `sweep` runs the same claim at several settings of one knob, so a law
// ("the gain is 1/√R") is pinned as a law rather than at one point.

/** One row, compared the way the row asked to be compared. */
function check(row, label) {
  expect(Number.isFinite(row.value) || typeof row.value === 'boolean', `${label}: ${row.name} produced ${row.value}`).toBe(true)
  if (row.wantBelow !== undefined) {
    expect(row.value, `${label}: ${row.name}`).toBeLessThan(row.wantBelow)
  } else if (row.wantAbove !== undefined) {
    expect(row.value, `${label}: ${row.name}`).toBeGreaterThan(row.wantAbove)
  } else if (row.tol === 0) {
    expect(row.value, `${label}: ${row.name}`).toBe(row.want)
  } else {
    const scale = Math.max(Math.abs(row.want), 1e-12)
    expect(Math.abs(row.value - row.want), `${label}: ${row.name} wanted ${row.want}, got ${row.value}`).toBeLessThanOrEqual(
      row.tol * (row.relative === false ? 1 : Math.max(1, scale)),
    )
  }
}

describe('the course', () => {
  it('runs A to F in the plan\'s order', () => {
    const order = EXPERIMENTS.map((e) => e.group)
    const firstOf = (g) => order.indexOf(g)
    for (let i = 1; i < GROUPS.length; i++) {
      expect(firstOf(GROUPS[i]), `${GROUPS[i]} starts before ${GROUPS[i - 1]}`).toBeGreaterThan(
        firstOf(GROUPS[i - 1]),
      )
    }
  })

  it('every experiment loads a state its own mode can analyse', () => {
    for (const e of EXPERIMENTS) {
      const a = analyse(applyExperiment(e))
      expect(a.open, `${e.id} has no open loop`).toBeTruthy()
      const branch = { state: 'state_', sampled: 'sampled', phase: 'nonlinear', describing: 'nonlinear', fit: 'fit', filter: 'filter' }[e.patch.mode]
      expect(a[branch], `${e.id} mode "${e.patch.mode}" produced no analysis`).toBeTruthy()
    }
  })

  it('no experiment references one that does not exist', () => {
    // The progression rule of PROGRAM.md section 3, applied inside the lab.
    // A note that sends a reader to B4 when B4 is not built is a broken
    // promise, and it fails here by design.
    // A reference to another LAB's experiment is a different thing and is
    // checked by that lab's own progression test, so "Elements F4" and
    // "Signal Lab B2" are read as the cross-lab pointers they are.
    const ids = new Set(EXPERIMENTS.map((e) => e.id))
    const ref = /(?<!(?:Elements|Lab|Group|Decision)\s)\b([A-F])(\d{1,2})\b/g
    for (const e of EXPERIMENTS) {
      const text = `${e.see} ${e.why} ${e.try.map((s) => s.say).join(' ')}`
      for (const [, letter, n] of text.matchAll(ref)) {
        const id = `${letter}${n}`
        if (id === e.id) continue
        expect(ids.has(id), `${e.id} names ${id}, which is not built`).toBe(true)
      }
    }
  })
})

describe('every claim, against the analysis that drew the picture', () => {
  for (const e of EXPERIMENTS) {
    it(`${e.id} ${e.name}`, () => {
      const state = applyExperiment(e)
      const rows = e.claim(analyse(state))
      expect(rows.length, `${e.id} claims nothing`).toBeGreaterThan(0)
      for (const row of rows) check(row, e.id)
    })
  }
})

describe('every sweep, so a law is pinned as a law', () => {
  for (const e of EXPERIMENTS.filter((x) => x.sweep)) {
    it(`${e.id} across ${e.sweep.knob}`, () => {
      // A row may name a `want` at each setting, or it may name `monotone`,
      // which is a claim about the SEQUENCE rather than about any one point.
      // "The wind rises as the limit tightens" is the second kind, and pinning
      // it at four separate values would not say it.
      const series = new Map()
      for (const at of e.sweep.at) {
        const state = applyStep(e, { set: { [e.sweep.knob]: at } })
        const rows = e.sweep.claim(analyse(state))
        for (const row of rows) {
          if (row.monotone) {
            if (!series.has(row.name)) series.set(row.name, { dir: row.monotone, values: [] })
            series.get(row.name).values.push({ at, value: row.value })
          } else {
            check(row, `${e.id} at ${e.sweep.knob} = ${at}`)
          }
        }
      }
      for (const [name, { dir, values }] of series) {
        expect(values.length, `${e.id}: ${name} needs at least two settings`).toBeGreaterThan(1)
        for (let i = 1; i < values.length; i++) {
          const label = `${e.id}: ${name}, ${e.sweep.knob} ${values[i - 1].at} then ${values[i].at}`
          if (dir === 'up') expect(values[i].value, label).toBeGreaterThan(values[i - 1].value)
          else expect(values[i].value, label).toBeLessThan(values[i - 1].value)
        }
      }
    })
  }
})

describe('every try step leads somewhere', () => {
  // The knobs a step may name that are not plant or controller parameters and
  // are not part of the experiment's own design block.
  const TOP_KNOBS = new Set([
    'mode', 'view', 'plantId', 'ctrlId', 'nlId', 'Ts', 'emulation', 'delta',
    'reference', 'duration', 'points', 'perCycle', 'noise', 'seed', 'x0', 'span',
  ])

  it('every step names a knob the state actually has', () => {
    // A1 originally asked the reader to "set the starting speed" through a key
    // called `compare`, which nothing read. The instruction was on screen, the
    // chip was clickable, and the picture did not move. This is that defect,
    // caught rather than shipped.
    for (const e of EXPERIMENTS) {
      const base = applyExperiment(e)
      for (const [i, step] of e.try.entries()) {
        for (const key of Object.keys(step.set)) {
          const known =
            key in base.plantP ||
            key in base.ctrlP ||
            (base.design && key in base.design) ||
            TOP_KNOBS.has(key)
          expect(known, `${e.id} try[${i}] sets "${key}", which no part of the state reads`).toBe(true)
        }
      }
    }
  })

  it('the state a step asks for still analyses, and at least one step moves the picture', () => {
    for (const e of EXPERIMENTS) {
      const base = applyExperiment(e)
      let moved = 0
      for (const [i, step] of e.try.entries()) {
        const next = applyStep(e, step)
        const a = analyse(next)
        expect(a.open, `${e.id} try[${i}] produced no loop`).toBeTruthy()
        if (isDirty(next, e) || next.duration !== base.duration || next.points !== base.points) moved++
      }
      // A closing "set it back" step is allowed and is often the kindest way
      // to end a list. A list where NO step changes anything is an experiment
      // with nothing to try.
      expect(moved, `${e.id}: no try step changes anything`).toBeGreaterThan(0)
    }
  })

  it('a step that quotes a quantity path resolves it', () => {
    // `reads` is the optional half of a try step. Where a step names the
    // number it expects to move, the path has to resolve against that step's
    // own analysis, not against the experiment's.
    for (const e of EXPERIMENTS) {
      for (const [i, step] of e.try.entries()) {
        if (!step.reads) continue
        const a = analyse(applyStep(e, step))
        for (const [path, want] of Object.entries(step.reads)) {
          const got = readPath(a, path)
          expect(got, `${e.id} try[${i}] reads ${path}`).not.toBe(undefined)
          if (Number.isFinite(want)) {
            expect(Math.abs(got - want), `${e.id} try[${i}] ${path}`).toBeLessThanOrEqual(
              Math.abs(want) * 0.01 + 1e-9,
            )
          }
        }
      }
    }
  })
})

describe('the quantity paths of the brief', () => {
  // Section 4 of AGENT_BRIEF.md lists what a `reads` pair may name. Each is
  // checked against an experiment whose mode produces it, so the list in the
  // brief and the resolver in analysis.js cannot drift apart.
  const CASES = [
    ['A5', ['ss.rank', 'ss.condition', 'ss.controllable', 'ss.observable']],
    ['A5', ['place.k1', 'place.k2', 'place.pole.0.re', 'place.pole.0.im', 'place.overshoot', 'place.dcgain']],
    ['A7', ['lqr.k1', 'lqr.k2', 'lqr.cost', 'lqr.residual', 'lqr.pole.0.re']],
    ['A6', ['obs.l1', 'obs.l2', 'obs.pole.0.re', 'obs.settling']],
    ['B3', ['z.alpha', 'z.b1', 'z.pole.0.mag', 'z.pole.0.arg', 'z.stable']],
    ['B2', ['hold.delay', 'hold.lagdeg', 'hold.gain']],
    ['B6', ['guard.perCycle', 'guard.threshold', 'guard.holds']],
    ['C3', ['phase.wind', 'phase.peak', 'phase.events', 'phase.equilibria']],
  ]

  for (const [id, paths] of CASES) {
    const e = byId(id)
    if (!e) continue
    it(`${id} resolves ${paths[0].split('.')[0]}.*`, () => {
      const a = analyse(applyExperiment(e))
      for (const path of paths) {
        const got = readPath(a, path)
        expect(got, `${id}: ${path} resolved to nothing`).not.toBe(undefined)
      }
    })
  }

  it('a path nobody defined is refused rather than read as nothing', () => {
    const a = analyse(applyExperiment(EXPERIMENTS[0]))
    expect(() => readPath(a, 'nonsense.value')).toThrow(/unknown quantity path/)
  })
})

describe('loading an experiment', () => {
  it('a patch is a whole state, so nothing leaks in from the experiment before', () => {
    // Control Lab paid for this one. A lesson that inherits half the previous
    // setup draws a picture its own note does not describe.
    for (const e of EXPERIMENTS) {
      const s = applyExperiment(e)
      expect(s.plantId, e.id).toBeTruthy()
      expect(s.ctrlId, e.id).toBeTruthy()
      expect(s.mode, e.id).toBeTruthy()
      expect(isDirty(s, e), `${e.id} loads dirty`).toBe(false)
    }
  })

  it('a loaded experiment cannot be written back into by moving a knob', () => {
    const e = EXPERIMENTS[0]
    const s = applyExperiment(e)
    const before = e.patch.plantP.tau
    s.plantP.tau = 99
    expect(e.patch.plantP.tau).toBe(before)
    expect(applyExperiment(e).plantP.tau).toBe(before)
  })
})
