import { describe, it, expect } from 'vitest'
import {
  autocorr,
  convolveFir,
  lmsStepBound,
  misadjustment,
  tailPower,
  weightError,
  wiener,
} from '@ee-labs/dsp'
import { byId } from '../experiments.js'
import { experimentState } from '../state.js'
import { adaptiveOf, costPerSample, reachAt, resolvePath } from '../measure.js'
import { PLANT, STEPS } from './c.js'

// Group C's numbers, measured on the chain the app runs.
//
// Every expectation is computed from the experiment's own parameters. The step
// bounds come from the taps and the measured input power, the convergence
// counts from the run's own weight history, and the floor from the noise that
// was actually added.

const state = (id) => experimentState(byId(id))
const at = (id, params) => {
  const s = state(id)
  return { ...s, blocks: [{ ...s.blocks[0], params: { ...s.blocks[0].params, ...params } }] }
}
const loud = (id, amp) => {
  const s = state(id)
  return { ...s, sources: [{ ...s.sources[0], amp }] }
}
const taps = (s) => PLANT.split(',').map(Number).length

describe('C1: the best fixed filter, and the equations that find it', () => {
  it('has an autocorrelation matrix whose diagonal is the input power', () => {
    const s = state('c1')
    const r = adaptiveOf(s)
    expect(resolvePath('lms.rdiag', s)).toBeCloseTo(autocorr(r.x, r.block.params.taps)[0], 12)
    // White noise is uncorrelated with itself at every lag but zero, so R is
    // the input power times the identity and the diagonal is that power.
    expect(resolvePath('lms.rdiag', s)).toBeCloseTo(resolvePath('lms.power', s), 6)
  })

  it('solves for the plant rather than searching for it', () => {
    const s = state('c1')
    const r = adaptiveOf(s)
    const w = wiener(r.x, r.d, r.block.params.taps)
    expect(resolvePath('lms.wiener', s)).toBeCloseTo(weightError(w.w, r.plant), 12)
    // With the same length as the plant and no noise, the answer is the plant.
    expect(r.block.params.taps).toBe(taps())
    expect(resolvePath('lms.wiener', s)).toBeLessThan(1e-3)
  })

  it('cannot hold the plant in fewer taps than the plant has', () => {
    const short = resolvePath('lms.wiener', at('c1', { taps: 4 }))
    const exact = resolvePath('lms.wiener', state('c1'))
    expect(short).toBeGreaterThan(100 * exact)
  })
})

describe('C2: LMS, the update in one line', () => {
  it('moves the first weight by exactly the step size times the error times the input', () => {
    const s = state('c2')
    const r = adaptiveOf(s)
    // The weights start at zero, so the output is zero and the error is the
    // whole of what was wanted. history[0] is the vector the run started from
    // and history[1] is the one after a single update.
    expect(r.history[0].every((v) => v === 0)).toBe(true)
    expect(r.history[1][0]).toBeCloseTo(s.blocks[0].params.mu * r.d[0] * r.x[0], 15)
  })

  it('reaches the plant, and prices the update at two multiplies a tap', () => {
    const s = state('c2')
    expect(resolvePath('lms.error', s)).toBeLessThan(1e-9)
    expect(resolvePath('lms.reach', s)).toBe(reachAt(adaptiveOf(s)))
    expect(resolvePath('lms.cost', s)).toBe(2 * s.blocks[0].params.taps)
  })
})

describe('C3: the step size, and the bound it cannot cross', () => {
  it('states both bounds from the taps and the measured input power', () => {
    const s = state('c3')
    const r = adaptiveOf(s)
    const b = lmsStepBound({ taps: r.block.params.taps, inputPower: r.inputPower })
    expect(resolvePath('lms.boundMean', s)).toBeCloseTo(b.mean, 12)
    expect(resolvePath('lms.bound', s)).toBeCloseTo(b.meanSquare, 12)
    expect(b.mean).toBeCloseTo(3 * b.meanSquare, 12)
  })

  it('converges under the bound and leaves for infinity at four times it', () => {
    const bound = resolvePath('lms.bound', state('c3'))
    for (const mu of [0.02, 0.25]) {
      expect(mu, 'inside the bound').toBeLessThanOrEqual(bound * 1.05)
      expect(resolvePath('lms.converged', at('c3', { mu })), `mu ${mu}`).toBe(true)
      expect(resolvePath('lms.diverged', at('c3', { mu })), `mu ${mu}`).toBe(false)
    }
    const far = 4 * bound
    expect(resolvePath('lms.diverged', at('c3', { mu: far }))).toBe(true)
    expect(resolvePath('lms.converged', at('c3', { mu: far }))).toBe(false)
  })

  it('is conservative, and the lesson says by how much', () => {
    // The bound rests on the weights being independent of the input, and they
    // are not, so a run can survive past it. This one does, at twice the
    // mean-square figure, and that is what the note claims.
    const bound = resolvePath('lms.bound', state('c3'))
    expect(resolvePath('lms.converged', at('c3', { mu: 2 * bound }))).toBe(true)
  })

  it('takes fewer samples at a larger step', () => {
    const counts = [0.02, 0.25, 0.5].map((mu) => resolvePath('lms.reach', at('c3', { mu })))
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThan(counts[i - 1])
  })
})

describe('C4: misadjustment, the price of a fast step', () => {
  it('measures the floor as the noise that was added to what was wanted', () => {
    const s = state('c4')
    const r = adaptiveOf(s)
    const amp = s.blocks[0].params.noiseAmp
    expect(resolvePath('lms.floor', s)).toBeCloseTo(tailPower(r.noise, r.noise.length), 12)
    // Uniform noise of amplitude A carries A squared over three a sample.
    expect(resolvePath('lms.floor', s)).toBeGreaterThan((0.9 * amp * amp) / 3)
    expect(resolvePath('lms.floor', s)).toBeLessThan((1.1 * amp * amp) / 3)
    // And it is what the plant cannot explain: what was wanted, minus the plant
    // applied to the input, is exactly that noise.
    const clean = convolveFir(r.x, r.plant)
    let acc = 0
    for (let i = 0; i < clean.length; i++) acc += (r.d[i] - clean[i] - r.noise[i]) ** 2
    expect(Math.sqrt(acc / clean.length)).toBeLessThan(1e-12)
  })

  it('halves the samples and doubles the excess as the step doubles', () => {
    const rows = STEPS.map((mu) => ({
      mu,
      reach: resolvePath('lms.reach', at('c4', { mu })),
      ratio: resolvePath('lms.ratio', at('c4', { mu })),
      excess: resolvePath('lms.misadjustment', at('c4', { mu })),
    }))
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].reach, `mu ${rows[i].mu}`).toBeLessThan(rows[i - 1].reach)
      expect(rows[i].ratio, `mu ${rows[i].mu}`).toBeGreaterThan(rows[i - 1].ratio)
      // Twice the step is twice the predicted excess, exactly, because the
      // prediction is linear in it.
      const scale = rows[i].mu / rows[i - 1].mu
      expect(rows[i].excess / rows[i - 1].excess).toBeCloseTo(scale, 9)
      // And about half the samples, which is the other half of the trade.
      expect(rows[i - 1].reach / rows[i].reach).toBeGreaterThan(scale * 0.6)
      expect(rows[i - 1].reach / rows[i].reach).toBeLessThan(scale * 1.7)
    }
  })

  it('settles under one plus the predicted excess, at every step', () => {
    for (const mu of STEPS) {
      const s = at('c4', { mu })
      const r = adaptiveOf(s)
      const bound = 1 + 1.25 * misadjustment({ mu, taps: r.block.params.taps, inputPower: r.inputPower })
      expect(resolvePath('lms.ratio', s), `mu ${mu}`).toBeLessThan(bound)
    }
  })
})

describe('C5: NLMS, and the step size made dimensionless', () => {
  it('keeps its convergence count when the level changes by ten', () => {
    const quiet = resolvePath('lms.reach', loud('c5', 1))
    const shout = resolvePath('lms.reach', loud('c5', 10))
    expect(shout).toBe(quiet)
    // A hundred times the power, and the same count of samples.
    expect(resolvePath('lms.power', loud('c5', 10)) / resolvePath('lms.power', loud('c5', 1))).toBeCloseTo(100, 6)
  })

  it('is what plain LMS cannot do at the same step size', () => {
    const asLms = { ...loud('c5', 10) }
    const lms = {
      ...asLms,
      blocks: [{ ...asLms.blocks[0], params: { ...asLms.blocks[0].params, algorithm: 'lms', mu: 0.02 } }],
    }
    const quietLms = {
      ...loud('c5', 1),
      blocks: [{ ...asLms.blocks[0], params: { ...asLms.blocks[0].params, algorithm: 'lms', mu: 0.02 } }],
    }
    expect(resolvePath('lms.diverged', quietLms)).toBe(false)
    expect(resolvePath('lms.diverged', lms)).toBe(true)
    // Because the bound moved with the level and the step size did not.
    const bound = resolvePath('lms.bound', lms)
    expect(0.02).toBeGreaterThan(bound)
  })

  it('prices the division at one more multiply a tap', () => {
    const s = state('c5')
    expect(resolvePath('lms.cost', s)).toBe(3 * s.blocks[0].params.taps)
    expect(costPerSample('lms', s.blocks[0].params.taps)).toBe(2 * s.blocks[0].params.taps)
  })
})

describe('C6: RLS, and what N squared buys', () => {
  it('orders the three algorithms by samples and by cost, the other way round', () => {
    const rows = [
      ['lms', { algorithm: 'lms', mu: 0.02 }],
      ['nlms', { algorithm: 'nlms', mu: 0.5 }],
      ['rls', { algorithm: 'rls' }],
    ].map(([name, params]) => ({
      name,
      reach: resolvePath('lms.reach', at('c6', params)),
      cost: resolvePath('lms.cost', at('c6', params)),
    }))
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].reach, rows[i].name).toBeLessThan(rows[i - 1].reach)
      expect(rows[i].cost, rows[i].name).toBeGreaterThan(rows[i - 1].cost)
    }
    const N = state('c6').blocks[0].params.taps
    expect(rows.map((r) => r.cost)).toEqual([2 * N, 3 * N, N * N])
  })

  it('reaches the plant in fewer samples than the filter has taps', () => {
    const s = state('c6')
    expect(resolvePath('lms.reach', s)).toBeLessThan(s.blocks[0].params.taps)
    expect(resolvePath('lms.error', s)).toBeLessThan(1e-6)
  })

  it('grows as N squared where LMS grows as N', () => {
    const wide = at('c6', { taps: 16 })
    const narrow = state('c6')
    expect(resolvePath('lms.cost', wide) / resolvePath('lms.cost', narrow)).toBe(4)
    const lmsNarrow = at('c6', { algorithm: 'lms', mu: 0.02 })
    const lmsWide = at('c6', { algorithm: 'lms', mu: 0.02, taps: 16 })
    expect(resolvePath('lms.cost', lmsWide) / resolvePath('lms.cost', lmsNarrow)).toBe(2)
  })
})

describe('C7: the echo canceller', () => {
  it('removes the echo and leaves the near-end voice behind', () => {
    const s = state('c7')
    const echo = resolvePath('lms.echo', s)
    const residual = resolvePath('lms.residual', s)
    const near = resolvePath('lms.near', s)
    expect(resolvePath('lms.erle', s)).toBeCloseTo(10 * Math.log10(echo / residual), 9)
    expect(resolvePath('lms.erle', s)).toBeGreaterThan(10)
    // A tone of amplitude A carries A squared over two.
    const amp = s.blocks[0].params.nearAmp
    expect(near).toBeCloseTo((amp * amp) / 2, 12)
    // What is left is the voice plus the misadjustment, and the voice is most
    // of it. No filter of the far-end input can produce a near-end voice.
    expect(residual).toBeGreaterThan(near)
    expect(residual).toBeLessThan(3 * near)
  })

  it('cancels to nothing when there is no near-end voice to leave behind', () => {
    const clean = at('c7', { nearAmp: 0 })
    expect(resolvePath('lms.residual', clean)).toBeLessThan(1e-20)
    expect(resolvePath('lms.erle', clean)).toBeGreaterThan(100)
  })

  it('needs enough taps to reach the end of the path', () => {
    // With the voice off the residue is the part of the path the filter could
    // not hold, so the tap count is the whole of what is left.
    const twelve = resolvePath('lms.erle', at('c7', { nearAmp: 0, taps: 12 }))
    const ten = resolvePath('lms.erle', at('c7', { nearAmp: 0, taps: 10 }))
    const eight = resolvePath('lms.erle', at('c7', { nearAmp: 0, taps: 8 }))
    expect(eight).toBeLessThan(ten)
    expect(ten).toBeLessThan(twelve)
    expect(eight).toBeGreaterThan(20)
    // With the voice on it dominates what is left, so the same four taps buy
    // less than half a decibel.
    expect(resolvePath('lms.erle', state('c7')) - resolvePath('lms.erle', at('c7', { taps: 8 }))).toBeLessThan(1)
  })
})
