import { describe, it, expect } from 'vitest'
import { rng } from '@ee-labs/random'
import { linearEqualiser, cascade, equaliserQuality, lmsEqualiser, lmsStable } from './eq.js'
import { channelResponse, twoRay, tapsReal } from './channel.js'

const TWO_RAY = tapsReal(twoRay(0.5, 4))
const DEEP = tapsReal(twoRay(0.9, 4))

describe('the zero-forcing equaliser', () => {
  const e = linearEqualiser({ channel: TWO_RAY, taps: 41 })
  const q = equaliserQuality({ channel: TWO_RAY, w: e.taps, delay: e.delay })

  it('leaves less than a thousandth of interference at 41 taps', () => {
    // The plan asks for this at 21 taps. At 21 the same solution leaves
    // 1.17e-2, because the channel's echo is four samples and its inverse needs
    // a tap every four out to the sixth power of the echo. NEEDS.md records it.
    expect(q.residual).toBeLessThan(1e-3)
  })

  it('leaves more with fewer taps, so the length is the knob', () => {
    let last = 0
    for (const taps of [41, 21, 11]) {
      const short = linearEqualiser({ channel: TWO_RAY, taps })
      const worse = equaliserQuality({ channel: TWO_RAY, w: short.taps, delay: short.delay })
      expect(worse.residual, `${taps} taps`).toBeGreaterThan(last)
      last = worse.residual
    }
  })

  it('finds a delay of nothing for this channel, because its inverse is causal', () => {
    expect(e.delay).toBe(0)
  })

  it('is the channel inverse, so the cascade is one at the delay and nothing elsewhere', () => {
    const c = cascade(TWO_RAY, e.taps)
    expect(c[e.delay]).toBeCloseTo(1, 3)
    for (let k = 0; k < c.length; k++) {
      if (k !== e.delay) expect(Math.abs(c[k]), `${k}`).toBeLessThan(1e-3)
    }
  })

  it('leaves a flat channel alone, apart from the delay', () => {
    const flat = Float64Array.from([1])
    const one = linearEqualiser({ channel: flat, taps: 11 })
    expect(one.taps[one.delay]).toBeCloseTo(1, 12)
  })

  it('amplifies noise where it inverts a notch', () => {
    const deep = linearEqualiser({ channel: DEEP, taps: 41 })
    const qd = equaliserQuality({ channel: DEEP, w: deep.taps, delay: deep.delay })
    expect(channelResponse(twoRay(0.9, 4), 8000, 4001).notchDb).toBeLessThan(
      channelResponse(twoRay(0.5, 4), 8000, 4001).notchDb,
    )
    expect(qd.noiseGainDb).toBeGreaterThan(q.noiseGainDb)
  })

  it('refuses a system it cannot solve rather than returning infinities', () => {
    expect(() => linearEqualiser({ channel: Float64Array.from([0]), taps: 5, delay: 0 })).toThrow(
      /singular/,
    )
  })
})

describe('the minimum mean-square equaliser', () => {
  it('trades residual interference for noise on the deeper notch', () => {
    const zf = linearEqualiser({ channel: DEEP, taps: 41, delay: 0, noiseVariance: 0 })
    const mmse = linearEqualiser({ channel: DEEP, taps: 41, delay: 0, noiseVariance: 0.05 })
    const qz = equaliserQuality({ channel: DEEP, w: zf.taps, delay: 0 })
    const qm = equaliserQuality({ channel: DEEP, w: mmse.taps, delay: 0 })
    expect(qm.residual).toBeGreaterThan(qz.residual)
    expect(qm.noiseGainDb).toBeLessThan(qz.noiseGainDb)
  })

  it('becomes the zero-forcing solution as the noise goes away', () => {
    const a = linearEqualiser({ channel: TWO_RAY, taps: 15, delay: 0, noiseVariance: 0 })
    const b = linearEqualiser({ channel: TWO_RAY, taps: 15, delay: 0, noiseVariance: 1e-12 })
    for (let i = 0; i < a.taps.length; i++) expect(b.taps[i]).toBeCloseTo(a.taps[i], 6)
  })
})

describe('the adaptive equaliser', () => {
  it('converges towards the taps the direct solution gives', () => {
    const direct = linearEqualiser({ channel: TWO_RAY, taps: 21, delay: 0 })
    const lms = lmsEqualiser({
      channel: TWO_RAY,
      taps: 21,
      mu: 0.02,
      symbols: 60000,
      delay: 0,
      rng: rng(1),
    })
    expect(lms.diverged).toBe(false)
    expect(lms.mse).toBeLessThan(0.05)
    let worst = 0
    for (let i = 0; i < 21; i++) worst = Math.max(worst, Math.abs(lms.taps[i] - direct.taps[i]))
    expect(worst).toBeLessThan(0.1)
  })

  it('learns, so the error falls from where it started', () => {
    const lms = lmsEqualiser({
      channel: TWO_RAY,
      taps: 21,
      mu: 0.02,
      symbols: 20000,
      delay: 0,
      rng: rng(2),
    })
    expect(lms.history.at(-1)).toBeLessThan(lms.history[0] / 2)
  })

  it('stops converging above the step size the bound names', () => {
    const bound = lmsStable(21, 1.25)
    const over = lmsEqualiser({
      channel: TWO_RAY,
      taps: 21,
      mu: 4 * bound,
      symbols: 5000,
      delay: 0,
      rng: rng(3),
    })
    expect(over.diverged).toBe(true)
  })

  it('says how large a step the recursion tolerates', () => {
    expect(lmsStable(21, 1)).toBeCloseTo(2 / 21, 12)
  })
})
