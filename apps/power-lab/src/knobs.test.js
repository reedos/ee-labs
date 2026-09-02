import { describe, it, expect } from 'vitest'
import { toPos, fromPos, snap, POS_MAX } from '@ee-labs/ui'
import { EXPERIMENTS } from './experiments.js'

// What a knob has to do: move.
//
// NumField's slider hands its position to fromPos, which snaps the result to a
// multiple of `step` — and `step` defaults to 1. A knob that runs 0 to 0.5, or
// a duty that runs 0.02 to 0.98, then has exactly two reachable values, and the
// slider is a switch. It looks fine in a screenshot and every test that sets
// values directly still passes, so it needs its own check.

const knobs = () => {
  const seen = new Map()
  for (const e of EXPERIMENTS) for (const k of e.params) if (k.kind !== 'toggle') seen.set(`${e.id}.${k.key}`, k)
  return [...seen.entries()]
}

/** Every value the slider can actually produce for this knob. */
const reachable = (k) => {
  const out = new Set()
  for (let pos = 0; pos <= POS_MAX; pos++) out.add(fromPos(pos, k))
  return out
}

describe('every knob', () => {
  it('reaches most of its slider positions rather than snapping to a handful', () => {
    for (const [name, k] of knobs()) {
      const n = reachable(k).size
      expect(n, `${name} (${k.min}…${k.max}, step ${k.step ?? 'unset'}) reaches ${n} values`).toBeGreaterThan(200)
    }
  })

  it('reaches its own ends, and its default survives a round trip', () => {
    for (const [name, k] of knobs()) {
      const values = reachable(k)
      expect(Math.min(...values), `${name} low end`).toBeCloseTo(k.min, 9)
      expect(Math.max(...values), `${name} high end`).toBeCloseTo(k.max, 9)
      // A default the slider cannot represent puts the handle somewhere the
      // number is not. A log knob snaps to three significant figures, so its
      // grid is a few parts in a thousand wide; a linear one is its step.
      const back = fromPos(toPos(k.default, k), k)
      const slack = k.scale === 'linear' ? k.step * 1.01 + 1e-12 : Math.abs(k.default) * 0.01
      expect(Math.abs(back - k.default), `${name} default ${k.default} → ${back}`).toBeLessThanOrEqual(slack)
    }
  })

  it('gives every linear knob a step, since snap() otherwise rounds it to whole units', () => {
    for (const [name, k] of knobs()) {
      if (k.scale !== 'linear') continue
      expect(k.step, `${name} step`).toBeGreaterThan(0)
      // Fine enough to be a slider, coarse enough not to be noise.
      expect(k.step, `${name} step vs range`).toBeLessThanOrEqual((k.max - k.min) / 100)
      expect(snap(k.min + (k.max - k.min) / 2, k), `${name} mid-range`).toBeGreaterThan(k.min)
    }
  })

  it('shows the duty as a percentage while storing it as a fraction', () => {
    const d = EXPERIMENTS.find((e) => e.id === 'b2').params.find((k) => k.key === 'D')
    expect(d.percent).toBe(true)
    expect(d.unit).toBe('%')
    expect(d.min).toBeLessThan(0.05)
    expect(d.max).toBeGreaterThan(0.95)
    // What the field shows and what the state holds, at the two ends.
    expect(d.min * 100).toBeCloseTo(2, 9)
    expect(d.max * 100).toBeCloseTo(98, 9)
  })
})
