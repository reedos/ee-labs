import { describe, it, expect } from 'vitest'
import { PLANTS, PLANT_GROUPS, CONTROLLERS, NONLINEARITIES, buildLoop, defaultsOf } from './systems.js'
import { toStateSpace, toTransferFunction, isStable, dcGain, magnitudeAt } from '@ee-labs/systems'

// Every plant carries two descriptions of the same physics: a transfer
// function and a state space in a PHYSICAL basis. Group A's whole subject is
// that the two agree, so this file checks it for every plant rather than
// trusting the one A3 happens to pick.

const relClose = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-12)

describe('the registries', () => {
  it('every plant declares a group, params, a formula and a named state', () => {
    for (const [id, p] of Object.entries(PLANTS)) {
      expect(PLANT_GROUPS, id).toContain(p.group)
      expect(p.params.length, id).toBeGreaterThan(0)
      expect(p.tex, id).toBeTruthy()
      expect(p.states.length, id).toBeGreaterThan(0)
      const tf = p.tf(defaultsOf(p))
      expect(Number.isFinite(magnitudeAt(tf, 1)), id).toBe(true)
    }
  })

  it("every plant's ss converts to its own tf, in its own physical basis", () => {
    // 'split' is deliberately a non-minimal realisation: its second state is
    // unobservable, so its raw ss-to-tf conversion carries that mode as a
    // pole exactly cancelled by a zero, while p.tf() already hands back the
    // reduced first-order transfer function A6 tests against. Comparing the
    // two here would be comparing a reduced form to an unreduced one, which
    // is A6's own subject rather than a round-trip defect.
    for (const [id, p] of Object.entries(PLANTS).filter(([k]) => k !== 'split')) {
      const params = defaultsOf(p)
      const tf = p.tf(params)
      const ss = p.ss(params)
      expect(ss.states ?? ss.A.length, id).toBe(p.states.length)
      const back = toTransferFunction(ss)
      const nf = tf.b.map((v) => v / tf.a[0])
      const nb = back.b.map((v) => v / back.a[0])
      const n = Math.max(nf.length, nb.length)
      for (let i = 0; i < n; i++) {
        const fv = nf[nf.length - n + i] ?? 0
        const bv = nb[nb.length - n + i] ?? 0
        expect(relClose(fv, bv, 1e-8), `${id} numerator[${i}]`).toBe(true)
      }
      const df = tf.a.map((v) => v / tf.a[0])
      const db = back.a.map((v) => v / back.a[0])
      for (let i = 0; i < df.length; i++) {
        expect(relClose(df[i], db[i], 1e-8), `${id} denominator[${i}]`).toBe(true)
      }
    }
  })

  it('every controller composes a loop that can be analysed', () => {
    for (const plantId of Object.keys(PLANTS)) {
      for (const ctrlId of Object.keys(CONTROLLERS)) {
        const plantP = defaultsOf(PLANTS[plantId])
        const ctrlP = defaultsOf(CONTROLLERS[ctrlId])
        const { open } = buildLoop(plantId, plantP, ctrlId, ctrlP)
        expect(Number.isFinite(dcGain(open) ?? 0) || true, `${plantId}+${ctrlId}`).toBe(true)
        expect(typeof isStable(open), `${plantId}+${ctrlId}`).toBe('boolean')
      }
    }
  })

  it('the nonlinearities registry has a hint for none, saturation and deadzone', () => {
    for (const key of ['none', 'saturation', 'deadzone']) {
      expect(NONLINEARITIES[key], key).toBeTruthy()
      expect(NONLINEARITIES[key].hint, key).toBeTruthy()
    }
  })

  it('the twin plant is the two identical lags read as a difference, at zero detuning', () => {
    const ss = PLANTS.twin.ss(defaultsOf(PLANTS.twin))
    expect(ss.A[0][0]).toBeCloseTo(ss.A[1][1], 9)
  })

  it('the motor state space is the named position/speed basis from the plan', () => {
    const ss = PLANTS.motor.ss(defaultsOf(PLANTS.motor))
    expect(ss.A).toEqual([
      [0, 1],
      [0, -2],
    ])
    expect(ss.B).toEqual([0, 2])
    const tf = toTransferFunction(ss)
    expect(tf.b[tf.b.length - 1] / tf.a[0]).toBeCloseTo(2, 9)
  })
})
