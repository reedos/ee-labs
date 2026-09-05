import { describe, it, expect } from 'vitest'
import { bounceDiagram, loadTrace, requireLossless, resistiveGamma, snapshot } from './bounce.js'
import { FieldsError } from './const.js'
import { logUniform, relative, rng } from './fuzz.js'

// Invariant 7: the bounce diagram's steady state equals the direct-current
// divider, for every resistive pair that has one.
//
// That identity is the whole warrant for the event loop. The loop knows nothing
// about dividers. It launches a wave, reflects it at each end, and sums the
// arrivals. The sum of that geometric series is Vs RL / (Rs + RL), and if the
// loop is right it comes out to floating point at fifty random pairs.
//
// The second warrant is that the loop's answer is a step function, not a ramp.
// A step has no rise time, so the value at a point either includes a wave or
// does not, and a trace sampled either side of an arrival shows two levels and
// nothing between them.

const base = { Vs: 5, Rs: 25, Z0: 50, RL: 150, len: 2, vp: 2e8 }

describe('the two reflection coefficients', () => {
  it('an open is exactly plus one and a short exactly minus one', () => {
    expect(resistiveGamma(Infinity, 50)).toBe(1)
    expect(resistiveGamma(0, 50)).toBe(-1)
    expect(resistiveGamma(50, 50)).toBe(0)
  })

  it('a resistance above Z0 reflects positively and below it negatively', () => {
    expect(resistiveGamma(150, 50)).toBeCloseTo(0.5, 12)
    expect(resistiveGamma(25, 50)).toBeCloseTo(-1 / 3, 12)
  })

  it('a negative resistance is declined', () => {
    expect(() => resistiveGamma(-10, 50)).toThrow(/R must be zero or a positive number/)
  })
})

describe('invariant 7: the arrivals settle to the divider', () => {
  it('holds at fifty random resistive pairs', () => {
    const r = rng(0xb0)
    let worst = 0
    for (let k = 0; k < 50; k++) {
      const Z0 = logUniform(r, 10, 300)
      const Rs = logUniform(r, 0.1, 5000)
      const RL = logUniform(r, 0.1, 5000)
      const Vs = logUniform(r, 0.1, 100)
      const d = bounceDiagram({ Vs, Rs, RL, Z0, len: 1, vp: 2e8 })
      expect(d.rings).toBe(false)
      worst = Math.max(worst, relative(d.steady.v, d.steady.divider))
    }
    expect(worst).toBeLessThan(1e-12)
  })

  it('holds with a short at the source, and with an open at the load', () => {
    const shorted = bounceDiagram({ ...base, Rs: 0 })
    expect(relative(shorted.steady.v, shorted.steady.divider)).toBeLessThan(1e-13)
    const open = bounceDiagram({ ...base, RL: Infinity })
    expect(relative(open.steady.v, open.steady.divider)).toBeLessThan(1e-13)
    expect(open.steady.v).toBeCloseTo(5, 12)
    expect(open.steady.i).toBe(0)
  })

  it('the sum of the arrivals really does reach that value', () => {
    const d = bounceDiagram(base)
    const late = d.atEnd(400 * d.T).v
    expect(relative(late, d.steady.v)).toBeLessThan(1e-11)
  })

  it('the line disappears at direct current, whatever its impedance', () => {
    const r = rng(0xb1)
    for (let k = 0; k < 20; k++) {
      const Z0 = logUniform(r, 5, 500)
      const d = bounceDiagram({ Vs: 5, Rs: 25, RL: 150, Z0, len: 1, vp: 2e8 })
      expect(relative(d.steady.v, (5 * 150) / 175)).toBeLessThan(1e-12)
    }
  })
})

describe('the arrivals themselves', () => {
  it('the first wave is the source divided against Z0', () => {
    const d = bounceDiagram(base)
    expect(d.first).toBeCloseTo((5 * 50) / 75, 12)
    expect(d.first).toBeCloseTo(3.3333, 4)
    expect(d.gammaS).toBeCloseTo(-1 / 3, 12)
    expect(d.gammaL).toBeCloseTo(0.5, 12)
    expect(d.T * 1e9).toBeCloseTo(10, 9)
  })

  it('the load sees nothing before the first arrival, and the full step after it', () => {
    const d = bounceDiagram(base)
    expect(d.atEnd(0.99 * d.T).v).toBe(0)
    expect(d.atEnd(1.5 * d.T).v).toBeCloseTo(d.first * (1 + d.gammaL), 12)
    expect(d.atEnd(1.5 * d.T).v).toBeCloseTo(5, 12)
  })

  it('the second arrival lands where the plan says', () => {
    const d = bounceDiagram(base)
    expect(d.atEnd(3.5 * d.T).v).toBeCloseTo(4.1667, 4)
  })

  it('the source end sees the launch at once and the echo after two delays', () => {
    const d = bounceDiagram(base)
    expect(d.atSource(0).v).toBeCloseTo(d.first, 12)
    expect(d.atSource(1.99 * d.T).v).toBeCloseTo(d.first, 12)
    expect(d.atSource(2.01 * d.T).v).toBeGreaterThan(d.first)
  })

  it('a matched source launches once and the line is done', () => {
    const d = bounceDiagram({ ...base, Rs: 50, RL: 50 })
    expect(d.waves.length).toBe(1)
    expect(d.gammaS).toBe(0)
    expect(d.gammaL).toBe(0)
    expect(d.atEnd(1.5 * d.T).v).toBeCloseTo(2.5, 12)
    expect(d.complete).toBe(true)
  })

  it('a matched load alone still ends the reflections', () => {
    const d = bounceDiagram({ ...base, RL: 50 })
    expect(d.waves.length).toBe(1)
    expect(d.atEnd(1.5 * d.T).v).toBeCloseTo(d.first, 12)
  })

  it('every wave is the last one times a reflection coefficient', () => {
    const d = bounceDiagram(base)
    for (let k = 1; k < d.waves.length; k++) {
      const g = d.waves[k - 1].dir > 0 ? d.gammaL : d.gammaS
      expect(relative(d.waves[k].amp, d.waves[k - 1].amp * g)).toBeLessThan(1e-12)
      expect(d.waves[k].dir).toBe(-d.waves[k - 1].dir)
      expect(d.waves[k].launchedAt).toBeCloseTo(d.waves[k - 1].launchedAt + d.T, 15)
    }
  })

  it('the sum stops when the tail falls below its tolerance, and says it did', () => {
    const d = bounceDiagram(base)
    expect(d.complete).toBe(true)
    expect(d.truncatedAt).toBeLessThan(1e-12 * Math.abs(d.first))
    expect(d.waves.length).toBeLessThan(400)
  })
})

describe('a line neither end can absorb', () => {
  it('rings for ever, and no steady value is quoted', () => {
    const d = bounceDiagram({ ...base, Rs: 0, RL: Infinity })
    expect(d.rings).toBe(true)
    expect(d.steady).toBe(null)
    expect(d.says).toMatch(/rings for ever/)
    expect(d.says).toMatch(/no steady state to quote/)
    expect(Math.abs(d.product)).toBeCloseTo(1, 12)
  })

  it('a short at both ends rings too', () => {
    const d = bounceDiagram({ ...base, Rs: 0, RL: 0 })
    expect(d.rings).toBe(true)
  })

  it('and its trace really does keep moving', () => {
    const d = bounceDiagram({ ...base, Rs: 0, RL: Infinity })
    expect(d.waves.length).toBe(400)
    // An ideal source and an open end put the load at twice the source voltage,
    // then at nothing, on a cycle four delays long. Nothing settles, and the
    // cycle is still running a hundred delays later.
    expect(d.atEnd(1.5 * d.T).v).toBeCloseTo(10, 10)
    expect(d.atEnd(3.5 * d.T).v).toBeCloseTo(0, 10)
    expect(d.atEnd(101.5 * d.T).v).toBeCloseTo(10, 10)
    expect(d.atEnd(103.5 * d.T).v).toBeCloseTo(0, 10)
  })

  it('a settling line reports a steady value and says what it equals', () => {
    const d = bounceDiagram(base)
    expect(d.rings).toBe(false)
    expect(d.says).toMatch(/settle to 4\.286 V/)
    expect(d.says).toMatch(/with the line taken away/)
  })
})

describe('the trace and the snapshot', () => {
  it('the trace steps rather than ramping across an arrival', () => {
    const d = bounceDiagram(base)
    const tr = loadTrace(d, { until: 6 * d.T, points: 400 })
    // Find the two samples that straddle the first arrival.
    let jump = 0
    for (let k = 1; k < tr.t.length; k++) {
      if (tr.t[k - 1] < d.T && tr.t[k] >= d.T) jump = Math.abs(tr.v[k] - tr.v[k - 1])
    }
    expect(jump).toBeCloseTo(5, 6)
    // And the samples either side are a sliver apart, so nothing is drawn as a
    // ramp between two levels.
    for (let k = 1; k < tr.t.length; k++) {
      if (tr.t[k - 1] < d.T && tr.t[k] >= d.T) expect(tr.t[k] - tr.t[k - 1]).toBeLessThan(d.T / 100)
    }
  })

  it('the trace and the sampler agree at every sample', () => {
    const d = bounceDiagram(base)
    const tr = loadTrace(d, { until: 8 * d.T, points: 200 })
    for (let k = 0; k < tr.t.length; k += 7) {
      expect(tr.v[k]).toBeCloseTo(d.atEnd(tr.t[k]).v, 12)
    }
  })

  it('a snapshot shows the wavefront partway down the line', () => {
    const d = bounceDiagram(base)
    const s = snapshot(d, 0.5 * d.T)
    // Behind the front the line carries the first wave, ahead of it nothing.
    const behind = s.v[Math.floor(s.x.length * 0.1)]
    const ahead = s.v[Math.floor(s.x.length * 0.9)]
    expect(behind).toBeCloseTo(d.first, 12)
    expect(ahead).toBe(0)
  })

  it('the snapshot uses the line length the diagram was given', () => {
    const d = bounceDiagram({ ...base, len: 7 })
    const s = snapshot(d, 0.5 * d.T)
    expect(Math.max(...s.x)).toBeCloseTo(7, 12)
  })

  it('the current on the line is the voltage over Z0, with a sign for the direction', () => {
    const d = bounceDiagram(base)
    const s = snapshot(d, 0.5 * d.T)
    const behind = Math.floor(s.x.length * 0.1)
    expect(s.i[behind]).toBeCloseTo(d.first / d.Z0, 12)
    // After the reflection the backward wave carries current the other way.
    const later = snapshot(d, 1.5 * d.T)
    const mid = Math.floor(later.x.length * 0.5)
    expect(later.i[mid]).toBeLessThan(s.i[behind])
  })
})

describe('what the diagram declines', () => {
  it('a point off the line is declined', () => {
    const d = bounceDiagram(base)
    expect(() => d.at(3, 0)).toThrow(/must lie on the line/)
    expect(() => d.at(-1, 0)).toThrow(/must lie on the line/)
  })

  it('a source of infinite resistance launches nothing, and is declined', () => {
    expect(() => bounceDiagram({ ...base, Rs: Infinity })).toThrow(/launches nothing/)
  })

  it('a lossy line has no bounce diagram, and the message says why', () => {
    expect(() => requireLossless({ R: 0.5, L: 250e-9, G: 0, C: 100e-12 })).toThrow(FieldsError)
    try {
      requireLossless({ R: 0.5, L: 250e-9, G: 0, C: 100e-12 })
    } catch (e) {
      expect(e.message).toMatch(/step spreads as it travels/)
      expect(e.message).toMatch(/exact at every frequency/)
      expect(e.kind).toBe('lossy-line-in-time')
    }
  })

  it('a lossless line passes through requireLossless', () => {
    expect(requireLossless({ Z0: 50, vp: 2e8, len: 2 }).lossy).toBe(false)
  })

  it('a line given by its delay alone still works, one unit long', () => {
    const d = bounceDiagram({ Vs: 5, Rs: 25, Z0: 50, RL: 150, T: 1e-8 })
    expect(d.T).toBe(1e-8)
    expect(d.len).toBe(1)
    expect(relative(d.steady.v, d.steady.divider)).toBeLessThan(1e-13)
  })

  it('a line given as a line description takes its delay from it', () => {
    const d = bounceDiagram({ Vs: 5, Rs: 25, RL: 150, line: { Z0: 50, vp: 2e8, len: 2 } })
    expect(d.T * 1e9).toBeCloseTo(10, 9)
    expect(d.Z0).toBeCloseTo(50, 12)
  })
})
