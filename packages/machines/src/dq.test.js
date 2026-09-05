import { describe, it, expect } from 'vitest'
import { CONVENTIONS, clarke, dq0, dqMatrix, fieldAt, invClarke, invDq0, invPark, park, power, rotatingField } from './dq.js'

const rand = (lo, hi) => lo + Math.random() * (hi - lo)
const TAU3 = (2 * Math.PI) / 3

describe('the rotating field', () => {
  const f = rotatingField({ amp: 3, omega: 2 * Math.PI * 50, poles: 4, turns: 120 })

  it('is one travelling wave, not three standing ones', () => {
    for (let k = 0; k < 500; k++) {
      const theta = rand(-20, 20)
      const t = rand(0, 0.2)
      expect(fieldAt(f, theta, t)).toBeCloseTo(f.amplitude * Math.cos(f.omega * t - theta), 9)
    }
  })

  it('has an amplitude of three halves one winding, at every instant', () => {
    expect(f.amplitude).toBeCloseTo(1.5 * 120 * 3, 12)
    for (let k = 0; k < 50; k++) {
      const t = rand(0, 0.2)
      let peak = 0
      for (let j = 0; j < 2000; j++) peak = Math.max(peak, Math.abs(fieldAt(f, (2 * Math.PI * j) / 2000, t)))
      expect(peak / f.amplitude).toBeCloseTo(1, 5)
    }
  })

  it('travels at 1500 rev/min on four poles at 50 Hz', () => {
    expect(f.rpmSync).toBeCloseTo(1500, 12)
    expect(f.omegaSync).toBeCloseTo((2 * Math.PI * 50 * 2) / 4, 12)
    expect(rotatingField({ omega: 2 * Math.PI * 50, poles: 2 }).rpmSync).toBeCloseTo(3000, 12)
  })

  it('refuses an odd number of poles', () => {
    expect(() => rotatingField({ poles: 3 })).toThrow(/even number of poles/)
  })
})

for (const name of Object.keys(CONVENTIONS)) {
  describe(`the dq transform, ${name}`, () => {
    it('inverts exactly at any angle', () => {
      for (let k = 0; k < 200; k++) {
        const abc = [rand(-10, 10), rand(-10, 10), rand(-10, 10)]
        const theta = rand(-20, 20)
        const back = invDq0(dq0(abc, theta, name), theta, name)
        for (let j = 0; j < 3; j++) expect(back[j]).toBeCloseTo(abc[j], 10)
      }
    })

    it('obeys its own power law', () => {
      for (let k = 0; k < 200; k++) {
        const v = [rand(-400, 400), rand(-400, 400), rand(-400, 400)]
        const i = [rand(-20, 20), rand(-20, 20), rand(-20, 20)]
        const theta = rand(-20, 20)
        const p = power(v, i, theta, name)
        expect(p.pDq / p.pAbc).toBeCloseTo(1, 9)
      }
    })

    it('makes a balanced set stand still', () => {
      const w = 2 * Math.PI * 50
      const amp = 325
      const first = dq0([0, -TAU3, TAU3].map((ph) => amp * Math.cos(ph)), 0, name)
      for (let k = 0; k < 40; k++) {
        const t = rand(0, 0.1)
        const abc = [0, -TAU3, TAU3].map((ph) => amp * Math.cos(w * t + ph))
        const d = dq0(abc, w * t, name)
        expect(d[0]).toBeCloseTo(first[0], 8)
        expect(d[1]).toBeCloseTo(first[1], 8)
        expect(d[2]).toBeCloseTo(0, 8)
      }
    })
  })
}

describe('the power-invariant matrix is orthogonal, and the other one is not', () => {
  it('K Kᵀ is the identity for the power-invariant convention', () => {
    const K = dqMatrix(0.7, 'power-invariant')
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++) {
        const dot = K[a][0] * K[b][0] + K[a][1] * K[b][1] + K[a][2] * K[b][2]
        expect(dot).toBeCloseTo(a === b ? 1 : 0, 12)
      }
  })

  it('the amplitude-invariant convention maps a peak of V to a radius of V', () => {
    const amp = 325
    const abc = [0, -TAU3, TAU3].map((ph) => amp * Math.cos(ph))
    const d = dq0(abc, 0, 'amplitude-invariant')
    expect(Math.hypot(d[0], d[1]) / amp).toBeCloseTo(1, 10)
    // In the power-invariant frame the same set has radius √(3/2) times it.
    const q = dq0(abc, 0, 'power-invariant')
    expect(Math.hypot(q[0], q[1]) / amp).toBeCloseTo(Math.sqrt(1.5), 10)
  })

  it('carries its power law as a sentence, so a caller cannot lose it', () => {
    expect(CONVENTIONS['power-invariant'].power).toMatch(/v_d i_d/)
    expect(CONVENTIONS['amplitude-invariant'].power).toMatch(/3\/2/)
    expect(CONVENTIONS['amplitude-invariant'].torqueFactor).toBeCloseTo(1.5, 12)
  })

  it('refuses a convention it does not have', () => {
    expect(() => dq0([1, 2, 3], 0, 'nonesuch')).toThrow(/unknown dq convention/)
  })
})

describe('Clarke and Park separately', () => {
  it('compose into the same transform as dq0', () => {
    for (let k = 0; k < 100; k++) {
      const abc = [rand(-10, 10), rand(-10, 10), rand(-10, 10)]
      const theta = rand(-10, 10)
      const two = park(clarke(abc), theta)
      const one = dq0(abc, theta)
      for (let j = 0; j < 3; j++) expect(two[j]).toBeCloseTo(one[j], 10)
    }
  })

  it('each inverts on its own', () => {
    for (let k = 0; k < 60; k++) {
      const ab = [rand(-10, 10), rand(-10, 10), rand(-10, 10)]
      const theta = rand(-10, 10)
      const back = invPark(park(ab, theta), theta)
      for (let j = 0; j < 3; j++) expect(back[j]).toBeCloseTo(ab[j], 10)
      const abc = invClarke(ab)
      const fwd = clarke(abc)
      for (let j = 0; j < 3; j++) expect(fwd[j]).toBeCloseTo(ab[j], 10)
    }
  })
})
